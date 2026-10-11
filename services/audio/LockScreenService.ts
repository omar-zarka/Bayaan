/**
 * LockScreenService - Bridges playerStore state to system lock screen controls
 *
 * Uses expo-audio's built-in lock screen API (setActiveForLockScreen / updateLockScreenMetadata).
 * Remote commands (play, pause, seek, skip) are handled natively by expo-audio — no JS routing needed.
 *
 * This service only manages: which player is active for lock screen, and metadata updates.
 */

import {Platform} from 'react-native';
import type {AudioPlayer, AudioMetadata} from 'expo-audio';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {expoAudioService} from './ExpoAudioService';
import {mushafAudioService} from './MushafAudioService';
import {audioCoordinator} from './AudioCoordinator';

class LockScreenService {
  private static instance: LockScreenService;
  private storeUnsubscribe: (() => void) | null = null;
  private mushafStoreUnsubscribe: (() => void) | null = null;
  private lastTrackId: string | null = null;
  private isMushafActive = false;
  private lastMushafVerseKey: string | null = null;
  private carMode = false;
  private carAyahLabel: string | null = null;

  private constructor() {}

  static getInstance(): LockScreenService {
    if (!LockScreenService.instance) {
      LockScreenService.instance = new LockScreenService();
    }
    return LockScreenService.instance;
  }

  /**
   * Start syncing store state to lock screen metadata.
   * expo-audio handles remote commands and playback state natively.
   */
  async startSync(): Promise<void> {
    this.subscribeToStore();
    this.subscribeToMushafStore();
    this.syncCurrentState();

    if (__DEV__) console.log('[LockScreenService] Sync started');
  }

  /**
   * Stop all syncing and clear lock screen.
   */
  stopSync(): void {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    if (this.mushafStoreUnsubscribe) {
      this.mushafStoreUnsubscribe();
      this.mushafStoreUnsubscribe = null;
    }

    // Clear lock screen for both players
    this.clearPlayer(expoAudioService.getPlayer());
    this.clearPlayer(mushafAudioService.getPlayer());

    this.lastTrackId = null;
    this.isMushafActive = false;
    this.lastMushafVerseKey = null;

    if (__DEV__) console.log('[LockScreenService] Sync stopped');
  }

  /**
   * Alias for stopSync — no separate native teardown needed with expo-audio.
   */
  async cleanup(): Promise<void> {
    this.stopSync();
    if (__DEV__) console.log('[LockScreenService] Cleaned up');
  }

  /**
   * While a car is connected, hide the 10s skip buttons so CarPlay shows
   * previous / next surah instead. Restored on disconnect. On Android this
   * only affects the phone notification.
   */
  setCarMode(enabled: boolean): void {
    if (this.carMode === enabled) return;
    this.carMode = enabled;
    if (this.isMushafActive) return;
    const {queue} = usePlayerStore.getState();
    const track = queue.tracks[queue.currentIndex];
    if (track) this.activateMainPlayer(track);
  }

  /**
   * Car mode only: the current ayah ("Ayah 12 of 110") shown after the
   * reciter on CarPlay's Now Playing, which reads the lock screen metadata.
   * iOS only: Android Auto reads the car bridge's now playing instead, and
   * expo-audio on Android reloads the artwork on every metadata update.
   * Null clears it.
   */
  setCarAyahLabel(label: string | null): void {
    if (Platform.OS !== 'ios') return;
    if (this.carAyahLabel === label) return;
    this.carAyahLabel = label;
    if (this.isMushafActive) return;
    const player = expoAudioService.getPlayer();
    const {queue} = usePlayerStore.getState();
    const track = queue.tracks[queue.currentIndex];
    if (!player || !track) return;
    try {
      player.updateLockScreenMetadata(this.mainMetadata(track));
    } catch {
      // Player may not be active for the lock screen yet
    }
  }

  // ========== PRIVATE ==========

  private clearPlayer(player: AudioPlayer | null): void {
    try {
      player?.clearLockScreenControls();
    } catch {
      // Player may already be removed
    }
  }

  private syncCurrentState(): void {
    const state = usePlayerStore.getState();
    const {queue} = state;
    const currentTrack = queue.tracks[queue.currentIndex];

    if (currentTrack) {
      this.lastTrackId = currentTrack.id;
      this.activateMainPlayer(currentTrack);
    }
  }

  private mainMetadata(track: {
    title: string;
    artist: string;
    artwork?: string;
  }): AudioMetadata {
    const label = this.carMode ? this.carAyahLabel : null;
    return {
      title: track.title,
      artist: label ? `${track.artist} · ${label}` : track.artist,
      artworkUrl: track.artwork,
    };
  }

  private activateMainPlayer(track: {
    title: string;
    artist: string;
    artwork?: string;
    duration?: number;
  }): void {
    const player = expoAudioService.getPlayer();
    if (!player) return;

    const metadata = this.mainMetadata(track);

    try {
      player.setActiveForLockScreen(true, metadata, {
        showSeekForward: !this.carMode,
        showSeekBackward: !this.carMode,
      });
    } catch (error) {
      if (__DEV__)
        console.warn(
          '[LockScreenService] Failed to activate main player:',
          error,
        );
    }
  }

  private activateMushafPlayer(title: string, artist: string): void {
    const player = mushafAudioService.getPlayer();
    if (!player) return;

    // Deactivate main player first
    this.clearPlayer(expoAudioService.getPlayer());

    const metadata: AudioMetadata = {
      title,
      artist,
    };

    try {
      player.setActiveForLockScreen(true, metadata, {
        showSeekForward: false,
        showSeekBackward: false,
      });
    } catch (error) {
      if (__DEV__)
        console.warn(
          '[LockScreenService] Failed to activate mushaf player:',
          error,
        );
    }
  }

  private subscribeToStore(): void {
    this.storeUnsubscribe = usePlayerStore.subscribe(state => {
      if (this.isMushafActive) return;

      const {queue} = state;
      const currentTrack = queue.tracks[queue.currentIndex];

      // Update when track changes
      if (currentTrack && currentTrack.id !== this.lastTrackId) {
        this.lastTrackId = currentTrack.id;
        this.activateMainPlayer(currentTrack);
      }
    });
  }

  private subscribeToMushafStore(): void {
    this.mushafStoreUnsubscribe = useMushafPlayerStore.subscribe(state => {
      const {playbackState, currentVerseKey, reciterName, currentSurah} = state;

      // Detect mushaf becoming active
      if (playbackState === 'playing' || playbackState === 'loading') {
        if (!this.isMushafActive) {
          this.isMushafActive = true;
          if (__DEV__)
            console.log('[LockScreenService] Mushaf override activated');
        }
      }

      // Update metadata when verse changes
      if (this.isMushafActive && currentVerseKey !== this.lastMushafVerseKey) {
        this.lastMushafVerseKey = currentVerseKey;

        if (currentVerseKey && currentSurah > 0) {
          try {
            const surahData = require('@/data/surahData.json');
            const surah = surahData.find(
              (s: {id: number; name: string}) => s.id === currentSurah,
            );
            const title = surah
              ? `${surah.name} · ${currentVerseKey}`
              : currentVerseKey;

            const player = mushafAudioService.getPlayer();
            if (player) {
              player.updateLockScreenMetadata({
                title,
                artist: reciterName || 'Quran',
              });
            }
          } catch {
            // Silently ignore metadata update failures
          }
        }
      }

      // Detect mushaf becoming idle — revert to main player
      if (this.isMushafActive && playbackState === 'idle') {
        this.isMushafActive = false;
        this.lastMushafVerseKey = null;

        // Clear mushaf lock screen and restore main player
        this.clearPlayer(mushafAudioService.getPlayer());
        this.lastTrackId = null;
        this.syncCurrentState();

        if (__DEV__) console.log('[LockScreenService] Mushaf override cleared');
      }
    });
  }
}

export const lockScreenService = LockScreenService.getInstance();

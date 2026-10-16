/**
 * Adhkar Play All Store
 *
 * Manages queue and state for sequential "Play All" adhkar playback.
 * Works alongside adhkarAudioStore - this store manages the queue,
 * while adhkarAudioStore manages the actual player intent.
 */

import {create} from 'zustand';
import {Dhikr} from '@/types/adhkar';
import {useAdhkarAudioStore} from '@/store/adhkarAudioStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {hasAudio} from '@/utils/adhkarAudio';

type SourceType = 'morning' | 'evening' | 'saved' | 'other';

/** First index at or after `from` whose dhikr has bundled audio, or -1. */
export function nextPlayableIndex(
  queue: readonly Dhikr[],
  from: number,
): number {
  for (let i = Math.max(0, from); i < queue.length; i++) {
    if (hasAudio(queue[i].audioFile)) return i;
  }
  return -1;
}

/** Last index at or before `from` whose dhikr has bundled audio, or -1. */
function previousPlayableIndex(queue: readonly Dhikr[], from: number): number {
  for (let i = Math.min(from, queue.length - 1); i >= 0; i--) {
    if (hasAudio(queue[i].audioFile)) return i;
  }
  return -1;
}

interface AdhkarPlayAllState {
  // Mode
  isPlayAllMode: boolean;

  // Queue
  queue: Dhikr[];
  currentIndex: number;

  // Source identification
  sourceType: SourceType | null;
  sourceId: string | null;

  // Playback intent
  isPlaying: boolean;
}

interface AdhkarPlayAllActions {
  // Start Play All with a list of adhkar. Returns the index playback starts
  // at (the first row with audio at or after startIndex), or -1 if none.
  startPlayAll: (
    adhkarList: Dhikr[],
    startIndex: number,
    sourceType: SourceType,
    sourceId: string,
  ) => number;

  // Stop Play All and reset
  stopPlayAll: () => void;

  // Navigation
  advanceToNext: () => boolean; // Returns false if at end
  goToPrevious: () => boolean; // Returns false if at start
  goToIndex: (index: number) => void;

  // Playback control
  play: () => void;
  pause: () => void;
  toggle: () => void;

  // Get current dhikr
  getCurrentDhikr: () => Dhikr | null;
}

export const useAdhkarPlayAllStore = create<
  AdhkarPlayAllState & AdhkarPlayAllActions
>((set, get) => ({
  // Initial state
  isPlayAllMode: false,
  queue: [],
  currentIndex: 0,
  sourceType: null,
  sourceId: null,
  isPlaying: false,

  startPlayAll: (adhkarList, startIndex, sourceType, sourceId) => {
    const first = nextPlayableIndex(
      adhkarList,
      Math.min(startIndex, adhkarList.length - 1),
    );
    if (first < 0) return -1;

    // Stop single-dhikr playback
    useAdhkarAudioStore.getState().pause();

    // Pause main Quran player if it's playing
    const mainPlayerState = usePlayerStore.getState();
    if (mainPlayerState.playback.state === 'playing') {
      mainPlayerState.pause();
    }

    set({
      isPlayAllMode: true,
      queue: adhkarList,
      currentIndex: first,
      sourceType,
      sourceId,
      isPlaying: true,
    });
    return first;
  },

  stopPlayAll: () => {
    set({
      isPlayAllMode: false,
      queue: [],
      currentIndex: 0,
      sourceType: null,
      sourceId: null,
      isPlaying: false,
    });
  },

  advanceToNext: () => {
    const {queue, currentIndex, isPlayAllMode} = get();
    if (!isPlayAllMode) return false;

    // Rows without audio are skipped; they have nothing to play.
    const next = nextPlayableIndex(queue, currentIndex + 1);
    if (next >= 0) {
      set({currentIndex: next});
      return true;
    }
    // End of queue - stop Play All
    get().stopPlayAll();
    return false;
  },

  goToPrevious: () => {
    const {queue, currentIndex, isPlayAllMode} = get();
    if (!isPlayAllMode) return false;

    // Rows without audio are skipped, as in advanceToNext.
    const previous = previousPlayableIndex(queue, currentIndex - 1);
    if (previous >= 0) {
      set({currentIndex: previous});
      return true;
    }
    return false;
  },

  goToIndex: index => {
    const {queue, isPlayAllMode} = get();
    if (!isPlayAllMode) return;

    if (index >= 0 && index < queue.length) {
      // A row without audio cannot play: pause there instead of leaving the
      // player waiting on a track that never starts.
      if (hasAudio(queue[index].audioFile)) {
        set({currentIndex: index});
      } else {
        set({currentIndex: index, isPlaying: false});
      }
    }
  },

  play: () => {
    const {isPlayAllMode, queue, currentIndex} = get();
    if (!isPlayAllMode) return;

    const playable = nextPlayableIndex(queue, currentIndex);
    if (playable < 0) {
      get().stopPlayAll();
      return;
    }

    // Pause main Quran player if it's playing
    const mainPlayerState = usePlayerStore.getState();
    if (mainPlayerState.playback.state === 'playing') {
      mainPlayerState.pause();
    }

    set({currentIndex: playable, isPlaying: true});
  },

  pause: () => {
    set({isPlaying: false});
  },

  toggle: () => {
    const {isPlaying, isPlayAllMode} = get();
    if (!isPlayAllMode) return;

    if (isPlaying) {
      get().pause();
    } else {
      get().play();
    }
  },

  getCurrentDhikr: () => {
    const {queue, currentIndex, isPlayAllMode} = get();
    if (!isPlayAllMode || queue.length === 0) return null;
    return queue[currentIndex] || null;
  },
}));

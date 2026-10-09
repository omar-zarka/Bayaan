// services/widgets/collectSnapshotInput.ts
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useReciterStore} from '@/store/reciterStore';
import {useThemeStore} from '@/store/themeStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {getSurahOfTheDay} from '@/utils/quranPages';
import {hasArtwork} from 'bayaan-widgets';
import {artworkFileName, SnapshotInput} from './buildSnapshot';

const OPENING_WORDS = 6;

function openingTextForPage(page: number): string {
  if (!digitalKhattDataService.initialized) return '';
  const firstKey = mushafVerseMapService.getOrderedVerseKeysForPage(page)[0];
  if (!firstKey) return '';
  return digitalKhattDataService
    .getVerseText(firstKey)
    .split(' ')
    .slice(0, OPENING_WORDS)
    .join(' ');
}

export function collectSnapshotInput(now: Date): SnapshotInput {
  const player = usePlayerStore.getState();
  const reciter = useReciterStore.getState().defaultReciter;
  return {
    now: now.getTime(),
    theme: useThemeStore.getState().themeMode,
    queueTracks: player.queue.tracks,
    currentIndex: player.queue.currentIndex,
    isPlaying: player.playback.state === 'playing',
    positionSec: player.playback.position,
    durationSec: player.playback.duration,
    rate: player.playback.rate,
    recentTracks: useRecentlyPlayedStore.getState().recentTracks,
    defaultReciter: reciter.id === '' ? null : reciter,
    lastReadPage: mushafSessionStore.getLastReadPage(),
    openingTextForPage,
    tasbeeh: {}, // filled in Plan 1b
    artworkFileFor: id => {
      const file = artworkFileName(id);
      return hasArtwork(file) ? file : null;
    },
    surahOfTheDayId: getSurahOfTheDay(now).id,
  };
}

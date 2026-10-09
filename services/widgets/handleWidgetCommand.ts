import type {WidgetCommand} from 'bayaan-widgets/src/commands';
import type {Reciter} from '@/data/reciterData';
import type {Track} from '@/types/audio';
import {createTrack} from '@/utils/track';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {useReciterStore} from '@/store/reciterStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import type {AyahTimestamp} from '@/types/timestamps';
import {timestampService} from '@/services/timestamps/TimestampService';

const DEFAULT_SURAH_FOR_RECITER = 1;

export interface CommandDeps {
  getReciter: (id: string) => Reciter | undefined;
  getDefaultReciter: () => Reciter | null;
  isPlaying: () => boolean;
  hasCurrentTrack: () => boolean;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  playTracks: (tracks: Track[], startSec: number) => Promise<void>;
  lastSurahForReciter: (reciterId: string) => number | null;
  ayahStartSec: (
    rewayatId: string,
    surahId: number,
    ayah: number,
  ) => Promise<number | null>;
}

export function ayahStartSecFrom(
  list: AyahTimestamp[] | null,
  ayah: number,
): number | null {
  const hit = list?.find(t => t.ayahNumber === ayah);
  return hit ? hit.timestampFrom / 1000 : null;
}

export function defaultDeps(): CommandDeps {
  return {
    getReciter: id => getReciterByIdSync(id),
    getDefaultReciter: () => {
      const r = useReciterStore.getState().defaultReciter;
      return r.id === '' ? null : r;
    },
    isPlaying: () => usePlayerStore.getState().playback.state === 'playing',
    hasCurrentTrack: () => {
      const {queue} = usePlayerStore.getState();
      return queue.tracks[queue.currentIndex] !== undefined;
    },
    play: () => usePlayerStore.getState().play(),
    pause: () => usePlayerStore.getState().pause(),
    playTracks: async (tracks, startSec) => {
      const store = usePlayerStore.getState();
      await store.updateQueue(tracks, 0, startSec);
      await store.play();
    },
    lastSurahForReciter: reciterId => {
      const hit = useRecentlyPlayedStore
        .getState()
        .recentTracks.find(r => r.reciter.id === reciterId);
      return hit ? hit.surah.id : null;
    },
    ayahStartSec: async (rewayatId, surahId, ayah) => {
      const list = await timestampService.getTimestampsForSurah(
        rewayatId,
        surahId,
      );
      return ayahStartSecFrom(list, ayah);
    },
  };
}

async function playSurah(
  reciter: Reciter,
  surahId: number,
  rewayatId: string | null,
  ayah: number | null,
  deps: CommandDeps,
): Promise<void> {
  const surah = getSurahById(surahId);
  if (!surah) return;
  const track = await createTrack(reciter, surah, rewayatId ?? undefined);
  const resolvedRewayat = track.rewayatId ?? reciter.rewayat[0]?.id;
  const startSec =
    ayah !== null && resolvedRewayat
      ? (await deps.ayahStartSec(resolvedRewayat, surahId, ayah)) ?? 0
      : 0;
  await deps.playTracks([track], startSec);
}

export async function handleWidgetCommand(
  command: WidgetCommand,
  deps: CommandDeps = defaultDeps(),
): Promise<void> {
  switch (command.type) {
    case 'togglePlayback': {
      if (!deps.hasCurrentTrack()) return;
      if (deps.isPlaying()) {
        await deps.pause();
        return;
      }
      await deps.play();
      return;
    }
    case 'playTrack': {
      const reciter = command.reciterId
        ? deps.getReciter(command.reciterId)
        : deps.getDefaultReciter();
      if (!reciter) return;
      await playSurah(
        reciter,
        command.surahId,
        command.rewayatId,
        command.ayah,
        deps,
      );
      return;
    }
    case 'playReciter': {
      const reciter = deps.getReciter(command.reciterId);
      if (!reciter) return;
      const surahId =
        deps.lastSurahForReciter(reciter.id) ?? DEFAULT_SURAH_FOR_RECITER;
      await playSurah(reciter, surahId, null, null, deps);
      return;
    }
  }
}

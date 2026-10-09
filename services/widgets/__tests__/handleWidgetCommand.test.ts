import {
  handleWidgetCommand,
  ayahStartSecFrom,
  CommandDeps,
  RecentMatch,
} from '../handleWidgetCommand';
import {createTrack} from '@/utils/track';
import {getSurahById} from '@/services/dataService';
import type {AyahTimestamp} from '@/types/timestamps';
import type {Reciter} from '@/data/reciterData';
import type {Track} from '@/types/audio';

jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(
    async (_r: unknown, surah: {id: number}, rewayatId?: string) => ({
      id: `x-${surah.id}`,
      url: '',
      title: '',
      artist: '',
      reciterId: 'r1',
      reciterName: 'R',
      surahId: String(surah.id),
      rewayatId: rewayatId ?? 'rw1',
    }),
  ),
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => undefined,
  getSurahById: jest.fn((id: number) => ({id})),
}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: {}}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {},
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {},
}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {},
}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {},
}));
jest.mock('@/services/player/utils/resumeRecent', () => ({
  resumeRecent: jest.fn(),
}));
jest.mock('@/services/player/utils/restoreSession', () => ({
  pendingRestoreLoad: () => Promise.resolve(),
}));

const reciter: Reciter = {
  id: 'r1',
  name: 'R',
  date: null,
  image_url: null,
  rewayat: [
    {
      id: 'rw1',
      reciter_id: 'r1',
      name: 'Hafs',
      style: 'murattal',
      server: '',
      surah_total: 114,
      surah_list: [],
      source_type: '',
      created_at: '',
    },
  ],
};

function deps(
  over: Partial<CommandDeps> = {},
): CommandDeps & {calls: string[]} {
  const calls: string[] = [];
  return {
    calls,
    getReciter: id => (id === 'r1' ? reciter : undefined),
    getDefaultReciter: () => reciter,
    playbackState: () => 'paused',
    hasCurrentTrack: () => true,
    isAudioLoaded: () => true,
    loadAndPlayCurrent: async () => void calls.push('loadAndPlayCurrent'),
    play: async () => void calls.push('play'),
    pause: async () => void calls.push('pause'),
    playTracks: async (tracks: Track[], startSec: number) =>
      void calls.push(`playTracks:${tracks[0].surahId}@${startSec}`),
    lastSurahForReciter: () => 67,
    upNextIndexOf: () => null,
    playQueueIndex: async (index: number, startSec?: number) =>
      void calls.push(`playQueueIndex:${index}@${startSec ?? 0}`),
    resumeChain: (recentIndex: number) =>
      void calls.push(`resumeChain:${recentIndex}`),
    findRecent: () => null,
    resumeRecent: async (m: RecentMatch) =>
      void calls.push(`resumeRecent:${m.surahId}@${m.startPosition}`),
    ayahStartSec: async (rewayatId: string) => {
      calls.push(`ayahStartSec:${rewayatId}`);
      return 42;
    },
    ...over,
  };
}

describe('handleWidgetCommand', () => {
  it('setPlayback plays when paused and pauses when playing', async () => {
    const d = deps();
    await handleWidgetCommand({type: 'setPlayback', playing: true}, d);
    expect(d.calls).toEqual(['play']);
    const d2 = deps({playbackState: () => 'playing'});
    await handleWidgetCommand({type: 'setPlayback', playing: false}, d2);
    expect(d2.calls).toEqual(['pause']);
  });

  it('setPlayback(false) pauses in any state, including ready', async () => {
    for (const state of ['ready', 'paused', 'loading'] as const) {
      const d = deps({playbackState: () => state});
      await handleWidgetCommand({type: 'setPlayback', playing: false}, d);
      expect(d.calls).toEqual(['pause']);
    }
  });

  it('setPlayback(true) is a no-op when already playing', async () => {
    const playing = deps({playbackState: () => 'playing'});
    await handleWidgetCommand({type: 'setPlayback', playing: true}, playing);
    expect(playing.calls).toEqual([]);
  });

  it('treats loading and buffering as already starting', async () => {
    for (const state of ['loading', 'buffering'] as const) {
      const d = deps({playbackState: () => state});
      await handleWidgetCommand({type: 'setPlayback', playing: true}, d);
      expect(d.calls).toEqual([]);
    }
  });

  it('loads and autoplays the restored track on a cold start', async () => {
    const d = deps({isAudioLoaded: () => false, playbackState: () => 'none'});
    await handleWidgetCommand({type: 'setPlayback', playing: true}, d);
    expect(d.calls).toEqual(['loadAndPlayCurrent']);
  });

  it('plays a surah with the default reciter from an ayah', async () => {
    const d = deps();
    await handleWidgetCommand(
      {
        type: 'playTrack',
        surahId: 18,
        reciterId: null,
        rewayatId: null,
        ayah: 10,
      },
      d,
    );
    expect(d.calls).toEqual(['ayahStartSec:rw1', 'playTracks:18@42']);
  });

  it('starts at 0 when no timestamps exist', async () => {
    const d = deps({ayahStartSec: async () => null});
    await handleWidgetCommand(
      {
        type: 'playTrack',
        surahId: 18,
        reciterId: 'r1',
        rewayatId: 'rw1',
        ayah: 10,
      },
      d,
    );
    expect(d.calls).toEqual(['playTracks:18@0']);
  });

  it('ignores unknown reciters without throwing', async () => {
    const d = deps();
    await handleWidgetCommand({type: 'playReciter', reciterId: 'missing'}, d);
    expect(d.calls).toEqual([]);
  });

  it('resumes the last surah for a reciter', async () => {
    const d = deps();
    await handleWidgetCommand({type: 'playReciter', reciterId: 'r1'}, d);
    expect(d.calls).toEqual(['playTracks:67@0']);
  });

  it('setPlayback with nothing queued does nothing', async () => {
    const d = deps({hasCurrentTrack: () => false});
    await handleWidgetCommand({type: 'setPlayback', playing: true}, d);
    expect(d.calls).toEqual([]);
  });

  it('carries rewayatId through createTrack and the timestamp lookup', async () => {
    const d = deps();
    await handleWidgetCommand(
      {
        type: 'playTrack',
        surahId: 18,
        reciterId: 'r1',
        rewayatId: 'rw2',
        ayah: 10,
      },
      d,
    );
    expect(createTrack).toHaveBeenLastCalledWith(reciter, {id: 18}, 'rw2');
    expect(d.calls).toEqual(['ayahStartSec:rw2', 'playTracks:18@42']);
  });

  it('picks a rewayah that has the surah when rewayatId is null', async () => {
    const partial = {
      ...reciter.rewayat[0],
      id: 'rwPartial',
      surah_total: 6,
      surah_list: [1, 2, 3],
    };
    const full = {
      ...reciter.rewayat[0],
      id: 'rwFull',
      surah_total: 114,
      surah_list: [1, 2, 3, 55],
    };
    const multi: Reciter = {...reciter, rewayat: [partial, full]};
    const d = deps({getReciter: () => multi});
    await handleWidgetCommand(
      {
        type: 'playTrack',
        surahId: 55,
        reciterId: 'r1',
        rewayatId: null,
        ayah: null,
      },
      d,
    );
    expect(createTrack).toHaveBeenLastCalledWith(multi, {id: 55}, 'rwFull');
  });

  it('prefers the fuller rewayah when several have the surah', async () => {
    const partial = {
      ...reciter.rewayat[0],
      id: 'rwPartial',
      surah_total: 6,
      surah_list: [1, 2],
    };
    const full = {
      ...reciter.rewayat[0],
      id: 'rwFull',
      surah_total: 114,
      surah_list: [1, 2],
    };
    const multi: Reciter = {...reciter, rewayat: [partial, full]};
    const d = deps({getReciter: () => multi});
    await handleWidgetCommand(
      {
        type: 'playTrack',
        surahId: 2,
        reciterId: 'r1',
        rewayatId: null,
        ayah: null,
      },
      d,
    );
    expect(createTrack).toHaveBeenLastCalledWith(multi, {id: 2}, 'rwFull');
  });

  it('does nothing when the default reciter is a placeholder', async () => {
    const d = deps({getDefaultReciter: () => null});
    await handleWidgetCommand(
      {
        type: 'playTrack',
        surahId: 18,
        reciterId: null,
        rewayatId: null,
        ayah: null,
      },
      d,
    );
    expect(d.calls).toEqual([]);
  });

  it('does nothing for an unknown reciterId on playTrack', async () => {
    const d = deps();
    await handleWidgetCommand(
      {
        type: 'playTrack',
        surahId: 18,
        reciterId: 'missing',
        rewayatId: null,
        ayah: null,
      },
      d,
    );
    expect(d.calls).toEqual([]);
  });

  it('does nothing for an unknown surah', async () => {
    jest.mocked(getSurahById).mockReturnValueOnce(undefined);
    const d = deps();
    await handleWidgetCommand(
      {
        type: 'playTrack',
        surahId: 18,
        reciterId: 'r1',
        rewayatId: null,
        ayah: null,
      },
      d,
    );
    expect(d.calls).toEqual([]);
  });
});

describe('playTrack row taps', () => {
  const row = {
    type: 'playTrack' as const,
    surahId: 36,
    reciterId: 'r1',
    rewayatId: 'rw1',
    ayah: null,
  };

  it('jumps to a matching up next track instead of replacing the queue', async () => {
    const keys: unknown[] = [];
    const d = deps({
      upNextIndexOf: key => {
        keys.push(key);
        return 3;
      },
    });
    await handleWidgetCommand(row, d);
    expect(keys).toEqual([{reciterId: 'r1', surahId: 36, rewayatId: 'rw1'}]);
    expect(d.calls).toEqual(['playQueueIndex:3@0']);
  });

  it('resumes a matching recent entry at its saved position', async () => {
    const d = deps({
      findRecent: key => ({...key, startPosition: 321, recentIndex: 2}),
    });
    await handleWidgetCommand(row, d);
    expect(d.calls).toEqual(['resumeRecent:36@321']);
  });

  it('keeps the queue but resumes at the recent position when both match', async () => {
    const d = deps({
      upNextIndexOf: () => 1,
      findRecent: key => ({...key, startPosition: 5, recentIndex: 2}),
    });
    await handleWidgetCommand(row, d);
    expect(d.calls).toEqual(['playQueueIndex:1@5', 'resumeChain:2']);
  });

  it('starts fresh when nothing matches', async () => {
    const d = deps();
    await handleWidgetCommand(row, d);
    expect(d.calls).toEqual(['playTracks:36@0']);
  });

  it('skips queue and recents when an ayah is given', async () => {
    const d = deps({
      upNextIndexOf: () => 1,
      findRecent: key => ({...key, startPosition: 5, recentIndex: 0}),
    });
    await handleWidgetCommand({...row, ayah: 10}, d);
    expect(d.calls).toEqual(['ayahStartSec:rw1', 'playTracks:36@42']);
  });
});

describe('ayahStartSecFrom', () => {
  const list: AyahTimestamp[] = [
    {
      surahNumber: 18,
      ayahNumber: 10,
      timestampFrom: 42000,
      timestampTo: 50000,
      durationMs: 8000,
    },
  ];

  it('converts milliseconds to seconds', () => {
    expect(ayahStartSecFrom(list, 10)).toBe(42);
  });

  it('returns null for a missing ayah or a null list', () => {
    expect(ayahStartSecFrom(list, 11)).toBeNull();
    expect(ayahStartSecFrom(null, 10)).toBeNull();
  });
});

import {handleWidgetCommand, CommandDeps} from '../handleWidgetCommand';
import type {Reciter} from '@/data/reciterData';
import type {Track} from '@/types/audio';

jest.mock('@/utils/track', () => ({
  createTrack: async (_r: unknown, surah: {id: number}) => ({
    id: `x-${surah.id}`,
    url: '',
    title: '',
    artist: '',
    reciterId: 'r1',
    reciterName: 'R',
    surahId: String(surah.id),
    rewayatId: 'rw1',
  }),
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => undefined,
  getSurahById: (id: number) => ({id}),
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
    isPlaying: () => false,
    hasCurrentTrack: () => true,
    play: async () => void calls.push('play'),
    pause: async () => void calls.push('pause'),
    playTracks: async (tracks: Track[], startSec: number) =>
      void calls.push(`playTracks:${tracks[0].surahId}@${startSec}`),
    lastSurahForReciter: () => 67,
    ayahStartSec: async () => 42,
    ...over,
  };
}

describe('handleWidgetCommand', () => {
  it('toggles play and pause', async () => {
    const d = deps();
    await handleWidgetCommand({type: 'togglePlayback'}, d);
    expect(d.calls).toEqual(['play']);
    const d2 = deps({isPlaying: () => true});
    await handleWidgetCommand({type: 'togglePlayback'}, d2);
    expect(d2.calls).toEqual(['pause']);
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
    expect(d.calls).toEqual(['playTracks:18@42']);
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

  it('togglePlayback with nothing loaded does nothing', async () => {
    const d = deps({hasCurrentTrack: () => false});
    await handleWidgetCommand({type: 'togglePlayback'}, d);
    expect(d.calls).toEqual([]);
  });
});

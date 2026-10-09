// The helpers under test are pure; stub the store and service graph so the
// native-backed modules (expo-audio, MMKV) are never loaded.
jest.mock('@/modules/bayaan-car', () => ({BayaanCar: {isAvailable: false}}));
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {setCarMode: jest.fn()},
}));
jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(),
  shuffleTracks: jest.fn(),
}));
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {},
}));
jest.mock('@/services/player/store/lovedStore', () => ({useLovedStore: {}}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {},
}));
jest.mock('@/services/car/CarSnapshotService', () => ({
  getCachedPlaylistItems: jest.fn(),
  getLastTopReciterId: jest.fn(),
}));

import {toNowPlaying, nextRate, nextRepeat} from '../CarPlaybackBridge';

describe('CarPlaybackBridge helpers', () => {
  it('cycles playback rates 1, 1.25, 1.5, 0.75', () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(1.25)).toBe(1.5);
    expect(nextRate(1.5)).toBe(0.75);
    expect(nextRate(0.75)).toBe(1);
    expect(nextRate(2)).toBe(1);
  });

  it('cycles repeat none, queue, track', () => {
    expect(nextRepeat('none')).toBe('queue');
    expect(nextRepeat('queue')).toBe('track');
    expect(nextRepeat('track')).toBe('none');
  });

  it('maps an empty queue to null', () => {
    expect(
      toNowPlaying(
        {tracks: [], currentIndex: 0},
        {state: 'paused', position: 0, duration: 0, rate: 1},
        'none',
        false,
      ),
    ).toBeNull();
  });

  it('maps the current track', () => {
    const np = toNowPlaying(
      {
        tracks: [
          {
            id: 'a',
            url: 'u',
            title: 'Al-Kahf',
            artist: 'Mishary',
            reciterId: 'r1',
            reciterName: 'Mishary',
            surahId: '18',
          },
        ],
        currentIndex: 0,
      },
      {state: 'playing', position: 10, duration: 100, rate: 1.25},
      'queue',
      true,
    );
    expect(np).toMatchObject({
      title: 'Al-Kahf',
      subtitle: 'Mishary',
      reciterId: 'r1',
      surahId: 18,
      isPlaying: true,
      position: 10,
      duration: 100,
      rate: 1.25,
      repeatMode: 'queue',
      isLoved: true,
      artwork: {kind: 'surah', surahId: 18},
      currentIndex: 0,
    });
  });
});

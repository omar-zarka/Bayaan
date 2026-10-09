// Drives car transports through the bridge's listener into the player store.
import type {CarTransport} from '@/services/car/types';

let mockTransportListener: ((transport: CarTransport) => void) | null = null;

jest.mock('@/modules/bayaan-car', () => ({
  BayaanCar: {
    isAvailable: true,
    markJsReady: jest.fn(),
    setNowPlaying: jest.fn(),
    addPlayRequestListener: () => jest.fn(),
    addTransportListener: (fn: (transport: CarTransport) => void) => {
      mockTransportListener = fn;
      return jest.fn();
    },
    addConnectionListener: () => jest.fn(),
  },
}));
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {setCarMode: jest.fn()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/data/surahData', () => ({SURAHS: []}));
jest.mock('@/data/systemPlaylists', () => ({getSystemPlaylists: () => []}));
jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(),
  shuffleTracks: jest.fn(),
}));
jest.mock('@/services/car/CarSnapshotService', () => ({
  getLastResolveContext: () => null,
  writeCarSnapshotNow: jest.fn(),
}));
jest.mock('@/services/car/sessionGate', () => ({
  markCarReplacedQueue: jest.fn(),
  waitForSessionRestored: () => Promise.resolve(),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({recentTracks: []})},
}));
jest.mock('@/services/player/store/lovedStore', () => ({
  useLovedStore: {
    getState: () => ({isLovedWithRewayat: () => false}),
    subscribe: () => jest.fn(),
  },
}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {},
}));

const mockPlayback = {state: 'playing', position: 0, duration: 0, rate: 1};
const mockSetRate = jest.fn(async (rate: number): Promise<void> => {
  mockPlayback.rate = rate;
});
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {tracks: [], currentIndex: 0},
      playback: mockPlayback,
      settings: {repeatMode: 'none'},
      setRate: mockSetRate,
    }),
    subscribe: () => jest.fn(),
  },
}));

import {startCarPlaybackBridge} from '../CarPlaybackBridge';

async function send(transport: CarTransport): Promise<void> {
  mockTransportListener?.(transport);
  await Promise.resolve();
}

describe('car transports', () => {
  beforeEach(() => {
    mockPlayback.rate = 1;
    mockSetRate.mockClear();
  });

  it('cycleRate steps the store rate through 1.25, 1.5, 0.75 and back to 1', async () => {
    const stop = startCarPlaybackBridge(Promise.resolve());
    await send({kind: 'cycleRate'});
    await send({kind: 'cycleRate'});
    await send({kind: 'cycleRate'});
    await send({kind: 'cycleRate'});
    expect(mockSetRate.mock.calls.map(([rate]) => rate)).toEqual([
      1.25, 1.5, 0.75, 1,
    ]);
    stop();
  });

  it('applies an explicit rate from the car rate command', async () => {
    const stop = startCarPlaybackBridge(Promise.resolve());
    await send({kind: 'rate', value: 1.5});
    expect(mockSetRate).toHaveBeenCalledWith(1.5);
    stop();
  });
});

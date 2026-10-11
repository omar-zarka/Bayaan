import type {
  ActivityStartResult,
  NowPlayingActivityState,
} from 'bayaan-widgets';
import {
  MULK_TRACK,
  YASIN_TRACK,
  nowPlayingSnapshot,
} from '@/test-utils/widgetSnapshots';

const mockLog: string[] = [];
const mockStart = jest.fn<
  Promise<ActivityStartResult>,
  [NowPlayingActivityState, number]
>();
const mockUpdate = jest.fn<
  Promise<boolean>,
  [NowPlayingActivityState, number]
>();
const mockEnd = jest.fn<Promise<void>, []>();
let mockSupported = true;
let mockPlatformOS = 'ios';
let mockMode: 'off' | 'surah' | 'ayah' = 'surah';
let mockAppStateListener: ((state: string) => void) | null = null;

function mockDescribe(s: NowPlayingActivityState): string {
  return `${s.surahName}:${s.isPlaying ? 'playing' : 'paused'}:${
    s.ayah ? s.ayah.number : '-'
  }`;
}

jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  isLiveActivitySupported: () => mockSupported,
  startNowPlayingActivity: (s: NowPlayingActivityState, at: number) => {
    mockLog.push(`start:${mockDescribe(s)}`);
    return mockStart(s, at);
  },
  updateNowPlayingActivity: (s: NowPlayingActivityState, at: number) => {
    mockLog.push(`update:${mockDescribe(s)}`);
    return mockUpdate(s, at);
  },
  endNowPlayingActivities: () => {
    mockLog.push('end');
    return mockEnd();
  },
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const appState = {
    addEventListener: (_event: string, cb: (state: string) => void) => {
      mockAppStateListener = cb;
      return {remove: jest.fn()};
    },
  };
  const platform = {
    get OS(): string {
      return mockPlatformOS;
    },
  };
  return new Proxy(actual, {
    get: (target, prop) => {
      if (prop === 'AppState') return appState;
      if (prop === 'Platform') return platform;
      return target[prop];
    },
  });
});
jest.mock('../config', () => ({liveActivityMode: () => mockMode}));

type SyncModule = typeof import('../syncLiveActivity');

function loadModule(): SyncModule {
  let mod: SyncModule | null = null;
  jest.isolateModules(() => {
    mod = require('../syncLiveActivity');
  });
  if (!mod) throw new Error('module failed to load');
  return mod;
}

describe('syncLiveActivity', () => {
  beforeEach(() => {
    mockLog.length = 0;
    mockStart.mockReset().mockResolvedValue('started');
    mockUpdate.mockReset().mockResolvedValue(true);
    mockEnd.mockReset().mockResolvedValue(undefined);
    mockSupported = true;
    mockPlatformOS = 'ios';
    mockMode = 'surah';
    mockAppStateListener = null;
  });

  it('does nothing off iOS, when unsupported, or when the mode is off', async () => {
    for (const setup of [
      () => (mockPlatformOS = 'android'),
      () => (mockSupported = false),
      () => (mockMode = 'off'),
    ]) {
      setup();
      const sync = loadModule();
      sync.startLiveActivitySync();
      sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
      await sync.reconcileLiveActivity();
      mockPlatformOS = 'ios';
      mockSupported = true;
      mockMode = 'surah';
    }
    expect(mockLog).toEqual([]);
  });

  it('ends orphans before the first start', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['end', 'start:Al-Kahf:playing:-']);
  });

  it('does not start for a paused session', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['end']);
  });

  it('updates on pause and ends when the queue clears', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot(null));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual([
      'end',
      'start:Al-Kahf:playing:-',
      'update:Al-Kahf:paused:-',
      'end',
    ]);
  });

  it('collapses rapid track changes into one start', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({track: YASIN_TRACK}));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({track: MULK_TRACK}));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockLog).toEqual(['end', 'start:Al-Mulk:playing:-']);
  });

  it('retries a deferred start on foreground', async () => {
    mockStart.mockResolvedValueOnce('deferred');
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    mockAppStateListener?.('active');
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('does not restart a dismissed activity for the same track', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    mockUpdate.mockResolvedValueOnce(false);
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({track: YASIN_TRACK}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual([
      'end',
      'start:Al-Kahf:playing:-',
      'update:Al-Kahf:paused:-',
      'start:Ya-Sin:playing:-',
    ]);
  });

  it('does not retry a disabled start for the same track', async () => {
    mockStart.mockResolvedValue('disabled');
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('stops reacting after cleanup', async () => {
    const sync = loadModule();
    const stop = sync.startLiveActivitySync();
    stop();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('treats a rejecting native start as a failed start', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockStart.mockRejectedValue(new Error('native boom'));
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('treats a rejecting native update as a failed update', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    mockUpdate.mockRejectedValueOnce(new Error('native boom'));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('survives a rejecting end', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockEnd.mockRejectedValue(new Error('native boom'));
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await expect(sync.reconcileLiveActivity()).resolves.toBeUndefined();
  });
});

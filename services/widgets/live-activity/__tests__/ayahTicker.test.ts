import type {AyahTimestamp} from '@/types/timestamps';
import type {NowPlayingAyah} from 'bayaan-widgets';
import {
  KAHF_TRACK,
  YASIN_TRACK,
  nowPlayingSnapshot,
} from '@/test-utils/widgetSnapshots';
import {createAyahTicker} from '../ayahTicker';

const TS: AyahTimestamp[] = [
  {
    surahNumber: 18,
    ayahNumber: 1,
    timestampFrom: 5000,
    timestampTo: 12000,
    durationMs: 7000,
  },
  {
    surahNumber: 18,
    ayahNumber: 2,
    timestampFrom: 12000,
    timestampTo: 20000,
    durationMs: 8000,
  },
  {
    surahNumber: 18,
    ayahNumber: 3,
    timestampFrom: 20000,
    timestampTo: 26000,
    durationMs: 6000,
  },
];
const START = 1_000_000;

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function setup(load: jest.Mock = jest.fn(async () => TS)) {
  const published: Array<NowPlayingAyah | null> = [];
  const ticker = createAyahTicker({
    loadTimestamps: load,
    verseText: key => `v${key}`,
    setAyah: a => published.push(a),
    now: () => Date.now(),
  });
  return {ticker, published, load};
}

describe('createAyahTicker', () => {
  beforeEach(() => {
    jest.useFakeTimers({now: START});
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('publishes the current ayah and advances at each boundary', async () => {
    const {ticker, published, load} = setup();
    ticker.onSnapshot(nowPlayingSnapshot({positionSec: 10}, START));
    await settle();
    expect(load).toHaveBeenCalledWith('rw-1', 18);
    expect(published).toEqual([{number: 1, count: 3, text: 'v18:1'}]);
    jest.advanceTimersByTime(2050);
    expect(published[1]).toEqual({number: 2, count: 3, text: 'v18:2'});
    jest.advanceTimersByTime(8000);
    expect(published[2]?.number).toBe(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('schedules nothing while paused', async () => {
    const {ticker, published} = setup();
    ticker.onSnapshot(
      nowPlayingSnapshot({positionSec: 13, isPlaying: false}, START),
    );
    await settle();
    expect(published).toEqual([{number: 2, count: 3, text: 'v18:2'}]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('skips uploads and tracks without a rewayah', async () => {
    const {ticker, published, load} = setup();
    ticker.onSnapshot(
      nowPlayingSnapshot({track: {...KAHF_TRACK, isUserUpload: true}}, START),
    );
    ticker.onSnapshot(
      nowPlayingSnapshot({track: {...YASIN_TRACK, rewayatId: null}}, START),
    );
    await settle();
    expect(load).not.toHaveBeenCalled();
    expect(published).toEqual([]);
  });

  it('clears the ayah on a track change and ignores a stale load', async () => {
    let resolveFirst: (v: AyahTimestamp[]) => void = () => undefined;
    const load = jest
      .fn()
      .mockImplementationOnce(
        () => new Promise<AyahTimestamp[]>(r => (resolveFirst = r)),
      )
      .mockImplementation(async () => [{...TS[0], surahNumber: 36}]);
    const {ticker, published} = setup(load);
    ticker.onSnapshot(nowPlayingSnapshot({positionSec: 10}, START));
    ticker.onSnapshot(
      nowPlayingSnapshot({track: YASIN_TRACK, positionSec: 10}, START),
    );
    resolveFirst(TS);
    await settle();
    expect(published).toEqual([{number: 1, count: 1, text: 'v36:1'}]);
  });

  it('logs a timestamp load failure and publishes no ayah', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const error = new Error('load failed');
    const {ticker, published} = setup(
      jest.fn(async () => Promise.reject(error)),
    );
    ticker.onSnapshot(nowPlayingSnapshot({positionSec: 10}, START));
    await settle();
    expect(warn).toHaveBeenCalledWith(
      '[LiveActivity] Failed to load ayah timestamps:',
      error,
    );
    expect(published).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
    warn.mockRestore();
  });

  it('stops scheduling after stop', async () => {
    const {ticker} = setup();
    ticker.onSnapshot(nowPlayingSnapshot({positionSec: 10}, START));
    await settle();
    ticker.stop();
    expect(jest.getTimerCount()).toBe(0);
  });
});

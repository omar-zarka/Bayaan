jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: jest.fn()},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: jest.fn(), subscribe: jest.fn()},
}));

import {ayahAt, ayahLabel} from '../carAyah';
import type {AyahTimestamp} from '@/types/timestamps';

function ts(ayahNumber: number, from: number, to: number): AyahTimestamp {
  return {
    surahNumber: 1,
    ayahNumber,
    timestampFrom: from,
    timestampTo: to,
    durationMs: to - from,
  };
}

const timestamps = [ts(1, 2000, 6000), ts(2, 6000, 9000), ts(3, 9000, 15000)];

describe('ayahAt', () => {
  it('is null before the first ayah starts (the opening)', () => {
    expect(ayahAt(timestamps, 0)).toBeNull();
    expect(ayahAt(timestamps, 1999)).toBeNull();
  });

  it('finds the ayah whose start is at or before the position', () => {
    expect(ayahAt(timestamps, 2000)).toBe(1);
    expect(ayahAt(timestamps, 5999)).toBe(1);
    expect(ayahAt(timestamps, 6000)).toBe(2);
    expect(ayahAt(timestamps, 14000)).toBe(3);
  });

  it('stays on the last ayah after its end', () => {
    expect(ayahAt(timestamps, 60000)).toBe(3);
  });

  it('is null with no timestamps', () => {
    expect(ayahAt([], 5000)).toBeNull();
  });
});

describe('ayahLabel', () => {
  it('reads as ayah of total', () => {
    expect(ayahLabel(12, 110)).toBe('Ayah 12 of 110');
  });
});

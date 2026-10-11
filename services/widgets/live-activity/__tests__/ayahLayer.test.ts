import type {AyahTimestamp} from '@/types/timestamps';
import type {WidgetNowPlaying} from 'bayaan-widgets';
import {KAHF_TRACK} from '@/test-utils/widgetSnapshots';
import {
  ayahCount,
  buildActivityAyah,
  currentAyahTimestamp,
  msUntilNextAyah,
  positionAt,
  truncateUtf8Words,
  utf8Length,
} from '../ayahLayer';

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

const NP: WidgetNowPlaying = {
  track: KAHF_TRACK,
  isPlaying: true,
  positionSec: 100,
  durationSec: 1800,
  rate: 1.5,
};

describe('current and next ayah', () => {
  it('finds the ayah at a position, null before the first', () => {
    expect(currentAyahTimestamp(TS, 4)).toBe(null);
    expect(currentAyahTimestamp(TS, 12)?.ayahNumber).toBe(2);
    expect(currentAyahTimestamp(TS, 30)?.ayahNumber).toBe(3);
  });

  it('measures wall time to the next boundary at the playback rate', () => {
    expect(msUntilNextAyah(TS, 0, 1)).toBe(5000);
    expect(msUntilNextAyah(TS, 10, 1)).toBe(2000);
    expect(msUntilNextAyah(TS, 10, 2)).toBe(1000);
    expect(msUntilNextAyah(TS, 10, 0)).toBe(2000);
    expect(msUntilNextAyah(TS, 21, 1)).toBe(null);
  });

  it('counts ayat by the last ayah number', () => {
    expect(ayahCount(TS)).toBe(3);
    expect(ayahCount([])).toBe(0);
  });
});

describe('positionAt', () => {
  it('extrapolates while playing, at the rate, clamped', () => {
    expect(positionAt(NP, 1_000_000, 1_010_000)).toBe(115);
    expect(positionAt({...NP, isPlaying: false}, 1_000_000, 1_010_000)).toBe(
      100,
    );
    expect(positionAt(NP, 1_000_000, 9_000_000)).toBe(1800);
  });
});

describe('UTF-8 truncation', () => {
  it('counts bytes per code point', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('ب')).toBe(2);
    expect(utf8Length('ﷺ')).toBe(3);
    expect(utf8Length('😀')).toBe(4);
  });

  it('keeps short text and cuts long text at a word with an ellipsis', () => {
    expect(truncateUtf8Words('aaaa bbbb', 20)).toBe('aaaa bbbb');
    expect(truncateUtf8Words('aaaa bbbb cccc', 12)).toBe('aaaa …');
    expect(
      utf8Length(truncateUtf8Words('بببب '.repeat(200), 600)),
    ).toBeLessThanOrEqual(600);
  });

  it('cuts a single oversized word by bytes with no leading space', () => {
    const out = truncateUtf8Words('😀'.repeat(10), 10);
    expect(out).toBe('😀…');
    expect(utf8Length(out)).toBeLessThanOrEqual(10);
    expect(truncateUtf8Words('abcdefghijkl mm', 8)).toBe('abcde…');
  });

  it('builds the activity ayah', () => {
    expect(buildActivityAyah(TS[1], 3, 'text')).toEqual({
      number: 2,
      count: 3,
      text: 'text',
    });
  });
});

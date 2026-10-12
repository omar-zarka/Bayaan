import {
  hafsVerseKeyOf,
  keptVerseKeys,
  sameHafsVerses,
} from '@/services/sync/hafsVerseKeys';

describe('hafsVerseKeys', () => {
  it('maps a mid-verse anchor to its Hafs verse', () => {
    expect(hafsVerseKeyOf('2:255:7')).toBe('2:255');
    expect(hafsVerseKeyOf('2:255')).toBe('2:255');
  });

  it('compares verse sets by Hafs verse, ignoring order and repeats', () => {
    expect(sameHafsVerses(['2:255:7', '2:256'], ['2:256', '2:255'])).toBe(true);
    expect(sameHafsVerses(['2:255:7'], ['2:256'])).toBe(false);
  });

  it('keeps local anchors only when QF names the same Hafs verses', () => {
    expect(keptVerseKeys(['2:255:7'], ['2:255'])).toEqual(['2:255:7']);
    expect(keptVerseKeys(['2:255:7'], ['2:256'])).toEqual(['2:256']);
    expect(keptVerseKeys([], ['2:255'])).toEqual(['2:255']);
  });
});

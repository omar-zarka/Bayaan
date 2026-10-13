// @ai-generated
import {SURAHS} from '@/data/surahData';
import {RECITERS, type Reciter} from '@/data/reciterData';
import reciterData from '@/data/reciters-fallback.json';
import {createCatalogSearch, rankReciters, rankSurahs} from '../catalog';

const reciters: Reciter[] = reciterData;
const ALAFASI = 'b3bca7d8-b004-4511-b46e-f3527f6b1f67';

afterEach(() => {
  RECITERS.splice(0, RECITERS.length);
});

describe('rankSurahs', () => {
  it.each([
    '112',
    '١١٢',
    '۱۱۲',
    ' ١١٢ ',
    '\u200f١١٢\u200f',
    'surah 112',
    'سورة ١١٢',
  ])('treats %s as surah number 112', query => {
    expect(rankSurahs(query).map(s => s.id)).toEqual([112]);
  });

  it.each(['0', '115', '999'])('returns nothing for out-of-range %s', query => {
    expect(rankSurahs(query)).toEqual([]);
  });

  it('returns the input unchanged for an empty query', () => {
    expect(rankSurahs('')).toBe(SURAHS);
    const subset = SURAHS.slice(0, 3);
    expect(rankSurahs('  ', subset)).toBe(subset);
  });

  it('restricts results to the given subset', () => {
    const subset = SURAHS.filter(s => s.id !== 1);
    expect(rankSurahs('fatiha', subset).map(s => s.id)).not.toContain(1);
  });

  it('finds surahs by alias', () => {
    expect(rankSurahs('amma')[0].id).toBe(78);
    expect(rankSurahs('tabarak')[0].id).toBe(67);
  });

  it('keeps original objects for display', () => {
    expect(rankSurahs('ال عمران')[0]).toBe(SURAHS[2]);
  });
});

describe('rankReciters', () => {
  it('rebuilds when RECITERS is repopulated in place', () => {
    expect(rankReciters('alafasi')).toEqual([]);
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters('alafasi')[0].id).toBe(ALAFASI);
  });

  it('searches Arabic names and rewayah names', () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters('العفاسي')[0].id).toBe(ALAFASI);
    expect(rankReciters('warsh').length).toBeGreaterThan(0);
  });

  it("returns the caller's own objects from the subset", () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    const persistedCopy = {...reciters.find(r => r.id === ALAFASI)!};
    expect(rankReciters('alafasi', [persistedCopy])[0]).toBe(persistedCopy);
  });

  it('restricts results to the given subset', () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    const subset = reciters.filter(r => r.id !== ALAFASI);
    expect(rankReciters('alafasi', subset).map(r => r.id)).not.toContain(
      ALAFASI,
    );
  });
});

describe('createCatalogSearch (Home)', () => {
  const search = createCatalogSearch(reciters, SURAHS);

  it('merges surahs and reciters by score, best first', () => {
    const results = search.search('al');
    const scores = results.map(r => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('returns only the surah for a number', () => {
    expect(search.search('36')).toEqual([
      {type: 'surah', item: SURAHS[35], score: 100},
    ]);
  });
});

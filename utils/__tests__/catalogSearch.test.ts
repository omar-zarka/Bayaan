// @ai-generated
import {SURAHS} from '@/data/surahData';
import type {Reciter} from '@/data/reciterData';
import reciters from '@/data/reciters-fallback.json';
import {createCatalogSearch} from '@/utils/search/catalog'; // @ai
import {
  matchesSearchText,
  matchesSurah,
  normalizeSearchText,
} from '../catalogSearch';

const search = createCatalogSearch(reciters as Reciter[], SURAHS); // @ai

describe('catalogue search', () => {
  it.each(['112', '١١٢', '۱۱۲', ' ١١٢ ', '\u200f١١٢\u200f'])(
    'finds only Al-Ikhlas for surah number %s',
    query => {
      expect(search.search(query)).toEqual([
        {type: 'surah', item: SURAHS[111], score: 100}, // @ai
      ]);
    },
  );

  it.each(['٠', '١١٥', '999', '  ', 'ــَ'])(
    'does not produce unrelated matches for %s',
    query => expect(search.search(query)).toEqual([]),
  );

  it.each([
    ['الْفَاتِحَة', 1],
    ['الفاتحه', 1],
    ['البــقرة', 2],
    ['ال عمران', 3],
    ['إِبْرَاهِيم', 14],
    ['Al-Fatihah', 1],
    ['The Opener', 1],
  ])('finds the expected surah for %s', (query, id) => {
    expect(search.search(query)[0]).toMatchObject({
      type: 'surah',
      item: {id},
    });
  });

  it.each(['العَفَاسِي', 'عفاسي', 'Mishary Alafasi'])(
    'finds the reciter for %s',
    query => {
      expect(search.search(query)[0]).toMatchObject({
        type: 'reciter',
        item: {id: 'b3bca7d8-b004-4511-b46e-f3527f6b1f67'},
      });
    },
  );

  it('keeps the original surah text for display', () => {
    const result = search.search('ال عمران')[0];
    expect(result.item).toBe(SURAHS[2]);
    expect(result.item).toMatchObject({name_arabic: 'آل عمران'});
  });
});

describe('browse and reader search', () => {
  it.each([
    ['الْفَاتِحَة', 1],
    ['الفاتحه', 1],
    ['ال عمران', 3],
    ['الضحي', 93],
    ['١١٢', 112],
    ['۱۱۲', 112],
    ['The Opener', 1],
  ])('matches %s without fuzzy search', (query, id) => {
    expect(
      SURAHS.filter(surah => matchesSurah(surah, query)).map(s => s.id),
    ).toContain(id);
  });

  it('matches joined and spaced reciter names without altering English spaces', () => {
    expect(matchesSearchText('عبدالباسط عبدالصمد', 'عَبْد الباسِط')).toBe(true);
    expect(matchesSearchText('عبد الباسط عبد الصمد', 'عبدالباسط')).toBe(true);
    expect(matchesSearchText('Mishary Alafasi', 'mishary alafasi')).toBe(true);
    expect(matchesSearchText('The Opener', 'theopener')).toBe(false);
  });

  it('preserves numeric reader commands and normalizes Arabic command spelling', () => {
    expect(normalizeSearchText('٢:٢٥٥')).toBe('2:255');
    expect(normalizeSearchText('صَفْحَة ٢٢')).toBe('صفحه 22');
    expect(normalizeSearchText('جُزْء ٣٠')).toBe('جزء 30');
    expect(normalizeSearchText('الأَجْزَاء')).toBe('الاجزاء');
  });
});

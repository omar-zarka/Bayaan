// @ai-generated
import {SURAHS} from '@/data/surahData';
import {buildSurahListItems, type SurahListItem} from '@/utils/surahListItems';

const ids = (item: SurahListItem) =>
  item.type === 'surah-row' ? item.surahs.map(s => s.id) : `juz ${item.juz}`;

it('keeps one surah per row with juz headers on phones', () => {
  const {items, stickyIndices} = buildSurahListItems(SURAHS, {
    viewMode: 'list',
    numColumns: 1,
    juzHeaders: true,
  });
  expect(items.slice(0, 4).map(ids)).toEqual(['juz 1', [1], [2], 'juz 3']);
  expect(items[1].key).toBe('surah-1');
  expect(stickyIndices.slice(0, 2)).toEqual([0, 3]);
  expect(stickyIndices.every(i => items[i].type === 'juz-header')).toBe(true);
  expect(items.filter(item => item.type === 'surah-row')).toHaveLength(114);
});

it('fills each juz section two to a row, never sharing a row across juz', () => {
  const {items} = buildSurahListItems(SURAHS, {
    viewMode: 'list',
    numColumns: 2,
    juzHeaders: true,
  });
  expect(items.slice(0, 4).map(ids)).toEqual(['juz 1', [1, 2], 'juz 3', [3]]);
  const amma = items.findIndex(item => ids(item) === 'juz 30');
  // Juz 30 starts at An-Naba (78) and runs to An-Nas (114).
  expect(ids(items[amma + 1])).toEqual([78, 79]);
  expect(ids(items[items.length - 1])).toEqual([114]);
  const surahs = items.flatMap(item =>
    item.type === 'surah-row' ? item.surahs : [],
  );
  expect(surahs.map(s => s.id)).toEqual(SURAHS.map(s => s.id));
});

it('has no headers when sorted by revelation or in the grid', () => {
  for (const options of [
    {viewMode: 'list' as const, numColumns: 2, juzHeaders: false},
    {viewMode: 'card' as const, numColumns: 5, juzHeaders: true},
  ]) {
    const {items, stickyIndices} = buildSurahListItems(SURAHS, options);
    expect(stickyIndices).toEqual([]);
    expect(items.every(item => item.type === 'surah-row')).toBe(true);
  }
  const grid = buildSurahListItems(SURAHS, {
    viewMode: 'card',
    numColumns: 5,
    juzHeaders: false,
  });
  expect(grid.items[0].key).toBe('card-1-2-3-4-5');
  expect(grid.items).toHaveLength(23);
});

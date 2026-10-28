// @ai-generated
import type {Surah} from '@/data/surahData';
import {getJuzForSurah} from '@/data/juzData';

export type SurahListItem =
  | {type: 'juz-header'; juz: number; key: string}
  | {type: 'surah-row'; surahs: Surah[]; key: string};

export interface SurahListOptions {
  /** Cards get their own keys, so switching views never reuses a row. */
  viewMode: 'card' | 'list';
  /** Surahs per row: grid columns, or list columns on iPad. */
  numColumns: number;
  /** Start a section, with a sticky header, at each juz (list view only). */
  juzHeaders: boolean;
}

function groupIntoRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/**
 * Rows for the surah list, in order. Each juz section fills its rows left to
 * right, `numColumns` surahs to a row, so a juz never shares a row with the
 * next one.
 */
export function buildSurahListItems(
  surahs: Surah[],
  {viewMode, numColumns, juzHeaders}: SurahListOptions,
): {items: SurahListItem[]; stickyIndices: number[]} {
  const items: SurahListItem[] = [];
  const stickyIndices: number[] = [];
  const keyPrefix = viewMode === 'card' ? 'card' : 'surah';
  const pushRows = (section: Surah[]) => {
    for (const row of groupIntoRows(section, Math.max(1, numColumns))) {
      items.push({
        type: 'surah-row',
        surahs: row,
        key: `${keyPrefix}-${row.map(s => s.id).join('-')}`,
      });
    }
  };

  if (viewMode === 'card' || !juzHeaders) {
    pushRows(surahs);
    return {items, stickyIndices};
  }

  let section: Surah[] = [];
  let currentJuz: number | null = null;
  for (const surah of surahs) {
    const juz = getJuzForSurah(surah.id);
    if (juz !== currentJuz) {
      pushRows(section);
      section = [];
      currentJuz = juz;
      stickyIndices.push(items.length);
      items.push({type: 'juz-header', juz, key: `juz-${juz}`});
    }
    section.push(surah);
  }
  pushRows(section);
  return {items, stickyIndices};
}

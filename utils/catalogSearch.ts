// @ai-generated
import Fuse from 'fuse.js';
import type {Reciter} from '@/data/reciterData';
import type {Surah} from '@/data/surahData';
export {normalizeSearchText} from '@/utils/search/normalize'; // @ai
import {normalizeSearchText} from '@/utils/search/normalize'; // @ai

export function matchesSearchText(text: string, query: string): boolean {
  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query);
  // Arabic compound names occur both joined and spaced in the catalogue.
  const compactArabic = (value: string) =>
    value.replace(/([\u0621-\u064a])\s+(?=[\u0621-\u064a])/g, '$1');
  return (
    normalizedText.includes(normalizedQuery) ||
    compactArabic(normalizedText).includes(compactArabic(normalizedQuery))
  );
}

export function matchesSurah(surah: Surah, query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (/^\d+$/.test(normalized)) return surah.id === Number(normalized);
  return [surah.name, surah.name_arabic, surah.translated_name_english].some(
    name => matchesSearchText(name, normalized),
  );
}

export interface CatalogSearchResult {
  type: 'surah' | 'reciter';
  item: Surah | Reciter;
  score: number;
}

export function createCatalogSearch(
  reciters: Reciter[],
  surahs: Surah[],
  getArabicReciterName: (reciter: Reciter) => string,
) {
  const options = {
    threshold: 0.4,
    distance: 200,
    minMatchCharLength: 2,
    useExtendedSearch: true,
    ignoreLocation: true,
    findAllMatches: true,
    includeScore: true,
    getFn: (object: object, path: string | string[]) => {
      const value = Fuse.config.getFn(object, path);
      return Array.isArray(value)
        ? value.map(normalizeSearchText)
        : normalizeSearchText(String(value ?? ''));
    },
  };
  const reciterIndex = new Fuse(
    reciters.map(reciter => ({
      ...reciter,
      arabic_name: getArabicReciterName(reciter),
    })),
    {
      ...options,
      keys: [
        {name: 'name', weight: 2},
        {name: 'translated_name', weight: 1.5},
        {name: 'arabic_name', weight: 2},
        {name: 'description', weight: 0.7},
        {name: 'style', weight: 0.5},
      ],
    },
  );
  const surahIndex = new Fuse(surahs, {
    ...options,
    keys: [
      {name: 'name', weight: 2},
      {name: 'name_arabic', weight: 2},
      {name: 'translated_name_english', weight: 1.5},
      {name: 'id', weight: 1},
      {name: 'revelation_type', weight: 0.5},
    ],
  });

  return {
    search(query: string): CatalogSearchResult[] {
      const normalized = normalizeSearchText(query);
      if (!normalized) return [];
      // Numeric queries identify a surah, rather than fuzzy-matching digits.
      if (/^\d+$/.test(normalized)) {
        const surah = surahs.find(item => item.id === Number(normalized));
        return surah ? [{type: 'surah', item: surah, score: 0}] : [];
      }
      return [
        ...surahIndex.search(normalized).map(result => ({
          type: 'surah' as const,
          item: result.item,
          score: result.score ?? 1,
        })),
        ...reciterIndex.search(normalized).map(result => ({
          type: 'reciter' as const,
          item: result.item,
          score: result.score ?? 1,
        })),
      ].sort((a, b) => a.score - b.score);
    },
  };
}

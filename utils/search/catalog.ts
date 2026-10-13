// @ai-generated
import {SURAHS, type Surah} from '@/data/surahData';
import {RECITERS, type Reciter} from '@/data/reciterData';
import {SURAH_ALIASES} from '@/data/searchAliases';
import {FEATURED_RECITER_NAMES} from '@/data/featuredReciters';
import {getReciterDisplayName} from '@/i18n/format';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
import {
  createSearchIndex,
  TIER,
  type SearchHit,
  type SearchIndex,
} from './createSearchIndex';
import {toSearchKey} from './normalize';

// "surah 36", "sura yasin", "سورة يس": the prefix word carries no meaning.
const SURAH_PREFIX = /^(surah|surat|sura|soorah|سوره|سورت)\s+/;
const FEATURED = new Set(FEATURED_RECITER_NAMES);

export function createSurahSearch(
  surahs: readonly Surah[],
): SearchIndex<Surah> {
  const index = createSearchIndex(surahs, {
    fields: [
      {get: surah => surah.name, weight: 1},
      {get: surah => surah.name_arabic, weight: 1},
      {get: surah => surah.translated_name_english, weight: 0.8},
      {get: surah => SURAH_ALIASES[surah.id] ?? [], weight: 0.9},
    ],
  });
  return {
    search(query: string, limit?: number): SearchHit<Surah>[] {
      const key = toSearchKey(query).replace(SURAH_PREFIX, '');
      if (/^\d+$/.test(key)) {
        const surah = surahs.find(item => item.id === Number(key));
        return surah ? [{item: surah, score: TIER.exact}] : [];
      }
      return index.search(key, limit);
    },
  };
}

export function createReciterSearch(
  reciters: readonly Reciter[],
): SearchIndex<Reciter> {
  return createSearchIndex(reciters, {
    fields: [
      {get: reciter => reciter.name, weight: 1},
      {get: reciter => getReciterDisplayName(reciter, 'ar'), weight: 1},
      {get: reciter => reciter.rewayat.map(r => r.name), weight: 0.6},
      {
        get: reciter =>
          reciter.rewayat.map(r => getDisplayLabelFromName(r.name)),
        weight: 0.6,
      },
      {get: reciter => reciter.rewayat.map(r => r.style), weight: 0.4},
    ],
    boost: reciter => (FEATURED.has(reciter.name) ? 1 : 0),
  });
}

let surahIndex: SearchIndex<Surah> | null = null;

function getSurahIndex(): SearchIndex<Surah> {
  surahIndex ??= createSurahSearch(SURAHS);
  return surahIndex;
}

// RECITERS is filled in place by dataService (splice), possibly after the
// first query. Rebuild whenever its identity signature changes.
let reciterIndex: SearchIndex<Reciter> | null = null;
let reciterSignature = '';

function getReciterIndex(): SearchIndex<Reciter> {
  const signature = `${RECITERS.length}:${RECITERS[0]?.id ?? ''}:${
    RECITERS[RECITERS.length - 1]?.id ?? ''
  }`;
  if (!reciterIndex || signature !== reciterSignature) {
    reciterIndex = createReciterSearch(RECITERS);
    reciterSignature = signature;
  }
  return reciterIndex;
}

function restrict<T extends {id: number | string}>(
  hits: readonly SearchHit<T>[],
  within: readonly T[] | undefined,
): T[] {
  if (!within) return hits.map(hit => hit.item);
  const allowed = new Set(within.map(item => item.id));
  return hits.filter(hit => allowed.has(hit.item.id)).map(hit => hit.item);
}

export function rankSurahs(
  query: string,
  within?: readonly Surah[],
): readonly Surah[] {
  if (!query.trim()) return within ?? SURAHS;
  return restrict(getSurahIndex().search(query), within);
}

export function rankReciters(
  query: string,
  within?: readonly Reciter[],
): readonly Reciter[] {
  if (!query.trim()) return within ?? RECITERS;
  return restrict(getReciterIndex().search(query), within);
}

export interface CatalogSearchResult {
  type: 'surah' | 'reciter';
  item: Surah | Reciter;
  score: number;
}

/** Home search: surahs and reciters merged by relevance (higher is better). */
export function createCatalogSearch(
  reciters: readonly Reciter[],
  surahs: readonly Surah[],
): {search(query: string): CatalogSearchResult[]} {
  const surahSearch = createSurahSearch(surahs);
  const reciterSearch = createReciterSearch(reciters);
  return {
    search(query: string): CatalogSearchResult[] {
      const surahHits = surahSearch.search(query);
      // A bare number is a surah reference; reciters never match digits.
      if (/^\d+$/.test(toSearchKey(query))) {
        return surahHits.map(hit => ({type: 'surah' as const, ...hit}));
      }
      return [
        ...surahHits.map(hit => ({type: 'surah' as const, ...hit})),
        ...reciterSearch
          .search(query)
          .map(hit => ({type: 'reciter' as const, ...hit})),
      ].sort((a, b) => b.score - a.score);
    },
  };
}

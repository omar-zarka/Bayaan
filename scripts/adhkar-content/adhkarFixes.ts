// scripts/adhkar-content/adhkarFixes.ts
// Content fixes for data/adhkar.json (adhkar audit, 2026-10-12). Every step
// is idempotent: applyAllFixes(fixed) equals fixed, which jest checks against
// the committed file (scripts/__tests__/adhkarFixes.test.ts).
// No '@/' imports: tsx scripts import this file.
import {parseEveningRows} from './eveningRows';
import type {EveningRow} from './eveningRows';

export interface SeedRow {
  id: string;
  category_id: string;
  category_name: string;
  arabic: string;
  translation: string | null;
  transliteration: string | null;
  instruction: string | null;
  repeat_count: number;
  audio_url: string | null;
  order_index: number;
  audio_file: string | null;
}

export type SeedCategory = Record<string, unknown> & {
  id: string;
  dhikr_count: number;
};

export interface SeedFile {
  categories: SeedCategory[];
  adhkar: SeedRow[];
  meta: unknown;
  super_category_dhikr_ids?: Record<string, string[]>;
}

export type FixStep = (seed: SeedFile, eveningMarkdown: string) => SeedFile;

// Key order of every row in data/adhkar.json; kept so the file round-trips.
const ROW_KEYS = [
  'id',
  'category_id',
  'category_name',
  'arabic',
  'translation',
  'transliteration',
  'instruction',
  'repeat_count',
  'audio_url',
  'order_index',
  'audio_file',
];

export const MORNING_AND_EVENING_CATEGORY = '27';
// Morning rows whose evening wording only lived in a bracketed note.
export const EVENING_VARIANT_IDS: readonly string[] = [
  '77',
  '78',
  '80',
  '81',
  '89',
  '90',
];
const FIRST_EVENING_ORDER_INDEX = 24;

// Hisn al-Muslim order. 93, 94, 95 are morning only; 97 is evening only.
export const MORNING_LIST: readonly string[] = [
  '75',
  '76',
  '77',
  '78',
  '79',
  '80',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '96',
  '98',
];
export const EVENING_LIST: readonly string[] = [
  '75',
  '76',
  'evening-77',
  'evening-78',
  '79',
  'evening-80',
  'evening-81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  'evening-89',
  'evening-90',
  '91',
  '92',
  '96',
  '97',
  '98',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function toSeedRow(value: unknown): SeedRow {
  if (!isRecord(value)) throw new Error('adhkar row must be an object');
  const {
    id,
    category_id,
    category_name,
    arabic,
    translation,
    transliteration,
    instruction,
    repeat_count,
    audio_url,
    order_index,
    audio_file,
  } = value;
  if (
    typeof id !== 'string' ||
    typeof category_id !== 'string' ||
    typeof category_name !== 'string' ||
    typeof arabic !== 'string' ||
    !isNullableString(translation) ||
    !isNullableString(transliteration) ||
    !isNullableString(instruction) ||
    typeof repeat_count !== 'number' ||
    !isNullableString(audio_url) ||
    typeof order_index !== 'number' ||
    !isNullableString(audio_file)
  ) {
    throw new Error(`malformed adhkar row ${String(id)}`);
  }
  const keys = Object.keys(value).join(',');
  if (keys !== ROW_KEYS.join(',')) {
    throw new Error(`adhkar row ${id} has unexpected keys: ${keys}`);
  }
  return {
    id,
    category_id,
    category_name,
    arabic,
    translation,
    transliteration,
    instruction,
    repeat_count,
    audio_url,
    order_index,
    audio_file,
  };
}

function toSeedCategory(value: unknown): SeedCategory {
  if (!isRecord(value)) throw new Error('category must be an object');
  const {id, dhikr_count} = value;
  if (typeof id !== 'string' || typeof dhikr_count !== 'number') {
    throw new Error(`malformed category ${String(id)}`);
  }
  return {...value, id, dhikr_count};
}

function toLists(value: unknown): Record<string, string[]> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value))
    throw new Error('super_category_dhikr_ids is malformed');
  const entries: [string, unknown][] = Object.entries(value);
  const lists: Record<string, string[]> = {};
  for (const [superId, list] of entries) {
    if (!Array.isArray(list)) throw new Error(`${superId} list is malformed`);
    const items: unknown[] = list;
    lists[superId] = items.map(item => {
      if (typeof item !== 'string') throw new Error(`${superId} has a non-id`);
      return item;
    });
  }
  return lists;
}

export function parseSeedFile(value: unknown): SeedFile {
  if (
    !isRecord(value) ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.adhkar)
  ) {
    throw new Error('data/adhkar.json is malformed');
  }
  const categories: unknown[] = value.categories;
  const adhkar: unknown[] = value.adhkar;
  const seed: SeedFile = {
    categories: categories.map(toSeedCategory),
    adhkar: adhkar.map(toSeedRow),
    meta: value.meta,
  };
  const lists = toLists(value.super_category_dhikr_ids);
  if (lists) seed.super_category_dhikr_ids = lists;
  return seed;
}

// data/adhkar.json is 2-space JSON without a trailing newline.
export function serializeSeedFile(seed: SeedFile): string {
  return JSON.stringify(seed, null, 2);
}

// ---- Morning and evening ---------------------------------------------------

// Where the evening note starts in each field of a morning variant row. The
// note always runs to the end of the field.
const EVENING_NOTE_START = {
  arabic: /\s*\[\s*وإذا أمسى/,
  translation:
    /\s*(\[In the evening:\]|\[For the evening|\(Note: for the evening)/,
  transliteration: /\s+widha amsa qal:/,
  instruction:
    /\s*(\[In the evening:\]|\[For the evening|\(Note: for the evening)/,
};

function cutAt(value: string, marker: RegExp): string {
  const index = value.search(marker);
  return index < 0 ? value : value.slice(0, index).trimEnd();
}

function cutNullableAt(value: string | null, marker: RegExp): string | null {
  return value === null ? null : cutAt(value, marker);
}

export function stripEveningNotes(seed: SeedFile): SeedFile {
  const variants = new Set(EVENING_VARIANT_IDS);
  return {
    ...seed,
    adhkar: seed.adhkar.map(row => {
      if (!variants.has(row.id)) return row;
      return {
        ...row,
        arabic: cutAt(row.arabic, EVENING_NOTE_START.arabic),
        translation: cutNullableAt(
          row.translation,
          EVENING_NOTE_START.translation,
        ),
        transliteration: cutNullableAt(
          row.transliteration,
          EVENING_NOTE_START.transliteration,
        ),
        // Row 77's instruction is the source's mixed morning/evening
        // transliteration ("...likewise, one says in the morning: Amsayna");
        // the curated morning transliteration stays in `transliteration`.
        instruction:
          row.id === '77'
            ? ''
            : cutNullableAt(row.instruction, EVENING_NOTE_START.instruction),
      };
    }),
  };
}

export function applyEveningRows(
  seed: SeedFile,
  eveningRows: readonly EveningRow[],
): SeedFile {
  const expected = EVENING_VARIANT_IDS.map(id => `evening-${id}`);
  const got = eveningRows.map(row => row.id);
  if (got.join(',') !== expected.join(',')) {
    throw new Error(
      `expected evening rows ${expected.join(', ')}, got ${got.join(', ')}`,
    );
  }
  const categoryName = seed.adhkar.find(
    row => row.category_id === MORNING_AND_EVENING_CATEGORY,
  )?.category_name;
  if (!categoryName) throw new Error('category 27 has no rows');
  const built: SeedRow[] = eveningRows.map((row, index) => ({
    id: row.id,
    category_id: MORNING_AND_EVENING_CATEGORY,
    category_name: categoryName,
    arabic: `((${row.arabic}))`,
    translation: row.translation,
    transliteration: row.transliteration,
    instruction: null,
    repeat_count: row.repeatCount,
    audio_url: null,
    order_index: FIRST_EVENING_ORDER_INDEX + index,
    audio_file: null,
  }));
  const eveningIds = new Set(expected);
  const rest = seed.adhkar.filter(row => !eveningIds.has(row.id));
  const lastMorningEvening = rest.findLastIndex(
    row => row.category_id === MORNING_AND_EVENING_CATEGORY,
  );
  return {
    ...seed,
    adhkar: [
      ...rest.slice(0, lastMorningEvening + 1),
      ...built,
      ...rest.slice(lastMorningEvening + 1),
    ],
  };
}

export function setPeriodLists(seed: SeedFile): SeedFile {
  return {
    ...seed,
    super_category_dhikr_ids: {
      'morning-adhkar': [...MORNING_LIST],
      'evening-adhkar': [...EVENING_LIST],
    },
  };
}

export function recountCategories(seed: SeedFile): SeedFile {
  return {
    ...seed,
    categories: seed.categories.map(category => ({
      ...category,
      dhikr_count: seed.adhkar.filter(row => row.category_id === category.id)
        .length,
    })),
  };
}

// Tasks append their steps before recountCategories, which must stay last.
export const FIX_STEPS: FixStep[] = [
  seed => stripEveningNotes(seed),
  (seed, eveningMarkdown) =>
    applyEveningRows(seed, parseEveningRows(eveningMarkdown)),
  seed => setPeriodLists(seed),
  seed => recountCategories(seed),
];

export function applyAllFixes(
  seed: SeedFile,
  eveningMarkdown: string,
): SeedFile {
  return FIX_STEPS.reduce(
    (current, step) => step(current, eveningMarkdown),
    seed,
  );
}

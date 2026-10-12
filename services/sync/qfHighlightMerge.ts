import type {HighlightColor} from '@/types/verse-annotations';

/**
 * One surah's highlights, keyed by the verse key without its surah: "255",
 * or "255:7" for a split verse anchor from a non-Hafs rewayah.
 */
export interface QfHighlightEntry {
  color: HighlightColor;
  rewayahId: string;
}

export type QfHighlightEntries = Readonly<Record<string, QfHighlightEntry>>;

/** The App State document value: `{v: [[ayah, color, rewayah], ...]}`. */
export interface QfHighlightDocumentValue {
  v: [string, HighlightColor, string][];
}

const COLORS: readonly HighlightColor[] = [
  'yellow',
  'green',
  'blue',
  'orange',
  'purple',
];
const AYAH_PART = /^[1-9]\d{0,2}(?::[1-9]\d{0,2})?$/;
const REWAYAH_ID = /^[a-z0-9_-]{1,64}$/;

function isHighlightColor(value: unknown): value is HighlightColor {
  return COLORS.some(color => color === value);
}

/** "2:255:7" in surah 2 is "255:7"; undefined when the key is not in it. */
export function ayahPartOf(
  verseKey: string,
  surahNumber: number,
): string | undefined {
  const prefix = `${surahNumber}:`;
  if (!verseKey.startsWith(prefix)) return undefined;
  const part = verseKey.slice(prefix.length);
  return AYAH_PART.test(part) ? part : undefined;
}

export function verseKeyOf(surahNumber: number, ayahPart: string): string {
  return `${surahNumber}:${ayahPart}`;
}

export function ayahNumberOf(ayahPart: string): number {
  return Number(ayahPart.split(':')[0]);
}

function compareAyahParts(left: string, right: string): number {
  const [leftAyah, leftWord = '0'] = left.split(':');
  const [rightAyah, rightWord = '0'] = right.split(':');
  return (
    Number(leftAyah) - Number(rightAyah) || Number(leftWord) - Number(rightWord)
  );
}

export function encodeHighlightDocument(
  entries: QfHighlightEntries,
): QfHighlightDocumentValue {
  return {
    v: Object.keys(entries)
      .sort(compareAyahParts)
      .map(part => [part, entries[part].color, entries[part].rewayahId]),
  };
}

/** Undefined for a value this version cannot read back without loss. */
export function decodeHighlightDocument(
  value: unknown,
): QfHighlightEntries | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('v' in value) ||
    !Array.isArray(value.v)
  ) {
    return undefined;
  }
  const entries: Record<string, QfHighlightEntry> = {};
  for (const entry of value.v) {
    if (!Array.isArray(entry) || entry.length !== 3) return undefined;
    const [part, color, rewayahId] = entry;
    if (
      typeof part !== 'string' ||
      !AYAH_PART.test(part) ||
      entries[part] !== undefined ||
      !isHighlightColor(color) ||
      typeof rewayahId !== 'string' ||
      !REWAYAH_ID.test(rewayahId)
    ) {
      return undefined;
    }
    entries[part] = {color, rewayahId};
  }
  return entries;
}

function sameEntry(
  left: QfHighlightEntry | undefined,
  right: QfHighlightEntry | undefined,
): boolean {
  if (!left || !right) return left === right;
  return left.color === right.color && left.rewayahId === right.rewayahId;
}

export function sameHighlights(
  left: QfHighlightEntries,
  right: QfHighlightEntries,
): boolean {
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(key => sameEntry(left[key], right[key]));
}

/** Verse keys whose highlight differs between the two sets. */
export function changedHighlightCount(
  left: QfHighlightEntries,
  right: QfHighlightEntries,
): number {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].filter(key => !sameEntry(left[key], right[key])).length;
}

/**
 * Three-way merge per verse against the last synced state. A side that left
 * a verse unchanged takes the other side's value; when both changed the same
 * verse differently, this device's edit wins.
 */
export function mergeHighlights(
  base: QfHighlightEntries,
  local: QfHighlightEntries,
  remote: QfHighlightEntries,
): QfHighlightEntries {
  const merged: Record<string, QfHighlightEntry> = {};
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);
  for (const key of keys) {
    const localChanged = !sameEntry(base[key], local[key]);
    const chosen = localChanged ? local[key] : remote[key];
    if (chosen) merged[key] = chosen;
  }
  return merged;
}

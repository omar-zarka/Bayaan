/**
 * Adhkar Arabic text markers (Hisn al-Muslim conventions in data/adhkar.json):
 *  - (( ... )) marks the words to say (the dhikr); text outside it is
 *    narration or instructions. A row without (( )) is dhikr throughout.
 *  - [ ... ] marks additions from other narrations.
 * The parser turns a row into ordered segments without the marks, so the
 * reader can mute the narration and copy/share can give clean dhikr text.
 */

export type AdhkarSegmentKind = 'dhikr' | 'narration' | 'addition';

export interface AdhkarSegment {
  kind: AdhkarSegmentKind;
  text: string;
  /** Index into the row's Quran ranges when this segment is a Quran passage
   *  (drawn with Digital Khatt), else null. */
  quranIndex: number | null;
}

/** A Quran passage inside a row: [start, end) offsets into the arabic text,
 *  including any ﴿ ﴾ around it. */
export interface AdhkarTextRange {
  start: number;
  end: number;
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LEADING_PUNCTUATION = /^[\s،,.:;؛\-–]+/;

function runLength(text: string, from: number, char: string): number {
  let end = from;
  while (end < text.length && text[end] === char) end += 1;
  return end - from;
}

// Drops brackets left without their partner inside one segment (a pair
// split by a (( )), [ ] or Quran boundary, or a ﴿ the data never closes).
function withoutUnpaired(
  text: string,
  openChar: string,
  closeChar: string,
): string {
  const open: number[] = [];
  const drop = new Set<number>();
  for (let i = 0; i < text.length; i++) {
    if (text[i] === openChar) open.push(i);
    if (text[i] === closeChar) {
      const match = open.pop();
      if (match === undefined) drop.add(i);
    }
  }
  for (const i of open) drop.add(i);
  if (drop.size === 0) return text;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (!drop.has(i)) out += text[i];
  }
  return out;
}

// Narration drops its ( ) pairs too: they wrap an instruction or a count
// ("(يَبْدَأُ بِرِجْلِهِ الْيُمْنَى)، وَيَقُولُ:"), which the muted style
// already sets apart.
function cleanSegmentText(raw: string, kind: AdhkarSegmentKind): string {
  const paired = withoutUnpaired(withoutUnpaired(raw, '(', ')'), '﴿', '﴾');
  const text = (kind === 'narration' ? paired.replace(/[()]/g, ' ') : paired)
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\.?\s*/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(LEADING_PUNCTUATION, '')
    .replace(/\s+([،,.:;؛])/g, '$1')
    .trim();
  return LETTER_OR_DIGIT.test(text) ? text : '';
}

// Offsets of a single "( ... )" pair that wraps the whole text (a "." may
// follow it), the way rows without (( )) mark their dhikr; else none.
function outerParenPair(text: string): number[] {
  const start = text.search(/\S/);
  if (start < 0 || text[start] !== '(') return [];
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return /^\s*\.?\s*$/.test(text.slice(i + 1)) ? [start, i] : [];
      }
    }
  }
  return [];
}

/**
 * Ordered segments of an adhkar Arabic text, marks removed.
 *
 * Odd cases in the data: a run of three parentheses is a single parenthesis
 * next to the mark (")))" closes "(ثلاثاً)" and the dhikr); a "((" inside an
 * open dhikr starts a new dhikr, and the text before it becomes narration
 * when it introduces speech (ends with ":"); a "))" with no open dhikr and an
 * unmatched "]" are dropped.
 *
 * `quranRanges` (sorted, non-overlapping) are emitted as their own segments
 * with `quranIndex` set and the ﴿ ﴾ removed from their text.
 */
export function parseAdhkarArabic(
  arabic: string,
  quranRanges: readonly AdhkarTextRange[] = [],
): AdhkarSegment[] {
  const hasDhikrMarks = arabic.includes('((');
  const skipped = new Set(hasDhikrMarks ? [] : outerParenPair(arabic));
  const segments: AdhkarSegment[] = [];
  let buffer = '';
  let inDhikr = false;
  let inAddition = false;
  let nextRange = 0;

  function currentKind(): AdhkarSegmentKind {
    if (inAddition) return 'addition';
    return inDhikr || !hasDhikrMarks ? 'dhikr' : 'narration';
  }

  function push(
    kind: AdhkarSegmentKind,
    raw: string,
    quranIndex: number | null,
  ): void {
    const text = cleanSegmentText(raw, kind);
    if (text) segments.push({kind, text, quranIndex});
  }

  function flush(kind: AdhkarSegmentKind = currentKind()): void {
    push(kind, buffer, null);
    buffer = '';
  }

  let i = 0;
  while (i < arabic.length) {
    const range = quranRanges[nextRange];
    if (range && i >= range.start) {
      flush();
      const passage = arabic.slice(range.start, range.end).replace(/[﴿﴾]/g, '');
      push(currentKind(), passage, nextRange);
      i = Math.max(i, range.end);
      nextRange += 1;
      continue;
    }

    const char = arabic[i];
    if (skipped.has(i)) {
      i += 1;
      continue;
    }
    if (char === '(' && arabic[i + 1] === '(') {
      const run = runLength(arabic, i, '(');
      if (inDhikr) {
        flush(/:\s*$/.test(buffer) ? 'narration' : 'dhikr');
      } else {
        flush();
      }
      inDhikr = true;
      // Extra parentheses after the mark belong to the text.
      buffer += '('.repeat(run - 2);
      i += run;
      continue;
    }
    if (char === ')' && arabic[i + 1] === ')') {
      const run = runLength(arabic, i, ')');
      // Extra parentheses before the mark belong to the text.
      buffer += ')'.repeat(run - 2);
      if (inDhikr) {
        flush();
        inDhikr = false;
      }
      i += run;
      continue;
    }
    if (char === '[') {
      flush();
      inAddition = true;
      i += 1;
      continue;
    }
    if (char === ']') {
      if (inAddition) {
        flush();
        inAddition = false;
      }
      i += 1;
      continue;
    }
    buffer += char;
    i += 1;
  }
  flush();
  return segments;
}

/**
 * Clean Arabic for copy and share: the dhikr (additions included) without
 * marks. When the row is mostly narration (a hadith with a short dhikr
 * inside), the whole text is kept, in order, so it still reads.
 */
export function adhkarCopyText(arabic: string): string {
  const segments = parseAdhkarArabic(arabic);
  let narration = 0;
  let total = 0;
  for (const segment of segments) {
    total += segment.text.length;
    if (segment.kind === 'narration') narration += segment.text.length;
  }
  const kept =
    narration * 2 > total
      ? segments
      : segments.filter(segment => segment.kind !== 'narration');
  return kept.map(segment => segment.text).join(' ');
}

/**
 * English translations reuse (( )) only rarely as a mark; most "))" there
 * close two nested parentheses. Collapse just the self-contained ((x)) pairs
 * to (x), which keeps every other parenthesis balanced.
 */
export function cleanAdhkarTranslation(translation: string): string {
  return translation.replace(/\(\(([^()]*)\)\)/g, '($1)');
}

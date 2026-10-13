// scripts/__tests__/adhkarFixes.test.ts
import fs from 'fs';
import path from 'path';
import {
  applyAllFixes,
  parseSeedFile,
  serializeSeedFile,
} from '../adhkar-content/adhkarFixes';
import {
  EVENING_TEXTS_DOC,
  parseEveningRows,
} from '../adhkar-content/eveningRows';

const root = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function block(body: string): string {
  return ['```json evening-row', body, '```'].join('\n');
}

const goodRow = JSON.stringify({
  id: 'evening-77',
  morning_id: '77',
  arabic: 'أَمْسَيْنَا',
  translation: 'We have entered the evening.',
  transliteration: null,
  repeat_count: 1,
});

describe('parseEveningRows', () => {
  it('reads every json evening-row block and ignores other code blocks', () => {
    const md = [
      '# Doc',
      '```json',
      '{"id": "not-a-row"}',
      '```',
      block(goodRow),
    ].join('\n');
    expect(parseEveningRows(md)).toEqual([
      {
        id: 'evening-77',
        morningId: '77',
        arabic: 'أَمْسَيْنَا',
        translation: 'We have entered the evening.',
        transliteration: null,
        repeatCount: 1,
      },
    ]);
  });

  it('rejects an id that does not match its morning row', () => {
    const bad = goodRow.replace('"evening-77"', '"evening-78"');
    expect(() => parseEveningRows(block(bad))).toThrow('evening-77');
  });

  it('rejects empty text and a non-positive repeat count', () => {
    expect(() =>
      parseEveningRows(block(goodRow.replace('أَمْسَيْنَا', ' '))),
    ).toThrow('empty');
    expect(() =>
      parseEveningRows(
        block(goodRow.replace('"repeat_count":1', '"repeat_count":0')),
      ),
    ).toThrow('repeat_count');
  });

  it('reads the six reviewed rows from the spec document', () => {
    expect(parseEveningRows(read(EVENING_TEXTS_DOC)).map(r => r.id)).toEqual([
      'evening-77',
      'evening-78',
      'evening-80',
      'evening-81',
      'evening-89',
      'evening-90',
    ]);
  });
});

describe('adhkar content fixes', () => {
  const raw = read('data/adhkar.json');
  const parsed: unknown = JSON.parse(raw);
  const seed = parseSeedFile(parsed);

  it('round-trips data/adhkar.json byte for byte', () => {
    expect(serializeSeedFile(seed)).toBe(raw);
  });

  it('are applied to data/adhkar.json (run npx tsx scripts/adhkar-content/apply-content-fixes.ts)', () => {
    expect(
      serializeSeedFile(applyAllFixes(seed, read(EVENING_TEXTS_DOC))),
    ).toBe(raw);
  });
});

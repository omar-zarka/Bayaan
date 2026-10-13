// services/adhkar/__tests__/adhkarSeed.test.ts
// Assertions on the committed data/adhkar.json. The file is written by
// scripts/adhkar-content/apply-content-fixes.ts; never hand-edit it.
import fs from 'fs';
import path from 'path';
import adhkarSeed from '@/data/adhkar.json';
import {
  EVENING_TEXTS_DOC,
  parseEveningRows,
} from '@/scripts/adhkar-content/eveningRows';

const root = path.resolve(__dirname, '../../..');
const rows = adhkarSeed.adhkar;
const byId = new Map(rows.map(r => [r.id, r]));

function row(id: string): (typeof rows)[number] {
  const found = byId.get(id);
  if (!found) throw new Error(`missing dhikr ${id}`);
  return found;
}

function range(prefix: string, from: number, to: number): string[] {
  return Array.from({length: to - from + 1}, (_, i) => `${prefix}${from + i}`);
}

const LEGACY_IDS = [
  ...range('', 1, 267),
  ...range('quranic-', 1, 40),
  ...range('name-', 1, 99),
];
const EVENING_IDS = [
  'evening-77',
  'evening-78',
  'evening-80',
  'evening-81',
  'evening-89',
  'evening-90',
];
const MORNING = [
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
const EVENING = [
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

describe('dhikr ids', () => {
  it('keeps every pre-existing id and adds only the six evening rows', () => {
    const ids = rows.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...LEGACY_IDS, ...EVENING_IDS].sort());
  });

  it('keeps each category dhikr_count equal to its rows', () => {
    for (const category of adhkarSeed.categories) {
      expect({
        id: category.id,
        count: rows.filter(r => r.category_id === category.id).length,
      }).toEqual({id: category.id, count: category.dhikr_count});
    }
  });
});

describe('morning and evening lists', () => {
  const lists = adhkarSeed.super_category_dhikr_ids;

  it('lists the morning adhkar without evening-only ones', () => {
    expect(lists['morning-adhkar']).toEqual(MORNING);
  });

  it('lists the evening adhkar with evening wording and without morning-only ones', () => {
    expect(lists['evening-adhkar']).toEqual(EVENING);
  });

  it('only lists ids that exist', () => {
    for (const id of [...MORNING, ...EVENING]) expect(byId.has(id)).toBe(true);
  });
});

describe('evening rows', () => {
  const reviewed = parseEveningRows(
    fs.readFileSync(path.join(root, EVENING_TEXTS_DOC), 'utf8'),
  );

  it('match the reviewed spec document exactly', () => {
    expect(reviewed).toHaveLength(6);
    reviewed.forEach((spec, index) => {
      const r = row(spec.id);
      expect(r).toEqual({
        id: spec.id,
        category_id: '27',
        category_name: 'Words of remembrance for morning and evening',
        arabic: `((${spec.arabic}))`,
        translation: spec.translation,
        transliteration: spec.transliteration,
        instruction: null,
        repeat_count: spec.repeatCount,
        audio_url: null,
        order_index: 24 + index,
        audio_file: null,
      });
    });
  });
});

describe('morning variant rows', () => {
  const variants = ['77', '78', '80', '81', '89', '90'];

  it('no longer carry the evening notes', () => {
    for (const id of variants) {
      const r = row(id);
      expect({id, arabic: r.arabic.includes('وإذا أمسى')}).toEqual({
        id,
        arabic: false,
      });
      for (const text of [r.translation, r.instruction]) {
        expect({id, text}).not.toEqual({
          id,
          text: expect.stringMatching(
            /In the evening:|For the evening|Note: for the evening|likewise, one says/,
          ),
        });
      }
      expect({id, translit: r.transliteration ?? ''}).not.toEqual({
        id,
        translit: expect.stringContaining('widha amsa'),
      });
    }
  });

  it('keeps the morning text itself', () => {
    expect(row('77').arabic.startsWith('((أَصْبَحْنَا')).toBe(true);
    expect(row('80').arabic.endsWith('(أربعَ مَرَّاتٍ).')).toBe(true);
    expect(row('78').translation).toBe(
      '(O Allah, by your leave we have reached the morning and by Your leave we have reached the evening, by Your leave we live and die and unto You is our resurrection.)',
    );
    expect(row('77').instruction).toBe('');
  });
});

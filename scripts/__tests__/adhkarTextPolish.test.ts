// scripts/__tests__/adhkarTextPolish.test.ts
// Checks data/adhkar.json against the text polish inputs in
// scripts/adhkar-content (translit.json, names.json, hisnmuslimRows.json,
// markerFixes.json, translitFitrahive.json).
import adhkarData from '@/data/adhkar.json';
import {parseAdhkarArabic, type AdhkarSegment} from '@/utils/adhkarText';
import {
  FITRAHIVE_ALTERNATIVES,
  FITRAHIVE_RULED_IDS,
  KEEP_INSTRUCTION_IDS,
  MARKER_FIXES,
  NAME_MEANINGS,
  NAMES_CATEGORY,
  SITE_ROWS,
  TRANSLITERATIONS,
  UNCHANGED,
  arabicSkeleton,
  withoutMarkers,
} from '../adhkar-content/textPolish';

interface Row {
  id: string;
  category_id: string;
  arabic: string;
  translation: string | null;
  transliteration: string | null;
  instruction: string | null;
}

const rows: readonly Row[] = adhkarData.adhkar;
const nonNames = rows.filter(r => r.category_id !== NAMES_CATEGORY);
const names = rows.filter(r => r.category_id === NAMES_CATEGORY);

function row(id: string): Row {
  const found = rows.find(r => r.id === id);
  if (!found) throw new Error(`row ${id} missing`);
  return found;
}

function kinds(segments: AdhkarSegment[]): string[] {
  return segments.map(s => s.kind);
}

describe('transliterations', () => {
  const ruled = new Set(FITRAHIVE_RULED_IDS);
  const keep = new Set(KEEP_INSTRUCTION_IDS);

  it('cover every non-name row and nothing else', () => {
    expect(Object.keys(TRANSLITERATIONS).sort()).toEqual(
      nonNames.map(r => r.id).sort(),
    );
  });

  it('equal the input value on every row outside the rulings', () => {
    for (const r of nonNames) {
      if (ruled.has(r.id)) continue;
      expect({id: r.id, value: r.transliteration}).toEqual({
        id: r.id,
        value: TRANSLITERATIONS[r.id].transliteration,
      });
    }
  });

  it('take the input instruction unless it says UNCHANGED', () => {
    for (const r of nonNames) {
      const input = TRANSLITERATIONS[r.id].instruction;
      if (input === UNCHANGED || keep.has(r.id)) continue;
      expect({id: r.id, value: r.instruction}).toEqual({
        id: r.id,
        value: input,
      });
    }
  });

  it('use the fitrahive value for row 77 only because its Arabic matches', () => {
    const alt = FITRAHIVE_ALTERNATIVES['77'];
    expect(arabicSkeleton(alt.arabic)).toBe(arabicSkeleton(row('77').arabic));
    expect(row('77').transliteration).toBe(alt.transliteration);
    expect(row('77').transliteration).not.toContain('laylah');
  });

  it('leave the other ruled rows without a transliteration', () => {
    for (const id of ['125', '265', 'evening-80', 'evening-81']) {
      expect(FITRAHIVE_ALTERNATIVES[id]).toBeUndefined();
      expect({id, value: row(id).transliteration}).toEqual({id, value: null});
    }
  });

  it('drop the stray English from row 125 and keep 133 from repeating its translation', () => {
    expect(row('125').instruction).toBeNull();
    expect(row('133').instruction).not.toBe(row('133').translation);
  });
});

describe('99 Names', () => {
  it('use the Wikipedia meanings', () => {
    expect(names).toHaveLength(99);
    for (const r of names) {
      expect({id: r.id, value: r.translation}).toEqual({
        id: r.id,
        value: NAME_MEANINGS[r.id].meaning,
      });
    }
  });

  it('take the source transliteration for name-91 only', () => {
    expect(row('name-91').transliteration).toBe(
      NAME_MEANINGS['name-91'].transliteration,
    );
    expect(row('name-1').transliteration).toBe('Ar Rahmaan');
  });

  it('keep trimmed transliterations with one apostrophe style', () => {
    for (const r of names) {
      const value = r.transliteration ?? '';
      expect({id: r.id, trimmed: value === value.trim()}).toEqual({
        id: r.id,
        trimmed: true,
      });
      expect(value).not.toMatch(/[‘’]|\s{2}/);
    }
    expect(row('name-72').transliteration).toBe("Al Mu'akhir");
  });

  it('leave no stray translation in an instruction', () => {
    expect(row('name-50').instruction).toBeNull();
    for (const r of names) {
      expect({id: r.id, value: r.instruction ?? ''}).not.toEqual({
        id: r.id,
        value: expect.stringMatching(/\\u|[éèàçêù]|\b(Le|est|des|qui)\b/),
      });
    }
  });
});

describe('rows restored from hisnmuslim.com', () => {
  it('match the site text stored in the inputs', () => {
    for (const id of ['114', '197', '267']) {
      const r = row(id);
      const site = SITE_ROWS[id];
      expect(r.arabic.trim()).not.toBe('');
      expect(r.translation?.trim()).toBeTruthy();
      expect(withoutMarkers(r.arabic)).toBe(withoutMarkers(site.arabic));
      expect(r.translation).toBe(site.translation);
    }
  });

  it('restore all four Arabic steps of row 114', () => {
    const text = row('114').arabic;
    for (const step of ['يَنْفُثُ', 'يَسْتَعِيذُ', 'يُحَدِّثْ', 'جَنْبِهِ']) {
      expect(text.normalize('NFC')).toContain(step.normalize('NFC'));
    }
  });
});

describe('marker fixes', () => {
  it('change only marker characters', () => {
    for (const [id, fix] of Object.entries(MARKER_FIXES)) {
      expect({id, same: withoutMarkers(fix.before)}).toEqual({
        id,
        same: withoutMarkers(fix.after),
      });
      expect({id, applied: row(id).arabic}).toEqual({id, applied: fix.after});
    }
  });

  it('leave no stray marks after parsing', () => {
    for (const id of Object.keys(MARKER_FIXES)) {
      for (const segment of parseAdhkarArabic(row(id).arabic)) {
        expect({id, text: segment.text}).not.toEqual({
          id,
          text: expect.stringMatching(/\(\(|\)\)|\[|\]/),
        });
      }
    }
  });

  it('show the entering and leaving instructions as narration (rows 20, 21)', () => {
    for (const id of ['20', '21']) {
      const [first, second] = parseAdhkarArabic(row(id).arabic);
      expect({id, kind: first.kind}).toEqual({id, kind: 'narration'});
      expect(first.text.normalize('NFC')).toContain(
        'يَبْدَأُ بِرِجْلِهِ'.normalize('NFC'),
      );
      expect({id, kind: second.kind}).toEqual({id, kind: 'dhikr'});
    }
  });

  it('split the hadith rows where the site quotes the words', () => {
    expect(kinds(parseAdhkarArabic(row('254').arabic))).toEqual([
      'narration',
      'dhikr',
      'narration',
    ]);
    expect(kinds(parseAdhkarArabic(row('236').arabic))).toEqual([
      'narration',
      'dhikr',
      'narration',
      'dhikr',
      'narration',
    ]);
    for (const id of ['134', '195', '135']) {
      expect({id, kinds: kinds(parseAdhkarArabic(row(id).arabic))}).toEqual({
        id,
        kinds: ['narration', 'dhikr'],
      });
    }
    expect(kinds(parseAdhkarArabic(row('206').arabic))).toEqual(['dhikr']);
    expect(kinds(parseAdhkarArabic(row('70').arabic))).toEqual([
      'dhikr',
      'narration',
    ]);
    expect(kinds(parseAdhkarArabic(row('99').arabic))).toEqual([
      'narration',
      'dhikr',
      'narration',
    ]);
  });

  it('show the additions of row 19 as additions', () => {
    expect(kinds(parseAdhkarArabic(row('19').arabic))).toEqual([
      'dhikr',
      'addition',
      'addition',
      'addition',
    ]);
  });

  it('close the Quran bracket of row 50', () => {
    expect(row('50').arabic).toContain('﴾))');
  });
});

describe('meta', () => {
  it('holds the real totals', () => {
    expect(adhkarData.meta.total_categories).toBe(adhkarData.categories.length);
    expect(adhkarData.meta.total_duas).toBe(adhkarData.adhkar.length);
  });
});

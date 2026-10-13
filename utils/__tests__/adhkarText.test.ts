import adhkarData from '@/data/adhkar.json';
import {
  adhkarCardLabel,
  adhkarCopyText,
  cleanAdhkarTranslation,
  parseAdhkarArabic,
  type AdhkarSegment,
} from '../adhkarText';
import {getAdhkarQuranPassages} from '../adhkarQuran';

const rows: ReadonlyArray<{
  id: string;
  arabic: string;
  translation: string | null;
}> = adhkarData.adhkar;

function row(id: string): {id: string; arabic: string} {
  const found = rows.find(r => r.id === id);
  if (!found) throw new Error(`row ${id} missing`);
  return found;
}

function arabicLetters(text: string): string {
  return (text.match(/[ء-ي]/g) ?? []).join('');
}

function kinds(segments: AdhkarSegment[]): string[] {
  return segments.map(s => s.kind);
}

// The data and these literals may order combining marks differently.
function nfc(text: string): string {
  return text.normalize('NFC');
}

function pairs(segments: AdhkarSegment[]): string[][] {
  return segments.map(s => [s.kind, nfc(s.text)]);
}

describe('parseAdhkarArabic', () => {
  it('splits narration, dhikr and additions and drops the marks (row 20)', () => {
    const segments = parseAdhkarArabic(row('20').arabic);
    expect(kinds(segments)).toEqual([
      'narration',
      'dhikr',
      'addition',
      'addition',
      'dhikr',
    ]);
    expect(nfc(segments[0].text)).toBe(
      nfc('يَبْدَأُ بِرِجْلِهِ الْيُمْنَى، وَيَقُولُ:'),
    );
    expect(nfc(segments[2].text)).toBe(nfc('بِسْمِ اللَّهِ، وَالصَّلَاةُ'));
    expect(nfc(segments[4].text)).toBe(
      nfc('اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ'),
    );
  });

  it('treats a row without (( )) as dhikr throughout', () => {
    expect(parseAdhkarArabic('سُبْحَانَ اللَّهِ')).toEqual([
      {kind: 'dhikr', text: 'سُبْحَانَ اللَّهِ', quranIndex: null},
    ]);
  });

  it('keeps a parenthesis that sits next to the closing mark', () => {
    // Row 138 before v9 moved its count note outside the marks.
    const segments = parseAdhkarArabic(
      '((أَعُوذُ بِاللَّهِ، وَاتْفُلْ عَلَى يَسَارِكَ (ثلاثاً))).',
    );
    expect(segments).toHaveLength(1);
    expect(segments[0].text.endsWith('(ثلاثاً)')).toBe(true);
  });

  it('turns an open dhikr that introduces speech into narration (row 134)', () => {
    const segments = parseAdhkarArabic(row('134').arabic);
    expect(pairs(segments)).toEqual([
      ['narration', nfc('يَقُولُ:')],
      ['dhikr', nfc('آمَنْتُ بِاللَّهِ وَرُسُلِهِ')],
    ]);
  });

  it('drops a single parenthesis split from its partner (row 10)', () => {
    const segments = parseAdhkarArabic(row('10').arabic);
    expect(pairs(segments)).toEqual([
      ['addition', nfc('بِسْمِ اللَّهِ')],
      [
        'dhikr',
        nfc('اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبْثِ وَالْخَبائِث.'),
      ],
    ]);
  });

  it('emits Quran ranges as their own segments without ﴿ ﴾', () => {
    const {arabic} = row('75');
    const passages = getAdhkarQuranPassages('75', arabic);
    expect(passages).not.toBeNull();
    const segments = parseAdhkarArabic(arabic, passages?.ranges);
    expect(segments.map(s => [s.kind, s.quranIndex])).toEqual([
      ['dhikr', null],
      ['dhikr', 0],
    ]);
    expect(nfc(segments[0].text)).toBe(
      nfc('أَعُوذُ بِاللَّهِ مِنَ الشَّيطَانِ الرَّجِيمِ'),
    );
    expect(segments[1].text).not.toMatch(/[﴿﴾]/);
  });

  it('parses every row cleanly', () => {
    for (const {id, arabic} of rows) {
      const passages = getAdhkarQuranPassages(id, arabic);
      for (const ranges of [undefined, passages?.ranges]) {
        const segments = parseAdhkarArabic(arabic, ranges);
        expect({id, count: segments.length > 0}).toEqual({id, count: true});
        for (const segment of segments) {
          expect({id, text: segment.text}).toEqual({
            id,
            text: expect.not.stringMatching(/\(\(|\)\)|\[|\]/),
          });
          expect(segment.text.trim()).toBe(segment.text);
          expect(segment.text).not.toMatch(/^[،,.:;؛]/);
          expect(segment.text.length).toBeGreaterThan(0);
          if (segment.kind === 'narration') {
            expect({id, text: segment.text}).toEqual({
              id,
              text: expect.not.stringMatching(/[()]/),
            });
          }
        }
        expect({
          id,
          letters: arabicLetters(segments.map(s => s.text).join(' ')),
        }).toEqual({id, letters: arabicLetters(arabic)});
      }
    }
  });
});

describe('outer parentheses and unpaired brackets', () => {
  it('drops one pair that wraps a whole row without (( )) (rows 1, 3)', () => {
    for (const id of ['1', '3']) {
      const segments = parseAdhkarArabic(row(id).arabic);
      expect(segments).toHaveLength(1);
      expect(segments[0].kind).toBe('dhikr');
      expect(segments[0].text).not.toMatch(/^[(.]|\)$|\s\)/);
    }
  });

  it('keeps inner parentheses of a wrapped row', () => {
    expect(parseAdhkarArabic('(أَ (بَ) جَ).')).toEqual([
      {kind: 'dhikr', text: 'أَ (بَ) جَ.', quranIndex: null},
    ]);
  });

  it('shows the garment word of row 5 as an addition', () => {
    const segments = parseAdhkarArabic(row('5').arabic);
    expect(kinds(segments)).toEqual(['dhikr', 'addition', 'dhikr']);
    expect(nfc(segments[1].text)).toBe(nfc('الثَّوْبَ'));
    expect(segments.some(s => /[()]/.test(s.text))).toBe(false);
  });

  it('keeps parentheses that do not wrap the whole row', () => {
    expect(parseAdhkarArabic('(أ) ب')[0].text).toBe('(أ) ب');
  });

  it('drops a ﴿ the data never closes from copy text (row 50 before v7)', () => {
    const text = adhkarCopyText(
      '((سَجَدَ وَجْهِيَ لِلَّذِي خَلَقَهُ، ﴿فَتَبارَكَ اللَّهُ أَحْسَنُ الْخَالِقِينَ)).',
    );
    expect(text).not.toMatch(/[﴿﴾]/);
  });

  it('leaves every row with balanced parentheses and ornate brackets', () => {
    function balanced(text: string, open: string, close: string): boolean {
      let depth = 0;
      for (const char of text) {
        if (char === open) depth += 1;
        if (char === close) depth -= 1;
        if (depth < 0) return false;
      }
      return depth === 0;
    }
    for (const {id, arabic} of rows) {
      for (const segment of parseAdhkarArabic(arabic)) {
        expect({id, ok: balanced(segment.text, '(', ')')}).toEqual({
          id,
          ok: true,
        });
        expect({id, ok: balanced(segment.text, '﴿', '﴾')}).toEqual({
          id,
          ok: true,
        });
      }
    }
  });
});

describe('adhkarCopyText', () => {
  it('gives the dhikr with additions and no marks or narration', () => {
    expect(nfc(adhkarCopyText(row('20').arabic))).toBe(
      nfc(
        'أَعُوذُ بِاللَّهِ العَظِيمِ، وَبِوَجْهِهِ الْكَرِيمِ، وَسُلْطَانِهِ الْقَدِيمِ، مِنَ الشَّيْطَانِ الرَّجِيمِ' +
          ' بِسْمِ اللَّهِ، وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُولِ اللَّهِ' +
          ' اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
      ),
    );
  });

  it('keeps the narration when it is most of the text (row 195)', () => {
    const text = nfc(adhkarCopyText(row('195').arabic));
    expect(text.startsWith(nfc('عَنِ ابْنِ عُمَرَ'))).toBe(true);
    expect(text.endsWith(nfc('إِنَّكَ أَنْتَ التَّوَّابُ الغَفُورُ'))).toBe(
      true,
    );
    expect(text).not.toMatch(/\(\(|\)\)/);
  });

  it('drops the ( ) of instructions and counts in narration (rows 21, 114, 236)', () => {
    const [first] = parseAdhkarArabic(row('21').arabic);
    expect(nfc(first.text)).toBe(
      nfc('يَبْدَأُ بِرِجْلِهِ الْيُسْرَى وَيَقُولُ:'),
    );
    const counts = parseAdhkarArabic(row('114').arabic).filter(
      s => s.kind === 'narration',
    );
    expect(counts.map(s => nfc(s.text))).toEqual([
      nfc('ثلاثاً -'),
      nfc('ثَلاَثَ مَرَّاتٍ -'),
    ]);
    const text = nfc(adhkarCopyText(row('236').arabic));
    expect(text).not.toMatch(/[()]/);
    expect(
      text.endsWith(
        nfc('فَفَعَلَ عَلَى الْمَرْوَةِ كَمَا فَعَلَ عَلَى الصَّفَا.'),
      ),
    ).toBe(true);
  });

  it('keeps the takbir and the travel verse in the copy (row 207)', () => {
    const text = nfc(adhkarCopyText(row('207').arabic));
    expect(text.startsWith(nfc('اللَّهُ أَكْبَرُ'))).toBe(true);
    expect(text).toContain(nfc('سُبْحَانَ الَّذِي سَخَّرَ لَنَا'));
    expect(text).toContain(nfc('آيِبُونَ'));
  });

  it('does not copy the after-prayer note of Ayat al-Kursi (row 71)', () => {
    const text = nfc(adhkarCopyText(row('71').arabic));
    expect(text).toContain(nfc('الْعَلِيُّ الْعَظِيمُ'));
    expect(text).not.toContain(nfc('عَقِبَ'));
  });

  it('treats the Safa verse as recited, inside the marks (row 236)', () => {
    const text = nfc(adhkarCopyText(row('236').arabic));
    expect(text).toContain(
      nfc('إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَآئِرِ اللَّهِ'),
    );
    const segments = parseAdhkarArabic(row('236').arabic);
    const verse = segments.find(s =>
      nfc(s.text).includes(nfc('إِنَّ الصَّفَا')),
    );
    expect(verse?.kind).not.toBe('narration');
  });

  it('returns a row without marks unchanged apart from whitespace', () => {
    expect(adhkarCopyText('  سُبْحَانَ   اللَّهِ ')).toBe('سُبْحَانَ اللَّهِ');
  });

  it('never leaves marks in any row', () => {
    for (const {arabic} of rows) {
      expect(adhkarCopyText(arabic)).not.toMatch(/\(\(|\)\)|\[|\]/);
    }
  });
});

describe('cleanAdhkarTranslation', () => {
  it('collapses a self-contained ((x)) to (x)', () => {
    expect(cleanAdhkarTranslation('omnipotent.)((one hundred times))')).toBe(
      'omnipotent.)(one hundred times)',
    );
  });

  it('leaves "))" that closes two nested parentheses alone', () => {
    const text = '(How perfect my Lord is.(three times))';
    expect(cleanAdhkarTranslation(text)).toBe(text);
  });

  it('never unbalances parentheses in any translation', () => {
    function balance(text: string): number {
      return (
        (text.match(/\(/g) ?? []).length - (text.match(/\)/g) ?? []).length
      );
    }
    for (const {translation} of rows) {
      if (!translation) continue;
      expect(balance(cleanAdhkarTranslation(translation))).toBe(
        balance(translation),
      );
    }
  });
});

describe('adhkarCardLabel', () => {
  it('speaks the clean Arabic dhikr then the translation', () => {
    const arabic =
      'قَالَ النَّبِيُّ (( سُبْحَانَ اللَّهِ وَبِحَمْدِهِ )) كَثِيرًا جِدًّا فِي الْيَوْمِ';
    const label = adhkarCardLabel(arabic, 'Glory be to Allah ((and praise))');
    expect(label).toContain(adhkarCopyText(arabic));
    expect(label).not.toMatch(/\(\(|\)\)/);
    expect(label).toContain('سُبْحَانَ اللَّهِ وَبِحَمْدِهِ');
    expect(label.endsWith('Glory be to Allah (and praise)')).toBe(true);
  });

  it('drops the ornate brackets and * separators from the spoken label', () => {
    const label = adhkarCardLabel(row('4').arabic, null);
    expect(label).not.toMatch(/[\uFD3E\uFD3F*]/);
    expect(label).not.toMatch(/\s{2,}/);
    const withVerse = adhkarCardLabel(row('70').arabic, 'Say');
    expect(withVerse).not.toMatch(/[\uFD3E\uFD3F*]/);
  });

  it('is only the Arabic without a translation', () => {
    expect(adhkarCardLabel('(( سُبْحَانَ اللَّهِ ))', null)).toBe(
      adhkarCopyText('(( سُبْحَانَ اللَّهِ ))'),
    );
  });
});

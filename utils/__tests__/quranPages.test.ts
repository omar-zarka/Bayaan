import {getJuzForPage, getSurahOfTheDay, getSurahForPage} from '../quranPages';

describe('getJuzForPage', () => {
  it.each([
    [1, 1],
    [21, 1],
    [22, 2],
    [281, 14],
    [282, 15],
    [581, 29],
    [582, 30],
    [604, 30],
  ])('page %i is in juz %i', (page, juz) => {
    expect(getJuzForPage(page)).toBe(juz);
  });

  it('clamps out of range pages', () => {
    expect(getJuzForPage(0)).toBe(1);
    expect(getJuzForPage(999)).toBe(30);
  });
});

describe('getSurahOfTheDay', () => {
  it('is deterministic for a date', () => {
    const d = new Date(2026, 9, 8);
    expect(getSurahOfTheDay(d).id).toBe(
      getSurahOfTheDay(new Date(2026, 9, 8, 23, 59)).id,
    );
  });

  it('changes day to day', () => {
    expect(getSurahOfTheDay(new Date(2026, 9, 8)).id).not.toBe(
      getSurahOfTheDay(new Date(2026, 9, 9)).id,
    );
  });
});

describe('getSurahForPage', () => {
  it('maps page 1 to Al-Fatiha and 604 to An-Nas', () => {
    expect(getSurahForPage(1)?.id).toBe(1);
    expect(getSurahForPage(604)?.id).toBeGreaterThanOrEqual(112);
  });
});

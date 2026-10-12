import {
  localDayKey,
  mergeTasbeehIncrements,
  parsePendingTasbeeh,
} from '../tasbeeh';

describe('localDayKey', () => {
  it('formats local date with zero padding', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('mergeTasbeehIncrements', () => {
  it('sums increments per dhikr for today only', () => {
    expect(
      mergeTasbeehIncrements(
        [
          {dhikrId: 'a', count: 3, day: '2026-10-08'},
          {dhikrId: 'a', count: 2, day: '2026-10-08'},
          {dhikrId: 'b', count: 9, day: '2026-10-07'},
          {dhikrId: 'c', count: -4, day: '2026-10-08'},
        ],
        '2026-10-08',
      ),
    ).toEqual({a: 5});
  });
});

describe('parsePendingTasbeeh', () => {
  it('ignores malformed json and entries', () => {
    expect(parsePendingTasbeeh('x')).toEqual([]);
    expect(
      parsePendingTasbeeh(JSON.stringify([{dhikrId: 'a', count: 1}])),
    ).toEqual([]);
  });
});

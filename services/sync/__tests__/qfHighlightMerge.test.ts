import {
  ayahPartOf,
  decodeHighlightDocument,
  encodeHighlightDocument,
  mergeHighlights,
} from '@/services/sync/qfHighlightMerge';

describe('qfHighlightMerge', () => {
  it('keys entries by the verse key without its surah', () => {
    expect(ayahPartOf('2:255', 2)).toBe('255');
    expect(ayahPartOf('2:255:7', 2)).toBe('255:7');
    expect(ayahPartOf('2:255', 3)).toBeUndefined();
    expect(ayahPartOf('22:1', 2)).toBeUndefined();
  });

  it('encodes in verse order and decodes back', () => {
    const entries = {
      '10': {color: 'green' as const, rewayahId: 'hafs'},
      '2:7': {color: 'blue' as const, rewayahId: 'warsh'},
      '2': {color: 'yellow' as const, rewayahId: 'hafs'},
    };
    const value = encodeHighlightDocument(entries);
    expect(value).toEqual({
      v: [
        ['2', 'yellow', 'hafs'],
        ['2:7', 'blue', 'warsh'],
        ['10', 'green', 'hafs'],
      ],
    });
    expect(decodeHighlightDocument(value)).toEqual(entries);
  });

  it.each([
    {v: [['1', 'magenta', 'hafs']]},
    {
      v: [
        ['1', 'yellow', 'hafs'],
        ['1', 'green', 'hafs'],
      ],
    },
    {v: [['0', 'yellow', 'hafs']]},
    {v: [['1', 'yellow']]},
    {v: 'nope'},
    null,
  ])('refuses a document it cannot read back (%j)', value => {
    expect(decodeHighlightDocument(value)).toBeUndefined();
  });

  it('takes the side that changed each verse, and this device on a clash', () => {
    const yellow = {color: 'yellow' as const, rewayahId: 'hafs'};
    const green = {color: 'green' as const, rewayahId: 'hafs'};
    const blue = {color: 'blue' as const, rewayahId: 'hafs'};
    const base = {'1': yellow, '2': yellow, '3': yellow, '4': yellow};
    const local = {'1': yellow, '2': green, '4': green, '5': blue};
    const remote = {'1': blue, '2': yellow, '3': yellow, '4': blue, '6': green};
    expect(mergeHighlights(base, local, remote)).toEqual({
      '1': blue, // only QF changed it
      '2': green, // only this device changed it
      // 3: removed here, unchanged on QF
      '4': green, // both changed: this device wins
      '5': blue, // added here
      '6': green, // added on QF
    });
  });
});

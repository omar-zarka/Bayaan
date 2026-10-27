// @ai-generated
import {computeGridLayout} from '../gridLayout';

const opts = {minCardWidth: 120, horizontalPadding: 10, gap: 10, minColumns: 3};

describe('computeGridLayout', () => {
  it('fits the row exactly inside the container', () => {
    for (const width of [320, 375, 430, 678, 720, 834, 1024]) {
      const {numColumns, itemWidth} = computeGridLayout(width, opts);
      const rowWidth =
        numColumns * itemWidth +
        (numColumns - 1) * opts.gap +
        opts.horizontalPadding * 2;
      expect(rowWidth).toBeCloseTo(width, 5);
    }
  });

  it('keeps every card at least minCardWidth when above minColumns', () => {
    const {numColumns, itemWidth} = computeGridLayout(720, opts);
    expect(numColumns).toBe(5);
    expect(itemWidth).toBeGreaterThanOrEqual(opts.minCardWidth);
  });

  it('uses the container width, so a narrower pane gets fewer columns', () => {
    // A 1024pt window with an 88pt rail and a 720pt column.
    expect(computeGridLayout(720, opts).numColumns).toBeLessThan(
      computeGridLayout(1024, opts).numColumns,
    );
  });

  it('never drops below minColumns on a phone', () => {
    const {numColumns, itemWidth} = computeGridLayout(320, opts);
    expect(numColumns).toBe(3);
    expect(itemWidth).toBeGreaterThan(0);
  });

  it('handles an unmeasured (zero) width', () => {
    expect(computeGridLayout(0, opts)).toEqual({numColumns: 3, itemWidth: 0});
  });
});

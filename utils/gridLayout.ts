// @ai-generated
export interface GridLayoutOptions {
  /** Smallest card width before a column is dropped. */
  minCardWidth: number;
  /** Padding on each side of the grid (applied twice). */
  horizontalPadding: number;
  /** Space between two cards in a row. */
  gap: number;
  /** Never show fewer columns than this. */
  minColumns?: number;
}

export interface GridLayout {
  numColumns: number;
  itemWidth: number;
}

/**
 * Columns and card width for a grid that fills `containerWidth`.
 *
 * Pass the width of the grid's own container (from `onLayout`), not the
 * window: on iPad the grid sits beside a sidebar inside a capped column, so
 * window-based math overflows the container and clips the last column.
 */
export function computeGridLayout(
  containerWidth: number,
  {minCardWidth, horizontalPadding, gap, minColumns = 1}: GridLayoutOptions,
): GridLayout {
  const innerWidth = Math.max(0, containerWidth - horizontalPadding * 2);
  const fit = Math.floor((innerWidth + gap) / (minCardWidth + gap));
  const numColumns = Math.max(minColumns, fit, 1);
  const itemWidth = Math.max(
    0,
    (innerWidth - gap * (numColumns - 1)) / numColumns,
  );
  return {numColumns, itemWidth};
}

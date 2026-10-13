// services/adhkar/playback/openPlayingDhikr.ts
// Which adhkar screen is focused, and (Task 5) how to get to the playing dhikr.
export type AdhkarFocus = {kind: 'list' | 'reader'; listId: string} | null;

let focus: AdhkarFocus = null;

export function setAdhkarFocus(next: AdhkarFocus): void {
  focus = next;
}

// Clears only when `expected` is still the current focus. Navigation can run
// the next screen's focus before the previous screen's blur cleanup.
export function clearAdhkarFocus(expected: AdhkarFocus): void {
  if (focus === expected) focus = null;
}

export function getAdhkarFocus(): AdhkarFocus {
  return focus;
}

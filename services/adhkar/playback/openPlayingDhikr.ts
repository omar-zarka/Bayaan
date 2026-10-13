// services/adhkar/playback/openPlayingDhikr.ts
// Which adhkar screen is focused, and (Task 5) how to get to the playing dhikr.
export type AdhkarFocus = {kind: 'list' | 'reader'; listId: string} | null;

let focus: AdhkarFocus = null;

export function setAdhkarFocus(next: AdhkarFocus): void {
  focus = next;
}

export function getAdhkarFocus(): AdhkarFocus {
  return focus;
}

// QF stores Hafs verses only ('S:A'). Bayaan keys a row on the later part of
// a split Hafs verse (another rewayah's verse unit) by its mid-verse anchor
// 'S:A:W'. A remote verse that names the same Hafs verses as the local keys
// must not move the row off the part of the verse it was saved on.

const VERSE_KEY = /^(\d+):(\d+)(?::[1-9]\d*)?$/;

export function hafsVerseKeyOf(verseKey: string): string {
  const match = VERSE_KEY.exec(verseKey);
  return match ? `${match[1]}:${match[2]}` : verseKey;
}

function hafsVerseSet(verseKeys: readonly string[]): string {
  return [...new Set(verseKeys.map(hafsVerseKeyOf))].sort().join(',');
}

export function sameHafsVerses(
  local: readonly string[],
  remote: readonly string[],
): boolean {
  return hafsVerseSet(local) === hafsVerseSet(remote);
}

/**
 * The verse keys to store for a row after QF reports `remote`: the local keys
 * when they name the same Hafs verses (anchors kept), else the remote ones.
 */
export function keptVerseKeys(
  local: readonly string[],
  remote: readonly string[],
): readonly string[] {
  return local.length > 0 && sameHafsVerses(local, remote) ? local : remote;
}

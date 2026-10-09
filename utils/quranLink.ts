export interface QuranLinkParams {
  surah: string;
  ayah?: string;
  page?: string;
}

/**
 * Mushaf route params for a /quran/{surah}?ayah=N link. The reader resolves a
 * bare surah to its first page, so pass the ayah's page when it is known.
 */
export function quranLinkParams(
  surah: string,
  ayah: string | undefined,
  pageForVerse: (verseKey: string) => number | undefined,
): QuranLinkParams {
  if (!ayah) return {surah};
  const page = pageForVerse(`${surah}:${ayah}`);
  return page === undefined ? {surah, ayah} : {surah, ayah, page: String(page)};
}

import type {TafseerEdition, TafseerVerse} from '@/types/tafseer';

/**
 * RFC-009 — pluggable tafsir source.
 *
 * A `TafsirProvider` supplies the editions list and full-tafsir download
 * used by Settings → Tafsir. Bayaan's default is the api.quran.com-backed
 * `QuranComTafsirProvider`; a fork can override it via
 * `branding.tafsirProvider`.
 *
 * The SQLite cache layer (`tafseerDbService`) sits outside this contract
 * — providers return in-memory `{edition, verses}` only.
 */
export interface TafsirProvider {
  /** Lists every tafsir edition the provider can serve. */
  fetchAvailableEditions(): Promise<TafseerEdition[]>;

  /**
   * Fetches every verse-level tafsir for one edition. The progress
   * callback fires at chapter granularity (0..1). Verse-group semantics
   * (consecutive verses sharing one tafsir text) are encoded via the
   * optional `groupVerseKey` / `fromAyah` / `toAyah` fields on
   * `TafseerVerse`; providers returning ungrouped tafsir leave them unset.
   */
  fetchFullTafseer(
    editionId: string,
    onProgress?: (progress: number) => void,
  ): Promise<{
    edition: TafseerEdition;
    verses: TafseerVerse[];
  }>;
}

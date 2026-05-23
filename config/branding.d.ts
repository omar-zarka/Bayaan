import type {ComponentType} from 'react';
import type {Track} from '@/types/audio';

/** Catalog source config for the active branding. */
export interface BrandingCatalogConfig {
  source: 'bundled' | 'remote';
  /** Path to bundled JSON catalog file; undefined = use data/reciters-fallback.json. */
  fallbackPath?: string;
}

/**
 * Identifier for a Listen-tab home row.
 *
 * Each id corresponds to a section rendered by `components/RecitersView.tsx`.
 * Forks select which rows to show and in what order by listing ids in
 * `Branding.homeRowConfig`. Unknown ids are ignored (forward-compat for forks
 * that haven't been updated when a new row is added upstream).
 */
export type HomeRowId =
  | 'continue-listening'
  | 'new-to-quran'
  | 'favorites'
  | 'featured'
  | 'adhkar'
  | 'follow-along'
  | 'playlists'
  | 'exclusives'
  | 'tajweed'
  | 'memorization'
  | 'rewayat'
  | 'collection';

/** Per-row toggle for the Listen-tab home rows. */
export interface HomeRow {
  id: HomeRowId;
  /** Whether this row renders. Rows whose data is empty still self-hide. */
  enabled: boolean;
}

/**
 * Props passed to a fork's `listenTabTopComponent` (RFC-008).
 *
 * Reserved for future extension — the slot starts with no required props
 * so forks can ship a plain `() => JSX.Element`. Any future additions
 * (theming context, navigation hooks, …) must default to optional so
 * existing implementations keep compiling.
 */
export interface ListenTabTopComponentProps {}

/**
 * RFC-012 — identifier for a Search/Browse-tab filter dimension.
 *
 * Each id is a predicate the `BrowseReciters` filter pipeline can apply
 * to the reciter list. Forks declare an array in `branding.searchFilters`
 * to opt in to the user-editable chip framework; when undefined, the
 * Search tab keeps today's bespoke chip set (teacher/student) unchanged.
 *
 * v1 ships the exists-today subset only — every dimension here resolves
 * against fields that already exist on `Reciter` / `Reciter.rewayat[]`.
 * Future dimensions (`country`, `translation`) require the corresponding
 * fields to be added to the `Reciter` type and populated from the
 * catalog first; they're not part of this PR.
 */
export type SearchFilterDimension =
  | 'rewaya' // Reciter.rewayat[].name — teacher/student (already bespoke; here for future migration)
  | 'has-surah' // surah picker → Reciter.rewayat[].surah_list includes (already bespoke; here for future migration)
  | 'has-photo' // Reciter.image_url present
  | 'recitation-style'; // Reciter.rewayat[].style — canonical slugs 'murattal'|'mojawwad'|'moalim' per data/rewayat-slugs.json (already bespoke; here for future migration)

/** App identity values that vary across forks. */
export interface Branding {
  appName: string;
  appSlug: string;
  urlScheme: string;
  bundleId: {ios: string; android: string};
  supportUrl: string;
  termsUrl: string;
  privacyUrl: string;
  shareBaseUrl: string;
  emailProductName: string;
  catalog: BrandingCatalogConfig;
  /**
   * Order + visibility of Listen-tab home rows.
   *
   * Optional — when undefined, RecitersView falls back to the built-in
   * default order (preserving today's Bayaan behavior verbatim). Forks
   * override by declaring their own array. Order in the array == render
   * order. Empty-data rows self-hide regardless of `enabled`.
   *
   * @example
   * homeRowConfig: [
   *   { id: 'continue-listening', enabled: true },
   *   { id: 'favorites', enabled: true },
   *   { id: 'featured', enabled: true },
   * ]
   */
  homeRowConfig?: HomeRow[];
  /**
   * RFC-010 — optional URL the app polls on cold-start (and on
   * `AppState 'active'`, debounced) to discover catalog updates. The
   * response is expected to be JSON of shape:
   *
   *   { version: number, updated_at?: string, url?: string }
   *
   * If `version` exceeds the locally-tracked last-seen version, the app
   * refetches the catalog. When `url` is present, it points at an
   * immutable per-version snapshot — preferred over the live catalog URL
   * because the URL itself is the CDN cache key.
   *
   * Undefined (default) → no polling. Bayaan ships undefined; forks with
   * dynamic catalog operations (e.g. Qariah's ops console) set it.
   *
   * Fail-open: any poll failure is swallowed. The bundled catalog is
   * always the source of truth on cold-start.
   */
  catalogVersionEndpoint?: string;
  /**
   * RFC-008 — optional component that replaces the Listen-tab top
   * region (the default `RecitersHero`). Forks return a React
   * component; `undefined` keeps Bayaan's `RecitersHero` verbatim.
   *
   * The component renders directly inside the Listen-tab ScrollView at
   * the top, above the rows controlled by `homeRowConfig`. It receives
   * no required props today; `ListenTabTopComponentProps` is a slot for
   * future extension.
   */
  listenTabTopComponent?: ComponentType<ListenTabTopComponentProps>;
  /**
   * RFC-012 — composable Search-tab filter dimensions. When set, the
   * Search tab renders a user-editable chip per id; tiles on the Home
   * tab can deeplink in with chips pre-applied via the matching URL
   * params on the `reciter/browse` route. RFC-012 chips render AFTER
   * Bayaan's existing bespoke chips (teacher/student) — trailing
   * position is intentional so users of a forked build see the
   * familiar chips first and the fork's additions after.
   *
   * Tri-state semantics:
   *   - `undefined` (default) — "not migrated"; Search tab keeps
   *     today's bespoke chip set unchanged. Bayaan ships this.
   *   - `[]` — "explicitly disable all RFC-012 chips". Observably the
   *     same as `undefined` today, but the intent is distinct for
   *     future v2 migration when bespoke chips themselves move under
   *     this seam.
   *   - non-empty array — opt in to the listed dimensions.
   *
   * v1 ships exists-today dimensions only — see `SearchFilterDimension`.
   *
   * @example
   * searchFilters: ['rewaya', 'has-surah', 'has-photo']
   */
  searchFilters?: SearchFilterDimension[];
  /**
   * RFC-013 — optional hook returning the verse_key (e.g. `"2:197"`) the
   * PlayerSheet ayah list (`QuranView`) should anchor on for the
   * currently-playing track. Called on cold-mount and on every
   * currentSurah change thereafter. Returning `undefined` (the default)
   * keeps the current scroll-to-top-of-surah behavior verbatim.
   *
   * Used by forks that ship range-restricted recitations (audio tracks
   * covering only a subset of a surah). The hook returns the start of
   * that subset; QuranView handles the rest (initial-scroll position +
   * deferred imperative scroll on subsequent surah changes).
   *
   * If the returned verse_key isn't found in the current surah's verses,
   * QuranView silently falls back to scrolling to the top.
   *
   * @example
   * // Fork with catalog metadata describing partial recitations:
   * initialPlayerVerseKey: (track) => {
   *   if (!track.surahId) return undefined;
   *   const meta = getSurahMetadata(track.reciterId, track.rewayatId, +track.surahId);
   *   return meta?.range ? `${track.surahId}:${meta.range.from}` : undefined;
   * }
   */
  initialPlayerVerseKey?: (track: Track) => string | undefined;
}

declare const branding: Branding;
export default branding;

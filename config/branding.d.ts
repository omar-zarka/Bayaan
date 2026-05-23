import type {ComponentType} from 'react';

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
}

declare const branding: Branding;
export default branding;

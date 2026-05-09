/** Catalog source config for the active branding. */
export interface BrandingCatalogConfig {
  source: 'bundled' | 'remote';
  /** Path to bundled JSON catalog file; undefined = use data/reciters-fallback.json. */
  fallbackPath?: string;
}

/**
 * Optional per-tab overrides. Currently labels only.
 *
 * Icons are intentionally not part of this seam — Bayaan's tab icons span
 * three rendering surfaces (iOS NativeTabs PNG `require()`, Android
 * `BottomTabBar` component switch, tablet sidebar same switch) and a
 * fork-overridable icon registry that preserves Metro static analysis is
 * a substantially larger refactor that should land via its own RFC.
 */
export interface BrandingTab {
  /** Display label. Defaults to Bayaan's hardcoded value. */
  label?: string;
}

/** Per-tab branding for the bottom tab bar / tablet sidebar. */
export interface BrandingTabs {
  home?: BrandingTab;
  surahs?: BrandingTab;
  search?: BrandingTab;
  collection?: BrandingTab;
  settings?: BrandingTab;
}

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
  /** Optional tab-bar customization for forks. Bayaan defaults to absent. */
  tabs?: BrandingTabs;
}

declare const branding: Branding;
export default branding;

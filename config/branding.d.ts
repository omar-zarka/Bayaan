/** Catalog source config for the active branding. */
export interface BrandingCatalogConfig {
  source: 'bundled' | 'remote';
  /** Path to bundled JSON catalog file; undefined = use data/reciters-fallback.json. */
  fallbackPath?: string;
}

/**
 * Optional color overrides applied on top of the chosen mode's palette.
 * Each key is shallow-merged into lightColors/darkColors inside createTheme.
 * Forks may override only the keys they care about; unspecified keys fall
 * through to Bayaan's defaults.
 */
export interface BrandingThemeOverrides {
  background?: string;
  secondary?: string;
  card?: string;
  border?: string;
  text?: string;
  accent?: string;
  error?: string;
}

/** Branding-level theme customization. All fields optional. */
export interface BrandingTheme {
  /** Overrides applied when the active color scheme is 'light'. */
  lightOverrides?: BrandingThemeOverrides;
  /** Overrides applied when the active color scheme is 'dark'. */
  darkOverrides?: BrandingThemeOverrides;
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
  /** Optional theming hooks for forks. Bayaan defaults to absent (no overrides). */
  theme?: BrandingTheme;
}

declare const branding: Branding;
export default branding;

/** Catalog source config for the active branding. */
export interface BrandingCatalogConfig {
  source: 'bundled' | 'remote';
  /** Path to bundled JSON catalog file; undefined = use data/reciters-fallback.json. */
  fallbackPath?: string;
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
}

declare const branding: Branding;
export default branding;

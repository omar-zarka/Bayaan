/**
 * Bayaan app identity config.
 *
 * CJS (not ESM) — app.config.js calls require() before Expo CLI transpiles.
 * Forks override by replacing this file; the shape is typed in branding.d.ts.
 *
 * See docs/rfcs/007-app-layer-multi-tenancy.md for the design rationale.
 */
module.exports = {
  appName: 'Bayaan',
  appSlug: 'Bayaan',
  urlScheme: 'bayaan',
  bundleId: {
    ios: 'com.bayaan.app',
    android: 'com.bayaan.app',
  },
  supportUrl: 'https://thebayaan.com/support',
  termsUrl: 'https://thebayaan.com/terms',
  privacyUrl: 'https://thebayaan.com/privacy',
  shareBaseUrl: 'https://app.thebayaan.com',
  emailProductName: 'Bayaan',
  catalog: {
    source: 'bundled',
    fallbackPath: undefined,
  },
};

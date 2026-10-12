# Arabic Language Support (i18n + RTL) — Design & Plan

**Goal:** Bayaan can run fully in Arabic: every user-facing string is translated,
the layout mirrors right-to-left, Arabic data (surah names) is shown, numbers
use Arabic-Indic digits, and Arabic UI text renders in a proper Arabic font.

## Decisions

| Topic | Decision |
|---|---|
| RTL | Native mirroring via `I18nManager.forceRTL`. Changing language reloads the app. |
| Language selection | Follow the device language by default; in-app picker in Settings: System / English / العربية. |
| Coverage | All user-facing strings (screens, sheets, toasts, alerts, player, mushaf chrome, adhkar). |
| Content | Arabic surah names, Arabic-Indic digits, translated rewayah/style labels. Arabic reciter names are shown when the API provides `name_arabic` (optional field; backend work is out of scope). |
| Font | IBM Plex Sans Arabic (OFL), loaded under the existing `Manrope-*` aliases in Arabic mode. |

## Architecture

### `i18n/` module

- `i18n/language.ts` — language preference (`'system' | 'en' | 'ar'`) persisted in
  MMKV (synchronous, so it is readable at module-evaluation time, before any
  StyleSheet or component is created). `resolveLanguage()` maps preference +
  device locale (`expo-localization`) to `'en' | 'ar'`. `setLanguagePreference()`
  persists, calls `I18nManager.forceRTL`, and reloads (`expo-updates`
  `reloadAsync`, falling back to `DevSettings.reload` in dev, otherwise an alert
  asking the user to restart).
- `i18n/index.ts` — initialises i18next synchronously with bundled JSON
  resources, `fallbackLng: 'en'`, and a global `arabicDigits` post-processor that
  converts ASCII digits in Arabic output to Arabic-Indic digits. Also performs the
  RTL bootstrap: if `I18nManager.isRTL` disagrees with the resolved language
  (e.g. first launch on an Arabic device) it forces the direction and reloads
  once (guarded by an MMKV flag against reload loops).
- `i18n/locales/{en,ar}/<namespace>.json` — one file per feature area so
  translation work can be done in parallel without merge conflicts.
  Namespaces: `common`, `home`, `collection`, `settings`, `sheets`, `player`,
  `content`.
- `i18n/i18next.d.ts` — type augmentation so `t('settings:…')` keys are type-checked
  against the English resources.
- `i18n/format.ts` — `localizeDigits()`, `formatNumber()`, and
  `getSurahDisplayName()` for numbers/data rendered outside `t()`.
- `intl-pluralrules` polyfill — Hermes lacks `Intl.PluralRules`, which i18next
  needs for Arabic's six plural forms (`_zero/_one/_two/_few/_many/_other`).

### RTL handling

- Yoga mirrors `flexDirection: 'row'`, `margin/paddingLeft|Right`, and absolute
  `left/right` automatically once `I18nManager.isRTL` is true.
- `utils/rtl.ts` exports `isRTL`, `flipX` (a `scaleX: -1` transform for
  directional icons: chevrons, arrows, back buttons), and `forceLTR`
  (`direction: 'ltr'`).
- Pinned to LTR (to keep current, already-correct behaviour):
  - Mushaf pagers (`inverted` horizontal FlatLists + index math already encode
    right-to-left page order; native RTL would double-flip them).
  - Media transport controls and progress sliders (platform guidelines: media
    playback controls are not mirrored).
- Quran Arabic text and Skia mushaf rendering are already RTL and unaffected.

### Fonts

`_layout.tsx` loads font files from `i18n/fonts.ts`. In Arabic mode the
`Manrope-*` aliases resolve to the matching IBM Plex Sans Arabic weight
(ExtraBold → Bold), so the ~560 existing `fontFamily: 'Manrope-…'` styles need
no changes. Plex Sans Arabic includes Latin glyphs, so English names still render.

### Native config

- iOS: `CFBundleLocalizations: ['en', 'ar']` so iOS reports Arabic as a supported
  app language (enables the per-app language setting in iOS Settings and makes
  native chrome — tab bar, nav bar, alerts — RTL when the system language is Arabic).
- Android already declares `android:supportsRtl="true"`.
- `expo-localization` plugin with `supportsRTL: true`.
- Requires a new native build (new native module + Info.plist change).

## Known limitations

- iOS native chrome (UIKit tab bar / navigation bar) follows the system or
  per-app language. Choosing Arabic in-app on an English device translates and
  mirrors all RN content, but UIKit components may stay LTR. The picker points
  iOS users to the per-app language setting.
- Reciter names stay in English until the API provides Arabic names.
- Changelog / "What's New" release notes and long-form content (tafsir, about page
  prose that comes from data files) are not translated in this pass.

## Implementation tasks

1. **Infrastructure** (lead): deps, `i18n/` module, fonts, RTL bootstrap,
   `utils/rtl.ts`, `i18n/format.ts`, `common` namespace, tabs labels,
   language picker screen in Settings, native config, parity test.
2. **String extraction** (parallel workers, disjoint file ownership; each owns
   its namespace JSON files):
   - `home`: home/search/surahs tabs, hero, browse, cards, search, top-level list components.
   - `collection`: collection tab, playlists, system playlists, downloads, uploads.
   - `settings`: settings screens, settings components, modals, changelog shell.
   - `sheets`: `components/sheets/**`.
   - `player`: player, mushaf chrome, quran reader, reciter profile, adhkar.
   - `content`: user-facing strings in `hooks/`, `utils/`, `services/`, `data/`
     (toasts, alerts, categories, onboarding, rewayah/style labels), tablet sidebar,
     bottom tab bar.
   Each worker also applies `flipX` to directional icons, `forceLTR` where
   needed, and `localizeDigits`/`getSurahDisplayName` for rendered data in its files.
3. **Verification** (lead): `tsc` (no new errors vs baseline), ESLint on touched
   files, Jest locale parity test (same keys + same `{{placeholders}}` in en/ar),
   grep for remaining hardcoded JSX strings.

## Testing

- `i18n/__tests__/locales.test.ts`: every namespace has identical key sets in en and
  ar (accounting for Arabic plural suffixes), identical interpolation variables,
  and no empty values.
- `i18n/__tests__/format.test.ts`: digit localisation and surah name selection.
- Manual QA on device (not possible in this environment): switch language,
  verify reload + mirroring, mushaf paging, player controls, text clipping with
  Arabic line heights.

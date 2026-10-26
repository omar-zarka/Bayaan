# Bayaan design system (as built)

This is a description of the design system **as it exists in the code today**, so contributors can find the right token instead of inventing one. Where the code is inconsistent, that is called out under **Known debt**; the rules for fixing it live in [ipad-standards.md](ipad-standards.md).

Last surveyed against `develop` in October 2026.

---

## 1. Principles

These are the principles the existing UI follows. New work should keep them.

1. **Content first, chrome quiet.** The Quran text, reciter artwork, and playback controls carry the screen. Chrome (cards, dividers, icons) is drawn with low-alpha tints of the text color rather than brand color.
2. **Monochrome UI, user-chosen accent.** UI chrome is derived from `theme.colors.text` and `theme.colors.textSecondary`. `theme.colors.primary` is a user preference and is **not** used for chrome (see `CONTRIBUTING.md` → Design system).
3. **Reading themes drive the whole app.** The reading theme the user picks recolors every screen, not just the Mushaf.
4. **Calm motion.** Transitions are short and physical (the player morphs from the mini player; sheets slide). No decorative animation.
5. **One codebase, phone first, tablet adapted.** Phone layouts are the baseline; tablet layouts are opt-in branches gated on `useResponsive()`.

---

## 2. Theming

### Where themes come from

| Piece | File | Notes |
| --- | --- | --- |
| Live theme object | `utils/themeUtils.ts` → `createTheme()` | Used by `store/themeStore.ts`; read with `useTheme()` from `hooks/useTheme.ts` |
| Base light/dark palettes | `styles/colorSchemes.ts` | `lightColors`, `darkColors`, `primaryColors` |
| Reading themes | `constants/readingThemes.ts` | 7 light + 7 dark palettes that override `background`, `backgroundSecondary`, `text`, `textSecondary`, `card` |
| Reading-theme colors hook | `hooks/useReadingThemeColors.ts` | |

Always read colors from `useTheme().theme.colors`. Never import a palette file directly into a component, because it bypasses the user's reading theme.

### Theme shape

```ts
theme.colors       // background, backgroundSecondary, text, textSecondary, card,
                   // border, secondary, accent, tertiary, light, shadow, error, primary
theme.isDarkMode   // boolean
theme.fonts        // regular | medium | semiBold | bold | heading | light | extraLight | extraBold (all Manrope)
theme.typography   // headingSize 30, subheadingSize 18, bodySize 16, arabicSize 20,
                   // mediumSize 14, smallSize 12, captionSize 10 (scaled; barely used, see debt)
theme.spacing.unit // 7 (scaled; unused)
```

### Reading themes

Light: `default` (#f4f3ec), `parchment`, `white`, `sage`, `rose`, `cool`, `sand`.
Dark: `dark-default` (#050b10), `dark-sepia`, `oled`, `dark-sage`, `charcoal`, `indigo`, `dark-amber`.

Every color you draw must look right on all fourteen. Test at least `default`, `parchment`, `oled`, and `dark-amber` when you add a surface.

---

## 3. Color tokens

The alpha-based system from `CONTRIBUTING.md`, using the `color` package:

| Token | Value | Usage |
| --- | --- | --- |
| Card background | `Color(text).alpha(0.04)` | Surface backgrounds |
| Card border | `Color(text).alpha(0.06)` | 1px borders |
| Divider | `Color(text).alpha(0.06)` | Hairline separators |
| Pressed state | `Color(text).alpha(0.06)` | Pressable feedback |
| Selected / active row | `Color(text).alpha(0.08)` | Sidebar active item (`TabletSidebar`) |
| Inactive icon / label | `Color(text).alpha(0.55)` | Unfocused sidebar and tab items |
| Icon | `Color(text).alpha(0.7)` | Secondary icons |
| Option label | `Color(text).alpha(0.85)` | Row labels |
| Section header | `Color(textSecondary).alpha(0.5)` | ALL CAPS labels. Fails contrast (about 3:1); new code uses 0.8 or more per [ipad-standards.md §12](ipad-standards.md#12-accessibility) |
| Primary button bg | `text` | Action buttons |
| Primary button text | `background` | Button labels |
| Error | `theme.colors.error` | Destructive actions and errors only |

Special-purpose palettes live in `constants/tajweedColors.ts`, `constants/mushafAllahHighlight.ts`, and `constants/adhkarColors.ts`. Use them only in their own feature.

`constants/Colors.ts` is the Expo template's leftover palette and is not part of the system. Do not use it.

---

## 4. Typography

### Typefaces

| Family | Files | Use |
| --- | --- | --- |
| **Manrope** (ExtraLight → ExtraBold) | `assets/fonts/Manrope-*.ttf` | All Latin UI text |
| **IBM Plex Sans Arabic** | `assets/fonts/IBMPlexSansArabic-*.ttf` | Arabic UI text (localized chrome) |
| **Scheherazade New** | `assets/fonts/ScheherazadeNew-*.ttf` | Arabic body text outside the Mushaf |
| **Uthmani / UthmanicHafs** | `assets/fonts/Uthmani.otf`, `UthmanicHafs1Ver18.ttf` | Quran text in list views |
| **DigitalKhatt** (Skia) | `services/mushaf/` | Mushaf page rendering; see `docs/features/digital-khatt/` |
| **Surah name glyphs** | `surah_names.ttf`, `surah_names_2.ttf` | Calligraphic surah titles (`constants/surahNameGlyphs.ts`) |

Use `theme.fonts.*` rather than string literals where you can. In practice about 500 call sites hardcode `'Manrope-SemiBold'` and friends; that works, but is harder to change.

### Sizes in use

Measured from `fontSize:` call sites in `app/` and `components/` (base values before scaling):

| Size (pt) | Uses | Typical role |
| --- | --- | --- |
| 9–11 | ~125 | Badges, captions, metadata |
| 12–13 | ~205 | Secondary labels, section headers |
| 14–15 | ~150 | Row titles, body |
| 16–18 | ~140 | Emphasized body, list titles, subheadings |
| 20–24 | ~50 | Screen and card headings |
| 28–30 | ~5 | Large titles |

Weights: SemiBold is the default for titles and labels, Medium for secondary text, Regular for body, Bold for headings. There is no named type ramp yet; [ipad-standards.md §4](ipad-standards.md#4-typography) defines one.

---

## 5. Spacing, radii, icons

Values measured across `app/` and `components/` (base values, usually wrapped in `moderateScale`):

| Kind | Most used values | Read as |
| --- | --- | --- |
| Padding | 16, 20, 14, 8, 12, 10, 6, 4, 24, 32 | Roughly a 4pt grid with 14/10/6 outliers |
| Border radius | 12, 8, 14, 20, 10, 16, 28, 6, 4, 32 | 14 is the documented card radius; 12 is the most common |
| Icon size | 20, 18, 16, 22, 24, 14, 30, 48 | 20 for row and toolbar icons, 24 for primary actions |

Card pattern (from `CONTRIBUTING.md`):

```tsx
{
  backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
  borderWidth: 1,
  borderColor: Color(theme.colors.text).alpha(0.06).toString(),
  borderRadius: moderateScale(14),
  overflow: 'hidden',
}
```

Reference implementations: `components/sheets/MushafSettingsContent.tsx`, `components/sheets/VerseActionsSheet.tsx`.

---

## 6. Size scaling

There are **two** scaling helpers in the codebase, and which one a file imports decides how it looks on iPad.

| Helper | Behavior on iPad | Files using it |
| --- | --- | --- |
| `react-native-size-matters` (`moderateScale`, `ScaledSheet`, `'16@s'`) | Scales from a 350pt guideline using the **shortest screen side**. On an iPad that inflates sizes about **1.7× (11" portrait) to 2×** (13") at the default 0.5 factor | ~190 files |
| `@/utils/scale` (`moderateScale`, `verticalScale`, `scale`) | Same API, but caps the width at `PHONE_SCALE_CAP` (430pt), so tablets render at large-phone size (about 1.11× base) | ~15 files |

Constants for both live in `utils/responsive.ts`: `TABLET_BREAKPOINT = 700` and `PHONE_SCALE_CAP = 430`.

New code MUST use `@/utils/scale`. See [ipad-standards.md §3](ipad-standards.md#3-sizing-and-scaling).

---

## 7. Responsive building blocks

| Piece | File | What it does |
| --- | --- | --- |
| `useResponsive()` | `hooks/useResponsive.ts` | Live `width`, `height`, `shortestSide`, `orientation`, `isTablet`, `isPhone`, `scaleWidth`. Re-renders on rotation |
| Static helpers | `utils/responsive.ts` | `getIsTablet()`, `getShortestSide()`, `getScaleWidth()` for non-component code |
| `MaxWidthContainer` | `components/layout/MaxWidthContainer.tsx` | Centers children in a capped column (default 720pt) on tablet; no-op on phone. Wraps every tab stack in `app/(tabs)/*/_layout.tsx` |
| Tablet shell | `app/(tabs)/_layout.tsx` → `TabletTabs` | Leading sidebar replaces the tab bar on tablet |
| `TabletSidebar` | `components/tablet/TabletSidebar.tsx` | 88pt icon rail in portrait, 240pt labeled sidebar in landscape; docks the mini player in its footer; flips side for RTL |
| `TabletDockedPlayer` | `components/tablet/TabletDockedPlayer.tsx` | Mini player inside the sidebar |
| `TabletPlayer` + columns | `components/player/v2/TabletPlayer.tsx`, `components/tablet/TabletPlayer*Column.tsx` | Full player: landscape splits player and reciter list, portrait splits mushaf and controls |
| Reading column | `components/player/v2/PlayerContent/QuranView/index.tsx` | Caps the verse column at 680pt on tablet |
| Grids | `components/collection/CollectionGrid.tsx`, `components/browse/BrowseGrid.tsx` | Column count derived from window width |

---

## 8. Core components

Prefer these over building new ones:

| Need | Use |
| --- | --- |
| Button | `components/Button.tsx` (`small` / `medium` / `large`) |
| Screen header | `components/ScreenHeader.tsx`, `components/Header.tsx`, `hooks/useCollectionNativeHeader.tsx` |
| Search | `components/SearchBar.tsx`, `components/SearchInput.tsx` |
| Segmented tabs | `components/TabSelector.tsx` |
| Toggle | `components/Toggle.tsx` |
| List rows | `SurahItem`, `ReciterItem`, `TrackItem`, `PlaylistItem` in `components/` |
| Sheets | `react-native-actions-sheet` (`SheetManager`) with content in `components/sheets/`; `components/BottomSheetModal.tsx` |
| Blur surface | `components/FrostedView.tsx` (iOS blur, Android solid card); `hooks/useGlassProps.ts` for liquid glass |
| Images | `expo-image`, and `components/ReciterImage.tsx` for reciter art |
| Lists | `@shopify/flash-list` (`FlashList`) |
| Press feedback | `Pressable` with the pressed-state token (never `TouchableOpacity`) |

---

## 9. Known debt

Each of these has a matching rule in [ipad-standards.md](ipad-standards.md):

1. **Uncapped scaling.** About 190 files import `react-native-size-matters`, so most of the app renders 1.7–2× larger on iPad than intended. This is the main cause of the "everything looks too big" feel.
2. **Device-based layout.** `isTablet` is true for every iPad regardless of window size, so once multitasking is enabled a 320pt Slide Over window would get the tablet layout.
3. **Portrait lock on iPad.** `app/_layout.tsx` calls `ScreenOrientation.lockAsync(PORTRAIT_UP)` on every device, and only `app/mushaf.tsx` unlocks it. The landscape branches in `TabletSidebar`, `PlayerBody`, and `TabletPlayer` are therefore unreachable outside the Mushaf screen, even though `Info.plist` declares all four iPad orientations.
4. **No multitasking.** `app.config.js` sets `UIRequiresFullScreen: true`, which opts out of Split View, Slide Over, and Stage Manager. Apple deprecated this key in iPadOS 26.
5. **Two `createTheme` copies.** `styles/theme.ts` and `utils/themeUtils.ts` both define it, and both read `Dimensions` once at module load. `utils/themeUtils.ts` is the live one.
6. **No type ramp.** `theme.typography` is used in two places; sizes are hardcoded per component.
7. **One-size column cap.** `MaxWidthContainer` caps every tab at 720pt, including grids and browse shelves that should use the full width in landscape.
8. **Thin accessibility coverage.** About 60 `accessibilityLabel`s across the app, no `maxFontSizeMultiplier` policy, and no reduce-motion handling outside a handful of files.
9. **No pointer or keyboard support.** No hover states and no hardware keyboard shortcuts.

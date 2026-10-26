# iPad and large-screen standards

These are the rules every screen in Bayaan follows on iPad and large Android tablets. They exist so the app feels like it was designed for the iPad, the way Tarteel and Quran.com feel for reading and Apple Music and Spotify feel for listening, without losing Bayaan's own quiet, monochrome look ([design-system.md](design-system.md)).

**How to read this document**

- **MUST**: a review blocker. Do not merge UI that breaks it.
- **SHOULD**: the default. Diverge only with a reason written in the PR.
- **MAY**: allowed, at your judgment.
- Rules apply to new and changed code. Existing code is migrated screen by screen; the migration status lives in [§13](#13-migration-plan).

---

## 1. Design goals

1. **Use the space, don't stretch the phone.** A tablet screen should show more (a second pane, more columns, a larger page), not the phone layout scaled up or a narrow phone column floating in empty space.
2. **Reading is a book, listening is a music app.** Reading surfaces follow book and Mushaf conventions (Tarteel, Quran.com, Apple Books). Listening surfaces follow Apple Music and Spotify on iPad.
3. **Layout follows the window, not the device.** iPadOS windows can be any size. Decide layout from the current window width.
4. **Every input works.** Touch, Apple Pencil, trackpad or mouse, and a hardware keyboard.
5. **Same identity everywhere.** Tokens, type, color, and motion are the same on phone and tablet; only density and arrangement change.

---

## 2. Width classes and breakpoints

### 2.1 Classes

Layout decisions use **width classes** computed from the **window** width (`useWindowDimensions().width`), never from device model.

| Class | Window width | Typical windows |
| --- | --- | --- |
| `compact` | < 600pt | Every phone; iPad Slide Over; ⅓ Split View; narrow Stage Manager windows |
| `medium` | 600–899pt | iPad mini and 11" in portrait (744–834); ½ Split View on 13" |
| `expanded` | 900–1199pt | 11" in landscape (1180–1210); 13" in portrait (1024–1032) |
| `large` | ≥ 1200pt | 13" in landscape (1366–1376); large Stage Manager windows; external displays |

Reference sizes (portrait width × height, in points): iPad mini 744×1133, iPad / iPad Air 11" 820×1180, iPad Pro 11" 834×1210, iPad Air 13" 1024×1366, iPad Pro 13" 1032×1376.

### 2.2 Rules

- **MUST** choose layout (columns, panes, sidebar style, sheet style) from the width class. `isTablet` answers "is this device an iPad", not "how wide is my window".
- **MUST** read sizes with `useWindowDimensions()` or `useResponsive()` inside components, so layout updates on rotation and resize. Never compute layout from `Dimensions.get()` at module scope.
- **MAY** use `isTablet` for device capabilities only: hardware keyboard hints, Pencil, default font size for Quran text.
- **SHOULD** use height too where it matters: an `expanded` window shorter than 700pt (landscape 11") should not stack two tall panels vertically.
- `compact` on an iPad **MUST** render the phone layout and stay fully functional.

### 2.3 Implementation

Add the class to `useResponsive()` so there is one source:

```ts
// hooks/useResponsive.ts
export type WidthClass = 'compact' | 'medium' | 'expanded' | 'large';

export const WIDTH_BREAKPOINTS = {medium: 600, expanded: 900, large: 1200} as const;

export function getWidthClass(width: number): WidthClass {
  if (width >= WIDTH_BREAKPOINTS.large) return 'large';
  if (width >= WIDTH_BREAKPOINTS.expanded) return 'expanded';
  if (width >= WIDTH_BREAKPOINTS.medium) return 'medium';
  return 'compact';
}
// useResponsive() returns {..., widthClass, isRegularWidth: widthClass !== 'compact'}
```

`TABLET_BREAKPOINT` (700, shortest side) stays as the device test behind `isTablet`.

---

## 3. Sizing and scaling

The phone UI was scaled with `react-native-size-matters`, which multiplies sizes by roughly 1.7–2× on iPad. Tablet UI must be sized in real points, with density added through layout instead.

- **MUST** import scaling helpers from `@/utils/scale` in new or edited files, never from `react-native-size-matters`. They cap the width at 430pt, so tablets render at large-phone size.
- **MUST NOT** use `ScaledSheet` string units (`'16@s'`, `'12@vs'`) in new code. Use `StyleSheet.create` with `moderateScale()` from `@/utils/scale`.
- **MUST NOT** use `verticalScale` for font sizes, icon sizes, or hit targets. It depends on screen height, which changes with orientation.
- **SHOULD** express tablet-only dimensions (pane widths, column minimums, max widths) as plain points from the tokens below, not scaled values.
- When you touch a file that still imports `react-native-size-matters`, **SHOULD** switch it to `@/utils/scale` in the same PR and check the phone layout is unchanged (it is, for widths ≤ 430pt).

---

## 4. Typography

### 4.1 UI type ramp

One named ramp for all UI text. Phone sizes match today's most common values; tablet sizes add density through a modest step rather than scaling. Values are in points **before** Dynamic Type.

| Role | Phone | Tablet (`medium`+) | Weight | Use |
| --- | --- | --- | --- | --- |
| `display` | 28 | 34 | Bold | Hero titles (reciter profile name, surah header) |
| `title1` | 24 | 28 | Bold | Screen titles |
| `title2` | 20 | 22 | SemiBold | Section titles, card headings |
| `headline` | 17 | 17 | SemiBold | List row titles, player track title |
| `body` | 15 | 16 | Regular | Paragraphs, descriptions |
| `callout` | 14 | 15 | Medium | Secondary row text, buttons |
| `footnote` | 13 | 13 | Medium | Metadata, timestamps |
| `caption` | 11 | 12 | Medium | Badges, tiny labels |
| `overline` | 12 | 12 | SemiBold, uppercase, +0.5 letter spacing | Section headers (`textSecondary` at 0.5 alpha) |

Rules:

- **SHOULD** use a ramp role in new code. Add the ramp to the theme as `theme.type.<role>` returning `{fontFamily, fontSize, lineHeight}` and replace `theme.typography`, which is barely used.
- **MUST NOT** introduce a font size outside the ramp for UI chrome. Quran and translation text use the reading scale below.
- **SHOULD** set `lineHeight` at about 1.3× for titles and 1.45× for body.
- Latin UI is Manrope; Arabic UI is IBM Plex Sans Arabic. **MUST NOT** render Quranic text in a UI font.

### 4.2 Reading type

Reading text is user-sized. Tablet defaults are larger because the device is held further away and the column is wider.

| Text | Phone default | Tablet default | Line height | User range |
| --- | --- | --- | --- | --- |
| Quran (verse-by-verse list) | 26 | 32 | 1.9–2.1× | 20–48 |
| Translation | 15 | 18 | 1.55× | 13–26 |
| Transliteration | 14 | 16 | 1.5×, italic | 12–22 |
| Tafsir and long-form | 16 | 18 | 1.6× | 14–26 |

- **MUST** keep reading text inside a readable column: **max 680pt** for verse-by-verse and translation views (matches `QuranView`), about 60–75 Latin characters per line for long-form.
- **MUST** size the Mushaf page to fit the available pane, not with a font size; see [§9.1](#91-mushaf).
- **SHOULD** persist reading sizes separately for phone and tablet, so a size chosen on iPad does not shrink the phone.

### 4.3 Dynamic Type and font scaling

- **MUST NOT** set `allowFontScaling={false}` on body, list, or reading text.
- **SHOULD** set `maxFontSizeMultiplier` on dense chrome only (tab and sidebar labels, badges, player time labels): 1.3 for chrome, 1.6 for list rows.
- **MUST** let rows grow in height with larger text. Do not give text rows fixed heights; use `minHeight`.

---

## 5. Spacing and layout grid

### 5.1 Spacing scale (4pt grid)

| Token | pt | Use |
| --- | --- | --- |
| `xxs` | 2 | Hairline nudges |
| `xs` | 4 | Icon-to-label inside a chip |
| `sm` | 8 | Between related elements |
| `md` | 12 | Inside rows and cards |
| `lg` | 16 | Card padding, phone page margin |
| `xl` | 20 | Between groups |
| `2xl` | 24 | Section spacing, tablet page margin |
| `3xl` | 32 | Large section spacing |
| `4xl` | 48 | Hero spacing |

**SHOULD** use these instead of 10, 14, 15, 6 in new code.

### 5.2 Page margins and gutters by width class

| | compact | medium | expanded | large |
| --- | --- | --- | --- | --- |
| Page margin (leading/trailing) | 16 | 24 | 32 | 40 |
| Grid gutter | 12 | 16 | 20 | 24 |
| Section spacing | 24 | 32 | 32 | 40 |

Margins are measured inside the safe area and after the sidebar.

### 5.3 Content width

Width caps depend on the kind of content, not one number for the whole app.

| Content | Max width | Alignment |
| --- | --- | --- |
| Reading column (verses, translation, tafsir) | 680 | Centered |
| Forms and settings lists | 640 | Centered, or leading in a split view detail pane |
| Sheets and dialogs | 560 | Centered |
| Grids, shelves, browse, search results | No cap; add columns | Full width inside page margins |
| Player | Pane-based ([§10](#10-listening-surfaces)) | |

- **MUST NOT** wrap grids and horizontal shelves in a 720pt `MaxWidthContainer`. Give them the full width and more columns.
- **SHOULD** move the `MaxWidthContainer` from the tab stack layouts into the screens that hold reading or form content.

### 5.4 Radii

| Token | pt | Use |
| --- | --- | --- |
| `xs` | 4 | Progress bars, tiny chips |
| `sm` | 8 | Thumbnails in rows, small buttons |
| `md` | 12 | Inputs, list group containers |
| `card` | 14 | Cards (the documented card radius) |
| `lg` | 20 | Sheets, large artwork, player artwork |
| `pill` | 999 | Pills, segmented controls, circular buttons |

Artwork radius scales with artwork size: about 6% of the edge length, clamped to 8–20.

---

## 6. Navigation and app shell

Pattern: Apple Music and Spotify on iPad use a leading sidebar with the mini player docked at the bottom, and a content area that can split into list and detail.

| Width class | Shell |
| --- | --- |
| `compact` | Phone tab bar (native tabs on iOS, floating pill on Android) and floating mini player |
| `medium` | Icon rail (88pt) with labels under icons; mini player docked at the bottom of the content area spanning its width |
| `expanded`, `large` | Labeled sidebar (240pt; 280pt at `large`) with the mini player docked in the sidebar footer |

Rules:

- **MUST** keep the sidebar on the leading edge and flip it for RTL (already done in `TabletSidebar`).
- **MUST** keep the current tab's navigation stack when the sidebar collapses or expands on resize.
- **SHOULD** use list-detail split views where the phone pushes a detail screen from a list: settings (list left, page right), collection (playlists left, contents right), and reciter browse at `expanded`+. Detail pane minimum 420pt, list pane 320–380pt.
- **SHOULD** let the user collapse the labeled sidebar to the rail (Apple Music behavior), and remember the choice.
- **MUST** keep a visible back affordance in every pushed detail screen; do not rely on the swipe-back gesture alone.

---

## 7. Touch, pointer, keyboard

### 7.1 Targets

- **MUST** give every interactive element a hit area of at least **44×44pt** (Apple HIG). Use `hitSlop` when the visual is smaller.
- **SHOULD** use 48×48pt for primary playback controls and 64pt for the play/pause button in the full player.
- **MUST** space adjacent targets at least 8pt apart.

### 7.2 Pointer (trackpad and mouse)

- **SHOULD** give tappable rows, cards, and toolbar buttons a hover state using `Pressable`'s `onHoverIn` / `onHoverOut`: the pressed-state token at half strength (`Color(text).alpha(0.04)`).
- **SHOULD** support secondary click (right-click) wherever long-press opens a menu.
- **MUST NOT** hide functionality behind swipe-only gestures; give a visible button or menu item too (pointer users cannot swipe comfortably).

### 7.3 Hardware keyboard

Target shortcuts (needs a small native `UIKeyCommand` module; until then they are a goal, not a rule):

| Keys | Action |
| --- | --- |
| Space | Play / pause |
| ← / → | Previous / next ayah (reading) or seek 10s (listening) |
| ⌘ ← / ⌘ → | Previous / next track |
| ⌘ F | Focus search |
| ⌘ 1–5 | Switch sidebar section |
| ⌘ L | Toggle follow-along |
| Esc | Close the player, sheet, or dialog |

- **MUST** keep text inputs working with a hardware keyboard: Return submits search, Tab moves focus.

---

## 8. Sheets, menus, and modals

Full-width bottom sheets look like a phone app on a 13" screen.

| Width class | Short action list (≤ 6 items) | Settings or content panel | Destructive confirmation |
| --- | --- | --- | --- |
| `compact` | Bottom sheet | Bottom sheet | Alert |
| `medium`+ | Popover or context menu anchored to the trigger | Centered form sheet, max 560pt wide; or a trailing side panel (360–400pt) when the content relates to what is on screen | Alert |

- **MUST** cap sheet width at 560pt and center it on `medium`+ when a bottom sheet is still used.
- **SHOULD** show reading-adjacent panels (tafsir, notes, verse actions, translations picker, Mushaf settings) as a trailing side panel on `expanded`+, so the page stays visible. This is how Tarteel and Quran.com handle tafsir on wide screens.
- **SHOULD** show player sub-sheets (speed, sleep timer, ambient) as popovers anchored to their button on `medium`+.
- **MUST** dismiss with a tap outside, the Esc key, and a visible close control.

---

## 9. Reading surfaces

Benchmarks: Tarteel (iPad), Quran.com, Apple Books.

### 9.1 Mushaf

- **MUST** fit the whole page in the pane at portrait, without scrolling, preserving the page aspect ratio.
- **SHOULD** show a **two-page spread** in landscape at `expanded`+ when each page can be at least 420pt wide: the odd (lower) page on the right, the even page on the left, as in a printed Mushaf. `components/mushaf/main.tsx` already does this on iPad landscape; keep it, and gate it on width class once §2 lands. Fall back to a single centered page with generous side margins otherwise.
- **SHOULD** keep page turns as horizontal paging in Mushaf direction, with tap zones on the outer 15% of each side for pointer and Pencil users.
- **MUST** hide chrome on tap and restore it on a second tap; chrome must not cover the text while hidden.
- **SHOULD** use the page's outer margins on wide screens for the surah name, juz, and page number rather than overlay bars.

### 9.2 Verse-by-verse and translation view

- **MUST** cap the column at 680pt and center it (already in `QuranView`).
- **SHOULD** at `expanded`+, show Arabic and translation side by side (Arabic on the trailing side in LTR UI, 55/45 split) only if the user enables it; the default stays stacked, which reads better for most users.
- **SHOULD** use the free space beside the column for a persistent tafsir or notes panel ([§8](#8-sheets-menus-and-modals)) instead of leaving it empty.

### 9.3 Follow-along while listening

- **MUST** keep the active ayah highlighted and scrolled into the comfortable reading zone (top third), and stop auto-scroll when the user scrolls manually, with a "jump to current" control.

---

## 10. Listening surfaces

Benchmarks: Apple Music and Spotify on iPad.

### 10.1 Browse, home, search

- **MUST** derive grid columns from available width: `columns = max(2, floor((paneWidth + gutter) / (minCard + gutter)))`, with `minCard` = 160pt for reciter and playlist cards, 120pt for surah tiles.
- **SHOULD** use horizontal shelves with a visible partial next card (peek) and a "See all" link, with shelf items sized from the same column math so they line up with grids below.
- **SHOULD** show artwork at a minimum of 140pt and up to 200pt on `large`.

### 10.2 Reciter and playlist detail

- **SHOULD** at `expanded`+, use a two-column header: artwork (240–280pt) on the leading side, title, metadata, and primary actions (Play, Shuffle, Download, Follow) beside it; tracks below at full width.
- **MUST** keep primary actions visible without scrolling.

### 10.3 Mini player

- **MUST** stay visible on every tab screen and dock as described in [§6](#6-navigation-and-app-shell); it does not float over content on tablet.
- **SHOULD** expose play/pause, next, and a progress hairline; tap opens the full player.

### 10.4 Full player

| Window | Layout |
| --- | --- |
| `medium` portrait | Two panes: Mushaf / ayah text on the leading side, artwork and controls on the trailing side (current `TabletPlayer` portrait split) |
| `expanded`+ landscape | Two panes: artwork and controls on the leading side (about 40%), and a switchable trailing pane for Mushaf / follow-along text, queue, or reciter list (Apple Music's lyrics/queue pattern) |
| `compact` | Phone player |

- **MUST** keep transport controls in the same place across the pane switch.
- **SHOULD** use a segmented control at the top of the trailing pane to switch between Text, Queue, and Reciters, instead of separate sheets.
- **SHOULD** cap artwork at 420pt in landscape so controls are not pushed off-screen on 11".

---

## 11. Orientation and multitasking

- **MUST** support all four orientations on iPad and keep phones portrait-locked. The root `ScreenOrientation.lockAsync(PORTRAIT_UP)` in `app/_layout.tsx` must apply only when `!isTablet`.
- **MUST** preserve scroll position, current page, and player state across rotation and window resize.
- **SHOULD** remove `UIRequiresFullScreen` from `app.config.js` so Bayaan supports Split View, Slide Over, and Stage Manager. Apple deprecated the key in iPadOS 26 and plans to ignore it, so every layout must work at any window width anyway.
- **MUST** test each screen at `compact` width on an iPad (⅓ Split View or a narrow Stage Manager window) once multitasking is enabled.
- **MUST NOT** animate layout changes on resize; snap to the new layout.

---

## 12. Accessibility

- **MUST** give every icon-only button an `accessibilityLabel` (via `t()`) and an `accessibilityRole`.
- **MUST** meet WCAG AA contrast: 4.5:1 for text under 18pt, 3:1 for large text and icons. Alpha tokens below 0.55 on text are for decoration only; check `overline` section headers (0.5 alpha) against every reading theme.
- **MUST** respect Reduce Motion (`useReducedMotion` from Reanimated): replace the player morph and page-curl animations with fades.
- **SHOULD** group row content for VoiceOver (`accessible` on the row with a combined label) so a surah row reads as one item.
- **SHOULD** make the reading order match visual order in split views (leading pane first).
- **MUST** keep RTL correct: use `start`/`end` (not `left`/`right`) for margins and positions, and mirror directional icons.

---

## 13. Migration plan

Ordered by impact. Each step is its own PR and updates this table.

| # | Change | Rule | Status |
| --- | --- | --- | --- |
| 1 | Unlock iPad orientation (portrait lock only on phones) | §11 | Not started |
| 2 | Add `widthClass` to `useResponsive()` and switch tablet branches to it | §2 | Not started |
| 3 | Move scaling imports to `@/utils/scale`, shared components first (`Button`, rows, headers, sheets) | §3 | Not started |
| 4 | Add `theme.type` ramp and spacing/radius tokens | §4, §5 | Not started |
| 5 | Replace stack-level `MaxWidthContainer` with per-content widths; widen grids | §5.3, §10.1 | Not started |
| 6 | Width-capped sheets, popovers for player sub-sheets, side panels for reading | §8 | Not started |
| 7 | Mushaf two-page spread in landscape | §9.1 | Shipped (`components/mushaf/main.tsx`); move gate to width class |
| 8 | Full player switchable trailing pane | §10.4 | Not started |
| 9 | Remove `UIRequiresFullScreen`; verify compact iPad windows | §11 | Not started |
| 10 | Hover states, secondary click, keyboard shortcuts | §7 | Not started |
| 11 | Accessibility pass: labels, contrast, reduce motion | §12 | Not started |

Screen-level audits and proposals live in [README.md → Audits and proposals](README.md#audits-and-proposals).

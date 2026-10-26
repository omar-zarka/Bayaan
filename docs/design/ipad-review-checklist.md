# UI review checklist (phone and iPad)

Run this before opening any PR that adds or changes UI. Paste the checked list into the PR's Testing section. Each item links to the rule in [ipad-standards.md](ipad-standards.md).

## Screenshots

- [ ] Phone screenshot
- [ ] iPad portrait screenshot (11" or iPad mini)
- [ ] iPad landscape screenshot (13" if you have it, or the 13" simulator)
- [ ] Dark reading theme screenshot of at least one of the above

## Layout

- [ ] Layout is chosen from the window width class, not from `isTablet` alone ([§2](ipad-standards.md#2-width-classes-and-breakpoints))
- [ ] No layout values from `Dimensions.get()` at module scope; rotation updates the screen ([§2.2](ipad-standards.md#22-rules))
- [ ] Reading and form content is width-capped; grids and shelves use the full width with more columns ([§5.3](ipad-standards.md#53-content-width))
- [ ] Page margins match the width class ([§5.2](ipad-standards.md#52-page-margins-and-gutters-by-width-class))
- [ ] Nothing stretches edge to edge on a 13" landscape screen without a reason

## Sizing and type

- [ ] Scaling helpers come from `@/utils/scale`, not `react-native-size-matters` ([§3](ipad-standards.md#3-sizing-and-scaling))
- [ ] Font sizes come from the type ramp; no new one-off sizes ([§4](ipad-standards.md#4-typography))
- [ ] Spacing and radii come from the tokens ([§5](ipad-standards.md#5-spacing-and-layout-grid))
- [ ] Text still fits at the largest Dynamic Type size; rows grow instead of clipping ([§4.3](ipad-standards.md#43-dynamic-type-and-font-scaling))

## Interaction

- [ ] Every target is at least 44×44pt ([§7.1](ipad-standards.md#71-targets))
- [ ] Rows and buttons have a hover state; long-press menus also open on right-click ([§7.2](ipad-standards.md#72-pointer-trackpad-and-mouse))
- [ ] No swipe-only actions
- [ ] On `medium`+ widths, sheets are width-capped, popovers, or side panels rather than full-width bottom sheets ([§8](ipad-standards.md#8-sheets-menus-and-modals))

## Orientation and multitasking

- [ ] Works in all four iPad orientations; scroll position and state survive rotation ([§11](ipad-standards.md#11-orientation-and-multitasking))
- [ ] Works at a compact width on iPad (⅓ Split View or a narrow Stage Manager window, once multitasking is enabled)

## Accessibility and RTL

- [ ] Icon-only buttons have `accessibilityLabel` (through `t()`) and `accessibilityRole` ([§12](ipad-standards.md#12-accessibility))
- [ ] Text contrast is at least 4.5:1 on every reading theme you touched
- [ ] Reduce Motion replaces large animations with fades
- [ ] Arabic UI language: layout mirrors correctly, including the sidebar

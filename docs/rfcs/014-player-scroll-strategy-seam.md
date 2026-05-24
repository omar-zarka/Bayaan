# RFC-014 (XF-NNN draft): Player scroll-handler seam (`branding.useBottomSheetScrollableInQuranView`)

**Status:** Draft (Qariah-side; doc-only PR following Sprint 15 standing rule — unusual structural
patterns → shape approval before code lands)
**Authors:** Omar Zarka (Qariah)
**Targets:** `thebayaan/Bayaan` `develop`
**Related:** RFC-013 (`thebayaan/Bayaan#269`, merged 2026-05-23 — `branding.initialPlayerVerseKey`)

---

## Summary

Add an optional `branding.useBottomSheetScrollableInQuranView?: boolean` field (default `true`,
preserving Bayaan's current behavior). When a fork sets it to `false`, `QuranView` skips
`useBottomSheetScrollableCreator()` and passes no `renderScrollComponent` to `FlashList`. The
swipe-down-to-close gesture on the player sheet is thereby opt-out; forks that need reliable
imperative `scrollToIndex` calls (range-anchored seeks, bookmark deeplinks, future word-by-word
follow-along) can trade the gesture for scroll correctness.

---

## Motivation

### The cross-fork problem

`QuranView/index.tsx` calls `useBottomSheetScrollableCreator()` from `@gorhom/bottom-sheet` and
passes the resulting factory as `renderScrollComponent` on `FlashList`. This wires the Mushaf
list's scroll gesture into the sheet's pan gesture recognizer so the user can swipe down anywhere
on the Mushaf to dismiss the player — a natural and desirable UX for Bayaan.

The gorhom integration has a well-known side effect: **it intercepts imperative scroll calls
(FlashList `ref.current.scrollToIndex(…)` / `scrollToOffset(…)`) whenever the sheet's internal
state machine has not yet settled into `EXTENDED` or `FILL_PARENT`**. During that transition
window — which spans the full open animation on every player launch, and re-occurs on every sheet
snap point change — any imperative scroll is silently no-oped. The list stays at its current
position; no error is thrown, no callback fires.

For Bayaan, which always starts playback from surah position 0 (ayah 1), the sheet transition
window is irrelevant: the imperative `scrollToOffset({offset: 0})` in the surah-change effect
lands at the same position the FlashList would already occupy, so the no-op is invisible.

### Why Qariah hit it

RFC-013 (`thebayaan/Bayaan#269`, merged 2026-05-23) added `branding.initialPlayerVerseKey(track)`
so forks can anchor the Mushaf view on a specific ayah when a track starts playing. Qariah uses
this to support partial-recitation tracks — a track might cover only ayahs 79–86 of Al-Baqarah.
The anchor sequence is:

1. `initialScrollIndex` on `FlashList` → handles the cold-mount case (layout pass).
2. A 2-rAF deferred `scrollToIndex({index: partialStartIndex, animated: false, viewPosition:
   0.05, viewOffset: -headerHeightRef.current})` in the surah-change `useEffect` → handles
   in-app surah switches where `FlashList` stays mounted across re-renders.

In Debug builds (Metro startup latency, slower JS thread), the deferred call fires well after the
sheet has settled → it works. In **iOS Release** builds (fast boot, the user taps "Continue
Listening" before the catalog has fully populated, or switches surahs in rapid succession), the
2-rAF window lands inside the sheet's open animation. The gorhom wrapper intercepts the call, the
list stays at ayah 1, and the track plays audio from ayah 79 while the Mushaf displays ayah 1.

This is the canonical failure mode of combining an imperative-scroll pattern with gorhom's
scrollable integration: the bug is **not detectable in Debug / simulator** and manifests
exclusively in Release on fast hardware.

### Qariah's workaround (Qariah commit `5331148`, 2026-05-24)

1. Drop `useBottomSheetScrollableCreator()` entirely — do not call the hook, do not pass
   `renderScrollComponent` to `FlashList`.
2. Retain `key={currentSurah}` on `FlashList` (remounts on surah change; ensures clean layout
   state before the deferred scroll fires).

The swipe-down-to-close gesture is gone. The sheet is still dismissable via the (×) button in the
player header. The comment at `QuranView/index.tsx` lines 20–28 documents the reasoning:

```
// Note: not wiring `useBottomSheetScrollableCreator()` here. The gorhom
// wrapper intercepts imperative `scrollToIndex` calls when the sheet
// state machine hasn't transitioned to EXTENDED/FILL_PARENT, which on
// iOS Release causes partial-recitation seeks to silently no-op (track
// lands at ayah 1 instead of the partial range start). The sheet is
// already dismissable via the (x) button in the player header, so the
// pan-down-to-close gesture is not required.
```

This workaround is a local Qariah divergence — no seam in the shared codebase lets Bayaan
preserve its gesture while Qariah opts out. This RFC proposes that seam.

### Why Bayaan should care beyond Qariah

Any future imperative scroll into `QuranView` faces the same race. Concrete candidates already in
the Bayaan roadmap or community wishlist:

- **Bookmark deeplinks** — tapping a shared verse link opens the player and jumps to that ayah.
- **Word-by-word follow-along auto-scroll** — the active word scrolls into the center of the
  viewport as audio progresses; must fire continuously, including during the player's open
  animation on first launch.
- **Surah-change verse retention** — if/when the player remembers the last-read ayah per surah
  and restores it on re-open.

All three will silently fail on iOS Release whenever they fire during the open-transition window,
for exactly the same reason Qariah's partial-recitation seek fails. The fix, without a seam, is
a fork-local divergence every time.

---

## Today's behavior in Bayaan upstream

In `components/player/v2/PlayerContent/QuranView/index.tsx`, the relevant lines are:

```tsx
// (inside QuranView function body)
const renderScrollComponent = useBottomSheetScrollableCreator();

// ...

<FlashList
  ref={listRef}
  renderScrollComponent={renderScrollComponent}
  // ... other props
/>
```

`useBottomSheetScrollableCreator()` returns a factory function that gorhom uses to wrap every
inner scroll view rendered by `FlashList`. The wrapper registers the scroll gesture with the
sheet's pan responder. While the sheet is animating (any state other than `EXTENDED` /
`FILL_PARENT`), gorhom holds the scroll gesture and parks imperative calls — the underlying
`ScrollView`/`FlashList` native scroll node is not reachable until the animation completes.

On iOS this is a hard timing dependency: the sheet open animation takes 300–450 ms in Release
(spring physics, no `skipTo` override), and the 2-rAF deferred imperative scroll (RFC-013's
anchor mechanism) fires in approximately 32 ms. The call always lands inside the transition
window.

---

## Proposed change

### Three shape options — requesting Osman's preference

#### Option A — Boolean branding flag (recommended)

```typescript
// config/branding.d.ts

export interface Branding {
  // ... existing fields ...

  /**
   * Whether to wire the `@gorhom/bottom-sheet` scrollable integration into
   * the player's Mushaf FlashList (`QuranView`).
   *
   * When `true` (default), `useBottomSheetScrollableCreator()` is called and
   * its result is passed as `renderScrollComponent` — preserving the
   * swipe-down-to-dismiss gesture on the player sheet. This is Bayaan's
   * existing behavior and the safe default for any fork that does not issue
   * imperative scroll calls during player open/surah-switch transitions.
   *
   * When `false`, the gorhom wrapper is skipped. Imperative `scrollToIndex`
   * and `scrollToOffset` calls on the FlashList ref are guaranteed to reach
   * the native scroll node immediately, regardless of the sheet's animation
   * state. Forks opting out must provide an alternative dismiss affordance
   * (e.g. an explicit close button in the player header).
   *
   * @default true
   */
  useBottomSheetScrollableInQuranView?: boolean;
}
```

Consumption in `QuranView/index.tsx`:

```tsx
import branding from '@/config/branding';

// (inside QuranView function body)
const useBottomSheetWrapper =
  branding.useBottomSheetScrollableInQuranView ?? true;
// Call the hook unconditionally (rules-of-hooks); use its result only
// when the flag is on. When the flag is off the factory is discarded
// and FlashList renders with its default ScrollView wrapper.
const bottomSheetScrollableCreator = useBottomSheetScrollableCreator();
const renderScrollComponent = useBottomSheetWrapper
  ? bottomSheetScrollableCreator
  : undefined;

// ...

<FlashList
  ref={listRef}
  {...(renderScrollComponent ? {renderScrollComponent} : {})}
  // ... other props
/>
```

`branding.js` for Bayaan: field absent (→ `true`, existing behavior).
`branding.js` for Qariah: `useBottomSheetScrollableInQuranView: false`.

**Why this is the recommendation:** smallest API surface, zero change to Bayaan's runtime path,
immediately clear at the call site what is being opted out of, no gorhom internals exposed beyond
the existing hook.

---

#### Option B — Scroll-component factory slot

```typescript
// config/branding.d.ts

export interface Branding {
  /**
   * Factory for the scroll component wrapper passed to the player's Mushaf
   * FlashList as `renderScrollComponent`.
   *
   * When undefined (default), `useBottomSheetScrollableCreator()` is used —
   * preserving the swipe-down-to-dismiss gesture. Return `null` to skip any
   * wrapper (equivalent to Option A's `false`). Return a custom factory to
   * provide a fork-specific scroll integration (e.g. a different gesture
   * library, or a logging wrapper for debugging).
   *
   * The factory is called unconditionally inside `QuranView` — callers that
   * return `null` pay no performance cost beyond the function call.
   */
  playerListScrollComponentFactory?: () =>
    | ((props: React.ComponentProps<typeof ScrollView>) => React.ReactElement)
    | null;
}
```

More flexible — a fork could swap in a completely different gesture wrapper — but exposes a
larger API surface, requires callers to know the `renderScrollComponent` prop shape, and doesn't
cleanly express "I want nothing" without a `null` convention. Option A's boolean expresses
intent more directly.

---

#### Option C — Hook-level auto-detection (no branding flag)

`QuranView` internally checks whether `branding.initialPlayerVerseKey` is configured. If it
returns a non-undefined key for the current track, the hook bypasses the gorhom wrapper for that
render cycle.

No branding flag needed; forks get the correct behavior automatically. But:

- The gorhom-bypass decision is coupled to `initialPlayerVerseKey` semantics, which is an
  accident of RFC-013. Future callers that want imperative scroll for *other* reasons (bookmarks,
  follow-along) would have to misuse `initialPlayerVerseKey` to opt in, or the detection logic
  grows more heuristics.
- The magic is hard to reason about from a fork maintainer's perspective. A flag is explicit
  documentation of a fork-level architectural choice.

Option C is the most invisible but the least maintainable. Not recommended.

---

## API surface (Option A, full specification)

### `config/branding.d.ts` addition

```typescript
/**
 * Whether to wire the `@gorhom/bottom-sheet` scrollable integration into
 * the player's Mushaf FlashList (`QuranView`).
 *
 * `true` (default) — `useBottomSheetScrollableCreator()` called; its result
 *   passed as `renderScrollComponent` on FlashList. The swipe-down-to-dismiss
 *   gesture on the player sheet is active.
 *
 * `false` — gorhom wrapper skipped; imperative `scrollToIndex` /
 *   `scrollToOffset` calls reach the native scroll node immediately, including
 *   during the sheet's open animation. Forks must provide an alternative
 *   dismiss affordance.
 *
 * @default true
 */
useBottomSheetScrollableInQuranView?: boolean;
```

### `config/branding.js` (Bayaan default)

Field omitted — `?? true` in `QuranView` preserves current behavior. Zero diff to
`branding.js` for the Bayaan distribution.

### `QuranView/index.tsx` change (the only code diff)

```diff
+import branding from '@/config/branding';
+
 export const QuranView: React.FC<QuranViewProps> = ({...}) => {
   // ...
-  const renderScrollComponent = useBottomSheetScrollableCreator();
+  const useBottomSheetWrapper =
+    branding.useBottomSheetScrollableInQuranView ?? true;
+  // Hook call is unconditional (rules-of-hooks); result is only used
+  // when the flag is on. When off, the factory is discarded harmlessly
+  // and FlashList renders with its default ScrollView wrapper.
+  const bottomSheetScrollableCreator = useBottomSheetScrollableCreator();
+  const renderScrollComponent = useBottomSheetWrapper
+    ? bottomSheetScrollableCreator
+    : undefined;

   // ...
   return (
     <View style={styles.container}>
       <FlashList
         ref={listRef}
-        renderScrollComponent={renderScrollComponent}
+        {...(renderScrollComponent ? {renderScrollComponent} : {})}
         // ... unchanged props
       />
     </View>
   );
 };
```

Total upstream diff: ~10 lines across 2 files (branding type + `QuranView`). No new files.

---

## Migration / default behavior

**Bayaan:** no change. Field absent → `true` → `useBottomSheetScrollableCreator()` called →
`renderScrollComponent` passed → behavior byte-equivalent to today. Zero action required.

**Forks opting out (`false`):** the swipe-down-to-close gesture on the player sheet stops
working at the Mushaf list level. The sheet itself is not removed — the (×) close button in the
player header, or any other dismiss trigger the fork provides, still works. Forks must audit
their player dismiss UX before shipping this setting.

**Forks that don't set the field:** same as Bayaan. The default is explicit (`?? true`) and
documented so there is no silent behavior change on upstream merge.

---

## Alternatives considered

### Patch gorhom upstream to forward imperative scrolls unconditionally

gorhom deliberately parks scroll calls during sheet animation to avoid conflict between the
sheet's pan responder and an in-progress scroll momentum. Removing that behavior upstream would
affect every gorhom user, not just Bayaan forks, and could introduce physics artifacts in the
sheet close animation on content that is scrolled mid-dismiss. Not our call to upstream-patch a
third-party library for a fork-specific edge case.

### Await the sheet's `EXTENDED` state before firing the deferred scroll

Read gorhom's `animatedIndex` shared value; only call `scrollToIndex` once it equals the
EXTENDED snap value. This works around the race without any branding seam. Drawbacks: requires
importing gorhom internals inside `QuranView` (couples the component to sheet implementation
details), the `animatedIndex` threshold for "settled enough to accept scroll" is not part of
gorhom's public contract and has shifted across minor versions, and it adds async complexity
(another `useEffect` with an Animated listener) to a component already managing several effects.
The flag approach is O(1) and version-stable.

### `key={currentSurah}` alone (remount on surah change)

Remounting `FlashList` resets layout state, which prevents a stale-list scroll race — but
`initialScrollIndex` (set during the mount layout pass) also fires inside the sheet's transition
window when the player opens for the first time on a given surah. The no-op race is orthogonal to
whether the list was remounted. `key={currentSurah}` is a useful companion fix (it is retained in
Qariah's workaround) but does not address the gorhom interception by itself.

### Forks shadow `QuranView` entirely

Each fork that needs reliable imperative scroll copies `QuranView/index.tsx` and omits the
gorhom line. This defeats the multi-tenant model the cross-fork seam work has been building
toward (RFC-007, RFC-010, RFC-011, RFC-013). Every upstream change to `QuranView` would need
manual porting into each fork's shadow copy — for what is a single conditional hook call.

---

## Open questions

1. **FlashList prop absent vs `undefined`.** The snippets above call
   `useBottomSheetScrollableCreator()` unconditionally (rules-of-hooks compliant — see the inline
   comment in the Option A snippet) and use a `{...(renderScrollComponent ? {renderScrollComponent}
   : {})}` spread to omit the prop entirely when the wrapper is off. Osman should confirm whether
   this matches Bayaan's preferred pattern, or whether `renderScrollComponent={undefined}` is
   acceptable (FlashList accepts both; spread keeps prop-shape parity with the no-fork case).

2. **Debug vs Release surface.** The interception race is invisible in Debug builds because Metro
   startup latency means the deferred rAF calls fire long after the sheet has settled. If Bayaan
   adopts a future imperative-scroll feature (follow-along, bookmark deeplink), it will not be
   testable in simulator Debug without artificially delaying the call. Should the PR that lands
   this flag also add a dev-only warning when `useBottomSheetScrollableInQuranView: true` and an
   imperative scroll fires within N ms of the sheet's last state change?

3. **Naming.** `useBottomSheetScrollableInQuranView` is precise but long. Alternative:
   `playerMushafScrollBehavior: 'gorhom' | 'native'`. The boolean keeps the API surface smaller;
   the string union is more self-documenting at the use site. Happy to use whichever Osman
   prefers.

---

## Out of scope

- **The code PR.** This RFC is doc-only on landing. A code PR follows once the shape (and
  preferably the naming) clears.
- **Any change to `branding.initialPlayerVerseKey`.** That is RFC-013, already merged. This RFC
  only addresses the scroll-integration plumbing that RFC-013 exposes as a race condition.
- **Changes to the player sheet's snap behavior or animation timing.** The race window is a
  consequence of gorhom's gesture integration, not the sheet configuration.
- **Android.** The same gorhom behavior exists on Android, but the race is narrower in practice
  (Android's Choreographer schedules the rAF callback after the first Vsync following layout
  commit, which on typical release build timing lands after the sheet's initial EXTENDED
  transition). Qariah has not observed the failure on Android. The flag would still apply on
  Android consistently.

---

## Cross-references

- RFC-013 — `branding.initialPlayerVerseKey` (`thebayaan/Bayaan#269`, merged 2026-05-23). This
  RFC formalizes the scroll seam that RFC-013's anchor mechanism requires.
- Qariah Sprint 23 working fix — commit `6f64a6f8535b33abc080a38942e163ff225059ac` (original
  out-of-band patch, dropped `useBottomSheetScrollableCreator` as an ad-hoc divergence).
- Qariah Sprint 24 restore — commit `5331148` (today, 2026-05-24; re-applied the workaround on
  the Sprint 24 branch; comment added at `QuranView/index.tsx:20–28`).
- Sprint 15 standing rule: "Unusual structural patterns → doc-only RFC PR first; code PR follows
  once shape clears."

---

## Maintainer ask

Requesting Osman's preference on:

1. **Option A (boolean flag) vs Option B (factory slot) vs Option C (auto-detect).** Recommendation
   is Option A — smallest surface, most explicit, no behavior change for Bayaan. Happy to be
   pushed toward B if there is appetite for a more general scroll-wrapper seam.
2. **Naming** — `useBottomSheetScrollableInQuranView` vs `playerMushafScrollBehavior: 'gorhom' |
   'native'` vs something else.
3. Whether the dev-only warning (open question 2) is worth including in the code PR.

Once shape clears, a code PR follows. Given the small diff (~10 lines), a combined doc + code PR
is also fine if that's easier to review in one pass.

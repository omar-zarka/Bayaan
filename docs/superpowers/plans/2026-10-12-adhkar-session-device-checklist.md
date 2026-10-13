# Adhkar Session Widget Phase 1: Device Checklist Results

Plan: `docs/superpowers/plans/2026-10-12-adhkar-session-widget-phase-1.md` (Task 7).

Environment:
- Commit: `f2e39707` on `feat/adhkar-session-widget`.
- iOS: "Bayaan Widgets" simulator (B68030CC), iPhone 17 Pro, iOS 26.2, Xcode 27. Release build with the embedded JS bundle (`xcodebuild ... -configuration Release -sdk iphonesimulator`, incremental into the existing `trimdd` derived data), reinstalled (fresh data), widgets added from the gallery (search "Bayaan", pages 23 to 25 of 27).
- Android: Pixel_API_36 emulator (1080x2400, 420 dpi, Pixel launcher). Release APK with the embedded bundle: `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease -Dorg.gradle.jvmargs="-Xmx6g -XX:MaxMetaspaceSize=2g"` (the first plain run failed with `OutOfMemoryError: Metaspace` in `:expo-updates:kspReleaseKotlin` plus lint worker failures). Reinstalled (fresh data).
- Run time: 2026-10-12, 20:34 to 21:05 local, so both platforms showed the Evening Adhkar session.
- Screenshots: `/private/tmp/claude-501/-Users-osmansaeday-orca-workspaces-Bayaan-widgets/c0503663-a396-4272-91ae-d9723ef577f3/scratchpad/adhkar-qa/` (file names below are relative to it).

Status key: PASS, PARTIAL, FAIL, NOT RUN.

## iOS

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Card 1: "1 of 24", no Prev, check in the counter | PASS | Medium and large both. `ios-01-card1-medium-large.png` |
| 2 | Next to card 2 (x3); ring 3, 2, 1, then card 3 | PASS | Ring went 3, 2, 1 and the third tap moved both widgets to "3 of 24". The widget redraw lags the tap by up to about a second. `ios-02-card2-ring2.png`, `ios-03-card3-dhikr77.png` |
| 3 | Prev from card 3 returns to card 2 with the ring at 3 | PASS | `ios-04-prev-card2-ring3.png` |
| 4 | Dhikr 77: medium opening, "…", caption; large full text unless `largeCut` | PASS | Medium shows the opening, ellipsis and "Read the rest in Bayaan →". Large: 77 has `largeCut: true`, shows the cut text and the caption. See the layout note in extra check 1. `ios-03-card3-dhikr77.png` |
| 5 | Body tap on card 3 opens the list at dhikr 77; card 1 opens at the top | PARTIAL | Card 3: opened the Evening list with dhikr 3 directly under the glass header, no "Open in Bayaan?" prompt, position unchanged 6 s later (`ios-06-deeplink-77-t6s.png`). Card 1 with the list freshly mounted: top (`ios-07-deeplink-card1-top-fresh.png`). Card 1 while the app was still on the same list (warm): stayed at dhikr 3 (`ios-07b-deeplink-card1-warm-stays-at-3.png`), see bug 3. |
| 6 | Finish, completed state, Start again; completion event | PASS | Completed state on both sizes (`ios-08-completed.png`); Start again returned to card 1 (`ios-09-start-again-card1.png`). Before opening the app the app group plist held `widgets.pendingEvents = [{"name":"adhkar_session_completed","props":{"dhikr_count":24,"duration_ms":298360,"category":"evening-adhkar"}}]`; after `launch-app` the key was gone (drained). PostHog live events not checked. Note: `xcrun simctl spawn ... defaults read group.com.bayaan.app widgets.pendingEvents` does not see the app group container; read `data/Containers/Shared/AppGroup/<uuid>/Library/Preferences/group.com.bayaan.app.plist` with `plutil -p` instead (the key contains a dot, so `plutil -extract` fails too). |
| 7 | Bayaan Now during adhkar hours shows the session; a tap updates both | NOT RUN | Run was at 20:45 to 20:48; Bayaan Now evening adhkar runs 15:00 to 19:59, so it showed listening (`ios-11-small-and-bayaan-now-2048.png`). No simulator clock control. The "tap updates both" half was confirmed between the medium and large Adhkar widgets (every tap on the medium updated the large). |
| 8 | Small widget unchanged, English title | PASS | "Evening Adhkar" title, single rotating dhikr, no session controls. `ios-11-small-and-bayaan-now-2048.png` |

## Android

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Card 1 | PASS | 3x2 (MEDIUM_TALL bucket): "1 of 24", no Prev, check. `and-01-medium-card1.png` |
| 2 | Card 2 ring 3, 2, 1, then card 3 | PASS | `and-02-medium-card3.png` |
| 3 | Prev from card 3 to card 2, ring 3 | PASS | Accessibility label "Count, 3 left". |
| 4 | Dhikr 77 medium and large | PARTIAL | Medium: opening, "…", caption, two readable lines (`and-02-medium-card3.png`). Large (3x3): the Arabic is clipped mid-line, see bug 2 (`and-05-large-card3.png`, `and-05-large-crop.png`). |
| 5 | Body tap on card 3 / card 1 | PARTIAL | Card 3 opened the list with dhikr 3 directly under the header, settled (`and-06-deeplink-77.png`). Card 1 warm: stayed at dhikr 3 (`and-09-card1-warm-stays-at-3.png`, bug 3). Card 1 after leaving the screen: top (`and-10-card1-fresh-top.png`). |
| 6 | Finish, completed, Start again; event | PARTIAL | Completed (`and-07-completed.png`) and Start again to card 1 (`and-08-start-again-large-card1-clipped.png`) PASS. Event queue NOT RUN: the release APK is not debuggable (`run-as: package not debuggable`), so the SharedPreferences queue could not be read; covered by the JVM/unit tests only. |
| 7 | Bayaan Now during adhkar hours | NOT RUN | 21:00 local (bedtime window); no clock change made this run. |
| 8 | Small unchanged | PASS | 2x2 on first add: "Evening Adhkar", static dhikr. `and-12-small-2x2.png` |

## Extra checks from reviews

| # | Check | Result | Notes |
|---|-------|--------|-------|
| E1 | iOS medium fits: header, 3 lines at 18pt, cut caption, 34pt controls, nothing clipped | FAIL | Nothing is clipped, but the Arabic never gets more than one line. Measured from full resolution screenshots: a short uncut card (dhikr 97, 62 chars) renders at full 18pt on one line (`ios-10-card23-short.png`); uncut dhikr 78 (102 chars) is squeezed onto one line at about 13pt (`ios-05-card4-uncut.png`, `ios-05-medium-crop.png`); cut cards with the caption render at about 12pt and SwiftUI adds its own truncation after about 60 characters (`ios-01-medium-crop.png`). Cause: the medium content height is about 130pt after padding; header (about 30pt), caption (about 13pt), controls (34pt) and five 6pt VStack gaps leave about 23pt for the text with a caption and about 42pt without. A Digital Khatt line at 18pt needs about 37pt, so 3 lines at 18pt (about 111pt) cannot fit. See bug 1. |
| E2 | Android 110 dp compact layout (and Bayaan Now) and large with long translations | FAIL | Compact NOT RUN: on the Pixel launcher the Adhkar widget cannot be shrunk below 2 rows (`minHeight` 110 dp needs 2 cells), so the 110 dp bucket was not reachable (`and-13-min-height-2-rows.png`); Bayaan Now was outside adhkar hours. Large FAIL: bug 2. |
| E3 | Deep link lands the dhikr under the header; `onScrollToIndexFailed` settles | PASS | iOS glass header and Android both land dhikr 3 directly below the header with the previous card's footer just hidden; no repeated jumping (iOS rechecked after 6 s, Android `await-screen-idle` settled in 1.6 s). |
| E4 | Tap shortly after a period boundary | NOT RUN | Needs clock control; covered by the reducer vectors only. |

Observation (known data issue, not fixed here): the Evening session shows morning wording, for example card 3 starts "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ" and its translation "We have reached the morning", because both periods use the same category.

## Bugs found

1. iOS medium Arabic is one line at 12 to 13pt for most cards (E1). Budget changes cannot fix the cut cards because the text is height bound, not width bound. Needs a layout change in `AdhkarSessionView.swift` (for example less vertical chrome on medium, or a smaller Khatt line height) before the medium budget can be calibrated.
2. Android large clips the Arabic bitmap mid-line on long cards (dhikr 75 and 77 at 3x3, 266x344 dp). `AdhkarSessionContent` sizes the text from `LocalSize`, which is the Responsive bucket (LARGE 250x250), not the real widget size, so the Arabic gets about 52 dp (250 minus padding, header, translation lines, caption and controls). `ArabicBitmap.render` then draws the 420-char text at the minimum size into that height and the overflow is cut off instead of ending on a whole line with an ellipsis. Visible as two lines plus the tops of a third (`and-05-large-crop.png`), with empty space above and below.
3. A widget link without `?dhikr` (card 1, completed) does not scroll the list to the top when the adhkar screen is already open on the same set; it keeps the previous position. Same for a repeated link to the same dhikr after the user scrolled (the `scrolledTo` ref blocks it). Both platforms. `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx`.

## Budget calibration

No change. `SESSION_MEDIUM_CHARS` stays 110 and `SESSION_LARGE_CHARS` stays 420.

- Medium: uncut cards around 100 chars render at about 13pt on iOS, just under the 14pt line, so the rule says lower. But lowering to about 80 would turn every 80 to 110 char card into a cut card, and cut cards render smaller (about 12pt, height bound by the caption). Android medium (MEDIUM_TALL) shows two readable lines at 110. The fix is the iOS layout (bug 1); recalibrate after it.
- Large: iOS large shows 415 to 419 char cards on 5 to 6 lines at about 14 to 15pt with the translation and caption (`ios-01-large-crop.png`), so 420 fits iOS. Android large cannot show it, but that is bug 2 (bucket sizing and clipping), not the budget.

## Verification

| Command | Result |
|---------|--------|
| `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit` | PASS (exit 0) |
| `npx jest services/widgets modules/bayaan-widgets/src plugins` | PASS (34 suites, 313 tests) |
| `bash scripts/check-widget-content.sh` | PASS (exit 0) |
| `npm run test:widget-fixtures` | PASS (exit 0) |
| `cd android && ./gradlew :bayaan-widgets:testDebugUnitTest` | PASS (run with `-Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g"`) |
| iOS Release iphonesimulator xcodebuild at `f2e39707` | PASS (BUILD SUCCEEDED, derived data `trimdd`) |

# Widgets Phase 1a: Device Checklist Results

Plan: `docs/superpowers/plans/2026-10-08-widgets-phase-1a.md` (Task 10).

Environment:
- iOS: iPhone 17 Pro simulator, iOS 26.2 ("Bayaan Widgets", B68030CC), Xcode 27. Release build via xcodebuild unless noted (the Debug dev client cannot run app JS on a background launch).
- Android: pending (Pixel_API_36 emulator, once disk space allows).
- The host was heavily loaded for part of the run (load average 200 to 800 from other sessions' builds), so absolute timings below are not representative of a phone.

Status key: PASS, PARTIAL, FAIL, PENDING.

## iOS

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | App killed, tap Play on small widget | PARTIAL | The widget side always works: the intent writes the optimistic override (icon flips at once), enqueues the command and iOS launches the app in the background within a second. Whether the command runs depends on how long JS boot takes in the background: a fresh install drained at +18 s and played. With a restored session, boot measured +75 s before `prepare()` started and +108 s to ready, past the 60 s command staleness window, so the command was dropped and the icon reverted after 61 s. Foreground cold boot of the same build is about 12 s. Needs a phone measurement before deciding between a longer window and the brief's `ForegroundContinuableIntent` fallback. |
| 2 | App alive in background, pause then play | PASS | Optimistic override flips both widgets within about 1.5 s of each tap; snapshot follows (paused at 280 s, then playing). No double toggle. A brief crossfade shows old and new time labels for one frame. |
| 3 | Tap an up-next row (medium) | PASS | Tapped Ali 'Imran in Saud Al-Shuraim's queue: jumped to that track (same reciter, same rewayah), queue kept (An-Nisa, Al-Ma'idah, Al-An'am up next). |
| 4 | Fresh install, no playback | PASS | Small and medium show surah of the day (Ar-Rahman) with the default reciter (Mishary Alafasy) and artwork. Medium right column is empty on a fresh install. |
| 5 | Play 3 minutes with widget visible | PASS | 0 snapshot writes and 1 timeline task in 180 s of playback; countdown and progress bar animate on their own. No reload loop. |
| 6 | Change theme in the app | PARTIAL | The snapshot picks up the theme within about 1 s. Continue Listening is artwork-tinted, so it looks the same in light and dark; the no-artwork fallback stays dark (Ruling 23, moved to 1b). |
| 7 | Artwork missing (offline proxy: cached files deleted) | PASS | Neutral tiles, layout intact, no crash; the app re-cached the artwork on its next snapshot and the widget showed it again. True airplane mode not reproduced on the simulator. |
| 8 | iOS 26 tinted and clear modes | PASS | Artwork stays full color in both; text readable on the tinted and glass backgrounds. |
| 10 | Deep links from cold start | PARTIAL | `mushaf/293` opens page 293. `quran/18?ayah=10` now opens page 294 (fixed). `mushaf/9999` falls back to page 1 with no crash. `player` opens the full player only when the app is already running (fixed); from a cold start it lands on Home with the sheet closed. |
| 11 | `npm run prebuild` (iOS) from clean reproduces a building project | PASS | Widget target, App Group, extension Info.plist and intents regenerate identically to the committed `ios/` (pbxproj compared with object IDs normalized). Other drift (versions, Sentry phase, EXUpdates, associated domains, ShareExtension attributes) predates this branch. Builds with the known local Xcode 27 workarounds only. Do not pass a global `IPHONEOS_DEPLOYMENT_TARGET`: it drags the iOS 17 extension down. |

### Fixes made during the run

- `3573bdcf` Pick a rewayah that has the surah when the widget sends none. The surah-of-the-day hero sends `rewayatId: null`; `createTrack` fell back to `rewayat[0]`, a 6-surah al-Duri rewayah for Mishary Alafasy without Ar-Rahman, so the widget queued a 404 URL.
- `722bc1aa` Fit the medium hero column inside the widget. It stacked about 170 pt into 130 pt and clipped the artwork; now uses the small widget's layout.
- `c7622081`, `ac5b39b0` Open `bayaan://quran/{surah}?ayah=N` at the ayah's page.
- `3c3627ed` Open the full player from `bayaan://player` while the app runs.

### Open items

- Item 1: background cold boot with a restored session can exceed the 60 s command window. Measure on a phone first.
- Item 10: `bayaan://player` from a cold start does not open the full player. The sheet renders nothing until the session is restored; waiting for the restore was tried and did not help, so the cause is not found yet.
- After the app is killed while playing, the widget keeps showing "playing" with a running countdown until the computed track end (M6 behavior), since no final snapshot is written.
- Small widget truncates long reciter names when the countdown shows.
- Debugging note: Argent sets `DYLD_INSERT_LIBRARIES` in the simulator's launchd environment, which stalled background launches inside Expo module registration for minutes. Clear it with `simctl spawn <udid> launchctl unsetenv DYLD_INSERT_LIBRARIES` before timing cold starts.

## Android

All items PENDING (disk space).

## Carried items

| Item | Result | Notes |
|------|--------|-------|
| Optimistic override expires after 61 s | PASS (iOS) | Seen in item 1: when the command was dropped, the icon reverted to Play once the override expired. |
| I9: Android background activity launch on API 34+ | PENDING | Android |
| Bitmap payload under RemoteViews limit | PENDING | Android |

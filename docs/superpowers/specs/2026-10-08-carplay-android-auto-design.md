# CarPlay and Android Auto Design

**Date:** 2026-10-08
**Status:** Implemented, synced with the build (see section 8)
**Branch:** `osmansaeday/carplay` (based on `origin/develop`, Expo SDK 56)
**Supersedes:** `docs/features/carplay-android-auto.md` (Feb 2026 plan, never built)

## 1. Goal

Ship CarPlay and Android Auto together, at a quality bar comparable to Spotify on the same platforms. Both platforms only allow system templates, so quality comes from four things:

1. Artwork on every tile (no blank squares).
2. Content ready the instant the car connects (no spinners, no empty tabs).
3. Personal, situational shelves on Home.
4. Playback and now-playing state that always match the phone.

### Decisions already made

| Decision | Choice |
|---|---|
| Audio engine | Keep `expo-audio`. Do not fork or replace it. |
| Platforms | CarPlay and Android Auto in the same release. |
| CarPlay entitlement | `com.apple.developer.carplay-audio` already approved for `com.bayaan.app`. |
| Browsing | Native, driven by a snapshot JS writes. |
| Playback | JS. Native sends play requests; `playerStore` and `ExpoAudioService` execute them. |

### Out of scope (v1)

- Siri / App Intents (`.audio.playAudio` schema). Good v2.
- Adhkar audio (separate player, `AdhkarAudioProvider`).
- Synced verse text on the car screen.
- Android Car App Library templated media (`MediaPlaybackTemplate`); still beta, not allowed on production tracks as of 2026-10-02.
- Android Automotive OS (built-in car OS) as a dedicated target.

## 2. Information architecture

Four root tabs on both platforms (Android Auto caps root children at 4; CarPlay audio apps effectively do too):

```
[ Home ]  [ Library ]  [ Reciters ]  [ Surahs ]
```

### Home

- **Quick start row** (CarPlay: `CPListTemplate.headerGridButtons`, iOS 26+; Android Auto: first section, grid style). Up to 4:
  - Resume (last played item at its saved position)
  - Shuffle Loved (hidden if no loved tracks)
  - Situational slot 1 and 2 (from the rules below)
- **For right now**: situational cards (CarPlay: `CPListImageRowItemCardElement`, iOS 26+; fallback image row).
- **Jump back in**: recently played, with progress (iOS `CPListItem.playbackProgress`; Android `COMPLETION_PERCENTAGE` extra). `CPPlaybackConfiguration` (iOS 26.4) is not used because the snapshot carries only a progress fraction, not elapsed time and duration.
- **Your reciters**: favorite reciters, circular portraits (`CPListImageRowItemImageGridElement` circular, iOS 26+). The Library group is titled "Favorite reciters".
- **Your playlists**: user playlists, then system playlists.

Empty sections are omitted. A brand-new user sees Quick start (situational only), For right now, and system playlists.

### Situational rules

Computed in TypeScript (one implementation, both platforms) by a pure function `buildSituationalPicks(now, context)`:

| Rule | Condition | Item |
|---|---|---|
| Friday Kahf | Thursday 18:00 through Friday 19:00 local time (approximates the sunnah window, Maghrib Thursday to Maghrib Friday) | Surah 18 by top reciter |
| Morning | 04:00 to 10:59 | System playlist `morning-reflections` |
| Night | 21:00 to 03:59 | Surah 67 (Al-Mulk) by top reciter, then system playlist `evening-serenity` (no "before sleep" playlist exists) |
| Up next | Most recent recently-played item completed (progress >= 95%) and surah < 114 | Next surah, same reciter and rewayah |

- **Top reciter** = the most recently played reciter in `recentlyPlayedStore` (non-upload), else `useReciterStore.getState().defaultReciter`. `playCountStore` counts per surah, not per reciter, so it is not used.
- Rules are ordered as listed; at most 4 picks; duplicates removed.
- Time windows use the device's local clock. No prayer-time data exists in the app; these are fixed windows.

### Library

Loved, Playlists, Downloads (offline-only items; playable without network), Favorite reciters.

### Reciters

- A to Z, favorites first, circular portraits.
- Reciter with one rewayah: opens its surah list. More than one: opens a rewayah picker first.
- iOS 26.4+: reciter surah list uses the details header (`CPListTemplateDetailsHeader`, large reciter card above the list). Older iOS: plain list with the reciter as the first row.
- Surah lists respect `surah_list` for the rewayah (only available surahs shown).

### Surahs

- All 114 surahs (surah artwork tiles), plus a Juz grouping.
- Tapping a surah opens a short list with "Play with <top reciter>" and "Choose reciter" (not direct play). "Choose reciter" lists favorites first, then all reciters that have that surah.

### Now Playing

- CarPlay `CPNowPlayingTemplate.shared`:
  - Buttons: playback rate, repeat, love (`CPNowPlayingImageButton`).
  - `isUpNextButtonEnabled = true` (queue list).
  - `isAlbumArtistButtonEnabled = true` (opens the reciter).
  - Transport from `MPRemoteCommandCenter`: `nextTrackCommand` and `previousTrackCommand` registered by `bayaan-car` (expo-audio registers play, pause, scrub, and 10s skip only).
- Android Auto: system player driven by our `MediaLibrarySession`; custom actions for speed and repeat; love as a custom action.

### Voice (Android only in v1)

`onSearch` / `onGetSearchResult` and play-from-search on the library session, required by Android Auto quality guideline VC-1. Parses "surah name" and optional "by reciter name" against the snapshot's search index (surah names in English transliteration and Arabic, reciter names).

## 3. Artwork

- **Surahs:** R2 cards at `https://cdn.thebayaan.com/assets/og-images/surah/{id}.png` (dark) and `{id}-light.png` (light). Variant follows the car's interface style (CarPlay `traitCollection.userInterfaceStyle`; Android Auto: dark). The base comes from the snapshot's `surahArtworkBase` (set by `branding.surahArtworkCdnBase`, https only); natives fall back to the Bayaan CDN when it is absent.
- **Reciters:** API `image_url` (https) first, then the bundled image from `utils/reciterImages.ts` (exported by JS into the snapshot as a local file URI), then a generated monogram tile (initials on a per-reciter color). Never transparent.
- **Playlists:** system playlist color as a solid tile with the title; user playlists use the first item's reciter portrait.
- **Android artwork provider:** a hardened `ContentProvider` serves artwork to Android Auto. It validates keys strictly, fetches only https URLs present in the snapshot, applies timeouts, size caps and decode bounds, caps the disk cache, and renders monogram/color tiles on demand.
- **Native image cache:** source PNGs are about 700 KB each. Native downloads once, downscales to 256 px, stores in the app caches directory (iOS `Caches/bayaan-car/artwork/`, Android `cacheDir/bayaan-car/artwork/`), so artwork works offline after first fetch unless the OS purges caches. Approx 7 MB for all surah variants. Cache is populated lazily and also prefetched for Home items when the snapshot changes.

## 4. Architecture

```
JS (existing app)                        modules/bayaan-car (local Expo module)
-----------------                        --------------------------------------
recentlyPlayedStore, lovedStore,    -->  snapshot file (JSON, versioned, app private storage)
playlistsStore, downloadStore,           iOS: Application Support (app private storage, not the App Group)
playCountStore, favoriteReciters,        Android: filesDir
reciters (dataService)
   |  CarSnapshotService (debounced)     iOS: CarPlaySceneDelegate (Swift)
   v                                       templates built from snapshot
playerStore  <-- onPlayRequest ---------   iOS 26/27 features behind #available
   |          <-- onTransport (next/prev, Android: BayaanLibraryService (Kotlin)
   |              rate, repeat, love)       Media3 MediaLibraryService
   v                                        browse tree + search from snapshot
ExpoAudioService (expo-audio)
   |  CarNowPlayingBridge
   +-- now playing, queue, state ------> car Now Playing / Up Next / progress
```

### 4.1 Units

**`services/car/snapshot/buildCarSnapshot.ts`** (pure)
- Input: store states, reciters, surahs, system playlists, `now`.
- Output: `CarSnapshot` (typed, see 4.2).
- Includes `buildSituationalPicks`.
- No I/O. Fully unit tested.

**`services/car/CarSnapshotService.ts`**
- Subscribes to the relevant stores; on change, rebuilds and calls `BayaanCar.writeSnapshot(json)`.
- Debounced 2 s; also runs once on app start and when the app returns to foreground.
- Situational picks depend on time, so it also rebuilds on a 15-minute timer while the car is connected (`BayaanCar.onCarConnectionChanged`).

**`services/car/CarPlaybackBridge.ts`**
- Listens to `onPlayRequest` and `onTransport` events from native.
- Converts a `CarPlayRequest` into a queue via existing `createTrack` / `updateQueue` / `playerStore` actions (the same path the phone UI uses), then starts playback.
- Pushes now-playing, including the queue summary, to native via `BayaanCar.setNowPlaying(...)` on `playerStore` changes.

**`modules/bayaan-car/`** (Expo module, iOS + Android)
- JS API: `writeSnapshot(json)`, `setNowPlaying(info)` (carries the queue), `markJsReady()`, events `onPlayRequest`, `onTransport`, `onCarConnectionChanged`.
- Holds play requests that arrive before `markJsReady()` and delivers them in order after.
- iOS: `CarPlaySceneDelegate`, `CarTemplateBuilder`, `CarArtworkCache`, remote command registration (next/previous) active only while a Bayaan track is loaded.
- Android: `BayaanLibraryService` (`MediaLibraryService`), `CarBrowseTree`, `CarArtworkCache`, forwarding player (see 4.4).

**`plugins/withBayaanCar.js`** (config plugin; must survive `prebuild --clean`)
- iOS:
  - Add `UIApplicationSceneManifest` with two scene configs: phone (`UIWindowSceneSessionRoleApplication`, `PhoneSceneDelegate`) and CarPlay (`CPTemplateApplicationSceneSessionRoleApplication`, `CarPlaySceneDelegate`).
  - Move window creation from `AppDelegate` into `BayaanCarSceneBridge`, adopted by `PhoneSceneDelegate`.
  - `UIApplicationSupportsMultipleScenes` = true. A second phone scene (iPad) is refused: the new session is destroyed and the primary window is untouched.
  - Add `com.apple.developer.carplay-audio` to entitlements. Option `carPlayAudioEntitlement` (default true) lets forks without the entitlement skip it.
- Android:
  - `res/xml/automotive_app_desc.xml` with `<uses name="media"/>`.
  - `com.google.android.gms.car.application` meta-data.
  - Service declaration for `BayaanLibraryService` with only the legacy `android.media.browse.MediaBrowserService` intent filter (the Media3 `MediaLibraryService` action is not exposed, which avoids a foreground-service crash on media button events), `foregroundServiceType="mediaPlayback"`. `onStartCommand` has a MEDIA_BUTTON safety net.
  - Android Auto pagination is honoured, with a 500 item cap per page.

### 4.2 Snapshot schema (v1)

```ts
interface CarSnapshot {
  version: 1;
  generatedAt: string; // ISO
  home: {
    quickStart: CarItem[];   // max 4
    sections: CarSection[];  // For right now, Jump back in, Your reciters, Your playlists
  };
  library: CarSection[];      // Loved, Playlists, Downloads, Favorite reciters
  reciters: CarReciter[];     // favorites first, then A to Z
  surahs: CarSurah[];         // 114
  juz: { number: number; surahIds: number[] }[];
  searchIndex: { surahs: CarSearchSurah[]; reciters: CarSearchReciter[] };
  surahArtworkBase?: string;  // https, ends in '/'; natives default to the Bayaan CDN
}

interface CarItem {
  id: string;              // stable, used as media id
  title: string;
  subtitle?: string;
  artwork: CarArtwork;     // { kind: 'surah', surahId } | { kind: 'url', url } | { kind: 'file', uri } | { kind: 'color', hex, label }
  progress?: number;       // 0..1
  isDownloaded?: boolean;
  action: { kind: 'play'; request: CarPlayRequest } | { kind: 'browse'; target: CarBrowseTarget };
}

type CarPlayRequest =
  | { kind: 'surah'; reciterId: string; rewayatId: string; surahId: number; startAt?: number }
  | { kind: 'playlist'; playlistId: string; system: boolean; startIndex?: number }
  | { kind: 'loved'; shuffle?: boolean; startIndex?: number }
  | { kind: 'downloads'; startIndex?: number }
  | { kind: 'resume' };
```

- Reciter surah lists are not pre-expanded per reciter (that would be thousands of items). Native builds them on demand from `reciters[].rewayat[].surahList` plus `surahs`.
- `version` lets native reject a snapshot it does not understand and keep the previous one.
- If no snapshot exists yet (first install, never opened), native shows a single "Open Bayaan on your phone to get started" row; Android Auto returns an empty root with the same message as an error state.

### 4.3 Cold start

- **iOS:** CarPlay connecting launches the app process. The AppDelegate no longer creates the window; `BayaanCarSceneBridge` starts React Native into a host window on whichever scene connects first (phone or CarPlay), so JS runs either way. Templates render from the snapshot immediately; play requests queue until `markJsReady()`.
- **Android:** Android Auto binds `BayaanLibraryService` with no Activity. The service serves the browse tree from the snapshot immediately. On the first play request (or on connect), the service starts the React Native host (`ReactHost.start()` from the application's `ReactNativeHost`) so JS can run `CarPlaybackBridge`. Requests queue until `markJsReady()`.

### 4.4 Android media session coexistence (risk)

expo-audio runs its own `MediaSessionService` (`AudioControlsService`) with a session that removes next/previous commands. Android Auto connects to the service declared for media browsing, which will be ours.

Plan:
- `BayaanLibraryService` hosts a `MediaLibrarySession` around a forwarding player (`SimpleBasePlayer`) that mirrors state pushed from JS (`setNowPlaying`, whose payload includes the queue) and forwards commands (play, pause, seek, next, previous, set rate) to JS as `onTransport` events.
- Only one notification: either expo-audio's or ours. Spike decides which (expo-audio's lock screen config is controlled from JS via `setActiveForLockScreen`).
- Background playback must keep working with the phone screen off and with Android Auto disconnected mid-playback.

**Fallback if the spike fails:** a minimal Android-only `patch-package` patch to expo-audio that exposes its `ExoPlayer` to our library session. Requires sign-off from the project owner before use.

### 4.5 iOS scene migration (risk)

Moving the phone app from an app-delegate window to scene-based lifecycle affects startup for every user. Must verify after the change:
- Splash screen, `expo-router` deep links (`bayaan://`, universal links), share extension handoff (`expo-share-intent`), notifications tap handling, `expo-screen-orientation`, `expo-updates`.

## 5. Implementation order

1. **Spike A (iOS scenes):** add scene manifest and `PhoneSceneDelegate` via the plugin; verify the checklist in 4.5. Throwaway CarPlay scene with one static list in the CarPlay Simulator.
2. **Spike B (Android session):** `BayaanLibraryService` with a hardcoded tree in the Desktop Head Unit; play through expo-audio from JS; verify single notification and background playback; verify cold start with app killed.
3. Snapshot types, `buildCarSnapshot`, situational rules, with unit tests.
4. `CarSnapshotService` and native snapshot reading on both platforms.
5. CarPlay templates (iOS 16.4 baseline, iOS 26 and iOS 27 enhancements behind `#available`).
6. Android browse tree, content styles, extras, search.
7. `CarPlaybackBridge`, now playing and queue sync, next/previous, rate, repeat, love.
8. Artwork cache on both platforms.
9. Polish pass on device and head unit.

If either spike fails, stop and revisit the design with the project owner before step 3.

## 6. Testing

- **Unit (Jest):** `buildCarSnapshot`, `buildSituationalPicks` (each rule, boundaries such as Thursday 17:59 vs 18:00 and Friday 19:00, empty stores), `CarPlayRequest` to queue conversion, search parsing.
- **iOS:** CarPlay Simulator (Device Hub, Xcode 27) on iOS 26 and iOS 27 runtimes; plus an older runtime (iOS 17 or 18) to check fallbacks.
- **Android:** Desktop Head Unit (DHU) against an emulator and a physical phone.
- **Manual scenarios:** cold start from car with app killed; connect mid-playback; disconnect mid-playback; airplane mode with downloads; switching light/dark in the car; empty-state new install; phone UI and car stay in sync when controlling from either.
- **Before release:** at least one real CarPlay and one real Android Auto head unit.
- `npx tsc --noEmit`, `npx prettier --write`, existing Jest suite pass.

## 7. Open items to resolve during implementation

- Juz grouping: a juz spans partial surahs; v1 lists the surahs that start in each juz (`data/juzData.ts`).
- Done: `docs/features/carplay-android-auto.md` points to this spec.

## 8. Deviations from the original draft

1. Top reciter comes from `recentlyPlayedStore`, not `playCountStore`.
2. The Night rule uses `evening-serenity`.
3. The snapshot lives in app private storage, not the App Group.
4. iOS React start goes through `BayaanCarSceneBridge`.
5. Item actions are wrapped (`play` or `browse`).
6. Surah tap opens "Play with <top reciter>" plus "Choose reciter".
7. The details header and `CPPlaybackConfiguration` are iOS 26.4 in the SDK, not 27. `CPPlaybackConfiguration` is skipped.
8. iOS uses multiple scenes; a second phone scene on iPad is refused.
9. Android: legacy browser service action only, hardened artwork provider, pagination with a 500 cap.

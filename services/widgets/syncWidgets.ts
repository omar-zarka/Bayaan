// services/widgets/syncWidgets.ts
import {AppState} from 'react-native';
import {
  changedWidgetKinds,
  isWidgetsAvailable,
  reloadWidgets,
  writeSnapshot,
  cacheArtwork,
  hasArtwork,
  addWidgetCommandListener,
  takeQueuedCommands,
  selectFreshCommands,
  WidgetSnapshot,
} from 'bayaan-widgets';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useReciterStore} from '@/store/reciterStore';
import {useThemeStore} from '@/store/themeStore';
import {getReciterByIdSync} from '@/services/dataService';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {buildSnapshot, artworkFileName} from './buildSnapshot';
import {collectSnapshotInput} from './collectSnapshotInput';
import {handleWidgetCommand} from './handleWidgetCommand';

const DEBOUNCE_MS = 1000;
const ARTWORK_RETRY_MS = 10 * 60 * 1000;

let lastSnapshot: WidgetSnapshot | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let playerReady = false;
const artworkFailures = new Map<string, number>();
const artworkInFlight = new Set<string>();

async function ensureArtwork(snapshot: WidgetSnapshot): Promise<boolean> {
  const ids = new Set<string>();
  const tracks = [
    ...(snapshot.nowPlaying ? [snapshot.nowPlaying.track] : []),
    ...snapshot.upNext,
    ...snapshot.recent,
  ];
  for (const t of tracks)
    if (!t.isUserUpload && t.reciterId) ids.add(t.reciterId);
  if (snapshot.defaultReciter) ids.add(snapshot.defaultReciter.id);

  let added = false;
  for (const id of ids) {
    const file = artworkFileName(id);
    if (hasArtwork(file)) continue;
    const reciter = getReciterByIdSync(id);
    if (!reciter) continue;
    const url = getReciterArtwork(reciter);
    if (url.startsWith('data:')) continue;
    const failedAt = artworkFailures.get(url);
    if (failedAt !== undefined && Date.now() - failedAt < ARTWORK_RETRY_MS)
      continue;
    if (artworkInFlight.has(url)) continue;
    artworkInFlight.add(url);
    try {
      const ok = await cacheArtwork(url, file);
      if (ok) {
        artworkFailures.delete(url);
        added = true;
      } else {
        artworkFailures.set(url, Date.now());
      }
    } catch (error) {
      artworkFailures.set(url, Date.now());
      console.error('[WidgetSync] Failed to cache artwork:', error);
    } finally {
      artworkInFlight.delete(url);
    }
  }
  return added;
}

// forceContinueListening writes and reloads Continue Listening even when
// nothing changed, so a fresh generatedAt supersedes a widget's optimistic
// playback override after a command that turned out to be a no-op.
export function flushWidgetSnapshot(forceContinueListening = false): void {
  if (timer) clearTimeout(timer);
  timer = null;
  try {
    const next = buildSnapshot(collectSnapshotInput(new Date()));
    const changed = changedWidgetKinds(lastSnapshot, next);
    const kinds =
      forceContinueListening && !changed.includes('ContinueListening')
        ? [...changed, 'ContinueListening' as const]
        : changed;
    if (kinds.length === 0) return;
    writeSnapshot(next);
    reloadWidgets(kinds);
    lastSnapshot = next;
    // Artwork arrives async; rebuild once so the snapshot references the
    // files. The diff against lastSnapshot picks up the new artworkFile.
    ensureArtwork(next)
      .then(added => {
        if (added) flushWidgetSnapshot();
      })
      .catch(error => {
        console.error('[WidgetSync] Artwork sync failed:', error);
      });
  } catch (error) {
    console.error('[WidgetSync] Failed to flush snapshot:', error);
  }
}

// Trailing throttle: the first change starts the timer and later changes do
// not reset it, so continuous updates (playback ticks) still flush every
// DEBOUNCE_MS. Android pauses JS timers while the app is backgrounded, so
// flush right away then; changedWidgetKinds keeps playback ticks from writing.
function schedule(): void {
  if (AppState.currentState === 'background') {
    flushWidgetSnapshot();
    return;
  }
  if (timer) return;
  timer = setTimeout(flushWidgetSnapshot, DEBOUNCE_MS);
}

let draining = false;
let redrainRequested = false;

export async function drainWidgetCommands(): Promise<void> {
  if (!playerReady) return;
  if (draining) {
    redrainRequested = true;
    return;
  }
  draining = true;
  let handled = 0;
  try {
    do {
      redrainRequested = false;
      for (const command of selectFreshCommands(
        takeQueuedCommands(),
        Date.now(),
      )) {
        handled += 1;
        try {
          await handleWidgetCommand(command);
        } catch (error) {
          console.error('[WidgetSync] Failed to handle widget command:', error);
        }
      }
    } while (redrainRequested);
  } finally {
    draining = false;
  }
  if (handled > 0) flushWidgetSnapshot(true);
}

export function markPlayerReadyForWidgets(): void {
  playerReady = true;
  void drainWidgetCommands();
}

export function startWidgetSync(): () => void {
  if (!isWidgetsAvailable()) return () => undefined;
  const unsubs = [
    usePlayerStore.subscribe(schedule),
    useRecentlyPlayedStore.subscribe(schedule),
    useReciterStore.subscribe(schedule),
    useThemeStore.subscribe(schedule),
  ];
  const appState = AppState.addEventListener('change', state => {
    if (state === 'background') flushWidgetSnapshot();
    if (state === 'active') void drainWidgetCommands();
  });
  const commands = addWidgetCommandListener(() => void drainWidgetCommands());
  schedule();
  return () => {
    unsubs.forEach(u => u());
    appState.remove();
    commands.remove();
    if (timer) clearTimeout(timer);
    timer = null;
  };
}

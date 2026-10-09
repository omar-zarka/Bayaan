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

let lastSnapshot: WidgetSnapshot | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let playerReady = false;

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
    try {
      added = (await cacheArtwork(url, file)) || added;
    } catch (error) {
      console.error('[WidgetSync] Failed to cache artwork:', error);
    }
  }
  return added;
}

export function flushWidgetSnapshot(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  try {
    const next = buildSnapshot(collectSnapshotInput(new Date()));
    const kinds = changedWidgetKinds(lastSnapshot, next);
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
// DEBOUNCE_MS.
function schedule(): void {
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
  try {
    do {
      redrainRequested = false;
      for (const command of selectFreshCommands(
        takeQueuedCommands(),
        Date.now(),
      )) {
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

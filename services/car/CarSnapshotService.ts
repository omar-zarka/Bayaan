import {AppState, Image} from 'react-native';
import {BayaanCar} from '@/modules/bayaan-car';
import {RECITERS, Reciter} from '@/data/reciterData';
import {SURAHS} from '@/data/surahData';
import {getSystemPlaylists} from '@/data/systemPlaylists';
import {SURAH_TO_JUZ} from '@/data/juzData';
import {reciterImages} from '@/utils/reciterImages';
import {formatReciterName} from '@/utils/artworkUtils';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {useReciterStore} from '@/store/reciterStore';
import {PlaylistItem} from '@/services/database/DatabaseService';
import {buildCarSnapshot} from '@/services/car/snapshot/buildCarSnapshot';
import {CarArtwork} from '@/services/car/types';
import {CarResolveContext} from '@/services/car/playback/resolveCarRequest';
import {recentTracksKey} from '@/services/car/snapshotKeys';

const DEBOUNCE_MS = 2000;
const MAX_WAIT_MS = 10_000;
const CONNECTED_REFRESH_MS = 15 * 60 * 1000;
const MONOGRAM_COLORS = [
  '#0F766E',
  '#1D4ED8',
  '#7C3AED',
  '#B45309',
  '#BE123C',
  '#15803D',
];

function monogram(reciter: Reciter): CarArtwork {
  const label = reciter.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
  let hash = 0;
  for (const ch of reciter.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    kind: 'monogram',
    label,
    hex: MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length],
  };
}

export function resolveReciterArtwork(reciter: Reciter): CarArtwork {
  if (reciter.image_url) {
    return {
      kind: 'url',
      url: reciter.image_url.replace(/^http:\/\//, 'https://'),
    };
  }
  const asset = reciterImages[formatReciterName(reciter.name)];
  if (asset !== undefined) {
    const resolved = Image.resolveAssetSource(asset);
    if (resolved?.uri) return {kind: 'asset', uri: resolved.uri};
  }
  return monogram(reciter);
}

async function loadPlaylistItems(): Promise<Record<string, PlaylistItem[]>> {
  const {playlists, getPlaylistItems} = usePlaylistsStore.getState();
  const entries = await Promise.all(
    playlists.map(
      async (p): Promise<[string, PlaylistItem[]]> => [
        p.id,
        await getPlaylistItems(p.id),
      ],
    ),
  );
  return Object.fromEntries(entries);
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingSince: number | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let lastContext: CarResolveContext | null = null;
let startedSeq = 0;
let committedSeq = 0;

// The exact data the last written snapshot was built from. The resolver must
// use this, not live stores, so startIndex matches the list the car shows.
export function getLastResolveContext(): CarResolveContext | null {
  return lastContext;
}

export async function writeCarSnapshotNow(): Promise<void> {
  const seq = ++startedSeq;
  const playlistItems = await loadPlaylistItems();
  const context: CarResolveContext = Object.freeze({
    reciters: RECITERS,
    topReciterId: null,
    recentTracks: useRecentlyPlayedStore.getState().recentTracks,
    lovedTracks: useLovedStore.getState().tracks,
    downloads: useDownloadStore.getState().downloads,
    systemPlaylists: getSystemPlaylists(),
    playlistItems,
  });
  const snapshot = buildCarSnapshot({
    now: new Date(),
    reciters: context.reciters,
    surahs: SURAHS,
    favoriteReciterIds: useFavoriteRecitersStore.getState().favoriteReciterIds,
    defaultReciterId: useReciterStore.getState().defaultReciter.id || null,
    recentTracks: context.recentTracks,
    lovedTracks: context.lovedTracks,
    downloads: context.downloads,
    userPlaylists: usePlaylistsStore.getState().playlists,
    playlistItems: context.playlistItems,
    systemPlaylists: context.systemPlaylists,
    surahToJuz: SURAH_TO_JUZ,
    resolveReciterArtwork,
  });
  // An older concurrent write must not overwrite a newer one.
  if (seq < committedSeq) return;
  committedSeq = seq;
  lastContext = Object.freeze({
    ...context,
    topReciterId: snapshot.topReciterId,
  });
  BayaanCar.writeSnapshot(JSON.stringify(snapshot));
}

function clearDebounce(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pendingSince = null;
}

function schedule(): void {
  const now = Date.now();
  if (pendingSince === null) pendingSince = now;
  // maxWait: continuous changes cannot starve the write.
  const delay = Math.min(
    DEBOUNCE_MS,
    Math.max(0, pendingSince + MAX_WAIT_MS - now),
  );
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    clearDebounce();
    writeCarSnapshotNow().catch(error => {
      if (__DEV__) console.warn('[CarSnapshotService] write failed', error);
    });
  }, delay);
}

interface SelectableStore<S> {
  getState: () => S;
  subscribe: (listener: (state: S) => void) => () => void;
}

// Schedules only when the selected slice changes, so high-frequency fields
// (progress, download percentages) do not trigger rebuilds.
function scheduleOnChange<S, V>(
  store: SelectableStore<S>,
  select: (state: S) => V,
): () => void {
  let previous = select(store.getState());
  return store.subscribe(state => {
    const next = select(state);
    if (Object.is(next, previous)) return;
    previous = next;
    schedule();
  });
}

export interface CarSnapshotService {
  stop: () => void;
  /** Settles (never rejects) once the initial snapshot write has finished or failed. */
  ready: Promise<void>;
}

export function startCarSnapshotService(): CarSnapshotService {
  if (!BayaanCar.isAvailable) {
    return {stop: () => {}, ready: Promise.resolve()};
  }
  const appStateSub = AppState.addEventListener('change', state => {
    if (state === 'active') schedule();
  });
  const unsubscribers = [
    scheduleOnChange(useRecentlyPlayedStore, s =>
      recentTracksKey(s.recentTracks),
    ),
    scheduleOnChange(useLovedStore, s => s.tracks),
    scheduleOnChange(useDownloadStore, s => s.downloads),
    scheduleOnChange(useFavoriteRecitersStore, s => s.favoriteReciterIds),
    scheduleOnChange(usePlaylistsStore, s => s.playlists),
    scheduleOnChange(useReciterStore, s => s.defaultReciter),
    BayaanCar.addConnectionListener(connected => {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = connected
        ? setInterval(schedule, CONNECTED_REFRESH_MS)
        : null;
      if (connected) schedule();
    }),
    () => appStateSub.remove(),
  ];
  const ready = writeCarSnapshotNow().catch(() => schedule());
  return {
    ready,
    stop: () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      clearDebounce();
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = null;
    },
  };
}

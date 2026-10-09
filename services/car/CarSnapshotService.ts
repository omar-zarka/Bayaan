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

const DEBOUNCE_MS = 2000;
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
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let cachedPlaylistItems: Record<string, PlaylistItem[]> = {};
let lastTopReciterId: string | null = null;

export function getCachedPlaylistItems(): Record<string, PlaylistItem[]> {
  return cachedPlaylistItems;
}

export function getLastTopReciterId(): string | null {
  return lastTopReciterId;
}

export async function writeCarSnapshotNow(): Promise<void> {
  const playlistItems = await loadPlaylistItems();
  const snapshot = buildCarSnapshot({
    now: new Date(),
    reciters: RECITERS,
    surahs: SURAHS,
    favoriteReciterIds: useFavoriteRecitersStore.getState().favoriteReciterIds,
    defaultReciterId: useReciterStore.getState().defaultReciter.id || null,
    recentTracks: useRecentlyPlayedStore.getState().recentTracks,
    lovedTracks: useLovedStore.getState().tracks,
    downloads: useDownloadStore.getState().downloads,
    userPlaylists: usePlaylistsStore.getState().playlists,
    playlistItems,
    systemPlaylists: getSystemPlaylists(),
    surahToJuz: SURAH_TO_JUZ,
    resolveReciterArtwork,
  });
  cachedPlaylistItems = playlistItems;
  lastTopReciterId = snapshot.topReciterId;
  BayaanCar.writeSnapshot(JSON.stringify(snapshot));
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    writeCarSnapshotNow().catch(error => {
      if (__DEV__) console.warn('[CarSnapshotService] write failed', error);
    });
  }, DEBOUNCE_MS);
}

export function startCarSnapshotService(): () => void {
  if (!BayaanCar.isAvailable) return () => {};
  const appStateSub = AppState.addEventListener('change', state => {
    if (state === 'active') schedule();
  });
  const unsubscribers = [
    useRecentlyPlayedStore.subscribe(schedule),
    useLovedStore.subscribe(schedule),
    useDownloadStore.subscribe(schedule),
    useFavoriteRecitersStore.subscribe(schedule),
    usePlaylistsStore.subscribe(schedule),
    useReciterStore.subscribe(schedule),
    BayaanCar.addConnectionListener(connected => {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = connected
        ? setInterval(schedule, CONNECTED_REFRESH_MS)
        : null;
      if (connected) schedule();
    }),
    () => appStateSub.remove(),
  ];
  writeCarSnapshotNow().catch(() => schedule());
  return () => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    if (timer) clearTimeout(timer);
    if (refreshTimer) clearInterval(refreshTimer);
  };
}

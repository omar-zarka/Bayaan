// services/widgets/buildSnapshot.ts
import type {Track} from '@/types/audio';
import type {Reciter} from '@/data/reciterData';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {SURAHS} from '@/data/surahData';
import {getJuzForPage, getSurahForPage} from '@/utils/quranPages';
import {
  WIDGET_SNAPSHOT_VERSION,
  WidgetLastRead,
  WidgetReciter,
  WidgetSnapshot,
  WidgetTasbeehEntry,
  WidgetThemeMode,
  WidgetTrack,
} from 'bayaan-widgets/src/snapshot';

const UP_NEXT_LIMIT = 3;
const RECENT_LIMIT = 6;
const RECITER_RECENT_LIMIT = 3;

export interface SnapshotInput {
  now: number;
  theme: WidgetThemeMode;
  queueTracks: Track[];
  currentIndex: number;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  recentTracks: RecentlyPlayedTrack[];
  defaultReciter: Reciter | null;
  lastReadPage: number | null;
  openingTextForPage: (page: number) => string;
  tasbeeh: Record<string, WidgetTasbeehEntry>;
  artworkFileFor: (reciterId: string) => string | null;
  surahOfTheDayId: number;
}

export function artworkFileName(reciterId: string): string {
  return `reciter-${reciterId.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
}

function surahName(surahId: number): string {
  return SURAHS[surahId - 1]?.name ?? '';
}

function fromQueueTrack(t: Track, input: SnapshotInput): WidgetTrack {
  const parsed = t.surahId ? parseInt(t.surahId, 10) : 0;
  const surahId = Number.isNaN(parsed) ? 0 : parsed;
  return {
    surahId,
    surahName: surahId > 0 && !t.isUserUpload ? surahName(surahId) : t.title,
    reciterId: t.reciterId,
    reciterName: t.reciterName,
    rewayatId: t.rewayatId ?? null,
    artworkFile: t.reciterId ? input.artworkFileFor(t.reciterId) : null,
    isUserUpload: t.isUserUpload ?? false,
  };
}

function fromRecent(r: RecentlyPlayedTrack, input: SnapshotInput): WidgetTrack {
  return {
    surahId: r.surah.id,
    surahName: r.surah.name,
    reciterId: r.reciter.id,
    reciterName: r.reciter.name,
    rewayatId: r.rewayatId || null,
    artworkFile: input.artworkFileFor(r.reciter.id),
    isUserUpload: r.isUserUpload ?? false,
  };
}

function toWidgetReciter(
  r: Reciter | null,
  input: SnapshotInput,
): WidgetReciter | null {
  if (!r || r.id === '') return null;
  return {id: r.id, name: r.name, artworkFile: input.artworkFileFor(r.id)};
}

function buildLastRead(input: SnapshotInput): WidgetLastRead | null {
  if (input.lastReadPage === null) return null;
  const surah = getSurahForPage(input.lastReadPage);
  if (!surah) return null;
  return {
    page: input.lastReadPage,
    surahId: surah.id,
    surahName: surah.name,
    juz: getJuzForPage(input.lastReadPage),
    openingText: input.openingTextForPage(input.lastReadPage),
  };
}

function buildReciterRecents(
  recent: WidgetTrack[],
): Record<string, WidgetTrack[]> {
  const byReciter: Record<string, WidgetTrack[]> = {};
  for (const t of recent) {
    if (t.isUserUpload) continue;
    const list = byReciter[t.reciterId] ?? [];
    if (list.length < RECITER_RECENT_LIMIT) list.push(t);
    byReciter[t.reciterId] = list;
  }
  return byReciter;
}

export function buildSnapshot(input: SnapshotInput): WidgetSnapshot {
  const current = input.queueTracks[input.currentIndex];
  const defaultReciter = toWidgetReciter(input.defaultReciter, input);
  const allRecent = [...input.recentTracks]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(r => fromRecent(r, input));

  let upNext = input.queueTracks
    .slice(input.currentIndex + 1, input.currentIndex + 1 + UP_NEXT_LIMIT)
    .map(t => fromQueueTrack(t, input));

  // Empty state: nothing queued or played yet, suggest surah of the day.
  if (
    !current &&
    upNext.length === 0 &&
    allRecent.length === 0 &&
    defaultReciter
  ) {
    upNext = [
      {
        surahId: input.surahOfTheDayId,
        surahName: surahName(input.surahOfTheDayId),
        reciterId: defaultReciter.id,
        reciterName: defaultReciter.name,
        rewayatId: null,
        artworkFile: defaultReciter.artworkFile,
        isUserUpload: false,
      },
    ];
  }

  return {
    version: WIDGET_SNAPSHOT_VERSION,
    generatedAt: input.now,
    theme: input.theme,
    nowPlaying: current
      ? {
          track: fromQueueTrack(current, input),
          isPlaying: input.isPlaying,
          positionSec: input.positionSec,
          durationSec: input.durationSec,
        }
      : null,
    upNext,
    recent: allRecent.slice(0, RECENT_LIMIT),
    defaultReciter,
    reciterRecents: buildReciterRecents(allRecent),
    lastRead: buildLastRead(input),
    tasbeeh: input.tasbeeh,
  };
}

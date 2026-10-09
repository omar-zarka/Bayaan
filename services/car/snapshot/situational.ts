import {CarItem} from '@/services/car/types';

export interface SituationalReciter {
  reciterId: string;
  rewayatId: string;
  name: string;
  surahIds: number[];
}

export interface SituationalLastPlayed {
  reciterId: string;
  rewayatId: string;
  reciterName: string;
  surahId: number;
  completed: boolean;
  surahIds: number[];
}

export interface SituationalPlaylist {
  id: string;
  title: string;
  color: string;
}

export interface SituationalContext {
  now: Date;
  topReciter: SituationalReciter | null;
  lastPlayed: SituationalLastPlayed | null;
  systemPlaylists: SituationalPlaylist[];
  surahName: (surahId: number) => string;
}

const MAX_PICKS = 4;
const KAHF = 18;
const MULK = 67;

function isFridayWindow(now: Date): boolean {
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 4) return hour >= 18;
  if (day === 5) return hour < 19;
  return false;
}

function isMorning(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 4 && hour < 11;
}

function isNight(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 21 || hour < 4;
}

function surahPick(
  id: string,
  reciter: SituationalReciter,
  surahId: number,
  title: string,
): CarItem | null {
  if (!reciter.surahIds.includes(surahId)) return null;
  return {
    id,
    title,
    subtitle: reciter.name,
    artwork: {kind: 'surah', surahId},
    action: {
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: reciter.reciterId,
        rewayatId: reciter.rewayatId,
        surahId,
      },
    },
  };
}

function playlistPick(
  id: string,
  playlists: SituationalPlaylist[],
  playlistId: string,
): CarItem | null {
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return null;
  return {
    id,
    title: playlist.title,
    artwork: {kind: 'color', label: playlist.title, hex: playlist.color},
    action: {
      kind: 'play',
      request: {kind: 'playlist', playlistId, system: true},
    },
  };
}

function upNextPick(ctx: SituationalContext): CarItem | null {
  const last = ctx.lastPlayed;
  if (!last || !last.completed) return null;
  const sorted = [...last.surahIds].sort((a, b) => a - b);
  const next = sorted.find(id => id > last.surahId);
  if (next === undefined) return null;
  return {
    id: 'now:upnext',
    title: `Up next: ${ctx.surahName(next)}`,
    subtitle: last.reciterName,
    artwork: {kind: 'surah', surahId: next},
    action: {
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: last.reciterId,
        rewayatId: last.rewayatId,
        surahId: next,
      },
    },
  };
}

export function buildSituationalPicks(ctx: SituationalContext): CarItem[] {
  const candidates: (CarItem | null)[] = [];
  const reciter = ctx.topReciter;

  if (isFridayWindow(ctx.now) && reciter) {
    candidates.push(
      surahPick('now:kahf', reciter, KAHF, `Friday: ${ctx.surahName(KAHF)}`),
    );
  }
  if (isMorning(ctx.now)) {
    candidates.push(
      playlistPick('now:morning', ctx.systemPlaylists, 'morning-reflections'),
    );
  }
  if (isNight(ctx.now)) {
    if (reciter) {
      candidates.push(
        surahPick(
          'now:mulk',
          reciter,
          MULK,
          `Before sleep: ${ctx.surahName(MULK)}`,
        ),
      );
    }
    candidates.push(
      playlistPick('now:evening', ctx.systemPlaylists, 'evening-serenity'),
    );
  }
  candidates.push(upNextPick(ctx));

  const seen = new Set<string>();
  const picks: CarItem[] = [];
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    picks.push(candidate);
    if (picks.length === MAX_PICKS) break;
  }
  return picks;
}

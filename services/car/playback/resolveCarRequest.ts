import {Reciter, Rewayat} from '@/data/reciterData';
import {SystemPlaylist} from '@/data/systemPlaylists';
import {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {LovedTrack} from '@/services/player/store/lovedStore';
import {DownloadedSurah} from '@/services/player/store/downloadStore';
import {PlaylistItem} from '@/services/database/DatabaseService';
import {CarPlayRequest} from '@/services/car/types';
import {availableSurahIds} from '@/services/car/snapshot/buildCarSnapshot';

export interface CarTrackSpec {
  reciterId: string;
  rewayatId: string;
  surahId: number;
}

export interface CarQueuePlan {
  tracks: CarTrackSpec[];
  startIndex: number;
  startPosition: number;
  shuffle: boolean;
  chain: 'new' | 'resume' | 'none';
  /** For chain 'resume': index of the matched entry in ctx.recentTracks. */
  recentIndex?: number;
}

export interface CarResolveContext {
  reciters: Reciter[];
  topReciterId: string | null;
  recentTracks: RecentlyPlayedTrack[];
  lovedTracks: LovedTrack[];
  downloads: DownloadedSurah[];
  systemPlaylists: SystemPlaylist[];
  playlistItems: Record<string, PlaylistItem[]>;
}

const SURAH_COUNT = 114;

function isKnownSurah(surahId: number): boolean {
  return Number.isInteger(surahId) && surahId >= 1 && surahId <= SURAH_COUNT;
}

function pickRewayat(
  reciter: Reciter,
  rewayatId: string | undefined,
): Rewayat | undefined {
  return reciter.rewayat.find(r => r.id === rewayatId) ?? reciter.rewayat[0];
}

// Strict spec: the rewayah must contain the surah. Used for explicit surah
// and resume requests, which are not tied to a snapshot list.
function spec(
  ctx: CarResolveContext,
  reciterId: string | undefined | null,
  rewayatId: string | undefined,
  surahId: number,
): CarTrackSpec | null {
  const reciter = ctx.reciters.find(r => r.id === reciterId);
  if (!reciter) return null;
  const rewayat = pickRewayat(reciter, rewayatId);
  if (!rewayat) return null;
  if (!availableSurahIds(rewayat).includes(surahId)) return null;
  return {reciterId: reciter.id, rewayatId: rewayat.id, surahId};
}

// List spec: mirrors the snapshot list builders, which drop only unknown
// reciters and unknown surahs and do not check rewayah availability.
function listSpec(
  ctx: CarResolveContext,
  reciterId: string | undefined | null,
  rewayatId: string | undefined,
  surahId: number,
): CarTrackSpec | null {
  if (!isKnownSurah(surahId)) return null;
  const reciter = ctx.reciters.find(r => r.id === reciterId);
  if (!reciter) return null;
  const rewayat = pickRewayat(reciter, rewayatId);
  if (!rewayat) return null;
  return {reciterId: reciter.id, rewayatId: rewayat.id, surahId};
}

// Mirrors pickTopReciter in buildCarSnapshot: the top reciter uses the rewayah
// of the most recent non-upload track when that track belongs to it, else the
// reciter's first rewayah.
function topRewayat(ctx: CarResolveContext): {
  reciter: Reciter;
  rewayat: Rewayat;
} | null {
  const reciter = ctx.reciters.find(r => r.id === ctx.topReciterId);
  if (!reciter) return null;
  const recent = ctx.recentTracks.find(t => !t.isUserUpload);
  const rewayatId =
    recent?.reciter.id === reciter.id ? recent.rewayatId : undefined;
  const rewayat = pickRewayat(reciter, rewayatId);
  if (!rewayat) return null;
  return {reciter, rewayat};
}

function compact(specs: (CarTrackSpec | null)[]): CarTrackSpec[] {
  return specs.filter((s): s is CarTrackSpec => s !== null);
}

function listPlan(
  tracks: CarTrackSpec[],
  startIndex: number | undefined,
  shuffle: boolean,
): CarQueuePlan | null {
  if (tracks.length === 0) return null;
  const index =
    startIndex !== undefined && startIndex >= 0 && startIndex < tracks.length
      ? startIndex
      : 0;
  return {tracks, startIndex: index, startPosition: 0, shuffle, chain: 'none'};
}

function surahPlan(
  ctx: CarResolveContext,
  reciterId: string,
  rewayatId: string,
  surahId: number,
  startPosition: number,
  chain: 'new' | 'resume',
): CarQueuePlan | null {
  const first = spec(ctx, reciterId, rewayatId, surahId);
  if (!first) return null;
  const reciter = ctx.reciters.find(r => r.id === first.reciterId);
  const rewayat = reciter?.rewayat.find(r => r.id === first.rewayatId);
  const ids = availableSurahIds(rewayat);
  const at = ids.indexOf(surahId);
  const ordered = [...ids.slice(at), ...ids.slice(0, at)];
  return {
    tracks: ordered.map(id => ({
      reciterId: first.reciterId,
      rewayatId: first.rewayatId,
      surahId: id,
    })),
    startIndex: 0,
    startPosition,
    shuffle: false,
    chain,
  };
}

export function resolveCarRequest(
  request: CarPlayRequest,
  ctx: CarResolveContext,
): CarQueuePlan | null {
  switch (request.kind) {
    case 'surah':
      return surahPlan(
        ctx,
        request.reciterId,
        request.rewayatId,
        request.surahId,
        request.startAt ?? 0,
        'new',
      );
    case 'resume': {
      const recentIndex = ctx.recentTracks.findIndex(t => !t.isUserUpload);
      const recent = ctx.recentTracks[recentIndex];
      if (!recent) return null;
      const plan = surahPlan(
        ctx,
        recent.reciter.id,
        recent.rewayatId,
        recent.surah.id,
        recent.progress * recent.duration,
        'resume',
      );
      return plan ? {...plan, recentIndex} : null;
    }
    case 'loved': {
      const tracks = compact(
        [...ctx.lovedTracks]
          .filter(t => !t.userRecitationId)
          .sort((a, b) => b.timestamp - a.timestamp)
          .map(t => listSpec(ctx, t.reciterId, t.rewayatId, Number(t.surahId))),
      );
      return listPlan(tracks, request.startIndex, request.shuffle === true);
    }
    case 'downloads': {
      const tracks = compact(
        ctx.downloads
          .filter(d => d.status === 'completed')
          .map(d => listSpec(ctx, d.reciterId, d.rewayatId, Number(d.surahId))),
      );
      return listPlan(tracks, request.startIndex, false);
    }
    case 'playlist': {
      if (request.system) {
        const playlist = ctx.systemPlaylists.find(
          p => p.id === request.playlistId,
        );
        if (!playlist) return null;
        const top = topRewayat(ctx);
        const tracks = compact(
          playlist.items.map(i => {
            if (i.reciterId !== undefined) {
              return listSpec(ctx, i.reciterId, i.rewayatId, i.surahId);
            }
            if (!top) return null;
            if (!availableSurahIds(top.rewayat).includes(i.surahId))
              return null;
            return listSpec(ctx, top.reciter.id, top.rewayat.id, i.surahId);
          }),
        );
        return listPlan(tracks, request.startIndex, false);
      }
      const tracks = compact(
        [...(ctx.playlistItems[request.playlistId] ?? [])]
          .filter(i => !i.userRecitationId)
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(i => listSpec(ctx, i.reciterId, i.rewayatId, Number(i.surahId))),
      );
      return listPlan(tracks, request.startIndex, false);
    }
  }
}

import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';

// Progress steps the key tracks. Jump back in rows show a progress bar, so
// the snapshot must follow playback, but per-second ticks must not rebuild it.
const PROGRESS_STEPS = 10;

function progressStep(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.floor(Math.min(Math.max(progress, 0), 1) * PROGRESS_STEPS);
}

// Identity, order and coarse progress (tenths) of recent entries.
export function recentTracksKey(tracks: RecentlyPlayedTrack[]): string {
  return tracks
    .map(
      t =>
        `${t.reciter.id}:${t.surah.id}:${t.rewayatId}:${
          t.isUserUpload ? 1 : 0
        }:${progressStep(t.progress)}`,
    )
    .join('|');
}

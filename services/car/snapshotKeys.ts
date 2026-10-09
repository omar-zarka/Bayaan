import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';

// Identity and order of recent entries only. Progress ticks during playback
// must not change this key, or the snapshot would rebuild every second.
export function recentTracksKey(tracks: RecentlyPlayedTrack[]): string {
  return tracks
    .map(
      t =>
        `${t.reciter.id}:${t.surah.id}:${t.rewayatId}:${
          t.isUserUpload ? 1 : 0
        }`,
    )
    .join('|');
}

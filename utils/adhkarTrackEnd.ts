// utils/adhkarTrackEnd.ts
// When an adhkar track counts as finished (Play All advances, single mode
// rewinds). The wall-time guard ignores a stale "ended" status left over from
// the previous track, but it must stay shorter than the clip itself: the 99
// Names clips run 1 to 2 seconds.

export interface TrackEndStatus {
  currentTime: number;
  duration: number;
  playing: boolean;
  didJustFinish: boolean;
}

const MAX_GUARD_MS = 2000;

export function minimumPlayTimeMs(durationSec: number): number {
  if (durationSec <= 0) return MAX_GUARD_MS;
  return Math.min(MAX_GUARD_MS, durationSec * 500);
}

export function isTrackFinished(
  status: TrackEndStatus,
  elapsedMs: number,
): boolean {
  if (elapsedMs < minimumPlayTimeMs(status.duration)) return false;
  if (status.didJustFinish) return true;
  return (
    status.duration > 0 &&
    status.currentTime >= status.duration - 0.1 &&
    !status.playing
  );
}

// After a source change the player keeps reporting the previous player's last
// status until the new one emits. A status identical to the one captured at
// the change is carried over and must not be judged.
export function isCarriedOverStatus(
  status: TrackEndStatus,
  staleStatus: TrackEndStatus | null,
): boolean {
  if (!staleStatus) return false;
  return (
    status.currentTime === staleStatus.currentTime &&
    status.duration === staleStatus.duration &&
    status.playing === staleStatus.playing &&
    status.didJustFinish === staleStatus.didJustFinish
  );
}

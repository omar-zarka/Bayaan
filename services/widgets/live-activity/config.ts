// services/widgets/live-activity/config.ts
// 'surah' ships: surah card, names, play/pause and timer-driven progress, a
// few updates per track. 'ayah' adds the current ayah and updates on every
// ayah change; keep it off until the device prototype in
// docs/superpowers/plans/2026-10-11-widgets-phase-2-device-checklist.md passes
// (background updates may stop after about 30 s). 'off' disables the activity.
export type LiveActivityMode = 'off' | 'surah' | 'ayah';

export function liveActivityMode(): LiveActivityMode {
  return 'surah';
}

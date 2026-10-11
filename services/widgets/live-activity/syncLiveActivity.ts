// services/widgets/live-activity/syncLiveActivity.ts
// Drives the Now Playing Live Activity from the widget snapshot pipeline:
// syncWidgets hands over each written snapshot; native calls are serialized.
import {AppState, Platform} from 'react-native';
import {
  endNowPlayingActivities,
  isLiveActivitySupported,
  startNowPlayingActivity,
  updateNowPlayingActivity,
  type ActivityStartResult,
  type NowPlayingAyah,
  type WidgetSnapshot,
} from 'bayaan-widgets';
import {liveActivityMode} from './config';
import {
  INITIAL_ACTIVITY_MEMORY,
  activityStateFromSnapshot,
  afterEnd,
  afterStart,
  afterUpdate,
  planActivity,
  type ActivityMemory,
} from './planActivity';

let enabled = false;
let memory: ActivityMemory = INITIAL_ACTIVITY_MEMORY;
let snapshot: WidgetSnapshot | null = null;
let ayah: NowPlayingAyah | null = null;
// One chain for every native call, so a start cannot race an update or end.
let chain: Promise<void> = Promise.resolve();

function logError(error: unknown): void {
  console.error('[LiveActivity] Failed to sync:', error);
}

// A rejected native call counts as a failed start, so the policy suppresses
// the track instead of retrying it on every snapshot.
async function safeStart(
  state: Parameters<typeof startNowPlayingActivity>[0],
  staleAt: number,
): Promise<ActivityStartResult> {
  try {
    return await startNowPlayingActivity(state, staleAt);
  } catch (error) {
    logError(error);
    return 'error';
  }
}

async function safeUpdate(
  state: Parameters<typeof updateNowPlayingActivity>[0],
  staleAt: number,
): Promise<boolean> {
  try {
    return await updateNowPlayingActivity(state, staleAt);
  } catch (error) {
    logError(error);
    return false;
  }
}

// Reads the latest snapshot when it runs, so queued calls collapse.
async function reconcileOnce(): Promise<void> {
  if (!enabled || !snapshot) return;
  const plan = planActivity(
    memory,
    activityStateFromSnapshot(snapshot, ayah),
    Date.now(),
  );
  switch (plan.kind) {
    case 'start':
      memory = afterStart(
        memory,
        plan.state,
        await safeStart(plan.state, plan.staleAt),
      );
      return;
    case 'update':
      memory = afterUpdate(
        memory,
        plan.state,
        await safeUpdate(plan.state, plan.staleAt),
      );
      return;
    case 'end':
      await endNowPlayingActivities();
      memory = afterEnd();
      return;
    case 'none':
      return;
  }
}

export function reconcileLiveActivity(): Promise<void> {
  chain = chain.then(reconcileOnce).catch(logError);
  return chain;
}

/** Called by syncWidgets after each snapshot write. */
export function noteSnapshotForLiveActivity(next: WidgetSnapshot): void {
  if (!enabled) return;
  snapshot = next;
  reconcileLiveActivity().catch(logError);
}

/** Set by the per-ayah layer (ayah mode); null hides the ayah line. */
export function setLiveActivityAyah(next: NowPlayingAyah | null): void {
  if (!enabled) return;
  ayah = next;
  reconcileLiveActivity().catch(logError);
}

// The root layout starts this after init, before startWidgetSync.
export function startLiveActivitySync(): () => void {
  if (
    Platform.OS !== 'ios' ||
    liveActivityMode() === 'off' ||
    !isLiveActivitySupported()
  ) {
    return () => undefined;
  }
  enabled = true;
  memory = INITIAL_ACTIVITY_MEMORY;
  snapshot = null;
  ayah = null;
  // An activity left by a previous process has no owner; start clean.
  chain = chain.then(() => endNowPlayingActivities()).catch(logError);
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') reconcileLiveActivity().catch(logError);
  });
  return () => {
    enabled = false;
    snapshot = null;
    ayah = null;
    appState.remove();
  };
}

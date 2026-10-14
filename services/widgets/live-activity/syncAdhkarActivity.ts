// services/widgets/live-activity/syncAdhkarActivity.ts
// Drives the adhkar session Live Activity (adhkar playback spec, section 7)
// from the adhkar session store and the audio coordinator. The policy is
// planAdhkarActivity.ts; native calls are serialized on one chain. iOS only.
import {AppState, Platform} from 'react-native';
import {
  endAdhkarSessionActivities,
  isLiveActivitySupported,
  startAdhkarSessionActivity,
  updateAdhkarSessionActivity,
  type ActivityStartResult,
  type AdhkarSessionActivityState,
} from 'bayaan-widgets';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {audioCoordinator} from '@/services/audio/AudioCoordinator';
import {adhkarLiveActivityEnabled} from './config';
import {
  ADHKAR_PAUSED_END_MS,
  ADHKAR_PLAYING_STALE_MS,
  INITIAL_ADHKAR_ACTIVITY_MEMORY,
  adhkarActivityState,
  adhkarSessionKey,
  adhkarStaleAt,
  afterAdhkarEnd,
  afterAdhkarStart,
  afterAdhkarUpdate,
  planAdhkarActivity,
  type AdhkarActivityMemory,
  type AdhkarActivityPlan,
} from './planAdhkarActivity';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

// A playing activity whose shown state does not change (a single dhikr on
// loop) is updated this long before its stale date, so it never reads stale
// while the app is alive.
export const ADHKAR_STALE_REFRESH_MARGIN_MS = 2 * 60 * 1000;

let enabled = false;
let memory: AdhkarActivityMemory = INITIAL_ADHKAR_ACTIVITY_MEMORY;
// One chain for every native call, so a start cannot race an update or end.
let chain: Promise<void> = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | null = null;
// When the live activity's stale date was last pushed forward.
let sentAt = 0;

function logError(error: unknown): void {
  console.error('[AdhkarActivity] Failed to sync:', error);
}

// Read inside the chained reconcile: AudioCoordinator dispatches
// otherAudioStarted before it sets the new source.
function otherSourceActive(): boolean {
  const source = audioCoordinator.getActiveSource();
  return source === 'main' || source === 'mushaf';
}

// A rejected native call counts as a failed start, so the policy suppresses
// the session instead of retrying it on every change.
async function safeStart(
  state: AdhkarSessionActivityState,
  staleAt: number,
): Promise<ActivityStartResult> {
  try {
    return await startAdhkarSessionActivity(state, staleAt);
  } catch (error) {
    logError(error);
    return 'error';
  }
}

async function safeUpdate(
  state: AdhkarSessionActivityState,
  staleAt: number,
): Promise<boolean> {
  try {
    return await updateAdhkarSessionActivity(state, staleAt);
  } catch (error) {
    logError(error);
    return false;
  }
}

function refreshDueAt(): number {
  return sentAt + ADHKAR_PLAYING_STALE_MS - ADHKAR_STALE_REFRESH_MARGIN_MS;
}

// The policy plans nothing when the shown state is unchanged; a playing
// activity still needs its stale date pushed forward.
function withStaleRefresh(
  plan: AdhkarActivityPlan,
  session: AdhkarSession | null,
  now: number,
): AdhkarActivityPlan {
  if (plan.kind !== 'none' || !memory.live || !session) return plan;
  if (session.status === 'paused' || now < refreshDueAt()) return plan;
  const state = adhkarActivityState(session);
  if (!state) return plan;
  return {
    kind: 'update',
    key: adhkarSessionKey(session),
    state,
    staleAt: adhkarStaleAt(session, now),
  };
}

// Nothing in the store marks the 15th minute of a pause or the stale refresh
// of a playing activity, so a timer does. If the app is suspended the timer
// may not run: the stale date covers that and the next foreground reconcile
// ends or refreshes the activity.
function scheduleTimer(now: number): void {
  if (timer) clearTimeout(timer);
  timer = null;
  const session = useAdhkarSessionStore.getState().session;
  if (!enabled || !memory.live || !session) return;
  const dueAt =
    session.status === 'paused'
      ? session.lastActiveAt + ADHKAR_PAUSED_END_MS
      : refreshDueAt();
  timer = setTimeout(
    () => {
      reconcileAdhkarActivity().catch(logError);
    },
    Math.max(dueAt - now, 0),
  );
}

// Reads the latest session when it runs, so queued calls collapse.
async function reconcileOnce(): Promise<void> {
  if (!enabled) return;
  const session = useAdhkarSessionStore.getState().session;
  const now = Date.now();
  const plan = withStaleRefresh(
    planAdhkarActivity(memory, session, now, otherSourceActive()),
    session,
    now,
  );
  switch (plan.kind) {
    case 'start':
      memory = afterAdhkarStart(
        memory,
        plan.key,
        plan.state,
        await safeStart(plan.state, plan.staleAt),
      );
      sentAt = now;
      break;
    case 'update':
      memory = afterAdhkarUpdate(
        memory,
        plan.key,
        plan.state,
        await safeUpdate(plan.state, plan.staleAt),
      );
      sentAt = now;
      break;
    case 'end':
      await endAdhkarSessionActivities();
      memory = afterAdhkarEnd();
      break;
    case 'reset':
      memory = INITIAL_ADHKAR_ACTIVITY_MEMORY;
      break;
    case 'none':
      break;
  }
  scheduleTimer(Date.now());
}

export function reconcileAdhkarActivity(): Promise<void> {
  chain = chain.then(reconcileOnce).catch(logError);
  return chain;
}

// ExpoAudioProvider starts this with the adhkar engine.
export function startAdhkarActivitySync(): () => void {
  if (
    Platform.OS !== 'ios' ||
    !adhkarLiveActivityEnabled() ||
    !isLiveActivitySupported()
  ) {
    return () => undefined;
  }
  enabled = true;
  memory = INITIAL_ADHKAR_ACTIVITY_MEMORY;
  // An activity left by a killed process shows a session that is no longer
  // playing (spec 8): end it before anything starts.
  chain = chain.then(() => endAdhkarSessionActivities()).catch(logError);
  reconcileAdhkarActivity().catch(logError);
  const unsubscribeStore = useAdhkarSessionStore.subscribe((state, prev) => {
    if (state.session !== prev.session) {
      reconcileAdhkarActivity().catch(logError);
    }
  });
  const unsubscribeCoordinator = audioCoordinator.subscribe(() => {
    reconcileAdhkarActivity().catch(logError);
  });
  const appState = AppState.addEventListener('change', next => {
    if (next === 'active') reconcileAdhkarActivity().catch(logError);
  });
  return () => {
    enabled = false;
    if (timer) clearTimeout(timer);
    timer = null;
    unsubscribeStore();
    unsubscribeCoordinator();
    appState.remove();
  };
}

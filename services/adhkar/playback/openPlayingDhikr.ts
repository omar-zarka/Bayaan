// services/adhkar/playback/openPlayingDhikr.ts
// Which adhkar screen is focused, and (Task 5) how to get to the playing dhikr.
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarSession} from './types';

export type AdhkarFocus = {kind: 'list' | 'reader'; listId: string} | null;

let focus: AdhkarFocus = null;

export function setAdhkarFocus(next: AdhkarFocus): void {
  focus = next;
}

// Clears only when `expected` is still the current focus. Navigation can run
// the next screen's focus before the previous screen's blur cleanup.
export function clearAdhkarFocus(expected: AdhkarFocus): void {
  if (focus === expected) focus = null;
}

export function getAdhkarFocus(): AdhkarFocus {
  return focus;
}

export type ReaderHref =
  | {
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]';
      params: {
        superId: string;
        dhikrId: string;
        globalIndex: string;
        superCategoryTitle: string;
      };
    }
  | {
      pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]';
      params: {dhikrId: string; globalIndex: string};
    };

export type OpenPlan =
  | {kind: 'none'}
  | {kind: 'reveal'}
  | {kind: 'push'; href: ReaderHref};

export function planOpenPlaying(
  session: AdhkarSession | null,
  current: AdhkarFocus,
): OpenPlan {
  if (!session) return {kind: 'none'};
  const item = session.items[session.index];
  if (!item) return {kind: 'none'};
  if (current && current.listId === session.listId) return {kind: 'reveal'};
  const globalIndex = String(session.index);
  if (session.listId === 'saved') {
    return {
      kind: 'push',
      href: {
        pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]',
        params: {dhikrId: item.dhikrId, globalIndex},
      },
    };
  }
  return {
    kind: 'push',
    href: {
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      params: {
        superId: session.listId,
        dhikrId: item.dhikrId,
        globalIndex,
        superCategoryTitle: session.listTitle,
      },
    },
  };
}

// `current` defaults to the focused adhkar screen. The bayaan://adhkar-playing
// route passes null: it sits on top of whatever screen was focused, so it
// must always navigate (a reveal would leave its empty screen showing).
export function openPlayingDhikr(
  router: {push(href: ReaderHref): void; replace(href: ReaderHref): void},
  mode: 'push' | 'replace' = 'push',
  current: AdhkarFocus = getAdhkarFocus(),
): boolean {
  const {session, requestReveal} = useAdhkarSessionStore.getState();
  const plan = planOpenPlaying(session, current);
  if (plan.kind === 'none') return false;
  if (plan.kind === 'reveal') {
    requestReveal();
    return true;
  }
  router[mode](plan.href);
  return true;
}

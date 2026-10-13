// The single adhkar player (spec 3.4). One expo-audio player for the whole
// app, made with keepAudioSessionActive so iOS keeps the audio session
// between clips (a new player per clip could not restart in the background).
// It follows useAdhkarSessionStore and reports player events back to it.
import {AppState} from 'react-native';
import {createAudioPlayer} from 'expo-audio';
import type {AudioPlayer} from 'expo-audio';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {getAudioSource} from '@/utils/adhkarAudio';
import {currentItem} from './sessionReducer';
import type {AdhkarSession} from './types';

const PLAY_CONFIRM_MS = 1500;

interface PlayerStatus {
  playing: boolean;
  didJustFinish: boolean;
}

export interface EnginePlayer {
  loop: boolean;
  currentTime: number;
  duration: number;
  replace(source: number): void;
  play(): void;
  pause(): void;
  seekTo(seconds: number): unknown;
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: PlayerStatus) => void,
  ): {remove(): void};
}

export interface EngineDeps {
  createPlayer: () => EnginePlayer;
  getSource: (audioFile: string | null) => number | null;
  coordinator: {
    adhkarWillPlay(): void;
    sourceDidStop(source: 'adhkar'): void;
    getActiveSource(): string;
  };
  // The default wiring ignores the player argument and uses the runtime's real
  // expo-audio AudioPlayer (EnginePlayer is a narrower type than AudioPlayer).
  lockScreen: {
    activate(player: EnginePlayer, session: AdhkarSession): void;
    clear(player: EnginePlayer): void;
  };
}

function defaultDeps(): EngineDeps {
  // Lazy requires, resolved at call time: the coordinator and lock screen
  // import player stores, and tests that inject their own deps never load them.
  const coordinator =
    (): typeof import('@/services/audio/AudioCoordinator').audioCoordinator =>
      require('@/services/audio/AudioCoordinator').audioCoordinator;
  const lockScreen =
    (): typeof import('@/services/audio/LockScreenService').lockScreenService =>
      require('@/services/audio/LockScreenService').lockScreenService;
  return {
    createPlayer: () => {
      const made = createAudioPlayer(null, {
        keepAudioSessionActive: true,
        updateInterval: 250,
      });
      realPlayer = made;
      return made;
    },
    getSource: getAudioSource,
    coordinator: {
      adhkarWillPlay: () => coordinator().adhkarWillPlay(),
      sourceDidStop: source => coordinator().sourceDidStop(source),
      getActiveSource: () => coordinator().getActiveSource(),
    },
    lockScreen: {
      activate: (_player, session) => {
        if (realPlayer) lockScreen().activateAdhkar(realPlayer, session);
      },
      clear: () => {
        if (realPlayer) lockScreen().clearAdhkar(realPlayer);
      },
    },
  };
}

// One player per JS runtime, created lazily and never released: a car-root
// provider handover restarts the engine mid-playback, and the clip that is
// playing must keep advancing.
let activePlayer: EnginePlayer | null = null;
let realPlayer: AudioPlayer | null = null;
let loadedToken: number | null = null;
// The token that has reported playing: true. A didJustFinish before that is
// left over from the previous clip.
let confirmedToken: number | null = null;

export function resetAdhkarEngineForTests(): void {
  activePlayer = null;
  realPlayer = null;
  loadedToken = null;
  confirmedToken = null;
}

export function getAdhkarPlaybackPosition(): {
  currentTime: number;
  duration: number;
} {
  if (!activePlayer) return {currentTime: 0, duration: 0};
  return {
    currentTime: activePlayer.currentTime,
    duration: activePlayer.duration,
  };
}

export function seekAdhkarPlayback(seconds: number): void {
  try {
    activePlayer?.seekTo(seconds);
  } catch (error) {
    if (__DEV__) console.warn('[AdhkarEngine] seek failed', error);
  }
}

export function startAdhkarPlaybackEngine(
  overrides: Partial<EngineDeps> = {},
): () => void {
  const deps: EngineDeps = {...defaultDeps(), ...overrides};
  const store = useAdhkarSessionStore;
  let subscription: {remove(): void} | null = null;
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;
  let retried = false;
  let lockScreenToken: number | null = null;

  function ensurePlayer(): EnginePlayer {
    if (!activePlayer) activePlayer = deps.createPlayer();
    attach();
    return activePlayer;
  }

  function attach(): void {
    if (!activePlayer || subscription) return;
    subscription = activePlayer.addListener('playbackStatusUpdate', onStatus);
  }

  function clearConfirm(): void {
    if (confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = null;
  }

  function armConfirm(token: number): void {
    clearConfirm();
    confirmTimer = setTimeout(() => {
      const s = store.getState().session;
      if (!s || s.trackToken !== token || s.status !== 'loading') return;
      if (!retried) {
        retried = true;
        tryPlay(token);
        return;
      }
      store.getState().dispatch({type: 'playFailed', token});
    }, PLAY_CONFIRM_MS);
  }

  function tryPlay(token: number): void {
    const p = ensurePlayer();
    try {
      deps.coordinator.adhkarWillPlay();
      p.play();
    } catch (error) {
      if (__DEV__) console.warn('[AdhkarEngine] play failed', error);
    }
    armConfirm(token);
  }

  function load(session: AdhkarSession): boolean {
    const item = currentItem(session);
    const source = deps.getSource(item?.audioFile ?? null);
    if (source === null) {
      store
        .getState()
        .dispatch({type: 'playFailed', token: session.trackToken});
      return false;
    }
    const p = ensurePlayer();
    p.replace(source);
    loadedToken = session.trackToken;
    confirmedToken = null;
    if (session.positionSec > 0) p.seekTo(session.positionSec);
    return true;
  }

  function savePosition(): void {
    // The loaded clip must be the session's current one, or a stale time
    // would land on a dhikr that was swiped to while paused.
    if (!activePlayer || loadedToken !== store.getState().session?.trackToken)
      return;
    store
      .getState()
      .dispatch({type: 'positionSaved', positionSec: activePlayer.currentTime});
  }

  function onStatus(status: PlayerStatus): void {
    const s = store.getState().session;
    if (!s || loadedToken !== s.trackToken) return;
    if (status.playing) {
      confirmedToken = loadedToken;
      if (s.status === 'loading') {
        clearConfirm();
        store.getState().dispatch({type: 'playStarted', token: s.trackToken});
      } else if (s.status === 'paused') {
        // Play from the lock screen, headphones or Control Center.
        deps.coordinator.adhkarWillPlay();
        store.getState().dispatch({type: 'playerResumed'});
      }
      return;
    }
    if (status.didJustFinish) {
      if (confirmedToken !== loadedToken || activePlayer?.loop) return;
      store.getState().dispatch({type: 'trackEnded', token: s.trackToken});
      return;
    }
    if (s.status === 'playing') {
      savePosition();
      store.getState().dispatch({type: 'playerPaused'});
    }
  }

  function follow(
    session: AdhkarSession | null,
    prev: AdhkarSession | null,
  ): void {
    if (!session) {
      clearConfirm();
      if (prev && activePlayer) {
        activePlayer.pause();
        deps.lockScreen.clear(activePlayer);
        deps.coordinator.sourceDidStop('adhkar');
      }
      loadedToken = null;
      confirmedToken = null;
      lockScreenToken = null;
      return;
    }
    if (activePlayer)
      activePlayer.loop = session.mode === 'single' && session.loop;
    if (session.status === 'loading') {
      const isNewRequest =
        !prev ||
        prev.status !== 'loading' ||
        prev.trackToken !== session.trackToken;
      if (!isNewRequest) return;
      retried = false;
      if (loadedToken !== session.trackToken && !load(session)) return;
      if (activePlayer)
        activePlayer.loop = session.mode === 'single' && session.loop;
      tryPlay(session.trackToken);
      return;
    }
    if (session.status === 'playing') {
      // Also on a resume of the same track: the lock screen service may have
      // dropped the entry while paused (Quran or mushaf took over). It only
      // updates the metadata when the entry is still there.
      if (
        activePlayer &&
        (lockScreenToken !== session.trackToken || prev?.status !== 'playing')
      ) {
        lockScreenToken = session.trackToken;
        deps.lockScreen.activate(activePlayer, session);
      }
      return;
    }
    // paused
    clearConfirm();
    if (prev && prev.status !== 'paused' && activePlayer) {
      savePosition();
      activePlayer.pause();
      // Keep the lock screen entry for a plain pause. Clear it only when
      // another source took over.
      if (deps.coordinator.getActiveSource() !== 'adhkar') {
        deps.lockScreen.clear(activePlayer);
        lockScreenToken = null;
      }
    }
  }

  attach();
  // A provider handover restarts the engine mid-playback, and stopSync took
  // the lock screen entry with it.
  const initial = store.getState().session;
  if (initial?.status === 'playing') follow(initial, null);

  const unsubscribe = store.subscribe((state, prevState) => {
    if (state.session !== prevState.session)
      follow(state.session, prevState.session);
  });

  // Spec 3.5: keep the position when the app leaves the foreground.
  const appStateSubscription = AppState.addEventListener(
    'change',
    nextState => {
      if (nextState === 'background' || nextState === 'inactive')
        savePosition();
    },
  );

  return () => {
    unsubscribe();
    appStateSubscription.remove();
    subscription?.remove();
    subscription = null;
    clearConfirm();
  };
}

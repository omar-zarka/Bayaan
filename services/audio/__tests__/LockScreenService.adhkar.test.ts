/**
 * Adhkar lock screen entry: title, activation, hand-off to and from the
 * Quran and mushaf players.
 */

const mockMainPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};
const mockMushafPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};
const adhkarPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      queue: {
        tracks: [{id: 't1', title: 'Al-Fatihah', artist: 'Reciter'}],
        currentIndex: 0,
      },
      playback: {state: 'paused'},
    })),
  };
});

jest.mock('@/store/mushafPlayerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useMushafPlayerStore: create(() => ({
      playbackState: 'idle',
      currentSurah: 0,
      currentVerseKey: null,
      currentVerseLabel: null,
      numberingMode: null,
      reciterName: 'Test Reciter',
    })),
  };
});

jest.mock('../ExpoAudioService', () => ({
  expoAudioService: {getPlayer: () => mockMainPlayer},
}));

jest.mock('../MushafAudioService', () => ({
  mushafAudioService: {getPlayer: () => mockMushafPlayer},
}));

jest.mock('../AudioCoordinator', () => ({audioCoordinator: {}}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (_key: string, o: {current: number; total: number}) =>
      `${o.current} of ${o.total}`,
  },
}));

jest.mock('@/config/branding', () => ({
  __esModule: true,
  default: {appName: 'Bayaan'},
}));

import {adhkarLockScreenTitle, lockScreenService} from '../LockScreenService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import type {AudioPlayer} from 'expo-audio';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

const session: AdhkarSession = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items: Array.from({length: 23}, (_, i) => ({
    dhikrId: String(i),
    audioFile: `${i}.mp3`,
    playable: true,
    preview: '',
  })),
  index: 3,
  mode: 'all',
  loop: false,
  status: 'playing',
  error: false,
  trackToken: 1,
  positionSec: 0,
  lastActiveAt: 0,
};

// The mock player is structural; the service only uses these three methods.
const asPlayer = (p: typeof adhkarPlayer): AudioPlayer =>
  p as unknown as AudioPlayer;

type SettableStore = {setState: (s: object) => void};
const playerStore = usePlayerStore as unknown as SettableStore;
const mushafStore = useMushafPlayerStore as unknown as SettableStore;

const track = (id: string) => ({
  queue: {tracks: [{id, title: id, artist: 'Reciter'}], currentIndex: 0},
});

beforeEach(async () => {
  [mockMainPlayer, mockMushafPlayer, adhkarPlayer].forEach(p =>
    Object.values(p).forEach(fn => fn.mockClear()),
  );
  mushafStore.setState({playbackState: 'idle'});
  playerStore.setState({...track('t1'), playback: {state: 'paused'}});
  await lockScreenService.startSync();
  Object.values(mockMainPlayer).forEach(fn => fn.mockClear());
});

afterEach(() => {
  lockScreenService.stopSync();
});

describe('adhkarLockScreenTitle', () => {
  it('builds "Morning Adhkar · 4 of 23"', () => {
    expect(adhkarLockScreenTitle(session, (c, t) => `${c} of ${t}`)).toBe(
      'Morning Adhkar · 4 of 23',
    );
  });
});

describe('activateAdhkar', () => {
  it('activates the adhkar player and clears main and mushaf', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      {title: 'Morning Adhkar · 4 of 23', artist: 'Bayaan'},
      {showSeekForward: false, showSeekBackward: false},
    );
    expect(mockMainPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMushafPlayer.clearLockScreenControls).toHaveBeenCalled();
  });

  it('only updates metadata when the same player is already active', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), {
      ...session,
      index: 4,
    });
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(adhkarPlayer.updateLockScreenMetadata).toHaveBeenCalledWith({
      title: 'Morning Adhkar · 5 of 23',
      artist: 'Bayaan',
    });
  });

  it('does not re-activate main on a main track change while held', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    playerStore.setState(track('t2'));
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });

  it('drops the held entry once the main player plays a new track', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    playerStore.setState({...track('t2'), playback: {state: 'playing'}});
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalled();
  });

  it('drops the held entry when the mushaf starts playing', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    adhkarPlayer.clearLockScreenControls.mockClear();
    mushafStore.setState({playbackState: 'playing'});
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
  });
});

describe('clearAdhkar', () => {
  it('clears the adhkar player and restores the main player', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(adhkarPlayer.setActiveForLockScreen).not.toHaveBeenCalledWith(
      false,
      expect.anything(),
    );
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalled();
  });
});

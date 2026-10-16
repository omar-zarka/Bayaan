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

let mockActiveSource = 'adhkar';
jest.mock('../AudioCoordinator', () => ({
  audioCoordinator: {getActiveSource: () => mockActiveSource},
}));

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

// The mocked stores hold a trimmed state (a track with three fields), which
// the real store types reject; these tests only need setState.
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
  mockActiveSource = 'adhkar';
  mushafStore.setState({playbackState: 'idle'});
  playerStore.setState({...track('t1'), playback: {state: 'paused'}});
  await lockScreenService.startSync();
  Object.values(mockMainPlayer).forEach(fn => fn.mockClear());
});

afterEach(() => {
  lockScreenService.stopSync();
  lockScreenService.setCarMode(false);
  lockScreenService.setCarAyahLabel(null);
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

  it('keeps the entry while main still reads playing right after adhkarWillPlay', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    playerStore.setState({...track('t2'), playback: {state: 'playing'}});
    expect(adhkarPlayer.clearLockScreenControls).not.toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });

  it('drops the held entry once the main player plays a new track', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockActiveSource = 'main';
    playerStore.setState({...track('t2'), playback: {state: 'playing'}});
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalled();
  });

  it('drops the held entry when the mushaf starts playing', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    adhkarPlayer.clearLockScreenControls.mockClear();
    mockActiveSource = 'mushaf';
    mushafStore.setState({playbackState: 'playing'});
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
  });

  it('drops the held entry when a paused mushaf resumes', () => {
    // Mushaf played, adhkarWillPlay paused it (not idle), adhkar took over.
    mushafStore.setState({playbackState: 'playing'});
    mushafStore.setState({playbackState: 'paused'});
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    adhkarPlayer.clearLockScreenControls.mockClear();
    mockActiveSource = 'mushaf';
    mushafStore.setState({playbackState: 'playing'});
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
  });

  it('does not restore main when a paused mushaf goes idle while held', () => {
    mushafStore.setState({playbackState: 'playing'});
    mushafStore.setState({playbackState: 'paused'});
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    mushafStore.setState({playbackState: 'idle'});
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
    // The entry is still held: the next track only updates metadata.
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), {
      ...session,
      index: 4,
    });
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(adhkarPlayer.updateLockScreenMetadata).toHaveBeenCalledTimes(1);
  });

  it('re-activates fully after the entry was dropped', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockActiveSource = 'main';
    playerStore.setState({...track('t2'), playback: {state: 'playing'}});
    mockActiveSource = 'adhkar';
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(2);
  });

  it('leaves car mode and the car ayah label off the main player while held', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    lockScreenService.setCarMode(true);
    lockScreenService.setCarAyahLabel('Ayah 3 of 7');
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
    expect(mockMainPlayer.updateLockScreenMetadata).not.toHaveBeenCalled();
    // Main picks both up when the entry is cleared.
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.objectContaining({artist: 'Reciter · Ayah 3 of 7'}),
      {showSeekForward: false, showSeekBackward: false},
    );
  });
});

describe('clearAdhkar', () => {
  it('clears the adhkar player and restores the main player', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.objectContaining({title: 't1'}),
      expect.anything(),
    );
  });

  it('is a no-op when the entry already went to another source', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockActiveSource = 'mushaf';
    mushafStore.setState({playbackState: 'playing'});
    adhkarPlayer.clearLockScreenControls.mockClear();
    mockMainPlayer.setActiveForLockScreen.mockClear();
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(adhkarPlayer.clearLockScreenControls).not.toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });

  it('does not restore main over a playing mushaf', () => {
    // A held entry the mushaf did not drop: adhkar re-activated while the
    // mushaf store still read playing.
    mushafStore.setState({playbackState: 'playing'});
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mushafStore.setState({playbackState: 'loading'});
    mockMainPlayer.setActiveForLockScreen.mockClear();
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });
});

describe('stopSync', () => {
  it('clears a held adhkar entry', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    lockScreenService.stopSync();
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    // After a restart the entry activates fully again.
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(2);
  });
});

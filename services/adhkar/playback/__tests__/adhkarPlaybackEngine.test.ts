import {AppState} from 'react-native';
import {startAdhkarPlaybackEngine} from '@/services/adhkar/playback/adhkarPlaybackEngine';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {SessionSource} from '@/services/adhkar/playback/types';

jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));

type Listener = (s: {
  playing: boolean;
  didJustFinish: boolean;
  currentTime: number;
  duration: number;
}) => void;

function fakePlayer() {
  let listener: Listener | null = null;
  return {
    loop: false,
    currentTime: 0,
    duration: 10,
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    updateLockScreenMetadata: jest.fn(),
    addListener: jest.fn((_e: string, l: Listener) => {
      listener = l;
      return {remove: jest.fn()};
    }),
    emit(s: Partial<Parameters<Listener>[0]>) {
      listener?.({
        playing: false,
        didJustFinish: false,
        currentTime: 0,
        duration: 10,
        ...s,
      });
    },
  };
}

const src: SessionSource = {
  listId: 'morning-adhkar',
  listTitle: 'Morning',
  items: ['a', 'b'].map(id => ({
    dhikrId: id,
    audioFile: `${id}.mp3`,
    playable: true,
    preview: id,
  })),
};

let player: ReturnType<typeof fakePlayer>;
let stop: () => void;
const coordinator = {adhkarWillPlay: jest.fn(), sourceDidStop: jest.fn()};
const lockScreen = {activate: jest.fn(), clear: jest.fn()};

beforeEach(() => {
  jest.useFakeTimers();
  useAdhkarSessionStore.setState({session: null, revealToken: 0});
  player = fakePlayer();
  stop = startAdhkarPlaybackEngine({
    createPlayer: () => player,
    getSource: file => (file ? 1 : null),
    coordinator,
    lockScreen,
  });
});
afterEach(() => {
  stop();
  jest.useRealTimers();
  jest.clearAllMocks();
});

const dispatch = useAdhkarSessionStore.getState().dispatch;

it('loads, plays and confirms through the player status', () => {
  dispatch({type: 'pressPlayAll', source: src});
  expect(player.replace).toHaveBeenCalledTimes(1);
  expect(player.play).toHaveBeenCalledTimes(1);
  expect(coordinator.adhkarWillPlay).toHaveBeenCalled();
  player.emit({playing: true});
  expect(useAdhkarSessionStore.getState().session?.status).toBe('playing');
});

it('advances on finish with the same player, no second player', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({playing: false, didJustFinish: true});
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
  expect(player.replace).toHaveBeenCalledTimes(2);
});

it('ignores a finish carried over from the previous clip', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({didJustFinish: true}); // advance to b
  player.emit({didJustFinish: true}); // stale, b has not reported playing yet
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
});

it('advances after a clip shorter than two seconds', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true, duration: 1.2});
  player.emit({didJustFinish: true, duration: 1.2});
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
});

it('retries once, then pauses with an error', () => {
  dispatch({type: 'pressPlayAll', source: src});
  jest.advanceTimersByTime(1500);
  expect(player.play).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(1500);
  expect(useAdhkarSessionStore.getState().session).toMatchObject({
    status: 'paused',
    error: true,
  });
});

it('follows a remote pause and resume without re-playing', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({playing: false});
  expect(useAdhkarSessionStore.getState().session?.status).toBe('paused');
  expect(player.play).toHaveBeenCalledTimes(1);
  player.emit({playing: true});
  expect(useAdhkarSessionStore.getState().session?.status).toBe('playing');
});

it('saves the position on pause and seeks to it on resume after restore', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.currentTime = 4;
  dispatch({type: 'toggle'});
  expect(player.pause).toHaveBeenCalled();
  expect(useAdhkarSessionStore.getState().session?.positionSec).toBe(4);
});

it('restored sessions do not load until play, then seek', () => {
  dispatch({
    type: 'restored',
    session: {
      ...src,
      index: 1,
      mode: 'all',
      loop: false,
      status: 'paused',
      error: false,
      trackToken: 1,
      positionSec: 3,
      lastActiveAt: 0,
    },
  });
  expect(player.replace).not.toHaveBeenCalled();
  dispatch({type: 'toggle'});
  expect(player.replace).toHaveBeenCalledTimes(1);
  expect(player.seekTo).toHaveBeenCalledWith(3);
});

it('pauses the player and clears the lock screen when the session ends', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  dispatch({type: 'stop'});
  expect(player.pause).toHaveBeenCalled();
  expect(lockScreen.clear).toHaveBeenCalled();
  expect(coordinator.sourceDidStop).toHaveBeenCalledWith('adhkar');
});

it('sets loop in single mode only', () => {
  dispatch({type: 'pressCard', source: src, index: 0});
  dispatch({type: 'toggleLoop'});
  expect(player.loop).toBe(true);
});

it('saves the position when the app goes to the background', () => {
  stop();
  const remove = jest.fn();
  const addSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({remove});
  addSpy.mockClear();
  stop = startAdhkarPlaybackEngine({
    createPlayer: () => player,
    getSource: file => (file ? 1 : null),
    coordinator,
    lockScreen,
  });
  const handler = addSpy.mock.calls[addSpy.mock.calls.length - 1][1];
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.currentTime = 6;
  handler('background');
  expect(useAdhkarSessionStore.getState().session?.positionSec).toBe(6);
  stop();
  expect(remove).toHaveBeenCalled();
  addSpy.mockRestore();
});

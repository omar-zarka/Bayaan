jest.mock('@/utils/adhkarAudio', () => ({
  hasAudio: (file: string | null) => file !== null && file.startsWith('ok'),
  getAudioSource: (file: string | null) =>
    file !== null && file.startsWith('ok') ? 1 : null,
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({playback: {state: 'idle'}, pause: jest.fn()}),
  },
}));
import {nextPlayableIndex, useAdhkarPlayAllStore} from '../adhkarPlayAllStore';
import type {Dhikr} from '@/types/adhkar';

function dhikr(id: string, audioFile: string | null): Dhikr {
  return {
    id,
    categoryId: '27',
    arabic: id,
    translation: null,
    transliteration: null,
    instruction: null,
    repeatCount: 1,
    audioFile,
    sortOrder: 0,
  };
}

// b has no audio; c names a file that is not bundled.
const queue = [
  dhikr('a', 'ok_a.mp3'),
  dhikr('b', null),
  dhikr('c', 'missing.mp3'),
  dhikr('d', 'ok_d.mp3'),
];

function state(): ReturnType<typeof useAdhkarPlayAllStore.getState> {
  return useAdhkarPlayAllStore.getState();
}

beforeEach(() => state().stopPlayAll());

describe('nextPlayableIndex', () => {
  it('finds the first row with bundled audio at or after an index', () => {
    expect(nextPlayableIndex(queue, 0)).toBe(0);
    expect(nextPlayableIndex(queue, 1)).toBe(3);
    expect(nextPlayableIndex(queue, 4)).toBe(-1);
    expect(nextPlayableIndex([dhikr('x', null)], 0)).toBe(-1);
  });
});

describe('Play All with rows without audio', () => {
  it('starts at the first playable row and reports where', () => {
    const start = state().startPlayAll(
      queue.slice(1),
      0,
      'evening',
      'evening-adhkar',
    );
    expect(start).toBe(2);
    expect(state().currentIndex).toBe(2);
    expect(state().isPlaying).toBe(true);
  });

  it('does not start when no row has audio', () => {
    expect(state().startPlayAll([dhikr('x', null)], 0, 'other', 'x')).toBe(-1);
    expect(state().isPlayAllMode).toBe(false);
  });

  it('skips rows without audio when a track ends, and stops at the end', () => {
    state().startPlayAll(queue, 0, 'evening', 'evening-adhkar');
    expect(state().advanceToNext()).toBe(true);
    expect(state().currentIndex).toBe(3);
    expect(state().advanceToNext()).toBe(false);
    expect(state().isPlayAllMode).toBe(false);
  });

  it('pauses instead of freezing when the user swipes onto a row without audio', () => {
    state().startPlayAll(queue, 0, 'evening', 'evening-adhkar');
    state().goToIndex(1);
    expect(state().currentIndex).toBe(1);
    expect(state().isPlaying).toBe(false);
    state().goToIndex(3);
    expect(state().currentIndex).toBe(3);
    expect(state().isPlaying).toBe(false);
  });

  it('play on a row without audio moves on to the next playable row', () => {
    state().startPlayAll(queue, 0, 'evening', 'evening-adhkar');
    state().goToIndex(1);
    state().play();
    expect(state().currentIndex).toBe(3);
    expect(state().isPlaying).toBe(true);
  });

  it('goToPrevious skips rows without audio back to the previous playable row', () => {
    state().startPlayAll(queue, 3, 'evening', 'evening-adhkar');
    expect(state().currentIndex).toBe(3);
    expect(state().goToPrevious()).toBe(true);
    expect(state().currentIndex).toBe(0);
    expect(state().isPlaying).toBe(true);
  });

  it('goToPrevious stays put when no earlier row has audio', () => {
    state().startPlayAll(queue.slice(1), 0, 'evening', 'evening-adhkar');
    expect(state().currentIndex).toBe(2);
    expect(state().goToPrevious()).toBe(false);
    expect(state().currentIndex).toBe(2);
  });
});

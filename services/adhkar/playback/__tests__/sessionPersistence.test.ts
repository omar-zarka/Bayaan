import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isSavedSessionStale,
  toSavedSession,
  saveSession,
  loadSavedSession,
  restoreSavedSession,
} from '@/services/adhkar/playback/sessionPersistence';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {
  AdhkarSession,
  SavedSession,
} from '@/services/adhkar/playback/types';

function at(h: number, m = 0, day = 13): number {
  return new Date(2026, 9, day, h, m).getTime();
}

const items = [
  {dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: 'a'},
  {dhikrId: 'b', audioFile: 'b.mp3', playable: true, preview: 'b'},
];

const live: AdhkarSession = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items,
  index: 1,
  mode: 'all',
  loop: false,
  status: 'playing',
  error: false,
  trackToken: 7,
  positionSec: 4.5,
  lastActiveAt: at(10),
};

function saved(over: Partial<SavedSession> = {}): SavedSession {
  return {
    listId: 'morning-adhkar',
    listTitle: 'Morning Adhkar',
    mode: 'all',
    loop: false,
    dhikrId: 'b',
    positionSec: 4.5,
    lastActiveAt: at(10),
    ...over,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useAdhkarSessionStore.setState({session: null, revealToken: 0});
});
afterEach(() => jest.restoreAllMocks());

it('saves only the listed fields', () => {
  expect(toSavedSession(live)).toEqual(saved());
});

describe('isSavedSessionStale', () => {
  it('Morning played at 10:00 lives until 15:00', () => {
    expect(isSavedSessionStale(saved(), at(14, 59))).toBe(false);
    expect(isSavedSessionStale(saved(), at(15))).toBe(true);
  });
  it('Evening played at 20:00 lives until 04:00', () => {
    const s = saved({listId: 'evening-adhkar', lastActiveAt: at(20)});
    expect(isSavedSessionStale(s, at(3, 59, 14))).toBe(false);
    expect(isSavedSessionStale(s, at(4, 0, 14))).toBe(true);
  });
  it('a session saved exactly at 15:00 lives until 04:00', () => {
    const s = saved({lastActiveAt: at(15)});
    expect(isSavedSessionStale(s, at(23))).toBe(false);
  });
  it('other lists live 24 hours', () => {
    const s = saved({listId: 'saved', lastActiveAt: at(10)});
    expect(isSavedSessionStale(s, at(9, 59, 14))).toBe(false);
    expect(isSavedSessionStale(s, at(10, 0, 14))).toBe(true);
  });
});

it('round-trips through AsyncStorage and clears on null', async () => {
  await saveSession(live);
  expect(await loadSavedSession()).toEqual(saved());
  await saveSession(null);
  expect(await loadSavedSession()).toBeNull();
});

it('restores as paused at the saved dhikr', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(at(11));
  await saveSession(live);
  await restoreSavedSession(async () => items);
  expect(useAdhkarSessionStore.getState().session).toMatchObject({
    index: 1,
    status: 'paused',
    positionSec: 4.5,
    mode: 'all',
  });
});

it('drops a saved session whose dhikr no longer exists', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(at(11));
  await saveSession(live);
  await restoreSavedSession(async () => [items[0]]);
  expect(useAdhkarSessionStore.getState().session).toBeNull();
  expect(await loadSavedSession()).toBeNull();
});

it('drops a stale saved session', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(at(16));
  await saveSession(live);
  await restoreSavedSession(async () => items);
  expect(useAdhkarSessionStore.getState().session).toBeNull();
});

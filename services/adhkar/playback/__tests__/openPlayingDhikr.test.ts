import {
  openPlayingDhikr,
  planOpenPlaying,
  setAdhkarFocus,
} from '@/services/adhkar/playback/openPlayingDhikr';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

const session: AdhkarSession = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items: [
    {dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: 'a'},
    {dhikrId: 'b', audioFile: 'b.mp3', playable: true, preview: 'b'},
  ],
  index: 1,
  mode: 'all',
  loop: false,
  status: 'playing',
  error: false,
  trackToken: 1,
  positionSec: 0,
  lastActiveAt: 0,
};

it('does nothing without a session', () => {
  expect(planOpenPlaying(null, null)).toEqual({kind: 'none'});
});
it('reveals when the session list reader or list is focused', () => {
  expect(
    planOpenPlaying(session, {kind: 'reader', listId: 'morning-adhkar'}),
  ).toEqual({kind: 'reveal'});
  expect(
    planOpenPlaying(session, {kind: 'list', listId: 'morning-adhkar'}),
  ).toEqual({kind: 'reveal'});
});
it('pushes the category reader at the playing index otherwise', () => {
  expect(
    planOpenPlaying(session, {kind: 'reader', listId: 'evening-adhkar'}),
  ).toEqual({
    kind: 'push',
    href: {
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      params: {
        superId: 'morning-adhkar',
        dhikrId: 'b',
        globalIndex: '1',
        superCategoryTitle: 'Morning Adhkar',
      },
    },
  });
});
it('pushes the saved reader for a saved session', () => {
  expect(planOpenPlaying({...session, listId: 'saved'}, null)).toEqual({
    kind: 'push',
    href: {
      pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]',
      params: {dhikrId: 'b', globalIndex: '1'},
    },
  });
});

describe('openPlayingDhikr', () => {
  const router = {push: jest.fn(), replace: jest.fn()};
  beforeEach(() => {
    router.push.mockClear();
    router.replace.mockClear();
    useAdhkarSessionStore.setState({session, revealToken: 0});
    setAdhkarFocus({kind: 'list', listId: 'morning-adhkar'});
  });
  afterEach(() => {
    setAdhkarFocus(null);
    useAdhkarSessionStore.setState({session: null, revealToken: 0});
  });

  it('reveals in place when the session list is focused', () => {
    expect(openPlayingDhikr(router)).toBe(true);
    expect(useAdhkarSessionStore.getState().revealToken).toBe(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('the deep link route navigates even while the session list is focused', () => {
    expect(openPlayingDhikr(router, 'replace', null)).toBe(true);
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      }),
    );
    expect(useAdhkarSessionStore.getState().revealToken).toBe(0);
  });
});

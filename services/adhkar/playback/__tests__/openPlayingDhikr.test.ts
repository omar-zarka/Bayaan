import {planOpenPlaying} from '@/services/adhkar/playback/openPlayingDhikr';
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

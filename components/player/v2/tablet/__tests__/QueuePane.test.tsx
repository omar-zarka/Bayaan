// @ai-generated
import React from 'react';
import {Text, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {primary: '#5B4FE0'}}}),
}));
jest.mock('@/hooks/useReadingThemeColors', () => ({
  useReadingThemeColors: () => ({
    text: '#111111',
    textSecondary: '#666666',
    card: '#F2F2F2',
  }),
}));
jest.mock('@/hooks/usePlayerA11y', () => ({
  usePlayerA11y: () => ({repeat: () => ({accessibilityLabel: 'Repeat'})}),
}));
const mockActions = {
  updateQueue: jest.fn().mockResolvedValue(undefined),
  removeFromQueue: jest.fn().mockResolvedValue(undefined),
  moveInQueue: jest.fn(),
  shuffleUpNext: jest.fn(),
  play: jest.fn().mockResolvedValue(undefined),
  updateSettings: jest.fn(),
};
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => mockActions,
}));
const mockNavigateToReciter = jest.fn();
jest.mock('@/hooks/useReciterNavigation', () => ({
  useReciterNavigation: () => ({
    navigateToReciterProfile: mockNavigateToReciter,
  }),
}));

type MockTrack = {id: string; title: string; reciterId?: string};
let mockQueue: {tracks: MockTrack[]; currentIndex: number};
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (selector: (s: unknown) => unknown) =>
    selector({
      queue: mockQueue,
      settings: {repeatMode: 'none'},
      playback: {state: 'paused'},
    }),
}));
jest.mock('../../PlayerContent/QueueList', () => ({
  useRowDisplay: (track: MockTrack) => ({
    title: track.title,
    subtitle: 'Reciter',
    tags: [],
    surahId: 1,
  }),
}));
jest.mock('@/i18n/format', () => ({
  ...jest.requireActual('@/i18n/format'),
  getTrackDisplayTitle: (track: MockTrack) => track.title,
  getTrackArtistDisplay: () => 'Reciter',
}));
const mockShowSheet = jest.fn();
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: (...args: unknown[]) => mockShowSheet(...args)},
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/NowPlayingIndicator', () => ({
  NowPlayingIndicator: () => null,
}));
jest.mock('@/components/Icons', () => new Proxy({}, {get: () => () => null}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
}));

// The real list needs Reanimated and gesture handler; this one renders the
// header, each row and the footer, and keeps onDragEnd to call directly.
interface MockListProps {
  data: unknown[];
  keyExtractor: (item: unknown) => string;
  renderItem: (params: object) => React.ReactNode;
  onDragEnd: (params: {from: number; to: number}) => void;
  ListHeaderComponent: React.ReactNode;
  ListFooterComponent: React.ReactNode;
}
jest.mock('react-native-draggable-flatlist', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: MockListProps) => (
      <MockView testID="list" onDragEnd={props.onDragEnd}>
        {props.ListHeaderComponent}
        {props.data.map((item, i) => (
          <MockView key={props.keyExtractor(item)}>
            {props.renderItem({
              item,
              drag: jest.fn(),
              isActive: false,
              getIndex: () => i,
            })}
          </MockView>
        ))}
        {props.ListFooterComponent}
      </MockView>
    ),
  };
});

import {QueuePane} from '../QueuePane';

const track = (id: string): MockTrack => ({
  id,
  title: `Surah ${id}`,
  reciterId: 'r1',
});

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<QueuePane bottomInset={20} />);
  });
  return renderer;
}

/** The innermost element with this label that takes a press. */
const button = (r: TestRenderer.ReactTestRenderer, label: string) => {
  const all = r.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  );
  return all[all.length - 1];
};

const texts = (r: TestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as unknown) === Text)
    .map(n => [n.props.children].flat().join(''));

beforeEach(() => {
  // a was played, b is playing, c and d are up next.
  mockQueue = {tracks: ['a', 'b', 'c', 'd'].map(track), currentIndex: 1};
  jest.clearAllMocks();
});

describe('QueuePane', () => {
  it('shows the current track and counts what is up next', () => {
    const shown = texts(render());
    expect(shown).toEqual(
      expect.arrayContaining(['Up Next', '2 tracks', 'Now Playing']),
    );
    expect(shown.indexOf('Surah b')).toBeLessThan(shown.indexOf('Surah c'));
    expect(shown.indexOf('Surah c')).toBeLessThan(shown.indexOf('Surah d'));
    // The played track waits behind its disclosure row.
    expect(shown).not.toContain('Surah a');
  });

  it('clears only the tracks after the current one', () => {
    const r = render();
    act(() => button(r, 'Clear Up Next').props.onPress());
    expect(mockActions.removeFromQueue).toHaveBeenCalledWith([2, 3]);
  });

  it('shuffles Up Next, and only when there are two tracks to shuffle', () => {
    const r = render();
    act(() => button(r, 'Shuffle').props.onPress());
    expect(mockActions.shuffleUpNext).toHaveBeenCalled();

    mockQueue = {...mockQueue, currentIndex: 2};
    expect(button(render(), 'Shuffle').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('cycles repeat from its chip', () => {
    const r = render();
    act(() => button(r, 'Repeat').props.onPress());
    expect(mockActions.updateSettings).toHaveBeenCalledWith({
      repeatMode: 'queue',
    });
  });

  it('opens a menu for a row that can play it next', () => {
    const r = render();
    act(() => button(r, 'More options for Surah d').props.onPress());
    const [id, {payload}] = mockShowSheet.mock.calls[0];
    expect(id).toBe('collection-options');
    expect(payload.title).toBe('Surah d');
    expect(payload.options.map((o: {label: string}) => o.label)).toEqual([
      'Play Now',
      'Play Next',
      'Go to Reciter',
      'Remove',
    ]);

    payload.options[1].onPress();
    expect(mockActions.moveInQueue).toHaveBeenCalledWith(3, 2);
    payload.options[3].onPress();
    expect(mockActions.removeFromQueue).toHaveBeenCalledWith([3]);
  });

  it('leaves Play Next out for the track that is already next', () => {
    const r = render();
    act(() => button(r, 'More options for Surah c').props.onPress());
    const [, {payload}] = mockShowSheet.mock.calls[0];
    expect(payload.options.map((o: {label: string}) => o.label)).not.toContain(
      'Play Next',
    );
  });

  it('moves a dragged row to its place in the whole queue', () => {
    const r = render();
    const [list] = r.root.findAll(
      n => n.props.testID === 'list' && (n.type as unknown) === View,
    );
    act(() => list.props.onDragEnd({from: 0, to: 1}));
    expect(mockActions.moveInQueue).toHaveBeenCalledWith(2, 3);

    mockActions.moveInQueue.mockClear();
    act(() => list.props.onDragEnd({from: 1, to: 1}));
    expect(mockActions.moveInQueue).not.toHaveBeenCalled();
  });

  it('offers VoiceOver move actions that stay inside Up Next', () => {
    const r = render();
    const row = button(r, 'Surah c, Reciter');
    expect(
      row.props.accessibilityActions.map((a: {name: string}) => a.name),
    ).toEqual(['moveDown']);
    act(() =>
      row.props.onAccessibilityAction({nativeEvent: {actionName: 'moveDown'}}),
    );
    expect(mockActions.moveInQueue).toHaveBeenCalledWith(2, 3);
  });

  it('shows the played tracks when their row is opened', () => {
    const r = render();
    const disclosure = r.root
      .findAll(
        n =>
          n.props.accessibilityState?.expanded !== undefined &&
          typeof n.props.onPress === 'function',
      )
      .pop();
    expect(disclosure).toBeDefined();
    act(() => disclosure?.props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['Played (1)', 'Surah a']));
  });

  it('plays a tapped row', async () => {
    const r = render();
    await act(async () => {
      await button(r, 'Surah d, Reciter').props.onPress();
    });
    expect(mockActions.updateQueue).toHaveBeenCalledWith(mockQueue.tracks, 3);
    expect(mockActions.play).toHaveBeenCalled();
  });
});

import React from 'react';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {AdhkarAudioControls} from '@/components/adhkar/AdhkarAudioControls';
import {AdhkarSessionSourceProvider} from '@/components/adhkar/AdhkarSessionSourceContext';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {SessionSource} from '@/services/adhkar/playback/types';

// The repo has no @testing-library/react-native, so this suite uses
// react-test-renderer like the other component suites here.

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
      },
      fonts: {regular: 'Regular', semiBold: 'SemiBold'},
    },
  }),
}));
// Icon fonts load asynchronously and update outside act.
jest.mock('@expo/vector-icons', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {Feather: MockView, Ionicons: MockView};
});
jest.mock('@react-native-community/slider', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {__esModule: true, default: MockView};
});
jest.mock('@/utils/adhkarAudio', () => ({
  hasAudio: (f: string | null) => f !== null,
  getAudioSource: () => 1,
}));
jest.mock('@/services/adhkar/playback/adhkarPlaybackEngine', () => ({
  getAdhkarPlaybackPosition: () => ({currentTime: 0, duration: 10}),
  seekAdhkarPlayback: jest.fn(),
}));

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

let mounted: ReactTestRenderer | undefined;

function renderCard(dhikrId: string): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <AdhkarSessionSourceProvider source={src}>
        <AdhkarAudioControls
          dhikrId={dhikrId}
          audioFile={`${dhikrId}.mp3`}
          onCopy={jest.fn()}
          onBookmark={jest.fn()}
          onShare={jest.fn()}
          onSettings={jest.fn()}
          isBookmarked={false}
        />
      </AdhkarSessionSourceProvider>,
    );
  });
  if (!renderer) throw new Error('not rendered');
  mounted = renderer;
  return renderer;
}

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
});

beforeEach(() =>
  useAdhkarSessionStore.setState({session: null, revealToken: 0}),
);

it('plays this card even while another list plays all', () => {
  useAdhkarSessionStore.getState().dispatch({
    type: 'pressPlayAll',
    source: {...src, listId: 'evening-adhkar'},
  });
  const renderer = renderCard('b');
  const button = renderer.root.find(
    node =>
      node.props.testID === 'adhkar-play-button' &&
      typeof node.props.onPress === 'function',
  );
  act(() => button.props.onPress());
  expect(useAdhkarSessionStore.getState().session).toMatchObject({
    listId: 'morning-adhkar',
    index: 1,
    mode: 'single',
  });
});

it('reserves the progress row height on a card that is not current', () => {
  const renderer = renderCard('a');
  const rows = renderer.root.findAll(
    node => node.props.testID === 'adhkar-progress-row',
  );
  expect(rows.length).toBeGreaterThan(0);
});

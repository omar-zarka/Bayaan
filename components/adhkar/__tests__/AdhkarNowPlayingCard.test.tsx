import React from 'react';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {AdhkarNowPlayingCard} from '@/components/adhkar/AdhkarNowPlayingCard';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({push: mockPush, replace: jest.fn()}),
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      fonts: {regular: 'r', medium: 'm', semiBold: 's'},
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        card: '#ffffff',
        background: '#ffffff',
      },
    },
  }),
}));

// No i18n instance in component tests: interpolate {{vars}} by hand so the
// position string resolves to "2 of 2".
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, number>) =>
      key === 'adhkar.position' && vars
        ? `${vars.current} of ${vars.total}`
        : key,
  }),
}));

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/Icons', () => ({
  PlayIcon: () => null,
  PauseIcon: () => null,
}));
jest.mock('@/services/adhkar/playback/sessionPersistence', () => ({
  dropStaleSession: jest.fn(),
}));

jest.mock('react-native-reanimated', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {View: MockView},
    cancelAnimation: jest.fn(),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    useSharedValue: (v: number) => ({value: v}),
    withDelay: (_d: number, v: number) => v,
    withRepeat: (v: number) => v,
    withTiming: (v: number) => v,
  };
});

jest.mock('@/services/adhkar/playback/openPlayingDhikr', () => ({
  openPlayingDhikr: (router: {push: (p: string) => void}) => {
    router.push('/adhkar/x');
    return true;
  },
}));

const items = [
  {dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: 'a'},
  {dhikrId: 'b', audioFile: 'b.mp3', playable: true, preview: 'b'},
];

const session: AdhkarSession = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items,
  index: 1,
  mode: 'all',
  loop: false,
  status: 'playing',
  error: false,
  trackToken: 1,
  positionSec: 0,
  lastActiveAt: Date.now(),
};

function texts(r: ReactTestRenderer): string[] {
  return r.root
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => [n.props.children].flat().join(''));
}

let renderer: ReactTestRenderer | null = null;

function mount(variant: 'tile' | 'row'): ReactTestRenderer {
  act(() => {
    renderer = TestRenderer.create(<AdhkarNowPlayingCard variant={variant} />);
  });
  if (!renderer) throw new Error('render failed');
  return renderer;
}

beforeEach(() => {
  mockPush.mockClear();
  act(() => {
    useAdhkarSessionStore.setState({session: null, revealToken: 0});
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('renders nothing without a session', () => {
  const r = mount('row');
  expect(r.toJSON()).toBeNull();
});

describe('with a session', () => {
  beforeEach(() => {
    act(() => {
      useAdhkarSessionStore.setState({session});
    });
  });

  it('shows the title and position', () => {
    const r = mount('row');
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Morning Adhkar', '2 of 2']),
    );
  });

  it('toggles, opens and stops', () => {
    const r = mount('tile');
    const press = (id: string): void => {
      act(() => {
        r.root.findByProps({testID: id}).props.onPress();
      });
    };
    press('adhkar-now-playing-toggle');
    expect(useAdhkarSessionStore.getState().session?.status).toBe('paused');
    press('adhkar-now-playing-open');
    expect(mockPush).toHaveBeenCalled();
    press('adhkar-now-playing-close');
    expect(useAdhkarSessionStore.getState().session).toBeNull();
  });
});

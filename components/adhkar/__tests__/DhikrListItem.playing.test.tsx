import React from 'react';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import type {Dhikr} from '@/types/adhkar';

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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

jest.mock('@/i18n/format', () => ({
  localizeDigits: (n: number) => String(n),
}));

jest.mock('@/store/adhkarSettingsStore', () => ({
  useAdhkarSettingsStore: (
    selector: (s: {showTranslation: boolean}) => unknown,
  ) => selector({showTranslation: false}),
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

jest.mock('../AdhkarArabicText', () => ({AdhkarArabicText: () => null}));
jest.mock('../AdhkarLatinText', () => ({AdhkarLatinText: () => null}));

const dhikr: Dhikr = {
  id: 'a',
  categoryId: 'c',
  arabic: 'سُبْحَانَ اللَّهِ',
  translation: null,
  transliteration: null,
  instruction: null,
  repeatCount: 1,
  audioFile: 'a.mp3',
  sortOrder: 1,
};

function hasBars(renderer: ReactTestRenderer): boolean {
  return (
    renderer.root.findAll(n => n.props.testID === 'dhikr-playing-bars').length >
    0
  );
}

it('shows bars only on the current card', () => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<DhikrListItem dhikr={dhikr} index={0} />);
  });
  if (!renderer) throw new Error('not rendered');
  expect(hasBars(renderer)).toBe(false);
  act(() => {
    renderer?.update(
      <DhikrListItem dhikr={dhikr} index={0} isCurrent isPlaying />,
    );
  });
  expect(hasBars(renderer)).toBe(true);
});

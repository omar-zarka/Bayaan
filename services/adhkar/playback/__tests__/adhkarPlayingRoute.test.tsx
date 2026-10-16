// app/adhkar-playing.tsx (tests cannot live under app/: expo-router would
// treat them as routes).
import React from 'react';
import {act, create} from 'react-test-renderer';

let mockRootKey: string | undefined = 'root';
const mockReplace = jest.fn();
const mockNavigation = {
  isReady: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};
let mockFinishRestore: () => void = () => undefined;
const mockWait = jest.fn(
  (_timeoutMs: number) =>
    new Promise<void>(resolve => {
      mockFinishRestore = resolve;
    }),
);
const mockOpen = jest.fn<boolean, [unknown, unknown]>();

jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => mockNavigation,
  useRootNavigationState: () =>
    mockRootKey === undefined ? undefined : {key: mockRootKey},
  useRouter: () => ({replace: mockReplace}),
}));
jest.mock('@/services/adhkar/playback/sessionPersistence', () => ({
  waitForSessionRestore: (timeoutMs: number) => mockWait(timeoutMs),
}));
jest.mock('@/services/adhkar/playback/openPlayingDhikr', () => ({
  ...jest.requireActual('@/services/adhkar/playback/openPlayingDhikr'),
  openPlayingDhikr: (navigation: unknown, current: unknown) =>
    mockOpen(navigation, current),
}));

import AdhkarPlayingRoute from '@/app/adhkar-playing';
import {adhkarStackAction} from '@/services/adhkar/playback/openPlayingDhikr';

beforeEach(() => {
  mockRootKey = 'root';
  mockReplace.mockClear();
  mockNavigation.isReady.mockReturnValue(true);
  mockNavigation.canGoBack.mockReturnValue(true);
  mockNavigation.goBack.mockClear();
  mockNavigation.dispatch.mockClear();
  mockWait.mockClear();
  mockOpen.mockReset();
});

it('waits for the saved session, then opens the playing dhikr', async () => {
  mockOpen.mockReturnValue(true);
  await act(async () => {
    create(<AdhkarPlayingRoute />);
  });
  expect(mockWait).toHaveBeenCalledWith(3000);
  expect(mockOpen).not.toHaveBeenCalled();
  await act(async () => {
    mockFinishRestore();
  });
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(mockOpen).toHaveBeenCalledWith(mockNavigation, null);
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
});

it('swaps itself for the tabs when it is the only route', async () => {
  mockOpen.mockReturnValue(true);
  mockNavigation.canGoBack.mockReturnValue(false);
  await act(async () => {
    create(<AdhkarPlayingRoute />);
  });
  await act(async () => {
    mockFinishRestore();
  });
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(a.home)');
});

it('waits for navigation to be ready before anything else', async () => {
  mockOpen.mockReturnValue(true);
  mockRootKey = undefined;
  mockNavigation.isReady.mockReturnValue(false);
  let renderer: ReturnType<typeof create> | null = null;
  await act(async () => {
    renderer = create(<AdhkarPlayingRoute />);
  });
  expect(mockWait).not.toHaveBeenCalled();
  mockRootKey = 'root';
  mockNavigation.isReady.mockReturnValue(true);
  await act(async () => {
    renderer?.update(<AdhkarPlayingRoute />);
  });
  expect(mockWait).toHaveBeenCalledTimes(1);
  await act(async () => {
    mockFinishRestore();
  });
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(mockOpen).toHaveBeenCalledWith(mockNavigation, null);
});

it('falls back to the Adhkar screen when no session comes back', async () => {
  mockOpen.mockReturnValue(false);
  await act(async () => {
    create(<AdhkarPlayingRoute />);
  });
  await act(async () => {
    mockFinishRestore();
  });
  expect(mockNavigation.dispatch).toHaveBeenCalledWith(
    adhkarStackAction([{name: 'index', params: {}}]),
  );
});

it('does not navigate after it unmounts', async () => {
  mockOpen.mockReturnValue(false);
  let renderer: ReturnType<typeof create> | null = null;
  await act(async () => {
    renderer = create(<AdhkarPlayingRoute />);
  });
  await act(async () => {
    renderer?.unmount();
  });
  await act(async () => {
    mockFinishRestore();
  });
  expect(mockOpen).not.toHaveBeenCalled();
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
});

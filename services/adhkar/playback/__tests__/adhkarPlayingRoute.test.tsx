// app/adhkar-playing.tsx (tests cannot live under app/: expo-router would
// treat them as routes).
import React from 'react';
import {act, create} from 'react-test-renderer';

const mockReplace = jest.fn();
const mockRouter = {push: jest.fn(), replace: mockReplace};
let mockFinishRestore: () => void = () => undefined;
const mockWait = jest.fn(
  (_timeoutMs: number) =>
    new Promise<void>(resolve => {
      mockFinishRestore = resolve;
    }),
);
const mockOpen = jest.fn<boolean, [unknown, string, unknown]>();

jest.mock('expo-router', () => ({useRouter: () => mockRouter}));
jest.mock('@/services/adhkar/playback/sessionPersistence', () => ({
  waitForSessionRestore: (timeoutMs: number) => mockWait(timeoutMs),
}));
jest.mock('@/services/adhkar/playback/openPlayingDhikr', () => ({
  openPlayingDhikr: (router: unknown, mode: string, current: unknown) =>
    mockOpen(router, mode, current),
}));

import AdhkarPlayingRoute from '@/app/adhkar-playing';

beforeEach(() => {
  mockReplace.mockClear();
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
  expect(mockOpen).toHaveBeenCalledWith(mockRouter, 'replace', null);
  expect(mockReplace).not.toHaveBeenCalled();
});

it('falls back to the Adhkar screen when no session comes back', async () => {
  mockOpen.mockReturnValue(false);
  await act(async () => {
    create(<AdhkarPlayingRoute />);
  });
  await act(async () => {
    mockFinishRestore();
  });
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(a.home)/adhkar');
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
  expect(mockReplace).not.toHaveBeenCalled();
});

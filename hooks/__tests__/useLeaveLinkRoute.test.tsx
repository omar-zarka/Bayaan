import React from 'react';
import {act, create} from 'react-test-renderer';

let mockRootKey: string | undefined;
let mockReady = false;
const mockNavigation = {
  isReady: jest.fn(() => mockReady),
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
};
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => mockNavigation,
  useRootNavigationState: () =>
    mockRootKey === undefined ? undefined : {key: mockRootKey},
  useRouter: () => ({replace: mockReplace}),
}));

import {useLeaveLinkRoute} from '@/hooks/useLeaveLinkRoute';

function Probe({onLeft}: {onLeft?: () => void}): null {
  useLeaveLinkRoute(onLeft);
  return null;
}

beforeEach(() => {
  mockRootKey = undefined;
  mockReady = false;
  mockNavigation.canGoBack.mockReturnValue(true);
  mockNavigation.goBack.mockClear();
  mockReplace.mockClear();
});

it('waits for navigation to be ready, then steps off the root stack once', async () => {
  const onLeft = jest.fn();
  let renderer: ReturnType<typeof create> | null = null;
  await act(async () => {
    renderer = create(<Probe onLeft={onLeft} />);
  });
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(onLeft).not.toHaveBeenCalled();

  mockRootKey = 'root';
  mockReady = true;
  await act(async () => {
    renderer?.update(<Probe onLeft={onLeft} />);
  });
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(onLeft).toHaveBeenCalledTimes(1);

  mockRootKey = 'root-2';
  await act(async () => {
    renderer?.update(<Probe onLeft={onLeft} />);
  });
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(onLeft).toHaveBeenCalledTimes(1);
});

it('replaces itself with Home when nothing is underneath', async () => {
  mockRootKey = 'root';
  mockReady = true;
  mockNavigation.canGoBack.mockReturnValue(false);
  await act(async () => {
    create(<Probe />);
  });
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(a.home)');
});

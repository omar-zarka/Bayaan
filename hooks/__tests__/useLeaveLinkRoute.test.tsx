import React from 'react';
import {act, create} from 'react-test-renderer';

const mockNavigation = {
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
}));

import {useLeaveLinkRoute} from '@/hooks/useLeaveLinkRoute';

function Probe({onLeft}: {onLeft?: () => void}): null {
  useLeaveLinkRoute(onLeft);
  return null;
}

beforeEach(() => {
  mockNavigation.canGoBack.mockReturnValue(true);
  mockNavigation.goBack.mockClear();
  mockNavigation.dispatch.mockClear();
});

it('steps off the root stack once, then calls onLeft', async () => {
  const onLeft = jest.fn();
  let renderer: ReturnType<typeof create> | null = null;
  await act(async () => {
    renderer = create(<Probe onLeft={onLeft} />);
  });
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(onLeft).toHaveBeenCalledTimes(1);
  await act(async () => {
    renderer?.update(<Probe onLeft={onLeft} />);
  });
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(onLeft).toHaveBeenCalledTimes(1);
});

it('replaces itself with the tabs when nothing is underneath', async () => {
  mockNavigation.canGoBack.mockReturnValue(false);
  await act(async () => {
    create(<Probe />);
  });
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockNavigation.dispatch).toHaveBeenCalledWith({
    type: 'REPLACE',
    payload: {name: '(tabs)'},
  });
});

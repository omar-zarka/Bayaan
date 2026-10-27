// @ai-generated
import React from 'react';
import {View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {Reciter} from '@/data/reciterData';
import type {Theme} from '@/utils/themeUtils';

const mockListProps: {extraData: {width: number}}[] = [];
jest.mock('@legendapp/list', () => ({
  LegendList: (props: {extraData: {width: number}}) => {
    mockListProps.push(props);
    return null;
  },
}));
jest.mock('@/components/browse/BrowseReciterCard', () => ({
  BrowseReciterCard: () => null,
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 1032, height: 1376, scale: 2, fontScale: 1}),
}));

import BrowseGrid from '@/components/browse/BrowseGrid';

const theme = {colors: {text: '#000'}} as unknown as Theme;
const reciters = [{id: 'r1'}, {id: 'r2'}] as unknown as Reciter[];

it('renders the list only once the container is measured, at that width', () => {
  let r: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(
      <BrowseGrid
        reciters={reciters}
        onReciterPress={jest.fn()}
        theme={theme}
      />,
    );
  });
  // Nothing is drawn at the window-width guess, so no stale rows get recycled.
  expect(mockListProps).toHaveLength(0);

  const container = r!.root.findAll(
    n => (n.type as unknown) === View && !!n.props.onLayout,
  )[0];
  act(() => {
    container.props.onLayout({
      nativeEvent: {layout: {width: 600, height: 800}},
    });
  });
  const narrow = mockListProps[mockListProps.length - 1].extraData.width;
  expect(narrow).toBeLessThan(600 / 3);

  // A later width change hands the list new extraData so rows redraw.
  act(() => {
    container.props.onLayout({
      nativeEvent: {layout: {width: 900, height: 800}},
    });
  });
  expect(mockListProps[mockListProps.length - 1].extraData.width).not.toBe(
    narrow,
  );
});

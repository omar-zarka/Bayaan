// @ai-generated
import React from 'react';
import {ScrollView} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

const mockCards: {width: number}[] = [];
jest.mock('@/components/adhkar/AdhkarBentoCard', () => ({
  AdhkarBentoCard: (props: {width: number}) => {
    mockCards.push(props);
    return null;
  },
}));
jest.mock('@/components/adhkar/AdhkarNowPlayingCard', () => ({
  AdhkarNowPlayingCard: () => null,
  useHasAdhkarSession: () => false,
}));
jest.mock('@/components/hero/SavedAdhkarHero', () => ({
  SavedAdhkarHero: () => null,
}));
jest.mock('@/components/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {text: '#000', error: '#f00'}}}),
}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/hooks/useAdhkar', () => ({
  useAdhkar: () => ({
    error: null,
    superCategoriesLoaded: true,
    savedIds: new Set(),
    mainSuperCategories: [
      {id: 'a', column: 'left', sortOrder: 1},
      {id: 'b', column: 'right', sortOrder: 1},
    ],
    otherSuperCategories: [],
  }),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 1032, height: 1376, scale: 2, fontScale: 1}),
}));

import {AdhkarView, adhkarTileDimensions} from '@/components/AdhkarView';

it('sizes the two columns from the measured container, not the window', () => {
  let r: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(
      <AdhkarView
        onCategoryPress={jest.fn()}
        onSavedPress={jest.fn()}
        headerHeight={0}
      />,
    );
  });
  const [scroll] = r!.root.findAll(n => (n.type as unknown) === ScrollView);
  mockCards.length = 0;
  act(() => {
    scroll.props.onLayout({nativeEvent: {layout: {width: 720, height: 900}}});
  });

  const [first] = mockCards.slice(-2);
  const {horizontalPadding} = adhkarTileDimensions(720, 0);
  // Two cards, one gap and both side paddings fill exactly 720pt.
  const gap = 720 - horizontalPadding * 2 - first.width * 2;
  expect(gap).toBeGreaterThan(0);
  expect(gap).toBeLessThan(30);
  expect(first.width).toBeCloseTo(adhkarTileDimensions(720, gap).columnWidth);
  // Window math would have sized them for 1032pt.
  expect(first.width).toBeLessThan(
    adhkarTileDimensions(1032, gap).columnWidth - 100,
  );
  act(() => r!.unmount());
});

it('splits the width into two columns with one gap', () => {
  const {columnWidth, cardHeight, horizontalPadding} = adhkarTileDimensions(
    400,
    10,
  );
  expect(columnWidth * 2 + 10 + horizontalPadding * 2).toBeCloseTo(400);
  expect(cardHeight).toBeCloseTo((columnWidth * 2) / 3);
});

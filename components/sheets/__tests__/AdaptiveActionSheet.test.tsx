// @ai-generated
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

type SheetProps = {containerStyle?: unknown; id?: string};
const mockSheetProps: SheetProps[] = [];
jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    default: ReactActual.forwardRef((props: SheetProps, _ref: unknown) => {
      mockSheetProps.push(props);
      return null;
    }),
  };
});

const mockResponsive = {width: 393, isTablet: false};
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));

import ActionSheet, {
  SHEET_MAX_WIDTH,
  getSheetWidth,
} from '@/components/sheets/AdaptiveActionSheet';

const base = {backgroundColor: 'white', borderRadius: 12};

function render() {
  act(() => {
    TestRenderer.create(
      <ActionSheet id="surah-options" containerStyle={base} />,
    );
  });
  return mockSheetProps[mockSheetProps.length - 1];
}

it('passes the sheet style through untouched on phones', () => {
  Object.assign(mockResponsive, {width: 393, isTablet: false});
  const props = render();
  expect(props.containerStyle).toBe(base);
  expect(props.id).toBe('surah-options');
});

it('caps and keeps the sheet style on iPad', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  const props = render();
  expect(props.containerStyle).toEqual([base, {maxWidth: SHEET_MAX_WIDTH}]);
});

it('reports the width the sheet is drawn at', () => {
  expect(getSheetWidth(393, false)).toBe(393);
  expect(getSheetWidth(1032, true)).toBe(SHEET_MAX_WIDTH);
  // A narrow iPad window (Slide Over) is narrower than the cap.
  expect(getSheetWidth(320, true)).toBe(320);
});

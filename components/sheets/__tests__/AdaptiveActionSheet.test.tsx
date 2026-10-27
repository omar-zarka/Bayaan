// @ai-generated
import React from 'react';
import {StyleSheet, Text, View, type ViewStyle} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

type SheetProps = {
  containerStyle?: unknown;
  id?: string;
  gestureEnabled?: boolean;
  animated?: boolean;
  children?: React.ReactNode;
};
const mockSheetProps: SheetProps[] = [];
jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    default: ReactActual.forwardRef((props: SheetProps, _ref: unknown) => {
      mockSheetProps.push(props);
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.children,
      );
    }),
  };
});

jest.mock('@/utils/rtl', () => ({
  appLayoutDirection: {direction: 'ltr'},
  forceLTR: {direction: 'ltr'},
}));

const mockResponsive = {width: 393, isTablet: false};
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));

let mockTouch: {x: number; y: number} | null = null;
jest.mock('@/utils/lastTouch', () => ({
  getRecentTouch: () => mockTouch,
}));

import ActionSheet, {
  MENU_WIDTH,
  SHEET_MAX_WIDTH,
  getSheetWidth,
  placeMenu,
  toCardStyle,
  type TabletPresentation,
} from '@/components/sheets/AdaptiveActionSheet';

const base = {
  backgroundColor: 'white',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  borderTopWidth: 1,
  paddingTop: 8,
};

function render(tabletPresentation?: TabletPresentation) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ActionSheet
        id="surah-options"
        containerStyle={base}
        tabletPresentation={tabletPresentation}>
        <Text>options</Text>
      </ActionSheet>,
    );
  });
  const view: unknown = View;
  // The card is the view the sheet's own background color lands on.
  const card = renderer.root.findAll(
    node =>
      node.type === view &&
      StyleSheet.flatten(node.props.style)?.backgroundColor === 'white',
  )[0];
  return {
    sheet: mockSheetProps[mockSheetProps.length - 1],
    card: card ? (StyleSheet.flatten(card.props.style) as ViewStyle) : null,
  };
}

beforeEach(() => {
  mockTouch = null;
});

it('passes the sheet through untouched on phones', () => {
  Object.assign(mockResponsive, {width: 393, isTablet: false});
  const {sheet, card} = render('menu');
  expect(sheet.containerStyle).toBe(base);
  expect(sheet.id).toBe('surah-options');
  expect(sheet.gestureEnabled).toBeUndefined();
  expect(card).toBeNull();
});

it('shows a centered card capped at 560pt on iPad', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  const {sheet, card} = render();
  expect(sheet.id).toBe('surah-options');
  expect(sheet.gestureEnabled).toBe(false);
  expect(sheet.containerStyle).not.toBe(base);
  expect(card).toMatchObject({
    maxWidth: SHEET_MAX_WIDTH,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  });
  expect(card?.position).toBeUndefined();
});

it('floats a menu beside the tap that opened it', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  mockTouch = {x: 900, y: 400};
  const {sheet, card} = render('menu');
  expect(sheet.animated).toBe(false);
  // Hidden until it has been measured and placed.
  expect(card).toMatchObject({
    position: 'absolute',
    width: MENU_WIDTH,
    opacity: 0,
  });
});

it('falls back to a card when no recent tap opened the menu', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  const {card} = render('menu');
  expect(card).toMatchObject({maxWidth: SHEET_MAX_WIDTH});
  expect(card?.position).toBeUndefined();
});

describe('placeMenu', () => {
  const area = {width: 1032, height: 1300};
  const menu = {width: 340, height: 400};

  it('opens below the tap, away from the nearer side', () => {
    expect(placeMenu({x: 900, y: 300}, menu, area)).toEqual({x: 560, y: 308});
    expect(placeMenu({x: 100, y: 300}, menu, area)).toEqual({x: 100, y: 308});
  });

  it('opens above the tap when there is no room below', () => {
    expect(placeMenu({x: 900, y: 1100}, menu, area)).toEqual({
      x: 560,
      y: 692,
    });
  });

  it('stays clear of the edges', () => {
    expect(placeMenu({x: 1030, y: 2}, menu, area)).toEqual({x: 668, y: 24});
    expect(placeMenu({x: 5, y: 300}, menu, area)).toEqual({x: 24, y: 308});
    // Taller than the window: pinned to the top margin.
    expect(
      placeMenu({x: 100, y: 600}, {width: 340, height: 1400}, area).y,
    ).toBe(24);
  });
});

it('rounds every corner of a card and pads it for the missing handle', () => {
  expect(toCardStyle(base)).toMatchObject({
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    paddingTop: 20,
    paddingBottom: 16,
  });
});

it('reports the width the sheet is drawn at', () => {
  expect(getSheetWidth(393, false)).toBe(393);
  expect(getSheetWidth(1032, true)).toBe(SHEET_MAX_WIDTH);
  // A narrow iPad window (Slide Over) is narrower than the cap.
  expect(getSheetWidth(320, true)).toBe(320);
});

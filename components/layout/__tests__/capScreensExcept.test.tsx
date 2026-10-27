// @ai-generated
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {capScreensExcept} from '../MaxWidthContainer';

const mockResponsive = {isTablet: true};
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));

const layout = capScreensExcept(['index', 'browse-all']);

function render(routeName: string) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      layout({route: {name: routeName}, children: <Text>screen</Text>}),
    );
  });
  return renderer;
}

function columnWidths(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType(View)
    .map(view => StyleSheet.flatten(view.props.style)?.maxWidth)
    .filter(Boolean);
}

describe('capScreensExcept on tablets', () => {
  beforeEach(() => {
    mockResponsive.isTablet = true;
  });

  it('lets listed routes take the whole pane', () => {
    expect(columnWidths(render('browse-all'))).toEqual([]);
  });

  it('keeps other routes in the 720pt column', () => {
    expect(columnWidths(render('reciter/[id]'))).toEqual([720]);
  });
});

describe('capScreensExcept on phones', () => {
  it('leaves every route unwrapped', () => {
    mockResponsive.isTablet = false;
    expect(render('reciter/[id]').root.findAllByType(View)).toHaveLength(0);
    expect(render('index').root.findAllByType(View)).toHaveLength(0);
  });
});

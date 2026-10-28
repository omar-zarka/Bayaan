// @ai-generated
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {TabletSearchResults, groupResults} from '../TabletSearchResults';
import type {CatalogSearchResult} from '@/utils/search/catalog';
import type {Surah} from '@/data/surahData';
import type {Reciter} from '@/data/reciterData';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        textSecondary: '#666666',
        background: '#ffffff',
      },
      fonts: {bold: 'b', semiBold: 's', medium: 'm'},
    },
  }),
}));
jest.mock('@/components/SurahItem', () => {
  const {Text: MockText} = jest.requireActual('react-native');
  return {
    SurahItem: ({item}: {item: {name: string}}) => (
      <MockText testID="surah-row">{item.name}</MockText>
    ),
  };
});
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/i18n/format', () => ({
  getReciterDisplayName: (r: {name: string}) => r.name,
  getSurahDisplayName: (s: {name: string}) => s.name,
  getSurahMeaning: () => null,
  localizeDigits: (n: number) => String(n),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

const surah = (id: number): CatalogSearchResult => ({
  type: 'surah',
  item: {id, name: `Surah ${id}`, verses_count: 7} as unknown as Surah,
  score: 1,
});
const reciter = (id: string): CatalogSearchResult => ({
  type: 'reciter',
  item: {id, name: `Reciter ${id}`, rewayat: []} as unknown as Reciter,
  score: 1,
});

const results = [
  reciter('a'),
  surah(1),
  surah(2),
  reciter('b'),
  surah(3),
  surah(4),
  surah(5),
  surah(6),
];

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <TabletSearchResults
        results={results}
        onResultPress={jest.fn()}
        onSurahPlay={jest.fn()}
        bottomPadding={0}
      />,
    );
  });
  return renderer;
}

function surahRows(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll(n => n.props.testID === 'surah-row' && typeof n.type !== 'string')
    .map(n => n.props.children);
}

function texts(renderer: TestRenderer.ReactTestRenderer) {
  const text: unknown = Text;
  return renderer.root
    .findAll(n => n.type === text)
    .map(n => n.props.children)
    .flat();
}

function pressTab(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const tab = renderer.root.find(
    n =>
      n.props.accessibilityRole === 'tab' &&
      typeof n.props.onPress === 'function' &&
      typeof n.type !== 'string' &&
      n.findAll(c => c.props.children === label).length > 0,
  );
  act(() => tab.props.onPress());
}

describe('groupResults', () => {
  it('keeps rank order and puts the best hit on top', () => {
    const grouped = groupResults(results);
    expect(grouped.top).toBe(results[0]);
    expect(grouped.reciters.map(r => r.item.id)).toEqual(['a', 'b']);
    expect(grouped.surahs.map(r => r.item.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('TabletSearchResults', () => {
  it('shows the top result, four surahs and the other reciters in All', () => {
    const renderer = render();
    expect(texts(renderer)).toContain('search.topResult');
    expect(texts(renderer)).toContain('Reciter a');
    expect(surahRows(renderer)).toEqual([
      'Surah 1',
      'Surah 2',
      'Surah 3',
      'Surah 4',
    ]);
    // The top reciter is not repeated in the shelf.
    expect(texts(renderer).filter(s => s === 'Reciter a')).toHaveLength(1);
    expect(texts(renderer)).toContain('Reciter b');
  });

  it('lists every surah in the Surahs scope', () => {
    const renderer = render();
    pressTab(renderer, 'common:terms.surahs');
    expect(surahRows(renderer)).toHaveLength(6);
    expect(texts(renderer)).not.toContain('search.topResult');
  });

  it('lists every reciter in the Reciters scope', () => {
    const renderer = render();
    pressTab(renderer, 'common:terms.reciters');
    expect(surahRows(renderer)).toHaveLength(0);
    expect(texts(renderer)).toEqual(
      expect.arrayContaining(['Reciter a', 'Reciter b']),
    );
  });

  it('gives every surah row a play button', () => {
    const onSurahPlay = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TabletSearchResults
          results={[surah(1), surah(2)]}
          onResultPress={jest.fn()}
          onSurahPlay={onSurahPlay}
          bottomPadding={0}
        />,
      );
    });
    const plays = renderer.root.findAll(
      n =>
        n.props.accessibilityLabel === 'actions.play' &&
        typeof n.props.onPress === 'function',
    );
    // The top result card plus the one other surah row.
    expect(plays.length).toBeGreaterThanOrEqual(2);
    act(() => plays[plays.length - 1].props.onPress());
    expect(onSurahPlay).toHaveBeenCalledWith(
      expect.objectContaining({item: expect.objectContaining({id: 2})}),
    );
  });
});

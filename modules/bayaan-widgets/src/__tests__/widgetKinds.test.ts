// modules/bayaan-widgets/src/__tests__/widgetKinds.test.ts
import full from '../__fixtures__/snapshot.full.json';
import {changedWidgetKinds} from '../widgetKinds';
import {isWidgetSnapshot, WidgetSnapshot} from '../snapshot';

function base(): WidgetSnapshot {
  if (!isWidgetSnapshot(full)) throw new Error('fixture invalid');
  return structuredClone(full);
}

describe('changedWidgetKinds', () => {
  it('reports every kind on first write', () => {
    expect(changedWidgetKinds(null, base())).toHaveLength(6);
  });

  it('ignores position ticks while playing', () => {
    const prev = base();
    const next = base();
    next.generatedAt += 5_000;
    if (next.nowPlaying) next.nowPlaying.positionSec += 5;
    expect(changedWidgetKinds(prev, next)).toEqual([]);
  });

  it('reloads Continue Listening on pause', () => {
    const prev = base();
    const next = base();
    if (next.nowPlaying) next.nowPlaying.isPlaying = false;
    expect(changedWidgetKinds(prev, next)).toEqual(['ContinueListening']);
  });

  it('reloads Continue Reading only when last read changes', () => {
    const prev = base();
    const next = base();
    if (next.lastRead) next.lastRead.page = 294;
    expect(changedWidgetKinds(prev, next)).toEqual(['ContinueReading']);
  });

  it('theme change reloads everything', () => {
    const prev = base();
    const next = {...base(), theme: 'light' as const};
    expect(changedWidgetKinds(prev, next)).toHaveLength(6);
  });
});

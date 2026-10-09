// modules/bayaan-widgets/src/widgetKinds.ts
import {WidgetSnapshot} from './snapshot';

export type WidgetKind =
  | 'ContinueListening'
  | 'QuickSurah'
  | 'PinnedReciter'
  | 'AyahOfTheDay'
  | 'ContinueReading'
  | 'Tasbeeh';

export const ALL_WIDGET_KINDS: readonly WidgetKind[] = [
  'ContinueListening',
  'QuickSurah',
  'PinnedReciter',
  'AyahOfTheDay',
  'ContinueReading',
  'Tasbeeh',
];

// Position is excluded while playing: widgets animate it from
// generatedAt + positionSec, so ticks must not trigger reloads.
function nowPlayingKey(s: WidgetSnapshot): unknown {
  const np = s.nowPlaying;
  if (!np) return null;
  return {
    track: np.track,
    isPlaying: np.isPlaying,
    durationSec: Math.round(np.durationSec),
    pausedAt: np.isPlaying ? null : Math.round(np.positionSec),
  };
}

function sliceFor(kind: WidgetKind, s: WidgetSnapshot): unknown {
  switch (kind) {
    case 'ContinueListening':
      return [nowPlayingKey(s), s.upNext, s.recent, s.defaultReciter];
    case 'QuickSurah':
      return s.defaultReciter;
    case 'PinnedReciter':
      return s.reciterRecents;
    case 'AyahOfTheDay':
      return null;
    case 'ContinueReading':
      return s.lastRead;
    case 'Tasbeeh':
      return s.tasbeeh;
  }
}

export function changedWidgetKinds(
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
): WidgetKind[] {
  if (!prev || prev.theme !== next.theme) return [...ALL_WIDGET_KINDS];
  return ALL_WIDGET_KINDS.filter(
    kind =>
      JSON.stringify(sliceFor(kind, prev)) !==
      JSON.stringify(sliceFor(kind, next)),
  );
}

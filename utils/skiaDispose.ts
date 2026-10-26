type Disposable = {dispose: () => void};

/**
 * Dispose Skia objects (paragraphs, etc.) that a <Canvas> may still draw.
 *
 * With Reanimated installed, every Canvas redraw records on the JS thread and
 * queues the replay (`recorder.play`) onto the UI thread. A React effect
 * cleanup that disposes the previous paragraphs runs on the JS thread and can
 * win that race, so the queued replay touches a freed object and the app
 * aborts with "Attempted to access a disposed object" (Sentry BAYAAN-53).
 *
 * Scheduling the dispose on the UI thread puts it behind every replay (and
 * mapper stop) already queued there, so nothing draws a freed object.
 */
export function disposeAfterPendingDraws(
  ...objects: (Disposable | null | undefined)[]
): void {
  const live = objects.filter((o): o is Disposable => o != null);
  if (live.length === 0) return;
  try {
    // Required lazily: loading worklets throws where its native module is
    // missing (Jest), which the catch below handles.
    const {scheduleOnUI} =
      require('react-native-worklets') as typeof import('react-native-worklets');
    scheduleOnUI((items: Disposable[]) => {
      'worklet';
      for (const item of items) {
        item.dispose();
      }
    }, live);
  } catch {
    // No UI runtime: nothing can be mid-draw, dispose directly.
    for (const item of live) {
      item.dispose();
    }
  }
}

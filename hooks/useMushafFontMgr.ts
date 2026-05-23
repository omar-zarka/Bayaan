// Single source of truth for the Mushaf font manager in render code.
//
// Before: each Skia-rendering component called `useFonts(...)` with the
// surah-name TTFs as a "fallback" alongside reading the preloaded
// `mushafPreloadService.fontMgr`. The useFonts call ran on every mount
// even when the preload service was already initialized, and at first-
// render many <SurahDivider> instances would mount simultaneously and
// contend for typeface creation — surfacing as "Couldn't create typeface
// for SurahNameV4" exceptions captured by Sentry.
//
// This hook is the real fix. It reads `mushafPreloadService.fontMgr`
// synchronously and subscribes to preload completion so callers re-render
// when the preload finishes. AppInitializer awaits `mushafPreloadService
// .initialize()` before splash hides, so in practice the snapshot is
// already non-null on first render; the subscription is for the brief
// window between Skia component mount and preload completion when
// AppInitializer hasn't blocked yet (e.g. fast-mounted modals).

import {useSyncExternalStore} from 'react';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';

export function useMushafFontMgr(): SkTypefaceFontProvider | null {
  return useSyncExternalStore(
    listener => mushafPreloadService.subscribe(listener),
    () => mushafPreloadService.fontMgr,
    () => mushafPreloadService.fontMgr,
  );
}

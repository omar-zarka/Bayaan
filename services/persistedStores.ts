// @ai-generated
/**
 * Every persisted zustand store that a module exports, for the foreground
 * retry of a failed hydration (services/rehydrateOnForeground).
 *
 * The list lives here and not in utils/storage, because every store imports
 * utils/storage. Add each new persisted store; a test fails when a module that
 * calls `persist(` is not imported here.
 *
 * The default-reciter pick in store/reciterStore is persisted too, but that
 * store is private to its module, so a failed read of it lasts until the next
 * launch.
 */
import {useSettings} from '@/hooks/useSettings';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import type {PersistedStore} from '@/services/rehydrateOnForeground';
import {useAdhkarSettingsStore} from '@/store/adhkarSettingsStore';
import {useAmbientStore} from '@/store/ambientStore';
import {useAnalyticsConsentStore} from '@/store/analyticsConsentStore';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {usePlayCountStore} from '@/store/playCountStore';
import {useTafseerStore} from '@/store/tafseerStore';
import {useThemeStore} from '@/store/themeStore';

export const PERSISTED_STORES: readonly PersistedStore[] = [
  useSettings,
  useDownloadStore,
  useFavoriteRecitersStore,
  useLovedStore,
  usePlayerStore,
  useRecentlyPlayedStore,
  useAdhkarSettingsStore,
  useAmbientStore,
  useAnalyticsConsentStore,
  useDevSettingsStore,
  useMushafPlayerStore,
  useMushafSettingsStore,
  usePlayCountStore,
  useTafseerStore,
  useThemeStore,
];

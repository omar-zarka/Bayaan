import {
  requireOptionalNativeModule,
  type EventSubscription,
} from 'expo-modules-core';

export interface NativeBayaanWidgetsModule {
  writeSnapshot(json: string): void;
  reloadWidgets(kinds: string[]): void;
  takeQueuedCommands(): string;
  takePendingTasbeeh(): string;
  cacheArtwork(sourceUrl: string, fileName: string): Promise<boolean>;
  hasArtwork(fileName: string): boolean;
  addListener(
    event: 'onCommandQueued',
    listener: () => void,
  ): EventSubscription;
}

// null on web and in Jest
export const NativeBayaanWidgets: NativeBayaanWidgetsModule | null =
  requireOptionalNativeModule<NativeBayaanWidgetsModule>('BayaanWidgets');

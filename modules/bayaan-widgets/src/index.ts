import {NativeBayaanWidgets} from './NativeBayaanWidgets';
import type {WidgetSnapshot} from './snapshot';
import type {WidgetKind} from './widgetKinds';
import {parseQueuedCommands, type QueuedWidgetCommand} from './commands';
import type {WidgetCatalog} from './catalog';
import {
  EMPTY_ARTWORK_REQUESTS,
  parseArtworkRequests,
  type WidgetArtworkRequests,
} from './artworkRequests';
import {parsePendingTasbeeh, type PendingTasbeeh} from './tasbeeh';

export * from './snapshot';
export * from './commands';
export * from './tasbeeh';
export * from './widgetKinds';
export * from './catalog';
export * from './artworkRequests';
export * from './dayMath';
export * from './liveActivity';

export function isWidgetsAvailable(): boolean {
  return NativeBayaanWidgets !== null;
}

export function writeSnapshot(snapshot: WidgetSnapshot): void {
  NativeBayaanWidgets?.writeSnapshot(JSON.stringify(snapshot));
}

export function reloadWidgets(kinds: WidgetKind[]): void {
  if (kinds.length === 0) return;
  NativeBayaanWidgets?.reloadWidgets(kinds);
}

export function takeQueuedCommands(): QueuedWidgetCommand[] {
  if (!NativeBayaanWidgets) return [];
  return parseQueuedCommands(NativeBayaanWidgets.takeQueuedCommands());
}

export function takePendingTasbeeh(): PendingTasbeeh[] {
  if (!NativeBayaanWidgets) return [];
  return parsePendingTasbeeh(NativeBayaanWidgets.takePendingTasbeeh());
}

export async function cacheArtwork(
  sourceUrl: string,
  fileName: string,
): Promise<boolean> {
  if (!NativeBayaanWidgets) return false;
  return NativeBayaanWidgets.cacheArtwork(sourceUrl, fileName);
}

export function hasArtwork(fileName: string): boolean {
  return NativeBayaanWidgets?.hasArtwork(fileName) ?? false;
}

export function writeCatalog(catalog: WidgetCatalog): void {
  NativeBayaanWidgets?.writeCatalog(JSON.stringify(catalog));
}

export function readArtworkRequests(): WidgetArtworkRequests {
  if (!NativeBayaanWidgets) return EMPTY_ARTWORK_REQUESTS;
  return parseArtworkRequests(NativeBayaanWidgets.readArtworkRequests());
}

export function addWidgetCommandListener(listener: () => void): {
  remove: () => void;
} {
  if (!NativeBayaanWidgets) return {remove: () => undefined};
  const sub = NativeBayaanWidgets.addListener('onCommandQueued', listener);
  return {remove: () => sub.remove()};
}

// services/widgets/enabledWidgets.ts
// Which native widget surfaces this build ships (RFC-021), so the sync code
// can skip work for widgets a fork compiled out or hid from the picker.
import branding from '@/config/branding';
import {featureFlags} from '@/config/featureFlags';
import {
  resolveNativeWidgets,
  type NativeWidgetFeatures,
  type NativeWidgetId,
} from '@/config/nativeWidgets';

const resolved = resolveNativeWidgets(branding.widgets, featureFlags);
const enabled = new Set<NativeWidgetId>(resolved.enabled);

export const widgetFeatures: Readonly<NativeWidgetFeatures> = resolved.features;

export function isWidgetEnabled(id: NativeWidgetId): boolean {
  return enabled.has(id);
}

/** The kinds that ship, in their original order. */
export function enabledKinds<K extends NativeWidgetId>(
  kinds: readonly K[],
): K[] {
  return kinds.filter(kind => enabled.has(kind));
}

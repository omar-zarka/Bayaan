/**
 * RFC-018 — default-noop inline community-reflections slot.
 *
 * This upstream component is the mount-site wrapper for the
 * `branding.ayahCommunityReflectionsComponent` render slot. `VerseItem`
 * mounts it unconditionally under the Arabic line; when no fork supplies a
 * component (Bayaan default) it returns `null`, so the mount is free.
 *
 * It honors the three hot-path requirements from the RFC review:
 *
 *  1. Provider<->component coupling: this wrapper does NOT fetch. The fork's
 *     component owns the provider call (`branding.communityReflectionsProvider`)
 *     and its caching, so there's no double-fetch — the wrapper only decides
 *     whether to mount and passes `{surahNumber, ayahNumber}`.
 *  2. Toggle gate: renders nothing unless the user's
 *     `MushafSettingsStore.showCommunityReflections` is on AND a provider is
 *     wired. Subscribing to the toggle here keeps `VerseItem`'s memo deps lean.
 *  3. Recycling safety: the fork's slot does per-ayah I/O on a recycling
 *     FlashList, so it's wrapped in a SILENT error boundary — a provider/render
 *     throw renders nothing instead of crashing the row or showing an error
 *     card per ayah.
 *
 * See docs/rfcs/018-community-reflections-provider.md.
 */

import React, {Component, type ErrorInfo, type ReactNode} from 'react';
import branding from '@/config/branding';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

interface AyahCommunityReflectionsProps {
  surahNumber: number;
  ayahNumber: number;
}

interface SilentBoundaryState {
  hasError: boolean;
}

/**
 * Per-ayah silent error boundary. Unlike the app-level `ErrorBoundary`
 * (which renders a visible "there was an error" view), a failure inside a
 * recycling verse row must render NOTHING — a visible error card on a single
 * ayah would be worse than the bug it guards. Resets `hasError` when the
 * ayah it wraps changes so a recycled cell isn't stuck in the error state.
 */
class SilentReflectionsBoundary extends Component<
  {verseKey: string; children: ReactNode},
  SilentBoundaryState
> {
  public state: SilentBoundaryState = {hasError: false};

  public static getDerivedStateFromError(): SilentBoundaryState {
    return {hasError: true};
  }

  public componentDidUpdate(prevProps: {verseKey: string}) {
    if (prevProps.verseKey !== this.props.verseKey && this.state.hasError) {
      this.setState({hasError: false});
    }
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.warn(
        '[AyahCommunityReflections] slot threw, rendering nothing:',
        error,
        info,
      );
    }
  }

  public render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function AyahCommunityReflections({
  surahNumber,
  ayahNumber,
}: AyahCommunityReflectionsProps) {
  const showCommunityReflections = useMushafSettingsStore(
    s => s.showCommunityReflections,
  );

  const SlotComponent = branding.ayahCommunityReflectionsComponent;

  // Bayaan default: no component wired → free no-op. Also gated on the
  // provider being present (a fork could ship a component but no data) and
  // the user's opt-in toggle.
  if (!SlotComponent) return null;
  if (!branding.communityReflectionsProvider) return null;
  if (!showCommunityReflections) return null;

  return (
    <SilentReflectionsBoundary verseKey={`${surahNumber}:${ayahNumber}`}>
      <SlotComponent surahNumber={surahNumber} ayahNumber={ayahNumber} />
    </SilentReflectionsBoundary>
  );
}

AyahCommunityReflections.displayName = 'AyahCommunityReflections';

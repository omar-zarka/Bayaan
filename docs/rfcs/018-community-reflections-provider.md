# RFC-018: Community-reflections provider + render-slot seams

| Field  | Value                    |
| ------ | ------------------------ |
| Status | Proposed                 |
| Date   | 2026-06-01               |
| Author | Omar Zarka (Qariah fork) |

## Summary

Add two optional, paired `Branding` slots so a fork can surface community-authored reflections on an ayah without forking the verse-render path:

1. `communityReflectionsProvider?: (surahNumber, ayahNumber, locale?) => Promise<CommunityReflection[]>` — a data fetcher returning verified, popular reflections for one ayah.
2. `ayahCommunityReflectionsComponent?: ComponentType<{surahNumber, ayahNumber}>` — an optional render slot (RFC-008 pattern) mounted under the Arabic line in the player Mushaf list, gated behind a new `MushafSettingsStore.showCommunityReflections` toggle.

When both are unset (Bayaan's default), nothing renders, no toggle row appears, and there is zero behavior change. This is the fifth entry in the XF-NNN multi-tenancy series (RFC-007 `Branding`/`CatalogProvider`, RFC-008 `listenTabTopComponent`, RFC-009 translation/tafsir providers, RFC-013 `initialPlayerVerseKey`).

## Motivation

The Qariah fork ships an inline "Community Reflections" surface: under each ayah's Arabic line in the player Mushaf, an opt-in toggle shows the single top verified, popular reflection sourced from QuranReflect (with a "View N more" deep link), plus a fullscreen popup from the verse long-press action sheet. It is live in production and validated.

To do this Qariah currently diverges on three hot, high-churn files:

- `components/player/v2/PlayerContent/QuranView/VerseItem.tsx` — mounts the inline subcomponent under the Arabic line.
- `components/sheets/VerseActionsSheet.tsx` — adds a "Community Reflections" EXPLORE row + popup screen.
- `store/mushafSettingsStore.ts` + `components/MushafSettingsContent.tsx` — the opt-in toggle.

Plus two Qariah-only files (the inline subcomponent + the QuranReflect service wrapper). The *data source* (QuranReflect) and the *content* are fork-specific, but the **integration points** — "fetch reflections for this ayah" and "render something under the Arabic line" — are generic. Any Bayaan-derived fork wiring its own community-content backend (QuranReflect, Tafsirly, a self-hosted comment service, …) hits the same three integration points and would re-introduce the same divergence on every upstream merge of `VerseItem.tsx` / `VerseActionsSheet.tsx` — both of which change frequently upstream.

This is the same divergence shape RFC-009 resolved for translation/tafsir sources and RFC-008 for the Listen-tab top region: the concrete source/content is fork-specific; the consumer-side hook is small and stable; a provider + render-slot seam makes it pluggable without forks maintaining parallel copies of hot files.

## Decision

### 1. `CommunityReflection` type + provider interface

```ts
// types/CommunityReflection.ts
export interface CommunityReflection {
  id: string;
  author: {name: string; handle: string; verified: boolean};
  body: string;
  likesCount: number;
  commentsCount: number;
  publishedAt: string; // ISO-8601
  url: string; // canonical permalink on the source platform
  language: string; // BCP-47-ish, e.g. 'en', 'ar'
}

export type CommunityReflectionsProvider = (
  surahNumber: number,
  ayahNumber: number,
  locale?: string, // user's translation preference; provider may combine `${locale},en`
) => Promise<CommunityReflection[]>;
```

The provider resolves to an array (possibly empty) of reflections for one ayah. It is the provider's job to filter/sort (Qariah's impl returns verified-only, popular-sorted, top-N, language-filtered). Throws/rejects on network or auth/scope errors; the consuming component renders an empty/error state silently. The caller may invoke it freely — caching is the provider's responsibility.

### 2. Branding slots (additive)

```ts
// config/branding.d.ts
import type {ComponentType} from 'react';
import type {CommunityReflectionsProvider} from '@/types/CommunityReflection';

export interface Branding {
  // …existing fields…

  /**
   * Optional fetcher for community-authored reflections on an ayah.
   * `undefined` (Bayaan default) → the entire community-reflections
   * surface is off (no toggle row, no inline render).
   */
  communityReflectionsProvider?: CommunityReflectionsProvider;

  /**
   * Optional render slot (RFC-008 pattern) mounted under the Arabic
   * line in the player Mushaf list when the user's
   * `showCommunityReflections` toggle is on. `undefined` → nothing
   * renders even if `communityReflectionsProvider` is set (a fork can
   * supply data without UI, e.g. to power only the action-sheet popup).
   */
  ayahCommunityReflectionsComponent?: ComponentType<{
    surahNumber: number;
    ayahNumber: number;
  }>;
}
```

### 3. Default no-op render + the gated toggle

Upstream ships a default-noop `<AyahCommunityReflections />` that returns `null` when `branding.ayahCommunityReflectionsComponent` is unset. `VerseItem.tsx` mounts it unconditionally under the Arabic line; the noop makes that free for Bayaan.

`MushafSettingsStore` gains `showCommunityReflections: boolean` (default `false`); `MushafSettingsContent` renders the toggle row **only when `branding.communityReflectionsProvider != null`** — so Bayaan shows no orphan toggle. `VerseItem` gates the render on `branding.communityReflectionsProvider && showCommunityReflections`.

### 4. Action-sheet entry (optional, same gate)

`VerseActionsSheet` adds a "Community Reflections" EXPLORE row gated on `branding.communityReflectionsProvider && !isRange`, opening a fullscreen list that reuses the same provider. This is the same gating predicate; no new seam.

## Backwards compatibility

None broken. With both fields unset (Bayaan default): the toggle row never renders, `<AyahCommunityReflections />` returns `null`, the action-sheet row is hidden, and `MushafSettingsStore.showCommunityReflections` is inert. `VerseItem` mounts one extra component that immediately returns `null` — negligible. No store migration (the new boolean defaults `false`).

## Alternatives considered

### Alt 1 — Keep it fork-only (status quo)

Forks fork `VerseItem.tsx` + `VerseActionsSheet.tsx` + the settings store/screen.

**Rejected.** `VerseItem.tsx` and `VerseActionsSheet.tsx` are two of the highest-churn files in the player. A fork carrying a render insertion in each lands on the merge-conflict list every sprint — exactly the cost RFC-008/009 exist to remove.

### Alt 2 — Data provider only, no render slot

Ship `communityReflectionsProvider` but let forks fork `VerseItem.tsx` to render it.

**Rejected.** The render insertion point *is* the expensive divergence (it's in the hot file). A data-only seam leaves the worst conflict in place. Pairing the two — provider + render slot — is what collapses the divergence to config-only, the same way RFC-008 paired the Listen-tab slot with its props type.

### Alt 3 — Generic "ayah annotation slot" array

A general `branding.ayahSlots?: ComponentType<{surahNumber, ayahNumber}>[]` that forks fill with arbitrary per-ayah widgets.

**Rejected as premature.** Tempting, but there's exactly one concrete consumer today. A generic slot array needs ordering/keying/layout-arbitration semantics that no current need exercises. If a second per-ayah widget surfaces, generalize then. (Same reasoning RFC-009 used to reject the generic `ContentEditionProvider<T>`.)

### Alt 4 — Bake QuranReflect into Bayaan

Bayaan ships a QuranReflect client and a `branding.communityReflectionsSourceId: 'quranreflect' | …` enum.

**Rejected** for the same reason RFC-008/009 rejected their string-enum alternatives: it puts fork-specific client + auth code permanently in Bayaan source. Qariah's impl needs QF `client_credentials` token plumbing that Bayaan has no reason to carry.

## Consequences

**Positive**
- A fork wires community content via two `config/branding.js` fields + its own provider/component; no fork of `VerseItem.tsx`, `VerseActionsSheet.tsx`, or the settings files.
- Matches RFC-008's component-slot pattern + RFC-009's provider pattern — no new concept.
- Zero behavior change + zero new UI for Bayaan.

**Neutral**
- One new type file, one default-noop component, one boolean on `MushafSettingsStore`, one gated toggle row.

**Negative / risks**
- `ayahCommunityReflectionsComponent` is a "live component in config" field — same precedent as RFC-008's `listenTabTopComponent` (now an established convention).
- The provider interface commits to a per-ayah request shape. If a fork needs batch/prefetch, it extends additively. v1 stays minimal (one ayah per call) — caching is provider-internal.

## How we'll know it worked

- `npx tsc --noEmit` clean after the implementation PR with both fields unset.
- Bayaan's Mushaf renders byte-identically to `develop` (no toggle row, no inline element).
- A fork sets both branding fields + ships its provider/component and the inline reflection renders under the Arabic line + the action-sheet row appears, without modifying any file present in `develop`.
- Qariah's divergence-ledger rows for `VerseItem.tsx` / `VerseActionsSheet.tsx` / `mushafSettingsStore.ts` / `MushafSettingsContent.tsx` flip to "Upstreamed (RFC-018)" and the fork's diff against `upstream/develop` for those paths drops to zero.

## Open questions

1. **Toggle home.** `showCommunityReflections` lives on `MushafSettingsStore` alongside translation/transliteration toggles. Reasonable, but reviewers may prefer a dedicated store or a `branding`-driven default for the initial value. Defaulting `false` matches the translation/transliteration opt-in pattern.
2. **Render-slot props.** v1 passes `{surahNumber, ayahNumber}` only. A future need (theme context, an `onOpenPopup` callback) would be an additive optional prop. Flagging so the prop shape can be bikeshed now rather than later.
3. **Naming.** `communityReflectionsProvider` / `ayahCommunityReflectionsComponent` vs. a shorter `reflectionsProvider`. Matched the descriptive style of `listenTabTopComponent`. Open to bikeshedding.

## Implementation plan

This is a doc-only RFC. If accepted:

1. **Code PR — Bayaan side (~120 LOC):** add `types/CommunityReflection.ts`; add the two `Branding` fields; add the default-noop `<AyahCommunityReflections />`; mount it in `VerseItem.tsx` under the Arabic line gated on the provider + toggle; add `showCommunityReflections` to `MushafSettingsStore` + the gated toggle row in `MushafSettingsContent`; add the gated EXPLORE row + popup shell in `VerseActionsSheet.tsx`. Bayaan branding leaves both fields unset; behavior unchanged.
2. **Code PR — Qariah side (qariah-v2 repo):** ship the QuranReflect-backed provider + the inline component, set both branding fields. Qariah's ledger rows for the four hot files flip to "Upstreamed (RFC-018)".

If the maintainer prefers Alt 2 (data-only), Alt 3 (generic slot array), or Alt 4 (baked-in source), this RFC is withdrawn and a new one opens with the preferred shape.

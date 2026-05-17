# RFC-009: Translation provider seam

| Field  | Value                    |
| ------ | ------------------------ |
| Status | Proposed                 |
| Date   | 2026-05-16               |
| Author | Omar Zarka (Qariah fork) |

## Summary

Add an optional `Branding.translationProvider?: TranslationProvider` slot so forks can supply their own translation source for the Settings → Translations download flow. Bayaan's default behavior is unchanged when the slot is empty (the existing alQuran.cloud-backed implementation stays the default). The SQLite cache layer that already wraps `translationApiService` does not move and does not change shape; it wraps the resolved provider exactly as it wraps the current concrete service.

This RFC is the third in the XF-NNN multi-tenancy series, following RFC-007 (the `Branding` interface itself) and RFC-008 (`branding.listenTabTopComponent`). It targets the only translation-source seam in the app.

## Motivation

`services/translation/TranslationApiService.ts` hardcodes `https://api.alquran.cloud/v1` at line 3 and uses it directly in `fetchAvailableEditions` (line 48) and `fetchFullTranslation` (line 68). The module exports a single `translationApiService` singleton (line 101), consumed today only by `store/translationStore.ts:33` (via `fetchFullTranslation`) — a small, well-defined surface.

alQuran.cloud is a third-party aggregator. Forks that prefer a different translation source — for example, the QF-aligned forks pointing at `apis.quran.foundation`'s `/translations` endpoint — currently have to fork this entire file to change the base URL and the response-shape mapping. That puts the file on the weekly merge-conflict list even though the *consumer surface* (`fetchAvailableEditions` + `fetchFullTranslation`) hasn't actually changed.

This is the same divergence shape RFC-007 resolved for the catalog (`CatalogProvider`): the concrete data source is hardcoded; the interface the rest of the app needs is small and stable; a provider seam makes the source swappable without forcing forks to maintain a parallel copy of the service file.

Concrete cost today: every Bayaan change to `TranslationApiService.ts` (e.g. the recent `direction`-default fallback at lines 92–95) creates a merge conflict for any fork that has swapped the base URL, even when the change is orthogonal to the source choice.

## Decision

### 1. New `TranslationProvider` interface

Mirror the `CatalogProvider` shape from RFC-007 (`types/CatalogProvider.ts`). The interface exposes only what `store/translationStore.ts` and `services/translation/TranslationApiService.ts`'s current call sites need:

```ts
// types/TranslationProvider.ts
import type {RemoteTranslationEdition} from '@/types/translation';
import type {TranslationVerse} from '@/services/translation/TranslationApiService';

export interface TranslationProvider {
  /** Lists every translation edition the provider can serve. */
  fetchAvailableEditions(): Promise<RemoteTranslationEdition[]>;

  /**
   * Fetches every verse for one edition. Progress callback fires at
   * surah granularity (0..1). The returned `edition` object MUST have
   * `direction` set (provider is responsible for defaulting it if the
   * upstream API omits it — see the RTL fallback at
   * `TranslationApiService.ts:92-95`).
   */
  fetchFullTranslation(
    editionId: string,
    onProgress?: (progress: number) => void,
  ): Promise<{
    edition: RemoteTranslationEdition;
    verses: TranslationVerse[];
  }>;
}
```

`TranslationVerse` already exists at `TranslationApiService.ts:39-44`; it would move to `types/translation.ts` alongside `RemoteTranslationEdition` as part of the implementation PR (mechanical re-export; no behavior change).

### 2. Branding slot

```ts
// config/branding.d.ts (additive)
import type {TranslationProvider} from '@/types/TranslationProvider';

export interface Branding {
  // …existing fields…

  /**
   * Optional translation source. `undefined` keeps Bayaan's default
   * (the alQuran.cloud-backed `AlQuranCloudTranslationProvider`).
   */
  translationProvider?: TranslationProvider;
}
```

### 3. Default implementation

The current `TranslationApiService` class body is extracted verbatim into `services/translation/AlQuranCloudTranslationProvider.ts` and exported as `alQuranCloudTranslationProvider`. The exported singleton `translationApiService` becomes a thin resolver:

```ts
// services/translation/TranslationApiService.ts (post-refactor)
import branding from '@/config/branding';
import {alQuranCloudTranslationProvider} from './AlQuranCloudTranslationProvider';

export const translationApiService =
  branding.translationProvider ?? alQuranCloudTranslationProvider;
```

The exported name and type stay the same, so `store/translationStore.ts:33` and any future consumer don't change.

### 4. Cache layer (non-change)

The SQLite cache layer that persists downloaded translations sits *outside* `TranslationApiService` (in the store + DB layer). It is not part of the provider contract and does not move. The provider returns in-memory verses; the cache wraps the provider call exactly as it wraps the current concrete service. This mirrors how RFC-007's `CatalogProvider` left the catalog-cache layer untouched.

## Backwards compatibility

None broken. With `branding.translationProvider` unset (Bayaan's default), the exported `translationApiService` resolves to `alQuranCloudTranslationProvider`, which is the current class body extracted unchanged. The base URL, response shapes, RTL-language fallback, progress callback semantics, and error messages are all preserved verbatim. `store/translationStore.ts` does not change.

## Alternatives considered

### Alt 1 — Leave forks to monkey-patch or copy the file

Forks fork `TranslationApiService.ts` wholesale and edit the URL + response mapping.

**Rejected.** This is the status quo and it's exactly the problem. The file lands on the weekly merge-conflict list permanently. Any Bayaan-side improvement to translation handling (e.g. the recent `direction` fallback) collides with the fork's edits even though the changes are orthogonal.

### Alt 2 — Ship a multi-provider mux upstream

Bayaan-side code knows about both alQuran.cloud and QF (and any future provider), and a `branding.translationProviderId: 'alquran-cloud' | 'qf' | …` enum selects between them.

**Rejected** for the same reason RFC-008 rejected its string-enum alternative: it conflates fork code with Bayaan-source code. Bayaan would either carry QF-specific client code permanently (even for users who never call it) or leave the enum value as a no-op outside QF-aligned forks. The whole point of the seam is that fork-specific source choices live in the fork.

### Alt 3 — Just swap the default to QF upstream

Replace alQuran.cloud as Bayaan's default with QF.

**Rejected.** This is a fork's motivation, not a Bayaan-side reason to switch defaults. alQuran.cloud has served Bayaan reliably and its edition list is broader in some languages. Default-switching is a Bayaan product decision orthogonal to multi-tenancy and not something this RFC should drive. The seam is neutral: if Bayaan later decides to switch defaults, it sets `branding.translationProvider` to a `QfTranslationProvider` in its own `config/branding.js`. Same machinery.

## Consequences

**Positive**
- Forks override translation source via one field in `config/branding.js`; no fork of `TranslationApiService.ts`.
- Pattern matches RFC-007 (`CatalogProvider`) exactly — no new architectural concept to learn.
- Zero behavior change for Bayaan; the default resolution path returns the same singleton it does today.

**Neutral**
- Adds one new file (`types/TranslationProvider.ts`) and one renamed file (`AlQuranCloudTranslationProvider.ts`). `TranslationApiService.ts` collapses to ~5 lines (the resolver).
- `TranslationVerse` moves from `services/translation/TranslationApiService.ts` to `types/translation.ts`; existing imports update mechanically.

**Negative / risks**
- The interface commits Bayaan to a specific provider contract. If a future provider needs (e.g.) pagination, async edition discovery, or per-verse streaming, the interface needs extension. Mitigation: keep v1 minimal — only the two methods `store/translationStore.ts` actually calls today — and extend additively when a concrete need surfaces. This is the same trade-off RFC-007's `CatalogProvider` made.
- `TranslationProvider` as `branding.translationProvider` is a "live code in config" pattern, the same one RFC-008's `listenTabTopComponent` introduces. Consistent with RFC-008 and a single precedent now applies to both.

## How we'll know it worked

- `npx tsc --noEmit` from repo root produces no new errors after the implementation PR.
- `store/translationStore.ts:33` works unchanged; downloading a translation from Settings → Translations produces byte-identical SQLite rows to `develop` baseline when `branding.translationProvider` is unset.
- A fork can set `branding.translationProvider = qfTranslationProvider` and downloading a translation works without modifying any file present in `develop`.
- Qariah's eventual divergence ledger row for `services/translation/TranslationApiService.ts` reads "Upstreamed (RFC-009)" and the fork's diff against `upstream/develop` for this path drops to zero.

## Open questions

1. **Rate limits / auth.** alQuran.cloud is anonymous. QF's `/translations` may require an OAuth app token even for read-only access. The provider interface treats this as a provider-internal concern (the QF provider holds its own credential), but Bayaan-side documentation should note that fork-supplied providers may carry their own auth lifecycle. Not blocking for this RFC.

2. **Should the SQLite cache key include the provider id?** Today the cache key is `editionId` alone. If two providers ever serve the same `editionId` with different content (unlikely — `editionId` is provider-namespaced in practice), the cache could serve stale rows across a provider swap. Probably not worth solving until a real conflict shows up; flag here so reviewers can weigh in.

3. **Naming.** `TranslationProvider` vs `TranslationSource` vs `TranslationApi`. Matched `CatalogProvider` naming from RFC-007 for consistency. Open to bikeshedding.

## Implementation plan

This is a doc-only RFC. If accepted:

1. **Code PR #1 (Bayaan side):** add `types/TranslationProvider.ts`, move `TranslationVerse` to `types/translation.ts`, extract `AlQuranCloudTranslationProvider.ts`, collapse `TranslationApiService.ts` to the resolver, add the optional `translationProvider` field to `Branding`. Default Bayaan branding leaves the field unset; behavior unchanged. ~80 lines diff.

2. **Code PR #2 (Qariah-side, in qariah-v2 repo):** add `services/translation/QfTranslationProvider.ts` implementing the interface against `apis.quran.foundation/v4/translations`, set `branding.translationProvider: qfTranslationProvider` in `config/branding.js`. Qariah's divergence ledger row for `TranslationApiService.ts` flips from "would-be Local" to "Upstreamed".

If the maintainer prefers Alt 2 (multi-provider mux) or Alt 3 (swap default), this RFC is withdrawn and a new one opens with the preferred shape.

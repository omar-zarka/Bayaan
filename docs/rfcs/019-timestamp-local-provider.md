# RFC-019: Bundled timestamp provider seam (`branding.timestampLocalProvider`)

**Status:** Draft (doc-first — the consumer touches the timestamp fetch
hot-path in three methods, so the shape is worth confirming before code lands;
code PR follows on shape approval).
**Authors:** Omar Zarka (Qariah)
**Targets:** `thebayaan/Bayaan` `develop`
**Related:** RFC-015 (`branding.timestampCdnBase`, merged) — the read-side CDN
seam this RFC complements; PR `thebayaan/Bayaan#278` (timestamps R2 mirror).

> **RFC numbering:** 017 (server-driven config envelope, PR #291) and 018
> (community-reflections provider, PR #299) are already claimed by open PRs, so
> this RFC takes **019**.

---

## Summary

`TimestampFetchService` resolves ayah-timing data for the Mushaf follow-along
highlight exclusively over the network — `fetchAndCache` builds an R2 URL and
`fetch`es it. A fork that ships **bundled** ayah-timing data for one of its own
reciters (timings authored offline, baked into the app rather than served from
a CDN) has no seam to plug that into the fetch service: the only way to make
`hasSource` / `hasSurah` / `fetchAndCache` aware of a locally-provided dataset
is to shadow the whole file.

This RFC adds an optional
`branding.timestampLocalProvider?: (rewayatId, surahNumber) => AyahTimestamp[] | null`.
When set, the three consumer methods consult it before going to the network;
when unset (Bayaan's default), an inline `?? null` coalesce makes every path
byte-identical to today. The `'local'` `TimestampSource` already exists in the
upstream schema — this RFC just gives a fork a supported way to reach it.

---

## Motivation

A fork that bundles its own timing data today has three options, all bad:

1. **Shadow `TimestampFetchService.ts`.** This is the status quo for Qariah,
   and it is the exact problem the cross-fork seam work (RFC-007 onward) exists
   to retire. The file changes upstream (RFC-015 reworked `R2_BASE` and added a
   JSON-shape guard; PR #278 rewrote it wholesale), and every such change
   silently drops the fork's local-provider branch on the next absorption —
   the follow-along highlight then goes dark for that reciter until someone
   notices and re-applies the divergence by hand.
2. **Mirror the bundled timings to a CDN anyway** (combine with RFC-015's
   `timestampCdnBase`). Works, but forces a network round-trip and an R2 bucket
   for data the fork already has on disk — and the timings are unavailable
   offline, which defeats the point of bundling them.
3. **Branch on a fork flag inside the service.** An `if (isQariah) …`
   conditional is the anti-pattern RFC-015 already rejected; every new fork
   balloons it.

A single optional config field — symmetric with RFC-015's read-side seam —
absorbs all forks at the three consumer call sites.

### Why now

The upstream schema **already** carries the destination this RFC unlocks:
`type TimestampSource = 'r2' | 'local'` (`types/timestamps.ts`) and
`TimestampDatabaseService.writeTimestamps(..., source: TimestampSource)` both
accept `'local'`. The only thing missing is a supported way for a fork to feed
locally-authored timings into the resolver — today that requires shadowing the
file. Filing this now so the seam lands before the next wholesale rewrite of
`TimestampFetchService` drops a fork's local branch again.

The shape mirrors RFC-015 (read-side CDN base) and RFC-009/RFC-018 (nullable
provider functions on `branding`), so a second fork can reuse it with no
coordination overhead.

---

## Proposed change

### `config/branding.d.ts` addition

```typescript
import type {AyahTimestamp} from '@/types/timestamps';

export interface Branding {
  // ... existing fields ...

  /**
   * Optional provider for **bundled** ayah-timing data, for forks that ship
   * their own offline-authored timestamps for a reciter rather than serving
   * them from a CDN (see `timestampCdnBase`, RFC-015).
   *
   * Called by `TimestampFetchService` before any network fetch. Return the
   * surah's timestamps (written to the cache with source `'local'`), or
   * `null` to fall through to the existing R2/CDN path.
   *
   * Field absent → consumer applies `?? null` at each call site →
   * byte-equivalent to today's behavior (network-only resolution).
   *
   * Must be synchronous and side-effect-free; it runs inside `hasSource`,
   * `hasSurah`, and `fetchAndCache`. Read bundled data from a module-level
   * import, not I/O.
   */
  timestampLocalProvider?: (
    rewayatId: string,
    surahNumber: number,
  ) => AyahTimestamp[] | null;
}
```

### `config/branding.js` (Bayaan default)

Field omitted. The `?? null` fallback at each consumer site preserves Bayaan's
behavior verbatim. **Zero diff** to `config/branding.js` in the Bayaan
distribution.

### `services/timestamps/TimestampFetchService.ts` (the only code diff)

The provider is consulted in the three resolution methods, each falling through
to today's logic when the provider is unset or returns `null`. Sketch:

```diff
 import branding from '@/config/branding';
 import {RECITERS, type Rewayat} from '@/data/reciterData';
 import {timestampDatabaseService} from './TimestampDatabaseService';
 import type {AyahTimestamp} from '@/types/timestamps';

 class TimestampFetchService {
   hasSource(rewayatId: string): boolean {
+    // A fork-bundled provider counts as a source. `?? null` keeps Bayaan's
+    // behavior identical when the field is unset.
+    if (branding.timestampLocalProvider) {
+      // Cheap presence check — surah 1 is the conventional probe; a provider
+      // returns null for rewayat it doesn't cover.
+      if ((branding.timestampLocalProvider(rewayatId, 1) ?? null) !== null) {
+        return true;
+      }
+    }
     const rw = this.findRewayat(rewayatId);
     return Boolean(rw?.has_timestamps);
   }

   hasSurah(rewayatId: string, surahNumber: number): boolean {
+    if (
+      (branding.timestampLocalProvider?.(rewayatId, surahNumber) ?? null) !==
+      null
+    ) {
+      return true;
+    }
     const rw = this.findRewayat(rewayatId);
     // ... unchanged ...
   }

   async fetchAndCache(
     rewayatId: string,
     surahNumber: number,
   ): Promise<AyahTimestamp[] | null> {
+    const local = branding.timestampLocalProvider?.(rewayatId, surahNumber) ?? null;
+    if (local && local.length > 0) {
+      await timestampDatabaseService.writeTimestamps(
+        rewayatId,
+        surahNumber,
+        local,
+        'local',
+      );
+      return local;
+    }
     if (!this.hasSurah(rewayatId, surahNumber)) return null;
     // ... unchanged R2 fetch ...
   }
 }
```

The exact probe shape (especially `hasSource`'s surah-1 presence check) is the
main thing this doc-first RFC is asking the maintainer to confirm — see Open
question 1. Total upstream diff is one branding type + three guarded early-outs
in `TimestampFetchService` (plus a one-line import for `AyahTimestamp` in
`branding.d.ts`). No new files, no new infrastructure.

---

## Migration / default behavior

**Bayaan:** no change. Field absent → every `?? null` short-circuits → the R2
fetch path runs exactly as today. Byte-equivalent; zero action required.

**Forks opting in:** declare `timestampLocalProvider` once in
`config/branding.js`, returning the bundled timings for the rewayat they
authored and `null` for everything else. The cache stores them with source
`'local'` (already a valid `TimestampSource`), so the rest of the highlight
pipeline is unchanged.

---

## Open questions

1. **`hasSource` presence-probe shape.** `hasSource` takes only a `rewayatId`,
   but the provider is keyed by `(rewayatId, surahNumber)`. The sketch probes
   surah 1 to decide "does this rewayat have any local coverage." Alternatives:
   (a) widen the provider to also expose a `hasRewayat(rewayatId)` or a surah
   list, or (b) add a separate `branding.timestampLocalSurahList?: (rewayatId)
   => number[] | null`. The single-function shape is the smallest surface;
   happy to split if the probe feels too implicit.

2. **Sync vs async provider.** This RFC specifies a **synchronous** provider
   (the methods `hasSource`/`hasSurah` are sync today, and bundled data is
   in-memory). If a fork ever needs async-loaded bundled data, the provider
   would need a `Promise` return and `hasSurah` would have to become async — a
   larger change. Keeping it sync unless there's a concrete async need.

3. **Precedence vs R2.** The sketch lets a non-null local result win over the
   R2 path. That's the intended semantic (a fork that bundles timings wants
   them used), but it's worth stating explicitly so a future reciter that has
   *both* a bundle and an R2 mirror resolves deterministically (local wins).

---

## Alternatives considered

### Reuse RFC-015's `timestampCdnBase` and mirror bundled timings to a CDN

Rejected as the primary path. It works, but forces an R2 bucket + a network
round-trip for data the fork already ships on disk, and the timings then can't
resolve offline. RFC-015 (CDN base) and this RFC (bundled provider) are
complementary read-side seams, not substitutes.

### Catalog field carrying inline timestamps per rewayat

Add the timings directly onto the `Rewayat` catalog row. Rejected: it bloats
the catalog JSON (timings are large), couples authoring to catalog versioning,
and the catalog is the wrong place for kilobytes of per-ayah timing arrays.

### Fork-detection branch inside `TimestampFetchService`

An `if (isQariah) …` conditional. Anti-pattern — every new fork grows the
conditional. Same reasoning RFC-015 used to reject it.

### Env variable

`EXPO_PUBLIC_*` can carry a string, not a function returning typed timing
arrays. Wrong tool for a provider seam.

---

## Out of scope

- **The R2/CDN fetch path** (RFC-015 / PR #278). This RFC adds a pre-network
  provider; it does not change how R2 timings are fetched, validated, or
  cached.
- **Timestamp authoring / bundling tooling.** Forks own how they produce and
  bundle their timing data; this RFC is read-side configurability only.
- **The `cached_surahs.source` column / `TimestampSource` enum.** Already in
  the upstream schema (`'r2' | 'local'`); this RFC just reaches the existing
  `'local'` value through a supported seam.

---

## Reference implementation

Qariah's adoption ships against the same shape:

- `config/branding.js` declares `timestampLocalProvider` returning the bundled
  timings for the fork's locally-authored reciter (today a single reciter whose
  timings are baked into the app), `null` otherwise.
- `services/timestamps/TimestampFetchService.ts` consumes the seam with the
  `?? null` fallbacks shown above — retiring a recurring hot-file divergence
  that has been dropped multiple times on wholesale absorptions of this file.

---

## Cross-references

- RFC-015 — `branding.timestampCdnBase` (read-side CDN seam; this RFC is the
  bundled-data counterpart, same inline-fallback pattern).
- RFC-009 / RFC-018 — nullable provider functions on `branding` (shape
  precedent for an optional fork-supplied function).
- PR #278 — `feature/timestamps-r2-mirror`. Introduced the fetch service this
  RFC extends.

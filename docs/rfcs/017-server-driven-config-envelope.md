# RFC-017: Server-driven config envelope

| Field    | Value                                                                       |
| -------- | --------------------------------------------------------------------------- |
| Status   | Proposed                                                                    |
| Date     | 2026-05-26                                                                  |
| Author   | Omar Zarka (@omar-zarka)                                                    |
| Reviewer | @osmansaeday                                                                |
| Related  | RFC-007 (multi-tenancy seam), RFC-010 (catalog version endpoint), RFC-016 (server-driven home rows) |

## Summary

Codify the wire-shape and client-side polling contract that RFC-010 (`/v1/catalog-version`) and RFC-016 (`/v1/home-config`) both consume into a single named pattern: the **server-driven config envelope**. Future seams of the same family (Listen-tab top slot, search filter dimensions, onboarding row order, featured-playlist surface) MUST adopt the envelope verbatim rather than re-deriving it per-feature.

Also codify the **platform-parity rule** that RFC-016 introduced as a first-class contract on envelope endpoints: no `?platform=` query parameter, no per-platform variance in the response, and a defined escape hatch for the rare case where a row or feature genuinely cannot exist on a given surface.

Doc only. Zero code change. The two endpoints that already exist (RFC-010, RFC-016) are conformant by construction.

## Motivation

RFC-016's final section asks for two things explicitly:

1. Sanity-check on the no-`?platform=` decision.
2. Confirmation that `{version, updated_at, ...payload}` is the standard wire shape for future server-driven config seams, rather than one-off-per-feature.

Both are real questions, and the cost of answering them in a doc that lives next to RFC-016 (rather than buried in PR comments) is one file. Once the contract is named, every future RFC of this family — and there will be several, see [Candidate future seams](#candidate-future-seams) below — can say "conforms to RFC-017 envelope" in two lines and skip re-deriving the wire shape, polling rules, cache semantics, and fail-open behaviour.

The corrosion this RFC prevents is real. Without a named contract:

- The next RFC re-debates `{version, updated_at, ...}` vs `{etag, ts, payload}` vs `{rev, mtime, ...}`. Three platforms then ship slightly different parsers.
- The next RFC re-debates 60s vs 30s vs 5min cache TTL. Mobile picks 60s, web picks 300s, TV picks "whatever HTTP defaults to". The "platforms read from the same source of truth" property of RFC-016 quietly erodes within two quarters.
- The platform-parity rule lives in RFC-016's prose only. The next contributor opens a follow-up endpoint with `?platform=` because the rule was not load-bearing on RFC-016 itself, just commentary.

## Decision

### The envelope

Every server-driven config endpoint returns a JSON object with these top-level fields:

| Field        | Type                  | Notes                                                                                                 |
| ------------ | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `version`    | `integer`             | Monotonically increasing. Bumped on every admin write that changes the payload.                       |
| `updated_at` | `string` (ISO 8601)   | Server's last-write timestamp, UTC, second-precision (e.g. `"2026-05-26T10:00:00Z"`).                 |
| _payload_    | object or array       | Feature-specific. Key name is the feature's `snake_case` slug (e.g. `rows`, `filters`, `slots`).      |

Example (RFC-016 conformant):

```json
{
  "version": 7,
  "updated_at": "2026-05-26T10:00:00Z",
  "rows": [
    {"id": "continue-listening", "enabled": true}
  ]
}
```

Example (hypothetical search-filter RFC, RFC-012's `/v1/search-filters`):

```json
{
  "version": 3,
  "updated_at": "2026-05-26T10:00:00Z",
  "filters": [
    {"id": "has-photo", "label": "Has photo", "default": false}
  ]
}
```

The payload key is **always** at the top level (not nested under `data` or `payload`). The reason is grep-ability and shell ergonomics: `curl … | jq .rows` and `curl … | jq .filters` are the natural read shapes for ops debugging, and a uniform `.data` wrapper bought no real type-safety while adding one level of indentation everywhere.

### Endpoint conventions

| Concern              | Rule                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Path                 | `GET /v{N}/{feature-slug}` on the existing Bayaan backend.                                                              |
| Auth                 | Public (no auth) for read. Per-user fields are NOT permitted on envelope endpoints — split into a separate auth'd path. |
| Cache-Control        | `public, max-age=60, s-maxage=60`. The CDN absorbs >99% of traffic; the 60s ceiling bounds propagation lag.             |
| Method               | `GET` only. Writes go through `/admin/{feature-slug}` and require the admin JWT (existing pattern).                     |
| Content-Type         | `application/json; charset=utf-8`.                                                                                      |
| HTTP status on empty | `200` with the payload key present and empty (`"rows": []`) NOT `404`. Clients treat empty as "valid, render nothing."  |

The empty-vs-404 distinction matters: a transient `404` is indistinguishable from a misrouted request, which trips the client's fail-open path and silently keeps the stale cache. An explicit `"rows": []` is the unambiguous "the admin deliberately cleared this" signal.

### Client-side polling contract

Every envelope-consuming client (mobile / web / TV) MUST implement the following behaviour. The pattern is what RFC-010 (`services/catalogVersionPoll.ts`) and RFC-016 (`hooks/useRemoteHomeConfig.ts`) already implement.

1. **Cold-start read order:** local cache → render → fetch → if `server.version > cache.version`, update cache + re-render.
2. **Foreground refresh:** debounced. On `AppState 'active'` transition, fetch IFF more than 5 minutes since the last successful fetch.
3. **Timeout:** 1500 ms on the network request. AbortController + timer.
4. **Fail-open:** any non-`2xx` response, network error, or timeout → silently keep the cached (or bundled) value. No retry storm.
5. **Version comparison:** `server.version > cache.version`. NOT `!==` (a backend rollback should not clobber a newer client cache for the rest of the session; the cache-control TTL bounds the staleness either way).
6. **Bundled fallback:** every envelope MUST have a bundled-in-binary fallback (the constant that the seam originally replaced). Cache missing AND network down on first launch → use the bundled value. This is what makes RFC-016's offline-first claim load-bearing.

Reference implementations live at `services/catalogVersionPoll.ts` (RFC-010) and RFC-016's proposed `hooks/useRemoteHomeConfig.ts`. New consumers should copy the structure, not refactor it into a generic hook factory — the per-seam types and cache key are clearer inline than abstracted.

### Platform-parity rule

A single canonical response is served to all platforms. No `?platform=` query parameter. The endpoint does not branch on `User-Agent`, `X-Platform`, or any other request header for content selection. The only client-aware shaping the server does is HTTP-standard (gzip, ETag).

**Why this is the right default.** Each platform (mobile / web / TV) already owns its own renderer registry (`rowNodes` on mobile; analogue on web; analogue on TV). The renderer keyed on an unknown id silently no-ops. This gives forward-compat for free: a new id can land server-side and roll out platform-by-platform as each client adds the renderer, without server changes. Per-platform branching on the server-side would introduce a second axis of divergence that the existing client-owned-registry pattern already handles.

**Escape hatch for genuine platform-only features.** If a feature genuinely cannot exist on a given surface (e.g. a "Cast to TV" row that has no rendering on the TV app itself, or a "Background audio" toggle that is meaningless on web), the right move is:

1. Define a new id (`cast-to-tv`, `background-audio-toggle`).
2. The platforms that can render it add an entry to their `rowNodes` registry.
3. The platforms that cannot do nothing. The client-owned-registry pattern silently skips it.

This is strictly cheaper than `?platform=`: it requires zero server work, ships with the client that needs it, and is grep-able from the client side ("where do we render `cast-to-tv`?" returns the one platform that does).

**When to revisit.** This rule is overturnable. If we ever discover a case where the same `id` legitimately needs different `enabled`/`label`/`order` semantics across platforms (genuinely the same row, behaving differently), open a follow-up RFC. The dual-registry workaround would be ugly enough at that point that the cost-benefit flips. We have not seen such a case across RFC-010 + RFC-016 + the candidate future seams below.

### Candidate future seams

This RFC is partially motivated by the seam pipeline I see landing over the next 1–2 quarters. Each of these is a natural envelope consumer:

| Future RFC                                                  | Endpoint                       | Payload key            | Why server-driven                                                                                              |
| ----------------------------------------------------------- | ------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| RFC-008 follow-up (Listen-tab top slot variant)             | `/v1/listen-tab-top-config`    | `slot`                 | A/B testing the top hero variant without rebuilding three platforms.                                           |
| RFC-012 v2 (composable search filter dimensions)            | `/v1/search-filters`           | `filters`              | New filter dimensions (translated-by, year-of-recording, etc.) land server-side, render client-side.           |
| Onboarding row order                                        | `/v1/onboarding-config`        | `cards`                | Per-cohort onboarding tweaks. Same forward-compat story as home rows.                                          |
| Featured-playlists surface                                  | `/v1/featured-playlists`       | `playlists`            | Editorial curation. Today this is `data/curatedPlaylists.ts` shipped in-binary; the wire shape is identical.   |

Each one fits the envelope verbatim. None of them needs `?platform=`. All four have a natural bundled-fallback (today's hardcoded constant).

I am NOT proposing we ship any of these as part of this RFC. They are listed only to make the case that the envelope contract is paying for itself across at least 4–6 future seams, not just RFC-010 + RFC-016.

## Alternatives considered

### A. Don't standardize; let each RFC re-derive the shape

What we have today. Rejected because RFC-010 and RFC-016 already had to litigate the same questions (cache TTL, fail-open, version-bump semantics). Standardizing across two existing precedents is cheap; standardizing across six is expensive and the divergence has set by then.

### B. A `data`-wrapped envelope (`{version, updated_at, data: {...}}`)

Used by REST APIs that need to add metadata over time without colliding with payload keys (think `pagination`, `errors`, `links`). Rejected because we control both ends and the payload key is feature-specific (`rows`, `filters`, `slots`) — there is no risk of collision. The flat shape is easier to grep and easier to type.

### C. Per-feature `etag` instead of `version`

HTTP `ETag` + `If-None-Match` is well-trodden and would let us drop the `version` integer. Rejected for two reasons: (1) the application-level `version` integer lets clients trivially express the "newer wins" rule without having to remember which etag they last saw, and (2) the CDN's `Cache-Control: max-age=60` already absorbs the bandwidth that conditional GETs would save. Keep both axes orthogonal: HTTP-level caching handles freshness, application-level `version` handles change detection.

### D. Per-platform endpoint (`?platform=ios` or `/v1/home-config/ios`)

Rejected per the platform-parity rule above. The dual-registry pattern handles every case we have today.

### E. Push (SSE / WebSocket) instead of poll

Rejected per RFC-016 alternative C: home row order and the candidate future seams all change ≤ weekly. Cold-start + foreground-debounced poll is the right cadence; push is overkill.

## Consequences

**Positive:**

- Every future server-driven config seam can cite this RFC in two lines and inherit the wire shape, polling rules, cache semantics, and platform-parity rule.
- The `services/catalogVersionPoll.ts` (mobile) and analogue (web, TV) implementations stay structurally similar across seams, which lowers the per-platform implementation cost.
- The platform-parity rule is now a written contract, not commentary in a prior RFC. Reviewers can point at it.

**Neutral:**

- RFC-010 and RFC-016 endpoints are conformant as written. No code change to either.
- The escape hatch (new id) for genuine platform-only features is the same pattern RFC-016 already implies; this RFC just names it.

**Negative / risks:**

- A future genuinely-cross-platform-divergent case would force an RFC amendment. Probability estimate is low given the candidate-seam list above, but real.
- The `version` integer is per-endpoint, not global. A user juggling multiple envelope-driven features sees independent version counters. This is fine for our use cases but worth flagging if we ever want a "config bundle" surface.
- The `s-maxage=60` ceiling means a misconfigured admin write is visible to all users within 60s. Mitigated by admin-side schema validation (RFC-016 already specifies this for `home-config`) and a documented rollback path (admin re-writes with the prior payload + a bumped `version`).

## How we'll know it worked

- The next server-driven config RFC (likely RFC-018 — Listen-tab top slot variant, or RFC-019 — search-filter dimensions) cites this RFC in its "Wire format" section and is ≤ 2 pages shorter as a result.
- A cross-platform review of `services/catalogVersionPoll.ts` (mobile) and the web equivalent shows structurally identical timeout / debounce / fail-open code modulo platform primitives.
- No future RFC reopens the `?platform=` debate without explicit reference to this RFC's [When to revisit](#platform-parity-rule) section.

## Open questions

1. **Should the envelope reserve a `min_client_version` field for future use?** A way for the server to say "this payload uses semantics that need client ≥ X". Today's escape hatch (unknown-id skip) handles the additive case, but a semantic change to an existing id (e.g. `enabled` becoming a per-cohort object) would need it. Deferred — add when first needed; YAGNI today.
2. **Should `updated_at` be required, or optional?** Strictly speaking the client only consumes `version`. `updated_at` is debugging-grade (it answers "when did this last change?" without DB access). My read: required, because the cost of typing it is zero and the operational value is high. Open to either.
3. **Bundled-fallback location convention.** Today RFC-016 puts the fallback in `config/branding.js` (the per-fork override layer). Future seams might want a different fallback location (e.g. a `defaults/` directory). Worth picking a convention now or leaving per-seam? My read: leave per-seam; the location is the seam's natural home and forcing a directory move buys nothing.

## Maintainer ask

cc @osmansaeday. This RFC directly responds to the two specific questions in RFC-016's "Maintainer ask" section. Both answers are codified above:

1. **No `?platform=` from day 1** — endorsed, with the escape-hatch pattern named explicitly.
2. **Wire shape as future standard** — yes, formalized as the envelope, with four candidate future consumers listed.

If you accept this RFC, RFC-016 can ship as-is (it is already conformant) and future RFCs of the same family cite this one. If you want adjustments to the envelope before locking it in, this is the cheapest moment to make them — zero code change either way.

Happy to fold this into RFC-016 directly if you would rather have one document instead of two. The argument for keeping it separate is that the envelope contract outlives any single seam.

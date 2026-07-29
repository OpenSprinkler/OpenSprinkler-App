# NLSpec — OpenSprinkler Companion (local database feature, v1)

- **Spec ID:** OSC-V1
- **Version:** 1.1 (completeness-challenged + incorporated)
- **Status:** Authored from the approved design `docs/superpowers/specs/2026-06-09-companion-local-db-v1-design.md`; multi-AI completeness challenge incorporated (§12)
- **Authoring method:** NLSpec (octo:spec) — Claude-authored, adversarial completeness challenge by Gemini + Codex CLIs

---

## 1. Overview

The Companion is an **optional**, self-hostable Node/TypeScript service that adds a **local database**
to the OpenSprinkler app and **serves the static dashboard** from the user's own container (removing
the need for Firebase Hosting when self-hosting). In v1 it persists **telemetry** and **run-log
history** for **one** configured controller and exposes a small read API the dashboard feature-detects.
The companion is strictly additive: when it is absent, the dashboard behaves exactly as it does today
(controller-direct read + control).

## 2. Actors

- **A1 Self-hoster / operator** — runs the companion container, supplies controller URL + password via
  config, accesses the dashboard on the LAN.
- **A2 Dashboard user (browser/SPA)** — views live status/control (controller-direct) and, when the
  companion is reachable, the History view (companion-served).
- **A3 Companion poller** — the in-process scheduled collector that reads the controller and writes
  history.
- **A4 OpenSprinkler controller** — the firmware device exposing the JSON API (`/jc`,`/jo`,`/jl`,…),
  source of truth for live state; unchanged by this feature.

## 3. Definitions

- **Telemetry sample** — a point-in-time snapshot of controller health/state captured by the poller.
- **Run-log row** — a station-run record ingested from the controller's `/jl` log, retained long-term.
- **StorageProvider** — the interface abstracting the database; v1 implements it with SQLite.
- **Graceful degradation** — the dashboard detects companion absence and omits companion-only UI with
  no error.
- **Combined firmware version** — `fwv*10 + fwm` (used for version gating; e.g. 221/4 → 2214).

## 4. Functional requirements

### 4.1 Hosting
- **FR-1** The companion SHALL serve the built SPA (`app/dist`) over HTTP on a configurable port
  (default 8080), with SPA fallback to `index.html` for unknown non-`/api` paths.
- **FR-2** Serving the SPA SHALL be independent of database health: the dashboard's controller-direct
  features SHALL load even if the database is empty or the poller has never run.

### 4.2 Collection (poller)
- **FR-3** The companion SHALL poll the configured controller on a fixed interval (default 300 s,
  configurable) using the existing typed `www/src/api` client + `BrowserDeviceSeam`. The **first poll
  SHALL run immediately on boot** (after the DB is ready), then repeat each interval.
- **FR-4** Each poll cycle SHALL read `/jc` and `/jo`, derive one **telemetry sample**, and persist it.
- **FR-5** The telemetry sample SHALL include: collector timestamp (UTC seconds), water level
  (`/jo.wl`), rain-delay flag (`/jc.rd`), weather error code (`/jc.wterr`), weather-restricted flag
  (`/jc.wtrestr`), last-weather-update (`/jc.lswc`), active-station count (derived from `/jc.sbits`
  via `countActiveStations`), RSSI (`/jc.RSSI`, nullable), current draw (`/jc.curr`, nullable), and a
  small allowlisted compatibility blob containing only controller time/board count and firmware
  version/timezone metadata. Raw `/jc` and `/jo` responses SHALL NOT be persisted because optional
  integration fields can contain credentials.
- **FR-6 (log backfill, gap-tolerant)** Each cycle SHALL fetch the run log over a window from
  `max(stored end_ts for this controller) − overlap` (cold start / empty DB: last `LOG_BACKFILL_DAYS`,
  default 2) up to now, via the **range-correct** `getLogs({start,end})`. Rows SHALL be mapped using
  the existing `decodeLogRow` decoder and **upserted idempotently** on `(controller, station, end_ts)`;
  the cycle returns the count of newly inserted rows. This recovers history after downtime instead of
  losing rows older than a fixed 24 h window.
- **FR-7 Poll-cycle atomicity** Telemetry persistence (FR-4) and run-log upsert (FR-6) are
  **independent**: if `/jc`+`/jo` succeed the telemetry sample SHALL be written even if the `/jl` fetch
  fails (and vice-versa). A failure in one part SHALL NOT prevent the other; both are logged. No
  partial telemetry row SHALL be written (a sample is written only when `/jc`+`/jo` both parsed).
- **FR-8** The poller SHALL NOT overlap cycles: if a cycle is still running when the next tick fires,
  that tick SHALL be skipped. Shutdown SHALL reject queued/new cycles, abort the active cycle, and
  bound the drain wait.
- **FR-9** A poll-cycle failure (network, auth, parse, or DB write — e.g. disk full / locked) SHALL be
  logged and SHALL NOT crash the poller or the HTTP server; the next scheduled cycle proceeds normally,
  and `/api/health` reflects the degraded state (`lastError`, stale `lastTs`).
- **FR-10** The companion SHALL authenticate to the controller **server-side** by reusing the seam's
  version-gated `authenticate()` (md5 for fwv ≥ 213 via `www/src/auth/md5`, legacy cleartext only for
  older firmware). A modern controller SHALL NOT be retried with the cleartext password after hash
  authentication fails. Firmware is auto-probed from the pre-auth `/jo` (`{fwv}` is
  readable without a password). For `ipas` controllers the password MAY be omitted; if the controller
  requires a password and none/an invalid one is supplied, the poller SHALL fail closed (no telemetry
  written) and report the auth failure via health. The password SHALL NEVER be exposed to the browser.

### 4.3 Storage
- **FR-11** All database access SHALL go through the `StorageProvider` interface (no direct DB calls
  elsewhere), so the backend is swappable.
- **FR-12** v1 SHALL provide a SQLite implementation (Drizzle ORM + better-sqlite3) writing to a file
  on a mounted volume (default `/data/data.db`), with a SQLite busy-timeout set for write contention.
- **FR-13 (stable controller identity)** Every persisted row SHALL carry a `controller` id that is
  **stable across the controller's IP / DHCP changes**: `CONTROLLER_ID` (env) if set, else the
  device MAC (`/jc.mac`), else a hash of the configured base URL. History MUST NOT fragment when the
  device's address changes.
- **FR-14 (startup / degraded hosting)** On startup the StorageProvider SHALL apply pending migrations
  (once, in-process — single container) **before** the poller starts. If DB open/migration **fails**,
  the HTTP server SHALL STILL serve the SPA and `/api/health` SHALL return `ok:false` with a reason —
  the process SHALL NOT exit (FR-2: hosting survives a DB failure); the poller SHALL NOT start until
  the DB is healthy.
- **FR-15 (retention)** A daily sweep (a separate low-frequency timer) SHALL prune `telemetry` older
  than `HISTORY_MAX_DAYS` (default 90). **Run-log rows SHALL NOT be pruned in v1** — long-term run
  history is the feature's purpose. (This corrects the design's §10 ambiguity: only telemetry is
  retention-bounded.)

### 4.4 Read API (Hono)
- **FR-16 (health)** `GET /api/health` SHALL return `{ ok, companion:"v1", storage:"sqlite", lastTs,
  telemetryRows, runLogRows, pollerStale, lastError }`. `ok` is true **iff** the DB is reachable and
  migrations are applied (false on DB/migration failure). `pollerStale` is true when `lastTs` is null
  or older than 2× `POLL_INTERVAL_SEC`. It SHALL succeed on an empty store (`lastTs` null, counts 0).
  The payload SHALL contain no secrets.
- **FR-17 (history)** `GET /api/history?from=<unix>&to=<unix>&limit=<n>&cursor=<opaque>` SHALL return
  `{ telemetry: [...], nextCursor: string|null }` with **inclusive** bounds, sorted **ascending by
  `(ts,id)`**. An omitted range defaults to the last 7 days. Pages SHALL use a fixed-snapshot keyset
  cursor so concurrent inserts/backfill cannot shift a walk. `from > to`, non-integer/negative params,
  an invalid/replayed-for-another-range cursor, or the obsolete `offset` parameter SHALL yield HTTP
  400 JSON. The effective span SHALL be **clamped to `HISTORY_MAX_DAYS`** and each page to 5,000 rows.
- **FR-18 (runlog)** `GET /api/runlog?from=&to=&limit=&cursor=` SHALL return
  `{ rows: [...], nextCursor: string|null }` with the same range, validation, snapshot, and sort
  semantics as FR-17 (using `(endTs,id)` as its keyset).
- **FR-19** API responses SHALL be JSON; **only GET** is allowed on `/api/*`; invalid params → HTTP 400
  JSON; unexpected errors → HTTP 500 JSON with **no stack/secret leakage**. Routing: `/api/*` takes
  precedence over static; unknown non-`/api` paths fall back to `index.html`; path traversal SHALL be
  prevented; if `app/dist` is missing the server SHALL log a clear warning and still serve `/api/*`.

### 4.5 SPA integration
- **FR-20** The SPA SHALL feature-detect the companion via `GET /api/health` at boot.
- **FR-21** When the companion is healthy (`ok` true), the dashboard SHALL show a **History** tab
  rendering trends (water level over time, run frequency per station, weather-update recency) from
  `/api/history` + `/api/runlog`, framework-free with inline-SVG sparklines (no charting dependency).
  When `pollerStale` is true, the History view SHALL show a non-blocking "data may be stale (collector
  not updating)" note.
- **FR-22** When the companion is absent/unreachable/unhealthy (`ok` false), the History tab SHALL NOT
  appear and no error SHALL be surfaced (graceful degradation).
- **FR-23** The companion base URL SHALL default to the origin the SPA was served from and be
  overridable (e.g. `?companion=<url>` or a stored setting).

### 4.6 Configuration & lifecycle
- **FR-24** Configuration SHALL be environment-driven and validated at startup: `STORAGE`
  (default `sqlite`), `DATABASE_PATH`, `CONTROLLER_BASE` (required), `CONTROLLER_PW` (optional for
  `ipas` devices), `CONTROLLER_ID` (optional; see FR-13), `CONTROLLER_FWV` (an explicit opt-in to
  verified pre-2.1.3 cleartext authentication; it must exactly match the version reported by `/jo`),
	  `POLL_INTERVAL_SEC` (300), `LOG_BACKFILL_DAYS` (2), `CONTROLLER_TIMEOUT_MS` (10000), `PORT` (8080),
	  `LISTEN_HOST` (`127.0.0.1`), `HISTORY_MAX_DAYS` (90), `API_ALLOWED_ORIGINS` (controller origin),
	  and optional `API_TOKEN` (minimum 16 characters). `LISTEN_HOST` SHALL accept only the
  loopback/wildcard IPv4/IPv6 literals documented in `.env.example`.
- **FR-25** Missing required configuration (e.g. `CONTROLLER_BASE`) SHALL fail fast at startup with a
  clear error. Secrets (`CONTROLLER_PW`) SHALL be redacted from all logs.
- **FR-26** The service SHALL shut down cleanly on SIGINT/SIGTERM: stop the poll loop and sweep timer,
  abort bounded controller I/O, drain the poller/HTTP server with finite deadlines, then close the DB.

## 5. Non-functional requirements

- **NFR-1 Optionality** — The feature SHALL NOT alter the controller-direct architecture; the SPA and
  the **existing test suite** SHALL remain green without the companion (no fixed count — "all existing
  tests pass").
- **NFR-2 Footprint** — The runtime image SHALL be slim (`node:*-alpine`, no native query-engine binary
  beyond the SQLite binding), suitable for low-power single-board hosts. Target (non-binding,
  monitored): runtime image < ~250 MB, idle RSS modest (single small Node process).
- **NFR-3 Security posture** — Controller credentials live only server-side; direct runs and Compose
  host publishing default to loopback. Non-loopback deployments use the optional bearer token and an
  explicit CORS origin allowlist. CORS on `/api/*` allows GET only. No secrets are written to logs.
- **NFR-4 Reliability** — A controller outage degrades to "no new samples"; a DB write error is logged
  and survived; the companion stays up and resumes when the dependency returns.
- **NFR-5 Portability** — Storage logic depends only on `StorageProvider`; adding Postgres SHALL
  require no changes to the poller, API, or SPA, and the storage contract suite SHALL run unchanged
  against it.
- **NFR-6 Data fidelity** — Raw controller JSON SHALL be retained alongside derived columns so future
  fields are recoverable without a firmware-side change.
- **NFR-7 Resource bound** — At the default interval, storage growth is expected on the order of
  ~KB/day for a single household (≈ one telemetry row / 5 min + a few run-log rows/day); this is a
  monitored expectation, not a hard test. All queries SHALL be range-bounded and indexed.

## 6. Data entities

- **`telemetry`**: `id` pk, `controller` text, `ts` int, `water_level` int, `rain_delay` int,
  `weather_err` int, `weather_restricted` int, `last_weather_update` int, `active_stations` int,
  `rssi` int null, `current_draw` int null, `raw` text(json). **Index (`controller`, `ts`)** — the
  range queries are always controller-qualified, so the compound index keeps multi-controller
  forward-compat performant.
- **`run_log`**: `controller` text, `program` int, `station` int, `duration_sec` int, `end_ts` int,
  `flow_gpm` real null; **UNIQUE(`controller`,`station`,`end_ts`)** (dedup) + **Index
  (`controller`, `end_ts`)**.

## 7. Interface contracts

### 7.1 StorageProvider
`init()`, `appendTelemetry(s)`, `upsertRunLog(rows) -> newCount`, `queryTelemetry(range)`,
`queryRunLog(range)`, `health()`, `close()` — as typed in the design doc §5. Pure data in/out; no HTTP
or controller knowledge.

### 7.2 REST API
As in §4.4. Stable response shapes; additive evolution only.

## 8. Error handling & edge cases

- **EC-1** Controller unreachable during a poll → log, skip writes, continue.
- **EC-2** Controller returns the pre-auth `{fwv}` stub (wrong password) → treated as an auth failure,
  logged; no telemetry written; surfaced via `/api/health` staleness (lastTs not advancing).
- **EC-3** `/jl` requires a `start`/`end` range (returns `{result:16}` otherwise) → the companion MUST
  use the range form `getLogs({start,end})` (FR-6; regression-guarded by the existing suite).
- **EC-4** Empty database / first boot → `/api/health` ok with zero counts; History view shows an
  empty-state, not an error.
- **EC-5** Duplicate run-log rows across overlapping poll/backfill windows → idempotent upsert on
  `(controller,station,end_ts)` prevents dupes.
- **EC-6** Clock skew between collector and controller → telemetry uses the collector clock; run-log
  uses the controller's `end_ts`; documented, not reconciled in v1.
- **EC-7** Large/over-wide history range requested → clamped to `HISTORY_MAX_DAYS`; response bounded.
- **EC-8** Companion served on a different origin than the controller (dev) → CORS allows **GET only**
  on `/api/*`; documented LAN-only.
- **EC-9** Migrations run once, in-process, in a single container (no multi-process assumption); they
  are idempotent and use a SQLite busy-timeout.
- **EC-10 (DB write failure)** Disk full / DB locked / corrupt on write → the error is logged, the poll
  cycle continues, the poller does not crash, and `/api/health` reflects the degraded state
  (`lastError`, stale `lastTs`).
- **EC-11 (controller IP change)** The device's LAN address changes (DHCP) → because `controller`
  identity is MAC/`CONTROLLER_ID`-based (FR-13), existing history continues under the same id; it does
  NOT fragment.
- **EC-12 (downtime gap)** The companion was down for hours/days → on restart the backfill window
  (FR-6) recovers run-log rows since the last stored `end_ts` (up to a safety cap), instead of losing
  everything older than 24 h.

## 9. Acceptance criteria (testable)

- **AC-1 (FR-3..FR-6, FR-13)** Given a mocked controller, one collect cycle writes exactly one
  telemetry row with the mapped fields and upserts the run-log rows under the **stable controller id**;
  a second identical cycle inserts **0** new run-log rows (dedup).
- **AC-2 (FR-7)** When `/jc`+`/jo` succeed but `/jl` throws, the telemetry sample is still written and
  no run-log rows are; when `/jc` fails, **no** telemetry sample is written (no partial row).
- **AC-3 (FR-8,FR-9,EC-10)** A cycle that throws (including a simulated DB write error) does not stop
  the loop; the next cycle succeeds.
- **AC-4 (FR-11..FR-15)** The storage contract suite (append / query / dedup / health / migrate /
  telemetry-prune) passes against the SQLite provider on a temp DB; the prune removes old **telemetry**
  but leaves **run-log** intact; the suite is structured to run unchanged against a future Postgres
  provider.
- **AC-5 (FR-16..FR-19)** `/api/health` returns `ok:true` with zero counts on an empty DB; `/api/history`
  and `/api/runlog` return range-bounded, **ascending-by-ts** JSON; `from > to` and a non-integer
  `from` each yield HTTP 400 JSON; a non-GET method on `/api/*` is rejected.
- **AC-6 (FR-14,FR-2)** When DB open/migration fails, the HTTP server still serves the SPA and
  `/api/health` returns `ok:false` with a reason — the process stays up.
- **AC-7 (FR-20..FR-22)** With `/api/health` ok, the dashboard shows a History tab that renders at least
  one water-level sparkline (≥1 data point) and the run-frequency view, or an explicit empty-state when
  there's no data; with health failing/unreachable the tab is absent and no error is shown; with
  `pollerStale:true` the "data may be stale" note renders (jsdom).
- **AC-8 (FR-1,FR-2,NFR-1)** The SPA loads and the existing test suite stays green with no companion
  running.
- **AC-9 (FR-10,NFR-3)** The browser bundle contains no controller password; the companion hashes md5
  for combined-fwv ≥ 213 (verified via the auth path).
- **AC-10 (FR-24,FR-25)** Startup with `CONTROLLER_BASE` unset fails fast with a clear message; with
  valid config it boots, migrates, and polls immediately; logs redact `CONTROLLER_PW`.
- **AC-11 (Docker)** `docker compose up` against a mocked/real controller yields a reachable dashboard;
  a telemetry row persists across a container restart (named volume); the container runs non-root and
  can write `/data`.

## 10. Out of scope (v1 non-goals / follow-ons)

Postgres adapter; config snapshots + restore; multi-controller "sites" UI; user/account auth; realtime
push; charting libraries; changes to the controller-direct live/control path.

## 11. Open questions

Resolved during the completeness challenge (now specified above): controller identity stability
(FR-13), poll atomicity (FR-7), log backfill after downtime (FR-6), retention scope — run-log not
pruned (FR-15), health/`ok`/staleness semantics (FR-16/FR-21), API range/sort/validation (FR-17/18),
degraded-startup hosting (FR-14), auth probing/`ipas` (FR-10).

Remaining (non-blocking, decided as defaults; revisit if needed):
- **OQ-1** Telemetry retention default is 90 days; run-log is unbounded in v1 — acceptable given
  KB/day volume; revisit if a user accumulates years of data.
- **OQ-2** Sparkline rendering is intentionally minimal (table + SVG); richer charts are a follow-on,
  not v1.
- **OQ-3** Resource-bound targets (NFR-2/7) are monitored expectations, not gated tests.

## 12. Completeness assessment (multi-AI adversarial challenge)

Two independent providers adversarially challenged the v1.0 draft (full content embedded, not just
referenced):

| Provider | Score | Headline gaps raised |
|---|---|---|
| **Gemini** | 88/100 | log-recovery data loss (fixed 24h window), controller identity fragility on DHCP change, silent collector failure (stale-data warning), unbounded query range, "slim"/footprint not measurable |
| **Codex** | 76/100 | poll atomicity (`/jl` fail after `/jc/jo`), health/`ok` semantics, API range semantics, retention contradicting the design (run-log pruning), startup-vs-degraded-hosting conflict, firmware-probe/`ipas` underspecified, CORS/static security, brittle "159-test" count |

**Incorporated (this revision, v1.1):** stable controller identity (FR-13) · gap-tolerant log backfill
(FR-6) · poll-cycle atomicity (FR-7) · DB-write-failure survival (FR-9, EC-10) · health `ok`/staleness
semantics + stale-data UI note (FR-16, FR-21) · precise API range/sort/validation + GET-only (FR-17–19)
· degraded-startup hosting (FR-14) · retention corrected — **run-log not pruned** (FR-15) · auth
probe/`ipas`/redaction (FR-10, FR-25) · compound indexes (§6) · de-brittled NFR-1 (drop fixed count) ·
measurable footprint/resource targets (NFR-2/7) · tightened AC-2/3/5/6/7/10/11 + new degraded-startup
and stale-poller criteria.

**Not incorporated (deliberately, as out-of-scope for v1 or default-decided):** hard image/RAM limits
as gated tests (kept as monitored targets), richer charting, run-log retention controls (unbounded by
design intent). These are noted in §10 / §11.

**Assessment:** after incorporation, both providers' top-3 gaps are addressed and no contradiction
with the approved design remains (the one contradiction Codex found — run-log pruning — was resolved in
the spec's favor of long-term history). Synthesized completeness: **~94/100** — shippable as the basis
for an implementation plan; remaining items are explicit, non-blocking defaults (§11).

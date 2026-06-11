# OpenSprinkler Companion — local database feature (v1 design)

**Date:** 2026-06-09
**Status:** Approved design, scoped to **v1**
**Branch context:** Phase-1 typed scaffold (`feat/phase1-typed-api-scaffold`) — `www/src/` typed API client, `app/` SPA build, controller-direct architecture.

## 1. Goal

Add an **optional, self-hostable companion service** that gives the app a local database for
**long-term telemetry/run history**, and that **serves the static dashboard from the user's own
Docker container** (replacing the dependency on Firebase Hosting for self-hosters). Designed as a
generalized feature: zero-config for a single household, pluggable storage behind an interface,
and **fully optional** — the SPA keeps working controller-direct when the companion is absent.

This document covers **v1 only**. Snapshots/restore, multi-controller "sites" UI, the Postgres
adapter, and API-token auth are explicit follow-ons (§12), each with its own spec.

## 2. Non-goals (v1)

- **No Postgres adapter yet** — v1 ships SQLite only, but behind a `StorageProvider` interface so
  Postgres is an additive change (the dual-dialect contract test arrives with that adapter).
- **No auth** — single-household LAN; the companion binds to the LAN and trusts it. (Optional API
  token is a follow-on.)
- **No config snapshots/restore, no multi-controller UI** — v1 polls **one** configured controller.
- **No realtime push** — periodic poll + client refresh is sufficient at household scale.
- **No change to the controller-direct live/control path** — that stays exactly as built; the DB is
  purely additive.

## 3. Architecture

```
 Docker host (user LAN)
 ┌──────────────────────────────────────────────────────────┐
 │  opensprinkler-companion  (one Node/TS container)         │
 │   • static server  → serves the built SPA (app/dist)      │  ← replaces Firebase Hosting
 │   • poller         → www/src/api typed client → controller│
 │                       /jc,/jo,/jl → writes telemetry/runlog│
 │   • REST API (Hono)→ /api/{health,history,runlog}         │
 │   • StorageProvider → Drizzle (better-sqlite3) → data.db  │
 └───────────────────────────┬──────────────────────────────┘
                             │ file on a named volume
                       ┌─────▼─────┐
                       │  data.db  │
                       └───────────┘
        ▲ HTTP (LAN)                          ▲ JSON API (LAN)
   ┌────┴─────┐  ── live status + control ──→ ┌──────────────┐
   │ Browser  │     (direct, unchanged)       │ OpenSprinkler│
   │  (SPA)   │  ── /api/* (history) ───────→ │  controller  │
   └──────────┘     (only if reachable)       └──────────────┘
```

The SPA talks to **two** endpoints: the **controller directly** for live status + control (unchanged)
and the **companion API** for history. The companion talks to the controller **server-side** for
collection, so the collector's credentials never touch the browser.

## 4. File layout (new `server/` top-level dir, sibling to `app/` and `www/src/`)

```
server/
  index.ts              # entrypoint: load config, init storage, start poller + http
  config.ts             # env-driven config (validated)
  http.ts               # Hono app: static serving (app/dist) + /api routes
  poller.ts             # scheduled collection loop (interval, overlap guard)
  collect.ts            # one poll cycle: read controller -> map -> storage writes (pure-ish, testable)
  api/
    health.ts           # GET /api/health
    history.ts          # GET /api/history
    runlog.ts           # GET /api/runlog
  storage/
    provider.ts         # StorageProvider interface + row types
    schema.ts           # Drizzle schema (sqlite dialect, v1)
    sqlite.ts           # SqliteStorageProvider (better-sqlite3 + drizzle-orm/better-sqlite3)
    migrate.ts          # apply migrations on boot (drizzle-kit generated SQL)
  Dockerfile            # multi-stage: build SPA + server -> slim runtime
docker-compose.yml      # companion service + named volume (root)
www/src/api/companion.ts # typed SPA client for the companion API + feature detection
```

`server/` reuses `www/src/api` (the typed client, seam, decoders) directly — same contract as the SPA.

## 5. StorageProvider interface (v1)

The single seam the rest of the server depends on. v1 implements it with SQLite; Postgres is a
later additive adapter.

```ts
export interface TelemetrySample {
  ts: number;              // collector unix seconds (UTC)
  waterLevel: number;      // /jo.wl  (%)
  rainDelay: 0 | 1;        // /jc.rd
  weatherErr: number;      // /jc.wterr
  weatherRestricted: 0 | 1;// /jc.wtrestr
  lastWeatherUpdate: number;// /jc.lswc
  activeStations: number;  // derived from /jc.sbits
  rssi: number | null;     // /jc.RSSI (esp only)
  currentDraw: number | null; // /jc.curr (arduino only)
  raw: unknown;            // { jc, jo } snapshot for forward-compat
}

export interface RunLogRow {
  program: number; station: number; durationSec: number; endTs: number; // dedup key: (controller, station, endTs)
  flowGpm: number | null;
}

export interface HistoryQuery { fromTs: number; toTs: number; }

export interface StorageProvider {
  init(): Promise<void>;                                   // run migrations / open
  appendTelemetry(s: TelemetrySample): Promise<void>;
  upsertRunLog(rows: RunLogRow[]): Promise<number>;        // returns # newly inserted (deduped)
  queryTelemetry(q: HistoryQuery): Promise<TelemetrySample[]>;
  queryRunLog(q: HistoryQuery): Promise<RunLogRow[]>;
  health(): Promise<{ ok: boolean; telemetryRows: number; runLogRows: number; lastTs: number | null }>;
  close(): Promise<void>;
}
```

Forward-compat: every table carries a `controller` text column (defaults to the single configured
controller id) so the multi-controller follow-on is additive, not a migration of existing rows.

## 6. Data model (Drizzle, SQLite dialect — v1)

- **`telemetry`**: `id` pk, `controller` text, `ts` int (indexed), `water_level` int, `rain_delay` int,
  `weather_err` int, `weather_restricted` int, `last_weather_update` int, `active_stations` int,
  `rssi` int null, `current_draw` int null, `raw` text(json).
- **`run_log`**: `controller` text, `program` int, `station` int, `duration_sec` int, `end_ts` int,
  `flow_gpm` real null — **unique (`controller`, `station`, `end_ts`)** for idempotent dedup;
  `end_ts` indexed.

Volume is tiny (one telemetry row per poll interval + a handful of run-log rows/day ≈ KB/day), so
plain indexed rows are sufficient — no time-series extension needed.

## 7. Poller / collection

- `poller.ts`: a guarded interval (default **300 s**, env `POLL_INTERVAL_SEC`). No overlap — skip a
  tick if the previous cycle is still running. Errors are logged and do not crash the loop.
- `collect.ts` (one cycle, testable in isolation against a mocked seam):
  1. `getControllerStatus()` (/jc) + `getOptions()` (/jo) via the typed client.
  2. Map → one `TelemetrySample` (`activeStations` via `countActiveStations(jc.sbits)`).
  3. `getLogs({ days: 1 })` (/jl, the range-correct call) → map rows → `upsertRunLog` (dedup).
  4. `appendTelemetry(sample)`.
- The companion authenticates to the controller server-side: `CONTROLLER_BASE` + `CONTROLLER_PW`
  (md5-hashed for fwv≥213 using the existing `www/src/auth/md5`), via `BrowserDeviceSeam`.

## 8. REST API (Hono, v1)

- `GET /api/health` → `{ ok, companion: "v1", storage: "sqlite", lastTs, telemetryRows, runLogRows }`.
  Used by the SPA to feature-detect.
- `GET /api/history?from=<unix>&to=<unix>` → `{ telemetry: TelemetrySample[] }` (bounded; default last 7 days, capped range).
- `GET /api/runlog?from=<unix>&to=<unix>` → `{ rows: RunLogRow[] }`.
- Static: everything else serves `app/dist` (SPA fallback to `index.html`).
- CORS: permissive on `/api/*` for LAN (the SPA may be served from a different origin during dev);
  documented as LAN-only.

## 9. SPA integration

- `www/src/api/companion.ts`: a typed client — `companionHealth(baseUrl)`, `fetchHistory(...)`,
  `fetchRunLog(...)`. The companion base URL is configured (default: same origin the SPA is served
  from; overridable via `?companion=` or a setting).
- **Feature detection + graceful degradation:** on boot the host calls `companionHealth()`. If it
  resolves ok, a **"History" tab** is added to the dashboard (`DASHBOARD_TABS`), rendering trends
  (water level over time, run frequency per station, weather-update recency) from `/api/history` +
  `/api/runlog`. If the companion is absent/unreachable, the History tab simply does not appear —
  zero error, identical to today's behavior.
- The History view is framework-free (HTML-string render, consistent with the other views): a compact
  data table plus **inline-SVG sparklines** (water level over time, run frequency per station) — **no
  charting dependency** in v1.

## 10. Configuration (env)

| Var | Default | Meaning |
|---|---|---|
| `STORAGE` | `sqlite` | storage backend (v1: only `sqlite`) |
| `DATABASE_PATH` | `/data/data.db` | SQLite file (on the mounted volume) |
| `CONTROLLER_BASE` | — (required) | controller URL, e.g. `http://10.10.100.246/` |
| `CONTROLLER_PW` | — | device password (md5-hashed server-side; omit if `ipas`) |
| `CONTROLLER_FWV` | probed | firmware version (auto-probed from `/jo` if unset) |
| `POLL_INTERVAL_SEC` | `300` | collection interval |
| `PORT` | `8080` | companion HTTP port |
| `HISTORY_MAX_DAYS` | `90` | retention cap (older telemetry pruned on a daily sweep) |

## 11. Docker

- `server/Dockerfile` — multi-stage: stage 1 builds the SPA (`npm run build:app` → `app/dist`) and
  compiles the server (`tsc` → `server/dist`); stage 2 is a slim `node:22-alpine` runtime with the
  server + built SPA + production deps; non-root user; `/data` volume for the SQLite file.
- `docker-compose.yml` (repo root) — one `companion` service, named volume `osdata:/data`, env from
  `.env`, `restart: unless-stopped`. (A commented-out `postgres` service stub marks the follow-on.)
- Result: `docker compose up` → dashboard at `http://<host>:8080`, polling the controller, history
  persisted locally. This is the Firebase-Hosting replacement for self-hosters; the Firebase config
  stays as the alternative cloud deploy (documented in DEPLOY.md).

## 12. Testing

- **Storage contract test** (`test/storage.contract.ts`): a shared suite run against the SQLite
  provider (in-memory/temp file) — append/query/dedup/health. Written so the **same suite** runs
  against the Postgres provider when that adapter lands (proving the pluggable swap).
- **collect.ts unit test**: mocked seam (reuse the `commands.spec` mock pattern) → asserts the
  mapped telemetry sample + run-log dedup (no double-insert on the same `end_ts`).
- **API tests**: Hono test client against an in-memory SQLite provider — health/history/runlog
  shapes + range bounding.
- **SPA**: `companion.ts` feature-detection (jsdom) — History tab present when health ok, absent on
  failure.
- All new server tests run under a dedicated `vitest.server.config.ts` (keeps the server suite
  separate from the contract suite + the `verify:live` harness), wired as `npm run test:server`.

## 13. Follow-ons (each its own spec → plan → build)

1. **Config snapshots + restore** — store `/jp,/jn,/jo` snapshots; "Restore" replays via the existing
   typed write commands (`submitProgram/Stations/Options`) with a diff + confirm.
2. **Multi-controller "sites" UI** — `controllers` table is already keyed; add CRUD + a switcher.
3. **Postgres adapter** — `storage/postgres.ts` (Drizzle pg) + run the storage contract suite against
   a Postgres-in-Docker; `STORAGE=postgres` + `DATABASE_URL`.
4. **Optional API token auth** — `COMPANION_TOKEN` gate on `/api/*` for non-trusted networks.

## 14. Why these choices

- **Companion service (not a raw DB):** a browser SPA can't talk to a DB directly, and telemetry
  history needs an always-on collector regardless — one small service does both + serves the app.
- **SQLite default:** single-household, local-only → embedded file DB = zero extra ops, no second
  container; volume is tiny.
- **Drizzle + better-sqlite3:** lean, typed, multi-dialect (SQLite→Postgres later), **no native
  query-engine binary** to bloat the image — fits the "easy to self-host" goal and the project's
  low-dependency character. Swappable behind `StorageProvider`.
- **Hono:** tiny, fast, first-class TS; right size for static + a few routes.
- **Optional + feature-detected:** keeps the app's serverless-by-default character; the DB is strictly
  additive, which is what makes it a safe generalized feature.

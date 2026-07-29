# OpenSprinkler Companion (local DB, v1) — Implementation Plan

> **Historical implementation artifact.** The companion has been implemented and this task plan is
> retained only for design provenance. Its unchecked commands and Docker snippets are not operational
> runbook instructions and intentionally reflect an earlier TypeScript-runtime prototype. Use the
> root `README.md`, `SECURITY.md`, `docs/DEPLOY.md`, and the current `server/Dockerfile` instead.

> The original execution checklist below is intentionally left unchanged for provenance.

**Goal:** Add an optional, self-hostable Node/TS "companion" container that serves the dashboard, polls one controller into a local SQLite database (telemetry + run history), and exposes a small read API the SPA feature-detects to show a History tab.

**Architecture:** One process. A Hono HTTP server serves the built SPA (`app/dist`) and a `/api/*` read API. A scheduled poller reuses the existing typed `www/src/api` client + `BrowserDeviceSeam` to read the controller and write rows through a `StorageProvider` interface (SQLite via Drizzle + better-sqlite3 in v1). The DB is strictly additive: with no companion, the SPA behaves as today. Spec: `docs/superpowers/specs/2026-06-09-companion-local-db-v1.nlspec.md`.

**Tech Stack:** TypeScript (ESM, run via `tsx`), Hono + `@hono/node-server`, Drizzle ORM + `better-sqlite3`, Vitest. Reuses `www/src/api/{client,decode}`, `www/src/seam/device`, `www/src/spike/status-view`, `www/src/auth/md5`.

---

## File structure

| File | Responsibility |
|---|---|
| `server/config.ts` | Load + validate env into a `CompanionConfig` (FR-24/25). |
| `server/storage/provider.ts` | `StorageProvider` interface + domain types (FR-11). |
| `server/storage/schema.ts` | Drizzle SQLite table schema + indexes (§6). |
| `server/storage/migrate.ts` | Idempotent `CREATE TABLE/INDEX IF NOT EXISTS` (FR-14). |
| `server/storage/sqlite.ts` | `SqliteStorageProvider` (FR-12..FR-15). |
| `server/device.ts` | `createDeviceClient(config)` → authed `OsApiClient` (FR-10). |
| `server/collect.ts` | `collectOnce()` — one poll cycle, atomic per-part (FR-4..FR-7). |
| `server/poller.ts` | Interval loop: first-poll-on-boot, no overlap, error-survival, daily prune (FR-3/8/9/15). |
| `server/api/routes.ts` | Hono sub-app: `/api/health`, `/api/history`, `/api/runlog` (FR-16..FR-19). |
| `server/http.ts` | Root Hono app: mount `/api`, static serving + SPA fallback (FR-1/2/19). |
| `server/index.ts` | Wire config→storage→device→poller→http; degraded-start; graceful shutdown (FR-14/26). |
| `www/src/api/companion.ts` | Typed SPA client + feature detection (FR-20/23). |
| `www/src/views/history-view.ts` | Framework-free History render (sparklines) (FR-21). |
| `www/src/views/dashboard.ts` (modify) | Conditionally add the History tab when present. |
| `server/Dockerfile`, `docker-compose.yml`, `.env.example` | Container + compose + sample env (AC-11). |
| `tsconfig.server.json`, `vitest.server.config.ts` | Server typecheck + test config. |
| `test/server/*.spec.ts`, `test/server/storage.contract.ts` | Server tests. |

---

## Task 1: Scaffold server deps, configs, and npm scripts

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `tsconfig.server.json`
- Create: `vitest.server.config.ts`
- Create: `server/.gitkeep` (placeholder so the dir exists; removed once real files land)

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
npm install hono @hono/node-server drizzle-orm better-sqlite3 tsx
npm install -D @types/better-sqlite3
```
Expected: packages added to `package.json` dependencies / devDependencies.

- [ ] **Step 2: Add npm scripts**

In `package.json` `"scripts"`, add:
```json
"companion": "tsx server/index.ts",
"test:server": "vitest run --config vitest.server.config.ts"
```

- [ ] **Step 3: Create `tsconfig.server.json`**

```json
{
	"//": "Typecheck the companion server + the www/src it reuses (Node target).",
	"compilerOptions": {
		"target": "ES2022",
		"module": "ESNext",
		"moduleResolution": "Bundler",
		"lib": [ "ES2022", "DOM" ],
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"resolveJsonModule": true,
		"types": [ "node" ],
		"noEmit": true
	},
	"include": [ "server/**/*.ts", "www/src/**/*.ts" ]
}
```

- [ ] **Step 4: Create `vitest.server.config.ts`**

```ts
import { defineConfig } from "vitest/config";

// Companion server tests — separate from the contract suite + the verify:live harness.
export default defineConfig( {
	test: { include: [ "test/server/**/*.spec.ts" ], environment: "node", testTimeout: 15000 },
} );
```

- [ ] **Step 5: Verify the toolchain builds**

Run: `npx tsc --noEmit -p tsconfig.server.json`
Expected: PASS (no server files yet → compiles cleanly; only checks www/src, already green).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.server.json vitest.server.config.ts
git commit -m "chore(companion): scaffold server deps + tsconfig + test config"
```

---

## Task 2: Config loader (`server/config.ts`)

**Files:**
- Create: `server/config.ts`
- Test: `test/server/config.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/server/config.spec.ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../../server/config";

const base = { CONTROLLER_BASE: "http://10.0.0.5/" };

describe( "loadConfig", () => {
	it( "applies defaults and requires CONTROLLER_BASE", () => {
		const c = loadConfig( base );
		expect( c.controllerBase ).toBe( "http://10.0.0.5/" );
		expect( c.pollIntervalSec ).toBe( 300 );
		expect( c.historyMaxDays ).toBe( 90 );
		expect( c.logBackfillDays ).toBe( 2 );
		expect( c.port ).toBe( 8080 );
		expect( c.databasePath ).toBe( "/data/data.db" );
	} );
	it( "throws fast when CONTROLLER_BASE is missing", () => {
		expect( () => loadConfig( {} ) ).toThrow( /CONTROLLER_BASE/ );
	} );
	it( "parses overrides", () => {
		const c = loadConfig( { ...base, POLL_INTERVAL_SEC: "60", PORT: "9000", CONTROLLER_ID: "house" } );
		expect( c.pollIntervalSec ).toBe( 60 );
		expect( c.port ).toBe( 9000 );
		expect( c.controllerId ).toBe( "house" );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/config.spec.ts`
Expected: FAIL — `loadConfig` is not defined.

- [ ] **Step 3: Implement `server/config.ts`**

```ts
/** Companion configuration, loaded + validated from environment variables (FR-24/25). */
export interface CompanionConfig {
	storage: "sqlite";
	databasePath: string;
	controllerBase: string;       // required
	controllerPw?: string;        // omit for ipas devices
	controllerId?: string;        // stable id override (else MAC, else base hash)
	controllerFwv?: number;       // auto-probed if unset
	pollIntervalSec: number;
	logBackfillDays: number;
	port: number;
	historyMaxDays: number;
}

function intOr( v: string | undefined, fallback: number ): number {
	const n = parseInt( String( v ), 10 );
	return Number.isFinite( n ) ? n : fallback;
}

export function loadConfig( env: Record<string, string | undefined> = process.env ): CompanionConfig {
	const controllerBase = env.CONTROLLER_BASE;
	if ( !controllerBase ) throw new Error( "CONTROLLER_BASE is required (e.g. http://10.0.0.5/)" );
	return {
		storage: "sqlite",
		databasePath: env.DATABASE_PATH || "/data/data.db",
		controllerBase: controllerBase.endsWith( "/" ) ? controllerBase : controllerBase + "/",
		controllerPw: env.CONTROLLER_PW,
		controllerId: env.CONTROLLER_ID,
		controllerFwv: env.CONTROLLER_FWV ? intOr( env.CONTROLLER_FWV, 0 ) : undefined,
		pollIntervalSec: intOr( env.POLL_INTERVAL_SEC, 300 ),
		logBackfillDays: intOr( env.LOG_BACKFILL_DAYS, 2 ),
		port: intOr( env.PORT, 8080 ),
		historyMaxDays: intOr( env.HISTORY_MAX_DAYS, 90 ),
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/config.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/config.ts test/server/config.spec.ts
git commit -m "feat(companion): env config loader with validation"
```

---

## Task 3: Storage interface + domain types (`server/storage/provider.ts`)

**Files:**
- Create: `server/storage/provider.ts`

(No test — types only; exercised by the storage contract suite in Task 5.)

- [ ] **Step 1: Write `server/storage/provider.ts`**

```ts
/** A point-in-time controller snapshot (FR-5). `controller` is added by the storage layer. */
export interface TelemetrySample {
	ts: number;                  // collector unix seconds (UTC)
	waterLevel: number;
	rainDelay: number;           // 0 | 1
	weatherErr: number;
	weatherRestricted: number;   // 0 | 1
	lastWeatherUpdate: number;
	activeStations: number;
	rssi: number | null;
	currentDraw: number | null;
	raw: string;                 // JSON.stringify({ jc, jo })
}

/** Telemetry as returned by queries — raw blob omitted to bound the payload (FR-17). */
export type StoredTelemetry = Omit<TelemetrySample, "raw">;

/** A station-run row ingested from /jl (FR-6). Dedup key: (controller, station, endTs). */
export interface RunLogRow {
	program: number; station: number; durationSec: number; endTs: number; flowGpm: number | null;
}

export interface HistoryQuery { fromTs: number; toTs: number; }

export interface StorageHealth {
	ok: boolean; telemetryRows: number; runLogRows: number; lastTs: number | null;
}

/** The single seam all DB access goes through (FR-11). v1 = SQLite; Postgres is an additive adapter. */
export interface StorageProvider {
	init(): Promise<void>;
	appendTelemetry( controller: string, s: TelemetrySample ): Promise<void>;
	upsertRunLog( controller: string, rows: RunLogRow[] ): Promise<number>; // # newly inserted
	queryTelemetry( controller: string, q: HistoryQuery ): Promise<StoredTelemetry[]>; // asc by ts
	queryRunLog( controller: string, q: HistoryQuery ): Promise<RunLogRow[]>;           // asc by endTs
	lastRunLogEndTs( controller: string ): Promise<number | null>;
	pruneTelemetry( olderThanTs: number ): Promise<number>; // # deleted
	health(): Promise<StorageHealth>;
	close(): Promise<void>;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit -p tsconfig.server.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/storage/provider.ts
git commit -m "feat(companion): StorageProvider interface + domain types"
```

---

## Task 4: Drizzle schema + migrations (`server/storage/schema.ts`, `migrate.ts`)

**Files:**
- Create: `server/storage/schema.ts`
- Create: `server/storage/migrate.ts`

- [ ] **Step 1: Write `server/storage/schema.ts`**

```ts
import { sqliteTable, integer, text, real, index, unique } from "drizzle-orm/sqlite-core";

export const telemetry = sqliteTable( "telemetry", {
	id: integer( "id" ).primaryKey( { autoIncrement: true } ),
	controller: text( "controller" ).notNull(),
	ts: integer( "ts" ).notNull(),
	waterLevel: integer( "water_level" ).notNull(),
	rainDelay: integer( "rain_delay" ).notNull(),
	weatherErr: integer( "weather_err" ).notNull(),
	weatherRestricted: integer( "weather_restricted" ).notNull(),
	lastWeatherUpdate: integer( "last_weather_update" ).notNull(),
	activeStations: integer( "active_stations" ).notNull(),
	rssi: integer( "rssi" ),
	currentDraw: integer( "current_draw" ),
	raw: text( "raw" ).notNull(),
}, ( t ) => ( { byCtrlTs: index( "telemetry_ctrl_ts" ).on( t.controller, t.ts ) } ) );

export const runLog = sqliteTable( "run_log", {
	id: integer( "id" ).primaryKey( { autoIncrement: true } ),
	controller: text( "controller" ).notNull(),
	program: integer( "program" ).notNull(),
	station: integer( "station" ).notNull(),
	durationSec: integer( "duration_sec" ).notNull(),
	endTs: integer( "end_ts" ).notNull(),
	flowGpm: real( "flow_gpm" ),
}, ( t ) => ( {
	uniq: unique( "run_log_uniq" ).on( t.controller, t.station, t.endTs ),
	byCtrlEnd: index( "run_log_ctrl_end" ).on( t.controller, t.endTs ),
} ) );
```

- [ ] **Step 2: Write `server/storage/migrate.ts`**

```ts
import type BetterSqlite3 from "better-sqlite3";

/** Idempotent schema creation (FR-14). Single-process, in-container; safe on every boot. */
export function migrate( db: BetterSqlite3.Database ): void {
	db.exec( `
		CREATE TABLE IF NOT EXISTS telemetry (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			controller TEXT NOT NULL,
			ts INTEGER NOT NULL,
			water_level INTEGER NOT NULL,
			rain_delay INTEGER NOT NULL,
			weather_err INTEGER NOT NULL,
			weather_restricted INTEGER NOT NULL,
			last_weather_update INTEGER NOT NULL,
			active_stations INTEGER NOT NULL,
			rssi INTEGER,
			current_draw INTEGER,
			raw TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS telemetry_ctrl_ts ON telemetry ( controller, ts );

		CREATE TABLE IF NOT EXISTS run_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			controller TEXT NOT NULL,
			program INTEGER NOT NULL,
			station INTEGER NOT NULL,
			duration_sec INTEGER NOT NULL,
			end_ts INTEGER NOT NULL,
			flow_gpm REAL
		);
		CREATE UNIQUE INDEX IF NOT EXISTS run_log_uniq ON run_log ( controller, station, end_ts );
		CREATE INDEX IF NOT EXISTS run_log_ctrl_end ON run_log ( controller, end_ts );
	` );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.server.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/storage/schema.ts server/storage/migrate.ts
git commit -m "feat(companion): drizzle sqlite schema + idempotent migrations"
```

---

## Task 5: SQLite provider + storage contract test (`server/storage/sqlite.ts`)

**Files:**
- Create: `server/storage/sqlite.ts`
- Create: `test/server/storage.contract.ts` (shared suite)
- Test: `test/server/sqlite.spec.ts`

- [ ] **Step 1: Write the shared contract + the failing SQLite spec**

```ts
// test/server/storage.contract.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { StorageProvider, TelemetrySample } from "../../server/storage/provider";

const sample = ( ts: number ): TelemetrySample => ( {
	ts, waterLevel: 34, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
	lastWeatherUpdate: ts - 60, activeStations: 1, rssi: -67, currentDraw: null,
	raw: JSON.stringify( { jc: {}, jo: {} } ),
} );

export function runStorageContract( name: string, make: () => StorageProvider ): void {
	describe( `StorageProvider contract: ${ name }`, () => {
		let store: StorageProvider;
		beforeEach( async () => { store = make(); await store.init(); } );
		afterEach( async () => { await store.close(); } );

		it( "appends + queries telemetry ascending, within range", async () => {
			await store.appendTelemetry( "c1", sample( 100 ) );
			await store.appendTelemetry( "c1", sample( 300 ) );
			await store.appendTelemetry( "c1", sample( 200 ) );
			const rows = await store.queryTelemetry( "c1", { fromTs: 150, toTs: 1000 } );
			expect( rows.map( ( r ) => r.ts ) ).toEqual( [ 200, 300 ] );    // sorted, range-filtered
			expect( ( rows[ 0 ] as Record<string, unknown> ).raw ).toBeUndefined(); // raw omitted
		} );

		it( "upserts run-log idempotently on (controller, station, endTs)", async () => {
			const rows = [ { program: 1, station: 2, durationSec: 60, endTs: 500, flowGpm: null } ];
			expect( await store.upsertRunLog( "c1", rows ) ).toBe( 1 );
			expect( await store.upsertRunLog( "c1", rows ) ).toBe( 0 ); // dedup
			expect( await store.lastRunLogEndTs( "c1" ) ).toBe( 500 );
		} );

		it( "scopes by controller", async () => {
			await store.appendTelemetry( "a", sample( 10 ) );
			await store.appendTelemetry( "b", sample( 20 ) );
			expect( ( await store.queryTelemetry( "a", { fromTs: 0, toTs: 99 } ) ).length ).toBe( 1 );
		} );

		it( "prunes telemetry older than a cutoff but leaves run-log", async () => {
			await store.appendTelemetry( "c1", sample( 100 ) );
			await store.appendTelemetry( "c1", sample( 999 ) );
			await store.upsertRunLog( "c1", [ { program: 0, station: 0, durationSec: 5, endTs: 100, flowGpm: null } ] );
			expect( await store.pruneTelemetry( 500 ) ).toBe( 1 );
			expect( ( await store.queryTelemetry( "c1", { fromTs: 0, toTs: 9999 } ) ).length ).toBe( 1 );
			expect( ( await store.queryRunLog( "c1", { fromTs: 0, toTs: 9999 } ) ).length ).toBe( 1 ); // not pruned
		} );

		it( "reports health", async () => {
			await store.appendTelemetry( "c1", sample( 100 ) );
			const h = await store.health();
			expect( h.ok ).toBe( true );
			expect( h.telemetryRows ).toBe( 1 );
			expect( h.lastTs ).toBe( 100 );
		} );
	} );
}
```

```ts
// test/server/sqlite.spec.ts
import { SqliteStorageProvider } from "../../server/storage/sqlite";
import { runStorageContract } from "./storage.contract";

runStorageContract( "sqlite (in-memory)", () => new SqliteStorageProvider( ":memory:" ) );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/sqlite.spec.ts`
Expected: FAIL — `SqliteStorageProvider` is not defined.

- [ ] **Step 3: Implement `server/storage/sqlite.ts`**

```ts
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, asc, eq, gte, lte, lt, sql } from "drizzle-orm";
import { telemetry, runLog } from "./schema";
import { migrate } from "./migrate";
import type {
	StorageProvider, TelemetrySample, StoredTelemetry, RunLogRow, HistoryQuery, StorageHealth,
} from "./provider";

export class SqliteStorageProvider implements StorageProvider {
	private raw: Database.Database;
	private db: BetterSQLite3Database;
	constructor( path: string ) {
		this.raw = new Database( path );
		this.raw.pragma( "journal_mode = WAL" );
		this.raw.pragma( "busy_timeout = 5000" );
		this.db = drizzle( this.raw );
	}
	async init(): Promise<void> { migrate( this.raw ); }

	async appendTelemetry( controller: string, s: TelemetrySample ): Promise<void> {
		this.db.insert( telemetry ).values( {
			controller, ts: s.ts, waterLevel: s.waterLevel, rainDelay: s.rainDelay,
			weatherErr: s.weatherErr, weatherRestricted: s.weatherRestricted,
			lastWeatherUpdate: s.lastWeatherUpdate, activeStations: s.activeStations,
			rssi: s.rssi, currentDraw: s.currentDraw, raw: s.raw,
		} ).run();
	}

	async upsertRunLog( controller: string, rows: RunLogRow[] ): Promise<number> {
		let inserted = 0;
		const tx = this.raw.transaction( ( items: RunLogRow[] ) => {
			for ( const r of items ) {
				const res = this.db.insert( runLog ).values( {
					controller, program: r.program, station: r.station,
					durationSec: r.durationSec, endTs: r.endTs, flowGpm: r.flowGpm,
				} ).onConflictDoNothing().run();
				inserted += res.changes;
			}
		} );
		tx( rows );
		return inserted;
	}

	async queryTelemetry( controller: string, q: HistoryQuery ): Promise<StoredTelemetry[]> {
		const r = this.db.select( {
			ts: telemetry.ts, waterLevel: telemetry.waterLevel, rainDelay: telemetry.rainDelay,
			weatherErr: telemetry.weatherErr, weatherRestricted: telemetry.weatherRestricted,
			lastWeatherUpdate: telemetry.lastWeatherUpdate, activeStations: telemetry.activeStations,
			rssi: telemetry.rssi, currentDraw: telemetry.currentDraw,
		} ).from( telemetry )
			.where( and( eq( telemetry.controller, controller ), gte( telemetry.ts, q.fromTs ), lte( telemetry.ts, q.toTs ) ) )
			.orderBy( asc( telemetry.ts ) ).all();
		return r as StoredTelemetry[];
	}

	async queryRunLog( controller: string, q: HistoryQuery ): Promise<RunLogRow[]> {
		const r = this.db.select( {
			program: runLog.program, station: runLog.station, durationSec: runLog.durationSec,
			endTs: runLog.endTs, flowGpm: runLog.flowGpm,
		} ).from( runLog )
			.where( and( eq( runLog.controller, controller ), gte( runLog.endTs, q.fromTs ), lte( runLog.endTs, q.toTs ) ) )
			.orderBy( asc( runLog.endTs ) ).all();
		return r as RunLogRow[];
	}

	async lastRunLogEndTs( controller: string ): Promise<number | null> {
		const r = this.db.select( { m: sql<number>`max(${ runLog.endTs })` } ).from( runLog )
			.where( eq( runLog.controller, controller ) ).all();
		return r[ 0 ]?.m ?? null;
	}

	async pruneTelemetry( olderThanTs: number ): Promise<number> {
		return this.db.delete( telemetry ).where( lt( telemetry.ts, olderThanTs ) ).run().changes;
	}

	async health(): Promise<StorageHealth> {
		const t = this.db.select( { c: sql<number>`count(*)`, m: sql<number>`max(${ telemetry.ts })` } ).from( telemetry ).all();
		const r = this.db.select( { c: sql<number>`count(*)` } ).from( runLog ).all();
		return { ok: true, telemetryRows: t[ 0 ]?.c ?? 0, runLogRows: r[ 0 ]?.c ?? 0, lastTs: t[ 0 ]?.m ?? null };
	}

	async close(): Promise<void> { this.raw.close(); }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/sqlite.spec.ts`
Expected: PASS (6 contract tests).

- [ ] **Step 5: Commit**

```bash
git add server/storage/sqlite.ts test/server/storage.contract.ts test/server/sqlite.spec.ts
git commit -m "feat(companion): SQLite StorageProvider + shared storage contract suite"
```

---

## Task 6: Authenticated device client (`server/device.ts`)

**Files:**
- Create: `server/device.ts`
- Test: `test/server/device.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/server/device.spec.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { createDeviceClient } from "../../server/device";
import { md5 } from "../../www/src/auth/md5";

afterEach( () => vi.restoreAllMocks() );

function mockFetch( fwv = 221 ): string[] {
	const urls: string[] = [];
	globalThis.fetch = vi.fn( async ( u: RequestInfo | URL ) => {
		urls.push( String( u ) );
		const body = String( u ).includes( "/jo" ) ? { fwv } : {};
		return { ok: true, status: 200, json: async () => body } as Response;
	} ) as unknown as typeof fetch;
	return urls;
}

describe( "createDeviceClient", () => {
	it( "probes fwv and md5-hashes the password for fwv>=213", async () => {
		const urls = mockFetch( 221 );
		const { client, fwv } = await createDeviceClient( { controllerBase: "http://d/", controllerPw: "example-password" } );
		expect( fwv ).toBe( 221 );
		await client.getControllerStatus();
		expect( urls.some( ( u ) => u.includes( `pw=${ md5( "example-password" ) }` ) ) ).toBe( true );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/device.spec.ts`
Expected: FAIL — `createDeviceClient` is not defined.

- [ ] **Step 3: Implement `server/device.ts`**

```ts
import { BrowserDeviceSeam } from "../www/src/seam/device";
import { OsApiClient } from "../www/src/api/client";
import { md5 } from "../www/src/auth/md5";

export interface DeviceClientConfig { controllerBase: string; controllerPw?: string; controllerFwv?: number; }

/**
 * Build an authenticated OsApiClient (FR-10): probe the pre-auth /jo for fwv (unless configured),
 * hash the password server-side (md5 for fwv>=213, cleartext fallback), and return a ready client.
 */
export async function createDeviceClient( cfg: DeviceClientConfig ): Promise<{ client: OsApiClient; fwv: number }> {
	const base = cfg.controllerBase.endsWith( "/" ) ? cfg.controllerBase : cfg.controllerBase + "/";
	let fwv = cfg.controllerFwv ?? 0;
	if ( !fwv ) {
		const res = await fetch( base + "jo", { headers: { Accept: "application/json" } } );
		const jo = await res.json() as { fwv?: number };
		fwv = typeof jo.fwv === "number" ? jo.fwv : 0;
	}
	const pwHash = cfg.controllerPw ? ( fwv >= 213 ? md5( cfg.controllerPw ) : cfg.controllerPw ) : "";
	const seam = new BrowserDeviceSeam( { baseUrl: base, pwHash, ver: fwv, ipas: cfg.controllerPw ? 0 : 1 } );
	return { client: new OsApiClient( seam ), fwv };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/device.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/device.ts test/server/device.spec.ts
git commit -m "feat(companion): server-side authenticated device client"
```

---

## Task 7: Collection cycle (`server/collect.ts`)

**Files:**
- Create: `server/collect.ts`
- Test: `test/server/collect.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/server/collect.spec.ts
import { describe, it, expect } from "vitest";
import { collectOnce } from "../../server/collect";
import { SqliteStorageProvider } from "../../server/storage/sqlite";
import type { OsApiClient } from "../../www/src/api/client";

const jc = { sbits: [ 2, 0 ], rd: 0, wterr: 0, wtrestr: 0, lswc: 1000, RSSI: -67 } as never;
const jo = { wl: 34 } as never;
const jl = [ [ 1, 2, 60, 500 ], [ 1, 3, 90, 600 ] ] as never; // two station-run rows

function fakeClient( opts: { jlThrows?: boolean } = {} ): OsApiClient {
	return {
		getControllerStatus: async () => jc,
		getOptions: async () => jo,
		getLogs: async () => { if ( opts.jlThrows ) throw new Error( "boom" ); return jl; },
	} as unknown as OsApiClient;
}

async function freshStore() { const s = new SqliteStorageProvider( ":memory:" ); await s.init(); return s; }

describe( "collectOnce", () => {
	it( "writes one telemetry row and upserts run-log; second cycle dedups", async () => {
		const store = await freshStore();
		const a = await collectOnce( fakeClient(), store, "c1", { backfillDays: 2, now: 2000 } );
		expect( a.telemetry ).toBe( true );
		expect( a.newRunLog ).toBe( 2 );
		const b = await collectOnce( fakeClient(), store, "c1", { backfillDays: 2, now: 2100 } );
		expect( b.newRunLog ).toBe( 0 ); // dedup
		expect( ( await store.queryTelemetry( "c1", { fromTs: 0, toTs: 9999 } ) ).length ).toBe( 2 );
	} );

	it( "still writes telemetry when the run-log fetch fails (atomicity, FR-7)", async () => {
		const store = await freshStore();
		const r = await collectOnce( fakeClient( { jlThrows: true } ), store, "c1", { backfillDays: 2, now: 2000 } );
		expect( r.telemetry ).toBe( true );
		expect( r.newRunLog ).toBe( 0 );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/collect.spec.ts`
Expected: FAIL — `collectOnce` is not defined.

- [ ] **Step 3: Implement `server/collect.ts`**

```ts
import type { OsApiClient } from "../www/src/api/client";
import type { JcResponse, JoResponse } from "../www/src/api/types";
import { decodeLogRow } from "../www/src/api/decode";
import { countActiveStations } from "../www/src/spike/status-view";
import type { StorageProvider, TelemetrySample, RunLogRow } from "./storage/provider";

const RUNLOG_OVERLAP_SEC = 3600; // re-scan the last hour to catch late-arriving rows

function mapTelemetry( jc: JcResponse, jo: JoResponse, now: number ): TelemetrySample {
	return {
		ts: now,
		waterLevel: jo.wl,
		rainDelay: jc.rd,
		weatherErr: jc.wterr,
		weatherRestricted: jc.wtrestr,
		lastWeatherUpdate: jc.lswc,
		activeStations: countActiveStations( jc.sbits ),
		rssi: typeof jc.RSSI === "number" ? jc.RSSI : null,
		currentDraw: typeof jc.curr === "number" ? jc.curr : null,
		raw: JSON.stringify( { jc, jo } ),
	};
}

/** One poll cycle. Telemetry + run-log are written independently (FR-7); errors are returned, not thrown. */
export async function collectOnce(
	client: OsApiClient, store: StorageProvider, controllerId: string,
	opts: { backfillDays: number; now: number },
): Promise<{ telemetry: boolean; newRunLog: number; errors: string[] }> {
	const errors: string[] = [];
	let telemetry = false;
	let newRunLog = 0;

	try {
		const [ jc, jo ] = await Promise.all( [ client.getControllerStatus(), client.getOptions() ] );
		await store.appendTelemetry( controllerId, mapTelemetry( jc, jo, opts.now ) );
		telemetry = true;
	} catch ( e ) { errors.push( `telemetry: ${ String( e ) }` ); }

	try {
		const last = await store.lastRunLogEndTs( controllerId );
		const start = last !== null ? last - RUNLOG_OVERLAP_SEC : opts.now - opts.backfillDays * 86400;
		const jl = await client.getLogs( { start, end: opts.now, now: opts.now * 1000 } );
		const rows: RunLogRow[] = jl.map( decodeLogRow )
			.filter( ( e ): e is Extract<ReturnType<typeof decodeLogRow>, { kind: "station" }> => e.kind === "station" )
			.map( ( e ) => ( { program: e.program, station: e.station, durationSec: e.durationSec, endTs: e.when, flowGpm: e.flowGpm ?? null } ) );
		newRunLog = await store.upsertRunLog( controllerId, rows );
	} catch ( e ) { errors.push( `runlog: ${ String( e ) }` ); }

	return { telemetry, newRunLog, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/collect.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/collect.ts test/server/collect.spec.ts
git commit -m "feat(companion): collection cycle (telemetry + gap-tolerant run-log, atomic)"
```

---

## Task 8: Poller (`server/poller.ts`)

**Files:**
- Create: `server/poller.ts`
- Test: `test/server/poller.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/server/poller.spec.ts
import { describe, it, expect, vi } from "vitest";
import { Poller } from "../../server/poller";

describe( "Poller", () => {
	it( "runs immediately, survives a throwing cycle, and reports lastError", async () => {
		let calls = 0;
		const cycle = vi.fn( async () => { calls++; if ( calls === 1 ) throw new Error( "first fails" ); } );
		const p = new Poller( cycle, 300 );
		await p.runNow();                      // immediate first poll (FR-3)
		expect( p.lastError ).toMatch( /first fails/ );
		await p.runNow();                      // loop survived; second succeeds (FR-9)
		expect( p.lastError ).toBeNull();
		expect( calls ).toBe( 2 );
	} );

	it( "does not overlap cycles", async () => {
		let active = 0; let maxActive = 0;
		const cycle = async () => { active++; maxActive = Math.max( maxActive, active ); await new Promise( ( r ) => setTimeout( r, 20 ) ); active--; };
		const p = new Poller( cycle, 300 );
		await Promise.all( [ p.runNow(), p.runNow() ] ); // second is skipped while first runs
		expect( maxActive ).toBe( 1 );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/poller.spec.ts`
Expected: FAIL — `Poller` is not defined.

- [ ] **Step 3: Implement `server/poller.ts`**

```ts
/** Interval poller: first-poll-on-boot, no overlap, error-survival (FR-3/8/9). */
export class Poller {
	lastError: string | null = null;
	private running = false;
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor( private readonly cycle: () => Promise<void>, private readonly intervalSec: number ) {}

	/** Run one cycle now; skips if one is already in flight (FR-8). Records lastError (FR-9). */
	async runNow(): Promise<void> {
		if ( this.running ) return;
		this.running = true;
		try { await this.cycle(); this.lastError = null; }
		catch ( e ) { this.lastError = String( e ); console.error( "[poller] cycle failed:", e ); }
		finally { this.running = false; }
	}

	/** Start: run immediately, then every interval (FR-3). */
	start(): void {
		void this.runNow();
		this.timer = setInterval( () => void this.runNow(), this.intervalSec * 1000 );
	}

	stop(): void { if ( this.timer ) clearInterval( this.timer ); this.timer = null; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/poller.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/poller.ts test/server/poller.spec.ts
git commit -m "feat(companion): poller (immediate first run, no overlap, error survival)"
```

---

## Task 9: Read API + HTTP app (`server/api/routes.ts`, `server/http.ts`)

**Files:**
- Create: `server/api/routes.ts`
- Create: `server/http.ts`
- Test: `test/server/api.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/server/api.spec.ts
import { describe, it, expect } from "vitest";
import { createApiRoutes, type ApiDeps } from "../../server/api/routes";
import { SqliteStorageProvider } from "../../server/storage/sqlite";

async function appWith( seedTs?: number ) {
	const store = new SqliteStorageProvider( ":memory:" ); await store.init();
	if ( seedTs ) await store.appendTelemetry( "c1", {
		ts: seedTs, waterLevel: 34, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
		lastWeatherUpdate: 0, activeStations: 0, rssi: null, currentDraw: null, raw: "{}",
	} );
	const deps: ApiDeps = { store, controllerId: "c1", pollIntervalSec: 300, historyMaxDays: 90, now: () => 10000, lastError: () => null };
	return createApiRoutes( deps );
}

describe( "api routes", () => {
	it( "GET /health → ok with counts; pollerStale when no/old data", async () => {
		const app = await appWith();
		const res = await app.request( "/health" );
		expect( res.status ).toBe( 200 );
		const j = await res.json();
		expect( j.ok ).toBe( true );
		expect( j.telemetryRows ).toBe( 0 );
		expect( j.pollerStale ).toBe( true ); // lastTs null
	} );

	it( "GET /history returns range-bounded ascending telemetry", async () => {
		const app = await appWith( 9000 );
		const res = await app.request( "/history?from=0&to=10000" );
		const j = await res.json();
		expect( j.telemetry.length ).toBe( 1 );
		expect( j.telemetry[ 0 ].ts ).toBe( 9000 );
	} );

	it( "GET /history with from>to → 400", async () => {
		const app = await appWith();
		expect( ( await app.request( "/history?from=500&to=100" ) ).status ).toBe( 400 );
	} );

	it( "rejects non-GET on /history", async () => {
		const app = await appWith();
		expect( ( await app.request( "/history", { method: "POST" } ) ).status ).toBe( 404 );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/api.spec.ts`
Expected: FAIL — `createApiRoutes` is not defined.

- [ ] **Step 3: Implement `server/api/routes.ts`**

```ts
import { Hono } from "hono";
import type { StorageProvider } from "../storage/provider";

export interface ApiDeps {
	store: StorageProvider;
	controllerId: string;
	pollIntervalSec: number;
	historyMaxDays: number;
	now: () => number;            // unix seconds (injectable for tests)
	lastError: () => string | null;
}

/** Parse + validate a from/to range (FR-17): inclusive, default 7d, clamp to historyMaxDays. */
function parseRange( url: URL, now: number, maxDays: number ): { fromTs: number; toTs: number } | null {
	const rawFrom = url.searchParams.get( "from" );
	const rawTo = url.searchParams.get( "to" );
	const to = rawTo === null ? now : Number( rawTo );
	const from = rawFrom === null ? now - 7 * 86400 : Number( rawFrom );
	if ( ![ from, to ].every( ( n ) => Number.isInteger( n ) && n >= 0 ) || from > to ) return null;
	const minFrom = to - maxDays * 86400;
	return { fromTs: Math.max( from, minFrom ), toTs: to };
}

export function createApiRoutes( deps: ApiDeps ): Hono {
	const app = new Hono();

	app.get( "/health", async ( c ) => {
		const h = await deps.store.health();
		const stale = h.lastTs === null || ( deps.now() - h.lastTs ) > 2 * deps.pollIntervalSec;
		return c.json( {
			ok: h.ok, companion: "v1", storage: "sqlite",
			lastTs: h.lastTs, telemetryRows: h.telemetryRows, runLogRows: h.runLogRows,
			pollerStale: stale, lastError: deps.lastError(),
		} );
	} );

	app.get( "/history", async ( c ) => {
		const range = parseRange( new URL( c.req.url ), deps.now(), deps.historyMaxDays );
		if ( !range ) return c.json( { error: "invalid range" }, 400 );
		return c.json( { telemetry: await deps.store.queryTelemetry( deps.controllerId, range ) } );
	} );

	app.get( "/runlog", async ( c ) => {
		const range = parseRange( new URL( c.req.url ), deps.now(), deps.historyMaxDays );
		if ( !range ) return c.json( { error: "invalid range" }, 400 );
		return c.json( { rows: await deps.store.queryRunLog( deps.controllerId, range ) } );
	} );

	return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/api.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement `server/http.ts` (static + mount + CORS)**

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import type { Hono as HonoApp } from "hono";

/** Root app: GET-only CORS on /api, mounts the API, serves the built SPA with SPA fallback (FR-1/2/19).
 *  NOTE: `npm run build:app` emits to ./dist (app/vite.config.ts outDir "../dist"), not app/dist. */
export function createHttpApp( api: HonoApp, distDir = "dist" ): Hono {
	const app = new Hono();
	app.use( "/api/*", cors( { origin: "*", allowMethods: [ "GET" ] } ) );
	app.route( "/api", api );

	if ( !existsSync( distDir ) ) {
		console.warn( `[http] ${ distDir } missing — serving /api only (build the SPA with npm run build:app)` );
	}
	app.use( "/*", serveStatic( { root: "./" + distDir } ) );
	app.notFound( ( c ) =>
		c.req.path.startsWith( "/api" ) ? c.json( { error: "not found" }, 404 ) : c.html( spaFallback( distDir ) ) );
	return app;
}

import { readFileSync } from "node:fs";
function spaFallback( distDir: string ): string {
	try { return readFileSync( `${ distDir }/index.html`, "utf8" ); }
	catch { return "<!doctype html><title>OpenSprinkler Companion</title><p>Build the dashboard: <code>npm run build:app</code></p>"; }
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.server.json`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/api/routes.ts server/http.ts test/server/api.spec.ts
git commit -m "feat(companion): read API (health/history/runlog) + static HTTP app"
```

---

## Task 10: Entrypoint wiring + degraded start (`server/index.ts`)

**Files:**
- Create: `server/index.ts`
- Create: `server/runtime.ts` (the testable wiring; `index.ts` is a thin shell)
- Test: `test/server/runtime.spec.ts`

- [ ] **Step 1: Write the failing test (degraded-start: DB failure still serves)**

```ts
// test/server/runtime.spec.ts
import { describe, it, expect } from "vitest";
import { buildRuntime } from "../../server/runtime";
import type { StorageProvider } from "../../server/storage/provider";

function brokenStore(): StorageProvider {
	return { async init() { throw new Error( "disk full" ); } } as unknown as StorageProvider;
}

describe( "buildRuntime degraded start (FR-14)", () => {
	it( "serves /api/health ok:false when the DB fails to init, without throwing", async () => {
		const rt = await buildRuntime( {
			config: { controllerId: "c1", pollIntervalSec: 300, historyMaxDays: 90 } as never,
			store: brokenStore(),
			startPoller: false,
			now: () => 1000,
		} );
		const res = await rt.app.request( "/api/health" );
		const j = await res.json();
		expect( j.ok ).toBe( false );
		expect( res.status ).toBe( 200 );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/runtime.spec.ts`
Expected: FAIL — `buildRuntime` is not defined.

- [ ] **Step 3: Implement `server/runtime.ts`**

```ts
import type { Hono } from "hono";
import type { CompanionConfig } from "./config";
import type { StorageProvider } from "./storage/provider";
import { createApiRoutes } from "./api/routes";
import { createHttpApp } from "./http";
import { Poller } from "./poller";

export interface RuntimeDeps {
	config: Pick<CompanionConfig, "controllerId" | "pollIntervalSec" | "historyMaxDays">;
	store: StorageProvider;
	startPoller: boolean;
	cycle?: () => Promise<void>;
	now?: () => number;
}

export interface Runtime { app: Hono; poller: Poller | null; dbOk: boolean; }

/** Wire storage→api→http with degraded-start: a failed store init still serves the app + health ok:false. */
export async function buildRuntime( deps: RuntimeDeps ): Promise<Runtime> {
	const now = deps.now ?? ( () => Math.floor( Date.now() / 1000 ) );
	let dbOk = true;
	try { await deps.store.init(); } catch ( e ) { dbOk = false; console.error( "[runtime] DB init failed:", e ); }

	let lastError: string | null = dbOk ? null : "database unavailable";
	const store: StorageProvider = dbOk ? deps.store : degradedStore();

	const poller = ( dbOk && deps.startPoller && deps.cycle )
		? new Poller( deps.cycle, deps.config.pollIntervalSec ) : null;
	if ( poller ) { poller.start(); }

	const api = createApiRoutes( {
		store, controllerId: deps.config.controllerId ?? "default",
		pollIntervalSec: deps.config.pollIntervalSec, historyMaxDays: deps.config.historyMaxDays,
		now, lastError: () => poller?.lastError ?? lastError,
	} );
	return { app: createHttpApp( api ), poller, dbOk };
}

/** A store that reports unhealthy + empty — used when the real DB failed to init (FR-14). */
function degradedStore(): StorageProvider {
	const empty = async () => [];
	return {
		init: async () => {}, appendTelemetry: async () => {}, upsertRunLog: async () => 0,
		queryTelemetry: empty, queryRunLog: empty, lastRunLogEndTs: async () => null,
		pruneTelemetry: async () => 0, close: async () => {},
		health: async () => ( { ok: false, telemetryRows: 0, runLogRows: 0, lastTs: null } ),
	} as StorageProvider;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/runtime.spec.ts`
Expected: PASS.

- [ ] **Step 5: Implement `server/index.ts` (thin shell — manual run, not unit-tested)**

```ts
import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { SqliteStorageProvider } from "./storage/sqlite";
import { createDeviceClient } from "./device";
import { collectOnce } from "./collect";
import { buildRuntime } from "./runtime";

async function main(): Promise<void> {
	const config = loadConfig();
	const store = new SqliteStorageProvider( config.databasePath );

	// Resolve a stable controller id (CONTROLLER_ID > device MAC > base hash) once the client is up.
	const { client } = await createDeviceClient( config ).catch( () => ( { client: null } ) );
	let controllerId = config.controllerId;
	if ( !controllerId && client ) {
		try { const jc = await client.getControllerStatus(); controllerId = jc.mac || undefined; } catch { /* keep undefined */ }
	}
	controllerId = controllerId || `base:${ config.controllerBase }`;
	config.controllerId = controllerId;

	const cycle = async (): Promise<void> => {
		if ( !client ) return;
		await collectOnce( client, store, controllerId!, { backfillDays: config.logBackfillDays, now: Math.floor( Date.now() / 1000 ) } );
	};

	const rt = await buildRuntime( { config, store, startPoller: true, cycle } );

	// daily telemetry prune (FR-15)
	const prune = setInterval( () => void store.pruneTelemetry( Math.floor( Date.now() / 1000 ) - config.historyMaxDays * 86400 ).catch( () => 0 ), 86400_000 );

	const server = serve( { fetch: rt.app.fetch, port: config.port } );
	console.log( `[companion] listening on :${ config.port }, polling ${ config.controllerBase } (id=${ controllerId })` );

	const shutdown = (): void => { rt.poller?.stop(); clearInterval( prune ); server.close(); void store.close(); process.exit( 0 ); };
	process.on( "SIGINT", shutdown );
	process.on( "SIGTERM", shutdown );
}

void main().catch( ( e ) => { console.error( "[companion] fatal:", e ); process.exit( 1 ); } );
```

- [ ] **Step 6: Typecheck + smoke run (no controller needed → degraded but serves)**

Run: `npx tsc --noEmit -p tsconfig.server.json`
Expected: PASS.
Run: `npm run build:app && CONTROLLER_BASE=http://127.0.0.1:1/ DATABASE_PATH=./tmp-data.db PORT=8123 timeout 3 npm run companion`
Expected: logs "listening on :8123" (poll fails silently; server stays up). Then `rm -f tmp-data.db`.

- [ ] **Step 7: Commit**

```bash
git add server/index.ts server/runtime.ts test/server/runtime.spec.ts
git commit -m "feat(companion): runtime wiring + degraded-start + entrypoint"
```

---

## Task 11: SPA companion client + feature detection (`www/src/api/companion.ts`)

**Files:**
- Create: `www/src/api/companion.ts`
- Test: `test/server/companion-client.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/server/companion-client.spec.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { detectCompanion, fetchHistory } from "../../www/src/api/companion";

afterEach( () => vi.restoreAllMocks() );

describe( "companion client", () => {
	it( "detectCompanion returns health when ok, null when unreachable", async () => {
		globalThis.fetch = vi.fn( async () => ( { ok: true, json: async () => ( { ok: true, pollerStale: false } ) } ) as Response ) as never;
		expect( await detectCompanion( "http://c/" ) ).toEqual( { ok: true, pollerStale: false } );
		globalThis.fetch = vi.fn( async () => { throw new Error( "down" ); } ) as never;
		expect( await detectCompanion( "http://c/" ) ).toBeNull();
	} );

	it( "fetchHistory builds a range query", async () => {
		const urls: string[] = [];
		globalThis.fetch = vi.fn( async ( u: RequestInfo | URL ) => { urls.push( String( u ) ); return { ok: true, json: async () => ( { telemetry: [] } ) } as Response; } ) as never;
		await fetchHistory( "http://c/", { fromTs: 1, toTs: 2 } );
		expect( urls[ 0 ] ).toBe( "http://c/api/history?from=1&to=2" );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/companion-client.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `www/src/api/companion.ts`**

```ts
/** Typed client for the optional companion API + feature detection (FR-20/23). */
export interface CompanionHealth {
	ok: boolean; companion?: string; storage?: string; lastTs?: number | null;
	telemetryRows?: number; runLogRows?: number; pollerStale?: boolean; lastError?: string | null;
}
export interface HistoryRange { fromTs: number; toTs: number; }
export interface TelemetryPoint {
	ts: number; waterLevel: number; rainDelay: number; weatherErr: number; weatherRestricted: number;
	lastWeatherUpdate: number; activeStations: number; rssi: number | null; currentDraw: number | null;
}
export interface RunLogPoint { program: number; station: number; durationSec: number; endTs: number; flowGpm: number | null; }

function base( url: string ): string { return url.endsWith( "/" ) ? url : url + "/"; }

/** Returns the companion health when reachable + ok, else null (graceful degradation, FR-22). */
export async function detectCompanion( companionBase: string ): Promise<CompanionHealth | null> {
	try {
		const res = await fetch( base( companionBase ) + "api/health", { headers: { Accept: "application/json" } } );
		if ( !res.ok ) return null;
		const h = await res.json() as CompanionHealth;
		return h.ok ? h : null;
	} catch { return null; }
}

export async function fetchHistory( companionBase: string, r: HistoryRange ): Promise<TelemetryPoint[]> {
	const res = await fetch( `${ base( companionBase ) }api/history?from=${ r.fromTs }&to=${ r.toTs }` );
	return ( ( await res.json() ) as { telemetry: TelemetryPoint[] } ).telemetry;
}

export async function fetchRunLog( companionBase: string, r: HistoryRange ): Promise<RunLogPoint[]> {
	const res = await fetch( `${ base( companionBase ) }api/runlog?from=${ r.fromTs }&to=${ r.toTs }` );
	return ( ( await res.json() ) as { rows: RunLogPoint[] } ).rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/companion-client.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add www/src/api/companion.ts test/server/companion-client.spec.ts
git commit -m "feat(companion): typed SPA companion client + feature detection"
```

---

## Task 12: History view + dashboard integration

**Files:**
- Create: `www/src/views/history-view.ts`
- Test: `test/server/history-view.spec.ts`
- Modify: `www/src/views/dashboard.ts` (add optional History tab)

- [ ] **Step 1: Write the failing test (render + stale note + empty-state)**

```ts
// test/server/history-view.spec.ts
import { describe, it, expect } from "vitest";
import { renderHistory } from "../../www/src/views/history-view";
import type { TelemetryPoint, RunLogPoint } from "../../www/src/api/companion";

const tel: TelemetryPoint[] = [
	{ ts: 100, waterLevel: 34, rainDelay: 0, weatherErr: 0, weatherRestricted: 0, lastWeatherUpdate: 0, activeStations: 0, rssi: -67, currentDraw: null },
	{ ts: 400, waterLevel: 50, rainDelay: 0, weatherErr: 0, weatherRestricted: 0, lastWeatherUpdate: 0, activeStations: 1, rssi: -70, currentDraw: null },
];
const runs: RunLogPoint[] = [ { program: 1, station: 2, durationSec: 60, endTs: 300, flowGpm: null } ];

describe( "renderHistory", () => {
	it( "renders a water-level sparkline + run-frequency from data", () => {
		const html = renderHistory( tel, runs, { stale: false } );
		expect( html ).toContain( "Water level" );
		expect( html ).toContain( "<svg" );        // sparkline
		expect( html ).toContain( "Runs" );
		expect( html ).not.toContain( "may be stale" );
	} );
	it( "shows an empty-state with no data", () => {
		expect( renderHistory( [], [], { stale: false } ) ).toContain( "No history yet" );
	} );
	it( "shows a stale note when the collector is behind", () => {
		expect( renderHistory( tel, runs, { stale: true } ) ).toContain( "may be stale" );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/history-view.spec.ts`
Expected: FAIL — `renderHistory` is not defined.

- [ ] **Step 3: Implement `www/src/views/history-view.ts`**

```ts
import type { TelemetryPoint, RunLogPoint } from "../api/companion";
import { esc, emptyState, infoNote } from "../ui/help";

/** Minimal inline-SVG sparkline from a series of numbers (no charting dependency, FR-21). */
function sparkline( values: number[], w = 240, h = 40 ): string {
	if ( values.length < 1 ) return "";
	const min = Math.min( ...values ), max = Math.max( ...values ), span = max - min || 1;
	const step = values.length > 1 ? w / ( values.length - 1 ) : w;
	const pts = values.map( ( v, i ) => `${ ( i * step ).toFixed( 1 ) },${ ( h - ( ( v - min ) / span ) * h ).toFixed( 1 ) }` ).join( " " );
	return `<svg class="spark" width="${ w }" height="${ h }" viewBox="0 0 ${ w } ${ h }" role="img" aria-label="trend">` +
		`<polyline fill="none" stroke="currentColor" stroke-width="2" points="${ pts }"></polyline></svg>`;
}

export function renderHistory( telemetry: TelemetryPoint[], runs: RunLogPoint[], opts: { stale: boolean } ): string {
	if ( telemetry.length === 0 && runs.length === 0 ) {
		return `<section aria-label="History"><h2>History</h2>` +
			( opts.stale ? infoNote( "Collector data may be stale — the companion isn't updating." ) : "" ) +
			emptyState( "No history yet", "The companion collects telemetry every few minutes; check back soon." ) +
			`</section>`;
	}
	const staleNote = opts.stale ? infoNote( "Data may be stale — the collector isn't updating." ) : "";

	// run frequency per station
	const freq = new Map<number, number>();
	for ( const r of runs ) freq.set( r.station, ( freq.get( r.station ) ?? 0 ) + 1 );
	const freqRows = [ ...freq.entries() ].sort( ( a, b ) => a[ 0 ] - b[ 0 ] )
		.map( ( [ s, n ] ) => `<tr><th scope="row">Station ${ s + 1 }</th><td>${ n }</td></tr>` ).join( "" );

	return `<section aria-label="History"><h2>History</h2>${ staleNote }` +
		`<h3>Water level <span class="muted">(${ telemetry.length } samples)</span></h3>` +
		`<div class="spark-wrap">${ sparkline( telemetry.map( ( t ) => t.waterLevel ) ) }</div>` +
		`<h3>Runs <span class="muted">(${ runs.length })</span></h3>` +
		( freqRows ? `<table class="status"><tbody>${ freqRows }</tbody></table>` : emptyState( "No runs in range" ) ) +
		`</section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/history-view.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire an optional History tab into `www/src/views/dashboard.ts`**

Make two edits. First, add `historyHtml` to `DashboardOptions`:

```ts
export interface DashboardOptions {
	actions?: boolean;
	settingsSection?: SettingsSection;
	/** When the companion is present, the host passes the rendered History HTML to add a History tab. */
	historyHtml?: string;
}
```

Second, replace the body of `renderDashboard` so the tab list is dynamic and a `"History"` case
returns the passed HTML (full function — keep every existing case unchanged):

```ts
export function renderDashboard( d: DashboardData, active: DashboardTab | "History" = "Status", opts: DashboardOptions = {} ): string {
	const tabs: readonly string[] = opts.historyHtml !== undefined
		? [ ...DASHBOARD_TABS, "History" ] : DASHBOARD_TABS;
	const nav = tabs.map( ( t ) =>
		`<button class="tab${ t === active ? " active" : "" }" role="tab" id="dashboard-tab-${ t }" ` +
		`aria-controls="dashboard-panel" aria-selected="${ t === active }" tabindex="${ t === active ? 0 : -1 }" ` +
		`data-tab="${ t }">${ t }</button>`
	).join( "" );

	const a = !!opts.actions;
	let content: string;
	switch ( active ) {
		case "Stations": content = renderStations( d.jc, d.jn, { actions: a } ); break;
		case "Programs": content = renderPrograms( d.jp, d.jn, { actions: a } ); break;
		case "Weather": content = renderWeather( d.jc, d.jo ); break;
		case "Log": content = renderLogs( d.jl, d.jn ); break;
		case "Diagnostics": content = renderDiagnostics( d.jc, d.jo ); break;
		case "Settings": content = renderSettings( d.jc, d.jo, d.jn, opts.settingsSection ); break;
		case "History": content = opts.historyHtml ?? ""; break;
		default: content = renderControllerStatus( d.jc, d.jo, deriveCapabilities( d.jc, d.jo ), { actions: a } );
	}
	return `<nav class="tabs" role="tablist" aria-label="Dashboard sections">${ nav }</nav>` +
		`<div class="tab-content" role="tabpanel" id="dashboard-panel" aria-labelledby="dashboard-tab-${ active }" tabindex="0">${ content }</div>`;
}
```

- [ ] **Step 6: Run the full SPA suite (no regressions)**

Run: `npm run test:contract`
Expected: PASS — `historyHtml` is optional, so existing `renderDashboard` calls are unchanged.

- [ ] **Step 7: Commit**

```bash
git add www/src/views/history-view.ts www/src/views/dashboard.ts test/server/history-view.spec.ts
git commit -m "feat(companion): History view + optional dashboard tab support"
```

---

## Task 12b: Host wiring — detect companion + populate the History tab

**Files:**
- Modify: `www/src/views/host.ts` (boot: detect companion, fetch history, pass `historyHtml`)
- Test: `test/server/host-companion.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/server/host-companion.spec.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveHistoryHtml } from "../../www/src/views/host";

afterEach( () => vi.restoreAllMocks() );

describe( "resolveHistoryHtml", () => {
	it( "returns rendered History HTML when the companion is healthy", async () => {
		globalThis.fetch = vi.fn( async ( u: RequestInfo | URL ) => {
			const s = String( u );
			if ( s.includes( "/api/health" ) ) return { ok: true, json: async () => ( { ok: true, pollerStale: false } ) } as Response;
			if ( s.includes( "/api/history" ) ) return { ok: true, json: async () => ( { telemetry: [] } ) } as Response;
			return { ok: true, json: async () => ( { rows: [] } ) } as Response;
		} ) as never;
		const html = await resolveHistoryHtml( "http://c/", () => 1000 );
		expect( html ).toContain( "History" );
	} );
	it( "returns undefined when the companion is absent (graceful degradation)", async () => {
		globalThis.fetch = vi.fn( async () => { throw new Error( "down" ); } ) as never;
		expect( await resolveHistoryHtml( "http://c/", () => 1000 ) ).toBeUndefined();
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- test/server/host-companion.spec.ts`
Expected: FAIL — `resolveHistoryHtml` is not exported.

- [ ] **Step 3: Add `resolveHistoryHtml` to `www/src/views/host.ts` and call it on boot**

Add the export and import:

```ts
import { detectCompanion, fetchHistory, fetchRunLog } from "../api/companion";
import { renderHistory } from "./history-view";

/**
 * If the companion is reachable + healthy, fetch the last 7 days and render the History HTML;
 * otherwise return undefined so the dashboard omits the History tab (FR-21/22).
 */
export async function resolveHistoryHtml( companionBase: string, now: () => number = () => Math.floor( Date.now() / 1000 ) ): Promise<string | undefined> {
	const health = await detectCompanion( companionBase );
	if ( !health ) return undefined;
	const range = { fromTs: now() - 7 * 86400, toTs: now() };
	const [ tel, runs ] = await Promise.all( [ fetchHistory( companionBase, range ), fetchRunLog( companionBase, range ) ] );
	return renderHistory( tel, runs, { stale: !!health.pollerStale } );
}
```

Then in `mountDashboard`, resolve it once on boot and thread it into `paint()`. In `refresh()` add,
after `data` is set:

```ts
// resolve the companion History once per refresh (companion base defaults to the serving origin)
const companionBase = new URLSearchParams( location.search ).get( "companion" ) || location.origin + "/";
historyHtml = await resolveHistoryHtml( companionBase );
```

Declare `let historyHtml: string | undefined;` alongside the other state, and pass it in `paint()`:

```ts
deps.mount.innerHTML = data
	? renderDashboard( data, activeTab, { actions: true, settingsSection, historyHtml } )
	: "<p>Loading…</p>";
```

(`activeTab`'s type widens to `DashboardTab | "History"` — update its declaration accordingly.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:server -- test/server/host-companion.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Confirm no SPA regressions + typecheck**

Run: `npm run test:contract && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add www/src/views/host.ts test/server/host-companion.spec.ts
git commit -m "feat(companion): host detects companion + populates the History tab"
```

---

## Task 13: Docker + compose + sample env

**Files:**
- Create: `server/Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Modify: `.gitignore` (ignore `*.db`, `tmp-data.db`, `/data`)

- [ ] **Step 1: Create `server/Dockerfile`**

```dockerfile
# Stage 1 — build the SPA + install deps
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++   # better-sqlite3 native build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:app                      # -> ./dist (app/vite.config.ts outDir "../dist")

# Stage 2 — slim runtime
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/www/src ./www/src
RUN addgroup -S osc && adduser -S osc -G osc && mkdir -p /data && chown osc:osc /data
USER osc
VOLUME /data
EXPOSE 8080
CMD [ "npx", "tsx", "server/index.ts" ]
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  companion:
    build: { context: ., dockerfile: server/Dockerfile }
    ports: [ "8080:8080" ]
    env_file: [ .env ]
    volumes: [ "osdata:/data" ]
    restart: unless-stopped
  # Follow-on: a `postgres` service goes here when the Postgres adapter lands.
volumes:
  osdata:
```

- [ ] **Step 3: Create `.env.example`**

```bash
CONTROLLER_BASE=http://192.0.2.10/
CONTROLLER_PW=example-password
# CONTROLLER_ID=my-house        # optional; defaults to device MAC
POLL_INTERVAL_SEC=300
HISTORY_MAX_DAYS=90
PORT=8080
DATABASE_PATH=/data/data.db
```

- [ ] **Step 4: Ignore local DB files**

Append to `.gitignore`:
```
# companion local database
*.db
*.db-*
/data/
```

- [ ] **Step 5: Manual verification (operator)**

Run:
```bash
cp .env.example .env   # edit CONTROLLER_BASE/PW for your device
docker compose up --build -d
curl -s localhost:8080/api/health     # -> {"ok":true,...}
# wait one poll interval, then:
curl -s "localhost:8080/api/history?from=0&to=9999999999" | head -c 200
docker compose restart                # data persists via the osdata volume
```
Expected: health ok; history grows; data survives the restart.

- [ ] **Step 6: Commit**

```bash
git add server/Dockerfile docker-compose.yml .env.example .gitignore
git commit -m "feat(companion): Dockerfile + compose + sample env"
```

---

## Task 14: Docs + final gates

**Files:**
- Modify: `docs/DEPLOY.md` (add a "Self-host with the companion" section)
- Modify: `www/src/README.md` (note the optional companion + History)

- [ ] **Step 1: Add a companion section to `docs/DEPLOY.md`**

Append:
```markdown
## Self-host with the companion (local database)

`docker compose up --build` runs the **companion** (`server/`): it serves the dashboard at
`http://<host>:8080`, polls your controller into a local SQLite database (`/data` volume), and adds
a **History** tab. Config via `.env` (see `.env.example`). The companion is optional — the dashboard
works controller-direct without it. See the v1 spec: `docs/superpowers/specs/2026-06-09-companion-local-db-v1.nlspec.md`.
```

- [ ] **Step 2: Note it in `www/src/README.md`**

Add a bullet under the status list:
```markdown
- `server/` (optional companion) serves the SPA + persists telemetry/run history to SQLite and adds a
  feature-detected History tab. `www/src/api/companion.ts` is the typed client. See docs/DEPLOY.md.
```

- [ ] **Step 3: Run all suites + typechecks**

Run:
```bash
npm run test:contract            # existing SPA suite — green
npm run test:server              # companion suite — green
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.server.json
npm run build:app                # SPA still builds
```
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/DEPLOY.md www/src/README.md
git commit -m "docs(companion): self-host + History section"
```

---

## Self-review (spec coverage)

- **Hosting (FR-1/2):** Task 9 (`http.ts` static + SPA fallback), Task 13 (Docker). ✓
- **Collection (FR-3..FR-10):** Task 7 (collect, atomicity, backfill), Task 8 (poller, first-run/overlap/survival), Task 6 (server-side md5 auth). ✓
- **Storage (FR-11..FR-15):** Tasks 3–5 (interface, schema, SQLite, contract incl. dedup + prune-telemetry-not-runlog), Task 10 (degraded start FR-14). ✓
- **API (FR-16..FR-19):** Task 9 (health w/ pollerStale, range validation, GET-only, 400/404). ✓
- **SPA (FR-20..FR-23):** Task 11 (feature detect), Task 12 (History view + tab + dynamic nav), Task 12b (host detects companion + populates/omits the tab, jsdom). ✓
- **Config/lifecycle (FR-24..FR-26):** Task 2 (validate/fail-fast), Task 10 (shutdown). ✓
- **NFRs:** optionality (Task 12 keeps existing suite green), footprint/security (Task 13 alpine/non-root, server-side creds, GET-only CORS), portability (StorageProvider contract Task 5). ✓
- **Acceptance criteria:** AC-1/2 (Task 7), AC-3 (Tasks 7/8), AC-4 (Task 5), AC-5 (Task 9), AC-6 (Task 10), AC-7 (Tasks 11/12/12b), AC-8 (Task 12 step 6 + Task 14), AC-9 (Task 6), AC-10 (Task 2 + Task 10), AC-11 (Task 13). ✓

**No deferrals.** The host wiring is a full task (12b) with its own jsdom test. One intentional v1
simplification: the History range is a fixed last-7-days on each refresh (date-range picker is a
follow-on); and the daily prune timer in `index.ts` (Task 10 Step 5) is exercised by manual run, not a
unit test, since it's a thin `setInterval` over the unit-tested `pruneTelemetry` (covered by AC-4).

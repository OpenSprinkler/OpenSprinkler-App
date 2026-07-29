// test/server/runtime.spec.ts
import { describe, it, expect } from "vitest";
import { buildRuntime } from "../../server/runtime";
import type { StorageProvider } from "../../server/storage/provider";
import { SqliteStorageProvider } from "../../server/storage/sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

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

	it( "also degrades when opening the SQLite file itself fails", async () => {
		const path = join( tmpdir(), `missing-${ randomUUID() }`, "data.db" );
		const store = new SqliteStorageProvider( path ); // construction is deliberately non-throwing
		const rt = await buildRuntime( {
			config: { controllerId: "c1", pollIntervalSec: 300, historyMaxDays: 90 },
			store, startPoller: false, now: () => 1000,
		} );
		expect( rt.dbOk ).toBe( false );
		expect( await ( await rt.app.request( "/api/health" ) ).json() ).toMatchObject( { ok: false } );
		await store.close(); // idempotent even though open failed
	} );

	it( "prunes retained telemetry immediately after initialization", async () => {
		const events: Array<string | number> = [];
		const store = {
			init: async () => { events.push( "init" ); },
			pruneTelemetry: async ( cutoff: number ) => { events.push( "prune", cutoff ); return 0; },
			health: async () => ( { ok: true, telemetryRows: 0, runLogRows: 0, lastTs: null } ),
			close: async () => {},
		} as unknown as StorageProvider;
		await buildRuntime( {
			config: { controllerId: "c1", pollIntervalSec: 300, historyMaxDays: 2 },
			store, startPoller: false, now: () => 500000,
		} );
		expect( events ).toEqual( [ "init", "prune", 500000 - 2 * 86400 ] );
	} );
} );

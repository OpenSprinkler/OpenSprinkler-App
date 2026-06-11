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

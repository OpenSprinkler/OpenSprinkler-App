// test/server/storage.contract.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { EventRow, StorageProvider, TelemetrySample } from "../../server/storage/provider";

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

		it( "returns the most recently INSERTED sample as the diff baseline (not greatest ts)", async () => {
			expect( await store.lastTelemetry( "c1" ) ).toBeNull();
			await store.appendTelemetry( "c1", sample( 100 ) );
			await store.appendTelemetry( "c1", sample( 300 ) );
			await store.appendTelemetry( "c1", sample( 200 ) ); // backward clock step
			// Insertion order wins: a max-ts baseline would re-diff against the ts=300 row on every
			// poll after a backward host-clock step, re-emitting the same transition events.
			expect( ( await store.lastTelemetry( "c1" ) )?.ts ).toBe( 200 );
			expect( await store.lastTelemetry( "other" ) ).toBeNull();
		} );

		it( "appendSample persists the sample and its events together", async () => {
			await store.appendSample( "c1", sample( 100 ), [
				{ ts: 100, source: "weather", level: "normal", label: "Weather", detail: "one" },
				{ ts: 100, source: "weather", level: "detail", label: "Weather", detail: "two" },
			] );
			expect( ( await store.lastTelemetry( "c1" ) )?.ts ).toBe( 100 );
			const page = await store.pageEvents( "c1", { fromTs: 0, toTs: 999, limit: 10 } );
			expect( page.rows.map( ( r ) => r.detail ) ).toEqual( [ "one", "two" ] );
		} );

		it( "appends + pages events with verbosity ceiling and source filter", async () => {
			const ev = ( ts: number, level: EventRow["level"], source: EventRow["source"] = "weather" ): EventRow =>
				( { ts, source, level, label: "Weather", detail: `event at ${ ts }` } );
			await store.appendEvents( "c1", [
				ev( 100, "normal" ), ev( 200, "detail" ), ev( 300, "debug" ), ev( 400, "normal", "system" ),
			] );
			const all = await store.pageEvents( "c1", { fromTs: 0, toTs: 9999, limit: 10 } );
			expect( all.rows.map( ( r ) => r.ts ) ).toEqual( [ 100, 200, 300, 400 ] );
			const normalOnly = await store.pageEvents( "c1", { fromTs: 0, toTs: 9999, limit: 10, maxLevel: "normal" } );
			expect( normalOnly.rows.map( ( r ) => r.ts ) ).toEqual( [ 100, 400 ] );
			const detailed = await store.pageEvents( "c1", { fromTs: 0, toTs: 9999, limit: 10, maxLevel: "detail" } );
			expect( detailed.rows.map( ( r ) => r.ts ) ).toEqual( [ 100, 200, 400 ] );
			const system = await store.pageEvents( "c1", { fromTs: 0, toTs: 9999, limit: 10, source: "system" } );
			expect( system.rows.map( ( r ) => r.ts ) ).toEqual( [ 400 ] );
			expect( ( await store.pageEvents( "other", { fromTs: 0, toTs: 9999, limit: 10 } ) ).rows ).toEqual( [] );
		} );

		it( "prunes events older than a cutoff", async () => {
			await store.appendEvents( "c1", [
				{ ts: 100, source: "weather", level: "normal", label: "Weather", detail: "old" },
				{ ts: 900, source: "weather", level: "normal", label: "Weather", detail: "new" },
			] );
			expect( await store.pruneEvents( 500 ) ).toBe( 1 );
			const left = await store.pageEvents( "c1", { fromTs: 0, toTs: 9999, limit: 10 } );
			expect( left.rows.map( ( r ) => r.detail ) ).toEqual( [ "new" ] );
		} );

		it( "reports health", async () => {
			await store.appendTelemetry( "c1", sample( 100 ) );
			const h = await store.health( "c1" );
			expect( h.ok ).toBe( true );
			expect( h.telemetryRows ).toBe( 1 );
			expect( h.lastTs ).toBe( 100 );
		} );

		it( "bounds query pages", async () => {
			await store.appendTelemetry( "c1", sample( 100 ) );
			await store.appendTelemetry( "c1", sample( 200 ) );
			await store.appendTelemetry( "c1", sample( 300 ) );
			const rows = await store.queryTelemetry( "c1", { fromTs: 0, toTs: 999, limit: 1, offset: 1 } );
			expect( rows.map( ( row ) => row.ts ) ).toEqual( [ 200 ] );
		} );

		it( "uses id as a deterministic keyset tie-breaker for equal timestamps", async () => {
			await store.appendTelemetry( "c1", sample( 100 ) );
			await store.appendTelemetry( "c1", sample( 100 ) );
			await store.appendTelemetry( "c1", sample( 200 ) );
			const first = await store.pageTelemetry( "c1", { fromTs: 0, toTs: 999, limit: 1 } );
			expect( first.rows.map( ( row ) => row.ts ) ).toEqual( [ 100 ] );
			expect( first.nextCursor ).not.toBeNull();
			const second = await store.pageTelemetry( "c1", {
				fromTs: 0, toTs: 999, limit: 2, cursor: first.nextCursor!,
			} );
			expect( second.rows.map( ( row ) => row.ts ) ).toEqual( [ 100, 200 ] );
			expect( second.nextCursor ).toBeNull();
		} );
	} );
}

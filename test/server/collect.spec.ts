// test/server/collect.spec.ts
import { describe, it, expect } from "vitest";
import { collectOnce, mapTelemetry } from "../../server/collect";
import { SqliteStorageProvider } from "../../server/storage/sqlite";
import type { OsApiClient } from "../../www/src/api/client";

const jc = { devt: 2000, sbits: [ 2, 0 ], rd: 0, wterr: 0, wtrestr: 0, lswc: 1000, RSSI: -67 };
const jo = { wl: 34, tz: 48 };
const jl = [ [ 1, 2, 60, 500 ], [ 1, 3, 90, 600 ] ] as never; // two station-run rows

function fakeClient( opts: { jlThrows?: boolean } = {} ): OsApiClient {
	return {
		getControllerStatus: async () => jc as never,
		getOptions: async () => jo as never,
		getLogs: async () => { if ( opts.jlThrows ) throw new Error( "boom" ); return jl; },
	} as unknown as OsApiClient;
}

async function freshStore() { const s = new SqliteStorageProvider( ":memory:" ); await s.init(); return s; }

describe( "collectOnce", () => {
	it( "persists only allowlisted compatibility metadata, never raw controller secrets", () => {
		const sample = mapTelemetry(
			{ ...jc, mqtt: "secret-mqtt", otc: "secret-otc", email: "secret-email" } as never,
			{ ...jo, wsp: "secret-weather", ifkey: "secret-ifttt" } as never,
			2000,
		);
		expect( JSON.parse( sample.raw ) ).toEqual( {
			schema: 1,
			controller: { devt: 2000, nbrd: 0 },
			firmware: { fwv: 0, fwm: 0, tz: 48 },
		} );
		expect( sample.raw ).not.toMatch( /secret-|mqtt|otc|email|wsp|ifkey/i );
	} );

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
		expect( r.errors[ 0 ] ).toMatch( /runlog.*boom/ );
	} );

	it( "converts log pulse rate to gallons per minute using /jo calibration", async () => {
		const store = await freshStore();
		const client = {
			getControllerStatus: async () => jc as never,
			getOptions: async () => ( { wl: 34, tz: 48, fpr0: 100, fpr1: 0 } as never ), // 1 liter / pulse
			getLogs: async () => [ [ 1, 2, 60, 500, 2.45 ] ],
		} as unknown as OsApiClient;
		await collectOnce( client, store, "c1", { backfillDays: 2, now: 2000 } );
		const rows = await store.queryRunLog( "c1", { fromTs: 0, toTs: 1000 } );
		expect( rows[ 0 ].flowGpm ).toBe( 0.65 );
	} );

	it( "queries logs in controller time but stores their timestamps in UTC", async () => {
		const store = await freshStore();
		let requested: { start?: number; end?: number } | undefined;
		const hostNow = 1_700_000_000;
		const offset = 3600;
		const client = {
			getControllerStatus: async () => ( { ...jc, devt: hostNow + offset } as never ),
			getOptions: async () => ( { ...jo, tz: 52 } as never ),
			getLogs: async ( options: { start?: number; end?: number } ) => {
				requested = options;
				return [ [ 1, 2, 60, hostNow + offset - 30 ] ] as never;
			},
		} as unknown as OsApiClient;
		await collectOnce( client, store, "c1", { backfillDays: 2, now: hostNow } );
		expect( requested?.end ).toBe( hostNow + offset );
		const rows = await store.queryRunLog( "c1", { fromTs: hostNow - 100, toTs: hostNow } );
		expect( rows[ 0 ]?.endTs ).toBe( hostNow - 30 );
	} );

	it( "drops boundary-day rows outside the exact collection window", async () => {
		const store = await freshStore();
		const controllerNow = 200000;
		const client = {
			getControllerStatus: async () => ( { ...jc, devt: controllerNow } as never ),
			getOptions: async () => ( { ...jo, tz: 48 } as never ),
			getLogs: async () => [
				[ 1, 2, 60, controllerNow - 86401 ],
				[ 1, 2, 60, controllerNow - 100 ],
				[ 1, 2, 60, controllerNow + 1 ],
			] as never,
		} as unknown as OsApiClient;
		const result = await collectOnce( client, store, "c1", { backfillDays: 1, now: controllerNow } );
		expect( result.newRunLog ).toBe( 1 );
		expect( await store.queryRunLog( "c1", { fromTs: 0, toTs: controllerNow + 10 } ) ).toHaveLength( 1 );
	} );

	it( "honors a long configured cold-start backfill but caps stale-cursor catch-up to 90 days", async () => {
		const controllerNow = 1_700_000_000;
		const requests: number[] = [];
		const client = {
			getControllerStatus: async () => ( { ...jc, devt: controllerNow } as never ),
			getOptions: async () => ( { ...jo, tz: 48 } as never ),
			getLogs: async ( options: { start?: number } ) => { requests.push( options.start! ); return [] as never; },
		} as unknown as OsApiClient;

		const cold = await freshStore();
		await collectOnce( client, cold, "cold", { backfillDays: 365, now: controllerNow } );
		expect( requests.pop() ).toBe( controllerNow - 365 * 86400 );

		const stale = await freshStore();
		await stale.upsertRunLog( "stale", [ {
			program: 1, station: 1, durationSec: 60, endTs: controllerNow - 200 * 86400, flowGpm: null,
		} ] );
		await collectOnce( client, stale, "stale", { backfillDays: 365, now: controllerNow } );
		expect( requests.pop() ).toBe( controllerNow - 90 * 86400 );
	} );
} );

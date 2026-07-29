import { describe, it, expect } from "vitest";
import { CollectionCycleError, ControllerCollector, controllerLogSummary, fallbackControllerId } from "../../server/controller";
import { SqliteStorageProvider } from "../../server/storage/sqlite";
import type { OsApiClient } from "../../www/src/api/client";

const jc = {
	devt: 0, nbrd: 1, lrun: [ 0, 0, 0, 0 ], ps: [], sbits: [], eip: 0,
	mac: "AA:BB:CC", rd: 0, wterr: 0, wtrestr: 0, lswc: 0,
} as never;
const jo = { fwv: 221, wl: 100 } as never;

function client( logs: () => Promise<never> | Promise<never[]> = async () => [] ): OsApiClient {
	return {
		getControllerStatus: async () => jc,
		getOptions: async () => jo,
		getLogs: logs,
	} as unknown as OsApiClient;
}

describe( "ControllerCollector", () => {
	it( "redacts controller path tokens and identifiers from its operational label", () => {
		const base = "https://cloud.openthings.io/forward/v1/OT0123456789abcdef0123456789abcd/";
		const label = controllerLogSummary( base, "aa:bb:cc:dd:ee:ff" );
		expect( label ).toMatch( /^https:\/\/cloud\.openthings\.io \(idHash=[a-f0-9]{12}\)$/ );
		expect( label ).not.toContain( "OT0123456789abcdef0123456789abcd" );
		expect( label ).not.toContain( "aa:bb:cc" );
	} );

	it( "retries acquisition and resolves MAC identity before the first write", async () => {
		const store = new SqliteStorageProvider( ":memory:" ); await store.init();
		const config = { controllerBase: "http://device/", logBackfillDays: 2, controllerTimeoutMs: 1000 };
		let attempts = 0;
		const collector = new ControllerCollector( config, store, () => 2000, async () => {
			attempts++;
			if ( attempts === 1 ) throw new Error( "temporarily offline" );
			return { client: client(), fwv: 221, status: jc };
		} );
		expect( collector.controllerId ).toBe( fallbackControllerId( config.controllerBase ) );
		await expect( collector.cycle() ).rejects.toThrow( /temporarily offline/ );
		await collector.cycle();
		expect( attempts ).toBe( 2 );
		expect( collector.controllerId ).toBe( "aa:bb:cc" );
		expect( await store.queryTelemetry( "aa:bb:cc", { fromTs: 0, toTs: 3000 } ) ).toHaveLength( 1 );
		expect( await store.queryTelemetry( fallbackControllerId( config.controllerBase ), { fromTs: 0, toTs: 3000 } ) ).toHaveLength( 0 );
		await store.close();
	} );

	it( "propagates partial collection errors after preserving successful writes", async () => {
		const store = new SqliteStorageProvider( ":memory:" ); await store.init();
		const config = { controllerBase: "http://device/", controllerId: "configured", logBackfillDays: 2 };
		const collector = new ControllerCollector( config, store, () => 2000, async () => ( {
			client: client( async () => { throw new Error( "logs offline" ); } ), fwv: 221, status: jc,
		} ) );
		await expect( collector.cycle() ).rejects.toBeInstanceOf( CollectionCycleError );
		expect( await store.queryTelemetry( "configured", { fromTs: 0, toTs: 3000 } ) ).toHaveLength( 1 );
		expect( collector.controllerId ).toBe( "configured" );
		await store.close();
	} );
} );

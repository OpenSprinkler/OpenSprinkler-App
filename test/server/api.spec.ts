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

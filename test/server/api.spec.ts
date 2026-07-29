// test/server/api.spec.ts
import { describe, it, expect, vi } from "vitest";
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

	it( "allows only bounded public last-error categories in health", async () => {
		const store = new SqliteStorageProvider( ":memory:" ); await store.init();
		const secret = "raw-controller-secret-fragment";
		const app = createApiRoutes( {
			store, controllerId: "c1", pollIntervalSec: 300, historyMaxDays: 90,
			now: () => 1000, lastError: () => `SyntaxError: ${ secret }`,
		} );
		const body = await ( await app.request( "/health" ) ).json();
		expect( body.lastError ).toBe( "service degraded" );
		expect( JSON.stringify( body ) ).not.toContain( secret );
		await store.close();
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

	it( "uses strict decimal query validation", async () => {
		const app = await appWith();
		expect( ( await app.request( "/history?from=1e3&to=2000" ) ).status ).toBe( 400 );
		expect( ( await app.request( "/history?from=0&to=2000&limit=0" ) ).status ).toBe( 400 );
		expect( ( await app.request( "/history?from=0&to=2000&offset=1" ) ).status ).toBe( 400 );
		expect( ( await app.request( "/history?from=0&to=2000&cursor=not+base64" ) ).status ).toBe( 400 );
	} );

	it( "returns snapshot-keyset pages without duplicates when backfilled rows arrive between requests", async () => {
		const store = new SqliteStorageProvider( ":memory:" ); await store.init();
		for ( const ts of [ 100, 200, 300 ] ) await store.appendTelemetry( "c1", {
			ts, waterLevel: ts, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
			lastWeatherUpdate: 0, activeStations: 0, rssi: null, currentDraw: null, raw: "{}",
		} );
		const app = createApiRoutes( {
			store, controllerId: "c1", pollIntervalSec: 300, historyMaxDays: 90, now: () => 1000, lastError: () => null,
		} );
		const first = await ( await app.request( "/history?from=0&to=1000&limit=2" ) ).json();
		expect( first.telemetry.map( ( row: { ts: number } ) => row.ts ) ).toEqual( [ 100, 200 ] );
		expect( first.nextCursor ).toEqual( expect.any( String ) );
		// Both rows sort inside the requested range, but were created after page one's snapshot.
		for ( const ts of [ 50, 250 ] ) await store.appendTelemetry( "c1", {
			ts, waterLevel: ts, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
			lastWeatherUpdate: 0, activeStations: 0, rssi: null, currentDraw: null, raw: "{}",
		} );
		const second = await ( await app.request(
			`/history?from=0&to=1000&limit=2&cursor=${ encodeURIComponent( first.nextCursor ) }`,
		) ).json();
		expect( second.telemetry.map( ( row: { ts: number } ) => row.ts ) ).toEqual( [ 300 ] );
		expect( second.nextCursor ).toBeNull();
		// Cursors are bound to endpoint + range, so they cannot be replayed into a different walk.
		expect( ( await app.request(
			`/history?from=0&to=999&limit=2&cursor=${ encodeURIComponent( first.nextCursor ) }`,
		) ).status ).toBe( 400 );
		expect( ( await app.request(
			`/runlog?from=0&to=1000&limit=2&cursor=${ encodeURIComponent( first.nextCursor ) }`,
		) ).status ).toBe( 400 );
		await store.close();
	} );

	it( "scopes health to the active controller", async () => {
		const store = new SqliteStorageProvider( ":memory:" ); await store.init();
		await store.appendTelemetry( "old", {
			ts: 9900, waterLevel: 1, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
			lastWeatherUpdate: 0, activeStations: 0, rssi: null, currentDraw: null, raw: "{}",
		} );
		const app = createApiRoutes( {
			store, controllerId: () => "current", pollIntervalSec: 300, historyMaxDays: 90, now: () => 10000, lastError: () => null,
		} );
		const health = await ( await app.request( "/health" ) ).json();
		expect( health.telemetryRows ).toBe( 0 );
		expect( health.pollerStale ).toBe( true );
		await store.close();
	} );

	it( "returns stable JSON failures without leaking exception details", async () => {
		const error = vi.spyOn( console, "error" ).mockImplementation( () => {} );
		const store = {
			health: async () => { throw new Error( "secret database detail" ); },
			queryTelemetry: async () => { throw new Error( "secret database detail" ); },
		} as never;
		const app = createApiRoutes( {
			store, controllerId: "c1", pollIntervalSec: 300, historyMaxDays: 90, now: () => 1000, lastError: () => null,
		} );
		const health = await app.request( "/health" );
		expect( health.status ).toBe( 200 );
		expect( await health.json() ).toMatchObject( { ok: false, lastError: "database unavailable" } );
		const history = await app.request( "/history?from=0&to=1000" );
		expect( history.status ).toBe( 500 );
		expect( history.headers.get( "content-type" ) ).toContain( "application/json" );
		expect( await history.text() ).toBe( '{"error":"internal server error"}' );
		expect( error ).toHaveBeenCalled();
		error.mockRestore();
	} );
} );

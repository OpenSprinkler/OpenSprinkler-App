/**
 * App ↔ companion /log seam contract: the REAL fetchCompanionLog client walking the REAL
 * Hono route backed by the REAL SQLite provider, with fetch bridged to app.request. Every
 * layer production traffic crosses — differ output, storage, keyset cursor encode/decode,
 * response shape, client validation — runs with no mocks in between.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { createApiRoutes, type ApiDeps } from "../../server/api/routes";
import { SqliteStorageProvider } from "../../server/storage/sqlite";
import { diffTelemetryEvents } from "../../server/events";
import { fetchCompanionLog } from "../../www/src/api/companion";
import type { StoredTelemetry, TelemetrySample } from "../../server/storage/provider";

const sample = ( over: Partial<TelemetrySample> ): TelemetrySample => ( {
	ts: 1000, waterLevel: 100, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
	lastWeatherUpdate: 500, activeStations: 0, rssi: null, currentDraw: null, raw: "{}",
	...over,
} );
const stored = ( over: Partial<StoredTelemetry> ): StoredTelemetry => {
	const { raw: _raw, ...rest } = sample( over );
	return rest;
};

/** Route the client's real fetches into the Hono app; optionally force a small page size. */
function bridgeFetchTo( app: ReturnType<typeof createApiRoutes>, forcedLimit?: number ): void {
	globalThis.fetch = vi.fn( async ( u: RequestInfo | URL ) => {
		const url = new URL( String( u ) );
		const path = url.pathname.replace( /^\/api/, "" );
		if ( forcedLimit && !url.searchParams.has( "limit" ) ) url.searchParams.set( "limit", String( forcedLimit ) );
		return app.request( `${ path }?${ url.searchParams.toString() }` );
	} ) as never;
}

async function makeStore(): Promise<SqliteStorageProvider> {
	const store = new SqliteStorageProvider( ":memory:" );
	await store.init();
	return store;
}

function apiFor( store: SqliteStorageProvider ): ReturnType<typeof createApiRoutes> {
	const deps: ApiDeps = {
		store, controllerId: "c1", pollIntervalSec: 300, historyMaxDays: 90,
		now: () => 100_000, lastError: () => null,
	};
	return createApiRoutes( deps );
}

afterEach( () => vi.restoreAllMocks() );

describe( "app ↔ companion /log contract", () => {
	it( "differ-produced events survive the full round trip byte-identically", async () => {
		const store = await makeStore();
		try {
			// Producer side: two poll cycles' worth of real transitions, exactly as collectOnce derives them.
			const first = diffTelemetryEvents( stored( {} ), sample( { ts: 2000, weatherErr: -3 } ) );
			const second = diffTelemetryEvents(
				stored( { weatherErr: -3 } ),
				sample( { ts: 3000, lastWeatherUpdate: 2900, waterLevel: 85, weatherErr: -3 } ),
			);
			await store.appendEvents( "c1", [ ...first, ...second ] );
			bridgeFetchTo( apiFor( store ) );
			const events = await fetchCompanionLog( "http://companion/", { fromTs: 0, toTs: 99_999 } );
			expect( events ).toEqual( [ ...first, ...second ] );
			expect( events[ 0 ]!.detail ).toContain( "Timed Out" );
			expect( events[ 1 ] ).toMatchObject( { level: "detail" } );
			expect( events[ 1 ]!.detail ).toContain( "85%" );
		} finally { await store.close(); }
	} );

	it( "walks real keyset cursors across pages without loss, duplication, or reordering", async () => {
		const store = await makeStore();
		try {
			const seeded = Array.from( { length: 12 }, ( _, i ) => ( {
				ts: 1000 + i, source: "weather" as const, level: "normal" as const,
				label: "Weather", detail: `event ${ i }`,
			} ) );
			await store.appendEvents( "c1", seeded );
			bridgeFetchTo( apiFor( store ), 5 ); // 12 rows / 5 per page → 3 real cursor hops
			const events = await fetchCompanionLog( "http://companion/", { fromTs: 0, toTs: 99_999 } );
			expect( events.map( ( e ) => e.detail ) ).toEqual( seeded.map( ( e ) => e.detail ) );
			expect( globalThis.fetch ).toHaveBeenCalledTimes( 3 );
		} finally { await store.close(); }
	} );

	it( "scopes to the requested range and returns empty cleanly when nothing matches", async () => {
		const store = await makeStore();
		try {
			await store.appendEvents( "c1", [
				{ ts: 100, source: "weather", level: "normal", label: "Weather", detail: "in range" },
				{ ts: 9000, source: "weather", level: "normal", label: "Weather", detail: "out of range" },
			] );
			bridgeFetchTo( apiFor( store ) );
			const events = await fetchCompanionLog( "http://companion/", { fromTs: 0, toTs: 5000 } );
			expect( events.map( ( e ) => e.detail ) ).toEqual( [ "in range" ] );
			expect( await fetchCompanionLog( "http://companion/", { fromTs: 20_000, toTs: 30_000 } ) ).toEqual( [] );
		} finally { await store.close(); }
	} );

	it( "the client rejects a payload the server contract forbids (tamper guard)", async () => {
		// Not reachable through the real route (enums are validated on write reads back what was
		// written) — this pins the CLIENT side of the contract independently: a compromised or
		// version-skewed companion cannot push out-of-contract rows into the merged Log view.
		const store = await makeStore();
		try {
			const app = apiFor( store );
			globalThis.fetch = vi.fn( async ( u: RequestInfo | URL ) => {
				const url = new URL( String( u ) );
				const res = await app.request( url.pathname.replace( /^\/api/, "" ) + url.search );
				const body = await res.json() as { events: unknown[] };
				body.events = [ { ts: 1, source: "weather", level: "verbose", label: "X", detail: "bad" } ];
				return new Response( JSON.stringify( body ), { status: 200 } );
			} ) as never;
			await expect( fetchCompanionLog( "http://companion/", { fromTs: 0, toTs: 5000 } ) )
				.rejects.toThrow( /invalid level/i );
		} finally { await store.close(); }
	} );
} );

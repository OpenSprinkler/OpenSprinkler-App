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

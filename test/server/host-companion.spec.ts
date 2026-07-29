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
	it( "sends a configured bearer token to every companion endpoint without putting it in URLs", async () => {
		const token = "test-token-0123456789";
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		globalThis.fetch = vi.fn( async ( u: RequestInfo | URL, init?: RequestInit ) => {
			const url = String( u );
			calls.push( { url, init } );
			if ( url.includes( "/api/health" ) ) return { ok: true, json: async () => ( { ok: true } ) } as Response;
			if ( url.includes( "/api/history" ) ) return { ok: true, json: async () => ( { telemetry: [] } ) } as Response;
			return { ok: true, json: async () => ( { rows: [] } ) } as Response;
		} ) as never;

		await expect( resolveHistoryHtml( "https://companion.example/", () => 1000, token ) )
			.resolves.toContain( "History" );
		expect( calls ).toHaveLength( 3 );
		for ( const call of calls ) {
			expect( call.url ).not.toContain( token );
			expect( call.init?.headers ).toMatchObject( { Authorization: `Bearer ${ token }` } );
		}
	} );
	it( "returns undefined when the companion is absent (graceful degradation)", async () => {
		globalThis.fetch = vi.fn( async () => { throw new Error( "down" ); } ) as never;
		expect( await resolveHistoryHtml( "http://c/", () => 1000 ) ).toBeUndefined();
	} );
	it( "returns undefined when health succeeds but a history endpoint fails or is malformed", async () => {
		globalThis.fetch = vi.fn( async ( u: RequestInfo | URL ) => {
			if ( String( u ).includes( "/api/health" ) ) return { ok: true, json: async () => ( { ok: true } ) } as Response;
			return { ok: false, status: 500, json: async () => ( { error: "down" } ) } as Response;
		} ) as never;
		await expect( resolveHistoryHtml( "http://c/", () => 1000 ) ).resolves.toBeUndefined();
	} );
	it( "aborts the sibling history request when either endpoint fails", async () => {
		let siblingAborted = false;
		globalThis.fetch = vi.fn( async ( u: RequestInfo | URL, init?: RequestInit ) => {
			const url = String( u );
			if ( url.includes( "/api/health" ) ) return { ok: true, json: async () => ( { ok: true } ) } as Response;
			if ( url.includes( "/api/history" ) ) return { ok: false, status: 500, json: async () => ( {} ) } as Response;
			return new Promise<Response>( ( _resolve, reject ) => {
				init?.signal?.addEventListener( "abort", () => {
					siblingAborted = true;
					reject( new DOMException( "Aborted", "AbortError" ) );
				}, { once: true } );
			} );
		} ) as typeof fetch;
		await expect( resolveHistoryHtml( "http://c/", () => 1000 ) ).resolves.toBeUndefined();
		expect( siblingAborted ).toBe( true );
	} );
} );

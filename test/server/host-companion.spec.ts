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
	it( "returns undefined when the companion is absent (graceful degradation)", async () => {
		globalThis.fetch = vi.fn( async () => { throw new Error( "down" ); } ) as never;
		expect( await resolveHistoryHtml( "http://c/", () => 1000 ) ).toBeUndefined();
	} );
} );

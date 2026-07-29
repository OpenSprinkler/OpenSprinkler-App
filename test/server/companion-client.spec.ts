// test/server/companion-client.spec.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
	detectCompanion, fetchHistory, fetchRunLog, normalizeCompanionBase, CompanionError,
} from "../../www/src/api/companion";

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

	it( "follows bounded opaque cursors without silently truncating history", async () => {
		const urls: string[] = [];
		const point = {
			ts: 1, waterLevel: 100, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
			lastWeatherUpdate: 1, activeStations: 0, rssi: null, currentDraw: null,
		};
		globalThis.fetch = vi.fn( async ( u: RequestInfo | URL ) => {
			urls.push( String( u ) );
			return { ok: true, json: async () => urls.length === 1
				? ( { telemetry: [ point ], nextCursor: "cursor_one" } )
				: ( { telemetry: [ { ...point, ts: 2 } ], nextCursor: null } ) } as Response;
		} ) as never;
		await expect( fetchHistory( "http://c/", { fromTs: 1, toTs: 2 } ) ).resolves.toHaveLength( 2 );
		expect( urls[ 1 ] ).toBe( "http://c/api/history?from=1&to=2&cursor=cursor_one" );
	} );

	it( "rejects a repeated continuation cursor", async () => {
		const point = {
			ts: 1, waterLevel: 100, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
			lastWeatherUpdate: 1, activeStations: 0, rssi: null, currentDraw: null,
		};
		globalThis.fetch = vi.fn( async () => ( {
			ok: true, json: async () => ( { telemetry: [ point ], nextCursor: "same_cursor" } ),
		} ) as Response ) as never;
		await expect( fetchHistory( "http://c/", { fromTs: 1, toTs: 2 } ) ).rejects.toThrow( /continuation cursor/i );
	} );

	it( "adds optional bearer auth without putting the token in the URL", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		globalThis.fetch = vi.fn( async ( u: RequestInfo | URL, init?: RequestInit ) => {
			calls.push( { url: String( u ), init } );
			return { ok: true, json: async () => ( { telemetry: [] } ) } as Response;
		} ) as never;
		await fetchHistory( "https://c/", { fromTs: 1, toTs: 2 }, { token: "0123456789abcdef", timeoutMs: 100 } );
		expect( calls[ 0 ]?.url ).not.toContain( "0123456789abcdef" );
		expect( calls[ 0 ]?.init?.headers ).toMatchObject( { Authorization: "Bearer 0123456789abcdef" } );
	} );

	it( "never sends a bearer token over plaintext except to loopback", async () => {
		const fetchMock = vi.fn( async () => ( {
			ok: true, json: async () => ( { telemetry: [] } ),
		} ) as Response );
		globalThis.fetch = fetchMock as typeof fetch;
		const range = { fromTs: 1, toTs: 2 };
		const authenticated = { token: "0123456789abcdef", timeoutMs: 100 };

		await expect( fetchHistory( "http://192.0.2.10/", range, authenticated ) )
			.rejects.toThrow( /must use HTTPS/i );
		expect( fetchMock ).not.toHaveBeenCalled();
		await expect( fetchHistory( "http://127.0.0.1:8080/", range, authenticated ) ).resolves.toEqual( [] );
	} );

	it( "rejects bearer handoff from a plaintext non-loopback dashboard and invalid header values", () => {
		const token = "0123456789abcdef";
		expect( () => normalizeCompanionBase(
			"https://companion.example/", token, "http://192.0.2.20/",
		) ).toThrow( /dashboards must themselves use HTTPS/i );
		expect( normalizeCompanionBase(
			"https://companion.example/", token, "http://127.0.0.1:8080/",
		) ).toBe( "https://companion.example/" );
		expect( () => normalizeCompanionBase(
			"https://companion.example/", "01234567\n89abcdef", "https://dashboard.example/",
		) ).toThrow( /visible ASCII/i );
	} );

	it( "checks status and validates history/run-log payload fields", async () => {
		globalThis.fetch = vi.fn( async () => ( { ok: false, status: 500, json: async () => ( {} ) } ) as Response ) as never;
		await expect( fetchHistory( "http://c/", { fromTs: 1, toTs: 2 } ) ).rejects.toBeInstanceOf( CompanionError );

		globalThis.fetch = vi.fn( async () => ( {
			ok: true, json: async () => ( { telemetry: [ { ts: 1, waterLevel: 100 } ] } ),
		} ) as Response ) as never;
		await expect( fetchHistory( "http://c/", { fromTs: 1, toTs: 2 } ) ).rejects.toThrow( /rain delay/i );

		globalThis.fetch = vi.fn( async () => ( {
			ok: true, json: async () => ( { rows: [ {
				program: 1, station: "<img onerror=alert(1)>", durationSec: 60, endTs: 2, flowGpm: null,
			} ] } ),
		} ) as Response ) as never;
		await expect( fetchRunLog( "http://c/", { fromTs: 1, toTs: 2 } ) ).rejects.toThrow( /station/i );
	} );

	it( "bounds optional companion detection with a timeout", async () => {
		globalThis.fetch = vi.fn( async ( _url: RequestInfo | URL, init?: RequestInit ) => new Promise<Response>( ( _resolve, reject ) => {
			init?.signal?.addEventListener( "abort", () => reject( new DOMException( "Aborted", "AbortError" ) ) );
		} ) ) as unknown as typeof fetch;
		await expect( detectCompanion( "http://c/", 5 ) ).resolves.toBeNull();
	} );

	it( "bounds companion response-body parsing even when a fetch mock ignores abort", async () => {
		globalThis.fetch = vi.fn( async () => ( {
			ok: true, json: () => new Promise<unknown>( () => {} ),
		} ) as Response ) as typeof fetch;
		await expect( fetchHistory( "http://c/", { fromTs: 1, toTs: 2 }, 5 ) )
			.rejects.toThrow( /timed out after 5ms/i );
	} );

	it( "cancels an in-flight page walk from an external lifecycle signal", async () => {
		globalThis.fetch = vi.fn( () => new Promise<Response>( () => {} ) ) as typeof fetch;
		const abort = new AbortController();
		const pending = fetchHistory( "http://c/", { fromTs: 1, toTs: 2 }, {
			timeoutMs: 1000, totalTimeoutMs: 1000, signal: abort.signal,
		} );
		abort.abort();
		await expect( pending ).rejects.toThrow( /cancelled/i );
	} );

	it( "applies one deadline to the complete paginated request", async () => {
		let calls = 0;
		globalThis.fetch = vi.fn( async () => {
			calls++;
			if ( calls === 1 ) return {
				ok: true, json: async () => ( { telemetry: [], nextCursor: "next_page" } ),
			} as Response;
			return new Promise<Response>( () => {} );
		} ) as typeof fetch;
		await expect( fetchHistory( "http://c/", { fromTs: 1, toTs: 2 }, {
			timeoutMs: 1000, totalTimeoutMs: 5,
		} ) ).rejects.toThrow( /pagination timed out after 5ms/i );
		expect( calls ).toBe( 2 );
	} );

	it( "rejects invalid request and pagination timeouts before transport", async () => {
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as typeof fetch;
		await expect( fetchHistory( "http://c/", { fromTs: 1, toTs: 2 }, { timeoutMs: 0 } ) ).rejects.toThrow( /request timeout/i );
		await expect( fetchHistory( "http://c/", { fromTs: 1, toTs: 2 }, { totalTimeoutMs: 0 } ) ).rejects.toThrow( /total timeout/i );
		expect( fetchMock ).not.toHaveBeenCalled();
	} );
} );

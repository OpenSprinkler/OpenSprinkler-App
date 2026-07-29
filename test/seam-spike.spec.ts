/**
 * Seam spike integration test — proves the end-to-end pipeline
 * (firmware globals → seam auth/base → typed client → render) against a MOCKED transport.
 *
 * This is the unit-level proof. The remaining LAN+OTC proof requires a live device (hardware step).
 *
 *   npm run test:contract
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { bootStatusSpike } from "../www/src/spike/boot";
import {
	BrowserDeviceSeam, normalizeHttpBase, resolveDeviceBaseFromLocation, selectBootstrapDeviceBase,
} from "../www/src/seam/device";

function fixtureText( name: string ): string {
	const url = new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url );
	return readFileSync( fileURLToPath( url ), "utf8" );
}

/** Build a fetch mock that routes by path to the fixtures + an /sp auth result. */
function mockFetch( spResult = 0 ): typeof fetch {
	return vi.fn( async ( input: RequestInfo | URL ) => {
		const url = String( input );
		const body =
			url.includes( "/jc" ) ? fixtureText( "jc" ) :
			url.includes( "/jo" ) ? fixtureText( "jo" ) :
			url.includes( "/sp" ) ? JSON.stringify( { result: spResult } ) :
			"null";
		return { ok: true, status: 200, statusText: "OK", json: async () => JSON.parse( body ) } as Response;
	} ) as unknown as typeof fetch;
}

const md5 = ( s: string ): string => "hash_" + s; // stand-in for www/js/hasher.js md5

describe( "seam spike: LAN status pipeline", () => {
	beforeEach( () => {
		( globalThis as Record<string, unknown> ).ver = 221;
		( globalThis as Record<string, unknown> ).ipas = 0;
		globalThis.fetch = mockFetch( 0 );
	} );
	afterEach( () => { vi.restoreAllMocks(); } );

	it( "boots, authenticates, fetches /jc+/jo and renders the status screen", async () => {
		const html = await bootStatusSpike( { baseUrl: "http://192.168.1.50/", password: "secret", md5 } );
		expect( html ).toContain( "Backyard Controller" );
		expect( html ).toContain( "2.2.1" );        // fwv 221
		expect( html ).toContain( "100%" );          // water level
		expect( html ).toContain( "Active stations" );
		expect( html ).toContain( "Enabled" );       // jc.en = 1
	} );

	it( "uses md5(pw) auth for fwv>=213 and the /sp check", async () => {
		const f = mockFetch( 0 );
		globalThis.fetch = f;
		await bootStatusSpike( { baseUrl: "http://192.168.1.50/", password: "secret", md5 } );
		const calls = ( f as unknown as { mock: { calls: unknown[][] } } ).mock.calls.map( ( c ) => String( c[ 0 ] ) );
		expect( calls.some( ( u ) => u.includes( "/sp?pw=hash_secret" ) ) ).toBe( true ); // hashed
		expect( calls.some( ( u ) => u.includes( "/jc" ) && u.includes( "pw=hash_secret" ) ) ).toBe( true );
	} );

	it( "fails closed when /sp rejects the password", async () => {
		globalThis.fetch = mockFetch( 2 ); // result>1 = invalid
		await expect(
			bootStatusSpike( { baseUrl: "http://192.168.1.50/", password: "wrong", md5 } )
		).rejects.toThrow( /authentication failed/ );
	} );

	it( "skips auth when ipas=1 (ignore password)", async () => {
		( globalThis as Record<string, unknown> ).ipas = 1;
		const html = await bootStatusSpike( { baseUrl: "http://192.168.1.50/", md5 } );
		expect( html ).toContain( "Backyard Controller" );
	} );
} );

describe( "seam spike: OTC remote path is uniform with LAN", () => {
	beforeEach( () => {
		( globalThis as Record<string, unknown> ).ver = 221;
		( globalThis as Record<string, unknown> ).ipas = 1;
		globalThis.fetch = mockFetch( 0 );
	} );
	afterEach( () => vi.restoreAllMocks() );

	it( "renders identically when baseUrl is an OTC forward URL", async () => {
		const html = await bootStatusSpike( {
			baseUrl: "https://cloud.openthings.io/forward/v1/DEVICETOKEN/",
			md5,
		} );
		expect( html ).toContain( "Backyard Controller" );
	} );
} );

describe( "device base resolution (home.js parity)", () => {
	it( "sanitizes invalid controller JSON without retaining response fragments", async () => {
		const secret = "OT0123456789abcdef-controller-secret";
		const previousFetch = globalThis.fetch;
		globalThis.fetch = vi.fn( async () => new Response(
			`{"otc":"${ secret }","broken":invalid}`,
			{ status: 200, headers: { "Content-Type": "application/json" } },
		) ) as typeof fetch;
		try {
			const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", requestTimeoutMs: 1000 } );
			let error: unknown;
			try { await seam.requestJson( "jc?pw=must-not-appear" ); } catch ( cause ) { error = cause; }
			expect( String( error ) ).toBe( "ControllerResponseError: Device returned an invalid JSON response (jc)." );
			expect( String( error ) ).not.toContain( secret );
			expect( String( error ) ).not.toContain( "must-not-appear" );
		} finally { globalThis.fetch = previousFetch; }
	} );

	it( "never sends a firmware-page request to a hostile handoff override", async () => {
		const selected = selectBootstrapDeviceBase( {
			firmwarePage: true,
			pageHref: "https://cloud.openthings.io/forward/v1/REAL_TOKEN/index.html#base=https://attacker.example/",
			configuredBase: "https://attacker.example/",
			savedBase: "https://stale.example/",
		} );
		expect( selected ).toBe( "https://cloud.openthings.io/forward/v1/REAL_TOKEN/" );
		const calls: string[] = [];
		const previousFetch = globalThis.fetch;
		globalThis.fetch = vi.fn( async ( input: RequestInfo | URL ) => {
			calls.push( String( input ) );
			return { ok: true, status: 200, json: async () => ( { result: 0 } ) } as Response;
		} ) as typeof fetch;
		try {
			const seam = new BrowserDeviceSeam( { baseUrl: selected!, ver: 221, requestTimeoutMs: 1000 } );
			const auth = await seam.authenticate( "controller-password", 221, md5 );
			await new BrowserDeviceSeam( {
				baseUrl: selected!, ver: 221, pwHash: auth.pwHash, requestTimeoutMs: 1000,
			} ).requestJson( "jc" );
		} finally {
			globalThis.fetch = previousFetch;
		}
		expect( calls ).toHaveLength( 2 );
		expect( calls.every( ( url ) => url.startsWith( selected! ) ) ).toBe( true );
		expect( calls.join( "" ) ).not.toContain( "attacker.example" );

		expect( selectBootstrapDeviceBase( {
			firmwarePage: false, pageHref: "https://ui.example/", configuredBase: "https://chosen.example/",
			savedBase: "https://saved.example/",
		} ) ).toBe( "https://chosen.example/" );
	} );

	it( "normalizes HTTP bases and rejects malformed or credential-bearing configuration", () => {
		expect( normalizeHttpBase( "../controller", "https://example.test/ui/" ) ).toBe( "https://example.test/controller/" );
		expect( () => normalizeHttpBase( "not a valid URL", "not a URL" ) ).toThrow( /invalid service URL/i );
		expect( () => normalizeHttpBase( "javascript:alert(1)", "https://example.test/" ) ).toThrow( /http/i );
		expect( () => normalizeHttpBase( "https://user:secret@example.test/", "https://example.test/" ) ).toThrow( /credentials/i );
	} );

	it( "uses the page directory and preserves an OTC forwarding prefix", () => {
		expect( resolveDeviceBaseFromLocation( "http://192.168.1.50/index.html?x=1" ) ).toBe( "http://192.168.1.50/" );
		expect( resolveDeviceBaseFromLocation( "https://cloud.openthings.io/forward/v1/T/" ) ).toBe( "https://cloud.openthings.io/forward/v1/T/" );
		expect( resolveDeviceBaseFromLocation( "https://cloud.openthings.io/forward/v1/T/index.html?x=1" ) ).toBe( "https://cloud.openthings.io/forward/v1/T/" );
	} );

	it( "buildUrl appends the hashed pw param", () => {
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", pwHash: "abc" } );
		expect( seam.buildUrl( "jc" ) ).toBe( "http://d/jc?pw=abc" );
		expect( seam.buildUrl( "jl?type=2" ) ).toBe( "http://d/jl?type=2&pw=abc" );
	} );
} );

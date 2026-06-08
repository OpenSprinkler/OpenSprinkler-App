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
import { BrowserDeviceSeam, resolveDeviceBaseFromLocation } from "../www/src/seam/device";

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
	it( "extracts the origin from a location href", () => {
		expect( resolveDeviceBaseFromLocation( "http://192.168.1.50/index.html?x=1" ) ).toBe( "http://192.168.1.50/" );
		expect( resolveDeviceBaseFromLocation( "https://cloud.openthings.io/forward/v1/T/" ) ).toBe( "https://cloud.openthings.io/" );
	} );

	it( "buildUrl appends the hashed pw param", () => {
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", pwHash: "abc" } );
		expect( seam.buildUrl( "jc" ) ).toBe( "http://d/jc?pw=abc" );
		expect( seam.buildUrl( "jl?type=2" ) ).toBe( "http://d/jl?type=2&pw=abc" );
	} );
} );

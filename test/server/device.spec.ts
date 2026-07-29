import { describe, it, expect, vi, afterEach } from "vitest";
import { ControllerAuthError, createDeviceClient } from "../../server/device";
import { md5 } from "../../www/src/auth/md5";

afterEach( () => vi.restoreAllMocks() );

const status = {
	devt: 0, lwc: 0, lswc: 0, lupt: 0, sunrise: 360, sunset: 1080,
	en: 1, rd: 0, rdst: 0, pq: 0, nq: 0, ocs: 0,
	wterr: 0, wtrestr: 0, wls: [], wtdata: {}, nbrd: 1, lrun: [ 0, 0, 0, 0 ],
	ps: Array.from( { length: 8 }, () => [ 0, 0, 0, 0 ] ), sbits: [ 0, 0 ], eip: 0, mac: "aa:bb",
};
function response( body: unknown, ok = true ): Response {
	return { ok, status: ok ? 200 : 500, statusText: ok ? "OK" : "Error", json: async () => body } as Response;
}

describe( "createDeviceClient", () => {
	it( "probes, validates md5 auth, and returns a tested client", async () => {
		const urls: string[] = [];
		globalThis.fetch = vi.fn( async ( input: RequestInfo | URL ) => {
			const url = String( input ); urls.push( url );
			if ( url.endsWith( "/jo" ) ) return response( { fwv: 221 } );
			if ( url.includes( "/sp?" ) ) return response( { result: url.includes( md5( "test-password-42" ) ) ? 1 : 2 } );
			return response( status );
		} ) as typeof fetch;
		const { client, fwv, status: probed } = await createDeviceClient( {
			controllerBase: "http://d/", controllerPw: "test-password-42", controllerTimeoutMs: 1000,
		} );
		expect( fwv ).toBe( 221 );
		expect( probed.mac ).toBe( "aa:bb" );
		await client.getControllerStatus();
		expect( urls.some( ( url ) => url.includes( `/sp?pw=${ md5( "test-password-42" ) }` ) ) ).toBe( true );
		expect( urls.some( ( url ) => url.includes( `/jc?pw=${ md5( "test-password-42" ) }` ) ) ).toBe( true );
	} );

	it( "never falls back to cleartext auth on modern firmware", async () => {
		const urls: string[] = [];
		globalThis.fetch = vi.fn( async ( input: RequestInfo | URL ) => {
			const url = String( input ); urls.push( url );
			if ( url.endsWith( "/jo" ) ) return response( { fwv: 221 } );
			if ( url.includes( "/sp?" ) ) return response( { result: 2 } );
			return response( status );
		} ) as typeof fetch;
		await expect( createDeviceClient( { controllerBase: "http://d/", controllerPw: "test-password-42" } ) )
			.rejects.toBeInstanceOf( ControllerAuthError );
		const authUrls = urls.filter( ( url ) => url.includes( "/sp?" ) );
		expect( authUrls ).toHaveLength( 1 );
		expect( authUrls[ 0 ] ).toContain( `pw=${ md5( "test-password-42" ) }` );
		expect( authUrls[ 0 ] ).not.toContain( "pw=test-password-42" );
	} );

	it( "rejects a stale old-firmware override before sending credentials to a modern controller", async () => {
		const urls: string[] = [];
		globalThis.fetch = vi.fn( async ( input: RequestInfo | URL ) => {
			const url = String( input );
			urls.push( url );
			return response( { fwv: 221 } );
		} ) as typeof fetch;
		await expect( createDeviceClient( {
			controllerBase: "http://d/", controllerPw: "test-password-42", controllerFwv: 1,
		} ) ).rejects.toThrow( /does not match/i );
		expect( urls ).toHaveLength( 1 );
		expect( urls[ 0 ] ).toBe( "http://d/jo" );
		expect( urls.join( "" ) ).not.toContain( "test-password-42" );
	} );

	it( "rejects an unpinned legacy-version downgrade before sending cleartext credentials", async () => {
		const urls: string[] = [];
		globalThis.fetch = vi.fn( async ( input: RequestInfo | URL ) => {
			const url = String( input );
			urls.push( url );
			return response( { fwv: 212 } );
		} ) as typeof fetch;
		await expect( createDeviceClient( {
			controllerBase: "http://d/", controllerPw: "test-password-42",
		} ) ).rejects.toThrow( /refusing unpinned legacy cleartext authentication/i );
		expect( urls ).toEqual( [ "http://d/jo" ] );
		expect( urls.join( "" ) ).not.toContain( "test-password-42" );
	} );

	it( "uses legacy cleartext authentication only with an exact explicit firmware pin", async () => {
		const urls: string[] = [];
		globalThis.fetch = vi.fn( async ( input: RequestInfo | URL ) => {
			const url = String( input );
			urls.push( url );
			if ( url.endsWith( "/jo" ) ) return response( { fwv: 212 } );
			if ( url.includes( "/sp?" ) ) return response( { result: url.includes( "pw=test-password-42" ) ? 1 : 2 } );
			return response( status );
		} ) as typeof fetch;
		await expect( createDeviceClient( {
			controllerBase: "http://d/", controllerPw: "test-password-42", controllerFwv: 212,
		} ) ).resolves.toMatchObject( { fwv: 212 } );
		expect( urls.some( ( url ) => url.includes( "/sp?pw=test-password-42" ) ) ).toBe( true );
	} );

	it( "rejects invalid or missing credentials", async () => {
		globalThis.fetch = vi.fn( async ( input: RequestInfo | URL ) => {
			const url = String( input );
			if ( url.endsWith( "/jo" ) ) return response( { fwv: 221 } );
			if ( url.includes( "/sp?" ) ) return response( { result: 2 } );
			return response( { result: 2 } );
		} ) as typeof fetch;
		await expect( createDeviceClient( { controllerBase: "http://d/", controllerPw: "wrong" } ) )
			.rejects.toBeInstanceOf( ControllerAuthError );
		await expect( createDeviceClient( { controllerBase: "http://d/" } ) )
			.rejects.toThrow( /password is required/ );
	} );

	it( "bounds a controller request even when fetch never settles", async () => {
		globalThis.fetch = vi.fn( () => new Promise<Response>( () => {} ) ) as typeof fetch;
		await expect( createDeviceClient( { controllerBase: "http://d/", controllerTimeoutMs: 20 } ) )
			.rejects.toThrow( /timed out after 20ms/ );
	} );

	it( "honors poller cancellation before the configured request timeout", async () => {
		globalThis.fetch = vi.fn( () => new Promise<Response>( () => {} ) ) as typeof fetch;
		const abort = new AbortController();
		const pending = createDeviceClient( {
			controllerBase: "http://d/", controllerTimeoutMs: 300000,
		}, abort.signal );
		abort.abort();
		await expect( pending ).rejects.toThrow( /cancelled/i );
	} );

	it( "allows a verified ipas controller without a password", async () => {
		globalThis.fetch = vi.fn( async ( input: RequestInfo | URL ) =>
			String( input ).endsWith( "/jo" ) ? response( { fwv: 221, ipas: 1 } ) : response( status ) ) as typeof fetch;
		await expect( createDeviceClient( { controllerBase: "http://d/" } ) ).resolves.toMatchObject( { fwv: 221 } );
	} );
} );

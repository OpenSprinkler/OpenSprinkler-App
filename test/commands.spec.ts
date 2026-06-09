/**
 * Command tests — the typed mutation methods build the right paths and surface firmware result
 * codes as CommandError; the seam transports change commands as GET (fwv<300) or POST-with-body
 * (fwv>=300), injecting the pw hash. Proven without a device.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OsApiClient, CommandError } from "../www/src/api/client";
import { BrowserDeviceSeam, type DeviceSeam } from "../www/src/seam/device";

/** Mock seam that records the last runCommand path and returns a configurable result. */
class MockSeam implements DeviceSeam {
	readonly config = { baseUrl: "http://d/" };
	lastPath = "";
	result = 1;
	async requestJson(): Promise<unknown> { return {}; }
	async runCommand( path: string ): Promise<unknown> { this.lastPath = path; return { result: this.result }; }
}

describe( "typed command paths", () => {
	const seam = new MockSeam();
	const api = new OsApiClient( seam );
	const cases: Array<[ () => Promise<unknown>, string ]> = [
		[ () => api.startStation( 2, 60 ), "cm?sid=2&en=1&t=60" ],
		[ () => api.stopStation( 2 ), "cm?sid=2&en=0" ],
		[ () => api.runOnce( [ 300, 0, 600 ] ), "cr?t=" + encodeURIComponent( "[300,0,600,0]" ) ],
		[ () => api.setRainDelayHours( 2 ), "cv?rd=2" ],
		[ () => api.cancelRainDelay(), "cv?rd=0" ],
		[ () => api.stopAllStations(), "cv?rsn=1" ],
		[ () => api.setControllerEnabled( false ), "cv?en=0" ],
		[ () => api.reboot(), "cv?rbt=1" ],
		[ () => api.clearOvercurrent(), "cv?rocs=1" ],
		[ () => api.deleteProgram( 1 ), "dp?pid=1" ],
		[ () => api.submitOptions( { wl: 120, uwt: 1 } ), "co?wl=120&uwt=1" ],
	];
	for ( const [ run, expected ] of cases ) {
		it( `builds ${ expected }`, async () => {
			await run();
			expect( seam.lastPath ).toBe( expected );
		} );
	}
} );

describe( "getLogs sends the firmware-required start/end range", () => {
	function captureSeam(): { seam: DeviceSeam; get: () => string } {
		let captured = "";
		const seam = {
			config: { baseUrl: "http://d/" },
			async requestJson( p: string ) { captured = p; return []; },
			async runCommand() { return { result: 1 }; },
		} as unknown as DeviceSeam;
		return { seam, get: () => captured };
	}
	it( "defaults to a 7-day window ending now (end padded by 86340s)", async () => {
		const c = captureSeam();
		await new OsApiClient( c.seam ).getLogs( { now: 1_700_000_000_000 } );
		const end = Math.floor( 1_700_000_000_000 / 1000 );
		expect( c.get() ).toBe( `jl?start=${ end - 7 * 86400 }&end=${ end + 86340 }` );
	} );
	it( "accepts an explicit range + type", async () => {
		const c = captureSeam();
		await new OsApiClient( c.seam ).getLogs( { start: 100, end: 200, type: "fl" } );
		expect( c.get() ).toBe( `jl?start=100&end=${ 200 + 86340 }&type=fl` );
	} );
} );

describe( "command result handling", () => {
	it( "throws CommandError with the firmware code on non-success", async () => {
		const seam = new MockSeam();
		seam.result = 2; // unauthorized
		const api = new OsApiClient( seam );
		await expect( api.stopAllStations() ).rejects.toBeInstanceOf( CommandError );
		await expect( api.stopAllStations() ).rejects.toThrow( /Unauthorized/ );
	} );
} );

describe( "seam runCommand transport", () => {
	afterEach( () => vi.restoreAllMocks() );

	function captureFetch(): { calls: Array<{ url: string; init: RequestInit }> } {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		globalThis.fetch = vi.fn( async ( url: RequestInfo | URL, init?: RequestInit ) => {
			calls.push( { url: String( url ), init: init ?? {} } );
			return { ok: true, status: 200, statusText: "OK", json: async () => ( { result: 1 } ) } as Response;
		} ) as unknown as typeof fetch;
		return { calls };
	}

	it( "uses GET with the pw query for fwv<300", async () => {
		const cap = captureFetch();
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", pwHash: "abc", ver: 221 } );
		await seam.runCommand( "cv?rd=2" );
		expect( cap.calls[ 0 ]!.url ).toBe( "http://d/cv?rd=2&pw=abc" );
		expect( cap.calls[ 0 ]!.init.method ).toBe( "GET" );
	} );

	it( "uses POST with the params + pw in the body for fwv>=300", async () => {
		const cap = captureFetch();
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", pwHash: "abc", ver: 300 } );
		await seam.runCommand( "cs?s0=Front" );
		expect( cap.calls[ 0 ]!.url ).toBe( "http://d/cs" );            // query stripped from URL
		expect( cap.calls[ 0 ]!.init.method ).toBe( "POST" );
		expect( cap.calls[ 0 ]!.init.body ).toBe( "s0=Front&pw=abc" );  // params + pw in body
	} );
} );

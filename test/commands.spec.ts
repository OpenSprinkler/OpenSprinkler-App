/**
 * Command tests — the typed mutation methods build the right paths and surface firmware result
 * codes as CommandError; the seam transports change commands as GET (fwv<300) or POST-with-body
 * (fwv>=300), injecting the pw hash. Proven without a device.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OsApiClient, CommandError } from "../www/src/api/client";
import { BrowserDeviceSeam, type DeviceSeam } from "../www/src/seam/device";
import type { OSProgram } from "../www/src/api/types";

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
	const program: OSProgram = [ 3, 127, 0, [ 360, -1, -1, -1 ], [ 600 ], "Morning", [ 0, 0, 0 ] ];
	const cases: Array<[ () => Promise<unknown>, string ]> = [
		[ () => api.startStation( 2, 60 ), "cm?sid=2&en=1&t=60" ],
		[ () => api.stopStation( 2 ), "cm?sid=2&en=0" ],
		[ () => api.runOnce( [ 300, 0, 600 ] ), "cr?t=" + encodeURIComponent( "[300,0,600,0]" ) + "&uwt=0&qo=0" ],
		[ () => api.runProgramNow( 2, program ), "mp?pid=2&uwt=1&qo=0" ],
		[ () => api.setRainDelayHours( 2 ), "cv?rd=2" ],
		[ () => api.cancelRainDelay(), "cv?rd=0" ],
		[ () => api.stopAllStations(), "cv?rsn=1" ],
		[ () => api.setControllerEnabled( false ), "cv?en=0" ],
		[ () => api.reboot(), "cv?rbt=1" ],
		[ () => api.clearOvercurrent(), "cv?rocs=1" ],
		[ () => api.deleteProgram( 1 ), "dp?pid=1" ],
		[ () => api.setProgramEnabled( 1, program, false ), "cp?pid=1&en=0" ],
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
	it( "defaults to exactly 7 inclusive controller calendar days ending at an explicit controller time", async () => {
		const c = captureSeam();
		const end = 1_700_000_000;
		await new OsApiClient( c.seam ).getLogs( { end } );
		expect( c.get() ).toBe( `jl?start=${ end - 6 * 86400 }&end=${ end }` );
	} );
	it( "accepts an explicit range + type", async () => {
		const c = captureSeam();
		await new OsApiClient( c.seam ).getLogs( { start: 100, end: 200, type: "fl" } );
		expect( c.get() ).toBe( "jl?start=100&end=200&type=fl" );
	} );
	it( "requires an explicit controller-wall end before transport", () => {
		const c = captureSeam();
		expect( () => new OsApiClient( c.seam ).getLogs( {} as never ) ).toThrow( /controller-wall log end/i );
		expect( c.get() ).toBe( "" );
	} );
	it( "rejects malformed ranges, days, and types before transport", () => {
		for ( const options of [
			{ start: Number.NaN, end: 200 }, { start: 201, end: 200 }, { start: 1.5, end: 200 },
			{ start: 0, end: 0x100000000 }, { end: Number.POSITIVE_INFINITY }, { end: 200, days: 0 },
			{ start: 100, end: 200, type: "toolong" },
		] ) {
			const c = captureSeam();
			expect( () => new OsApiClient( c.seam ).getLogs( options ) ).toThrow();
			expect( c.get() ).toBe( "" );
		}
	} );
} );

describe( "pre-auth bootstrap probe", () => {
	it( "returns firmware and ignore-password state without requiring injected globals", async () => {
		const seam = {
			config: { baseUrl: "http://d/" },
			async requestJson() { return { fwv: 221, ipas: 1 }; },
			async runCommand() { return { result: 1 }; },
		} as DeviceSeam;
		await expect( new OsApiClient( seam ).probeBootstrap() ).resolves.toEqual( { fwv: 221, ipas: 1 } );
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

	it( "redacts all command parameters, including provider keys", async () => {
		const seam = new MockSeam();
		seam.result = 2;
		const api = new OsApiClient( seam );
		let error: unknown;
		try { await api.submitOptions( { wto: '"key":"TOPSECRET"' } ); }
		catch ( e ) { error = e; }
		expect( String( error ) ).toContain( "[co]" );
		expect( String( error ) ).not.toContain( "TOPSECRET" );
	} );

	it( "rejects fractional or non-positive rain-delay values before transport", () => {
		const seam = new MockSeam();
		const api = new OsApiClient( seam );
		expect( () => api.setRainDelayHours( 0.5 ) ).toThrow( /whole number/i );
		expect( () => api.setRainDelayHours( 0 ) ).toThrow( /positive/i );
		expect( () => api.setRainDelayHours( 8761 ) ).toThrow( /8760/i );
		expect( seam.lastPath ).toBe( "" );
	} );

	it( "rejects the firmware delete-all sentinel and malformed program indexes before transport", () => {
		const seam = new MockSeam();
		const api = new OsApiClient( seam );
		for ( const pid of [ -1, 0.5, 256, Number.NaN ] ) expect( () => api.deleteProgram( pid ) ).toThrow( /program index/i );
		expect( seam.lastPath ).toBe( "" );
	} );

	it( "rejects malformed station indexes and non-finite command durations", () => {
		const seam = new MockSeam();
		const api = new OsApiClient( seam );
		expect( () => api.stopStation( -1 ) ).toThrow( /station index/i );
		expect( () => api.stopStation( 256 ) ).toThrow( /station index/i );
		expect( () => api.startStation( 0, Number.NaN ) ).toThrow( /duration/i );
		expect( () => api.startStation( 0, 0.1 ) ).toThrow( /64800/i );
		expect( () => api.startStation( 0, 64801 ) ).toThrow( /64800/i );
		expect( () => api.runOnce( [ 60, Number.POSITIVE_INFINITY ] ) ).toThrow( /durations/i );
		expect( seam.lastPath ).toBe( "" );
	} );

	it( "accepts uint8 mutation indexes and rejects the first out-of-range value", async () => {
		const seam = new MockSeam();
		const api = new OsApiClient( seam );
		await api.stopStation( 255 );
		expect( seam.lastPath ).toBe( "cm?sid=255&en=0" );
		await api.deleteProgram( 255 );
		expect( seam.lastPath ).toBe( "dp?pid=255" );
	} );

	it( "bounds run-once payloads and validates queue choices at runtime", async () => {
		const fresh = (): { seam: MockSeam; api: OsApiClient } => {
			const seam = new MockSeam();
			return { seam, api: new OsApiClient( seam ) };
		};
		for ( const durations of [ [], Array( 256 ).fill( 0 ), [ -1 ], [ 65536 ] ] ) {
			const { seam, api } = fresh();
			expect( () => api.runOnce( durations ) ).toThrow( /run-once/i );
			expect( seam.lastPath ).toBe( "" );
		}
		const runOnce = fresh();
		expect( () => runOnce.api.runOnce( [ 60 ], { queueOption: 3 as 0 | 1 | 2 } ) ).toThrow( /queue option/i );
		expect( runOnce.seam.lastPath ).toBe( "" );
		const maxRunOnce = fresh();
		await maxRunOnce.api.runOnce( Array( 255 ).fill( 65535 ), { queueOption: 2 } );
		const maxParams = new URLSearchParams( maxRunOnce.seam.lastPath.split( "?" )[ 1 ] );
		const maxDurations = JSON.parse( maxParams.get( "t" ) ?? "[]" ) as number[];
		expect( maxDurations ).toHaveLength( 256 ); // 255 stations plus firmware terminator
		expect( maxDurations[ 0 ] ).toBe( 65535 );
		expect( maxDurations[ maxDurations.length - 1 ] ).toBe( 0 );
		expect( maxParams.get( "qo" ) ).toBe( "2" );

		const runProgram = fresh();
		const program: OSProgram = [ 1, 1, 0, [ 60, -1, -1, -1 ], [ 60 ], "P", [ 0, 0, 0 ] ];
		expect( () => runProgram.api.runProgramNow( 0, program, 2 as 0 | 1 ) ).toThrow( /queue option/i );
		expect( runProgram.seam.lastPath ).toBe( "" );
		await runProgram.api.runProgramNow( 0, program, 1 );
		expect( runProgram.seam.lastPath ).toContain( "&qo=1" );
	} );

	it( "forwards the caller's AbortSignal through typed reads and mutations", async () => {
		let readSignal: AbortSignal | undefined;
		let commandSignal: AbortSignal | undefined;
		const seam = {
			config: { baseUrl: "http://d/" },
			async requestJson( _path: string, signal?: AbortSignal ) {
				readSignal = signal;
				return { sn: Array( 8 ).fill( 0 ), nstations: 8 };
			},
			async runCommand( _path: string, signal?: AbortSignal ) {
				commandSignal = signal;
				return { result: 1 };
			},
		} satisfies DeviceSeam;
		const signal = new AbortController().signal;
		const api = new OsApiClient( seam );
		await api.getStatus( signal );
		await api.stopAllStations( signal );
		expect( readSignal ).toBe( signal );
		expect( commandSignal ).toBe( signal );
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

	it( "accepts the empty response or disconnect produced by a successful reboot", async () => {
		globalThis.fetch = vi.fn( async () => new Response( "", { status: 200 } ) ) as unknown as typeof fetch;
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", ver: 221 } );
		await expect( new OsApiClient( seam ).reboot() ).resolves.toEqual( { result: 1, unverified: true } );

		globalThis.fetch = vi.fn( async () => { throw new TypeError( "connection closed" ); } ) as unknown as typeof fetch;
		await expect( new OsApiClient( seam ).reboot() ).resolves.toEqual( { result: 1, unverified: true } );
	} );

	it( "preserves a normal reboot acknowledgement as verified", async () => {
		globalThis.fetch = vi.fn( async () => new Response( '{"result":1}', { status: 200 } ) ) as unknown as typeof fetch;
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", ver: 221 } );
		await expect( new OsApiClient( seam ).reboot() ).resolves.toEqual( { result: 1 } );
	} );

	it( "does not mistake a reboot timeout or HTTP rejection for success", async () => {
		globalThis.fetch = vi.fn( () => new Promise<Response>( () => {} ) ) as typeof fetch;
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", ver: 221, requestTimeoutMs: 5 } );
		await expect( new OsApiClient( seam ).reboot() ).rejects.toThrow( /timed out after 5ms/i );

		globalThis.fetch = vi.fn( async () => new Response( "failure", { status: 500 } ) ) as unknown as typeof fetch;
		await expect( new OsApiClient( seam ).reboot() ).rejects.toThrow( /failed \(500/i );
	} );

	it( "bounds browser reads, command fetches, and response-body parsing", async () => {
		globalThis.fetch = vi.fn( () => new Promise<Response>( () => {} ) ) as typeof fetch;
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", ver: 221, requestTimeoutMs: 5 } );
		await expect( seam.requestJson( "jc" ) ).rejects.toThrow( /timed out after 5ms/i );
		await expect( seam.runCommand( "cv?rd=2" ) ).rejects.toThrow( /timed out after 5ms/i );

		globalThis.fetch = vi.fn( async () => ( {
			ok: true, status: 200, json: () => new Promise<unknown>( () => {} ),
		} ) as Response ) as typeof fetch;
		await expect( seam.requestJson( "jc" ) ).rejects.toThrow( /timed out after 5ms/i );
	} );

	it( "cancels browser transport when the caller aborts", async () => {
		let transportSignal: AbortSignal | undefined;
		globalThis.fetch = vi.fn( ( _url: RequestInfo | URL, init?: RequestInit ) => {
			transportSignal = init?.signal ?? undefined;
			return new Promise<Response>( () => {} );
		} ) as typeof fetch;
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", ver: 221 } );
		const abort = new AbortController();
		const pending = new OsApiClient( seam ).stopAllStations( abort.signal );
		abort.abort();
		await expect( pending ).rejects.toThrow( /cancelled \(cv\)/i );
		expect( transportSignal?.aborted ).toBe( true );
	} );

	it( "does not turn an explicitly cancelled reboot into an unverified success", async () => {
		globalThis.fetch = vi.fn( () => new Promise<Response>( () => {} ) ) as typeof fetch;
		const seam = new BrowserDeviceSeam( { baseUrl: "http://d/", ver: 221 } );
		const abort = new AbortController();
		const pending = new OsApiClient( seam ).reboot( abort.signal );
		abort.abort();
		await expect( pending ).rejects.toThrow( /cancelled \(cv\)/i );
	} );
} );

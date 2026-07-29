/**
 * Action dispatcher tests — verify each data-action maps to the right typed command, that
 * input-requiring actions honor prompt/confirm (including cancellation), and that program
 * actions read from the current data.
 */
import { describe, it, expect } from "vitest";
import { dispatchAction, type ActionContext } from "../www/src/views/dispatch";
import type { OsApiClient } from "../www/src/api/client";
import type { JpResponse, OSProgram } from "../www/src/api/types";

/** Records every command call as "method:args". */
class MockApi {
	calls: string[] = [];
	signals: Array<AbortSignal | undefined> = [];
	rebootResult: Record<string, unknown> = {};
	private record( call: string, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		this.calls.push( call );
		this.signals.push( signal );
		return Promise.resolve( {} );
	}
	startStation( sid: number, s: number, signal?: AbortSignal ) { return this.record( `startStation:${ sid }:${ s }`, signal ); }
	stopStation( sid: number, signal?: AbortSignal ) { return this.record( `stopStation:${ sid }`, signal ); }
	stopAllStations( signal?: AbortSignal ) { return this.record( "stopAll", signal ); }
	setControllerEnabled( e: boolean, signal?: AbortSignal ) { return this.record( `enable:${ e }`, signal ); }
	setRainDelayHours( h: number, signal?: AbortSignal ) { return this.record( `rain:${ h }`, signal ); }
	cancelRainDelay( signal?: AbortSignal ) { return this.record( "cancelRain", signal ); }
	reboot( signal?: AbortSignal ) {
		this.calls.push( "reboot" );
		this.signals.push( signal );
		return Promise.resolve( this.rebootResult );
	}
	clearOvercurrent( signal?: AbortSignal ) { return this.record( "clearOcs", signal ); }
	deleteProgram( pid: number, signal?: AbortSignal ) { return this.record( `delete:${ pid }`, signal ); }
	runProgramNow( pid: number, p: OSProgram, _queueOption = 0, signal?: AbortSignal ) {
		return this.record( `run:${ pid }:${ p[ 5 ] }`, signal );
	}
	setProgramEnabled( pid: number, _p: OSProgram, e: boolean, signal?: AbortSignal ) {
		return this.record( `progEnable:${ pid }:${ e }`, signal );
	}
}

const program: OSProgram = [ 1, 0b10101, 0, [ 360, -1, -1, -1 ], [ 600 ], "Morning", [ 0, 0, 0 ] ];
const data = { jp: { pd: [ program ] } as unknown as JpResponse, stationCount: 4 };

function ctx( answer: string | null = "5", yes = true ): ActionContext {
	return { prompt: () => answer, confirm: () => yes };
}
function run( api: MockApi, ds: Record<string, string >, c = ctx(), signal?: AbortSignal ): Promise<string | null> {
	return dispatchAction( api as unknown as OsApiClient, data, ds, c, signal );
}

describe( "dispatchAction", () => {
	it( "stop-all / enable toggle / clear-ocs / reboot", async () => {
		const api = new MockApi();
		expect( await run( api, { action: "stop-all" } ) ).toMatch( /stopped/i );
		expect( await run( api, { action: "toggle-enable", enabled: "1" } ) ).toMatch( /disabled/i );
		expect( await run( api, { action: "toggle-enable", enabled: "0" } ) ).toMatch( /enabled/i );
		await run( api, { action: "clear-ocs" } );
		await run( api, { action: "reboot" } );
		expect( api.calls ).toEqual( [ "stopAll", "enable:false", "enable:true", "clearOcs", "reboot" ] );
	} );

	it( "station start prompts for minutes and converts to seconds; cancel does nothing", async () => {
		const api = new MockApi();
		expect( await run( api, { action: "station-start", sid: "2" }, ctx( "5" ) ) ).toMatch( /started/i );
		expect( api.calls ).toEqual( [ "startStation:2:300" ] );
		expect( await run( api, { action: "station-start", sid: "2" }, ctx( null ) ) ).toBeNull();
		expect( api.calls ).toEqual( [ "startStation:2:300" ] ); // unchanged
		await expect( run( api, { action: "station-start", sid: "2" }, ctx( "5junk" ) ) ).rejects.toThrow( /positive number/i );
		await expect( run( api, { action: "station-start", sid: "2" }, ctx( "0.001" ) ) ).rejects.toThrow( /1080/i );
		await expect( run( api, { action: "station-start", sid: "2" }, ctx( "1080.001" ) ) ).rejects.toThrow( /1080/i );
		await expect( run( api, { action: "station-start", sid: "2" }, ctx( "1e308" ) ) ).rejects.toThrow( /1080/i );
		expect( api.calls ).toEqual( [ "startStation:2:300" ] );
	} );

	it( "station stop", async () => {
		const api = new MockApi();
		await run( api, { action: "station-stop", sid: "0" } );
		expect( api.calls ).toEqual( [ "stopStation:0" ] );
	} );

	it( "rain-delay accepts whole hours, uses explicit cancellation, and rejects invalid input", async () => {
		const api = new MockApi();
		await run( api, { action: "rain-delay" }, ctx( "3" ) );
		await run( api, { action: "rain-delay" }, ctx( "0" ) );
		await expect( run( api, { action: "rain-delay" }, ctx( "nope" ) ) ).rejects.toThrow( /whole number/i );
		await expect( run( api, { action: "rain-delay" }, ctx( "0.5" ) ) ).rejects.toThrow( /whole number/i );
		await expect( run( api, { action: "rain-delay" }, ctx( "  " ) ) ).rejects.toThrow( /whole number/i );
		await expect( run( api, { action: "rain-delay" }, ctx( "8761" ) ) ).rejects.toThrow( /8760/i );
		expect( api.calls ).toEqual( [ "rain:3", "cancelRain" ] );
	} );

	it( "cancel-rain calls cancelRainDelay", async () => {
		const api = new MockApi();
		await run( api, { action: "cancel-rain" } );
		expect( api.calls ).toEqual( [ "cancelRain" ] );
	} );

	it( "reboot only fires when confirmed", async () => {
		const api = new MockApi();
		expect( await run( api, { action: "reboot" }, ctx( "x", false ) ) ).toBeNull();
		expect( api.calls ).toEqual( [] );
		await run( api, { action: "reboot" }, ctx( "x", true ) );
		expect( api.calls ).toEqual( [ "reboot" ] );
	} );

	it( "uses cautious wording when reboot acknowledgement is unverified", async () => {
		const api = new MockApi();
		api.rebootResult = { result: 1, unverified: true };
		const message = await run( api, { action: "reboot" } );
		expect( message ).toMatch( /may have started/i );
		expect( message ).toMatch( /disconnected before it could confirm/i );
	} );

	it( "program run / toggle / delete (with confirm) read the current program", async () => {
		const api = new MockApi();
		await run( api, { action: "program-run", pid: "0" } );
		await run( api, { action: "program-toggle", pid: "0", enabled: "1" } );
		expect( await run( api, { action: "program-delete", pid: "0" }, ctx( "x", true ) ) ).toMatch( /deleted/i );
		expect( await run( api, { action: "program-delete", pid: "0" }, ctx( "x", false ) ) ).toBeNull();
		expect( api.calls ).toEqual( [ "run:0:Morning", "progEnable:0:false", "delete:0" ] );
	} );

	it( "does not queue a program when the run-now consequence is declined", async () => {
		const api = new MockApi();
		expect( await run( api, { action: "program-run", pid: "0" }, ctx( "x", false ) ) ).toBeNull();
		expect( api.calls ).toEqual( [] );
	} );

	it( "rejects missing, negative, out-of-range, and partially parsed mutation indexes", async () => {
		for ( const pid of [ undefined, "-1", "0junk", "1" ] ) {
			const api = new MockApi();
			await expect( dispatchAction( api as unknown as OsApiClient, data, { action: "program-delete", pid }, ctx() ) )
				.rejects.toThrow( /invalid program/i );
			expect( api.calls ).toEqual( [] );
		}
		for ( const sid of [ undefined, "-1", "0junk", "4" ] ) {
			const api = new MockApi();
			await expect( dispatchAction( api as unknown as OsApiClient, data, { action: "station-stop", sid }, ctx() ) )
				.rejects.toThrow( /invalid station/i );
			expect( api.calls ).toEqual( [] );
		}
	} );

	it( "forwards one caller AbortSignal through every dispatched mutation", async () => {
		const api = new MockApi();
		const signal = new AbortController().signal;
		const cases: Array<[ Record<string, string>, ActionContext ]> = [
			[ { action: "stop-all" }, ctx() ],
			[ { action: "toggle-enable", enabled: "1" }, ctx() ],
			[ { action: "rain-delay" }, ctx( "3" ) ],
			[ { action: "cancel-rain" }, ctx() ],
			[ { action: "reboot" }, ctx() ],
			[ { action: "clear-ocs" }, ctx() ],
			[ { action: "station-start", sid: "0" }, ctx( "1" ) ],
			[ { action: "station-stop", sid: "0" }, ctx() ],
			[ { action: "program-run", pid: "0" }, ctx() ],
			[ { action: "program-toggle", pid: "0", enabled: "1" }, ctx() ],
			[ { action: "program-delete", pid: "0" }, ctx() ],
		];
		for ( const [ action, context ] of cases ) await run( api, action, context, signal );
		expect( api.signals ).toHaveLength( cases.length );
		expect( api.signals.every( ( seen ) => seen === signal ) ).toBe( true );
	} );

	it( "returns null for unknown actions", async () => {
		const api = new MockApi();
		expect( await run( api, { action: "program-new" } ) ).toBeNull();
		expect( api.calls ).toEqual( [] );
	} );
} );

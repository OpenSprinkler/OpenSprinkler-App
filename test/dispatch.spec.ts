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
	startStation( sid: number, s: number ) { this.calls.push( `startStation:${ sid }:${ s }` ); return Promise.resolve( {} ); }
	stopStation( sid: number ) { this.calls.push( `stopStation:${ sid }` ); return Promise.resolve( {} ); }
	stopAllStations() { this.calls.push( "stopAll" ); return Promise.resolve( {} ); }
	setControllerEnabled( e: boolean ) { this.calls.push( `enable:${ e }` ); return Promise.resolve( {} ); }
	setRainDelayHours( h: number ) { this.calls.push( `rain:${ h }` ); return Promise.resolve( {} ); }
	cancelRainDelay() { this.calls.push( "cancelRain" ); return Promise.resolve( {} ); }
	reboot() { this.calls.push( "reboot" ); return Promise.resolve( {} ); }
	clearOvercurrent() { this.calls.push( "clearOcs" ); return Promise.resolve( {} ); }
	deleteProgram( pid: number ) { this.calls.push( `delete:${ pid }` ); return Promise.resolve( {} ); }
	runProgramNow( p: OSProgram ) { this.calls.push( `run:${ p[ 5 ] }` ); return Promise.resolve( {} ); }
	setProgramEnabled( pid: number, _p: OSProgram, e: boolean ) { this.calls.push( `progEnable:${ pid }:${ e }` ); return Promise.resolve( {} ); }
}

const program: OSProgram = [ 1, 0b10101, 0, [ 360, -1, -1, -1 ], [ 600 ], "Morning", [ 0, 0, 0 ] ];
const data = { jp: { pd: [ program ] } as unknown as JpResponse };

function ctx( answer: string | null = "5", yes = true ): ActionContext {
	return { prompt: () => answer, confirm: () => yes };
}
function run( api: MockApi, ds: Record<string, string >, c = ctx() ): Promise<string | null> {
	return dispatchAction( api as unknown as OsApiClient, data, ds, c );
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
	} );

	it( "station stop", async () => {
		const api = new MockApi();
		await run( api, { action: "station-stop", sid: "0" } );
		expect( api.calls ).toEqual( [ "stopStation:0" ] );
	} );

	it( "rain-delay prompts hours; 0 cancels; non-numeric falls back to 0", async () => {
		const api = new MockApi();
		await run( api, { action: "rain-delay" }, ctx( "3" ) );
		await run( api, { action: "rain-delay" }, ctx( "0" ) );
		await run( api, { action: "rain-delay" }, ctx( "nope" ) );
		expect( api.calls ).toEqual( [ "rain:3", "rain:0", "rain:0" ] );
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

	it( "program run / toggle / delete (with confirm) read the current program", async () => {
		const api = new MockApi();
		await run( api, { action: "program-run", pid: "0" } );
		await run( api, { action: "program-toggle", pid: "0", enabled: "1" } );
		expect( await run( api, { action: "program-delete", pid: "0" }, ctx( "x", true ) ) ).toMatch( /deleted/i );
		expect( await run( api, { action: "program-delete", pid: "0" }, ctx( "x", false ) ) ).toBeNull();
		expect( api.calls ).toEqual( [ "run:Morning", "progEnable:0:false", "delete:0" ] );
	} );

	it( "returns null for unknown actions", async () => {
		const api = new MockApi();
		expect( await run( api, { action: "program-new" } ) ).toBeNull();
		expect( api.calls ).toEqual( [] );
	} );
} );

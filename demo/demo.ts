/**
 * Local demo harness for the Phase-1 dashboard — Status / Stations / Programs / Weather / Log /
 * Diagnostics / Settings — rendered from MOCKED fixtures (no device). Runs the real seam → typed
 * client → decoders/encoders → views → host controller. Control + settings actions hit the mock,
 * which returns a success result so the flow is exercisable end-to-end.
 *
 *   npm run demo
 */
import jc from "../test/fixtures/api/jc.fixture.json";
import jo from "../test/fixtures/api/jo.fixture.json";
import jn from "../test/fixtures/api/jn.fixture.json";
import jp from "../test/fixtures/api/jp.fixture.json";
import jl from "../test/fixtures/api/jl.fixture.json";

import { BrowserDeviceSeam } from "../www/src/seam/device";
import { OsApiClient, parseJp } from "../www/src/api/client";
import type { JpResponse, OSProgram } from "../www/src/api/types";
import { mountDashboard } from "../www/src/views/host";
import type { DashboardData } from "../www/src/views/dashboard";

// Firmware globals normally injected by server_home before home.js loads.
( globalThis as Record<string, unknown> ).ver = 221;
( globalThis as Record<string, unknown> ).ipas = 1;

function cloneProgram( program: OSProgram ): OSProgram {
	return [
		program[ 0 ], program[ 1 ], program[ 2 ], program[ 3 ].slice(), program[ 4 ].slice(), program[ 5 ],
		[ ...program[ 6 ] ],
	];
}

const fixturePrograms = parseJp( jp );
const demoPrograms: JpResponse = { ...fixturePrograms, pd: fixturePrograms.pd.map( cloneProgram ) };

function programSnapshot(): JpResponse {
	return { ...demoPrograms, pd: demoPrograms.pd.map( cloneProgram ) };
}

function commandFailure(): { result: number } {
	return { result: 16 }; // Firmware HTML_DATA_MISSING; the typed client surfaces this as an error.
}

function programIndex( value: string | null ): number | null {
	if ( value === null || !/^-?\d+$/.test( value ) ) return null;
	const parsed = Number( value );
	return Number.isSafeInteger( parsed ) ? parsed : null;
}

/** Apply the `/cp` shapes used by create/edit/toggle to the demo's in-memory `/jp` response. */
function changeProgram( params: URLSearchParams ): { result: number } {
	const pid = programIndex( params.get( "pid" ) );
	if ( pid === null || pid < -1 || pid >= demoPrograms.pd.length ) return commandFailure();

	const enabled = params.get( "en" );
	if ( enabled !== null ) {
		if ( pid < 0 || ( enabled !== "0" && enabled !== "1" ) ) return commandFailure();
		const program = demoPrograms.pd[ pid ]!;
		program[ 0 ] = enabled === "1" ? program[ 0 ] | 1 : program[ 0 ] & ~1;
		return { result: 1 };
	}

	const useWeather = params.get( "uwt" );
	if ( useWeather !== null ) {
		if ( pid < 0 || ( useWeather !== "0" && useWeather !== "1" ) ) return commandFailure();
		const program = demoPrograms.pd[ pid ]!;
		program[ 0 ] = useWeather === "1" ? program[ 0 ] | 2 : program[ 0 ] & ~2;
		return { result: 1 };
	}

	const rawValue = params.get( "v" );
	if ( rawValue === null ) return commandFailure();
	let encoded: unknown;
	try { encoded = JSON.parse( rawValue ); }
	catch { return commandFailure(); }
	if ( !Array.isArray( encoded ) || encoded.length !== 5 ||
		!Array.isArray( encoded[ 3 ] ) || !Array.isArray( encoded[ 4 ] ) ) return commandFailure();

	const flags = encoded[ 0 ];
	const days0 = encoded[ 1 ];
	const days1 = encoded[ 2 ];
	const starts = encoded[ 3 ];
	const durations = encoded[ 4 ];
	if ( !Number.isSafeInteger( flags ) || !Number.isSafeInteger( days0 ) || !Number.isSafeInteger( days1 ) ||
		starts.length !== demoPrograms.mnst || starts.some( ( value ) => !Number.isSafeInteger( value ) ) ||
		durations.length !== demoPrograms.nboards * 8 || durations.some( ( value ) => !Number.isSafeInteger( value ) ) ) {
		return commandFailure();
	}

	const from = programIndex( params.get( "from" ) ) ?? 33;
	const to = programIndex( params.get( "to" ) ) ?? 415;
	const program: OSProgram = [
		flags as number, days0 as number, days1 as number,
		( starts as number[] ).slice(), ( durations as number[] ).slice(),
		// Match the controller's storage canonicalization so the host's post-write comparison
		// behaves the same in the demo for JSON-sensitive characters.
		( params.get( "name" ) ?? `Program ${ pid < 0 ? demoPrograms.pd.length + 1 : pid + 1 }` )
			.replace( /"/g, "'" ).replace( /\\/g, "/" ),
		[ ( ( flags as number ) >> 7 ) & 1, from, to ],
	];

	if ( pid === -1 ) {
		if ( demoPrograms.pd.length >= demoPrograms.mnp ) return commandFailure();
		demoPrograms.pd.push( program );
	} else {
		demoPrograms.pd[ pid ] = program;
	}
	demoPrograms.nprogs = demoPrograms.pd.length;
	return { result: 1 };
}

function deleteProgram( params: URLSearchParams ): { result: number } {
	const pid = programIndex( params.get( "pid" ) );
	if ( pid === -1 ) demoPrograms.pd.splice( 0 );
	else if ( pid !== null && pid >= 0 && pid < demoPrograms.pd.length ) demoPrograms.pd.splice( pid, 1 );
	else return commandFailure();
	demoPrograms.nprogs = demoPrograms.pd.length;
	return { result: 1 };
}

// Mock transport: serve the fixtures for reads; program writes mutate the in-memory /jp response.
// Only URLs aimed at the fake device are mocked — everything else (e.g. dev tooling
// on another origin) passes through to the real fetch.
const realFetch = globalThis.fetch.bind( globalThis );
globalThis.fetch = ( async ( input: RequestInfo | URL, init?: RequestInit ) => {
	const url = String( input );
	if ( !url.startsWith( "http://demo-device/" ) ) {
		return realFetch( input, init );
	}
	const request = new URL( url );
	const endpoint = request.pathname.split( "/" ).filter( Boolean ).pop() ?? "";
	const isCommand = [ "cm", "cv", "cr", "co", "cs", "cp", "dp" ].includes( endpoint );
	const body =
		endpoint === "cp" ? changeProgram( request.searchParams ) :
		endpoint === "dp" ? deleteProgram( request.searchParams ) :
		isCommand ? { result: 1 } :
		url.includes( "/jc" ) ? jc :
		url.includes( "/jo" ) ? jo :
		url.includes( "/jn" ) ? jn :
		url.includes( "/je" ) ? {} :
		url.includes( "/jp" ) ? programSnapshot() :
		url.includes( "/jl" ) ? jl :
		url.includes( "/sp" ) ? { result: 0 } :
		null;
	await new Promise( ( r ) => setTimeout( r, 30 ) );
	return { ok: true, status: 200, statusText: "OK", json: async () => body } as Response;
} ) as typeof fetch;

const mount = document.getElementById( "app" ) as HTMLElement;
const toastEl = document.getElementById( "toast" ) as HTMLElement | null;

let baseUrl = "http://demo-device/";

async function load(): Promise<DashboardData> {
	const api = new OsApiClient( new BrowserDeviceSeam( { baseUrl, ipas: 1, ver: 221 } ) );
	const [ c, o, n, e, p ] = await Promise.all( [
		api.getControllerStatus(), api.getOptions(), api.getStations(), api.getSpecialStations(), api.getPrograms(),
	] );
	const l = await api.getLogs( { end: c.devt } );
	// Showcase the fork build tag (#3): the kars85 firmware fork emits `fwf` in /jo.
	// Showcase current sensing (`curr` mA in /jc) and flow calibration (fpr = 1 L/pulse).
	return { jc: { ...c, curr: 247 }, jo: { ...o, fwf: "kars85.3", fpr0: 100, fpr1: 0 }, jn: n, je: e, jp: p, jl: l };
}

function toast( message: string, isError = false ): void {
	if ( !toastEl ) return;
	toastEl.textContent = message;
	toastEl.className = isError ? "toast err" : "toast";
	// Errors are assertive so failures are announced promptly; success stays polite.
	toastEl.setAttribute( "role", isError ? "alert" : "status" );
	toastEl.setAttribute( "aria-live", isError ? "assertive" : "polite" );
	window.setTimeout( () => { if ( toastEl.textContent === message ) toastEl.textContent = ""; }, 4000 );
}

const api = new OsApiClient( new BrowserDeviceSeam( { baseUrl, ipas: 1, ver: 221 } ) );
const controller = mountDashboard( {
	mount, api, load, toast,
	ctx: { prompt: ( m, d ) => window.prompt( m, d ), confirm: ( m ) => window.confirm( m ) },
} );

document.querySelectorAll<HTMLInputElement>( 'input[name="path"]' ).forEach( ( el ) =>
	el.addEventListener( "change", () => {
		baseUrl = el.value === "otc" ? "https://cloud.openthings.io/forward/v1/DEMOTOKEN/" : "http://demo-device/";
		void controller.refresh();
	} )
);

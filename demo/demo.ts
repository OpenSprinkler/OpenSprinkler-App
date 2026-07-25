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
import { OsApiClient } from "../www/src/api/client";
import { mountDashboard } from "../www/src/views/host";
import type { DashboardData } from "../www/src/views/dashboard";

// Firmware globals normally injected by server_home before home.js loads.
( globalThis as Record<string, unknown> ).ver = 221;
( globalThis as Record<string, unknown> ).ipas = 1;

// Mock transport: serve the fixtures for reads; return result:1 for change commands.
// Only URLs aimed at the fake device are mocked — everything else (e.g. dev tooling
// on another origin) passes through to the real fetch.
const realFetch = globalThis.fetch.bind( globalThis );
globalThis.fetch = ( async ( input: RequestInfo | URL, init?: RequestInit ) => {
	const url = String( input );
	if ( !url.startsWith( "http://demo-device/" ) ) {
		return realFetch( input, init );
	}
	const isCommand = /\/(cm|cv|cr|co|cs|cp|dp)\b/.test( url ) || /\/(cm|cv|cr|co|cs|cp|dp)\?/.test( url );
	const body =
		isCommand ? { result: 1 } :
		url.includes( "/jc" ) ? jc :
		url.includes( "/jo" ) ? jo :
		url.includes( "/jn" ) ? jn :
		url.includes( "/jp" ) ? jp :
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
	const [ c, o, n, p, l ] = await Promise.all( [
		api.getControllerStatus(), api.getOptions(), api.getStations(), api.getPrograms(), api.getLogs(),
	] );
	// Showcase the fork build tag (#3): the kars85 firmware fork emits `fwf` in /jo.
	// Showcase current sensing (`curr` mA in /jc) and flow calibration (fpr = 1 L/pulse).
	return { jc: { ...c, curr: 247 }, jo: { ...o, fwf: "kars85.3", fpr0: 100, fpr1: 0 }, jn: n, jp: p, jl: l };
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

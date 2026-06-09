/**
 * Local demo harness for the Phase-1 read-only views — renders the controller status,
 * the stations grid, and the programs list from MOCKED fixtures (no device required).
 *
 *   npm run demo
 *
 * Installs a fake `fetch` returning the test fixtures, sets the firmware-injected globals,
 * and runs the real seam → typed client → decoders → views pipeline.
 */
import jc from "../test/fixtures/api/jc.fixture.json";
import jo from "../test/fixtures/api/jo.fixture.json";
import jn from "../test/fixtures/api/jn.fixture.json";
import jp from "../test/fixtures/api/jp.fixture.json";

import { BrowserDeviceSeam } from "../www/src/seam/device";
import { OsApiClient, deriveCapabilities } from "../www/src/api/client";
import { renderControllerStatus } from "../www/src/spike/status-view";
import { renderStations } from "../www/src/views/stations-view";
import { renderPrograms } from "../www/src/views/programs-view";

// Firmware globals normally injected by server_home before home.js loads.
( globalThis as Record<string, unknown> ).ver = 221;
( globalThis as Record<string, unknown> ).ipas = 1; // skip the password prompt for the demo

// Mock transport: serve the fixtures instead of a real controller.
globalThis.fetch = ( async ( input: RequestInfo | URL ) => {
	const url = String( input );
	const body =
		url.includes( "/jc" ) ? jc :
		url.includes( "/jo" ) ? jo :
		url.includes( "/jn" ) ? jn :
		url.includes( "/jp" ) ? jp :
		url.includes( "/sp" ) ? { result: 0 } :
		null;
	await new Promise( ( r ) => setTimeout( r, 40 ) );
	return { ok: true, status: 200, statusText: "OK", json: async () => body } as Response;
} ) as typeof fetch;

const mount = document.getElementById( "app" ) as HTMLElement;

async function render( path: "lan" | "otc" ): Promise<void> {
	const baseUrl = path === "otc"
		? "https://cloud.openthings.io/forward/v1/DEMOTOKEN/"
		: "http://demo-device/";
	mount.innerHTML = "<p>Loading…</p>";
	try {
		const api = new OsApiClient( new BrowserDeviceSeam( { baseUrl, ipas: 1 } ) );
		const [ c, o, n, p ] = await Promise.all( [
			api.getControllerStatus(), api.getOptions(), api.getStations(), api.getPrograms(),
		] );
		mount.innerHTML =
			renderControllerStatus( c, o, deriveCapabilities( c, o ) ) +
			renderStations( c, n ) +
			renderPrograms( p, n );
	} catch ( e ) {
		mount.innerHTML = `<pre class="err">${ String( e ) }</pre>`;
	}
}

document.querySelectorAll<HTMLInputElement>( 'input[name="path"]' ).forEach( ( el ) =>
	el.addEventListener( "change", () => render( el.value as "lan" | "otc" ) )
);

void render( "lan" );

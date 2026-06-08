/**
 * Local demo harness for the Phase-1 seam spike — renders the controller-status screen
 * from a MOCKED /jc + /jo fixture, no device required.
 *
 *   npm run demo     (vite dev server; open the printed URL)
 *
 * It installs a fake `fetch` that returns the test fixtures, sets the firmware-injected
 * globals (ver/ipas), and runs the real spike pipeline (seam -> typed client -> render).
 */
import jc from "../test/fixtures/api/jc.fixture.json";
import jo from "../test/fixtures/api/jo.fixture.json";
import { bootStatusSpike } from "../www/src/spike/boot";

// Firmware globals normally injected by server_home before home.js loads.
( globalThis as Record<string, unknown> ).ver = 221;
( globalThis as Record<string, unknown> ).ipas = 1; // skip the password prompt for the demo

// Mock transport: serve the fixtures instead of a real controller.
globalThis.fetch = ( async ( input: RequestInfo | URL ) => {
	const url = String( input );
	const body =
		url.includes( "/jc" ) ? jc :
		url.includes( "/jo" ) ? jo :
		url.includes( "/sp" ) ? { result: 0 } :
		null;
	// emulate a little latency so the aria-live region announces
	await new Promise( ( r ) => setTimeout( r, 50 ) );
	return { ok: true, status: 200, statusText: "OK", json: async () => body } as Response;
} ) as typeof fetch;

const mount = document.getElementById( "app" ) as HTMLElement;

async function render( path: "lan" | "otc" ): Promise<void> {
	const baseUrl = path === "otc"
		? "https://cloud.openthings.io/forward/v1/DEMOTOKEN/"
		: "http://demo-device/";
	mount.innerHTML = "<p>Loading…</p>";
	try {
		await bootStatusSpike( { baseUrl, md5: ( s ) => s }, mount );
	} catch ( e ) {
		mount.innerHTML = `<pre class="err">${ String( e ) }</pre>`;
	}
}

document.querySelectorAll<HTMLInputElement>( 'input[name="path"]' ).forEach( ( el ) =>
	el.addEventListener( "change", () => render( el.value as "lan" | "otc" ) )
);

void render( "lan" );

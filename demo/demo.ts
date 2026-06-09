/**
 * Local demo harness for the Phase-1 read-only dashboard — Status / Stations / Programs / Log,
 * rendered from MOCKED fixtures (no device). Runs the real seam → typed client → decoders → views.
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
import { renderDashboard, type DashboardData, type DashboardTab } from "../www/src/views/dashboard";

// Firmware globals normally injected by server_home before home.js loads.
( globalThis as Record<string, unknown> ).ver = 221;
( globalThis as Record<string, unknown> ).ipas = 1;

// Mock transport: serve the fixtures instead of a real controller.
globalThis.fetch = ( async ( input: RequestInfo | URL ) => {
	const url = String( input );
	const body =
		url.includes( "/jc" ) ? jc :
		url.includes( "/jo" ) ? jo :
		url.includes( "/jn" ) ? jn :
		url.includes( "/jp" ) ? jp :
		url.includes( "/jl" ) ? jl :
		url.includes( "/sp" ) ? { result: 0 } :
		null;
	await new Promise( ( r ) => setTimeout( r, 40 ) );
	return { ok: true, status: 200, statusText: "OK", json: async () => body } as Response;
} ) as typeof fetch;

const mount = document.getElementById( "app" ) as HTMLElement;
let data: DashboardData | null = null;
let activeTab: DashboardTab = "Status";

function paint(): void {
	mount.innerHTML = data ? renderDashboard( data, activeTab ) : "<p>Loading…</p>";
}

async function load( path: "lan" | "otc" ): Promise<void> {
	const baseUrl = path === "otc"
		? "https://cloud.openthings.io/forward/v1/DEMOTOKEN/"
		: "http://demo-device/";
	data = null; paint();
	try {
		const api = new OsApiClient( new BrowserDeviceSeam( { baseUrl, ipas: 1 } ) );
		const [ c, o, n, p, l ] = await Promise.all( [
			api.getControllerStatus(), api.getOptions(), api.getStations(), api.getPrograms(), api.getLogs(),
		] );
		data = { jc: c, jo: o, jn: n, jp: p, jl: l };
		paint();
	} catch ( e ) {
		mount.innerHTML = `<pre class="err">${ String( e ) }</pre>`;
	}
}

// Tab switching (event delegation; data already fetched).
mount.addEventListener( "click", ( ev ) => {
	const t = ( ev.target as HTMLElement ).closest<HTMLElement>( "[data-tab]" );
	if ( t && t.dataset.tab ) { activeTab = t.dataset.tab as DashboardTab; paint(); }
} );

document.querySelectorAll<HTMLInputElement>( 'input[name="path"]' ).forEach( ( el ) =>
	el.addEventListener( "change", () => void load( el.value as "lan" | "otc" ) )
);

void load( "lan" );

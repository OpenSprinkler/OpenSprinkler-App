/**
 * Phase-1 production app entry (DRAFT, read-only).
 *
 * Boots the read-only dashboard against a REAL device (no mock). This is the deployable bundle
 * for the parallel-URL rollout (PRD §7). It is NOT yet wired into the firmware's `home.js`
 * bootstrap, and the full md5 login UI is the deferred home.js-wiring step — for now it supports
 * `ipas` devices and a `?pwhash=<md5>` query param for authenticated testing.
 *
 * Device base resolution:
 *   - `?base=http://192.168.1.50/`  → explicit device (LAN) or an OTC forward URL (remote)
 *   - otherwise `location.origin`   → when this build is eventually served from the device
 */
import "../demo/style.css"; // DRAFT: shares the demo's view styling for now
import { BrowserDeviceSeam, readFirmwareGlobals } from "../www/src/seam/device";
import { OsApiClient } from "../www/src/api/client";
import { renderDashboard, type DashboardData, type DashboardTab } from "../www/src/views/dashboard";
import { runLogin } from "../www/src/auth/login";

function qp( name: string ): string | undefined {
	return new URLSearchParams( location.search ).get( name ) ?? undefined;
}

const { ver, ipas } = readFirmwareGlobals();
const baseUrl = qp( "base" ) || location.origin + "/";
let pwHash = qp( "pwhash" );

const mount = document.getElementById( "app" ) as HTMLElement;
let data: DashboardData | null = null;
let activeTab: DashboardTab = "Status";

function paint(): void {
	mount.innerHTML = data ? renderDashboard( data, activeTab ) : "<p>Loading…</p>";
}

async function load(): Promise<void> {
	data = null; paint();
	const api = new OsApiClient( new BrowserDeviceSeam( { baseUrl, ver, ipas, pwHash } ) );
	const [ jc, jo, jn, jp, jl ] = await Promise.all( [
		api.getControllerStatus(), api.getOptions(), api.getStations(), api.getPrograms(), api.getLogs(),
	] );
	data = { jc, jo, jn, jp, jl };
	paint();
}

async function boot(): Promise<void> {
	// Authenticate when the device enforces a password and we weren't handed a hash.
	if ( ipas !== 1 && !pwHash ) {
		pwHash = await runLogin( mount, baseUrl, ver ?? 0 );
	}
	await load();
}

mount.addEventListener( "click", ( ev ) => {
	const t = ( ev.target as HTMLElement ).closest<HTMLElement>( "[data-tab]" );
	if ( t && t.dataset.tab ) { activeTab = t.dataset.tab as DashboardTab; paint(); }
} );

boot().catch( ( e ) => { mount.innerHTML = `<pre style="color:#b91c1c">${ String( e ) }</pre>`; } );

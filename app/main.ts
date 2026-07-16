/**
 * Phase-1 production app entry (DRAFT). Boots the dashboard against a REAL device (no mock) — now
 * with write/control + settings via the shared host controller (views/host.ts). Still gated behind
 * the md5 login for password-protected devices; the home.js-wiring + rollout remain (PRD §7).
 *
 * Device base resolution:
 *   - `?base=http://192.168.1.50/`  → explicit device (LAN) or an OTC forward URL (remote)
 *   - otherwise `location.origin`   → when this build is eventually served from the device
 */
import "../www/src/ui/system.css";
import { BrowserDeviceSeam, readFirmwareGlobals } from "../www/src/seam/device";
import { OsApiClient } from "../www/src/api/client";
import type { DashboardData } from "../www/src/views/dashboard";
import { mountDashboard } from "../www/src/views/host";
import { runLogin } from "../www/src/auth/login";
import { errorCard } from "../www/src/ui/help";

function qp( name: string ): string | undefined {
	return new URLSearchParams( location.search ).get( name ) ?? undefined;
}

const { ver, ipas } = readFirmwareGlobals();
const baseUrl = qp( "base" ) || location.origin + "/";
let pwHash = qp( "pwhash" );

const mount = document.getElementById( "app" ) as HTMLElement;

/** A minimal toast banner appended to the body for action/settings feedback (live region). */
const toastEl = document.createElement( "div" );
toastEl.className = "toast";
toastEl.setAttribute( "aria-atomic", "true" );
document.body.appendChild( toastEl );
function toast( message: string, isError = false ): void {
	toastEl.textContent = message;
	toastEl.className = isError ? "toast err show" : "toast show";
	// Errors are assertive (role=alert) so failures are announced promptly; success is polite.
	toastEl.setAttribute( "role", isError ? "alert" : "status" );
	toastEl.setAttribute( "aria-live", isError ? "assertive" : "polite" );
	window.setTimeout( () => { if ( toastEl.textContent === message ) { toastEl.className = "toast"; toastEl.textContent = ""; } }, 4000 );
}

async function boot(): Promise<void> {
	if ( ipas !== 1 && !pwHash ) {
		pwHash = await runLogin( mount, baseUrl, ver ?? 0 );
	}
	const api = new OsApiClient( new BrowserDeviceSeam( { baseUrl, ver, ipas, pwHash } ) );
	const load = async (): Promise<DashboardData> => {
		const [ jc, jo, jn, jp, jl ] = await Promise.all( [
			api.getControllerStatus(), api.getOptions(), api.getStations(), api.getPrograms(), api.getLogs(),
		] );
		return { jc, jo, jn, jp, jl };
	};
	mountDashboard( {
		mount, api, load, toast,
		ctx: { prompt: ( m, d ) => window.prompt( m, d ), confirm: ( m ) => window.confirm( m ) },
	} );
}

boot().catch( ( e ) => {
	mount.innerHTML = errorCard( String( e ) );
	// At boot failure the host click-listener isn't mounted yet, so wire retry to a full reload.
	mount.querySelector<HTMLButtonElement>( '[data-action="retry"]' )?.addEventListener( "click", () => location.reload() );
} );

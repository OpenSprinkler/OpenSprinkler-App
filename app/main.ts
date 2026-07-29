/**
 * Phase-1 production app entry (DRAFT). Boots the dashboard against a REAL device (no mock) — now
 * with write/control + settings via the shared host controller (views/host.ts). Still gated behind
 * the md5 login for password-protected devices; the home.js-wiring + rollout remain (PRD §7).
 *
 * Standalone deployments accept `#base=<controller URL>` (query form is consumed and scrubbed by
 * index.html for compatibility). Firmware-served pages use their full page directory, preserving
 * OTC forwarding prefixes. The optional companion base comes from `#companion=` or the bundle's
 * own origin, so a device page loading companion-hosted assets still reaches companion history.
 */
import "../www/src/ui/system.css";
import {
	BrowserDeviceSeam, normalizeHttpBase, readFirmwareGlobals, selectBootstrapDeviceBase,
} from "../www/src/seam/device";
import { OsApiClient } from "../www/src/api/client";
import type { JoResponse } from "../www/src/api/types";
import type { DashboardData } from "../www/src/views/dashboard";
import { mountDashboard } from "../www/src/views/host";
import { runLogin } from "../www/src/auth/login";
import { errorCard } from "../www/src/ui/help";
import { shouldDisposeOnPageHide } from "../www/src/ui/lifecycle";
import {
	clearCompanionSession, loadCompanionSession, saveCompanionSession, selectCompanionSession, type SessionStore,
} from "../www/src/api/companion-session";
import { assertModernFirmwareSupport, assertModernPreflightVersion } from "../www/src/auth/support";
import { normalizeCompanionBase } from "../www/src/api/companion";
import { connectAuthorizedDeviceTarget } from "../www/src/auth/device-bootstrap";

interface InlineBootstrap { deviceBase?: string; companionBase?: string; companionToken?: string; }

const bootstrapAborted = ( globalThis as typeof globalThis & {
	__OS_BOOTSTRAP_ABORTED__?: boolean;
} ).__OS_BOOTSTRAP_ABORTED__ === true;

function storedValue( key: string ): string | undefined {
	try {
		return sessionStorage.getItem( key ) ?? undefined;
	} catch { return undefined; }
}

function storeValue( key: string, value: string ): void {
	try { sessionStorage.setItem( key, value ); } catch { /* session storage may be disabled */ }
}

function clearValue( key: string ): void {
	try { sessionStorage.removeItem( key ); } catch { /* session storage may be disabled */ }
}

function availableSessionStorage(): SessionStore | undefined {
	try { return sessionStorage; } catch { return undefined; }
}

/** Firmware pages do not run app/index.html, so consume and scrub any compatibility parameters. */
function consumeBootstrap(): InlineBootstrap {
	const g = globalThis as typeof globalThis & { __OS_BOOTSTRAP__?: InlineBootstrap };
	const inline = g.__OS_BOOTSTRAP__ ?? {};
	delete g.__OS_BOOTSTRAP__;
	const url = new URL( location.href );
	const hash = new URLSearchParams( url.hash.replace( /^#\??/, "" ) );
	const deviceBase = inline.deviceBase ?? hash.get( "base" ) ?? url.searchParams.get( "base" ) ?? undefined;
	const companionBase = inline.companionBase ?? hash.get( "companion" ) ?? url.searchParams.get( "companion" ) ?? undefined;
	const companionToken = inline.companionToken ?? hash.get( "companionToken" ) ?? undefined;
	for ( const key of [ "base", "companion", "companionToken", "pwhash" ] ) {
		url.searchParams.delete( key );
		hash.delete( key );
	}
	url.hash = hash.toString() ? `#${ hash.toString() }` : "";
	history.replaceState( history.state, "", url.href );
	return { deviceBase, companionBase, companionToken };
}

const assetBase = new URL( /* @vite-ignore */ "../", import.meta.url ).href;
const mount = document.getElementById( "app" ) as HTMLElement;

/** A minimal toast banner appended to the body for action/settings feedback (live region). */
const toastEl = document.createElement( "div" );
let toastGeneration = 0;
toastEl.className = "toast";
toastEl.setAttribute( "aria-atomic", "true" );
if ( !bootstrapAborted ) document.body.appendChild( toastEl );
function toast( message: string, isError = false ): void {
	const generation = ++toastGeneration;
	toastEl.textContent = message;
	toastEl.className = isError ? "toast err show" : "toast show";
	// Errors are assertive (role=alert) so failures are announced promptly; success is polite.
	toastEl.setAttribute( "role", isError ? "alert" : "status" );
	toastEl.setAttribute( "aria-live", isError ? "assertive" : "polite" );
	window.setTimeout( () => {
		if ( generation === toastGeneration ) { toastEl.className = "toast"; toastEl.textContent = ""; }
	}, 4000 );
}

async function boot(): Promise<void> {
	const configured = consumeBootstrap();
	const { ver, ipas } = readFirmwareGlobals();
	const firmwarePage = ver !== undefined || ipas !== undefined;
	const savedDeviceBase = storedValue( "opensprinkler.deviceBase" );
	const freshConfiguredBase = !firmwarePage && configured.deviceBase !== undefined;
	const rawDeviceBase = selectBootstrapDeviceBase( {
		firmwarePage, pageHref: location.href, configuredBase: configured.deviceBase, savedBase: savedDeviceBase,
	} );
	let baseUrl = "";
	try {
		baseUrl = rawDeviceBase ? normalizeHttpBase( rawDeviceBase, location.href ) : "";
	} catch ( error ) {
		// A bad URL handoff must not erase a previously trusted target. Clear only a malformed
		// saved target selected in a standalone boot.
		if ( !firmwarePage && !freshConfiguredBase ) clearValue( "opensprinkler.deviceBase" );
		throw error;
	}
	if ( !baseUrl ) throw new Error( "No controller is configured. Open this page with #base=http://controller-address/." );
	const connected = await connectAuthorizedDeviceTarget( {
		baseUrl,
		confirmFreshTarget: freshConfiguredBase,
		firmwareVersion: ver,
		ignoresPassword: ipas,
		confirm: ( message ) => window.confirm( message ),
		probe: () => new OsApiClient( new BrowserDeviceSeam( { baseUrl } ) ).probeBootstrap(),
		validatePreflight: assertModernPreflightVersion,
		login: ( firmwareVersion ) => runLogin( mount, baseUrl, firmwareVersion ),
		authenticate: async ( { firmwareVersion, ignoresPassword, pwHash } ) => {
			const api = new OsApiClient( new BrowserDeviceSeam( {
				baseUrl, ver: firmwareVersion, ipas: ignoresPassword, pwHash,
			} ) );
			const options = await api.getOptions();
			assertModernFirmwareSupport( options );
			return { api, options };
		},
		...( freshConfiguredBase ? {
			persist: () => storeValue( "opensprinkler.deviceBase", baseUrl ),
		} : {} ),
	} );
	const api = connected.authenticated.api;
	let initialOptions: JoResponse | undefined = connected.authenticated.options;

	let companionBase: string | null;
	let companionToken: string | undefined;
	const companionStorage = availableSessionStorage();
	try {
		const savedRaw = companionStorage ? loadCompanionSession( companionStorage ) : undefined;
		let saved;
		if ( savedRaw ) saved = { ...savedRaw, base: normalizeHttpBase( savedRaw.base, location.href ) };
		const configuredBase = configured.companionBase === undefined
			? undefined : normalizeHttpBase( configured.companionBase, location.href );
		const selected = selectCompanionSession( normalizeHttpBase( assetBase, location.href ), {
			base: configuredBase, token: configured.companionToken,
		}, saved );
		companionBase = normalizeCompanionBase( selected.base, selected.token, location.href );
		companionToken = selected.token;
		if ( companionStorage ) saveCompanionSession( companionStorage, { ...selected, base: companionBase } );
	} catch ( error ) {
		if ( companionStorage ) clearCompanionSession( companionStorage );
		companionBase = null;
		companionToken = undefined;
		toast( `${ error instanceof Error ? error.message : "Invalid companion URL." } History has been disabled.`, true );
	}
	const load = async ( signal?: AbortSignal ): Promise<DashboardData> => {
		const [ jc, jo, jn, je, jp ] = await Promise.all( [
			api.getControllerStatus( signal ), initialOptions ? Promise.resolve( initialOptions ) : api.getOptions( signal ),
			api.getStations( signal ), api.getSpecialStations( signal ), api.getPrograms( signal ),
		] );
		initialOptions = undefined;
		assertModernFirmwareSupport( jo );
		const jl = await api.getLogs( { end: jc.devt, signal } );
		return { jc, jo, jn, je, jp, jl };
	};
	const controller = mountDashboard( {
		mount, api, load, toast,
		companionBase,
		companionToken,
		ctx: { prompt: ( m, d ) => window.prompt( m, d ), confirm: ( m ) => window.confirm( m ) },
	} );
	window.addEventListener( "pagehide", ( event ) => {
		if ( shouldDisposeOnPageHide( event ) ) controller.destroy();
	} );
}

if ( !bootstrapAborted ) {
	boot().catch( ( e ) => {
		mount.innerHTML = errorCard( String( e ) );
		// At boot failure the host click-listener isn't mounted yet, so wire retry to a full reload.
		mount.querySelector<HTMLButtonElement>( '[data-action="retry"]' )?.addEventListener( "click", () => location.reload() );
	} );
}

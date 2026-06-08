/**
 * Seam spike bootstrap — the de-risking entry point (PRD §8 step 2).
 *
 * Proves the full pipeline end-to-end: firmware globals → seam (base resolution + auth) →
 * typed client (/jc + /jo) → capability derivation → render. Works identically over LAN and
 * OTC because both are just a `baseUrl`; the live LAN+OTC proof is the hardware validation step.
 *
 * This is NOT yet wired into the firmware bootstrap (that still loads www/js/home.js). It is the
 * isolated spike used to validate the seam before committing to the UI rewrite.
 */
import { BrowserDeviceSeam, readFirmwareGlobals, resolveDeviceBaseFromLocation, type Md5 } from "../seam/device";
import { OsApiClient, deriveCapabilities } from "../api/client";
import { renderControllerStatus } from "./status-view";

export interface SpikeOptions {
	baseUrl?: string;     // override (e.g. an OTC forward URL); defaults to current location (LAN)
	password?: string;    // device password (empty if ipas)
	md5: Md5;             // provide www/js/hasher.js's md5
}

/** Boot the status spike and return the rendered HTML (also injects into `mount` if given). */
export async function bootStatusSpike( opts: SpikeOptions, mount?: { innerHTML: string } ): Promise<string> {
	const { ver, ipas } = readFirmwareGlobals();
	const baseUrl = opts.baseUrl || resolveDeviceBaseFromLocation();
	if ( !baseUrl ) throw new Error( "could not resolve device base URL" );

	const seam = new BrowserDeviceSeam( { baseUrl, ver, ipas } );

	// Authenticate unless the device ignores passwords (ipas) or none was supplied.
	let pwHash = "";
	if ( ipas !== 1 && opts.password ) {
		const auth = await seam.authenticate( opts.password, ver ?? 0, opts.md5 );
		if ( !auth.ok ) throw new Error( "authentication failed" );
		pwHash = auth.pwHash;
	}

	const authedSeam = new BrowserDeviceSeam( { baseUrl, ver, ipas, pwHash } );
	const api = new OsApiClient( authedSeam );

	const [ jc, jo ] = await Promise.all( [ api.getControllerStatus(), api.getOptions() ] );
	const html = renderControllerStatus( jc, jo, deriveCapabilities( jc, jo ) );
	if ( mount ) mount.innerHTML = html;
	return html;
}

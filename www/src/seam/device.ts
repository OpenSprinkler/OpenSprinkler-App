/**
 * Device seam adapter — Phase 1 / Step 1 (the integration contract, PRD §4).
 *
 * This is the ONLY place that knows HOW to reach the controller. It must preserve the
 * proven behavior currently living in www/js/home.js, so the modern UI can be built on top
 * without re-solving the hard problems:
 *   - self-locating asset base        (home.js getAssetLocation, ~line 23)
 *   - device base URL resolution      (LAN: window.location;  remote: OTC forward path)
 *   - md5 password auth               (www/js/hasher.js;  home.js ~line 342, pw= param)
 *   - CORS / cross-origin requests    (home.js ~line 277/339)
 *   - LAN (http) vs OpenThings-Cloud (https tunnel) access paths
 *
 * The interface is final for the scaffold; BrowserDeviceSeam is a STUB whose TODOs map
 * 1:1 to the existing home.js logic to port. The seam spike (PRD §8 step 2) replaces the
 * stub with the real implementation and proves both access paths against a live device.
 */

export interface DeviceSeamConfig {
	/** Base URL of the device, e.g. "http://192.168.1.100/" (LAN) or an OTC forward URL. */
	baseUrl: string;
	/** Firmware globals injected by server_home before home.js loads. */
	ver?: number;   // OS_FW_VERSION
	ipas?: number;  // ignore-password flag
	/** md5 hash of the device password (empty when ipas or open). */
	pwHash?: string;
	/** Access path in use (affects mixed-content handling). */
	transport?: "lan" | "otc";
}

export interface DeviceSeam {
	readonly config: Readonly<DeviceSeamConfig>;
	/** GET a controller endpoint (e.g. "jc", "jo", "jl?type=..") and parse JSON. */
	requestJson( path: string ): Promise<unknown>;
}

/** A function that returns the md5 hex of a string (provide www/js/hasher.js's md5). */
export type Md5 = ( input: string ) => string;

/**
 * Resolve the firmware-injected globals + asset base, mirroring home.js getAssetLocation().
 * In a real bootstrap these come from the `<script src=...home.js>` tag and `var ver,ipas`.
 */
export function readFirmwareGlobals(): { ver?: number; ipas?: number } {
	const g = globalThis as Record<string, unknown>;
	return {
		ver: typeof g.ver === "number" ? g.ver as number : undefined,
		ipas: typeof g.ipas === "number" ? g.ipas as number : undefined,
	};
}

/** Browser implementation. STUB for the scaffold — ports of home.js logic are marked TODO. */
export class BrowserDeviceSeam implements DeviceSeam {
	constructor( readonly config: Readonly<DeviceSeamConfig> ) {}

	/** Build a request URL, appending the hashed password when present (home.js pw= convention). */
	buildUrl( path: string ): string {
		const base = this.config.baseUrl.endsWith( "/" ) ? this.config.baseUrl : this.config.baseUrl + "/";
		const url = base + path;
		if ( !this.config.pwHash ) return url;
		return url + ( url.includes( "?" ) ? "&" : "?" ) + "pw=" + this.config.pwHash;
	}

	async requestJson( path: string ): Promise<unknown> {
		// TODO(port from home.js): CORS handling (legacy XDomainRequest shim no longer needed),
		// TODO: OTC vs LAN base selection + mixed-content handling (PRD §4 #1 risk),
		// TODO: timeout/retry parity with the existing app.
		const res = await fetch( this.buildUrl( path ), {
			method: "GET",
			headers: { Accept: "application/json" },
		} );
		if ( !res.ok ) throw new Error( `device request failed: ${ res.status } ${ res.statusText } (${ path })` );
		return res.json();
	}
}

/** Hash a password for the pw= param (port of www/js/hasher.js md5). */
export function hashPassword( md5: Md5, password: string ): string {
	return password ? md5( password ) : "";
}

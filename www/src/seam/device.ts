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

/** Result of an authentication attempt. */
export interface AuthResult { ok: boolean; pwHash: string; }

/**
 * Resolve the device base URL from the current location (LAN path), mirroring home.js
 * `document.URL.match(/(https?:\/\/.*)\/.*?/)[1]`. For OTC remote access, pass the cloud
 * forward URL as `baseUrl` instead — the seam treats both uniformly.
 */
export function resolveDeviceBaseFromLocation( href: string = ( globalThis as { location?: { href: string } } ).location?.href ?? "" ): string {
	const m = href.match( /(https?:\/\/[^/]+)/ );
	return m ? m[ 1 ] + "/" : "";
}

/**
 * Browser implementation — ports the proven device-comms from www/js/home.js:
 *   - request with the `pw=` (md5) auth param,
 *   - native `fetch` CORS (the legacy XDomainRequest IE8/9 shim is no longer needed),
 *   - LAN vs OTC handled uniformly via `config.baseUrl`,
 *   - version-gated auth check against `/sp` (md5 for fwv>=213, cleartext fallback/<208).
 */
export class BrowserDeviceSeam implements DeviceSeam {
	constructor( readonly config: Readonly<DeviceSeamConfig> ) {}

	/** Build a request URL, appending the hashed password when present (home.js pw= convention). */
	buildUrl( path: string ): string {
		const base = this.config.baseUrl.endsWith( "/" ) ? this.config.baseUrl : this.config.baseUrl + "/";
		const url = base + path;
		if ( !this.config.pwHash ) return url;
		return url + ( url.includes( "?" ) ? "&" : "?" ) + "pw=" + encodeURIComponent( this.config.pwHash );
	}

	async requestJson( path: string ): Promise<unknown> {
		// CORS is handled natively by fetch in modern browsers (firmware sends the headers);
		// LAN vs OTC differ only by config.baseUrl. NOTE: an HTTPS-hosted app cannot reach a
		// plain-HTTP LAN device (mixed content) — remote access must go via the OTC HTTPS tunnel
		// (PRD §4 risk #1). This is what the live LAN+OTC hardware proof validates.
		const res = await fetch( this.buildUrl( path ), {
			method: "GET",
			mode: "cors",
			headers: { Accept: "application/json" },
		} );
		if ( !res.ok ) throw new Error( `device request failed: ${ res.status } ${ res.statusText } (${ path })` );
		return res.json();
	}

	/**
	 * Authenticate against the device (port of home.js homeCheckPW / version gating).
	 * `GET /sp?pw=&npw=&cpw=` returns `{result}` (<=1 = valid). fwv>=213 hashes with md5
	 * (cleartext fallback); fwv<208 sends cleartext. Returns the pwHash to store on the seam.
	 */
	async authenticate( password: string, fwv: number, md5: Md5 ): Promise<AuthResult> {
		if ( fwv < 208 ) {
			return { ok: await this.checkPassword( password ), pwHash: password };
		}
		if ( fwv >= 213 ) {
			const hashed = md5( password );
			if ( await this.checkPassword( hashed ) ) return { ok: true, pwHash: hashed };
			// fall back to cleartext for devices that pre-date hashed auth
			return { ok: await this.checkPassword( password ), pwHash: password };
		}
		return { ok: await this.checkPassword( password ), pwHash: password };
	}

	/** `GET /sp?pw=&npw=&cpw=` → `{result}`; valid when result is defined and <= 1. */
	private async checkPassword( pass: string ): Promise<boolean> {
		const base = this.config.baseUrl.endsWith( "/" ) ? this.config.baseUrl : this.config.baseUrl + "/";
		const p = encodeURIComponent( pass );
		const res = await fetch( `${ base }sp?pw=${ p }&npw=${ p }&cpw=${ p }`, { method: "GET", mode: "cors" } );
		if ( !res.ok ) return false;
		const data = await res.json() as { result?: number };
		return typeof data.result !== "undefined" && data.result <= 1;
	}
}

/** Hash a password for the pw= param (port of www/js/hasher.js md5). */
export function hashPassword( md5: Md5, password: string ): string {
	return password ? md5( password ) : "";
}

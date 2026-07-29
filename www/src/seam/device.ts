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
 * BrowserDeviceSeam is the shared browser/server implementation; contract tests pin its
 * authentication, transport, cancellation, and response-parsing behavior.
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
	/** Hard deadline for one fetch plus body read. Defaults to 10 seconds. */
	requestTimeoutMs?: number;
}

export interface DeviceSeam {
	readonly config: Readonly<DeviceSeamConfig>;
	/** GET a controller endpoint (e.g. "jc", "jo", "jl?type=..") and parse JSON. */
	requestJson( path: string, signal?: AbortSignal ): Promise<unknown>;
	/**
	 * Send a CHANGE command (e.g. "cm?sid=0&en=1&t=60", "cv?rd=2") and parse the `{result}` JSON.
	 * Mirrors home.js sendToOS transport: POST (params in the body, query stripped from the path)
	 * for fwv>=300, else GET; the `pw=` hash is injected either way.
	 */
	runCommand( path: string, signal?: AbortSignal ): Promise<unknown>;
}

/** A function that returns the md5 hex of a string (provide www/js/hasher.js's md5). */
export type Md5 = ( input: string ) => string;

export const DEFAULT_DEVICE_TIMEOUT_MS = 10000;

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
 * Resolve the device base URL from the current page directory. This intentionally preserves an
 * OTC forwarding prefix (for example `/forward/v1/<token>/`) while still resolving a normal
 * device page such as `/index.html` to the origin root.
 */
export function resolveDeviceBaseFromLocation( href: string = ( globalThis as { location?: { href: string } } ).location?.href ?? "" ): string {
	try {
		const u = new URL( href );
		if ( u.protocol !== "http:" && u.protocol !== "https:" ) return "";
		u.search = "";
		u.hash = "";
		const last = u.pathname.split( "/" ).pop() ?? "";
		if ( last.includes( "." ) ) u.pathname = u.pathname.slice( 0, -last.length );
		else if ( !u.pathname.endsWith( "/" ) ) u.pathname += "/";
		return u.href;
	} catch { return ""; }
}

/**
 * Select the raw controller target without allowing a URL handoff to override a firmware-served
 * page. Firmware globals establish that the current page is the controller (or its OTC forward
 * prefix), so trusting `base` there would disclose the user's replayable controller credential.
 */
export function selectBootstrapDeviceBase( options: {
	firmwarePage: boolean; pageHref: string; configuredBase?: string; savedBase?: string;
} ): string | undefined {
	return options.firmwarePage
		? resolveDeviceBaseFromLocation( options.pageHref ) || undefined
		: options.configuredBase ?? options.savedBase;
}

/** Resolve and validate an explicit controller/companion base against a page URL. */
export function normalizeHttpBase( candidate: string, pageHref?: string ): string {
	let u: URL;
	try { u = new URL( candidate, pageHref ); }
	catch { throw new Error( "Invalid service URL." ); }
	if ( u.protocol !== "http:" && u.protocol !== "https:" ) throw new Error( "Service URL must use HTTP or HTTPS." );
	if ( u.username || u.password ) throw new Error( "Service URL must not contain credentials." );
	u.search = "";
	u.hash = "";
	if ( !u.pathname.endsWith( "/" ) ) u.pathname += "/";
	return u.href;
}

/**
 * Browser implementation — ports the proven device-comms from www/js/home.js:
 *   - request with the `pw=` (md5) auth param,
 *   - native `fetch` CORS (the legacy XDomainRequest IE8/9 shim is no longer needed),
 *   - LAN vs OTC handled uniformly via `config.baseUrl`,
 *   - version-gated auth check against `/sp` (md5 for fwv>=213; cleartext only on old firmware).
 */
export class BrowserDeviceSeam implements DeviceSeam {
	constructor( readonly config: Readonly<DeviceSeamConfig> ) {}

	/** Bound both fetch and response-body parsing; explicit cancellation wins over the request timer. */
	private async withinDeadline<T>( path: string, externalSignal: AbortSignal | undefined,
		request: ( signal: AbortSignal ) => Promise<T> ): Promise<T> {
		if ( externalSignal?.aborted ) throw new Error( `Device request cancelled (${ endpointName( path ) }).` );
		const configured = this.config.requestTimeoutMs;
		const timeoutMs = typeof configured === "number" && Number.isFinite( configured ) && configured > 0
			? configured : DEFAULT_DEVICE_TIMEOUT_MS;
		const abort = new AbortController();
		let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
		let rejectDeadline!: ( error: Error ) => void;
		const deadline = new Promise<never>( ( _resolve, reject ) => { rejectDeadline = reject; } );
		const cancel = (): void => {
			rejectDeadline( new Error( `Device request cancelled (${ endpointName( path ) }).` ) );
			abort.abort();
		};
		externalSignal?.addEventListener( "abort", cancel, { once: true } );
		timer = globalThis.setTimeout( () => {
			rejectDeadline( new Error( `Device request timed out after ${ timeoutMs }ms (${ endpointName( path ) }).` ) );
			abort.abort();
		}, timeoutMs );
		try { return await Promise.race( [ request( abort.signal ), deadline ] ); }
		finally {
			if ( timer !== undefined ) globalThis.clearTimeout( timer );
			externalSignal?.removeEventListener( "abort", cancel );
			abort.abort();
		}
	}

	/** Build a request URL, appending the hashed password when present (home.js pw= convention). */
	buildUrl( path: string ): string {
		const base = this.config.baseUrl.endsWith( "/" ) ? this.config.baseUrl : this.config.baseUrl + "/";
		const url = base + path;
		if ( !this.config.pwHash ) return url;
		return url + ( url.includes( "?" ) ? "&" : "?" ) + "pw=" + encodeURIComponent( this.config.pwHash );
	}

	async requestJson( path: string, signal?: AbortSignal ): Promise<unknown> {
		// CORS is handled natively by fetch in modern browsers (firmware sends the headers);
		// LAN vs OTC differ only by config.baseUrl. NOTE: an HTTPS-hosted app cannot reach a
		// plain-HTTP LAN device (mixed content) — remote access must go via the OTC HTTPS tunnel
		// (PRD §4 risk #1). This is what the live LAN+OTC hardware proof validates.
		return this.withinDeadline( path, signal, async ( requestSignal ) => {
			const res = await fetch( this.buildUrl( path ), {
				method: "GET",
				mode: "cors",
				headers: { Accept: "application/json" },
				signal: requestSignal,
			} );
			if ( !res.ok ) throw new Error( `Device request failed (${ res.status }, ${ endpointName( path ) }).` );
			return readJsonResponse( res, path );
		} );
	}

	/**
	 * Send a change command. Faithful to home.js sendToOS: change endpoints use POST for fwv>=300
	 * (the query string becomes the form body, so large station/program payloads aren't capped by
	 * URL length), else GET. The `pw=` hash is injected into the query (GET) or body (POST).
	 */
	async runCommand( path: string, signal?: AbortSignal ): Promise<unknown> {
		const usePOST = typeof this.config.ver === "number" && this.config.ver >= 300;
		const reboot = endpointName( path ) === "cv" && new URLSearchParams( path.split( "?" )[ 1 ] ?? "" ).get( "rbt" ) === "1";
		if ( !usePOST ) {
			try {
				return await this.withinDeadline( path, signal, async ( requestSignal ) => {
					const res = await fetch( this.buildUrl( path ), {
						method: "GET", mode: "cors", headers: { Accept: "application/json" }, signal: requestSignal,
					} );
					if ( !res.ok ) throw new Error( `Device command failed (${ res.status }, ${ endpointName( path ) }).` );
					return readCommandResponse( res, reboot );
				} );
			} catch ( e ) {
				// A controller commonly closes the connection as soon as reboot begins. Only that exact
				// command treats a transport disconnect as acknowledgement; all other failures propagate.
					if ( reboot && isTransportDisconnect( e ) && !signal?.aborted ) return { result: 1, unverified: true };
				throw e;
			}
		}
		const base = this.config.baseUrl.endsWith( "/" ) ? this.config.baseUrl : this.config.baseUrl + "/";
		const q = path.indexOf( "?" );
		const pathOnly = q >= 0 ? path.slice( 0, q ) : path;
		const query = q >= 0 ? path.slice( q + 1 ) : "";
		const pw = this.config.pwHash ? ( query ? "&" : "" ) + "pw=" + encodeURIComponent( this.config.pwHash ) : "";
		try {
			return await this.withinDeadline( pathOnly, signal, async ( requestSignal ) => {
				const res = await fetch( base + pathOnly, {
					method: "POST", mode: "cors",
					headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
					body: query + pw,
					signal: requestSignal,
				} );
				if ( !res.ok ) throw new Error( `Device command failed (${ res.status }, ${ pathOnly }).` );
				return readCommandResponse( res, reboot );
			} );
		} catch ( e ) {
			if ( reboot && isTransportDisconnect( e ) && !signal?.aborted ) return { result: 1, unverified: true };
			throw e;
		}
	}

	/**
	 * Authenticate against the device (port of home.js homeCheckPW / version gating).
	 * `GET /sp?pw=&npw=&cpw=` returns `{result}` (<=1 = valid). fwv>=213 hashes with md5
	 * without a cleartext retry; fwv<213 uses the legacy cleartext protocol. Returns the pwHash to
	 * store on the seam.
	 */
	async authenticate( password: string, fwv: number, md5: Md5, signal?: AbortSignal ): Promise<AuthResult> {
		if ( fwv < 208 ) {
			return { ok: await this.checkPassword( password, signal ), pwHash: password };
		}
		if ( fwv >= 213 ) {
			const hashed = md5( password );
			return { ok: await this.checkPassword( hashed, signal ), pwHash: hashed };
		}
		return { ok: await this.checkPassword( password, signal ), pwHash: password };
	}

	/** `GET /sp?pw=&npw=&cpw=` → `{result}`; firmware success codes are integer 0 or 1. */
	private async checkPassword( pass: string, signal?: AbortSignal ): Promise<boolean> {
		const base = this.config.baseUrl.endsWith( "/" ) ? this.config.baseUrl : this.config.baseUrl + "/";
		const p = encodeURIComponent( pass );
		return this.withinDeadline( "sp", signal, async ( requestSignal ) => {
			const res = await fetch( `${ base }sp?pw=${ p }&npw=${ p }&cpw=${ p }`, {
				method: "GET", mode: "cors", signal: requestSignal,
			} );
			if ( !res.ok ) return false;
			const data = await readJsonResponse( res, "sp" ) as { result?: unknown };
			return Number.isSafeInteger( data.result ) && ( data.result === 0 || data.result === 1 );
		} );
	}
}

function endpointName( path: string ): string {
	return path.split( "?", 1 )[ 0 ] || "device";
}

function isTransportDisconnect( error: unknown ): boolean {
	return error instanceof TypeError || ( typeof DOMException !== "undefined" &&
		error instanceof DOMException && error.name === "NetworkError" );
}

class ControllerResponseError extends Error {
	constructor( endpoint: string ) {
		super( `Device returned an invalid JSON response (${ endpoint }).` );
		this.name = "ControllerResponseError";
	}
}

/** Parse controller JSON without retaining V8's payload-quoting SyntaxError message or a raw cause. */
async function readJsonResponse( res: Response, path: string ): Promise<unknown> {
	try { return await res.json() as unknown; }
	catch { throw new ControllerResponseError( endpointName( path ) ); }
}

async function readCommandResponse( res: Response, allowEmpty: boolean ): Promise<unknown> {
	// Real Response objects provide text(); older unit mocks provide only json().
	if ( typeof res.text !== "function" ) return readJsonResponse( res, "command" );
	const body = await res.text();
	if ( body.trim() === "" ) {
		if ( allowEmpty ) return { result: 1, unverified: true };
		throw new Error( "Device returned an empty command response." );
	}
	try { return JSON.parse( body ) as unknown; }
	catch { throw new Error( "Device returned an invalid command response." ); }
}

/** Hash a password for the pw= param (port of www/js/hasher.js md5). */
export function hashPassword( md5: Md5, password: string ): string {
	return password ? md5( password ) : "";
}

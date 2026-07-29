/** Companion configuration, loaded + validated from environment variables (FR-24/25). */
export interface CompanionConfig {
	storage: "sqlite";
	databasePath: string;
	controllerBase: string;       // required
	controllerPw?: string;        // omit for ipas devices
	controllerId?: string;        // stable id override (else MAC, else base hash)
	controllerFwv?: number;       // auto-probed if unset
	pollIntervalSec: number;
	logBackfillDays: number;
	port: number;
	listenHost: "127.0.0.1" | "0.0.0.0" | "::1" | "::";
	historyMaxDays: number;
	controllerTimeoutMs: number;
	apiAllowedOrigins: string[];
	apiToken?: string;
}

function intInRange( name: string, v: string | undefined, fallback: number, min: number, max: number ): number {
	if ( v === undefined || v === "" ) return fallback;
	if ( !/^(0|[1-9]\d*)$/.test( v ) ) throw new Error( `${ name } must be an integer from ${ min } to ${ max }` );
	const n = Number( v );
	if ( !Number.isSafeInteger( n ) || n < min || n > max ) {
		throw new Error( `${ name } must be an integer from ${ min } to ${ max }` );
	}
	return n;
}

function controllerUrl( raw: string ): URL {
	let url: URL;
	try { url = new URL( raw ); }
	catch { throw new Error( "CONTROLLER_BASE must be a valid http(s) URL" ); }
	if ( url.protocol !== "http:" && url.protocol !== "https:" ) throw new Error( "CONTROLLER_BASE must use http or https" );
	if ( url.username || url.password ) throw new Error( "CONTROLLER_BASE must not contain credentials; use CONTROLLER_PW" );
	if ( url.search || url.hash ) throw new Error( "CONTROLLER_BASE must not contain a query string or fragment" );
	if ( !url.pathname.endsWith( "/" ) ) url.pathname += "/";
	return url;
}

function allowedOrigins( raw: string | undefined, controllerOrigin: string ): string[] {
	if ( raw === undefined || raw.trim() === "" ) return [ controllerOrigin ];
	const values = raw.split( "," ).map( ( value ) => value.trim() ).filter( Boolean );
	if ( values.length === 0 ) throw new Error( "API_ALLOWED_ORIGINS must contain at least one origin" );
	return values.map( ( value ) => {
		if ( value === "*" ) return value;
		let url: URL;
		try { url = new URL( value ); }
		catch { throw new Error( `API_ALLOWED_ORIGINS contains an invalid origin: ${ value }` ); }
		if ( ( url.protocol !== "http:" && url.protocol !== "https:" ) || url.username || url.password ||
			url.pathname !== "/" || url.search || url.hash ) {
			throw new Error( `API_ALLOWED_ORIGINS entries must be http(s) origins: ${ value }` );
		}
		return url.origin;
	} );
}

function listenHost( raw: string | undefined ): CompanionConfig["listenHost"] {
	const value = raw?.trim() || "127.0.0.1";
	if ( value === "127.0.0.1" || value === "0.0.0.0" || value === "::1" || value === "::" ) return value;
	throw new Error( "LISTEN_HOST must be a loopback or wildcard IP literal (127.0.0.1, 0.0.0.0, ::1, or ::)" );
}

export function loadConfig( env: Record<string, string | undefined> = process.env ): CompanionConfig {
	const rawControllerBase = env.CONTROLLER_BASE?.trim();
	if ( !rawControllerBase ) throw new Error( "CONTROLLER_BASE is required (e.g. http://10.0.0.5/)" );
	if ( env.STORAGE !== undefined && env.STORAGE !== "sqlite" ) throw new Error( "STORAGE must be 'sqlite'" );
	const base = controllerUrl( rawControllerBase );
	const databasePath = env.DATABASE_PATH?.trim() || "/data/data.db";
	const controllerId = env.CONTROLLER_ID?.trim();
	if ( env.CONTROLLER_ID !== undefined && !controllerId ) throw new Error( "CONTROLLER_ID must not be empty" );
	const rawApiToken = env.API_TOKEN;
	const apiToken = rawApiToken === undefined || rawApiToken === "" ? undefined : rawApiToken;
	if ( apiToken !== undefined && !/^[\x21-\x7e]{16,512}$/.test( apiToken ) ) {
		throw new Error( "API_TOKEN must be 16-512 visible ASCII characters without spaces" );
	}
	return {
		storage: "sqlite",
		databasePath,
		controllerBase: base.toString(),
		controllerPw: env.CONTROLLER_PW,
		controllerId,
		controllerFwv: env.CONTROLLER_FWV === undefined || env.CONTROLLER_FWV === "" ? undefined
			: intInRange( "CONTROLLER_FWV", env.CONTROLLER_FWV, 0, 1, 9999 ),
		pollIntervalSec: intInRange( "POLL_INTERVAL_SEC", env.POLL_INTERVAL_SEC, 300, 1, 86400 ),
		logBackfillDays: intInRange( "LOG_BACKFILL_DAYS", env.LOG_BACKFILL_DAYS, 2, 1, 365 ),
		port: intInRange( "PORT", env.PORT, 8080, 1, 65535 ),
		listenHost: listenHost( env.LISTEN_HOST ),
		historyMaxDays: intInRange( "HISTORY_MAX_DAYS", env.HISTORY_MAX_DAYS, 90, 1, 3650 ),
		controllerTimeoutMs: intInRange( "CONTROLLER_TIMEOUT_MS", env.CONTROLLER_TIMEOUT_MS, 10000, 100, 300000 ),
		apiAllowedOrigins: allowedOrigins( env.API_ALLOWED_ORIGINS, base.origin ),
		apiToken,
	};
}

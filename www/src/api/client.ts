/**
 * Typed OpenSprinkler API client — Phase 1 / Step 1 (contract capture).
 *
 * The single module (besides the seam adapter) that knows the device's wire format.
 * Parsers are intentionally TOLERANT validators, not strict schema guards: the firmware
 * API is not a declared schema (emit_p into a ~2 KB buffer, state-dependent shapes), so
 * we assert the invariants the UI actually depends on and narrow the known ambiguities
 * (lrun order, /jl discriminated union, eip number|string), rather than reject unknown keys.
 *
 * See docs/PHASE-1-MODERNIZATION-PRD.md. No new fields may be required here without Phase 2
 * (firmware) work — consume only what the firmware already emits.
 */
import type {
	JcResponse, JoResponse, JnResponse, JpResponse, JlResponse, JlRow,
	JlStationRow, JsResponse, Capabilities,
} from "./types";
import type { DeviceSeam } from "../seam/device";

export class ApiError extends Error {
	constructor( message: string, readonly endpoint: string, readonly raw?: unknown ) {
		super( message );
		this.name = "ApiError";
	}
}

function requireNumber( o: Record<string, unknown>, key: string, endpoint: string ): number {
	const v = o[ key ];
	if ( typeof v !== "number" || Number.isNaN( v ) ) {
		throw new ApiError( `expected numeric '${ key }'`, endpoint, v );
	}
	return v;
}
function requireArray( o: Record<string, unknown>, key: string, endpoint: string ): unknown[] {
	const v = o[ key ];
	if ( !Array.isArray( v ) ) throw new ApiError( `expected array '${ key }'`, endpoint, v );
	return v;
}

/** /jl row discriminator: special rows put a string ('s1'|'s2'|'rd'|'wl'|'fl'|'cu') at index 1. */
export function isStationLogRow( row: JlRow ): row is JlStationRow {
	return typeof row[ 1 ] === "number";
}

// ---- Parsers (raw JSON -> typed, with invariant checks) ----------------------

export function parseJc( raw: unknown ): JcResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/jc", raw );
	const o = raw as Record<string, unknown>;
	requireNumber( o, "devt", "/jc" );
	requireNumber( o, "nbrd", "/jc" );
	const lrun = requireArray( o, "lrun", "/jc" );
	if ( lrun.length !== 4 ) throw new ApiError( "lrun must have 4 elements [station,program,duration,endtime]", "/jc", lrun );
	requireArray( o, "ps", "/jc" );
	requireArray( o, "sbits", "/jc" );
	if ( typeof o.eip !== "number" && typeof o.eip !== "string" ) {
		throw new ApiError( "eip must be number|string", "/jc", o.eip );
	}
	return o as unknown as JcResponse;
}

export function parseJo( raw: unknown ): JoResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/jo", raw );
	const o = raw as Record<string, unknown>;
	requireNumber( o, "fwv", "/jo" ); // pre-auth readable; always present
	return o as unknown as JoResponse;
}

/** /jo can arrive as a pre-auth fallback `{fwv}` when the password check fails. */
export function isPreAuthFallback( jo: Partial<JoResponse> ): boolean {
	return typeof jo.fwv === "number" && Object.keys( jo ).length <= 2;
}

export function parseJn( raw: unknown ): JnResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/jn", raw );
	const o = raw as Record<string, unknown>;
	requireArray( o, "snames", "/jn" );
	requireArray( o, "stn_dis", "/jn" );
	return o as unknown as JnResponse;
}

export function parseJp( raw: unknown ): JpResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/jp", raw );
	const o = raw as Record<string, unknown>;
	requireNumber( o, "nprogs", "/jp" );
	requireArray( o, "pd", "/jp" );
	return o as unknown as JpResponse;
}

export function parseJl( raw: unknown ): JlResponse {
	if ( !Array.isArray( raw ) ) throw new ApiError( "/jl response must be an array", "/jl", raw );
	for ( const row of raw ) {
		if ( !Array.isArray( row ) || row.length < 4 ) throw new ApiError( "malformed log row", "/jl", row );
	}
	return raw as JlResponse;
}

export function parseJs( raw: unknown ): JsResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/js", raw );
	const o = raw as Record<string, unknown>;
	requireArray( o, "sn", "/js" );
	requireNumber( o, "nstations", "/js" );
	return o as unknown as JsResponse;
}

/**
 * Fork build-tag suffix for the version string (e.g. " +kars85.3"). The kars85 firmware fork
 * emits `fwf` as a string in /jo; official firmware omits it, so the suffix is guarded to "".
 * No firmware change is needed — the field is already served when present.
 */
export function getForkTag( jo: Pick<JoResponse, "fwf"> ): string {
	return typeof jo.fwf === "string" && jo.fwf ? " +" + jo.fwf : "";
}

/** Derive UI capability flags from /jc + /jo (PRD §5 fwv matrix). */
export function deriveCapabilities( jc: JcResponse, jo: JoResponse ): Capabilities {
	return {
		fwvCombined: jo.fwv * 10 + ( typeof jo.fwm === "number" ? jo.fwm : 0 ),
		weatherRestricted: typeof jc.wtrestr === "number",
		secondMaster: typeof jo.mas2 === "number" && jo.mas2 > 0,
		secondSensor: typeof jo.sn2t === "number",
		flowSensor: jo.sn1t === 2,
		otfCloud: jc.otc !== undefined,
	};
}

// ---- Client (parsers + the seam transport) -----------------------------------

/**
 * Thin typed client. All device I/O goes through the injected DeviceSeam (which encapsulates
 * device-base resolution, md5 auth, CORS and the LAN-vs-OTC-cloud path — ported from home.js).
 */
export class OsApiClient {
	constructor( private readonly seam: DeviceSeam ) {}

	private async get<T>( path: string, parse: ( raw: unknown ) => T ): Promise<T> {
		const raw = await this.seam.requestJson( path );
		return parse( raw );
	}

	getControllerStatus(): Promise<JcResponse> { return this.get( "jc", parseJc ); }
	getOptions(): Promise<JoResponse> { return this.get( "jo", parseJo ); }
	getStations(): Promise<JnResponse> { return this.get( "jn", parseJn ); }
	getPrograms(): Promise<JpResponse> { return this.get( "jp", parseJp ); }
	getLogs( query = "" ): Promise<JlResponse> { return this.get( "jl" + ( query ? "?" + query : "" ), parseJl ); }
	getStatus(): Promise<JsResponse> { return this.get( "js", parseJs ); }

	/** Pre-auth firmware-version probe (works before login). */
	async probeFirmwareVersion(): Promise<number> {
		const raw = await this.seam.requestJson( "jo" );
		const o = ( raw && typeof raw === "object" ) ? raw as Record<string, unknown> : {};
		if ( typeof o.fwv !== "number" ) throw new ApiError( "no fwv in /jo", "/jo", raw );
		return o.fwv;
	}
}

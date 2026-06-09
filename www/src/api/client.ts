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
	JlStationRow, JsResponse, Capabilities, OSProgram,
} from "./types";
import type { DeviceSeam } from "../seam/device";
import {
	encodeProgram, programSubmitPath, stationConfigPath, optionsPath,
	type ProgramInput, type StationConfigInput,
} from "./encode";

export class ApiError extends Error {
	constructor( message: string, readonly endpoint: string, readonly raw?: unknown ) {
		super( message );
		this.name = "ApiError";
	}
}

/** Firmware change-command result codes (opensprinkler_server.cpp / defines.h HTML_* ). */
export const COMMAND_RESULT_TEXT: Record<number, string> = {
	1: "Success", 2: "Unauthorized", 3: "Mismatch", 16: "Data missing", 17: "Out of range",
	18: "Data format error", 19: "RF code error", 32: "Page not found", 48: "Not permitted",
};

/** Thrown when a change command returns a non-success (`result !== 1`) code. */
export class CommandError extends Error {
	constructor( readonly code: number, readonly endpoint: string ) {
		super( ( COMMAND_RESULT_TEXT[ code ] ?? `command failed (result ${ code })` ) + ` [${ endpoint }]` );
		this.name = "CommandError";
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
	/**
	 * Fetch the log history. The firmware /jl REQUIRES a start/end epoch range — without it it returns
	 * `{result:16}` (data missing), NOT an array (verified on real hardware) — so this defaults to the
	 * last `days` (7). `end` is padded by 86340s to include the final day (legacy logs.js parity).
	 */
	getLogs( opts: { start?: number; end?: number; type?: string; days?: number; now?: number } = {} ): Promise<JlResponse> {
		const end = opts.end ?? Math.floor( ( opts.now ?? Date.now() ) / 1000 );
		const start = opts.start ?? ( end - ( opts.days ?? 7 ) * 86400 );
		const type = opts.type ? `&type=${ encodeURIComponent( opts.type ) }` : "";
		return this.get( `jl?start=${ start }&end=${ end + 86340 }${ type }`, parseJl );
	}
	getStatus(): Promise<JsResponse> { return this.get( "js", parseJs ); }

	/** Pre-auth firmware-version probe (works before login). */
	async probeFirmwareVersion(): Promise<number> {
		const raw = await this.seam.requestJson( "jo" );
		const o = ( raw && typeof raw === "object" ) ? raw as Record<string, unknown> : {};
		if ( typeof o.fwv !== "number" ) throw new ApiError( "no fwv in /jo", "/jo", raw );
		return o.fwv;
	}

	/**
	 * Run a change command and validate the firmware result code (1 = success). Throws CommandError
	 * on any non-success code. The single choke point all typed mutations go through.
	 */
	async command( path: string ): Promise<Record<string, unknown>> {
		const raw = await this.seam.runCommand( path );
		const o = ( raw && typeof raw === "object" ) ? raw as Record<string, unknown> : {};
		const result = typeof o.result === "number" ? o.result : NaN;
		if ( result !== 1 ) throw new CommandError( result, path );
		return o;
	}

	// ---- control / action paths (/cm, /cr, /cv, /dp) -------------------------

	/** Manually start (en=1, with seconds) or stop (en=0) a station. /cm */
	startStation( sid: number, seconds: number ): Promise<Record<string, unknown>> {
		return this.command( `cm?sid=${ sid }&en=1&t=${ Math.max( 0, Math.round( seconds ) ) }` );
	}
	stopStation( sid: number ): Promise<Record<string, unknown>> {
		return this.command( `cm?sid=${ sid }&en=0` );
	}
	/** Run-once: per-station seconds (index = sid); a trailing 0 is appended for legacy fw. /cr */
	runOnce( durationsBySid: number[] ): Promise<Record<string, unknown>> {
		const t = JSON.stringify( [ ...durationsBySid.map( ( n ) => Math.max( 0, Math.round( n ) ) ), 0 ] );
		return this.command( `cr?t=${ encodeURIComponent( t ) }` );
	}
	/** Set the rain delay in hours (0 cancels). /cv?rd= */
	setRainDelayHours( hours: number ): Promise<Record<string, unknown>> {
		return this.command( `cv?rd=${ Math.max( 0, hours ) }` );
	}
	cancelRainDelay(): Promise<Record<string, unknown>> { return this.command( "cv?rd=0" ); }
	stopAllStations(): Promise<Record<string, unknown>> { return this.command( "cv?rsn=1" ); }
	setControllerEnabled( enabled: boolean ): Promise<Record<string, unknown>> {
		return this.command( `cv?en=${ enabled ? 1 : 0 }` );
	}
	reboot(): Promise<Record<string, unknown>> { return this.command( "cv?rbt=1" ); }
	clearOvercurrent(): Promise<Record<string, unknown>> { return this.command( "cv?rocs=1" ); }
	deleteProgram( pid: number ): Promise<Record<string, unknown>> { return this.command( `dp?pid=${ pid }` ); }

	/**
	 * Enable/disable a program by re-packing its existing /jp tuple with flags bit0 flipped and
	 * resubmitting via /cp (the firmware has no enable-only toggle). No decode needed — the read
	 * tuple already carries the v-array fields.
	 */
	setProgramEnabled( pid: number, program: OSProgram, enabled: boolean ): Promise<Record<string, unknown>> {
		const [ flags, days0, days1, starttimes, durations, name, daterange ] = program;
		const newFlags = enabled ? ( flags | 1 ) : ( flags & ~1 );
		const v: Array<number | number[]> = [ newFlags, days0, days1, starttimes, durations ];
		let path = `cp?pid=${ pid }&v=${ encodeURIComponent( JSON.stringify( v ) ) }&name=${ encodeURIComponent( name ) }`;
		if ( Array.isArray( daterange ) ) {
			path += `&endr=${ daterange[ 0 ] ? 1 : 0 }&from=${ daterange[ 1 ] ?? 0 }&to=${ daterange[ 2 ] ?? 0 }`;
		}
		return this.command( path );
	}

	/** Run a program's per-station durations immediately as a run-once. /cr */
	runProgramNow( program: OSProgram ): Promise<Record<string, unknown>> {
		return this.runOnce( program[ 4 ] );
	}

	// ---- settings (/cp, /cs, /co) -------------------------------------------

	/** Create (pid=-1) or update a program. /cp */
	submitProgram( pid: number, program: ProgramInput ): Promise<Record<string, unknown>> {
		return this.command( programSubmitPath( pid, encodeProgram( program ) ) );
	}
	/** Save station names + attributes. /cs */
	submitStations( cfg: StationConfigInput ): Promise<Record<string, unknown>> {
		return this.command( stationConfigPath( cfg ) );
	}
	/** Save general/weather/network options by NAMED key (fw219+; keys match /jo). /co */
	submitOptions( named: Record<string, string | number> ): Promise<Record<string, unknown>> {
		return this.command( optionsPath( named ) );
	}
}

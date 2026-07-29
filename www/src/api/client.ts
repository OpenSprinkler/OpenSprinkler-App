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
	constructor( message: string, readonly endpoint: string, _raw?: unknown ) {
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
		super( ( COMMAND_RESULT_TEXT[ code ] ?? `Command failed (result ${ code })` ) + ` [${ endpoint }]` );
		this.name = "CommandError";
	}
}

function endpointName( path: string ): string { return path.split( "?", 1 )[ 0 ] || "device"; }

function requireNumber( o: Record<string, unknown>, key: string, endpoint: string ): number {
	const v = o[ key ];
	if ( typeof v !== "number" || !Number.isFinite( v ) ) {
		throw new ApiError( `expected numeric '${ key }'`, endpoint, v );
	}
	return v;
}
function requireArray( o: Record<string, unknown>, key: string, endpoint: string ): unknown[] {
	const v = o[ key ];
	if ( !Array.isArray( v ) ) throw new ApiError( `expected array '${ key }'`, endpoint, v );
	return v;
}

function requirePlainRecord( o: Record<string, unknown>, key: string, endpoint: string ): Record<string, unknown> {
	const v = o[ key ];
	if ( typeof v !== "object" || v === null || Array.isArray( v ) ) {
		throw new ApiError( `expected plain object '${ key }'`, endpoint, v );
	}
	const prototype = Object.getPrototypeOf( v );
	if ( prototype !== Object.prototype && prototype !== null ) {
		throw new ApiError( `expected plain object '${ key }'`, endpoint, v );
	}
	return v as Record<string, unknown>;
}

function requireNumberArray( o: Record<string, unknown>, key: string, endpoint: string ): number[] {
	const v = requireArray( o, key, endpoint );
	if ( v.some( ( n ) => typeof n !== "number" || !Number.isFinite( n ) ) ) {
		throw new ApiError( `expected numeric array '${ key }'`, endpoint, v );
	}
	return v as number[];
}

function requireFiniteTuple( value: unknown, length: number, endpoint: string, label: string ): number[] {
	if ( !Array.isArray( value ) || value.length < length || value.slice( 0, length ).some( ( n ) => typeof n !== "number" || !Number.isFinite( n ) ) ) {
		throw new ApiError( `malformed ${ label }`, endpoint, value );
	}
	return value as number[];
}

const MAX_UNIX_SECONDS = 0xffffffff;
// Current supported builds compile at most 24 expanders plus the base board (200 stations).
const MAX_BOARD_COUNT = 25;
const MAX_CONFIGURED_STATION_COUNT = MAX_BOARD_COUNT * 8;
const MAX_WIRE_STATION_COUNT = 255;
const MAX_MULTI_DAY_LEVELS = 14;

function requireUnixTimestamp( value: unknown, endpoint: string, label: string ): number {
	if ( typeof value !== "number" || !Number.isSafeInteger( value ) || value < 0 || value > MAX_UNIX_SECONDS ) {
		throw new ApiError( `malformed ${ label }`, endpoint, value );
	}
	return value;
}

function requireIntegerInRange( value: unknown, min: number, max: number, endpoint: string, label: string ): number {
	if ( typeof value !== "number" || !Number.isSafeInteger( value ) || value < min || value > max ) {
		throw new ApiError( `malformed ${ label }`, endpoint, value );
	}
	return value;
}

function requireEncodedDate( value: unknown, endpoint: string ): number {
	const encoded = requireIntegerInRange( value, 33, 415, endpoint, "program date range" );
	const month = encoded >> 5;
	const day = encoded & 31;
	const monthDays = [ 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
	if ( month < 1 || month > 12 || day < 1 || day > monthDays[ month - 1 ]! ) {
		throw new ApiError( "malformed program date range", endpoint, value );
	}
	return encoded;
}

/** Validate the bit layout used by one fixed/first program start time. */
function isValidEncodedStartTime( value: number ): boolean {
	if ( value === -1 ) return true;
	if ( value < 0 || value > 0x7fff ) return false;
	const sunrise = ( value & ( 1 << 14 ) ) !== 0;
	const sunset = ( value & ( 1 << 13 ) ) !== 0;
	if ( !sunrise && !sunset ) return value <= 1440;
	if ( sunrise && sunset ) return false;
	return ( value & ( 1 << 11 ) ) === 0; // reserved bit; remaining bits are sign + offset
}

function mutationIndex( value: number, label: string ): number {
	if ( !Number.isSafeInteger( value ) || value < 0 || value > 255 ) {
		throw new RangeError( `${ label } index must be an integer from 0 to 255.` );
	}
	return value;
}

function mutationBoolean( value: unknown, label: string ): boolean {
	if ( typeof value !== "boolean" ) throw new TypeError( `${ label } must be a boolean.` );
	return value;
}

/** /jl row discriminator: special rows put a string ('s1'|'s2'|'rs'|'rd'|'wl'|'fl'|'cu') at index 1. */
export function isStationLogRow( row: JlRow ): row is JlStationRow {
	return typeof row[ 1 ] === "number";
}

// ---- Parsers (raw JSON -> typed, with invariant checks) ----------------------

export function parseJc( raw: unknown ): JcResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/jc", raw );
	const o = raw as Record<string, unknown>;
	requireNumber( o, "devt", "/jc" );
	requireUnixTimestamp( o.devt, "/jc", "device timestamp" );
	for ( const key of [ "lwc", "lswc", "lupt" ] ) requireUnixTimestamp( o[ key ], "/jc", `${ key } timestamp` );
	requireIntegerInRange( o.sunrise, 0, 1440, "/jc", "sunrise minutes" );
	requireIntegerInRange( o.sunset, 0, 1440, "/jc", "sunset minutes" );
	requireIntegerInRange( o.wtrestr, 0, 1, "/jc", "weather restriction" );
	if ( typeof o.wterr !== "number" || !Number.isSafeInteger( o.wterr ) ) {
		throw new ApiError( "malformed weather error", "/jc", o.wterr );
	}
	const weatherLevels = requireNumberArray( o, "wls", "/jc" );
	if ( weatherLevels.length > MAX_MULTI_DAY_LEVELS ||
		weatherLevels.some( ( value ) => !Number.isSafeInteger( value ) || value < 0 || value > 250 ) ) {
		throw new ApiError( "malformed multi-day weather levels", "/jc", weatherLevels );
	}
	requirePlainRecord( o, "wtdata", "/jc" );
	const boardCount = requireIntegerInRange( o.nbrd, 1, MAX_BOARD_COUNT, "/jc", "board count" );
	const lrun = requireArray( o, "lrun", "/jc" );
	if ( lrun.length !== 4 ) throw new ApiError( "lrun must have 4 elements [station,program,duration,endtime]", "/jc", lrun );
	requireIntegerInRange( lrun[ 0 ], 0, 255, "/jc", "lrun station" );
	requireIntegerInRange( lrun[ 1 ], 0, 255, "/jc", "lrun program" );
	requireIntegerInRange( lrun[ 2 ], 0, 65535, "/jc", "lrun duration" );
	requireUnixTimestamp( lrun[ 3 ], "/jc", "last-run timestamp" );
	const ps = requireArray( o, "ps", "/jc" );
	if ( ps.length !== boardCount * 8 ) throw new ApiError( "station-status count does not match board count", "/jc", ps );
	ps.forEach( ( tuple ) => {
		if ( !Array.isArray( tuple ) || tuple.length !== 4 ) throw new ApiError( "malformed station-status tuple", "/jc", tuple );
		const status = tuple;
		requireIntegerInRange( status[ 0 ], 0, 255, "/jc", "station-status tuple program" );
		requireIntegerInRange( status[ 1 ], 0, 65535, "/jc", "station-status tuple duration" );
		requireUnixTimestamp( status[ 2 ], "/jc", "station start timestamp" );
		requireIntegerInRange( status[ 3 ], 0, 255, "/jc", "station-status tuple group" );
	} );
	if ( o.rdst !== undefined ) requireUnixTimestamp( o.rdst, "/jc", "rain-delay timestamp" );
	const stationBits = requireNumberArray( o, "sbits", "/jc" );
	if ( stationBits.length !== boardCount + 1 || stationBits[ boardCount ] !== 0 ||
		stationBits.some( ( value ) => !Number.isSafeInteger( value ) || value < 0 || value > 255 ) ) {
		throw new ApiError( "malformed station bitfield", "/jc", stationBits );
	}
	if ( typeof o.eip !== "number" && typeof o.eip !== "string" ) {
		throw new ApiError( "eip must be number|string", "/jc", o.eip );
	}
	if ( typeof o.eip === "number" ) requireIntegerInRange( o.eip, 0, MAX_UNIX_SECONDS, "/jc", "external IP" );
	else if ( o.eip.length < 1 || o.eip.length > 128 ) throw new ApiError( "eip string is malformed", "/jc", o.eip );
	return o as unknown as JcResponse;
}

export function parseJo( raw: unknown ): JoResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/jo", raw );
	const o = raw as Record<string, unknown>;
	requireNumber( o, "fwv", "/jo" ); // pre-auth readable; always present
	for ( const key of [ "fwm", "uwt", "wl", "tz", "ipas", "sn1t", "mas2", "hp0", "hp1" ] ) {
		if ( o[ key ] !== undefined ) requireNumber( o, key, "/jo" );
	}
	if ( o.wl !== undefined ) requireIntegerInRange( o.wl, 0, 250, "/jo", "water level" );
	if ( o.tz !== undefined ) requireIntegerInRange( o.tz, 0, 108, "/jo", "timezone" );
	if ( o.ms !== undefined ) requireNumberArray( o, "ms", "/jo" );
	return o as unknown as JoResponse;
}

/** /jo can arrive as a pre-auth fallback `{fwv}` when the password check fails. */
export function isPreAuthFallback( jo: Partial<JoResponse> ): boolean {
	return typeof jo.fwv === "number" && Object.keys( jo ).length <= 2;
}

export function parseJn( raw: unknown ): JnResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/jn", raw );
	const o = raw as Record<string, unknown>;
	const names = requireArray( o, "snames", "/jn" );
	if ( names.length < 8 || names.length > MAX_CONFIGURED_STATION_COUNT || names.length % 8 !== 0 ||
		names.some( ( name ) => typeof name !== "string" ) ) {
		throw new ApiError( "station names must be strings with one entry per configured station", "/jn", names );
	}
	const maxNameBytes = requireIntegerInRange( o.maxlen, 1, 255, "/jn", "station-name limit" );
	if ( names.some( ( name ) => new TextEncoder().encode( name as string ).length > maxNameBytes ) ) {
		throw new ApiError( "station name exceeds maxlen", "/jn", names );
	}
	const boardCount = names.length / 8;
	for ( const key of [ "masop", "masop2", "ignore_rain", "ignore_sn1", "ignore_sn2", "stn_dis", "stn_spe" ] ) {
		const values = requireNumberArray( o, key, "/jn" );
		if ( values.length !== boardCount || values.some( ( value ) => !Number.isSafeInteger( value ) || value < 0 || value > 255 ) ) {
			throw new ApiError( `malformed per-board station attribute '${ key }'`, "/jn", values );
		}
	}
	const groups = requireNumberArray( o, "stn_grp", "/jn" );
	if ( groups.length !== names.length || groups.some( ( value ) => !Number.isSafeInteger( value ) ||
		( value !== 255 && ( value < 0 || value > 3 ) ) ) ) {
		throw new ApiError( "malformed station groups", "/jn", groups );
	}
	return o as unknown as JnResponse;
}

export function parseJp( raw: unknown ): JpResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/jp", raw );
	const o = raw as Record<string, unknown>;
	const nprogs = requireIntegerInRange( o.nprogs, 0, 255, "/jp", "program count" );
	const boardCount = requireIntegerInRange( o.nboards, 1, MAX_BOARD_COUNT, "/jp", "nboards" );
	const maxPrograms = requireIntegerInRange( o.mnp, 1, 255, "/jp", "mnp" );
	if ( o.mnst !== 4 ) throw new ApiError( "mnst must match the four firmware start-time slots", "/jp", o.mnst );
	const programNameSize = requireIntegerInRange( o.pnsize, 1, 255, "/jp", "pnsize" );
	if ( nprogs > maxPrograms ) throw new ApiError( "program count exceeds controller capacity", "/jp", nprogs );
	const stationCount = boardCount * 8;
	const programs = requireArray( o, "pd", "/jp" ).map( ( value ) => {
		// The supported firmware emits exactly seven fields. Accepting an eighth extension while
		// rebuilding only seven silently discards it and is unsafe for later edit/restore flows.
		if ( !Array.isArray( value ) || value.length !== 7 ) throw new ApiError( "malformed program tuple", "/jp", value );
		requireFiniteTuple( value, 3, "/jp", "program tuple" );
		requireIntegerInRange( value[ 0 ], 0, 0xff, "/jp", "program flags" );
		requireIntegerInRange( value[ 1 ], 0, 0xff, "/jp", "program days" );
		requireIntegerInRange( value[ 2 ], 0, 0xff, "/jp", "program days" );
		if ( !Array.isArray( value[ 3 ] ) || value[ 3 ].length !== 4 ||
			value[ 3 ].some( ( n ) => typeof n !== "number" || !Number.isSafeInteger( n ) || n < -1 || n > 32767 ) ) {
			throw new ApiError( "malformed program start times", "/jp", value[ 3 ] );
		}
		const starts = value[ 3 ] as number[];
		const fixedStarts = ( Number( value[ 0 ] ) & ( 1 << 6 ) ) !== 0;
		if ( fixedStarts ? starts.some( ( start ) => !isValidEncodedStartTime( start ) ) :
			( !isValidEncodedStartTime( starts[ 0 ]! ) || starts[ 0 ] === -1 || starts[ 1 ]! < 0 ||
				starts[ 2 ]! < 0 || starts[ 2 ]! > 1440 || starts[ 3 ] !== 0 ) ) {
			throw new ApiError( "malformed program start times", "/jp", value[ 3 ] );
		}
		if ( !Array.isArray( value[ 4 ] ) || value[ 4 ].length !== stationCount ||
			value[ 4 ].some( ( n ) => typeof n !== "number" || !Number.isSafeInteger( n ) || n < 0 || n > 65535 ) ) {
			throw new ApiError( "malformed program durations", "/jp", value[ 4 ] );
		}
		if ( typeof value[ 5 ] !== "string" ) throw new ApiError( "malformed program name", "/jp", value[ 5 ] );
		if ( new TextEncoder().encode( value[ 5 ] ).length > programNameSize ) throw new ApiError( "program name exceeds pnsize", "/jp", value[ 5 ] );
		const dateRange = value[ 6 ];
		if ( !Array.isArray( dateRange ) || dateRange.length !== 3 ) throw new ApiError( "malformed program date range", "/jp", dateRange );
		const dateRangeEnabled = requireIntegerInRange( dateRange[ 0 ], 0, 1, "/jp", "program date range" );
		if ( dateRangeEnabled !== ( ( Number( value[ 0 ] ) >> 7 ) & 1 ) ) {
			throw new ApiError( "program date-range flag does not match tuple", "/jp", dateRange );
		}
		requireEncodedDate( dateRange[ 1 ], "/jp" );
		requireEncodedDate( dateRange[ 2 ], "/jp" );
		return [ value[ 0 ], value[ 1 ], value[ 2 ], value[ 3 ], value[ 4 ], value[ 5 ], dateRange ];
	} );
	if ( programs.length !== nprogs ) throw new ApiError( "program count does not match pd", "/jp", programs );
	return { ...o, pd: programs } as unknown as JpResponse;
}

export function parseJl( raw: unknown ): JlResponse {
	if ( !Array.isArray( raw ) ) throw new ApiError( "/jl response must be an array", "/jl", raw );
	const specialCodes = new Set( [ "s1", "s2", "rs", "rd", "fl", "wl", "cu" ] );
	const normalized: unknown[][] = [];
	for ( const value of raw ) {
		if ( !Array.isArray( value ) || value.length < 4 || value.length > 5 ) throw new ApiError( "malformed log row", "/jl", value );
		const row = value.slice();
		if ( typeof row[ 1 ] === "number" ) {
			if ( row.length !== 4 && row.length !== 5 ) throw new ApiError( "malformed station log row", "/jl", row );
			requireIntegerInRange( row[ 0 ], 0, 255, "/jl", "log program" );
			requireIntegerInRange( row[ 1 ], 0, 255, "/jl", "log station" );
			const duration = requireIntegerInRange( row[ 2 ], -65535, 65535, "/jl", "log duration" );
			// Firmware before July 2024 serialized the uint16 duration through a signed format.
			// `/jl` streams retained log files verbatim after upgrades, so normalize those rows here.
			if ( duration < 0 ) row[ 2 ] = duration + 65536;
			if ( row[ 4 ] !== undefined && ( typeof row[ 4 ] !== "number" || !Number.isFinite( row[ 4 ] ) || row[ 4 ] < 0 ) ) {
				throw new ApiError( "malformed flow log field", "/jl", row );
			}
		} else {
			if ( row.length !== 4 || typeof row[ 1 ] !== "string" || !specialCodes.has( row[ 1 ] ) ) {
				throw new ApiError( "malformed log discriminator", "/jl", row );
			}
			requireIntegerInRange( row[ 0 ], 0, MAX_UNIX_SECONDS, "/jl", "log value" );
			requireIntegerInRange( row[ 2 ], 0, MAX_UNIX_SECONDS, "/jl", "log duration" );
		}
		requireUnixTimestamp( row[ 3 ], "/jl", "log timestamp" );
		normalized.push( row );
	}
	return normalized as JlResponse;
}

export function parseJs( raw: unknown ): JsResponse {
	if ( typeof raw !== "object" || raw === null ) throw new ApiError( "not an object", "/js", raw );
	const o = raw as Record<string, unknown>;
	const statuses = requireNumberArray( o, "sn", "/js" );
	const stationCount = requireIntegerInRange( o.nstations, 8, MAX_CONFIGURED_STATION_COUNT, "/js", "station count" );
	if ( statuses.length !== stationCount || statuses.some( ( value ) => !Number.isSafeInteger( value ) || ( value !== 0 && value !== 1 ) ) ) {
		throw new ApiError( "station status count or value is malformed", "/js", statuses );
	}
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

	private async get<T>( path: string, parse: ( raw: unknown ) => T, signal?: AbortSignal ): Promise<T> {
		const raw = await this.seam.requestJson( path, signal );
		return parse( raw );
	}

	getControllerStatus( signal?: AbortSignal ): Promise<JcResponse> { return this.get( "jc", parseJc, signal ); }
	getOptions( signal?: AbortSignal ): Promise<JoResponse> { return this.get( "jo", parseJo, signal ); }
	getStations( signal?: AbortSignal ): Promise<JnResponse> { return this.get( "jn", parseJn, signal ); }
	getPrograms( signal?: AbortSignal ): Promise<JpResponse> { return this.get( "jp", parseJp, signal ); }
	/**
	 * Fetch the log history. The firmware /jl REQUIRES a start/end epoch range — without it it returns
	 * `{result:16}` (data missing), NOT an array (verified on real hardware). `end` must be an explicit
	 * controller-wall timestamp (normally `/jc.devt`); browser `Date.now()` is a true UTC timestamp and
	 * can select the wrong controller calendar file. Firmware includes both endpoint days, so the default
	 * seven-day range subtracts six days and padding `end` would incorrectly fetch the following day.
	 */
	getLogs( opts: { end: number; start?: number; type?: string; days?: number; signal?: AbortSignal } ): Promise<JlResponse> {
		if ( !opts || opts.end === undefined ) throw new RangeError( "A controller-wall log end timestamp is required." );
		const days = opts.days ?? 7;
		if ( !Number.isSafeInteger( days ) || days < 1 || days > 365 ) throw new RangeError( "Log days must be a whole number from 1 to 365." );
		const end = opts.end;
		const start = opts.start ?? Math.max( 0, end - ( days - 1 ) * 86400 );
		if ( !Number.isSafeInteger( start ) || !Number.isSafeInteger( end ) || start < 0 || start > end || end > MAX_UNIX_SECONDS ) {
			throw new RangeError( "Log range must contain ordered whole timestamps within the firmware epoch." );
		}
		if ( opts.type !== undefined && !/^[A-Za-z0-9]{1,3}$/.test( opts.type ) ) throw new RangeError( "Invalid log type." );
		const type = opts.type ? `&type=${ encodeURIComponent( opts.type ) }` : "";
		return this.get( `jl?start=${ start }&end=${ end }${ type }`, parseJl, opts.signal );
	}
	getStatus( signal?: AbortSignal ): Promise<JsResponse> { return this.get( "js", parseJs, signal ); }

	/** Pre-auth firmware-version probe (works before login). */
	async probeFirmwareVersion( signal?: AbortSignal ): Promise<number> {
		return ( await this.probeBootstrap( signal ) ).fwv;
	}

	/** Pre-auth `/jo` bootstrap fields. `ipas` is present only when the full response is readable. */
	async probeBootstrap( signal?: AbortSignal ): Promise<{ fwv: number; ipas?: number }> {
		const raw = await this.seam.requestJson( "jo", signal );
		const o = ( raw && typeof raw === "object" ) ? raw as Record<string, unknown> : {};
		if ( typeof o.fwv !== "number" || !Number.isSafeInteger( o.fwv ) || o.fwv < 1 ) throw new ApiError( "no valid fwv in /jo", "/jo", raw );
		return { fwv: o.fwv, ...( typeof o.ipas === "number" ? { ipas: o.ipas } : {} ) };
	}

	/**
	 * Run a change command and validate the firmware result code (1 = success). Throws CommandError
	 * on any non-success code. The single choke point all typed mutations go through.
	 */
	async command( path: string, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		const raw = await this.seam.runCommand( path, signal );
		const o = ( raw && typeof raw === "object" ) ? raw as Record<string, unknown> : {};
		const result = typeof o.result === "number" ? o.result : NaN;
		if ( result !== 1 ) throw new CommandError( result, endpointName( path ) );
		return o;
	}

	// ---- control / action paths (/cm, /cr, /cv, /dp) -------------------------

	/** Manually start (en=1, with seconds) or stop (en=0) a station. /cm */
	startStation( sid: number, seconds: number, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		mutationIndex( sid, "Station" );
		const roundedSeconds = Math.round( seconds );
		if ( !Number.isFinite( seconds ) || !Number.isSafeInteger( roundedSeconds ) || roundedSeconds < 1 || seconds > 64800 ) {
			throw new RangeError( "Station duration must be between 1 and 64800 seconds." );
		}
		return this.command( `cm?sid=${ sid }&en=1&t=${ roundedSeconds }`, signal );
	}
	stopStation( sid: number, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		mutationIndex( sid, "Station" );
		return this.command( `cm?sid=${ sid }&en=0`, signal );
	}
	/** Queue choice accepted by `/cr`, `/cm`, and `/mp`: append, front, or replace. */
	/** Run-once: safe default is append (`qo=0`), never the firmware's destructive replace default. */
	runOnce( durationsBySid: number[], opts: { useWeather?: boolean; queueOption?: 0 | 1 | 2 } = {}, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		if ( !Array.isArray( durationsBySid ) || durationsBySid.length < 1 || durationsBySid.length > MAX_WIRE_STATION_COUNT ) {
			throw new RangeError( `Run-once requires between 1 and ${ MAX_WIRE_STATION_COUNT } station durations.` );
		}
		if ( durationsBySid.some( ( duration ) => !Number.isFinite( duration ) || duration < 0 || duration > 65535 ||
			!Number.isSafeInteger( Math.round( duration ) ) ) ) {
			throw new RangeError( "Run-once durations must be between 0 and 65535 seconds." );
		}
		const t = JSON.stringify( [ ...durationsBySid.map( ( n ) => Math.round( n ) ), 0 ] );
		const uwt = opts.useWeather === undefined ? 0 : ( mutationBoolean( opts.useWeather, "Run-once weather option" ) ? 1 : 0 );
		const qo = opts.queueOption ?? 0;
		if ( !Number.isSafeInteger( qo ) || qo < 0 || qo > 2 ) throw new RangeError( "Run-once queue option must be 0, 1, or 2." );
		return this.command( `cr?t=${ encodeURIComponent( t ) }&uwt=${ uwt }&qo=${ qo }`, signal );
	}
	/** Set the rain delay in hours (0 cancels). /cv?rd= */
	setRainDelayHours( hours: number, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		if ( !Number.isSafeInteger( hours ) || hours <= 0 || hours > 8760 ) {
			throw new RangeError( "Rain delay must be a positive whole number from 1 to 8760 hours." );
		}
		return this.command( `cv?rd=${ hours }`, signal );
	}
	cancelRainDelay( signal?: AbortSignal ): Promise<Record<string, unknown>> { return this.command( "cv?rd=0", signal ); }
	stopAllStations( signal?: AbortSignal ): Promise<Record<string, unknown>> { return this.command( "cv?rsn=1", signal ); }
	setControllerEnabled( enabled: boolean, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		return this.command( `cv?en=${ mutationBoolean( enabled, "Controller enabled state" ) ? 1 : 0 }`, signal );
	}
	reboot( signal?: AbortSignal ): Promise<Record<string, unknown>> { return this.command( "cv?rbt=1", signal ); }
	clearOvercurrent( signal?: AbortSignal ): Promise<Record<string, unknown>> { return this.command( "cv?rocs=1", signal ); }
	deleteProgram( pid: number, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		mutationIndex( pid, "Program" );
		return this.command( `dp?pid=${ pid }`, signal );
	}

	/**
	 * Enable/disable a program atomically. Current firmware ignores all other fields when `en` is
	 * present, so this cannot overwrite a concurrent edit made from another client.
	 */
	setProgramEnabled( pid: number, _program: OSProgram, enabled: boolean, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		mutationIndex( pid, "Program" );
		return this.command( `cp?pid=${ pid }&en=${ mutationBoolean( enabled, "Program enabled state" ) ? 1 : 0 }`, signal );
	}

	/** Queue a stored program without clearing active/queued watering. `/mp` preserves its semantics. */
	runProgramNow( pid: number, program: OSProgram, queueOption: 0 | 1 = 0, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		mutationIndex( pid, "Program" );
		if ( !Number.isSafeInteger( queueOption ) || queueOption < 0 || queueOption > 1 ) {
			throw new RangeError( "Program queue option must be 0 or 1." );
		}
		const useWeather = ( program[ 0 ] & 0x02 ) !== 0;
		return this.command( `mp?pid=${ pid }&uwt=${ useWeather ? 1 : 0 }&qo=${ queueOption }`, signal );
	}

	// ---- settings (/cp, /cs, /co) -------------------------------------------

	/** Create (pid=-1) or update a program. /cp */
	submitProgram( pid: number, program: ProgramInput, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		if ( pid !== -1 ) mutationIndex( pid, "Program" );
		return this.command( programSubmitPath( pid, encodeProgram( program ) ), signal );
	}
	/** Save station names + attributes. /cs */
	submitStations( cfg: StationConfigInput, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		return this.command( stationConfigPath( cfg ), signal );
	}
	/** Save general/weather/network options by NAMED key (fw219+; keys match /jo). /co */
	submitOptions( named: Record<string, string | number>, signal?: AbortSignal ): Promise<Record<string, unknown>> {
		return this.command( optionsPath( named ), signal );
	}
}

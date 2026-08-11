/** Typed client for the optional companion API + feature detection (FR-20/23). */
export interface CompanionHealth {
	ok: boolean; companion?: string; storage?: string; lastTs?: number | null;
	telemetryRows?: number; runLogRows?: number; pollerStale?: boolean; lastError?: string | null;
}
export interface HistoryRange { fromTs: number; toTs: number; }
export interface CompanionClientOptions {
	timeoutMs?: number;
	/** Upper bound for a complete multi-page history walk. */
	totalTimeoutMs?: number;
	token?: string;
	signal?: AbortSignal;
}
export interface TelemetryPoint {
	ts: number; waterLevel: number; rainDelay: number; weatherErr: number; weatherRestricted: number;
	lastWeatherUpdate: number; activeStations: number; rssi: number | null; currentDraw: number | null;
}
export interface RunLogPoint { program: number; station: number; durationSec: number; endTs: number; flowGpm: number | null; }
/** One derived companion event (weather-error transitions, completed weather checks, …). */
export interface CompanionLogEvent {
	ts: number;                               // unix seconds, UTC (companion clock)
	source: "weather" | "system";
	level: "normal" | "detail" | "debug";
	label: string;
	detail: string;
}

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_TOTAL_TIMEOUT_MS = 30000;
// Seven days at the minimum supported one-second poll interval is 604,800 rows (122 default pages).
const MAX_PAGES = 256;
const MAX_CURSOR_LENGTH = 512;

export class CompanionError extends Error {
	constructor( message: string, readonly endpoint: "health" | "history" | "runlog" | "log" ) {
		super( message );
		this.name = "CompanionError";
	}
}

function isLoopbackHostname( hostname: string ): boolean {
	return hostname === "localhost" || hostname === "[::1]" || /^127(?:\.[0-9]{1,3}){3}$/.test( hostname );
}

function currentDocumentUrl(): string | undefined {
	const candidate = ( globalThis as typeof globalThis & { location?: { href?: unknown } } ).location?.href;
	return typeof candidate === "string" ? candidate : undefined;
}

function validateBearerContext( token: string | undefined, documentUrl: string | undefined ): void {
	if ( !token ) return;
	if ( !/^[\x21-\x7e]{16,512}$/.test( token ) ) {
		throw new Error( "Companion bearer tokens must be 16-512 visible ASCII characters without spaces." );
	}
	if ( !documentUrl ) return;
	let page: URL;
	try { page = new URL( documentUrl ); }
	catch { throw new Error( "Invalid dashboard URL." ); }
	if ( page.protocol === "http:" && !isLoopbackHostname( page.hostname.toLowerCase() ) ) {
		throw new Error( "Bearer-authenticated dashboards must themselves use HTTPS or loopback." );
	}
}

/** Normalize a companion URL and prevent bearer credentials from crossing a plaintext network. */
export function normalizeCompanionBase( url: string, token?: string, documentUrl = currentDocumentUrl() ): string {
	validateBearerContext( token, documentUrl );
	let u: URL;
	try { u = new URL( url ); }
	catch { throw new Error( "Invalid companion URL." ); }
	if ( ( u.protocol !== "http:" && u.protocol !== "https:" ) || u.username || u.password ) {
		throw new Error( "Invalid companion URL." );
	}
	if ( token && u.protocol !== "https:" && !isLoopbackHostname( u.hostname.toLowerCase() ) ) {
		throw new Error( "Bearer-authenticated companion URLs must use HTTPS except on loopback." );
	}
	u.search = "";
	u.hash = "";
	if ( !u.pathname.endsWith( "/" ) ) u.pathname += "/";
	return u.href;
}

function base( url: string, endpoint: CompanionError["endpoint"], token?: string ): string {
	try { return normalizeCompanionBase( url, token ); }
	catch ( error ) {
		throw new CompanionError( error instanceof Error ? error.message : "Invalid companion URL.", endpoint );
	}
}

type NormalizedClientOptions = Required<Pick<CompanionClientOptions, "timeoutMs" | "totalTimeoutMs">> &
	Pick<CompanionClientOptions, "token" | "signal">;

function validTimeout( value: number, label: string ): number {
	if ( !Number.isSafeInteger( value ) || value < 1 || value > 300000 ) {
		throw new RangeError( `${ label } must be a whole number from 1 to 300000 milliseconds.` );
	}
	return value;
}

function clientOptions( value: number | CompanionClientOptions | undefined ): NormalizedClientOptions {
	const source = typeof value === "number" ? { timeoutMs: value } : value;
	return {
		timeoutMs: validTimeout( source?.timeoutMs ?? DEFAULT_TIMEOUT_MS, "Companion request timeout" ),
		totalTimeoutMs: validTimeout( source?.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS, "Companion total timeout" ),
		...( source?.token ? { token: source.token } : {} ),
		...( source?.signal ? { signal: source.signal } : {} ),
	};
}

async function getJson( url: string, endpoint: CompanionError["endpoint"], options: NormalizedClientOptions ): Promise<unknown> {
	if ( options.signal?.aborted ) throw new CompanionError( `Companion ${ endpoint } request was cancelled.`, endpoint );
	const controller = new AbortController();
	let rejectDeadline!: ( error: CompanionError ) => void;
	const deadline = new Promise<never>( ( _resolve, reject ) => { rejectDeadline = reject; } );
	const cancel = (): void => {
		rejectDeadline( new CompanionError( `Companion ${ endpoint } request was cancelled.`, endpoint ) );
		controller.abort();
	};
	options.signal?.addEventListener( "abort", cancel, { once: true } );
	const timer = globalThis.setTimeout( () => {
		rejectDeadline( new CompanionError( `Companion ${ endpoint } request timed out after ${ options.timeoutMs }ms.`, endpoint ) );
		controller.abort();
	}, options.timeoutMs );
	try {
		const request = ( async (): Promise<unknown> => {
			const headers: Record<string, string> = { Accept: "application/json" };
			if ( options.token ) headers.Authorization = `Bearer ${ options.token }`;
			const res = await fetch( url, { headers, signal: controller.signal } );
			if ( !res.ok ) throw new CompanionError( `Companion ${ endpoint } request failed (${ res.status }).`, endpoint );
			try { return await res.json() as unknown; }
			catch { throw new CompanionError( `Companion ${ endpoint } returned invalid JSON.`, endpoint ); }
		} )();
		return await Promise.race( [ request, deadline ] );
	} finally {
		globalThis.clearTimeout( timer );
		options.signal?.removeEventListener( "abort", cancel );
		controller.abort();
	}
}

async function withOverallDeadline<T>(
	endpoint: "history" | "runlog" | "log", options: NormalizedClientOptions,
	work: ( signal: AbortSignal ) => Promise<T>,
): Promise<T> {
	if ( options.signal?.aborted ) throw new CompanionError( `Companion ${ endpoint } request was cancelled.`, endpoint );
	const controller = new AbortController();
	let rejectDeadline!: ( error: CompanionError ) => void;
	const deadline = new Promise<never>( ( _resolve, reject ) => { rejectDeadline = reject; } );
	const cancel = (): void => {
		rejectDeadline( new CompanionError( `Companion ${ endpoint } request was cancelled.`, endpoint ) );
		controller.abort();
	};
	options.signal?.addEventListener( "abort", cancel, { once: true } );
	const timer = globalThis.setTimeout( () => {
		rejectDeadline( new CompanionError(
			`Companion ${ endpoint } pagination timed out after ${ options.totalTimeoutMs }ms.`, endpoint,
		) );
		controller.abort();
	}, options.totalTimeoutMs );
	try { return await Promise.race( [ work( controller.signal ), deadline ] ); }
	finally {
		globalThis.clearTimeout( timer );
		options.signal?.removeEventListener( "abort", cancel );
		controller.abort();
	}
}

function object( value: unknown, endpoint: CompanionError["endpoint"] ): Record<string, unknown> {
	if ( typeof value !== "object" || value === null || Array.isArray( value ) ) throw new CompanionError( `Companion ${ endpoint } response has an invalid shape.`, endpoint );
	return value as Record<string, unknown>;
}

function finite( value: unknown, endpoint: CompanionError["endpoint"], field: string ): number {
	if ( typeof value !== "number" || !Number.isFinite( value ) ) throw new CompanionError( `Companion ${ endpoint } has an invalid ${ field }.`, endpoint );
	return value;
}

function nullableFinite( value: unknown, endpoint: CompanionError["endpoint"], field: string ): number | null {
	return value === null ? null : finite( value, endpoint, field );
}

function parseTelemetry( value: unknown ): TelemetryPoint {
	const o = object( value, "history" );
	return {
		ts: finite( o.ts, "history", "timestamp" ),
		waterLevel: finite( o.waterLevel, "history", "water level" ),
		rainDelay: finite( o.rainDelay, "history", "rain delay" ),
		weatherErr: finite( o.weatherErr, "history", "weather error" ),
		weatherRestricted: finite( o.weatherRestricted, "history", "weather restriction" ),
		lastWeatherUpdate: finite( o.lastWeatherUpdate, "history", "weather timestamp" ),
		activeStations: finite( o.activeStations, "history", "active-station count" ),
		rssi: nullableFinite( o.rssi, "history", "RSSI" ),
		currentDraw: nullableFinite( o.currentDraw, "history", "current draw" ),
	};
}

function parseRun( value: unknown ): RunLogPoint {
	const o = object( value, "runlog" );
	return {
		program: finite( o.program, "runlog", "program" ),
		station: finite( o.station, "runlog", "station" ),
		durationSec: finite( o.durationSec, "runlog", "duration" ),
		endTs: finite( o.endTs, "runlog", "end timestamp" ),
		flowGpm: nullableFinite( o.flowGpm, "runlog", "flow" ),
	};
}

/** Returns the companion health when reachable + ok, else null (graceful degradation, FR-22). */
export async function detectCompanion( companionBase: string, options?: number | CompanionClientOptions ): Promise<CompanionHealth | null> {
	try {
		const requestOptions = clientOptions( options );
		const h = object( await getJson(
			base( companionBase, "health", requestOptions.token ) + "api/health", "health", requestOptions,
		), "health" );
		if ( h.ok !== true ) return null;
		for ( const key of [ "lastTs", "telemetryRows", "runLogRows" ] ) {
			if ( h[ key ] !== undefined && h[ key ] !== null ) finite( h[ key ], "health", key );
		}
		for ( const key of [ "pollerStale" ] ) {
			if ( h[ key ] !== undefined && typeof h[ key ] !== "boolean" ) throw new CompanionError( `Companion health has an invalid ${ key }.`, "health" );
		}
		return h as unknown as CompanionHealth;
	} catch { return null; }
}

export async function fetchHistory( companionBase: string, r: HistoryRange, options?: number | CompanionClientOptions ): Promise<TelemetryPoint[]> {
	const requestOptions = clientOptions( options );
	const root = `${ base( companionBase, "history", requestOptions.token ) }api/history?from=${ r.fromTs }&to=${ r.toTs }`;
	return withOverallDeadline( "history", requestOptions, async ( signal ) => {
		const points: TelemetryPoint[] = [];
		let cursor: string | null = null;
		let first = true;
		let pages = 0;
		const seen = new Set<string>();
		while ( first || cursor !== null ) {
			if ( ++pages > MAX_PAGES ) throw new CompanionError( "Companion history returned too many pages.", "history" );
			const raw = object( await getJson(
				root + ( first ? "" : `&cursor=${ encodeURIComponent( cursor! ) }` ), "history", { ...requestOptions, signal },
			), "history" );
			if ( !Array.isArray( raw.telemetry ) ) throw new CompanionError( "Companion history response has no telemetry array.", "history" );
			for ( const point of raw.telemetry ) points.push( parseTelemetry( point ) );
			cursor = parseNextCursor( raw.nextCursor, seen, "history" );
			first = false;
		}
		return points;
	} );
}

export async function fetchRunLog( companionBase: string, r: HistoryRange, options?: number | CompanionClientOptions ): Promise<RunLogPoint[]> {
	const requestOptions = clientOptions( options );
	const root = `${ base( companionBase, "runlog", requestOptions.token ) }api/runlog?from=${ r.fromTs }&to=${ r.toTs }`;
	return withOverallDeadline( "runlog", requestOptions, async ( signal ) => {
		const rows: RunLogPoint[] = [];
		let cursor: string | null = null;
		let first = true;
		let pages = 0;
		const seen = new Set<string>();
		while ( first || cursor !== null ) {
			if ( ++pages > MAX_PAGES ) throw new CompanionError( "Companion run-log returned too many pages.", "runlog" );
			const raw = object( await getJson(
				root + ( first ? "" : `&cursor=${ encodeURIComponent( cursor! ) }` ), "runlog", { ...requestOptions, signal },
			), "runlog" );
			if ( !Array.isArray( raw.rows ) ) throw new CompanionError( "Companion run-log response has no rows array.", "runlog" );
			for ( const row of raw.rows ) rows.push( parseRun( row ) );
			cursor = parseNextCursor( raw.nextCursor, seen, "runlog" );
			first = false;
		}
		return rows;
	} );
}

const EVENT_SOURCES = new Set( [ "weather", "system" ] );
const EVENT_LEVELS = new Set( [ "normal", "detail", "debug" ] );
const EVENT_LABEL_MAX = 40;
const EVENT_DETAIL_MAX = 500;

/** Untrusted-input rules as elsewhere: whitelist enums, cap string lengths, require finite times. */
function parseEvent( value: unknown ): CompanionLogEvent {
	const o = object( value, "log" );
	const source = o.source, level = o.level, label = o.label, detail = o.detail;
	if ( typeof source !== "string" || !EVENT_SOURCES.has( source ) ) throw new CompanionError( "Companion log event has an invalid source.", "log" );
	if ( typeof level !== "string" || !EVENT_LEVELS.has( level ) ) throw new CompanionError( "Companion log event has an invalid level.", "log" );
	if ( typeof label !== "string" || label.length < 1 || label.length > EVENT_LABEL_MAX ) throw new CompanionError( "Companion log event has an invalid label.", "log" );
	if ( typeof detail !== "string" || detail.length < 1 || detail.length > EVENT_DETAIL_MAX ) throw new CompanionError( "Companion log event has an invalid detail.", "log" );
	return {
		ts: finite( o.ts, "log", "timestamp" ),
		source: source as CompanionLogEvent["source"],
		level: level as CompanionLogEvent["level"],
		label, detail,
	};
}

/** Fetch the derived companion event log for a range (all levels; the view filters locally). */
export async function fetchCompanionLog( companionBase: string, r: HistoryRange, options?: number | CompanionClientOptions ): Promise<CompanionLogEvent[]> {
	const requestOptions = clientOptions( options );
	const root = `${ base( companionBase, "log", requestOptions.token ) }api/log?from=${ r.fromTs }&to=${ r.toTs }`;
	return withOverallDeadline( "log", requestOptions, async ( signal ) => {
		const rows: CompanionLogEvent[] = [];
		let cursor: string | null = null;
		let first = true;
		let pages = 0;
		const seen = new Set<string>();
		while ( first || cursor !== null ) {
			if ( ++pages > MAX_PAGES ) throw new CompanionError( "Companion log returned too many pages.", "log" );
			const raw = object( await getJson(
				root + ( first ? "" : `&cursor=${ encodeURIComponent( cursor! ) }` ), "log", { ...requestOptions, signal },
			), "log" );
			if ( !Array.isArray( raw.events ) ) throw new CompanionError( "Companion log response has no events array.", "log" );
			for ( const event of raw.events ) rows.push( parseEvent( event ) );
			cursor = parseNextCursor( raw.nextCursor, seen, "log" );
			first = false;
		}
		return rows;
	} );
}

function parseNextCursor( value: unknown, seen: Set<string>, endpoint: "history" | "runlog" | "log" ): string | null {
	if ( value === undefined || value === null ) return null;
	if ( typeof value !== "string" || value.length < 1 || value.length > MAX_CURSOR_LENGTH ||
		!/^[A-Za-z0-9_-]+$/.test( value ) || seen.has( value ) ) {
		throw new CompanionError( `Companion ${ endpoint } returned an invalid continuation cursor.`, endpoint );
	}
	seen.add( value );
	return value;
}

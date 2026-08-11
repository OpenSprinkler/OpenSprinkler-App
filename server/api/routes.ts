import { Hono } from "hono";
import { Buffer } from "node:buffer";
import type { EventLevel, EventSource, HistoryPageCursor, StorageProvider } from "../storage/provider";

export const DEFAULT_PAGE_SIZE = 5000;
export const MAX_PAGE_SIZE = 5000;

export interface ApiDeps {
	store: StorageProvider;
	controllerId: string | ( () => string );
	pollIntervalSec: number;
	historyMaxDays: number;
	now: () => number;            // unix seconds (injectable for tests)
	lastError: () => string | null;
}

interface ParsedQuery { fromTs: number; toTs: number; limit: number; cursorToken: string | null; }
/** "telemetry", "runlog", or a composed "events|<level>|<source>" — filters bind the cursor. */
type CursorKind = string;

const EVENT_LEVELS = new Set<string>( [ "normal", "detail", "debug" ] );
const EVENT_SOURCES = new Set<string>( [ "weather", "system" ] );

const PUBLIC_LAST_ERRORS = new Set( [
	"database unavailable", "database operation failed", "controller authentication failed",
	"controller request failed", "controller response invalid", "controller collection failed",
	"poll cycle failed", "service degraded",
] );

function publicLastError( error: string | null ): string | null {
	if ( error === null ) return null;
	return PUBLIC_LAST_ERRORS.has( error ) ? error : "service degraded";
}

function nonNegativeInteger( raw: string | null ): number | null {
	if ( raw === null || !/^(0|[1-9]\d*)$/.test( raw ) ) return null;
	const value = Number( raw );
	return Number.isSafeInteger( value ) ? value : null;
}

/** Parse + validate a bounded inclusive range and a bounded result page. */
function parseQuery( url: URL, now: number, maxDays: number ): ParsedQuery | null {
	const rawTo = url.searchParams.get( "to" );
	const to = rawTo === null ? now : nonNegativeInteger( rawTo );
	if ( to === null || !Number.isSafeInteger( to ) || to < 0 ) return null;
	const rawFrom = url.searchParams.get( "from" );
	const from = rawFrom === null ? Math.max( 0, to - 7 * 86400 ) : nonNegativeInteger( rawFrom );
	if ( from === null || from > to ) return null;

	const rawLimit = url.searchParams.get( "limit" );
	const limit = rawLimit === null ? DEFAULT_PAGE_SIZE : nonNegativeInteger( rawLimit );
	if ( url.searchParams.has( "offset" ) ) return null;
	if ( limit === null || limit < 1 || limit > MAX_PAGE_SIZE ) return null;

	const cursorToken = url.searchParams.get( "cursor" );
	// A defaulted `to` re-resolves from the clock on every request, while cursors bind the exact
	// range they were minted for — so page 2 of a default-range walk would 400 as soon as the clock
	// advanced. Fail deterministically on the first continuation instead.
	if ( cursorToken !== null && rawTo === null ) return null;
	return {
		fromTs: Math.max( from, to - maxDays * 86400 ), toTs: to, limit,
		cursorToken,
	};
}

function encodeCursor( kind: CursorKind, q: ParsedQuery, cursor: HistoryPageCursor ): string {
	return Buffer.from( JSON.stringify( [
		1, kind, q.fromTs, q.toTs, cursor.snapshotId, cursor.afterTs, cursor.afterId,
	] ) ).toString( "base64url" );
}

function decodeCursor( kind: CursorKind, q: ParsedQuery ): HistoryPageCursor | undefined | null {
	const token = q.cursorToken;
	if ( token === null ) return undefined;
	if ( token.length < 1 || token.length > 512 || !/^[A-Za-z0-9_-]+$/.test( token ) ) return null;
	try {
		const bytes = Buffer.from( token, "base64url" );
		if ( bytes.toString( "base64url" ) !== token ) return null;
		const value = JSON.parse( bytes.toString( "utf8" ) ) as unknown;
		if ( !Array.isArray( value ) || value.length !== 7 || value[ 0 ] !== 1 || value[ 1 ] !== kind ||
			value[ 2 ] !== q.fromTs || value[ 3 ] !== q.toTs ) return null;
		const numbers = value.slice( 4 );
		if ( numbers.some( ( n ) => typeof n !== "number" || !Number.isSafeInteger( n ) || n < 0 ) ) return null;
		const [ snapshotId, afterTs, afterId ] = numbers as [number, number, number];
		if ( afterTs < q.fromTs || afterTs > q.toTs || afterId < 1 || afterId > snapshotId ) return null;
		return { snapshotId, afterTs, afterId };
	} catch { return null; }
}

function controllerId( deps: ApiDeps ): string {
	return typeof deps.controllerId === "function" ? deps.controllerId() : deps.controllerId;
}

export function createApiRoutes( deps: ApiDeps ): Hono {
	const app = new Hono();
	app.onError( ( error, c ) => {
		console.error( `[api] request failed (${ error instanceof Error ? error.name : "unknown error" })` );
		return c.json( { error: "internal server error" }, 500 );
	} );

	app.get( "/health", async ( c ) => {
		try {
			const h = await deps.store.health( controllerId( deps ) );
			const stale = h.lastTs === null || ( deps.now() - h.lastTs ) > 2 * deps.pollIntervalSec;
			return c.json( {
				ok: h.ok, companion: "v1", storage: "sqlite",
				lastTs: h.lastTs, telemetryRows: h.telemetryRows, runLogRows: h.runLogRows,
					pollerStale: stale, lastError: publicLastError( deps.lastError() ),
			} );
		} catch {
			return c.json( {
				ok: false, companion: "v1", storage: "sqlite", lastTs: null,
				telemetryRows: 0, runLogRows: 0, pollerStale: true,
					lastError: publicLastError( deps.lastError() ) ?? "database unavailable",
			} );
		}
	} );

	app.get( "/history", async ( c ) => {
		const query = parseQuery( new URL( c.req.url ), deps.now(), deps.historyMaxDays );
		if ( !query ) return c.json( { error: "invalid range or page" }, 400 );
		const cursor = decodeCursor( "telemetry", query );
		if ( cursor === null ) return c.json( { error: "invalid range or page" }, 400 );
		const page = await deps.store.pageTelemetry( controllerId( deps ), {
			fromTs: query.fromTs, toTs: query.toTs, limit: query.limit, cursor: cursor ?? undefined,
		} );
		return c.json( {
			telemetry: page.rows,
			nextCursor: page.nextCursor ? encodeCursor( "telemetry", query, page.nextCursor ) : null,
		} );
	} );

	app.get( "/log", async ( c ) => {
		const url = new URL( c.req.url );
		const query = parseQuery( url, deps.now(), deps.historyMaxDays );
		if ( !query ) return c.json( { error: "invalid range or page" }, 400 );
		const level = url.searchParams.get( "level" ) ?? "debug";
		if ( !EVENT_LEVELS.has( level ) ) return c.json( { error: "invalid level" }, 400 );
		const source = url.searchParams.get( "source" );
		if ( source !== null && !EVENT_SOURCES.has( source ) ) return c.json( { error: "invalid source" }, 400 );
		const kind = `events|${ level }|${ source ?? "all" }`;
		const cursor = decodeCursor( kind, query );
		if ( cursor === null ) return c.json( { error: "invalid range or page" }, 400 );
		const page = await deps.store.pageEvents( controllerId( deps ), {
			fromTs: query.fromTs, toTs: query.toTs, limit: query.limit, cursor: cursor ?? undefined,
			maxLevel: level as EventLevel, source: ( source as EventSource | null ) ?? undefined,
		} );
		return c.json( {
			events: page.rows,
			nextCursor: page.nextCursor ? encodeCursor( kind, query, page.nextCursor ) : null,
		} );
	} );

	app.get( "/runlog", async ( c ) => {
		const query = parseQuery( new URL( c.req.url ), deps.now(), deps.historyMaxDays );
		if ( !query ) return c.json( { error: "invalid range or page" }, 400 );
		const cursor = decodeCursor( "runlog", query );
		if ( cursor === null ) return c.json( { error: "invalid range or page" }, 400 );
		const page = await deps.store.pageRunLog( controllerId( deps ), {
			fromTs: query.fromTs, toTs: query.toTs, limit: query.limit, cursor: cursor ?? undefined,
		} );
		return c.json( {
			rows: page.rows,
			nextCursor: page.nextCursor ? encodeCursor( "runlog", query, page.nextCursor ) : null,
		} );
	} );

	return app;
}

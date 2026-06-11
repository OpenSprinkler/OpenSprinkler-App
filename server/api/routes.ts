import { Hono } from "hono";
import type { StorageProvider } from "../storage/provider";

export interface ApiDeps {
	store: StorageProvider;
	controllerId: string;
	pollIntervalSec: number;
	historyMaxDays: number;
	now: () => number;            // unix seconds (injectable for tests)
	lastError: () => string | null;
}

/** Parse + validate a from/to range (FR-17): inclusive, default 7d, clamp to historyMaxDays. */
function parseRange( url: URL, now: number, maxDays: number ): { fromTs: number; toTs: number } | null {
	const rawFrom = url.searchParams.get( "from" );
	const rawTo = url.searchParams.get( "to" );
	const to = rawTo === null ? now : Number( rawTo );
	const from = rawFrom === null ? now - 7 * 86400 : Number( rawFrom );
	if ( ![ from, to ].every( ( n ) => Number.isInteger( n ) && n >= 0 ) || from > to ) return null;
	const minFrom = to - maxDays * 86400;
	return { fromTs: Math.max( from, minFrom ), toTs: to };
}

export function createApiRoutes( deps: ApiDeps ): Hono {
	const app = new Hono();

	app.get( "/health", async ( c ) => {
		const h = await deps.store.health();
		const stale = h.lastTs === null || ( deps.now() - h.lastTs ) > 2 * deps.pollIntervalSec;
		return c.json( {
			ok: h.ok, companion: "v1", storage: "sqlite",
			lastTs: h.lastTs, telemetryRows: h.telemetryRows, runLogRows: h.runLogRows,
			pollerStale: stale, lastError: deps.lastError(),
		} );
	} );

	app.get( "/history", async ( c ) => {
		const range = parseRange( new URL( c.req.url ), deps.now(), deps.historyMaxDays );
		if ( !range ) return c.json( { error: "invalid range" }, 400 );
		return c.json( { telemetry: await deps.store.queryTelemetry( deps.controllerId, range ) } );
	} );

	app.get( "/runlog", async ( c ) => {
		const range = parseRange( new URL( c.req.url ), deps.now(), deps.historyMaxDays );
		if ( !range ) return c.json( { error: "invalid range" }, 400 );
		return c.json( { rows: await deps.store.queryRunLog( deps.controllerId, range ) } );
	} );

	return app;
}

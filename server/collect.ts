import type { OsApiClient } from "../www/src/api/client";
import type { JcResponse, JoResponse } from "../www/src/api/types";
import { decodeLogRow, flowGpm } from "../www/src/api/decode";
import { countActiveStations } from "../www/src/spike/status-view";
import { osTzOffsetSeconds } from "../www/src/api/time";
import type { StorageProvider, TelemetrySample, RunLogRow } from "./storage/provider";

const RUNLOG_OVERLAP_SEC = 3600; // re-scan the last hour to catch late-arriving rows
const RUNLOG_MAX_CATCHUP_DAYS = 90;

/** Coerce to a finite number (the parsers don't validate every /jc,/jo field; NOT NULL columns must
 *  never receive undefined). */
function num( v: unknown, fallback = 0 ): number {
	return typeof v === "number" && Number.isFinite( v ) ? v : fallback;
}

export function mapTelemetry( jc: JcResponse, jo: JoResponse, now: number ): TelemetrySample {
	// Never persist the raw controller responses: options/status payloads can contain OTC, MQTT,
	// weather-provider, email, and automation credentials. This explicit allowlist retains only
	// non-secret compatibility context that is not already represented by the typed columns.
	const safeRaw = {
		schema: 1,
		controller: { devt: num( jc.devt ), nbrd: num( jc.nbrd ) },
		firmware: { fwv: num( jo.fwv ), fwm: num( jo.fwm ), tz: num( jo.tz ) },
	};
	return {
		ts: now,
		waterLevel: num( jo.wl ),
		rainDelay: num( jc.rd ),
		weatherErr: num( jc.wterr ),
		weatherRestricted: num( jc.wtrestr ),
		lastWeatherUpdate: num( jc.lswc ),
		activeStations: countActiveStations( jc.sbits ),
		rssi: typeof jc.RSSI === "number" && Number.isFinite( jc.RSSI ) ? jc.RSSI : null,
		currentDraw: typeof jc.curr === "number" && Number.isFinite( jc.curr ) ? jc.curr : null,
		raw: JSON.stringify( safeRaw ),
	};
}

export interface CollectResult { telemetry: boolean; newRunLog: number; errors: string[]; }

/** One poll cycle. Telemetry + run-log are written independently (FR-7); errors are returned, not thrown. */
export async function collectOnce(
	client: OsApiClient, store: StorageProvider, controllerId: string,
	opts: { backfillDays: number; now: number; signal?: AbortSignal },
): Promise<CollectResult> {
	const errors: string[] = [];
	let telemetry = false;
	let newRunLog = 0;
	let optionsForFlow: JoResponse | undefined;
	let statusForClock: JcResponse | undefined;
	const result = (): CollectResult => ( { telemetry, newRunLog, errors } );
	if ( opts.signal?.aborted ) return result();

	try {
		const [ jcResult, joResult ] = await Promise.allSettled( [
			client.getControllerStatus( opts.signal ), client.getOptions( opts.signal ),
		] );
		if ( joResult.status === "fulfilled" ) optionsForFlow = joResult.value;
		if ( jcResult.status === "fulfilled" ) statusForClock = jcResult.value;
		if ( jcResult.status === "rejected" || joResult.status === "rejected" ) {
			const causes = [ jcResult, joResult ]
				.filter( ( result ): result is PromiseRejectedResult => result.status === "rejected" )
				.map( ( result ) => result.reason );
			throw new Error( `controller telemetry read failed: ${ causes.map( String ).join( "; " ) }` );
		}
		if ( opts.signal?.aborted ) return result();
		await store.appendTelemetry( controllerId, mapTelemetry( jcResult.value, joResult.value, opts.now ) );
		telemetry = true;
	} catch ( e ) { errors.push( `telemetry: ${ String( e ) }` ); }
	if ( opts.signal?.aborted ) return result();

	try {
		if ( !statusForClock || !optionsForFlow ) throw new Error( "controller clock/timezone unavailable" );
		const offset = osTzOffsetSeconds( optionsForFlow.tz );
		const controllerNow = statusForClock.devt;
		const last = await store.lastRunLogEndTs( controllerId );
		if ( opts.signal?.aborted ) return result();
		const desiredStart = last !== null ? last + offset - RUNLOG_OVERLAP_SEC : controllerNow - opts.backfillDays * 86400;
		// A configured cold-start backfill may intentionally exceed 90 days. Once any run-log row
		// exists, however, a stale cursor is independently capped so one outage cannot trigger an
		// unbounded controller query.
		const earliest = controllerNow - ( last === null ? opts.backfillDays : RUNLOG_MAX_CATCHUP_DAYS ) * 86400;
		const start = Math.max( 0, desiredStart, earliest );
		const jl = await client.getLogs( { start, end: controllerNow, signal: opts.signal } );
		if ( opts.signal?.aborted ) return result();
		const rows: RunLogRow[] = jl
			.map( decodeLogRow )
			.filter( ( e ): e is Extract<ReturnType<typeof decodeLogRow>, { kind: "station" }> =>
				e.kind === "station" && e.when >= start && e.when <= controllerNow )
			.map( ( e ) => {
				const endTs = e.when - offset;
				if ( !Number.isSafeInteger( endTs ) || endTs < 0 ) throw new Error( "log timestamp cannot be normalized to UTC" );
				return {
					program: e.program, station: e.station, durationSec: e.durationSec, endTs,
					flowGpm: e.flowPulseRate === undefined ? null : flowGpm( e.flowPulseRate, optionsForFlow ),
				};
			} );
		newRunLog = await store.upsertRunLog( controllerId, rows );
	} catch ( e ) { errors.push( `runlog: ${ String( e ) }` ); }

	return result();
}

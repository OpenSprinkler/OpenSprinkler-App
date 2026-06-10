import type { OsApiClient } from "../www/src/api/client";
import type { JcResponse, JoResponse } from "../www/src/api/types";
import { decodeLogRow } from "../www/src/api/decode";
import { countActiveStations } from "../www/src/spike/status-view";
import type { StorageProvider, TelemetrySample, RunLogRow } from "./storage/provider";

const RUNLOG_OVERLAP_SEC = 3600; // re-scan the last hour to catch late-arriving rows

/** Coerce to a finite number (the parsers don't validate every /jc,/jo field; NOT NULL columns must
 *  never receive undefined). */
function num( v: unknown, fallback = 0 ): number {
	return typeof v === "number" && Number.isFinite( v ) ? v : fallback;
}

function mapTelemetry( jc: JcResponse, jo: JoResponse, now: number ): TelemetrySample {
	return {
		ts: now,
		waterLevel: num( jo.wl ),
		rainDelay: num( jc.rd ),
		weatherErr: num( jc.wterr ),
		weatherRestricted: num( jc.wtrestr ),
		lastWeatherUpdate: num( jc.lswc ),
		activeStations: countActiveStations( jc.sbits ),
		rssi: typeof jc.RSSI === "number" ? jc.RSSI : null,
		currentDraw: typeof jc.curr === "number" ? jc.curr : null,
		raw: JSON.stringify( { jc, jo } ),
	};
}

/** One poll cycle. Telemetry + run-log are written independently (FR-7); errors are returned, not thrown. */
export async function collectOnce(
	client: OsApiClient, store: StorageProvider, controllerId: string,
	opts: { backfillDays: number; now: number },
): Promise<{ telemetry: boolean; newRunLog: number; errors: string[] }> {
	const errors: string[] = [];
	let telemetry = false;
	let newRunLog = 0;

	try {
		const [ jc, jo ] = await Promise.all( [ client.getControllerStatus(), client.getOptions() ] );
		await store.appendTelemetry( controllerId, mapTelemetry( jc, jo, opts.now ) );
		telemetry = true;
	} catch ( e ) { errors.push( `telemetry: ${ String( e ) }` ); }

	try {
		const last = await store.lastRunLogEndTs( controllerId );
		const start = last !== null ? last - RUNLOG_OVERLAP_SEC : opts.now - opts.backfillDays * 86400;
		const jl = await client.getLogs( { start, end: opts.now, now: opts.now * 1000 } );
		const rows: RunLogRow[] = jl
			.map( decodeLogRow )
			.filter( ( e ): e is Extract<ReturnType<typeof decodeLogRow>, { kind: "station" }> => e.kind === "station" )
			.map( ( e ) => ( { program: e.program, station: e.station, durationSec: e.durationSec, endTs: e.when, flowGpm: e.flowGpm ?? null } ) );
		newRunLog = await store.upsertRunLog( controllerId, rows );
	} catch ( e ) { errors.push( `runlog: ${ String( e ) }` ); }

	return { telemetry, newRunLog, errors };
}

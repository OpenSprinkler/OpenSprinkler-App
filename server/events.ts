/**
 * Event derivation: turn consecutive telemetry snapshots into plain-English log events.
 *
 * Only transitions the firmware does NOT already record in /jl are emitted here — water level
 * and rain delay changes appear in the controller's own log, so re-deriving them would produce
 * duplicate rows in any merged view. What /jl never shows, and this differ does:
 *   - weather adjustment errors appearing / clearing (jc.wterr)
 *   - the California weather watering restriction engaging / lifting (jc.wtrestr)
 *   - each completed controller weather call (jc.lswc advancing), as a Detail row
 *
 * The baseline is the previous *persisted* sample, so a companion restart never re-emits
 * events: with no baseline (first sample ever, or an unreadable one) nothing is derived.
 */
import { weatherErrorText } from "../www/src/api/diagnostics";
import type { EventRow, StoredTelemetry, TelemetrySample } from "./storage/provider";

export function diffTelemetryEvents( prev: StoredTelemetry | null, cur: TelemetrySample ): EventRow[] {
	if ( !prev ) return [];
	const out: EventRow[] = [];
	const base = { ts: cur.ts, source: "weather" as const, label: "Weather" };

	if ( cur.weatherErr !== prev.weatherErr ) {
		out.push( {
			...base, level: "normal",
			detail: cur.weatherErr === 0
				? "Weather service recovered; adjustments are updating again."
				: `Weather adjustment problem: ${ weatherErrorText( cur.weatherErr ) }.`,
		} );
	}
	if ( cur.weatherRestricted !== prev.weatherRestricted ) {
		out.push( {
			...base, level: "normal",
			detail: cur.weatherRestricted
				? "Watering restricted by a weather rule."
				: "Weather watering restriction lifted.",
		} );
	}
	if ( cur.lastWeatherUpdate !== prev.lastWeatherUpdate && cur.lastWeatherUpdate > 0 ) {
		out.push( {
			...base, level: "detail",
			detail: `Controller completed a weather check; water level is ${ cur.waterLevel }%.`,
		} );
	}
	return out;
}

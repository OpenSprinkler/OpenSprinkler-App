/**
 * Logs read-only view — the firmware /jl history (station runs + sensor/rain/flow/water-level
 * events), merged with this browser's own session observations and, when a companion server is
 * present, its durable derived events (weather-error transitions, completed weather checks).
 * A toolbar filters by source and verbosity; filtering is purely client-side.
 */
import type { JlResponse, JnResponse, JoResponse } from "../api/types";
import type { CompanionLogEvent } from "../api/companion";
import { decodeLogRow, describeLogEntry, formatControllerTimestamp, LOG_KIND_LABEL, type LogEntry } from "../api/decode";
import { osTzOffsetSeconds } from "../api/time";
import { sessionLogEvents } from "../api/session-log";
import { esc, emptyState, helpTip } from "../ui/help";

const KIND_BADGE: Record<string, string> = {
	station: "on", sensor1: "spec", sensor2: "spec", rainsensor: "spec", raindelay: "", flow: "cap", waterlevel: "cap", current: "",
};

/** Source bucket per firmware log kind — every row belongs to exactly one filter bucket. */
const KIND_SOURCE: Record<string, LogSource> = {
	station: "watering", flow: "watering",
	sensor1: "sensors", sensor2: "sensors", rainsensor: "sensors",
	waterlevel: "weather", raindelay: "system", current: "system",
};

export type LogSource = "watering" | "weather" | "sensors" | "system";
export type LogSourceFilter = "all" | LogSource;
export type LogLevelFilter = "normal" | "detailed" | "debug";
export interface LogFilter { level: LogLevelFilter; source: LogSourceFilter; }
export const DEFAULT_LOG_FILTER: LogFilter = { level: "detailed", source: "all" };
export const LOG_LEVEL_FILTERS: readonly LogLevelFilter[] = [ "normal", "detailed", "debug" ];
export const LOG_SOURCE_FILTERS: readonly LogSourceFilter[] = [ "all", "watering", "weather", "sensors", "system" ];

export interface LogViewOptions {
	/** Durable events from the companion's /log endpoint (UTC epochs). */
	companionEvents?: CompanionLogEvent[];
	filter?: LogFilter;
}

/**
 * Verbosity level of a log row. Firmware /jl rows are all routine events ("Info");
 * "detail" (weather checks, adjustment calculations) and "debug" (request traces)
 * come from the session log and the companion event stream.
 */
type LogLevel = "normal" | "detail" | "debug";
const LEVEL_LABEL: Record<LogLevel, string> = { normal: "Info", detail: "Detail", debug: "Debug" };
const LEVEL_RANK: Record<LogLevel, number> = { normal: 0, detail: 1, debug: 2 };
const FILTER_CEILING: Record<LogLevelFilter, number> = { normal: 0, detailed: 1, debug: 2 };

interface LogRow { when: number; level: LogLevel; source: LogSource; html: string; }

function logRow( level: LogLevel, when: string, badge: string, label: string, detail: string, calc = false ): string {
	return `<tr class="lvl-${ level }"><td class="lvl-cell lvl-${ level }">${ LEVEL_LABEL[ level ] }</td>` +
		`<td class="muted">${ when }</td>` +
		`<td><span class="badge ${ badge }">${ esc( label ) }</span></td>` +
		`<td${ calc ? ` class="calc-detail"` : "" }>${ calc ? "↳ " : "" }${ esc( detail ) }</td></tr>`;
}

const SOURCE_CHIPS: ReadonlyArray<[ LogSourceFilter, string ]> = [
	[ "all", "All" ], [ "watering", "Watering" ], [ "weather", "Weather" ], [ "sensors", "Sensors" ], [ "system", "System" ],
];

function toolbar( filter: LogFilter ): string {
	const chips = SOURCE_CHIPS.map( ( [ value, label ] ) =>
		`<button type="button" class="chip${ filter.source === value ? " active" : "" }" data-action="log-source" ` +
		`data-source="${ value }" aria-pressed="${ filter.source === value }">${ label }</button>` ).join( "" );
	const levels: ReadonlyArray<[ LogLevelFilter, string ]> =
		[ [ "normal", "Normal" ], [ "detailed", "Detailed" ], [ "debug", "Debug" ] ];
	const options = levels.map( ( [ value, label ] ) =>
		`<option value="${ value }"${ filter.level === value ? " selected" : "" }>${ label }</option>` ).join( "" );
	return `<div class="log-toolbar" role="group" aria-label="Log filters">${ chips }` +
		`<label class="lvl-label">Verbosity <select name="logLevel">${ options }</select></label></div>`;
}

export function renderLogs( jl: JlResponse, jn: JnResponse, jo?: JoResponse, opts: LogViewOptions = {} ): string {
	const filter = opts.filter ?? DEFAULT_LOG_FILTER;
	// Firmware appends rows oldest→newest. Source occurrence order remains authoritative across a
	// fall-back clock change, when a later wall-clock timestamp can be numerically smaller.
	const entries: LogEntry[] = jl.map( decodeLogRow ).reverse();
	const firmware: LogRow[] = entries.map( ( e ) => ( {
		when: e.when, level: "normal", source: KIND_SOURCE[ e.kind ] ?? "system",
		html: logRow( "normal", formatControllerTimestamp( e.when ), KIND_BADGE[ e.kind ] ?? "", LOG_KIND_LABEL[ e.kind ],
			describeLogEntry( e, jn.snames, jo ) ),
	} ) );
	// Observed events (browser session + companion) carry true UTC epochs; jo.tz shifts them into
	// the controller's clock domain for display and placement. Without jo the offset is unknowable,
	// so those rows are omitted rather than misplaced. The merge walk keeps the firmware block's
	// source order untouched (the fold-back rule above).
	let merged = firmware;
	if ( jo ) {
		const offset = osTzOffsetSeconds( jo.tz );
		const observed: LogRow[] = [
			...sessionLogEvents().map( ( ev ): LogRow => {
				const when = Math.floor( ev.whenMs / 1000 ) + offset;
				return {
					when, level: ev.level, source: "weather",
					html: logRow( ev.level, formatControllerTimestamp( when ), "cap", ev.label, ev.detail ),
				};
			} ),
			...( opts.companionEvents ?? [] ).map( ( ev ): LogRow => {
				const when = ev.ts + offset;
				return {
					when, level: ev.level, source: ev.source,
					html: logRow( ev.level, formatControllerTimestamp( when ), ev.source === "weather" ? "cap" : "", ev.label, ev.detail ),
				};
			} ),
		].sort( ( a, b ) => b.when - a.when );
		merged = [];
		let f = 0, o = 0;
		while ( f < firmware.length || o < observed.length ) {
			if ( o >= observed.length || ( f < firmware.length && firmware[ f ]!.when >= observed[ o ]!.when ) ) {
				merged.push( firmware[ f++ ]! );
			} else merged.push( observed[ o++ ]! );
		}
	}
	const shown = merged.filter( ( r ) =>
		LEVEL_RANK[ r.level ] <= FILTER_CEILING[ filter.level ] &&
		( filter.source === "all" || r.source === filter.source ) );
	const body = shown.length
		? shown.map( ( r ) => r.html ).join( "" )
		: `<tr><td colspan="4">${ merged.length
			? `<p class="muted">No entries match the current filters.</p>`
			: emptyState( "No log entries yet", "Watering runs and sensor events will appear here." ) }</td></tr>`;
	const count = shown.length === merged.length
		? `(${ merged.length })`
		: `(${ shown.length } of ${ merged.length })`;
	return `<section aria-label="Log"><h2>Log <span class="muted">${ count }</span></h2>` +
		toolbar( filter ) +
		`<table class="grid log-leveled"><thead><tr>` +
		`<th scope="col">Level</th>` +
		`<th scope="col">When (controller) ${ helpTip( "Log timestamps use the controller's configured local clock." ) }</th>` +
		`<th scope="col">Event</th><th scope="col">Detail</th>` +
		`</tr></thead><tbody>${ body }</tbody></table></section>`;
}

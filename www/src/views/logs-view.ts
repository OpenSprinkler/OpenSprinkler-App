/**
 * Logs read-only view — renders /jl history (station runs + sensor/rain/flow/water-level events).
 */
import type { JlResponse, JnResponse, JoResponse } from "../api/types";
import { decodeLogRow, describeLogEntry, formatControllerTimestamp, LOG_KIND_LABEL, type LogEntry } from "../api/decode";
import { esc, emptyState, helpTip } from "../ui/help";

const KIND_BADGE: Record<string, string> = {
	station: "on", sensor1: "spec", sensor2: "spec", rainsensor: "spec", raindelay: "", flow: "cap", waterlevel: "cap", current: "",
};

/**
 * Verbosity level of a log row. Firmware /jl rows are all routine events ("Info");
 * "detail" (weather fetches, adjustment calculations) and "debug" (request traces)
 * arrive once richer sources feed this view — the table renders them already.
 */
type LogLevel = "normal" | "detail" | "debug";
const LEVEL_LABEL: Record<LogLevel, string> = { normal: "Info", detail: "Detail", debug: "Debug" };

function logRow( level: LogLevel, when: string, badge: string, label: string, detail: string, calc = false ): string {
	return `<tr class="lvl-${ level }"><td class="lvl-cell lvl-${ level }">${ LEVEL_LABEL[ level ] }</td>` +
		`<td class="muted">${ when }</td>` +
		`<td><span class="badge ${ badge }">${ esc( label ) }</span></td>` +
		`<td${ calc ? ` class="calc-detail"` : "" }>${ calc ? "↳ " : "" }${ esc( detail ) }</td></tr>`;
}

export function renderLogs( jl: JlResponse, jn: JnResponse, jo?: JoResponse ): string {
	// Firmware appends rows oldest→newest. Source occurrence order remains authoritative across a
	// fall-back clock change, when a later wall-clock timestamp can be numerically smaller.
	const entries: LogEntry[] = jl.map( decodeLogRow ).reverse();
	const rows = entries.map( ( e ) =>
		logRow( "normal", formatControllerTimestamp( e.when ), KIND_BADGE[ e.kind ] ?? "", LOG_KIND_LABEL[ e.kind ],
			describeLogEntry( e, jn.snames, jo ) ),
	).join( "" );
	const body = entries.length
		? rows
		: `<tr><td colspan="4">${ emptyState( "No log entries yet", "Watering runs and sensor events will appear here." ) }</td></tr>`;
	return `<section aria-label="Log"><h2>Log <span class="muted">(${ entries.length })</span></h2>` +
		`<table class="grid log-leveled"><thead><tr>` +
		`<th scope="col">Level</th>` +
		`<th scope="col">When (controller) ${ helpTip( "Log timestamps use the controller's configured local clock." ) }</th>` +
		`<th scope="col">Event</th><th scope="col">Detail</th>` +
		`</tr></thead><tbody>${ body }</tbody></table></section>`;
}

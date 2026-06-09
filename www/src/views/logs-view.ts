/**
 * Logs read-only view — renders /jl history (station runs + sensor/rain/flow/water-level events).
 */
import type { JlResponse, JnResponse } from "../api/types";
import { decodeLogRow, describeLogEntry, LOG_KIND_LABEL, type LogEntry } from "../api/decode";

function esc( s: string ): string {
	return s.replace( /[&<>"]/g, ( c ) => ( { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } )[ c ]! );
}

/** Deterministic "YYYY-MM-DD HH:MM" (UTC) — stable for tests; the real UI would localize. */
function fmtWhen( unix: number ): string {
	const iso = new Date( unix * 1000 ).toISOString();
	return iso.slice( 0, 10 ) + " " + iso.slice( 11, 16 );
}

const KIND_BADGE: Record<string, string> = {
	station: "on", sensor1: "spec", sensor2: "spec", raindelay: "", flow: "cap", waterlevel: "cap", current: "",
};

export function renderLogs( jl: JlResponse, jn: JnResponse ): string {
	const entries: LogEntry[] = jl.map( decodeLogRow ).sort( ( a, b ) => b.when - a.when ); // newest first
	const rows = entries.map( ( e ) =>
		`<tr><td class="muted">${ fmtWhen( e.when ) }</td>` +
		`<td><span class="badge ${ KIND_BADGE[ e.kind ] ?? "" }">${ LOG_KIND_LABEL[ e.kind ] }</span></td>` +
		`<td>${ esc( describeLogEntry( e, jn.snames ) ) }</td></tr>`
	).join( "" );
	const body = entries.length ? rows : '<tr><td colspan="3" class="muted">No log entries.</td></tr>';
	return `<section aria-label="Log"><h2>Log <span class="muted">(${ entries.length })</span></h2>` +
		`<table class="grid"><thead><tr>` +
		`<th scope="col">When (UTC)</th><th scope="col">Event</th><th scope="col">Detail</th>` +
		`</tr></thead><tbody>${ body }</tbody></table></section>`;
}

/**
 * Stations read-only view — renders /jn (names + attributes) + /jc (live state) via the decoders.
 */
import type { JcResponse, JnResponse } from "../api/types";
import { decodeAllStations, formatDuration, PARALLEL_GROUP_ID, type StationState } from "../api/decode";
import { esc, emptyState } from "../ui/help";
import { actionBar, actionButton } from "../ui/controls";

export interface StationsViewOptions { actions?: boolean; }

/** A small status dot prepended inside a state badge. Decorative — the badge text carries meaning. */
function badgeDot( cls: string ): string {
	return `<svg class="i-dot ${ cls }" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><circle cx="6" cy="6" r="4" fill="currentColor"/></svg>`;
}

function stateLabel( s: StationState ): string {
	if ( s.disabled ) return `<span class="badge off">${ badgeDot( "" ) }Disabled</span>`;
	if ( s.on ) return `<span class="badge on">${ badgeDot( s.running ? "live" : "" ) }On</span>` +
		( s.running ? ` <span class="muted">${ formatDuration( s.remaining ) } left</span>` : "" );
	return `<span class="badge">${ badgeDot( "" ) }Off</span>`;
}

function groupLabel( g: number ): string {
	return g === PARALLEL_GROUP_ID ? "Parallel" : `Seq ${ g }`;
}

function rowActions( s: StationState ): string {
	if ( s.disabled ) return "";
	return s.on
		? actionButton( "station-stop", "Stop", { sid: s.index }, "danger" )
		: actionButton( "station-start", "Start", { sid: s.index } );
}

export function renderStations( jc: JcResponse, jn: JnResponse, opts: StationsViewOptions = {} ): string {
	const stations = decodeAllStations( jc, jn );
	if ( stations.length === 0 ) {
		return `<section aria-label="Stations"><h2>Stations</h2>` +
			emptyState( "No stations configured", "Add stations in the controller's settings to start watering." ) +
			`</section>`;
	}
	const actionsCol = opts.actions ? '<th scope="col">Run</th>' : "";
	const rows = stations.map( ( s ) =>
		`<tr><td class="num">${ s.index + 1 }</td>` +
		`<td>${ esc( s.name ) }${ s.special ? ' <span class="badge spec">Special</span>' : "" }</td>` +
		`<td>${ stateLabel( s ) }</td>` +
		`<td class="muted">${ groupLabel( s.group ) }</td>` +
		( opts.actions ? `<td>${ rowActions( s ) }</td>` : "" ) + `</tr>`
	).join( "" );
	const activeCount = stations.filter( ( s ) => s.on ).length;
	const controls = opts.actions ? actionBar( actionButton( "stop-all", "Stop all", {}, "danger" ) ) : "";
	return `<section aria-label="Stations">` +
		`<h2>Stations <span class="muted">(${ stations.length }, ${ activeCount } on)</span></h2>` +
		`<div class="table-scroll" tabindex="0" role="region" aria-label="Stations table"><table class="grid"><thead><tr>` +
		`<th scope="col">#</th><th scope="col">Name</th><th scope="col">State</th><th scope="col">Group</th>${ actionsCol }` +
		`</tr></thead><tbody>${ rows }</tbody></table></div>${ controls }</section>`;
}

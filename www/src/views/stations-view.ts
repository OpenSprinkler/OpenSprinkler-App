/**
 * Stations read-only view — renders /jn (names + attributes) + /jc (live state) via the decoders.
 */
import type { JcResponse, JnResponse } from "../api/types";
import { decodeAllStations, formatDuration, PARALLEL_GROUP_ID, type StationState } from "../api/decode";
import { esc, emptyState } from "../ui/help";

function stateLabel( s: StationState ): string {
	if ( s.disabled ) return '<span class="badge off">Disabled</span>';
	if ( s.on ) return '<span class="badge on">On</span>' +
		( s.running ? ` <span class="muted">${ formatDuration( s.remaining ) } left</span>` : "" );
	return '<span class="badge">Off</span>';
}

function groupLabel( g: number ): string {
	return g === PARALLEL_GROUP_ID ? "Parallel" : `Seq ${ g }`;
}

export function renderStations( jc: JcResponse, jn: JnResponse ): string {
	const stations = decodeAllStations( jc, jn );
	if ( stations.length === 0 ) {
		return `<section aria-label="Stations"><h2>Stations</h2>` +
			emptyState( "No stations configured", "Add stations in the controller's settings to start watering." ) +
			`</section>`;
	}
	const rows = stations.map( ( s ) =>
		`<tr><td class="num">${ s.index + 1 }</td>` +
		`<td>${ esc( s.name ) }${ s.special ? ' <span class="badge spec">Special</span>' : "" }</td>` +
		`<td>${ stateLabel( s ) }</td>` +
		`<td class="muted">${ groupLabel( s.group ) }</td></tr>`
	).join( "" );
	const activeCount = stations.filter( ( s ) => s.on ).length;
	return `<section aria-label="Stations">` +
		`<h2>Stations <span class="muted">(${ stations.length }, ${ activeCount } on)</span></h2>` +
		`<table class="grid"><thead><tr>` +
		`<th scope="col">#</th><th scope="col">Name</th><th scope="col">State</th><th scope="col">Group</th>` +
		`</tr></thead><tbody>${ rows }</tbody></table></section>`;
}

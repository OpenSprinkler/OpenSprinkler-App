/**
 * Stations read-only view — renders /jn (names + attributes) + /jc (live state) via the decoders.
 */
import type { JcResponse, JnResponse, JeResponse, JlResponse, JoResponse, SpecialStationType } from "../api/types";
import {
	decodeAllStations, flowGpm, formatDuration, formatControllerTimestamp, lastRunsByStation,
	PARALLEL_GROUP_ID, type LastRun, type StationState,
} from "../api/decode";
import { esc, emptyState, helpTip } from "../ui/help";
import { actionBar, actionButton } from "../ui/controls";

export interface StationsViewOptions { actions?: boolean; je?: JeResponse; jl?: JlResponse; jo?: JoResponse; }

const SPECIAL_STATION_LABELS: Record<SpecialStationType, string> = {
	0: "Standard", 1: "RF", 2: "Remote IP", 3: "GPIO", 4: "HTTP", 5: "HTTPS", 6: "Remote OTC",
};

/** Derive homeowner copy from `/je.st`; never return or interpolate the opaque `/je.sd` payload. */
export function specialStationLabel( stationId: number, special: boolean, definitions?: JeResponse ): string | undefined {
	if ( !special ) return undefined;
	const type = definitions?.[ String( stationId ) ]?.st;
	return type === undefined ? "Special" : SPECIAL_STATION_LABELS[ type ];
}

/** "15m · 06/09/2024 1:30 PM · 0.65 gal/min" from the newest log run, or a muted em-dash. */
function lastRunCell( run: LastRun | undefined, jo: JoResponse | undefined ): string {
	if ( !run ) return '<span class="muted">—</span>';
	const gpm = run.flowPulseRate != null && jo ? flowGpm( run.flowPulseRate, jo ) : null;
	const flow = gpm != null ? ` · ${ gpm } gal/min` : "";
	return `${ formatDuration( run.durationSec ) } · <span class="muted">${ formatControllerTimestamp( run.when ) }</span>${ flow }`;
}

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
	return g === PARALLEL_GROUP_ID ? "Parallel" : `Seq ${ esc( String( g ) ) }`;
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
	const lastRuns = opts.jl ? lastRunsByStation( opts.jl ) : null;
	const actionsCol = opts.actions ? '<th scope="col">Run</th>' : "";
	const lastRunCol = lastRuns
		? `<th scope="col">Last run ${ helpTip( "The most recent completed run in the controller's configured local time." ) }</th>`
		: "";
	const rows = stations.map( ( s ) => {
		const special = specialStationLabel( s.index, s.special, opts.je );
		return `<tr><td class="num">${ s.index + 1 }</td>` +
			`<td>${ esc( s.name ) }${ special ? ` <span class="badge spec">${ esc( special ) }</span>` : "" }</td>` +
			`<td>${ stateLabel( s ) }</td>` +
			`<td class="muted">${ groupLabel( s.group ) }</td>` +
			( lastRuns ? `<td>${ lastRunCell( lastRuns.get( s.index ), opts.jo ) }</td>` : "" ) +
			( opts.actions ? `<td>${ rowActions( s ) }</td>` : "" ) + `</tr>`;
	} ).join( "" );
	const activeCount = stations.filter( ( s ) => s.on ).length;
	// Current sensing is hardware-dependent; the reading is controller-wide, so it lives on the
	// section, never on one zone row (never claim per-valve what the firmware measures in total).
	const draw = typeof jc.curr === "number"
		? ` <span class="muted">· drawing ${ jc.curr } mA</span> ` +
			helpTip( "Live current measured at the controller — all open valves plus the board itself, not one zone alone." )
		: "";
	const controls = opts.actions ? actionBar( actionButton( "stop-all", "Stop all", {}, "danger" ) ) : "";
	return `<section aria-label="Stations">` +
		`<h2>Stations <span class="muted">(${ stations.length }, ${ activeCount } on)</span>${ draw }</h2>` +
		`<div class="table-scroll" tabindex="0" role="region" aria-label="Stations table"><table class="grid"><thead><tr>` +
		`<th scope="col">#</th><th scope="col">Name</th><th scope="col">State</th><th scope="col">Group</th>${ lastRunCol }${ actionsCol }` +
		`</tr></thead><tbody>${ rows }</tbody></table></div>${ controls }</section>`;
}

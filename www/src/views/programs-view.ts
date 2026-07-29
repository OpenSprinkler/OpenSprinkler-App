/**
 * Programs read-only view — renders /jp (programs) decoded against /jn station names.
 */
import type { JpResponse, JnResponse } from "../api/types";
import { decodeAllPrograms, type ProgramView } from "../api/decode";
import { esc, emptyState } from "../ui/help";
import { actionBar, actionButton } from "../ui/controls";

export interface ProgramsViewOptions { actions?: boolean; }

function renderProgram( p: ProgramView, index: number, actions: boolean ): string {
	const badges = [
		p.enabled ? '<span class="badge on">Enabled</span>' : '<span class="badge off">Disabled</span>',
		p.useWeather ? '<span class="badge">Weather</span>' : "",
		`<span class="badge cap">${ p.type }</span>`,
	].filter( Boolean ).join( " " );

	// only stations that participate (duration > 0)
	const durs = p.perStationDurations.filter( ( d ) => d.seconds > 0 );
	const durList = durs.length
		? durs.map( ( d ) => `<li>${ esc( d.name ) }: <b>${ esc( d.display ) }</b></li>` ).join( "" )
		: '<li class="muted">no stations</li>';

	const meta: Array<[ string, string ]> = [
		[ "Days", esc( p.days ) + ( p.oddEven !== "none" ? "" : "" ) ],
		[ "Start", esc( p.startTimes.join( ", " ) || "—" ) ],
	];
	// Firmware stores only month/day here, so call it an annual season instead of inventing a year.
	if ( p.dateRange ) meta.push( [ "Seasonal range (every year)", `${ esc( p.dateRange.start ) } → ${ esc( p.dateRange.end ) }` ] );
	const metaRows = meta.map( ( [ k, v ] ) => `<tr><th scope="row">${ k }</th><td>${ v }</td></tr>` ).join( "" );

	const controls = actions ? actionBar( [
		actionButton( "program-edit", "Edit", { pid: index }, "primary",
			`Edit program ${ index + 1 }: ${ p.name || "(unnamed)" }` ),
		actionButton( "program-run", "Run now", { pid: index } ),
		actionButton( "program-toggle", p.enabled ? "Disable" : "Enable", { pid: index, enabled: p.enabled ? 1 : 0 } ),
		actionButton( "program-delete", "Delete", { pid: index }, "danger" ),
	].join( "" ) ) : "";

	return `<article class="program">` +
		`<header><h3>${ esc( p.name || "(unnamed)" ) }</h3><div class="badges">${ badges }</div></header>` +
		`<table class="meta"><tbody>${ metaRows }</tbody></table>` +
		`<details open><summary>Run times (${ durs.length } station${ durs.length === 1 ? "" : "s" })</summary>` +
		`<ul class="durations">${ durList }</ul></details>${ controls }</article>`;
}

export function renderPrograms( jp: JpResponse, jn: JnResponse, opts: ProgramsViewOptions = {} ): string {
	const programs = decodeAllPrograms( jp, jn.snames );
	const body = programs.length
		? programs.map( ( p, i ) => renderProgram( p, i, !!opts.actions ) ).join( "" )
		: emptyState( "No programs yet", "Create a program to schedule automatic watering." );
	const newBtn = opts.actions ? actionBar( actionButton( "program-new", "+ New program", {} ) ) : "";
	return `<section aria-label="Programs"><h2>Programs <span class="muted">(${ programs.length })</span></h2>${ newBtn }${ body }</section>`;
}

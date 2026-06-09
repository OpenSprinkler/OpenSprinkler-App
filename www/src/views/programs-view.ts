/**
 * Programs read-only view — renders /jp (programs) decoded against /jn station names.
 */
import type { JpResponse, JnResponse } from "../api/types";
import { decodeAllPrograms, type ProgramView } from "../api/decode";
import { esc, emptyState } from "../ui/help";

function renderProgram( p: ProgramView ): string {
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
	if ( p.dateRange ) meta.push( [ "Date range", `${ esc( p.dateRange.start ) } → ${ esc( p.dateRange.end ) }` ] );
	const metaRows = meta.map( ( [ k, v ] ) => `<tr><th scope="row">${ k }</th><td>${ v }</td></tr>` ).join( "" );

	return `<article class="program">` +
		`<header><h3>${ esc( p.name || "(unnamed)" ) }</h3><div class="badges">${ badges }</div></header>` +
		`<table class="meta"><tbody>${ metaRows }</tbody></table>` +
		`<details open><summary>Run times (${ durs.length } station${ durs.length === 1 ? "" : "s" })</summary>` +
		`<ul class="durations">${ durList }</ul></details></article>`;
}

export function renderPrograms( jp: JpResponse, jn: JnResponse ): string {
	const programs = decodeAllPrograms( jp, jn.snames );
	const body = programs.length
		? programs.map( renderProgram ).join( "" )
		: emptyState( "No programs yet", "Create a program to schedule automatic watering." );
	return `<section aria-label="Programs"><h2>Programs <span class="muted">(${ programs.length })</span></h2>${ body }</section>`;
}

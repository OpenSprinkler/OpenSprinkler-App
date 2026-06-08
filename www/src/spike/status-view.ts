/**
 * Seam spike — one read-only screen (controller status) rendered from /jc + /jo.
 * Framework-free on purpose: the spike proves the seam→client→render pipeline; the UI
 * framework choice is a later step (PRD §6). Output is an HTML string for easy testing.
 */
import type { JcResponse, JoResponse, Capabilities } from "../api/types";

function esc( s: string ): string {
	return s.replace( /[&<>"]/g, ( c ) => ( { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } )[ c ]! );
}

function fmtVersion( fwv: number ): string {
	const major = Math.floor( fwv / 100 ), minor = Math.floor( ( fwv % 100 ) / 10 ), patch = fwv % 10;
	return `${ major }.${ minor }.${ patch }`;
}

function fmtTime( unix: number ): string {
	if ( !unix ) return "—";
	const h = Math.floor( ( unix % 86400 ) / 3600 ), m = Math.floor( ( unix % 3600 ) / 60 );
	return `${ String( h ).padStart( 2, "0" ) }:${ String( m ).padStart( 2, "0" ) }`;
}

/** Count active stations from /jc.sbits (one byte per board, 8 stations/byte). */
export function countActiveStations( sbits: number[] ): number {
	let n = 0;
	for ( const b of sbits ) for ( let i = 0; i < 8; i++ ) if ( b & ( 1 << i ) ) n++;
	return n;
}

/** Render the controller-status screen as an HTML string. */
export function renderControllerStatus( jc: JcResponse, jo: JoResponse, caps: Capabilities ): string {
	const active = countActiveStations( jc.sbits );
	const rows: Array<[ string, string ]> = [
		[ "Device", esc( jc.dname || "OpenSprinkler" ) ],
		[ "Firmware", fmtVersion( jo.fwv ) + ( jo.fwm ? `.${ jo.fwm }` : "" ) ],
		[ "Controller", jc.en ? "Enabled" : "Disabled" ],
		[ "Active stations", `${ active }` ],
		[ "Water level", `${ jo.wl }%` ],
		[ "Rain delay", jc.rd ? `Active until ${ fmtTime( jc.rdst ) }` : "Off" ],
		[ "Weather restriction", caps.weatherRestricted && jc.wtrestr ? "Restricted" : "None" ],
		[ "Sunrise / Sunset", `${ fmtTime( jc.sunrise * 60 ) } / ${ fmtTime( jc.sunset * 60 ) }` ],
		[ "Cloud (OTC)", caps.otfCloud ? `status ${ jc.otcs ?? "?" }` : "n/a" ],
	];
	const body = rows.map( ( [ k, v ] ) => `<tr><th scope="row">${ esc( k ) }</th><td>${ esc( v ) }</td></tr>` ).join( "" );
	return `<section aria-label="Controller status"><h1>${ esc( jc.dname || "OpenSprinkler" ) }</h1>` +
		`<table class="status"><tbody>${ body }</tbody></table></section>`;
}

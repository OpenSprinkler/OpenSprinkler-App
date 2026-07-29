/**
 * Seam spike — one read-only screen (controller status) rendered from /jc + /jo.
 * Framework-free on purpose: the spike proves the seam→client→render pipeline; the UI
 * framework choice is a later step (PRD §6). Output is an HTML string for easy testing.
 *
 * Novice-UX layer (GitHub #4): the fork build tag rides the Firmware row (#3), the
 * "Weather restriction" label carries an inline tooltip (upstream #290), and all device times
 * use the single tz-correct base in api/time.ts (upstream #287).
 */
import type { JcResponse, JoResponse, Capabilities } from "../api/types";
import { getForkTag } from "../api/client";
import { formatMinutesOfDay, formatControllerDateTime } from "../api/time";
import { esc, helpTip } from "../ui/help";
import { actionBar, actionButton } from "../ui/controls";

function fmtVersion( fwv: number ): string {
	const major = Math.floor( fwv / 100 ), minor = Math.floor( ( fwv % 100 ) / 10 ), patch = fwv % 10;
	return `${ major }.${ minor }.${ patch }`;
}

/** Count active stations from /jc.sbits (one byte per board, 8 stations/byte). */
export function countActiveStations( sbits: number[] ): number {
	let n = 0;
	for ( const b of sbits ) for ( let i = 0; i < 8; i++ ) if ( b & ( 1 << i ) ) n++;
	return n;
}

export interface ViewOptions { actions?: boolean; }

/** A filled dot for an OK/on state. Decorative — the adjacent text label carries the meaning (WCAG 1.4.1). */
function dotOk(): string {
	return `<svg class="i-dot ok" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><circle cx="6" cy="6" r="5" fill="currentColor"/></svg>`;
}
/** A ring-with-slash for a disabled/paused state (shape redundancy, not color-only). Decorative. */
function dotOff(): string {
	return `<svg class="i-dot off" viewBox="0 0 12 12" aria-hidden="true" focusable="false">` +
		`<circle cx="6" cy="6" r="4.3" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
		`<line x1="3" y1="9" x2="9" y2="3" stroke="currentColor" stroke-width="1.6"/></svg>`;
}
/** A radial water-level gauge (server-computed offset, no JS). Decorative: the % text beside it is authoritative. */
function waterGauge( wl: number ): string {
	const pct = Math.max( 0, Math.min( 100, Number( wl ) || 0 ) ), C = 97.39, off = ( C * ( 1 - pct / 100 ) ).toFixed( 2 );
	return `<svg class="i-gauge" viewBox="0 0 36 36" aria-hidden="true" focusable="false">` +
		`<circle class="i-gauge-track" cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3"/>` +
		`<circle class="i-gauge-fill" cx="18" cy="18" r="15.5" fill="none" stroke-linecap="round" stroke-width="3" ` +
		`stroke-dasharray="${ C }" stroke-dashoffset="${ off }" transform="rotate(-90 18 18)"/></svg>`;
}

/** Render the controller-status screen as an HTML string. With `opts.actions`, append a control bar. */
export function renderControllerStatus( jc: JcResponse, jo: JoResponse, caps: Capabilities, opts: ViewOptions = {} ): string {
	const active = countActiveStations( jc.sbits );
	const firmware = fmtVersion( jo.fwv ) + ( jo.fwm ? ` (${ jo.fwm })` : "" ) + getForkTag( jo );
	const rows: Array<[ label: string, value: string, help?: string ]> = [
		[ "Device", esc( jc.dname || "OpenSprinkler" ) ],
		[ "Firmware", esc( firmware ), jo.fwf ? "Includes a fork build tag (+) from a custom firmware build." : undefined ],
		[ "Controller", `${ jc.en ? dotOk() : dotOff() }<span>${ jc.en ? "Enabled" : "Disabled" }</span>` ],
		[ "Active stations", `${ active }` ],
		[ "Water level", `<span class="gauge-cell">${ waterGauge( jo.wl ) }<span class="gauge-pct">${ esc( String( jo.wl ) ) }%</span></span>`,
			"Scales every program's run time (100% = as programmed)." ],
		[ "Rain delay", `${ jc.rd ? dotOff() : dotOk() }<span>${ jc.rd ? `Active until ${ esc( formatControllerDateTime( jc.rdst ) ) }` : "Off" }</span>`,
			"A timed pause on all watering." ],
		[ "Weather restriction", caps.weatherRestricted && jc.wtrestr ? "Restricted" : "None",
			"Watering is paused by a weather rule (e.g. a rain restriction)." ],
		[ "Sunrise / Sunset", `${ esc( formatMinutesOfDay( jc.sunrise ) ) } / ${ esc( formatMinutesOfDay( jc.sunset ) ) }` ],
		[ "Cloud (OTC)", caps.otfCloud ? `status ${ esc( String( jc.otcs ?? "?" ) ) }` : "n/a",
			"OpenThings Cloud — OpenSprinkler's remote-access relay." ],
	];
	const body = rows.map( ( [ k, v, help ] ) =>
		`<tr><th scope="row">${ esc( k ) }${ help ? " " + helpTip( help ) : "" }</th><td>${ v }</td></tr>` ).join( "" );

	let controls = "";
	if ( opts.actions ) {
		const buttons = [
			actionButton( "toggle-enable", jc.en ? "Disable" : "Enable", { enabled: jc.en ? 1 : 0 } ),
			actionButton( "stop-all", "Stop all", {}, "danger" ),
			actionButton( jc.rd ? "cancel-rain" : "rain-delay", jc.rd ? "Cancel rain delay" : "Rain delay…" ),
			actionButton( "reboot", "Reboot", {}, "danger" ),
		].join( "" );
		controls = actionBar( buttons );
	}

	return `<section aria-label="Controller status"><h1>${ esc( jc.dname || "OpenSprinkler" ) }</h1>` +
		`<table class="status"><tbody>${ body }</tbody></table>${ controls }</section>`;
}

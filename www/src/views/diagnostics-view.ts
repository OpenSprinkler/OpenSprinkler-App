/**
 * System Diagnostics view — makes controller health interpretable for non-experts
 * (upstream #288) and fixes the "Last Request" timezone bug (upstream #287).
 *
 * Ports www/js/modules/system-diagnostics.js, adding: (a) a one-line health summary, (b) relative
 * times ("2 min ago") beside absolute ones, (c) grouped sections (Connectivity / Weather /
 * Scheduling) with short helper text. All device times are formatted in ONE consistent base — the
 * device's local wall clock — via api/time.ts (see #287).
 */
import type { JcResponse, JoResponse } from "../api/types";
import { formatControllerDateTime, formatDeviceTime, relativeTime, elapsedSeconds } from "../api/time";
import {
	weatherStatus, weatherErrorText, wifiRating, rebootReason, otcStatus, adjustmentMethodName,
	type StatusText,
} from "../api/diagnostics";
import { esc, helpTip, infoNote } from "../ui/help";

/** Dotted-quad from /jc.eip (uint32, big-endian) or pass through an IPv6 string. */
function formatIp( eip: number | string ): string {
	if ( typeof eip === "string" ) return eip;
	return `${ ( eip >>> 24 ) & 255 }.${ ( eip >>> 16 ) & 255 }.${ ( eip >>> 8 ) & 255 }.${ eip & 255 }`;
}

function statusSpan( s: StatusText ): string {
	return `<span class="status status-${ s.level }">${ esc( s.text ) }</span>`;
}

/** A controller-clock epoch rendered as absolute device-local time + a relative hint; "—" when unset. */
function whenCell( controllerEpoch: number, jc: JcResponse ): string {
	if ( !controllerEpoch || controllerEpoch <= 0 ) return "—";
	const rel = controllerEpoch > jc.devt
		? "Controller clock needs review"
		: relativeTime( elapsedSeconds( controllerEpoch, jc.devt ) );
	return `${ esc( formatControllerDateTime( controllerEpoch ) ) } <span class="muted">(${ esc( rel ) })</span>`;
}

function row( label: string, valueHtml: string, help?: string ): string {
	return `<tr><th scope="row">${ esc( label ) }${ help ? " " + helpTip( help ) : "" }</th>` +
		`<td>${ valueHtml }</td></tr>`;
}

function group( title: string, note: string, rows: string ): string {
	return `<h3>${ esc( title ) }</h3>${ infoNote( note ) }` +
		`<table class="status"><tbody>${ rows }</tbody></table>`;
}

/** One-line "is my system OK?" summary from whatever fields are available. */
function healthSummary( jc: JcResponse ): string {
	const parts: string[] = [];
	if ( typeof jc.wterr === "number" ) parts.push( `Weather: ${ weatherStatus( jc.wterr ).text }` );
	if ( typeof jc.lswc === "number" ) {
		parts.push( jc.lswc > 0
			? ( jc.lswc > jc.devt
				? "Last update: Controller clock needs review"
				: `Last update ${ relativeTime( elapsedSeconds( jc.lswc, jc.devt ) ) }` )
			: "Never updated" );
	}
	if ( typeof jc.RSSI === "number" ) parts.push( `Wi-Fi ${ wifiRating( jc.RSSI ).text }` );
	if ( !jc.en ) parts.unshift( "Controller DISABLED" );
	return parts.length ? esc( parts.join( " · " ) ) : "No status fields reported.";
}

export function renderDiagnostics( jc: JcResponse, jo: JoResponse ): string {
	// --- Connectivity ---
	const connRows = [
		row( "External IP", esc( formatIp( jc.eip ) ), "The address your controller appears as on the internet." ),
		row( "MAC address", esc( jc.mac || "—" ) ),
		typeof jc.RSSI === "number" ? row( "Wi-Fi strength", statusSpan( wifiRating( jc.RSSI ) ),
			"Signal at the controller. Closer to 0 dBm is stronger; below -80 dBm is unreliable." ) : "",
		typeof jc.otcs === "number" ? row( "OpenThings Cloud", statusSpan( otcStatus( jc.otcs ) ),
			"Remote access via OpenSprinkler's cloud relay (OTC)." ) : "",
		row( "Last reboot", whenCell( jc.lupt, jc ), "When the controller last powered up." ),
		typeof jc.lrbtc === "number" ? row( "Reboot reason", esc( rebootReason( jc.lrbtc ) ) ) : "",
	].join( "" );

	// --- Weather service ---
	const weatherRows = [
		typeof jc.wterr === "number" ? row( "Service status", statusSpan( weatherStatus( jc.wterr ) ),
			"Whether the controller can reach its weather service." ) : "",
		row( "Last request", whenCell( jc.lwc, jc ),
			"When the controller last asked the weather service for data." ),
		row( "Last successful update", whenCell( jc.lswc, jc ),
			"When usable weather data was last received." ),
		typeof jc.wterr === "number" ? row( "Last response", esc( weatherErrorText( jc.wterr ) ) ) : "",
		typeof jo.uwt === "number" ? row( "Adjustment method", esc( adjustmentMethodName( jo.uwt ) ),
			"How weather changes the watering amount." ) : "",
		typeof jo.wl === "number" ? row( "Watering level", `${ esc( String( jo.wl ) ) }%` ) : "",
		typeof jc.wtrestr === "number" ? row( "Weather restriction",
			jc.wtrestr > 0 ? statusSpan( { text: "Active", level: "warn" } ) : statusSpan( { text: "Inactive", level: "ok" } ),
			"Watering is paused by a weather rule (e.g. a rain restriction)." ) : "",
	].join( "" );

	// --- Scheduling ---
	const schedRows = [
		row( "Controller", jc.en
			? statusSpan( { text: "Enabled", level: "ok" } )
			: statusSpan( { text: "Disabled", level: "error" } ) ),
		typeof jc.nq === "number" ? row( "Queued runs", esc( String( jc.nq ) ),
			"Stations waiting to run or running now." ) : "",
		typeof jc.pq === "number" ? row( "Queue paused", jc.pq
			? statusSpan( { text: `Yes (${ jc.pt ?? 0 }s left)`, level: "warn" } )
			: statusSpan( { text: "No", level: "ok" } ) ) : "",
		typeof jc.devt === "number" ? row( "Controller time", esc( formatDeviceTime( jc.devt ) ),
			"The controller's own clock (already in its local timezone)." ) : "",
	].join( "" );

	return `<section aria-label="System diagnostics">` +
		`<h2>System Diagnostics</h2>` +
		`<p class="health-summary" role="status">${ healthSummary( jc ) }</p>` +
		group( "Connectivity", "How the controller reaches your network and the internet.", connRows ) +
		group( "Weather service", "Where watering adjustments come from, and whether it's healthy.", weatherRows ) +
		group( "Scheduling", "What the controller is doing right now.", schedRows ) +
		( typeof jc.curr === "number" ? infoNote( `Current draw: ${ jc.curr } mA` ) : "" ) +
		`</section>`;
}

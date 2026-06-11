/**
 * Weather view — what's adjusting the watering and where it comes from. Closes two novice-UX gaps:
 *   • Multi-Day Levels renders a friendly empty-state instead of a bare "[]" (upstream #289).
 *   • The weather-source footer is descriptive, with "PWS" spelled out (upstream #291).
 *
 * Reads /jc (wls, wtdata, wsp, wterr) + /jo (uwt, wl). Framework-free HTML string, like the other
 * views; interpretation logic lives in api/diagnostics.ts.
 */
import type { JcResponse, JoResponse } from "../api/types";
import { adjustmentMethodName, weatherProviderTag, weatherSourceName } from "../api/diagnostics";
import { esc, helpTip, emptyState, infoNote } from "../ui/help";

/** Friendly labels for the weather-data fields the firmware may report in /jc.wtdata. */
const WTDATA_LABELS: Record<string, string> = {
	t: "Mean temp", minT: "Min temp", maxT: "Max temp",
	h: "Mean humidity", minH: "Min humidity", maxH: "Max humidity",
	p: "Total rain", eto: "ETo", wind: "Mean wind", radiation: "Mean radiation",
};

function renderMultiDayLevels( wls: number[] ): string {
	const help = helpTip( "Per-day watering adjustments your weather service applied recently (100% = no change)." );
	if ( !Array.isArray( wls ) || wls.length === 0 ) {
		return `<h3>Multi-Day Levels ${ help }</h3>` +
			emptyState( "None", "Your weather service isn't sending multi-day levels." );
	}
	const items = wls.map( ( v, i ) =>
		`<li><span class="muted">Day ${ i + 1 }</span> <b>${ esc( String( v ) ) }%</b></li>` ).join( "" );
	return `<h3>Multi-Day Levels ${ help }</h3><ol class="wls">${ items }</ol>`;
}

function renderWeatherData( wtdata: Record<string, unknown> ): string {
	const keys = Object.keys( wtdata ).filter( ( k ) => k in WTDATA_LABELS && typeof wtdata[ k ] === "number" );
	if ( keys.length === 0 ) {
		return `<h3>Current Weather Data</h3>` +
			emptyState( "No weather data yet", "The controller hasn't received observations from its weather service." );
	}
	const rows = keys.map( ( k ) => {
		const unit = k === "h" || k === "minH" || k === "maxH" ? "%" : "";
		return `<tr><th scope="row">${ esc( WTDATA_LABELS[ k ]! ) }</th>` +
			`<td>${ esc( String( wtdata[ k ] ) ) }${ unit }</td></tr>`;
	} ).join( "" );
	return `<h3>Current Weather Data</h3>` +
		infoNote( "Values as reported by your weather service (units follow your controller)." ) +
		`<table class="status"><tbody>${ rows }</tbody></table>`;
}

/**
 * Descriptive weather-source footer (upstream #291). Prefers the provider tag from observations;
 * otherwise falls back to the configured weather-service host (/jc.wsp), and spells out PWS.
 */
function renderSourceFooter( jc: JcResponse, jo: JoResponse ): string {
	const provider = weatherProviderTag( jc.wtdata );
	const host = typeof jc.wsp === "string" && jc.wsp ? jc.wsp : "";
	const pwsAbbr = `<abbr title="Personal Weather Station">PWS</abbr>`;

	let source: string;
	if ( provider ) {
		source = `Weather source: ${ esc( weatherSourceName( provider ) ) }`;
	} else if ( ( jo.uwt & ~( 1 << 7 ) ) === 0 ) {
		source = "Weather source: manual adjustment (no weather service)";
	} else if ( host ) {
		source = `Weather source: service at ${ esc( host ) }`;
	} else {
		source = "Weather source: not reported";
	}

	const hostLine = host ? `<br><span class="muted">Service host: ${ esc( host ) }</span>` : "";
	const pwsLine = ( provider === "local" )
		? `<br><span class="muted">A ${ pwsAbbr } is your own weather station feeding readings to the controller.</span>`
		: "";
	return `<footer class="weather-source">${ source }${ hostLine }${ pwsLine }</footer>`;
}

export function renderWeather( jc: JcResponse, jo: JoResponse ): string {
	const summaryRows = [
		typeof jo.uwt === "number"
			? `<tr><th scope="row">Adjustment method ${ helpTip( "How weather changes the watering amount." ) }</th>` +
				`<td>${ esc( adjustmentMethodName( jo.uwt ) ) }</td></tr>` : "",
		typeof jo.wl === "number"
			? `<tr><th scope="row">Watering level ${ helpTip( "Current overall watering as a percentage of program durations." ) }</th>` +
				`<td>${ esc( String( jo.wl ) ) }%</td></tr>` : "",
	].join( "" );

	return `<section aria-label="Weather">` +
		`<h2>Weather</h2>` +
		`<table class="status"><tbody>${ summaryRows }</tbody></table>` +
		renderMultiDayLevels( jc.wls ) +
		renderWeatherData( jc.wtdata ) +
		renderSourceFooter( jc, jo ) +
		`</section>`;
}

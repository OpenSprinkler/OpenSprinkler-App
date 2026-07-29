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

interface MultiDayAdjustmentState {
	active: boolean;
	methodSupportsIt: boolean;
	status: string;
}

function multiDayAdjustmentState( jc: JcResponse, jo: JoResponse ): MultiDayAdjustmentState {
	const methodId = jo.uwt & ~( 1 << 7 );
	const methodSupportsIt = methodId === 1 || methodId === 3;
	const active = jc.wto?.mda === 100;
	return { active, methodSupportsIt, status: active ? "Enabled" : "Disabled" };
}

function multiDayFreshnessNote( jc: JcResponse ): string {
	const { devt, lwc, lswc, wterr } = jc;
	if ( ( lwc > 0 && lwc > devt ) || ( lswc > 0 && lswc > devt ) ) {
		return "Controller clock needs review, so the age of these retained weather levels cannot be verified.";
	}
	if ( lwc === 0 && lswc === 0 ) return "No weather update has completed yet; any retained levels are not current.";
	if ( lwc === 0 && lswc > 0 ) return "A weather update is pending; these levels are retained from the last successful update.";
	const stale = lswc === 0 || devt - lswc > 86400;
	if ( wterr !== 0 ) {
		return stale
			? "The last weather update failed, and these retained levels are stale."
			: "The last weather update failed; these levels are retained from the last successful update.";
	}
	return stale ? "These retained weather levels are stale because no successful update arrived in the last 24 hours." : "";
}

function renderMultiDayLevels( jc: JcResponse, state: MultiDayAdjustmentState ): string {
	const wls = jc.wls;
	const help = helpTip( "Rolling weather adjustments for interval programs; these are not separate calendar days or forecasts." );
	const usage = state.active
		? "Multi-day adjustment is enabled. An interval program with Use Weather enabled uses the N-day average for an N-day interval." +
			( state.methodSupportsIt ? "" : " The toggle remains enabled; it is normally shown while Zimmerman or ETo is selected." )
		: "Multi-day adjustment is disabled. These values are reference only; interval programs with Use Weather use the current overall " +
			"Watering Level. " + ( state.methodSupportsIt
				? "Enable multi-day adjustment under Settings > Weather to use these averages."
				: "Select Zimmerman or ETo under Settings > Weather to expose the multi-day toggle." );
	const explanation = infoNote(
		"Each value combines the most recent N weather days; it is not a forecast or a reading for one calendar date. " + usage + " " +
		"When enabled, an interval longer than this list uses the longest average available. " +
		"100% keeps programmed run times, 80% makes them 20% shorter, " +
		"150% makes them 50% longer, and 0% skips watering. An active weather restriction always skips watering.",
	);
	if ( !Array.isArray( wls ) || wls.length === 0 ) {
		return `<h3>Multi-Day Levels ${ help }</h3>` +
			explanation +
			emptyState( "None", "No multi-day averages are available from this weather service." );
	}
	const freshness = multiDayFreshnessNote( jc );
	const freshnessHtml = freshness ? infoNote( freshness ) : "";
	const items = wls.map( ( v, i ) => {
		const effect = v === 0 ? "skip watering" : v === 100 ? "programmed run time" : `${ v }% of programmed run time`;
		return `<li><span class="muted">${ i + 1 }-day rolling average</span> ` +
			`<b>${ esc( String( v ) ) }%</b> <span class="muted">— ${ esc( effect ) }</span></li>`;
	} ).join( "" );
	return `<h3>Multi-Day Levels ${ help }</h3>${ explanation }${ freshnessHtml }<ol class="wls">${ items }</ol>`;
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

/** A decorative glyph for the adjustment method: cloud = a weather service drives it, slider = manual. */
function methodGlyph( uwt: number ): string {
	const manual = ( uwt & ~( 1 << 7 ) ) === 0;
	const path = manual
		? `<path d="M4 12h16"/><circle cx="9" cy="12" r="2.5"/>`
		: `<path d="M17.5 18a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6.5 18z"/>`;
	return `<svg class="i-method" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
		`stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ path }</svg>`;
}

export function renderWeather( jc: JcResponse, jo: JoResponse ): string {
	const multiDayState = multiDayAdjustmentState( jc, jo );
	const summaryRows = [
		typeof jo.uwt === "number"
			? `<tr><th scope="row">Adjustment method ${ helpTip( "How weather changes the watering amount." ) }</th>` +
				`<td><span class="method-cell">${ methodGlyph( jo.uwt ) }${ esc( adjustmentMethodName( jo.uwt ) ) }</span></td></tr>` : "",
		typeof jo.wl === "number"
			? `<tr><th scope="row">Watering level ${ helpTip( "Current overall watering as a percentage of program durations." ) }</th>` +
				`<td>${ esc( String( jo.wl ) ) }%</td></tr>` : "",
		`<tr><th scope="row">Multi-day interval adjustment ${ helpTip( "When enabled, uses rolling averages for Use Weather interval programs. Its toggle is shown with Zimmerman or ETo." ) }</th>` +
			`<td>${ esc( multiDayState.status ) }</td></tr>`,
	].join( "" );

	return `<section aria-label="Weather">` +
		`<h2>Weather</h2>` +
		`<table class="status"><tbody>${ summaryRows }</tbody></table>` +
		renderMultiDayLevels( jc, multiDayState ) +
		renderWeatherData( jc.wtdata ) +
		renderSourceFooter( jc, jo ) +
		`</section>`;
}

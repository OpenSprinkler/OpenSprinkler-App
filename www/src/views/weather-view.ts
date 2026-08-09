/**
 * Weather view — what's adjusting the watering and where it comes from. Closes two novice-UX gaps:
 *   • Multi-Day Levels renders a friendly empty-state instead of a bare "[]" (upstream #289).
 *   • The weather-source footer is descriptive, with "PWS" spelled out (upstream #291).
 *
 * Reads /jc (wls, wtdata, wsp, wterr) + /jo (uwt, wl). Framework-free HTML string, like the other
 * views; interpretation logic lives in api/diagnostics.ts.
 */
import type { JcResponse, JoResponse } from "../api/types";
import { adjustmentMethodName, weatherErrorText, weatherProviderTag, weatherSourceName } from "../api/diagnostics";
import { elapsedSeconds, formatControllerDateTime, relativeTime } from "../api/time";
import { esc, helpTip, emptyState, infoNote } from "../ui/help";
import type { ForecastState } from "../api/weather";
import { forecastDayLabel } from "../api/weather";
import { renderForecastChart, weatherIconSvg } from "../ui/forecast-chart";

/**
 * Friendly labels for the weather-data fields the firmware may report in /jc.wtdata.
 * Wind/radiation wording matches the service's WU aggregation (peak of hourly averages;
 * summed daily radiation) — these are NOT means (see OpenSprinkler-Weather WUnderground.ts).
 */
const WTDATA_LABELS: Record<string, string> = {
	t: "Mean temp", minT: "Min temp", maxT: "Max temp",
	h: "Mean humidity", minH: "Min humidity", maxH: "Max humidity",
	p: "Total rain", eto: "ETo (latest complete day)", wind: "Peak wind", radiation: "Total solar radiation",
};

/** Display units for /jc.wtdata fields — the weather service reports imperial values. */
const WTDATA_UNITS: Record<string, string> = {
	t: " °F", minT: " °F", maxT: " °F",
	h: "%", minH: "%", maxH: "%",
	p: " in", eto: " in", wind: " mph", radiation: "",
};

interface MultiDayAdjustmentState {
	active: boolean;
	methodSupportsIt: boolean;
	status: string;
}

export type WeatherHealth = "Current" | "Last update failed" | "Stale" | "Not yet updated" | "Update pending";

export interface WeatherDecision {
	mode: string;
	effect: string;
	effectPercent: number;
	health: WeatherHealth;
	clockNeedsReview: boolean;
	lastSuccessIsStale: boolean;
	currentReason?: string;
	lastSuccessfulReason?: string;
}

/** Decode only Weather-owned presentation strings from the service's legacy flat-wire escaping. */
function decodeWeatherText( value: unknown ): string | undefined {
	if ( typeof value !== "string" ) return undefined;
	const decoded = value.replace( /\+/g, " " ).replace( /AMPERSAND/g, "&" ).trim();
	return decoded || undefined;
}

function decisionReason( jc: JcResponse, effectPercent: number ): string {
	const explicit = decodeWeatherText( jc.wtdata.skipReason ) ?? decodeWeatherText( jc.wtdata.reason );
	if ( explicit ) return explicit;
	if ( jc.wtrestr ) return "Skipped because a weather restriction is active.";
	if ( jc.wtdata.skip ) return "The weather service decided to skip watering.";
	if ( jc.wtdata.pwsBypassed ) return "Using a backup weather provider because the personal weather station was unavailable.";
	if ( effectPercent === 100 ) return "Weather-enabled schedules keep their programmed run time.";
	if ( effectPercent === 0 ) return "Weather-enabled schedules are currently skipped.";
	return `Weather-enabled schedules use ${ effectPercent }% of their programmed run time.`;
}

/** Derive mode, controller effect, and service health independently (UX-SPEC §8.1). */
export function deriveWeatherDecision( jc: JcResponse, jo: JoResponse ): WeatherDecision {
	const methodId = jo.uwt & ~( 1 << 7 );
	const modeName = adjustmentMethodName( jo.uwt );
	const mode = methodId === 3 ? "ETo (Automatic)" : methodId === 1 ? "Zimmerman (Legacy)" : modeName;
	const effectPercent = jc.wtrestr ? 0 : jo.wl;
	const effect = jc.wtrestr
		? "Restricted — 0%"
		: effectPercent === 100 ? "100% — programmed run time" : `Adjusted to ${ effectPercent }%`;
	const clockNeedsReview = ( jc.lwc > 0 && jc.lwc > jc.devt ) || ( jc.lswc > 0 && jc.lswc > jc.devt );
	const lastSuccessIsStale = jc.lswc === 0 || ( !clockNeedsReview && jc.devt - jc.lswc > 86400 );

	let health: WeatherHealth;
	if ( jc.lwc === 0 && jc.lswc === 0 ) health = "Not yet updated";
	else if ( jc.lwc === 0 && jc.lswc > 0 ) health = "Update pending";
	else if ( jc.wterr !== 0 ) health = "Last update failed";
	else if ( lastSuccessIsStale ) health = "Stale";
	else health = "Current";

	const reason = decisionReason( jc, effectPercent );
	return {
		mode, effect, effectPercent, health, clockNeedsReview, lastSuccessIsStale,
		...( health === "Current" ? { currentReason: reason } : {} ),
		...( health !== "Current" && jc.lswc > 0 ? { lastSuccessfulReason: reason } : {} ),
	};
}

function weatherWhen( epoch: number, jc: JcResponse ): string {
	if ( epoch <= 0 ) return "Never";
	const age = epoch > jc.devt ? "Controller clock needs review" : relativeTime( elapsedSeconds( epoch, jc.devt ) );
	return `${ formatControllerDateTime( epoch ) } (${ age })`;
}

function renderDecisionCard( jc: JcResponse, decision: WeatherDecision ): string {
	const healthClass = decision.health === "Current" ? "ok" : decision.health === "Update pending" ? "warn" : "error";
	const failure = decision.health === "Last update failed"
		? `<p><b>Weather update failed.</b> ${ esc( weatherErrorText( jc.wterr ) ) }. ` +
			`Current controller effect: ${ esc( String( decision.effectPercent ) ) }%.</p>`
		: "";
	const currentReason = decision.currentReason ? `<p>${ esc( decision.currentReason ) }</p>` : "";
	const historical = decision.lastSuccessfulReason
		? `<h3>${ decision.lastSuccessIsStale ? "Stale last successful decision" : "Last successful decision" }</h3>` +
			`<p>${ esc( decision.lastSuccessfulReason ) }</p>`
		: "";
	const clock = decision.clockNeedsReview
		? infoNote( "Controller clock needs review, so Weather update ages cannot be verified." )
		: "";
	return `<section class="weather-decision" aria-label="Weather decision">` +
		`<h3>Current decision</h3>` +
		`<table class="status"><tbody>` +
		`<tr><th scope="row">Mode</th><td>${ esc( decision.mode ) }</td></tr>` +
		`<tr><th scope="row">Effect</th><td>${ esc( decision.effect ) }</td></tr>` +
		`<tr><th scope="row">Service health</th><td><span class="status status-${ healthClass }">${ esc( decision.health ) }</span></td></tr>` +
		`<tr><th scope="row">Last checked</th><td>${ esc( weatherWhen( jc.lwc, jc ) ) }</td></tr>` +
		`<tr><th scope="row">Last successful update</th><td>${ esc( weatherWhen( jc.lswc, jc ) ) }</td></tr>` +
		`</tbody></table>${ failure }${ currentReason }${ historical }${ clock }</section>`;
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

function renderWeatherData( wtdata: Record<string, unknown>, current: boolean ): string {
	const title = current ? "Current Weather Data" : "Last Successful Weather Data";
	const keys = Object.keys( wtdata ).filter( ( k ) => k in WTDATA_LABELS && typeof wtdata[ k ] === "number" );
	if ( keys.length === 0 ) {
		return `<h3>${ title }</h3>` +
			emptyState( "No weather data yet", "The controller hasn't received observations from its weather service." );
	}
	const rows = keys.map( ( k ) => {
		return `<tr><th scope="row">${ esc( WTDATA_LABELS[ k ]! ) }</th>` +
			`<td>${ esc( String( wtdata[ k ] ) ) }${ esc( WTDATA_UNITS[ k ] ?? "" ) }</td></tr>`;
	} ).join( "" );
	return `<h3>${ title }</h3>` +
		infoNote( "Historical observations your weather service used for the last adjustment — not a forecast. " +
			"Values are imperial (°F, mph, inches)." ) +
		`<table class="status"><tbody>${ rows }</tbody></table>`;
}

/** Freshness line for the direct forecast fetch (client receipt time, browser clock). */
function forecastFreshness( fetchedAt: number | undefined ): string {
	if ( typeof fetchedAt !== "number" ) return "";
	const ageSeconds = Math.max( 0, Math.round( ( Date.now() - fetchedAt ) / 1000 ) );
	return `<p class="muted">Forecast fetched ${ esc( relativeTime( ageSeconds ) ) }.</p>`;
}

/** WU hybrid provenance: PWS observations + coordinate forecast are different data products. */
function forecastProvenance( jc: JcResponse, provider: string | undefined ): string {
	const wto = jc.wto ?? {};
	const pws = typeof wto.pws === "string" && wto.pws ? wto.pws : "";
	if ( ( provider === "WU" || provider === "WUnderground" ) && pws ) {
		return infoNote( `Current conditions come from your personal weather station ${ pws }; ` +
			"the daily forecast is for your coordinates (Weather Underground)." );
	}
	return "";
}

/** The verbose daily forecast (chart + day cards) from the direct /weatherData fetch. */
function renderForecastSection( jc: JcResponse, jo: JoResponse, forecast: ForecastState | undefined ): string {
	if ( forecast === undefined ) return "";
	const heading = `<h3>Forecast</h3>`;
	if ( forecast.status === "unavailable" ) {
		return heading + emptyState( "No forecast", forecast.reason ?? "The forecast is unavailable." );
	}
	const data = forecast.data;
	if ( !data ) {
		return heading + emptyState( "Forecast unavailable",
			forecast.error ?? "The weather service could not be reached." );
	}
	const staleNote = forecast.status === "error"
		? infoNote( `Showing an older forecast — the latest fetch failed. ${ forecast.error ?? "" }`.trim() )
		: "";
	const provider = data.wp ?? data.weatherProvider;

	const details = [
		typeof data.humidity === "number" ? `Humidity ${ Math.round( data.humidity ) }%` : "",
		typeof data.wind === "number" ? `Wind ${ Math.round( data.wind * 10 ) / 10 } mph` : "",
		data.raining === true ? "Raining now" : "",
		typeof data.region === "string" && data.region ? data.region : "",
	].filter( Boolean ).join( " · " );
	const now = `<div class="forecast-now">${ weatherIconSvg( data.icon ) }` +
		`<span class="now-temp">${ esc( String( Math.round( data.temp * 10 ) / 10 ) ) } °F</span>` +
		`<span class="now-detail">${ esc( data.description ) }` +
		( details ? `<br><span class="muted">${ esc( details ) }</span>` : "" ) + `</span></div>`;

	const alert = data.alert && ( data.alert.message || data.alert.name )
		? infoNote( `Weather alert: ${ [ data.alert.name, data.alert.message ].filter( Boolean ).join( " — " ) }` )
		: "";

	const days = data.forecast.map( ( day ) => ( {
		...day, label: forecastDayLabel( day.date, jc.devt, jo.tz ),
	} ) );
	const chart = renderForecastChart( days );
	const cards = days.map( ( day ) => {
		const extras = [
			typeof day.pop === "number" ? `${ Math.round( day.pop ) }% chance of rain` : "",
			typeof day.wind === "number" ? `wind ${ Math.round( day.wind ) } mph` : "",
			typeof day.humidity === "number" ? `humidity ${ Math.round( day.humidity ) }%` : "",
			typeof day.uv === "number" ? `UV ${ Math.round( day.uv ) }` : "",
		].filter( Boolean ).join( " · " );
		return `<li>${ weatherIconSvg( day.icon ) }<span class="fd-day">${ esc( day.label ) }</span>` +
			`<span class="fd-desc">${ esc( day.description ) }` +
			( extras ? `<br><span class="muted">${ esc( extras ) }</span>` : "" ) + `</span>` +
			`<span class="fd-nums">${ esc( String( Math.round( day.temp_max ) ) ) }° / ` +
			`${ esc( String( Math.round( day.temp_min ) ) ) }°F · ` +
			`${ esc( String( Math.round( day.precip * 100 ) / 100 ) ) } in</span></li>`;
	} ).join( "" );

	return heading + staleNote + alert + now + forecastProvenance( jc, provider ) + chart +
		`<ul class="forecast-days">${ cards }</ul>` + forecastFreshness( forecast.fetchedAt );
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
	const configuredPws = typeof jc.wto?.pws === "string" && jc.wto.pws ? String( jc.wto.pws ) : "";
	let pwsLine = "";
	if ( provider === "local" ) {
		pwsLine = `<br><span class="muted">A ${ pwsAbbr } is your own weather station feeding readings to the controller.</span>`;
	} else if ( ( provider === "WU" || provider === "WUnderground" ) && configuredPws ) {
		pwsLine = `<br><span class="muted">Observations come from your ${ pwsAbbr } ${ esc( configuredPws ) }.</span>`;
	}
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

export function renderWeather( jc: JcResponse, jo: JoResponse, forecast?: ForecastState ): string {
	const multiDayState = multiDayAdjustmentState( jc, jo );
	const decision = deriveWeatherDecision( jc, jo );
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
		renderDecisionCard( jc, decision ) +
		`<table class="status"><tbody>${ summaryRows }</tbody></table>` +
		renderForecastSection( jc, jo, forecast ) +
		renderMultiDayLevels( jc, multiDayState ) +
		renderWeatherData( jc.wtdata, decision.health === "Current" ) +
		renderSourceFooter( jc, jo ) +
		`</section>`;
}

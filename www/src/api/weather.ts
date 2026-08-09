/**
 * Read-only weather-service forecast client (/weatherData) for the modern views.
 *
 * The controller's own weather pipeline (/jc.wtdata, wls) carries HISTORICAL adjustment
 * inputs only — it has no forecast. The forecast shown on Weather/Status/Diagnostics
 * comes from this direct, read-only fetch against the same service host + `wto` options
 * the firmware uses (see docs/weather-forecast-audit: app-direct and firmware-direct
 * requests share provider/key/pws from /jc.wto).
 *
 * Untrusted-input rules are ported faithfully from the legacy normalizer
 * (www/js/modules/weather.js OSApp.Weather.normalizeWeatherData): whitelist rebuild,
 * range checks, length caps. The API key is interpolated into the request URL only —
 * never into any returned state that views render.
 */
import type { JcResponse } from "./types";
import { osTzOffsetSeconds } from "./time";

export const DEFAULT_WEATHER_SERVER_URL = "https://weather.opensprinkler.com";
const FETCH_TIMEOUT_MS = 10000;

/** One normalized forecast day (service field names kept verbatim). */
export interface ForecastDay {
	temp_min: number;
	temp_max: number;
	precip: number;
	date: number;
	icon: string;
	description: string;
}

/** Normalized /weatherData payload. All values are imperial (°F, mph, in) per the service. */
export interface ForecastData {
	location: [ number, number ];
	temp: number;
	precip: number;
	description: string;
	icon: string;
	forecast: ForecastDay[];
	humidity?: number;
	wind?: number;
	minTemp?: number;
	maxTemp?: number;
	timezone?: number;
	sunrise?: number;
	sunset?: number;
	/** Remaining service cache lifetime in ms — NOT data age. */
	ttl?: number;
	weatherProvider?: string;
	wp?: string;
	region?: string;
	city?: string;
	raining?: boolean;
	alert?: { type?: string; name?: string; message?: string } | null;
}

/** Forecast fetch state threaded (optionally) through the dashboard views. */
export interface ForecastState {
	status: "ok" | "error" | "unavailable";
	/** Present when ok; on error the host may retain the previous good data (stale). */
	data?: ForecastData;
	/** Browser epoch ms when `data` was received (client receipt time, not observation time). */
	fetchedAt?: number;
	error?: string;
	reason?: string;
}

function toFiniteNumber( value: unknown ): number | undefined {
	if ( ( typeof value !== "number" && typeof value !== "string" ) ||
		( typeof value === "string" && value.trim() === "" ) ) return undefined;
	const n = Number( value );
	return Number.isFinite( n ) ? n : undefined;
}

/**
 * Resolve the weather-service base URL from /jc.wsp using the firmware ≥ 2.2.1(4) rule:
 * honor an explicit scheme, otherwise default to HTTPS; the stock host uses the default URL.
 */
export function resolveWeatherServiceUrl( wsp: unknown ): string {
	const host = typeof wsp === "string" ? wsp.trim() : "";
	if ( !host || host === "weather.opensprinkler.com" ) return DEFAULT_WEATHER_SERVER_URL;
	const withScheme = /^https?:\/\//i.test( host ) ? host : `https://${ host }`;
	return withScheme.replace( /\/+$/, "" );
}

/** Legacy escapeJSON: the serialized options object without its surrounding braces. */
function bracelessJson( obj: Record<string, unknown> ): string {
	return JSON.stringify( obj ).slice( 1, -1 );
}

/**
 * Build the exact /weatherData request URL the legacy app sends: `loc` always; `wto` only when a
 * provider is configured, carrying `key` when set and `pws` only for the WU provider.
 * Returns null when the controller has no location (nothing useful to ask for).
 */
export function buildForecastUrl( jc: Pick<JcResponse, "wsp" | "loc" | "wto"> ): string | null {
	const loc = typeof jc.loc === "string" ? jc.loc.trim() : "";
	if ( !loc ) return null;
	let url = `${ resolveWeatherServiceUrl( jc.wsp ) }/weatherData?loc=${ encodeURIComponent( loc ) }`;
	const wto = jc.wto ?? {};
	const provider = typeof wto.provider === "string" ? wto.provider : "";
	if ( provider ) {
		const options: Record<string, unknown> = { provider };
		if ( typeof wto.key === "string" && wto.key ) options.key = wto.key;
		if ( provider === "WU" && typeof wto.pws === "string" && wto.pws ) options.pws = wto.pws;
		url += `&wto=${ encodeURIComponent( bracelessJson( options ) ) }`;
	}
	return url;
}

/**
 * Validate + rebuild an untrusted /weatherData payload (faithful port of the legacy
 * normalizeWeatherData whitelist). Returns null when the payload is unusable.
 */
export function normalizeForecastData( data: unknown ): ForecastData | null {
	if ( !data || typeof data !== "object" || Array.isArray( data ) ) return null;
	const raw = data as Record<string, unknown>;
	if ( !Array.isArray( raw.location ) || raw.location.length < 2 ||
		!Array.isArray( raw.forecast ) || raw.forecast.length === 0 || raw.forecast.length > 32 ) return null;

	const latitude = toFiniteNumber( raw.location[ 0 ] ), longitude = toFiniteNumber( raw.location[ 1 ] );
	const temperature = toFiniteNumber( raw.temp ), precipitation = toFiniteNumber( raw.precip );
	if ( latitude === undefined || latitude < -90 || latitude > 90 ||
		longitude === undefined || longitude < -180 || longitude > 180 ||
		temperature === undefined || temperature < -500 || temperature > 500 ||
		precipitation === undefined || precipitation < 0 || precipitation > 10000 ||
		typeof raw.description !== "string" || raw.description.length > 2048 ||
		typeof raw.icon !== "string" || raw.icon.length > 64 ) return null;

	const forecast: ForecastDay[] = [];
	for ( const entry of raw.forecast as unknown[] ) {
		if ( !entry || typeof entry !== "object" || Array.isArray( entry ) ) return null;
		const e = entry as Record<string, unknown>;
		const minimum = toFiniteNumber( e.temp_min ), maximum = toFiniteNumber( e.temp_max );
		const precip = toFiniteNumber( e.precip ), date = toFiniteNumber( e.date );
		if ( minimum === undefined || minimum < -500 || minimum > 500 ||
			maximum === undefined || maximum < minimum || maximum > 500 ||
			precip === undefined || precip < 0 || precip > 10000 ||
			date === undefined || !Number.isSafeInteger( date ) || date <= 0 || date > 0xffffffff ||
			typeof e.description !== "string" || e.description.length > 2048 ||
			typeof e.icon !== "string" || e.icon.length > 64 ) return null;
		forecast.push( {
			temp_min: minimum, temp_max: maximum, precip, date,
			icon: e.icon, description: e.description,
		} );
	}

	const normalized: ForecastData = {
		location: [ latitude, longitude ],
		temp: temperature, precip: precipitation,
		description: raw.description, icon: raw.icon, forecast,
	};
	for ( const field of [ "humidity", "wind", "minTemp", "maxTemp", "timezone", "sunrise", "sunset", "ttl" ] as const ) {
		const value = toFiniteNumber( raw[ field ] );
		if ( value !== undefined ) normalized[ field ] = value;
	}
	for ( const field of [ "weatherProvider", "wp", "region", "city" ] as const ) {
		const value = raw[ field ];
		if ( typeof value === "string" && value.length <= 2048 ) normalized[ field ] = value;
	}
	if ( typeof raw.raining === "boolean" ) normalized.raining = raw.raining;
	if ( raw.alert === null ) normalized.alert = null;
	else if ( raw.alert && typeof raw.alert === "object" && !Array.isArray( raw.alert ) ) {
		const alert: NonNullable<ForecastData[ "alert" ]> = {};
		const rawAlert = raw.alert as Record<string, unknown>;
		for ( const field of [ "type", "name", "message" ] as const ) {
			const value = rawAlert[ field ];
			if ( typeof value === "string" && value.length <= 32768 ) alert[ field ] = value;
		}
		normalized.alert = alert;
	}
	return normalized;
}

export interface FetchForecastOptions {
	signal?: AbortSignal;
	/** Injectable for tests; defaults to the global fetch. */
	fetchImpl?: typeof fetch;
	/** Injectable clock for tests; defaults to Date.now. */
	now?: () => number;
}

/** Fetch + normalize the forecast for the controller's configured location/provider. */
export async function fetchForecast( jc: JcResponse, opts: FetchForecastOptions = {} ): Promise<ForecastState> {
	const url = buildForecastUrl( jc );
	if ( !url ) return { status: "unavailable", reason: "The controller has no location configured, so no forecast can be fetched." };
	const fetchImpl = opts.fetchImpl ?? fetch;
	const now = opts.now ?? ( () => Date.now() );
	const abort = new AbortController();
	const cancel = (): void => abort.abort();
	if ( opts.signal?.aborted ) abort.abort();
	else opts.signal?.addEventListener( "abort", cancel, { once: true } );
	const timer = setTimeout( () => abort.abort(), FETCH_TIMEOUT_MS );
	try {
		const response = await fetchImpl( url, { signal: abort.signal } );
		if ( !response.ok ) return { status: "error", error: `The weather service responded with HTTP ${ response.status }.` };
		const data = normalizeForecastData( await response.json() );
		if ( !data ) return { status: "error", error: "The weather service returned an unusable forecast payload." };
		return { status: "ok", data, fetchedAt: now() };
	} catch ( error ) {
		return {
			status: "error",
			error: abort.signal.aborted && !opts.signal?.aborted
				? "The weather service did not respond within 10 seconds."
				: `The weather service could not be reached: ${ String( error ) }`,
		};
	} finally {
		clearTimeout( timer );
		opts.signal?.removeEventListener( "abort", cancel );
	}
}

/**
 * Label a forecast-day epoch in the CONTROLLER's timezone: "Today", else a short weekday.
 * Forecast dates are true UTC epochs; `devt` is already tz-shifted, so shift the forecast
 * epoch by the same offset before comparing calendar days.
 */
export function forecastDayLabel( dateEpoch: number, devt: number, tz: number ): string {
	const local = dateEpoch + osTzOffsetSeconds( tz );
	if ( Math.floor( local / 86400 ) === Math.floor( devt / 86400 ) ) return "Today";
	return [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ][ new Date( local * 1000 ).getUTCDay() ]!;
}

/** Rain is "meaningful" at or above this daily amount (inches). */
// ponytail: fixed 0.1 in threshold; make it a wto-backed setting if users ask.
export const MEANINGFUL_RAIN_INCHES = 0.1;

/** The first forecast day with meaningful rain, or null. */
export function nextRainDay( forecast: ForecastDay[] ): ForecastDay | null {
	return forecast.find( ( day ) => day.precip >= MEANINGFUL_RAIN_INCHES ) ?? null;
}

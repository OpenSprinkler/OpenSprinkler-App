/**
 * Direct /weatherData forecast client tests — exact query serialization (legacy parity),
 * untrusted-payload normalization, fetch error paths, and the day-label/next-rain helpers.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJc } from "../www/src/api/client";
import {
	buildForecastUrl, fetchForecast, forecastDayLabel, nextRainDay,
	normalizeForecastData, resolveWeatherServiceUrl, DEFAULT_WEATHER_SERVER_URL,
	type ForecastDay,
} from "../www/src/api/weather";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jc = parseJc( fx( "jc" ) );

function day( overrides: Partial<ForecastDay> = {} ): ForecastDay {
	return { temp_min: 55, temp_max: 78, precip: 0, date: 1717934400, icon: "01d", description: "Clear", ...overrides };
}

function payload( overrides: Record<string, unknown> = {} ): Record<string, unknown> {
	return {
		location: [ 37.5, -122.3 ], temp: 72, precip: 0.05, description: "Partly cloudy", icon: "02d",
		forecast: [ day(), day( { date: 1718020800, precip: 0.3, icon: "10d", description: "Rain" } ) ],
		...overrides,
	};
}

describe( "resolveWeatherServiceUrl", () => {
	it( "defaults for the stock host, blank, and non-string values", () => {
		expect( resolveWeatherServiceUrl( "weather.opensprinkler.com" ) ).toBe( DEFAULT_WEATHER_SERVER_URL );
		expect( resolveWeatherServiceUrl( "" ) ).toBe( DEFAULT_WEATHER_SERVER_URL );
		expect( resolveWeatherServiceUrl( undefined ) ).toBe( DEFAULT_WEATHER_SERVER_URL );
	} );
	it( "honors an explicit scheme and defaults custom hosts to https", () => {
		expect( resolveWeatherServiceUrl( "http://192.168.1.10:3000/" ) ).toBe( "http://192.168.1.10:3000" );
		expect( resolveWeatherServiceUrl( "my.weather.host" ) ).toBe( "https://my.weather.host" );
	} );
} );

describe( "buildForecastUrl", () => {
	it( "returns null without a location", () => {
		expect( buildForecastUrl( { ...jc, loc: "" } ) ).toBeNull();
		expect( buildForecastUrl( { ...jc, loc: "   " } ) ).toBeNull();
	} );
	it( "sends loc only when no provider is configured", () => {
		expect( buildForecastUrl( jc ) ) // fixture wto has no provider
			.toBe( `${ DEFAULT_WEATHER_SERVER_URL }/weatherData?loc=${ encodeURIComponent( "37.5,-122.3" ) }` );
	} );
	it( "serializes WU provider + key + pws as brace-less JSON (legacy escapeJSON parity)", () => {
		const url = buildForecastUrl( { ...jc, wto: { provider: "WU", key: "a".repeat( 32 ), pws: "KCASANFR123" } } );
		expect( url ).toContain( "&wto=" );
		const wto = decodeURIComponent( url!.split( "&wto=" )[ 1 ]! );
		expect( wto ).toBe( `"provider":"WU","key":"${ "a".repeat( 32 ) }","pws":"KCASANFR123"` );
	} );
	it( "omits pws for non-WU providers and omits a blank key", () => {
		const owm = buildForecastUrl( { ...jc, wto: { provider: "OWM", pws: "KCASANFR123" } } );
		expect( decodeURIComponent( owm! ) ).not.toContain( "pws" );
		expect( decodeURIComponent( owm! ) ).not.toContain( "key" );
	} );
} );

describe( "normalizeForecastData", () => {
	it( "keeps the whitelisted shape and drops unknown fields", () => {
		const data = normalizeForecastData( payload( { humidity: 40, wind: 6, surprise: "x", ttl: 120000 } ) );
		expect( data ).not.toBeNull();
		expect( data! ).not.toHaveProperty( "surprise" );
		expect( data!.humidity ).toBe( 40 );
		expect( data!.ttl ).toBe( 120000 );
		expect( data!.forecast ).toHaveLength( 2 );
	} );
	it( "rejects a payload whose forecast entry is missing a typed field (nullable-day defect upstream)", () => {
		expect( normalizeForecastData( payload( { forecast: [ { ...day(), icon: undefined } ] } ) ) ).toBeNull();
		expect( normalizeForecastData( payload( { forecast: [ { ...day(), temp_max: null } ] } ) ) ).toBeNull();
	} );
	it( "rejects out-of-range values and oversized lists", () => {
		expect( normalizeForecastData( payload( { temp: 9999 } ) ) ).toBeNull();
		expect( normalizeForecastData( payload( { forecast: [] } ) ) ).toBeNull();
		expect( normalizeForecastData( payload( { forecast: Array.from( { length: 33 }, () => day() ) } ) ) ).toBeNull();
	} );
	it( "keeps range-checked optional verbose day fields and drops out-of-range ones", () => {
		const data = normalizeForecastData( payload( { forecast: [
			day( { pop: 60, humidity: 45, wind: 12, uv: 7 } ),
			day( { date: 1718020800, pop: 400, wind: -3 } ),
		] } ) );
		expect( data!.forecast[ 0 ] ).toMatchObject( { pop: 60, humidity: 45, wind: 12, uv: 7 } );
		expect( data!.forecast[ 1 ] ).not.toHaveProperty( "pop" );
		expect( data!.forecast[ 1 ] ).not.toHaveProperty( "wind" );
	} );
	it( "keeps a valid alert and drops non-string alert members", () => {
		const data = normalizeForecastData( payload( { alert: { type: "flood", name: "Flood watch", message: "High water", junk: 4 } } ) );
		expect( data!.alert ).toEqual( { type: "flood", name: "Flood watch", message: "High water" } );
	} );
} );

describe( "fetchForecast", () => {
	const okResponse = { ok: true, status: 200, json: async () => payload() } as Response;
	it( "returns unavailable without a location (no fetch attempted)", async () => {
		const state = await fetchForecast( { ...jc, loc: "" }, { fetchImpl: () => { throw new Error( "must not fetch" ); } } );
		expect( state.status ).toBe( "unavailable" );
	} );
	it( "returns ok with normalized data and a receipt time", async () => {
		const state = await fetchForecast( jc, { fetchImpl: async () => okResponse, now: () => 12345 } );
		expect( state.status ).toBe( "ok" );
		expect( state.fetchedAt ).toBe( 12345 );
		expect( state.data!.forecast ).toHaveLength( 2 );
	} );
	it( "reports HTTP failures and unusable payloads as errors", async () => {
		const http = await fetchForecast( jc, { fetchImpl: async () => ( { ok: false, status: 502 } as Response ) } );
		expect( http ).toMatchObject( { status: "error", error: expect.stringContaining( "502" ) } );
		const bad = await fetchForecast( jc, { fetchImpl: async () => ( { ok: true, status: 200, json: async () => ( { nope: 1 } ) } as Response ) } );
		expect( bad ).toMatchObject( { status: "error", error: expect.stringContaining( "unusable" ) } );
	} );
	it( "reports a network throw as an error state, not a rejection", async () => {
		const state = await fetchForecast( jc, { fetchImpl: async () => { throw new TypeError( "offline" ); } } );
		expect( state.status ).toBe( "error" );
		expect( state.error ).toContain( "offline" );
	} );
} );

describe( "forecastDayLabel / nextRainDay", () => {
	it( "labels the controller's calendar day as Today and others by weekday", () => {
		// fixture devt 1717939200 = Sun Jun 9 2024 12:00 wall clock; tz 48 = UTC offset 0.
		expect( forecastDayLabel( 1717934400, jc.devt, 48 ) ).toBe( "Today" );
		expect( forecastDayLabel( 1718020800, jc.devt, 48 ) ).toBe( "Mon" );
	} );
	it( "applies the controller tz offset to the forecast epoch", () => {
		// GMT-8 (tz 16): UTC midnight epoch of Jun 10 lands on Jun 9 locally.
		expect( forecastDayLabel( 1718000000, jc.devt, 16 ) ).toBe( "Today" );
	} );
	it( "finds the first meaningful-rain day and ignores drizzle", () => {
		const days = [ day( { precip: 0.05 } ), day( { precip: 0.3, date: 1718020800 } ) ];
		expect( nextRainDay( days )!.date ).toBe( 1718020800 );
		expect( nextRainDay( [ day( { precip: 0.01 } ) ] ) ).toBeNull();
	} );
} );

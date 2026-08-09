/**
 * Weather view tests — friendly Multi-Day Levels empty-state (upstream #289) and the descriptive
 * weather-source / PWS footer (upstream #291).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJc, parseJo } from "../www/src/api/client";
import { deriveWeatherDecision, renderWeather } from "../www/src/views/weather-view";
import type { ForecastState } from "../www/src/api/weather";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jc = parseJc( fx( "jc" ) );
const jo = parseJo( fx( "jo" ) );

describe( "renderWeather — adjustment summary", () => {
	const html = renderWeather( jc, jo );
	it( "shows the adjustment method and watering level", () => {
		expect( html ).toContain( "Adjustment method" );
		expect( html ).toContain( "Manual" );      // uwt 0
		expect( html ).toContain( "Watering level" );
		expect( html ).toContain( "100%" );          // wl 100
		expect( html ).toContain( "Multi-day interval adjustment" );
		expect( html ).toContain( ">Disabled<" );
	} );
} );

describe( "renderWeather — independent mode, effect, and service health", () => {
	it( "keeps Manual mode and the held controller effect visible after a failed update", () => {
		const failed = { ...jc, wterr: -3, wtdata: { reason: "Last+goodAMPERSANDsafe+decision" } };
		const decision = deriveWeatherDecision( failed, { ...jo, uwt: 0, wl: 65 } );
		expect( decision ).toMatchObject( {
			mode: "Manual", effect: "Adjusted to 65%", effectPercent: 65, health: "Last update failed",
			lastSuccessfulReason: "Last good&safe decision",
		} );
		expect( decision.currentReason ).toBeUndefined();

		const html = renderWeather( failed, { ...jo, uwt: 0, wl: 65 } );
		expect( html ).toContain( "Weather update failed" );
		expect( html ).toContain( "Current controller effect: 65%" );
		expect( html ).toContain( "Last successful decision" );
		expect( html ).toContain( "Last Successful Weather Data" );
		expect( html ).not.toContain( "<h3>Current Weather Data</h3>" );
	} );

	it( "derives startup, pending, failed, stale, and current health in the required order", () => {
		expect( deriveWeatherDecision( { ...jc, lwc: 0, lswc: 0, wterr: -1 }, jo ).health ).toBe( "Not yet updated" );
		expect( deriveWeatherDecision( { ...jc, lwc: 0, lswc: jc.lswc, wterr: -1 }, jo ).health ).toBe( "Update pending" );
		expect( deriveWeatherDecision( { ...jc, wterr: 12 }, jo ).health ).toBe( "Last update failed" );
		expect( deriveWeatherDecision( { ...jc, lswc: jc.devt - 86401, wterr: 0 }, jo ).health ).toBe( "Stale" );
		expect( deriveWeatherDecision( jc, jo ).health ).toBe( "Current" );
	} );

	it( "makes restriction authoritative and labels an unverifiable controller clock", () => {
		const restricted = deriveWeatherDecision( { ...jc, wtrestr: 1 }, { ...jo, uwt: 3, wl: 72 } );
		expect( restricted.mode ).toBe( "ETo (Automatic)" );
		expect( restricted.effect ).toBe( "Restricted — 0%" );
		expect( restricted.currentReason ).toContain( "restriction" );

		const clock = deriveWeatherDecision( { ...jc, lswc: jc.devt + 1 }, jo );
		expect( clock.clockNeedsReview ).toBe( true );
		expect( renderWeather( { ...jc, lswc: jc.devt + 1 }, jo ) ).toContain( "Controller clock needs review" );
	} );

	it( "uses generic flag explanations when optional human strings were trimmed", () => {
		expect( deriveWeatherDecision( { ...jc, wtdata: { skip: 1 } }, { ...jo, wl: 0 } ).currentReason )
			.toContain( "decided to skip" );
		expect( deriveWeatherDecision( { ...jc, wtdata: { pwsBypassed: 1 } }, jo ).currentReason )
			.toContain( "backup weather provider" );
	} );
} );

describe( "renderWeather — Multi-Day Levels (#289)", () => {
	it( "renders the levels when present", () => {
		const html = renderWeather( jc, jo ); // wls [100]
		expect( html ).toContain( "Multi-Day Levels" );
		expect( html ).toContain( "1-day rolling average" );
		expect( html ).toContain( "100%" );
		expect( html ).toContain( "not a forecast" );
		expect( html ).toContain( "interval program" );
		expect( html ).not.toContain( ">Day 1<" );
	} );
	it( "explains level selection, scaling, fallback, and restrictions in human terms", () => {
		const html = renderWeather( { ...jc, wls: [ 100, 90, 80 ] }, jo );
		expect( html ).toContain( "3-day rolling average" );
		expect( html ).toContain( "80% makes them 20% shorter" );
		expect( html ).toContain( "longest average available" );
		expect( html ).toContain( "active weather restriction always skips watering" );
		expect( html ).toContain( "reference only" );
		expect( html ).toContain( "current overall Watering Level" );
	} );
	it( "reports mda as active regardless of method and otherwise explains how to enable it", () => {
		const active = renderWeather( { ...jc, wto: { ...jc.wto, mda: 100 } }, { ...jo, uwt: 1 } );
		expect( active ).toContain( ">Enabled<" );
		expect( active ).toContain( "Multi-day adjustment is enabled" );
		expect( active ).toContain( "uses the N-day average" );

		const disabled = renderWeather( { ...jc, wto: { ...jc.wto, mda: 0 } }, { ...jo, uwt: 3 } );
		expect( disabled ).toContain( ">Disabled<" );
		expect( disabled ).toContain( "Multi-day adjustment is disabled" );
		expect( disabled ).toContain( "reference only" );

		const retained = renderWeather( { ...jc, wto: { ...jc.wto, mda: 100 } }, { ...jo, uwt: 4 } );
		expect( retained ).toContain( ">Enabled<" );
		expect( retained ).toContain( "toggle remains enabled" );

		const manualDisabled = renderWeather( { ...jc, wto: { ...jc.wto, mda: 0 } }, jo );
		expect( manualDisabled ).toContain( ">Disabled<" );
		expect( manualDisabled ).toContain( "Select Zimmerman or ETo" );
	} );
	it( "marks retained levels as potentially stale while the weather service is failing", () => {
		const html = renderWeather( { ...jc, wterr: -1, wls: [ 80 ] }, jo );
		expect( html ).toContain( "last weather update failed" );
		expect( html ).toContain( "retained from the last successful update" );
	} );
	it( "distinguishes pending, stale, not-yet-updated, and invalid-clock levels", () => {
		expect( renderWeather( { ...jc, lwc: 0, lswc: jc.lswc, wterr: -1, wls: [ 80 ] }, jo ) )
			.toContain( "weather update is pending" );
		expect( renderWeather( { ...jc, lwc: 0, lswc: 0, wterr: -1, wls: [ 80 ] }, jo ) )
			.toContain( "No weather update has completed yet" );
		expect( renderWeather( { ...jc, lswc: jc.devt - 86401, wls: [ 80 ] }, jo ) )
			.toContain( "no successful update arrived in the last 24 hours" );
		expect( renderWeather( { ...jc, lswc: jc.devt + 1, wls: [ 80 ] }, jo ) )
			.toContain( "Controller clock needs review" );
	} );
	it( "shows a friendly empty-state instead of '[]' when empty", () => {
		const html = renderWeather( { ...jc, wls: [] }, jo );
		expect( html ).toContain( "Multi-Day Levels" );
		expect( html ).toContain( "None" );
		expect( html ).toContain( "No multi-day averages are available" );
		expect( html ).not.toContain( "[]" );
	} );
} );

describe( "renderWeather — current weather data", () => {
	it( "empty-states when wtdata is empty", () => {
		expect( renderWeather( jc, jo ) ).toContain( "No weather data yet" ); // fixture wtdata {}
	} );
	it( "renders known wtdata fields with labels", () => {
		const html = renderWeather( { ...jc, wtdata: { t: 18, h: 55, p: 2 } }, jo );
		expect( html ).toContain( "Mean temp" );
		expect( html ).toContain( "18" );
		expect( html ).toContain( "Mean humidity" );
		expect( html ).toContain( "55%" );
	} );
} );

describe( "renderWeather — weather-source footer (#291)", () => {
	it( "spells out a local PWS source with the abbr-expansion explainer line", () => {
		const html = renderWeather( { ...jc, wtdata: { wp: "local" } }, jo );
		expect( html ).toContain( "your local Personal Weather Station (PWS)" );
		// the distinct, provider==='local'-gated explainer line (not just the source label substring):
		expect( html ).toContain( '<abbr title="Personal Weather Station">PWS</abbr>' );
		expect( html ).toContain( "is your own weather station" );
	} );
	it( "names a known cloud provider and omits the PWS explainer", () => {
		const html = renderWeather( { ...jc, wtdata: { weatherProvider: "OWM" } }, jo );
		expect( html ).toContain( "OpenWeather" );
		expect( html ).not.toContain( "is your own weather station" );
	} );
	it( "falls back to 'manual adjustment' when no provider and uwt is Manual", () => {
		const html = renderWeather( jc, jo ); // wtdata {}, uwt 0
		expect( html ).toContain( "manual adjustment (no weather service)" );
	} );
	it( "falls back to 'service at <host>' when no provider but a non-Manual method + host", () => {
		const html = renderWeather( { ...jc, wtdata: {} }, { ...jo, uwt: 1 } ); // Zimmerman, host present
		expect( html ).toContain( "service at weather.opensprinkler.com" );
	} );
	it( "shows 'not reported' when no provider, non-Manual method, and no host", () => {
		const html = renderWeather( { ...jc, wtdata: {}, wsp: "" }, { ...jo, uwt: 1 } );
		expect( html ).toContain( "Weather source: not reported" );
	} );
	it( "shows the configured service host", () => {
		expect( renderWeather( jc, jo ) ).toContain( "weather.opensprinkler.com" ); // jc.wsp
	} );
	it( "names the WU PWS station when observations come from a personal weather station", () => {
		const html = renderWeather( { ...jc, wtdata: { wp: "WU" }, wto: { ...jc.wto, provider: "WU", pws: "KCASANFR123" } }, jo );
		expect( html ).toContain( "Weather Underground" );
		expect( html ).toContain( "KCASANFR123" );
	} );
} );

describe( "renderWeather — direct forecast section", () => {
	const okForecast: ForecastState = {
		status: "ok",
		fetchedAt: Date.now() - 60000,
		data: {
			location: [ 37.5, -122.3 ], temp: 72.4, precip: 0.02, description: "Partly cloudy", icon: "02d",
			humidity: 41, wind: 6.3, region: "CA", wp: "WU",
			forecast: [
				{ temp_min: 55, temp_max: 78, precip: 0, date: 1717934400, icon: "01d", description: "Clear" },
				{ temp_min: 57, temp_max: 81, precip: 0.35, date: 1718020800, icon: "10d", description: "Showers" },
			],
		},
	};

	it( "omits the section entirely when no forecast client exists", () => {
		expect( renderWeather( jc, jo ) ).not.toContain( "<h3>Forecast</h3>" );
	} );
	it( "renders current conditions, chart, verbose day cards, and freshness", () => {
		const html = renderWeather( jc, jo, okForecast );
		expect( html ).toContain( "<h3>Forecast</h3>" );
		expect( html ).toContain( "72.4 °F" );
		expect( html ).toContain( "Partly cloudy" );
		expect( html ).toContain( "Humidity 41%" );
		expect( html ).toContain( "Wind 6.3 mph" );
		expect( html ).toContain( "forecast-chart" );
		expect( html ).toContain( "Today" );      // devt fixture day
		expect( html ).toContain( "Mon" );
		expect( html ).toContain( "Showers" );
		expect( html ).toContain( "0.35 in" );
		expect( html ).toContain( "Forecast fetched" );
	} );
	it( "explains the WU hybrid (PWS observations, coordinate forecast)", () => {
		const html = renderWeather( { ...jc, wto: { ...jc.wto, provider: "WU", pws: "KCASANFR123" } }, jo, okForecast );
		expect( html ).toContain( "personal weather station KCASANFR123" );
		expect( html ).toContain( "coordinates" );
	} );
	it( "labels a retained forecast as older when the latest fetch failed", () => {
		const html = renderWeather( jc, jo, { ...okForecast, status: "error", error: "HTTP 502" } );
		expect( html ).toContain( "older forecast" );
		expect( html ).toContain( "HTTP 502" );
		expect( html ).toContain( "forecast-chart" ); // stale data still shown
	} );
	it( "renders unavailable and hard-error states without a chart", () => {
		const unavailable = renderWeather( jc, jo, { status: "unavailable", reason: "No location." } );
		expect( unavailable ).toContain( "No forecast" );
		expect( unavailable ).toContain( "No location." );
		const failed = renderWeather( jc, jo, { status: "error", error: "Timed out." } );
		expect( failed ).toContain( "Forecast unavailable" );
		expect( failed ).not.toContain( "forecast-chart" );
	} );
	it( "renders verbose per-day details when the service provides them", () => {
		const verbose: ForecastState = {
			...okForecast,
			data: { ...okForecast.data!, forecast: [
				{ ...okForecast.data!.forecast[ 1 ]!, pop: 60, wind: 12.4, humidity: 45, uv: 7 } ] },
		};
		const html = renderWeather( jc, jo, verbose );
		expect( html ).toContain( "60% chance of rain" );
		expect( html ).toContain( "wind 12 mph" );
		expect( html ).toContain( "humidity 45%" );
		expect( html ).toContain( "UV 7" );
		// absent optionals render nothing, not zeros:
		expect( renderWeather( jc, jo, okForecast ) ).not.toContain( "chance of rain" );
	} );
	it( "escapes hostile service strings and surfaces alerts", () => {
		const hostile: ForecastState = {
			...okForecast,
			data: {
				...okForecast.data!,
				description: `<script>alert(1)</script>`,
				alert: { name: "Flood watch", message: "<b>High water</b>" },
			},
		};
		const html = renderWeather( jc, jo, hostile );
		expect( html ).not.toContain( "<script>" );
		expect( html ).toContain( "Flood watch" );
		expect( html ).not.toContain( "<b>High water</b>" );
	} );
} );

describe( "renderWeather — wtdata labels match WU aggregation semantics", () => {
	it( "labels wind as a peak, radiation as a total, and units as imperial", () => {
		const html = renderWeather( { ...jc, wtdata: { wind: 12, radiation: 6.5, eto: 0.21, p: 0.4 } }, jo );
		expect( html ).toContain( "Peak wind" );
		expect( html ).toContain( "12 mph" );
		expect( html ).toContain( "Total solar radiation" );
		expect( html ).toContain( "ETo (latest complete day)" );
		expect( html ).toContain( "0.21 in" );
		expect( html ).toContain( "not a forecast" );
	} );
} );

/**
 * Diagnostics tests — interpretation helpers (ported from the legacy app) plus the System
 * Diagnostics view: health summary, grouped sections, relative+absolute times, and the tz-correct
 * "Last request" (upstream #287/#288).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJc, parseJo } from "../www/src/api/client";
import {
	adjustmentMethodName, weatherErrorText, weatherStatus, rebootReason, wifiRating, otcStatus,
	weatherProviderTag, weatherSourceName,
} from "../www/src/api/diagnostics";
import { formatControllerDateTime } from "../www/src/api/time";
import { renderDiagnostics } from "../www/src/views/diagnostics-view";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jc = parseJc( fx( "jc" ) );
const jo = parseJo( fx( "jo" ) );

describe( "interpretation helpers (legacy parity)", () => {
	it( "adjustmentMethodName masks bit 7 and names known methods", () => {
		expect( adjustmentMethodName( 0 ) ).toBe( "Manual" );
		expect( adjustmentMethodName( 1 ) ).toBe( "Zimmerman" );
		expect( adjustmentMethodName( 4 ) ).toBe( "Monthly" );
		expect( adjustmentMethodName( 4 | ( 1 << 7 ) ) ).toBe( "Monthly" ); // restriction bit ignored
		expect( adjustmentMethodName( 9 ) ).toBe( "Method 9" );
	} );
	it( "weatherErrorText: exact match, tens-digit category, then unknown", () => {
		expect( weatherErrorText( 0 ) ).toBe( "Success" );
		expect( weatherErrorText( -3 ) ).toBe( "Timed Out" );
		expect( weatherErrorText( 21 ) ).toBe( "Location Not Found" );
		expect( weatherErrorText( 25 ) ).toBe( "Location Error" ); // 25 → category 2
		expect( weatherErrorText( 1234 ) ).toBe( "Unrecognised (1234)" );
	} );
	it( "weatherErrorText: category boundaries and the >=10 guard for negatives", () => {
		expect( weatherErrorText( 19 ) ).toBe( "Weather Data Error" );   // category 1
		expect( weatherErrorText( 59 ) ).toBe( "Adjustment Options Error" ); // category 5
		expect( weatherErrorText( 60 ) ).toBe( "Unrecognised (60)" );    // past the 10..59 window
		// the err>=10 guard must stop Math.floor(-7/10) === -1 ("No Response") from matching:
		expect( weatherErrorText( -7 ) ).toBe( "Unrecognised (-7)" );
	} );
	it( "weatherStatus tri-states on sign", () => {
		expect( weatherStatus( 0 ) ).toEqual( { text: "Online", level: "ok" } );
		expect( weatherStatus( -1 ) ).toEqual( { text: "Offline", level: "error" } );
		expect( weatherStatus( 5 ) ).toEqual( { text: "Error", level: "error" } );
	} );
	it( "rebootReason maps codes", () => {
		expect( rebootReason( 99 ) ).toBe( "Power On" );
		expect( rebootReason( 1 ) ).toBe( "Factory Reset" );
		expect( rebootReason( 50 ) ).toBe( "Unrecognised (50)" );
	} );
	it( "wifiRating bands", () => {
		expect( wifiRating( -45 ) ).toEqual( { text: "-45 dBm (Excellent)", level: "ok" } );
		expect( wifiRating( -67 ) ).toEqual( { text: "-67 dBm (Fair)", level: "warn" } );
		expect( wifiRating( -85 ) ).toEqual( { text: "-85 dBm (Unusable)", level: "error" } );
	} );
	it( "otcStatus maps codes", () => {
		expect( otcStatus( 3 ).text ).toBe( "Connected" );
		expect( otcStatus( 2 ) ).toEqual( { text: "Disconnected", level: "error" } );
		expect( otcStatus( 0 ).level ).toBe( "neutral" );
	} );
	it( "weatherProviderTag + weatherSourceName", () => {
		expect( weatherProviderTag( { wp: "local" } ) ).toBe( "local" );
		expect( weatherProviderTag( { weatherProvider: "OWM" } ) ).toBe( "OWM" );
		expect( weatherProviderTag( {} ) ).toBeNull();
		expect( weatherSourceName( "local" ) ).toContain( "Personal Weather Station (PWS)" );
		expect( weatherSourceName( "OWM" ) ).toBe( "OpenWeather" );
		expect( weatherSourceName( "ZZ" ) ).toBe( "an unrecognised weather provider" );
	} );
} );

describe( "renderDiagnostics", () => {
	const html = renderDiagnostics( jc, jo );
	it( "shows a one-line health summary with weather status + relative last-update", () => {
		expect( html ).toContain( "health-summary" );
		expect( html ).toContain( "Weather: Online" );
		expect( html ).toContain( "Last update 10 mins ago" ); // devt-lswc = 600s
	} );
	it( "groups fields under Connectivity / Weather service / Scheduling", () => {
		expect( html ).toContain( "Connectivity" );
		expect( html ).toContain( "Weather service" );
		expect( html ).toContain( "Scheduling" );
	} );
	it( "decodes the external IP from the uint32", () => {
		expect( html ).toContain( "192.168.1.100" ); // eip 3232235876
	} );
	it( "renders Last request as tz-correct absolute time + relative hint (#287)", () => {
		expect( html ).toContain( "Last request" );
		expect( html ).toContain( formatControllerDateTime( jc.lwc ) );
		expect( html ).toContain( "(10 mins ago)" );
	} );
	it( "does not apply a changed timezone option twice to an already-local firmware epoch", () => {
		const utc = renderDiagnostics( jc, { ...jo, tz: 48 } );
		const pdt = renderDiagnostics( jc, { ...jo, tz: 20 } ); // GMT-7
		expect( utc ).toContain( formatControllerDateTime( jc.lwc ) );
		expect( pdt ).toContain( formatControllerDateTime( jc.lwc ) );
		expect( utc ).toContain( "PM" );
	} );
	it( "flags impossible future history instead of presenting it as a future event", () => {
		const invalidClock = renderDiagnostics( { ...jc, lwc: jc.devt + 60, lswc: jc.devt + 60, lupt: jc.devt + 60 }, jo );
		expect( invalidClock ).toContain( "Controller clock needs review" );
		expect( invalidClock ).not.toContain( "in 1 min" );
	} );
	it( "shows platform-gated rows only when present", () => {
		expect( html ).not.toContain( "Wi-Fi strength" ); // fixture has no RSSI
		expect( html ).not.toContain( "OpenThings Cloud" ); // fixture has no otcs
		expect( html ).not.toContain( "Current draw" );     // fixture has no curr
		const rich = renderDiagnostics( { ...jc, RSSI: -67, otcs: 3, curr: 240 }, jo );
		expect( rich ).toContain( "-67 dBm (Fair)" );
		expect( rich ).toContain( "Connected" );
		expect( rich ).toContain( "240 mA" );
	} );
	it( "renders the Weather restriction Active/Inactive branch (#290)", () => {
		expect( html ).toContain( "Weather restriction" );
		expect( html ).toContain( "Inactive" );             // fixture wtrestr 0
		const restricted = renderDiagnostics( { ...jc, wtrestr: 1 }, jo );
		expect( restricted ).toContain( "Active" );
	} );
	it( "names the weather source with the PWS station and the service host", () => {
		const wu = renderDiagnostics( { ...jc, wtdata: { wp: "WU" }, wto: { provider: "WU", pws: "KCASANFR123" } }, jo );
		expect( wu ).toContain( "Weather source" );
		expect( wu ).toContain( "Weather Underground · PWS KCASANFR123" );
		expect( wu ).toContain( "Service host" );
		expect( wu ).toContain( "weather.opensprinkler.com" );
		expect( wu ).not.toContain( "wto.key" );
		// falls back to configured wto.provider before any observation arrives:
		const configuredOnly = renderDiagnostics( { ...jc, wtdata: {}, wto: { provider: "OWM" } }, jo );
		expect( configuredOnly ).toContain( "OpenWeather" );
		// fixture has neither a provider tag nor wto.provider → row omitted:
		expect( html ).not.toContain( "Weather source" );
	} );
	it( "reports direct forecast-fetch health without leaking credentials", () => {
		const now = Math.floor( Date.now() / 1000 );
		const ok = renderDiagnostics( jc, jo, {
			status: "ok", fetchedAt: Date.now() - 120000,
			data: {
				location: [ 37.5, -122.3 ], temp: 70, precip: 0, description: "Clear", icon: "01d",
				ttl: 600000, observedAt: now - 720, generatedAt: now - 180,
				forecast: [ { temp_min: 55, temp_max: 78, precip: 0, date: 1717934400, icon: "01d", description: "Clear" } ],
			},
		} );
		expect( ok ).toContain( "Forecast fetch" );
		expect( ok ).toContain( "OK" );
		expect( ok ).toContain( "2 mins ago" );
		expect( ok ).toContain( "Forecast cache" );
		expect( ok ).toContain( "10 min" );
		expect( ok ).toContain( "Observation age" );
		expect( ok ).toContain( "12 mins ago" );
		expect( ok ).toContain( "Forecast generated" );
		expect( ok ).toContain( "3 mins ago" );
		const failed = renderDiagnostics( jc, jo, { status: "error", error: "HTTP 502" } );
		expect( failed ).toContain( "Failed" );
		expect( failed ).toContain( "HTTP 502" );
		expect( html ).not.toContain( "Forecast fetch" ); // omitted without a forecast client
	} );
} );

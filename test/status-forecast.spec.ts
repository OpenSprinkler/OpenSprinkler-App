/** Status tab — the single compact forecast row (today's temps + next meaningful rain). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJc, parseJo, deriveCapabilities } from "../www/src/api/client";
import { renderControllerStatus, forecastSummary } from "../www/src/spike/status-view";
import type { ForecastState } from "../www/src/api/weather";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jc = parseJc( fx( "jc" ) );
const jo = parseJo( fx( "jo" ) );
const caps = deriveCapabilities( jc, jo );

const forecast: ForecastState = {
	status: "ok", fetchedAt: Date.now(),
	data: {
		location: [ 37.5, -122.3 ], temp: 72, precip: 0, description: "Clear", icon: "01d",
		forecast: [
			{ temp_min: 55.6, temp_max: 78.4, precip: 0.02, date: 1717934400, icon: "01d", description: "Clear" },
			{ temp_min: 57, temp_max: 81, precip: 0.35, date: 1718020800, icon: "10d", description: "Showers" },
		],
	},
};

describe( "forecastSummary", () => {
	it( "summarizes today's range and the next meaningful rain day", () => {
		expect( forecastSummary( forecast, jc, jo ) ).toBe( "High 78°F / Low 56°F · rain 0.35 in Mon" );
	} );
	it( "says 'today' when today crosses the rain threshold", () => {
		const wet: ForecastState = { ...forecast, data: { ...forecast.data!, forecast: [
			{ ...forecast.data!.forecast[ 0 ]!, precip: 0.5 }, ...forecast.data!.forecast.slice( 1 ) ] } };
		expect( forecastSummary( wet, jc, jo ) ).toContain( "rain 0.5 in today" );
	} );
	it( "reports a dry outlook and suppresses itself without fresh data", () => {
		const dry: ForecastState = { ...forecast, data: { ...forecast.data!, forecast: forecast.data!.forecast.map(
			( d ) => ( { ...d, precip: 0 } ) ) } };
		expect( forecastSummary( dry, jc, jo ) ).toContain( "no rain expected in the next 2 days" );
		expect( forecastSummary( undefined, jc, jo ) ).toBeNull();
		expect( forecastSummary( { status: "error", error: "x" }, jc, jo ) ).toBeNull();
		expect( forecastSummary( { status: "unavailable" }, jc, jo ) ).toBeNull();
	} );
} );

describe( "renderControllerStatus — forecast row", () => {
	it( "adds one row when a fresh forecast exists and none otherwise", () => {
		const withRow = renderControllerStatus( jc, jo, caps, { forecast } );
		expect( withRow ).toContain( "Today's forecast" );
		expect( withRow ).toContain( "High 78°F / Low 56°F" );
		expect( renderControllerStatus( jc, jo, caps, {} ) ).not.toContain( "forecast" );
	} );
} );

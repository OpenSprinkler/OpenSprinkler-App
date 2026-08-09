/** Forecast SVG chart — geometry sanity, direct labels, escaping, and icon-code mapping. */
import { describe, it, expect } from "vitest";
import { renderForecastChart, weatherIconSvg, type ForecastChartDay } from "../www/src/ui/forecast-chart";

function day( overrides: Partial<ForecastChartDay> = {} ): ForecastChartDay {
	return { label: "Mon", temp_min: 55, temp_max: 78, precip: 0.25, description: "Cloudy", ...overrides };
}

describe( "renderForecastChart", () => {
	it( "renders nothing for an empty list", () => {
		expect( renderForecastChart( [] ) ).toBe( "" );
	} );
	it( "renders both panels, day labels, and direct value labels", () => {
		const html = renderForecastChart( [ day( { label: "Today" } ), day( { label: "Tue", temp_max: 90, precip: 0 } ) ] );
		expect( html ).toContain( "High / Low (°F)" );
		expect( html ).toContain( "Rain (in)" );
		expect( html ).toContain( ">Today</text>" );
		expect( html ).toContain( ">Tue</text>" );
		expect( html ).toContain( ">90°</text>" );
		expect( html ).toContain( ">55°</text>" );
		expect( html ).toContain( ">0.25</text>" );
	} );
	it( "shows a muted zero instead of a bar for a dry day", () => {
		const html = renderForecastChart( [ day( { precip: 0 } ) ] );
		expect( html ).not.toContain( "fc-precip\"" );
		expect( html ).toContain( ">0</text>" );
	} );
	it( "carries an accessible summary and hover titles, with content escaped", () => {
		const html = renderForecastChart( [ day( { description: `<img onerror="x">` } ) ] );
		expect( html ).toContain( 'role="img"' );
		expect( html ).toContain( "aria-label=" );
		expect( html ).toContain( "<title>" );
		expect( html ).not.toContain( `<img onerror` );
	} );
	it( "keeps a visible temperature bar when high equals low", () => {
		const html = renderForecastChart( [ day( { temp_min: 70, temp_max: 70 } ) ] );
		expect( html ).toMatch( /class="fc-temp"[^>]*height="8"/ );
	} );
} );

describe( "weatherIconSvg", () => {
	it( "maps OWM code families to distinct glyphs and defaults to a cloud", () => {
		const sun = weatherIconSvg( "01d" ), storm = weatherIconSvg( "11n" ), fallback = weatherIconSvg( "??" );
		expect( sun ).toContain( "<svg" );
		expect( sun ).not.toBe( storm );
		expect( fallback ).toBe( weatherIconSvg( "04d" ) );
	} );
	it( "never interpolates unsafe icon input", () => {
		expect( weatherIconSvg( `"><script>` ) ).not.toContain( "script" );
	} );
} );

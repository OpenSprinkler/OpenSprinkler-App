/**
 * View-render tests — stations + programs views render the decoded fixture data.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJc, parseJl, parseJn, parseJp } from "../www/src/api/client";
import { renderStations } from "../www/src/views/stations-view";
import { renderPrograms } from "../www/src/views/programs-view";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jc = parseJc( fx( "jc" ) );
const jn = parseJn( fx( "jn" ) );
const jp = parseJp( fx( "jp" ) );

describe( "renderStations", () => {
	const html = renderStations( jc, jn );
	it( "lists all stations with names and the active count", () => {
		expect( html ).toContain( "Front Lawn" );
		expect( html ).toContain( "Back Lawn" );
		expect( html ).toContain( "(8, 1 on)" );  // 8 stations, sbits => 1 on
	} );
	it( "marks the running station On with time remaining", () => {
		expect( html ).toContain( ">On<" );
		expect( html ).toContain( "left" );        // 600s remaining
	} );

	it( "omits current draw and last-run column without curr/jl", () => {
		expect( html ).not.toContain( "mA" );
		expect( html ).not.toContain( "Last run" );
	} );

	it( "shows controller current draw and per-station last runs when provided", () => {
		const jl = parseJl( fx( "jl" ) );
		const jo = { fpr0: 100, fpr1: 0 } as never; // flow calibration: 1 L/pulse
		const rich = renderStations( { ...jc, curr: 247 }, jn, { jl, jo } );
		expect( rich ).toContain( "drawing 247 mA" );
		expect( rich ).toContain( "Last run" );
		expect( rich ).toContain( "10m" );          // Garden Drip's newest log run (600s)
		expect( rich ).toContain( "06/09/2024 1:30 PM" );
		expect( rich ).toContain( "0.65 gal/min" ); // pulses/min × fpr (liters) → imperial
		expect( rich ).toContain( "—" );            // stations that never ran stay honest
	} );

	it( "omits flow, not mislabels it, when the controller has no calibration", () => {
		const jl = parseJl( fx( "jl" ) );
		const rich = renderStations( jc, jn, { jl } );
		expect( rich ).toContain( "Last run" );
		expect( rich ).not.toContain( "gal/min" );
	} );
} );

describe( "renderPrograms", () => {
	const html = renderPrograms( jp, jn );
	it( "renders the decoded program schedule", () => {
		expect( html ).toContain( "Morning Watering" );
		expect( html ).toContain( "Mon, Wed, Fri" );
		expect( html ).toContain( "6:30 AM" );
		expect( html ).toContain( "Sunrise +30m" );
		expect( html ).toContain( "05/01" );        // annual date range (firmware stores no year)
		expect( html ).toContain( "Seasonal range (every year)" );
		expect( html ).toContain( "Sunrise to Sunset" ); // solar duration
	} );
	it( "shows only participating stations (duration > 0)", () => {
		expect( html ).toContain( "3 stations" );
	} );
	it( "offers Edit as the primary action with the stored program index", () => {
		const interactive = renderPrograms( jp, jn, { actions: true } );
		const edit = interactive.indexOf( 'data-action="program-edit" data-pid="0"' );
		const run = interactive.indexOf( 'data-action="program-run"' );
		expect( edit ).toBeGreaterThan( -1 );
		expect( edit ).toBeLessThan( run );
		expect( interactive ).toContain( 'aria-label="Edit program 1: Morning Watering"' );
	} );
} );

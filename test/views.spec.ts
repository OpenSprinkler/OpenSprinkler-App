/**
 * View-render tests — stations + programs views render the decoded fixture data.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJc, parseJn, parseJp } from "../www/src/api/client";
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
} );

describe( "renderPrograms", () => {
	const html = renderPrograms( jp, jn );
	it( "renders the decoded program schedule", () => {
		expect( html ).toContain( "Morning Watering" );
		expect( html ).toContain( "Mon, Wed, Fri" );
		expect( html ).toContain( "06:30" );
		expect( html ).toContain( "Sunrise +30m" );
		expect( html ).toContain( "05-01" );        // date range
		expect( html ).toContain( "Sunrise to Sunset" ); // solar duration
	} );
	it( "shows only participating stations (duration > 0)", () => {
		expect( html ).toContain( "3 stations" );
	} );
} );

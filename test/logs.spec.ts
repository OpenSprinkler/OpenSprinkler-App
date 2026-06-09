/**
 * Log decoder + view tests — /jl station runs and special events.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJl, parseJn } from "../www/src/api/client";
import { decodeLogRow, describeLogEntry } from "../www/src/api/decode";
import { renderLogs } from "../www/src/views/logs-view";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jl = parseJl( fx( "jl" ) );
const jn = parseJn( fx( "jn" ) );

describe( "decodeLogRow", () => {
	it( "decodes a station run with flow", () => {
		const e = decodeLogRow( jl[ 0 ] );
		expect( e.kind ).toBe( "station" );
		if ( e.kind === "station" ) {
			expect( e.station ).toBe( 2 );
			expect( e.durationSec ).toBe( 600 );
			expect( e.flowGpm ).toBe( 2.45 );
		}
	} );
	it( "discriminates special events by the string code", () => {
		expect( decodeLogRow( jl[ 2 ] ).kind ).toBe( "sensor1" );
		expect( decodeLogRow( jl[ 3 ] ).kind ).toBe( "raindelay" );
		expect( decodeLogRow( jl[ 4 ] ).kind ).toBe( "waterlevel" );
		expect( decodeLogRow( jl[ 5 ] ).kind ).toBe( "flow" );
	} );
	it( "water-level value2 is the percentage; flow value is pulse count", () => {
		const wl = decodeLogRow( jl[ 4 ] );
		expect( wl.kind === "waterlevel" && wl.value ).toBe( 75 );
		const fl = decodeLogRow( jl[ 5 ] );
		expect( fl.kind === "flow" && fl.value ).toBe( 1280 );
		expect( fl.kind === "flow" && fl.durationSec ).toBe( 60 );
	} );
} );

describe( "describeLogEntry", () => {
	it( "renders human descriptions per kind", () => {
		expect( describeLogEntry( decodeLogRow( jl[ 0 ] ), jn.snames ) ).toBe( "Garden Drip ran 10m (program 1) · 2.45 gpm" );
		expect( describeLogEntry( decodeLogRow( jl[ 2 ] ), jn.snames ) ).toBe( "Sensor 1 active 1h" );
		expect( describeLogEntry( decodeLogRow( jl[ 3 ] ), jn.snames ) ).toBe( "Rain delay 2h" );
		expect( describeLogEntry( decodeLogRow( jl[ 4 ] ), jn.snames ) ).toBe( "Water level set to 75%" );
		expect( describeLogEntry( decodeLogRow( jl[ 5 ] ), jn.snames ) ).toBe( "Flow: 1280 pulses over 1m" );
	} );
} );

describe( "renderLogs", () => {
	const html = renderLogs( jl, jn );
	it( "shows all entries, newest first, with the count", () => {
		expect( html ).toContain( "Log <span" );
		expect( html ).toContain( "(6)" );
		expect( html ).toContain( "Garden Drip ran 10m" );
		expect( html ).toContain( "Water level set to 75%" );
		// newest (2024-06-09 13:30 from 1717939800) appears before an older row
		expect( html.indexOf( "Garden Drip ran 10m" ) ).toBeLessThan( html.indexOf( "Flow: 1280 pulses" ) );
	} );
} );

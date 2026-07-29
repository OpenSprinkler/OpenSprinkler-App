/**
 * Log decoder + view tests — /jl station runs and special events.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJl, parseJn } from "../www/src/api/client";
import { decodeLogRow, describeLogEntry, lastRunsByStation } from "../www/src/api/decode";
import { renderLogs } from "../www/src/views/logs-view";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jl = parseJl( fx( "jl" ) );
const jn = parseJn( fx( "jn" ) );

describe( "decodeLogRow", () => {
	it( "decodes a station run with flow", () => {
		const e = decodeLogRow( jl[ 5 ] );
		expect( e.kind ).toBe( "station" );
		if ( e.kind === "station" ) {
			expect( e.station ).toBe( 2 );
			expect( e.durationSec ).toBe( 600 );
			expect( e.flowPulseRate ).toBe( 2.45 );  // raw pulses/min — volume needs fpr calibration
		}
	} );
	it( "discriminates special events by the string code", () => {
		expect( decodeLogRow( jl[ 3 ] ).kind ).toBe( "sensor1" );
		expect( decodeLogRow( jl[ 2 ] ).kind ).toBe( "raindelay" );
		expect( decodeLogRow( jl[ 1 ] ).kind ).toBe( "waterlevel" );
		expect( decodeLogRow( jl[ 0 ] ).kind ).toBe( "flow" );
	} );
	it( "water-level value2 is the percentage; flow value is pulse count", () => {
		const wl = decodeLogRow( jl[ 1 ] );
		expect( wl.kind === "waterlevel" && wl.value ).toBe( 75 );
		const fl = decodeLogRow( jl[ 0 ] );
		expect( fl.kind === "flow" && fl.value ).toBe( 1280 );
		expect( fl.kind === "flow" && fl.durationSec ).toBe( 60 );
	} );
} );

describe( "describeLogEntry", () => {
	it( "renders human descriptions per kind", () => {
		// Without calibration the flow figure is unprintable (raw pulses) — omitted, not mislabeled.
		expect( describeLogEntry( decodeLogRow( jl[ 5 ] ), jn.snames ) ).toBe( "Garden Drip ran 10m (program 1)" );
		// With fpr calibration (1 L/pulse): 2.45 pulses/min → 2.45 L/min → 0.65 gal/min imperial.
		expect( describeLogEntry( decodeLogRow( jl[ 5 ] ), jn.snames, { fpr0: 100, fpr1: 0 } ) )
			.toBe( "Garden Drip ran 10m (program 1) · 0.65 gal/min" );
		expect( describeLogEntry( decodeLogRow( jl[ 3 ] ), jn.snames ) ).toBe( "Sensor 1 active 1h" );
		expect( describeLogEntry( decodeLogRow( jl[ 2 ] ), jn.snames ) ).toBe( "Rain delay 2h" );
		expect( describeLogEntry( decodeLogRow( jl[ 1 ] ), jn.snames ) ).toBe( "Water level set to 75%" );
		expect( describeLogEntry( decodeLogRow( jl[ 0 ] ), jn.snames ) ).toBe( "Flow: 1280 pulses over 1m" );
	} );
} );

describe( "log chronology across folded controller wall time", () => {
	const folded = parseJl( [
		[ 1, 0, 60, 6600 ],   // earlier occurrence: 1:50 AM
		[ 1, 0, 120, 4200 ],  // later after fall-back: 1:10 AM
		[ 1, 0, 180, 4200 ],  // still later, same encoded wall time
	] );
	it( "uses the last source occurrence for each station", () => {
		expect( lastRunsByStation( folded ).get( 0 ) ).toMatchObject( { when: 4200, durationSec: 180 } );
	} );
	it( "renders newest-first by reversing append order rather than sorting timestamps", () => {
		const html = renderLogs( folded, jn );
		expect( html.indexOf( "ran 3m" ) ).toBeLessThan( html.indexOf( "ran 2m" ) );
		expect( html.indexOf( "ran 2m" ) ).toBeLessThan( html.indexOf( "ran 1m" ) );
	} );
} );

describe( "renderLogs", () => {
	const html = renderLogs( jl, jn );
	it( "shows all entries, newest first, with the count", () => {
		expect( html ).toContain( "Log <span" );
		expect( html ).toContain( "(6)" );
		expect( html ).toContain( "Garden Drip ran 10m" );
		expect( html ).toContain( "Water level set to 75%" );
		expect( html ).toContain( "06/09/2024 1:30 PM" );
		expect( html ).not.toContain( "2024-06-09" );
		// newest controller-local entry appears before an older row
		expect( html.indexOf( "Garden Drip ran 10m" ) ).toBeLessThan( html.indexOf( "Flow: 1280 pulses" ) );
	} );
} );

/**
 * API contract tests — Phase 1 / Step 1.
 *
 * Run the typed client parsers against the (provisional, derived) fixtures and assert the
 * invariants the UI depends on, including the known ambiguities flagged during contract
 * capture. When fixtures are replaced with live device captures, these tests pin the real
 * contract and fail on producer-side drift.
 *
 *   npm run test:contract       (vitest run)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import {
	parseJc, parseJo, parseJn, parseJp, parseJl, parseJs,
	deriveCapabilities, isStationLogRow, isPreAuthFallback, ApiError,
} from "../www/src/api/client";

function fixture( name: string ): unknown {
	const url = new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url );
	return JSON.parse( readFileSync( fileURLToPath( url ), "utf8" ) );
}

describe( "/jc controller status", () => {
	const jc = parseJc( fixture( "jc" ) );
	it( "parses required numeric/array fields", () => {
		expect( jc.devt ).toBeTypeOf( "number" );
		expect( jc.nbrd ).toBeTypeOf( "number" );
		expect( Array.isArray( jc.ps ) ).toBe( true );
		expect( Array.isArray( jc.sbits ) ).toBe( true );
	} );
	it( "lrun is [station, program, duration, endtime] (station-first, length 4)", () => {
		expect( jc.lrun ).toHaveLength( 4 );
		expect( jc.lrun.every( ( n ) => typeof n === "number" ) ).toBe( true );
	} );
	it( "eip is number|string", () => {
		expect( [ "number", "string" ] ).toContain( typeof jc.eip );
	} );
	it( "rejects a non-object", () => {
		expect( () => parseJc( 42 ) ).toThrow( ApiError );
	} );
	it( "rejects a malformed lrun", () => {
		expect( () => parseJc( { ...( fixture( "jc" ) as object ), lrun: [ 1, 2 ] } ) ).toThrow( /lrun/ );
	} );
} );

describe( "/jo options", () => {
	const jo = parseJo( fixture( "jo" ) );
	it( "exposes fwv as a number (pre-auth readable)", () => {
		expect( jo.fwv ).toBeTypeOf( "number" );
		expect( jo.fwv ).toBe( 221 );
	} );
	it( "detects the pre-auth fallback shape", () => {
		expect( isPreAuthFallback( { fwv: 221 } ) ).toBe( true );
		expect( isPreAuthFallback( jo ) ).toBe( false );
	} );
	it( "ms is a number array", () => {
		expect( Array.isArray( jo.ms ) ).toBe( true );
	} );
} );

describe( "/jn stations", () => {
	const jn = parseJn( fixture( "jn" ) );
	it( "snames length matches station count; per-board arrays len = nboards", () => {
		expect( jn.snames ).toHaveLength( 8 );
		expect( jn.stn_dis ).toHaveLength( 1 );  // 1 board
		expect( jn.maxlen ).toBe( 32 );
	} );
} );

describe( "/jp programs", () => {
	const jp = parseJp( fixture( "jp" ) );
	it( "pd is an array of program tuples with int16 daterange", () => {
		expect( jp.nprogs ).toBe( 1 );
		const [ , , , starttimes, durations, name, daterange ] = jp.pd[ 0 ];
		expect( Array.isArray( starttimes ) ).toBe( true );
		expect( Array.isArray( durations ) ).toBe( true );
		expect( name ).toBeTypeOf( "string" );
		expect( daterange[ 1 ] ).toBeGreaterThanOrEqual( -32768 );
		expect( daterange[ 2 ] ).toBeLessThanOrEqual( 32767 );
	} );
} );

describe( "/jl logs (discriminated rows)", () => {
	const jl = parseJl( fixture( "jl" ) );
	it( "is a bare array; station vs special rows discriminate on typeof row[1]", () => {
		expect( Array.isArray( jl ) ).toBe( true );
		const stationRows = jl.filter( isStationLogRow );
		const specialRows = jl.filter( ( r ) => !isStationLogRow( r ) );
		expect( stationRows.length ).toBe( 2 );  // jl fixture: 2 station runs
		expect( specialRows.length ).toBe( 4 );  // + s1/rd/wl/fl special events
		// station row with flow telemetry has a 5th element
		expect( stationRows[ 0 ][ 4 ] ).toBeTypeOf( "number" );
		// special row's index 1 is the type string
		expect( typeof ( specialRows[ 0 ] as unknown[] )[ 1 ] ).toBe( "string" );
	} );
	it( "rejects a non-array", () => {
		expect( () => parseJl( { not: "an array" } ) ).toThrow( ApiError );
	} );
} );

describe( "/js status", () => {
	it( "sn length matches nstations", () => {
		const js = parseJs( fixture( "js" ) );
		expect( js.sn ).toHaveLength( js.nstations );
	} );
} );

describe( "capabilities (fwv matrix)", () => {
	it( "derives capability flags from /jc + /jo", () => {
		const jc = parseJc( fixture( "jc" ) );
		const jo = parseJo( fixture( "jo" ) );
		const caps = deriveCapabilities( jc, jo );
		expect( caps.fwvCombined ).toBe( 221 * 10 + 4 ); // fwv*10 + fwm
		expect( caps.weatherRestricted ).toBe( true );    // jc.wtrestr present
		expect( caps.secondMaster ).toBe( false );         // jo.mas2 == 0
		expect( caps.flowSensor ).toBe( false );           // jo.sn1t == 1 (not 2)
	} );
} );

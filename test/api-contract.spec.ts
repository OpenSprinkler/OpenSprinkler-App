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
	it( "rejects finite timestamps that cannot be represented by the firmware or Date", () => {
		expect( () => parseJc( { ...( fixture( "jc" ) as object ), devt: 1e308 } ) ).toThrow( /timestamp/i );
		for ( const key of [ "lwc", "lswc", "lupt" ] ) {
			expect( () => parseJc( { ...( fixture( "jc" ) as object ), [ key ]: 1.5 } ) ).toThrow( /timestamp/i );
		}
	} );
	it( "rejects malformed weather times, status, and multi-day percentages", () => {
		for ( const [ key, value ] of [
			[ "sunrise", -1 ], [ "sunset", 1441 ], [ "wterr", 1.5 ], [ "wtrestr", 2 ],
		] ) expect( () => parseJc( { ...( fixture( "jc" ) as object ), [ key ]: value } ) ).toThrow( /weather|sunrise|sunset/i );
		for ( const wls of [ [ -1 ], [ 251 ], [ 80.5 ], Array( 15 ).fill( 100 ) ] ) {
			expect( () => parseJc( { ...( fixture( "jc" ) as object ), wls } ) ).toThrow( /multi-day/i );
		}
	} );
	it( "requires weather data to be a non-null plain record", () => {
		for ( const wtdata of [ null, [] ] ) {
			expect( () => parseJc( { ...( fixture( "jc" ) as object ), wtdata } ) ).toThrow( /plain object.*wtdata/i );
		}
		expect( () => parseJc( { ...( fixture( "jc" ) as object ), wtdata: {} } ) ).not.toThrow();
	} );
	it( "treats nbrd as the total board count and requires coherent station arrays", () => {
		const twoBoards = fixture( "jc" ) as { nbrd: number; ps: unknown[]; sbits: number[] };
		twoBoards.nbrd = 2;
		twoBoards.ps = [ ...twoBoards.ps, ...twoBoards.ps ];
		twoBoards.sbits = [ 2, 0, 0 ]; // one byte per board plus the firmware's zero sentinel
		expect( parseJc( twoBoards ).ps ).toHaveLength( 16 );

		for ( const nbrd of [ 0, 1.5, 26, 256 ] ) {
			expect( () => parseJc( { ...( fixture( "jc" ) as object ), nbrd } ) ).toThrow( /board count/i );
		}
		const wrongStatusCount = fixture( "jc" ) as { nbrd: number; sbits: number[] };
		wrongStatusCount.nbrd = 2;
		wrongStatusCount.sbits = [ 0, 0, 0 ];
		expect( () => parseJc( wrongStatusCount ) ).toThrow( /station-status count/i );
		for ( const sbits of [ [ 0, 0 ], [ 0, 0, 1 ], [ 0, 0, 0, 0 ] ] ) {
			expect( () => parseJc( { ...twoBoards, sbits } ) ).toThrow( /station bitfield/i );
		}
	} );
	it( "enforces the uint8/uint16 runtime tuple boundaries", () => {
		const valid = fixture( "jc" ) as { lrun: unknown[]; ps: unknown[][] };
		valid.lrun = [ 255, 255, 65535, 0xffffffff ];
		valid.ps[ 0 ] = [ 255, 65535, 0xffffffff, 255 ];
		expect( () => parseJc( valid ) ).not.toThrow();

		for ( const lrun of [ [ 256, 0, 0, 0 ], [ 0, 256, 0, 0 ], [ 0, 0, 65536, 0 ] ] ) {
			expect( () => parseJc( { ...( fixture( "jc" ) as object ), lrun } ) ).toThrow( /lrun/i );
		}
		for ( const status of [ [ 256, 0, 0, 0 ], [ 0, 65536, 0, 0 ] ] ) {
			const raw = fixture( "jc" ) as { ps: unknown[][] };
			raw.ps[ 0 ] = status;
			expect( () => parseJc( raw ) ).toThrow( /station-status tuple/i );
		}
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
	it( "requires an integer water level in the firmware's 0–250 range", () => {
		for ( const wl of [ -1, 250.5, 251 ] ) {
			expect( () => parseJo( { ...( fixture( "jo" ) as object ), wl } ) ).toThrow( /water level/i );
		}
	} );
	it( "requires a quarter-hour timezone encoding in the firmware's 0–108 range", () => {
		expect( parseJo( { ...( fixture( "jo" ) as object ), tz: 108 } ).tz ).toBe( 108 );
		for ( const tz of [ -1, 48.5, 109 ] ) {
			expect( () => parseJo( { ...( fixture( "jo" ) as object ), tz } ) ).toThrow( /timezone/i );
		}
	} );
} );

describe( "/jn stations", () => {
	const jn = parseJn( fixture( "jn" ) );
	it( "snames length matches station count; per-board arrays len = nboards", () => {
		expect( jn.snames ).toHaveLength( 8 );
		expect( jn.stn_dis ).toHaveLength( 1 );  // 1 board
		expect( jn.maxlen ).toBe( 32 );
	} );
	it( "rejects incoherent station names, board attributes, groups, and byte limits", () => {
		const empty = fixture( "jn" ) as Record<string, unknown>;
		for ( const key of [ "snames", "masop", "masop2", "ignore_rain", "ignore_sn1", "ignore_sn2", "stn_dis", "stn_spe", "stn_grp" ] ) {
			empty[ key ] = [];
		}
		expect( () => parseJn( empty ) ).toThrow( /station names/i );

		const shortNames = fixture( "jn" ) as { snames: string[] };
		shortNames.snames.pop();
		expect( () => parseJn( shortNames ) ).toThrow( /station names/i );

		const boardByte = fixture( "jn" ) as { ignore_rain: number[] };
		boardByte.ignore_rain[ 0 ] = 256;
		expect( () => parseJn( boardByte ) ).toThrow( /per-board/i );

		const group = fixture( "jn" ) as { stn_grp: number[] };
		group.stn_grp[ 0 ] = 4;
		expect( () => parseJn( group ) ).toThrow( /groups/i );

		const longName = fixture( "jn" ) as { maxlen: number; snames: string[] };
		longName.maxlen = 4;
		longName.snames[ 0 ] = "💧💧";
		expect( () => parseJn( longName ) ).toThrow( /maxlen/i );
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
	it( "rejects out-of-range program day/date fields before rendering", () => {
		const raw = fixture( "jp" ) as { pd: unknown[][] };
		raw.pd[ 0 ]![ 1 ] = 1e308;
		expect( () => parseJp( raw ) ).toThrow( /program days/i );
	} );
	it( "requires valid encoded dates whose enable flag matches the program flags", () => {
		for ( const dateRange of [ [ 1, 0, 318 ], [ 1, ( 4 << 5 ) + 31, 318 ], [ 0, 161, 318 ] ] ) {
			const raw = fixture( "jp" ) as { pd: unknown[][] };
			raw.pd[ 0 ]![ 6 ] = dateRange;
			expect( () => parseJp( raw ) ).toThrow( /date.range|date range/i );
		}
		const flagsMismatch = fixture( "jp" ) as { pd: unknown[][] };
		flagsMismatch.pd[ 0 ]![ 0 ] = Number( flagsMismatch.pd[ 0 ]![ 0 ] ) & 0x7f;
		expect( () => parseJp( flagsMismatch ) ).toThrow( /date-range flag/i );
	} );
	it( "rejects missing, fractional, and inconsistent program metadata", () => {
		const missing = fixture( "jp" ) as Record<string, unknown>;
		delete missing.pnsize;
		expect( () => parseJp( missing ) ).toThrow( /pnsize/i );

		const fractional = fixture( "jp" ) as Record<string, unknown>;
		fractional.mnst = 1.5;
		expect( () => parseJp( fractional ) ).toThrow( /mnst/i );
		for ( const mnst of [ 3, 5 ] ) {
			expect( () => parseJp( { ...( fixture( "jp" ) as object ), mnst } ) ).toThrow( /mnst/i );
		}
		expect( () => parseJp( { ...( fixture( "jp" ) as object ), nboards: 26 } ) ).toThrow( /nboards/i );
		expect( () => parseJp( { ...( fixture( "jp" ) as object ), nprogs: 256 } ) ).toThrow( /program count/i );
		expect( () => parseJp( { ...( fixture( "jp" ) as object ), mnp: 0 } ) ).toThrow( /mnp/i );

		const inconsistent = fixture( "jp" ) as Record<string, unknown>;
		inconsistent.nprogs = 2;
		expect( () => parseJp( inconsistent ) ).toThrow( /program count/i );
	} );
	it( "requires exactly four semantically valid start values", () => {
		const valid = fixture( "jp" ) as { pd: unknown[][] };
		valid.pd[ 0 ]![ 3 ] = [ 1440, ( 1 << 14 ) + 2047, -1, -1 ];
		expect( () => parseJp( valid ) ).not.toThrow();

		for ( const starts of [
			[ 0, 0, 0 ], [ 0, 0, 0, 0, 0 ], [ 1.5, 0, 0, 0 ], [ -2, 0, 0, 0 ], [ 32768, 0, 0, 0 ],
			[ 1441, -1, -1, -1 ], [ 2047, -1, -1, -1 ],
			[ ( 1 << 14 ) | ( 1 << 13 ), -1, -1, -1 ], [ ( 1 << 14 ) | ( 1 << 11 ), -1, -1, -1 ],
		] ) {
			const raw = fixture( "jp" ) as { pd: unknown[][] };
			raw.pd[ 0 ]![ 3 ] = starts;
			expect( () => parseJp( raw ) ).toThrow( /start times/i );
		}
		const repeating = fixture( "jp" ) as { pd: unknown[][] };
		repeating.pd[ 0 ]![ 0 ] = Number( repeating.pd[ 0 ]![ 0 ] ) & ~( 1 << 6 );
		repeating.pd[ 0 ]![ 3 ] = [ 390, 4, 60, 0 ];
		expect( () => parseJp( repeating ) ).not.toThrow();
		for ( const starts of [ [ -1, 4, 60, 0 ], [ 390, -1, 60, 0 ], [ 390, 4, 1441, 0 ], [ 390, 4, 60, 1 ] ] ) {
			const raw = fixture( "jp" ) as { pd: unknown[][] };
			raw.pd[ 0 ]![ 0 ] = Number( raw.pd[ 0 ]![ 0 ] ) & ~( 1 << 6 );
			raw.pd[ 0 ]![ 3 ] = starts;
			expect( () => parseJp( raw ) ).toThrow( /start times/i );
		}
	} );
	it( "rejects program tuples with omitted or silently droppable fields", () => {
		for ( const mutate of [
			( tuple: unknown[] ): unknown[] => tuple.slice( 0, 6 ),
			( tuple: unknown[] ): unknown[] => [ ...tuple, { unsupported: true } ],
		] ) {
			const raw = fixture( "jp" ) as { pd: unknown[][] };
			raw.pd[ 0 ] = mutate( raw.pd[ 0 ]! );
			expect( () => parseJp( raw ) ).toThrow( /program tuple/i );
		}
	} );
	it( "requires one uint16 duration per station", () => {
		const valid = fixture( "jp" ) as { pd: unknown[][] };
		( valid.pd[ 0 ]![ 4 ] as number[] )[ 0 ] = 65535;
		expect( () => parseJp( valid ) ).not.toThrow();

		for ( const durations of [
			Array( 7 ).fill( 0 ), Array( 9 ).fill( 0 ), [ 1.5, ...Array( 7 ).fill( 0 ) ],
			[ -1, ...Array( 7 ).fill( 0 ) ], [ 65536, ...Array( 7 ).fill( 0 ) ],
		] ) {
			const raw = fixture( "jp" ) as { pd: unknown[][] };
			raw.pd[ 0 ]![ 4 ] = durations;
			expect( () => parseJp( raw ) ).toThrow( /durations/i );
		}
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
		expect( stationRows.some( ( row ) => typeof row[ 4 ] === "number" ) ).toBe( true );
		// special row's index 1 is the type string
		expect( typeof ( specialRows[ 0 ] as unknown[] )[ 1 ] ).toBe( "string" );
	} );
	it( "rejects a non-array", () => {
		expect( () => parseJl( { not: "an array" } ) ).toThrow( ApiError );
	} );
	it( "rejects a finite but unrepresentable timestamp", () => {
		expect( () => parseJl( [ [ 1, 0, 60, 1e308 ] ] ) ).toThrow( /timestamp/i );
	} );
	it( "accepts historical rain-sensor rows and rejects unknown discriminators", () => {
		expect( parseJl( [ [ 0, "rs", 60, 1 ] ] )[ 0 ]![ 1 ] ).toBe( "rs" );
		expect( () => parseJl( [ [ 0, "xx", 60, 1 ] ] ) ).toThrow( /discriminator/i );
	} );
	it( "enforces station-log uint8/uint16 boundaries", () => {
		expect( () => parseJl( [ [ 255, 255, 65535, 0xffffffff ] ] ) ).not.toThrow();
		expect( parseJl( [ [ 1, 0, -1, 1 ] ] )[ 0 ]![ 2 ] ).toBe( 65535 );
		for ( const row of [
			[ 256, 0, 0, 1 ], [ 0, 256, 0, 1 ], [ 0, 0, 65536, 1 ],
			[ 0, 0, -65536, 1 ], [ 0.5, 0, 0, 1 ], [ 0, 0.5, 0, 1 ], [ 0, 0, 0.5, 1 ],
		] ) expect( () => parseJl( [ row ] ) ).toThrow( ApiError );
	} );
	it( "enforces unsigned 32-bit special-log values and durations", () => {
		expect( () => parseJl( [ [ 0xffffffff, "fl", 0xffffffff, 0xffffffff ] ] ) ).not.toThrow();
		for ( const row of [
			[ -1, "fl", 0, 1 ], [ 0x100000000, "fl", 0, 1 ],
			[ 0, "fl", -1, 1 ], [ 0, "fl", 0x100000000, 1 ],
		] ) expect( () => parseJl( [ row ] ) ).toThrow( ApiError );
	} );
} );

describe( "/js status", () => {
	it( "sn length matches nstations", () => {
		const js = parseJs( fixture( "js" ) );
		expect( js.sn ).toHaveLength( js.nstations );
	} );
	it( "requires a supported count, an exact status count, and binary values", () => {
		expect( parseJs( { sn: Array( 200 ).fill( 0 ), nstations: 200 } ).nstations ).toBe( 200 );
		for ( const raw of [
			{ sn: [], nstations: 0 },
			{ sn: Array( 201 ).fill( 0 ), nstations: 201 },
			{ sn: [ 0 ], nstations: 2 },
			{ sn: [ 0, 2 ], nstations: 2 },
			{ sn: [ 0 ], nstations: 1.5 },
		] ) expect( () => parseJs( raw ) ).toThrow( ApiError );
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

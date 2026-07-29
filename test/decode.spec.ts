/**
 * Decoder unit tests — the firmware program/station bit-logic (the easy-to-get-wrong part).
 * Verified against OpenSprinkler-Firmware program.h/program.cpp/utils.h.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
	formatDuration, formatInterval, getDurationText, decodeEncodedDate,
	decodeOneStartTime, decodeStartTimes, decodeProgramDays, decodeProgram, decodeStationState,
	formatControllerTimestamp,
} from "../www/src/api/decode";
import { parseJc, parseJn, parseJp } from "../www/src/api/client";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}

describe( "formatters", () => {
	it( "formatDuration", () => {
		expect( formatDuration( 5400 ) ).toBe( "1h 30m" );
		expect( formatDuration( 2700 ) ).toBe( "45m" );
		expect( formatDuration( 30 ) ).toBe( "0:30" );
		expect( formatDuration( 0 ) ).toBe( "0:00" );
		expect( formatDuration( 90 ) ).toBe( "1:30" );
	} );
	it( "formatInterval", () => {
		expect( formatInterval( 120 ) ).toBe( "2h" );
		expect( formatInterval( 30 ) ).toBe( "30m" );
		expect( formatInterval( 90 ) ).toBe( "1h 30m" );
	} );
	it( "getDurationText handles solar specials", () => {
		expect( getDurationText( 65534 ) ).toBe( "Sunrise to Sunset" );
		expect( getDurationText( 65535 ) ).toBe( "Sunset to Sunrise" );
		expect( getDurationText( 1800 ) ).toBe( "30m" );
	} );
	it( "decodeEncodedDate = (month<<5)+day", () => {
		expect( decodeEncodedDate( 33 ) ).toBe( "01/01" );    // MIN
		expect( decodeEncodedDate( 415 ) ).toBe( "12/31" );   // MAX (corrected: 12<<5 + 31)
		expect( decodeEncodedDate( 161 ) ).toBe( "05/01" );
		expect( decodeEncodedDate( 318 ) ).toBe( "09/30" );
	} );
	it( "does not throw while formatting corrupt timestamps at a defensive render boundary", () => {
		expect( formatControllerTimestamp( 1e308 ) ).toBe( "Invalid date" );
	} );
} );

describe( "start times", () => {
	it( "standard / sunrise / sunset / unused", () => {
		expect( decodeOneStartTime( 390 ) ).toBe( "6:30 AM" );        // standard 6:30 AM
		expect( decodeOneStartTime( 16384 + 30 ) ).toBe( "Sunrise +30m" );
		expect( decodeOneStartTime( 16384 ) ).toBe( "Sunrise" );      // zero offset
		expect( decodeOneStartTime( 8192 + 4096 + 15 ) ).toBe( "Sunset -15m" ); // sunset, sign bit, 15
		expect( decodeOneStartTime( -1 ) ).toBeNull();               // unused (bit15)
	} );
	it( "fixed mode drops unused slots", () => {
		expect( decodeStartTimes( 0x40, [ 390, 16414, -1, -1 ] ) ).toEqual( [ "6:30 AM", "Sunrise +30m" ] );
	} );
	it( "repeating mode formats start/interval/count", () => {
		expect( decodeStartTimes( 0x00, [ 360, 4, 120, 0 ] ) ).toEqual( [ "from 6:00 AM, every 2h, 4x" ] );
	} );
} );

describe( "program days", () => {
	it( "weekly bit0=Mon..bit6=Sun", () => {
		expect( decodeProgramDays( 0x00, 0b0010101, 0 ) ).toBe( "Mon, Wed, Fri" );
		expect( decodeProgramDays( 0x00, 0b1111111, 0 ) ).toBe( "Every day" );
	} );
	it( "interval uses days1=interval", () => {
		expect( decodeProgramDays( 3 << 4, 0, 3 ) ).toBe( "Every 3 days" );
	} );
	it( "odd/even restriction layered on", () => {
		expect( decodeProgramDays( ( 2 << 2 ), 0b0010101, 0 ) ).toBe( "Mon, Wed, Fri (even days)" );
	} );
	it( "monthly last-day", () => {
		expect( decodeProgramDays( 2 << 4, 0, 0 ) ).toBe( "Last day of month" );
		expect( decodeProgramDays( 2 << 4, 15, 0 ) ).toBe( "Day 15 of month" );
	} );
} );

describe( "decodeProgram (rich fixture)", () => {
	const jp = parseJp( fx( "jp" ) );
	const jn = parseJn( fx( "jn" ) );
	const prog = decodeProgram( jp.pd[ 0 ] as unknown[], jn.snames );
	it( "decodes flags + schedule", () => {
		expect( prog.name ).toBe( "Morning Watering" );
		expect( prog.enabled ).toBe( true );
		expect( prog.useWeather ).toBe( true );
		expect( prog.type ).toBe( "weekly" );
		expect( prog.days ).toBe( "Mon, Wed, Fri" );
		expect( prog.startTimes ).toEqual( [ "6:30 AM", "Sunrise +30m" ] );
		expect( prog.dateRange ).toEqual( { start: "05/01", end: "09/30" } );
	} );
	it( "maps per-station durations incl. solar special", () => {
		const active = prog.perStationDurations.filter( ( d ) => d.seconds > 0 );
		expect( active.map( ( d ) => d.name ) ).toEqual( [ "Front Lawn", "Back Lawn", "Garden Drip" ] );
		expect( active[ 0 ].display ).toBe( "30m" );
		expect( active[ 2 ].display ).toBe( "Sunrise to Sunset" ); // 65534
	} );
} );

describe( "decodeStationState", () => {
	const jc = parseJc( fx( "jc" ) );
	const jn = parseJn( fx( "jn" ) );
	it( "reads on/off via sbits board+bit math", () => {
		expect( decodeStationState( jc, jn, 0 ).on ).toBe( false );
		const s1 = decodeStationState( jc, jn, 1 ); // sbits[0] bit1 set
		expect( s1.on ).toBe( true );
		expect( s1.name ).toBe( "Back Lawn" );
		expect( s1.running ).toBe( true );  // ps[1] = [2,600,..]
	} );
	it( "exposes group from ps[3]", () => {
		expect( decodeStationState( jc, jn, 1 ).group ).toBe( 1 );
	} );
	it( "distinguishes a queued station from an energized output", () => {
		const queued = decodeStationState( { ...jc, sbits: [ 0, 0 ] }, jn, 1 );
		expect( queued.on ).toBe( false );
		expect( queued.running ).toBe( false );
		expect( queued.queued ).toBe( true );
	} );
} );

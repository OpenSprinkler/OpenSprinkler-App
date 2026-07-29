/**
 * Encoder tests — round-trip the write encoders (api/encode.ts) through the decoders (api/decode.ts)
 * so a faithful inverse is proven without a device. Covers start times, program flags/days/dates,
 * the /cp v-array, the /cs station query, and /co option encoding.
 */
import { describe, it, expect } from "vitest";
import {
	encodeStartTime, encodeDate, dateToEpochDays, encodeProgram, programSubmitPath, stationConfigPath,
	setStationBit, escapeJsonForFirmware, optionsPath, encodeUwt, ipOctets, type ProgramInput,
} from "../www/src/api/encode";
import { decodeOneStartTime, decodeProgram, decodeEncodedDate } from "../www/src/api/decode";

describe( "start-time encode ↔ decode", () => {
	it( "round-trips standard, sunrise/sunset (±offset), and unused", () => {
		expect( decodeOneStartTime( encodeStartTime( { kind: "time", minutes: 390 } ) ) ).toBe( "6:30 AM" );
		expect( decodeOneStartTime( encodeStartTime( { kind: "sunrise", offsetMinutes: 30 } ) ) ).toBe( "Sunrise +30m" );
		expect( decodeOneStartTime( encodeStartTime( { kind: "sunrise", offsetMinutes: -15 } ) ) ).toBe( "Sunrise -15m" );
		expect( decodeOneStartTime( encodeStartTime( { kind: "sunset", offsetMinutes: 0 } ) ) ).toBe( "Sunset" );
		expect( decodeOneStartTime( encodeStartTime( { kind: "off" } ) ) ).toBeNull();
	} );
} );

describe( "date encode ↔ decode", () => {
	it( "round-trips (month<<5)+day", () => {
		expect( decodeEncodedDate( encodeDate( 5, 1 ) ) ).toBe( "05/01" );
		expect( decodeEncodedDate( encodeDate( 9, 30 ) ) ).toBe( "09/30" );
	} );
} );

/** Wrap an encoded program into the /jp READ tuple shape so the decoder can verify it. */
function toJpTuple( enc: ReturnType<typeof encodeProgram> ): unknown[] {
	const dr = enc.dateRange ? [ enc.dateRange.enable ? 1 : 0, enc.dateRange.from, enc.dateRange.to ] : [ 0, 0, 0 ];
	return [ enc.v[ 0 ], enc.v[ 1 ], enc.v[ 2 ], enc.v[ 3 ], enc.v[ 4 ], enc.name, dr ];
}

describe( "program encode ↔ decode", () => {
	it( "round-trips a weekly, fixed-time, odd-restricted, date-ranged program", () => {
		const input: ProgramInput = {
			enabled: true, useWeather: true, restriction: "odd",
			schedule: { type: "weekly", weekdays: [ 0, 2, 4 ] }, // Mon, Wed, Fri
			start: { type: "fixed", times: [ { kind: "time", minutes: 390 }, { kind: "sunrise", offsetMinutes: 30 } ] },
			durations: [ 600, 0, 300 ], name: "Morning",
			dateRange: { enable: true, from: encodeDate( 5, 1 ), to: encodeDate( 9, 30 ) },
		};
		const d = decodeProgram( toJpTuple( encodeProgram( input ) ), [ "Front", "Back", "Side" ] );
		expect( d.enabled ).toBe( true );
		expect( d.useWeather ).toBe( true );
		expect( d.type ).toBe( "weekly" );
		expect( d.oddEven ).toBe( "odd" );
		expect( d.days ).toContain( "Mon, Wed, Fri" );
		expect( d.startTimes ).toContain( "6:30 AM" );
		expect( d.startTimes ).toContain( "Sunrise +30m" );
		expect( d.dateRange ).toEqual( { start: "05/01", end: "09/30" } );
		expect( d.perStationDurations.filter( ( x ) => x.seconds > 0 ).length ).toBe( 2 );
		expect( d.name ).toBe( "Morning" );
	} );

	it( "round-trips an interval, repeating-start, disabled program", () => {
		const input: ProgramInput = {
			enabled: false, useWeather: false, restriction: "none",
			schedule: { type: "interval", intervalDays: 3, startingInDays: 1 },
			start: { type: "repeat", first: { kind: "time", minutes: 360 }, count: 4, intervalMinutes: 30 },
			durations: [ 1200 ], name: "Interval",
		};
		const d = decodeProgram( toJpTuple( encodeProgram( input ) ), [ "Zone 1" ] );
		expect( d.enabled ).toBe( false );
		expect( d.type ).toBe( "interval" );
		expect( d.days ).toBe( "Every 3 days (in 1d)" );
		expect( d.startTimes ).toEqual( [ "from 6:00 AM, every 30m, 4x" ] );
		expect( d.dateRange ).toBeNull();
	} );

	it( "round-trips a monthly program (specific day and last-day)", () => {
		const mk = ( dom: number ) => decodeProgram( toJpTuple( encodeProgram( {
			enabled: true, useWeather: false, restriction: "none",
			schedule: { type: "monthly", dayOfMonth: dom },
			start: { type: "fixed", times: [ { kind: "time", minutes: 360 } ] },
			durations: [ 600 ], name: "M",
		} ) ), [ "Z" ] );
		expect( mk( 15 ).type ).toBe( "monthly" );
		expect( mk( 15 ).days ).toBe( "Day 15 of month" );
		expect( mk( 0 ).days ).toBe( "Last day of month" );
	} );

	it( "round-trips a single-run program (epoch day -> date)", () => {
		const epoch = dateToEpochDays( 2024, 6, 9 );
		const d = decodeProgram( toJpTuple( encodeProgram( {
			enabled: true, useWeather: false, restriction: "none",
			schedule: { type: "singlerun", epochDays: epoch },
			start: { type: "fixed", times: [ { kind: "time", minutes: 360 } ] },
			durations: [ 600 ], name: "S",
		} ) ), [ "Z" ] );
		expect( d.type ).toBe( "singlerun" );
		expect( d.days ).toBe( "On 06/09/2024" );
	} );

	it( "builds the /cp submit path (new program, name + date range params)", () => {
		const enc = encodeProgram( {
			enabled: true, useWeather: false, restriction: "none",
			schedule: { type: "weekly", weekdays: [ 0 ] },
			start: { type: "fixed", times: [ { kind: "time", minutes: 360 } ] },
			durations: [ 600 ], name: "P 1",
			dateRange: { enable: true, from: encodeDate( 1, 1 ), to: encodeDate( 12, 31 ) },
		} );
		const path = programSubmitPath( -1, enc );
		expect( path ).toContain( "cp?pid=-1" );
		expect( path ).toContain( "&name=P%201" );
		expect( path ).toContain( "&endr=1" );
		expect( path ).toContain( `&from=${ encodeDate( 1, 1 ) }` );
		expect( path ).toContain( "&v=" );
	} );
} );

describe( "station config encode (/cs)", () => {
	it( "emits per-board attribute bytes, names (spaces->_), and groups", () => {
		const path = stationConfigPath( {
			fwv: 221,
			names: { 0: "Front Lawn" },
			masop: [ 1 ], ignoreRain: [ 5 ], disabled: [ 0 ],
			groups: { 0: 255 },
		} );
		expect( path ).toContain( "cs?" );
		expect( path ).toContain( "s0=Front%20Lawn".replace( "%20", "_" ) ); // fw>=208 underscores spaces
		expect( path ).toContain( "s0=Front_Lawn" );
		expect( path ).toContain( "m0=1" );
		expect( path ).toContain( "i0=5" );
		expect( path ).toContain( "g0=255" );
	} );
	it( "emits all per-board attribute prefixes (n/j/k/p/q/a) and special-station data", () => {
		const path = stationConfigPath( {
			fwv: 221,
			masop2: [ 3 ], ignoreSn1: [ 4 ], ignoreSn2: [ 8 ], special: [ 16 ], sequential: [ 32 ], actRelay: [ 64 ],
			special_: { sid: 2, type: 5, data: "AB CD" },
		} );
		expect( path ).toContain( "n0=3" );
		expect( path ).toContain( "j0=4" );
		expect( path ).toContain( "k0=8" );
		expect( path ).toContain( "p0=16" );
		expect( path ).toContain( "q0=32" );
		expect( path ).toContain( "a0=64" );
		expect( path ).toContain( "sid=2" );
		expect( path ).toContain( "st=5" );
		expect( path ).toContain( "sd=AB%20CD" ); // URL-encoded special data
	} );
	it( "setStationBit flips the right board/bit", () => {
		expect( setStationBit( [ 0 ], 2, true ) ).toEqual( [ 4 ] );        // station 2 -> board0 bit2
		expect( setStationBit( [ 0, 0 ], 9, true ) ).toEqual( [ 0, 2 ] );  // station 9 -> board1 bit1
		expect( setStationBit( [ 5 ], 0, false ) ).toEqual( [ 4 ] );       // clear board0 bit0
	} );
} );

describe( "options encode (/co)", () => {
	it( "builds named-key queries and url-encodes values", () => {
		expect( optionsPath( { wl: 120, uwt: 1 } ) ).toBe( "co?wl=120&uwt=1" );
		expect( optionsPath( { loc: "37.5,-122.3" } ) ).toBe( "co?loc=37.5%2C-122.3" );
	} );
	it( "escapeJsonForFirmware strips the outer braces", () => {
		expect( escapeJsonForFirmware( { en: 1, token: "abc" } ) ).toBe( '"en":1,"token":"abc"' );
	} );
	it( "encodeUwt encodes only the current adjustment-method bits", () => {
		expect( encodeUwt( 1 ) ).toBe( 1 );
		expect( encodeUwt( 0x84 ) ).toBe( 4 );
	} );
	it( "ipOctets splits a dotted quad", () => {
		expect( ipOctets( "192.168.1.100" ) ).toEqual( [ 192, 168, 1, 100 ] );
	} );
	it( "ipOctets rejects wrapping, partial, and junk octets", () => {
		expect( () => ipOctets( "999.-1.nope.4junk" ) ).toThrow( /IPv4|octet/i );
		expect( () => ipOctets( "192.168.1" ) ).toThrow( /four/i );
	} );
} );

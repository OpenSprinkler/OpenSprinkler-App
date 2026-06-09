/**
 * Time-base tests — pins the upstream #287 fix: device times use ONE consistent base (the device's
 * local wall clock), with a non-UTC, DST-active offset so a double-applied (or omitted) tz/DST
 * offset would fail here. See www/src/api/time.ts.
 */
import { describe, it, expect } from "vitest";
import {
	osTzOffsetSeconds, formatClock, formatDeviceTime, formatClockTime, formatMinutesOfDay,
	deviceNowUtc, elapsedSeconds, relativeTime,
} from "../www/src/api/time";

// 2024-01-01T00:00:00Z — clean reference epoch.
const NEW_YEAR_UTC = 1704067200;
// GMT-7 (e.g. US Pacific Daylight Time, DST active): OpenSprinkler tz = (-7+12)*4 = 20.
const TZ_PDT = 20;

describe( "osTzOffsetSeconds (tz = (gmtOffset+12)*4)", () => {
	it( "decodes the OpenSprinkler tz integer to seconds", () => {
		expect( osTzOffsetSeconds( 48 ) ).toBe( 0 );          // UTC
		expect( osTzOffsetSeconds( TZ_PDT ) ).toBe( -25200 ); // GMT-7
		expect( osTzOffsetSeconds( 52 ) ).toBe( 3600 );       // GMT+1
		expect( osTzOffsetSeconds( 44 ) ).toBe( -3600 );      // GMT-1
	} );
} );

describe( "formatClock — raw UTC epoch shown in the device's local wall clock (#287)", () => {
	it( "formats a UTC epoch at UTC unchanged", () => {
		expect( formatClock( NEW_YEAR_UTC, 48 ) ).toBe( "2024-01-01 00:00" );
	} );
	it( "shifts by the device offset exactly once (no double-apply, no DST drift)", () => {
		// GMT-7 → 7 hours earlier, rolling back across the date boundary.
		expect( formatClock( NEW_YEAR_UTC, TZ_PDT ) ).toBe( "2023-12-31 17:00" );
	} );
	it( "is browser-timezone independent (uses UTC components internally)", () => {
		// Equivalent to pre-shifting then formatting as UTC — proves the single, explicit base.
		expect( formatClock( NEW_YEAR_UTC, TZ_PDT ) ).toBe( formatClock( NEW_YEAR_UTC - 25200, 48 ) );
	} );
} );

describe( "formatDeviceTime — devt is ALREADY local; do not re-offset", () => {
	it( "formats devt directly (no second offset application)", () => {
		expect( formatDeviceTime( NEW_YEAR_UTC ) ).toBe( "2024-01-01 00:00" );
	} );
	it( "agrees with the raw-epoch path on the same wall clock (regression guard for the bug)", () => {
		// devt for a GMT-7 device whose true-UTC now is NEW_YEAR_UTC:
		const devt = NEW_YEAR_UTC + osTzOffsetSeconds( TZ_PDT ); // = local-shifted
		expect( formatDeviceTime( devt ) ).toBe( formatClock( deviceNowUtc( devt, TZ_PDT ), TZ_PDT ) );
	} );
} );

describe( "formatClockTime / formatMinutesOfDay", () => {
	it( "renders HH:MM device-local for a raw UTC epoch (rain-delay rdst)", () => {
		expect( formatClockTime( NEW_YEAR_UTC, TZ_PDT ) ).toBe( "17:00" );
	} );
	it( "renders HH:MM from minutes-since-local-midnight (sunrise/sunset)", () => {
		expect( formatMinutesOfDay( 360 ) ).toBe( "06:00" );
		expect( formatMinutesOfDay( 1080 ) ).toBe( "18:00" );
		expect( formatMinutesOfDay( 0 ) ).toBe( "00:00" );
	} );
} );

describe( "elapsedSeconds — devt (local) compared against raw UTC epochs", () => {
	it( "undoes the offset baked into devt before differencing", () => {
		for ( const tz of [ 48, TZ_PDT, 52 ] ) {
			const epoch = 1700000000;
			const devt = epoch + osTzOffsetSeconds( tz ) + 300; // 300s after `epoch`, expressed as device-local
			expect( elapsedSeconds( epoch, devt, tz ) ).toBe( 300 );
		}
	} );
} );

describe( "relativeTime", () => {
	it( "humanizes past and future deltas", () => {
		expect( relativeTime( 0 ) ).toBe( "just now" );
		expect( relativeTime( 30 ) ).toBe( "just now" );
		expect( relativeTime( 60 ) ).toBe( "1 min ago" );
		expect( relativeTime( 600 ) ).toBe( "10 mins ago" );
		expect( relativeTime( 7200 ) ).toBe( "2 hrs ago" );
		expect( relativeTime( 172800 ) ).toBe( "2 days ago" );
		expect( relativeTime( -300 ) ).toBe( "in 5 mins" );
	} );
} );

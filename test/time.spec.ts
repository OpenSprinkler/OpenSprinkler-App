/**
 * Time-base tests — pins the upstream #287 fix: device times use ONE consistent base (the device's
 * local wall clock), with a non-UTC, DST-active offset so a double-applied (or omitted) tz/DST
 * offset would fail here. See www/src/api/time.ts.
 */
import { describe, it, expect } from "vitest";
import {
	osTzOffsetSeconds, formatControllerDate, formatControllerDateTime, formatControllerTime,
	formatDeviceTime, formatMinutesOfDay,
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

describe( "controller-local display — firmware epochs already use the device wall clock (#287)", () => {
	it( "formats dates as MM/DD/YYYY and times on a 12-hour clock", () => {
		expect( formatControllerDate( NEW_YEAR_UTC ) ).toBe( "01/01/2024" );
		expect( formatControllerDateTime( NEW_YEAR_UTC ) ).toBe( "01/01/2024 12:00 AM" );
	} );
	it( "handles noon and midnight correctly", () => {
		expect( formatControllerTime( NEW_YEAR_UTC ) ).toBe( "12:00 AM" );
		expect( formatControllerTime( NEW_YEAR_UTC + 12 * 3600 ) ).toBe( "12:00 PM" );
	} );
	it( "rejects invalid epochs at the render boundary", () => {
		expect( formatControllerDateTime( 1e308 ) ).toBe( "Invalid date" );
		expect( formatControllerTime( Number.NaN ) ).toBe( "Invalid time" );
	} );
} );

describe( "formatDeviceTime — devt is ALREADY local; do not re-offset", () => {
	it( "formats devt directly (no second offset application)", () => {
		expect( formatDeviceTime( NEW_YEAR_UTC ) ).toBe( "01/01/2024 12:00 AM" );
	} );
	it( "renders the shifted wall clock while UTC conversion remains available for storage", () => {
		// devt for a GMT-7 device whose true-UTC now is NEW_YEAR_UTC:
		const devt = NEW_YEAR_UTC + osTzOffsetSeconds( TZ_PDT ); // = local-shifted
		expect( formatDeviceTime( devt ) ).toBe( "12/31/2023 5:00 PM" );
		expect( deviceNowUtc( devt, TZ_PDT ) ).toBe( NEW_YEAR_UTC );
	} );
} );

describe( "formatControllerTime / formatMinutesOfDay", () => {
	it( "renders an already-local rain-delay epoch without applying the offset twice", () => {
		expect( formatControllerTime( NEW_YEAR_UTC ) ).toBe( "12:00 AM" );
	} );
	it( "renders 12-hour time from minutes-since-local-midnight (sunrise/sunset)", () => {
		expect( formatMinutesOfDay( 360 ) ).toBe( "6:00 AM" );
		expect( formatMinutesOfDay( 720 ) ).toBe( "12:00 PM" );
		expect( formatMinutesOfDay( 1080 ) ).toBe( "6:00 PM" );
		expect( formatMinutesOfDay( 0 ) ).toBe( "12:00 AM" );
		expect( formatMinutesOfDay( -1 ) ).toBe( "11:59 PM" );
	} );
} );

describe( "elapsedSeconds — controller-local epochs share one clock domain", () => {
	it( "compares timestamps directly without applying an offset", () => {
		for ( const controllerOffset of [ 0, -25200, 3600 ] ) {
			const epoch = 1700000000 + controllerOffset;
			const devt = epoch + 300;
			expect( elapsedSeconds( epoch, devt ) ).toBe( 300 );
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

/**
 * Settings mapper tests — the pure build*() functions that turn read form values into device
 * command params (the testable contract between the Settings forms and the typed commands).
 */
import { describe, it, expect } from "vitest";
import {
	buildGeneralOptions, isTimezoneAutoManaged, offsetHoursToTz, renderGeneralSettings, tzToOffsetHours,
} from "../www/src/views/settings/general";
import { buildWeatherOptions, renderWeatherConfig } from "../www/src/views/settings/weather";
import { buildNetworkOptions } from "../www/src/views/settings/network";
import { buildStationConfig } from "../www/src/views/settings/stations-edit";
import { buildProgramInput, parseClock, parseDate, parseStartTime, renderProgramEditor } from "../www/src/views/settings/program-edit";
import { encodeProgram, encodeDate } from "../www/src/api/encode";
import { decodeProgram } from "../www/src/api/decode";
import { renderSystemSettings } from "../www/src/views/settings/system";

describe( "system settings", () => {
	it( "offers only the secret-safe read-only export path", () => {
		const html = renderSystemSettings(
			{ otcs: 3 } as never,
			{ fwv: 221, fwm: 4, fwf: "kars85.3", hwv: 30 } as never,
		);
		expect( html ).toContain( "221/4 · kars85.3" );
		expect( html ).toContain( "Connected" );
		expect( html ).toContain( 'data-action="config-export"' );
		expect( html ).toContain( "Passwords, tokens, provider keys" );
		expect( html ).not.toMatch( /data-action="[^\"]*import/i );
	} );
} );

describe( "general options", () => {
	it( "maps form values to named /co params (tz from GMT offset; dname on fw>=2191)", () => {
		expect( buildGeneralOptions( {
			dname: "Yard", tzOffset: "-8", wl: "120", sdt: "10", lg: true, sn1t: "1", sn1o: false,
		}, 2214 ) ).toEqual( { dname: "Yard", tz: offsetHoursToTz( -8 ), wl: 120, sdt: 10, lg: 1, sn1t: 1, sn1o: 0 } );
	} );
	it( "tz helpers round-trip (UTC and a fractional offset)", () => {
		expect( offsetHoursToTz( 0 ) ).toBe( 48 );
		expect( tzToOffsetHours( 48 ) ).toBe( 0 );
		expect( offsetHoursToTz( 5.5 ) ).toBe( 70 );        // GMT+5:30
		expect( tzToOffsetHours( 70 ) ).toBe( 5.5 );
	} );
	it( "omits a blank device name", () => {
		expect( buildGeneralOptions( { dname: "", tzOffset: "0", wl: "100", sdt: "0", lg: false, sn1t: "0", sn1o: false }, 2214 ) )
			.not.toHaveProperty( "dname" );
	} );
	it( "omits the device name on firmware older than 2191", () => {
		expect( buildGeneralOptions( { dname: "Yard", tzOffset: "0", wl: "100", sdt: "0", lg: false, sn1t: "0", sn1o: false }, 2190 ) )
			.not.toHaveProperty( "dname" );
	} );
	it( "accepts quarter-hour timezones and signed station overlap", () => {
		expect( buildGeneralOptions( {
			tzOffset: "5.75", wl: "250", sdt: "-600", lg: false, sn1t: "240", sn1o: true,
		} ) ).toMatchObject( { tz: 71, wl: 250, sdt: -600, sn1t: 240, sn1o: 1 } );
		expect( buildGeneralOptions( {
			tzOffset: "15", wl: "100", sdt: "0", lg: false, sn1t: "0", sn1o: false,
		} ).tz ).toBe( 108 );
	} );
	it( "disables and omits timezone while Location manages it", () => {
		expect( isTimezoneAutoManaged( "37.5,-122.3" ) ).toBe( true );
		expect( isTimezoneAutoManaged( "''" ) ).toBe( false );
		const html = renderGeneralSettings( { tz: 48, wl: 100, sdt: 0, lg: 1, sn1t: 0, sn1o: 0 } as never, "", "37.5,-122.3" );
		expect( html ).toMatch( /name="tzOffset"[^>]*disabled/ );
		expect( html ).toContain( "Automatically maintained from Location" );
		const out = buildGeneralOptions( {
			tzOffset: "-8", wl: "100", sdt: "0", lg: true, sn1t: "0", sn1o: false,
		}, 2214, false );
		expect( out ).not.toHaveProperty( "tz" );
	} );
	it( "rejects malformed or out-of-range numeric options", () => {
		const base = { tzOffset: "0", wl: "100", sdt: "0", lg: false, sn1t: "0", sn1o: false };
		for ( const [ field, value ] of [
			[ "tzOffset", "5.1" ], [ "tzOffset", "15.25" ], [ "tzOffset", "5junk" ],
			[ "wl", "1.5" ], [ "wl", "251" ], [ "sdt", "-601" ], [ "sdt", "1e2" ], [ "sdt", "7" ],
			[ "sn1t", "4" ], [ "sn1t", "241" ],
		] ) {
			expect( () => buildGeneralOptions( { ...base, [ field ]: value } ) ).toThrow();
		}
	} );
	it( "enforces the device-name UTF-8 byte limit", () => {
		const base = { tzOffset: "0", wl: "100", sdt: "0", lg: false, sn1t: "0", sn1o: false };
		expect( buildGeneralOptions( { ...base, dname: "💧".repeat( 32 ) }, 2191 ).dname ).toBe( "💧".repeat( 32 ) );
		expect( () => buildGeneralOptions( { ...base, dname: "💧".repeat( 33 ) }, 2191 ) ).toThrow( /128 UTF-8 bytes/i );
	} );
} );

describe( "weather options", () => {
	it( "keeps uwt to the method and writes current restriction fields into wto", () => {
		const out = buildWeatherOptions(
			{
				method: "1", loc: "37,-122", provider: "OWM", key: "abc",
				rainAmt: "0.5", rainDays: "2", minTemp: "35", cali: true,
			},
			{ scales: [ 100, 100 ] },
			2213,
		);
		expect( out.uwt ).toBe( 1 );
		expect( out.loc ).toBe( "37,-122" );
		expect( out.wto ).toContain( '"scales":[100,100]' ); // preserved
		expect( out.wto ).toContain( '"provider":"OWM"' );
		expect( out.wto ).toContain( '"key":"abc"' );
		expect( out.wto ).toContain( '"rainAmt":0.5' );
		expect( out.wto ).toContain( '"rainDays":2' );
		expect( out.wto ).toContain( '"minTemp":35' );
		expect( out.wto ).toContain( '"cali":1' );
	} );
	it( "does not synthesize the removed uwt restriction bit on older firmware", () => {
		const out = buildWeatherOptions( { method: "4", restriction: true }, { rainDays: 3 }, 2210 );
		expect( out.uwt ).toBe( 4 );
		expect( out.wto ).toContain( '"rainDays":3' );
	} );
	it( "underscores spaces in loc for fw>=208 and omits a blank loc", () => {
		expect( buildWeatherOptions( { method: "0", loc: "New York, NY" }, {}, 221 ).loc ).toBe( "New_York,_NY" );
		expect( buildWeatherOptions( { method: "0", loc: "" }, {}, 221 ) ).not.toHaveProperty( "loc" );
	} );
	it( "renders an explicit Location clear action and normalizes the firmware unset sentinel", () => {
		const jo = { uwt: 1, fwv: 221, fwm: 3 } as never;
		const configured = renderWeatherConfig( jo, {
			loc: "37.5,-122.3", wto: { mda: 100 },
		} as never );
		expect( configured ).toContain( 'name="clearLoc"' );
		expect( configured ).toContain( "manage timezone manually" );
		expect( configured ).toMatch( /name="mda" checked/ );
		expect( configured ).toContain( 'data-weather-methods="1,3"' );

		const cleared = renderWeatherConfig( jo, { loc: "''", wto: { mda: 100 } } as never );
		expect( cleared ).toContain( 'name="loc" value=""' );
		expect( cleared ).not.toContain( 'name="clearLoc"' );
	} );
	it( "clears Location only through the explicit checkbox sentinel", () => {
		const out = buildWeatherOptions( {
			method: "0", loc: "37.5,-122.3", clearLoc: true,
			rainAmt: "0", rainDays: "0", minTemp: "-40", cali: false,
		}, { provider: "OWM" }, 2213 );
		expect( out.loc ).toBe( "''" );
		expect( out.wto ).toContain( '"provider":"OWM"' );
		expect( () => buildWeatherOptions( { method: "0", clearLoc: "false" }, {}, 2210 ) ).toThrow( /checkbox value/i );
	} );
	it( "edits multi-day adjustment only for supported methods and preserves the rest of wto", () => {
		const fields = { rainAmt: "0", rainDays: "0", minTemp: "-40", cali: false };
		const enabled = buildWeatherOptions( { ...fields, method: "1", mda: true }, { provider: "OWM", extra: 7 }, 2213 );
		expect( enabled.wto ).toContain( '"mda":100' );
		expect( enabled.wto ).toContain( '"extra":7' );
		const disabled = buildWeatherOptions( { ...fields, method: "3", mda: false }, { mda: 100 }, 2213 );
		expect( disabled.wto ).toContain( '"mda":0' );

		const inactive = buildWeatherOptions( { ...fields, method: "4", mda: false }, { mda: 100 }, 2213 );
		expect( inactive.wto ).toContain( '"mda":100' );
		const omitted = buildWeatherOptions( { ...fields, method: "1" }, { mda: 100 }, 2213 );
		expect( omitted.wto ).toContain( '"mda":100' );
		const oldFirmware = buildWeatherOptions( { method: "1", mda: false }, { mda: 100 }, 2210 );
		expect( oldFirmware.wto ).toContain( '"mda":100' );
	} );
} );

describe( "network options", () => {
	it( "splits the HTTP port and the static address octets when DHCP is off", () => {
		const out = buildNetworkOptions( {
			dhcp: false, ip: "192.168.1.50", gw: "192.168.1.1", dns: "8.8.8.8", subnet: "255.255.255.0",
			port: "8080", ntp: true, ntpServer: "129.6.15.28",
		} );
		expect( out ).toMatchObject( {
			dhcp: 0, ntp: 1, hp0: 8080 & 0xff, hp1: ( 8080 >> 8 ) & 0xff,
			ip1: 192, ip2: 168, ip3: 1, ip4: 50, gw1: 192, gw4: 1, dns1: 8, subn1: 255, subn4: 0,
			ntp1: 129, ntp4: 28,
		} );
	} );
	it( "omits static octets when DHCP is on", () => {
		const out = buildNetworkOptions( { dhcp: true, ip: "192.168.1.50", port: "80", ntp: false } );
		expect( out ).not.toHaveProperty( "ip1" );
		expect( out.dhcp ).toBe( 1 );
	} );
	it( "rejects invalid ports and IPv4 octets rather than wrapping them", () => {
		expect( () => buildNetworkOptions( { dhcp: true, port: "70000", ntp: false } ) ).toThrow( /port/i );
		expect( () => buildNetworkOptions( {
			dhcp: false, ip: "999.-1.nope.4junk", gw: "192.168.1.1", subnet: "255.255.255.0", port: "80", ntp: false,
		} ) ).toThrow( /Static IP/i );
	} );
} );

describe( "station config", () => {
	it( "builds per-board attribute bytes + names + groups (fw220+)", () => {
		const cfg = buildStationConfig( {
			name_0: "Front", name_1: "Back",
			dis_0: false, dis_1: true, rain_0: true, rain_1: false, grp_0: "0", grp_1: "255",
		}, 2, 221 );
		expect( cfg.names ).toEqual( { 0: "Front", 1: "Back" } );
		expect( cfg.disabled ).toEqual( [ 2 ] );    // station 1 disabled -> bit1
		expect( cfg.ignoreRain ).toEqual( [ 1 ] );  // station 0 ignores rain -> bit0
		expect( cfg.groups ).toEqual( { 0: 0, 1: 255 } );
		expect( cfg.fwv ).toBe( 221 );
	} );
	it( "omits groups on firmware < 220", () => {
		const cfg = buildStationConfig( { name_0: "A", dis_0: false, rain_0: false }, 1, 219 );
		expect( cfg.groups ).toBeUndefined();
	} );
	it( "enforces station-count, firmware, and name-limit metadata", () => {
		for ( const [ count, fwv, maxNameBytes ] of [
			[ -1, 221, 32 ], [ 1.5, 221, 32 ], [ 201, 221, 32 ],
			[ 0, 0, 32 ], [ 0, 10000, 32 ], [ 0, 221, 0 ], [ 0, 221, 256 ],
		] ) expect( () => buildStationConfig( {}, count, fwv, maxNameBytes ) ).toThrow( /invalid/i );
		expect( buildStationConfig( {}, 0, 9999, 255 ).names ).toEqual( {} );
		const maxStations: Record<string, string> = {};
		for ( let sid = 0; sid < 200; sid++ ) {
			maxStations[ `name_${ sid }` ] = `S${ sid + 1 }`;
			maxStations[ `grp_${ sid }` ] = "0";
		}
		expect( buildStationConfig( maxStations, 200, 221 ).disabled ).toHaveLength( 25 );
	} );
	it( "requires every station name and enforces its UTF-8 byte limit", () => {
		expect( () => buildStationConfig( {}, 1, 221, 8 ) ).toThrow( /needs a name/i );
		expect( buildStationConfig( { name_0: "💧💧", grp_0: "0" }, 1, 221, 8 ).names ).toEqual( { 0: "💧💧" } );
		expect( () => buildStationConfig( { name_0: "💧💧💧", grp_0: "0" }, 1, 221, 8 ) ).toThrow( /8 UTF-8 bytes/i );
	} );
	it( "accepts only firmware-supported station groups", () => {
		for ( const group of [ "0", "1", "2", "3", "255" ] ) {
			expect( buildStationConfig( { name_0: "A", grp_0: group }, 1, 221 ).groups ).toEqual( { 0: Number( group ) } );
		}
		for ( const group of [ "", "-1", "4", "254", "255junk" ] ) {
			expect( () => buildStationConfig( { name_0: "A", grp_0: group }, 1, 221 ) ).toThrow( /invalid group/i );
		}
	} );
} );

describe( "checkbox form validation", () => {
	it( "rejects string truthiness at representative settings write boundaries", () => {
		expect( () => buildGeneralOptions( {
			tzOffset: "0", wl: "100", sdt: "0", lg: "false", sn1t: "0", sn1o: false,
		} ) ).toThrow( /checkbox value/i );
		expect( () => buildNetworkOptions( { dhcp: "false", ntp: false, port: "80" } ) ).toThrow( /checkbox value/i );
		expect( () => buildWeatherOptions( {
			method: "0", rainAmt: "0", rainDays: "0", minTemp: "0", cali: "false",
		}, {}, 2213 ) ).toThrow( /checkbox value/i );
		expect( () => buildStationConfig( {
			name_0: "A", dis_0: "false", rain_0: false, grp_0: "0",
		}, 1, 221 ) ).toThrow( /checkbox value/i );
		expect( () => buildProgramInput( {
			enabled: "false", schedType: "weekly", wd_0: true,
			startType: "fixed", t_0: "6:00 AM", dur_0: "5",
		}, 1 ) ).toThrow( /checkbox value/i );
	} );
} );

describe( "program editor mapper", () => {
	it( "rejects station counts that cannot be represented on the wire", () => {
		for ( const count of [ 0, 1.5, 201 ] ) {
			expect( () => buildProgramInput( {}, count ) ).toThrow( /invalid station count/i );
		}
		const max = buildProgramInput( {
			schedType: "weekly", wd_0: true, startType: "fixed", t_0: "6:00 AM", dur_0: "5",
		}, 200 );
		expect( max.durations ).toHaveLength( 200 );
	} );
	it( "parseClock accepts 12-hour values and rejects 24-hour or overflow input", () => {
		expect( parseClock( "6:30 AM" ) ).toBe( 390 );
		expect( parseClock( "12:00 AM" ) ).toBe( 0 );
		expect( parseClock( "12:00 PM" ) ).toBe( 720 );
		expect( parseClock( "6:30 PM" ) ).toBe( 1110 );
		expect( parseClock( "06:30" ) ).toBeNull();
		expect( parseClock( "24:00" ) ).toBeNull();
		expect( parseClock( "99:99" ) ).toBeNull();
		expect( parseClock( "nope" ) ).toBeNull();
	} );
	it( "parses sunrise/sunset starts without flattening them to a wall clock", () => {
		expect( parseStartTime( "Sunrise +30m" ) ).toEqual( { kind: "sunrise", offsetMinutes: 30 } );
		expect( parseStartTime( "Sunset -15m" ) ).toEqual( { kind: "sunset", offsetMinutes: -15 } );
		expect( parseStartTime( "Sunset" ) ).toEqual( { kind: "sunset", offsetMinutes: 0 } );
		expect( parseStartTime( "Sunrise +2048m" ) ).toBeNull();
	} );
	it( "strictly validates calendar dates instead of normalizing overflow", () => {
		expect( parseDate( "02/28/2026" ) ).toEqual( { year: 2026, month: 2, day: 28 } );
		expect( parseDate( "02/29/2024" ) ).toEqual( { year: 2024, month: 2, day: 29 } );
		expect( parseDate( "02/30/2026" ) ).toBeNull();
		expect( parseDate( "99/99/2026" ) ).toBeNull();
		expect( parseDate( "2026-02-28" ) ).toBeNull();
	} );
	it( "rejects an invalid active single-run date or start time", () => {
		expect( () => buildProgramInput( {
			schedType: "singlerun", singleDate: "02/30/2026", startType: "fixed", t_0: "6:00 AM", dur_0: "5",
		}, 1 ) ).toThrow( /single-run date/i );
		expect( () => buildProgramInput( {
			schedType: "singlerun", singleDate: "12/31/2149", startType: "fixed", t_0: "6:00 AM", dur_0: "5",
		}, 1 ) ).toThrow( /06\/06\/2149/i );
		expect( () => buildProgramInput( {
			schedType: "weekly", wd_0: true, startType: "fixed", t_0: "99:99 PM", dur_0: "5",
		}, 1 ) ).toThrow( /start time/i );
	} );
	it( "builds a ProgramInput that survives encode→decode", () => {
		const input = buildProgramInput( {
			name: "Morning", enabled: true, useWeather: true, restriction: "odd",
			schedType: "weekly", wd_0: true, wd_2: true, wd_4: true,
			startType: "fixed", t_0: "6:00 AM", t_1: "", t_2: "", t_3: "",
			dur_0: "10", dur_1: "0",
		}, 2 );
		expect( input.durations ).toEqual( [ 600, 0 ] );
		expect( input.restriction ).toBe( "odd" );
		const enc = encodeProgram( input );
		const d = decodeProgram(
			[ enc.v[ 0 ], enc.v[ 1 ], enc.v[ 2 ], enc.v[ 3 ], enc.v[ 4 ], enc.name, [ 0, 0, 0 ] ],
			[ "Front", "Back" ],
		);
		expect( d.type ).toBe( "weekly" );
		expect( d.days ).toContain( "Mon, Wed, Fri" );
		expect( d.startTimes ).toContain( "6:00 AM" );
		expect( d.name ).toBe( "Morning" );
	} );
	it( "populates the date range when useDateRange + drFrom/drTo are set", () => {
		const input = buildProgramInput( {
			name: "Seasonal", enabled: true, useWeather: false, restriction: "none",
			schedType: "weekly", wd_0: true, startType: "fixed", t_0: "6:00 AM",
			useDateRange: true, drFrom: "05/01/2024", drTo: "09/30/2024", dur_0: "10",
		}, 1 );
		expect( input.dateRange ).toEqual( { enable: true, from: encodeDate( 5, 1 ), to: encodeDate( 9, 30 ) } );
	} );
	it( "accepts exact-second and named solar durations", () => {
		const input = buildProgramInput( {
			schedType: "weekly", wd_0: true, startType: "fixed", t_0: "Sunrise -15m",
			durMode_0: "seconds", dur_0: "61",
			durMode_1: "sunrise-sunset", dur_1: "0",
			durMode_2: "sunset-sunrise", dur_2: "0",
		}, 3 );
		expect( input.start ).toEqual( { type: "fixed", times: [
			{ kind: "sunrise", offsetMinutes: -15 }, { kind: "off" }, { kind: "off" }, { kind: "off" },
		] } );
		expect( input.durations ).toEqual( [ 61, 65534, 65535 ] );
	} );
	it( "enforces firmware interval invariants and requires a station run time", () => {
		const base = {
			schedType: "interval", intervalDays: "2", startingInDays: "0",
			startType: "fixed", t_0: "6:00 AM", dur_0: "5",
		};
		expect( () => buildProgramInput( { ...base, startingInDays: "2" }, 1, 2200 ) ).toThrow( /less than the interval/i );
		expect( () => buildProgramInput( { ...base, intervalDays: "1" }, 1, 2198 ) ).toThrow( /between 2 and 255/i );
		expect( buildProgramInput( { ...base, intervalDays: "1" }, 1, 2199 ).schedule ).toMatchObject( { intervalDays: 1 } );
		expect( buildProgramInput( { ...base, intervalDays: "255", startingInDays: "254" }, 1, 2199 ).schedule )
			.toEqual( { type: "interval", intervalDays: 255, startingInDays: 254 } );
		expect( () => buildProgramInput( { ...base, dur_0: "0" }, 1, 2200 ) ).toThrow( /at least one station/i );
	} );
	it( "renders and enforces the firmware's program-name byte limit", () => {
		const jn = { snames: [ "Front" ] } as never;
		const html = renderProgramEditor( jn, 221, 8 );
		expect( html ).toContain( 'maxlength="8"' );
		expect( html ).toContain( 'placeholder="MM/DD/YYYY"' );
		expect( html ).toContain( 'value="6:00 AM"' );
		expect( html ).not.toContain( 'type="date"' );
		expect( html ).not.toContain( 'type="time"' );
		const base = {
			schedType: "weekly", wd_0: true, startType: "fixed", t_0: "6:00 AM", dur_0: "5",
		};
		expect( () => buildProgramInput( { ...base, name: "123456789" }, 1, 2210, 8 ) ).toThrow( /at most 8/i );
		expect( () => buildProgramInput( { ...base, name: "💧💧💧" }, 1, 2210, 8 ) ).toThrow( /at most 8/i );
	} );
	it( "prefills an existing raw tuple, including solar starts, durations, and annual range", () => {
		const jn = { snames: [ "Front", "Back", "Lights" ] } as never;
		const program = [
			195, 21, 0, [ 390, 16414, -1, -1 ], [ 1800, 61, 65534 ], "Morning Watering",
			[ 1, encodeDate( 5, 1 ), encodeDate( 9, 30 ) ],
		] as const;
		const html = renderProgramEditor( jn, 221, 32, program as never, 0 );
		expect( html ).toContain( "Edit Program" );
		expect( html ).toContain( 'data-pid="0"' );
		expect( html ).toContain( 'name="name" value="Morning Watering"' );
		expect( html ).toMatch( /name="enabled" checked/ );
		expect( html ).toContain( 'name="t_1" value="Sunrise +30m"' );
		expect( html ).toMatch( /value="seconds" selected/ );
		expect( html ).toMatch( /value="sunrise-sunset" selected/ );
		expect( html ).toContain( 'name="drFrom" value="05\/01\/2000"' );
		expect( html ).toContain( 'name="drTo" value="09\/30\/2000"' );
		expect( html ).not.toMatch( /name="dur_2"[^>]*value="65534"/ );
	} );
	it( "keeps repeat metadata out of fixed-time fields when changing start modes", () => {
		const jn = { snames: [ "Front" ] } as never;
		const repeating = [ 0, 1, 0, [ 360, 3, 60, 0 ], [ 60 ], "Repeating", [ 0, 33, 415 ] ] as never;
		const repeatHtml = renderProgramEditor( jn, 221, 32, repeating, 0 );
		expect( repeatHtml ).toContain( 'name="repeatCount" value="3"' );
		expect( repeatHtml ).toContain( 'name="repeatInterval" value="60"' );
		expect( repeatHtml ).toContain( 'name="t_1" value=""' );
		expect( repeatHtml ).not.toContain( 'name="t_1" value="12:03 AM"' );

		const fixed = [ 64, 1, 0, [ 390, -1, -1, -1 ], [ 60 ], "Fixed", [ 0, 33, 415 ] ] as never;
		const fixedHtml = renderProgramEditor( jn, 221, 32, fixed, 0 );
		expect( fixedHtml ).toContain( 'name="repeatFirst" value="6:30 AM"' );
	} );
} );

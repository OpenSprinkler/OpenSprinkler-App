/**
 * Settings mapper tests — the pure build*() functions that turn read form values into device
 * command params (the testable contract between the Settings forms and the typed commands).
 */
import { describe, it, expect } from "vitest";
import { buildGeneralOptions, offsetHoursToTz, tzToOffsetHours } from "../www/src/views/settings/general";
import { buildWeatherOptions } from "../www/src/views/settings/weather";
import { buildNetworkOptions } from "../www/src/views/settings/network";
import { buildStationConfig } from "../www/src/views/settings/stations-edit";
import { buildProgramInput, parseClock } from "../www/src/views/settings/program-edit";
import { encodeProgram, encodeDate } from "../www/src/api/encode";
import { decodeProgram } from "../www/src/api/decode";

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
} );

describe( "weather options", () => {
	it( "packs uwt method+restriction and merges provider/key into existing wto", () => {
		const out = buildWeatherOptions(
			{ method: "1", restriction: true, loc: "37,-122", provider: "OWM", key: "abc" },
			{ scales: [ 100, 100 ] },
		);
		expect( out.uwt ).toBe( 1 | 0x80 );
		expect( out.loc ).toBe( "37,-122" );
		expect( out.wto ).toContain( '"scales":[100,100]' ); // preserved
		expect( out.wto ).toContain( '"provider":"OWM"' );
		expect( out.wto ).toContain( '"key":"abc"' );
	} );
	it( "underscores spaces in loc for fw>=208 and omits a blank loc", () => {
		expect( buildWeatherOptions( { method: "0", loc: "New York, NY" }, {}, 221 ).loc ).toBe( "New_York,_NY" );
		expect( buildWeatherOptions( { method: "0", loc: "" }, {}, 221 ) ).not.toHaveProperty( "loc" );
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
} );

describe( "program editor mapper", () => {
	it( "parseClock handles HH:MM, midnight wrap, and invalid", () => {
		expect( parseClock( "06:30" ) ).toBe( 390 );
		expect( parseClock( "24:00" ) ).toBe( 0 );
		expect( parseClock( "nope" ) ).toBeNull();
	} );
	it( "builds a ProgramInput that survives encode→decode", () => {
		const input = buildProgramInput( {
			name: "Morning", enabled: true, useWeather: true, restriction: "odd",
			schedType: "weekly", wd_0: true, wd_2: true, wd_4: true,
			startType: "fixed", t_0: "06:00", t_1: "", t_2: "", t_3: "",
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
		expect( d.startTimes ).toContain( "06:00" );
		expect( d.name ).toBe( "Morning" );
	} );
	it( "populates the date range when useDateRange + drFrom/drTo are set", () => {
		const input = buildProgramInput( {
			name: "Seasonal", enabled: true, useWeather: false, restriction: "none",
			schedType: "weekly", wd_0: true, startType: "fixed", t_0: "06:00",
			useDateRange: true, drFrom: "2024-05-01", drTo: "2024-09-30", dur_0: "10",
		}, 1 );
		expect( input.dateRange ).toEqual( { enable: true, from: encodeDate( 5, 1 ), to: encodeDate( 9, 30 ) } );
	} );
} );

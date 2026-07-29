// test/server/config.spec.ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../../server/config";

const base = { CONTROLLER_BASE: "http://10.0.0.5/" };

describe( "loadConfig", () => {
	it( "applies defaults and requires CONTROLLER_BASE", () => {
		const c = loadConfig( base );
		expect( c.controllerBase ).toBe( "http://10.0.0.5/" );
		expect( c.pollIntervalSec ).toBe( 300 );
		expect( c.historyMaxDays ).toBe( 90 );
		expect( c.logBackfillDays ).toBe( 2 );
		expect( c.port ).toBe( 8080 );
		expect( c.listenHost ).toBe( "127.0.0.1" );
		expect( c.databasePath ).toBe( "/data/data.db" );
		expect( c.controllerTimeoutMs ).toBe( 10000 );
		expect( c.apiAllowedOrigins ).toEqual( [ "http://10.0.0.5" ] );
	} );
	it( "throws fast when CONTROLLER_BASE is missing", () => {
		expect( () => loadConfig( {} ) ).toThrow( /CONTROLLER_BASE/ );
	} );
	it( "parses overrides", () => {
		const c = loadConfig( {
			...base, POLL_INTERVAL_SEC: "60", PORT: "9000", LISTEN_HOST: "0.0.0.0", CONTROLLER_ID: "house",
		} );
		expect( c.pollIntervalSec ).toBe( 60 );
		expect( c.port ).toBe( 9000 );
		expect( c.listenHost ).toBe( "0.0.0.0" );
		expect( c.controllerId ).toBe( "house" );
	} );

	it.each( [ "127.0.0.1", "0.0.0.0", "::1", "::" ] )( "accepts safe LISTEN_HOST=%s", ( value ) => {
		expect( loadConfig( { ...base, LISTEN_HOST: value } ).listenHost ).toBe( value );
	} );

	it.each( [ "localhost", "192.168.1.20", "example.com", "[::1]", "127.0.0.1:8080" ] )(
		"rejects LISTEN_HOST=%s outside the loopback/wildcard literals", ( value ) => {
			expect( () => loadConfig( { ...base, LISTEN_HOST: value } ) ).toThrow( /LISTEN_HOST/ );
		},
	);

	it.each( [
		[ "POLL_INTERVAL_SEC", "0" ], [ "POLL_INTERVAL_SEC", "1junk" ],
		[ "HISTORY_MAX_DAYS", "-1" ], [ "LOG_BACKFILL_DAYS", "1.5" ],
		[ "PORT", "65536" ], [ "CONTROLLER_TIMEOUT_MS", "99" ],
	] )( "rejects invalid %s=%s", ( key, value ) => {
		expect( () => loadConfig( { ...base, [ key ]: value } ) ).toThrow( key );
	} );

	it( "validates URL, storage, API origins, and token", () => {
		expect( () => loadConfig( { CONTROLLER_BASE: "file:///tmp/device" } ) ).toThrow( /http or https/ );
		expect( () => loadConfig( { ...base, STORAGE: "postgres" } ) ).toThrow( /STORAGE/ );
		expect( () => loadConfig( { ...base, API_ALLOWED_ORIGINS: "not-an-origin" } ) ).toThrow( /API_ALLOWED_ORIGINS/ );
		expect( () => loadConfig( { ...base, API_TOKEN: "short" } ) ).toThrow( /API_TOKEN/ );
		const c = loadConfig( {
			CONTROLLER_BASE: "https://controller.example/path",
			API_ALLOWED_ORIGINS: "https://ui.example,http://192.168.1.2",
			API_TOKEN: "0123456789abcdef",
		} );
		expect( c.controllerBase ).toBe( "https://controller.example/path/" );
		expect( c.apiAllowedOrigins ).toEqual( [ "https://ui.example", "http://192.168.1.2" ] );
		expect( loadConfig( { ...base, API_TOKEN: "" } ).apiToken ).toBeUndefined();
	} );

	it.each( [
		"01234567\n89abcdef", "0123456789abcde ", "0123456789abcdeé", "x".repeat( 513 ),
	] )( "rejects an HTTP-header-unsafe API token", ( token ) => {
		expect( () => loadConfig( { ...base, API_TOKEN: token } ) ).toThrow( /visible ASCII/i );
	} );
} );

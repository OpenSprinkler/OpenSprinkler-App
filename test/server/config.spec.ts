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
		expect( c.databasePath ).toBe( "/data/data.db" );
	} );
	it( "throws fast when CONTROLLER_BASE is missing", () => {
		expect( () => loadConfig( {} ) ).toThrow( /CONTROLLER_BASE/ );
	} );
	it( "parses overrides", () => {
		const c = loadConfig( { ...base, POLL_INTERVAL_SEC: "60", PORT: "9000", CONTROLLER_ID: "house" } );
		expect( c.pollIntervalSec ).toBe( 60 );
		expect( c.port ).toBe( 9000 );
		expect( c.controllerId ).toBe( "house" );
	} );
} );

/**
 * Fork build-tag tests (GitHub #3) — the kars85 firmware fork emits `fwf` (a string) in /jo; the
 * About/Status version line appends " +<fwf>", guarded so official firmware (no fwf) shows nothing.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJc, parseJo, deriveCapabilities, getForkTag } from "../www/src/api/client";
import { renderControllerStatus } from "../www/src/spike/status-view";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jc = parseJc( fx( "jc" ) );
const jo = parseJo( fx( "jo" ) );
const caps = deriveCapabilities( jc, jo );

describe( "getForkTag", () => {
	it( "returns a guarded ' +<fwf>' suffix when fwf is a non-empty string", () => {
		expect( getForkTag( { fwf: "kars85.3" } ) ).toBe( " +kars85.3" );
	} );
	it( "returns '' for official firmware (fwf absent)", () => {
		expect( getForkTag( {} ) ).toBe( "" );
	} );
	it( "returns '' for an empty fwf string", () => {
		expect( getForkTag( { fwf: "" } ) ).toBe( "" );
	} );
} );

describe( "status view firmware line", () => {
	it( "appends the fork tag after the version when fwf is present", () => {
		const html = renderControllerStatus( jc, { ...jo, fwf: "kars85.3" }, caps );
		expect( html ).toContain( "2.2.1 (4) +kars85.3" );
	} );
	it( "omits the fork suffix on official firmware", () => {
		const html = renderControllerStatus( jc, jo, caps );
		expect( html ).toContain( "2.2.1 (4)" );
		expect( html ).not.toContain( "+kars85" );
	} );
} );

describe( "status view weather restriction (#290)", () => {
	it( "uses the full 'Weather restriction' label with an inline tooltip", () => {
		const html = renderControllerStatus( jc, jo, caps );
		expect( html ).toContain( "Weather restriction" );
		expect( html ).not.toContain( "Weather Restri." ); // the truncated legacy label
		expect( html ).toContain( "Watering is paused by a weather rule" ); // helpTip text
	} );
	it( "shows 'Restricted' when a weather rule is active, 'None' otherwise", () => {
		const restricted = parseJc( { ...( fx( "jc" ) as object ), wtrestr: 1 } );
		expect( renderControllerStatus( restricted, jo, deriveCapabilities( restricted, jo ) ) ).toContain( "Restricted" );
		expect( renderControllerStatus( jc, jo, caps ) ).toContain( "None" ); // fixture wtrestr 0
	} );
} );

describe( "status view controller-local time", () => {
	it( "renders rain-delay and solar times on a 12-hour clock", () => {
		const timed = { ...jc, rd: 1 as const, rdst: jc.devt, sunrise: 360, sunset: 1080 };
		const html = renderControllerStatus( timed, jo, deriveCapabilities( timed, jo ) );
		expect( html ).toContain( "Active until 06/09/2024 1:20 PM" );
		expect( html ).toContain( "6:00 AM / 6:00 PM" );
	} );
} );

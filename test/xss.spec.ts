/**
 * XSS / output-escaping tests — the framework-free views build HTML strings dropped into innerHTML,
 * so every device-controlled value (dname, fwf, mac, weather host) MUST be escaped. These prove a
 * hostile payload is neutralized end-to-end, including the fwf path (getForkTag returns raw; the
 * status view escapes the composed string). A dropped esc() call should fail here.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJc, parseJo, deriveCapabilities } from "../www/src/api/client";
import { renderControllerStatus } from "../www/src/spike/status-view";
import { renderDiagnostics } from "../www/src/views/diagnostics-view";
import { renderWeather } from "../www/src/views/weather-view";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jc = parseJc( fx( "jc" ) );
const jo = parseJo( fx( "jo" ) );
const caps = deriveCapabilities( jc, jo );

const SCRIPT = "<script>alert(1)</script>";
const IMG = '"><img src=x onerror=alert(1)>';

describe( "XSS escaping", () => {
	it( "status view escapes a hostile device name and fork tag (fwf)", () => {
		const html = renderControllerStatus( { ...jc, dname: SCRIPT }, { ...jo, fwf: IMG }, caps );
		expect( html ).not.toContain( "<script>" );
		expect( html ).not.toContain( "<img" );
		expect( html ).toContain( "&lt;script&gt;" );
		expect( html ).toContain( "&lt;img" ); // fwf payload neutralized via esc(firmware)
	} );

	it( "diagnostics view escapes a hostile MAC address", () => {
		const html = renderDiagnostics( { ...jc, mac: SCRIPT }, jo );
		expect( html ).not.toContain( "<script>" );
		expect( html ).toContain( "&lt;script&gt;" );
	} );

	it( "weather view escapes a hostile weather-service host", () => {
		const html = renderWeather( { ...jc, wsp: IMG }, jo );
		expect( html ).not.toContain( "<img" );
		expect( html ).toContain( "&lt;img" );
	} );

	it( "esc() coerces a non-string device value instead of throwing (tolerant parsers; availability)", () => {
		const hostile = { ...jc, dname: 12345 as unknown as string };
		expect( () => renderControllerStatus( hostile, jo, caps ) ).not.toThrow();
		expect( renderControllerStatus( hostile, jo, caps ) ).toContain( "12345" );
	} );
} );

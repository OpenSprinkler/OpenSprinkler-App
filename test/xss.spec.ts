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
import { renderStations } from "../www/src/views/stations-view";
import { renderHistory } from "../www/src/views/history-view";
import { renderPrograms } from "../www/src/views/programs-view";
import { renderProgramEditor } from "../www/src/views/settings/program-edit";
import type { OSProgram } from "../www/src/api/types";
import { parseJn } from "../www/src/api/client";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jc = parseJc( fx( "jc" ) );
const jo = parseJo( fx( "jo" ) );
const jn = parseJn( fx( "jn" ) );
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

	it( "rejects a non-numeric station-status group at the API boundary", () => {
		const raw = fx( "jc" ) as Record<string, unknown>;
		const ps = ( raw.ps as unknown[][] ).map( ( tuple ) => [ ...tuple ] );
		ps[ 0 ]![ 3 ] = IMG;
		expect( () => parseJc( { ...raw, ps } ) ).toThrow( /station-status tuple/i );
	} );

	it( "still escapes station groups and companion station ids when a typed caller is bypassed", () => {
		const ps = jc.ps.map( ( tuple ) => [ ...tuple ] ) as unknown as typeof jc.ps;
		( ps[ 0 ] as unknown[] )[ 3 ] = IMG;
		const stationHtml = renderStations( { ...jc, ps }, jn );
		expect( stationHtml ).not.toContain( "<img" );
		expect( stationHtml ).toContain( "&lt;img" );

		const historyHtml = renderHistory( [], [ {
			program: 1, station: IMG as unknown as number, durationSec: 1, endTs: 1, flowGpm: null,
		} ], { stale: false } );
		expect( historyHtml ).not.toContain( "<img" );
		expect( historyHtml ).toContain( "&lt;img" );
	} );

	it( "escapes a hostile existing program name when prefilling the editor", () => {
		const program: OSProgram = [ 65, 1, 0, [ 360, -1, -1, -1 ], Array( 8 ).fill( 60 ), IMG, [ 0, 33, 33 ] ];
		const html = renderProgramEditor( jn, 221, 32, program, 0 );
		expect( html ).not.toContain( "<img" );
		expect( html ).toContain( "&lt;img" );

		const listHtml = renderPrograms( {
			nprogs: 1, nboards: 1, mnp: 40, mnst: 4, pnsize: 32, pd: [ program ],
		}, jn, { actions: true } );
		expect( listHtml ).not.toContain( "<img" );
		expect( listHtml ).toContain( 'aria-label="Edit program 1: &quot;&gt;&lt;img' );
	} );
} );

/**
 * Empty-state + discoverability tests (upstream #289/#292) — views show friendly guidance instead
 * of blank tables, and carry inline help affordances.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseJc, parseJo, parseJn, parseJp, parseJl, deriveCapabilities } from "../www/src/api/client";
import { renderStations } from "../www/src/views/stations-view";
import { renderPrograms } from "../www/src/views/programs-view";
import { renderLogs } from "../www/src/views/logs-view";
import { renderWeather } from "../www/src/views/weather-view";
import { renderDiagnostics } from "../www/src/views/diagnostics-view";
import { renderControllerStatus } from "../www/src/spike/status-view";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jc = parseJc( fx( "jc" ) );
const jo = parseJo( fx( "jo" ) );
const jn = parseJn( fx( "jn" ) );

describe( "friendly empty-states", () => {
	it( "stations: guidance when none are configured", () => {
		// The parser correctly rejects a controller with no base board; exercise the pure view's
		// defensive empty state with an explicitly synthesized model instead.
		const emptyJn = { ...jn, snames: [], stn_dis: [] };
		const html = renderStations( jc, emptyJn );
		expect( html ).toContain( "No stations configured" );
	} );
	it( "programs: guidance when none are defined", () => {
		const emptyJp = parseJp( { ...( fx( "jp" ) as object ), pd: [], nprogs: 0 } );
		const html = renderPrograms( emptyJp, jn );
		expect( html ).toContain( "No programs yet" );
		expect( html ).toContain( "class=\"empty-state\"" );
	} );
	it( "logs: guidance when the history is empty", () => {
		const html = renderLogs( parseJl( [] ), jn );
		expect( html ).toContain( "No log entries yet" );
	} );
} );

describe( "discoverability: inline help affordances (#292)", () => {
	const caps = deriveCapabilities( jc, jo );
	it( "status, weather and diagnostics carry accessible help tips", () => {
		for ( const html of [
			renderControllerStatus( jc, jo, caps ),
			renderWeather( jc, jo ),
			renderDiagnostics( jc, jo ),
		] ) {
			expect( html ).toContain( "help-tip" );
			expect( html ).toContain( "aria-label=" );
		}
	} );
} );

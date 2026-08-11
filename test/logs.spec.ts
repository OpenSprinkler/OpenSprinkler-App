/**
 * Log decoder + view tests — /jl station runs and special events.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it, expect } from "vitest";
import { parseJl, parseJn, parseJo } from "../www/src/api/client";
import { decodeLogRow, describeLogEntry, formatControllerTimestamp, lastRunsByStation } from "../www/src/api/decode";
import { clearSessionLog, recordSessionEvent } from "../www/src/api/session-log";
import { renderLogs } from "../www/src/views/logs-view";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( fileURLToPath( new URL( `./fixtures/api/${ name }.fixture.json`, import.meta.url ) ), "utf8" ) );
}
const jl = parseJl( fx( "jl" ) );
const jn = parseJn( fx( "jn" ) );

describe( "decodeLogRow", () => {
	it( "decodes a station run with flow", () => {
		const e = decodeLogRow( jl[ 5 ] );
		expect( e.kind ).toBe( "station" );
		if ( e.kind === "station" ) {
			expect( e.station ).toBe( 2 );
			expect( e.durationSec ).toBe( 600 );
			expect( e.flowPulseRate ).toBe( 2.45 );  // raw pulses/min — volume needs fpr calibration
		}
	} );
	it( "discriminates special events by the string code", () => {
		expect( decodeLogRow( jl[ 3 ] ).kind ).toBe( "sensor1" );
		expect( decodeLogRow( jl[ 2 ] ).kind ).toBe( "raindelay" );
		expect( decodeLogRow( jl[ 1 ] ).kind ).toBe( "waterlevel" );
		expect( decodeLogRow( jl[ 0 ] ).kind ).toBe( "flow" );
	} );
	it( "water-level value2 is the percentage; flow value is pulse count", () => {
		const wl = decodeLogRow( jl[ 1 ] );
		expect( wl.kind === "waterlevel" && wl.value ).toBe( 75 );
		const fl = decodeLogRow( jl[ 0 ] );
		expect( fl.kind === "flow" && fl.value ).toBe( 1280 );
		expect( fl.kind === "flow" && fl.durationSec ).toBe( 60 );
	} );
} );

describe( "describeLogEntry", () => {
	it( "renders human descriptions per kind", () => {
		// Without calibration the flow figure is unprintable (raw pulses) — omitted, not mislabeled.
		expect( describeLogEntry( decodeLogRow( jl[ 5 ] ), jn.snames ) ).toBe( "Garden Drip ran 10m (program 1)" );
		// With fpr calibration (1 L/pulse): 2.45 pulses/min → 2.45 L/min → 0.65 gal/min imperial.
		expect( describeLogEntry( decodeLogRow( jl[ 5 ] ), jn.snames, { fpr0: 100, fpr1: 0 } ) )
			.toBe( "Garden Drip ran 10m (program 1) · 0.65 gal/min" );
		expect( describeLogEntry( decodeLogRow( jl[ 3 ] ), jn.snames ) ).toBe( "Sensor 1 active 1h" );
		expect( describeLogEntry( decodeLogRow( jl[ 2 ] ), jn.snames ) ).toBe( "Rain delay 2h" );
		expect( describeLogEntry( decodeLogRow( jl[ 1 ] ), jn.snames ) ).toBe( "Water level set to 75%" );
		expect( describeLogEntry( decodeLogRow( jl[ 0 ] ), jn.snames ) ).toBe( "Flow: 1280 pulses over 1m" );
	} );
} );

describe( "log chronology across folded controller wall time", () => {
	const folded = parseJl( [
		[ 1, 0, 60, 6600 ],   // earlier occurrence: 1:50 AM
		[ 1, 0, 120, 4200 ],  // later after fall-back: 1:10 AM
		[ 1, 0, 180, 4200 ],  // still later, same encoded wall time
	] );
	it( "uses the last source occurrence for each station", () => {
		expect( lastRunsByStation( folded ).get( 0 ) ).toMatchObject( { when: 4200, durationSec: 180 } );
	} );
	it( "renders newest-first by reversing append order rather than sorting timestamps", () => {
		const html = renderLogs( folded, jn );
		expect( html.indexOf( "ran 3m" ) ).toBeLessThan( html.indexOf( "ran 2m" ) );
		expect( html.indexOf( "ran 2m" ) ).toBeLessThan( html.indexOf( "ran 1m" ) );
	} );
} );

describe( "session-observed events in the log", () => {
	const jo = parseJo( fx( "jo" ) );
	afterEach( clearSessionLog );
	it( "merges a browser-observed weather event by controller-clock position", () => {
		recordSessionEvent( "detail", "Weather", "Weather fetched: 72°F, cloudy" );
		const html = renderLogs( jl, jn, jo );
		expect( html ).toContain( "Weather fetched: 72°F, cloudy" );
		expect( html ).toContain( ">Detail</td>" );
		expect( html ).toContain( "(7)" );
		// The session event (recorded now) is newer than every 2024 fixture row.
		expect( html.indexOf( "Weather fetched" ) ).toBeLessThan( html.indexOf( "Garden Drip ran 10m" ) );
	} );
	it( "omits session events when jo (and so the controller clock offset) is absent", () => {
		recordSessionEvent( "detail", "Weather", "Weather fetched: 72°F, cloudy" );
		expect( renderLogs( jl, jn ) ).not.toContain( "Weather fetched" );
	} );
	it( "shifts observed epochs into the controller clock by exactly +offset (nonzero tz)", () => {
		// tz 52 → (52-48)*900 = +3600s. The fixture jo is tz 48 (offset 0), which hides sign or
		// double-application bugs — so pin the rendered timestamp under a real one-hour offset.
		const joPlusOne = { ...parseJo( fx( "jo" ) ), tz: 52 };
		const companionTs = 1717975800;
		recordSessionEvent( "detail", "Weather", "session marker row" );
		const sessionEpoch = Math.floor( Date.now() / 1000 ) + 3600;
		const html = renderLogs( jl, jn, joPlusOne, { companionEvents: [
			{ ts: companionTs, source: "weather", level: "normal", label: "Weather", detail: "companion marker row" },
		] } );
		expect( html ).toContain( formatControllerTimestamp( companionTs + 3600 ) );
		// Allow one second of test-clock drift on the session row.
		const sessionTimes = [ sessionEpoch, sessionEpoch + 1 ].map( formatControllerTimestamp );
		expect( sessionTimes.some( ( t ) => html.includes( t ) ) ).toBe( true );
	} );
	it( "shows session events even when the firmware log is empty", () => {
		const jo = parseJo( fx( "jo" ) );
		recordSessionEvent( "detail", "Weather", "Weather fetched: 72°F, cloudy" );
		const html = renderLogs( [], jn, jo );
		expect( html ).toContain( "Weather fetched: 72°F, cloudy" );
		expect( html ).toContain( "(1)" );
		expect( html ).not.toContain( "No log entries yet" );
	} );
} );

describe( "companion events and filters in the log", () => {
	const jo = parseJo( fx( "jo" ) );
	afterEach( clearSessionLog );
	const companion = [
		{ ts: 1717975800, source: "weather" as const, level: "normal" as const, label: "Weather", detail: "Weather adjustment problem: Timed Out." },
		{ ts: 1717975860, source: "weather" as const, level: "detail" as const, label: "Weather", detail: "Controller completed a weather check; water level is 85%." },
	];
	it( "merges companion events and renders their levels", () => {
		const html = renderLogs( jl, jn, jo, { companionEvents: companion } );
		expect( html ).toContain( "Timed Out" );
		expect( html ).toContain( "water level is 85%" );
		expect( html ).toContain( "(8)" );
	} );
	it( "level filter is a ceiling: Normal hides Detail rows and shows the filtered count", () => {
		const html = renderLogs( jl, jn, jo, { companionEvents: companion, filter: { level: "normal", source: "all" } } );
		expect( html ).toContain( "Timed Out" );
		expect( html ).not.toContain( "water level is 85%" );
		expect( html ).toContain( "(7 of 8)" );
	} );
	it( "source filter isolates one bucket", () => {
		const html = renderLogs( jl, jn, jo, { companionEvents: companion, filter: { level: "debug", source: "watering" } } );
		expect( html ).toContain( "Garden Drip ran 10m" );
		expect( html ).not.toContain( "Timed Out" );
		expect( html ).not.toContain( "Sensor 1 active" );
	} );
	it( "filtered-to-empty says so instead of showing the empty state", () => {
		const html = renderLogs( [], jn, jo, { companionEvents: companion, filter: { level: "debug", source: "sensors" } } );
		expect( html ).toContain( "No entries match the current filters." );
		expect( html ).not.toContain( "No log entries yet" );
	} );
	it( "restrictive level and source combine (AND), and Detailed hides Debug rows", () => {
		clearSessionLog();
		recordSessionEvent( "debug", "Weather", "debug trace row" );
		const detailRow = { ts: 1717975860, source: "weather" as const, level: "detail" as const, label: "Weather", detail: "detail weather row" };
		// Default Detailed ceiling: debug hidden, detail shown.
		const detailed = renderLogs( jl, jn, jo, { companionEvents: [ detailRow ] } );
		expect( detailed ).toContain( "detail weather row" );
		expect( detailed ).not.toContain( "debug trace row" );
		// Debug ceiling reveals it.
		expect( renderLogs( jl, jn, jo, { companionEvents: [ detailRow ], filter: { level: "debug", source: "all" } } ) )
			.toContain( "debug trace row" );
		// Both predicates restrictive at once: weather source + normal ceiling hides the detail
		// weather row AND every watering/sensor row.
		const combined = renderLogs( jl, jn, jo, { companionEvents: companion, filter: { level: "normal", source: "weather" } } );
		expect( combined ).toContain( "Timed Out" );                       // normal + weather
		expect( combined ).not.toContain( "water level is 85%" );          // detail level filtered
		expect( combined ).not.toContain( "Garden Drip ran 10m" );         // watering source filtered
		expect( combined ).toContain( "Water level set to 75%" );          // firmware waterlevel row is weather-bucketed
	} );

	it( "toolbar reflects the active filter", () => {
		const html = renderLogs( jl, jn, jo, { filter: { level: "debug", source: "weather" } } );
		expect( html ).toContain( 'data-source="weather" aria-pressed="true"' );
		expect( html ).toContain( '<option value="debug" selected>' );
	} );
} );

describe( "renderLogs", () => {
	const html = renderLogs( jl, jn );
	it( "shows all entries, newest first, with the count", () => {
		expect( html ).toContain( "Log <span" );
		expect( html ).toContain( "(6)" );
		expect( html ).toContain( "Garden Drip ran 10m" );
		expect( html ).toContain( "Water level set to 75%" );
		expect( html ).toContain( "06/09/2024 1:30 PM" );
		expect( html ).not.toContain( "2024-06-09" );
		// newest controller-local entry appears before an older row
		expect( html.indexOf( "Garden Drip ran 10m" ) ).toBeLessThan( html.indexOf( "Flow: 1280 pulses" ) );
	} );
} );

// test/server/history-view.spec.ts
import { describe, it, expect } from "vitest";
import { renderHistory } from "../../www/src/views/history-view";
import type { TelemetryPoint, RunLogPoint } from "../../www/src/api/companion";

const tel: TelemetryPoint[] = [
	{ ts: 100, waterLevel: 34, rainDelay: 0, weatherErr: 0, weatherRestricted: 0, lastWeatherUpdate: 0, activeStations: 0, rssi: -67, currentDraw: null },
	{ ts: 400, waterLevel: 50, rainDelay: 0, weatherErr: 0, weatherRestricted: 0, lastWeatherUpdate: 0, activeStations: 1, rssi: -70, currentDraw: null },
];
const runs: RunLogPoint[] = [ { program: 1, station: 2, durationSec: 60, endTs: 300, flowGpm: null } ];

describe( "renderHistory", () => {
	it( "renders a water-level sparkline + run-frequency from data", () => {
		const html = renderHistory( tel, runs, { stale: false } );
		expect( html ).toContain( "Water level" );
		expect( html ).toContain( "<svg" );        // sparkline
		expect( html ).toContain( "Runs" );
		expect( html ).not.toContain( "may be stale" );
	} );
	it( "shows an empty-state with no data", () => {
		expect( renderHistory( [], [], { stale: false } ) ).toContain( "No history yet" );
	} );
	it( "shows a stale note when the collector is behind", () => {
		expect( renderHistory( tel, runs, { stale: true } ) ).toContain( "may be stale" );
	} );
	it( "bounds a large sparkline while retaining narrow extrema", () => {
		const many = Array.from( { length: 10_000 }, ( _, ts ): TelemetryPoint => ( {
			ts, waterLevel: ts === 123 ? 0 : ts === 456 ? 100 : 50,
			rainDelay: 0, weatherErr: 0, weatherRestricted: 0, lastWeatherUpdate: 0,
			activeStations: 0, rssi: null, currentDraw: null,
		} ) );
		const html = renderHistory( many, [], { stale: false } );
		const points = /<polyline[^>]+points="([^"]+)"/.exec( html )?.[ 1 ]?.split( " " ) ?? [];
		expect( points.length ).toBeLessThanOrEqual( 480 );
		expect( points.some( ( point ) => point.endsWith( ",0.0" ) ) ).toBe( true );
		expect( points.some( ( point ) => point.endsWith( ",40.0" ) ) ).toBe( true );
	} );
} );

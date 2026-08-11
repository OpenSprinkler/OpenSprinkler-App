/**
 * Event derivation — telemetry snapshot diffs become plain-English log events, and only for
 * transitions the firmware's own /jl log does not already record.
 */
import { describe, it, expect } from "vitest";
import { diffTelemetryEvents } from "../../server/events";
import type { StoredTelemetry, TelemetrySample } from "../../server/storage/provider";

const base = ( over: Partial<TelemetrySample> = {} ): TelemetrySample => ( {
	ts: 1000, waterLevel: 100, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
	lastWeatherUpdate: 500, activeStations: 0, rssi: null, currentDraw: null, raw: "{}",
	...over,
} );
const stored = ( over: Partial<StoredTelemetry> = {} ): StoredTelemetry => {
	const { raw: _raw, ...rest } = base( over as Partial<TelemetrySample> );
	return rest;
};

describe( "diffTelemetryEvents", () => {
	it( "emits nothing without a baseline (first sample, or unreadable baseline)", () => {
		expect( diffTelemetryEvents( null, base() ) ).toEqual( [] );
	} );

	it( "emits nothing when nothing changed", () => {
		expect( diffTelemetryEvents( stored(), base() ) ).toEqual( [] );
	} );

	it( "maps a weather error appearing to its human text, and clearing to a recovery line", () => {
		const failed = diffTelemetryEvents( stored(), base( { weatherErr: -3 } ) );
		expect( failed ).toHaveLength( 1 );
		expect( failed[ 0 ] ).toMatchObject( { level: "normal", source: "weather" } );
		expect( failed[ 0 ]!.detail ).toContain( "Timed Out" );
		const recovered = diffTelemetryEvents( stored( { weatherErr: -3 } ), base() );
		expect( recovered[ 0 ]!.detail ).toContain( "recovered" );
	} );

	it( "reports the weather watering restriction engaging and lifting", () => {
		expect( diffTelemetryEvents( stored(), base( { weatherRestricted: 1 } ) )[ 0 ]!.detail )
			.toContain( "restricted" );
		expect( diffTelemetryEvents( stored( { weatherRestricted: 1 } ), base() )[ 0 ]!.detail )
			.toContain( "lifted" );
	} );

	it( "records a completed weather check as a Detail row carrying the water level", () => {
		const out = diffTelemetryEvents( stored(), base( { lastWeatherUpdate: 900, waterLevel: 85 } ) );
		expect( out ).toHaveLength( 1 );
		expect( out[ 0 ] ).toMatchObject( { level: "detail" } );
		expect( out[ 0 ]!.detail ).toContain( "85%" );
	} );

	it( "does not re-derive what /jl already logs (water level, rain delay)", () => {
		expect( diffTelemetryEvents( stored(), base( { waterLevel: 55, rainDelay: 1 } ) ) ).toEqual( [] );
	} );

	it( "emits every simultaneous transition — the fields derive independently", () => {
		// A 300s-apart poll can legitimately carry all three at once: a completed weather check
		// that cleared an error and engaged the restriction.
		const out = diffTelemetryEvents(
			stored( { weatherErr: -3 } ),
			base( { weatherErr: 0, weatherRestricted: 1, lastWeatherUpdate: 900, waterLevel: 70 } ),
		);
		expect( out ).toHaveLength( 3 );
		expect( out.map( ( e ) => e.level ) ).toEqual( [ "normal", "normal", "detail" ] );
		expect( out[ 0 ]!.detail ).toContain( "recovered" );
		expect( out[ 1 ]!.detail ).toContain( "restricted" );
		expect( out[ 2 ]!.detail ).toContain( "70%" );
	} );

	it( "stamps events with the current sample's collector timestamp", () => {
		const out = diffTelemetryEvents( stored(), base( { ts: 4242, weatherErr: 2 } ) );
		expect( out[ 0 ]!.ts ).toBe( 4242 );
	} );
} );

// @vitest-environment jsdom
/**
 * Lossless program-editor regressions for firmware-valid values that are unusual in a new schedule.
 * These exercise raw tuple -> rendered form -> ProgramInput -> encoded /jp tuple, without involving
 * the dashboard host.
 */
import { describe, expect, it } from "vitest";
import { parseJp } from "../www/src/api/client";
import { encodeProgram, type EncodedProgram } from "../www/src/api/encode";
import type { JnResponse, JpResponse, OSProgram } from "../www/src/api/types";
import { readForm } from "../www/src/ui/form";
import { buildProgramInput, renderProgramEditor } from "../www/src/views/settings/program-edit";

const STATION_COUNT = 8;
const jn: JnResponse = {
	masop: [ 0 ], masop2: [ 0 ], ignore_rain: [ 0 ], ignore_sn1: [ 0 ], ignore_sn2: [ 0 ],
	stn_dis: [ 0 ], stn_spe: [ 0 ], stn_grp: Array( STATION_COUNT ).fill( 0 ),
	snames: Array.from( { length: STATION_COUNT }, ( _, index ) => `Zone ${ index + 1 }` ), maxlen: 32,
};

function tupleFromEncoded( encoded: EncodedProgram ): OSProgram {
	return [
		encoded.v[ 0 ] as number,
		encoded.v[ 1 ] as number,
		encoded.v[ 2 ] as number,
		( encoded.v[ 3 ] as number[] ).slice(),
		( encoded.v[ 4 ] as number[] ).slice(),
		encoded.name,
		encoded.dateRange
			? [ encoded.dateRange.enable ? 1 : 0, encoded.dateRange.from, encoded.dateRange.to ]
			: [ 0, 33, 415 ],
	];
}

function validateTuple( program: OSProgram ): OSProgram {
	const response: JpResponse = parseJp( {
		nprogs: 1, nboards: 1, mnp: 40, mnst: 4, pnsize: 32, pd: [ program ],
	} );
	return response.pd[ 0 ]!;
}

function valuesFromEditor( program: OSProgram ): Record<string, string | boolean> {
	const mount = document.createElement( "div" );
	mount.innerHTML = renderProgramEditor( jn, 2214, 32, program, 0 );
	const form = mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' );
	if ( !form ) throw new Error( "Program editor did not render a form." );
	return readForm( form );
}

function editorRoundTrip( program: OSProgram ): OSProgram {
	const values = valuesFromEditor( validateTuple( program ) );
	const rebuilt = buildProgramInput( values, STATION_COUNT, 2214, 32 );
	return validateTuple( tupleFromEncoded( encodeProgram( rebuilt ) ) );
}

describe( "program editor legacy compatibility", () => {
	it( "accepts and losslessly round-trips repeat counts above uint8 range", () => {
		for ( const count of [ 300, 0x7fff ] ) {
			const input = buildProgramInput( {
				name: `Repeat ${ count }`, enabled: false, useWeather: false, restriction: "none",
				schedType: "weekly", wd_0: true, startType: "repeat", repeatFirst: "6:00 AM",
				repeatCount: String( count ), repeatInterval: "60", durMode_0: "minutes", dur_0: "1",
			}, STATION_COUNT, 2214, 32 );
			const stored = validateTuple( tupleFromEncoded( encodeProgram( input ) ) );

			expect( stored[ 3 ] ).toEqual( [ 360, count, 60, 0 ] );
			expect( editorRoundTrip( stored ) ).toEqual( stored );
		}
	} );

	it( "round-trips the full uint8 interval range", () => {
		const interval: OSProgram = [
			3 << 4 | 1 << 6, 254, 255, [ 360, -1, -1, -1 ],
			[ 60, ...Array( STATION_COUNT - 1 ).fill( 0 ) ], "Long interval", [ 0, 33, 415 ],
		];
		const values = valuesFromEditor( validateTuple( interval ) );
		expect( values.intervalDays ).toBe( "255" );
		expect( values.startingInDays ).toBe( "254" );
		expect( editorRoundTrip( interval ) ).toEqual( interval );
	} );

	it( "rejects newly entered duplicate fixed starts after semantic parsing", () => {
		expect( () => buildProgramInput( {
			name: "Duplicate", enabled: false, useWeather: false, restriction: "none",
			schedType: "weekly", wd_0: true, startType: "fixed",
			t_0: "6:00 AM", t_1: "06:00 AM", t_2: "", t_3: "",
			durMode_0: "minutes", dur_0: "1",
		}, STATION_COUNT, 2214, 32 ) ).toThrow( /duplicate/i );
	} );

	it( "round-trips an unchanged inert tuple with no weekdays, starts, or durations", () => {
		const inert: OSProgram = [
			1 << 6, 0, 0, [ -1, -1, -1, -1 ], Array( STATION_COUNT ).fill( 0 ),
			"Dormant legacy", [ 0, 33, 415 ],
		];
		expect( editorRoundTrip( inert ) ).toEqual( inert );
	} );

	it( "round-trips unchanged duplicate fixed starts from a legacy tuple", () => {
		const duplicate: OSProgram = [
			1 << 6, 1, 0, [ 360, 360, -1, -1 ], [ 60, ...Array( STATION_COUNT - 1 ).fill( 0 ) ],
			"Legacy duplicate", [ 0, 33, 415 ],
		];
		expect( editorRoundTrip( duplicate ) ).toEqual( duplicate );
	} );

	it( "preserves non-semantic restriction and monthly schedule bits", () => {
		const noncanonical: OSProgram = [
			( 1 << 6 ) | ( 2 << 4 ) | ( 3 << 2 ), 32, 7, [ 360, -1, -1, -1 ],
			[ 60, ...Array( STATION_COUNT - 1 ).fill( 0 ) ], "Last day", [ 0, 33, 415 ],
		];
		const values = valuesFromEditor( validateTuple( noncanonical ) );
		expect( values.restriction ).toBe( "none" );
		expect( values.dayOfMonth ).toBe( "0" );
		expect( editorRoundTrip( noncanonical ) ).toEqual( noncanonical );
	} );

	it( "preserves unused weekly schedule words", () => {
		const weekly: OSProgram = [
			1 << 6, 0x81, 99, [ 360, -1, -1, -1 ],
			[ 60, ...Array( STATION_COUNT - 1 ).fill( 0 ) ], "Weekly raw", [ 0, 33, 415 ],
		];
		expect( editorRoundTrip( weekly ) ).toEqual( weekly );
	} );
} );

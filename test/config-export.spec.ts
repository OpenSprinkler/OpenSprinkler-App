// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseJc, parseJe, parseJn, parseJo, parseJp } from "../www/src/api/client";
import {
	buildConfigurationExport, configurationExportFilename, deliverConfigurationExport,
	serializeConfigurationExport, type ConfigurationExportSource,
} from "../www/src/config-export";

function fx( name: string ): unknown {
	return JSON.parse( readFileSync( resolve( `test/fixtures/api/${ name }.fixture.json` ), "utf8" ) );
}

function source(): ConfigurationExportSource {
	return {
		jc: parseJc( fx( "jc" ) ), jo: parseJo( fx( "jo" ) ), jn: parseJn( fx( "jn" ) ),
		je: parseJe( fx( "je" ) ), jp: parseJp( fx( "jp" ) ),
	};
}

describe( "safe configuration export", () => {
	it( "uses a versioned allowlist while preserving station and raw program data", () => {
		const input = source();
		input.jc = {
			...input.jc,
			ifkey: "IFTTT-SECRET", jsp: "https://secret.example/path?token=ONE", wsp: "secret-weather.example",
			wto: { key: "PROVIDER-SECRET", pws: "PRIVATE-STATION" }, mqtt: { password: "MQTT-SECRET" },
			otc: { token: "OTC-SECRET" },
		};
		input.je = { ...input.je, "0": { st: 2, sd: "REMOTE-OTC-SECRET" } };
		input.jp.pd[ 0 ]![ 4 ] = [ 1, 59, 60, 61, 90, 65533, 65534, 65535 ];

		const out = buildConfigurationExport( input );
		expect( out.schema ).toBe( "opensprinkler.configuration" );
		expect( out.version ).toBe( 1 );
		expect( out.stations.names ).toEqual( input.jn.snames );
		expect( out.stations.specialTypes[ "0" ] ).toBe( 2 );
		expect( out.programs.tuples[ 0 ]![ 4 ] ).toEqual( [ 1, 59, 60, 61, 90, 65533, 65534, 65535 ] );

		const json = JSON.stringify( out );
		for ( const secret of [
			"IFTTT-SECRET", "secret.example", "secret-weather.example", "PROVIDER-SECRET", "PRIVATE-STATION",
			"MQTT-SECRET", "OTC-SECRET", "REMOTE-OTC-SECRET",
		] ) expect( json ).not.toContain( secret );
		for ( const forbiddenKey of [ "ifkey", "jsp", "wsp", "wto", "mqtt", "otc", "sd", "pw", "password", "token" ] ) {
			expect( json.toLowerCase() ).not.toContain( `\"${ forbiddenKey }\"` );
		}
	} );

	it( "returns detached arrays and stable pretty JSON", () => {
		const input = source();
		const out = buildConfigurationExport( input );
		out.stations.names[ 0 ] = "Changed export";
		out.programs.tuples[ 0 ]![ 4 ][ 0 ] = 123;
		expect( input.jn.snames[ 0 ] ).not.toBe( "Changed export" );
		expect( input.jp.pd[ 0 ]![ 4 ][ 0 ] ).not.toBe( 123 );
		expect( serializeConfigurationExport( input ) ).toMatch( /\n  "version": 1,/ );
		expect( serializeConfigurationExport( input ).endsWith( "\n" ) ).toBe( true );
	} );

	it( "creates a privacy-neutral filename", () => {
		expect( configurationExportFilename( " Back Yard / Main! " ) )
			.toBe( "opensprinkler-back-yard-main-configuration-v1.json" );
		expect( configurationExportFilename( "💧" ) ).toBe( "opensprinkler-controller-configuration-v1.json" );
	} );

	it( "uses the share sheet when file sharing is supported", async () => {
		const share = vi.fn( async ( _data: ShareData ) => undefined );
		const result = await deliverConfigurationExport( source(), {
			navigator: { canShare: () => true, share } as never,
		} );
		expect( result ).toBe( "shared" );
		expect( share ).toHaveBeenCalledOnce();
		expect( share.mock.calls[ 0 ]![ 0 ].files?.[ 0 ]?.name ).toContain( "configuration-v1.json" );
	} );

	it( "falls back to a revoked object-URL download", async () => {
		const createObjectURL = vi.fn( () => "blob:safe-export" );
		const revokeObjectURL = vi.fn();
		const click = vi.spyOn( HTMLAnchorElement.prototype, "click" ).mockImplementation( () => undefined );
		const result = await deliverConfigurationExport( source(), {
			navigator: {} as never,
			document,
			url: { createObjectURL, revokeObjectURL },
		} );
		expect( result ).toBe( "downloaded" );
		expect( click ).toHaveBeenCalledOnce();
		expect( createObjectURL ).toHaveBeenCalledOnce();
		expect( revokeObjectURL ).toHaveBeenCalledWith( "blob:safe-export" );
		expect( document.querySelector( 'a[download$="configuration-v1.json"]' ) ).toBeNull();
	} );
} );

import { describe, expect, it } from "vitest";
import { assertModernFirmwareSupport, assertModernPreflightVersion } from "../www/src/auth/support";

describe( "modern firmware security gates", () => {
	it( "rejects malformed and pre-221 versions before login", () => {
		for ( const version of [ undefined, 0, 220, 220.5, Number.NaN, Number.POSITIVE_INFINITY ] ) {
			expect( () => assertModernPreflightVersion( version ) ).toThrow( /unsupported controller firmware/i );
		}
		expect( () => assertModernPreflightVersion( 221 ) ).not.toThrow();
	} );

	it( "requires the authenticated storage epoch, minor floor, and fork identity", () => {
		expect( () => assertModernFirmwareSupport( { fwv: 221, fwm: 4, fwf: "kars85.3" } as never ) ).not.toThrow();
		for ( const options of [
			{ fwv: 221, fwm: 3, fwf: "kars85.3" },
			{ fwv: 222, fwm: 4, fwf: "kars85.3" },
			{ fwv: 221, fwm: 4 },
			{ fwv: 221, fwm: 4, fwf: "official.1" },
		] ) expect( () => assertModernFirmwareSupport( options as never ) ).toThrow( /unsupported controller build/i );
	} );
} );

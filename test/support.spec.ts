import { describe, expect, it } from "vitest";
import {
	assertModernFirmwareSupport, assertModernPreflightVersion, modernPreflightPolicy,
} from "../www/src/auth/support";

describe( "modern firmware security gates", () => {
	it( "rejects malformed and pre-221 versions before login", () => {
		for ( const version of [ undefined, "221", "1.9.0-OSPi", 0, 220, 220.5, Number.NaN, Number.POSITIVE_INFINITY ] ) {
			expect( modernPreflightPolicy( version ) ).toBe( "unsupported" );
			expect( () => assertModernPreflightVersion( version ) ).toThrow( /unsupported controller firmware/i );
		}
		expect( modernPreflightPolicy( 221 ) ).toBe( "hash-authentication" );
		expect( () => assertModernPreflightVersion( 221 ) ).not.toThrow();
	} );

	it( "maps a plausible-floor version-only auth fallback to authentication failure, never unsupported", () => {
		expect( () => assertModernFirmwareSupport( { fwv: 221 } ) ).toThrow( /authentication required or failed/i );
		try { assertModernFirmwareSupport( { fwv: 221 } ); }
		catch ( error ) { expect( String( error ) ).not.toMatch( /unsupported/i ); }
		expect( () => assertModernFirmwareSupport( { fwv: 220 } ) ).toThrow( /unsupported controller firmware/i );
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

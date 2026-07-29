import { describe, expect, it } from "vitest";

import {
	appleReleaseVersionCode,
	releaseVersionCode,
} from "../scripts/release-version-code.mjs";

describe( "release version codes", () => {
	it( "uses a collision-free reserved range instead of packing semver fields", () => {
		expect( releaseVersionCode( 1 ) ).toBe( 1_000_000_001 );
		expect( releaseVersionCode( 12_345 ) ).toBe( 1_000_012_345 );
		expect( releaseVersionCode( 1_100_000_000 ) ).toBe( 2_100_000_000 );
		expect( () => releaseVersionCode( 1_100_000_001 ) ).toThrow( /Google Play's maximum/i );
		expect( () => releaseVersionCode( 0 ) ).toThrow( /positive safe integer/i );
	} );

	it( "uses an Apple-compatible raw revision for CFBundleVersion", () => {
		expect( appleReleaseVersionCode( 2_890 ) ).toBe( 2_890 );
		expect( () => appleReleaseVersionCode( 10_000 ) ).toThrow( /four-digit first component/i );
	} );
} );

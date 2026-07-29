import { describe, expect, it } from "vitest";
import { shouldDisposeOnPageHide } from "../www/src/ui/lifecycle";

describe( "browser page lifecycle", () => {
	it( "keeps the mounted controller alive in BFCache and disposes on real navigation", () => {
		expect( shouldDisposeOnPageHide( { persisted: true } ) ).toBe( false );
		expect( shouldDisposeOnPageHide( { persisted: false } ) ).toBe( true );
	} );
} );

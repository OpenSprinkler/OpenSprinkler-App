import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

type LegacyJQuery = {
	( selector: string ): { hasClass: ( name: string ) => boolean; listview: () => unknown };
	fn: { jquery: string };
	mobile: { version: string };
};

function vendorSource( name: string ): string {
	return readFileSync( resolve( "www/vendor-js", name ), "utf8" );
}

describe( "legacy browser vendor compatibility", () => {
	it( "ships the exact audited npm jQuery and Migrate distributions", () => {
		expect( readFileSync( resolve( "www/vendor-js/jquery.js" ) ) )
			.toEqual( readFileSync( resolve( "node_modules/jquery/dist/jquery.min.js" ) ) );
		expect( readFileSync( resolve( "www/vendor-js/jquery-migrate.min.js" ) ) )
			.toEqual( readFileSync( resolve( "node_modules/jquery-migrate/dist/jquery-migrate.min.js" ) ) );
	} );

	it( "boots jQuery Mobile through the jQuery 3 compatibility layer", () => {
		const dom = new JSDOM( "<!doctype html><html><head></head><body><ul id='items'><li>One</li></ul></body></html>", {
			runScripts: "outside-only",
			url: "https://ui.example/",
		} );

		try {
			dom.window.eval( vendorSource( "jquery.js" ) );
			dom.window.eval( vendorSource( "jquery-migrate.min.js" ) );
			dom.window.eval( vendorSource( "jqm.js" ) );

			const jquery = ( dom.window as unknown as { jQuery: LegacyJQuery } ).jQuery;
			expect( jquery.fn.jquery ).toBe( "3.7.1" );
			expect( jquery.mobile.version ).toBe( "1.4.5" );
			expect( () => jquery( "#items" ).listview() ).not.toThrow();
			expect( jquery( "#items" ).hasClass( "ui-listview" ) ).toBe( true );
		} finally {
			dom.window.close();
		}
	} );
} );

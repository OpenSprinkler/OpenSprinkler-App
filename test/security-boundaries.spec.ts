import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read( path: string ): string {
	return readFileSync( resolve( path ), "utf8" );
}

describe( "browser security boundaries", () => {
	it( "keeps executable content out of the legacy app CSP", () => {
		const html = read( "www/index.html" );
		const policy = html.match( /Content-Security-Policy[^>]+content="([^"]+)"/i )?.[ 1 ];
		expect( policy ).toBeDefined();

		const scriptPolicy = policy?.split( ";" ).find( ( directive ) => directive.trim().startsWith( "script-src" ) );
		expect( scriptPolicy ).not.toContain( "'unsafe-inline'" );
		expect( scriptPolicy ).not.toContain( "'unsafe-eval'" );
		expect( policy ).toContain( "object-src 'none'" );
		expect( policy ).toContain( "base-uri 'none'" );
	} );

	it( "scrubs modern bootstrap parameters before loading the module graph", () => {
		const html = read( "app/index.html" );
		const bootstrap = html.indexOf( 'src="/bootstrap.js"' );
		const module = html.indexOf( 'type="module"' );
		expect( html ).toContain( 'name="referrer" content="no-referrer"' );
		expect( html ).toContain( "script-src 'self'" );
		expect( html ).not.toMatch( /<script>(?:.|\n)*<\/script>/ );
		expect( bootstrap ).toBeGreaterThan( -1 );
		expect( bootstrap ).toBeLessThan( module );
		const source = read( "app/public/bootstrap.js" );
		expect( source ).toContain( 'url.searchParams.delete( key )' );
		expect( source ).toContain( 'history.replaceState' );
		expect( source ).not.toContain( "sessionStorage" );
	} );

	it( "authenticates map messages and renders station labels as text", () => {
		const source = read( "www/js/map.js" );
		const options = read( "www/js/modules/options.js" );
		expect( source ).toContain( "e.source !== parentWindow" );
		expect( source ).toContain( "e.origin !== parentOrigin" );
		expect( source ).toContain( "document.createTextNode" );
		expect( source ).toContain( "new google.maps.Geocoder()" );
		expect( source ).not.toContain( "window.top.postMessage" );
		expect( source ).not.toMatch( /innerHTML\s*=/ );
		expect( options ).not.toContain( "maps.googleapis.com/maps/api/geocode" );
		expect( options ).not.toMatch( /AIza[0-9A-Za-z_-]{20,}/ );
	} );

	it( "does not allow captured environment files into version control", () => {
		const ignore = read( ".gitignore" ).split( /\r?\n/ );
		expect( ignore ).toContain( ".env" );
		expect( ignore ).toContain( ".env.*" );
	} );

	it( "does not grant Cordova arbitrary external intent schemes", () => {
		const config = read( "config.xml" );
		expect( config ).not.toContain( '<allow-intent href="*"' );
		expect( config ).toContain( '<allow-intent href="https://*/*"' );
		expect( config ).toContain( '<allow-intent href="mailto:*"' );
	} );

	it( "ships real HTTP framing/sniffing/referrer headers for every Firebase target", () => {
		const firebase = JSON.parse( read( "firebase.json" ) ) as {
			hosting: Array<{ headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> }>;
		};
		for ( const [ index, target ] of firebase.hosting.entries() ) {
			const globalHeaders = target.headers.find( ( entry ) => entry.source === "**/*" )?.headers ?? [];
			const globalByName = new Map( globalHeaders.map( ( header ) => [ header.key.toLowerCase(), header.value ] ) );
			expect( globalByName.get( "x-content-type-options" ) ).toBe( "nosniff" );
			expect( globalByName.get( "referrer-policy" ) ).toBe( index < 3 ? "strict-origin-when-cross-origin" : "no-referrer" );
			const allByName = new Map( target.headers.flatMap( ( entry ) => entry.headers )
				.map( ( header ) => [ header.key.toLowerCase(), header.value ] ) );
			expect( allByName.get( "x-frame-options" ) ).toBe( "SAMEORIGIN" );
			expect( allByName.get( "content-security-policy" ) ).toContain( "frame-ancestors 'self'" );
		}
		for ( const legacy of firebase.hosting.slice( 0, 3 ) ) {
			const globalNames = legacy.headers.find( ( entry ) => entry.source === "**/*" )?.headers
				.map( ( header ) => header.key.toLowerCase() ) ?? [];
			expect( globalNames ).not.toContain( "x-frame-options" ); // map.html is framed cross-origin by firmware pages
			for ( const source of [ "/", "/index.html" ] ) {
				const names = legacy.headers.find( ( entry ) => entry.source === source )?.headers
					.map( ( header ) => header.key.toLowerCase() ) ?? [];
				expect( names ).toContain( "x-frame-options" );
				expect( names ).toContain( "content-security-policy" );
			}
		}
	} );
} );

// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync( resolve( "www/js/home.js" ), "utf8" );
const index = readFileSync( resolve( "www/index.html" ), "utf8" );
const jqmConfig = readFileSync( resolve( "www/js/jqm-config.js" ), "utf8" );

function stubManifest( body = "[]", synchronous = false ): void {
	class FakeXMLHttpRequest {
		readyState = 0;
		status = 200;
		responseText = body;
		onreadystatechange: null | ( () => void ) = null;

		open(): void {}
		abort(): void {}
		send(): void {
			const finish = () => {
				this.readyState = 4;
				this.onreadystatechange?.();
			};
			if ( synchronous ) finish();
			else queueMicrotask( finish );
		}
	}

	vi.stubGlobal( "XMLHttpRequest", FakeXMLHttpRequest );
	vi.stubGlobal( "XDomainRequest", undefined );
}

function prepareBootstrap(
	eventFor: ( src: string ) => "load" | "error" = () => "load",
	synchronous = false,
): string[] {
	document.head.innerHTML = '<meta name="viewport" content="width=device-width"><script src="https://assets.example/ui/home.js"></script>';
	document.body.innerHTML = "";
	stubManifest( "[]", synchronous );
	const loaded: string[] = [];
	const original = document.head.appendChild.bind( document.head );
	vi.spyOn( document.head, "appendChild" ).mockImplementation( ( node: Node ) => {
		const result = original( node );
		if ( node instanceof HTMLScriptElement ) {
			loaded.push( node.src );
			const settle = () => node.dispatchEvent( new Event( eventFor( node.src ) ) );
			if ( synchronous ) settle();
			else queueMicrotask( settle );
		}
		return result;
	} );
	return loaded;
}

afterEach( () => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
} );

describe( "legacy firmware bootstrap", () => {
	it( "configures jQuery Mobile before its static bootstrap", () => {
		expect( index.indexOf( 'src="js/jqm-config.js"' ) ).toBeGreaterThan( -1 );
		expect( index.indexOf( 'src="js/jqm-config.js"' ) ).toBeLessThan( index.indexOf( 'src="vendor-js/jqm.js"' ) );
		expect( jqmConfig ).toContain( "$.mobile.ajaxEnabled = false" );
		expect( jqmConfig ).toContain( "$.mobile.hashListeningEnabled = false" );
		expect( jqmConfig ).toContain( "$.mobile.allowCrossDomainPages = false" );
	} );

	it( "loads the compatibility layer in order and reports an invalid module manifest", async () => {
		const loaded = prepareBootstrap();
		vi.spyOn( console, "error" ).mockImplementation( () => undefined );

		( 0, eval )( source );
		await vi.waitFor( () => expect( document.title ).toBe( "Unable to load UI" ) );
		expect( loaded.slice( 0, 4 ).map( ( url ) => new URL( url ).pathname.replace( /^\/ui/, "" ) ) ).toEqual( [
			"/vendor-js/jquery.js",
			"/js/jqm-config.js",
			"/vendor-js/jquery-migrate.min.js",
			"/vendor-js/libs.js",
		] );
		expect( document.querySelector( ".feedback" )?.textContent ).toMatch( /Unable to load UI/ );
	} );

	it( "settles on an asset error instead of leaving the spinner indefinitely", async () => {
		prepareBootstrap( ( src ) => src.endsWith( "/jquery.js" ) ? "error" : "load" );
		vi.spyOn( console, "error" ).mockImplementation( () => undefined );

		( 0, eval )( source );
		await vi.waitFor( () => expect( document.title ).toBe( "Unable to load UI" ) );
		expect( document.querySelector( ".feedback" )?.textContent ).toMatch( /Check your connection/ );
	} );

	it( "removes a timed-out script so it cannot execute after failure", async () => {
		vi.useFakeTimers();
		document.head.innerHTML = '<meta name="viewport" content="width=device-width"><script src="https://assets.example/ui/home.js"></script>';
		document.body.innerHTML = "";
		vi.spyOn( console, "error" ).mockImplementation( () => undefined );

		( 0, eval )( source );
		expect( document.querySelectorAll( 'script[src$="/vendor-js/jquery.js"]' ) ).toHaveLength( 1 );
		await vi.advanceTimersByTimeAsync( 15000 );
		await Promise.resolve();
		expect( document.title ).toBe( "Unable to load UI" );
		expect( document.querySelectorAll( 'script[src$="/vendor-js/jquery.js"]' ) ).toHaveLength( 0 );
	} );

	it( "uses the safe default asset host when the bootstrap tag is missing", async () => {
		document.head.innerHTML = '<meta name="viewport" content="width=device-width">';
		document.body.innerHTML = "";
		stubManifest();
		vi.spyOn( console, "error" ).mockImplementation( () => undefined );
		const original = document.head.appendChild.bind( document.head );
		const loaded: string[] = [];
		vi.spyOn( document.head, "appendChild" ).mockImplementation( ( node: Node ) => {
			const result = original( node );
			if ( node instanceof HTMLScriptElement ) {
				loaded.push( node.src );
				queueMicrotask( () => node.dispatchEvent( new Event( "load" ) ) );
			}
			return result;
		} );
		( 0, eval )( source );
		await vi.waitFor( () => expect( loaded[ 0 ] ).toBe( "https://ui.opensprinkler.com/vendor-js/jquery.js" ) );
	} );

	it( "does not require native Promise or fetch to settle bootstrap failures", () => {
		prepareBootstrap( () => "load", true );
		vi.spyOn( console, "error" ).mockImplementation( () => undefined );
		vi.stubGlobal( "fetch", vi.fn( () => { throw new Error( "fetch must not be called" ); } ) );
		( 0, eval )( source );

		expect( document.title ).toBe( "Unable to load UI" );
		expect( source ).not.toMatch( /\b(?:new Promise|fetch\s*\()/ );
	} );

	it( "settles when a deferred XDomainRequest send throws", async () => {
		prepareBootstrap( () => "load", true );
		vi.spyOn( console, "error" ).mockImplementation( () => undefined );
		class ThrowingXDomainRequest {
			responseText = "";
			timeout = 0;
			onload: null | ( () => void ) = null;
			onerror: null | ( () => void ) = null;
			ontimeout: null | ( () => void ) = null;
			onprogress: null | ( () => void ) = null;
			open(): void {}
			abort(): void {}
			send(): void { throw new Error( "XDR send failed" ); }
		}
		vi.stubGlobal( "XDomainRequest", ThrowingXDomainRequest );

		( 0, eval )( source );
		await vi.waitFor( () => expect( document.title ).toBe( "Unable to load UI" ) );
		expect( document.querySelector( ".feedback" )?.textContent ).toMatch( /Unable to load UI/ );
	} );

	it( "delegates login to the single-attempt firmware auth policy", () => {
		expect( source ).toContain( "OSApp.Firmware.verifyPassword( ver, pw, md5, homeCheckPW" );
		expect( source ).toContain( "callback( OSApp.Firmware.isValidPasswordResult( data ) )" );
		expect( source ).toMatch( /homeCheckPW[\s\S]*?url:[\s\S]*?timeout: 10000[\s\S]*?\} \)\.then/ );
		expect( source ).not.toContain( "var result = data.result" );
		expect( source ).not.toContain( "checkClear" );
	} );

	it( "rejects a downloaded shell without a body instead of dereferencing a missing match", () => {
		expect( source ).toContain( 'typeof data === "string" ? data.match' );
		expect( source ).toContain( "if ( !bodyMatch )" );
		expect( source ).toContain( 'showLoadError( new Error( "Downloaded index.html did not contain a body" ) )' );
		expect( source ).not.toContain( "data.match( /<body>([.\\s\\S]*)<\\/body>/ )[ 1 ]" );
	} );
} );

// @vitest-environment jsdom
/**
 * home.js bootstrap-loader test. Simulates the firmware's server_home output (globals + a
 * <script src=…/home.js>), evaluates the real app/public/home.js, and asserts it self-locates
 * its asset base and injects the dashboard module + CSS. This is the integration linchpin that
 * lets the firmware bootstrap load the modernized build.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, it, expect, vi } from "vitest";

// cwd-relative (jsdom env makes import.meta.url non-file://); vitest runs from the project root.
const homeSrc = readFileSync( resolve( process.cwd(), "app/public/home.js" ), "utf8" );
const bootstrapSrc = readFileSync( resolve( process.cwd(), "app/public/bootstrap.js" ), "utf8" );
const appMainSrc = readFileSync( resolve( process.cwd(), "app/main.ts" ), "utf8" );

function runHome( scriptSrc: string, settle = true ): void {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	( globalThis as Record<string, unknown> ).ver = 221;
	( globalThis as Record<string, unknown> ).ipas = 1;
	const s = document.createElement( "script" );
	s.setAttribute( "src", scriptSrc ); // home.js finds itself via querySelector on the src attribute
	document.body.appendChild( s );
	// eval in this scope so `document`/`window` resolve to jsdom globals; currentScript is null → fallback path
	( 0, eval )( homeSrc );
	if ( settle ) {
		document.querySelector( "link[rel=stylesheet]" )?.dispatchEvent( new Event( "load" ) );
		document.querySelector( "script[type=module]" )?.dispatchEvent( new Event( "load" ) );
	}
}

afterEach( () => {
	vi.useRealTimers();
	delete ( globalThis as typeof globalThis & { __OS_BOOTSTRAP_ABORTED__?: boolean } ).__OS_BOOTSTRAP_ABORTED__;
} );

describe( "home.js bootstrap loader", () => {
	it( "creates the #app mount and injects the dashboard bundle + css from the self-located base", () => {
		runHome( "https://ui.opensprinkler.com/js/home.js" );
		expect( document.getElementById( "app" ) ).not.toBeNull();
		const mod = document.querySelector( "script[type=module]" ) as HTMLScriptElement;
		expect( mod.src ).toBe( "https://ui.opensprinkler.com/js/assets/app.js" );
		const link = document.querySelector( "link[rel=stylesheet]" ) as HTMLLinkElement;
		expect( link.href ).toBe( "https://ui.opensprinkler.com/js/assets/app.css" );
	} );

	it( "strips a query string and works from a root path", () => {
		runHome( "https://cdn.example/home.js?v=2" );
		const mod = document.querySelector( "script[type=module]" ) as HTMLScriptElement;
		expect( mod.src ).toBe( "https://cdn.example/assets/app.js" );
	} );

	it( "strips a fragment from the bootstrap script URL", () => {
		runHome( "https://cdn.example/ui/home.js#v2" );
		const mod = document.querySelector( "script[type=module]" ) as HTMLScriptElement;
		expect( mod.src ).toBe( "https://cdn.example/ui/assets/app.js" );
	} );

	it( "does not duplicate the #app node if one already exists", () => {
		document.head.innerHTML = "";
		document.body.innerHTML = '<div id="app">x</div>';
		const s = document.createElement( "script" );
		s.setAttribute( "src", "https://x/js/home.js" );
		document.body.appendChild( s );
		( 0, eval )( homeSrc );
		expect( document.querySelectorAll( "#app" ).length ).toBe( 1 );
	} );

	it( "replaces the spinner with an accessible error when an asset fails", () => {
		runHome( "https://cdn.example/home.js", false );
		document.querySelector( "link[rel=stylesheet]" )?.dispatchEvent( new Event( "load" ) );
		const mod = document.querySelector( "script[type=module]" ) as HTMLScriptElement;
		mod.dispatchEvent( new Event( "error" ) );
		const app = document.getElementById( "app" )!;
		expect( app.getAttribute( "role" ) ).toBe( "alert" );
		expect( app.textContent ).toMatch( /application script failed/i );
	} );

	it( "never starts the application after its stylesheet fails", () => {
		runHome( "https://cdn.example/home.js", false );
		document.querySelector( "link[rel=stylesheet]" )?.dispatchEvent( new Event( "error" ) );
		expect( document.querySelector( "script[type=module]" ) ).toBeNull();
		expect( document.getElementById( "app" )?.getAttribute( "role" ) ).toBe( "alert" );
	} );

	it( "fails visibly when an asset request stalls", () => {
		vi.useFakeTimers();
		runHome( "https://cdn.example/home.js", false );
		vi.advanceTimersByTime( 15000 );
		expect( document.getElementById( "app" )?.textContent ).toMatch( /timed out/i );
		expect( document.querySelector( "link[rel=stylesheet]" ) ).toBeNull();
	} );

	it( "gives each asset a full timeout and removes a stalled module before it can load late", () => {
		vi.useFakeTimers();
		runHome( "https://cdn.example/home.js", false );
		vi.advanceTimersByTime( 14999 );
		document.querySelector( "link[rel=stylesheet]" )?.dispatchEvent( new Event( "load" ) );
		const mod = document.querySelector( "script[type=module]" ) as HTMLScriptElement;

		vi.advanceTimersByTime( 14999 );
		expect( document.getElementById( "app" )?.getAttribute( "role" ) ).not.toBe( "alert" );
		vi.advanceTimersByTime( 1 );
		expect( document.getElementById( "app" )?.textContent ).toMatch( /timed out/i );
		expect( document.querySelector( "script[type=module]" ) ).toBeNull();
		expect( ( globalThis as typeof globalThis & { __OS_BOOTSTRAP_ABORTED__?: boolean } ).__OS_BOOTSTRAP_ABORTED__ ).toBe( true );
		expect( appMainSrc ).toMatch( /if \( !bootstrapAborted \) \{\s*boot\(\)\.catch/ );

		mod.dispatchEvent( new Event( "load" ) );
		expect( document.getElementById( "app" )?.getAttribute( "role" ) ).toBe( "alert" );
	} );
} );

describe( "standalone bootstrap parameters", () => {
	it( "captures controller/companion bases and scrubs URL secrets before module loading", () => {
		history.replaceState( {}, "", "/?base=" + encodeURIComponent( "https://cloud.example/forward/v1/T/" ) +
			"&companion=" + encodeURIComponent( "https://companion.example/" ) + "&pwhash=SECRET&keep=1" +
			"#companionToken=BEARER_SECRET" );
		( 0, eval )( bootstrapSrc );
		const config = ( globalThis as typeof globalThis & { __OS_BOOTSTRAP__?: {
			deviceBase?: string; companionBase?: string; companionToken?: string;
		} } ).__OS_BOOTSTRAP__;
		expect( config ).toEqual( {
			deviceBase: "https://cloud.example/forward/v1/T/",
			companionBase: "https://companion.example/",
			companionToken: "BEARER_SECRET",
		} );
		expect( location.search ).toBe( "?keep=1" );
		expect( location.href ).not.toContain( "SECRET" );
		delete ( globalThis as typeof globalThis & { __OS_BOOTSTRAP__?: unknown } ).__OS_BOOTSTRAP__;
	} );
} );

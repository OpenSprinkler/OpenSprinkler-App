// @vitest-environment jsdom
/**
 * home.js bootstrap-loader test. Simulates the firmware's server_home output (globals + a
 * <script src=…/home.js>), evaluates the real app/public/home.js, and asserts it self-locates
 * its asset base and injects the dashboard module + CSS. This is the integration linchpin that
 * lets the firmware bootstrap load the modernized build.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

// cwd-relative (jsdom env makes import.meta.url non-file://); vitest runs from the project root.
const homeSrc = readFileSync( resolve( process.cwd(), "app/public/home.js" ), "utf8" );

function runHome( scriptSrc: string ): void {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	( globalThis as Record<string, unknown> ).ver = 221;
	( globalThis as Record<string, unknown> ).ipas = 1;
	const s = document.createElement( "script" );
	s.setAttribute( "src", scriptSrc ); // home.js finds itself via querySelector on the src attribute
	document.body.appendChild( s );
	// eval in this scope so `document`/`window` resolve to jsdom globals; currentScript is null → fallback path
	( 0, eval )( homeSrc );
}

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

	it( "does not duplicate the #app node if one already exists", () => {
		document.head.innerHTML = "";
		document.body.innerHTML = '<div id="app">x</div>';
		const s = document.createElement( "script" );
		s.setAttribute( "src", "https://x/js/home.js" );
		document.body.appendChild( s );
		( 0, eval )( homeSrc );
		expect( document.querySelectorAll( "#app" ).length ).toBe( 1 );
	} );
} );

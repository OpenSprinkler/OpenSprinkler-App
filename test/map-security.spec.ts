import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

interface ButtonStub {
	tagName: "BUTTON";
	className: string;
	dataset: { loc: string; id?: string };
	disabled: boolean;
}

function loadMap( results: unknown[], status = "OK", options: {
	referrer?: string; crossOriginParent?: boolean; initialize?: boolean;
} = {} ) {
	let click: ( event: { target: ButtonStub } ) => void = () => {};
	const postMessage = vi.fn();
	const script: { onerror?: () => void } = {};
	const geocode = vi.fn( ( _request: unknown, callback: ( value: unknown[], state: string ) => void ) => {
		callback( results, status );
	} );
	const documentStub = {
		referrer: options.referrer ?? "https://controller.example/options",
		head: { appendChild: vi.fn() },
		createElement: vi.fn( () => script ),
		addEventListener: vi.fn( ( type: string, handler: typeof click ) => {
			if ( type === "click" ) click = handler;
		} ),
	};
	const parent: Record<string, unknown> = { postMessage };
	if ( options.crossOriginParent ) {
		Object.defineProperty( parent, "location", { get: () => { throw new Error( "cross-origin" ); } } );
	} else {
		parent.location = { origin: "https://controller.example" };
	}
	const windowStub: Record<string, unknown> = {
		parent,
		location: { origin: "https://ui.opensprinkler.com" },
	};
	const google = {
		maps: {
			Geocoder: function Geocoder() { return { geocode }; },
		},
	};
	runInNewContext( readFileSync( resolve( "www/js/map.js" ), "utf8" ), {
		window: windowStub, document: documentStub, google, URL, console,
		setTimeout, clearTimeout, Number, String, Array,
	} );
	if ( options.initialize !== false ) ( windowStub.initMap as () => void )();
	return { click, geocode, postMessage, script };
}

describe( "legacy map key and messaging boundary", () => {
	it( "reverse geocodes through the Maps JavaScript client and returns the label to its authenticated parent", () => {
		const map = loadMap( [ {
			types: [ "locality" ], formatted_address: "Chicago, IL, USA",
		} ] );
		const button: ButtonStub = {
			tagName: "BUTTON", className: "submit", dataset: { loc: "41.8819,-87.6278" }, disabled: false,
		};
		map.click( { target: button } );

		expect( map.geocode ).toHaveBeenCalledWith( {
			location: { lat: 41.8819, lng: -87.6278 },
		}, expect.any( Function ) );
		expect( map.postMessage ).toHaveBeenCalledWith( {
			WS: "41.8819,-87.6278", locationName: "Chicago, IL, USA",
		}, "https://controller.example" );
		expect( button.disabled ).toBe( false );
	} );

	it( "falls back to coordinates when geocoding fails and rejects malformed selections", () => {
		const map = loadMap( [], "ZERO_RESULTS" );
		map.click( { target: {
			tagName: "BUTTON", className: "submitPWS", dataset: { loc: "41,-87", id: "PWS-1" }, disabled: false,
		} } );
		expect( map.postMessage ).toHaveBeenLastCalledWith( {
			WS: "41,-87", station: "PWS-1",
		}, "https://controller.example" );

		map.postMessage.mockClear();
		map.click( { target: {
			tagName: "BUTTON", className: "submit", dataset: { loc: "999,-87" }, disabled: false,
		} } );
		expect( map.postMessage ).not.toHaveBeenCalled();
	} );

	it( "keeps source-checked wildcard messaging when a cross-origin parent suppresses Referrer", () => {
		const map = loadMap( [], "ZERO_RESULTS", { referrer: "", crossOriginParent: true } );
		map.click( { target: {
			tagName: "BUTTON", className: "submit", dataset: { loc: "41,-87" }, disabled: false,
		} } );
		expect( map.postMessage ).toHaveBeenCalledWith( { WS: "41,-87" }, "*" );
	} );

	it( "signals a Maps script failure to the authenticated parent origin", () => {
		const map = loadMap( [], "ZERO_RESULTS", { initialize:false } );
		map.script.onerror?.();
		expect( map.postMessage ).toHaveBeenCalledWith( { mapError:true }, "https://controller.example" );
	} );
} );

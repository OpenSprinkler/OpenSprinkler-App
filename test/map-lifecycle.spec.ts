import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

interface InteractiveMap {
	markerOptions: Array<{ icon: string; position: { lat: () => number; lng: () => number } }>;
	markerInstances: Array<{ setMap: ReturnType<typeof vi.fn> }>;
	mapSetCenter: ReturnType<typeof vi.fn>;
	postMessage: ReturnType<typeof vi.fn>;
	setPlaces: ( places: unknown[] | undefined ) => void;
	triggerPlaces: () => void;
	triggerTilesLoaded: () => void;
	send: ( data: unknown, source?: object, origin?: string ) => void;
}

function loadInteractiveMap(): InteractiveMap {
	const parent = {
		location: { origin: "https://controller.example" },
		postMessage: vi.fn(),
	};
	const markerOptions: InteractiveMap["markerOptions"] = [];
	const markerInstances: InteractiveMap["markerInstances"] = [];
	const mapSetCenter = vi.fn();
	const mapControls: unknown[] = [];
	const mapListeners: Record<string, () => void> = {};
	let places: unknown[] | undefined = [];
		let placesChanged: () => void = () => {};
		let tilesLoaded: () => void = () => {};

	function LatLng( this: { lat: () => number; lng: () => number }, lat: number, lng: number ): void {
		this.lat = () => lat;
		this.lng = () => lng;
	}

	const map = {
		controls: { TOP_LEFT: mapControls },
		addListener: vi.fn( ( type: string, callback: () => void ) => {
			mapListeners[ type ] = callback;
		} ),
		getBounds: vi.fn( () => ( {} ) ),
		getCenter: vi.fn( () => new ( LatLng as unknown as new ( lat: number, lng: number ) => { lat: () => number; lng: () => number } )( 0, 0 ) ),
		getZoom: vi.fn( () => 14 ),
		setCenter: mapSetCenter,
	};
	const searchBox = {
		addListener: vi.fn( ( type: string, callback: () => void ) => {
			if ( type === "places_changed" ) placesChanged = callback;
		} ),
		getPlaces: vi.fn( () => places ),
		setBounds: vi.fn(),
	};
	const elements: Record<string, unknown> = {
		customControls: { style: {} },
		jumpCurrent: { addEventListener: vi.fn() },
		map_canvas: {},
		"pac-input": {},
	};
	const documentStub = {
		referrer: "https://controller.example/options",
		head: { appendChild: vi.fn() },
		createElement: vi.fn( () => ( {} ) ),
		createTextNode: vi.fn( () => ( {} ) ),
		addEventListener: vi.fn(),
		getElementById: vi.fn( ( id: string ) => elements[ id ] ),
		querySelectorAll: vi.fn( () => [] ),
	};
	const windowStub: Record<string, unknown> = {
		parent,
		location: { origin: "https://ui.opensprinkler.com" },
	};
	const google = {
		maps: {
			ControlPosition: { LEFT_BOTTOM: "LEFT_BOTTOM", TOP_LEFT: "TOP_LEFT" },
			Geocoder: function Geocoder() { return { geocode: vi.fn() }; },
			InfoWindow: function InfoWindow() { return { close: vi.fn(), open: vi.fn() }; },
			LatLng,
			Map: function Map() { return map; },
			MapTypeId: { ROADMAP: "ROADMAP" },
			Marker: function Marker( options: InteractiveMap["markerOptions"][ number ] ) {
				markerOptions.push( options );
				const marker = { getPosition: () => options.position, setMap: vi.fn() };
				markerInstances.push( marker );
				return marker;
			},
			event: {
				addListener: vi.fn(),
				addListenerOnce: vi.fn( ( _target: unknown, type: string, callback: () => void ) => {
					if ( type === "tilesloaded" ) tilesLoaded = callback;
				} ),
				trigger: vi.fn(),
			},
			places: {
				SearchBox: function SearchBox() { return searchBox; },
			},
		},
	};

	runInNewContext( readFileSync( resolve( "www/js/map.js" ), "utf8" ), {
		window: windowStub, document: documentStub, google, URL, console,
		navigator: { userAgent: "iPhone" }, setTimeout, clearTimeout,
		Number, String, Array, JSON, Math, encodeURIComponent, decodeURIComponent,
	} );
	( windowStub.initMap as () => void )();

	return {
		markerOptions,
		markerInstances,
		mapSetCenter,
		postMessage: parent.postMessage,
		setPlaces: ( value ) => { places = value; },
		triggerPlaces: () => placesChanged(),
		triggerTilesLoaded: () => tilesLoaded(),
		send: ( data, source = parent, origin = "https://controller.example" ) => {
			( windowStub.onmessage as ( event: { data: unknown; source: object; origin: string } ) => void )( {
				data, source, origin,
			} );
		},
	};
}

function pwsData( stations: unknown[] ): { type: string; payload: string } {
	return { type: "pwsData", payload: encodeURIComponent( JSON.stringify( stations ) ) };
}

describe( "legacy map iframe lifecycle", () => {
	it( "authenticates and caches the latest PWS data until the map loaded handshake", () => {
		const frame = loadInteractiveMap();

		frame.send( pwsData( [ { id: "rogue", lat: 1, lon: 2, message: "rogue" } ] ), {} );
		frame.send( pwsData( [ { id: "old", lat: 10, lon: 20, message: "old" } ] ) );
		frame.send( pwsData( [ { id: "latest", lat: 30, lon: 40, message: "latest" } ] ) );
		expect( frame.markerOptions ).toHaveLength( 0 );

		frame.send( { type: "startLocation", payload: { start: { lat:0, lon:0 } } } );
		expect( frame.markerOptions ).toHaveLength( 0 );

		frame.triggerTilesLoaded();
		expect( frame.postMessage ).toHaveBeenCalledWith( { loaded:true }, "https://controller.example" );
		expect( frame.markerOptions ).toHaveLength( 1 );
		expect( frame.markerOptions[ 0 ].position.lat() ).toBe( 30 );
		expect( frame.markerOptions[ 0 ].position.lng() ).toBe( 40 );

		frame.send( pwsData( [ { id: "new", lat: 50, lon: 60, message: "new" } ] ) );
		expect( frame.markerInstances[ 0 ].setMap ).toHaveBeenCalledWith( null );
		expect( frame.markerOptions ).toHaveLength( 2 );
		expect( frame.markerOptions[ 1 ].position.lat() ).toBe( 50 );
	} );

	it( "ignores incomplete SearchBox places and tolerates a missing iOS prediction container", () => {
		const frame = loadInteractiveMap();
		frame.send( { type: "startLocation", payload: { start: { lat:0, lon:0 } } } );

		for ( const value of [ undefined, [], [ {} ], [ { geometry:{} } ],
			[ { geometry:{ location:null } } ], [ { geometry:{ location:{ lat:1, lng:2 } } } ],
			[ { geometry:{ location:{ lat:() => Number.POSITIVE_INFINITY, lng:() => 1 } } } ] ] ) {
			frame.setPlaces( value );
			expect( () => frame.triggerPlaces() ).not.toThrow();
		}
		expect( frame.markerOptions ).toHaveLength( 0 );

		frame.setPlaces( [ { geometry:{ location:{ lat:() => 41.8, lng:() => -87.6 } } } ] );
		frame.triggerPlaces();
		expect( frame.markerOptions ).toHaveLength( 1 );
		expect( frame.mapSetCenter ).toHaveBeenCalledOnce();

		expect( () => frame.triggerTilesLoaded() ).not.toThrow();
	} );
} );

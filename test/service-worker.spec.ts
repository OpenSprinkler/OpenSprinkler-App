import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerEvent = { request?: Request; respondWith?: ReturnType<typeof vi.fn>; waitUntil?: ReturnType<typeof vi.fn> };

function loadWorker( cacheKeys: string[] = [] ) {
	const handlers = new Map<string, ( event: WorkerEvent ) => void>();
	const addAll = vi.fn( async ( _files: string[] ) => undefined );
	const cache = {
		addAll,
		match: vi.fn( async (): Promise<Response | undefined> => undefined ),
		put: vi.fn( async () => undefined ),
	};
	const caches = {
		open: vi.fn( async () => cache ),
		match: vi.fn( async () => undefined ),
		keys: vi.fn( async () => cacheKeys ),
		delete: vi.fn( async () => true ),
	};
	const self = {
		location: { origin: "https://ui.example" },
		clients: { claim: vi.fn( async () => undefined ) },
		skipWaiting: vi.fn( async () => undefined ),
		addEventListener: ( name: string, callback: ( event: WorkerEvent ) => void ) => handlers.set( name, callback ),
	};
	const source = readFileSync( resolve( "www/sw.js" ), "utf8" );
	const fetch = vi.fn( async () => new Response( "asset", { status: 200 } ) );
	runInNewContext( source, { self, caches, fetch, URL, console } );
	return { handlers, addAll, cache, caches, fetch };
}

describe( "legacy service worker", () => {
	it( "pre-caches only files that exist in the published www tree", async () => {
		const { handlers, addAll } = loadWorker();
		let install: Promise<unknown> | undefined;
		handlers.get( "install" )!( { waitUntil: vi.fn( ( value ) => { install = value; } ) } );
		await install;
		const files = addAll.mock.calls[ 0 ]![ 0 ];

		expect( files ).toContain( "/vendor-js/apexcharts.min.js" );
		expect( files ).toContain( "/vendor-js/jquery-migrate.min.js" );
		expect( files.filter( ( file ) => !existsSync( resolve( "www", file.slice( 1 ) ) ) ) ).toEqual( [] );
		const manifest = JSON.parse( readFileSync( resolve( "www/modules.json" ), "utf8" ) ) as string[];
		for ( const module of manifest ) expect( files ).toContain( `/js/modules/${ module }` );
	} );

	it( "keeps the direct-development module manifest synchronized with module sources", () => {
		const manifest = JSON.parse( readFileSync( resolve( "www/modules.json" ), "utf8" ) ) as string[];
		const modules = readdirSync( resolve( "www/js/modules" ) ).filter( ( file ) => file.endsWith( ".js" ) ).sort();
		expect( manifest ).toEqual( modules );
	} );

	it( "keeps the release-replaced cache version marker", () => {
		const source = readFileSync( resolve( "www/sw.js" ), "utf8" );
		expect( source ).toMatch( /var cacheName = "OpenSprinkler-v\d+\.\d+\.\d+";/ );
	} );

	it( "intercepts only allowlisted static assets, never controller/API/unknown/query requests", async () => {
		const { handlers } = loadWorker();
		const fetchHandler = handlers.get( "fetch" )!;
		const bypassed = [
			new Request( "https://ui.example/cv", { method: "POST" } ),
			new Request( "https://ui.example/jc" ),
			new Request( "https://ui.example/mp?pid=2" ),
			new Request( "https://ui.example/pq" ),
			new Request( "https://ui.example/ja" ),
			new Request( "https://ui.example/se" ),
			new Request( "https://ui.example/api/history" ),
			new Request( "https://ui.example/future-firmware-endpoint" ),
			new Request( "https://ui.example/js/main.js?pw=secret" ),
			new Request( "http://controller.local/jo" ),
		];
		for ( const request of bypassed ) {
			const respondWith = vi.fn();
			fetchHandler( { request, respondWith } );
			expect( respondWith ).not.toHaveBeenCalled();
		}

		let responsePromise: Promise<Response> | undefined;
		const respondWith = vi.fn( ( value: Promise<Response> ) => { responsePromise = value; } );
		fetchHandler( { request: new Request( "https://ui.example/js/main.js" ), respondWith } );
		expect( respondWith ).toHaveBeenCalledOnce();
		await responsePromise;
	} );

	it( "deletes only obsolete OpenSprinkler caches on activation", async () => {
		const { handlers, caches } = loadWorker( [ "OpenSprinkler-v0.0.0", "OpenSprinkler-v-old", "another-app-cache" ] );
		let activation: Promise<unknown> | undefined;
		handlers.get( "activate" )!( { waitUntil: vi.fn( ( value ) => { activation = value; } ) } );
		await activation;
		expect( caches.delete ).toHaveBeenCalledWith( "OpenSprinkler-v-old" );
		expect( caches.delete ).not.toHaveBeenCalledWith( "another-app-cache" );
	} );

	it( "never reads navigation fallbacks from another cache namespace", async () => {
		const { handlers, cache, caches, fetch } = loadWorker();
		fetch.mockRejectedValueOnce( new Error( "offline" ) );
		cache.match.mockResolvedValueOnce( new Response( "offline index" ) );
		let responsePromise: Promise<Response> | undefined;
		handlers.get( "fetch" )!( {
			request: { method: "GET", mode: "navigate", url: "https://ui.example/route" } as Request,
			respondWith: vi.fn( ( value: Promise<Response> ) => { responsePromise = value; } ),
		} );
		expect( await ( await responsePromise )?.text() ).toBe( "offline index" );
		expect( cache.match ).toHaveBeenCalledWith( "/index.html" );
		expect( caches.match ).not.toHaveBeenCalled();
	} );
} );

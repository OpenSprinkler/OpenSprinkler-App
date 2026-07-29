import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Hono } from "hono";
import {
	attachServerErrorShutdown, cleanupAfterStartupFailure, createGracefulShutdown, waitForServerListening,
} from "../../server/lifecycle";
import { createHttpApp } from "../../server/http";
import { Poller } from "../../server/poller";
import type { StorageProvider } from "../../server/storage/provider";

describe( "createGracefulShutdown", () => {
	it( "is idempotent and closes storage only after poller and HTTP drain", async () => {
		const events: string[] = [];
		let releasePoller!: () => void;
		let releaseServer!: () => void;
		const poller = {
			stop: async () => { events.push( "poller-stop" ); await new Promise<void>( ( resolve ) => { releasePoller = resolve; } ); },
		} as Poller;
		const server = {
			close: ( callback: ( error?: Error ) => void ) => { events.push( "server-close" ); releaseServer = () => callback(); },
		};
		const store = {
			close: async () => { events.push( "store-close" ); },
		} as StorageProvider;
		const shutdown = createGracefulShutdown( { poller, server, store, serverCloseTimeoutMs: 1000 } );
		const first = shutdown();
		const second = shutdown();
		expect( second ).toBe( first );
		expect( events ).toEqual( [ "poller-stop", "server-close" ] );
		releasePoller(); releaseServer();
		await first;
		expect( events ).toEqual( [ "poller-stop", "server-close", "store-close" ] );
		await shutdown();
		expect( events ).toHaveLength( 3 );
	} );

	it( "bounds an in-flight cycle that ignores cancellation without closing its live storage", async () => {
		vi.useFakeTimers();
		try {
			const poller = new Poller( async () => new Promise<void>( () => {} ), 300 );
			void poller.runNow();
			await Promise.resolve();
			let closed = false;
			const shutdown = createGracefulShutdown( {
				poller,
				server: { close: ( callback ) => callback() },
				store: { close: async () => { closed = true; } } as StorageProvider,
				pollerStopTimeoutMs: 25, serverCloseTimeoutMs: 25,
			} )();
			const assertion = expect( shutdown ).rejects.toThrow( /poller drain timed out after 25ms/i );
			await vi.advanceTimersByTimeAsync( 25 );
			await assertion;
			expect( closed ).toBe( false );
		} finally { vi.useRealTimers(); }
	} );

	it( "never closes storage beneath a timed-out cycle that later resumes", async () => {
		vi.useFakeTimers();
		try {
			let release!: () => void;
			const gate = new Promise<void>( ( resolve ) => { release = resolve; } );
			let closed = false;
			let writes = 0;
			const poller = new Poller( async () => {
				await gate; // deliberately ignore AbortSignal
				if ( closed ) throw new Error( "write after close" );
				writes++;
			}, 300 );
			const run = poller.runNow();
			await Promise.resolve();
			const shutdown = createGracefulShutdown( {
				poller,
				server: { close: ( callback ) => callback() },
				store: { close: async () => { closed = true; } } as StorageProvider,
				pollerStopTimeoutMs: 25, serverCloseTimeoutMs: 25,
			} )();
			const assertion = expect( shutdown ).rejects.toThrow( /poller drain timed out after 25ms/i );
			await vi.advanceTimersByTimeAsync( 25 );
			await assertion;
			expect( closed ).toBe( false );
			release();
			await run;
			expect( writes ).toBe( 1 );
		} finally { vi.useRealTimers(); }
	} );

	it( "refuses new HTTP work and never closes storage beneath a timed-out route", async () => {
		vi.useFakeTimers();
		try {
			let routeStarted!: () => void;
			const started = new Promise<void>( ( resolve ) => { routeStarted = resolve; } );
			let release!: () => void;
			const gate = new Promise<void>( ( resolve ) => { release = resolve; } );
			let closed = false;
			let reads = 0;
			const api = new Hono().get( "/slow", async ( c ) => {
				routeStarted();
				await gate; // deliberately ignore the disconnected client and continue the handler
				if ( closed ) throw new Error( "read after close" );
				reads++;
				return c.json( { ok: true } );
			} );
			const app = createHttpApp( api );
			const request = app.request( "/api/slow" );
			await started;

			const shutdown = createGracefulShutdown( {
				poller: null, requestDrain: app.requestDrain,
				server: { close: ( callback ) => callback(), closeAllConnections: () => {} },
				store: { close: async () => { closed = true; } } as StorageProvider,
				requestDrainTimeoutMs: 25, serverCloseTimeoutMs: 25,
			} )();
			const assertion = expect( shutdown ).rejects.toThrow( /HTTP request drain timed out after 25ms/i );
			await vi.advanceTimersByTimeAsync( 25 );
			await assertion;
			expect( closed ).toBe( false );
			expect( ( await app.request( "/api/slow" ) ).status ).toBe( 503 );

			release();
			expect( ( await request ).status ).toBe( 200 );
			expect( reads ).toBe( 1 );
		} finally { vi.useRealTimers(); }
	} );

	it( "drains an in-flight retention task before closing storage", async () => {
		const events: string[] = [];
		let release!: () => void;
		const pruner = new Poller( async () => {
			events.push( "prune-start" );
			await new Promise<void>( ( resolve ) => { release = resolve; } );
			events.push( "prune-end" );
		}, 86400 );
		const run = pruner.runNow();
		await Promise.resolve();
		const shutdown = createGracefulShutdown( {
			poller: null, pruner,
			server: { close: ( callback ) => callback() },
			store: { close: async () => { events.push( "store-close" ); } } as StorageProvider,
		} )();
		await Promise.resolve();
		expect( events ).toEqual( [ "prune-start" ] );
		release();
		await Promise.all( [ run, shutdown ] );
		expect( events ).toEqual( [ "prune-start", "prune-end", "store-close" ] );
	} );

	it( "cleans up a started poller and open store after listener startup fails", async () => {
		const events: string[] = [];
		const poller = new Poller( async () => { events.push( "cycle" ); }, 300 );
		poller.start();
		await Promise.resolve();
		await cleanupAfterStartupFailure( {
			poller,
			store: { close: async () => { events.push( "store-close" ); } } as StorageProvider,
		} );
		await poller.runNow();
		expect( events ).toEqual( [ "cycle", "store-close" ] );
	} );

	it( "rejects an asynchronous listener startup error before reporting ready", async () => {
		const server = Object.assign( new EventEmitter(), {
			listening: false,
			close: ( callback: ( error?: Error ) => void ) => callback(),
		} );
		const failure = new Error( "listen EADDRINUSE: address already in use" );
		const ready = waitForServerListening( server );
		server.emit( "error", failure );
		await expect( ready ).rejects.toBe( failure );
		expect( server.listenerCount( "error" ) ).toBe( 0 );
		expect( server.listenerCount( "listening" ) ).toBe( 0 );
	} );

	it( "resolves readiness only after the server emits listening", async () => {
		const server = Object.assign( new EventEmitter(), {
			listening: false,
			close: ( callback: ( error?: Error ) => void ) => callback(),
		} );
		let ready = false;
		const wait = waitForServerListening( server ).then( () => { ready = true; } );
		await Promise.resolve();
		expect( ready ).toBe( false );
		server.emit( "listening" );
		await wait;
		expect( ready ).toBe( true );
		expect( server.listenerCount( "error" ) ).toBe( 0 );
	} );

	it( "keeps the permanent shutdown listener across the bind-readiness transition", async () => {
		const server = Object.assign( new EventEmitter(), {
			listening: false,
			close: ( callback: ( error?: Error ) => void ) => callback(),
		} );
		const shutdown = vi.fn();
		const onError = vi.fn();
		const markFailure = vi.fn();

		// Production installs the permanent listener immediately after serve(), before it awaits
		// readiness. The temporary readiness listener must be the only one removed on `listening`.
		attachServerErrorShutdown( server, shutdown, { onError, markFailure } );
		const ready = waitForServerListening( server );
		expect( server.listenerCount( "error" ) ).toBe( 2 );
		server.emit( "listening" );
		await ready;
		expect( server.listenerCount( "error" ) ).toBe( 1 );

		const failure = new Error( "post-bind accept failed" );
		server.emit( "error", failure );
		expect( onError ).toHaveBeenCalledWith( failure );
		expect( markFailure ).toHaveBeenCalledOnce();
		expect( shutdown ).toHaveBeenCalledOnce();
	} );

	it( "turns a post-bind server error into one failure-marked bounded shutdown", () => {
		const server = new EventEmitter();
		const shutdown = vi.fn();
		const onError = vi.fn();
		const markFailure = vi.fn();
		attachServerErrorShutdown( server, shutdown, { onError, markFailure } );
		const first = new Error( "accept failed" );
		server.emit( "error", first );
		server.emit( "error", new Error( "shutdown socket error" ) );
		expect( markFailure ).toHaveBeenCalledTimes( 1 );
		expect( onError ).toHaveBeenCalledWith( first );
		expect( shutdown ).toHaveBeenCalledTimes( 1 );
	} );
} );

import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { SqliteStorageProvider } from "./storage/sqlite";
import { ControllerCollector, controllerLogSummary } from "./controller";
import { buildRuntime } from "./runtime";
import { Poller } from "./poller";
import {
	attachServerErrorShutdown, createGracefulShutdown, createStartupAwareShutdownHandler,
	waitForServerListening,
} from "./lifecycle";

// Database, WAL, and any diagnostic files created by the direct process must be owner-only.
process.umask( 0o077 );

async function main(): Promise<void> {
	// Register before config, SQLite migration/VACUUM, or poller startup. An early signal is held until
	// the resources acquired so far can be handed to the same bounded cleanup used after startup.
	const startupShutdown = createStartupAwareShutdownHandler();
	process.once( "SIGINT", startupShutdown.handleSignal );
	process.once( "SIGTERM", startupShutdown.handleSignal );

	let store: SqliteStorageProvider | null = null;
	let runtime: Awaited<ReturnType<typeof buildRuntime>> | null = null;
	let pruner: Poller | null = null;
	let server: ReturnType<typeof serve> | null = null;
	let shutdown: ( () => Promise<void> ) | null = null;
	let shutdownConfigured = false;
	const ownedShutdown = (): ( () => Promise<void> ) => {
		if ( !store ) return async () => {};
		return createGracefulShutdown( {
			poller: runtime?.poller ?? null,
			pruner,
			requestDrain: runtime?.requestDrain,
			server: server ?? { close: ( callback ) => callback() },
			store,
		} );
	};
	const handoffShutdown = ( next: () => Promise<void> ): void => {
		shutdown = next;
		startupShutdown.setShutdown( next );
		shutdownConfigured = true;
	};

	try {
		const config = loadConfig();
		const initializedStore = new SqliteStorageProvider( config.databasePath );
		store = initializedStore;
		const collector = new ControllerCollector( config, initializedStore );
		runtime = await buildRuntime( {
			config, store: initializedStore, startPoller: true,
			cycle: ( signal ) => collector.cycle( signal ).then( () => undefined ),
		} );
		if ( startupShutdown.isRequested() ) {
			handoffShutdown( ownedShutdown() );
			return;
		}

		pruner = runtime.dbOk ? new Poller( async ( signal ) => {
			if ( signal.aborted ) return;
			await initializedStore.pruneTelemetry( Math.floor( Date.now() / 1000 ) - config.historyMaxDays * 86400 );
		}, 86400 ) : null;
		pruner?.start( false ); // startup already pruned; first retention pass is one day later
		server = serve( { fetch: runtime.app.fetch, port: config.port, hostname: config.listenHost } );
		// Install the permanent listener before bind readiness removes its temporary error listener.
		// The startup-aware handler can safely wait for the cleanup closure if an early error fires.
		attachServerErrorShutdown( server, startupShutdown.handleSignal );
		await waitForServerListening( server );
		handoffShutdown( ownedShutdown() );
		if ( startupShutdown.isRequested() ) return;
		console.log( `[companion] listening on ${ config.listenHost }:${ config.port }, polling ${ controllerLogSummary( config.controllerBase, collector.controllerId ) }` );
	} catch ( error ) {
		shutdown ??= ownedShutdown();
		if ( !shutdownConfigured ) handoffShutdown( shutdown );
		// The bounded signal handler owns cleanup + exit once a signal has arrived. Do not race it.
		if ( startupShutdown.isRequested() ) return;
		try {
			await shutdown();
		} catch ( cleanupError ) {
			throw new AggregateError( [ error, cleanupError ], "companion startup and cleanup both failed" );
		}
		throw error;
	}
}

void main().catch( ( error ) => { console.error( "[companion] fatal:", error ); process.exit( 1 ); } );

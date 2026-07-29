import type { Poller } from "./poller";
import type { StorageProvider } from "./storage/provider";
import type { EventEmitter } from "node:events";

export interface ClosableServer {
	close( callback: ( error?: Error ) => void ): unknown;
	closeAllConnections?(): void;
}

type StartingServer = ClosableServer & Pick<EventEmitter, "once" | "off"> & { listening?: boolean };

/** Keep post-bind server errors from becoming an unhandled EventEmitter crash without cleanup. */
export function attachServerErrorShutdown(
	server: Pick<EventEmitter, "on">,
	shutdown: () => void,
	options: { onError?: ( error: unknown ) => void; markFailure?: () => void } = {},
): void {
	let started = false;
	server.on( "error", ( error: unknown ) => {
		// Retain the listener during shutdown so a second server error is consumed, but report and start
		// the idempotent shutdown sequence only once.
		if ( started ) return;
		started = true;
		( options.markFailure ?? ( () => { process.exitCode = 1; } ) )();
		( options.onError ?? ( ( cause: unknown ) => console.error( "[companion] HTTP server failed:", cause ) ) )( error );
		shutdown();
	} );
}

/** Wait until a newly-created Node server really owns its socket; early listen errors are async. */
export async function waitForServerListening( server: StartingServer ): Promise<void> {
	if ( server.listening ) return;
	await new Promise<void>( ( resolve, reject ) => {
		const cleanup = (): void => {
			server.off( "listening", onListening );
			server.off( "error", onError );
		};
		const onListening = (): void => { cleanup(); resolve(); };
		const onError = ( error: Error ): void => { cleanup(); reject( error ); };
		server.once( "listening", onListening );
		server.once( "error", onError );
	} );
}

async function closeServer( server: ClosableServer, timeoutMs: number ): Promise<void> {
	await new Promise<void>( ( resolve, reject ) => {
		let settled = false;
		const finish = ( error?: Error ): void => {
			if ( settled ) return;
			settled = true;
			clearTimeout( timeout );
			if ( error && ( error as NodeJS.ErrnoException ).code !== "ERR_SERVER_NOT_RUNNING" ) reject( error );
			else resolve();
		};
		const timeout = setTimeout( () => {
			server.closeAllConnections?.();
			finish();
		}, timeoutMs );
		timeout.unref?.();
		try { server.close( finish ); } catch ( error ) { finish( error as Error ); }
	} );
}

/** Build an idempotent shutdown that drains poll/retention/HTTP work before closing storage. */
export function createGracefulShutdown( deps: {
	poller: Poller | null;
	pruner?: Poller | null;
	requestDrain?: { stop( timeoutMs?: number ): Promise<void> };
	server: ClosableServer;
	store: StorageProvider;
	serverCloseTimeoutMs?: number;
	pollerStopTimeoutMs?: number;
	requestDrainTimeoutMs?: number;
} ): () => Promise<void> {
	let pending: Promise<void> | null = null;
	return () => {
		if ( pending ) return pending;
		pending = ( async () => {
			const results = await Promise.allSettled( [
				deps.poller?.stop( deps.pollerStopTimeoutMs ?? 5000 ) ?? Promise.resolve(),
				deps.pruner?.stop( deps.pollerStopTimeoutMs ?? 5000 ) ?? Promise.resolve(),
				// stop() flips HTTP to non-accepting synchronously before closeServer starts.
				deps.requestDrain?.stop( deps.requestDrainTimeoutMs ?? 5000 ) ?? Promise.resolve(),
				closeServer( deps.server, deps.serverCloseTimeoutMs ?? 5000 ),
			] );
			const operationError = results.find(
				( result ): result is PromiseRejectedResult => result.status === "rejected",
			)?.reason;
			// A timed-out poll remains live inside this process. Closing its shared store here would
			// create a close/use race if the cancellation-ignoring cycle later resumes. Leave SQLite
			// open for the process-exit path; the OS can release it safely once the watchdog terminates.
			if ( operationError ) throw operationError;
			let closeError: unknown;
			try { await deps.store.close(); } catch ( error ) { closeError = error; }
			if ( closeError ) throw closeError;
		} )();
		return pending;
	};
}

/** Release resources initialized before the HTTP listener when startup fails. */
export async function cleanupAfterStartupFailure( deps: {
	poller: Poller | null;
	pruner?: Poller | null;
	store: StorageProvider;
	pollerStopTimeoutMs?: number;
} ): Promise<void> {
	await createGracefulShutdown( {
		poller: deps.poller,
		pruner: deps.pruner,
		store: deps.store,
		pollerStopTimeoutMs: deps.pollerStopTimeoutMs,
		server: { close: ( callback ) => callback() },
	} )();
}

/**
 * Adapt a shutdown promise to a signal handler with a true upper bound. Merely assigning
 * `process.exitCode` cannot stop a cancellation-ignoring socket/timer from keeping Node alive.
 */
export function createBoundedShutdownHandler( deps: {
	shutdown: () => Promise<void>;
	hardExitAfterMs?: number;
	hardExit?: ( code: number ) => void;
	exitAfterDrain?: ( code: number ) => void;
	getExitCode?: () => number | undefined;
	onError?: ( error: unknown ) => void;
} ): () => void {
	let started = false;
	return () => {
		if ( started ) return;
		started = true;
		let finished = false;
		const hardExit = deps.hardExit ?? ( ( code: number ) => process.exit( code ) );
		const exitAfterDrain = deps.exitAfterDrain ?? ( ( code: number ) => process.exit( code ) );
		const getExitCode: () => number | undefined = deps.getExitCode ?? ( () => {
			const exitCode = process.exitCode;
			return typeof exitCode === "number" ? exitCode : undefined;
		} );
		const onError = deps.onError ?? ( ( error: unknown ) => console.error( "[companion] shutdown failed:", error ) );
		const timeoutMs = deps.hardExitAfterMs ?? 12_000;
		const watchdog = setTimeout( () => {
			if ( finished ) return;
			finished = true;
			onError( new Error( `shutdown hard timeout after ${ timeoutMs }ms` ) );
			hardExit( 1 );
		}, timeoutMs );

		void deps.shutdown().then( () => {
			if ( finished ) return;
			finished = true;
			clearTimeout( watchdog );
			// All owned resources are closed at this point. Exit explicitly so a stale undici socket from
			// an already-aborted controller fetch cannot outlive Docker's stop grace period.
			const priorExitCode = getExitCode();
			exitAfterDrain( priorExitCode === undefined || priorExitCode === 0 ? 0 : priorExitCode );
		} ).catch( ( error ) => {
			if ( finished ) return;
			finished = true;
			clearTimeout( watchdog );
			onError( error );
			hardExit( 1 );
		} );
	};
}

export interface StartupAwareShutdownHandler {
	handleSignal(): void;
	isRequested(): boolean;
	setShutdown( shutdown: () => Promise<void> ): void;
}

/**
 * Installable before async initialization owns all of its resources. An early signal starts the
 * normal bounded watchdog immediately, then waits for startup to hand over the cleanup closure.
 */
export function createStartupAwareShutdownHandler(
	options: Omit<Parameters<typeof createBoundedShutdownHandler>[ 0 ], "shutdown"> = {},
): StartupAwareShutdownHandler {
	let requested = false;
	let configured = false;
	let resolveShutdown!: ( shutdown: () => Promise<void> ) => void;
	const shutdownReady = new Promise<() => Promise<void>>( ( resolve ) => { resolveShutdown = resolve; } );
	const bounded = createBoundedShutdownHandler( {
		...options,
		shutdown: async () => { await ( await shutdownReady )(); },
	} );
	return {
		handleSignal: () => { requested = true; bounded(); },
		isRequested: () => requested,
		setShutdown: ( shutdown ) => {
			if ( configured ) throw new Error( "startup shutdown handler is already configured" );
			configured = true;
			resolveShutdown( shutdown );
		},
	};
}

import { describe, expect, it, vi } from "vitest";
import { createBoundedShutdownHandler, createStartupAwareShutdownHandler } from "../../server/lifecycle";

describe( "createBoundedShutdownHandler", () => {
	it( "exits cleanly and cancels its watchdog after a graceful shutdown", async () => {
		vi.useFakeTimers();
		try {
			const hardExit = vi.fn();
			const exitAfterDrain = vi.fn();
			const handler = createBoundedShutdownHandler( {
				shutdown: async () => {}, hardExitAfterMs: 25, hardExit, exitAfterDrain,
			} );
			handler();
			await Promise.resolve();
			expect( exitAfterDrain ).toHaveBeenCalledWith( 0 );
			await vi.advanceTimersByTimeAsync( 25 );
			expect( hardExit ).not.toHaveBeenCalled();
		} finally { vi.useRealTimers(); }
	} );

	it( "does not mask a failure exit code after resources drain cleanly", async () => {
		const exitAfterDrain = vi.fn();
		createBoundedShutdownHandler( {
			shutdown: async () => {}, getExitCode: () => 2, exitAfterDrain,
		} )();
		await Promise.resolve();
		expect( exitAfterDrain ).toHaveBeenCalledWith( 2 );
	} );

	it( "hard-exits when graceful shutdown rejects", async () => {
		const error = new Error( "poller did not drain" );
		const hardExit = vi.fn();
		const onError = vi.fn();
		const handler = createBoundedShutdownHandler( {
			shutdown: async () => { throw error; }, hardExit, onError,
		} );
		handler();
		await vi.waitFor( () => expect( hardExit ).toHaveBeenCalledWith( 1 ) );
		expect( onError ).toHaveBeenCalledWith( error );
	} );

	it( "hard-exits after the deadline when shutdown never settles", async () => {
		vi.useFakeTimers();
		try {
			const hardExit = vi.fn();
			const onError = vi.fn();
			const handler = createBoundedShutdownHandler( {
				shutdown: async () => new Promise<void>( () => {} ),
				hardExitAfterMs: 25, hardExit, onError,
			} );
			handler();
			handler();
			await vi.advanceTimersByTimeAsync( 25 );
			expect( hardExit ).toHaveBeenCalledTimes( 1 );
			expect( hardExit ).toHaveBeenCalledWith( 1 );
			expect( onError.mock.calls[ 0 ]?.[ 0 ] ).toEqual( expect.objectContaining( {
				message: "shutdown hard timeout after 25ms",
			} ) );
		} finally { vi.useRealTimers(); }
	} );
} );

describe( "createStartupAwareShutdownHandler", () => {
	it( "holds an early signal until startup hands off cleanup, then exits cleanly", async () => {
		const events: string[] = [];
		let resolveExit!: ( code: number ) => void;
		const exited = new Promise<number>( ( resolve ) => { resolveExit = resolve; } );
		const hardExit = vi.fn();
		const startup = createStartupAwareShutdownHandler( {
			hardExitAfterMs: 1000,
			hardExit,
			exitAfterDrain: ( code ) => { events.push( `exit:${ code }` ); resolveExit( code ); },
		} );

		expect( startup.isRequested() ).toBe( false );
		startup.handleSignal();
		expect( startup.isRequested() ).toBe( true );
		await Promise.resolve();
		expect( events ).toEqual( [] );

		startup.setShutdown( async () => { events.push( "poller/store cleanup" ); } );
		expect( await exited ).toBe( 0 );
		expect( events ).toEqual( [ "poller/store cleanup", "exit:0" ] );
		expect( hardExit ).not.toHaveBeenCalled();
	} );
} );

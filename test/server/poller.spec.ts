// test/server/poller.spec.ts
import { describe, it, expect, vi } from "vitest";
import { Poller } from "../../server/poller";
import { ApiError } from "../../www/src/api/client";

describe( "Poller", () => {
	it( "runs immediately, survives a throwing cycle, and reports lastError", async () => {
		const log = vi.spyOn( console, "error" ).mockImplementation( () => {} );
		let calls = 0;
		const cycle = vi.fn( async () => { calls++; if ( calls === 1 ) throw new Error( "first fails" ); } );
		const p = new Poller( cycle, 300 );
		await p.runNow();                      // immediate first poll (FR-3)
		expect( p.lastError ).toBe( "poll cycle failed" );
		expect( log ).toHaveBeenCalledWith( "[poller] poll cycle failed" );
		await p.runNow();                      // loop survived; second succeeds (FR-9)
		expect( p.lastError ).toBeNull();
		expect( calls ).toBe( 2 );
		log.mockRestore();
	} );

	it( "never exposes response fragments or ApiError.raw through state or logs", async () => {
		const secret = "controller-secret-response-fragment";
		const error = new ApiError( "malformed controller response", "/jc", { otc: secret } );
		expect( ( error as unknown as Record<string, unknown> ).raw ).toBeUndefined();
		const log = vi.spyOn( console, "error" ).mockImplementation( () => {} );
		const p = new Poller( async () => { throw error; }, 300 );
		await p.runNow();
		expect( p.lastError ).toBe( "controller response invalid" );
		const logged = JSON.stringify( log.mock.calls );
		expect( logged ).toContain( "controller response invalid" );
		expect( logged ).not.toContain( secret );
		log.mockRestore();
	} );

	it( "does not overlap cycles", async () => {
		let active = 0; let maxActive = 0;
		const cycle = async () => { active++; maxActive = Math.max( maxActive, active ); await new Promise( ( r ) => setTimeout( r, 20 ) ); active--; };
		const p = new Poller( cycle, 300 );
		await Promise.all( [ p.runNow(), p.runNow() ] ); // second is skipped while first runs
		expect( maxActive ).toBe( 1 );
	} );

	it( "starts idempotently and stop clears the only interval", async () => {
		vi.useFakeTimers();
		try {
			const cycle = vi.fn( async () => {} );
			const p = new Poller( cycle, 1 );
			p.start(); p.start();
			await vi.advanceTimersByTimeAsync( 1000 );
			expect( cycle ).toHaveBeenCalledTimes( 2 ); // boot + one tick, not two intervals
			await p.stop();
			await vi.advanceTimersByTimeAsync( 2000 );
			expect( cycle ).toHaveBeenCalledTimes( 2 );
		} finally { vi.useRealTimers(); }
	} );

	it( "can defer its first cycle for scheduled background maintenance", async () => {
		vi.useFakeTimers();
		try {
			const cycle = vi.fn( async () => {} );
			const p = new Poller( cycle, 1 );
			p.start( false );
			await Promise.resolve();
			expect( cycle ).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync( 1000 );
			expect( cycle ).toHaveBeenCalledTimes( 1 );
			await p.stop();
		} finally { vi.useRealTimers(); }
	} );

	it( "waits for an in-flight cycle during stop", async () => {
		let release!: () => void;
		const gate = new Promise<void>( ( resolve ) => { release = resolve; } );
		const p = new Poller( async () => gate, 300 );
		const run = p.runNow();
		let stopped = false;
		const stop = p.stop().then( () => { stopped = true; } );
		await Promise.resolve();
		expect( stopped ).toBe( false );
		release();
		await Promise.all( [ run, stop ] );
		expect( stopped ).toBe( true );
	} );

	it( "cancels an abort-aware in-flight cycle during stop", async () => {
		let received: AbortSignal | undefined;
		const p = new Poller( ( signal ) => new Promise<void>( ( resolve ) => {
			received = signal;
			signal.addEventListener( "abort", () => resolve(), { once: true } );
		} ), 300 );
		const run = p.runNow();
		await Promise.resolve();
		expect( received?.aborted ).toBe( false );
		await p.stop( 100 );
		expect( received?.aborted ).toBe( true );
		await run;
	} );

	it( "does not accept a queued or manual cycle after stop begins", async () => {
		const cycle = vi.fn( async () => {} );
		const p = new Poller( cycle, 300 );
		await p.stop();
		await p.runNow();
		p.start();
		await Promise.resolve();
		expect( cycle ).not.toHaveBeenCalled();
	} );
} );

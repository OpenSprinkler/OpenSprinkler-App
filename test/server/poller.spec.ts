// test/server/poller.spec.ts
import { describe, it, expect, vi } from "vitest";
import { Poller } from "../../server/poller";

describe( "Poller", () => {
	it( "runs immediately, survives a throwing cycle, and reports lastError", async () => {
		let calls = 0;
		const cycle = vi.fn( async () => { calls++; if ( calls === 1 ) throw new Error( "first fails" ); } );
		const p = new Poller( cycle, 300 );
		await p.runNow();                      // immediate first poll (FR-3)
		expect( p.lastError ).toMatch( /first fails/ );
		await p.runNow();                      // loop survived; second succeeds (FR-9)
		expect( p.lastError ).toBeNull();
		expect( calls ).toBe( 2 );
	} );

	it( "does not overlap cycles", async () => {
		let active = 0; let maxActive = 0;
		const cycle = async () => { active++; maxActive = Math.max( maxActive, active ); await new Promise( ( r ) => setTimeout( r, 20 ) ); active--; };
		const p = new Poller( cycle, 300 );
		await Promise.all( [ p.runNow(), p.runNow() ] ); // second is skipped while first runs
		expect( maxActive ).toBe( 1 );
	} );
} );

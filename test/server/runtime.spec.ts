// test/server/runtime.spec.ts
import { describe, it, expect } from "vitest";
import { buildRuntime } from "../../server/runtime";
import type { StorageProvider } from "../../server/storage/provider";

function brokenStore(): StorageProvider {
	return { async init() { throw new Error( "disk full" ); } } as unknown as StorageProvider;
}

describe( "buildRuntime degraded start (FR-14)", () => {
	it( "serves /api/health ok:false when the DB fails to init, without throwing", async () => {
		const rt = await buildRuntime( {
			config: { controllerId: "c1", pollIntervalSec: 300, historyMaxDays: 90 } as never,
			store: brokenStore(),
			startPoller: false,
			now: () => 1000,
		} );
		const res = await rt.app.request( "/api/health" );
		const j = await res.json();
		expect( j.ok ).toBe( false );
		expect( res.status ).toBe( 200 );
	} );
} );

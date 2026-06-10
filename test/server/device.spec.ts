// test/server/device.spec.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { createDeviceClient } from "../../server/device";
import { md5 } from "../../www/src/auth/md5";

afterEach( () => vi.restoreAllMocks() );

function mockFetch( fwv = 221 ): string[] {
	const urls: string[] = [];
	globalThis.fetch = vi.fn( async ( u: RequestInfo | URL ) => {
		urls.push( String( u ) );
		// Minimal valid JcResponse so parseJc doesn't throw on the /jc probe.
		const jcBody = { devt: 0, nbrd: 1, lrun: [ 0, 0, 0, 0 ], ps: [], sbits: [], eip: 0, rd: 0, wterr: 0, wtrestr: 0, lswc: 0 };
		const body = String( u ).includes( "/jo" ) ? { fwv } : jcBody;
		return { ok: true, status: 200, json: async () => body } as Response;
	} ) as unknown as typeof fetch;
	return urls;
}

describe( "createDeviceClient", () => {
	it( "probes fwv and md5-hashes the password for fwv>=213", async () => {
		const urls = mockFetch( 221 );
		const { client, fwv } = await createDeviceClient( { controllerBase: "http://d/", controllerPw: "opendoor" } );
		expect( fwv ).toBe( 221 );
		await client.getControllerStatus();
		expect( urls.some( ( u ) => u.includes( `pw=${ md5( "opendoor" ) }` ) ) ).toBe( true );
	} );
} );

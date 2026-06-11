// test/server/http.spec.ts
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createHttpApp } from "../../server/http";

// Regression: when the firmware's home.js bootstrap points at the companion, the page is served from
// the DEVICE's origin and loads the Vite ESM bundle (assets/app.js) cross-origin as a module script.
// Module scripts are fetched in CORS mode, so every served file (not just /api) must carry
// Access-Control-Allow-Origin or the browser blocks app.js and the UI hangs at "Loading…".
describe( "createHttpApp — CORS covers static assets (cross-origin ESM bootstrap)", () => {
	const app = createHttpApp( new Hono() );   // empty api; dist may be absent — the cors middleware still runs

	it( "sets Access-Control-Allow-Origin on the ESM bundle path", async () => {
		const res = await app.request( "/assets/app.js", { headers: { Origin: "http://10.10.100.246" } } );
		expect( res.headers.get( "access-control-allow-origin" ) ).toBe( "*" );
	} );

	it( "sets Access-Control-Allow-Origin on the home.js bootstrap path", async () => {
		const res = await app.request( "/home.js", { headers: { Origin: "http://10.10.100.246" } } );
		expect( res.headers.get( "access-control-allow-origin" ) ).toBe( "*" );
	} );

	it( "still sets CORS on the /api surface", async () => {
		const res = await app.request( "/api/anything", { headers: { Origin: "http://10.10.100.246" } } );
		expect( res.headers.get( "access-control-allow-origin" ) ).toBe( "*" );
	} );
} );

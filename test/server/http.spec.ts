import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createHttpApp } from "../../server/http";

describe( "createHttpApp", () => {
	const origin = "http://192.0.2.20";
	const app = createHttpApp( new Hono(), "dist", { apiAllowedOrigins: [ origin ] } );

	it( "keeps wildcard CORS on cross-origin static modules", async () => {
		for ( const path of [ "/assets/app.js", "/home.js" ] ) {
			const res = await app.request( path, { headers: { Origin: origin } } );
			expect( res.headers.get( "access-control-allow-origin" ) ).toBe( "*" );
		}
	} );

	it( "allows configured API origins but not arbitrary sites", async () => {
		const allowed = await app.request( "/api/anything", { headers: { Origin: origin } } );
		expect( allowed.headers.get( "access-control-allow-origin" ) ).toBe( origin );
		const denied = await app.request( "/api/anything", { headers: { Origin: "https://evil.example" } } );
		expect( denied.headers.get( "access-control-allow-origin" ) ).toBeNull();
	} );

	it( "supports optional bearer authentication without exposing it through CORS", async () => {
		const api = new Hono().get( "/health", ( c ) => c.json( { ok: true } ) );
		const secured = createHttpApp( api, "dist", {
			apiAllowedOrigins: [ origin ], apiToken: "0123456789abcdef",
		} );
		expect( ( await secured.request( "/api/health" ) ).status ).toBe( 401 );
		const response = await secured.request( "/api/health", {
			headers: { Authorization: "Bearer 0123456789abcdef", Origin: origin },
		} );
		expect( response.status ).toBe( 200 );
		expect( response.headers.get( "access-control-allow-origin" ) ).toBe( origin );
	} );

	it( "treats only /api path segments as API routes", async () => {
		const response = await app.request( "/apiary" );
		expect( response.status ).toBe( 200 );
		expect( response.headers.get( "content-type" ) ).toContain( "text/html" );
	} );

	it( "uses the SPA fallback only for navigation-like GET/HEAD requests", async () => {
		expect( ( await app.request( "/settings", { headers: { Accept: "text/html" } } ) ).status ).toBe( 200 );
		expect( ( await app.request( "/settings", { method: "HEAD" } ) ).status ).toBe( 200 );
		expect( ( await app.request( "/assets/missing.js" ) ).status ).toBe( 404 );
		expect( ( await app.request( "/missing", { headers: { Accept: "application/json" } } ) ).status ).toBe( 404 );
		expect( ( await app.request( "/settings", { method: "POST" } ) ).status ).toBe( 404 );
	} );

	it( "sets browser hardening headers and prevents API response caching", async () => {
		const page = await app.request( "/" );
		expect( page.headers.get( "x-content-type-options" ) ).toBe( "nosniff" );
		expect( page.headers.get( "referrer-policy" ) ).toBe( "no-referrer" );
		expect( page.headers.get( "x-frame-options" ) ).toBe( "SAMEORIGIN" );
		expect( page.headers.get( "content-security-policy" ) ).toContain( "frame-ancestors 'self'" );
		const apiResponse = await app.request( "/api/anything" );
		expect( apiResponse.headers.get( "cache-control" ) ).toBe( "no-store" );
	} );
} );

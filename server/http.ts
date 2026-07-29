import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import type { Hono as HonoApp } from "hono";

export interface HttpOptions {
	apiAllowedOrigins?: string[];
	apiToken?: string;
}

/** Own the lifetime of async HTTP handlers that may still hold a StorageProvider reference. */
export class HttpRequestDrain {
	private accepting = true;
	private active = 0;
	private drained: Promise<void> | null = null;
	private resolveDrained: ( () => void ) | null = null;

	begin(): ( () => void ) | null {
		if ( !this.accepting ) return null;
		this.active++;
		let finished = false;
		return () => {
			if ( finished ) return;
			finished = true;
			this.active--;
			if ( this.active === 0 ) this.resolveDrained?.();
		};
	}

	async stop( timeoutMs?: number ): Promise<void> {
		this.accepting = false;
		if ( this.active === 0 ) return;
		if ( !this.drained ) {
			this.drained = new Promise<void>( ( resolve ) => { this.resolveDrained = resolve; } );
		}
		if ( timeoutMs === undefined ) { await this.drained; return; }
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race( [ this.drained, new Promise<never>( ( _resolve, reject ) => {
				timer = setTimeout( () => reject( new Error( `HTTP request drain timed out after ${ timeoutMs }ms` ) ), timeoutMs );
			} ) ] );
		} finally { if ( timer !== undefined ) clearTimeout( timer ); }
	}
}

export type CompanionHttpApp = Hono & { readonly requestDrain: HttpRequestDrain };

function isApiPath( path: string ): boolean { return path === "/api" || path.startsWith( "/api/" ); }

function validBearerToken( header: string | undefined, expected: string ): boolean {
	if ( !header?.startsWith( "Bearer " ) ) return false;
	const supplied = Buffer.from( header.slice( 7 ) );
	const wanted = Buffer.from( expected );
	return supplied.length === wanted.length && timingSafeEqual( supplied, wanted );
}

/** Serve the API and SPA while keeping cross-origin static-module access separate from API access. */
export function createHttpApp( api: HonoApp, distDir = "dist", options: HttpOptions = {} ): CompanionHttpApp {
	const requestDrain = new HttpRequestDrain();
	const app = Object.assign( new Hono(), { requestDrain } );
	const allowedOrigins = options.apiAllowedOrigins ?? [];
	const staticCors = cors( { origin: "*", allowMethods: [ "GET" ] } );
	const apiCors = cors( {
		origin: ( origin ) => allowedOrigins.includes( "*" ) ? "*" : allowedOrigins.includes( origin ) ? origin : undefined,
		allowMethods: [ "GET" ], allowHeaders: [ "Authorization" ], maxAge: 600,
	} );

	app.use( "/*", async ( c, next ) => {
		await next();
		c.header( "X-Content-Type-Options", "nosniff" );
		c.header( "Referrer-Policy", "no-referrer" );
		c.header( "X-Frame-Options", "SAMEORIGIN" );
		c.header( "Content-Security-Policy", "frame-ancestors 'self'; object-src 'none'; base-uri 'none'" );
		c.header( "Permissions-Policy", "geolocation=(self)" );
		if ( isApiPath( c.req.path ) ) c.header( "Cache-Control", "no-store" );
	} );
	app.use( "/*", async ( c, next ) => {
		const finish = requestDrain.begin();
		if ( !finish ) return c.json( { error: "service shutting down" }, 503 );
		try { await next(); } finally { finish(); }
	} );
	app.use( "/*", ( c, next ) => isApiPath( c.req.path ) ? apiCors( c, next ) : staticCors( c, next ) );
	app.use( "/*", async ( c, next ) => {
		if ( isApiPath( c.req.path ) && options.apiToken &&
			!validBearerToken( c.req.header( "Authorization" ), options.apiToken ) ) {
			return c.json( { error: "unauthorized" }, 401 );
		}
		await next();
	} );
	app.route( "/api", api );

	if ( !existsSync( distDir ) ) {
		console.warn( `[http] ${ distDir } missing — serving /api only (build the SPA with npm run build:app)` );
	}
	const fallback = spaFallback( distDir );
	app.use( "/*", serveStatic( { root: "./" + distDir } ) );
	app.notFound( ( c ) => {
		if ( isApiPath( c.req.path ) ) return c.json( { error: "not found" }, 404 );
		const method = c.req.method;
		const leaf = c.req.path.split( "/" ).at( -1 ) ?? "";
		const accepts = c.req.header( "Accept" ) ?? "";
		const looksLikeAsset = /\.[A-Za-z0-9]{1,12}$/.test( leaf );
		const explicitlyRejectsHtml = accepts !== "" && !accepts.includes( "text/html" ) && !accepts.includes( "*/*" );
		if ( ( method !== "GET" && method !== "HEAD" ) || looksLikeAsset || explicitlyRejectsHtml ) {
			return c.text( "Not found", 404 );
		}
		return c.html( fallback );
	} );
	return app;
}

function spaFallback( distDir: string ): string {
	try { return readFileSync( `${ distDir }/index.html`, "utf8" ); }
	catch { return "<!doctype html><title>OpenSprinkler Companion</title><p>Build the dashboard: <code>npm run build:app</code></p>"; }
}

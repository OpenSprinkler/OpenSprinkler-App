import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import type { Hono as HonoApp } from "hono";

/** Root app: GET-only CORS on /api, mounts the API, serves the built SPA with SPA fallback (FR-1/2/19).
 *  `npm run build:app` emits to ./dist (app/vite.config.ts outDir "../dist"). */
export function createHttpApp( api: HonoApp, distDir = "dist" ): Hono {
	const app = new Hono();
	app.use( "/api/*", cors( { origin: "*", allowMethods: [ "GET" ] } ) );
	app.route( "/api", api );

	if ( !existsSync( distDir ) ) {
		console.warn( `[http] ${ distDir } missing — serving /api only (build the SPA with npm run build:app)` );
	}
	app.use( "/*", serveStatic( { root: "./" + distDir } ) );
	app.notFound( ( c ) =>
		c.req.path.startsWith( "/api" ) ? c.json( { error: "not found" }, 404 ) : c.html( spaFallback( distDir ) ) );
	return app;
}

import { readFileSync } from "node:fs";
function spaFallback( distDir: string ): string {
	try { return readFileSync( `${ distDir }/index.html`, "utf8" ); }
	catch { return "<!doctype html><title>OpenSprinkler Companion</title><p>Build the dashboard: <code>npm run build:app</code></p>"; }
}

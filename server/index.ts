import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { SqliteStorageProvider } from "./storage/sqlite";
import { createDeviceClient } from "./device";
import { collectOnce } from "./collect";
import { buildRuntime } from "./runtime";

async function main(): Promise<void> {
	const config = loadConfig();
	const store = new SqliteStorageProvider( config.databasePath );

	// Resolve a stable controller id (CONTROLLER_ID > device MAC > base hash) once the client is up.
	const { client } = await createDeviceClient( config ).catch( () => ( { client: null } ) );
	let controllerId = config.controllerId;
	if ( !controllerId && client ) {
		try { const jc = await client.getControllerStatus(); controllerId = jc.mac || undefined; } catch { /* keep undefined */ }
	}
	controllerId = controllerId || `base:${ config.controllerBase }`;
	config.controllerId = controllerId;

	const cycle = async (): Promise<void> => {
		if ( !client ) return;
		await collectOnce( client, store, controllerId!, { backfillDays: config.logBackfillDays, now: Math.floor( Date.now() / 1000 ) } );
	};

	const rt = await buildRuntime( { config, store, startPoller: true, cycle } );

	// daily telemetry prune (FR-15)
	const prune = setInterval( () => void store.pruneTelemetry( Math.floor( Date.now() / 1000 ) - config.historyMaxDays * 86400 ).catch( () => 0 ), 86400_000 );

	const server = serve( { fetch: rt.app.fetch, port: config.port } );
	console.log( `[companion] listening on :${ config.port }, polling ${ config.controllerBase } (id=${ controllerId })` );

	const shutdown = (): void => { rt.poller?.stop(); clearInterval( prune ); server.close(); void store.close(); process.exit( 0 ); };
	process.on( "SIGINT", shutdown );
	process.on( "SIGTERM", shutdown );
}

void main().catch( ( e ) => { console.error( "[companion] fatal:", e ); process.exit( 1 ); } );

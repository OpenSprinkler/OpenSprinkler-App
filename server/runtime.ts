import type { Hono } from "hono";
import type { CompanionConfig } from "./config";
import type { StorageProvider } from "./storage/provider";
import { createApiRoutes } from "./api/routes";
import { createHttpApp } from "./http";
import { Poller } from "./poller";

export interface RuntimeDeps {
	config: Pick<CompanionConfig, "controllerId" | "pollIntervalSec" | "historyMaxDays">;
	store: StorageProvider;
	startPoller: boolean;
	cycle?: () => Promise<void>;
	now?: () => number;
}

export interface Runtime { app: Hono; poller: Poller | null; dbOk: boolean; }

/** Wire storage→api→http with degraded-start: a failed store init still serves the app + health ok:false. */
export async function buildRuntime( deps: RuntimeDeps ): Promise<Runtime> {
	const now = deps.now ?? ( () => Math.floor( Date.now() / 1000 ) );
	let dbOk = true;
	try { await deps.store.init(); } catch ( e ) { dbOk = false; console.error( "[runtime] DB init failed:", e ); }

	let lastError: string | null = dbOk ? null : "database unavailable";
	const store: StorageProvider = dbOk ? deps.store : degradedStore();

	const poller = ( dbOk && deps.startPoller && deps.cycle )
		? new Poller( deps.cycle, deps.config.pollIntervalSec ) : null;
	if ( poller ) { poller.start(); }

	const api = createApiRoutes( {
		store, controllerId: deps.config.controllerId ?? "default",
		pollIntervalSec: deps.config.pollIntervalSec, historyMaxDays: deps.config.historyMaxDays,
		now, lastError: () => poller?.lastError ?? lastError,
	} );
	return { app: createHttpApp( api ), poller, dbOk };
}

/** A store that reports unhealthy + empty — used when the real DB failed to init (FR-14). */
function degradedStore(): StorageProvider {
	const empty = async () => [];
	return {
		init: async () => {}, appendTelemetry: async () => {}, upsertRunLog: async () => 0,
		queryTelemetry: empty, queryRunLog: empty, lastRunLogEndTs: async () => null,
		pruneTelemetry: async () => 0, close: async () => {},
		health: async () => ( { ok: false, telemetryRows: 0, runLogRows: 0, lastTs: null } ),
	} as StorageProvider;
}

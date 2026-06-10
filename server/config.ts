/** Companion configuration, loaded + validated from environment variables (FR-24/25). */
export interface CompanionConfig {
	storage: "sqlite";
	databasePath: string;
	controllerBase: string;       // required
	controllerPw?: string;        // omit for ipas devices
	controllerId?: string;        // stable id override (else MAC, else base hash)
	controllerFwv?: number;       // auto-probed if unset
	pollIntervalSec: number;
	logBackfillDays: number;
	port: number;
	historyMaxDays: number;
}

function intOr( v: string | undefined, fallback: number ): number {
	const n = parseInt( String( v ), 10 );
	return Number.isFinite( n ) ? n : fallback;
}

export function loadConfig( env: Record<string, string | undefined> = process.env ): CompanionConfig {
	const controllerBase = env.CONTROLLER_BASE;
	if ( !controllerBase ) throw new Error( "CONTROLLER_BASE is required (e.g. http://10.0.0.5/)" );
	return {
		storage: "sqlite",
		databasePath: env.DATABASE_PATH || "/data/data.db",
		controllerBase: controllerBase.endsWith( "/" ) ? controllerBase : controllerBase + "/",
		controllerPw: env.CONTROLLER_PW,
		controllerId: env.CONTROLLER_ID,
		controllerFwv: env.CONTROLLER_FWV ? intOr( env.CONTROLLER_FWV, 0 ) : undefined,
		pollIntervalSec: intOr( env.POLL_INTERVAL_SEC, 300 ),
		logBackfillDays: intOr( env.LOG_BACKFILL_DAYS, 2 ),
		port: intOr( env.PORT, 8080 ),
		historyMaxDays: intOr( env.HISTORY_MAX_DAYS, 90 ),
	};
}

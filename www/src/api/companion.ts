/** Typed client for the optional companion API + feature detection (FR-20/23). */
export interface CompanionHealth {
	ok: boolean; companion?: string; storage?: string; lastTs?: number | null;
	telemetryRows?: number; runLogRows?: number; pollerStale?: boolean; lastError?: string | null;
}
export interface HistoryRange { fromTs: number; toTs: number; }
export interface TelemetryPoint {
	ts: number; waterLevel: number; rainDelay: number; weatherErr: number; weatherRestricted: number;
	lastWeatherUpdate: number; activeStations: number; rssi: number | null; currentDraw: number | null;
}
export interface RunLogPoint { program: number; station: number; durationSec: number; endTs: number; flowGpm: number | null; }

function base( url: string ): string { return url.endsWith( "/" ) ? url : url + "/"; }

/** Returns the companion health when reachable + ok, else null (graceful degradation, FR-22). */
export async function detectCompanion( companionBase: string ): Promise<CompanionHealth | null> {
	try {
		const res = await fetch( base( companionBase ) + "api/health", { headers: { Accept: "application/json" } } );
		if ( !res.ok ) return null;
		const h = await res.json() as CompanionHealth;
		return h.ok ? h : null;
	} catch { return null; }
}

export async function fetchHistory( companionBase: string, r: HistoryRange ): Promise<TelemetryPoint[]> {
	const res = await fetch( `${ base( companionBase ) }api/history?from=${ r.fromTs }&to=${ r.toTs }` );
	return ( ( await res.json() ) as { telemetry: TelemetryPoint[] } ).telemetry;
}

export async function fetchRunLog( companionBase: string, r: HistoryRange ): Promise<RunLogPoint[]> {
	const res = await fetch( `${ base( companionBase ) }api/runlog?from=${ r.fromTs }&to=${ r.toTs }` );
	return ( ( await res.json() ) as { rows: RunLogPoint[] } ).rows;
}

/** A point-in-time controller snapshot (FR-5). `controller` is added by the storage layer. */
export interface TelemetrySample {
	ts: number;                  // collector unix seconds (UTC)
	waterLevel: number;
	rainDelay: number;           // 0 | 1
	weatherErr: number;
	weatherRestricted: number;   // 0 | 1
	lastWeatherUpdate: number;
	activeStations: number;
	rssi: number | null;
	currentDraw: number | null;
	raw: string;                 // JSON.stringify({ jc, jo })
}

/** Telemetry as returned by queries — raw blob omitted to bound the payload (FR-17). */
export type StoredTelemetry = Omit<TelemetrySample, "raw">;

/** A station-run row ingested from /jl (FR-6). Dedup key: (controller, station, endTs). */
export interface RunLogRow {
	program: number; station: number; durationSec: number; endTs: number; flowGpm: number | null;
}

export interface HistoryQuery { fromTs: number; toTs: number; }

export interface StorageHealth {
	ok: boolean; telemetryRows: number; runLogRows: number; lastTs: number | null;
}

/** The single seam all DB access goes through (FR-11). v1 = SQLite; Postgres is an additive adapter. */
export interface StorageProvider {
	init(): Promise<void>;
	appendTelemetry( controller: string, s: TelemetrySample ): Promise<void>;
	upsertRunLog( controller: string, rows: RunLogRow[] ): Promise<number>; // # newly inserted
	queryTelemetry( controller: string, q: HistoryQuery ): Promise<StoredTelemetry[]>; // asc by ts
	queryRunLog( controller: string, q: HistoryQuery ): Promise<RunLogRow[]>;           // asc by endTs
	lastRunLogEndTs( controller: string ): Promise<number | null>;
	pruneTelemetry( olderThanTs: number ): Promise<number>; // # deleted
	health(): Promise<StorageHealth>;
	close(): Promise<void>;
}

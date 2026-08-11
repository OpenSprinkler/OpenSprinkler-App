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
	raw: string;                 // allowlisted, non-secret compatibility metadata only
}

/** Telemetry as returned by queries — raw blob omitted to bound the payload (FR-17). */
export type StoredTelemetry = Omit<TelemetrySample, "raw">;

/** A station-run row ingested from /jl (FR-6). Dedup key: (controller, station, endTs). */
export interface RunLogRow {
	program: number; station: number; durationSec: number; endTs: number; flowGpm: number | null;
}

export type EventSource = "weather" | "system";
export type EventLevel = "normal" | "detail" | "debug";

/** A derived observation (weather-error transition, completed weather call, …). Append-only. */
export interface EventRow {
	ts: number;         // collector unix seconds (UTC)
	source: EventSource;
	level: EventLevel;
	label: string;      // badge text, e.g. "Weather"
	detail: string;     // one plain-English sentence
}

/** Events page query: `maxLevel` includes levels up to that verbosity (normal ⊂ detail ⊂ debug). */
export interface EventsPageQuery extends HistoryPageQuery {
	maxLevel?: EventLevel;
	source?: EventSource;
}

export interface HistoryQuery { fromTs: number; toTs: number; limit?: number; offset?: number; }

/** Stable keyset cursor: rows inserted after `snapshotId` cannot shift an in-progress page walk. */
export interface HistoryPageCursor { snapshotId: number; afterTs: number; afterId: number; }
export interface HistoryPageQuery {
	fromTs: number; toTs: number; limit: number; cursor?: HistoryPageCursor;
}
export interface HistoryPage<T> { rows: T[]; nextCursor: HistoryPageCursor | null; }

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
	pageTelemetry( controller: string, q: HistoryPageQuery ): Promise<HistoryPage<StoredTelemetry>>;
	pageRunLog( controller: string, q: HistoryPageQuery ): Promise<HistoryPage<RunLogRow>>;
	lastRunLogEndTs( controller: string ): Promise<number | null>;
	/** Most recently INSERTED sample — the diff baseline for event derivation. Insertion order,
	 *  not greatest timestamp: a backward host-clock step must not resurrect an old baseline. */
	lastTelemetry( controller: string ): Promise<StoredTelemetry | null>;
	/** Atomically persist a sample together with its derived events (single transaction), so a
	 *  crash between the two can never lose a transition or re-derive duplicates. */
	appendSample( controller: string, s: TelemetrySample, events: EventRow[] ): Promise<void>;
	appendEvents( controller: string, rows: EventRow[] ): Promise<void>;
	pageEvents( controller: string, q: EventsPageQuery ): Promise<HistoryPage<EventRow>>;
	pruneEvents( olderThanTs: number ): Promise<number>;    // # deleted
	pruneTelemetry( olderThanTs: number ): Promise<number>; // # deleted
	health( controller: string ): Promise<StorageHealth>;
	close(): Promise<void>;
}

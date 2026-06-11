import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, asc, eq, gte, lte, lt, sql } from "drizzle-orm";
import { telemetry, runLog } from "./schema";
import { migrate } from "./migrate";
import type {
	StorageProvider, TelemetrySample, StoredTelemetry, RunLogRow, HistoryQuery, StorageHealth,
} from "./provider";

export class SqliteStorageProvider implements StorageProvider {
	private raw: Database.Database;
	private db: BetterSQLite3Database;
	constructor( path: string ) {
		this.raw = new Database( path );
		this.raw.pragma( "journal_mode = WAL" );
		this.raw.pragma( "busy_timeout = 5000" );
		this.db = drizzle( this.raw );
	}
	async init(): Promise<void> { migrate( this.raw ); }

	async appendTelemetry( controller: string, s: TelemetrySample ): Promise<void> {
		await this.db.insert( telemetry ).values( {
			controller, ts: s.ts, waterLevel: s.waterLevel, rainDelay: s.rainDelay,
			weatherErr: s.weatherErr, weatherRestricted: s.weatherRestricted,
			lastWeatherUpdate: s.lastWeatherUpdate, activeStations: s.activeStations,
			rssi: s.rssi, currentDraw: s.currentDraw, raw: s.raw,
		} ).execute();
	}

	async upsertRunLog( controller: string, rows: RunLogRow[] ): Promise<number> {
		if ( rows.length === 0 ) return 0;
		// Use raw prepared statement + raw transaction: better-sqlite3 transactions are synchronous,
		// and drizzle insert is async — mixing them is not supported. Raw INSERT OR IGNORE achieves
		// the same dedup semantics as onConflictDoNothing() with synchronous change counting.
		const stmt = this.raw.prepare(
			"INSERT OR IGNORE INTO run_log (controller, program, station, duration_sec, end_ts, flow_gpm) VALUES (?, ?, ?, ?, ?, ?)",
		);
		const tx = this.raw.transaction( ( items: RunLogRow[] ) => {
			let inserted = 0;
			for ( const r of items ) {
				const res = stmt.run( controller, r.program, r.station, r.durationSec, r.endTs, r.flowGpm );
				inserted += res.changes;
			}
			return inserted;
		} );
		return tx( rows ) as number;
	}

	async queryTelemetry( controller: string, q: HistoryQuery ): Promise<StoredTelemetry[]> {
		const r = this.db.select( {
			ts: telemetry.ts, waterLevel: telemetry.waterLevel, rainDelay: telemetry.rainDelay,
			weatherErr: telemetry.weatherErr, weatherRestricted: telemetry.weatherRestricted,
			lastWeatherUpdate: telemetry.lastWeatherUpdate, activeStations: telemetry.activeStations,
			rssi: telemetry.rssi, currentDraw: telemetry.currentDraw,
		} ).from( telemetry )
			.where( and( eq( telemetry.controller, controller ), gte( telemetry.ts, q.fromTs ), lte( telemetry.ts, q.toTs ) ) )
			.orderBy( asc( telemetry.ts ) ).all();
		return r as StoredTelemetry[];
	}

	async queryRunLog( controller: string, q: HistoryQuery ): Promise<RunLogRow[]> {
		const r = this.db.select( {
			program: runLog.program, station: runLog.station, durationSec: runLog.durationSec,
			endTs: runLog.endTs, flowGpm: runLog.flowGpm,
		} ).from( runLog )
			.where( and( eq( runLog.controller, controller ), gte( runLog.endTs, q.fromTs ), lte( runLog.endTs, q.toTs ) ) )
			.orderBy( asc( runLog.endTs ) ).all();
		return r as RunLogRow[];
	}

	async lastRunLogEndTs( controller: string ): Promise<number | null> {
		const r = this.db.select( { m: sql<number>`max(${ runLog.endTs })` } ).from( runLog )
			.where( eq( runLog.controller, controller ) ).all();
		return r[ 0 ]?.m ?? null;
	}

	async pruneTelemetry( olderThanTs: number ): Promise<number> {
		const res = await this.db.delete( telemetry ).where( lt( telemetry.ts, olderThanTs ) ).execute();
		return res.changes;
	}

	async health(): Promise<StorageHealth> {
		const t = this.db.select( { c: sql<number>`count(*)`, m: sql<number>`max(${ telemetry.ts })` } ).from( telemetry ).all();
		const r = this.db.select( { c: sql<number>`count(*)` } ).from( runLog ).all();
		return { ok: true, telemetryRows: t[ 0 ]?.c ?? 0, runLogRows: r[ 0 ]?.c ?? 0, lastTs: t[ 0 ]?.m ?? null };
	}

	async close(): Promise<void> { this.raw.close(); }
}

import Database from "better-sqlite3";
import { chmod } from "node:fs/promises";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, asc, eq, gt, gte, lte, lt, or, sql } from "drizzle-orm";
import { telemetry, runLog } from "./schema";
import { migrate } from "./migrate";
import type {
	StorageProvider, TelemetrySample, StoredTelemetry, RunLogRow, HistoryQuery, HistoryPageQuery,
	HistoryPage, StorageHealth,
} from "./provider";

export class SqliteStorageProvider implements StorageProvider {
	private raw: Database.Database | null = null;
	private db: BetterSQLite3Database | null = null;
	constructor( private readonly path: string ) {}
	private async restrictFilePermissions(): Promise<void> {
		if ( this.path === ":memory:" ) return;
		for ( const candidate of [ this.path, `${ this.path }-wal`, `${ this.path }-shm` ] ) {
			await chmod( candidate, 0o600 ).catch( ( error: NodeJS.ErrnoException ) => {
				if ( error.code !== "ENOENT" ) throw error;
			} );
		}
	}

	async init(): Promise<void> {
		if ( this.raw ) return;
		let raw: Database.Database | null = null;
		try {
			// Secure an existing database before opening or attempting a migration. Repeat after the
			// WAL is created so a failed migration can never leave old controller data world-readable.
				await this.restrictFilePermissions();
				raw = new Database( this.path );
				raw.pragma( "busy_timeout = 5000" );
				migrate( raw );
				raw.pragma( "journal_mode = WAL" );
			await this.restrictFilePermissions();
			this.raw = raw;
			this.db = drizzle( raw );
		} catch ( error ) {
			try { raw?.close(); } catch { /* preserve the original open/migration error */ }
			throw error;
		}
	}

	private connection(): Database.Database {
		if ( !this.raw ) throw new Error( "SQLite storage is not initialized" );
		return this.raw;
	}

	private orm(): BetterSQLite3Database {
		if ( !this.db ) throw new Error( "SQLite storage is not initialized" );
		return this.db;
	}

	async appendTelemetry( controller: string, s: TelemetrySample ): Promise<void> {
		await this.orm().insert( telemetry ).values( {
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
		const raw = this.connection();
		const stmt = raw.prepare(
			"INSERT OR IGNORE INTO run_log (controller, program, station, duration_sec, end_ts, flow_gpm) VALUES (?, ?, ?, ?, ?, ?)",
		);
		const tx = raw.transaction( ( items: RunLogRow[] ) => {
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
		const limit = Math.min( Math.max( q.limit ?? 5000, 1 ), 5001 );
		const offset = Math.min( Math.max( q.offset ?? 0, 0 ), 100000 );
		const r = this.orm().select( {
			ts: telemetry.ts, waterLevel: telemetry.waterLevel, rainDelay: telemetry.rainDelay,
			weatherErr: telemetry.weatherErr, weatherRestricted: telemetry.weatherRestricted,
			lastWeatherUpdate: telemetry.lastWeatherUpdate, activeStations: telemetry.activeStations,
			rssi: telemetry.rssi, currentDraw: telemetry.currentDraw,
		} ).from( telemetry )
			.where( and( eq( telemetry.controller, controller ), gte( telemetry.ts, q.fromTs ), lte( telemetry.ts, q.toTs ) ) )
			.orderBy( asc( telemetry.ts ), asc( telemetry.id ) ).limit( limit ).offset( offset ).all();
		return r as StoredTelemetry[];
	}

	async queryRunLog( controller: string, q: HistoryQuery ): Promise<RunLogRow[]> {
		const limit = Math.min( Math.max( q.limit ?? 5000, 1 ), 5001 );
		const offset = Math.min( Math.max( q.offset ?? 0, 0 ), 100000 );
		const r = this.orm().select( {
			program: runLog.program, station: runLog.station, durationSec: runLog.durationSec,
			endTs: runLog.endTs, flowGpm: runLog.flowGpm,
		} ).from( runLog )
			.where( and( eq( runLog.controller, controller ), gte( runLog.endTs, q.fromTs ), lte( runLog.endTs, q.toTs ) ) )
			.orderBy( asc( runLog.endTs ), asc( runLog.id ) ).limit( limit ).offset( offset ).all();
		return r as RunLogRow[];
	}

	async pageTelemetry( controller: string, q: HistoryPageQuery ): Promise<HistoryPage<StoredTelemetry>> {
		const raw = this.connection(), db = this.orm();
		return raw.transaction( () => {
			const snapshotId = q.cursor?.snapshotId ?? db.select( { value: sql<number | null>`max(${ telemetry.id })` } )
				.from( telemetry ).where( and(
					eq( telemetry.controller, controller ), gte( telemetry.ts, q.fromTs ), lte( telemetry.ts, q.toTs ),
				) ).all()[ 0 ]?.value ?? 0;
			const after = q.cursor ? or(
				gt( telemetry.ts, q.cursor.afterTs ),
				and( eq( telemetry.ts, q.cursor.afterTs ), gt( telemetry.id, q.cursor.afterId ) ),
			) : undefined;
			const limit = Math.min( Math.max( q.limit, 1 ), 5000 );
			const selected = db.select( {
				id: telemetry.id, ts: telemetry.ts, waterLevel: telemetry.waterLevel, rainDelay: telemetry.rainDelay,
				weatherErr: telemetry.weatherErr, weatherRestricted: telemetry.weatherRestricted,
				lastWeatherUpdate: telemetry.lastWeatherUpdate, activeStations: telemetry.activeStations,
				rssi: telemetry.rssi, currentDraw: telemetry.currentDraw,
			} ).from( telemetry ).where( and(
				eq( telemetry.controller, controller ), gte( telemetry.ts, q.fromTs ), lte( telemetry.ts, q.toTs ),
				lte( telemetry.id, snapshotId ), after,
			) ).orderBy( asc( telemetry.ts ), asc( telemetry.id ) ).limit( limit + 1 ).all();
			const hasMore = selected.length > limit;
			const visible = hasMore ? selected.slice( 0, limit ) : selected;
			const last = visible.at( -1 );
			return {
				rows: visible.map( ( { id: _id, ...row } ) => row as StoredTelemetry ),
				nextCursor: hasMore && last ? { snapshotId, afterTs: last.ts, afterId: last.id } : null,
			};
		} )();
	}

	async pageRunLog( controller: string, q: HistoryPageQuery ): Promise<HistoryPage<RunLogRow>> {
		const raw = this.connection(), db = this.orm();
		return raw.transaction( () => {
			const snapshotId = q.cursor?.snapshotId ?? db.select( { value: sql<number | null>`max(${ runLog.id })` } )
				.from( runLog ).where( and(
					eq( runLog.controller, controller ), gte( runLog.endTs, q.fromTs ), lte( runLog.endTs, q.toTs ),
				) ).all()[ 0 ]?.value ?? 0;
			const after = q.cursor ? or(
				gt( runLog.endTs, q.cursor.afterTs ),
				and( eq( runLog.endTs, q.cursor.afterTs ), gt( runLog.id, q.cursor.afterId ) ),
			) : undefined;
			const limit = Math.min( Math.max( q.limit, 1 ), 5000 );
			const selected = db.select( {
				id: runLog.id, program: runLog.program, station: runLog.station, durationSec: runLog.durationSec,
				endTs: runLog.endTs, flowGpm: runLog.flowGpm,
			} ).from( runLog ).where( and(
				eq( runLog.controller, controller ), gte( runLog.endTs, q.fromTs ), lte( runLog.endTs, q.toTs ),
				lte( runLog.id, snapshotId ), after,
			) ).orderBy( asc( runLog.endTs ), asc( runLog.id ) ).limit( limit + 1 ).all();
			const hasMore = selected.length > limit;
			const visible = hasMore ? selected.slice( 0, limit ) : selected;
			const last = visible.at( -1 );
			return {
				rows: visible.map( ( { id: _id, ...row } ) => row as RunLogRow ),
				nextCursor: hasMore && last ? { snapshotId, afterTs: last.endTs, afterId: last.id } : null,
			};
		} )();
	}

	async lastRunLogEndTs( controller: string ): Promise<number | null> {
		const r = this.orm().select( { m: sql<number>`max(${ runLog.endTs })` } ).from( runLog )
			.where( eq( runLog.controller, controller ) ).all();
		return r[ 0 ]?.m ?? null;
	}

	async pruneTelemetry( olderThanTs: number ): Promise<number> {
		const res = await this.orm().delete( telemetry ).where( lt( telemetry.ts, olderThanTs ) ).execute();
		return res.changes;
	}

	async health( controller: string ): Promise<StorageHealth> {
		const db = this.orm();
		const t = db.select( { c: sql<number>`count(*)`, m: sql<number>`max(${ telemetry.ts })` } ).from( telemetry )
			.where( eq( telemetry.controller, controller ) ).all();
		const r = db.select( { c: sql<number>`count(*)` } ).from( runLog )
			.where( eq( runLog.controller, controller ) ).all();
		return { ok: true, telemetryRows: t[ 0 ]?.c ?? 0, runLogRows: r[ 0 ]?.c ?? 0, lastTs: t[ 0 ]?.m ?? null };
	}

	async close(): Promise<void> {
		const raw = this.raw;
		this.raw = null;
		this.db = null;
		if ( raw?.open ) raw.close();
	}
}

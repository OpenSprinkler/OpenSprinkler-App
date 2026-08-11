import type BetterSqlite3 from "better-sqlite3";

const SCHEMA_VERSION = 2;

/** Idempotent schema creation (FR-14). Single-process, in-container; safe on every boot. */
export function migrate( db: BetterSqlite3.Database ): void {
	const version = db.pragma( "user_version", { simple: true } ) as number;
	// Never let an older binary reinterpret or mutate a database owned by a newer schema.
	if ( version > SCHEMA_VERSION ) {
		throw new Error( `SQLite schema version ${ version } is newer than supported version ${ SCHEMA_VERSION }` );
	}
	db.exec( `
		CREATE TABLE IF NOT EXISTS telemetry (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			controller TEXT NOT NULL,
			ts INTEGER NOT NULL,
			water_level INTEGER NOT NULL,
			rain_delay INTEGER NOT NULL,
			weather_err INTEGER NOT NULL,
			weather_restricted INTEGER NOT NULL,
			last_weather_update INTEGER NOT NULL,
			active_stations INTEGER NOT NULL,
			rssi INTEGER,
			current_draw INTEGER,
			raw TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS telemetry_ctrl_ts ON telemetry ( controller, ts );

		CREATE TABLE IF NOT EXISTS run_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			controller TEXT NOT NULL,
			program INTEGER NOT NULL,
			station INTEGER NOT NULL,
			duration_sec INTEGER NOT NULL,
			end_ts INTEGER NOT NULL,
			flow_gpm REAL
		);
		CREATE UNIQUE INDEX IF NOT EXISTS run_log_uniq ON run_log ( controller, station, end_ts );
		CREATE INDEX IF NOT EXISTS run_log_ctrl_end ON run_log ( controller, end_ts );

		CREATE TABLE IF NOT EXISTS events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			controller TEXT NOT NULL,
			ts INTEGER NOT NULL,
			source TEXT NOT NULL,
			level TEXT NOT NULL,
			label TEXT NOT NULL,
			detail TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS events_ctrl_ts ON events ( controller, ts );
	` );
	if ( version < 1 ) {
		// Releases before schema version 1 stored complete /jc and /jo responses in `raw`, including
		// optional integration credentials. Overwrite that legacy data, compact it out of the DB,
		// and truncate the WAL before marking the one-time migration complete.
		db.pragma( "secure_delete = ON" );
		db.prepare( "UPDATE telemetry SET raw = '{}'" ).run();
		db.exec( "VACUUM" );
		db.pragma( "wal_checkpoint(TRUNCATE)" );
	}
	// Schema version 2 only adds the `events` table (created above for every version).
	if ( version < SCHEMA_VERSION ) db.pragma( `user_version = ${ SCHEMA_VERSION }` );
}

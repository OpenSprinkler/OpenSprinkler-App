import type BetterSqlite3 from "better-sqlite3";

/** Idempotent schema creation (FR-14). Single-process, in-container; safe on every boot. */
export function migrate( db: BetterSqlite3.Database ): void {
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
	` );
}

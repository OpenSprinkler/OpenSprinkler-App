// test/server/sqlite.spec.ts
import Database from "better-sqlite3";
import { chmod, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/storage/migrate";
import { SqliteStorageProvider } from "../../server/storage/sqlite";
import { runStorageContract } from "./storage.contract";

runStorageContract( "sqlite (in-memory)", () => new SqliteStorageProvider( ":memory:" ) );

describe( "SQLite file security", () => {
	it( "rejects a database from a newer schema before creating or changing tables", () => {
		const db = new Database( ":memory:" );
		try {
			db.pragma( "user_version = 3" );
			expect( () => migrate( db ) ).toThrow( /newer than supported/i );
			const tables = db.prepare( "SELECT name FROM sqlite_master WHERE type = 'table'" ).all();
			expect( tables ).toEqual( [] );
			expect( db.pragma( "user_version", { simple: true } ) ).toBe( 3 );
		} finally { db.close(); }
	} );

	it( "makes database files owner-only and scrubs pre-v1 raw controller snapshots", async () => {
		const root = await mkdtemp( join( tmpdir(), "opensprinkler-db-" ) );
		const path = join( root, "data.db" );
		let store: SqliteStorageProvider | undefined;
		try {
			const seed = new Database( path );
			migrate( seed );
			seed.prepare( `INSERT INTO telemetry (
				controller, ts, water_level, rain_delay, weather_err, weather_restricted,
				last_weather_update, active_stations, rssi, current_draw, raw
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` )
				.run( "controller", 1, 100, 0, 0, 0, 0, 0, null, null, '{"otc":"secret-token"}' );
			seed.pragma( "user_version = 0" );
			seed.close();
			await chmod( path, 0o644 );

			store = new SqliteStorageProvider( path );
			await store.init();
			await store.appendTelemetry( "controller", {
				ts: 2, waterLevel: 100, rainDelay: 0, weatherErr: 0, weatherRestricted: 0,
				lastWeatherUpdate: 0, activeStations: 0, rssi: null, currentDraw: null, raw: "{}",
			} );
			expect( ( await stat( path ) ).mode & 0o777 ).toBe( 0o600 );
			expect( ( await stat( `${ path }-wal` ) ).mode & 0o777 ).toBe( 0o600 );

			const inspect = new Database( path, { readonly: true } );
			const raws = inspect.prepare( "SELECT raw FROM telemetry ORDER BY ts" ).all() as Array<{ raw: string }>;
			inspect.close();
			expect( raws.map( ( row ) => row.raw ) ).toEqual( [ "{}", "{}" ] );
		} finally {
			await store?.close();
			await rm( root, { recursive: true, force: true } );
		}
	} );

	it( "migrates a populated v1 database without touching its data, adding events + advancing the version", () => {
		const db = new Database( ":memory:" );
		try {
			// Build a genuine v1 database: run the current migration (which creates everything and
			// stamps v2), then strip it back to the v1 shape — no events table, user_version 1.
			migrate( db );
			db.exec( "DROP TABLE events" );
			db.pragma( "user_version = 1" );
			db.prepare( `INSERT INTO telemetry (
				controller, ts, water_level, rain_delay, weather_err, weather_restricted,
				last_weather_update, active_stations, rssi, current_draw, raw
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` )
				.run( "controller", 1, 100, 0, 0, 0, 0, 0, null, null, '{"schema":1,"kept":"v1-allowlisted-raw"}' );
			db.prepare( "INSERT INTO run_log (controller, program, station, duration_sec, end_ts, flow_gpm) VALUES (?, ?, ?, ?, ?, ?)" )
				.run( "controller", 1, 2, 60, 500, null );

			migrate( db );

			// v2 is additive: the pre-v1 credential scrub must NOT touch v1 data.
			const raw = db.prepare( "SELECT raw FROM telemetry" ).get() as { raw: string };
			expect( raw.raw ).toBe( '{"schema":1,"kept":"v1-allowlisted-raw"}' );
			expect( ( db.prepare( "SELECT count(*) AS c FROM run_log" ).get() as { c: number } ).c ).toBe( 1 );
			const tables = ( db.prepare( "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'events'" ).all() );
			expect( tables ).toHaveLength( 1 );
			expect( db.pragma( "user_version", { simple: true } ) ).toBe( 2 );
		} finally { db.close(); }
	} );

	it( "secures an existing database even when its migration fails", async () => {
		const root = await mkdtemp( join( tmpdir(), "opensprinkler-db-failure-" ) );
		const path = join( root, "data.db" );
		try {
			const seed = new Database( path );
			seed.exec( "CREATE VIEW telemetry AS SELECT 1 AS id" );
			seed.close();
			await chmod( path, 0o644 );
			const store = new SqliteStorageProvider( path );
			await expect( store.init() ).rejects.toThrow();
			expect( ( await stat( path ) ).mode & 0o777 ).toBe( 0o600 );
			await store.close();
		} finally {
			await rm( root, { recursive: true, force: true } );
		}
	} );
} );

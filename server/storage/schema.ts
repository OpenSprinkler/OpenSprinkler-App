import { sqliteTable, integer, text, real, index, unique } from "drizzle-orm/sqlite-core";

export const telemetry = sqliteTable( "telemetry", {
	id: integer( "id" ).primaryKey( { autoIncrement: true } ),
	controller: text( "controller" ).notNull(),
	ts: integer( "ts" ).notNull(),
	waterLevel: integer( "water_level" ).notNull(),
	rainDelay: integer( "rain_delay" ).notNull(),
	weatherErr: integer( "weather_err" ).notNull(),
	weatherRestricted: integer( "weather_restricted" ).notNull(),
	lastWeatherUpdate: integer( "last_weather_update" ).notNull(),
	activeStations: integer( "active_stations" ).notNull(),
	rssi: integer( "rssi" ),
	currentDraw: integer( "current_draw" ),
	raw: text( "raw" ).notNull(),
}, ( t ) => ( { byCtrlTs: index( "telemetry_ctrl_ts" ).on( t.controller, t.ts ) } ) );

export const events = sqliteTable( "events", {
	id: integer( "id" ).primaryKey( { autoIncrement: true } ),
	controller: text( "controller" ).notNull(),
	ts: integer( "ts" ).notNull(),
	source: text( "source" ).notNull(),   // "weather" | "system"
	level: text( "level" ).notNull(),     // "normal" | "detail" | "debug"
	label: text( "label" ).notNull(),
	detail: text( "detail" ).notNull(),
}, ( t ) => ( { byCtrlTs: index( "events_ctrl_ts" ).on( t.controller, t.ts ) } ) );

export const runLog = sqliteTable( "run_log", {
	id: integer( "id" ).primaryKey( { autoIncrement: true } ),
	controller: text( "controller" ).notNull(),
	program: integer( "program" ).notNull(),
	station: integer( "station" ).notNull(),
	durationSec: integer( "duration_sec" ).notNull(),
	endTs: integer( "end_ts" ).notNull(),
	flowGpm: real( "flow_gpm" ),
}, ( t ) => ( {
	uniq: unique( "run_log_uniq" ).on( t.controller, t.station, t.endTs ),
	byCtrlEnd: index( "run_log_ctrl_end" ).on( t.controller, t.endTs ),
} ) );

/**
 * Firmware program/station decoders — Phase 1.
 *
 * Faithful ports of the firmware encodings (source of truth: OpenSprinkler-Firmware
 * program.h / program.cpp / opensprinkler_server.cpp / utils.h). Verified bit layouts:
 *   flags: bit0 enabled, bit1 use_weather, bits2-3 oddeven, bits4-5 type, bit6 starttime_type, bit7 en_daterange
 *   starttime int16: bit15 unused, bit14 sunrise, bit13 sunset, bit12 sign, bits0-10 magnitude/minutes
 *   duration uint16 seconds; 65534 = sunrise→sunset, 65535 = sunset→sunrise
 *   date_encode = (month<<5)+day  (day=bits0-4, month=bits5+);  weekday bit order = Mon=bit0..Sun=bit6
 *
 * Notes: the existing app's readStartTime has an operator-precedence bug (`!(time>>14)&1`);
 * we follow the firmware logic instead.
 */
import type { JcResponse, JnResponse, JpResponse, JlRow, JlStationRow, JlSpecialRow } from "./types";
import { formatControllerDate, formatControllerDateTime, formatMinutesOfDay } from "./time";

const PARALLEL_GROUP_ID = 255;

export interface StationState {
	index: number;
	name: string;
	on: boolean;
	disabled: boolean;
	special: boolean;
	group: number; // 0-3 sequential; 255 = parallel
	running: boolean;
	queued: boolean;
	remaining: number; // seconds left, if running
}

export interface ProgramView {
	name: string;
	enabled: boolean;
	useWeather: boolean;
	type: "weekly" | "singlerun" | "monthly" | "interval";
	oddEven: "none" | "odd" | "even";
	days: string;
	startTimes: string[];
	dateRange: { start: string; end: string } | null;
	perStationDurations: Array<{ stationIndex: number; name: string; seconds: number; display: string }>;
}

// ---- formatting helpers ------------------------------------------------------

/** Duration (seconds) → "1h 30m" / "45m" / "0:30". Solar specials handled by getDurationText. */
export function formatDuration( seconds: number ): string {
	const neg = seconds < 0;
	let s = Math.abs( Math.round( seconds ) );
	const d = Math.floor( s / 86400 ); s -= d * 86400;
	const h = Math.floor( s / 3600 ); s -= h * 3600;
	const m = Math.floor( s / 60 ); s -= m * 60;
	const parts: string[] = [];
	if ( d ) parts.push( `${ d }d` );
	if ( h ) parts.push( `${ h }h` );
	if ( m ) parts.push( `${ m }m` );
	let out: string;
	if ( parts.length && s === 0 ) out = parts.join( " " );
	else if ( !d && !h ) out = `${ m }:${ String( s ).padStart( 2, "0" ) }`; // m:ss form, e.g. "0:30"
	else out = [ ...parts, `${ s }s` ].join( " " );
	return ( neg ? "-" : "" ) + out;
}

/** Interval minutes → "2h" / "30m" / "1h 30m". */
export function formatInterval( mins: number ): string {
	if ( mins <= 0 ) return "0m";
	const h = Math.floor( mins / 60 ), m = mins % 60;
	return [ h ? `${ h }h` : "", m ? `${ m }m` : "" ].filter( Boolean ).join( " " ) || "0m";
}

/** Station-duration text, solar-aware (durations[] specials). */
export function getDurationText( sec: number ): string {
	if ( sec === 65535 ) return "Sunset to Sunrise";
	if ( sec === 65534 ) return "Sunrise to Sunset";
	return formatDuration( sec );
}

/** date_encode inverse → "MM/DD". The firmware stores no year for this annual range. */
export function decodeEncodedDate( enc: number ): string {
	return `${ String( enc >> 5 ).padStart( 2, "0" ) }/${ String( enc & 0x1f ).padStart( 2, "0" ) }`;
}

// ---- station ----------------------------------------------------------------

export function decodeStationState( jc: JcResponse, jn: JnResponse, index: number ): StationState {
	const board = index >> 3, bit = index & 0x07;
	const bitOf = ( arr: number[] | undefined ): boolean =>
		Array.isArray( arr ) && board < arr.length ? ( ( arr[ board ] >> bit ) & 1 ) === 1 : false;
	const ps = jc.ps[ index ];
	const [ pid, remaining ] = ps ?? [ 0, 0, 0, 0 ];
	const group = ps ? ps[ 3 ] : 0;
	const on = bitOf( jc.sbits );
	const hasQueueEntry = pid !== 0 && remaining > 0;
	return {
		index,
		name: jn.snames?.[ index ] ?? `S${ String( index + 1 ).padStart( 2, "0" ) }`,
		on,
		disabled: bitOf( jn.stn_dis ),
		special: bitOf( jn.stn_spe ),
		group,
		running: on && hasQueueEntry,
		queued: !on && hasQueueEntry,
		remaining,
	};
}

export function decodeAllStations( jc: JcResponse, jn: JnResponse ): StationState[] {
	return jn.snames.map( ( _, i ) => decodeStationState( jc, jn, i ) );
}

// ---- program ----------------------------------------------------------------

export function decodeProgramDays( flags: number, days0: number, days1: number ): string {
	const type = ( flags >> 4 ) & 0x03;
	const oddeven = ( flags >> 2 ) & 0x03;
	let base: string;
	switch ( type ) {
		case 0: { // WEEKLY — bit0=Mon .. bit6=Sun
			const NAMES = [ "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" ];
			const sel = NAMES.filter( ( _, i ) => ( days0 >> i ) & 1 );
			base = sel.length === 7 ? "Every day" : sel.length === 0 ? "No days" : sel.join( ", " );
			break;
		}
		case 3: // INTERVAL — days1=interval, days0=relative remainder (days from today)
			base = `Every ${ days1 } days` + ( days0 ? ` (in ${ days0 }d)` : "" );
			break;
		case 2: { // MONTHLY — days0 bits0-4 = day-of-month; 0 = last day
			const dom = days0 & 0x1f;
			base = dom === 0 ? "Last day of month" : `Day ${ dom } of month`;
			break;
		}
		default: { // SINGLERUN — (days0<<8)+days1 = epoch day
			const epochDay = ( days0 << 8 ) + days1;
			base = `On ${ formatControllerDate( epochDay * 86400 ) }`;
		}
	}
	if ( oddeven === 1 ) return `${ base } (odd days)`;
	if ( oddeven === 2 ) return `${ base } (even days)`;
	return base;
}

/** Decode one int16 start-time; null = unused slot. */
export function decodeOneStartTime( t: number ): string | null {
	const u = t & 0xffff;
	if ( ( u >> 15 ) & 1 ) return null;          // unused (-1)
	const sunrise = ( u >> 14 ) & 1;
	const sunset = ( u >> 13 ) & 1;
	if ( !sunrise && !sunset ) return formatMinutesOfDay( u & 0x7ff ); // standard
	let offset = u & 0x7ff;
	if ( ( u >> 12 ) & 1 ) offset = -offset;     // sign bit
	const label = sunrise ? "Sunrise" : "Sunset"; // sunrise precedence
	if ( offset === 0 ) return label;
	return `${ label } ${ offset > 0 ? "+" : "-" }${ Math.abs( offset ) }m`;
}

export function decodeStartTimes( flags: number, st: number[] ): string[] {
	const fixed = ( ( flags >> 6 ) & 0x01 ) === 1;
	if ( fixed ) {
		return st.map( decodeOneStartTime ).filter( ( s ): s is string => s !== null );
	}
	// repeating: st[0]=first, st[1]=repeat count, st[2]=interval minutes
	const first = decodeOneStartTime( st[ 0 ] ) ?? "—";
	const count = st[ 1 ] ?? 0;
	const everyMin = st[ 2 ] ?? 0;
	if ( count <= 0 || everyMin <= 0 ) return [ first ];
	return [ `from ${ first }, every ${ formatInterval( everyMin ) }, ${ count }x` ];
}

export function decodeProgram( p: unknown[], stationNames: string[] ): ProgramView {
	const flags = p[ 0 ] as number, days0 = p[ 1 ] as number, days1 = p[ 2 ] as number;
	const st = p[ 3 ] as number[];
	const durations = p[ 4 ] as number[];
	const name = p[ 5 ] as string;
	const dr = p[ 6 ] as number[];
	const TYPE = [ "weekly", "singlerun", "monthly", "interval" ] as const;
	const ODD = [ "none", "odd", "even", "none" ] as const;
	return {
		name,
		enabled: ( flags & 1 ) === 1,
		useWeather: ( ( flags >> 1 ) & 1 ) === 1,
		type: TYPE[ ( flags >> 4 ) & 0x03 ],
		oddEven: ODD[ ( flags >> 2 ) & 0x03 ],
		days: decodeProgramDays( flags, days0, days1 ),
		startTimes: decodeStartTimes( flags, st ),
		dateRange: dr && dr[ 0 ]
			? { start: decodeEncodedDate( dr[ 1 ] ), end: decodeEncodedDate( dr[ 2 ] ) }
			: null,
		perStationDurations: durations.map( ( sec, i ) => ( {
			stationIndex: i,
			name: stationNames[ i ] ?? `S${ String( i + 1 ).padStart( 2, "0" ) }`,
			seconds: sec,
			display: getDurationText( sec ),
		} ) ),
	};
}

export function decodeAllPrograms( jp: JpResponse, stationNames: string[] ): ProgramView[] {
	return jp.pd.map( ( p ) => decodeProgram( p as unknown[], stationNames ) );
}

// ---- logs (/jl) -------------------------------------------------------------
// Station run row: [program, station, durationSec, endtime, flowPulseRate?]
//   flowPulseRate = average sensor pulses/min over the run. Volume needs the fpr0/fpr1
//   calibration from /jo: volume/min = rate × ((fpr1<<8)+fpr0)/100 (see flowLpm).
// Special row:     [value, "<code>", value2, endtime]   code: s1 s2 rs rd fl wl cu
//   value2 = duration seconds (s1/s2/rd/fl) OR water-level % (wl);  value = flow pulses (fl)

export type LogKind = "station" | "sensor1" | "sensor2" | "rainsensor" | "raindelay" | "flow" | "waterlevel" | "current";

export type LogEntry =
	| { kind: "station"; when: number; program: number; station: number; durationSec: number; flowPulseRate?: number }
	| { kind: Exclude<LogKind, "station">; when: number; value: number; durationSec: number };

const LOG_CODE: Record<string, Exclude<LogKind, "station">> = {
	s1: "sensor1", s2: "sensor2", rs: "rainsensor", rd: "raindelay", fl: "flow", wl: "waterlevel", cu: "current",
};

export function decodeLogRow( row: JlRow ): LogEntry {
	if ( typeof row[ 1 ] === "number" ) {
		const [ program, station, durationSec, when, flowPulseRate ] = row as JlStationRow;
		const e: LogEntry = { kind: "station", when, program, station, durationSec };
		if ( typeof flowPulseRate === "number" ) e.flowPulseRate = flowPulseRate;
		return e;
	}
	const [ value, code, value2, when ] = row as JlSpecialRow;
	const kind = LOG_CODE[ code ] ?? "current";
	if ( kind === "waterlevel" ) return { kind, when, value: value2, durationSec: 0 };
	return { kind, when, value, durationSec: value2 };
}

/** Render a firmware /jl timestamp in the controller's configured local clock. */
export function formatControllerTimestamp( controllerEpoch: number ): string {
	return formatControllerDateTime( controllerEpoch );
}

export interface LastRun { when: number; durationSec: number; flowPulseRate?: number }

/** Newest completed run per station index, from the /jl log. */
export function lastRunsByStation( jl: JlRow[] ): Map<number, LastRun> {
	const out = new Map<number, LastRun>();
	for ( const row of jl ) {
		const e = decodeLogRow( row );
		if ( e.kind !== "station" ) continue;
		// /jl is append order (oldest→newest). Last occurrence, not greatest wall-clock value, wins:
		// a DST fall-back makes a genuinely later event's encoded local timestamp smaller or equal.
		out.set( e.station, { when: e.when, durationSec: e.durationSec,
			...( e.flowPulseRate != null ? { flowPulseRate: e.flowPulseRate } : {} ) } );
	}
	return out;
}

const LITERS_PER_GALLON = 3.78541;

/**
 * Sensor pulses/min → gallons/min, using the /jo flow calibration (fpr = liters per 100 pulses,
 * the firmware's convention) converted to imperial for display. Null when the controller has no
 * calibration — callers show nothing rather than a raw pulse count dressed as a unit.
 */
export function flowGpm( pulseRate: number, jo: { fpr0?: number; fpr1?: number } ): number | null {
	const fpr = ( ( jo.fpr1 ?? 0 ) << 8 ) + ( jo.fpr0 ?? 0 );
	if ( fpr <= 0 ) return null;
	const lpm = pulseRate * fpr / 100;
	return Math.round( lpm / LITERS_PER_GALLON * 100 ) / 100;
}

/** Human-readable description of a log entry. Flow shows only when `jo` provides calibration. */
export function describeLogEntry( e: LogEntry, stationNames: string[], jo?: { fpr0?: number; fpr1?: number } ): string {
	switch ( e.kind ) {
		case "station": {
			const name = stationNames[ e.station ] ?? `S${ String( e.station + 1 ).padStart( 2, "0" ) }`;
			const gpm = e.flowPulseRate != null && jo ? flowGpm( e.flowPulseRate, jo ) : null;
			const flow = gpm != null ? ` · ${ gpm } gal/min` : "";
			const src = e.program ? `program ${ e.program }` : "manual";
			return `${ name } ran ${ formatDuration( e.durationSec ) } (${ src })${ flow }`;
		}
		case "sensor1": return `Sensor 1 active ${ formatDuration( e.durationSec ) }`;
		case "sensor2": return `Sensor 2 active ${ formatDuration( e.durationSec ) }`;
		case "rainsensor": return `Rain sensor active ${ formatDuration( e.durationSec ) }`;
		case "raindelay": return `Rain delay ${ formatDuration( e.durationSec ) }`;
		case "flow": return `Flow: ${ e.value } pulses over ${ formatDuration( e.durationSec ) }`;
		case "waterlevel": return `Water level set to ${ e.value }%`;
		case "current": return `Current event (${ e.value })`;
	}
}

export const LOG_KIND_LABEL: Record<LogKind, string> = {
	station: "Run", sensor1: "Sensor 1", sensor2: "Sensor 2", rainsensor: "Rain sensor",
	raindelay: "Rain delay", flow: "Flow", waterlevel: "Water level", current: "Current",
};

export { PARALLEL_GROUP_ID };

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
import type { JcResponse, JnResponse, JpResponse } from "./types";

const PARALLEL_GROUP_ID = 255;

export interface StationState {
	index: number;
	name: string;
	on: boolean;
	disabled: boolean;
	special: boolean;
	group: number; // 0-3 sequential; 255 = parallel
	running: boolean;
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

export function minutesToHHMM( mins: number ): string {
	const m = ( ( mins % 1440 ) + 1440 ) % 1440;
	return `${ String( Math.floor( m / 60 ) ).padStart( 2, "0" ) }:${ String( m % 60 ).padStart( 2, "0" ) }`;
}

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

/** date_encode inverse → "MM-DD". */
export function decodeEncodedDate( enc: number ): string {
	return `${ String( enc >> 5 ).padStart( 2, "0" ) }-${ String( enc & 0x1f ).padStart( 2, "0" ) }`;
}

// ---- station ----------------------------------------------------------------

export function decodeStationState( jc: JcResponse, jn: JnResponse, index: number ): StationState {
	const board = index >> 3, bit = index & 0x07;
	const bitOf = ( arr: number[] | undefined ): boolean =>
		Array.isArray( arr ) && board < arr.length ? ( ( arr[ board ] >> bit ) & 1 ) === 1 : false;
	const ps = jc.ps[ index ];
	const [ pid, remaining ] = ps ?? [ 0, 0, 0, 0 ];
	const group = ps ? ps[ 3 ] : 0;
	return {
		index,
		name: jn.snames?.[ index ] ?? `S${ String( index + 1 ).padStart( 2, "0" ) }`,
		on: bitOf( jc.sbits ),
		disabled: bitOf( jn.stn_dis ),
		special: bitOf( jn.stn_spe ),
		group,
		running: pid !== 0 && remaining > 0,
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
			base = `On ${ new Date( epochDay * 86400000 ).toISOString().slice( 0, 10 ) }`;
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
	if ( !sunrise && !sunset ) return minutesToHHMM( u & 0x7ff ); // standard
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

export { PARALLEL_GROUP_ID };

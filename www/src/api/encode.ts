/**
 * Firmware write encoders — the inverse of api/decode.ts, grounded in the legacy submit code
 * (programs.js submitProgram21, dashboard.js /cs build, dates.js encodeDate). These build the exact
 * byte/array payloads the firmware expects for /cp (programs), /cs (stations) and /co (options), so
 * the typed write layer is faithful. Pure functions — unit-tested by round-tripping through decode.ts.
 *
 * Verified bit layouts (must match decode.ts):
 *   program flags: bit0 enabled, bit1 use_weather, bits2-3 restriction(0 none/1 odd/2 even),
 *                  bits4-5 type(0 weekly/1 singlerun/2 monthly/3 interval), bit6 fixed-start, bit7 daterange
 *   start int16:   bit15 unused(-1), bit14 sunrise, bit13 sunset, bit12 sign, bits0-10 minutes/offset
 *   date encode:   (month<<5) + day   (month 1-12)
 */

// ---- start times -------------------------------------------------------------

export type StartTimeInput =
	| { kind: "off" }
	| { kind: "time"; minutes: number }                 // 0-1439, minutes since midnight
	| { kind: "sunrise"; offsetMinutes: number }
	| { kind: "sunset"; offsetMinutes: number };

/** Encode one program start time to its int16 (−1 = unused). Inverse of decode.decodeOneStartTime. */
export function encodeStartTime( s: StartTimeInput ): number {
	switch ( s.kind ) {
		case "off": return -1;
		case "time": return s.minutes & 0x7ff;
		case "sunrise":
		case "sunset": {
			const base = s.kind === "sunrise" ? ( 1 << 14 ) : ( 1 << 13 );
			const sign = s.offsetMinutes < 0 ? ( 1 << 12 ) : 0;
			return base | sign | ( Math.abs( s.offsetMinutes ) & 0x7ff );
		}
	}
}

// ---- dates -------------------------------------------------------------------

/** date_encode = (month<<5) + day, month 1-12 (legacy dates.js encodeDate). */
export function encodeDate( month: number, day: number ): number {
	return ( month << 5 ) + day;
}

/** Epoch days for a single-run program (legacy dates.js dateToEpoch). */
export function dateToEpochDays( year: number, month: number, day: number ): number {
	return Math.floor( Date.UTC( year, month - 1, day ) / ( 1000 * 86400 ) );
}

// ---- programs (/cp) ----------------------------------------------------------

export type RestrictionInput = "none" | "odd" | "even";
export type ProgramTypeInput = "weekly" | "singlerun" | "monthly" | "interval";

export type ScheduleInput =
	| { type: "weekly"; weekdays: number[] }                                  // 0=Mon..6=Sun
	| { type: "interval"; intervalDays: number; startingInDays: number }
	| { type: "monthly"; dayOfMonth: number }
	| { type: "singlerun"; epochDays: number };

export type StartInput =
	| { type: "repeat"; first: StartTimeInput; count: number; intervalMinutes: number }
	| { type: "fixed"; times: StartTimeInput[] };                             // up to 4

export interface ProgramInput {
	enabled: boolean;
	useWeather: boolean;
	restriction: RestrictionInput;
	schedule: ScheduleInput;
	start: StartInput;
	durations: number[];                  // per-station seconds (0 = excluded)
	name: string;
	dateRange?: { enable: boolean; from: number; to: number };  // from/to already encodeDate()'d
	/** Non-semantic firmware words retained by the existing-program editor on unrelated changes. */
	preservedRaw?: { restrictionCode?: 3; scheduleDays?: [ number, number ] };
}

const PROGRAM_TYPE_CODE: Record<ProgramTypeInput, number> = { weekly: 0, singlerun: 1, monthly: 2, interval: 3 };

/** Program flags byte. Inverse of the decode.ts flags layout. */
export function encodeProgramFlags( p: {
	enabled: boolean; useWeather: boolean; restriction: RestrictionInput;
	type: ProgramTypeInput; fixedStart: boolean; useDateRange: boolean;
} ): number {
	let f = 0;
	if ( p.enabled ) f |= 1;
	if ( p.useWeather ) f |= 1 << 1;
	if ( p.restriction === "odd" ) f |= 1 << 2;
	else if ( p.restriction === "even" ) f |= 2 << 2;
	f |= PROGRAM_TYPE_CODE[ p.type ] << 4;
	if ( p.fixedStart ) f |= 1 << 6;
	if ( p.useDateRange ) f |= 1 << 7;
	return f;
}

/** [days0, days1] for the schedule. Inverse of decode.decodeProgramDays. */
export function encodeProgramDays( s: ScheduleInput ): [ number, number ] {
	switch ( s.type ) {
		case "weekly": {
			let d0 = 0;
			for ( const i of s.weekdays ) if ( i >= 0 && i < 7 ) d0 |= 1 << i;
			return [ d0, 0 ];
		}
		case "interval": return [ s.startingInDays, s.intervalDays ];
		case "monthly": return [ s.dayOfMonth, 0 ];
		case "singlerun": return [ ( s.epochDays >> 8 ) & 0xff, s.epochDays & 0xff ];
	}
}

/** The 4-element start field (legacy submitProgram21 `start`). */
export function encodeStartField( s: StartInput ): number[] {
	if ( s.type === "repeat" ) {
		return [ encodeStartTime( s.first ), s.count, s.intervalMinutes, 0 ];
	}
	const times = [ 0, 1, 2, 3 ].map( ( i ) => encodeStartTime( s.times[ i ] ?? { kind: "off" } ) );
	return times;
}

export interface EncodedProgram {
	v: Array<number | number[]>;                 // [flags, days0, days1, start[4], durations[]]
	name: string;
	dateRange?: { enable: boolean; from: number; to: number };
}

/** Build the /cp `v` array + name (+ optional date range), faithful to submitProgram21. */
export function encodeProgram( p: ProgramInput ): EncodedProgram {
	let flags = encodeProgramFlags( {
		enabled: p.enabled, useWeather: p.useWeather, restriction: p.restriction,
		type: p.schedule.type, fixedStart: p.start.type === "fixed",
		useDateRange: !!p.dateRange?.enable,
	} );
	if ( p.restriction === "none" && p.preservedRaw?.restrictionCode === 3 ) {
		flags = ( flags & ~( 0x03 << 2 ) ) | ( 3 << 2 );
	}
	let [ days0, days1 ] = encodeProgramDays( p.schedule );
	const rawDays = p.preservedRaw?.scheduleDays;
	if ( rawDays && rawDays.length === 2 && rawDays.every( ( value ) =>
		Number.isSafeInteger( value ) && value >= 0 && value <= 255 ) ) {
		const semanticallySame = p.schedule.type === "weekly"
			? ( rawDays[ 0 ] & 0x7f ) === days0
			: p.schedule.type === "monthly" && ( rawDays[ 0 ] & 0x1f ) === days0;
		if ( semanticallySame ) [ days0, days1 ] = rawDays;
	}
	const v: Array<number | number[]> = [ flags, days0, days1, encodeStartField( p.start ), p.durations.slice() ];
	return p.dateRange ? { v, name: p.name, dateRange: p.dateRange } : { v, name: p.name };
}

/** Build the /cp command path (pid=-1 for a new program). */
export function programSubmitPath( pid: number, enc: EncodedProgram ): string {
	let q = `cp?pid=${ pid }&v=${ encodeURIComponent( JSON.stringify( enc.v ) ) }&name=${ encodeURIComponent( enc.name ) }`;
	if ( enc.dateRange ) {
		q += `&endr=${ enc.dateRange.enable ? 1 : 0 }&from=${ enc.dateRange.from }&to=${ enc.dateRange.to }`;
	}
	return q;
}

// ---- stations (/cs) ----------------------------------------------------------

/** Per-board attribute arrays (each index = one board byte) + per-station names/groups. */
export interface StationConfigInput {
	names?: Record<number, string>;       // sid -> name (only changed ones)
	masop?: number[]; masop2?: number[];  // master op per board
	ignoreRain?: number[]; ignoreSn1?: number[]; ignoreSn2?: number[];
	disabled?: number[]; special?: number[]; sequential?: number[]; actRelay?: number[];
	groups?: Record<number, number>;      // sid -> group id (fw220+)
	special_?: { sid: number; type: number; data: string };  // special-station data (st/sd/sid)
	fwv: number;
}

/** Build the /cs query, faithful to dashboard.js (s<sid>, m/n/i/j/k/d/p/q/a<bid>, g<sid>). */
export function stationConfigPath( cfg: StationConfigInput ): string {
	const parts: string[] = [ "cs?" ];
	const kv: string[] = [];
	const addBoards = ( prefix: string, arr?: number[] ): void => {
		if ( !arr ) return;
		arr.forEach( ( v, bid ) => kv.push( `${ prefix }${ bid }=${ v }` ) );
	};
	if ( cfg.names ) {
		for ( const [ sid, name ] of Object.entries( cfg.names ) ) {
			// fw208+ replaces spaces with underscores (firmware parsing bug workaround).
			const n = cfg.fwv >= 208 ? name.replace( /\s/g, "_" ) : name;
			kv.push( `s${ sid }=${ encodeURIComponent( n ) }` );
		}
	}
	addBoards( "m", cfg.masop );
	addBoards( "n", cfg.masop2 );
	addBoards( "i", cfg.ignoreRain );
	addBoards( "j", cfg.ignoreSn1 );
	addBoards( "k", cfg.ignoreSn2 );
	addBoards( "d", cfg.disabled );
	addBoards( "p", cfg.special );
	addBoards( "q", cfg.sequential );
	addBoards( "a", cfg.actRelay );
	if ( cfg.groups ) {
		for ( const [ sid, gid ] of Object.entries( cfg.groups ) ) kv.push( `g${ sid }=${ gid }` );
	}
	if ( cfg.special_ ) {
		kv.push( `sid=${ cfg.special_.sid }`, `st=${ cfg.special_.type }`, `sd=${ encodeURIComponent( cfg.special_.data ) }` );
	}
	return parts[ 0 ] + kv.join( "&" );
}

/** Set/clear bit `stationIndex` across the per-board byte array (helper for editors). */
export function setStationBit( perBoard: number[], stationIndex: number, on: boolean ): number[] {
	const out = perBoard.slice();
	const bid = stationIndex >> 3, bit = stationIndex & 7;
	while ( out.length <= bid ) out.push( 0 );
	out[ bid ] = on ? ( out[ bid ]! | ( 1 << bit ) ) : ( out[ bid ]! & ~( 1 << bit ) );
	return out;
}

// ---- options (/co) -----------------------------------------------------------

/** JSON for a firmware option value (wto/mqtt/email/otc): stringify minus the outer braces. */
export function escapeJsonForFirmware( obj: Record<string, unknown> ): string {
	const j = JSON.stringify( obj );
	return j.slice( 1, j.length - 1 );
}

/**
 * Build a /co options query from NAMED keys (the fw219+ path: keys match /jo, e.g. wl, uwt, tz,
 * sn1t, ip1..). JSON option values (wto/mqtt/email/otc) must be pre-escaped via
 * escapeJsonForFirmware. Values are URL-encoded.
 */
export function optionsPath( named: Record<string, string | number> ): string {
	const kv = Object.entries( named ).map( ( [ k, v ] ) => `${ k }=${ encodeURIComponent( String( v ) ) }` );
	return "co?" + kv.join( "&" );
}

/** `uwt` carries only the adjustment method; current firmware no longer uses bit 7. */
export function encodeUwt( methodId: number ): number {
	return methodId & 0x7f;
}

/** Dotted-quad "a.b.c.d" -> 4 octets for ipN/gwN/dnsN/subnN/ntpN option keys. */
export function ipOctets( dotted: string ): [ number, number, number, number ] {
	const parts = dotted.trim().split( "." );
	if ( parts.length !== 4 || parts.some( ( part ) => !/^\d{1,3}$/.test( part ) ) ) {
		throw new Error( "Enter an IPv4 address with four numeric octets." );
	}
	const octets = parts.map( Number );
	if ( octets.some( ( octet ) => !Number.isInteger( octet ) || octet < 0 || octet > 255 ) ) {
		throw new Error( "Each IPv4 octet must be between 0 and 255." );
	}
	return octets as [ number, number, number, number ];
}

/**
 * Time formatting against the OpenSprinkler firmware time bases (fixes upstream #287).
 *
 * The firmware mixes two bases in /jc, and conflating them is the "Last Request shows the wrong
 * time" bug:
 *   • `devt` is ALREADY shifted to the device timezone (firmware emits `os.now_tz()` = UTC + tzOffset).
 *   • `lwc`, `lswc`, `lupt`, rain-delay `rdst`, and `lrun`/`ps` end-times are RAW UTC epoch seconds.
 *
 * Bug pattern: converting a raw UTC epoch with the browser's timezone (or treating `devt` as UTC)
 * double-applies — or omits — the offset, so the time is off by the tz/DST delta.
 *
 * Fix (PRD §3 / upstream #287): pick ONE consistent base — the DEVICE's local wall clock — and
 * format every value to it exactly once, browser-timezone-independent. We add the device offset to
 * raw UTC epochs, and format `devt` directly (it is already local). Components are read via
 * `getUTC*`, so output is deterministic regardless of where the browser runs.
 */

/**
 * Device tz offset in seconds, from the OpenSprinkler `tz` integer option.
 * Encoding: `tz = (gmtOffsetHours + 12) * 4` (15-minute steps) → offset = (tz − 48) × 900 s.
 * Examples: tz 48 → 0 (UTC); tz 16 → −28800 (GMT−8); tz 52 → +3600 (GMT+1).
 */
export function osTzOffsetSeconds( tz: number ): number {
	return ( tz - 48 ) * 900;
}

/** Format an epoch (already in the desired wall-clock base) as "YYYY-MM-DD HH:MM" via UTC components. */
function fmtComponents( wallClockEpoch: number ): string {
	const d = new Date( wallClockEpoch * 1000 );
	const p = ( n: number ): string => String( n ).padStart( 2, "0" );
	return `${ d.getUTCFullYear() }-${ p( d.getUTCMonth() + 1 ) }-${ p( d.getUTCDate() ) } ` +
		`${ p( d.getUTCHours() ) }:${ p( d.getUTCMinutes() ) }`;
}

/** Format a RAW UTC epoch (lwc/lswc/lupt/rdst/log end-times) in the device's local wall clock. */
export function formatClock( epochUtc: number, tz: number ): string {
	return fmtComponents( epochUtc + osTzOffsetSeconds( tz ) );
}

/** Format `devt` (already device-local) directly — do NOT re-apply the offset. */
export function formatDeviceTime( devt: number ): string {
	return fmtComponents( devt );
}

/** HH:MM (device-local) for a RAW UTC epoch — e.g. the rain-delay stop time `rdst`. */
export function formatClockTime( epochUtc: number, tz: number ): string {
	return fmtComponents( epochUtc + osTzOffsetSeconds( tz ) ).slice( 11 );
}

/** HH:MM from minutes-since-local-midnight (sunrise/sunset are already device-local). */
export function formatMinutesOfDay( minutes: number ): string {
	const p = ( n: number ): string => String( n ).padStart( 2, "0" );
	return `${ p( Math.floor( ( minutes % 1440 ) / 60 ) ) }:${ p( ( ( minutes % 60 ) + 60 ) % 60 ) }`;
}

/** The device's current time as a TRUE UTC epoch (undo the offset baked into `devt`). */
export function deviceNowUtc( devt: number, tz: number ): number {
	return devt - osTzOffsetSeconds( tz );
}

/** Seconds elapsed between a raw UTC `epochUtc` and the device's current time (positive = past). */
export function elapsedSeconds( epochUtc: number, devt: number, tz: number ): number {
	return deviceNowUtc( devt, tz ) - epochUtc;
}

/**
 * Humanize an elapsed-seconds delta as "just now" / "2 min ago" / "in 5 min" (upstream #288).
 * Positive delta = past; negative = future.
 */
export function relativeTime( deltaSeconds: number ): string {
	const past = deltaSeconds >= 0;
	const s = Math.abs( deltaSeconds );
	if ( s < 45 ) return "just now";
	const units: Array<[ limit: number, div: number, name: string ]> = [
		[ 5400, 60, "min" ],          // < 90 min → minutes
		[ 172800, 3600, "hr" ],       // < 48 hr → hours
		[ 31536000, 86400, "day" ],   // < 365 d → days
		[ Infinity, 31536000, "yr" ],
	];
	for ( const [ limit, div, name ] of units ) {
		if ( s < limit ) {
			const n = Math.round( s / div );
			const label = `${ n } ${ name }${ n === 1 ? "" : "s" }`;
			return past ? `${ label } ago` : `in ${ label }`;
		}
	}
	return past ? "a long time ago" : "in a long time"; // unreachable (Infinity guard)
}

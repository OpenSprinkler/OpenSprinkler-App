/**
 * Time formatting against the OpenSprinkler firmware time bases (fixes upstream #287).
 *
 * Firmware emits controller-clock epochs from `os.now_tz()` (the timestamp shifted to the
 * configured controller timezone) for `devt`,
 * weather/power/rain timestamps, queue/last-run fields, and `/jl` log rows.
 *
 * Bug pattern: adding the configured offset to any of those values applies it twice.
 *
 * Fix (PRD §3 / upstream #287): pick ONE consistent base — the DEVICE's local wall clock — and
 * format each value directly, browser-timezone-independent. JavaScript's neutral component getters
 * are used only to unpack that already-local wall clock; the UI never labels or presents it as UTC.
 */

/**
 * Device tz offset in seconds, from the OpenSprinkler `tz` integer option.
 * Encoding: `tz = (gmtOffsetHours + 12) * 4` (15-minute steps) → offset = (tz − 48) × 900 s.
 * Examples: tz 48 → 0 (UTC); tz 16 → −28800 (GMT−8); tz 52 → +3600 (GMT+1).
 */
export function osTzOffsetSeconds( tz: number ): number {
	return ( tz - 48 ) * 900;
}

interface ClockParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}

/**
 * Unpack an epoch that already represents the controller's local wall clock. `getUTC*` deliberately
 * avoids applying the browser's timezone; it does not convert the displayed value to UTC.
 */
function controllerClockParts( wallClockEpoch: number ): ClockParts | null {
	if ( !Number.isFinite( wallClockEpoch ) ) return null;
	const d = new Date( wallClockEpoch * 1000 );
	if ( Number.isNaN( d.getTime() ) ) return null;
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate(),
		hour: d.getUTCHours(),
		minute: d.getUTCMinutes(),
	};
}

function twoDigits( n: number ): string {
	return String( n ).padStart( 2, "0" );
}

function formatHourMinute( hour: number, minute: number ): string {
	const suffix = hour >= 12 ? "PM" : "AM";
	const hour12 = hour % 12 || 12;
	return `${ hour12 }:${ twoDigits( minute ) } ${ suffix }`;
}

/** Format a controller-local epoch as MM/DD/YYYY. */
export function formatControllerDate( controllerEpoch: number ): string {
	const parts = controllerClockParts( controllerEpoch );
	if ( !parts ) return "Invalid date";
	return `${ twoDigits( parts.month ) }/${ twoDigits( parts.day ) }/${ parts.year }`;
}

/** Format a controller-local epoch as MM/DD/YYYY h:mm AM/PM. */
export function formatControllerDateTime( controllerEpoch: number ): string {
	const parts = controllerClockParts( controllerEpoch );
	if ( !parts ) return "Invalid date";
	return `${ twoDigits( parts.month ) }/${ twoDigits( parts.day ) }/${ parts.year } ` +
		formatHourMinute( parts.hour, parts.minute );
}

/** Format a controller-local epoch as h:mm AM/PM. */
export function formatControllerTime( controllerEpoch: number ): string {
	const parts = controllerClockParts( controllerEpoch );
	return parts ? formatHourMinute( parts.hour, parts.minute ) : "Invalid time";
}

/** Format `devt` (already device-local) directly — do NOT re-apply the offset. */
export function formatDeviceTime( devt: number ): string {
	return formatControllerDateTime( devt );
}

/** h:mm AM/PM from minutes-since-local-midnight (sunrise/sunset are already device-local). */
export function formatMinutesOfDay( minutes: number ): string {
	if ( !Number.isFinite( minutes ) ) return "Invalid time";
	const normalized = ( ( Math.trunc( minutes ) % 1440 ) + 1440 ) % 1440;
	return formatHourMinute( Math.floor( normalized / 60 ), normalized % 60 );
}

/** The device's current time as a TRUE UTC epoch (undo the offset baked into `devt`). */
export function deviceNowUtc( devt: number, tz: number ): number {
	return devt - osTzOffsetSeconds( tz );
}

/** Seconds elapsed between two controller-clock epochs (positive = past). */
export function elapsedSeconds( controllerEpoch: number, devt: number ): number {
	return devt - controllerEpoch;
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

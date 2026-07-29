/**
 * Program editor — builds a typed ProgramInput from a form for /cp (create new / overwrite).
 * Covers schedule (weekly/interval/monthly/single-run), start times (fixed up to 4, or repeating),
 * per-station durations, weather use, and odd/even restriction. buildProgramInput() is pure + tested;
 * the encoder (api/encode.ts) turns it into the firmware payload.
 */
import type { JnResponse, OSProgram } from "../../api/types";
import {
	textField, numberField, checkboxField, selectField, checkboxValue, type SelectOption,
} from "../../ui/form";
import { esc, infoNote } from "../../ui/help";
import { decodeEncodedDate, decodeOneStartTime } from "../../api/decode";
import { formatControllerDate } from "../../api/time";
import {
	dateToEpochDays, encodeDate, encodeProgramDays, encodeStartTime,
	type ProgramInput, type ScheduleInput, type StartInput, type StartTimeInput,
} from "../../api/encode";

export type FormValues = Record<string, string | boolean >;

const WEEKDAYS = [ "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" ];
const TYPE_OPTS: SelectOption[] = [
	{ value: "weekly", label: "Weekly" }, { value: "interval", label: "Interval (every N days)" },
	{ value: "monthly", label: "Monthly (day of month)" }, { value: "singlerun", label: "Single run (one date)" },
];
const REST_OPTS: SelectOption[] = [
	{ value: "none", label: "None" }, { value: "odd", label: "Odd days" }, { value: "even", label: "Even days" },
];
const START_OPTS: SelectOption[] = [
	{ value: "fixed", label: "Fixed times" }, { value: "repeat", label: "Repeating" },
];
const DURATION_OPTS: SelectOption[] = [
	{ value: "minutes", label: "Minutes" },
	{ value: "seconds", label: "Exact seconds" },
	{ value: "sunrise-sunset", label: "Sunrise to sunset" },
	{ value: "sunset-sunrise", label: "Sunset to sunrise" },
];
const MAX_CONFIGURED_STATIONS = 200;
const MAX_REPEAT_COUNT = 0x7fff;
const CLOCK_PATTERN = "(?:(?:0?[1-9]|1[0-2]):[0-5][0-9] [AaPp][Mm]|(?:[Ss]unrise|[Ss]unset)(?:\\s*(?:\\+|-)\\s*[0-9]{1,4}[Mm])?)";
const DATE_PATTERN = "(?:0[1-9]|1[0-2])/(?:0[1-9]|[12][0-9]|3[01])/[0-9]{4}";
const ANNUAL_RANGE_YEAR = 2000; // Leap year: every valid annual month/day can be represented.

/** "h:mm AM/PM" -> minutes since midnight (or null if blank/invalid). */
export function parseClock( s: string ): number | null {
	const m = /^(0?[1-9]|1[0-2]):([0-5]\d)\s+([AP])M$/i.exec( s.trim() );
	if ( !m ) return null;
	const hour12 = parseInt( m[ 1 ]!, 10 ), minute = parseInt( m[ 2 ]!, 10 );
	const hour = ( hour12 % 12 ) + ( m[ 3 ]!.toUpperCase() === "P" ? 12 : 0 );
	return hour * 60 + minute;
}

/** Parse a wall-clock or a firmware solar-relative start label. */
export function parseStartTime( s: string ): StartTimeInput | null {
	const clock = parseClock( s );
	if ( clock !== null ) return { kind: "time", minutes: clock };
	const solar = /^(Sunrise|Sunset)(?:\s*([+-])\s*(\d{1,4})m)?$/i.exec( s.trim() );
	if ( !solar ) return null;
	const magnitude = solar[ 3 ] === undefined ? 0 : Number( solar[ 3 ] );
	if ( !Number.isSafeInteger( magnitude ) || magnitude > 0x7ff ) return null;
	const offsetMinutes = solar[ 2 ] === "-" ? -magnitude : magnitude;
	return solar[ 1 ]!.toLowerCase() === "sunrise"
		? { kind: "sunrise", offsetMinutes }
		: { kind: "sunset", offsetMinutes };
}

/** "MM/DD/YYYY" -> {year,month,day} (or null). */
export function parseDate( s: string ): { year: number; month: number; day: number } | null {
	const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec( s.trim() );
	if ( !m ) return null;
	const month = +m[ 1 ]!, day = +m[ 2 ]!, year = +m[ 3 ]!;
	if ( year < 1970 || year > 2149 || month < 1 || month > 12 || day < 1 ) return null;
	const leap = year % 4 === 0 && ( year % 100 !== 0 || year % 400 === 0 );
	const daysInMonth = [ 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
	if ( day > daysInMonth[ month - 1 ]! ) return null;
	return { year, month, day };
}

function integerInRange( value: string | boolean | undefined, label: string, min: number, max: number, fallback?: number ): number {
	const raw = value === undefined || value === "" ? ( fallback === undefined ? "" : String( fallback ) ) : String( value ).trim();
	if ( !/^-?\d+$/.test( raw ) ) throw new Error( `${ label } must be a whole number.` );
	const number = Number( raw );
	if ( !Number.isSafeInteger( number ) || number < min || number > max ) throw new Error( `${ label } must be between ${ min } and ${ max }.` );
	return number;
}

function hiddenField( name: string, value: string | number ): string {
	return `<input type="hidden" name="${ esc( name ) }" value="${ esc( String( value ) ) }">`;
}

function encodedStartToInput( raw: number ): StartTimeInput {
	const unsigned = raw & 0xffff;
	if ( ( unsigned >> 15 ) & 1 ) return { kind: "off" };
	const sunrise = ( ( unsigned >> 14 ) & 1 ) === 1;
	const sunset = ( ( unsigned >> 13 ) & 1 ) === 1;
	if ( !sunrise && !sunset ) return { kind: "time", minutes: unsigned & 0x7ff };
	const magnitude = unsigned & 0x7ff;
	const offsetMinutes = ( ( unsigned >> 12 ) & 1 ) === 1 ? -magnitude : magnitude;
	return sunrise ? { kind: "sunrise", offsetMinutes } : { kind: "sunset", offsetMinutes };
}

function displayedStart( raw: number ): string {
	return decodeOneStartTime( raw ) ?? "";
}

function annualDate( encoded: number ): string {
	return `${ decodeEncodedDate( encoded ) }/${ ANNUAL_RANGE_YEAR }`;
}

function durationFields( name: string, sid: number, raw: number ): string {
	let mode = "minutes";
	let value = raw / 60;
	if ( raw === 65534 ) { mode = "sunrise-sunset"; value = 0; }
	else if ( raw === 65535 ) { mode = "sunset-sunrise"; value = 0; }
	else if ( raw % 60 !== 0 || raw > 64800 ) { mode = "seconds"; value = raw; }
	return `<fieldset class="duration-field"><legend>${ esc( name ) }</legend>` +
		selectField( `durMode_${ sid }`, "Duration format", DURATION_OPTS, mode ) +
		numberField( `dur_${ sid }`, "Duration", value, {
			min: 0, max: 65533, step: 1,
			help: "Use 0 to skip. Exact seconds and solar spans are preserved when editing.",
		} ) + `</fieldset>`;
}

/** Render a new editor, or prefill an existing raw /jp tuple when `program` is supplied. */
export function renderProgramEditor(
	jn: JnResponse, fwv = 0, programNameSize = 32, program?: OSProgram, pid = -1,
): string {
	if ( program && ( !Number.isSafeInteger( pid ) || pid < 0 ) ) throw new Error( "An existing program needs a valid program index." );
	if ( program && program[ 4 ].length !== jn.snames.length ) throw new Error( "Program and station counts do not match." );
	const flags = program?.[ 0 ] ?? ( ( 1 << 1 ) | ( 1 << 6 ) );
	const days0 = program?.[ 1 ] ?? 0b0011111;
	const days1 = program?.[ 2 ] ?? 0;
	const starts = program?.[ 3 ] ?? [ 360, -1, -1, -1 ];
	const type = ( [ "weekly", "singlerun", "monthly", "interval" ] as const )[ ( flags >> 4 ) & 0x03 ];
	const restrictionCode = ( flags >> 2 ) & 0x03;
	const restriction = restrictionCode === 1 ? "odd" : restrictionCode === 2 ? "even" : "none";
	const fixed = ( ( flags >> 6 ) & 1 ) === 1;
	const range = program?.[ 6 ];
	// In repeating mode slots 1-3 are count/interval/reserved words, not encoded clock values.
	// When changing modes, carry only the genuine first start into the fixed-time controls.
	const fixedStarts = fixed ? starts : [ starts[ 0 ] ?? -1, -1, -1, -1 ];
	const weeklyDays = type === "weekly" ? days0 : 0b0011111;
	const wd = WEEKDAYS.map( ( d, i ) => checkboxField( `wd_${ i }`, d, ( ( weeklyDays >> i ) & 1 ) === 1 ) ).join( "" );
	const durs = jn.snames.map( ( name, sid ) => durationFields( name, sid, program?.[ 4 ][ sid ] ?? 0 ) ).join( "" );
	const fixedTimes = [ 0, 1, 2, 3 ].map( ( i ) =>
		textField( `t_${ i }`, `Start time ${ i + 1 }`, displayedStart( fixedStarts[ i ] ?? -1 ), {
			placeholder: "h:mm AM/PM or Sunrise/Sunset", pattern: CLOCK_PATTERN,
		} ) ).join( "" );
	const rawStarts = program ? fixedStarts.map( ( value, i ) => hiddenField( `rawStart_${ i }`, value ) ).join( "" ) : "";
	const rawRepeat = program
		? hiddenField( "rawRepeatCount", starts[ 1 ] ?? 0 ) + hiddenField( "rawRepeatInterval", starts[ 2 ] ?? 0 )
		: "";
	const compatibilityFields = program ? [
		restrictionCode === 3 ? hiddenField( "rawRestrictionCode", 3 ) : "",
		( type === "weekly" && ( ( days0 & 0x80 ) !== 0 || days1 !== 0 ) ) ||
			type === "monthly" && ( days0 > 31 || days1 !== 0 )
			? hiddenField( "rawScheduleType", type ) + hiddenField( "rawScheduleDays", `${ days0 },${ days1 }` ) : "",
		type === "weekly" && ( days0 & 0x7f ) === 0 ? hiddenField( "rawEmptyWeekdays", 1 ) : "",
		fixed && fixedStarts.every( ( value ) => decodeOneStartTime( value ) === null )
			? hiddenField( "rawEmptyStarts", fixedStarts.join( "," ) ) : "",
		program[ 4 ].every( ( value ) => value === 0 ) ? hiddenField( "rawEmptyDurations", 1 ) : "",
		fixed && new Set( fixedStarts.filter( ( value ) => decodeOneStartTime( value ) !== null ) ).size <
			fixedStarts.filter( ( value ) => decodeOneStartTime( value ) !== null ).length
			? hiddenField( "rawDuplicateStarts", fixedStarts.join( "," ) ) : "",
	].join( "" ) : "";
	// Direct callers historically pass `fwv` (221); the settings host can pass `fwv*10+fwm`
	// (2213). Normalize both shapes so the 2.1.9(9) interval capability is represented exactly.
	const fwvCombined = fwv >= 1000 ? fwv : fwv * 10;
	const intervalMinimum = fwvCombined >= 2199 ? 1 : 2;
	const repeatCount = !fixed ? starts[ 1 ] ?? 1 : 1;
	const repeatInterval = !fixed ? starts[ 2 ] ?? 60 : 60;
	const editing = !!program;

	return `<section aria-label="Program editor"><h2>${ editing ? "Edit Program" : "New Program" }</h2>` +
		infoNote( editing ? "Update this watering schedule. Existing values are preserved until you save." :
			"Define a watering schedule. Saved to the device via /cp." ) +
		`<form class="settings" data-settings="program" data-count="${ jn.snames.length }" data-pid="${ editing ? pid : -1 }">` +
		rawStarts + rawRepeat + compatibilityFields +
		textField( "name", "Program name", program?.[ 5 ] ?? "", { placeholder: "e.g. Morning", maxLength: programNameSize } ) +
		checkboxField( "enabled", "Enabled", ( flags & 1 ) === 1,
			editing ? "Keep or change this program's current state." : "New programs stay disabled until you review and enable them." ) +
		checkboxField( "useWeather", "Use weather adjustment", ( ( flags >> 1 ) & 1 ) === 1 ) +
		selectField( "restriction", "Day restriction", REST_OPTS, restriction ) +
		selectField( "schedType", "Schedule", TYPE_OPTS, type ) +
		`<fieldset data-when="weekly"><legend>Weekly days</legend>${ wd }</fieldset>` +
		`<fieldset data-when="interval"><legend>Interval</legend>` +
			numberField( "intervalDays", "Every N days", type === "interval" ? days1 : 2, { min: intervalMinimum, max: 255 } ) +
			numberField( "startingInDays", "Starting in (days)", type === "interval" ? days0 : 0, { min: 0, max: 254 } ) + `</fieldset>` +
		`<fieldset data-when="monthly"><legend>Monthly</legend>` +
			numberField( "dayOfMonth", "Day of month", type === "monthly" ? days0 & 0x1f : 1,
				{ min: 0, max: 31, help: "0 = last day." } ) + `</fieldset>` +
		`<fieldset data-when="singlerun"><legend>Single run</legend>` +
			textField( "singleDate", "Date (MM/DD/YYYY)", type === "singlerun"
				? formatControllerDate( ( ( days0 << 8 ) + days1 ) * 86400 ) : "",
				{ placeholder: "MM/DD/YYYY", pattern: DATE_PATTERN } ) + `</fieldset>` +
		selectField( "startType", "Start type", START_OPTS, fixed ? "fixed" : "repeat" ) +
		`<fieldset data-when="fixed"><legend>Fixed start times</legend>${ fixedTimes }</fieldset>` +
		`<fieldset data-when="repeat"><legend>Repeating</legend>` +
			textField( "repeatFirst", "First start", displayedStart( starts[ 0 ] ?? -1 ) || "6:00 AM",
				{ placeholder: "h:mm AM/PM or Sunrise/Sunset", pattern: CLOCK_PATTERN } ) +
			numberField( "repeatCount", "Repeat count", repeatCount, { min: repeatCount === 0 ? 0 : 1, max: MAX_REPEAT_COUNT } ) +
			numberField( "repeatInterval", "Interval (minutes)", repeatInterval, { min: repeatInterval === 0 ? 0 : 1, max: 1440 } ) + `</fieldset>` +
		`<fieldset class="duration-list"><legend>Run times</legend>${ durs }</fieldset>` +
		( fwvCombined >= 2200
			? `<fieldset><legend>Date range (optional)</legend>` +
				checkboxField( "useDateRange", "Limit to a seasonal date range", range?.[ 0 ] === 1 ) +
				infoNote( "Enter dates as MM/DD/YYYY. The controller repeats this seasonal range every year." ) +
				textField( "drFrom", "From (MM/DD/YYYY)", range ? annualDate( range[ 1 ] ) : "", { placeholder: "MM/DD/YYYY", pattern: DATE_PATTERN } ) +
				textField( "drTo", "To (MM/DD/YYYY)", range ? annualDate( range[ 2 ] ) : "", { placeholder: "MM/DD/YYYY", pattern: DATE_PATTERN } ) + `</fieldset>`
			: "" ) +
		`<div class="action-bar" role="group" aria-label="Program editor controls">` +
		`<button type="submit" class="action primary" data-save="program">${ editing ? "Save changes" : "Save program" }</button>` +
		( editing ? `<button type="button" class="action" data-action="program-cancel">Cancel</button>` : "" ) + `</div>` +
		`</form></section>`;
}

function buildSchedule( v: FormValues, fwvCombined: number ): ScheduleInput {
	switch ( String( v.schedType ) ) {
		case "interval": {
			// Firmware before 2.1.9(9) stores 2 as the smallest valid divisor. Newer builds accept 1.
			const minimum = fwvCombined >= 2199 ? 1 : 2;
			const intervalDays = integerInRange( v.intervalDays, "Interval", minimum, 255, 2 );
			const startingInDays = integerInRange( v.startingInDays, "Starting offset", 0, 254, 0 );
			if ( startingInDays >= intervalDays ) throw new Error( "Starting offset must be less than the interval." );
			return {
				type: "interval",
				intervalDays,
				startingInDays,
			};
		}
		case "monthly":
			return { type: "monthly", dayOfMonth: integerInRange( v.dayOfMonth, "Day of month", 0, 31, 1 ) };
		case "singlerun": {
			const d = parseDate( String( v.singleDate ?? "" ) );
			if ( !d ) throw new Error( "Enter a valid single-run date." );
			const epochDays = dateToEpochDays( d.year, d.month, d.day );
			if ( epochDays > 0xffff ) throw new Error( "Single-run dates must be on or before 06/06/2149." );
			return { type: "singlerun", epochDays };
		}
		case "weekly": {
			const weekdays: number[] = [];
			for ( let i = 0; i < 7; i++ ) {
				if ( checkboxValue( v[ `wd_${ i }` ], `Weekday ${ i + 1 }` ) ) weekdays.push( i );
			}
			if ( weekdays.length === 0 && v.rawEmptyWeekdays !== "1" ) throw new Error( "Select at least one weekday." );
			return { type: "weekly", weekdays };
		}
		default: throw new Error( "Select a valid schedule type." );
	}
}

function startTimeFromField( v: FormValues, field: string, rawIndex: number ): StartTimeInput {
	const value = String( v[ field ] ?? "" ).trim();
	const rawValue = v[ `rawStart_${ rawIndex }` ];
	if ( typeof rawValue === "string" && /^-?\d+$/.test( rawValue ) ) {
		const raw = Number( rawValue );
		if ( Number.isSafeInteger( raw ) && raw >= -1 && raw <= 0x7fff && value === displayedStart( raw ) ) {
			return encodedStartToInput( raw );
		}
	}
	if ( value === "" ) return { kind: "off" };
	const parsed = parseStartTime( value );
	if ( parsed === null ) {
		throw new Error( `Invalid start time: ${ value }. Use h:mm AM/PM or Sunrise/Sunset with an optional minute offset.` );
	}
	return parsed;
}

function repeatingInteger(
	v: FormValues, field: "repeatCount" | "repeatInterval", rawField: "rawRepeatCount" | "rawRepeatInterval",
	label: string, max: number, fallback: number,
): number {
	const value = String( v[ field ] ?? "" ).trim();
	const original = v[ rawField ];
	if ( typeof original === "string" && value === original && /^\d+$/.test( original ) ) {
		const raw = Number( original );
		// Some stored programs use zero to mean no repeats/window. Preserve it on unrelated edits,
		// while continuing to require a positive value for newly entered repeating schedules.
		if ( Number.isSafeInteger( raw ) && raw >= 0 && raw <= max ) return raw;
	}
	return integerInRange( v[ field ], label, 1, max, fallback );
}

function buildStart( v: FormValues ): StartInput {
	const startType = String( v.startType );
	if ( startType === "repeat" ) {
		const first = startTimeFromField( v, "repeatFirst", 0 );
		if ( first.kind === "off" ) throw new Error( "Enter the first repeating start time." );
		return {
			type: "repeat",
			first,
			count: repeatingInteger( v, "repeatCount", "rawRepeatCount", "Repeat count", MAX_REPEAT_COUNT, 1 ),
			intervalMinutes: repeatingInteger( v, "repeatInterval", "rawRepeatInterval", "Repeat interval", 1440, 60 ),
		};
	}
	if ( startType !== "fixed" ) throw new Error( "Select a valid start type." );
	const times = [ 0, 1, 2, 3 ].map( ( i ) => startTimeFromField( v, `t_${ i }`, i ) );
	const encoded = times.map( encodeStartTime );
	if ( times.every( ( time ) => time.kind === "off" ) && v.rawEmptyStarts !== encoded.join( "," ) ) {
		throw new Error( "Enter at least one start time." );
	}
	const active = encoded.filter( ( value ) => value !== -1 );
	if ( new Set( active ).size !== active.length && v.rawDuplicateStarts !== encoded.join( "," ) ) {
		throw new Error( "Start times must not contain duplicates." );
	}
	return { type: "fixed", times };
}

function buildDuration( v: FormValues, sid: number ): number {
	const field = v[ `dur_${ sid }` ];
	switch ( String( v[ `durMode_${ sid }` ] ?? "minutes" ) ) {
		case "minutes": return integerInRange( field, `Station ${ sid + 1 } duration`, 0, 1080, 0 ) * 60;
		case "seconds": return integerInRange( field, `Station ${ sid + 1 } duration`, 0, 65533, 0 );
		case "sunrise-sunset": return 65534;
		case "sunset-sunrise": return 65535;
		default: throw new Error( `Select a valid duration format for station ${ sid + 1 }.` );
	}
}

/** Map read form values -> ProgramInput. `count` = station count; `fwvCombined` = fwv*10+fwm. */
export function buildProgramInput( v: FormValues, count: number, fwvCombined = 0, programNameSize = 32 ): ProgramInput {
	if ( !Number.isSafeInteger( count ) || count < 1 || count > MAX_CONFIGURED_STATIONS ) throw new Error( "Invalid station count." );
	if ( !Number.isSafeInteger( fwvCombined ) || fwvCombined < 0 || fwvCombined > 9999 ) throw new Error( "Invalid firmware version." );
	const durations: number[] = [];
	for ( let sid = 0; sid < count; sid++ ) {
		durations.push( buildDuration( v, sid ) );
	}
	if ( durations.every( ( duration ) => duration === 0 ) && v.rawEmptyDurations !== "1" ) {
		throw new Error( "Set a positive run time for at least one station." );
	}
	const rest = String( v.restriction ?? "none" );
	if ( !REST_OPTS.some( ( option ) => option.value === rest ) ) throw new Error( "Select a valid day restriction." );
	const name = typeof v.name === "string" ? v.name : "";
	if ( !Number.isSafeInteger( programNameSize ) || programNameSize < 1 || programNameSize > 255 ) throw new Error( "Invalid program-name limit." );
	if ( new TextEncoder().encode( name ).length > programNameSize ) {
		throw new Error( `Program name must be at most ${ programNameSize } UTF-8 bytes.` );
	}
	const schedule = buildSchedule( v, fwvCombined );
	const input: ProgramInput = {
		enabled: checkboxValue( v.enabled, "Program enabled" ),
		useWeather: checkboxValue( v.useWeather, "Use weather" ),
		restriction: rest === "odd" || rest === "even" ? rest : "none",
		schedule,
		start: buildStart( v ),
		durations,
		name,
	};
	const preservedRaw: NonNullable<ProgramInput[ "preservedRaw" ]> = {};
	if ( input.restriction === "none" && v.rawRestrictionCode === "3" ) preservedRaw.restrictionCode = 3;
	const rawDays = typeof v.rawScheduleDays === "string" ? /^(\d{1,3}),(\d{1,3})$/.exec( v.rawScheduleDays ) : null;
	if ( rawDays ) {
		const candidate: [ number, number ] = [ Number( rawDays[ 1 ] ), Number( rawDays[ 2 ] ) ];
		const canonical = encodeProgramDays( schedule );
		const validBytes = candidate.every( ( value ) => Number.isSafeInteger( value ) && value >= 0 && value <= 255 );
		const semanticallySame = schedule.type === "weekly"
			? ( candidate[ 0 ] & 0x7f ) === canonical[ 0 ]
			: schedule.type === "monthly" && ( candidate[ 0 ] & 0x1f ) === canonical[ 0 ];
		if ( v.rawScheduleType === schedule.type && validBytes && semanticallySame ) preservedRaw.scheduleDays = candidate;
	}
	if ( preservedRaw.restrictionCode !== undefined || preservedRaw.scheduleDays !== undefined ) {
		input.preservedRaw = preservedRaw;
	}
	const dr = parseDate( String( v.drFrom ?? "" ) );
	const dr2 = parseDate( String( v.drTo ?? "" ) );
	if ( checkboxValue( v.useDateRange, "Use date range" ) ) {
		if ( !dr || !dr2 ) throw new Error( "Enter valid start and end dates for the seasonal range." );
		input.dateRange = { enable: true, from: encodeDate( dr.month, dr.day ), to: encodeDate( dr2.month, dr2.day ) };
	}
	return input;
}

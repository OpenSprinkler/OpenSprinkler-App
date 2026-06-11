/**
 * Program editor — builds a typed ProgramInput from a form for /cp (create new / overwrite).
 * Covers schedule (weekly/interval/monthly/single-run), start times (fixed up to 4, or repeating),
 * per-station durations, weather use, and odd/even restriction. buildProgramInput() is pure + tested;
 * the encoder (api/encode.ts) turns it into the firmware payload.
 */
import type { JnResponse } from "../../api/types";
import {
	textField, numberField, checkboxField, selectField, toInt, type SelectOption,
} from "../../ui/form";
import { esc, infoNote } from "../../ui/help";
import {
	dateToEpochDays, encodeDate, type ProgramInput, type ScheduleInput, type StartInput, type StartTimeInput,
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

/** "HH:MM" -> minutes since midnight (or null if blank/invalid). */
export function parseClock( s: string ): number | null {
	const m = /^(\d{1,2}):(\d{2})$/.exec( s.trim() );
	if ( !m ) return null;
	return ( parseInt( m[ 1 ]!, 10 ) * 60 + parseInt( m[ 2 ]!, 10 ) ) % 1440;
}

/** "YYYY-MM-DD" -> {year,month,day} (or null). */
function parseDate( s: string ): { year: number; month: number; day: number } | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec( s.trim() );
	if ( !m ) return null;
	return { year: +m[ 1 ]!, month: +m[ 2 ]!, day: +m[ 3 ]! };
}

export function renderProgramEditor( jn: JnResponse, fwv = 0 ): string {
	const wd = WEEKDAYS.map( ( d, i ) => checkboxField( `wd_${ i }`, d, i < 5 ) ).join( "" );
	const durs = jn.snames.map( ( name, sid ) =>
		numberField( `dur_${ sid }`, esc( name ), 0, { min: 0, max: 1080, help: "Minutes (0 = skip)." } ) ).join( "" );
	const fixedTimes = [ 0, 1, 2, 3 ].map( ( i ) =>
		textField( `t_${ i }`, `Start time ${ i + 1 }`, i === 0 ? "06:00" : "", { placeholder: "HH:MM (blank = unused)" } ) ).join( "" );

	return `<section aria-label="Program editor"><h2>New Program</h2>` +
		infoNote( "Define a watering schedule. Saved to the device via /cp." ) +
		`<form class="settings" data-settings="program" data-count="${ jn.snames.length }">` +
		textField( "name", "Program name", "", { placeholder: "e.g. Morning" } ) +
		checkboxField( "enabled", "Enabled", true ) +
		checkboxField( "useWeather", "Use weather adjustment", true ) +
		selectField( "restriction", "Day restriction", REST_OPTS, "none" ) +
		selectField( "schedType", "Schedule", TYPE_OPTS, "weekly" ) +
		`<fieldset data-when="weekly"><legend>Weekly days</legend>${ wd }</fieldset>` +
		`<fieldset data-when="interval"><legend>Interval</legend>` +
			numberField( "intervalDays", "Every N days", 2, { min: 1, max: 128 } ) +
			numberField( "startingInDays", "Starting in (days)", 0, { min: 0, max: 127 } ) + `</fieldset>` +
		`<fieldset data-when="monthly"><legend>Monthly</legend>` +
			numberField( "dayOfMonth", "Day of month", 1, { min: 0, max: 31, help: "0 = last day." } ) + `</fieldset>` +
		`<fieldset data-when="singlerun"><legend>Single run</legend>` +
			textField( "singleDate", "Date", "", { placeholder: "YYYY-MM-DD" } ) + `</fieldset>` +
		selectField( "startType", "Start type", START_OPTS, "fixed" ) +
		`<fieldset data-when="fixed"><legend>Fixed start times</legend>${ fixedTimes }</fieldset>` +
		`<fieldset data-when="repeat"><legend>Repeating</legend>` +
			textField( "repeatFirst", "First start", "06:00", { placeholder: "HH:MM" } ) +
			numberField( "repeatCount", "Repeat count", 1, { min: 1, max: 255 } ) +
			numberField( "repeatInterval", "Interval (minutes)", 60, { min: 1, max: 1440 } ) + `</fieldset>` +
		`<fieldset><legend>Run times</legend>${ durs }</fieldset>` +
		( fwv >= 220
			? `<fieldset><legend>Date range (optional)</legend>` +
				checkboxField( "useDateRange", "Limit to a seasonal date range", false ) +
				textField( "drFrom", "From", "", { placeholder: "YYYY-MM-DD" } ) +
				textField( "drTo", "To", "", { placeholder: "YYYY-MM-DD" } ) + `</fieldset>`
			: "" ) +
		`<button type="submit" class="action primary" data-save="program">Save program</button>` +
		`</form></section>`;
}

function buildSchedule( v: FormValues ): ScheduleInput {
	switch ( String( v.schedType ) ) {
		case "interval":
			return { type: "interval", intervalDays: toInt( v.intervalDays, 2 ), startingInDays: toInt( v.startingInDays, 0 ) };
		case "monthly":
			return { type: "monthly", dayOfMonth: toInt( v.dayOfMonth, 1 ) };
		case "singlerun": {
			const d = parseDate( String( v.singleDate ?? "" ) );
			return { type: "singlerun", epochDays: d ? dateToEpochDays( d.year, d.month, d.day ) : 0 };
		}
		default: {
			const weekdays: number[] = [];
			for ( let i = 0; i < 7; i++ ) if ( v[ `wd_${ i }` ] ) weekdays.push( i );
			return { type: "weekly", weekdays };
		}
	}
}

function startTimeFromClock( s: string ): StartTimeInput {
	const m = parseClock( s );
	return m === null ? { kind: "off" } : { kind: "time", minutes: m };
}

function buildStart( v: FormValues ): StartInput {
	if ( String( v.startType ) === "repeat" ) {
		return {
			type: "repeat",
			first: startTimeFromClock( String( v.repeatFirst ?? "" ) ),
			count: toInt( v.repeatCount, 1 ),
			intervalMinutes: toInt( v.repeatInterval, 60 ),
		};
	}
	const times = [ 0, 1, 2, 3 ].map( ( i ) => startTimeFromClock( String( v[ `t_${ i }` ] ?? "" ) ) );
	return { type: "fixed", times };
}

/** Map read form values -> ProgramInput. `count` = number of stations (for the durations array). */
export function buildProgramInput( v: FormValues, count: number ): ProgramInput {
	const durations: number[] = [];
	for ( let sid = 0; sid < count; sid++ ) durations.push( toInt( v[ `dur_${ sid }` ], 0 ) * 60 );
	const rest = String( v.restriction ?? "none" );
	const input: ProgramInput = {
		enabled: !!v.enabled,
		useWeather: !!v.useWeather,
		restriction: rest === "odd" || rest === "even" ? rest : "none",
		schedule: buildSchedule( v ),
		start: buildStart( v ),
		durations,
		name: typeof v.name === "string" ? v.name : "",
	};
	const dr = parseDate( String( v.drFrom ?? "" ) );
	const dr2 = parseDate( String( v.drTo ?? "" ) );
	if ( v.useDateRange && dr && dr2 ) {
		input.dateRange = { enable: true, from: encodeDate( dr.month, dr.day ), to: encodeDate( dr2.month, dr2.day ) };
	}
	return input;
}

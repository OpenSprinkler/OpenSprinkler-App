/**
 * General settings — device name, timezone, water level, sequential, station delay, logging and
 * sensor 1 config. Writes via /co using NAMED option keys (fw219+, keys match /jo). render* emits
 * the form; buildGeneralOptions() maps read form values to /co params (pure + tested).
 */
import type { JoResponse } from "../../api/types";
import { textField, numberField, checkboxField, selectField, checkboxValue } from "../../ui/form";
import { infoNote } from "../../ui/help";

export type FormValues = Record<string, string | boolean >;

/** tz integer (= (offsetHours+12)*4) <-> GMT offset hours. */
export function tzToOffsetHours( tz: number ): number { return ( tz - 48 ) / 4; }
export function offsetHoursToTz( hours: number ): number { return Math.round( ( hours + 12 ) * 4 ); }

const SENSOR_TYPES = [
	{ value: 0, label: "None" }, { value: 1, label: "Rain" }, { value: 2, label: "Flow" },
	{ value: 3, label: "Soil" }, { value: 240, label: "Program switch" },
];

export function isTimezoneAutoManaged( location: unknown ): boolean {
	return typeof location === "string" && location.trim() !== "" && location.trim() !== "''";
}

export function renderGeneralSettings( jo: JoResponse, dname = "", location = "" ): string {
	const timezoneAutoManaged = isTimezoneAutoManaged( location );
	return `<section aria-label="General settings"><h2>General</h2>` +
		infoNote( "Controller-wide options. Saved to the device via /co." ) +
		`<form class="settings" data-settings="general">` +
		textField( "dname", "Device name", dname, { placeholder: "OpenSprinkler" } ) +
		numberField( "tzOffset", "Timezone (GMT offset, hours)", tzToOffsetHours( jo.tz ), {
			min: -12, max: 15, step: 0.25, disabled: timezoneAutoManaged,
			help: timezoneAutoManaged
				? "Automatically maintained from Location. All UI dates and 12-hour times use this controller-local offset."
				: "All UI dates and 12-hour times use this controller-local offset; e.g. -8 for US Pacific.",
		} ) +
		numberField( "wl", "Water level (%)", jo.wl, { min: 0, max: 250, help: "Scales every program's run time." } ) +
		numberField( "sdt", "Station delay (seconds)", jo.sdt, { min: -600, max: 600, step: 5, help: "Pause between sequential stations; a negative value overlaps them." } ) +
		checkboxField( "lg", "Enable logging", jo.lg === 1 ) +
		selectField( "sn1t", "Sensor 1 type", SENSOR_TYPES, jo.sn1t ) +
		checkboxField( "sn1o", "Sensor 1 normally open", jo.sn1o === 1 ) +
		`<button type="submit" class="action primary" data-save="general">Save</button>` +
		`</form></section>`;
}

/**
 * Map read form values -> named /co option params. `fwvCombined` (= fwv*10 + fwm) gates `dname`,
 * which the firmware only accepts on builds >= 2191 (legacy checkOSVersion(2191)).
 */
export function buildGeneralOptions(
	v: FormValues, fwvCombined = 0, timezoneEditable = true,
): Record<string, string | number > {
	const integer = ( key: string, label: string, min: number, max: number ): number => {
		const raw = String( v[ key ] ?? "" ).trim();
		if ( !/^-?\d+$/.test( raw ) ) throw new Error( `${ label } must be a whole number.` );
		const value = Number( raw );
		if ( !Number.isSafeInteger( value ) || value < min || value > max ) {
			throw new Error( `${ label } must be between ${ min } and ${ max }.` );
		}
		return value;
	};
	const stationDelay = integer( "sdt", "Station delay", -600, 600 );
	if ( stationDelay % 5 !== 0 ) throw new Error( "Station delay must use 5-second increments." );
	const sensorType = integer( "sn1t", "Sensor type", 0, 240 );
	if ( !SENSOR_TYPES.some( ( option ) => option.value === sensorType ) ) throw new Error( "Select a valid sensor type." );
	const out: Record<string, string | number > = {
		wl: integer( "wl", "Water level", 0, 250 ),
		sdt: stationDelay,
		lg: checkboxValue( v.lg, "Logging" ) ? 1 : 0,
		sn1t: sensorType,
		sn1o: checkboxValue( v.sn1o, "Sensor option" ) ? 1 : 0,
	};
	if ( timezoneEditable ) {
		const rawOffset = String( v.tzOffset ?? "" ).trim();
		if ( !/^-?\d+(?:\.\d+)?$/.test( rawOffset ) ) throw new Error( "Timezone must be a number." );
		const offset = Number( rawOffset );
		if ( !Number.isFinite( offset ) || offset < -12 || offset > 15 || !Number.isInteger( offset * 4 ) ) {
			throw new Error( "Timezone must be between -12 and 15 in 15-minute increments." );
		}
		out.tz = offsetHoursToTz( offset );
	}
	if ( typeof v.dname === "string" && v.dname !== "" && fwvCombined >= 2191 ) {
		if ( new TextEncoder().encode( v.dname ).length > 128 ) throw new Error( "Device name must be at most 128 UTF-8 bytes." );
		out.dname = v.dname;
	}
	return out;
}

/**
 * General settings — device name, timezone, water level, sequential, station delay, logging and
 * sensor 1 config. Writes via /co using NAMED option keys (fw219+, keys match /jo). render* emits
 * the form; buildGeneralOptions() maps read form values to /co params (pure + tested).
 */
import type { JoResponse } from "../../api/types";
import { textField, numberField, checkboxField, selectField, toInt } from "../../ui/form";
import { infoNote } from "../../ui/help";

export type FormValues = Record<string, string | boolean >;

/** tz integer (= (offsetHours+12)*4) <-> GMT offset hours. */
export function tzToOffsetHours( tz: number ): number { return ( tz - 48 ) / 4; }
export function offsetHoursToTz( hours: number ): number { return Math.round( ( hours + 12 ) * 4 ); }

const SENSOR_TYPES = [
	{ value: 0, label: "None" }, { value: 1, label: "Rain" }, { value: 2, label: "Flow" },
	{ value: 3, label: "Soil" }, { value: 240, label: "Program switch" },
];

export function renderGeneralSettings( jo: JoResponse, dname = "" ): string {
	return `<section aria-label="General settings"><h2>General</h2>` +
		infoNote( "Controller-wide options. Saved to the device via /co." ) +
		`<form class="settings" data-settings="general">` +
		textField( "dname", "Device name", dname, { placeholder: "OpenSprinkler" } ) +
		numberField( "tzOffset", "Timezone (GMT offset, hours)", tzToOffsetHours( jo.tz ), { min: -12, max: 14, step: 0.25, help: "Your offset from GMT, e.g. -8 for US Pacific." } ) +
		numberField( "wl", "Water level (%)", jo.wl, { min: 0, max: 250, help: "Scales every program's run time." } ) +
		numberField( "sdt", "Station delay (seconds)", jo.sdt, { min: 0, max: 255, help: "Pause between sequential stations." } ) +
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
export function buildGeneralOptions( v: FormValues, fwvCombined = 0 ): Record<string, string | number > {
	const out: Record<string, string | number > = {
		tz: offsetHoursToTz( parseFloat( String( v.tzOffset ) ) || 0 ),
		wl: toInt( v.wl, 100 ),
		sdt: toInt( v.sdt, 0 ),
		lg: v.lg ? 1 : 0,
		sn1t: toInt( v.sn1t, 0 ),
		sn1o: v.sn1o ? 1 : 0,
	};
	if ( typeof v.dname === "string" && v.dname !== "" && fwvCombined >= 2191 ) out.dname = v.dname;
	return out;
}

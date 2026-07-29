/**
 * Station attributes editor — per-station name, disabled, ignore-rain and group assignment. Reads
 * the per-board bitfields from /jn, renders one row per station, and rebuilds the /cs payload
 * (per-board bytes via setStationBit, names, and g<sid> groups on fw220+).
 */
import type { JcResponse, JnResponse } from "../../api/types";
import { textField, checkboxField, selectField, checkboxValue, type SelectOption } from "../../ui/form";
import { esc, infoNote } from "../../ui/help";
import { setStationBit, type StationConfigInput } from "../../api/encode";

export type FormValues = Record<string, string | boolean >;

/** Read station `sid`'s bit from a per-board byte array. */
function bit( perBoard: number[], sid: number ): boolean {
	const b = perBoard[ sid >> 3 ];
	return typeof b === "number" ? ( ( b >> ( sid & 7 ) ) & 1 ) === 1 : false;
}

const GROUP_OPTIONS: SelectOption[] = [
	{ value: 0, label: "Sequential A" }, { value: 1, label: "Sequential B" },
	{ value: 2, label: "Sequential C" }, { value: 3, label: "Sequential D" },
	{ value: 255, label: "Parallel" },
];
const MAX_CONFIGURED_STATIONS = 200;

export function renderStationsEditor( jc: JcResponse, jn: JnResponse, fwv: number ): string {
	const groups = fwv >= 220;
	const rows = jn.snames.map( ( name, sid ) => {
		const grp = groups
			? selectField( `grp_${ sid }`, "Group", GROUP_OPTIONS, jn.stn_grp?.[ sid ] ?? 0 )
			: "";
		return `<fieldset class="station-edit"><legend>#${ sid + 1 }</legend>` +
			textField( `name_${ sid }`, "Name", name, { maxLength: jn.maxlen, required: true } ) +
			checkboxField( `dis_${ sid }`, "Disabled", bit( jn.stn_dis, sid ) ) +
			checkboxField( `rain_${ sid }`, "Ignore rain", bit( jn.ignore_rain, sid ) ) +
			grp + `</fieldset>`;
	} ).join( "" );
	return `<section aria-label="Station settings"><h2>Stations</h2>` +
		infoNote( "Rename stations and set per-station behavior. Saved to the device via /cs." ) +
		`<form class="settings" data-settings="stations" data-count="${ jn.snames.length }">${ rows }` +
		`<button type="submit" class="action primary" data-save="stations">Save stations</button>` +
		`</form></section>`;
}

/** Rebuild the /cs config from read form values. `count` = number of stations, `fwv` gates groups. */
export function buildStationConfig( v: FormValues, count: number, fwv: number, maxNameBytes = 32 ): StationConfigInput {
	if ( !Number.isSafeInteger( count ) || count < 0 || count > MAX_CONFIGURED_STATIONS ) throw new Error( "Invalid station count." );
	if ( !Number.isSafeInteger( fwv ) || fwv < 1 || fwv > 9999 ) throw new Error( "Invalid firmware version." );
	if ( !Number.isSafeInteger( maxNameBytes ) || maxNameBytes < 1 || maxNameBytes > 255 ) throw new Error( "Invalid station-name limit." );
	const names: Record<number, string> = {};
	let disabled: number[] = [];
	let ignoreRain: number[] = [];
	const groups: Record<number, number> = {};
	for ( let sid = 0; sid < count; sid++ ) {
		const nm = v[ `name_${ sid }` ];
		if ( typeof nm !== "string" ) throw new Error( `Station ${ sid + 1 } needs a name.` );
		if ( nm.trim() === "" ) throw new Error( `Station ${ sid + 1 } needs a name.` );
		if ( new TextEncoder().encode( nm ).length > maxNameBytes ) {
			throw new Error( `Station ${ sid + 1 } name must be at most ${ maxNameBytes } UTF-8 bytes.` );
		}
		names[ sid ] = nm;
		disabled = setStationBit( disabled, sid, checkboxValue( v[ `dis_${ sid }` ], `Station ${ sid + 1 } disabled` ) );
		ignoreRain = setStationBit( ignoreRain, sid, checkboxValue( v[ `rain_${ sid }` ], `Station ${ sid + 1 } ignore rain` ) );
		if ( fwv >= 220 ) {
			const rawGroup = String( v[ `grp_${ sid }` ] ?? "" ).trim();
			if ( !/^\d+$/.test( rawGroup ) ) throw new Error( `Station ${ sid + 1 } has an invalid group.` );
			const group = Number( rawGroup );
			if ( !GROUP_OPTIONS.some( ( option ) => option.value === group ) ) throw new Error( `Station ${ sid + 1 } has an invalid group.` );
			groups[ sid ] = group;
		}
	}
	const cfg: StationConfigInput = { fwv, names, disabled, ignoreRain };
	if ( fwv >= 220 ) cfg.groups = groups;
	return cfg;
}

/** Escaped label list for headers, etc. (kept for parity with the read view). */
export function stationLabels( jn: JnResponse ): string[] {
	return jn.snames.map( ( n ) => esc( n ) );
}

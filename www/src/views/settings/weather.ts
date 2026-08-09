/**
 * Weather configuration — adjustment method, current `wto` restriction fields, location, and
 * provider credentials. Current firmware no longer uses `uwt` bit 7 for restrictions.
 */
import type { JcResponse, JoResponse } from "../../api/types";
import { selectField, textField, checkboxField, numberField, checkboxValue } from "../../ui/form";
import { infoNote } from "../../ui/help";
import { encodeUwt, escapeJsonForFirmware } from "../../api/encode";
import { ADJUSTMENT_METHODS } from "../../api/diagnostics";
import { isTimezoneAutoManaged } from "./general";

export type FormValues = Record<string, string | boolean >;

const PROVIDERS = [
	{ value: "", label: "(unchanged / default)" }, { value: "Apple", label: "Apple Weather" },
	{ value: "OWM", label: "OpenWeather" }, { value: "WU", label: "Weather Underground (PWS)" },
	{ value: "PW", label: "PirateWeather" }, { value: "AW", label: "AccuWeather" },
	{ value: "OpenMeteo", label: "Open-Meteo" }, { value: "DWD", label: "Bright Sky + DWD" },
];

export function renderWeatherConfig( jo: JoResponse, jc: JcResponse ): string {
	const method = jo.uwt & 0x7f;
	const wto = ( jc.wto ?? {} ) as Record<string, unknown>;
	const provider = typeof wto.provider === "string" ? wto.provider : "";
	const fwvCombined = jo.fwv * 10 + ( jo.fwm ?? 0 );
	const supportsRestrictions = fwvCombined >= 2213;
	const supportsMultiDay = fwvCombined >= 2213;
	const multiDayMethod = method === 1 || method === 3;
	const hasLocation = isTimezoneAutoManaged( jc.loc );
	const numeric = ( key: string, fallback: number ): number => {
		const value = wto[ key ];
		return typeof value === "number" && Number.isFinite( value ) ? value : fallback;
	};
	const methodOpts = ADJUSTMENT_METHODS.map( ( label, value ) => ( { value, label } ) );
	const restrictions = supportsRestrictions
		? `<fieldset><legend>Weather restrictions</legend>` +
			numberField( "rainAmt", "Forecast rain threshold (inches)", numeric( "rainAmt", 0 ), { min: 0, max: 100, step: 0.1, help: "Use 0 with rain days to disable the rain rule." } ) +
			numberField( "rainDays", "Forecast window (days)", numeric( "rainDays", 0 ), { min: 0, max: 10, step: 1 } ) +
			numberField( "minTemp", "Minimum temperature (°F)", numeric( "minTemp", -40 ), { min: -100, max: 100, step: 1, help: "-40 disables the temperature rule." } ) +
			checkboxField( "cali", "California watering restriction", !!wto.cali ) + `</fieldset>`
		: infoNote( "Weather restrictions require firmware 2.2.1(3) or newer; this controller will keep its existing settings." );
	const multiDay = supportsMultiDay
		? `<fieldset data-weather-methods="1,3"${ multiDayMethod ? "" : " hidden" }><legend>Interval programs</legend>` +
			checkboxField(
				"mda", "Use multi-day weather adjustment", wto.mda === 100,
				"For interval programs with Use Weather enabled, use the rolling average for the program's interval. Available with Zimmerman and ETo.",
			) + `</fieldset>`
		: "";
	const clearLocation = hasLocation
		? checkboxField(
			"clearLoc", "Clear saved Location and manage timezone manually", false,
			"On Save, removes this Location. You can then set the controller-local timezone under General.",
		)
		: "";

	return `<section aria-label="Weather settings"><h2>Weather</h2>` +
		infoNote( "How weather adjusts watering, and which service provides it." ) +
		`<form class="settings" data-settings="weather">` +
		selectField( "method", "Adjustment method", methodOpts, method, "How weather changes the watering amount." ) +
		multiDay +
		restrictions +
		textField( "loc", "Location (lat,long)", hasLocation ? String( jc.loc ).trim() : "", { placeholder: "37.5,-122.3", help: "Used to fetch weather and automatically maintain timezone." } ) +
		clearLocation +
		selectField( "provider", "Weather provider", PROVIDERS, provider ) +
		textField( "key", "Weather API key", "", { placeholder: typeof wto.key === "string" && wto.key ? "Configured — leave blank to keep" : "Provider key, if required" } ) +
		textField( "pws", "PWS station ID", "", {
			placeholder: typeof wto.pws === "string" && wto.pws ? `Configured (${ wto.pws }) — leave blank to keep` : "e.g. KCASANFR123",
			help: "Weather Underground personal weather station. Observations come from this station; the forecast stays coordinate-based.",
		} ) +
		`<button type="submit" class="action primary" data-save="weather">Save</button>` +
		`</form></section>`;
}

/**
 * Map read values -> /co params, merging provider/key into the existing wto object. `fwv` gates the
 * space->underscore workaround the firmware needs for string options on builds >= 208. A blank
 * location is omitted so an empty submit doesn't clobber the existing one; only `clearLoc` writes
 * the firmware's explicit unset sentinel.
 */
export function buildWeatherOptions(
	v: FormValues, currentWto: Record<string, unknown> = {}, firmwareVersion = 0,
): Record<string, string | number > {
	const fwvCombined = firmwareVersion < 1000 ? firmwareVersion * 10 : firmwareVersion;
	const rawMethod = String( v.method ?? "" ).trim();
	if ( !/^\d+$/.test( rawMethod ) ) throw new Error( "Select a valid weather adjustment method." );
	const method = Number( rawMethod );
	if ( !Number.isInteger( method ) || method < 0 || method >= ADJUSTMENT_METHODS.length ) throw new Error( "Select a valid weather adjustment method." );
	const wto: Record<string, unknown> = { ...currentWto };
	if ( typeof v.provider === "string" && v.provider !== "" ) wto.provider = v.provider;
	if ( typeof v.key === "string" && v.key.trim() !== "" ) wto.key = v.key.trim();
	if ( typeof v.pws === "string" && v.pws.trim() !== "" ) {
		const pws = v.pws.trim();
		// The weather service accepts alphanumeric station IDs only (routes/weather.ts).
		if ( !/^[A-Za-z0-9]{1,32}$/.test( pws ) ) throw new Error( "PWS station ID must be letters and numbers only." );
		wto.pws = pws;
	}
	const effectiveProvider = typeof wto.provider === "string" ? wto.provider : "";
	if ( effectiveProvider === "WU" ) {
		// Weather Underground requires a 32-character hex API key; the service rejects anything else.
		if ( typeof wto.key === "string" && wto.key && !/^[0-9a-fA-F]{32}$/.test( wto.key ) ) {
			throw new Error( "Weather Underground API keys are 32 hexadecimal characters." );
		}
		if ( typeof wto.key === "string" ) wto.key = wto.key.toLowerCase();
	}
	if ( fwvCombined >= 2213 ) {
		const numberFieldValue = ( key: string, label: string, min: number, max: number, integer = false ): number => {
			const raw = String( v[ key ] ?? "" ).trim();
			if ( raw === "" || !/^-?\d+(?:\.\d+)?$/.test( raw ) ) throw new Error( `${ label } must be a number.` );
			const value = Number( raw );
			if ( !Number.isFinite( value ) || value < min || value > max || ( integer && !Number.isInteger( value ) ) ) {
				throw new Error( `${ label } must be between ${ min } and ${ max }${ integer ? " and use a whole number" : "" }.` );
			}
			return value;
		};
		wto.rainAmt = numberFieldValue( "rainAmt", "Rain threshold", 0, 100 );
		wto.rainDays = numberFieldValue( "rainDays", "Rain forecast window", 0, 10, true );
		wto.minTemp = numberFieldValue( "minTemp", "Minimum temperature", -100, 100 );
		wto.cali = checkboxValue( v.cali, "California restriction" ) ? 1 : 0;
		if ( ( method === 1 || method === 3 ) && v.mda !== undefined ) {
			wto.mda = checkboxValue( v.mda, "Multi-day adjustment" ) ? 100 : 0;
		}
	}
	const out: Record<string, string | number > = {
		uwt: encodeUwt( method ),
		wto: escapeJsonForFirmware( wto ),
	};
	const clearLocation = checkboxValue( v.clearLoc, "Clear Location" );
	const loc = typeof v.loc === "string" ? v.loc.trim() : "";
	if ( clearLocation ) out.loc = "''";
	else if ( loc !== "" ) out.loc = fwvCombined >= 2080 ? loc.replace( /\s/g, "_" ) : loc;
	return out;
}

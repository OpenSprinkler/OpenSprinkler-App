/**
 * Weather configuration — adjustment method (uwt method bits) + the weather-restriction flag
 * (uwt bit 7), location, and weather provider + API key (merged into the existing wto JSON so
 * other wto fields like Zimmerman baselines / Monthly scales are preserved). Writes via /co.
 */
import type { JcResponse, JoResponse } from "../../api/types";
import { selectField, textField, checkboxField, toInt } from "../../ui/form";
import { infoNote } from "../../ui/help";
import { encodeUwt, escapeJsonForFirmware } from "../../api/encode";
import { ADJUSTMENT_METHODS } from "../../api/diagnostics";

export type FormValues = Record<string, string | boolean >;

const PROVIDERS = [
	{ value: "", label: "(unchanged / default)" }, { value: "Apple", label: "Apple Weather" },
	{ value: "OWM", label: "OpenWeather" }, { value: "WU", label: "Weather Underground (PWS)" },
	{ value: "PW", label: "PirateWeather" }, { value: "AW", label: "AccuWeather" },
	{ value: "OpenMeteo", label: "Open-Meteo" }, { value: "DWD", label: "Bright Sky + DWD" },
];

export function renderWeatherConfig( jo: JoResponse, jc: JcResponse ): string {
	const method = jo.uwt & 0x7f;
	const restriction = ( jo.uwt & 0x80 ) !== 0;
	const wto = ( jc.wto ?? {} ) as Record<string, unknown>;
	const key = typeof wto.key === "string" ? wto.key : "";
	const provider = typeof wto.provider === "string" ? wto.provider : "";
	const methodOpts = ADJUSTMENT_METHODS.map( ( label, value ) => ( { value, label } ) );

	return `<section aria-label="Weather settings"><h2>Weather</h2>` +
		infoNote( "How weather adjusts watering, and which service provides it." ) +
		`<form class="settings" data-settings="weather">` +
		selectField( "method", "Adjustment method", methodOpts, method, "How weather changes the watering amount." ) +
		checkboxField( "restriction", "Weather restriction (pause on rain rule)", restriction,
			"Pause watering when a weather rule is met." ) +
		textField( "loc", "Location (lat,long)", jc.loc || "", { placeholder: "37.5,-122.3", help: "Used to fetch weather." } ) +
		selectField( "provider", "Weather provider", PROVIDERS, provider ) +
		textField( "key", "Weather API key", key, { placeholder: "(provider key, if required)" } ) +
		`<button type="submit" class="action primary" data-save="weather">Save</button>` +
		`</form></section>`;
}

/**
 * Map read values -> /co params, merging provider/key into the existing wto object. `fwv` gates the
 * space->underscore workaround the firmware needs for string options on builds >= 208; a blank
 * location is omitted so an empty submit doesn't clobber the existing one.
 */
export function buildWeatherOptions(
	v: FormValues, currentWto: Record<string, unknown> = {}, fwv = 0,
): Record<string, string | number > {
	const wto: Record<string, unknown> = { ...currentWto };
	if ( typeof v.provider === "string" && v.provider !== "" ) wto.provider = v.provider;
	if ( typeof v.key === "string" ) wto.key = v.key;
	const out: Record<string, string | number > = {
		uwt: encodeUwt( toInt( v.method, 0 ), !!v.restriction ),
		wto: escapeJsonForFirmware( wto ),
	};
	const loc = typeof v.loc === "string" ? v.loc.trim() : "";
	if ( loc !== "" ) out.loc = fwv >= 208 ? loc.replace( /\s/g, "_" ) : loc;
	return out;
}

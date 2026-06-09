/**
 * Diagnostics & weather interpretation helpers — pure text/status mappers ported faithfully from
 * the legacy app (www/js/modules/weather.js, firmware.js, network.js, system-diagnostics.js) so the
 * modernized Diagnostics/Weather views render the same meanings. No HTML, no i18n wiring yet
 * (English literals, like the other typed views); callers escape + localize.
 *
 * Sources of truth:
 *   - adjustment methods / weather error codes: weather.js OSApp.Weather.Constants
 *   - reboot reasons: firmware.js OSApp.Firmware.Constants.rebootReasons
 *   - Wi-Fi rating bands: network.js OSApp.Network.getWiFiRating
 *   - weather provider attribution: weather.js OSApp.Weather.makeAttribution
 */

export type StatusLevel = "ok" | "warn" | "error" | "neutral";
export interface StatusText { text: string; level: StatusLevel; }

/** Watering-level adjustment methods, indexed by id (weather.js adjustmentMethods). */
export const ADJUSTMENT_METHODS = [ "Manual", "Zimmerman", "Auto Rain Delay", "ETo", "Monthly" ] as const;

/** Name of the adjustment method encoded in /jo.uwt (bit 7 is the restriction flag — masked off). */
export function adjustmentMethodName( uwt: number ): string {
	const id = uwt & ~( 1 << 7 );
	return ADJUSTMENT_METHODS[ id ] ?? `Method ${ id }`;
}

/** Weather error/status codes (/jc.wterr). Mirrors weather.js Constants.weatherErrors. */
export const WEATHER_ERRORS: Record<number, string> = {
	[ -4 ]: "Empty Response", [ -3 ]: "Timed Out", [ -2 ]: "Connection Failed", [ -1 ]: "No Response",
	0: "Success", 1: "Weather Data Error", 2: "Location Error", 3: "PWS Error",
	4: "Adjustment Method Error", 5: "Adjustment Options Error",
	10: "Insufficient Weather Data", 11: "Weather Data Incomplete", 12: "Weather Data Request Failed",
	20: "Location Service API Error", 21: "Location Not Found", 22: "Invalid Location Format",
	30: "Invalid WUnderground PWS", 31: "Invalid WUnderground Key", 32: "PWS Authentication Error",
	33: "Unsupported PWS Method", 34: "PWS Not Provided Error", 35: "Missing Weather API Key",
	40: "Unsupported Adjustment Method", 41: "No Adjustment Method Provided",
	50: "Corrupt Adjustment Options", 51: "Missing Adjustment Option", 99: "Unexpected Error",
};

/** Human text for a weather error code: exact match, else the tens-digit category (10–59), else unknown. */
export function weatherErrorText( err: number ): string {
	if ( err in WEATHER_ERRORS ) return WEATHER_ERRORS[ err ]!;
	const category = Math.floor( err / 10 );
	if ( err >= 10 && err <= 59 && category in WEATHER_ERRORS ) return WEATHER_ERRORS[ category ]!;
	return `Unrecognised (${ err })`;
}

/** Online/Offline/Error status from /jc.wterr (weather.js getWeatherStatus: <0 offline, >0 error, 0 online). */
export function weatherStatus( wterr: number ): StatusText {
	if ( wterr < 0 ) return { text: "Offline", level: "error" };
	if ( wterr > 0 ) return { text: "Error", level: "error" };
	return { text: "Online", level: "ok" };
}

/** Reboot reasons (/jc.lrbtc). Mirrors firmware.js Constants.rebootReasons. */
export const REBOOT_REASONS: Record<number, string> = {
	0: "None", 1: "Factory Reset", 2: "Reset Button", 3: "WiFi Change", 4: "Web Request",
	5: "Web Request", 6: "WiFi Configure", 7: "Firmware Update", 8: "Weather Failure",
	9: "Network Failure", 10: "Clock Update", 99: "Power On",
};

export function rebootReason( code: number ): string {
	return code in REBOOT_REASONS ? REBOOT_REASONS[ code ]! : `Unrecognised (${ code })`;
}

/** Wi-Fi signal rating from RSSI dBm (network.js getWiFiRating bands), e.g. "-67 dBm (Fair)". */
export function wifiRating( rssi: number ): StatusText {
	let rating: string, level: StatusLevel;
	if ( rssi < -80 ) { rating = "Unusable"; level = "error"; }
	else if ( rssi < -70 ) { rating = "Poor"; level = "warn"; }
	else if ( rssi < -60 ) { rating = "Fair"; level = "warn"; }
	else if ( rssi < -50 ) { rating = "Good"; level = "ok"; }
	else { rating = "Excellent"; level = "ok"; }
	return { text: `${ Math.round( rssi ) } dBm (${ rating })`, level };
}

/** OpenThings Cloud (OTC) connection status from /jc.otcs (system-diagnostics.js resolveOTCStatus). */
export function otcStatus( code: number ): StatusText {
	switch ( code ) {
		case 1: return { text: "Connecting…", level: "warn" };
		case 2: return { text: "Disconnected", level: "error" };
		case 3: return { text: "Connected", level: "ok" };
		default: return { text: "Not Enabled", level: "neutral" };
	}
}

/** The weather provider tag from /jc.wtdata (`wp` or `weatherProvider`), or null when unknown. */
export function weatherProviderTag( wtdata: Record<string, unknown> ): string | null {
	const wp = wtdata.wp ?? wtdata.weatherProvider;
	return typeof wp === "string" && wp ? wp : null;
}

/**
 * Human, descriptive weather-source label from a provider tag (upstream #291 — replaces the vague
 * "Powered by Your Local PWS"). `local` is spelled out as a Personal Weather Station.
 */
export function weatherSourceName( provider: string ): string {
	switch ( provider ) {
		case "Apple": return "Apple Weather";
		case "DarkSky": case "DS": return "Dark Sky";
		case "OWM": return "OpenWeather";
		case "DWD": return "Bright Sky + DWD";
		case "OpenMeteo": case "OM": return "Open-Meteo";
		case "WUnderground": case "WU": return "Weather Underground";
		case "PirateWeather": case "PW": return "PirateWeather";
		case "AccuWeather": case "AW": return "AccuWeather";
		case "local": return "your local Personal Weather Station (PWS)";
		case "Manual": return "manual adjustment (no weather service)";
		default: return "an unrecognised weather provider";
	}
}

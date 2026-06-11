/**
 * Settings shell — sub-tabbed navigation across the editor views. Pure render; the host wires
 * `data-settings-section` clicks to re-render and `data-settings` form submits to the matching
 * build*() mapper + typed command.
 */
import type { JcResponse, JoResponse, JnResponse } from "../../api/types";
import { renderGeneralSettings } from "./general";
import { renderWeatherConfig } from "./weather";
import { renderNetwork } from "./network";
import { renderStationsEditor } from "./stations-edit";
import { renderProgramEditor } from "./program-edit";

export const SETTINGS_SECTIONS = [ "General", "Weather", "Network", "Stations", "Programs" ] as const;
export type SettingsSection = ( typeof SETTINGS_SECTIONS )[ number ];

export function renderSettings(
	jc: JcResponse, jo: JoResponse, jn: JnResponse, active: SettingsSection = "General",
): string {
	const nav = SETTINGS_SECTIONS.map( ( s ) =>
		`<button type="button" class="subtab${ s === active ? " active" : "" }" role="tab" ` +
		`id="settings-tab-${ s }" aria-controls="settings-panel" aria-selected="${ s === active }" ` +
		`tabindex="${ s === active ? 0 : -1 }" data-settings-section="${ s }">${ s }</button>`
	).join( "" );

	let content: string;
	switch ( active ) {
		case "Weather": content = renderWeatherConfig( jo, jc ); break;
		case "Network": content = renderNetwork( jo ); break;
		case "Stations": content = renderStationsEditor( jc, jn, jo.fwv ); break;
		case "Programs": content = renderProgramEditor( jn, jo.fwv ); break;
		default: content = renderGeneralSettings( jo, jc.dname || "" );
	}
	return `<nav class="subtabs" role="tablist" aria-label="Settings sections">${ nav }</nav>` +
		`<div class="settings-content" role="tabpanel" id="settings-panel" ` +
		`aria-labelledby="settings-tab-${ active }" tabindex="0">${ content }</div>`;
}

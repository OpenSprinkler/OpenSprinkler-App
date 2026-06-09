/**
 * Dashboard shell — tabbed navigation across the read-only views. Pure render (no framework);
 * the host wires tab clicks to re-render with a new active tab. Data is fetched once.
 *
 * Discoverability (upstream #292): the Weather and Diagnostics views are surfaced as first-class
 * tabs rather than URL-only / buried popups, so novices can find them.
 */
import type { JcResponse, JoResponse, JnResponse, JpResponse, JlResponse } from "../api/types";
import { deriveCapabilities } from "../api/client";
import { renderControllerStatus } from "../spike/status-view";
import { renderStations } from "./stations-view";
import { renderPrograms } from "./programs-view";
import { renderLogs } from "./logs-view";
import { renderWeather } from "./weather-view";
import { renderDiagnostics } from "./diagnostics-view";

export interface DashboardData {
	jc: JcResponse; jo: JoResponse; jn: JnResponse; jp: JpResponse; jl: JlResponse;
}

export const DASHBOARD_TABS = [ "Status", "Stations", "Programs", "Weather", "Log", "Diagnostics" ] as const;
export type DashboardTab = ( typeof DASHBOARD_TABS )[ number ];

export function renderDashboard( d: DashboardData, active: DashboardTab = "Status" ): string {
	// Each tab controls the single panel; the panel is labelled by the active tab and is focusable.
	// (Arrow-key roving-tabindex is a host-JS follow-up; the buttons remain Tab-navigable + operable.)
	const nav = DASHBOARD_TABS.map( ( t ) =>
		`<button class="tab${ t === active ? " active" : "" }" role="tab" id="dashboard-tab-${ t }" ` +
		`aria-controls="dashboard-panel" aria-selected="${ t === active }" data-tab="${ t }">${ t }</button>`
	).join( "" );

	let content: string;
	switch ( active ) {
		case "Stations": content = renderStations( d.jc, d.jn ); break;
		case "Programs": content = renderPrograms( d.jp, d.jn ); break;
		case "Weather": content = renderWeather( d.jc, d.jo ); break;
		case "Log": content = renderLogs( d.jl, d.jn ); break;
		case "Diagnostics": content = renderDiagnostics( d.jc, d.jo ); break;
		default: content = renderControllerStatus( d.jc, d.jo, deriveCapabilities( d.jc, d.jo ) );
	}
	return `<nav class="tabs" role="tablist" aria-label="Dashboard sections">${ nav }</nav>` +
		`<div class="tab-content" role="tabpanel" id="dashboard-panel" aria-labelledby="dashboard-tab-${ active }" tabindex="0">${ content }</div>`;
}

/**
 * Dashboard shell — tabbed navigation across the views. Pure render (no framework); the host
 * (views/host.ts) wires tab clicks, control actions, and settings form submits.
 *
 * Discoverability (upstream #292): Weather, Diagnostics and Settings are first-class tabs rather
 * than URL-only / buried popups. With `opts.actions`, the read views gain write/control affordances.
 */
import type { JcResponse, JoResponse, JnResponse, JpResponse, JlResponse } from "../api/types";
import { deriveCapabilities } from "../api/client";
import { renderControllerStatus } from "../spike/status-view";
import { renderStations } from "./stations-view";
import { renderPrograms } from "./programs-view";
import { renderLogs } from "./logs-view";
import { renderWeather } from "./weather-view";
import { renderDiagnostics } from "./diagnostics-view";
import { renderSettings, type SettingsSection } from "./settings/index";

export interface DashboardData {
	jc: JcResponse; jo: JoResponse; jn: JnResponse; jp: JpResponse; jl: JlResponse;
}

export const DASHBOARD_TABS = [ "Status", "Stations", "Programs", "Weather", "Log", "Diagnostics", "Settings" ] as const;
export type DashboardTab = ( typeof DASHBOARD_TABS )[ number ];

export interface DashboardOptions {
	/** Enable write/control affordances (Start/Stop, Run, Enable, etc.). */
	actions?: boolean;
	/** Active sub-section when the Settings tab is shown. */
	settingsSection?: SettingsSection;
	/** When the companion is present, the host passes the rendered History HTML to add a History tab. */
	historyHtml?: string;
}

export function renderDashboard( d: DashboardData, active: DashboardTab | "History" = "Status", opts: DashboardOptions = {} ): string {
	const tabs: readonly string[] = opts.historyHtml !== undefined
		? [ ...DASHBOARD_TABS, "History" ] : DASHBOARD_TABS;
	const nav = tabs.map( ( t ) =>
		`<button class="tab${ t === active ? " active" : "" }" role="tab" id="dashboard-tab-${ t }" ` +
		`aria-controls="dashboard-panel" aria-selected="${ t === active }" tabindex="${ t === active ? 0 : -1 }" ` +
		`data-tab="${ t }">${ t }</button>`
	).join( "" );

	const a = !!opts.actions;
	let content: string;
	switch ( active ) {
		case "Stations": content = renderStations( d.jc, d.jn, { actions: a } ); break;
		case "Programs": content = renderPrograms( d.jp, d.jn, { actions: a } ); break;
		case "Weather": content = renderWeather( d.jc, d.jo ); break;
		case "Log": content = renderLogs( d.jl, d.jn ); break;
		case "Diagnostics": content = renderDiagnostics( d.jc, d.jo ); break;
		case "Settings": content = renderSettings( d.jc, d.jo, d.jn, opts.settingsSection ); break;
		case "History": content = opts.historyHtml ?? ""; break;
		default: content = renderControllerStatus( d.jc, d.jo, deriveCapabilities( d.jc, d.jo ), { actions: a } );
	}
	return `<nav class="tabs" role="tablist" aria-label="Dashboard sections">${ nav }</nav>` +
		`<div class="tab-content" role="tabpanel" id="dashboard-panel" aria-labelledby="dashboard-tab-${ active }" tabindex="0">${ content }</div>`;
}

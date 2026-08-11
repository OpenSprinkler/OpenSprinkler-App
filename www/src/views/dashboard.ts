/**
 * Dashboard shell — tabbed navigation across the views. Pure render (no framework); the host
 * (views/host.ts) wires tab clicks, control actions, and settings form submits.
 *
 * Discoverability (upstream #292): Weather, Diagnostics and Settings are first-class tabs rather
 * than URL-only / buried popups. With `opts.actions`, the read views gain write/control affordances.
 */
import type { JcResponse, JoResponse, JnResponse, JeResponse, JpResponse, JlResponse } from "../api/types";
import { deriveCapabilities } from "../api/client";
import { renderControllerStatus } from "../spike/status-view";
import { renderStations } from "./stations-view";
import { renderPrograms } from "./programs-view";
import { renderLogs, type LogFilter } from "./logs-view";
import type { CompanionLogEvent } from "../api/companion";
import { renderWeather } from "./weather-view";
import { renderDiagnostics } from "./diagnostics-view";
import { renderSettings, type ProgramEditorTarget, type SettingsSection } from "./settings/index";
import type { ForecastState } from "../api/weather";

export interface DashboardData {
	jc: JcResponse; jo: JoResponse; jn: JnResponse; je: JeResponse; jp: JpResponse; jl: JlResponse;
}

export const DASHBOARD_TABS = [ "Status", "Stations", "Programs", "Weather", "Log", "Diagnostics", "Settings" ] as const;
export type DashboardTab = ( typeof DASHBOARD_TABS )[ number ];

export interface DashboardOptions {
	/** Enable write/control affordances (Start/Stop, Run, Enable, etc.). */
	actions?: boolean;
	/** Active sub-section when the Settings tab is shown. */
	settingsSection?: SettingsSection;
	/** Existing raw program selected for lossless editing. Omitted for the new-program editor. */
	programEditor?: ProgramEditorTarget;
	/** When the companion is present, the host passes the rendered History HTML to add a History tab. */
	historyHtml?: string;
	/** Direct weather-service forecast state (Weather/Status/Diagnostics). Omitted = no forecast client. */
	forecast?: ForecastState;
	/** Durable companion events for the Log view (omitted = no companion). */
	companionEvents?: CompanionLogEvent[];
	/** Log view source/verbosity filter state (host-owned). */
	logFilter?: LogFilter;
}

/** Decorative single-stroke tab glyphs (currentColor, aria-hidden — the label is the accessible name). */
const TAB_ICONS: Record<string, string> = {
	Status: `<circle cx="12" cy="12" r="9"/><path d="M12 12l3.5-2"/>`,
	Stations: `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,
	Programs: `<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>`,
	Weather: `<path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6.5 19z"/>`,
	Log: `<path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>`,
	Diagnostics: `<path d="M3 12h4l2 6 4-14 2 8h6"/>`,
	Settings: `<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>`,
	History: `<path d="M3 12a9 9 0 1 0 3-6.7M3 5v4h4"/><path d="M12 8v4l3 2"/>`,
};
function tabIcon( t: string ): string {
	const p = TAB_ICONS[ t ];
	return p
		? `<svg class="i-tab" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ p }</svg>`
		: "";
}

export function renderDashboard( d: DashboardData, active: DashboardTab | "History" = "Status", opts: DashboardOptions = {} ): string {
	const tabs: readonly string[] = opts.historyHtml !== undefined
		? [ ...DASHBOARD_TABS, "History" ] : DASHBOARD_TABS;
	const nav = tabs.map( ( t ) =>
		`<button class="tab${ t === active ? " active" : "" }" role="tab" id="dashboard-tab-${ t }" ` +
		`aria-controls="dashboard-panel" aria-selected="${ t === active }" tabindex="${ t === active ? 0 : -1 }" ` +
		`data-tab="${ t }">${ tabIcon( t ) }<span class="tab-label">${ t }</span></button>`
	).join( "" );

	const a = !!opts.actions;
	let content: string;
	switch ( active ) {
		case "Stations": content = renderStations( d.jc, d.jn, { actions: a, je: d.je, jl: d.jl, jo: d.jo } ); break;
		case "Programs": content = renderPrograms( d.jp, d.jn, { actions: a } ); break;
		case "Weather": content = renderWeather( d.jc, d.jo, opts.forecast ); break;
		case "Log": content = renderLogs( d.jl, d.jn, d.jo, {
			...( opts.companionEvents ? { companionEvents: opts.companionEvents } : {} ),
			...( opts.logFilter ? { filter: opts.logFilter } : {} ),
		} ); break;
		case "Diagnostics": content = renderDiagnostics( d.jc, d.jo, opts.forecast ); break;
		case "Settings": content = renderSettings( d.jc, d.jo, d.jn, d.jp, opts.settingsSection, opts.programEditor ); break;
		case "History": content = opts.historyHtml ?? ""; break;
		default: content = renderControllerStatus( d.jc, d.jo, deriveCapabilities( d.jc, d.jo ),
			{ actions: a, ...( opts.forecast ? { forecast: opts.forecast } : {} ) } );
	}
	return `<nav class="tabs" role="tablist" aria-label="Dashboard sections">${ nav }</nav>` +
		`<div class="tab-content" role="tabpanel" id="dashboard-panel" aria-labelledby="dashboard-tab-${ active }" tabindex="0">${ content }</div>`;
}

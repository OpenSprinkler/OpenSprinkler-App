/**
 * Dashboard shell — tabbed navigation across the read-only views. Pure render (no framework);
 * the host wires tab clicks to re-render with a new active tab. Data is fetched once.
 */
import type { JcResponse, JoResponse, JnResponse, JpResponse, JlResponse } from "../api/types";
import { deriveCapabilities } from "../api/client";
import { renderControllerStatus } from "../spike/status-view";
import { renderStations } from "./stations-view";
import { renderPrograms } from "./programs-view";
import { renderLogs } from "./logs-view";

export interface DashboardData {
	jc: JcResponse; jo: JoResponse; jn: JnResponse; jp: JpResponse; jl: JlResponse;
}

export const DASHBOARD_TABS = [ "Status", "Stations", "Programs", "Log" ] as const;
export type DashboardTab = ( typeof DASHBOARD_TABS )[ number ];

export function renderDashboard( d: DashboardData, active: DashboardTab = "Status" ): string {
	const nav = DASHBOARD_TABS.map( ( t ) =>
		`<button class="tab${ t === active ? " active" : "" }" role="tab" aria-selected="${ t === active }" data-tab="${ t }">${ t }</button>`
	).join( "" );

	let content: string;
	switch ( active ) {
		case "Stations": content = renderStations( d.jc, d.jn ); break;
		case "Programs": content = renderPrograms( d.jp, d.jn ); break;
		case "Log": content = renderLogs( d.jl, d.jn ); break;
		default: content = renderControllerStatus( d.jc, d.jo, deriveCapabilities( d.jc, d.jo ) );
	}
	return `<nav class="tabs" role="tablist">${ nav }</nav>` +
		`<div class="tab-content" role="tabpanel">${ content }</div>`;
}

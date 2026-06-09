/**
 * Dashboard host controller — the single place that turns the pure render + the data/command layers
 * into an interactive app. Used by both the demo (mocked transport) and app/ (real device). It owns
 * the active tab / settings-section state, delegates clicks to dispatchAction(), and maps settings
 * form submits to the tested build*() mappers + typed commands. Re-fetches after a successful write.
 */
import type { OsApiClient } from "../api/client";
import { renderDashboard, type DashboardData, type DashboardTab } from "./dashboard";
import type { SettingsSection } from "./settings/index";
import { dispatchAction, type ActionContext } from "./dispatch";
import { readForm } from "../ui/form";
import { buildGeneralOptions } from "./settings/general";
import { buildWeatherOptions } from "./settings/weather";
import { buildNetworkOptions } from "./settings/network";
import { buildStationConfig } from "./settings/stations-edit";
import { buildProgramInput } from "./settings/program-edit";

export interface HostDeps {
	mount: HTMLElement;
	api: OsApiClient;
	/** (Re)fetch the full dashboard data set from the device. */
	load(): Promise<DashboardData>;
	/** prompt/confirm for actions that need input (rain-delay hours, run minutes, deletes). */
	ctx: ActionContext;
	/** Surface a status / error message to the user. */
	toast( message: string, isError?: boolean ): void;
}

export interface DashboardController { refresh(): Promise<void>; }

export function mountDashboard( deps: HostDeps ): DashboardController {
	let data: DashboardData | null = null;
	let activeTab: DashboardTab = "Status";
	let settingsSection: SettingsSection = "General";

	/** Show only the schedule/start fieldset that matches the current select (program editor). */
	function applyConditionalVisibility(): void {
		const sched = deps.mount.querySelector<HTMLSelectElement>( 'select[name="schedType"]' )?.value;
		const start = deps.mount.querySelector<HTMLSelectElement>( 'select[name="startType"]' )?.value;
		deps.mount.querySelectorAll<HTMLElement>( "[data-when]" ).forEach( ( el ) => {
			const w = el.dataset.when;
			el.hidden = !( w === sched || w === start );
		} );
	}

	function paint(): void {
		// Preserve keyboard focus on the active tab across a re-render driven by tab navigation.
		const refocusTab = ( document.activeElement as HTMLElement | null )?.getAttribute?.( "role" ) === "tab";
		deps.mount.innerHTML = data
			? renderDashboard( data, activeTab, { actions: true, settingsSection } )
			: "<p>Loading…</p>";
		applyConditionalVisibility();
		if ( refocusTab ) deps.mount.querySelector<HTMLElement>( '[role="tab"][aria-selected="true"]' )?.focus();
	}

	async function refresh(): Promise<void> {
		try {
			data = await deps.load();
		} catch ( e ) {
			deps.toast( String( e ), true );
		}
		paint();
	}

	async function runAction( ds: Record<string, string | undefined > ): Promise<void> {
		if ( !data ) return;
		try {
			const msg = await dispatchAction( deps.api, { jp: data.jp }, ds, deps.ctx );
			if ( msg !== null ) { deps.toast( msg ); await refresh(); }
		} catch ( e ) {
			deps.toast( String( e ), true );
		}
	}

	async function saveSettings( form: HTMLFormElement ): Promise<void> {
		if ( !data ) return;
		const kind = form.dataset.settings;
		const v = readForm( form );
		const count = parseInt( form.dataset.count ?? "0", 10 );
		try {
			const fwvCombined = data.jo.fwv * 10 + ( data.jo.fwm || 0 );
			let msg = "Settings saved.";
			switch ( kind ) {
				case "general": await deps.api.submitOptions( buildGeneralOptions( v, fwvCombined ) ); break;
				case "weather": await deps.api.submitOptions( buildWeatherOptions( v, ( data.jc.wto ?? {} ) as Record<string, unknown>, data.jo.fwv ) ); break;
				case "network": await deps.api.submitOptions( buildNetworkOptions( v ) ); break;
				case "stations": await deps.api.submitStations( buildStationConfig( v, count, data.jo.fwv ) ); break;
				case "program": await deps.api.submitProgram( -1, buildProgramInput( v, count ) ); msg = "Program created."; break;
				default: return;
			}
			deps.toast( msg );
			await refresh();
		} catch ( e ) {
			deps.toast( String( e ), true );
		}
	}

	deps.mount.addEventListener( "click", ( ev ) => {
		const target = ev.target as HTMLElement;
		const tab = target.closest<HTMLElement>( "[data-tab]" );
		if ( tab?.dataset.tab ) { activeTab = tab.dataset.tab as DashboardTab; paint(); return; }

		const sec = target.closest<HTMLElement>( "[data-settings-section]" );
		if ( sec?.dataset.settingsSection ) { settingsSection = sec.dataset.settingsSection as SettingsSection; paint(); return; }

		const action = target.closest<HTMLButtonElement>( "[data-action]" );
		if ( action?.dataset.action ) {
			if ( action.dataset.action === "program-new" ) {
				activeTab = "Settings"; settingsSection = "Programs"; paint(); return;
			}
			// "save-*" submit buttons are handled by the form submit listener.
			if ( action.type !== "submit" ) void runAction( { ...action.dataset } );
		}
	} );

	deps.mount.addEventListener( "submit", ( ev ) => {
		const form = ( ev.target as HTMLElement ).closest<HTMLFormElement>( "form[data-settings]" );
		if ( !form ) return;
		ev.preventDefault();
		void saveSettings( form );
	} );

	// Re-apply program-editor conditional visibility as the schedule/start selects change.
	deps.mount.addEventListener( "change", ( ev ) => {
		const name = ( ev.target as HTMLElement ).getAttribute?.( "name" );
		if ( name === "schedType" || name === "startType" ) applyConditionalVisibility();
	} );

	// Roving-tabindex arrow-key navigation for the tablists (WAI-ARIA tabs pattern, auto-activation).
	deps.mount.addEventListener( "keydown", ( ev ) => {
		const tab = ( ev.target as HTMLElement ).closest<HTMLElement>( '[role="tab"]' );
		if ( !tab ) return;
		const list = tab.closest( '[role="tablist"]' );
		if ( !list ) return;
		const tabs = Array.from( list.querySelectorAll<HTMLElement>( '[role="tab"]' ) );
		const idx = tabs.indexOf( tab );
		let next = -1;
		switch ( ev.key ) {
			case "ArrowRight": case "ArrowDown": next = ( idx + 1 ) % tabs.length; break;
			case "ArrowLeft": case "ArrowUp": next = ( idx - 1 + tabs.length ) % tabs.length; break;
			case "Home": next = 0; break;
			case "End": next = tabs.length - 1; break;
			default: return;
		}
		ev.preventDefault();
		tabs[ next ]?.click(); // activates + repaints; paint() restores focus to the active tab
	} );

	void refresh();
	return { refresh };
}

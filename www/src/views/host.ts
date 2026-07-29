/**
 * Dashboard host controller — the single place that turns the pure render + the data/command layers
 * into an interactive app. Used by both the demo (mocked transport) and app/ (real device). It owns
 * the active tab / settings-section state, delegates clicks to dispatchAction(), and maps settings
 * form submits to the tested build*() mappers + typed commands. Re-fetches after a successful write.
 */
import type { OsApiClient } from "../api/client";
import type { OSProgram } from "../api/types";
import { encodeProgram, type ProgramInput } from "../api/encode";
import { renderDashboard, type DashboardData, type DashboardTab } from "./dashboard";
import type { SettingsSection } from "./settings/index";
import { dispatchAction, type ActionContext } from "./dispatch";
import { readForm } from "../ui/form";
import { buildGeneralOptions, isTimezoneAutoManaged } from "./settings/general";
import { buildWeatherOptions } from "./settings/weather";
import { buildNetworkOptions } from "./settings/network";
import { buildStationConfig } from "./settings/stations-edit";
import { buildProgramInput } from "./settings/program-edit";
import { detectCompanion, fetchHistory, fetchRunLog } from "../api/companion";
import { renderHistory } from "./history-view";
import { errorCard } from "../ui/help";

/**
 * If the companion is reachable + healthy, fetch the last 7 days and render the History HTML;
 * otherwise return undefined so the dashboard omits the History tab (FR-21/22).
 */
export async function resolveHistoryHtml(
	companionBase: string,
	now: () => number = () => Math.floor( Date.now() / 1000 ),
	token?: string,
	signal?: AbortSignal,
): Promise<string | undefined> {
	const abort = new AbortController();
	const cancel = (): void => abort.abort();
	if ( signal?.aborted ) abort.abort();
	else signal?.addEventListener( "abort", cancel, { once: true } );
	try {
		const options = { ...( token ? { token } : {} ), signal: abort.signal };
		const health = await detectCompanion( companionBase, options );
		if ( !health ) return undefined;
		const toTs = now();
		const range = { fromTs: toTs - 7 * 86400, toTs };
		const [ tel, runs ] = await Promise.all( [
			fetchHistory( companionBase, range, options ),
			fetchRunLog( companionBase, range, options ),
		] );
		return renderHistory( tel, runs, { stale: !!health.pollerStale } );
	} catch { return undefined; }
	finally {
		signal?.removeEventListener( "abort", cancel );
		abort.abort();
	}
}

export interface HostDeps {
	mount: HTMLElement;
	api: OsApiClient;
	/** (Re)fetch the full dashboard data set from the device. */
	load( signal?: AbortSignal ): Promise<DashboardData>;
	/** prompt/confirm for actions that need input (rain-delay hours, run minutes, deletes). */
	ctx: ActionContext;
	/** Surface a status / error message to the user. */
	toast( message: string, isError?: boolean ): void;
	/** Explicit companion API base. `null` disables companion discovery (useful for embedded hosts). */
	companionBase?: string | null;
	/** Optional bearer token, supplied from a scrubbed URL fragment and retained for this tab session. */
	companionToken?: string;
}

export interface DashboardController {
	refresh(): Promise<void>;
	/** Remove delegated listeners and make all outstanding async completions inert. */
	destroy(): void;
}

interface ProgramEditState { pid: number; source: OSProgram; sourceControllerDay: number; }

function cloneProgram( program: OSProgram ): OSProgram {
	return [
		program[ 0 ], program[ 1 ], program[ 2 ], program[ 3 ].slice(), program[ 4 ].slice(), program[ 5 ],
		[ ...program[ 6 ] ],
	];
}

function equalNumbers( a: number[], b: number[] ): boolean {
	return a.length === b.length && a.every( ( value, index ) => value === b[ index ] );
}

/** Exact tuple comparison used to stop a stale full-program write. */
export function sameProgramTuple( a: OSProgram | undefined, b: OSProgram | undefined ): boolean {
	return !!a && !!b && a[ 0 ] === b[ 0 ] && a[ 1 ] === b[ 1 ] && a[ 2 ] === b[ 2 ] &&
		equalNumbers( a[ 3 ], b[ 3 ] ) && equalNumbers( a[ 4 ], b[ 4 ] ) && a[ 5 ] === b[ 5 ] &&
		equalNumbers( a[ 6 ], b[ 6 ] );
}

function controllerDay( devt: number ): number {
	return Math.floor( devt / 86400 );
}

function controllerSecondsOfDay( devt: number ): number {
	return devt % 86400;
}

function controllerDayBoundaryIsNear( devt: number ): boolean {
	const seconds = controllerSecondsOfDay( devt );
	return seconds < 120 || seconds >= 86400 - 120;
}

/**
 * Interval `/jp.days0` is relative to the controller's current day, so it naturally decrements at
 * midnight even when the stored program is unchanged. Compare its stable absolute remainder while
 * retaining exact comparison for every other program word.
 */
function sameProgramTupleAtControllerDays(
	a: OSProgram | undefined, aDay: number, b: OSProgram | undefined, bDay: number,
): boolean {
	if ( !a || !b ) return false;
	const aInterval = ( ( a[ 0 ] >> 4 ) & 0x03 ) === 3;
	const bInterval = ( ( b[ 0 ] >> 4 ) & 0x03 ) === 3;
	if ( !aInterval || !bInterval || a[ 2 ] <= 0 || b[ 2 ] <= 0 ) return sameProgramTuple( a, b );
	return a[ 0 ] === b[ 0 ] && a[ 2 ] === b[ 2 ] &&
		( aDay + a[ 1 ] ) % a[ 2 ] === ( bDay + b[ 1 ] ) % b[ 2 ] &&
		equalNumbers( a[ 3 ], b[ 3 ] ) && equalNumbers( a[ 4 ], b[ 4 ] ) && a[ 5 ] === b[ 5 ] &&
		equalNumbers( a[ 6 ], b[ 6 ] );
}

function expectedProgramTuple( input: ProgramInput, source: OSProgram ): OSProgram {
	const encoded = encodeProgram( input );
	const dateRange: [ number, number, number ] = encoded.dateRange
		? [ encoded.dateRange.enable ? 1 : 0, encoded.dateRange.from, encoded.dateRange.to ]
		: [ 0, source[ 6 ][ 1 ], source[ 6 ][ 2 ] ];
	return [
		encoded.v[ 0 ] as number,
		encoded.v[ 1 ] as number,
		encoded.v[ 2 ] as number,
		( encoded.v[ 3 ] as number[] ).slice(),
		( encoded.v[ 4 ] as number[] ).slice(),
		// Firmware canonicalizes these two JSON-sensitive characters before storing the name.
		encoded.name.replace( /"/g, "'" ).replace( /\\/g, "/" ),
		dateRange,
	];
}

function selectedProgramIndex( value: string | undefined ): number | null {
	if ( value === undefined || !/^\d+$/.test( value ) ) return null;
	const pid = Number( value );
	return Number.isSafeInteger( pid ) && pid >= 0 && pid <= 255 ? pid : null;
}

export function mountDashboard( deps: HostDeps ): DashboardController {
	let data: DashboardData | null = null;
	let lastError: string | null = null;
	let activeTab: DashboardTab | "History" = "Status";
	let settingsSection: SettingsSection = "General";
	let programEditor: ProgramEditState | null = null;
	let programDraftDirty = false;
	let focusAfterPaint: string | null = null;
	let historyHtml: string | undefined;
	let refreshGeneration = 0;
	let mutationInFlight = false;
	let refreshAbort: AbortController | null = null;
	let mutationAbort: AbortController | null = null;
	let disposed = false;

	async function readProgramsWithClock( signal: AbortSignal, refreshClock: boolean ): Promise<{
		jp: DashboardData[ "jp" ]; jc: DashboardData[ "jc" ]; day: number;
	}> {
		if ( !refreshClock && data ) {
			const jp = await deps.api.getPrograms( signal );
			return { jp, jc: data.jc, day: controllerDay( data.jc.devt ) };
		}
		// Bracket `/jp` with controller-clock reads. Unlike the other program types, an interval
		// program's days0 is relative to "today"; pairing responses from opposite sides of midnight
		// would otherwise invent a conflict or the wrong absolute phase.
		const before = await deps.api.getControllerStatus( signal );
		const jp = await deps.api.getPrograms( signal );
		const after = await deps.api.getControllerStatus( signal );
		if ( controllerDay( before.devt ) === controllerDay( after.devt ) ) {
			return { jp, jc: after, day: controllerDay( after.devt ) };
		}
		const retryJp = await deps.api.getPrograms( signal );
		const retryAfter = await deps.api.getControllerStatus( signal );
		if ( controllerDay( after.devt ) !== controllerDay( retryAfter.devt ) ) {
			throw new Error( "The controller clock changed while reading this interval program. Try saving again." );
		}
		return { jp: retryJp, jc: retryAfter, day: controllerDay( retryAfter.devt ) };
	}

	function hasVisibleDirtyProgramDraft(): boolean {
		return programDraftDirty && activeTab === "Settings" && settingsSection === "Programs" &&
			deps.mount.querySelector( 'form[data-settings="program"]' ) !== null;
	}

	function discardProgramDraft(): boolean {
		if ( !hasVisibleDirtyProgramDraft() ) return true;
		if ( !deps.ctx.confirm( "Discard your unsaved program changes?" ) ) return false;
		programDraftDirty = false;
		return true;
	}

	/** Show only the schedule/start fieldset that matches the current select (program editor). */
	function applyConditionalVisibility(): void {
		const sched = deps.mount.querySelector<HTMLSelectElement>( 'select[name="schedType"]' )?.value;
		const start = deps.mount.querySelector<HTMLSelectElement>( 'select[name="startType"]' )?.value;
		const weatherMethod = deps.mount.querySelector<HTMLSelectElement>( 'select[name="method"]' )?.value;
		deps.mount.querySelectorAll<HTMLElement>( "[data-when]" ).forEach( ( el ) => {
			const w = el.dataset.when;
			el.hidden = !( w === sched || w === start );
		} );
		deps.mount.querySelectorAll<HTMLElement>( "[data-weather-methods]" ).forEach( ( el ) => {
			const methods = ( el.dataset.weatherMethods ?? "" ).split( "," );
			el.hidden = !weatherMethod || !methods.includes( weatherMethod );
		} );
	}

	function paint(): void {
		if ( disposed ) return;
		if ( activeTab === "History" && historyHtml === undefined ) activeTab = "Status";
		// Preserve keyboard focus on the active tab across a re-render driven by tab navigation.
		const refocusTab = ( document.activeElement as HTMLElement | null )?.getAttribute?.( "role" ) === "tab";
		try {
			deps.mount.innerHTML = data
				? ( lastError ? errorCard( lastError ) : "" ) + renderDashboard( data, activeTab, {
					actions: true, settingsSection, historyHtml,
					...( programEditor ? { programEditor: { pid: programEditor.pid, program: programEditor.source } } : {} ),
				} )
				: lastError
					? errorCard( lastError )
					: `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>Loading…</span></div>`;
		} catch ( error ) {
			lastError = `Unable to render controller data: ${ String( error ) }`;
			deps.mount.innerHTML = errorCard( lastError );
		}
		applyConditionalVisibility();
		applyInteractionState();
		if ( focusAfterPaint ) {
			deps.mount.querySelector<HTMLElement>( focusAfterPaint )?.focus();
			focusAfterPaint = null;
		} else if ( refocusTab ) deps.mount.querySelector<HTMLElement>( '[role="tab"][aria-selected="true"]' )?.focus();
	}

	function applyInteractionState(): void {
		if ( disposed ) return;
		const stale = lastError !== null;
		const dateRangeEnabled = deps.mount.querySelector<HTMLInputElement>( 'input[name="useDateRange"]' )?.checked ?? false;
		deps.mount.setAttribute( "aria-busy", mutationInFlight ? "true" : "false" );
		deps.mount.querySelectorAll<HTMLButtonElement>( "button[data-action]" ).forEach( ( button ) => {
			button.disabled = mutationInFlight || ( stale && button.dataset.action !== "retry" );
		} );
		deps.mount.querySelectorAll<HTMLButtonElement>( "button[data-tab], button[data-settings-section]" ).forEach( ( button ) => {
			button.disabled = mutationInFlight;
		} );
		deps.mount.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>( "form[data-settings] input, form[data-settings] select, form[data-settings] button" )
			.forEach( ( control ) => {
				const conditional = control.closest<HTMLElement>( "[data-when], [data-weather-methods]" );
				const inactiveScheduleField = conditional?.hidden ?? false;
				const inactiveDateRangeField = ( control.name === "drFrom" || control.name === "drTo" ) && !dateRangeEnabled;
				const permanentlyDisabled = control.dataset.formDisabled === "true";
				control.disabled = Boolean( permanentlyDisabled || mutationInFlight || stale || inactiveScheduleField || inactiveDateRangeField );
			} );
	}

	async function performRefresh(): Promise<boolean> {
		if ( disposed ) return false;
		const generation = ++refreshGeneration;
		refreshAbort?.abort();
		const abort = new AbortController();
		refreshAbort = abort;
		let loaded: DashboardData;
		try {
			loaded = await deps.load( abort.signal );
		} catch ( e ) {
			if ( disposed || abort.signal.aborted || generation !== refreshGeneration ) return false;
			if ( hasVisibleDirtyProgramDraft() ) {
				deps.toast( String( e ), true );
				applyInteractionState();
				return false;
			}
			lastError = String( e );
			deps.toast( String( e ), true );
			paint();
			return false;
		}
		if ( disposed || abort.signal.aborted || generation !== refreshGeneration ) return false;
		const preserveDraft = hasVisibleDirtyProgramDraft();
		if ( programEditor && programEditor.source[ 4 ].length !== loaded.jn.snames.length && !preserveDraft ) {
			programEditor = null;
			programDraftDirty = false;
			if ( activeTab === "Settings" && settingsSection === "Programs" ) activeTab = "Programs";
			deps.toast( "Station configuration changed, so the program editor was closed. Open it again to use the latest zones.", true );
		}
		data = loaded;
		lastError = null;
		// Device data is useful on its own; paint it before waiting on the optional companion.
		if ( preserveDraft ) applyInteractionState();
		else paint();

		if ( deps.companionBase === null ) {
			historyHtml = undefined;
			if ( hasVisibleDirtyProgramDraft() ) applyInteractionState();
			else paint();
			return true;
		}
		const companionBase = deps.companionBase ?? location.origin + "/";
		const nextHistory = await resolveHistoryHtml( companionBase, undefined, deps.companionToken, abort.signal );
		if ( disposed || abort.signal.aborted || generation !== refreshGeneration ) return false;
		historyHtml = nextHistory;
		if ( hasVisibleDirtyProgramDraft() ) applyInteractionState();
		else paint();
		return true;
	}

	async function refresh(): Promise<void> {
		await performRefresh();
	}

	async function withMutation( work: ( signal: AbortSignal ) => Promise<string | null> ): Promise<void> {
		if ( disposed || mutationInFlight || !data || lastError !== null ) return;
		mutationInFlight = true;
		const abort = new AbortController();
		mutationAbort = abort;
		// Keep the live form DOM intact so local validation or a failed command does not erase drafts.
		applyInteractionState();
		try {
			const msg = await work( abort.signal );
			if ( msg === null || disposed || abort.signal.aborted ) return;
			const refreshed = await performRefresh();
			if ( disposed || abort.signal.aborted ) return;
			if ( refreshed ) deps.toast( msg );
			else deps.toast( "The command may have been sent, but the controller state could not be verified.", true );
		} catch ( e ) {
			if ( !disposed && !abort.signal.aborted ) deps.toast( String( e ), true );
		} finally {
			if ( mutationAbort === abort ) mutationAbort = null;
			mutationInFlight = false;
			if ( !disposed ) applyInteractionState();
		}
	}

	async function runAction( ds: Record<string, string | undefined > ): Promise<void> {
		await withMutation( async ( signal ) => data ? dispatchAction( deps.api, {
			jp: data.jp, stationCount: data.jn.snames.length,
		}, ds, deps.ctx, signal ) : null );
	}

	function showProgramEditor( pid: number, program: OSProgram, sourceDay: number ): void {
		programEditor = { pid, source: cloneProgram( program ), sourceControllerDay: sourceDay };
		programDraftDirty = false;
		focusAfterPaint = '[name="name"]';
		activeTab = "Settings";
		settingsSection = "Programs";
		paint();
	}

	async function beginProgramEdit( pid: number, program: OSProgram ): Promise<void> {
		if ( !data || disposed ) return;
		const interval = ( ( program[ 0 ] >> 4 ) & 0x03 ) === 3;
		if ( !interval || !controllerDayBoundaryIsNear( data.jc.devt ) ) {
			showProgramEditor( pid, program, controllerDay( data.jc.devt ) );
			return;
		}

		// The dashboard's ordinary data load is concurrent. Around midnight, pair an interval
		// source with a bracketed controller day before the user starts editing it.
		mutationInFlight = true;
		const abort = new AbortController();
		mutationAbort = abort;
		applyInteractionState();
		try {
			const fresh = await readProgramsWithClock( abort.signal, true );
			if ( disposed || abort.signal.aborted ) return;
			const latest = fresh.jp.pd[ pid ];
			if ( !latest || latest[ 4 ].length !== data.jn.snames.length ) {
				throw new Error( "This program changed while it was opening. Refresh and try again." );
			}
			data = { ...data, jc: fresh.jc, jp: fresh.jp };
			if ( mutationAbort === abort ) mutationAbort = null;
			mutationInFlight = false;
			showProgramEditor( pid, latest, fresh.day );
		} catch ( error ) {
			if ( !disposed && !abort.signal.aborted ) deps.toast( String( error ), true );
		} finally {
			if ( mutationAbort === abort ) mutationAbort = null;
			mutationInFlight = false;
			if ( !disposed ) applyInteractionState();
		}
	}

	async function saveSettings( form: HTMLFormElement ): Promise<void> {
		if ( !data ) return;
		const kind = form.dataset.settings;
		const v = readForm( form );
		const count = parseInt( form.dataset.count ?? "0", 10 );
		await withMutation( async ( signal ) => {
			if ( !data ) return null;
			const fwvCombined = data.jo.fwv * 10 + ( data.jo.fwm || 0 );
			let msg = "Settings saved.";
			switch ( kind ) {
				case "general": await deps.api.submitOptions( buildGeneralOptions(
					v, fwvCombined, !isTimezoneAutoManaged( data.jc.loc ),
				), signal ); break;
				case "weather": await deps.api.submitOptions( buildWeatherOptions( v, ( data.jc.wto ?? {} ) as Record<string, unknown>, fwvCombined ), signal ); break;
				case "network": await deps.api.submitOptions( buildNetworkOptions( v ), signal ); break;
				case "stations": await deps.api.submitStations( buildStationConfig( v, count, data.jo.fwv, data.jn.maxlen ), signal ); break;
				case "program": {
					if ( count !== data.jn.snames.length ) {
						throw new Error( "Station configuration changed while this program was open. Keep the draft, or Cancel and reopen it." );
					}
					const input = buildProgramInput( v, count, fwvCombined, data.jp.pnsize );
					if ( programEditor ) {
						const formPid = selectedProgramIndex( form.dataset.pid );
						if ( formPid !== programEditor.pid ) throw new Error( "Invalid program selected for editing." );
						const source = programEditor.source;
						// `/cp` initializes omitted date bounds to the firmware defaults, even while the range is
						// disabled. Send the stored bounds explicitly so a name-only edit remains bit-for-bit safe.
						if ( !input.dateRange ) input.dateRange = {
							enable: false, from: source[ 6 ][ 1 ], to: source[ 6 ][ 2 ],
						};
						const intervalClock = ( ( source[ 0 ] >> 4 ) & 0x03 ) === 3 || input.schedule.type === "interval";
						const fresh = await readProgramsWithClock( signal, intervalClock );
						const freshProgram = fresh.jp.pd[ formPid ];
						if ( !sameProgramTupleAtControllerDays(
							freshProgram, fresh.day, source, programEditor.sourceControllerDay,
						) ) {
							data = { ...data, jc: fresh.jc, jp: fresh.jp };
							throw new Error( "This schedule changed on the controller. Keep this draft, or Cancel to review the latest version." );
						}
						// If an unchanged interval editor crossed midnight, submit the controller's current
						// relative remainder instead of shifting the schedule by resending yesterday's value.
						if ( ( ( source[ 0 ] >> 4 ) & 0x03 ) === 3 && input.schedule.type === "interval" &&
							input.schedule.intervalDays === source[ 2 ] && input.schedule.startingInDays === source[ 1 ] ) {
							input.schedule.startingInDays = freshProgram![ 1 ];
						}
						if ( input.schedule.type === "interval" && controllerSecondsOfDay( fresh.jc.devt ) >= 86400 - 120 ) {
							throw new Error( "The controller day is about to change. Keep this draft and retry in a couple of minutes." );
						}
						await deps.api.submitProgram( formPid, input, signal );
						const verified = await readProgramsWithClock( signal, intervalClock );
						const saved = verified.jp.pd[ formPid ];
						if ( !sameProgramTupleAtControllerDays(
							saved, verified.day, expectedProgramTuple( input, source ), fresh.day,
						) ) {
							data = { ...data, jc: verified.jc, jp: verified.jp };
							throw new Error( "The program was sent, but the controller did not return the saved changes. Review it before retrying." );
						}
						programEditor = { pid: formPid, source: cloneProgram( saved! ), sourceControllerDay: verified.day };
						programDraftDirty = false;
						msg = "Program updated.";
					} else {
						if ( form.dataset.pid !== "-1" ) throw new Error( "Invalid new-program form." );
						if ( input.schedule.type === "interval" ) {
							const current = await deps.api.getControllerStatus( signal );
							if ( controllerSecondsOfDay( current.devt ) >= 86400 - 120 ) {
								throw new Error( "The controller day is about to change. Keep this draft and retry in a couple of minutes." );
							}
						}
						await deps.api.submitProgram( -1, input, signal );
						programDraftDirty = false;
						msg = "Program created.";
					}
					break;
				}
				default: return null;
			}
			return msg;
		} );
	}

	function onClick( ev: Event ): void {
		const target = ev.target as HTMLElement;
		const tab = target.closest<HTMLElement>( "[data-tab]" );
		if ( tab?.dataset.tab ) {
			if ( mutationInFlight ) return;
			const next = tab.dataset.tab as DashboardTab | "History";
			if ( next === activeTab ) return;
			if ( !discardProgramDraft() ) return;
			activeTab = next; paint(); return;
		}

		const sec = target.closest<HTMLElement>( "[data-settings-section]" );
		if ( sec?.dataset.settingsSection ) {
			if ( mutationInFlight ) return;
			const next = sec.dataset.settingsSection as SettingsSection;
			if ( next === settingsSection ) return;
			if ( !discardProgramDraft() ) return;
			settingsSection = next; paint(); return;
		}

		const action = target.closest<HTMLButtonElement>( "[data-action]" );
		if ( action?.dataset.action ) {
			if ( action.dataset.action === "retry" ) { void refresh(); return; }
			if ( mutationInFlight || lastError !== null ) return;
			if ( action.dataset.action === "program-new" ) {
				programEditor = null; programDraftDirty = false;
				focusAfterPaint = '[name="name"]'; activeTab = "Settings"; settingsSection = "Programs"; paint(); return;
			}
			if ( action.dataset.action === "program-edit" ) {
				const pid = selectedProgramIndex( action.dataset.pid );
				const program = pid === null ? undefined : data?.jp.pd[ pid ];
				if ( pid === null || !program ) { deps.toast( "Invalid program.", true ); return; }
				if ( program[ 4 ].length !== data?.jn.snames.length ) {
					deps.toast( "Program and station data are out of sync. Refresh before editing.", true ); return;
				}
				void beginProgramEdit( pid, program ); return;
			}
			if ( action.dataset.action === "program-cancel" ) {
				if ( !discardProgramDraft() ) return;
				const pid = programEditor?.pid;
				programEditor = null; programDraftDirty = false;
				focusAfterPaint = pid === undefined ? '[data-action="program-new"]' :
					`[data-action="program-edit"][data-pid="${ pid }"]`;
				activeTab = "Programs"; paint(); return;
			}
			// "save-*" submit buttons are handled by the form submit listener.
			if ( action.type !== "submit" ) void runAction( { ...action.dataset } );
		}
	}

	function onSubmit( ev: Event ): void {
		const form = ( ev.target as HTMLElement ).closest<HTMLFormElement>( "form[data-settings]" );
		if ( !form ) return;
		ev.preventDefault();
		if ( mutationInFlight || lastError !== null ) return;
		void saveSettings( form );
	}

	function noteProgramDraft( ev: Event ): void {
		const target = ev.target as HTMLElement;
		if ( target.closest( 'form[data-settings="program"]' ) ) programDraftDirty = true;
	}

	// Re-apply program-editor conditional visibility as the schedule/start selects change.
	function onChange( ev: Event ): void {
		noteProgramDraft( ev );
		const name = ( ev.target as HTMLElement ).getAttribute?.( "name" );
		if ( name === "schedType" || name === "startType" || name === "useDateRange" || name === "method" ) {
			applyConditionalVisibility();
			applyInteractionState();
		}
	}

	// Roving-tabindex arrow-key navigation for the tablists (WAI-ARIA tabs pattern, auto-activation).
	function onKeydown( ev: KeyboardEvent ): void {
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
	}

	deps.mount.addEventListener( "click", onClick );
	deps.mount.addEventListener( "submit", onSubmit );
	deps.mount.addEventListener( "input", noteProgramDraft );
	deps.mount.addEventListener( "change", onChange );
	deps.mount.addEventListener( "keydown", onKeydown );

	void refresh();
	return {
		refresh,
		destroy(): void {
			if ( disposed ) return;
			disposed = true;
			refreshGeneration++;
			refreshAbort?.abort();
			mutationAbort?.abort();
			refreshAbort = null;
			mutationAbort = null;
			deps.mount.removeEventListener( "click", onClick );
			deps.mount.removeEventListener( "submit", onSubmit );
			deps.mount.removeEventListener( "input", noteProgramDraft );
			deps.mount.removeEventListener( "change", onChange );
			deps.mount.removeEventListener( "keydown", onKeydown );
			deps.mount.removeAttribute( "aria-busy" );
		},
	};
}

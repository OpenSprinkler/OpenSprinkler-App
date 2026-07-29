/**
 * Dashboard host controller — the single place that turns the pure render + the data/command layers
 * into an interactive app. Used by both the demo (mocked transport) and app/ (real device). It owns
 * the active tab / settings-section state, maps clicks and settings forms to verified transactions,
 * and re-fetches the full dashboard after a successfully checked write.
 */
import type { OsApiClient } from "../api/client";
import type { JcResponse, JnResponse, JoResponse, OSProgram } from "../api/types";
import { encodeProgram, escapeJsonForFirmware, type ProgramInput, type StationConfigInput } from "../api/encode";
import { renderDashboard, type DashboardData, type DashboardTab } from "./dashboard";
import type { SettingsSection } from "./settings/index";
import type { ActionContext } from "./dispatch";
import { readForm } from "../ui/form";
import { buildGeneralOptions, isTimezoneAutoManaged } from "./settings/general";
import { buildWeatherOptions } from "./settings/weather";
import { buildStationConfig } from "./settings/stations-edit";
import { buildProgramInput } from "./settings/program-edit";
import { detectCompanion, fetchHistory, fetchRunLog } from "../api/companion";
import { deliverConfigurationExport } from "../config-export";
import { renderHistory } from "./history-view";
import { errorCard, esc } from "../ui/help";

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
	/**
	 * Explicit hardware-verification proof and the exact mutation families approved for this host.
	 * Absence is intentionally read-only except for emergency stop/cancel controls.
	 */
	mutationProof?: Readonly<{
		hardwareVerified: true;
		permissions: readonly MutationPermission[];
	}>;
}

/** Mutations whose current controller read APIs support a deterministic post-write check. */
export const VERIFIED_MUTATION_PERMISSIONS = [
	"controller-enable", "rain-delay", "clear-overcurrent",
	"general-options", "weather-options", "stations",
	"program-create", "program-edit", "program-toggle", "program-delete",
] as const;
export type MutationPermission = ( typeof VERIFIED_MUTATION_PERMISSIONS )[ number ];

export interface DashboardController {
	refresh(): Promise<void>;
	/** Remove delegated listeners and make all outstanding async completions inert. */
	destroy(): void;
}

const RUNTIME_REFRESH_MS = 4000;
const CONFIG_REFRESH_MS = 20000;
const CONTROLLER_STALE_MS = 12000;
const FAILURE_BACKOFF_MS = [ 4000, 8000, 16000, 30000 ] as const;

type RefreshResult = "success" | "failure" | "aborted";

interface FullRefreshOptions {
	automatic: boolean;
	discoverHistory: boolean;
	surfaceError: boolean;
}

function sameSnapshot( a: unknown, b: unknown ): boolean {
	return JSON.stringify( a ) === JSON.stringify( b );
}

function sameValue( a: unknown, b: unknown ): boolean {
	if ( Object.is( a, b ) ) return true;
	if ( Array.isArray( a ) || Array.isArray( b ) ) {
		return Array.isArray( a ) && Array.isArray( b ) && a.length === b.length &&
			a.every( ( value, index ) => sameValue( value, b[ index ] ) );
	}
	if ( typeof a !== "object" || a === null || typeof b !== "object" || b === null ) return false;
	const aRecord = a as Record<string, unknown>, bRecord = b as Record<string, unknown>;
	const aKeys = Object.keys( aRecord ).sort(), bKeys = Object.keys( bRecord ).sort();
	return aKeys.length === bKeys.length && aKeys.every( ( key, index ) =>
		key === bKeys[ index ] && sameValue( aRecord[ key ], bRecord[ key ] ) );
}

const LOCAL_ACTIONS = new Set( [ "retry", "config-export", "program-new", "program-edit", "program-cancel" ] );
const EMERGENCY_ACTIONS = new Set( [ "stop-all", "station-stop", "cancel-rain" ] );
const ACTION_PERMISSIONS: Readonly<Record<string, MutationPermission>> = {
	"toggle-enable": "controller-enable",
	"rain-delay": "rain-delay",
	"clear-ocs": "clear-overcurrent",
	"program-toggle": "program-toggle",
	"program-delete": "program-delete",
};
const GENERAL_OPTION_FIELDS: Readonly<Record<string, string>> = {
	dname: "dname", tzOffset: "tz", wl: "wl", sdt: "sdt", lg: "lg", sn1t: "sn1t", sn1o: "sn1o",
};
const WEATHER_WTO_FIELDS = new Set( [ "provider", "key", "rainAmt", "rainDays", "minTemp", "cali", "mda" ] );

function actionPermission( action: string | undefined ): MutationPermission | null {
	return action === undefined ? null : ACTION_PERMISSIONS[ action ] ?? null;
}

function settingsPermission( kind: string | undefined, editingProgram: boolean ): MutationPermission | null {
	switch ( kind ) {
		case "general": return "general-options";
		case "weather": return "weather-options";
		// Network writes can sever the route needed for readback; keep them locked until a
		// recovery-aware reconnect transaction is available.
		case "network": return null;
		case "stations": return "stations";
		case "program": return editingProgram ? "program-edit" : "program-create";
		default: return null;
	}
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

function sameProgramCollectionAtControllerDays(
	a: DashboardData[ "jp" ], aDay: number, b: DashboardData[ "jp" ], bDay: number,
): boolean {
	return a.nprogs === b.nprogs && a.nboards === b.nboards && a.mnp === b.mnp &&
		a.mnst === b.mnst && a.pnsize === b.pnsize && a.pd.length === b.pd.length &&
		a.pd.every( ( program, pid ) => sameProgramTupleAtControllerDays( program, aDay, b.pd[ pid ], bDay ) );
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

function withProgramEnabled( program: OSProgram, enabled: boolean ): OSProgram {
	const expected = cloneProgram( program );
	expected[ 0 ] = enabled ? expected[ 0 ] | 1 : expected[ 0 ] & ~1;
	return expected;
}

function selectedProgramIndex( value: string | undefined ): number | null {
	if ( value === undefined || !/^\d+$/.test( value ) ) return null;
	const pid = Number( value );
	return Number.isSafeInteger( pid ) && pid >= 0 && pid <= 255 ? pid : null;
}

function optionValue( jo: JoResponse, jc: JcResponse, key: string ): unknown {
	if ( key === "dname" ) return jc.dname;
	if ( key === "loc" ) return jc.loc;
	if ( key === "wto" ) return jc.wto;
	return jo[ key ];
}

function expectedOptionValue( key: string, wireValue: string | number ): unknown {
	if ( key === "dname" || key === "loc" ) {
		return typeof wireValue === "string" ? canonicalFirmwareString( wireValue ) : wireValue;
	}
	if ( key !== "wto" ) return wireValue;
	try { return JSON.parse( `{${ wireValue }}` ) as unknown; }
	catch { throw new Error( "Weather options could not be encoded for exact verification." ); }
}

function canonicalFirmwareString( value: string ): string {
	return value.replace( /"/g, "'" ).replace( /\\/g, "/" );
}

function requireActionIndex( value: string | undefined, label: string ): number {
	const index = selectedProgramIndex( value );
	if ( index === null ) throw new Error( `Invalid ${ label }.` );
	return index;
}

function stationOutputIsClear( jc: JcResponse, sid: number ): boolean {
	const board = jc.sbits[ sid >> 3 ];
	return typeof board === "number" && ( board & ( 1 << ( sid & 7 ) ) ) === 0;
}

function snapshotFormValues( form: HTMLFormElement ): Record<string, string | boolean> {
	const values: Record<string, string | boolean> = {};
	form.querySelectorAll<HTMLInputElement | HTMLSelectElement>( "[name]" ).forEach( ( control ) => {
		values[ control.name ] = control instanceof HTMLInputElement && control.type === "checkbox"
			? control.checked : control.value;
	} );
	return values;
}

function changedFormFields(
	current: Record<string, string | boolean>, original: Record<string, string | boolean> | null,
): Set<string> {
	return new Set( Object.keys( current ).filter( ( key ) => !sameValue( current[ key ], original?.[ key ] ) ) );
}

export function mountDashboard( deps: HostDeps ): DashboardController {
	let data: DashboardData | null = null;
	let lastError: string | null = null;
	let activeTab: DashboardTab | "History" = "Status";
	let settingsSection: SettingsSection = "General";
	let renderedSettingsSource: DashboardData | null = null;
	let renderedSettingsValues: Record<string, string | boolean> | null = null;
	let programEditor: ProgramEditState | null = null;
	let programDraftDirty = false;
	let focusAfterPaint: string | null = null;
	let historyHtml: string | undefined;
	let refreshGeneration = 0;
	let mutationInFlight = false;
	let refreshAbort: AbortController | null = null;
	let automaticRefreshAbort: AbortController | null = null;
	let mutationAbort: AbortController | null = null;
	let pollTimer: ReturnType<typeof setTimeout> | null = null;
	let staleTimer: ReturnType<typeof setTimeout> | null = null;
	let lastControllerSuccessAt: number | null = null;
	let lastConfigurationRefreshAt: number | null = null;
	let automaticError: string | null = null;
	let automaticFailures = 0;
	let companionDiscoveryAttempted = false;
	let disposed = false;
	const hostDocument = deps.mount.ownerDocument;
	const mutationPermissions = new Set<MutationPermission>( deps.mutationProof?.hardwareVerified === true
		? deps.mutationProof.permissions : [] );
	const hardwareVerified = deps.mutationProof?.hardwareVerified === true;

	function permissionGranted( permission: MutationPermission | null ): boolean {
		return permission !== null && hardwareVerified && mutationPermissions.has( permission );
	}

	function actionAllowed( action: string | undefined ): boolean {
		if ( action === undefined ) return false;
		return LOCAL_ACTIONS.has( action ) || EMERGENCY_ACTIONS.has( action ) || permissionGranted( actionPermission( action ) );
	}

	function mutationLockedMessage(): string {
		return hardwareVerified
			? "This controller write is not enabled by the hardware-verification permissions."
			: "Controller writes are locked pending hardware verification.";
	}

	function controllerIsStale(): boolean {
		return data !== null && lastControllerSuccessAt !== null &&
			Date.now() - lastControllerSuccessAt >= CONTROLLER_STALE_MS;
	}

	function interactionsAreBlocked(): boolean {
		return lastError !== null || controllerIsStale();
	}

	function clearPollTimer(): void {
		if ( pollTimer !== null ) clearTimeout( pollTimer );
		pollTimer = null;
	}

	function clearStaleTimer(): void {
		if ( staleTimer !== null ) clearTimeout( staleTimer );
		staleTimer = null;
	}

	function scheduleStaleTransition(): void {
		clearStaleTimer();
		if ( disposed || lastControllerSuccessAt === null ) return;
		const remaining = CONTROLLER_STALE_MS - ( Date.now() - lastControllerSuccessAt );
		if ( remaining <= 0 ) {
			updateConnectionState();
			return;
		}
		staleTimer = setTimeout( () => {
			staleTimer = null;
			updateConnectionState();
		}, remaining );
	}

	function noteControllerSuccess( configuration = false ): void {
		lastControllerSuccessAt = Date.now();
		if ( configuration ) lastConfigurationRefreshAt = lastControllerSuccessAt;
		lastError = null;
		automaticError = null;
		automaticFailures = 0;
		scheduleStaleTransition();
	}

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

	function connectionStateHtml(): string {
		if ( controllerIsStale() ) {
			const detail = automaticError ?? lastError;
			return `<div class="error-card" role="status">` +
				`<div class="error-title"><span>Controller data is stale</span></div>` +
				`<p class="error-detail">The last successful controller response was at least 12 seconds ago.` +
				( detail ? ` ${ esc( detail ) }` : "" ) + `</p>` +
				`<button class="action primary" type="button" data-action="retry">Retry</button></div>`;
		}
		return lastError ? errorCard( lastError ) : "";
	}

	function mutationStateHtml(): string {
		return hardwareVerified ? "" : `<p class="info-note muted" role="status" data-mutation-lock>` +
			`Controller writes are locked pending hardware verification. Stop and cancel controls remain available.</p>`;
	}

	function updateConnectionState(): void {
		if ( disposed ) return;
		const container = deps.mount.querySelector<HTMLElement>( "[data-connection-state]" );
		if ( !container ) return;
		const html = connectionStateHtml();
		container.innerHTML = html;
		container.hidden = html === "";
		applyInteractionState();
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
			const connection = connectionStateHtml();
			deps.mount.innerHTML = `<div data-connection-state${ connection ? "" : " hidden" }>${ connection }</div>` +
				mutationStateHtml() + ( data
				? renderDashboard( data, activeTab, {
					actions: true, settingsSection, historyHtml,
					...( programEditor ? { programEditor: { pid: programEditor.pid, program: programEditor.source } } : {} ),
				} )
				: lastError
					? ""
					: `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>Loading…</span></div>` );
		} catch ( error ) {
			lastError = `Unable to render controller data: ${ String( error ) }`;
			deps.mount.innerHTML = `<div data-connection-state>${ errorCard( lastError ) }</div>`;
		}
		applyConditionalVisibility();
		applyInteractionState();
		if ( data && activeTab === "Settings" ) {
			renderedSettingsSource = data;
			const form = deps.mount.querySelector<HTMLFormElement>( "form[data-settings]" );
			renderedSettingsValues = form ? snapshotFormValues( form ) : null;
		}
		if ( focusAfterPaint ) {
			deps.mount.querySelector<HTMLElement>( focusAfterPaint )?.focus();
			focusAfterPaint = null;
		} else if ( refocusTab ) deps.mount.querySelector<HTMLElement>( '[role="tab"][aria-selected="true"]' )?.focus();
	}

	function applyInteractionState(): void {
		if ( disposed ) return;
		const stale = interactionsAreBlocked();
		const dateRangeEnabled = deps.mount.querySelector<HTMLInputElement>( 'input[name="useDateRange"]' )?.checked ?? false;
		deps.mount.setAttribute( "aria-busy", mutationInFlight ? "true" : "false" );
		deps.mount.querySelectorAll<HTMLButtonElement>( "button[data-action]" ).forEach( ( button ) => {
			const action = button.dataset.action;
			const permissionLocked = !actionAllowed( action );
			const staleBlocked = stale && action !== "retry" && !LOCAL_ACTIONS.has( action ?? "" ) &&
				!EMERGENCY_ACTIONS.has( action ?? "" );
			button.disabled = mutationInFlight || staleBlocked || permissionLocked;
			if ( permissionLocked ) button.title = mutationLockedMessage();
			else if ( button.title === mutationLockedMessage() ) button.removeAttribute( "title" );
		} );
		deps.mount.querySelectorAll<HTMLButtonElement>( "button[data-tab], button[data-settings-section]" ).forEach( ( button ) => {
			button.disabled = mutationInFlight;
		} );
		deps.mount.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>( "form[data-settings] input, form[data-settings] select, form[data-settings] button" )
			.forEach( ( control ) => {
				const form = control.closest<HTMLFormElement>( "form[data-settings]" );
				const conditional = control.closest<HTMLElement>( "[data-when], [data-weather-methods]" );
				const inactiveScheduleField = conditional?.hidden ?? false;
				const inactiveDateRangeField = ( control.name === "drFrom" || control.name === "drTo" ) && !dateRangeEnabled;
				const permanentlyDisabled = control.dataset.formDisabled === "true";
				const submitLocked = control instanceof HTMLButtonElement && control.type === "submit" &&
					!permissionGranted( settingsPermission( form?.dataset.settings, form?.dataset.pid !== "-1" ) );
				control.disabled = Boolean( permanentlyDisabled || mutationInFlight || stale || submitLocked ||
					inactiveScheduleField || inactiveDateRangeField );
				if ( submitLocked ) control.title = mutationLockedMessage();
			} );
	}

	async function performRefresh( options: FullRefreshOptions ): Promise<RefreshResult> {
		if ( disposed ) return "aborted";
		const generation = ++refreshGeneration;
		refreshAbort?.abort();
		const abort = new AbortController();
		refreshAbort = abort;
		if ( options.automatic ) automaticRefreshAbort = abort;
		try {
			let loaded: DashboardData;
			try {
				loaded = await deps.load( abort.signal );
			} catch ( e ) {
				if ( disposed || abort.signal.aborted || generation !== refreshGeneration ) return "aborted";
				if ( options.surfaceError ) {
					if ( hasVisibleDirtyProgramDraft() ) {
						deps.toast( String( e ), true );
						applyInteractionState();
						return "failure";
					}
					lastError = String( e );
					deps.toast( String( e ), true );
					paint();
				} else {
					automaticError = String( e );
					updateConnectionState();
				}
				return "failure";
			}
			if ( disposed || abort.signal.aborted || generation !== refreshGeneration ) return "aborted";
			const previous = data;
			const preserveDraft = hasVisibleDirtyProgramDraft();
			const preserveAutomaticSettings = options.automatic && activeTab === "Settings" &&
				deps.mount.querySelector( "form[data-settings]" ) !== null;
			let editorClosed = false;
			if ( programEditor && programEditor.source[ 4 ].length !== loaded.jn.snames.length &&
				!preserveDraft ) {
				programEditor = null;
				programDraftDirty = false;
				editorClosed = true;
				if ( activeTab === "Settings" && settingsSection === "Programs" ) activeTab = "Programs";
				deps.toast( "Station configuration changed, so the program editor was closed. Open it again to use the latest zones.", true );
			}
			data = loaded;
			noteControllerSuccess( true );
			// Automatic polling leaves live settings forms intact. Unchanged snapshots also need no repaint.
			if ( preserveDraft || ( preserveAutomaticSettings && !editorClosed ) ||
				( options.automatic && !editorClosed && sameSnapshot( previous, loaded ) ) ) {
				updateConnectionState();
			} else paint();

			if ( options.discoverHistory && !companionDiscoveryAttempted ) {
				companionDiscoveryAttempted = true;
				let nextHistory: string | undefined;
				if ( deps.companionBase !== null ) {
					const companionBase = deps.companionBase ?? location.origin + "/";
					nextHistory = await resolveHistoryHtml( companionBase, undefined, deps.companionToken, abort.signal );
					if ( disposed || abort.signal.aborted || generation !== refreshGeneration ) return "aborted";
				}
				const historyChanged = historyHtml !== nextHistory;
				historyHtml = nextHistory;
				if ( historyChanged ) {
					if ( hasVisibleDirtyProgramDraft() || preserveAutomaticSettings ) applyInteractionState();
					else paint();
				}
			}
			return "success";
		} finally {
			if ( refreshAbort === abort ) refreshAbort = null;
			if ( automaticRefreshAbort === abort ) automaticRefreshAbort = null;
		}
	}

	async function performRuntimeRefresh(): Promise<RefreshResult> {
		if ( disposed || !data ) return "aborted";
		const generation = ++refreshGeneration;
		refreshAbort?.abort();
		const abort = new AbortController();
		refreshAbort = abort;
		automaticRefreshAbort = abort;
		try {
			let jc: DashboardData[ "jc" ];
			try { jc = await deps.api.getControllerStatus( abort.signal ); }
			catch ( error ) {
				if ( disposed || abort.signal.aborted || generation !== refreshGeneration ) return "aborted";
				automaticError = String( error );
				updateConnectionState();
				return "failure";
			}
			if ( disposed || abort.signal.aborted || generation !== refreshGeneration ) return "aborted";
			const changed = !sameSnapshot( data.jc, jc );
			data = changed ? { ...data, jc } : data;
			noteControllerSuccess();
			if ( !changed || activeTab === "Settings" || hasVisibleDirtyProgramDraft() ) updateConnectionState();
			else paint();
			return "success";
		} finally {
			if ( refreshAbort === abort ) refreshAbort = null;
			if ( automaticRefreshAbort === abort ) automaticRefreshAbort = null;
		}
	}

	function scheduleAutomaticPoll( delay: number ): void {
		clearPollTimer();
		if ( disposed || hostDocument.hidden ) return;
		pollTimer = setTimeout( () => {
			pollTimer = null;
			void runAutomaticPoll();
		}, delay );
	}

	async function runAutomaticPoll( supersedePausedRead = false ): Promise<void> {
		if ( disposed || hostDocument.hidden ) return;
		if ( refreshAbort !== null && supersedePausedRead && automaticRefreshAbort !== null ) {
			automaticRefreshAbort.abort();
		} else if ( mutationInFlight || refreshAbort !== null ) {
			scheduleAutomaticPoll( RUNTIME_REFRESH_MS );
			return;
		}
		const configurationDue = lastConfigurationRefreshAt === null ||
			Date.now() - lastConfigurationRefreshAt >= CONFIG_REFRESH_MS;
		const result = configurationDue
			? await performRefresh( { automatic: true, discoverHistory: false, surfaceError: false } )
			: await performRuntimeRefresh();
		if ( disposed || hostDocument.hidden ) return;
		if ( result === "failure" ) automaticFailures++;
		const delay = result === "failure"
			? FAILURE_BACKOFF_MS[ Math.min( automaticFailures - 1, FAILURE_BACKOFF_MS.length - 1 ) ]
			: RUNTIME_REFRESH_MS;
		scheduleAutomaticPoll( delay );
	}

	async function refresh(): Promise<void> {
		if ( disposed || mutationInFlight ) return;
		clearPollTimer();
		automaticFailures = 0;
		await performRefresh( { automatic: false, discoverHistory: true, surfaceError: true } );
		if ( !disposed ) scheduleAutomaticPoll( RUNTIME_REFRESH_MS );
	}

	async function verifyOptionsMutation(
		desired: Record<string, string | number>, dirtyFields: Set<string>, source: DashboardData,
		kind: "general" | "weather", signal: AbortSignal,
	): Promise<boolean> {
		const directKeys = new Set<string>();
		if ( kind === "general" ) {
			for ( const field of dirtyFields ) {
				const key = GENERAL_OPTION_FIELDS[ field ];
				if ( key && Object.prototype.hasOwnProperty.call( desired, key ) ) directKeys.add( key );
			}
		} else {
			if ( dirtyFields.has( "method" ) ) directKeys.add( "uwt" );
			if ( ( dirtyFields.has( "loc" ) || dirtyFields.has( "clearLoc" ) ) &&
				Object.prototype.hasOwnProperty.call( desired, "loc" ) ) directKeys.add( "loc" );
		}

		const directChanges = [ ...directKeys ].filter( ( key ) =>
			!sameValue( optionValue( source.jo, source.jc, key ), expectedOptionValue( key, desired[ key ]! ) ) );
		const dirtyWtoFields = kind === "weather"
			? [ ...dirtyFields ].filter( ( field ) => WEATHER_WTO_FIELDS.has( field ) ) : [];
		if ( directChanges.length === 0 && dirtyWtoFields.length === 0 ) return false;

		const [ freshJo, freshJc ] = await Promise.all( [
			deps.api.getOptions( signal ), deps.api.getControllerStatus( signal ),
		] );
		for ( const key of directChanges ) {
			if ( !sameValue( optionValue( freshJo, freshJc, key ), optionValue( source.jo, source.jc, key ) ) ) {
				throw new Error( "These settings changed on the controller. Review the latest values before saving." );
			}
		}

		const payload: Record<string, string | number> = {};
		const expected = new Map<string, unknown>();
		for ( const key of directChanges ) {
			payload[ key ] = desired[ key ]!;
			expected.set( key, expectedOptionValue( key, desired[ key ]! ) );
		}

		if ( dirtyWtoFields.length > 0 ) {
			const sourceWto = source.jc.wto;
			const freshWto = freshJc.wto;
			const candidate = expectedOptionValue( "wto", desired.wto! );
			if ( typeof candidate !== "object" || candidate === null || Array.isArray( candidate ) ) {
				throw new Error( "Weather options could not be prepared for exact verification." );
			}
			const candidateWto = candidate as Record<string, unknown>;
			const mergedWto: Record<string, unknown> = { ...freshWto };
			for ( const field of dirtyWtoFields ) {
				if ( !Object.prototype.hasOwnProperty.call( candidateWto, field ) ||
					sameValue( candidateWto[ field ], sourceWto[ field ] ) ) continue;
				if ( !sameValue( freshWto[ field ], sourceWto[ field ] ) ) {
					throw new Error( "Weather settings changed on the controller. Review the latest values before saving." );
				}
				mergedWto[ field ] = candidateWto[ field ];
			}
			if ( !sameValue( mergedWto, freshWto ) ) {
				payload.wto = escapeJsonForFirmware( mergedWto );
				expected.set( "wto", mergedWto );
			}
		}

		if ( Object.keys( payload ).length === 0 ) return false;
		await deps.api.submitOptions( payload, signal );
		const [ verifiedJo, verifiedJc ] = await Promise.all( [
			deps.api.getOptions( signal ), deps.api.getControllerStatus( signal ),
		] );
		const verificationKeys = new Set( [ ...Object.keys( desired ), ...expected.keys() ] );
		for ( const key of verificationKeys ) {
			const wanted = expected.has( key ) ? expected.get( key ) : optionValue( freshJo, freshJc, key );
			if ( !sameValue( optionValue( verifiedJo, verifiedJc, key ), wanted ) ) {
				throw new Error( "The controller did not return the exact saved settings. Review them before retrying." );
			}
		}
		if ( data ) data = { ...data, jo: verifiedJo, jc: verifiedJc };
		return true;
	}

	async function verifyStationsMutation(
		desired: StationConfigInput, dirtyFields: Set<string>, source: DashboardData, signal: AbortSignal,
	): Promise<boolean> {
		const changedNames: Record<number, string> = {};
		for ( const [ rawSid, name ] of Object.entries( desired.names ?? {} ) ) {
			const sid = Number( rawSid );
			if ( !dirtyFields.has( `name_${ sid }` ) ) continue;
			const expectedName = canonicalFirmwareString( desired.fwv >= 208 ? name.replace( /\s/g, "_" ) : name );
			if ( source.jn.snames[ sid ] !== expectedName ) changedNames[ sid ] = expectedName;
		}
		type BoardTargets = Map<number, number[]>;
		const boardBit = ( values: number[], sid: number ): number => ( ( values[ sid >> 3 ] ?? 0 ) >> ( sid & 7 ) ) & 1;
		const changedBoardTargets = (
			desiredValues: number[] | undefined, sourceValues: number[], fieldPrefix: string,
		): BoardTargets => {
			const targets: BoardTargets = new Map();
			if ( !desiredValues ) return targets;
			for ( let sid = 0; sid < source.jn.snames.length; sid++ ) {
				if ( !dirtyFields.has( `${ fieldPrefix }_${ sid }` ) ||
					boardBit( desiredValues, sid ) === boardBit( sourceValues, sid ) ) continue;
				const bid = sid >> 3;
				targets.set( bid, [ ...( targets.get( bid ) ?? [] ), sid ] );
			}
			return targets;
		};
		const disabledTargets = changedBoardTargets( desired.disabled, source.jn.stn_dis, "dis" );
		const ignoreRainTargets = changedBoardTargets( desired.ignoreRain, source.jn.ignore_rain, "rain" );
		const changedGroups: Record<number, number> = {};
		for ( const [ rawSid, group ] of Object.entries( desired.groups ?? {} ) ) {
			const sid = Number( rawSid );
			if ( !dirtyFields.has( `grp_${ sid }` ) ) continue;
			if ( source.jn.stn_grp[ sid ] !== group ) changedGroups[ sid ] = group;
		}
		if ( Object.keys( changedNames ).length === 0 && disabledTargets.size === 0 && ignoreRainTargets.size === 0 &&
			Object.keys( changedGroups ).length === 0 ) return false;

		const fresh = await deps.api.getStations( signal );
		if ( fresh.snames.length !== source.jn.snames.length || fresh.maxlen !== source.jn.maxlen ) {
			throw new Error( "Station configuration changed on the controller. Reload it before saving." );
		}
		for ( const sid of Object.keys( changedNames ).map( Number ) ) {
			if ( fresh.snames[ sid ] !== source.jn.snames[ sid ] ) {
				throw new Error( "A station name changed on the controller. Reload it before saving." );
			}
		}
		const rebaseBoards = (
			targets: BoardTargets, desiredValues: number[] | undefined, freshValues: number[], sourceValues: number[],
		): number[] | undefined => {
			if ( targets.size === 0 || !desiredValues ) return undefined;
			const rebased: number[] = [];
			for ( const [ bid, sids ] of targets ) {
				let board = freshValues[ bid ] ?? 0;
				for ( const sid of sids ) {
					if ( boardBit( freshValues, sid ) !== boardBit( sourceValues, sid ) ) {
					throw new Error( "Station attributes changed on the controller. Reload them before saving." );
				}
					const mask = 1 << ( sid & 7 );
					board = boardBit( desiredValues, sid ) === 1 ? board | mask : board & ~mask;
				}
				rebased[ bid ] = board;
			}
			return rebased;
		};
		const changedDisabled = rebaseBoards( disabledTargets, desired.disabled, fresh.stn_dis, source.jn.stn_dis );
		const changedIgnoreRain = rebaseBoards( ignoreRainTargets, desired.ignoreRain, fresh.ignore_rain, source.jn.ignore_rain );
		for ( const sid of Object.keys( changedGroups ).map( Number ) ) {
			if ( fresh.stn_grp[ sid ] !== source.jn.stn_grp[ sid ] ) {
				throw new Error( "Station groups changed on the controller. Reload them before saving." );
			}
		}

		const payload: StationConfigInput = { fwv: desired.fwv };
		if ( Object.keys( changedNames ).length > 0 ) payload.names = changedNames;
		if ( changedDisabled ) payload.disabled = changedDisabled;
		if ( changedIgnoreRain ) payload.ignoreRain = changedIgnoreRain;
		if ( Object.keys( changedGroups ).length > 0 ) payload.groups = changedGroups;
		await deps.api.submitStations( payload, signal );

		const expected: JnResponse = {
			...fresh, snames: fresh.snames.slice(), stn_dis: fresh.stn_dis.slice(),
			ignore_rain: fresh.ignore_rain.slice(), stn_grp: fresh.stn_grp.slice(),
		};
		for ( const [ sid, name ] of Object.entries( changedNames ) ) expected.snames[ Number( sid ) ] = name;
		changedDisabled?.forEach( ( value, bid ) => { expected.stn_dis[ bid ] = value; } );
		changedIgnoreRain?.forEach( ( value, bid ) => { expected.ignore_rain[ bid ] = value; } );
		for ( const [ sid, group ] of Object.entries( changedGroups ) ) expected.stn_grp[ Number( sid ) ] = group;
		const verified = await deps.api.getStations( signal );
		if ( !sameValue( verified, expected ) ) {
			throw new Error( "The controller did not return the exact saved station configuration. Review it before retrying." );
		}
		if ( data ) data = { ...data, jn: verified };
		return true;
	}

	async function withMutation(
		authorization: MutationPermission | "emergency",
		work: ( signal: AbortSignal ) => Promise<string | null>,
	): Promise<void> {
		if ( authorization !== "emergency" && !permissionGranted( authorization ) ) {
			deps.toast( mutationLockedMessage(), true );
			return;
		}
		if ( disposed || mutationInFlight || !data || ( authorization !== "emergency" && interactionsAreBlocked() ) ) return;
		clearPollTimer();
		mutationInFlight = true;
		const abort = new AbortController();
		mutationAbort = abort;
		// Keep the live form DOM intact so local validation or a failed command does not erase drafts.
		applyInteractionState();
		try {
			const msg = await work( abort.signal );
			if ( msg === null || disposed || abort.signal.aborted ) return;
			const refreshed = await performRefresh( { automatic: false, discoverHistory: false, surfaceError: true } );
			if ( disposed || abort.signal.aborted ) return;
			if ( refreshed === "success" ) deps.toast( msg );
			else deps.toast( `${ msg } The changed state was verified, but the dashboard could not refresh.`, true );
		} catch ( e ) {
			if ( !disposed && !abort.signal.aborted ) deps.toast( String( e ), true );
		} finally {
			if ( mutationAbort === abort ) mutationAbort = null;
			mutationInFlight = false;
			if ( !disposed ) {
				applyInteractionState();
				scheduleAutomaticPoll( RUNTIME_REFRESH_MS );
			}
		}
	}

	async function runAction( ds: Record<string, string | undefined > ): Promise<void> {
		const action = ds.action;
		const authorization = action !== undefined && EMERGENCY_ACTIONS.has( action )
			? "emergency" : actionPermission( action );
		if ( authorization === null ) {
			deps.toast( mutationLockedMessage(), true );
			return;
		}
		await withMutation( authorization, async ( signal ) => {
			if ( !data ) return null;
			const source = data;
			switch ( action ) {
				case "stop-all": {
					// The pre-read proves the controller is reachable immediately before this unconditional
					// safety command. A generic refresh is not accepted as evidence of the stop.
					await Promise.all( [ deps.api.getControllerStatus( signal ), deps.api.getStatus( signal ) ] );
					await deps.api.stopAllStations( signal );
					const [ verifiedJc, verifiedStatus ] = await Promise.all( [
						deps.api.getControllerStatus( signal ), deps.api.getStatus( signal ),
					] );
					const queueClear = verifiedJc.nq === 0 && verifiedJc.ps.every( ( station ) =>
						station[ 0 ] === 0 && station[ 1 ] === 0 && station[ 2 ] === 0 );
					const outputsClear = verifiedJc.sbits.slice( 0, verifiedJc.nbrd ).every( ( bits ) => bits === 0 ) &&
						verifiedStatus.sn.every( ( on ) => on === 0 );
					if ( !queueClear || !outputsClear ) {
						throw new Error( "The controller did not confirm that every station and queue entry stopped." );
					}
					data = { ...data, jc: verifiedJc };
					return "All stations stopped.";
				}
				case "station-stop": {
					const sid = requireActionIndex( ds.sid, "station" );
					const [ freshJc, freshStatus ] = await Promise.all( [
						deps.api.getControllerStatus( signal ), deps.api.getStatus( signal ),
					] );
					if ( sid >= source.jn.snames.length || sid >= freshStatus.nstations || !freshJc.ps[ sid ] ) {
						throw new Error( "Invalid station." );
					}
					await deps.api.stopStation( sid, signal );
					const [ verifiedJc, verifiedStatus ] = await Promise.all( [
						deps.api.getControllerStatus( signal ), deps.api.getStatus( signal ),
					] );
					const station = verifiedJc.ps[ sid ];
					if ( !station || station[ 0 ] !== 0 || station[ 1 ] !== 0 || station[ 2 ] !== 0 ||
						verifiedStatus.sn[ sid ] !== 0 || !stationOutputIsClear( verifiedJc, sid ) ) {
						throw new Error( `The controller did not confirm that station ${ sid + 1 } stopped.` );
					}
					data = { ...data, jc: verifiedJc };
					return `Station ${ sid + 1 } stopped.`;
				}
				case "rain-delay": {
					const response = deps.ctx.prompt( "Rain delay in hours (0 to cancel):", "6" );
					if ( response === null ) return null;
					const rawHours = response.trim();
					if ( rawHours === "" ) throw new Error( "Enter a positive whole number of hours, or 0 to cancel." );
					const hours = Number( rawHours );
					if ( !Number.isSafeInteger( hours ) || hours < 0 || hours > 8760 ) {
						throw new Error( "Enter a whole number of hours from 1 to 8760, or 0 to cancel." );
					}
					const fresh = await deps.api.getControllerStatus( signal );
					if ( fresh.rd !== source.jc.rd || fresh.rdst !== source.jc.rdst ) {
						throw new Error( "Rain-delay state changed on the controller. Refresh before retrying." );
					}
					if ( hours === 0 ) await deps.api.cancelRainDelay( signal );
					else await deps.api.setRainDelayHours( hours, signal );
					const verified = await deps.api.getControllerStatus( signal );
					if ( hours === 0 ) {
						if ( verified.rd !== 0 || verified.rdst !== 0 ) {
							throw new Error( "The controller did not confirm that the rain delay was cancelled." );
						}
					} else {
						const minimumStop = fresh.devt + hours * 3600;
						const maximumStop = verified.devt + hours * 3600;
						if ( verified.rd !== 1 || verified.rdst < minimumStop || verified.rdst > maximumStop ) {
							throw new Error( "The controller did not return the requested rain-delay window." );
						}
					}
					data = { ...data, jc: verified };
					return hours === 0 ? "Rain delay cancelled." : `Rain delay set to ${ hours }h.`;
				}
				case "cancel-rain": {
					await deps.api.getControllerStatus( signal );
					await deps.api.cancelRainDelay( signal );
					const verified = await deps.api.getControllerStatus( signal );
					if ( verified.rd !== 0 || verified.rdst !== 0 ) {
						throw new Error( "The controller did not confirm that the rain delay was cancelled." );
					}
					data = { ...data, jc: verified };
					return "Rain delay cancelled.";
				}
				case "toggle-enable": {
					if ( ds.enabled !== "0" && ds.enabled !== "1" ) throw new Error( "Invalid controller state." );
					const renderedEnabled = source.jc.en;
					if ( Number( ds.enabled ) !== renderedEnabled ) throw new Error( "Controller state changed. Refresh before retrying." );
					const enabled = renderedEnabled !== 1;
					if ( !deps.ctx.confirm( enabled
						? "Enable the controller? Scheduled watering may start automatically."
						: "Disable the controller? Automatic watering will stop until it is enabled again." ) ) return null;
					const fresh = await deps.api.getControllerStatus( signal );
					if ( fresh.en !== renderedEnabled ) throw new Error( "Controller state changed. Refresh before retrying." );
					await deps.api.setControllerEnabled( enabled, signal );
					const verified = await deps.api.getControllerStatus( signal );
					if ( verified.en !== ( enabled ? 1 : 0 ) ) {
						throw new Error( "The controller did not return the requested enabled state." );
					}
					data = { ...data, jc: verified };
					return enabled ? "Controller enabled." : "Controller disabled.";
				}
				case "clear-ocs": {
					if ( source.jc.ocs === 0 ) throw new Error( "There is no overcurrent alert to clear." );
					const fresh = await deps.api.getControllerStatus( signal );
					if ( fresh.ocs !== source.jc.ocs ) throw new Error( "The overcurrent state changed. Refresh before retrying." );
					await deps.api.clearOvercurrent( signal );
					const verified = await deps.api.getControllerStatus( signal );
					if ( verified.ocs !== 0 ) throw new Error( "The controller did not confirm that the overcurrent alert cleared." );
					data = { ...data, jc: verified };
					return "Overcurrent alert cleared.";
				}
				case "program-toggle": {
					const pid = requireActionIndex( ds.pid, "program" );
					const renderedProgram = source.jp.pd[ pid ];
					if ( !renderedProgram || ( ds.enabled !== "0" && ds.enabled !== "1" ) ||
						Number( ds.enabled ) !== ( renderedProgram[ 0 ] & 1 ) ) throw new Error( "Invalid program state." );
					const enabled = ( renderedProgram[ 0 ] & 1 ) === 0;
					const programName = renderedProgram[ 5 ] || `Program ${ pid + 1 }`;
					if ( !deps.ctx.confirm( enabled
						? `Enable “${ programName }”? It may run at its next scheduled time.`
						: `Disable “${ programName }”? It will not run on schedule until re-enabled.` ) ) return null;
					const fresh = await readProgramsWithClock( signal, true );
					if ( !sameProgramCollectionAtControllerDays(
						fresh.jp, fresh.day, source.jp, controllerDay( source.jc.devt ),
					) ) throw new Error( "Programs changed on the controller. Refresh before retrying." );
					await deps.api.setProgramEnabled( pid, fresh.jp.pd[ pid ]!, enabled, signal );
					const expected = { ...fresh.jp, pd: fresh.jp.pd.map( ( program, index ) =>
						index === pid ? withProgramEnabled( program, enabled ) : cloneProgram( program ) ) };
					const verified = await readProgramsWithClock( signal, true );
					if ( !sameProgramCollectionAtControllerDays( verified.jp, verified.day, expected, fresh.day ) ) {
						throw new Error( "The controller did not return the exact requested program state." );
					}
					data = { ...data, jc: verified.jc, jp: verified.jp };
					return enabled ? "Program enabled." : "Program disabled.";
				}
				case "program-delete": {
					const pid = requireActionIndex( ds.pid, "program" );
					if ( !source.jp.pd[ pid ] ) throw new Error( "Invalid program." );
					if ( !deps.ctx.confirm( "Delete this program?" ) ) return null;
					const fresh = await readProgramsWithClock( signal, true );
					if ( !sameProgramCollectionAtControllerDays(
						fresh.jp, fresh.day, source.jp, controllerDay( source.jc.devt ),
					) ) throw new Error( "Programs changed on the controller. Refresh before retrying." );
					await deps.api.deleteProgram( pid, signal );
					const expected = {
						...fresh.jp, nprogs: fresh.jp.nprogs - 1,
						pd: fresh.jp.pd.filter( ( _program, index ) => index !== pid ).map( cloneProgram ),
					};
					const verified = await readProgramsWithClock( signal, true );
					if ( !sameProgramCollectionAtControllerDays( verified.jp, verified.day, expected, fresh.day ) ) {
						throw new Error( "The controller did not return the exact program list after deletion." );
					}
					data = { ...data, jc: verified.jc, jp: verified.jp };
					return "Program deleted.";
				}
				default:
					throw new Error( mutationLockedMessage() );
			}
		} );
	}

	async function exportConfiguration(): Promise<void> {
		if ( disposed || mutationInFlight || !data ) return;
		mutationInFlight = true;
		applyInteractionState();
		try {
			const delivery = await deliverConfigurationExport( data );
			if ( !disposed ) deps.toast( delivery === "shared"
				? "Configuration shared." : "Configuration export downloaded." );
		} catch ( error ) {
			if ( !disposed ) deps.toast( `Configuration export failed: ${ String( error ) }`, true );
		} finally {
			mutationInFlight = false;
			if ( !disposed ) applyInteractionState();
		}
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
		const dirtyFields = changedFormFields( snapshotFormValues( form ), renderedSettingsValues );
		const count = parseInt( form.dataset.count ?? "0", 10 );
		const permission = settingsPermission( kind, form.dataset.pid !== "-1" );
		if ( permission === null ) {
			deps.toast( mutationLockedMessage(), true );
			return;
		}
		// Automatic polling intentionally leaves a settings form in place. Always transact against
		// the snapshot that produced this DOM, not a newer background `data` object.
		const source = renderedSettingsSource ?? data;
		await withMutation( permission, async ( signal ) => {
			if ( !data ) return null;
			const fwvCombined = source.jo.fwv * 10 + ( source.jo.fwm || 0 );
			let msg = "Settings saved.";
			switch ( kind ) {
				case "general": {
					const changed = await verifyOptionsMutation( buildGeneralOptions(
						v, fwvCombined, !isTimezoneAutoManaged( source.jc.loc ),
					), dirtyFields, source, "general", signal );
					msg = changed ? "Settings saved." : "No settings changed.";
					break;
				}
				case "weather": {
					const changed = await verifyOptionsMutation( buildWeatherOptions(
						v, ( source.jc.wto ?? {} ) as Record<string, unknown>, fwvCombined,
					), dirtyFields, source, "weather", signal );
					msg = changed ? "Settings saved." : "No settings changed.";
					break;
				}
				case "network":
					throw new Error( "Network writes remain locked until the app can reconnect and verify the controller at its new address." );
				case "stations": {
					const changed = await verifyStationsMutation( buildStationConfig(
						v, count, source.jo.fwv, source.jn.maxlen,
					), dirtyFields, source, signal );
					msg = changed ? "Station settings saved." : "No station settings changed.";
					break;
				}
				case "program": {
					if ( count !== data.jn.snames.length ) {
						throw new Error( "Station configuration changed while this program was open. Keep the draft, or Cancel and reopen it." );
					}
					const input = buildProgramInput( v, count, fwvCombined, source.jp.pnsize );
					if ( programEditor ) {
						const formPid = selectedProgramIndex( form.dataset.pid );
						if ( formPid !== programEditor.pid ) throw new Error( "Invalid program selected for editing." );
						const sourceProgram = programEditor.source;
						// `/cp` initializes omitted date bounds to the firmware defaults, even while the range is
						// disabled. Send the stored bounds explicitly so a name-only edit remains bit-for-bit safe.
						if ( !input.dateRange ) input.dateRange = {
							enable: false, from: sourceProgram[ 6 ][ 1 ], to: sourceProgram[ 6 ][ 2 ],
						};
						const intervalClock = ( ( sourceProgram[ 0 ] >> 4 ) & 0x03 ) === 3 || input.schedule.type === "interval";
						const fresh = await readProgramsWithClock( signal, intervalClock );
						const freshProgram = fresh.jp.pd[ formPid ];
						if ( !sameProgramCollectionAtControllerDays(
							fresh.jp, fresh.day, source.jp, controllerDay( source.jc.devt ),
						) ) {
							data = { ...data, jc: fresh.jc, jp: fresh.jp };
							throw new Error( "Programs changed on the controller. Keep this draft, or Cancel to review the latest list." );
						}
						if ( !sameProgramTupleAtControllerDays(
							freshProgram, fresh.day, sourceProgram, programEditor.sourceControllerDay,
						) ) {
							data = { ...data, jc: fresh.jc, jp: fresh.jp };
							throw new Error( "This schedule changed on the controller. Keep this draft, or Cancel to review the latest version." );
						}
						// If an unchanged interval editor crossed midnight, submit the controller's current
						// relative remainder instead of shifting the schedule by resending yesterday's value.
						if ( ( ( sourceProgram[ 0 ] >> 4 ) & 0x03 ) === 3 && input.schedule.type === "interval" &&
							input.schedule.intervalDays === sourceProgram[ 2 ] && input.schedule.startingInDays === sourceProgram[ 1 ] ) {
							input.schedule.startingInDays = freshProgram![ 1 ];
						}
						if ( input.schedule.type === "interval" && controllerSecondsOfDay( fresh.jc.devt ) >= 86400 - 120 ) {
							throw new Error( "The controller day is about to change. Keep this draft and retry in a couple of minutes." );
						}
						await deps.api.submitProgram( formPid, input, signal );
						const expected = {
							...fresh.jp, pd: fresh.jp.pd.map( ( program, pid ) => pid === formPid
								? expectedProgramTuple( input, sourceProgram ) : cloneProgram( program ) ),
						};
						const verified = await readProgramsWithClock( signal, intervalClock );
						if ( !sameProgramCollectionAtControllerDays( verified.jp, verified.day, expected, fresh.day ) ) {
							data = { ...data, jc: verified.jc, jp: verified.jp };
							throw new Error( "The program was sent, but the controller did not return the saved changes. Review it before retrying." );
						}
						const saved = verified.jp.pd[ formPid ];
						programEditor = { pid: formPid, source: cloneProgram( saved! ), sourceControllerDay: verified.day };
						programDraftDirty = false;
						data = { ...data, jc: verified.jc, jp: verified.jp };
						msg = "Program updated.";
					} else {
						if ( form.dataset.pid !== "-1" ) throw new Error( "Invalid new-program form." );
						if ( !input.dateRange ) input.dateRange = { enable: false, from: 33, to: 415 };
						const fresh = await readProgramsWithClock( signal, true );
						if ( !sameProgramCollectionAtControllerDays(
							fresh.jp, fresh.day, source.jp, controllerDay( source.jc.devt ),
						) ) throw new Error( "Programs changed on the controller. Keep this draft and refresh before creating it." );
						if ( fresh.jp.nprogs >= fresh.jp.mnp ) throw new Error( "The controller program limit has been reached." );
						if ( input.schedule.type === "interval" && controllerSecondsOfDay( fresh.jc.devt ) >= 86400 - 120 ) {
							throw new Error( "The controller day is about to change. Keep this draft and retry in a couple of minutes." );
						}
						await deps.api.submitProgram( -1, input, signal );
						const emptySource: OSProgram = [ 0, 0, 0, [], [], "", [ 0, 33, 415 ] ];
						const expected = {
							...fresh.jp, nprogs: fresh.jp.nprogs + 1,
							pd: [ ...fresh.jp.pd.map( cloneProgram ), expectedProgramTuple( input, emptySource ) ],
						};
						const verified = await readProgramsWithClock( signal, true );
						if ( !sameProgramCollectionAtControllerDays( verified.jp, verified.day, expected, fresh.day ) ) {
							data = { ...data, jc: verified.jc, jp: verified.jp };
							throw new Error( "The program was sent, but the controller did not return the exact created program. Review it before retrying." );
						}
						data = { ...data, jc: verified.jc, jp: verified.jp };
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
			if ( action.dataset.action === "config-export" ) { void exportConfiguration(); return; }
			if ( action.dataset.action === "program-new" ) {
				if ( mutationInFlight ) return;
				programEditor = null; programDraftDirty = false;
				focusAfterPaint = '[name="name"]'; activeTab = "Settings"; settingsSection = "Programs"; paint(); return;
			}
			if ( action.dataset.action === "program-edit" ) {
				if ( mutationInFlight ) return;
				const pid = selectedProgramIndex( action.dataset.pid );
				const program = pid === null ? undefined : data?.jp.pd[ pid ];
				if ( pid === null || !program ) { deps.toast( "Invalid program.", true ); return; }
				if ( program[ 4 ].length !== data?.jn.snames.length ) {
					deps.toast( "Program and station data are out of sync. Refresh before editing.", true ); return;
				}
				void beginProgramEdit( pid, program ); return;
			}
			if ( action.dataset.action === "program-cancel" ) {
				if ( mutationInFlight ) return;
				if ( !discardProgramDraft() ) return;
				const pid = programEditor?.pid;
				programEditor = null; programDraftDirty = false;
				focusAfterPaint = pid === undefined ? '[data-action="program-new"]' :
					`[data-action="program-edit"][data-pid="${ pid }"]`;
				activeTab = "Programs"; paint(); return;
			}
			if ( mutationInFlight || ( interactionsAreBlocked() &&
				!EMERGENCY_ACTIONS.has( action.dataset.action ) ) ) return;
			if ( !actionAllowed( action.dataset.action ) ) {
				deps.toast( mutationLockedMessage(), true );
				return;
			}
			// "save-*" submit buttons are handled by the form submit listener.
			if ( action.type !== "submit" ) void runAction( { ...action.dataset } );
		}
	}

	function onSubmit( ev: Event ): void {
		const form = ( ev.target as HTMLElement ).closest<HTMLFormElement>( "form[data-settings]" );
		if ( !form ) return;
		ev.preventDefault();
		if ( mutationInFlight || interactionsAreBlocked() ) return;
		const permission = settingsPermission( form.dataset.settings, form.dataset.pid !== "-1" );
		if ( !permissionGranted( permission ) ) {
			deps.toast( mutationLockedMessage(), true );
			return;
		}
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

	function onVisibilityChange(): void {
		if ( disposed ) return;
		if ( hostDocument.hidden ) {
			clearPollTimer();
			automaticRefreshAbort?.abort();
			return;
		}
		clearPollTimer();
		void runAutomaticPoll( true );
	}

	deps.mount.addEventListener( "click", onClick );
	deps.mount.addEventListener( "submit", onSubmit );
	deps.mount.addEventListener( "input", noteProgramDraft );
	deps.mount.addEventListener( "change", onChange );
	deps.mount.addEventListener( "keydown", onKeydown );
	hostDocument.addEventListener( "visibilitychange", onVisibilityChange );

	void refresh();
	return {
		refresh,
		destroy(): void {
			if ( disposed ) return;
			disposed = true;
			refreshGeneration++;
			clearPollTimer();
			clearStaleTimer();
			refreshAbort?.abort();
			automaticRefreshAbort?.abort();
			mutationAbort?.abort();
			refreshAbort = null;
			automaticRefreshAbort = null;
			mutationAbort = null;
			deps.mount.removeEventListener( "click", onClick );
			deps.mount.removeEventListener( "submit", onSubmit );
			deps.mount.removeEventListener( "input", noteProgramDraft );
			deps.mount.removeEventListener( "change", onChange );
			deps.mount.removeEventListener( "keydown", onKeydown );
			hostDocument.removeEventListener( "visibilitychange", onVisibilityChange );
			deps.mount.removeAttribute( "aria-busy" );
		},
	};
}

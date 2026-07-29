// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJc, parseJe, parseJl, parseJn, parseJo, parseJp, type OsApiClient } from "../www/src/api/client";
import { encodeProgram, type ProgramInput } from "../www/src/api/encode";
import type { OSProgram } from "../www/src/api/types";
import type { DashboardData } from "../www/src/views/dashboard";
import { mountDashboard } from "../www/src/views/host";

function fixture( name: string ): unknown {
	return JSON.parse( readFileSync( resolve( process.cwd(), `test/fixtures/api/${ name }.fixture.json` ), "utf8" ) );
}

const baseline: DashboardData = {
	jc: parseJc( fixture( "jc" ) ), jo: parseJo( fixture( "jo" ) ), jn: parseJn( fixture( "jn" ) ),
	je: parseJe( fixture( "je" ) ), jp: parseJp( fixture( "jp" ) ), jl: parseJl( fixture( "jl" ) ),
};

function deferred<T>(): { promise: Promise<T>; resolve( value: T ): void } {
	let resolve!: ( value: T ) => void;
	return { promise: new Promise<T>( ( done ) => { resolve = done; } ), resolve };
}

async function flush(): Promise<void> {
	await Promise.resolve();
	await new Promise<void>( ( resolve ) => setTimeout( resolve, 0 ) );
}

async function settlePromises(): Promise<void> {
	for ( let i = 0; i < 8; i++ ) await Promise.resolve();
}

function deps( mount: HTMLElement, api: object, load: () => Promise<DashboardData> ) {
	return {
		mount, api: api as OsApiClient, load, companionBase: null,
		ctx: { prompt: () => null, confirm: () => true }, toast: vi.fn(),
	};
}

function tupleFromInput( input: ProgramInput, source: OSProgram ): OSProgram {
	const encoded = encodeProgram( input );
	const range: [ number, number, number ] = encoded.dateRange
		? [ encoded.dateRange.enable ? 1 : 0, encoded.dateRange.from, encoded.dateRange.to ]
		: [ 0, source[ 6 ][ 1 ], source[ 6 ][ 2 ] ];
	return [
		encoded.v[ 0 ] as number, encoded.v[ 1 ] as number, encoded.v[ 2 ] as number,
		( encoded.v[ 3 ] as number[] ).slice(), ( encoded.v[ 4 ] as number[] ).slice(), encoded.name, range,
	];
}

afterEach( () => {
	vi.useRealTimers();
	vi.restoreAllMocks();
} );

describe( "dashboard host concurrency", () => {
	it( "polls runtime state every four seconds and configuration every twenty seconds", async () => {
		vi.useFakeTimers();
		vi.setSystemTime( 0 );
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const load = vi.fn( async () => baseline );
		const getControllerStatus = vi.fn( async () => baseline.jc );
		const controller = mountDashboard( deps( mount, { getControllerStatus }, load ) );
		await settlePromises();

		expect( load ).toHaveBeenCalledTimes( 1 );
		await vi.advanceTimersByTimeAsync( 19_999 );
		expect( getControllerStatus ).toHaveBeenCalledTimes( 4 );
		expect( load ).toHaveBeenCalledTimes( 1 );
		await vi.advanceTimersByTimeAsync( 1 );
		expect( load ).toHaveBeenCalledTimes( 2 );
		expect( getControllerStatus ).toHaveBeenCalledTimes( 4 );

		controller.destroy();
		await vi.advanceTimersByTimeAsync( 60_000 );
		expect( load ).toHaveBeenCalledTimes( 2 );
		expect( getControllerStatus ).toHaveBeenCalledTimes( 4 );
		mount.remove();
	} );

	it( "pauses while hidden, becomes stale after twelve seconds, and refreshes immediately on resume", async () => {
		vi.useFakeTimers();
		vi.setSystemTime( 0 );
		let hidden = false;
		vi.spyOn( document, "hidden", "get" ).mockImplementation( () => hidden );
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const getControllerStatus = vi.fn( async () => baseline.jc );
		const controller = mountDashboard( deps( mount, { getControllerStatus }, async () => baseline ) );
		await settlePromises();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();

		hidden = true;
		document.dispatchEvent( new Event( "visibilitychange" ) );
		await vi.advanceTimersByTimeAsync( 12_000 );
		expect( getControllerStatus ).not.toHaveBeenCalled();
		expect( mount.textContent ).toContain( "Controller data is stale" );
		expect( mount.querySelector<HTMLButtonElement>( '[data-action="program-delete"]' )?.disabled ).toBe( true );

		hidden = false;
		document.dispatchEvent( new Event( "visibilitychange" ) );
		await settlePromises();
		expect( getControllerStatus ).toHaveBeenCalledTimes( 1 );
		expect( mount.textContent ).not.toContain( "Controller data is stale" );
		expect( mount.querySelector<HTMLButtonElement>( '[data-action="program-delete"]' )?.disabled ).toBe( false );

		controller.destroy();
		mount.remove();
	} );

	it( "backs failed controller reads off at four, eight, sixteen, then thirty seconds", async () => {
		vi.useFakeTimers();
		vi.setSystemTime( 0 );
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const attempts: number[] = [];
		let initial = true;
		let fail = true;
		const load = vi.fn( async () => {
			if ( initial ) { initial = false; return baseline; }
			attempts.push( Date.now() );
			if ( fail ) throw new Error( "offline" );
			return baseline;
		} );
		const getControllerStatus = vi.fn( async () => {
			attempts.push( Date.now() );
			if ( fail ) throw new Error( "offline" );
			return baseline.jc;
		} );
		const d = deps( mount, { getControllerStatus }, load );
		const controller = mountDashboard( d );
		await settlePromises();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();

		await vi.advanceTimersByTimeAsync( 12_000 );
		expect( attempts ).toEqual( [ 4_000, 8_000 ] );
		expect( mount.textContent ).toContain( "Controller data is stale" );
		expect( mount.querySelector<HTMLButtonElement>( '[data-action="program-delete"]' )?.disabled ).toBe( true );
		await vi.advanceTimersByTimeAsync( 20_000 );
		expect( attempts ).toEqual( [ 4_000, 8_000, 16_000, 32_000 ] );

		fail = false;
		await vi.advanceTimersByTimeAsync( 30_000 );
		expect( attempts ).toEqual( [ 4_000, 8_000, 16_000, 32_000, 62_000 ] );
		expect( mount.textContent ).not.toContain( "Controller data is stale" );
		expect( mount.querySelector<HTMLButtonElement>( '[data-action="program-delete"]' )?.disabled ).toBe( false );
		expect( d.toast ).not.toHaveBeenCalled();

		controller.destroy();
		mount.remove();
	} );

	it( "keeps a focused settings draft intact during automatic runtime refresh", async () => {
		vi.useFakeTimers();
		vi.setSystemTime( 0 );
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const load = vi.fn( async () => baseline );
		const getControllerStatus = vi.fn( async () => ( { ...baseline.jc, devt: baseline.jc.devt + 4 } ) );
		const controller = mountDashboard( deps( mount, { getControllerStatus }, load ) );
		await settlePromises();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )!.click();
		const waterLevel = mount.querySelector<HTMLInputElement>( '[name="wl"]' )!;
		waterLevel.value = "137";
		waterLevel.focus();

		await vi.advanceTimersByTimeAsync( 4_000 );
		expect( getControllerStatus ).toHaveBeenCalledTimes( 1 );
		expect( mount.querySelector<HTMLInputElement>( '[name="wl"]' ) ).toBe( waterLevel );
		expect( waterLevel.value ).toBe( "137" );
		expect( document.activeElement ).toBe( waterLevel );
		await vi.advanceTimersByTimeAsync( 16_000 );
		expect( load ).toHaveBeenCalledTimes( 2 );
		expect( mount.querySelector<HTMLInputElement>( '[name="wl"]' ) ).toBe( waterLevel );
		expect( waterLevel.value ).toBe( "137" );
		expect( document.activeElement ).toBe( waterLevel );

		controller.destroy();
		mount.remove();
	} );

	it( "discovers the optional companion only once, outside automatic polls", async () => {
		vi.useFakeTimers();
		vi.setSystemTime( 0 );
		const fetchMock = vi.spyOn( globalThis, "fetch" ).mockResolvedValue( {
			ok: false, status: 503, statusText: "Unavailable", json: async () => ( {} ),
		} as Response );
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const api = { getControllerStatus: vi.fn( async () => baseline.jc ) };
		const d = deps( mount, api, async () => baseline );
		delete ( d as { companionBase?: string | null } ).companionBase;
		const controller = mountDashboard( { ...d, companionBase: "http://localhost:8080/" } );
		await settlePromises();
		expect( fetchMock ).toHaveBeenCalledTimes( 1 );

		await vi.advanceTimersByTimeAsync( 20_000 );
		expect( fetchMock ).toHaveBeenCalledTimes( 1 );
		await controller.refresh();
		expect( fetchMock ).toHaveBeenCalledTimes( 1 );

		controller.destroy();
		mount.remove();
	} );

	it( "does not clobber an auto-managed timezone when saving another General setting", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const api = { submitOptions: vi.fn( async ( _options: Record<string, string | number> ) => ( { result: 1 } ) ) };
		const controller = mountDashboard( deps( mount, api, async () => baseline ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )!.click();
		const timezone = mount.querySelector<HTMLInputElement>( '[name="tzOffset"]' )!;
		expect( timezone.disabled ).toBe( true );
		mount.querySelector<HTMLInputElement>( '[name="wl"]' )!.value = "110";
		mount.querySelector<HTMLFormElement>( 'form[data-settings="general"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( api.submitOptions ).toHaveBeenCalledTimes( 1 );
		expect( api.submitOptions.mock.calls[ 0 ]?.[ 0 ] ).toMatchObject( { wl: 110 } );
		expect( api.submitOptions.mock.calls[ 0 ]?.[ 0 ] ).not.toHaveProperty( "tz" );
		controller.destroy();
		mount.remove();
	} );

	it( "clears Location explicitly and makes timezone manually editable after refresh", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		let current = baseline;
		const api = { submitOptions: vi.fn( async ( options: Record<string, string | number> ) => {
			current = { ...baseline, jc: { ...baseline.jc, loc: String( options.loc ) } };
			return { result: 1 };
		} ) };
		const controller = mountDashboard( deps( mount, api, async () => current ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-settings-section="Weather"]' )!.click();
		const clearLocation = mount.querySelector<HTMLInputElement>( '[name="clearLoc"]' )!;
		expect( clearLocation ).not.toBeNull();
		clearLocation.checked = true;
		mount.querySelector<HTMLFormElement>( 'form[data-settings="weather"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( api.submitOptions ).toHaveBeenCalledTimes( 1 );
		expect( api.submitOptions.mock.calls[ 0 ]?.[ 0 ] ).toMatchObject( { loc: "''" } );
		expect( mount.querySelector<HTMLInputElement>( '[name="loc"]' )?.value ).toBe( "" );
		expect( mount.querySelector<HTMLInputElement>( '[name="clearLoc"]' ) ).toBeNull();

		mount.querySelector<HTMLButtonElement>( '[data-settings-section="General"]' )!.click();
		expect( mount.querySelector<HTMLInputElement>( '[name="tzOffset"]' )?.disabled ).toBe( false );
		controller.destroy();
		mount.remove();
	} );

	it( "shows and saves multi-day adjustment only for Zimmerman or ETo", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const api = { submitOptions: vi.fn( async ( _options: Record<string, string | number> ) => ( { result: 1 } ) ) };
		const controller = mountDashboard( deps( mount, api, async () => baseline ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-settings-section="Weather"]' )!.click();

		const method = mount.querySelector<HTMLSelectElement>( '[name="method"]' )!;
		const multiDay = mount.querySelector<HTMLInputElement>( '[name="mda"]' )!;
		const multiDayGroup = multiDay.closest<HTMLFieldSetElement>( '[data-weather-methods]' )!;
		expect( multiDayGroup.hidden ).toBe( true );
		expect( multiDay.disabled ).toBe( true );

		method.value = "1";
		method.dispatchEvent( new Event( "change", { bubbles: true } ) );
		expect( multiDayGroup.hidden ).toBe( false );
		expect( multiDay.disabled ).toBe( false );
		multiDay.checked = true;
		mount.querySelector<HTMLFormElement>( 'form[data-settings="weather"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( api.submitOptions ).toHaveBeenCalledTimes( 1 );
		const options = api.submitOptions.mock.calls[ 0 ]?.[ 0 ];
		expect( options ).toMatchObject( { uwt: 1 } );
		expect( options?.wto ).toContain( '"mda":100' );
		expect( options?.wto ).toContain( '"key":""' );
		controller.destroy();
		mount.remove();
	} );

	it( "disables inactive program fields so hidden invalid values cannot block Save", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const controller = mountDashboard( deps( mount, {}, async () => baseline ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-settings-section="Programs"]' )!.click();

		const singleDate = mount.querySelector<HTMLInputElement>( '[name="singleDate"]' )!;
		const repeatFirst = mount.querySelector<HTMLInputElement>( '[name="repeatFirst"]' )!;
		const rangeFrom = mount.querySelector<HTMLInputElement>( '[name="drFrom"]' )!;
		singleDate.value = "not a date";
		repeatFirst.value = "not a time";
		rangeFrom.value = "not a date";
		expect( singleDate.disabled ).toBe( true );
		expect( repeatFirst.disabled ).toBe( true );
		expect( rangeFrom.disabled ).toBe( true );
		expect( mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!.checkValidity() ).toBe( true );

		const schedule = mount.querySelector<HTMLSelectElement>( '[name="schedType"]' )!;
		schedule.value = "singlerun";
		schedule.dispatchEvent( new Event( "change", { bubbles: true } ) );
		expect( singleDate.disabled ).toBe( false );
		expect( mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!.checkValidity() ).toBe( false );

		const useRange = mount.querySelector<HTMLInputElement>( '[name="useDateRange"]' )!;
		useRange.checked = true;
		useRange.dispatchEvent( new Event( "change", { bubbles: true } ) );
		expect( rangeFrom.disabled ).toBe( false );
		controller.destroy();
		mount.remove();
	} );

	it( "aborts a superseded refresh instead of only ignoring its completion", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const newer = deferred<DashboardData>();
		const signals: AbortSignal[] = [];
		let calls = 0;
		const controller = mountDashboard( deps( mount, {}, ( signal?: AbortSignal ) => {
			signals.push( signal! );
			calls++;
			if ( calls === 1 ) return new Promise<DashboardData>( ( _resolve, reject ) => {
				signal?.addEventListener( "abort", () => reject( new DOMException( "Aborted", "AbortError" ) ), { once: true } );
			} );
			return newer.promise;
		} ) );
		const current = controller.refresh();
		expect( signals[ 0 ]?.aborted ).toBe( true );
		newer.resolve( baseline );
		await current;
		expect( signals[ 1 ]?.aborted ).toBe( false );
		controller.destroy();
		mount.remove();
	} );

	it( "ignores a superseded refresh that resolves after the newer one", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const older = deferred<DashboardData>(), newer = deferred<DashboardData>();
		let calls = 0;
		const controller = mountDashboard( deps( mount, {}, () => ++calls === 1 ? older.promise : newer.promise ) );
		const current = controller.refresh();
		newer.resolve( { ...baseline, jc: { ...baseline.jc, dname: "NEW" } } );
		await current;
		expect( mount.textContent ).toContain( "NEW" );
		older.resolve( { ...baseline, jc: { ...baseline.jc, dname: "STALE" } } );
		await flush();
		expect( mount.textContent ).toContain( "NEW" );
		expect( mount.textContent ).not.toContain( "STALE" );
		controller.destroy();
		mount.remove();
	} );

	it( "serializes destructive actions and disables replacement controls while pending", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const pending = deferred<Record<string, unknown>>();
		const api = { deleteProgram: vi.fn( () => pending.promise ) };
		const controller = mountDashboard( deps( mount, api, async () => baseline ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-delete"]' )!.click();
		const replacement = mount.querySelector<HTMLButtonElement>( '[data-action="program-delete"]' )!;
		expect( replacement.disabled ).toBe( true );
		replacement.dispatchEvent( new MouseEvent( "click", { bubbles: true } ) );
		expect( api.deleteProgram ).toHaveBeenCalledTimes( 1 );
		pending.resolve( { result: 1 } );
		await flush();
		expect( api.deleteProgram ).toHaveBeenCalledTimes( 1 );
		controller.destroy();
		mount.remove();
	} );

	it( "keeps stale controls disabled but exposes a usable retry after refresh failure", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		let fail = false;
		const controller = mountDashboard( deps( mount, {}, async () => {
			if ( fail ) throw new Error( "offline" );
			return baseline;
		} ) );
		await flush();
		fail = true;
		await controller.refresh();
		expect( mount.querySelector<HTMLButtonElement>( '[data-action="retry"]' )?.disabled ).toBe( false );
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		expect( mount.querySelector<HTMLButtonElement>( '[data-action="program-delete"]' )?.disabled ).toBe( true );
		controller.destroy();
		mount.remove();
	} );

	it( "serializes settings submits and destroy removes all delegated behavior", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const pending = deferred<Record<string, unknown>>();
		const api = { submitProgram: vi.fn( () => pending.promise ) };
		const controller = mountDashboard( deps( mount, api, async () => baseline ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-settings-section="Programs"]' )!.click();
		mount.querySelector<HTMLInputElement>( '[name="dur_0"]' )!.value = "5";
		const form = mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!;
		form.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		const replacement = mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!;
		expect( replacement.querySelector<HTMLButtonElement>( "button[type=submit]" )!.disabled ).toBe( true );
		replacement.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		expect( api.submitProgram ).toHaveBeenCalledTimes( 1 );
		pending.resolve( { result: 1 } );
		await flush();
		controller.destroy();
		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )?.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		expect( api.submitProgram ).toHaveBeenCalledTimes( 1 );
		mount.remove();
	} );

	it( "aborts a pending mutation on destroy without surfacing a stale error", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		let mutationSignal: AbortSignal | undefined;
		const api = { deleteProgram: vi.fn( ( _pid: number, signal?: AbortSignal ) => {
			mutationSignal = signal;
			return new Promise<Record<string, unknown>>( ( _resolve, reject ) => {
				signal?.addEventListener( "abort", () => reject( new DOMException( "Aborted", "AbortError" ) ), { once: true } );
			} );
		} ) };
		const d = deps( mount, api, async () => baseline );
		const controller = mountDashboard( d );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-delete"]' )!.click();
		expect( mutationSignal?.aborted ).toBe( false );
		controller.destroy();
		expect( mutationSignal?.aborted ).toBe( true );
		await flush();
		expect( d.toast ).not.toHaveBeenCalled();
		mount.remove();
	} );

	it( "preserves a program draft when local validation rejects submission", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const api = { submitProgram: vi.fn() };
		const controller = mountDashboard( deps( mount, api, async () => baseline ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-settings-section="Programs"]' )!.click();
		const name = mount.querySelector<HTMLInputElement>( '[name="name"]' )!;
		name.value = "Keep this unsaved draft";
		const form = mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!;
		form.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( api.submitProgram ).not.toHaveBeenCalled();
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' )?.value ).toBe( "Keep this unsaved draft" );
		expect( mount.querySelector<HTMLButtonElement>( "button[type=submit]" )?.disabled ).toBe( false );
		controller.destroy();
		mount.remove();
	} );

	it( "opens an existing program, preserves its raw values, and saves to its real program id", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		let current = baseline;
		const getPrograms = vi.fn( async () => current.jp );
		const submitProgram = vi.fn( async ( pid: number, input: ProgramInput ) => {
			const source = current.jp.pd[ pid ]!;
			const pd = current.jp.pd.slice();
			pd[ pid ] = tupleFromInput( input, source );
			current = { ...current, jp: { ...current.jp, pd } };
			return { result: 1 };
		} );
		const d = deps( mount, { getControllerStatus: vi.fn( async () => current.jc ), getPrograms, submitProgram }, async () => current );
		const controller = mountDashboard( d );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();

		expect( mount.querySelector( "h2" )?.textContent ).toBe( "Edit Program" );
		expect( mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )?.dataset.pid ).toBe( "0" );
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' )?.value ).toBe( "Morning Watering" );
		expect( mount.querySelector<HTMLInputElement>( '[name="enabled"]' )?.checked ).toBe( true );
		expect( mount.querySelector<HTMLInputElement>( '[name="t_1"]' )?.value ).toBe( "Sunrise +30m" );
		expect( mount.querySelector<HTMLSelectElement>( '[name="durMode_2"]' )?.value ).toBe( "sunrise-sunset" );
		expect( mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )?.checkValidity() ).toBe( true );

		mount.querySelector<HTMLInputElement>( '[name="name"]' )!.value = "Updated Watering";
		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( submitProgram ).toHaveBeenCalledTimes( 1 );
		expect( submitProgram.mock.calls[ 0 ]?.[ 0 ] ).toBe( 0 );
		expect( submitProgram.mock.calls[ 0 ]?.[ 1 ].durations ).toEqual( baseline.jp.pd[ 0 ]![ 4 ] );
		expect( encodeProgram( submitProgram.mock.calls[ 0 ]![ 1 ] ).v[ 3 ] ).toEqual( baseline.jp.pd[ 0 ]![ 3 ] );
		expect( getPrograms ).toHaveBeenCalledTimes( 2 );
		expect( d.toast ).toHaveBeenCalledWith( "Program updated." );
		controller.destroy();
		mount.remove();
	} );

	it( "cancels editing and opens a clean new-program form", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const controller = mountDashboard( deps( mount, {}, async () => baseline ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' )?.value ).toBe( "Morning Watering" );
		mount.querySelector<HTMLButtonElement>( '[data-action="program-cancel"]' )!.click();
		expect( mount.querySelector<HTMLButtonElement>( '[data-action="program-new"]' ) ).not.toBeNull();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-new"]' )!.click();
		expect( mount.querySelector( "h2" )?.textContent ).toBe( "New Program" );
		expect( mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )?.dataset.pid ).toBe( "-1" );
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' )?.value ).toBe( "" );
		controller.destroy();
		mount.remove();
	} );

	it( "keeps a dirty program draft when navigation discard is rejected", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const confirm = vi.fn( () => false );
		const d = deps( mount, {}, async () => baseline );
		d.ctx.confirm = confirm;
		const controller = mountDashboard( d );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		const name = mount.querySelector<HTMLInputElement>( '[name="name"]' )!;
		name.value = "Keep this unsaved name";
		name.dispatchEvent( new Event( "input", { bubbles: true } ) );

		mount.querySelector<HTMLButtonElement>( '[data-tab="Weather"]' )!.click();

		expect( confirm ).toHaveBeenCalledWith( "Discard your unsaved program changes?" );
		expect( mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )?.getAttribute( "aria-selected" ) ).toBe( "true" );
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' ) ).toBe( name );
		expect( name.value ).toBe( "Keep this unsaved name" );
		controller.destroy();
		mount.remove();
	} );

	it( "discards a dirty program draft when navigation discard is confirmed", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const confirm = vi.fn( () => true );
		const d = deps( mount, {}, async () => baseline );
		d.ctx.confirm = confirm;
		const controller = mountDashboard( d );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		const name = mount.querySelector<HTMLInputElement>( '[name="name"]' )!;
		name.value = "Discard this name";
		name.dispatchEvent( new Event( "input", { bubbles: true } ) );

		mount.querySelector<HTMLButtonElement>( '[data-tab="Weather"]' )!.click();

		expect( confirm ).toHaveBeenCalledWith( "Discard your unsaved program changes?" );
		expect( mount.querySelector<HTMLButtonElement>( '[data-tab="Weather"]' )?.getAttribute( "aria-selected" ) ).toBe( "true" );
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' ) ).toBeNull();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )!.click();
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' )?.value ).toBe( "Morning Watering" );
		controller.destroy();
		mount.remove();
	} );

	it( "preserves a program input edited while a refresh is pending", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const pending = deferred<DashboardData>();
		let loads = 0;
		const controller = mountDashboard( deps( mount, {}, () => {
			loads++;
			return loads === 1 ? Promise.resolve( baseline ) : pending.promise;
		} ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();

		const refreshing = controller.refresh();
		const name = mount.querySelector<HTMLInputElement>( '[name="name"]' )!;
		name.value = "Edited after refresh started";
		name.dispatchEvent( new Event( "input", { bubbles: true } ) );
		pending.resolve( baseline );
		await refreshing;

		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' ) ).toBe( name );
		expect( name.value ).toBe( "Edited after refresh started" );
		controller.destroy();
		mount.remove();
	} );

	it( "closes a clean editor when the refreshed station count no longer matches", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		let current = baseline;
		const controller = mountDashboard( deps( mount, {}, async () => current ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();

		const source = baseline.jp.pd[ 0 ]!;
		const expandedProgram: OSProgram = [
			source[ 0 ], source[ 1 ], source[ 2 ], source[ 3 ].slice(),
			[ ...source[ 4 ], ...Array( 8 ).fill( 0 ) ], source[ 5 ], [ ...source[ 6 ] ],
		];
		current = {
			...baseline,
			jn: { ...baseline.jn, snames: [ ...baseline.jn.snames, ...Array.from( { length: 8 }, ( _, i ) => `Extra ${ i + 1 }` ) ] },
			jp: { ...baseline.jp, nboards: 2, pd: [ expandedProgram ] },
		};
		await controller.refresh();

		expect( mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )?.getAttribute( "aria-selected" ) ).toBe( "true" );
		expect( mount.querySelector( 'form[data-settings="program"]' ) ).toBeNull();
		expect( mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' ) ).not.toBeNull();
		expect( mount.textContent ).not.toContain( "Unable to render controller data" );
		controller.destroy();
		mount.remove();
	} );

	it( "keeps but will not submit a dirty draft after the station count changes", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		let current = baseline;
		const api = { getPrograms: vi.fn(), submitProgram: vi.fn() };
		const controller = mountDashboard( deps( mount, api, async () => current ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		const name = mount.querySelector<HTMLInputElement>( '[name="name"]' )!;
		name.value = "Keep after station refresh";
		name.dispatchEvent( new Event( "input", { bubbles: true } ) );

		const source = baseline.jp.pd[ 0 ]!;
		current = {
			...baseline,
			jn: { ...baseline.jn, snames: [ ...baseline.jn.snames, ...Array.from( { length: 8 }, ( _, i ) => `Extra ${ i + 1 }` ) ] },
			jp: { ...baseline.jp, nboards: 2, pd: [ [
				source[ 0 ], source[ 1 ], source[ 2 ], source[ 3 ].slice(),
				[ ...source[ 4 ], ...Array( 8 ).fill( 0 ) ], source[ 5 ], [ ...source[ 6 ] ],
			] ] },
		};
		await controller.refresh();
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' ) ).toBe( name );

		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( api.getPrograms ).not.toHaveBeenCalled();
		expect( api.submitProgram ).not.toHaveBeenCalled();
		expect( name.value ).toBe( "Keep after station refresh" );
		controller.destroy();
		mount.remove();
	} );

	it( "focuses the program name for editing and restores focus to its Edit button on cancel", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const controller = mountDashboard( deps( mount, {}, async () => baseline ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"][data-pid="0"]' )!.click();

		const name = mount.querySelector<HTMLInputElement>( '[name="name"]' )!;
		expect( document.activeElement ).toBe( name );
		mount.querySelector<HTMLButtonElement>( '[data-action="program-cancel"]' )!.click();

		const edit = mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"][data-pid="0"]' )!;
		expect( document.activeElement ).toBe( edit );
		controller.destroy();
		mount.remove();
	} );

	it( "pairs an interval source with a fresh controller day when opening near midnight", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const source: OSProgram = [
			( 3 << 4 ) | ( 1 << 6 ), 2, 5, [ 360, -1, -1, -1 ],
			[ 60, 0, 0, 0, 0, 0, 0, 0 ], "Interval", [ 0, 33, 415 ],
		];
		const fresh: OSProgram = [
			source[ 0 ], 1, source[ 2 ], source[ 3 ].slice(), source[ 4 ].slice(), source[ 5 ], [ ...source[ 6 ] ],
		];
		const day = Math.floor( baseline.jc.devt / 86400 );
		const nearStart = { ...baseline.jc, devt: day * 86400 + 5 };
		const initial: DashboardData = {
			...baseline, jc: nearStart, jp: { ...baseline.jp, pd: [ source ], nprogs: 1 },
		};
		const api = {
			getControllerStatus: vi.fn( async () => nearStart ),
			getPrograms: vi.fn( async () => ( { ...initial.jp, pd: [ fresh ] } ) ),
		};
		const controller = mountDashboard( deps( mount, api, async () => initial ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		await flush();

		expect( mount.querySelector( "h2" )?.textContent ).toBe( "Edit Program" );
		expect( mount.querySelector<HTMLInputElement>( '[name="startingInDays"]' )?.value ).toBe( "1" );
		expect( document.activeElement ).toBe( mount.querySelector<HTMLInputElement>( '[name="name"]' ) );
		expect( api.getControllerStatus ).toHaveBeenCalledTimes( 2 );
		expect( api.getPrograms ).toHaveBeenCalledTimes( 1 );
		controller.destroy();
		mount.remove();
	} );

	it( "keeps a stale draft until Cancel, then shows and reopens the latest program", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const changed = { ...baseline.jp, pd: baseline.jp.pd.map( ( program, pid ) =>
			pid === 0 ? [ ...program.slice( 0, 5 ), "Changed elsewhere", [ ...program[ 6 ] ] ] as OSProgram : program ) };
		const api = {
			getControllerStatus: vi.fn( async () => baseline.jc ),
			getPrograms: vi.fn( async () => changed ),
			submitProgram: vi.fn( async () => ( { result: 1 } ) ),
		};
		const d = deps( mount, api, async () => baseline );
		const controller = mountDashboard( d );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		const name = mount.querySelector<HTMLInputElement>( '[name="name"]' )!;
		name.value = "Keep my draft";
		name.dispatchEvent( new Event( "input", { bubbles: true } ) );
		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( api.submitProgram ).not.toHaveBeenCalled();
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' )?.value ).toBe( "Keep my draft" );
		expect( d.toast ).toHaveBeenCalledWith( expect.stringMatching( /changed on the controller/i ), true );

		mount.querySelector<HTMLButtonElement>( '[data-action="program-cancel"]' )!.click();
		expect( mount.textContent ).toContain( "Changed elsewhere" );
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"][data-pid="0"]' )!.click();
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' )?.value ).toBe( "Changed elsewhere" );
		expect( api.getPrograms ).toHaveBeenCalledTimes( 1 );
		controller.destroy();
		mount.remove();
	} );

	it( "does not report success when the post-write program does not match", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const api = {
			getControllerStatus: vi.fn( async () => baseline.jc ),
			getPrograms: vi.fn( async () => baseline.jp ),
			submitProgram: vi.fn( async () => ( { result: 1 } ) ),
		};
		const d = deps( mount, api, async () => baseline );
		const controller = mountDashboard( d );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		mount.querySelector<HTMLInputElement>( '[name="name"]' )!.value = "Unverified draft";
		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( api.submitProgram ).toHaveBeenCalledTimes( 1 );
		expect( mount.querySelector<HTMLInputElement>( '[name="name"]' )?.value ).toBe( "Unverified draft" );
		expect( d.toast ).not.toHaveBeenCalledWith( "Program updated." );
		expect( d.toast ).toHaveBeenCalledWith( expect.stringMatching( /did not return the saved changes/i ), true );
		controller.destroy();
		mount.remove();
	} );

	it( "round-trips every raw duration word during a name-only edit", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const rawDurations = [ 1, 59, 60, 61, 90, 65533, 65534, 65535 ];
		const source: OSProgram = [ 65, 1, 0, [ 360, -1, -1, -1 ], rawDurations, "Raw durations", [ 0, 33, 33 ] ];
		let current: DashboardData = { ...baseline, jp: { ...baseline.jp, pd: [ source ], nprogs: 1 } };
		const submitProgram = vi.fn( async ( pid: number, input: ProgramInput ) => {
			current = { ...current, jp: { ...current.jp, pd: [ tupleFromInput( input, source ) ] } };
			return { result: 1 };
		} );
		const api = {
			getControllerStatus: vi.fn( async () => current.jc ),
			getPrograms: vi.fn( async () => current.jp ), submitProgram,
		};
		const controller = mountDashboard( deps( mount, api, async () => current ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		mount.querySelector<HTMLInputElement>( '[name="name"]' )!.value = "Renamed only";
		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( submitProgram.mock.calls[ 0 ]?.[ 1 ].durations ).toEqual( rawDurations );
		expect( submitProgram.mock.calls[ 0 ]?.[ 1 ].dateRange ).toEqual( { enable: false, from: 33, to: 33 } );
		controller.destroy();
		mount.remove();
	} );

	it( "rebases an unchanged interval schedule across controller midnight", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const source: OSProgram = [
			( 3 << 4 ) | ( 1 << 6 ) | 1, 2, 5, [ 360, -1, -1, -1 ],
			[ 60, 0, 0, 0, 0, 0, 0, 0 ], "Interval", [ 0, 33, 415 ],
		];
		const initial: DashboardData = { ...baseline, jp: { ...baseline.jp, pd: [ source ], nprogs: 1 } };
		let submitted: ProgramInput | undefined;
		let reads = 0;
		const getPrograms = vi.fn( async () => {
			const read = reads++;
			if ( read === 0 ) return { ...initial.jp, pd: [ source ] };
			if ( read === 1 ) {
				const fresh: OSProgram = [
					source[ 0 ], 1, source[ 2 ], source[ 3 ].slice(), source[ 4 ].slice(), source[ 5 ], [ ...source[ 6 ] ],
				];
				return { ...initial.jp, pd: [ fresh ] };
			}
			const verified = tupleFromInput( submitted!, source );
			verified[ 1 ] = 0;
			return { ...initial.jp, pd: [ verified ] };
		} );
		const initialDay = Math.floor( baseline.jc.devt / 86400 );
		const getControllerStatus = vi.fn()
			// The first bracket crosses midnight, forcing `/jp` to be sampled again on the new day.
			.mockResolvedValueOnce( { ...baseline.jc, devt: initialDay * 86400 + 86399 } )
			.mockResolvedValueOnce( { ...baseline.jc, devt: ( initialDay + 1 ) * 86400 + 1 } )
			.mockResolvedValueOnce( { ...baseline.jc, devt: ( initialDay + 1 ) * 86400 + 2 } )
			// The verified response is another day later; stable comparison must still succeed.
			.mockResolvedValueOnce( { ...baseline.jc, devt: ( initialDay + 2 ) * 86400 + 48000 } )
			.mockResolvedValueOnce( { ...baseline.jc, devt: ( initialDay + 2 ) * 86400 + 48001 } );
		const submitProgram = vi.fn( async ( _pid: number, input: ProgramInput ) => {
			submitted = input;
			return { result: 1 };
		} );
		const d = deps( mount, { getControllerStatus, getPrograms, submitProgram }, async () => initial );
		const controller = mountDashboard( d );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		const name = mount.querySelector<HTMLInputElement>( '[name="name"]' )!;
		name.value = "Interval renamed";
		name.dispatchEvent( new Event( "input", { bubbles: true } ) );
		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();

		expect( submitProgram ).toHaveBeenCalledTimes( 1 );
		expect( submitted?.schedule ).toEqual( { type: "interval", intervalDays: 5, startingInDays: 1 } );
		expect( getControllerStatus ).toHaveBeenCalledTimes( 5 );
		expect( getPrograms ).toHaveBeenCalledTimes( 3 );
		expect( d.toast ).toHaveBeenCalledWith( "Program updated." );
		controller.destroy();
		mount.remove();
	} );

	it( "defers an interval save that is too close to controller midnight", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const source: OSProgram = [
			( 3 << 4 ) | ( 1 << 6 ), 2, 5, [ 360, -1, -1, -1 ],
			[ 60, 0, 0, 0, 0, 0, 0, 0 ], "Interval", [ 0, 33, 415 ],
		];
		const initial: DashboardData = { ...baseline, jp: { ...baseline.jp, pd: [ source ], nprogs: 1 } };
		const day = Math.floor( baseline.jc.devt / 86400 );
		const nearMidnight = { ...baseline.jc, devt: day * 86400 + 86300 };
		const api = {
			getControllerStatus: vi.fn( async () => nearMidnight ),
			getPrograms: vi.fn( async () => initial.jp ),
			submitProgram: vi.fn(),
		};
		const d = deps( mount, api, async () => initial );
		const controller = mountDashboard( d );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		const name = mount.querySelector<HTMLInputElement>( '[name="name"]' )!;
		name.value = "Keep until tomorrow";
		name.dispatchEvent( new Event( "input", { bubbles: true } ) );
		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();

		expect( api.submitProgram ).not.toHaveBeenCalled();
		expect( name.value ).toBe( "Keep until tomorrow" );
		expect( d.toast ).toHaveBeenCalledWith( expect.stringMatching( /day is about to change/i ), true );
		controller.destroy();
		mount.remove();
	} );

	it( "defers a new interval program that is too close to controller midnight", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const day = Math.floor( baseline.jc.devt / 86400 );
		const api = {
			getControllerStatus: vi.fn( async () => ( { ...baseline.jc, devt: day * 86400 + 86300 } ) ),
			submitProgram: vi.fn(),
		};
		const d = deps( mount, api, async () => baseline );
		const controller = mountDashboard( d );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Settings"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-settings-section="Programs"]' )!.click();
		const schedule = mount.querySelector<HTMLSelectElement>( '[name="schedType"]' )!;
		schedule.value = "interval";
		schedule.dispatchEvent( new Event( "change", { bubbles: true } ) );
		mount.querySelector<HTMLInputElement>( '[name="dur_0"]' )!.value = "5";
		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();

		expect( api.submitProgram ).not.toHaveBeenCalled();
		expect( d.toast ).toHaveBeenCalledWith( expect.stringMatching( /day is about to change/i ), true );
		controller.destroy();
		mount.remove();
	} );

	it( "does not turn repeat count/interval words into clock starts when switching to fixed times", async () => {
		const mount = document.createElement( "div" );
		document.body.appendChild( mount );
		const source: OSProgram = [ 0, 1, 0, [ 360, 3, 60, 0 ], [ 60, 0, 0, 0, 0, 0, 0, 0 ], "Repeat", [ 0, 33, 415 ] ];
		let current: DashboardData = { ...baseline, jp: { ...baseline.jp, pd: [ source ], nprogs: 1 } };
		const submitProgram = vi.fn( async ( _pid: number, input: ProgramInput ) => {
			current = { ...current, jp: { ...current.jp, pd: [ tupleFromInput( input, source ) ] } };
			return { result: 1 };
		} );
		const api = {
			getControllerStatus: vi.fn( async () => current.jc ),
			getPrograms: vi.fn( async () => current.jp ), submitProgram,
		};
		const controller = mountDashboard( deps( mount, api, async () => current ) );
		await flush();
		mount.querySelector<HTMLButtonElement>( '[data-tab="Programs"]' )!.click();
		mount.querySelector<HTMLButtonElement>( '[data-action="program-edit"]' )!.click();
		const startType = mount.querySelector<HTMLSelectElement>( '[name="startType"]' )!;
		startType.value = "fixed";
		startType.dispatchEvent( new Event( "change", { bubbles: true } ) );
		expect( mount.querySelector<HTMLInputElement>( '[name="t_1"]' )?.value ).toBe( "" );
		mount.querySelector<HTMLFormElement>( 'form[data-settings="program"]' )!
			.dispatchEvent( new Event( "submit", { bubbles: true, cancelable: true } ) );
		await flush();
		expect( submitProgram.mock.calls[ 0 ]?.[ 1 ].start ).toEqual( { type: "fixed", times: [
			{ kind: "time", minutes: 360 }, { kind: "off" }, { kind: "off" }, { kind: "off" },
		] } );
		controller.destroy();
		mount.remove();
	} );
} );

/**
 * Action dispatcher — interprets a clicked control's `data-action` (+ data-sid / data-pid) and runs
 * the matching typed command. The single brain for write/control affordances, kept framework-free
 * and testable: the host passes the element's dataset, the current data, and an injectable
 * prompt/confirm context; this returns a human status string (or null when cancelled) and throws
 * (CommandError) on device failure for the host to surface.
 */
import type { OsApiClient } from "../api/client";
import type { JpResponse } from "../api/types";

export interface ActionContext {
	prompt( message: string, def?: string ): string | null;
	confirm( message: string ): boolean;
}
export interface ActionData { jp: JpResponse; stationCount: number; }
export type ActionDataset = Record<string, string | undefined>;

function requireIndex( value: string | undefined, label: string ): number {
	if ( value === undefined || !/^\d+$/.test( value ) ) throw new Error( `Invalid ${ label }.` );
	const index = Number( value );
	if ( !Number.isSafeInteger( index ) ) throw new Error( `Invalid ${ label }.` );
	return index;
}

export async function dispatchAction(
	api: OsApiClient, data: ActionData, ds: ActionDataset, ctx: ActionContext, signal?: AbortSignal,
): Promise<string | null> {
	switch ( ds.action ) {
		case "stop-all":
			await api.stopAllStations( signal );
			return "All stations stopped.";
		case "toggle-enable": {
			const enable = ds.enabled !== "1";
			await api.setControllerEnabled( enable, signal );
			return enable ? "Controller enabled." : "Controller disabled.";
		}
		case "rain-delay": {
			const h = ctx.prompt( "Rain delay in hours (0 to cancel):", "6" );
			if ( h === null ) return null;
			const input = h.trim();
			if ( input === "" ) throw new Error( "Enter a positive whole number of hours, or 0 to cancel." );
			const hours = Number( input );
			if ( hours === 0 ) {
				await api.cancelRainDelay( signal );
				return "Rain delay cancelled.";
			}
			if ( !Number.isSafeInteger( hours ) || hours < 1 || hours > 8760 ) {
				throw new Error( "Enter a whole number of hours from 1 to 8760, or 0 to cancel." );
			}
			await api.setRainDelayHours( hours, signal );
			return `Rain delay set to ${ hours }h.`;
		}
		case "cancel-rain":
			await api.cancelRainDelay( signal );
			return "Rain delay cancelled.";
		case "reboot":
			if ( !ctx.confirm( "Reboot the controller now?" ) ) return null;
			if ( ( await api.reboot( signal ) ).unverified === true ) {
				return "The reboot may have started; the controller disconnected before it could confirm.";
			}
			return "Rebooting…";
		case "clear-ocs":
			await api.clearOvercurrent( signal );
			return "Overcurrent alert cleared.";
		case "station-start": {
			const sid = requireIndex( ds.sid, "station" );
			if ( sid >= data.stationCount ) throw new Error( "Invalid station." );
			const m = ctx.prompt( "Run this station for how many minutes?", "5" );
			if ( m === null ) return null;
			const mins = Number( m.trim() );
			const seconds = Math.round( mins * 60 );
			if ( !Number.isFinite( mins ) || mins <= 0 || mins > 1080 || !Number.isSafeInteger( seconds ) || seconds < 1 || seconds > 64800 ) {
				throw new Error( "Enter a positive number of minutes up to 1080." );
			}
			await api.startStation( sid, seconds, signal );
			return `Station ${ sid + 1 } started for ${ mins } min.`;
		}
		case "station-stop": {
			const sid = requireIndex( ds.sid, "station" );
			if ( sid >= data.stationCount ) throw new Error( "Invalid station." );
			await api.stopStation( sid, signal );
			return `Station ${ sid + 1 } stopped.`;
		}
		case "program-run": {
			const pid = requireIndex( ds.pid, "program" );
			const p = data.jp.pd[ pid ];
			if ( !p ) throw new Error( "Invalid program." );
			if ( !ctx.confirm( `Run “${ p[ 5 ] || `Program ${ pid + 1 }` }” now? It will be appended to the current watering queue.` ) ) return null;
			await api.runProgramNow( pid, p, 0, signal );
			return `Program ${ pid + 1 } added to the watering queue.`;
		}
		case "program-toggle": {
			const pid = requireIndex( ds.pid, "program" );
			const p = data.jp.pd[ pid ];
			if ( !p ) throw new Error( "Invalid program." );
			const enable = ds.enabled !== "1";
			await api.setProgramEnabled( pid, p, enable, signal );
			return enable ? "Program enabled." : "Program disabled.";
		}
		case "program-delete": {
			const pid = requireIndex( ds.pid, "program" );
			if ( !data.jp.pd[ pid ] ) throw new Error( "Invalid program." );
			if ( !ctx.confirm( "Delete this program?" ) ) return null;
			await api.deleteProgram( pid, signal );
			return "Program deleted.";
		}
		default:
			return null;
	}
}

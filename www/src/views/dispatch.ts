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
export interface ActionData { jp: JpResponse; }
export type ActionDataset = Record<string, string | undefined>;

export async function dispatchAction(
	api: OsApiClient, data: ActionData, ds: ActionDataset, ctx: ActionContext,
): Promise<string | null> {
	const sid = ds.sid !== undefined ? parseInt( ds.sid, 10 ) : -1;
	const pid = ds.pid !== undefined ? parseInt( ds.pid, 10 ) : -1;

	switch ( ds.action ) {
		case "stop-all":
			await api.stopAllStations();
			return "All stations stopped.";
		case "toggle-enable": {
			const enable = ds.enabled !== "1";
			await api.setControllerEnabled( enable );
			return enable ? "Controller enabled." : "Controller disabled.";
		}
		case "rain-delay": {
			const h = ctx.prompt( "Rain delay in hours (0 to cancel):", "6" );
			if ( h === null ) return null;
			const hours = parseFloat( h );
			await api.setRainDelayHours( Number.isFinite( hours ) && hours > 0 ? hours : 0 );
			return hours > 0 ? `Rain delay set to ${ hours }h.` : "Rain delay cancelled.";
		}
		case "cancel-rain":
			await api.cancelRainDelay();
			return "Rain delay cancelled.";
		case "reboot":
			if ( !ctx.confirm( "Reboot the controller now?" ) ) return null;
			await api.reboot();
			return "Rebooting…";
		case "clear-ocs":
			await api.clearOvercurrent();
			return "Overcurrent alert cleared.";
		case "station-start": {
			const m = ctx.prompt( "Run this station for how many minutes?", "5" );
			if ( m === null ) return null;
			const mins = parseFloat( m );
			if ( !Number.isFinite( mins ) || mins <= 0 ) return null;
			await api.startStation( sid, Math.round( mins * 60 ) );
			return `Station ${ sid + 1 } started for ${ mins } min.`;
		}
		case "station-stop":
			await api.stopStation( sid );
			return `Station ${ sid + 1 } stopped.`;
		case "program-run": {
			const p = data.jp.pd[ pid ];
			if ( !p ) return null;
			await api.runProgramNow( p );
			return `Running program ${ pid + 1 } now.`;
		}
		case "program-toggle": {
			const p = data.jp.pd[ pid ];
			if ( !p ) return null;
			const enable = ds.enabled !== "1";
			await api.setProgramEnabled( pid, p, enable );
			return enable ? "Program enabled." : "Program disabled.";
		}
		case "program-delete": {
			if ( !ctx.confirm( "Delete this program?" ) ) return null;
			await api.deleteProgram( pid );
			return "Program deleted.";
		}
		default:
			return null;
	}
}

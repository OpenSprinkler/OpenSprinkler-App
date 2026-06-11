/**
 * Action-button primitives for the interactive views. A button carries a `data-action` (+ optional
 * data-sid/data-pid/data-enabled) that the host feeds to dispatchAction(). Framework-free strings;
 * the host wires a single delegated click listener.
 */
import { esc } from "./help";

export function actionButton(
	action: string, label: string, data: Record<string, string | number | boolean> = {}, cls = "",
): string {
	const attrs = Object.entries( data )
		.map( ( [ k, v ] ) => ` data-${ esc( k ) }="${ esc( String( v ) ) }"` ).join( "" );
	return `<button type="button" class="action${ cls ? " " + cls : "" }" ` +
		`data-action="${ esc( action ) }"${ attrs }>${ esc( label ) }</button>`;
}

export function actionBar( buttons: string ): string {
	return `<div class="action-bar" role="group" aria-label="Controls">${ buttons }</div>`;
}

/** Read-only system identity and safe export entrypoint. Controller mutations live elsewhere. */
import type { JcResponse, JoResponse } from "../../api/types";
import { otcStatus } from "../../api/diagnostics";
import { actionBar, actionButton } from "../../ui/controls";
import { esc, infoNote } from "../../ui/help";

export function renderSystemSettings( jc: JcResponse, jo: JoResponse ): string {
	const build = `${ jo.fwv }/${ jo.fwm }${ jo.fwf ? ` · ${ jo.fwf }` : "" }`;
	const cloud = typeof jc.otcs === "number" ? otcStatus( jc.otcs ).text : "Not reported";
	return `<section aria-label="System settings">` +
		`<h2>System</h2>` +
		`<table class="status"><tbody>` +
		`<tr><th scope="row">Firmware build</th><td>${ esc( build ) }</td></tr>` +
		`<tr><th scope="row">Hardware version</th><td>${ esc( String( jo.hwv ) ) }</td></tr>` +
		`<tr><th scope="row">OpenThings Cloud</th><td>${ esc( cloud ) }</td></tr>` +
		`</tbody></table>` +
		`<h3>Configuration export</h3>` +
		infoNote( "Creates a read-only, versioned JSON snapshot of controller, station, and schedule settings. " +
			"Passwords, tokens, provider keys, request URLs, and opaque special-output definitions are excluded." ) +
		actionBar( actionButton( "config-export", "Export configuration", {}, "primary" ) ) +
		`<p class="muted">Import remains available only in the frozen legacy UI until a verified restore workflow exists.</p>` +
		`</section>`;
}

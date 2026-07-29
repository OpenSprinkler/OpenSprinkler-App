/**
 * Device login UI — md5 password prompt, ported from the legacy www/js/home.js flow.
 * Uses the seam's version-gated authenticate() (md5 for fwv>=213, legacy cleartext below that).
 * Returns the validated pwHash to attach to the authenticated seam.
 */
import { BrowserDeviceSeam } from "../seam/device";
import { md5 } from "./md5";

function esc( s: string ): string {
	return s.replace( /[&<>"]/g, ( c ) => ( { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } )[ c ]! );
}

export function renderLoginForm( error?: string, baseUrl?: string ): string {
	return `<form class="login" novalidate>` +
		`<h1>Device password</h1>` +
		( baseUrl ? `<p class="login-target">Controller: <strong>${ esc( baseUrl ) }</strong></p>` : "" ) +
		( error ? `<p class="err" role="alert">${ esc( error ) }</p>` : "" ) +
		`<label for="os_pw">Password</label>` +
		`<input type="password" id="os_pw" name="pw" autocomplete="current-password" required>` +
		`<button type="submit">Sign in</button></form>`;
}

/**
 * Drive the login form inside `mount`; resolves with the validated pwHash once the device accepts it.
 * Re-prompts on a wrong password or a transient error.
 */
export function runLogin( mount: HTMLElement, baseUrl: string, fwv: number ): Promise<string> {
	return new Promise( ( resolve ) => {
		let attempt = 0;
		let settled = false;
		function show( error?: string ): void {
			if ( settled ) return;
			mount.innerHTML = renderLoginForm( error, baseUrl );
			const form = mount.querySelector( "form" ) as HTMLFormElement;
			const input = mount.querySelector( "#os_pw" ) as HTMLInputElement;
			const button = form.querySelector( "button" ) as HTMLButtonElement;
			input.focus?.();
			form.addEventListener( "submit", async ( ev ) => {
				ev.preventDefault();
				if ( button.disabled || settled ) return;
				const currentAttempt = ++attempt;
				const pw = input.value;
				button.disabled = true;
				button.textContent = "Signing in…";
				try {
					const seam = new BrowserDeviceSeam( { baseUrl, ver: fwv } );
					const result = await seam.authenticate( pw, fwv, md5 );
					if ( settled || currentAttempt !== attempt ) return;
					if ( result.ok ) { settled = true; resolve( result.pwHash ); return; }
					show( "Invalid password" );
				} catch {
					if ( settled || currentAttempt !== attempt ) return;
					show( "Could not reach the device" );
				}
			} );
		}
		show();
	} );
}

// @vitest-environment jsdom
/**
 * Login UI flow test (jsdom) — the password form drives the version-gated auth and resolves
 * with the validated pwHash, re-prompting on a wrong password.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { runLogin, renderLoginForm } from "../www/src/auth/login";
import { md5 } from "../www/src/auth/md5";

afterEach( () => vi.restoreAllMocks() );

function mockSp( result: number ): typeof fetch {
	return vi.fn( async () => ( { ok: true, status: 200, json: async () => ( { result } ) } ) as Response ) as unknown as typeof fetch;
}

function submit( mount: HTMLElement, pw: string ): void {
	( mount.querySelector( "#os_pw" ) as HTMLInputElement ).value = pw;
	( mount.querySelector( "form" ) as HTMLFormElement ).dispatchEvent( new Event( "submit", { cancelable: true, bubbles: true } ) );
}

describe( "renderLoginForm", () => {
	it( "renders a password field and surfaces an error", () => {
		expect( renderLoginForm() ).toContain( 'type="password"' );
		expect( renderLoginForm( "Invalid password" ) ).toContain( "Invalid password" );
	} );

	it( "keeps the scrubbed controller target visible and escaped", () => {
		const html = renderLoginForm( undefined, "https://controller.example/forward/<target>/" );
		expect( html ).toContain( "Controller:" );
		expect( html ).toContain( "https://controller.example/forward/&lt;target&gt;/" );
		expect( html ).not.toContain( "forward/<target>" );
	} );
} );

describe( "runLogin", () => {
	it( "resolves with md5(pw) when the device accepts it (fwv>=213)", async () => {
		globalThis.fetch = mockSp( 0 );
		const mount = document.createElement( "div" );
		const p = runLogin( mount, "http://d/", 221 );
		expect( mount.textContent ).toContain( "http://d/" );
		submit( mount, "secret" );
		await expect( p ).resolves.toBe( md5( "secret" ) );
	} );

	it( "re-prompts with an error on a wrong password", async () => {
		globalThis.fetch = mockSp( 2 );
		const mount = document.createElement( "div" );
		void runLogin( mount, "http://d/", 221 );
		submit( mount, "wrong" );
		await new Promise( ( r ) => setTimeout( r, 0 ) ); // let the async handler re-render
		expect( mount.innerHTML ).toContain( "Invalid password" );
		expect( mount.querySelector( "#os_pw" ) ).not.toBeNull(); // form still present
	} );
} );

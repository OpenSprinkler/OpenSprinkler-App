import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, type ServerResponse } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
// Plain ESM keeps the capture CLI directly executable under Node.
// @ts-expect-error JavaScript helper has no declaration file.
import { parseTrustedFirmware, resolveCaptureAuthentication } from "../scripts/capture-auth.mjs";

async function runCaptureProbe( respond: ( response: ServerResponse ) => void ): Promise<{ code: unknown; stderr: string }> {
	const server = createServer( ( _request, response ) => respond( response ) );
	await new Promise<void>( ( resolveListen ) => server.listen( 0, "127.0.0.1", resolveListen ) );
	try {
		const address = server.address();
		if ( !address || typeof address === "string" ) throw new Error( "test server did not bind to TCP" );
		const env: NodeJS.ProcessEnv = {
			...process.env,
			OS_BASE: `http://127.0.0.1:${ address.port }/`,
			OS_PWHASH: "abcdef0123456789abcdef0123456789",
		};
		delete env.OS_FWV;
		delete env.OS_PW;
		const child = spawn( process.execPath, [ resolve( "scripts/capture-fixtures.mjs" ) ], {
			env, stdio: [ "ignore", "ignore", "pipe" ],
		} );
		let stderr = "";
		child.stderr.setEncoding( "utf8" );
		child.stderr.on( "data", ( chunk: string ) => { stderr += chunk; } );
		const [ code ] = await once( child, "close" );
		return { code, stderr };
	} finally {
		await new Promise<void>( ( resolveClose, rejectClose ) => server.close( ( error ) => error ? rejectClose( error ) : resolveClose() ) );
	}
}

describe( "fixture capture authentication boundary", () => {
	it( "hashes a password for modern firmware without trusting it for a cleartext downgrade", () => {
		expect( resolveCaptureAuthentication( {
			probe: { fwv: 213 }, password: "opendoor",
		} ) ).toEqual( { fwv: 213, credential: "a6d82bced638de3def1e9bbb4983225c" } );
	} );

	it( "rejects an unauthenticated legacy downgrade before exposing the password", () => {
		expect( () => resolveCaptureAuthentication( {
			probe: { fwv: 212 }, password: "do-not-send-cleartext",
		} ) ).toThrow( /refusing unpinned legacy cleartext authentication/i );
	} );

	it( "stops the CLI after the credential-free probe when a server reports an unpinned legacy version", async () => {
		const requests: string[] = [];
		const server = createServer( ( request, response ) => {
			requests.push( request.url ?? "" );
			response.writeHead( 200, { "Content-Type": "application/json" } );
			response.end( JSON.stringify( { fwv: 212 } ) );
		} );
		await new Promise<void>( ( resolveListen ) => server.listen( 0, "127.0.0.1", resolveListen ) );
		try {
			const address = server.address();
			if ( !address || typeof address === "string" ) throw new Error( "test server did not bind to TCP" );
			const env: NodeJS.ProcessEnv = {
				...process.env, OS_BASE: `http://127.0.0.1:${ address.port }/`, OS_PW: "do-not-send-cleartext",
			};
			delete env.OS_FWV;
			delete env.OS_PWHASH;
			const child = spawn( process.execPath, [ resolve( "scripts/capture-fixtures.mjs" ) ], {
				env, stdio: [ "ignore", "ignore", "pipe" ],
			} );
			let stderr = "";
			child.stderr.setEncoding( "utf8" );
			child.stderr.on( "data", ( chunk: string ) => { stderr += chunk; } );
			const [ code ] = await once( child, "close" );
			expect( code ).toBe( 1 );
			expect( stderr ).toMatch( /refusing unpinned legacy cleartext authentication/i );
			expect( requests ).toEqual( [ "/jo" ] );
			expect( requests.join( "" ) ).not.toContain( "do-not-send-cleartext" );
		} finally {
			await new Promise<void>( ( resolveClose, rejectClose ) => server.close( ( error ) => error ? rejectClose( error ) : resolveClose() ) );
		}
	} );

	it( "does not echo malformed bodies or HTTP reason phrases from the controller", async () => {
		const malformed = await runCaptureProbe( ( response ) => {
			response.writeHead( 200, { "Content-Type": "application/json" } );
			response.end( "PRIVATE_BODY_SECRET" );
		} );
		expect( malformed.code ).toBe( 1 );
		expect( malformed.stderr ).toContain( "jo: invalid JSON response" );
		expect( malformed.stderr ).not.toContain( "PRIVATE_BODY_SECRET" );

		const httpFailure = await runCaptureProbe( ( response ) => {
			response.writeHead( 502, "PRIVATE_STATUS_SECRET", { "Content-Type": "text/plain" } );
			response.end( "PRIVATE_ERROR_SECRET" );
		} );
		expect( httpFailure.code ).toBe( 1 );
		expect( httpFailure.stderr ).toContain( "jo: HTTP 502" );
		expect( httpFailure.stderr ).not.toMatch( /PRIVATE_(?:STATUS|ERROR)_SECRET/ );
	} );

	it( "captures a valid controller with an empty run-log window", async () => {
		const requests: string[] = [];
		const replies: Record<string, unknown> = {
			"/jc": { devt: 100 },
			"/jo": { fwv: 221, fwm: 0, tz: 48 },
			"/jn": { snames: [] },
			"/jp": { pd: [] },
			"/jl": [],
			"/js": { sn: [] },
		};
		let joRequests = 0;
		const server = createServer( ( request, response ) => {
			requests.push( request.url ?? "" );
			const path = new URL( request.url ?? "/", "http://capture.test" ).pathname;
			const body = path === "/jo" && joRequests++ === 0 ? { fwv: 221 } : replies[ path ];
			response.writeHead( body === undefined ? 404 : 200, { "Content-Type": "application/json" } );
			response.end( JSON.stringify( body ?? { error: "not found" } ) );
		} );
		const temporary = await mkdtemp( join( tmpdir(), "os-capture-empty-log-" ) );
		const output = join( temporary, "221" );
		await new Promise<void>( ( resolveListen ) => server.listen( 0, "127.0.0.1", resolveListen ) );
		try {
			const address = server.address();
			if ( !address || typeof address === "string" ) throw new Error( "test server did not bind to TCP" );
			const env: NodeJS.ProcessEnv = {
				...process.env,
				OS_BASE: `http://127.0.0.1:${ address.port }/`,
				OS_PWHASH: "abcdef0123456789abcdef0123456789",
			};
			delete env.OS_FWV;
			delete env.OS_PW;
			const child = spawn( process.execPath, [
				resolve( "scripts/capture-fixtures.mjs" ), "--out", output,
			], { env, stdio: [ "ignore", "ignore", "pipe" ] } );
			let stderr = "";
			child.stderr.setEncoding( "utf8" );
			child.stderr.on( "data", ( chunk: string ) => { stderr += chunk; } );
			const [ code ] = await once( child, "close" );
			expect( { code, stderr } ).toEqual( { code: 0, stderr: "" } );
			expect( JSON.parse( await readFile( join( output, "jl.fixture.json" ), "utf8" ) ) ).toEqual( [] );
			expect( requests[ 0 ] ).toBe( "/jo" );
			expect( requests.slice( 1 ).every( ( path ) => path.includes( "pw=abcdef0123456789abcdef0123456789" ) ) ).toBe( true );
		} finally {
			await new Promise<void>( ( resolveClose, rejectClose ) => server.close( ( error ) => error ? rejectClose( error ) : resolveClose() ) );
			await rm( temporary, { recursive: true, force: true } );
		}
	} );

	it( "permits legacy cleartext only with the exact trusted firmware pin", () => {
		expect( resolveCaptureAuthentication( {
			probe: { fwv: 212 }, trustedFwv: 212, password: "verified-legacy-password",
		} ) ).toEqual( { fwv: 212, credential: "verified-legacy-password" } );
		expect( () => resolveCaptureAuthentication( {
			probe: { fwv: 211 }, trustedFwv: 212, password: "do-not-send-cleartext",
		} ) ).toThrow( /does not match/i );
	} );

	it( "validates trusted firmware pins and precomputed hashes", () => {
		expect( parseTrustedFirmware( "212" ) ).toBe( 212 );
		for ( const invalid of [ "", "0", "2.12", "10000" ] ) {
			expect( () => parseTrustedFirmware( invalid ) ).toThrow( /OS_FWV/ );
		}
		expect( () => resolveCaptureAuthentication( {
			probe: { fwv: 221 }, passwordHash: "not-a-hash",
		} ) ).toThrow( /32 hexadecimal/i );
		expect( resolveCaptureAuthentication( {
			probe: { fwv: 221 }, passwordHash: "ABCDEF0123456789ABCDEF0123456789",
		} ) ).toEqual( { fwv: 221, credential: "abcdef0123456789abcdef0123456789" } );
	} );

	it( "requires an unambiguous credential and a valid probed or pinned version", () => {
		expect( () => resolveCaptureAuthentication( {
			probe: {}, password: "secret", passwordHash: "abcdef0123456789abcdef0123456789",
		} ) ).toThrow( /valid firmware version/i );
		expect( () => resolveCaptureAuthentication( {
			probe: { fwv: 221 }, password: "secret", passwordHash: "abcdef0123456789abcdef0123456789",
		} ) ).toThrow( /only one/i );
	} );
} );

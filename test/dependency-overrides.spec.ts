import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { describe, expect, it } from "vitest";

const require = createRequire( import.meta.url );

function loadIosSimSimctl() {
	const iosSimRequire = createRequire( require.resolve( "ios-sim/package.json" ) );
	return iosSimRequire( "simctl" );
}

describe( "dependency override compatibility", () => {
	// simctl itself is macOS-only and constructs POSIX-shell commands; Linux can emulate xcrun,
	// while a Windows command shim would exercise different quoting semantics than the real tool.
	it.skipIf( process.platform === "win32" )(
		"keeps ios-sim's simctl 2 API compatible with patched shelljs", () => {
		const fixtureRoot = mkdtempSync( join( tmpdir(), "opensprinkler-simctl-" ) );
		const callsPath = join( fixtureRoot, "calls.jsonl" );
		const fakeXcrunPath = join( fixtureRoot, "xcrun" );
		writeFileSync( fakeXcrunPath, `#!/usr/bin/env node
const { appendFileSync } = require( "node:fs" );
const args = process.argv.slice( 2 );
appendFileSync( process.env.SIMCTL_FAKE_CALLS, JSON.stringify( args ) + "\\n" );
if ( args[ 0 ] !== "simctl" ) process.exit( 2 );
if ( args[ 1 ] === "list" ) {
	process.stdout.write( JSON.stringify( { devices: { fixture: [] } } ) );
} else if ( args[ 1 ] === "help" ) {
	process.stdout.write( "ok\\n" );
}
` );
		chmodSync( fakeXcrunPath, 0o755 );

		const originalPath = process.env.PATH;
		const originalCalls = process.env.SIMCTL_FAKE_CALLS;
		process.env.PATH = `${ fixtureRoot }${ delimiter }${ originalPath ?? "" }`;
		process.env.SIMCTL_FAKE_CALLS = callsPath;

		try {
			const simctl = loadIosSimSimctl();
			const prerequisite = simctl.check_prerequisites();
			expect( prerequisite.code ).toBe( 0 );
			expect( prerequisite.stdout ).toBe( "ok\n" );

			const list = simctl.list( { silent: true } );
			expect( list.code ).toBe( 0 );
			expect( list.json ).toEqual( { devices: { fixture: [] } } );

			expect( simctl.launch( true, "DEVICE", "APP", [ "one", "two words" ] ).code ).toBe( 0 );
			expect( simctl.spawn( true, "arm64", "DEVICE", "/bin/tool", [ "one", "two words" ] ).code ).toBe( 0 );

			const iosSimVersion = spawnSync( process.execPath, [ require.resolve( "ios-sim/bin/ios-sim" ), "--version" ], {
				encoding: "utf8",
				env: process.env
			} );
			expect( iosSimVersion.status ).toBe( 0 );
			expect( iosSimVersion.stdout.trim() ).toBe( "8.0.2" );

			const calls = readFileSync( callsPath, "utf8" ).trim().split( "\n" ).map( ( line ) => JSON.parse( line ) );
			expect( calls ).toEqual( [
				[ "simctl", "help" ],
				[ "simctl", "list", "--json" ],
				[ "simctl", "launch", "--wait-for-debugger", "DEVICE", "APP", "one", "two words" ],
				[ "simctl", "spawn", "--wait-for-debugger", "--arch=arm64", "DEVICE", "/bin/tool", "one", "two words" ],
				[ "simctl", "help" ]
			] );
		} finally {
			if ( originalPath === undefined ) delete process.env.PATH;
			else process.env.PATH = originalPath;
			if ( originalCalls === undefined ) delete process.env.SIMCTL_FAKE_CALLS;
			else process.env.SIMCTL_FAKE_CALLS = originalCalls;
			rmSync( fixtureRoot, { force: true, recursive: true } );
		}
	} );

	it( "makes ios-sim fail closed when xcrun is unavailable", () => {
		const emptyPath = mkdtempSync( join( tmpdir(), "opensprinkler-no-xcrun-" ) );
		try {
			const iosSimBin = require.resolve( "ios-sim/bin/ios-sim" );
			const result = spawnSync( process.execPath, [ iosSimBin, "--version" ], {
				encoding: "utf8",
				env: { ...process.env, PATH: emptyPath }
			} );

			expect( result.status ).toBe( 127 );
			expect( result.stdout ).not.toContain( "8.0.2" );
		} finally {
			rmSync( emptyPath, { force: true, recursive: true } );
		}
	} );

	it( "keeps xcode's CommonJS uuid generation compatible with the patched uuid release", () => {
		const xcode = require( "xcode" );
		const project = xcode.project( "unused.pbxproj" );
		project.hash = { project: { objects: {} } };

		expect( project.generateUuid() ).toMatch( /^[0-9A-F]{24}$/ );
	} );
} );

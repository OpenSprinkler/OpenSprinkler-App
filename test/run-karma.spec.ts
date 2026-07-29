import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The local .mjs helper has no separate declaration file.
import { findBrowser, resolveStaticFile } from "../scripts/run-karma.mjs";

const temporaryDirectories: string[] = [];

afterEach( async () => {
	await Promise.all( temporaryDirectories.splice( 0 ).map( ( directory ) =>
		rm( directory, { recursive: true, force: true } )
	) );
} );

describe( "legacy browser discovery", () => {
	it( "finds a Chromium-only Proxmox installation on PATH", async () => {
		const directory = await mkdtemp( join( tmpdir(), "opensprinkler-browser-" ) );
		temporaryDirectories.push( directory );
		const chromium = join( directory, "chromium" );
		await writeFile( chromium, "#!/bin/sh\nexit 0\n" );
		await chmod( chromium, 0o755 );

		expect( findBrowser( { PATH: directory } ) ).toBe( chromium );
		expect( findBrowser( { CHROME_BIN: "chromium", PATH: directory } ) ).toBe( chromium );
	} );

	it( "rejects an explicitly configured missing browser", () => {
		expect( () => findBrowser( { CHROME_BIN: "/missing/chrome", PATH: "" } ) )
			.toThrow( "Configured browser is not executable" );
	} );
} );

describe( "legacy browser server boundary", () => {
	it( "serves only public test/app assets and exact browser dependencies", async () => {
		const root = await mkdtemp( join( tmpdir(), "opensprinkler-browser-root-" ) );
		temporaryDirectories.push( root );
		await Promise.all( [
			mkdir( join( root, "www/js" ), { recursive: true } ),
			mkdir( join( root, "test/tests" ), { recursive: true } ),
			mkdir( join( root, "node_modules/mocha" ), { recursive: true } ),
		] );
		await Promise.all( [
			writeFile( join( root, "www/js/main.js" ), "window.app = true;\n" ),
			writeFile( join( root, "www/.private" ), "not public\n" ),
			writeFile( join( root, "test/tests/example.js" ), "describe('example', function () {});\n" ),
			writeFile( join( root, "node_modules/mocha/mocha.js" ), "window.mocha = {};\n" ),
			writeFile( join( root, "node_modules/mocha/package.json" ), "{}\n" ),
			writeFile( join( root, ".env" ), "API_TOKEN=must-not-leak\n" ),
			writeFile( join( root, "package.json" ), "{}\n" ),
		] );

		expect( await resolveStaticFile( "/www/js/main.js", root ) )
			.toBe( await realpath( join( root, "www/js/main.js" ) ) );
		expect( await resolveStaticFile( "/base/test/tests/example.js", root ) )
			.toBe( await realpath( join( root, "test/tests/example.js" ) ) );
		expect( await resolveStaticFile( "/node_modules/mocha/mocha.js", root ) )
			.toBe( await realpath( join( root, "node_modules/mocha/mocha.js" ) ) );

		for (const denied of [
			"/.env",
			"/base/.env",
			"/package.json",
			"/www/.private",
			"/node_modules/mocha/package.json",
			"/www/../.env",
		]) {
			expect( await resolveStaticFile( denied, root ), denied ).toBeUndefined();
		}

		if (process.platform !== "win32") {
			await symlink( "../../.env", join( root, "www/js/leak.js" ) );
			expect( await resolveStaticFile( "/www/js/leak.js", root ) ).toBeUndefined();
		}
	} );
} );

describe( "containerized legacy browser runner", () => {
	it( "keeps the Proxmox lane independent of a host browser", async () => {
		const packageJson = JSON.parse(
			await readFile( new URL( "../package.json", import.meta.url ), "utf8" ),
		) as { scripts: Record<string, string> };
		const runner = await readFile(
			new URL( "../scripts/run-karma-container.sh", import.meta.url ),
			"utf8",
		);
		const dockerfile = await readFile(
			new URL( "./karma-browser.Dockerfile", import.meta.url ),
			"utf8",
		);
		const dockerignore = await readFile( new URL( "./.dockerignore", import.meta.url ), "utf8" );
		const browserHarness = await readFile(
			new URL( "../scripts/run-karma.mjs", import.meta.url ),
			"utf8",
		);

		expect( packageJson.scripts[ "ci:proxmox" ] ).toContain( "test:browser:container" );
		expect( packageJson ).not.toHaveProperty( "devDependencies.karma" );
		expect( packageJson ).not.toHaveProperty( "devDependencies.grunt" );
		expect( runner ).toContain( 'mktemp -d "${TMPDIR:-/tmp}/opensprinkler-browser.XXXXXX"' );
		expect( runner ).toContain( 'trap cleanup EXIT' );
		expect( runner ).toContain( 'docker container rm --force "$container_name"' );
		expect( runner ).toContain( 'docker image rm "$image_name"' );
		expect( runner ).toContain( '--iidfile "$image_id_file"' );
		expect( runner ).toContain( '"$image_id" "$@"' );
		expect( runner ).not.toContain( "opensprinkler-browser-tests:node22-bookworm" );
		expect( runner ).toContain( "--read-only" );
		expect( runner ).toContain( '--name "$container_name"' );
		expect( runner ).toContain( "--network none" );
		expect( runner ).toContain( ":/workspace:ro" );
		expect( dockerfile ).toMatch( /^FROM node:22-bookworm@sha256:[a-f0-9]{64}$/m );
		expect( dockerfile ).toContain( "USER node" );
		expect( dockerignore.trim() ).toBe( "**" );
		expect( browserHarness ).toContain( "createServer" );
		expect( browserHarness ).toContain( "randomBytes(24)" );
		expect( browserHarness ).toContain( "__OPENSPRINKLER_BOOT_ERRORS__" );
		expect( browserHarness ).toContain( "result.tests < 1" );
		expect( browserHarness ).not.toContain( 'node_modules", "karma"' );
	} );
} );

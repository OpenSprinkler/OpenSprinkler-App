import { spawn } from "node:child_process";
import {
	lstat,
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	stat,
	symlink,
	utimes,
	writeFile,
} from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { inflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The local .mjs helper has no separate declaration file.
import { buildFirmware, collectFirmwareEntries, snapshotFirmwareEntries, validateFirmwareSnapshots } from "../scripts/build-firmware.mjs";

const temporaryDirectories: string[] = [];
const firmwareBuilderUrl = new URL( "../scripts/build-firmware.mjs", import.meta.url ).href;

function staleOwner( token: string, overrides: Record<string, unknown> = {} ) {
	return {
		version: 1,
		token,
		pid: 0x7fffffff,
		hostname: hostname(),
		processIdentity: "test-stale-process",
		createdAt: Date.now() - 10 * 60_000,
		...overrides,
	};
}

async function currentLinuxProcessIdentity() {
	if ( process.platform !== "linux" ) return null;
	const [ bootIdentity, processStat ] = await Promise.all( [
		readFile( "/proc/sys/kernel/random/boot_id", "utf8" ),
		readFile( `/proc/${ process.pid }/stat`, "utf8" ),
	] );
	const closingParenthesis = processStat.lastIndexOf( ")" );
	const fieldsAfterName = processStat.slice( closingParenthesis + 2 ).trim().split( /\s+/ );
	return `linux:${ bootIdentity.trim() }:${ fieldsAfterName[ 19 ] }`;
}

async function createFirmwareFixture() {
	const root = await mkdtemp( join( tmpdir(), "opensprinkler-firmware-" ) );
	temporaryDirectories.push( root );
	for ( const directory of [
		"www/css", "www/js/modules", "www/vendor-js", "www/img", "www/locale", "res/ios-web/icons",
	] ) {
		await mkdir( join( root, directory ), { recursive: true } );
	}
	await Promise.all( [
		writeFile( join( root, "www/css/main.css" ), "body { color: black; }\n" ),
		writeFile( join( root, "www/css/.private" ), "must not ship\n" ),
		writeFile( join( root, "www/js/main.js" ), "window.app = true;\n" ),
		writeFile( join( root, "www/js/modules/status.js" ), "window.statusModule = true;\n" ),
		writeFile( join( root, "www/vendor-js/vendor.js" ), "window.vendor = true;\n" ),
		writeFile( join( root, "www/img/icon.png" ), "png" ),
		writeFile( join( root, "www/locale/en.js" ), "{}\n" ),
		writeFile( join( root, "www/locale/messages_en.po" ), "not packaged\n" ),
		writeFile( join( root, "www/index.html" ), "<!doctype html>\n" ),
		writeFile( join( root, "www/manifest.json" ), "{}\n" ),
		writeFile( join( root, "www/sw.js" ), "// worker\n" ),
		writeFile( join( root, "res/ios-web/icons/icon.png" ), "ios-png" ),
	] );
	return root;
}

function startFirmwareBuilder( root: string, extraEnvironment: Record<string, string> = {} ) {
	let standardOutput = "";
	let standardError = "";
	let signalReady: () => void = () => undefined;
	let readySignalled = false;
	const ready = new Promise<void>( ( resolve ) => {
		signalReady = resolve;
	} );
	const program = [
		`import { buildFirmware } from ${ JSON.stringify( firmwareBuilderUrl ) };`,
		`console.log( "READY" );`,
		`await buildFirmware( process.env.FIRMWARE_TEST_ROOT );`,
	].join( "\n" );
	const child = spawn( process.execPath, [ "--input-type=module", "--eval", program ], {
		env: { ...process.env, ...extraEnvironment, FIRMWARE_TEST_ROOT: root },
		stdio: [ "ignore", "pipe", "pipe" ],
	} );

	child.stdout.setEncoding( "utf8" );
	child.stderr.setEncoding( "utf8" );
	child.stdout.on( "data", ( chunk: string ) => {
		standardOutput += chunk;
		if ( !readySignalled && standardOutput.includes( "READY\n" ) ) {
			readySignalled = true;
			signalReady();
		}
	} );
	child.stderr.on( "data", ( chunk: string ) => {
		standardError += chunk;
	} );

	const completed = new Promise<{ stdout: string; stderr: string }>( ( resolve, reject ) => {
		child.once( "error", ( error ) => {
			signalReady();
			reject( error );
		} );
		child.once( "close", ( code, signal ) => {
			signalReady();
			if ( code === 0 ) {
				resolve( { stdout: standardOutput, stderr: standardError } );
			} else {
				reject( new Error(
					`Firmware builder exited with ${ code ?? signal }: ${ standardError || standardOutput }`
				) );
			}
		} );
	} );

	return { ready, completed };
}

function readZipEntry( archive: Buffer, requestedName: string ) {
	const endSignature = 0x06054b50;
	let endOffset = archive.length - 22;
	while ( endOffset >= 0 && archive.readUInt32LE( endOffset ) !== endSignature ) endOffset--;
	if ( endOffset < 0 ) throw new Error( "ZIP end record not found" );
	const entries = archive.readUInt16LE( endOffset + 10 );
	let centralOffset = archive.readUInt32LE( endOffset + 16 );
	for ( let index = 0; index < entries; index++ ) {
		if ( archive.readUInt32LE( centralOffset ) !== 0x02014b50 ) {
			throw new Error( "Invalid ZIP central directory" );
		}
		const method = archive.readUInt16LE( centralOffset + 10 );
		const compressedSize = archive.readUInt32LE( centralOffset + 20 );
		const nameLength = archive.readUInt16LE( centralOffset + 28 );
		const extraLength = archive.readUInt16LE( centralOffset + 30 );
		const commentLength = archive.readUInt16LE( centralOffset + 32 );
		const localOffset = archive.readUInt32LE( centralOffset + 42 );
		const name = archive.subarray( centralOffset + 46, centralOffset + 46 + nameLength ).toString();
		if ( name === requestedName ) {
			if ( archive.readUInt32LE( localOffset ) !== 0x04034b50 ) throw new Error( "Invalid ZIP entry" );
			const localNameLength = archive.readUInt16LE( localOffset + 26 );
			const localExtraLength = archive.readUInt16LE( localOffset + 28 );
			const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
			const compressed = archive.subarray( dataOffset, dataOffset + compressedSize );
			if ( method === 0 ) return Buffer.from( compressed );
			if ( method === 8 ) return inflateRawSync( compressed );
			throw new Error( `Unsupported ZIP compression method ${ method }` );
		}
		centralOffset += 46 + nameLength + extraLength + commentLength;
	}
	throw new Error( `ZIP entry not found: ${ requestedName }` );
}

afterEach( async () => {
	await Promise.all( temporaryDirectories.splice( 0 ).map( ( directory ) =>
		rm( directory, { recursive: true, force: true } )
	) );
} );

describe( "firmware bundle builder", () => {
	it( "selects only the intended published asset classes", async () => {
		const entries = await collectFirmwareEntries();
		const targets = entries.map( ( entry: { target: string } ) => entry.target );

		expect( new Set( targets ).size ).toBe( targets.length );
		expect( targets ).toContain( "index.html" );
		expect( targets ).toContain( "js/main.js" );
		expect( targets ).toContain( "res/ios-web/icons/icon.png" );
		expect( targets.some( ( target: string ) => target.endsWith( ".po" ) ) ).toBe( false );
		expect( targets.every( ( target: string ) => !target.startsWith( "/" ) && !target.includes( ".." ) ) )
			.toBe( true );
	} );

	it( "rejects selected root-level assets that are symbolic links", async () => {
		const root = await createFirmwareFixture();
		await rm( join( root, "www/index.html" ) );
		await writeFile( join( root, "www/index-target.txt" ), "<!doctype html>\n" );
		await symlink( "index-target.txt", join( root, "www/index.html" ) );

		await expect( collectFirmwareEntries( root ) ).rejects.toThrow(
			"Refusing to package symbolic link: www/index.html"
		);
	} );

	it( "rejects an asset tree reached through a symbolic-link ancestor", async () => {
		const root = await createFirmwareFixture();
		const outsideRoot = await mkdtemp( join( tmpdir(), "opensprinkler-firmware-outside-" ) );
		temporaryDirectories.push( outsideRoot );
		const outsideWww = join( outsideRoot, "www" );
		await rename( join( root, "www" ), outsideWww );
		await symlink( outsideWww, join( root, "www" ), "dir" );

		await expect( collectFirmwareEntries( root ) ).rejects.toThrow(
			"Refusing to package symbolic link: www"
		);
	} );

	it( "never follows the build directory or top-level modules output through a symbolic link", async () => {
		if ( process.platform === "win32" ) return;
		const escapedRoot = await createFirmwareFixture();
		const outsideRoot = await mkdtemp( join( tmpdir(), "opensprinkler-build-outside-" ) );
		temporaryDirectories.push( outsideRoot );
		await mkdir( join( outsideRoot, "firmware" ) );
		await writeFile( join( outsideRoot, "firmware/sentinel" ), "outside-must-survive\n" );
		await symlink( outsideRoot, join( escapedRoot, "build" ), "dir" );

		await expect( buildFirmware( escapedRoot ) ).rejects.toThrow( /build root/i );
		expect( await readFile( join( outsideRoot, "firmware/sentinel" ), "utf8" ) )
			.toBe( "outside-must-survive\n" );
		await expect( readFile( join( outsideRoot, "firmware/index.html" ) ) ).rejects.toThrow();

		const modulesRoot = await createFirmwareFixture();
		const victim = join( outsideRoot, "modules-victim" );
		await mkdir( join( modulesRoot, "build" ) );
		await writeFile( victim, "outside-must-not-change\n" );
		await symlink( victim, join( modulesRoot, "build/modules.json" ) );

		await buildFirmware( modulesRoot );
		expect( await readFile( victim, "utf8" ) ).toBe( "outside-must-not-change\n" );
		const generatedState = await lstat( join( modulesRoot, "build/modules.json" ) );
		expect( generatedState.isSymbolicLink() ).toBe( false );
		expect( generatedState.isFile() ).toBe( true );
	} );

	it( "rejects an asset replaced by a symlink after enumeration", async () => {
		if ( process.platform === "win32" ) return;
		const root = await createFirmwareFixture();
		const outsideRoot = await mkdtemp( join( tmpdir(), "opensprinkler-input-outside-" ) );
		temporaryDirectories.push( outsideRoot );
		const victim = join( outsideRoot, "secret" );
		await writeFile( victim, "SECRET-MUST-NOT-SHIP\n" );
		const entries = await collectFirmwareEntries( root );
		await rm( join( root, "www/vendor-js/vendor.js" ) );
		await symlink( victim, join( root, "www/vendor-js/vendor.js" ) );

		await expect( snapshotFirmwareEntries( entries, root ) ).rejects.toThrow( /asset/i );
	} );

	it( "rejects a source tree that changes after an earlier asset was snapshotted", async () => {
		const root = await createFirmwareFixture();
		const entries = await collectFirmwareEntries( root );
		const snapshots = await snapshotFirmwareEntries( entries, root );
		await writeFile( join( root, "www/css/main.css" ), "body { color: red; }\n" );

		await expect( validateFirmwareSnapshots( entries, snapshots, root ) )
			.rejects.toThrow( /changed after being read/i );
	} );

	it( "replaces the complete output with a reproducible archive", async () => {
		const root = await createFirmwareFixture();

		await buildFirmware( root );
		const firstArchive = await readFile( join( root, "build/firmware/UI.zip" ) );
		await writeFile( join( root, "build/firmware/stale.txt" ), "stale" );
		await Promise.all( [ buildFirmware( root ), buildFirmware( root ) ] );
		const secondArchive = await readFile( join( root, "build/firmware/UI.zip" ) );

		expect( secondArchive ).toEqual( firstArchive );
		expect( readZipEntry( secondArchive, "css/main.css" ) )
			.toEqual( await readFile( join( root, "build/firmware/css/main.css" ) ) );
		await expect( readFile( join( root, "build/firmware/stale.txt" ) ) ).rejects.toThrow();
		await expect( readFile( join( root, "build/firmware/css/.private" ) ) ).rejects.toThrow();
		expect( JSON.parse( await readFile( join( root, "build/firmware/modules.json" ), "utf8" ) ) )
			.toEqual( [ "status.js" ] );
		if ( process.platform !== "win32" ) {
			expect( ( await stat( join( root, "build/firmware" ) ) ).mode & 0o777 ).toBe( 0o755 );
			expect( ( await stat( join( root, "build/firmware/css" ) ) ).mode & 0o777 ).toBe( 0o755 );
			expect( ( await stat( join( root, "build/firmware/UI.zip" ) ) ).mode & 0o777 ).toBe( 0o644 );
		}
	} );

	it( "recovers a lock left behind by a dead local process", async () => {
		const root = await createFirmwareFixture();
		const lockDirectory = join( root, "build/.firmware-build.lock" );
		await mkdir( lockDirectory, { recursive: true } );
		const ownerPath = join( lockDirectory, "owner.json" );
		const heartbeatPath = join( lockDirectory, "heartbeat" );
		await writeFile( ownerPath, JSON.stringify( staleOwner( "dead-test-owner" ) ) );
		await writeFile( heartbeatPath, "" );

		await buildFirmware( root );

		await expect( stat( lockDirectory ) ).rejects.toThrow();
		expect( await readFile( join( root, "build/firmware/index.html" ), "utf8" ) )
			.toBe( "<!doctype html>\n" );
	} );

	it( "recovers a dead lock whose previous reaper was also interrupted", async () => {
		const root = await createFirmwareFixture();
		const lockDirectory = join( root, "build/.firmware-build.lock" );
		const reaperDirectory = join( lockDirectory, ".reaping" );
		await mkdir( reaperDirectory, { recursive: true } );
		await Promise.all( [
			writeFile( join( lockDirectory, "owner.json" ), JSON.stringify( staleOwner( "dead-lock-owner" ) ) ),
			writeFile( join( lockDirectory, "heartbeat" ), "" ),
			writeFile( join( reaperDirectory, "owner.json" ), JSON.stringify( staleOwner( "dead-reaper-owner" ) ) ),
			writeFile( join( reaperDirectory, "heartbeat" ), "" ),
		] );

		await buildFirmware( root );

		await expect( stat( lockDirectory ) ).rejects.toThrow();
		expect( await readFile( join( root, "build/firmware/index.html" ), "utf8" ) )
			.toBe( "<!doctype html>\n" );
	} );

	it( "expires a stale heartbeat even when a same-host PID has been reused", async () => {
		const root = await createFirmwareFixture();
		const lockDirectory = join( root, "build/.firmware-build.lock" );
		await mkdir( lockDirectory, { recursive: true } );
		const ownerPath = join( lockDirectory, "owner.json" );
		const heartbeatPath = join( lockDirectory, "heartbeat" );
		await writeFile( ownerPath, JSON.stringify( staleOwner( "reused-live-pid", {
			pid: process.pid,
			processIdentity: "identity-from-an-earlier-process-using-this-pid",
		} ) ) );
		await writeFile( heartbeatPath, "" );

		await buildFirmware( root );
		await expect( stat( lockDirectory ) ).rejects.toThrow();

		await mkdir( lockDirectory );
		await writeFile( ownerPath, JSON.stringify( staleOwner( "invalid-pid", {
			pid: 0x80000000,
		} ) ) );
		await writeFile( heartbeatPath, "" );
		const staleDate = new Date( Date.now() - 10 * 60_000 );
		await Promise.all( [
			utimes( ownerPath, staleDate, staleDate ),
			utimes( heartbeatPath, staleDate, staleDate ),
		] );
		await buildFirmware( root );
		await expect( stat( lockDirectory ) ).rejects.toThrow();
	} );

	it( "expires an abandoned worker lease even while its shared process remains live", async () => {
		const processIdentity = await currentLinuxProcessIdentity();
		if ( processIdentity === null ) return;
		const root = await createFirmwareFixture();
		const lockDirectory = join( root, "build/.firmware-build.lock" );
		await mkdir( lockDirectory, { recursive: true } );
		const ownerPath = join( lockDirectory, "owner.json" );
		const heartbeatPath = join( lockDirectory, "heartbeat" );
		await writeFile( ownerPath, JSON.stringify( staleOwner( "abandoned-worker", {
			pid: process.pid,
			processIdentity,
		} ) ) );
		await writeFile( heartbeatPath, "" );
		const staleDate = new Date( Date.now() - 10 * 60_000 );
		await Promise.all( [
			utimes( ownerPath, staleDate, staleDate ),
			utimes( heartbeatPath, staleDate, staleDate ),
		] );

		await buildFirmware( root );

		await expect( stat( lockDirectory ) ).rejects.toThrow();
		expect( await readFile( join( root, "build/firmware/index.html" ), "utf8" ) )
			.toBe( "<!doctype html>\n" );
	} );

	it( "rolls back an interrupted publication and cleans abandoned private stages", async () => {
		const root = await createFirmwareFixture();
		await buildFirmware( root );
		const buildRoot = join( root, "build" );
		const transactionToken = "11111111-1111-4111-8111-111111111111";
		const transaction = join( buildRoot, `.firmware-publish-${ transactionToken }` );
		await mkdir( transaction );
		const metadataPath = join( transaction, "metadata.json" );
		await writeFile( metadataPath, JSON.stringify( {
			version: 2,
			previousPair: true,
			owner: staleOwner( transactionToken ),
		} ) );
		const staleDate = new Date( Date.now() - 10 * 60_000 );
		await utimes( metadataPath, staleDate, staleDate );
		await rename( join( buildRoot, "firmware" ), join( transaction, "firmware.previous" ) );
		await rename( join( buildRoot, "modules.json" ), join( transaction, "modules.previous.json" ) );
		await mkdir( join( buildRoot, "firmware" ) );
		await writeFile( join( buildRoot, "firmware/partial" ), "incomplete\n" );
		await writeFile( join( buildRoot, "modules.json" ), "[\"partial.js\"]\n" );
		const workToken = "22222222-2222-4222-8222-222222222222";
		const abandonedWork = join( buildRoot, `.firmware-work-${ workToken }` );
		await mkdir( abandonedWork );
		const workOwnerPath = join( abandonedWork, "owner.json" );
		await writeFile( workOwnerPath, JSON.stringify( staleOwner( workToken ) ) );
		await utimes( workOwnerPath, staleDate, staleDate );
		const candidateToken = "33333333-3333-4333-8333-333333333333";
		const abandonedCandidate = join( buildRoot, `.firmware-build-lock-${ candidateToken }` );
		await mkdir( abandonedCandidate );
		const candidateOwnerPath = join( abandonedCandidate, "owner.json" );
		await writeFile( candidateOwnerPath, JSON.stringify( staleOwner( candidateToken ) ) );
		await utimes( candidateOwnerPath, staleDate, staleDate );

		if ( process.platform !== "win32" ) {
			await rm( join( root, "www/index.html" ) );
			await symlink( "manifest.json", join( root, "www/index.html" ) );
			await expect( buildFirmware( root ) ).rejects.toThrow( /symbolic link/i );
		} else {
			await writeFile( join( root, "www/index.html" ), "broken", { flag: "w" } );
			await buildFirmware( root );
		}

		if ( process.platform !== "win32" ) {
			expect( await readFile( join( buildRoot, "firmware/index.html" ), "utf8" ) )
				.toBe( "<!doctype html>\n" );
			expect( JSON.parse( await readFile( join( buildRoot, "modules.json" ), "utf8" ) ) )
				.toEqual( [ "status.js" ] );
			await expect( stat( join( buildRoot, "firmware/partial" ) ) ).rejects.toThrow();
		}
		for ( const artifact of [
			transaction,
			abandonedWork,
			abandonedCandidate,
		] ) {
			await expect( stat( artifact ) ).rejects.toThrow();
		}
	} );

	it( "recovers when a crash split the previous pair across live and backup paths", async () => {
		if ( process.platform === "win32" ) return;
		const root = await createFirmwareFixture();
		await buildFirmware( root );
		const buildRoot = join( root, "build" );
		const transactionToken = "44444444-4444-4444-8444-444444444444";
		const transaction = join( buildRoot, `.firmware-publish-${ transactionToken }` );
		await mkdir( transaction );
		const metadataPath = join( transaction, "metadata.json" );
		await writeFile( metadataPath, JSON.stringify( {
			version: 2,
			previousPair: true,
			owner: staleOwner( transactionToken ),
		} ) );
		const staleDate = new Date( Date.now() - 10 * 60_000 );
		await utimes( metadataPath, staleDate, staleDate );
		// This is the exact state after firmware was backed up but before the
		// corresponding modules.json rename completed.
		await rename( join( buildRoot, "firmware" ), join( transaction, "firmware.previous" ) );
		await rm( join( root, "www/index.html" ) );
		await symlink( "manifest.json", join( root, "www/index.html" ) );

		await expect( buildFirmware( root ) ).rejects.toThrow( /symbolic link/i );

		expect( await readFile( join( buildRoot, "firmware/index.html" ), "utf8" ) )
			.toBe( "<!doctype html>\n" );
		expect( JSON.parse( await readFile( join( buildRoot, "modules.json" ), "utf8" ) ) )
			.toEqual( [ "status.js" ] );
		await expect( stat( transaction ) ).rejects.toThrow();
	} );

	it( "never mutates valid output using unauthenticated recovery metadata", async () => {
		const root = await createFirmwareFixture();
		await buildFirmware( root );
		const buildRoot = join( root, "build" );
		const originalArchive = await readFile( join( buildRoot, "firmware/UI.zip" ) );
		const originalModules = await readFile( join( buildRoot, "modules.json" ) );
		const transactionToken = "55555555-5555-4555-8555-555555555555";
		const transaction = join( buildRoot, `.firmware-publish-${ transactionToken }` );
		await mkdir( transaction );
		await writeFile( join( transaction, "metadata.json" ), JSON.stringify( {
			version: 2,
			previousPair: false,
		} ) );

		await expect( buildFirmware( root ) ).rejects.toThrow( /metadata|owner/i );
		expect( await readFile( join( buildRoot, "firmware/UI.zip" ) ) ).toEqual( originalArchive );
		expect( await readFile( join( buildRoot, "modules.json" ) ) ).toEqual( originalModules );
		expect( ( await stat( transaction ) ).isDirectory() ).toBe( true );
	} );

	it( "rejects a symbolic-link recovery backup before changing live output", async () => {
		if ( process.platform === "win32" ) return;
		const root = await createFirmwareFixture();
		await buildFirmware( root );
		const buildRoot = join( root, "build" );
		const outsideRoot = await mkdtemp( join( tmpdir(), "opensprinkler-recovery-outside-" ) );
		temporaryDirectories.push( outsideRoot );
		await mkdir( join( outsideRoot, "firmware" ) );
		await writeFile( join( outsideRoot, "firmware/sentinel" ), "must-survive\n" );
		const transactionToken = "66666666-6666-4666-8666-666666666666";
		const transaction = join( buildRoot, `.firmware-publish-${ transactionToken }` );
		await mkdir( transaction );
		const metadataPath = join( transaction, "metadata.json" );
		await writeFile( metadataPath, JSON.stringify( {
			version: 2,
			previousPair: true,
			owner: staleOwner( transactionToken ),
		} ) );
		const staleDate = new Date( Date.now() - 10 * 60_000 );
		await utimes( metadataPath, staleDate, staleDate );
		await symlink( join( outsideRoot, "firmware" ), join( transaction, "firmware.previous" ), "dir" );
		await rename( join( buildRoot, "modules.json" ), join( transaction, "modules.previous.json" ) );
		await rm( join( buildRoot, "firmware" ), { recursive: true } );
		await mkdir( join( buildRoot, "firmware" ) );
		await writeFile( join( buildRoot, "firmware/partial" ), "incomplete\n" );

		await expect( buildFirmware( root ) ).rejects.toThrow( /recovery pair/i );
		expect( await readFile( join( outsideRoot, "firmware/sentinel" ), "utf8" ) )
			.toBe( "must-survive\n" );
		expect( await readFile( join( buildRoot, "firmware/partial" ), "utf8" ) )
			.toBe( "incomplete\n" );
		await expect( stat( join( buildRoot, "modules.json" ) ) ).rejects.toThrow();
	} );

	it( "sorts archive entries independently of the process locale", async () => {
		const root = await createFirmwareFixture();
		await Promise.all( [
			writeFile( join( root, "www/img/z.png" ), "z" ),
			writeFile( join( root, "www/img/ä.png" ), "umlaut" ),
		] );

		await startFirmwareBuilder( root, { LC_ALL: "C", LANG: "C" } ).completed;
		const cArchive = await readFile( join( root, "build/firmware/UI.zip" ) );
		await startFirmwareBuilder( root, { LC_ALL: "sv_SE.UTF-8", LANG: "sv_SE.UTF-8" } ).completed;
		const swedishArchive = await readFile( join( root, "build/firmware/UI.zip" ) );

		expect( swedishArchive ).toEqual( cArchive );
	} );

	it( "serializes independent module instances that share one process identity", async () => {
		const root = await createFirmwareFixture();
		const [ firstInstance, secondInstance ] = await Promise.all( [
			import( `${ firmwareBuilderUrl }?lock-instance=first` ),
			import( `${ firmwareBuilderUrl }?lock-instance=second` ),
		] );

		await Promise.all( [
			firstInstance.buildFirmware( root ),
			secondInstance.buildFirmware( root ),
		] );

		expect( await readFile( join( root, "build/firmware/index.html" ), "utf8" ) )
			.toBe( "<!doctype html>\n" );
		expect( ( await readdir( join( root, "build" ) ) ).filter( ( name ) =>
			name.startsWith( ".firmware-" )
		) ).toEqual( [] );
	} );

	it( "serializes independent builder processes and publishes deterministic bytes", async () => {
		const root = await createFirmwareFixture();
		const lockDirectory = join( root, "build/.firmware-build.lock" );
		await mkdir( lockDirectory, { recursive: true } );
		const ownerPath = join( lockDirectory, "owner.json" );
		await writeFile( ownerPath, JSON.stringify( {
			version: 1,
			token: "remote-live-test-owner",
			pid: process.pid,
			hostname: `${ hostname() }-remote-test`,
			processIdentity: "remote-live-test-process",
			createdAt: Date.now() - 10 * 60_000,
		} ) );
		await writeFile( join( lockDirectory, "heartbeat" ), "" );
		const oldOwnerDate = new Date( Date.now() - 10 * 60_000 );
		await utimes( ownerPath, oldOwnerDate, oldOwnerDate );

		const first = startFirmwareBuilder( root );
		const second = startFirmwareBuilder( root );
		await Promise.all( [ first.ready, second.ready ] );
		const contentionDeadline = Date.now() + 5_000;
		let waitingCandidates: string[] = [];
		do {
			waitingCandidates = ( await readdir( join( root, "build" ) ) ).filter( ( name ) =>
				name.startsWith( ".firmware-build-lock-" )
			);
			if ( waitingCandidates.length < 2 ) await delay( 10 );
		} while ( waitingCandidates.length < 2 && Date.now() < contentionDeadline );
		expect( waitingCandidates ).toHaveLength( 2 );
		expect( JSON.parse( await readFile( join( lockDirectory, "owner.json" ), "utf8" ) ).token )
			.toBe( "remote-live-test-owner" );
		const releasedSyntheticLock = join( root, "build/.firmware-test-release" );
		await rename( lockDirectory, releasedSyntheticLock );
		await rm( releasedSyntheticLock, { recursive: true, force: true } );

		const results = await Promise.all( [ first.completed, second.completed ] );
		expect( results.every( ( result ) => result.stdout.includes( "Built 11 firmware assets" ) ) )
			.toBe( true );
		const contendedArchive = await readFile( join( root, "build/firmware/UI.zip" ) );
		const finalBuilder = startFirmwareBuilder( root );
		await finalBuilder.completed;
		expect( await readFile( join( root, "build/firmware/UI.zip" ) ) ).toEqual( contendedArchive );
		expect( ( await readdir( join( root, "build" ) ) ).filter( ( name ) =>
			name.startsWith( ".firmware-" )
		) ).toEqual( [] );
	}, 30_000 );
} );

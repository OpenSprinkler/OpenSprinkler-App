import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { publishPrivateDirectory } from "../scripts/capture-output.mjs";

const roots: string[] = [];
async function temporaryRoot(): Promise<string> {
	const root = await mkdtemp( join( tmpdir(), "os-capture-publish-" ) );
	roots.push( root );
	return root;
}
afterEach( async () => { await Promise.all( roots.splice( 0 ).map( ( root ) => rm( root, { recursive: true, force: true } ) ) ); } );

describe( "capture generation publication", () => {
	it( "replaces the complete directory and removes stale endpoints", async () => {
		const root = await temporaryRoot(), output = join( root, "221" );
		await mkdir( output );
		await writeFile( join( output, "stale.fixture.json" ), "old" );
		await publishPrivateDirectory( output, {
			"jc.fixture.json": "new-jc", "jo.fixture.json": "new-jo",
		} );
		await expect( readFile( join( output, "jc.fixture.json" ), "utf8" ) ).resolves.toBe( "new-jc" );
		await expect( readFile( join( output, "stale.fixture.json" ), "utf8" ) ).rejects.toThrow();
	} );

	it( "rejects a concurrent publisher and a symlink target", async () => {
		const root = await temporaryRoot(), output = join( root, "221" );
		await mkdir( output );
		await writeFile( `${ output }.lock`, "busy" );
		await expect( publishPrivateDirectory( output, { "jc.fixture.json": "new" } ) ).rejects.toThrow( /another capture/i );
		await rm( `${ output }.lock` );
		await rm( output, { recursive: true } );
		const target = join( root, "target" );
		await mkdir( target );
		await symlink( target, output );
		await expect( publishPrivateDirectory( output, { "jc.fixture.json": "new" } ) ).rejects.toThrow( /symlink/i );
	} );
} );

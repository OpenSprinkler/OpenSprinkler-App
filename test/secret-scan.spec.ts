import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scanner = resolve( "scripts/check-tracked-secrets.mjs" );
const temporaryDirectories: string[] = [];

afterEach( async () => {
	await Promise.all( temporaryDirectories.splice( 0 ).map( ( directory ) =>
		rm( directory, { recursive: true, force: true } )
	) );
} );

async function scanToken( token: string ): Promise<{ status: number | null; stderr: string }> {
	const directory = await mkdtemp( join( tmpdir(), "opensprinkler-secret-scan-" ) );
	temporaryDirectories.push( directory );
	execFileSync( "git", [ "init", "--quiet" ], { cwd: directory } );
	await writeFile( `${ directory }/candidate.txt`, `${ token }\n`, { mode: 0o600 } );
	const result = spawnSync( process.execPath, [ scanner ], { cwd: directory, encoding: "utf8" } );
	return { status: result.status, stderr: result.stderr };
}

describe( "tracked secret scanning", () => {
	it.each( [
		[ "GitHub fine-grained token", [ "github", "_pat_", "A".repeat( 82 ) ].join( "" ) ],
		[ "Docker access token", [ "dckr", "_pat_", "B".repeat( 27 ) ].join( "" ) ],
		[ "private key material", [ "-----BEGIN ENCRYPTED", " PRIVATE KEY-----" ].join( "" ) ],
	] )( "detects a %s without embedding a real-looking token in this repository", async ( label, token ) => {
		const result = await scanToken( token );
		expect( result.status ).toBe( 1 );
		expect( result.stderr ).toContain( label );
	} );
} );

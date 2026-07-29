import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
// This helper is intentionally plain ESM so the capture CLI can run directly under Node.
// @ts-expect-error JavaScript helper has no declaration file.
import { assertRedactedFixture, redactFixture } from "../scripts/fixture-redaction.mjs";
import { writePrivateFile } from "../scripts/capture-output.mjs";

describe( "live fixture redaction", () => {
	it( "removes controller credentials, identity, and private endpoints without mutating input", () => {
		const original = {
			mac: "AA:BB:CC:DD:EE:FF", loc: "42.3,-71.0", eip: 1234, dname: "Home",
			devt: 123456, lwc: 123450, lswc: 123440, lupt: 123430, lrbtc: 123420, rdst: 123410,
			lrun: [ 1, 2, 60, 123400 ], ps: [ [ 1, 60, 123390, 2 ] ],
			jsp: "https://private-ui/", wsp: "http://10.0.0.3:3000", ifkey: "ifttt-secret",
			wto: { provider: "WU", key: "weather-secret", pws: "KPRIVATE123" },
			mqtt: { host: "10.0.0.4", user: "me", pass: "secret" },
			email: { recipient: "person@example.com" }, otc: { token: "OTsecret" },
		};
		const redacted = redactFixture( "jc", original );
		const serialized = JSON.stringify( redacted );

		expect( serialized ).not.toContain( "weather-secret" );
		expect( serialized ).not.toContain( "ifttt-secret" );
		expect( serialized ).not.toContain( "10.0.0" );
		expect( serialized ).not.toContain( "person@example.com" );
		expect( serialized ).not.toContain( "KPRIVATE123" );
		expect( redacted.wto.provider ).toBe( "WU" );
		expect( redacted.devt ).toBe( 0 );
		expect( redacted.lrun[ 3 ] ).toBe( 0 );
		expect( redacted.ps[ 0 ][ 2 ] ).toBe( 0 );
		expect( original.wto.key ).toBe( "weather-secret" );
	} );

	it( "redacts network octets, names, program labels, and activity timestamps", () => {
		expect( redactFixture( "jo", { ip1: 192, ip2: 168, hp0: 80, devid: 8675309 } ) ).toEqual( { ip1: 0, ip2: 0, hp0: 80, devid: 0 } );
		expect( redactFixture( "jn", { snames: [ "Front yard", "Back yard" ] } ).snames ).toEqual( [ "S01", "S02" ] );
		expect( redactFixture( "jp", { pd: [ [ 1, 2, 3, [], [], "Morning" ] ] } ).pd[ 0 ][ 5 ] ).toBe( "Program 1" );
		expect( redactFixture( "jl", [ [ 1, 2, 60, 123456 ] ] )[ 0 ][ 3 ] ).toBe( 0 );
	} );

	it( "preserves endpoint shape when optional firmware fields are absent", () => {
		expect( redactFixture( "jc", { devt: 1 } ) ).toEqual( { devt: 0 } );
	} );

	it( "fails closed for future nested secret, identity, and private-network fields", () => {
		const redacted = redactFixture( "future", {
			integration: { apiToken: "future-secret", endpoint: "http://192.168.7.4/private" },
			contact: "owner@example.com", adapter: { private_key: "pem-data" }, latitude: 41.2,
			lastSeen: 1_700_000_000,
		} );
		const serialized = JSON.stringify( redacted );
		expect( serialized ).not.toContain( "future-secret" );
		expect( serialized ).not.toContain( "192.168.7.4" );
		expect( serialized ).not.toContain( "owner@example.com" );
		expect( serialized ).not.toContain( "pem-data" );
		expect( redacted.latitude ).toBe( 0 );
		expect( redacted.lastSeen ).toBe( 0 );
		expect( () => assertRedactedFixture( { futureToken: "still-secret" } ) ).toThrow( /not redacted/i );
	} );

	it( "refuses a requested output directory that could overwrite curated fixtures", () => {
		const result = spawnSync( process.execPath, [ resolve( "scripts/capture-fixtures.mjs" ),
			"--base", "http://192.0.2.10/", "--out", resolve( "test/fixtures/api" ) ], { encoding: "utf8" } );
		expect( result.status ).toBe( 1 );
		expect( result.stderr ).toMatch( /refusing.*curated/i );
	} );

	it( "atomically replaces regular captures but never follows a leaf symlink", async () => {
		const dir = await mkdtemp( join( tmpdir(), "os-capture-test-" ) );
		try {
			const protectedFile = join( dir, "protected.json" );
			const output = join( dir, "jc.fixture.json" );
			await writeFile( protectedFile, "protected" );
			await symlink( protectedFile, output );
			await expect( writePrivateFile( output, "new" ) ).rejects.toThrow( /symlink/i );
			expect( await readFile( protectedFile, "utf8" ) ).toBe( "protected" );
			await rm( output );
			await writePrivateFile( output, "first" );
			await writePrivateFile( output, "second" );
			expect( await readFile( output, "utf8" ) ).toBe( "second" );
			expect( ( await stat( output ) ).mode & 0o777 ).toBe( 0o600 );
		} finally {
			await rm( dir, { recursive: true, force: true } );
		}
	} );
} );

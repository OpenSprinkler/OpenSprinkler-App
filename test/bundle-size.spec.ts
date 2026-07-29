import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The local .mjs helper has no separate declaration file.
import { checkBundleSizeBudget, deterministicGzipSize, evaluateBundleSize } from "../scripts/check-bundle-size.mjs";

const temporaryDirectories: string[] = [];

afterEach( async () => {
	await Promise.all( temporaryDirectories.splice( 0 ).map( ( directory ) =>
		rm( directory, { recursive: true, force: true } )
	) );
} );

async function writeBudget( root: string, baselineBytes: number ) {
	await writeFile( join( root, "bundle-size-budget.json" ), JSON.stringify( {
		schemaVersion: 1,
		compression: { algorithm: "gzip", level: 9 },
		maximumGrowthPercent: 10,
		assets: [ { path: "dist/assets/app.js", baselineBytes } ],
	} ) );
}

describe( "production bundle-size budget", () => {
	it( "uses deterministic gzip and permits no more than ten percent growth", () => {
		const source = Buffer.from( "repeatable production asset\n".repeat( 100 ) );
		expect( deterministicGzipSize( source ) ).toBe( deterministicGzipSize( source ) );
		expect( evaluateBundleSize( "asset.js", 1_000, 1_100 ).passed ).toBe( true );
		expect( evaluateBundleSize( "asset.js", 1_000, 1_101 ).passed ).toBe( false );
	} );

	it( "fails with an actionable message when an asset exceeds its reviewed baseline", async () => {
		const root = await mkdtemp( join( tmpdir(), "opensprinkler-bundle-size-" ) );
		temporaryDirectories.push( root );
		await mkdir( join( root, "dist/assets" ), { recursive: true } );
		const source = Buffer.from( "oversized production asset\n".repeat( 100 ) );
		await writeFile( join( root, "dist/assets/app.js" ), source );
		const actualBytes = deterministicGzipSize( source );
		await writeBudget( root, Math.floor( actualBytes / 1.11 ) );

		await expect( checkBundleSizeBudget( { repositoryRoot: root, logger: () => undefined } ) )
			.rejects.toThrow( /Reduce the bundle.*update baselineBytes.*explain the increase/s );
	} );

	it( "records CSS and JavaScript baselines and runs the guard after the production build", async () => {
		const budget = JSON.parse(
			await readFile( new URL( "../bundle-size-budget.json", import.meta.url ), "utf8" ),
		) as {
			compression: { algorithm: string; level: number };
			maximumGrowthPercent: number;
			assets: Array<{ path: string; baselineBytes: number }>;
		};
		const packageJson = JSON.parse(
			await readFile( new URL( "../package.json", import.meta.url ), "utf8" ),
		) as { scripts: Record<string, string> };

		expect( budget.compression ).toEqual( { algorithm: "gzip", level: 9 } );
		expect( budget.maximumGrowthPercent ).toBe( 10 );
		expect( budget.assets.map( ( asset ) => asset.path ) ).toEqual( [
			"dist/assets/app.css",
			"dist/assets/app.js",
		] );
		expect( budget.assets.every( ( asset ) => asset.baselineBytes > 0 ) ).toBe( true );
		expect( packageJson.scripts[ "check:bundle-size" ] ).toBe( "node scripts/check-bundle-size.mjs" );
		expect( packageJson.scripts[ "ci:checks" ] )
			.toContain( "npm run build:app && npm run check:bundle-size" );
	} );
} );

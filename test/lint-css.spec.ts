import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

// @ts-expect-error The local .mjs helper has no separate declaration file.
import { lintCss } from "../scripts/lint-css.mjs";

describe( "CSS lint task", () => {
	it( "reports malformed CSS as a lint failure", async () => {
		const directory = await mkdtemp( join( tmpdir(), "opensprinkler-csslint-" ) );
		try {
			const css = join( directory, "broken.css" );
			const config = join( directory, ".csslintrc" );
			await Promise.all( [
				writeFile( css, "a { color: ; }\n" ),
				writeFile( config, "{}\n" ),
			] );
			await expect( lintCss( css, config ) ).rejects.toThrow( /CSSLint found [1-9]/ );
		} finally {
			await rm( directory, { recursive: true, force: true } );
		}
	} );
} );

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe( "companion image deployment policy", () => {
	it( "keeps both production and browser-test Docker bases updated", async () => {
		const dependabot = await readFile( new URL( "../.github/dependabot.yml", import.meta.url ), "utf8" );

		expect( dependabot ).toMatch( /package-ecosystem: docker\n\s+directory: \/server/ );
		expect( dependabot ).toMatch( /package-ecosystem: docker\n\s+directory: \/test/ );
	} );

	it( "documents immutable image selection and a volume-preserving rollback", async () => {
		const compose = await readFile( new URL( "../docker-compose.yml", import.meta.url ), "utf8" );
		const deploy = await readFile( new URL( "../docs/DEPLOY.md", import.meta.url ), "utf8" );

		expect( compose ).toContain( "image: ${COMPANION_IMAGE:?Set COMPANION_IMAGE" );
		expect( compose ).toContain( "@sha256:<64-hex-manifest-digest>" );
		expect( compose ).not.toContain( "opensprinkler-companion:latest" );
		expect( deploy ).toContain( "Do not deploy `latest`" );
		expect( deploy ).toContain( "### Published-image upgrade and rollback" );
		expect( deploy ).toContain( "restore the previously recorded `COMPANION_IMAGE` value" );
		expect( deploy ).toContain( "never use `docker compose down -v`" );
	} );

	it( "preserves cancellation exit codes while cleaning up companion smoke resources", async () => {
		const smoke = await readFile( new URL( "../scripts/smoke-companion-container.sh", import.meta.url ), "utf8" );

		expect( smoke ).toContain( "trap cleanup EXIT" );
		expect( smoke ).toContain( "trap 'exit 129' HUP" );
		expect( smoke ).toContain( "trap 'exit 130' INT" );
		expect( smoke ).toContain( "trap 'exit 143' TERM" );
		expect( smoke ).not.toMatch( /trap cleanup (?:EXIT )?(?:HUP |INT |TERM )+(?:HUP|INT|TERM)/ );
	} );
} );

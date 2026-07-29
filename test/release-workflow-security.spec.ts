import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read( path: string ): string {
	return readFileSync( resolve( path ), "utf8" );
}

describe( "release workflow supply-chain boundaries", () => {
	it( "pins helper images and limits QEMU to the released foreign platform", () => {
		const workflow = read( ".github/workflows/companion-image.yml" );
		expect( workflow ).toMatch(
			/image: docker\.io\/tonistiigi\/binfmt@sha256:[0-9a-f]{64}\n\s+platforms: arm64/,
		);
		expect( workflow ).toMatch(
			/driver-opts: image=moby\/buildkit@sha256:[0-9a-f]{64}/,
		);
		expect( workflow ).not.toContain( "tonistiigi/binfmt:latest" );
		expect( workflow ).not.toContain( "moby/buildkit:buildx-stable-1" );
	} );

	it( "smokes the exact platform digests before manifest promotion", () => {
		const workflow = read( ".github/workflows/companion-image.yml" );
		const smokeScript = read( "scripts/smoke-companion-container.sh" );
		const amd64Smoke = workflow.indexOf( "- name: Smoke-test the exact amd64 registry artifact" );
		const arm64Smoke = workflow.indexOf( "- name: Smoke-test the exact arm64 registry artifact" );
		const retrySmoke = workflow.indexOf( "- name: Re-smoke the existing arm64 release on a retry" );
		const promotion = workflow.indexOf( "- name: Promote the tested digests to image tags" );
		const promotionScript = workflow.slice( promotion );
		expect( workflow.match( /push-by-digest=true/g ) ).toHaveLength( 2 );
		expect( workflow.match( /SMOKE_IMAGE:/g ) ).toHaveLength( 4 );
		expect( amd64Smoke ).toBeGreaterThan( workflow.indexOf( "id: build_amd64" ) );
		expect( arm64Smoke ).toBeGreaterThan( workflow.indexOf( "id: build_arm64" ) );
		expect( promotion ).toBeGreaterThan( amd64Smoke );
		expect( promotion ).toBeGreaterThan( arm64Smoke );
		expect( promotion ).toBeGreaterThan( retrySmoke );
		expect( promotionScript ).toContain( "AMD64_DIGEST: ${{ steps.build_amd64.outputs.digest }}" );
		expect( promotionScript ).toContain( "ARM64_DIGEST: ${{ steps.build_arm64.outputs.digest }}" );
		expect( promotionScript ).toContain( '"$IMAGE_REPOSITORY@$AMD64_DIGEST"' );
		expect( promotionScript ).toContain( '"$IMAGE_REPOSITORY@$ARM64_DIGEST"' );
		expect( promotionScript ).toContain( "docker buildx imagetools create" );
		expect( promotionScript ).not.toContain( "uses: docker/build-push-action" );
		expect( workflow ).not.toContain( "platforms: linux/amd64,linux/arm64" );
		expect( smokeScript ).toContain( "image_name=$SMOKE_IMAGE" );
		expect( smokeScript ).toContain( "@sha256:<64 lowercase hex characters>" );
		expect( smokeScript ).toContain( 'docker pull --platform "$SMOKE_PLATFORM" "$image_name"' );
	} );

	it( "reserves companion release tags and requires Docker Hub immutability", () => {
		const workflow = read( ".github/workflows/companion-image.yml" );
		const deployGuide = read( "docs/DEPLOY.md" );
		expect( workflow ).toContain( 'if [[ "$IMAGE_TAG" == companion-v* ]]' );
		expect( workflow ).toContain( "Preflight immutable release tag" );
		expect( workflow ).toContain( "immutable_tags_settings" );
		expect( workflow ).toContain( 'const requiredRule = "^companion-v.*$";' );
		expect( workflow ).toContain( "settings.rules.length !== 1" );
		expect( workflow ).toContain( "flavor: latest=false" );
		expect( workflow ).toContain( 'if [[ "$IMAGE_TAG" == "latest" ]]' );
		expect( deployGuide ).toContain( "Specific tags are immutable" );
		expect( deployGuide ).toContain( "`^companion-v.*$`" );
	} );

	it( "makes partial release promotion verifiable and retry-safe", () => {
		const workflow = read( ".github/workflows/companion-image.yml" );
		const deployGuide = read( "docs/DEPLOY.md" );
		const promotion = workflow.slice( workflow.indexOf( "- name: Promote the tested digests to image tags" ) );
		const releaseCreation = promotion.indexOf( 'docker buildx imagetools create --tag "$release_ref"' );
		const mutablePromotion = promotion.indexOf( 'for tag in "${mutable_tags[@]}"' );
		expect( workflow ).toContain( "RUN_ATTEMPT: ${{ github.run_attempt }}" );
		expect( workflow ).toContain( "RUN_ID: ${{ github.run_id }}" );
		expect( workflow ).toContain( 'labels?.["org.opencontainers.image.revision"] !== sourceSha' );
		expect( workflow ).toContain( 'labels?.["io.github.opensprinkler.release-run-id"] !== runId' );
		expect( workflow ).toContain( "io.github.opensprinkler.release-run-id=${{ github.run_id }}" );
		expect( workflow ).toContain( "release_exists=true" );
		expect( workflow ).toContain( "Re-smoke the existing amd64 release on a retry" );
		expect( promotion ).toContain( "{{.Manifest.Digest}}" );
		expect( promotion ).toContain( "verify_tag_digest" );
		expect( promotion ).toContain( "git ls-remote --exit-code origin refs/heads/master" );
		expect( promotion ).toContain( 'remote_sha" != "$SOURCE_SHA' );
		expect( releaseCreation ).toBeGreaterThan( -1 );
		expect( mutablePromotion ).toBeGreaterThan( releaseCreation );
		expect( promotion ).toContain( '"$IMAGE_REPOSITORY@$canonical_digest"' );
		expect( deployGuide ).toContain( "rerun that same workflow run" );
	} );

	it( "pins one exact Firebase CLI version in both deploy workflows", () => {
		const workflows = [
			read( ".github/workflows/firebase-hosting.yml" ),
			read( ".github/workflows/firebase-hosting-next.yml" ),
		];
		const versions = workflows.map( ( workflow ) =>
			workflow.match( /firebaseToolsVersion: "([0-9]+\.[0-9]+\.[0-9]+)"/ )?.[ 1 ],
		);
		expect( versions[ 0 ] ).toBeDefined();
		expect( versions[ 1 ] ).toBe( versions[ 0 ] );
		for ( const workflow of workflows ) {
			expect( workflow ).not.toMatch( /firebaseToolsVersion:\s*["']?latest/ );
		}
	} );
} );

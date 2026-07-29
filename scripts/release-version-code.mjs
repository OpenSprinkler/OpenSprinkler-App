#!/usr/bin/env node
/** Generate a reproducible, monotonic store build number from protected master history. */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Reserve a range above every historical semver-derived code while staying below Google Play's
// documented 2,100,000,000 ceiling. Protected master must prohibit history rewrites.
const VERSION_CODE_BASE = 1_000_000_000;
const MAX_ANDROID_VERSION_CODE = 2_100_000_000;
const MAX_APPLE_BUILD_NUMBER = 9_999;

function validateFirstParentRevision( firstParentRevision ) {
	if ( !Number.isSafeInteger( firstParentRevision ) || firstParentRevision < 1 ) {
		throw new RangeError( "First-parent revision must be a positive safe integer." );
	}
}

export function releaseVersionCode( firstParentRevision ) {
	validateFirstParentRevision( firstParentRevision );
	const versionCode = VERSION_CODE_BASE + firstParentRevision;
	if ( versionCode > MAX_ANDROID_VERSION_CODE ) {
		throw new RangeError( `Release version code ${ versionCode } exceeds Google Play's maximum.` );
	}
	return versionCode;
}

export function appleReleaseVersionCode( firstParentRevision ) {
	validateFirstParentRevision( firstParentRevision );
	if ( firstParentRevision > MAX_APPLE_BUILD_NUMBER ) {
		throw new RangeError(
			`Apple build number ${ firstParentRevision } exceeds CFBundleVersion's four-digit first component.`,
		);
	}
	return firstParentRevision;
}

export function currentFirstParentRevision() {
	const shallow = execFileSync( "git", [ "rev-parse", "--is-shallow-repository" ], {
		encoding: "utf8",
	} ).trim();
	if ( shallow !== "false" ) {
		throw new Error( "Release version codes require a full, non-shallow Git history." );
	}
	const raw = execFileSync( "git", [ "rev-list", "--count", "--first-parent", "HEAD" ], {
		encoding: "utf8",
	} ).trim();
	if ( !/^[1-9][0-9]*$/.test( raw ) ) throw new Error( "Git returned an invalid first-parent revision count." );
	return Number( raw );
}

export function currentReleaseVersionCode() {
	return releaseVersionCode( currentFirstParentRevision() );
}

export function currentAppleReleaseVersionCode() {
	return appleReleaseVersionCode( currentFirstParentRevision() );
}

const invokedPath = process.argv[ 1 ];
if ( invokedPath && import.meta.url === pathToFileURL( invokedPath ).href ) {
	const mode = process.argv[ 2 ];
	if ( mode !== undefined && mode !== "--apple" ) {
		throw new Error( `Unknown release version code option: ${ mode }` );
	}
	const versionCode = mode === "--apple"
		? currentAppleReleaseVersionCode()
		: currentReleaseVersionCode();
	process.stdout.write( `${ versionCode }\n` );
}

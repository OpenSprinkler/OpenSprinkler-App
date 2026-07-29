#!/usr/bin/env node
/**
 * Live fixture capture — read a real controller's JSON endpoints and write them as the contract
 * redacted, version-scoped fixtures for contract inspection. It never overwrites the curated corpus
 * and never writes controller credentials or identifying network/location data. READ-ONLY: never
 * sends a change command.
 *
 * Set OS_BASE and either OS_PW or OS_PWHASH securely in the environment before running
 * `npm run capture`; credentials in process arguments are refused. Firmware before 2.1.3 requires
 * the exact, independently verified version in OS_FWV before OS_PW may be sent in cleartext.
 *
 * OS_PW is md5-hashed by default. OS_PWHASH must already be a 32-character MD5 value.
 */
import { mkdir, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseTrustedFirmware, resolveCaptureAuthentication } from "./capture-auth.mjs";
import { assertRedactedFixture, redactFixture } from "./fixture-redaction.mjs";
import { publishPrivateDirectory } from "./capture-output.mjs";

function arg( name ) {
	const i = process.argv.indexOf( `--${ name }` );
	return i >= 0 ? process.argv[ i + 1 ] : undefined;
}

const rawBase = arg( "base" ) || process.env.OS_BASE || "";
const passwordHash = process.env.OS_PWHASH;
const pw = process.env.OS_PW;
let trustedFwv;
try {
	trustedFwv = parseTrustedFirmware( process.env.OS_FWV );
} catch ( error ) {
	console.error( error.message );
	process.exit( 1 );
}
const repositoryRoot = join( dirname( fileURLToPath( import.meta.url ) ), ".." );
const curatedRoot = join( repositoryRoot, "test", "fixtures", "api" );
const capturedRoot = join( curatedRoot, "captured" );
const requestedOut = arg( "out" );
const requestedOutDir = requestedOut ? resolve( requestedOut ) : undefined;

if ( arg( "pw" ) !== undefined || arg( "pwhash" ) !== undefined ) {
	console.error( "Refusing credentials in process arguments; use OS_PW or OS_PWHASH in the environment." );
	process.exit( 1 );
}

if ( requestedOutDir ) {
	const relativeToCurated = relative( curatedRoot, requestedOutDir );
	const relativeToCaptured = relative( capturedRoot, requestedOutDir );
	const insideCurated = relativeToCurated === "" || ( relativeToCurated !== ".." && !relativeToCurated.startsWith( `..${ sep }` ) );
	const insideCapturedVersion = relativeToCaptured !== "" && relativeToCaptured !== ".." && !relativeToCaptured.startsWith( `..${ sep }` );
	if ( insideCurated && !insideCapturedVersion ) {
		console.error( `Refusing to write into the curated fixture corpus: ${ requestedOutDir }` );
		process.exit( 1 );
	}
}

if ( !rawBase ) {
	console.error( "usage: set OS_PW or OS_PWHASH securely, then run npm run capture -- --base http://<device-ip>/" );
	process.exit( 1 );
}

let base;
try {
	const parsed = new URL( rawBase );
	if ( ![ "http:", "https:" ].includes( parsed.protocol ) || parsed.username || parsed.password ) throw new Error();
	parsed.search = "";
	parsed.hash = "";
	if ( !parsed.pathname.endsWith( "/" ) ) parsed.pathname += "/";
	base = parsed.href;
} catch {
	console.error( "Controller base must be an HTTP(S) URL without embedded credentials." );
	process.exit( 1 );
}

async function getJson( path, credential ) {
	const sep = path.includes( "?" ) ? "&" : "?";
	const url = base + path + ( credential ? `${ sep }pw=${ encodeURIComponent( credential ) }` : "" );
	const controller = new AbortController();
	const timeout = setTimeout( () => controller.abort(), 10000 );
	try {
		let res;
		try {
			res = await fetch( url, { headers: { Accept: "application/json" }, signal: controller.signal } );
		} catch ( error ) {
			if ( error && error.name === "AbortError" ) throw new Error( `${ path }: request timed out after 10000ms` );
			throw new Error( `${ path }: request failed` );
		}
		if ( !res.ok ) throw new Error( `${ path }: HTTP ${ res.status }` );
		try {
			return await res.json();
		} catch ( error ) {
			if ( error && error.name === "AbortError" ) throw new Error( `${ path }: request timed out after 10000ms` );
			throw new Error( `${ path }: invalid JSON response` );
		}
	} finally {
		clearTimeout( timeout );
	}
}

// Always probe without credentials. The response may select hashed auth but can never authorize a
// cleartext downgrade; only an exact OS_FWV pin from trusted local configuration can do that.
const probe = await getJson( "jo", "" );
let auth;
try {
	auth = resolveCaptureAuthentication( { probe, trustedFwv, password: pw, passwordHash } );
} catch ( error ) {
	console.error( error.message );
	process.exit( 1 );
}
const { fwv, credential } = auth;

const outDir = requestedOutDir
	? requestedOutDir
	: join( capturedRoot, String( fwv || "unknown" ) );
await mkdir( outDir, { recursive: true } );
const [ realOut, realCurated ] = await Promise.all( [ realpath( outDir ), realpath( curatedRoot ) ] );
const expectedCaptured = join( realCurated, "captured" );
const realCaptured = await realpath( capturedRoot ).catch( () => expectedCaptured );
const relCurated = relative( realCurated, realOut );
const relCaptured = relative( realCaptured, realOut );
const insideRealCurated = relCurated === "" || ( relCurated !== ".." && !relCurated.startsWith( `..${ sep }` ) );
const insideRealCapturedVersion = realCaptured === expectedCaptured && relCaptured !== "" &&
	relCaptured !== ".." && !relCaptured.startsWith( `..${ sep }` );
if ( insideRealCurated && !insideRealCapturedVersion ) {
	console.error( `Refusing a symlink-resolved output inside the curated fixture corpus: ${ realOut }` );
	process.exit( 1 );
}

// Minimal shape checks so a pre-auth stub (e.g. /jo -> {fwv} when the password is wrong) isn't
// silently written as a fixture that the contract test would then reject confusingly.
const looksValid = {
	jc: ( d ) => d && typeof d.devt === "number",
	jo: ( d ) => d && typeof d === "object" && Object.keys( d ).length > 2,
	jn: ( d ) => d && Array.isArray( d.snames ),
	jp: ( d ) => d && Array.isArray( d.pd ),
	// A controller with no runs in the requested window legitimately returns an empty array.
	jl: ( d ) => Array.isArray( d ) && d.every( ( row ) => Array.isArray( row ) && row.length >= 4 ),
	js: ( d ) => d && Array.isArray( d.sn ),
};

let ok = 0;
const prepared = {};
let controllerNow;
try {
	const data = await getJson( "jc", credential );
	if ( !looksValid.jc( data ) ) throw new Error( "response failed the shape check (auth/pre-auth stub?)" );
	controllerNow = data.devt;
	const redacted = redactFixture( "jc", data );
	assertRedactedFixture( redacted );
	prepared[ "jc.fixture.json" ] = JSON.stringify( redacted ) + "\n";
	console.log( "  prepared + redacted /jc" );
	ok++;
} catch ( e ) {
	console.error( `  skip /jc: ${ e.message }` );
}
const endpoints = controllerNow === undefined ? {} : {
	jo: "jo", jn: "jn", jp: "jp",
	jl: `jl?start=${ Math.max( 0, controllerNow - 7 * 86400 ) }&end=${ controllerNow }`, js: "js",
};
for ( const [ ep, requestPath ] of Object.entries( endpoints ) ) {
	try {
		const data = await getJson( requestPath, credential );
		if ( !looksValid[ ep ]( data ) ) {
			console.error( `  skip /${ ep }: response failed the shape check (auth/pre-auth stub?) — not written` );
			continue;
		}
		const redacted = redactFixture( ep, data );
		assertRedactedFixture( redacted );
		prepared[ `${ ep }.fixture.json` ] = JSON.stringify( redacted ) + "\n";
		console.log( `  prepared + redacted /${ ep }` );
		ok++;
	} catch ( e ) {
		console.error( `  skip /${ ep }: ${ e.message }` );
	}
}
console.log( `\nCaptured ${ ok }/6 endpoints (fwv ${ fwv }) -> ${ outDir }` );
if ( ok !== 6 ) {
	console.error( "Capture incomplete: all six endpoints are required; the previous generation was left untouched." );
	process.exitCode = 1;
} else {
	await publishPrivateDirectory( outDir, prepared );
	console.log( "Published one complete generation. Curated fixtures were not modified; review before committing." );
}

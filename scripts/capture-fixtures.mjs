#!/usr/bin/env node
/**
 * Live fixture capture — read a real controller's JSON endpoints and write them as the contract
 * fixtures, so test/api-contract.spec.ts pins the ACTUAL wire format (one set per fwv) instead of
 * the derived-from-source defaults. READ-ONLY: never sends a change command.
 *
 *   npm run capture -- --base http://192.168.1.50/ --pw 'opendoor'
 *   npm run capture -- --base http://192.168.1.50/ --pwhash <md5>
 *   OS_BASE=http://...  OS_PW=...  npm run capture
 *
 * The password is md5-hashed for fwv>=213 (matching the firmware); pass --pwhash to skip hashing.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function arg( name ) {
	const i = process.argv.indexOf( `--${ name }` );
	return i >= 0 ? process.argv[ i + 1 ] : undefined;
}

const base = ( arg( "base" ) || process.env.OS_BASE || "" ).replace( /\/?$/, "/" );
let pwhash = arg( "pwhash" ) || process.env.OS_PWHASH;
const pw = arg( "pw" ) ?? process.env.OS_PW;

if ( !base ) {
	console.error( "usage: npm run capture -- --base http://<device-ip>/ [--pw <password> | --pwhash <md5>]" );
	process.exit( 1 );
}

const md5 = ( s ) => createHash( "md5" ).update( s ).digest( "hex" );

async function getJson( path ) {
	const sep = path.includes( "?" ) ? "&" : "?";
	const url = base + path + ( pwhash ? `${ sep }pw=${ encodeURIComponent( pwhash ) }` : "" );
	const res = await fetch( url, { headers: { Accept: "application/json" } } );
	if ( !res.ok ) throw new Error( `${ path }: HTTP ${ res.status } ${ res.statusText }` );
	return res.json();
}

// Probe /jo pre-auth for fwv, then choose md5 vs cleartext auth (firmware hashes for fwv>=213).
const probe = await getJson( "jo" );
const fwv = typeof probe.fwv === "number" ? probe.fwv : 0;
if ( !pwhash && pw !== undefined ) pwhash = fwv >= 213 ? md5( pw ) : pw;

const outDir = join( dirname( fileURLToPath( import.meta.url ) ), "..", "test", "fixtures", "api" );
await mkdir( outDir, { recursive: true } );

// Minimal shape checks so a pre-auth stub (e.g. /jo -> {fwv} when the password is wrong) isn't
// silently written as a fixture that the contract test would then reject confusingly.
const looksValid = {
	jc: ( d ) => d && typeof d.devt === "number",
	jo: ( d ) => d && typeof d === "object" && Object.keys( d ).length > 2,
	jn: ( d ) => d && Array.isArray( d.snames ),
	jp: ( d ) => d && Array.isArray( d.pd ),
	jl: ( d ) => Array.isArray( d ),
	js: ( d ) => d && Array.isArray( d.sn ),
};

let ok = 0;
for ( const ep of [ "jc", "jo", "jn", "jp", "jl", "js" ] ) {
	try {
		const data = await getJson( ep );
		if ( !looksValid[ ep ]( data ) ) {
			console.error( `  skip /${ ep }: response failed the shape check (auth/pre-auth stub?) — not written` );
			continue;
		}
		await writeFile( join( outDir, `${ ep }.fixture.json` ), JSON.stringify( data ) + "\n" );
		console.log( `  captured /${ ep }` );
		ok++;
	} catch ( e ) {
		console.error( `  skip /${ ep }: ${ e.message }` );
	}
}
console.log( `\nCaptured ${ ok }/6 endpoints (fwv ${ fwv }) -> ${ outDir }` );
console.log( "Next: npm run test:contract  # re-pin the contract against this live capture" );

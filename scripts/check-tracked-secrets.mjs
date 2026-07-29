#!/usr/bin/env node
/** High-confidence repository secret guard. Complements provider-side secret scanning. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const files = execFileSync( "git", [ "ls-files", "-co", "--exclude-standard", "-z" ], {
	encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
} ).split( "\0" ).filter( Boolean );

const forbiddenValues = [
	{ label: "private key material", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/ },
	{ label: "GitHub token", pattern: /\bgh[opusr]_[A-Za-z0-9_]{30,}\b/ },
	{ label: "GitHub fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
	{ label: "Docker access token", pattern: /\bdckr_pat_[A-Za-z0-9_-]{20,}\b/ },
	{ label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
	{ label: "OpenAI API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
];
const secretFile = /(?:^|\/)(?:\.env(?:\..+)?|[^/]+\.(?:key|pem|p8|p12|pfx|jks|keystore|mobileprovision|provisionprofile))$/i;
const failures = [];

for ( const file of files ) {
	if ( secretFile.test( file ) && basename( file ) !== ".env.example" ) {
		failures.push( `${ file }: tracked/generated secret-bearing filename` );
	}
	let bytes;
	try { bytes = readFileSync( file ); } catch { continue; }
	if ( bytes.includes( 0 ) ) continue;
	const text = bytes.toString( "utf8" );
	for ( const rule of forbiddenValues ) {
		if ( rule.pattern.test( text ) ) failures.push( `${ file }: ${ rule.label }` );
	}
	if ( basename( file ) === ".env.example" ) {
		for ( const line of text.split( /\r?\n/ ) ) {
			const match = /^(?:CONTROLLER_PW|API_TOKEN|OS_(?:LIVE_)?PW)=(.*)$/.exec( line );
			if ( match?.[ 1 ]?.trim() ) failures.push( `${ file}: example credential must be blank` );
		}
	}
}

if ( failures.length ) {
	console.error( "Secret scan failed:\n" + [ ...new Set( failures ) ].map( ( failure ) => `  - ${ failure }` ).join( "\n" ) );
	process.exitCode = 1;
} else {
	console.log( `Secret scan passed (${ files.length } repository files).` );
}

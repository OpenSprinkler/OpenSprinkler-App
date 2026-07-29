#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const repositoryRoot = resolve( dirname( fileURLToPath( import.meta.url ) ), ".." );
const budgetFileName = "bundle-size-budget.json";
const requiredGrowthPercent = 10;
const requiredGzipLevel = 9;

function isObject( value ) {
	return typeof value === "object" && value !== null && !Array.isArray( value );
}

function parseBudget( source, sourcePath ) {
	let budget;
	try {
		budget = JSON.parse( source );
	} catch ( error ) {
		throw new Error( `Unable to parse ${ sourcePath }: ${ error.message }` );
	}

	if ( !isObject( budget ) || budget.schemaVersion !== 1 ) {
		throw new Error( `${ sourcePath } must use bundle-size budget schemaVersion 1.` );
	}
	if ( budget.compression?.algorithm !== "gzip" || budget.compression?.level !== requiredGzipLevel ) {
		throw new Error( `${ sourcePath } must use deterministic gzip compression at level ${ requiredGzipLevel }.` );
	}
	if ( budget.maximumGrowthPercent !== requiredGrowthPercent ) {
		throw new Error( `${ sourcePath } must enforce a maximum ${ requiredGrowthPercent }% bundle-size increase.` );
	}
	if ( !Array.isArray( budget.assets ) || budget.assets.length === 0 ) {
		throw new Error( `${ sourcePath } must define at least one bundle asset.` );
	}

	const paths = new Set();
	for ( const asset of budget.assets ) {
		if ( !isObject( asset ) || typeof asset.path !== "string" || asset.path.length === 0 ) {
			throw new Error( `${ sourcePath } contains a bundle asset without a path.` );
		}
		if ( isAbsolute( asset.path ) || asset.path.split( /[\\/]+/ ).includes( ".." ) ) {
			throw new Error( `${ sourcePath } contains an unsafe bundle asset path: ${ asset.path }.` );
		}
		if ( paths.has( asset.path ) ) {
			throw new Error( `${ sourcePath } contains a duplicate bundle asset path: ${ asset.path }.` );
		}
		if ( !Number.isSafeInteger( asset.baselineBytes ) || asset.baselineBytes < 1 ) {
			throw new Error( `${ sourcePath } contains an invalid baselineBytes value for ${ asset.path }.` );
		}
		paths.add( asset.path );
	}

	return budget;
}

export function deterministicGzipSize( contents ) {
	return gzipSync( contents, { level: requiredGzipLevel } ).byteLength;
}

export function evaluateBundleSize( path, baselineBytes, actualBytes, maximumGrowthPercent = requiredGrowthPercent ) {
	const limitBytes = Math.floor( baselineBytes * ( 1 + maximumGrowthPercent / 100 ) );
	return {
		path,
		baselineBytes,
		actualBytes,
		limitBytes,
		changePercent: ( ( actualBytes - baselineBytes ) / baselineBytes ) * 100,
		passed: actualBytes <= limitBytes,
	};
}

function formatChange( changePercent ) {
	const prefix = changePercent >= 0 ? "+" : "";
	return `${ prefix }${ changePercent.toFixed( 2 ) }%`;
}

export async function checkBundleSizeBudget( options = {} ) {
	const root = resolve( options.repositoryRoot ?? repositoryRoot );
	const budgetPath = resolve( options.budgetPath ?? resolve( root, budgetFileName ) );
	const logger = options.logger ?? console.log;
	const budget = parseBudget( await readFile( budgetPath, "utf8" ), budgetPath );
	const results = [];

	for ( const asset of budget.assets ) {
		const assetPath = resolve( root, asset.path );
		const pathFromRoot = relative( root, assetPath );
		if ( isAbsolute( pathFromRoot ) || pathFromRoot === ".." || pathFromRoot.startsWith( `..${ sep }` ) ) {
			throw new Error( `Bundle asset resolves outside the repository: ${ asset.path }.` );
		}

		let contents;
		try {
			contents = await readFile( assetPath );
		} catch ( error ) {
			if ( error?.code === "ENOENT" ) {
				throw new Error(
					`Bundle asset ${ asset.path } was not found. Run npm run build:app before npm run check:bundle-size.`,
				);
			}
			throw error;
		}
		results.push( evaluateBundleSize(
			asset.path,
			asset.baselineBytes,
			deterministicGzipSize( contents ),
			budget.maximumGrowthPercent,
		) );
	}

	logger(
		`Production bundle budget (gzip level ${ requiredGzipLevel }; maximum growth ${ requiredGrowthPercent }%):`,
	);
	for ( const result of results ) {
		logger(
			`  ${ result.passed ? "PASS" : "FAIL" } ${ result.path }: ${ result.actualBytes } bytes `
			+ `(baseline ${ result.baselineBytes }; limit ${ result.limitBytes }; ${ formatChange( result.changePercent ) })`,
		);
	}

	const failures = results.filter( ( result ) => !result.passed );
	if ( failures.length > 0 ) {
		const details = failures.map( ( result ) =>
			`${ result.path } is ${ result.actualBytes } gzip bytes (${ formatChange( result.changePercent ) }); `
			+ `the limit is ${ result.limitBytes } bytes.`
		).join( "\n" );
		throw new Error(
			`Bundle size budget exceeded:\n${ details }\n`
			+ `Reduce the bundle, or if the growth is intentional, update baselineBytes in ${ budgetFileName } `
			+ "and explain the increase in the pull request.",
		);
	}

	return results;
}

if ( process.argv[ 1 ] && import.meta.url === pathToFileURL( resolve( process.argv[ 1 ] ) ).href ) {
	checkBundleSizeBudget().catch( ( error ) => {
		console.error( error instanceof Error ? error.message : String( error ) );
		process.exitCode = 1;
	} );
}

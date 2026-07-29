import { chmod, lstat, mkdir, mkdtemp, open, rename, rm, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

/** Atomically replace a regular capture file without ever following a leaf symlink. */
export async function writePrivateFile( outputPath, content ) {
	const temporary = join( dirname( outputPath ), `.${ basename( outputPath ) }.${ randomUUID() }.tmp` );
	try {
		await writeFile( temporary, content, { flag: "wx", mode: 0o600 } );
		await chmod( temporary, 0o600 );
		const existing = await lstat( outputPath ).catch( ( error ) => {
			if ( error?.code === "ENOENT" ) return null;
			throw error;
		} );
		if ( existing?.isSymbolicLink() ) throw new Error( `Refusing to replace symlink: ${ outputPath }` );
		if ( existing && !existing.isFile() ) throw new Error( `Refusing to replace non-file: ${ outputPath }` );
		await rename( temporary, outputPath );
	} finally {
		await unlink( temporary ).catch( ( error ) => {
			if ( error?.code !== "ENOENT" ) throw error;
		} );
	}
}

/** Stage and publish one complete fixture generation under an exclusive per-version lock. */
export async function publishPrivateDirectory( outputDir, entries ) {
	const parent = dirname( outputDir );
	await mkdir( parent, { recursive: true } );
	const stage = await mkdtemp( join( parent, `.${ basename( outputDir ) }.stage-` ) );
	const lockPath = `${ outputDir }.lock`;
	const backup = join( parent, `.${ basename( outputDir ) }.backup-${ randomUUID() }` );
	let lock;
	let movedExisting = false;
	let published = false;
	try {
		for ( const [ name, content ] of Object.entries( entries ) ) {
			if ( basename( name ) !== name || !/^[a-z0-9.-]+$/i.test( name ) ) throw new Error( `Invalid capture filename: ${ name }` );
			await writePrivateFile( join( stage, name ), content );
		}
		try { lock = await open( lockPath, "wx", 0o600 ); }
		catch ( error ) {
			if ( error?.code === "EEXIST" ) throw new Error( `Another capture is publishing to ${ outputDir }` );
			throw error;
		}
		const existing = await lstat( outputDir ).catch( ( error ) => {
			if ( error?.code === "ENOENT" ) return null;
			throw error;
		} );
		if ( existing?.isSymbolicLink() ) throw new Error( `Refusing to replace symlink: ${ outputDir }` );
		if ( existing && !existing.isDirectory() ) throw new Error( `Refusing to replace non-directory: ${ outputDir }` );
		if ( existing ) { await rename( outputDir, backup ); movedExisting = true; }
		try {
			await rename( stage, outputDir );
			published = true;
		} catch ( error ) {
			if ( movedExisting ) { await rename( backup, outputDir ); movedExisting = false; }
			throw error;
		}
		if ( movedExisting ) { await rm( backup, { recursive: true, force: true } ); movedExisting = false; }
	} finally {
		await lock?.close();
		if ( lock ) await unlink( lockPath ).catch( () => undefined );
		if ( !published ) await rm( stage, { recursive: true, force: true } );
	}
}

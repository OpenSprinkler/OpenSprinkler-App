import { createHash } from "node:crypto";

const MD5_HEX = /^[0-9a-f]{32}$/i;

function md5( value ) {
	return createHash( "md5" ).update( value ).digest( "hex" );
}

/** Parse the operator's trusted, exact firmware pin. */
export function parseTrustedFirmware( raw ) {
	if ( raw === undefined ) return undefined;
	if ( !/^[1-9]\d*$/.test( raw ) ) throw new Error( "OS_FWV must be an integer from 1 to 9999" );
	const value = Number( raw );
	if ( !Number.isSafeInteger( value ) || value > 9999 ) {
		throw new Error( "OS_FWV must be an integer from 1 to 9999" );
	}
	return value;
}

/**
 * Resolve fixture-capture authentication without allowing an unauthenticated probe to downgrade
 * OS_PW to the legacy cleartext protocol. OS_FWV is trusted local configuration; /jo is not.
 */
export function resolveCaptureAuthentication( { probe, trustedFwv, password, passwordHash } ) {
	const probedFwv = typeof probe?.fwv === "number" && Number.isSafeInteger( probe.fwv ) &&
		probe.fwv > 0 && probe.fwv <= 9999 ? probe.fwv : undefined;
	if ( trustedFwv !== undefined && probedFwv !== undefined && trustedFwv !== probedFwv ) {
		throw new Error( `OS_FWV does not match the pre-auth probe (${ trustedFwv } != ${ probedFwv })` );
	}
	const fwv = probedFwv ?? trustedFwv;
	if ( fwv === undefined ) throw new Error( "controller /jo response did not include a valid firmware version; set a verified OS_FWV pin" );
	if ( password !== undefined && passwordHash !== undefined ) {
		throw new Error( "Set only one of OS_PW or OS_PWHASH" );
	}
	if ( passwordHash !== undefined ) {
		if ( !MD5_HEX.test( passwordHash ) ) throw new Error( "OS_PWHASH must be exactly 32 hexadecimal MD5 characters" );
		return { fwv, credential: passwordHash.toLowerCase() };
	}
	if ( password === undefined ) return { fwv, credential: "" };
	if ( fwv < 213 && trustedFwv !== fwv ) {
		throw new Error(
			`refusing unpinned legacy cleartext authentication; set OS_FWV=${ fwv } only after verifying the controller firmware`,
		);
	}
	return { fwv, credential: fwv >= 213 ? md5( password ) : password };
}

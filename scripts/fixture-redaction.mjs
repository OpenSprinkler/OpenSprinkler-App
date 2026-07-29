function redactString( value = "" ) { return value === "" ? "" : "<redacted>"; }
function hasOwn( value, key ) { return Object.prototype.hasOwnProperty.call( value, key ); }

const SECRET_KEY = /^(?:key|.*(?:pass(?:word)?|pwd|pwhash|token|secret|key|auth|credential).*)$/i;
const IDENTITY_KEY = /^(?:mac|loc|lat(?:itude)?|lon(?:gitude)?|coord(?:inates)?|ssid|name|user(?:name)?|recipient|email|dname|device[_-]?name|host|server|url|endpoint|address)$/i;
const NETWORK_KEY = /^(?:e?ip\d*|gw\d*|subn\d*|dns\d*|ntp\d*)$/i;
const TIME_KEY = /^(?:devt|lwc|lswc|lupt|lrbtc|rdst|.*(?:timestamp|_ts|updatedAt|createdAt|lastSeen|lastRun))$/i;
const PRIVATE_IP = /(?:^|[^\d])(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?:$|[^\d])/;
const EMAIL = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;
const MAC = /(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i;

function scrubUnknownSensitiveFields( value ) {
	if ( Array.isArray( value ) ) {
		value.forEach( scrubUnknownSensitiveFields );
		return;
	}
	if ( !value || typeof value !== "object" ) return;
	for ( const [ key, item ] of Object.entries( value ) ) {
		if ( SECRET_KEY.test( key ) ) {
			value[ key ] = typeof item === "string" ? redactString( item ) : item == null ? item : {};
			continue;
		}
		if ( NETWORK_KEY.test( key ) ) {
			value[ key ] = typeof item === "number" ? 0 : typeof item === "string" ? redactString( item ) : item;
			continue;
		}
		if ( IDENTITY_KEY.test( key ) ) {
			value[ key ] = typeof item === "string" ? redactString( item ) : typeof item === "number" ? 0 : item == null ? item : {};
			continue;
		}
		if ( TIME_KEY.test( key ) && typeof item === "number" ) {
			value[ key ] = 0;
			continue;
		}
		if ( typeof item === "string" && ( PRIVATE_IP.test( item ) || EMAIL.test( item ) || MAC.test( item ) ) ) {
			value[ key ] = redactString( item );
			continue;
		}
		scrubUnknownSensitiveFields( item );
	}
}

/** Refuse to write if a future firmware field survives the generic fail-closed scrubber. */
export function assertRedactedFixture( value ) {
	function inspect( item, path ) {
		if ( Array.isArray( item ) ) return item.forEach( ( child, index ) => inspect( child, `${ path }[${ index }]` ) );
		if ( !item || typeof item !== "object" ) return;
		for ( const [ key, child ] of Object.entries( item ) ) {
			const childPath = path ? `${ path }.${ key }` : key;
			if ( SECRET_KEY.test( key ) && child !== "" && child !== "<redacted>" &&
				!( child && typeof child === "object" && Object.keys( child ).length === 0 ) ) {
				throw new Error( `Sensitive field was not redacted: ${ childPath }` );
			}
			if ( IDENTITY_KEY.test( key ) && child !== "" && child !== "<redacted>" && child !== 0 && child != null &&
				!( child && typeof child === "object" && Object.keys( child ).length === 0 ) ) {
				throw new Error( `Identifying field was not redacted: ${ childPath }` );
			}
			if ( TIME_KEY.test( key ) && typeof child === "number" && child !== 0 ) {
				throw new Error( `Activity timestamp was not redacted: ${ childPath }` );
			}
			if ( typeof child === "string" && ( PRIVATE_IP.test( child ) || EMAIL.test( child ) || MAC.test( child ) ) ) {
				throw new Error( `Identifying value was not redacted: ${ childPath }` );
			}
			inspect( child, childPath );
		}
	}
	inspect( value, "" );
	return value;
}

/** Preserve endpoint shape/types while removing credentials, identity, location, and activity time. */
export function redactFixture( endpoint, input ) {
	const data = JSON.parse( JSON.stringify( input ) );
	if ( endpoint === "jc" ) {
		if ( hasOwn( data, "mac" ) ) data.mac = "00:00:00:00:00:00";
		if ( hasOwn( data, "loc" ) ) data.loc = "0,0";
		if ( hasOwn( data, "eip" ) ) data.eip = typeof data.eip === "number" ? 0 : "0.0.0.0";
		if ( hasOwn( data, "dname" ) ) data.dname = "Captured Controller";
		for ( const key of [ "jsp", "wsp", "ifkey" ] ) if ( hasOwn( data, key ) ) data[ key ] = redactString( data[ key ] );
		if ( hasOwn( data, "wto" ) ) {
			data.wto = data.wto && typeof data.wto === "object" ? { ...data.wto } : {};
			for ( const key of [ "key", "pws" ] ) if ( hasOwn( data.wto, key ) ) data.wto[ key ] = redactString( data.wto[ key ] );
		}
		for ( const key of [ "devt", "lwc", "lswc", "lupt", "lrbtc", "rdst" ] ) {
			if ( typeof data[ key ] === "number" ) data[ key ] = 0;
		}
		if ( Array.isArray( data.lrun ) && data.lrun.length > 3 ) data.lrun[ 3 ] = 0;
		if ( Array.isArray( data.ps ) ) {
			for ( const row of data.ps ) if ( Array.isArray( row ) && row.length > 2 ) row[ 2 ] = 0;
		}
		for ( const key of [ "mqtt", "email", "otc" ] ) if ( hasOwn( data, key ) ) data[ key ] = {};
	}
	if ( endpoint === "jo" ) {
		if ( typeof data.devid === "number" ) data.devid = 0;
		for ( const key of Object.keys( data ) ) {
			if ( /^(?:ip|gw|subn|dns|ntp)\d+$/.test( key ) ) data[ key ] = 0;
		}
	}
	if ( endpoint === "jn" && Array.isArray( data.snames ) ) {
		data.snames = data.snames.map( ( _, index ) => `S${ String( index + 1 ).padStart( 2, "0" ) }` );
	}
	if ( endpoint === "jp" && Array.isArray( data.pd ) ) {
		data.pd = data.pd.map( ( program, index ) => {
			const copy = Array.isArray( program ) ? [ ...program ] : program;
			if ( Array.isArray( copy ) && typeof copy[ 5 ] === "string" ) copy[ 5 ] = `Program ${ index + 1 }`;
			return copy;
		} );
	}
	if ( endpoint === "jl" && Array.isArray( data ) ) {
		for ( const row of data ) if ( Array.isArray( row ) && row.length > 3 ) row[ 3 ] = 0;
	}
	scrubUnknownSensitiveFields( data );
	return assertRedactedFixture( data );
}

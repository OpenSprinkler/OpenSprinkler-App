/* global $ */

/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <http://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// Configure module
var OSApp = OSApp || {};
OSApp.Utils = OSApp.Utils || {};

// Transform keys to JSON names for 2.1.9+
OSApp.Utils.transformKeys = function( opt ) {
	if ( OSApp.Firmware.checkOSVersion( 219 ) ) {
		var renamedOpt = {};
		Object.keys( opt ).forEach( function( item ) {
			var name = item.match( /^o(\d+)$/ );

			if ( name && name[ 1 ] ) {
				renamedOpt[ Object.keys( OSApp.Constants.keyIndex ).find( function( index ) { return OSApp.Constants.keyIndex[ index ] === parseInt( name[ 1 ], 10 ); } ) ] = opt[ item ];
			} else {
				renamedOpt[ item ] = opt[ item ];
			}
		} );

		return renamedOpt;
	}

	return opt;
};

OSApp.Utils.transformKeysinString = function( co ) {
	var opt = {};
	co.split( "&" ).forEach( function( item ) {
		item = item.split( "=" );
		opt[ item[ 0 ] ] = item[ 1 ];
	} );
	opt = OSApp.Utils.transformKeys( opt );
	var arr = [];
	Object.keys( opt ).forEach( function( key ) { arr.push( key + "=" + opt[ key ] ); } );
	co = arr.join( "&" );
	return co;
};

OSApp.Utils.escapeJSON = function( json ) {
	const j = JSON.stringify( json );
	return j.substring(1, j.length-1); // remove the surrounding brackets for firmware
};

OSApp.Utils.unescapeJSON = function( string ) {
	return JSON.parse( "{" + string + "}" );
};

OSApp.Utils.isMD5 = function( pass ) {
	return /^[a-f0-9]{32}$/i.test( pass );
};

OSApp.Utils.sortByStation = function( a, b ) {
	if ( a.station < b.station ) {
		return -1;
	} else if ( a.station > b.station ) {
		return 1;
	} else {
		return 0;
	}
};

OSApp.Utils.getBitFromByte = function( byte, bit ) {
	return ( byte & ( 1 << bit ) ) !== 0;
};

OSApp.Utils.coerceFiniteNumber = function( value ) {
	if ( ( typeof value !== "number" && typeof value !== "string" ) ||
		( typeof value === "string" && value.trim() === "" ) ) {
		return undefined;
	}

	var number = Number( value );
	return isFinite( number ) ? number : undefined;
};

// Pad a single digit with a leading zero
OSApp.Utils.pad = function( number ) {
	var r = String( number );
	if ( r.length === 1 ) {
		r = "0" + r;
	}
	return r;
};

// Escape characters for HTML support
OSApp.Utils.htmlEscape = function( str ) {

	// FIXME: this is not an extensive list and should be rewritten to use native DOM js htmlEncode. see https://www.w3docs.com/snippets/javascript/how-to-html-encode-a-string.html
	return String( str )
		.replace( /&/g, "&amp;" )
		.replace( /"/g, "&quot;" )
		.replace( /'/g, "&#39;" )
		.replace( /</g, "&lt;" )
		.replace( />/g, "&gt;" );
};

// Generate export link for JSON data
OSApp.Utils.exportObj = function( ele, obj, subject ) {
	var exportLink = $( ele ).off( "click.exportObj" ),
		controllerDate = OSApp.Dates.currentControllerDate();
	obj = encodeURIComponent( JSON.stringify( obj ) );

	if ( OSApp.currentDevice.isFileCapable ) {
		exportLink.attr( {
			href: "data:text/json;charset=utf-8," + obj,
			download: "backup-" + OSApp.Dates.dateOnly( controllerDate ).replace( /\//g, "-" ) + ".json"
		} );
	} else {
		subject = subject || "OpenSprinkler Data Export on " + OSApp.Dates.dateToString( controllerDate );
		var href = "mailto:?subject=" + encodeURIComponent( subject ) + "&body=" + obj;
		exportLink.removeAttr( "download" ).attr( "href", href ).on( "click.exportObj", function() {
			window.open( href );
		} );
	}
};

OSApp.Utils.sortObj = function( obj, type ) {
	var tempArray = [];

	for ( var key in obj ) {
		if ( Object.prototype.hasOwnProperty.call(obj,  key ) ) {
			tempArray.push( key );
		}
	}

	if ( typeof type === "function" ) {
		tempArray.sort( type );
	} else if ( type === "value" ) {
		tempArray.sort( function( a, b ) {
			var x = obj[ a ];
			var y = obj[ b ];
			return ( ( x < y ) ? -1 : ( ( x > y ) ? 1 : 0 ) );
		} );
	} else {
		tempArray.sort();
	}

	var tempObj = {};

	for ( var i = 0; i < tempArray.length; i++ ) {
		tempObj[ tempArray[ i ] ] = obj[ tempArray[ i ] ];
	}

	return tempObj;
};

// Convert all elements in array to integer
OSApp.Utils.parseIntArray = function( arr ) {
	for ( var i = 0; i < arr.length; i++ ) {arr[ i ] = +arr[ i ];}
	return arr;
};

OSApp.Utils.isValidOTC = function( token ) {
	return /^OT[a-f0-9]{30}$/i.test( token );
};

OSApp.Utils.parseIPv4 = function( value ) {
	var parts = Array.isArray( value ) ? value : ( typeof value === "string" ? value.split( "." ) : [] );
	if ( parts.length !== 4 ) return null;

	var address = [];
	for ( var i = 0; i < parts.length; i++ ) {
		var part = parts[ i ];
		if ( typeof part === "string" ) {
			part = part.trim();
			if ( !/^\d{1,3}$/.test( part ) ) return null;
			part = Number( part );
		}
		if ( typeof part !== "number" || !Number.isInteger( part ) || part < 0 || part > 255 ) return null;
		address.push( part );
	}

	return address;
};

OSApp.Utils.getBasicAuthHeader = function( username, password ) {
	if ( typeof username !== "string" || typeof password !== "string" || username.indexOf( ":" ) !== -1 ||
		username.length > 2048 || password.length > 2048 ) return null;
	var value = username + ":" + password;
	try {
		return "Basic " + btoa( value );
	} catch ( error ) { // eslint-disable-line no-unused-vars
		try {
			var bytes = encodeURIComponent( value ).replace( /%([0-9A-F]{2})/g, function( match, hex ) {
				return String.fromCharCode( parseInt( hex, 16 ) );
			} );
			return "Basic " + btoa( bytes );
		} catch ( encodingError ) { // eslint-disable-line no-unused-vars
			return null;
		}
	}
};

OSApp.Utils.flowCountToVolume = function( count ) {
        return parseFloat( ( count * ( ( OSApp.currentSession.controller.options.fpr1 << 8 ) + OSApp.currentSession.controller.options.fpr0 ) / 100 ).toFixed( 2 ) );
};

// Convert flow rate (sensor pulses per minute) to volume per minute
OSApp.Utils.flowRateToVolume = function( rate ) {
       return parseFloat( ( rate * ( ( OSApp.currentSession.controller.options.fpr1 << 8 ) + OSApp.currentSession.controller.options.fpr0 ) / 100 ).toFixed( 2 ) );
};

/*
Returns true when currentSession.controller.settings is populated
*/
OSApp.Utils.isSessionValid = function() {
	return !$.isEmptyObject(OSApp.currentSession?.controller?.settings || {});
};

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
	opt = transformKeys( opt );
	var arr = [];
	Object.keys( opt ).forEach( function( key ) { arr.push( key + "=" + opt[ key ] ); } );
	co = arr.join( "&" );
	return co;
};

OSApp.Utils.escapeJSON = function( json ) {
	return JSON.stringify( json ).replace( /\{|\}/g, "" );
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
	obj = encodeURIComponent( JSON.stringify( obj ) );

	if ( OSApp.currentDevice.isFileCapable ) {
		$( ele ).attr( {
			href: "data:text/json;charset=utf-8," + obj,
			download: "backup-" + new Date().toLocaleDateString().replace( /\//g, "-" ) + ".json"
		} );
	} else {
		subject = subject || "OpenSprinkler Data Export on " + OSApp.Dates.dateToString( new Date() );
		var href = "mailto:?subject=" + encodeURIComponent( subject ) + "&body=" + obj;
		$( ele ).attr( "href", href ).on( "click", function() {
			window.open( href );
		} );
	}
};

OSApp.Utils.sortObj = function( obj, type ) {
	var tempArray = [];

	for ( var key in obj ) {
		if ( obj.hasOwnProperty( key ) ) {
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

OSApp.Utils.flowCountToVolume = function( count ) {
	return parseFloat( ( count * ( ( OSApp.currentSession.controller.options.fpr1 << 8 ) + OSApp.currentSession.controller.options.fpr0 ) / 100 ).toFixed( 2 ) );
}

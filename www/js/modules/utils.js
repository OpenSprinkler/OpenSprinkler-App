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

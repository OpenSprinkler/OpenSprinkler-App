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
OSApp.Storage = OSApp.Storage || {};

// Prefix to namespace localStorage keys by path. This allows the app to be
// served from different URLs under the same origin without clobbering each
// other's storage.
OSApp.Storage.prefix = ( function() {
       var path = window.location.pathname
               .replace(/\/index\.html$/, "")
               .replace(/\/$/, "");
       return path ? path + ":" : "";
} )();

OSApp.Storage._key = function( key ) {
       return OSApp.Storage.prefix + key;
};

OSApp.Storage.getItemSync = function( key ) {
       var value = localStorage.getItem( OSApp.Storage._key( key ) );
       if ( value === null && OSApp.Storage.prefix ) {
               value = localStorage.getItem( key );
       }
       return value;
};

OSApp.Storage.setItemSync = function( key, value ) {
       localStorage.setItem( OSApp.Storage._key( key ), value );
       if ( OSApp.Storage.prefix ) {
               localStorage.removeItem( key );
       }
};

OSApp.Storage.removeItemSync = function( key ) {
       localStorage.removeItem( OSApp.Storage._key( key ) );
       if ( OSApp.Storage.prefix ) {
               localStorage.removeItem( key );
       }
};

// Functions
OSApp.Storage.get = function( query, callback ) {
       callback = callback || function() {};
       var data = {},
               i;

       if ( typeof query === "string" ) {
               query = [ query ];
       }

       for ( i in query ) {
               if ( Object.prototype.hasOwnProperty.call( query, i ) ) {
                       data[ query[ i ] ] = OSApp.Storage.getItemSync( query[ i ] );
               }
       }

       callback( data );
};

OSApp.Storage.set = function( query, callback ) {
       callback = callback || function() {};
       var i;
       for ( i in query ) {
               if ( Object.prototype.hasOwnProperty.call( query, i ) ) {
                       OSApp.Storage.setItemSync( i, query[ i ] );
               }
       }

       callback( true );
};

OSApp.Storage.remove = function( query, callback ) {
       callback = callback || function() {};
       var i;

       if ( typeof query === "string" ) {
               query = [ query ];
       }

       for ( i in query ) {
               if ( Object.prototype.hasOwnProperty.call( query, i ) ) {
                       OSApp.Storage.removeItemSync( query[ i ] );
               }
       }

       callback( true );
};

OSApp.Storage.loadLocalSettings = function() {
	OSApp.Storage.get( "isMetric", function( data ) {

		// We are using a switch because the boolean gets stored as a string
		// and we don't want to impact the in-memory value of `isMetric` when
		// no value in local storage exists.
		switch ( data.isMetric ) {
			case "true":
				OSApp.currentDevice.isMetric = true;
				break;
			case "false":
				OSApp.currentDevice.isMetric = false;
				break;
			default:
		}
	} );
	OSApp.Storage.get( "is24Hour", function( data ) {
		switch ( data.is24Hour ) {
			case "true":
				OSApp.uiState.is24Hour = true;
				break;
			case "false":
				OSApp.uiState.is24Hour = false;
				break;
			default:
		}
	} );
	OSApp.Storage.get( "groupView", function( data ) {
		switch ( data.groupView ) {
			case "true":
				OSApp.uiState.groupView = true;
				break;
			case "false":
				OSApp.uiState.groupView = false;
				break;
			default:
		}
	} );
	OSApp.Storage.get( "sortByStationName", function( data ) {
		switch ( data.sortByStationName ) {
			case "true":
				OSApp.uiState.sortByStationName = true;
				break;
			case "false":
				OSApp.uiState.sortByStationName = false;
				break;
			default:
		}
	} );
};

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

// Generate a namespace based on the current URL path to avoid conflicts in reverse proxy setups
OSApp.Storage._getNamespace = function() {
	// Use the pathname to create a unique namespace for each app instance
	var pathname = window.location.pathname;
	// Remove trailing slash and replace slashes with underscores to create a valid key
	var namespace = pathname.replace(/\/$/, '').replace(/\//g, '_');
	// If we're at the root, use 'root' as the namespace
	if (!namespace || namespace === '_') {
		namespace = 'root';
	}
	return 'OSApp' + namespace + '_';
};

// Helper function to add namespace to a key
OSApp.Storage._namespacedKey = function( key ) {
	return OSApp.Storage._getNamespace() + key;
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
		if ( Object.prototype.hasOwnProperty.call(query,  i ) ) {
			data[ query[ i ] ] = localStorage.getItem( OSApp.Storage._namespacedKey( query[ i ] ) );
		}
	}

	callback( data );
};

OSApp.Storage.set = function( query, callback ) {
	callback = callback || function() {};
	var i;
	for ( i in query ) {
		if ( Object.prototype.hasOwnProperty.call(query,  i ) ) {
			localStorage.setItem( OSApp.Storage._namespacedKey( i ), query[ i ] );
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
		if ( Object.prototype.hasOwnProperty.call(query,  i ) ) {
			localStorage.removeItem( OSApp.Storage._namespacedKey( query[ i ] ) );
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
	OSApp.Storage.get( "showDisabled", function( data ) {
		switch ( data.showDisabled ) {
			case "true":
				OSApp.uiState.showDisabled = true;
				break;
			case "false":
				OSApp.uiState.showDisabled = false;
				break;
			default:
		}
	} );
	OSApp.Storage.get( "showStationNum", function( data ) {
		switch ( data.showStationNum ) {
			case "true":
				OSApp.uiState.showStationNum = true;
				break;
			case "false":
				OSApp.uiState.showStationNum = false;
				break;
			default:
		}
	} );
};

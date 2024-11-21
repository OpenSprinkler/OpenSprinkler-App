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

// Functions
OSApp.Storage.get = ( query, callback = () => void 0) => {
	var data = {},
		i;

	if ( typeof query === "string" ) {
		query = [ query ];
	}

	for ( i in query ) {
		if ( query.hasOwnProperty( i ) ) {
			data[ query[ i ] ] = localStorage.getItem( query[ i ] );
		}
	}

	callback( data );
};

OSApp.Storage.set = ( query, callback = () => void 0) => {
	var i;
	if ( typeof query === "object" ) {
		for ( i in query ) {
			if ( query.hasOwnProperty( i ) ) {
				localStorage.setItem( i, query[ i ] );
			}
		}
	}

	// callback( true ); mellodev this causes other functions that require a callback func arg to fail
	callback();
};

OSApp.Storage.remove = ( query, callback = () => void 0) => {
	var i;

	if ( typeof query === "string" ) {
		query = [ query ];
	}

	for ( i in query ) {
		if ( query.hasOwnProperty( i ) ) {
			localStorage.removeItem( query[ i ] );
		}
	}

	// callback( true ); mellodev this causes other functions that require a callback func arg to fail
	callback();
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
};

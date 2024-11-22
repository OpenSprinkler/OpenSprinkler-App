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
OSApp.Groups = OSApp.Groups || {};

/* Gid conversions */

// Last index value is dedicated to the parallel group
OSApp.Groups.mapIndexToGIDValue = function( index ) {
	return ( index - OSApp.Constants.options.NUM_SEQ_GROUPS ) ? index : OSApp.Constants.options.PARALLEL_GID_VALUE;
};

OSApp.Groups.mapGIDValueToName = function( value ) {
	switch ( value ) {
		case OSApp.Constants.options.PARALLEL_GID_VALUE:
			return OSApp.Constants.options.PARALLEL_GROUP_NAME;
		case OSApp.Constants.options.MASTER_GID_VALUE:
			return OSApp.Constants.options.MASTER_GROUP_NAME;
		default:
			return String.fromCharCode( 65 + value );
	}
};

OSApp.Groups.mapGIDNameToValue = function( groupName ) {
	switch ( groupName ) {
		case OSApp.Constants.options.PARALLEL_GROUP_NAME:
			return OSApp.Constants.options.PARALLEL_GID_VALUE;
		case OSApp.Constants.options.MASTER_GROUP_NAME:
			return OSApp.Constants.options.MASTER_GID_VALUE;
		default:
			return groupName.charCodeAt( 0 ) - 65;
	}
};

// Determines the number of station that are on or scheduled (active)
OSApp.Groups.numActiveStations = function( gid ) {
	var activeCards = $( ".station-status.on, .station-status.wait" ).parents( ".card" );
	var numMatchingCards = 0;

	$.each( activeCards, function( index ) {
		var activeCard = $( activeCards[ index ] );
		if ( OSApp.Cards.getGIDValue( activeCard ) === gid && !OSApp.Cards.isMasterStation( activeCard ) ) {
			numMatchingCards++;
		}
	} );

	return numMatchingCards;
};

// If more than 1 stations (includes the one to be turned off) are active
OSApp.Groups.canShift = function( gid ) {
	return OSApp.Groups.numActiveStations( gid ) > 1;
};

// tbh, not sure if this belongs here in groups.js (mellodev)
OSApp.Groups.calculateTotalRunningTime = function( runTimes ) {
	var sdt = OSApp.currentSession.controller.options.sdt,
		sequential, parallel;
	if ( OSApp.Supported.groups() ) {
		sequential = new Array( OSApp.Constants.options.NUM_SEQ_GROUPS ).fill( 0 );
		parallel = 0;
		var sequentialMax = 0;
		$.each( OSApp.currentSession.controller.stations.snames, function( i ) {
			var run = runTimes[ i ];
			var gid = OSApp.Stations.getGIDValue( i );
			if ( run > 0 ) {
				if ( gid !== OSApp.Constants.options.PARALLEL_GID_VALUE ) {
					sequential[ gid ] += ( run + sdt );
				} else {
					if ( run > parallel ) {
						parallel = run;
					}
				}
			}
		} );
		for ( var d = 0; d < OSApp.Constants.options.NUM_SEQ_GROUPS; d++ )	{
			if ( sequential[ d ] > sdt ) { sequential[ d ] -= sdt; }
			if ( sequential[ d ] > sequentialMax ) { sequentialMax = sequential[ d ]; }
		}
		return Math.max( sequentialMax, parallel );
	} else {
		sequential = 0;
		parallel = 0;
		$.each( OSApp.currentSession.controller.stations.snames, function( i ) {
			var run = runTimes[ i ];
			if ( run > 0 ) {
				if ( OSApp.Stations.isSequential( i ) ) {
					sequential += ( run + sdt );
				} else {
					if ( run > parallel ) {
						parallel = run;
					}
				}
			}
		} );
		if ( sequential > sdt ) { sequential -= sdt; } // Discount the last sdt
		return Math.max( sequential, parallel );
	}
};

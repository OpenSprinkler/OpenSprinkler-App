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
OSApp.StationAttributes = OSApp.StationAttributes || {};

// Determines if a station is bound to the master (masid)
OSApp.StationAttributes.getMasterOperation = function( sid, masid ) {
	var bid = ( sid / 8 ) >> 0,
		sourceMasterAttribute;

	if ( !OSApp.Supported.master( masid ) ) { return 0; }

	switch ( masid ) {
		case OSApp.Constants.options.MASTER_STATION_1:
			sourceMasterAttribute = OSApp.currentSession.controller.stations.masop;
			break;
		case OSApp.Constants.options.MASTER_STATION_2:
			sourceMasterAttribute = OSApp.currentSession.controller.stations.masop2;
			break;
		default:
			return 0;
	}

	var boardMasterAttribute = sourceMasterAttribute[ bid ],
		boardStationID = 1 << ( sid % 8 );

	return ( boardMasterAttribute & boardStationID ) ? 1 : 0;
};

OSApp.StationAttributes.getIgnoreRain = function( sid ) {
	if ( !OSApp.Supported.ignoreRain() ) { return 0; }
	var bid = ( sid / 8 ) >> 0,
		boardIgnoreRainAttribute = OSApp.currentSession.controller.stations.ignore_rain[ bid ],
		boardStationID = 1 << ( sid % 8 );

	return ( boardIgnoreRainAttribute & boardStationID ) ? 1 : 0;
};

OSApp.StationAttributes.getIgnoreSensor = function( sid, sensorID ) {
	var bid = ( sid / 8 ) >> 0,
		sourceIgnoreSensorAttribute;

	if ( !OSApp.Supported.ignoreSensor( sensorID ) ) { return 0; }

	switch ( sensorID ) {
		case OSApp.Constants.options.IGNORE_SENSOR_1:
			sourceIgnoreSensorAttribute = OSApp.currentSession.controller.stations.ignore_sn1;
			break;
		case OSApp.Constants.options.IGNORE_SENSOR_2:
			sourceIgnoreSensorAttribute = OSApp.currentSession.controller.stations.ignore_sn2;
			break;
		default:
			return 0;
	}

	var boardIgnoreSensorAttribute = sourceIgnoreSensorAttribute[ bid ],
		boardStationID = 1 << ( sid % 8 );

	return ( boardIgnoreSensorAttribute & boardStationID ) ? 1 : 0;
};

OSApp.StationAttributes.getActRelay = function( sid ) {
	if ( !OSApp.Supported.actRelay() ) { return 0; }
	var bid = ( sid / 8 ) >> 0,
		boardActRelayAttribute = OSApp.currentSession.controller.stations.act_relay[ bid ],
		boardStationID = 1 << ( sid % 8 );

	return ( boardActRelayAttribute & boardStationID ) ? 1 : 0;
};

OSApp.StationAttributes.getDisabled = function( sid ) {
	if ( !OSApp.Supported.disabled() ) { return 0; }
	var bid = ( sid / 8 ) >> 0,
		boardDisabledAttribute = OSApp.currentSession.controller.stations.stn_dis[ bid ],
		boardStationID = 1 << ( sid % 8 );

	return ( boardDisabledAttribute & boardStationID ) ? 1 : 0;
};

OSApp.StationAttributes.getSequential = function( sid ) {
	if ( OSApp.Supported.groups() ) {
		return OSApp.Stations.getGIDValue( sid ) !== OSApp.Constants.options.PARALLEL_GID_VALUE ? 1 : 0;
	}
	if ( !OSApp.Supported.sequential() ) { return 0; }
	var bid = ( sid / 8 ) >> 0,
		boardSequentialAttribute = OSApp.currentSession.controller.stations.stn_seq[ bid ],
		boardStationID = 1 << ( sid % 8 );

	return ( boardSequentialAttribute & boardStationID ) ? 1 : 0;
};

OSApp.StationAttributes.getSpecial = function( sid ) {
	if ( !OSApp.Supported.special() ) { return 0; }
	var bid = ( sid / 8 ) >> 0,
		boardSpecialAttribute = OSApp.currentSession.controller.stations.stn_spe[ bid ],
		boardStationID = 1 << ( sid % 8 );

	return ( boardSpecialAttribute & boardStationID ) ? 1 : 0;
};

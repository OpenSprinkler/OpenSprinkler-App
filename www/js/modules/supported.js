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
OSApp.Supported = OSApp.Supported || {};

/* Compatibility methods, verify that necessary data is
 * sent from the controller to the UI without explicitly
 * checking for OS version. */

OSApp.Supported.hasStationMask = function( name ) {
	var stations = OSApp.currentSession.controller && OSApp.currentSession.controller.stations,
		names = stations && stations.snames,
		mask = stations && stations[ name ],
		boardCount = Array.isArray( names ) ? Math.ceil( names.length / 8 ) : -1;

	return boardCount >= 0 && Array.isArray( mask ) && mask.length === boardCount && mask.every( function( value ) {
		return Number.isSafeInteger( value ) && value >= 0 && value <= 255;
	} );
};

OSApp.Supported.master = function( masid ) {
	var options = OSApp.currentSession.controller && OSApp.currentSession.controller.options || {},
		stations = OSApp.currentSession.controller && OSApp.currentSession.controller.stations,
		stationCount = stations && Array.isArray( stations.snames ) ? stations.snames.length : 0,
		masterStation,
		maskName;

	switch ( masid ) {
		case OSApp.Constants.options.MASTER_STATION_1:
			masterStation = options.mas;
			maskName = "masop";
			break;
		case OSApp.Constants.options.MASTER_STATION_2:
			masterStation = options.mas2;
			maskName = "masop2";
			break;
		default:
			return false;
	}

	return Number.isSafeInteger( masterStation ) && masterStation > 0 && masterStation <= stationCount &&
		OSApp.Supported.hasStationMask( maskName );
};

OSApp.Supported.ignoreRain = function() {
	return ( typeof OSApp.currentSession.controller.stations.ignore_rain === "object" ) ? true : false;
};

OSApp.Supported.ignoreSensor = function( sensorID ) {
	switch ( sensorID ) {
		case OSApp.Constants.options.IGNORE_SENSOR_1:
			return ( typeof OSApp.currentSession.controller.stations.ignore_sn1 === "object" ) ? true : false;
		case OSApp.Constants.options.IGNORE_SENSOR_2:
			return ( typeof OSApp.currentSession.controller.stations.ignore_sn2 === "object" ) ? true : false;
		default:
			return false;
	}
};

OSApp.Supported.actRelay = function() {
	return ( typeof OSApp.currentSession.controller.stations.act_relay === "object" ) ? true : false;
};

OSApp.Supported.disabled = function() {
	return ( typeof OSApp.currentSession.controller.stations.stn_dis === "object" ) ? true : false;
};

OSApp.Supported.sequential = function() {
	if ( OSApp.Firmware.checkOSVersion( 220 ) ) {
		return false;
	}
	return ( typeof OSApp.currentSession.controller.stations.stn_seq === "object" ) ? true : false;
};

OSApp.Supported.special = function() {
	return ( typeof OSApp.currentSession.controller.stations.stn_spe === "object" ) ? true : false;
};

OSApp.Supported.pausing = function() {
	return OSApp.currentSession.controller.settings.pq !== undefined;
};

OSApp.Supported.groups = function() {
	return OSApp.Stations.getNumberProgramStatusOptions() >= 4;
};

OSApp.Supported.dateRange = function() {
	return OSApp.Firmware.checkOSVersion( 220 );
};

OSApp.Supported.sensors = function() {
	return Array.isArray( OSApp.currentSession.controller?.sensors?.sn );
};

OSApp.Supported.changePause = function() {
	return OSApp.Firmware.checkOSVersion( 2211 );
};

OSApp.Supported.verifyWeatherAPIKey = function() {
	return OSApp.Firmware.checkOSVersion( 219 ) &&
			typeof OSApp.currentSession.controller.options.uwt !== "undefined" &&
			typeof OSApp.currentSession.controller.settings.wto === "object";
};

OSApp.Supported.singleRunAndMonthly = function() {
	return OSApp.Firmware.checkOSVersion( 2211 );
};

OSApp.Supported.repeatedRunonce = function() {
	return OSApp.Firmware.checkOSVersion( 2211 );
};

OSApp.Supported.restrictions = function() {
	const wto = typeof OSApp.currentSession.controller?.settings?.wto !== "undefined";
	return wto && OSApp.Firmware.checkOSVersion( 2213 );
};

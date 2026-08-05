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

OSApp.Supported.master = function( masid ) {
	switch ( masid ) {
		case OSApp.Constants.options.MASTER_STATION_1:
			return OSApp.currentSession.controller.options.mas ? true : false;
		case OSApp.Constants.options.MASTER_STATION_2:
			return OSApp.currentSession.controller.options.mas2 ? true : false;
		case OSApp.Constants.options.MASTER_STATION_3:
			return OSApp.currentSession.controller.options.mas3 ? true : false;
		case OSApp.Constants.options.MASTER_STATION_4:
			return OSApp.currentSession.controller.options.mas4 ? true : false;
		default:
			return false;
	}
};

OSApp.Supported.ignoreRain = function() {
	return ( typeof OSApp.currentSession.controller.stations.ignore_rain === "object" ) ? true : false;
};

OSApp.Supported.ignoreSensor = function( sensorID ) {
	if ( sensorID < OSApp.Constants.options.IGNORE_SENSOR_1 || sensorID > OSApp.Constants.options.IGNORE_SENSOR_4 ) {
		return false;
	}

	return typeof OSApp.currentSession.controller.stations[ "ignore_sn" + sensorID ] === "object";
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

OSApp.Supported.officialSensorAPIAllowed = function( controller ) {
	return !OSApp.Analog.checkAnalogSensorAvail( controller );
};

OSApp.Supported.legacySensorEndpoints = function( controller ) {
	return OSApp.Supported.officialSensorAPIAllowed( controller ) && OSApp.Firmware.checkOSVersion( 2215 );
};

OSApp.Supported.sensors = function() {
	return OSApp.Supported.officialSensorAPIAllowed() && Array.isArray( OSApp.currentSession.controller?.sensors?.sn );
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

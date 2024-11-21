/* global htmlEscape, checkConfigured, $ */

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
OSApp.Stations = OSApp.Stations || {};

/* Station accessor methods */
OSApp.Stations.Constants = {
	programStatusOptions: {
		PID: 0,
		REM: 1,
		START: 2,
		GID: 3
	}
};

OSApp.Stations.getNumberProgramStatusOptions = function() {
	if ( OSApp.currentSession.controller.settings.ps.length <= 0 ) {
		return undefined;
	}

	return OSApp.currentSession.controller.settings.ps[ 0 ].length;
};

OSApp.Stations.getName = function( sid ) {
	return OSApp.currentSession.controller.stations.snames[ sid ];
};

OSApp.Stations.setName = function( sid, value ) {
	OSApp.currentSession.controller.settings.snames[ sid ] = value;
};

OSApp.Stations.getPID = function( sid ) {
	return OSApp.currentSession.controller.settings.ps[ sid ][ OSApp.Stations.Constants.programStatusOptions.PID ];
};

OSApp.Stations.setPID = function( sid, value ) {
	OSApp.currentSession.controller.settings.ps[ sid ][ OSApp.Stations.Constants.programStatusOptions.PID ] = value;
};

OSApp.Stations.getRemainingRuntime = function( sid ) {
	return OSApp.currentSession.controller.settings.ps[ sid ][ OSApp.Stations.Constants.programStatusOptions.REM ];
};

OSApp.Stations.setRemainingRuntime = function( sid, value ) {
	OSApp.currentSession.controller.settings.ps[ sid ][ OSApp.Stations.Constants.programStatusOptions.REM ] = value;
};

OSApp.Stations.getStartTime = function( sid ) {
	return OSApp.currentSession.controller.settings.ps[ sid ][ OSApp.Stations.Constants.programStatusOptions.START ];
};

OSApp.Stations.setStartTime = function( sid, value ) {
	OSApp.currentSession.controller.settings.ps[ sid ][ OSApp.Stations.Constants.programStatusOptions.START ] = value;
};

OSApp.Stations.getGIDValue = function( sid ) {
	if ( !OSApp.Supported.groups() ) {
		return undefined;
	}
	return OSApp.currentSession.controller.settings.ps[ sid ][ OSApp.Stations.Constants.programStatusOptions.GID ];
};

OSApp.Stations.setGIDValue = function( sid, value ) {
	if ( !OSApp.Supported.groups() ) {
		return;
	}
	OSApp.currentSession.controller.settings.ps[ sid ][ OSApp.Stations.Constants.programStatusOptions.GID ] = value;
};

OSApp.Stations.getStatus = function( sid ) {
	return OSApp.currentSession.controller.status[ sid ];
};

OSApp.Stations.setStatus = function( sid, value ) {
	OSApp.currentSession.controller.status[ sid ] = value;
};

OSApp.Stations.isRunning = function( sid ) {
	return OSApp.Stations.getStatus( sid ) > 0;
};

OSApp.Stations.isMaster = function( sid ) {
	var m1 = typeof OSApp.currentSession.controller.options.mas === "number" ? OSApp.currentSession.controller.options.mas : 0,
		m2 = typeof OSApp.currentSession.controller.options.mas2 === "number" ? OSApp.currentSession.controller.options.mas2 : 0;

	sid++;

	if ( m1 === sid ) {
		return 1;
	} else if ( m2 === sid ) {
		return 2;
	} else {
		return 0;
	}
};

OSApp.Stations.isSequential = function( sid ) {
	return OSApp.StationAttributes.getSequential( sid ) > 0;
};

OSApp.Stations.isSpecial = function( sid ) {
	return OSApp.StationAttributes.getSpecial( sid ) > 0;
};

OSApp.Stations.isDisabled = function( sid )  {
	return OSApp.StationAttributes.getDisabled( sid ) > 0;
};

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
OSApp.StationQueue = OSApp.StationQueue || {};

OSApp.StationQueue.isActive = function() {
	for ( var i = 0; i < OSApp.currentSession.controller.status.length; i++ ) {
		if ( OSApp.Stations.getStatus( i ) > 0 && OSApp.Stations.getPID( i ) > 0 ) {
			return i;
		}
	}
	return -1;
};

OSApp.StationQueue.isPaused = function() {
	return OSApp.currentSession.controller.settings.pq;
};

OSApp.StationQueue.size = function() {
	return OSApp.currentSession.controller.settings.nq;
};

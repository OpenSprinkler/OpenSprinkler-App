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
OSApp.Logs = OSApp.Logs || {};

OSApp.Logs.clearLogs = function( callback = () => void 0 ) {
	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to clear ALL your log data?" ), "", function() {
		var url = OSApp.Firmware.isOSPi() ? "/cl?pw=" : "/dl?pw=&day=all";
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( url ).done( function() {
			if ( typeof callback === "function" ) {
				callback();
			}
			OSApp.Errors.showError( OSApp.Language._( "Logs have been cleared" ) );
		} );
	} );
};

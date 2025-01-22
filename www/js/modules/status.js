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
OSApp.Status = OSApp.Status || {};

// Current status related functions
OSApp.Status.refreshStatus = function( callback ) {
	callback = callback || function() {};
	if ( !OSApp.currentSession.isControllerConnected() ) {
		return;
	}

	var finish = function() {

		// Notify the page container that the data has refreshed
		$( "html" ).trigger( "datarefresh" );
		OSApp.Status.checkStatus();
		callback();
	};

	if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
		OSApp.Sites.updateController( finish, OSApp.Network.networkFail );
	} else {
		$.when(
			OSApp.Sites.updateControllerStatus(),
			OSApp.Sites.updateControllerSettings(),
			OSApp.Sites.updateControllerOptions()
		).then( finish, OSApp.Network.networkFail );
	}
};

// Actually change the status bar
OSApp.Status.changeStatus = function( seconds, color, line, onclick ) {
	onclick = onclick || function() {};
	var footer = $( "#footer-running" ),
		html = "";

	if ( seconds > 1 ) {
		OSApp.uiState.timers.statusbar = {
			val: seconds,
			type: "statusbar",
			update: function() {
				$( "#countdown" ).text( "(" + OSApp.Dates.sec2hms( this.val ) + " " + OSApp.Language._( "remaining" ) + ")" );
			}
		};
	}

	if ( OSApp.currentSession.isControllerConnected() && typeof OSApp.currentSession.controller.settings.curr !== "undefined" ) {
		html += OSApp.Language._( "Current" ) + ": " + OSApp.currentSession.controller.settings.curr + " mA ";
	}

	if (
		OSApp.currentSession.isControllerConnected() &&
		( OSApp.currentSession.controller.options.urs === 2 || OSApp.currentSession.controller.options.sn1t === 2 ) &&
		typeof OSApp.currentSession.controller.settings.flcrt !== "undefined" &&
		typeof OSApp.currentSession.controller.settings.flwrt !== "undefined"
	) {
		html += "<span style='padding-left:5px'>" + OSApp.Language._( "Flow" ) + ": " + ( OSApp.Utils.flowCountToVolume( OSApp.currentSession.controller.settings.flcrt ) / ( OSApp.currentSession.controller.settings.flwrt / 60 ) ).toFixed( 2 ) + " L/min</span>";
	}

	if ( html !== "" ) {
		html = line + "<p class='running-text smaller center'>" + html + "</p>";
	} else {
		html = line;
	}

	footer.removeClass().addClass( color ).html( html ).off( "click" ).on( "click", onclick );
};

// Update status bar based on device status
OSApp.Status.checkStatus = function() {
	var open, ptotal, sample, pid, pname, line, match, tmp, i;

	if ( !OSApp.currentSession.isControllerConnected() ) {
		OSApp.Status.changeStatus( 0, "transparent", "<p class='running-text smaller'></p>" );
		return;
	}

	// Handle controller configured as extender
	if ( OSApp.currentSession.controller.options.re === 1 ) {
		OSApp.Status.changeStatus( 0, "red", "<p class='running-text center pointer'>" + OSApp.Language._( "Configured as Extender" ) + "</p>", function() {
			OSApp.UIDom.areYouSure( OSApp.Language._( "Do you wish to disable extender mode?" ), "", function() {
				OSApp.UIDom.showLoading( "#footer-running" );
				OSApp.Firmware.sendToOS( "/cv?pw=&re=0" ).done( function() {
					OSApp.Sites.updateController();
				} );
			} );
		} );
		return;
	}

	// Handle operation disabled
	if ( !OSApp.currentSession.controller.settings.en ) {
		OSApp.Status.changeStatus( 0, "red", "<p class='running-text center pointer'>" + OSApp.Language._( "System Disabled" ) + "</p>", function() {
			OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to re-enable system operation?" ), "", function() {
				OSApp.UIDom.showLoading( "#footer-running" );
				OSApp.Firmware.sendToOS( "/cv?pw=&en=1" ).done( function() {
					OSApp.Sites.updateController();
				} );
			} );
		} );
		return;
	}

	// Handle queue paused
	if ( OSApp.currentSession.controller.settings.pq ) {
		line = "<p class='running-text center pointer'>" + OSApp.Language._( "Stations Currently Paused" );

		if ( OSApp.currentSession.controller.settings.pt ) {
			line += " <span id='countdown' class='nobr'>(" + OSApp.Dates.sec2hms( OSApp.currentSession.controller.settings.pt ) + " " + OSApp.Language._( "remaining" ) + ")</span>";
		}

		line += "</p>";

		OSApp.Status.changeStatus( OSApp.currentSession.controller.settings.pt || 0, "yellow", line, function() {
			OSApp.UIDom.showPause();
		} );

		return;
	}

	// Handle open stations
	open = {};
	for ( i = 0; i < OSApp.currentSession.controller.status.length; i++ ) {
		if ( OSApp.currentSession.controller.status[ i ] && !OSApp.Stations.isMaster( i ) ) {
			open[ i ] = OSApp.currentSession.controller.status[ i ];
		}
	}

	// Handle more than 1 open station
	if ( Object.keys( open ).length >= 2 ) {
		ptotal = 0;

		for ( i in open ) {
			if ( Object.prototype.hasOwnProperty.call(open,  i ) ) {
				tmp = OSApp.Stations.getRemainingRuntime( i );
				if ( tmp > ptotal ) {
					ptotal = tmp;
				}
			}
		}

		sample = Object.keys( open )[ 0 ];
		pid    = OSApp.Stations.getPID( sample );
		pname  = OSApp.Programs.pidToName( pid );
		line   = "<div><div class='running-icon'></div><div class='running-text pointer'>";

		line += pname + " " + OSApp.Language._( "is running on" ) + " " + Object.keys( open ).length + " " + OSApp.Language._( "stations" ) + " ";
		if ( ptotal > 0 ) {
			line += "<span id='countdown' class='nobr'>(" + OSApp.Dates.sec2hms( ptotal ) + " " + OSApp.Language._( "remaining" ) + ")</span>";
		}
		line += "</div></div>";
		OSApp.Status.changeStatus( ptotal, "green", line, OSApp.UIDom.goHome );
		return;
	}

	// Handle a single station open
	match = false;
	for ( i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++ ) {
		if ( OSApp.currentSession.controller.settings.ps[ i ] && OSApp.Stations.getPID( i ) && OSApp.Stations.getStatus( i ) && !OSApp.Stations.isMaster( i ) ) {
			match = true;
			pid = OSApp.Stations.getPID( i );
			pname = OSApp.Programs.pidToName( pid );
			line = "<div><div class='running-icon'></div><div class='running-text pointer'>";
			line += pname + " " + OSApp.Language._( "is running on station" ) + " <span class='nobr'>" + OSApp.Stations.getName( i ) + "</span> ";
			if ( OSApp.Stations.getRemainingRuntime( i ) > 0 ) {
				line += "<span id='countdown' class='nobr'>(" + OSApp.Dates.sec2hms( OSApp.Stations.getRemainingRuntime( i ) ) + " " + OSApp.Language._( "remaining" ) + ")</span>";
			}
			line += "</div></div>";
			break;
		}
	}

	if ( match ) {
		OSApp.Status.changeStatus( OSApp.Stations.getRemainingRuntime( i ), "green", line, OSApp.UIDom.goHome );
		return;
	}

	// Handle rain delay enabled
	if ( OSApp.currentSession.controller.settings.rd ) {
		OSApp.Status.changeStatus( 0, "red", "<p class='running-text center pointer'>" +
			OSApp.Language._( "Rain delay until" ) + " " + OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.rdst * 1000 ) ) + "</p>",
			function() {
				OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to turn off rain delay?" ), "", function() {
					OSApp.UIDom.showLoading( "#footer-running" );
					OSApp.Firmware.sendToOS( "/cv?pw=&rd=0" ).done( function() {
						OSApp.Status.refreshStatus( OSApp.Weather.updateWeather );
					} );
				} );
			}
		);
		return;
	}

	// Handle rain sensor triggered
	if ( OSApp.currentSession.controller.options.urs === 1 && OSApp.currentSession.controller.settings.rs === 1 ) {
		OSApp.Status.changeStatus( 0, "red", "<p class='running-text center'>" + OSApp.Language._( "Rain detected" ) + "</p>" );
		return;
	}

	if ( OSApp.currentSession.controller.settings.sn1 === 1 ) {
		OSApp.Status.changeStatus( 0, "red", "<p class='running-text center'>Sensor 1 (" + ( OSApp.currentSession.controller.options.sn1t === 3 ? OSApp.Language._( "Soil" ) : OSApp.Language._( "Rain" ) ) + OSApp.Language._( ") Activated" ) + "</p>" );
		return;
	}

	if ( OSApp.currentSession.controller.settings.sn2 === 1 ) {
		OSApp.Status.changeStatus( 0, "red", "<p class='running-text center'>Sensor 2 (" + ( OSApp.currentSession.controller.options.sn2t === 3 ? OSApp.Language._( "Soil" ) : OSApp.Language._( "Rain" ) ) + OSApp.Language._( ") Activated" ) + "</p>" );
		return;
	}

	// Handle manual mode enabled
	if ( OSApp.currentSession.controller.settings.mm === 1 ) {
		OSApp.Status.changeStatus( 0, "red", "<p class='running-text center pointer'>" + OSApp.Language._( "Manual mode enabled" ) + "</p>", function() {
			OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to turn off manual mode?" ), "", function() {
				OSApp.UIDom.showLoading( "#footer-running" );
				OSApp.Firmware.sendToOS( "/cv?pw=&mm=0" ).done( function() {
					OSApp.Sites.updateController();
				} );
			} );
		} );
		return;
	}

	var lrdur = OSApp.currentSession.controller.settings.lrun[ 2 ];

	// If last run duration is given, add it to the footer
	if ( lrdur !== 0 ) {
		var lrpid = OSApp.currentSession.controller.settings.lrun[ 1 ];
		pname = OSApp.Programs.pidToName( lrpid );

		OSApp.Status.changeStatus( 0, "transparent", "<p class='running-text smaller center pointer'>" + pname + " " + OSApp.Language._( "last ran station" ) + " " +
			OSApp.currentSession.controller.stations.snames[ OSApp.currentSession.controller.settings.lrun[ 0 ] ] + " " + OSApp.Language._( "for" ) + " " + ( lrdur / 60 >> 0 ) + "m " + ( lrdur % 60 ) + "s " +
			OSApp.Language._( "on" ) + " " + OSApp.Dates.dateToString( new Date( ( OSApp.currentSession.controller.settings.lrun[ 3 ] - lrdur ) * 1000 ) ) + "</p>", OSApp.UIDom.goHome );
		return;
	}

	OSApp.Status.changeStatus( 0, "transparent", "<p class='running-text smaller center pointer'>" + OSApp.Language._( "System Idle" ) + "</p>", OSApp.UIDom.goHome );
};

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
	var result = sid;
	if (!OSApp.currentSession.controller?.stations?.snames || OSApp.currentSession.controller?.stations?.snames.length < sid)
	{
		return result;
	}

	result = OSApp.currentSession.controller.stations.snames[ sid ];

	OSApp.Storage.get( "showStationNum", function( data ) {
		if ( data.showStationNum && data.showStationNum === "true" ) {
			result += ` (S${sid + 1})`;
		}
	});

	return result;
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
		m2 = typeof OSApp.currentSession.controller.options.mas2 === "number" ? OSApp.currentSession.controller.options.mas2 : 0,
		m3 = typeof OSApp.currentSession.controller.options.mas3 === "number" ? OSApp.currentSession.controller.options.mas3 : 0,
		m4 = typeof OSApp.currentSession.controller.options.mas4 === "number" ? OSApp.currentSession.controller.options.mas4 : 0;

	sid++;

	if ( m1 === sid ) {
		return 1;
	} else if ( m2 === sid ) {
		return 2;
	} else if ( m3 === sid ) {
		return 3;
	} else if ( m4 === sid ) {
		return 4;
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

OSApp.Stations.stopAllStations = function() {
	if ( !OSApp.currentSession.isControllerConnected() ) {
		return false;
	}

	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to stop all stations?" ), "", function() {
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( "/cv?pw=&rsn=1" ).done( function() {
			$.mobile.loading( "hide" );
			OSApp.Stations.removeStationTimers();
			OSApp.Status.refreshStatus();
			OSApp.Errors.showError( OSApp.Language._( "All stations have been stopped" ) );
		} );
	} );
};

OSApp.Stations.removeStationTimers = function() {
	for ( var timer in OSApp.uiState.timers ) {
		if ( Object.prototype.hasOwnProperty.call(OSApp.uiState.timers,  timer ) ) {
			if ( timer !== "clock" ) {
				delete OSApp.uiState.timers[ timer ];
			}
		}
	}
};

OSApp.Stations.stopStations = function( callback ) {
	callback = callback || function() {};
	$.mobile.loading( "show" );

	// It can take up to a second before stations actually stop
	OSApp.Firmware.sendToOS( "/cv?pw=&rsn=1" ).done( function() {
		setTimeout( function() {
			$.mobile.loading( "hide" );
			callback();
		}, 1000 );
	} );
};

OSApp.Stations.parseRemoteStationData = function( hex ) {
	var fields = hex.split( "," );
	var result = {};
	if ( fields.length === 2 && OSApp.Utils.isValidOTC( fields[ 0 ] ) ) {
		result.otc = fields[ 0 ];
		result.station = parseInt( fields[ 1 ], 16 );
	} else {
		hex = hex.split( "" );

		var ip = [], value;

		for ( var i = 0; i < 8; i++ ) {
			value = parseInt( hex[ i ] + hex[ i + 1 ], 16 ) || 0;
			ip.push( value );
			i++;
		}

		result.ip = ip.join( "." );
		result.port = parseInt( hex[ 8 ] + hex[ 9 ] + hex[ 10 ] + hex[ 11 ], 16 );
		result.station = parseInt( hex[ 12 ] + hex[ 13 ], 16 );
	}

	return result;
};

OSApp.Stations.verifyRemoteStation = function( data, callback ) {
	callback = callback || function() {};
	data = OSApp.Stations.parseRemoteStationData( data );

	$.ajax( {
		url: ( data.otc ? ( "https://cloud.openthings.io/forward/v1/" + data.otc ) : ( "http://" + data.ip + ":" + data.port ) ) + "/jo?pw=" + encodeURIComponent( OSApp.currentSession.pass ),
		type: "GET",
		dataType: "json"
	} ).then(
		function( result ) {
			if ( typeof result !== "object" || !Object.prototype.hasOwnProperty.call(result,  "fwv" ) ) {
				callback( -1 );
			} else if ( Object.keys( result ).length === 1 ) {
				callback( -2 );
			} else if ( !Object.prototype.hasOwnProperty.call(result,  "re" ) || result.re === 0 ) {
				callback( -3 );
			} else {
				callback( true );
			}
		},
		function() {
			callback( false );
		}
	);
};

OSApp.Stations.convertRemoteToExtender = function( data ) {
	data = OSApp.Stations.parseRemoteStationData( data );
	var comm;
	if ( data.otc ) {
		comm = "https://cloud.openthings.io/forward/v1/" + data.otc;
	} else {
		comm = "http://" + data.ip + ":" + data.port;
	}
	comm += "/cv?re=1&pw=" + encodeURIComponent( OSApp.currentSession.pass );

	$.ajax( {
		url: comm,
		type: "GET",
		dataType: "json"
	} );
};

OSApp.Stations.submitRunonce = function( runonce, interval, repeat, annotation, qo ) {
	var boundedInteger = function( value, minimum, maximum, fallback ) {
		value = Number( value );
		if ( !Number.isFinite( value ) ) {
			return fallback;
		}

		return Math.min( maximum, Math.max( minimum, Math.floor( value ) ) );
	},
		normalizeDuration = function( value ) {
			value = boundedInteger( value, 0, 65535, 0 );
			return value === 65534 || value === 65535 ? value : Math.min( value, 65533 );
		},
		adjustDuration = function( value, percentage ) {
			value = normalizeDuration( value );
			if ( value === 65534 || value === 65535 ) {
				if ( percentage === 100 ) {
					return value;
				}
				value = OSApp.Stations.getStationDuration( value );
			}

			return Math.min( 65533, Math.floor( value * percentage / 100 ) );
		},
		originalRunonce;

	// This block is for the Run-Once Page *only*.
	// It detects if `runonce` is not an array, meaning it's being called from the page.
	if ( !Array.isArray( runonce ) ) {
		if ( runonce && typeof runonce.preventDefault === "function" ) {
			runonce.preventDefault();
		}
		runonce = [];
		$( "#runonce" ).find( "[id^='zone-']" ).each( function() {
			runonce.push( normalizeDuration( this.value ) );
		} );
		runonce.push( 0 );
		originalRunonce = runonce.slice();

		var wlMode = $( "#runonce" ).find( "input[name='wl-runonce']:checked" ).val() || "none";
		var i;
		if ( wlMode === "custom" ) {
			var customPct = boundedInteger( $( "#runonce" ).find( "#wl-custom-slider" ).val(), 1, 250, 100 );
			for ( i = 0; i < runonce.length - 1; i++ ) {
				runonce[ i ] = adjustDuration( runonce[ i ], customPct );
			}
		} else if ( wlMode === "current" ) {
			var wlPct = boundedInteger( OSApp.currentSession.controller.options.wl, 0, 250, 100 );
			for ( i = 0; i < runonce.length - 1; i++ ) {
				runonce[ i ] = adjustDuration( runonce[ i ], wlPct );
			}
		}

		if( OSApp.Supported.repeatedRunonce() ){
			if( interval == null ) {
				interval = $( "#runonce" ).find( "#interval-runonce").val() / 60;
			}
			if( repeat == null ) {
				repeat = $( "#runonce" ).find( "#repeat-runonce").val();
			}
		}

		if ( OSApp.Firmware.checkOSVersion ( 2214 ) ) {
			if ( qo == null ) {
				qo = $("input[name='qo-runonce']:checked").val();
			}
		}
	} else {
		runonce = runonce.map( function( duration ) {
			return normalizeDuration( duration );
		} );
	}

	var submit = function() {
		$.mobile.loading( "show" );
		OSApp.Storage.set( { "runonce": JSON.stringify( originalRunonce || runonce ) } );

		let request = "/cr?pw=&t=" + JSON.stringify( runonce );

		if ( OSApp.Supported.repeatedRunonce() ) {
			interval = boundedInteger( interval, 0, 1439, 0 );
			repeat = boundedInteger( repeat, 0, 1440, 0 );
			if ( interval > 0 && repeat > 0 ) {
				request += "&int=" + interval + "&cnt=" + repeat;
			}
			if ( typeof annotation === "string" && annotation.length > 0 ) {
				request += "&anno=" + encodeURIComponent( annotation );
			}
		}
		if ( OSApp.Firmware.checkOSVersion ( 2214 ) ) {
			if ( qo != null ) {
				qo = Number( qo );
				request += "&qo=" + ( Number.isInteger( qo ) && qo >= 0 && qo <= 2 ? qo : 2 );
			}
		}

		OSApp.Firmware.sendToOS( request ).done( function() {
			$.mobile.document.one( "pageshow", function() {
				OSApp.Errors.showError( OSApp.Language._( "Run-once program has been scheduled" ) );
			} );
			OSApp.Status.refreshStatus();
			OSApp.UIDom.goBack();
		} ).always( function() {
			$.mobile.loading( "hide" );
		} );
	},
	isOn = OSApp.StationQueue.isActive();

	var checkIsOnAndSubmit = function() {
		if ( !OSApp.Firmware.checkOSVersion ( 2214 ) && isOn !== -1 ){
			// Add a short delay to allow the first popup to finish closing
			setTimeout(function() {
				OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to stop the currently running program?" ), OSApp.Utils.htmlEscape( OSApp.Programs.pidToName( OSApp.Stations.getPID( isOn ) ) ), function() {
					$.mobile.loading( "show" );
					OSApp.Stations.stopStations( submit );
				} );
			}, 100); // 100ms delay is usually enough for the DOM to settle
		} else {
			submit();
		}
	};

	checkIsOnAndSubmit();
	return false;
};

OSApp.Stations.getStationDuration = function( duration, date ) {
	if ( OSApp.Firmware.checkOSVersion( 214 ) ) {
		var sunTimes = OSApp.Weather.getSunTimes( date );

		if ( duration === 65535 ) {
			duration = ( ( sunTimes[ 0 ] + 1440 ) - sunTimes[ 1 ] ) * 60;
		} else if ( duration === 65534 ) {
			duration = ( sunTimes[ 1 ] - sunTimes[ 0 ] ) * 60;
		}
	}

	return duration;
};

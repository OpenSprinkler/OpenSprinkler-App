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
OSApp.Stations.activeAction = null;

/* Station accessor methods */
OSApp.Stations.Constants = {
	programStatusOptions: {
		PID: 0,
		REM: 1,
		START: 2,
		GID: 3
	}
};

OSApp.Stations.captureSessionIdentity = function() {
	return {
		generation: OSApp.currentSession.generation || 0,
		endpoint: String( OSApp.currentSession.token || "" ) + "|" +
			String( OSApp.currentSession.prefix || "" ) + String( OSApp.currentSession.ip || "" )
	};
};

OSApp.Stations.isSessionIdentityCurrent = function( identity ) {
	return !!identity && identity.generation === ( OSApp.currentSession.generation || 0 ) &&
		identity.endpoint === String( OSApp.currentSession.token || "" ) + "|" +
			String( OSApp.currentSession.prefix || "" ) + String( OSApp.currentSession.ip || "" );
};

OSApp.Stations.beginAction = function( identity ) {
	if ( OSApp.ImportExport && OSApp.ImportExport.isImportInProgress() ) return null;
	var active = OSApp.Stations.activeAction;
	if ( active && OSApp.Stations.isSessionIdentityCurrent( active ) ) return null;
	if ( active ) OSApp.Stations.finishAction( active );

	var action = identity || OSApp.Stations.captureSessionIdentity();
	action.loaderOwned = false;
	OSApp.Stations.activeAction = action;
	return action;
};

OSApp.Stations.showActionLoader = function( action ) {
	if ( OSApp.Stations.activeAction !== action || !OSApp.Stations.isSessionIdentityCurrent( action ) ) return false;
	action.loaderOwned = true;
	OSApp.uiState.operationLoaderOwner = action;
	$.mobile.loading( "show" );
	return true;
};

OSApp.Stations.releaseActionLoader = function( action ) {
	if ( !action || !action.loaderOwned ) return;
	action.loaderOwned = false;
	if ( OSApp.uiState.operationLoaderOwner !== action ) return;
	OSApp.uiState.operationLoaderOwner = null;

	// A generation change transfers the global loader to the new site load. Endpoint-only
	// invalidation still releases and dismisses the loader owned by this action.
	if ( action.generation === ( OSApp.currentSession.generation || 0 ) ) $.mobile.loading( "hide" );
};

OSApp.Stations.finishAction = function( action ) {
	OSApp.Stations.releaseActionLoader( action );
	if ( OSApp.Stations.activeAction === action ) OSApp.Stations.activeAction = null;
};

OSApp.Stations.getNumberProgramStatusOptions = function() {
	if ( OSApp.currentSession.controller.settings.ps.length <= 0 ) {
		return undefined;
	}

	return OSApp.currentSession.controller.settings.ps[ 0 ].length;
};

OSApp.Stations.getName = function( sid ) {
	var result = sid;
	if ( !OSApp.currentSession.controller?.stations?.snames || sid < 0 || sid >= OSApp.currentSession.controller.stations.snames.length )
	{
		return result;
	}

	result = OSApp.currentSession.controller.stations.snames[ sid ];

	if ( OSApp.Storage.getItemSync( "showStationNum" ) === "true" ) {
		result += " (S" + ( sid + 1 ) + ")";
	}

	return result;
};

OSApp.Stations.setName = function( sid, value ) {
	OSApp.currentSession.controller.stations.snames[ sid ] = value;
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
	return OSApp.Groups.normalizeGIDValue(
		OSApp.currentSession.controller.settings.ps[ sid ][ OSApp.Stations.Constants.programStatusOptions.GID ]
	);
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

OSApp.Stations.stopAllStations = function() {
	if ( !OSApp.currentSession.isControllerConnected() ) {
		return false;
	}

	var action = OSApp.Stations.beginAction();
	if ( !action ) return false;
	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to stop all stations?" ), "", function() {
		action.confirmed = true;
		if ( !OSApp.Stations.showActionLoader( action ) ) {
			OSApp.Stations.finishAction( action );
			return;
		}
		OSApp.Firmware.sendToOS( "/cv?pw=&rsn=1" ).done( function() {
			if ( !OSApp.Stations.isSessionIdentityCurrent( action ) ) return;
			OSApp.Stations.removeStationTimers();
			OSApp.Status.refreshStatus();
			OSApp.Errors.showError( OSApp.Language._( "All stations have been stopped" ) );
		} ).always( function() {
			OSApp.Stations.finishAction( action );
		} );
	}, function() {
		OSApp.Stations.finishAction( action );
	} );

	$( "#sure" ).one( "popupafterclose.stationAction", function() {
		if ( !action.confirmed ) OSApp.Stations.finishAction( action );
	} );
	return true;
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

OSApp.Stations.stopStations = function( callback, identity, action ) {
	callback = callback || function() {};
	identity = identity || OSApp.Stations.captureSessionIdentity();
	var reuseAction = !!action;
	action = action || OSApp.Stations.beginAction( identity );
	if ( !action || !OSApp.Stations.isSessionIdentityCurrent( identity ) ||
		OSApp.Stations.activeAction !== action || !OSApp.Stations.showActionLoader( action ) ) {
		if ( action ) OSApp.Stations.finishAction( action );
		return $.Deferred().reject( { status:0, statusText:"stale-session" } ).promise();
	}

	// It can take up to a second before stations actually stop
	return OSApp.Firmware.sendToOS( "/cv?pw=&rsn=1" ).done( function() {
		setTimeout( function() {
			if ( !OSApp.Stations.isSessionIdentityCurrent( identity ) ) {
				OSApp.Stations.finishAction( action );
				return;
			}
			if ( reuseAction ) {
				OSApp.Stations.releaseActionLoader( action );
			} else {
				OSApp.Stations.finishAction( action );
			}
			callback();
		}, 1000 );
	} ).fail( function() {
		OSApp.Stations.finishAction( action );
	} );
};

OSApp.Stations.parseRemoteStationData = function( value ) {
	if ( typeof value !== "string" ) return null;

	var fields = value.split( "," ),
		result = {},
		station;
	if ( fields.length === 2 ) {
		if ( !OSApp.Utils.isValidOTC( fields[ 0 ] ) || !/^[a-f0-9]{2}$/i.test( fields[ 1 ] ) ) return null;
		station = parseInt( fields[ 1 ], 16 );
		if ( station < 0 || station > 199 ) return null;
		result.otc = fields[ 0 ];
		result.station = station;
		return result;
	}

	if ( fields.length !== 1 || !/^[a-f0-9]{14}$/i.test( value ) ) return null;
	var ip = [],
		port = parseInt( value.slice( 8, 12 ), 16 );
	station = parseInt( value.slice( 12, 14 ), 16 );
	if ( port < 1 || port > 65535 || station < 0 || station > 199 ) return null;
	for ( var i = 0; i < 8; i += 2 ) {
		ip.push( parseInt( value.slice( i, i + 2 ), 16 ) );
	}

	result.ip = ip.join( "." );
	result.port = port;
	result.station = station;
	return result;
};

OSApp.Stations.verifyRemoteStation = function( data, callback ) {
	callback = callback || function() {};
	data = OSApp.Stations.parseRemoteStationData( data );
	if ( !data ) {
		callback( -1 );
		return $.Deferred().reject( { status:0, statusText:"invalid-data" } ).promise();
	}

	var request = $.ajax( {
		url: ( data.otc ? ( "https://cloud.openthings.io/forward/v1/" + data.otc ) : ( "http://" + data.ip + ":" + data.port ) ) + "/jo?pw=" + encodeURIComponent( OSApp.currentSession.pass ),
		type: "GET",
		dataType: "json",
		timeout: 10000
	} );
	request.then(
		function( result ) {
			if ( !result || typeof result !== "object" || Array.isArray( result ) ||
				!OSApp.Firmware.isValidFirmwareVersion( result.fwv ) ) {
				callback( -1 );
			} else if ( Object.keys( result ).length === 1 ) {
				callback( -2 );
			} else if ( !OSApp.Firmware.isFullOptionsResponse( result ) ) {
				callback( -1 );
			} else if ( !Number.isSafeInteger( result.re ) || result.re < 0 || result.re > 1 ) {
				callback( -1 );
			} else if ( result.re === 0 ) {
				callback( -3 );
			} else {
				callback( true );
			}
		},
		function() {
			callback( false );
		}
	);
	return request;
};

OSApp.Stations.convertRemoteToExtender = function( data ) {
	data = OSApp.Stations.parseRemoteStationData( data );
	if ( !data ) return false;
	var comm;
	if ( data.otc ) {
		comm = "https://cloud.openthings.io/forward/v1/" + data.otc;
	} else {
		comm = "http://" + data.ip + ":" + data.port;
	}
	comm += "/cv?re=1&pw=" + encodeURIComponent( OSApp.currentSession.pass );

	var request = $.ajax( {
		url: comm,
		type: "GET",
		dataType: "json",
		timeout: 10000
	} ),
		validated = request.then( function( result ) {
			if ( !result || typeof result !== "object" || Array.isArray( result ) || result.result !== 1 ) {
				return $.Deferred().reject( { status:0, statusText:"invalid-response" } ).promise();
			}
			return result;
		} );
	validated.abort = function() { request.abort(); };
	return validated;
};

OSApp.Stations.submitRunonce = function( runonce, uwt, interval, repeat, annotation, qo ) {
	var identity = OSApp.Stations.captureSessionIdentity();

	// This block is for the Run-Once Page *only*.
	// It detects if `runonce` is not an array, meaning it's being called from the page.
	if ( !( runonce instanceof Array ) ) {
		runonce = [];
		$( "#runonce" ).find( "[id^='zone-']" ).each( function() {
			runonce.push( parseInt( this.value ) || 0 );
		} );
		runonce.push( 0 );

		if( OSApp.Supported.repeatedRunonce() ){
			// Set up all parameters if needed
			if( uwt == null ) {
				uwt = $( "#runonce" ).find( "#uwt-runonce" ).prop( "checked" ) ? 1 : 0;
			}

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
	}

	var submit = function() {
		if ( !OSApp.Stations.isSessionIdentityCurrent( identity ) || !OSApp.Stations.showActionLoader( action ) ) {
			OSApp.Stations.finishAction( action );
			return;
		}
		OSApp.Storage.set( { "runonce": JSON.stringify( runonce ) } );

		let request = "/cr?pw=&t=" + JSON.stringify( runonce );

		if ( OSApp.Supported.repeatedRunonce() ) {
			request += "&int=" + interval + "&cnt=" + repeat + "&uwt=" + uwt;
			if ( annotation?.length > 0 ) {
				request += "&anno=" + encodeURIComponent( annotation );
			}
		}
		if ( OSApp.Firmware.checkOSVersion ( 2214 ) ) {
			if ( qo != null ) {
				request += "&qo=" + qo;
			}
		}

		OSApp.Firmware.sendToOS( request ).done( function() {
			if ( !OSApp.Stations.isSessionIdentityCurrent( identity ) ) return;
			$.mobile.document.one( "pageshow", function() {
				OSApp.Errors.showError( OSApp.Language._( "Run-once program has been scheduled" ) );
			} );
			OSApp.Status.refreshStatus();
			OSApp.UIDom.goBack();
		} ).always( function() {
			OSApp.Stations.finishAction( action );
		} );
	},
		isOn = OSApp.StationQueue.isActive(),
		activeProgramName = isOn !== -1 ? OSApp.Programs.pidToName( OSApp.Stations.getPID( isOn ) ) : "",
		action = OSApp.Stations.beginAction( identity );

	if ( !action ) return false;

	var checkIsOnAndSubmit = function() {
		if ( !OSApp.Stations.isSessionIdentityCurrent( identity ) ) {
			OSApp.Stations.finishAction( action );
			return;
		}
		if ( !OSApp.Firmware.checkOSVersion ( 2214 ) && isOn !== -1 ){
			// Add a short delay to allow the first popup to finish closing
			setTimeout(function() {
				if ( !OSApp.Stations.isSessionIdentityCurrent( identity ) ) {
					OSApp.Stations.finishAction( action );
					return;
				}
				action.confirmed = false;
				OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to stop the currently running program?" ), activeProgramName, function() {
					action.confirmed = true;
					if ( !OSApp.Stations.isSessionIdentityCurrent( identity ) ) {
						OSApp.Stations.finishAction( action );
						return;
					}
					OSApp.Stations.stopStations( submit, identity, action );
				}, function() {
					OSApp.Stations.finishAction( action );
				} );
				$( "#sure" ).one( "popupafterclose.runonceAction", function() {
					if ( !action.confirmed ) OSApp.Stations.finishAction( action );
				} );
			}, 100); // 100ms delay is usually enough for the DOM to settle
		} else {
			submit();
		}
	};

	checkIsOnAndSubmit();
	return true;
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

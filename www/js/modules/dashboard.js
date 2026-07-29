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
OSApp.Dashboard = OSApp.Dashboard || {};
OSApp.Dashboard.MAX_STATION_IMAGE_BASE64_LENGTH = 512 * 1024;
OSApp.Dashboard.activeStationSubmission = null;

OSApp.Dashboard.captureSessionIdentity = function() {
	return {
		generation: OSApp.currentSession.generation || 0,
		endpoint: String( OSApp.currentSession.token || "" ) + "|" +
			String( OSApp.currentSession.prefix || "" ) + String( OSApp.currentSession.ip || "" )
	};
};

OSApp.Dashboard.isSessionIdentityCurrent = function( identity ) {
	return !!identity && identity.generation === ( OSApp.currentSession.generation || 0 ) &&
		identity.endpoint === String( OSApp.currentSession.token || "" ) + "|" +
			String( OSApp.currentSession.prefix || "" ) + String( OSApp.currentSession.ip || "" );
};

OSApp.Dashboard.normalizeGPIOPins = function( pins ) {
	if ( !Array.isArray( pins ) ) return null;
	return pins.slice( 0, 64 ).filter( function( pin, index, values ) {
		return Number.isInteger( pin ) && pin >= 0 && pin <= 99 && values.indexOf( pin ) === index;
	} );
};

OSApp.Dashboard.beginStationSubmission = function() {
	if ( OSApp.ImportExport && OSApp.ImportExport.isImportInProgress() ) return null;
	var active = OSApp.Dashboard.activeStationSubmission;
	if ( active && OSApp.Dashboard.isSessionIdentityCurrent( active ) ) return null;
	if ( active ) active.loaderOwned = false;

	var submission = OSApp.Dashboard.captureSessionIdentity();
	submission.loaderOwned = true;
	OSApp.Dashboard.activeStationSubmission = submission;
	OSApp.uiState.operationLoaderOwner = submission;
	$.mobile.loading( "show" );
	return submission;
};

OSApp.Dashboard.finishStationSubmission = function( submission ) {
	if ( OSApp.Dashboard.activeStationSubmission !== submission ) return;
	OSApp.Dashboard.activeStationSubmission = null;
	var loaderOwned = submission.loaderOwned;
	submission.loaderOwned = false;
	if ( !loaderOwned || OSApp.uiState.operationLoaderOwner !== submission ) return;
	OSApp.uiState.operationLoaderOwner = null;
	if ( submission.generation === ( OSApp.currentSession.generation || 0 ) ) {
		$.mobile.loading( "hide" );
	}
};

OSApp.Dashboard.getStationImageSource = function( value, placeholder ) {
	var base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
	if ( typeof value !== "string" || value.length === 0 ||
		value.length > OSApp.Dashboard.MAX_STATION_IMAGE_BASE64_LENGTH || !base64.test( value ) ) {
		return placeholder;
	}
	return "data:image/jpeg;base64," + value;
};

OSApp.Dashboard.renderWaterLevel = function( container, value ) {
	var waterLevel = OSApp.Utils.coerceFiniteNumber( value );
	container.empty().append( document.createTextNode( OSApp.Language._( "Water Level" ) + ": " ) );
	$( "<span>" ).addClass( "waterlevel" ).text( typeof waterLevel === "undefined" ? "--" : waterLevel ).appendTo( container );
	if ( typeof waterLevel !== "undefined" ) {
		container.append( document.createTextNode( "%" ) );
	}
};

OSApp.Dashboard.displayPage = function() {
	// Display the home dasbhoard main view
	var cards, siteSelect, currentSite, i, sites;
	var content = '<div data-role="page" id="sprinklers">' +
			'<div class="ui-panel-wrapper">' +
				'<div class="ui-content" role="main">' +
					'<div class="ui-grid-a ui-body ui-corner-all info-card noweather">' +
						'<div class="ui-block-a center">' +
							'<div id="weather" class="pointer"></div>' +
							'<div id="restr-active" class="pointer settings-weather' + (( OSApp.currentSession.controller.settings?.wtrestr || 0 > 0 ) ? '' : ' hidden') + '">' +
								'<span class="bold blue-text">' + OSApp.Language._("Weather Restriction Active") + '</span>' +
							'</div>' +
						'</div>' +
						'<div class="ui-block-b center settings-weather home-info pointer">' +
							'<div class="sitename bold"></div>' +
							'<div id="clock-s" class="nobr"></div>' +
							'<div id="water-level">' +
								OSApp.Language._("Water Level") + ': <span class="waterlevel"></span>%' +
							'</div>' +
						'</div>' +
					'</div>' +
					'<div id="os-stations-list" class="card-group center"></div>' +
					'<div id="os-sensor-show" class="card-group center"></div>' +
				'</div>' +
			'</div>' +
		'</div>';

	var page = $(content),
		addTimer = function( station, rem ) {
			OSApp.uiState.timers[ "station-" + station ] = {
				val: rem,
				station: station,
				update: function() {
					page.find( "#countdown-" + station ).text( "(" + OSApp.Dates.sec2hms( this.val ) + " " + OSApp.Language._( "remaining" ) + ")" );
				},
				done: function() {
					page.find( "#countdown-" + station ).parent( "p" ).empty().siblings( ".station-status" ).removeClass( "on" ).addClass( "off" );
				}
			};
		},
		addCard = function( sid ) {
			var isScheduled = OSApp.Stations.getPID( sid ) > 0,
				isRunning = OSApp.Stations.isRunning( sid ),
				pname = isScheduled ? OSApp.Programs.pidToName( OSApp.Stations.getPID( sid ) ) : "",
				rem = OSApp.Stations.getRemainingRuntime( sid ),
				qPause = OSApp.Supported.pausing() && OSApp.StationQueue.isPaused(),
				imageSource = OSApp.Dashboard.getStationImageSource( sites[ currentSite ].images[ sid ], OSApp.UIDom.getAppURLPath() + "img/placeholder.png" ),
				gid = OSApp.Supported.groups() ? OSApp.Stations.getGIDValue( sid ) : undefined;

			if ( OSApp.Stations.getStatus( sid ) && rem > 0 ) {
				addTimer( sid, rem );
			}

			// Group card settings visually
			cards += "<div data-station='" + sid + "' class='ui-corner-all card" +
				( OSApp.Stations.isDisabled( sid ) ? " station-hidden' style='display:none" : "" ) + "'>";

			cards += "<div class='ui-body ui-body-a center'>";

			cards += "<img src='" + OSApp.Utils.htmlEscape( imageSource ) + "' />";


			cards += "<p class='station-name center inline-icon' id='station_" + sid + "'>" + OSApp.Utils.htmlEscape( OSApp.Stations.getName( sid) ) + "</p>";
			cards += "<span class='bno-border ui-btn ui-btn-icon-notext ui-corner-all card-icon station-status " +
				( isRunning ? "on" : ( isScheduled ? "wait" : "off" ) ) + "'></span>";

			cards += "<span class='btn-no-border ui-btn ui-btn-icon-notext ui-icon-wifi card-icon special-station " +
				( OSApp.Stations.isSpecial( sid ) ? "" : "hidden" ) + "'></span>";

			if ( typeof gid !== "undefined" ) {
				cards += "<span class='btn-no-border ui-btn card-icon station-gid " + ( OSApp.Stations.isMaster( sid ) ? "hidden" : "" ) +
					"'>" + OSApp.Groups.mapGIDValueToName( gid ) + "</span>";
			}

			cards += "<span class='btn-no-border ui-btn " + ( ( OSApp.Stations.isMaster( sid ) ) ? "ui-icon-master" : "ui-icon-gear" ) +
				" card-icon ui-btn-icon-notext station-settings' data-station='" + sid + "' id='attrib-" + sid + "' " +
				( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_1 ) ? ( "data-um='" + ( OSApp.StationAttributes.getMasterOperation( sid, OSApp.Constants.options.MASTER_STATION_1 ) ) + "' " ) : "" ) +
				( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_2 ) ? ( "data-um2='" + ( OSApp.StationAttributes.getMasterOperation( sid, OSApp.Constants.options.MASTER_STATION_2 ) ) + "' " ) : "" ) +
				( OSApp.Supported.ignoreRain() ? ( "data-ir='" + ( OSApp.StationAttributes.getIgnoreRain( sid ) ) + "' " ) : "" ) +
				( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_1 ) ? ( "data-sn1='" + ( OSApp.StationAttributes.getIgnoreSensor( sid, OSApp.Constants.options.IGNORE_SENSOR_1 ) ) + "' " ) : "" ) +
				( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_2 ) ? ( "data-sn2='" + ( OSApp.StationAttributes.getIgnoreSensor( sid, OSApp.Constants.options.IGNORE_SENSOR_2 ) ) + "' " ) : "" ) +
				( OSApp.Supported.actRelay() ? ( "data-ar='" + ( OSApp.StationAttributes.getActRelay( sid ) ) + "' " ) : "" ) +
				( OSApp.Supported.disabled() ? ( "data-sd='" + ( OSApp.StationAttributes.getDisabled( sid ) ) + "' " ) : "" ) +
				( OSApp.Supported.sequential() ? ( "data-us='" + ( OSApp.StationAttributes.getSequential( sid ) ) + "' " ) : "" ) +
				( OSApp.Supported.special() ? ( "data-hs='" + ( OSApp.StationAttributes.getSpecial( sid ) ) + "' " ) : "" ) +
				( typeof gid !== "undefined" ? ( "data-gid='" + gid + "' " ) : "" ) +
				"></span>";

			if ( !OSApp.Stations.isMaster( sid ) ) {
				if ( isScheduled || isRunning ) {

					// Generate status line for station
					pname = OSApp.Utils.htmlEscape( pname );
					cards += "<p class='rem center'>" + ( isRunning ? OSApp.Language._( "Running" ) + " " + pname : OSApp.Language._( "Scheduled" ) + " " +
						( OSApp.Stations.getStartTime( sid ) ? OSApp.Language._( "for" ) + " " + OSApp.Dates.dateToString( new Date( OSApp.Stations.getStartTime( sid ) * 1000 ) ) : pname ) );

					if ( rem > 0 ) {

						// Show the remaining time if it's greater than 0
						cards += " <span id=" + ( qPause ? "'pause" : "'countdown-" ) + sid + "' class='nobr'>(" + OSApp.Dates.sec2hms( rem ) + " " + OSApp.Language._( "remaining" ) + ")</span>";
					}
					cards += "</p>";
				}
			}

			// Add sequential group divider and close current card group
			cards += "</div><hr style='display:none' class='content-divider'" +
				( typeof gid !== "undefined" ? " divider-gid='" + gid + "'" : "" ) + "></div>";

		},
		showAttributes = function() {
			var existingPopup = $( "#stn_attrib" );
			existingPopup.triggerHandler( "stationcleanup" );
			existingPopup.popup( "destroy" ).remove();

			var button = $( this ),
				sid = button.data( "station" ),
				name = button.siblings( "[id='station_" + sid + "']" ),
				sessionIdentity = OSApp.Dashboard.captureSessionIdentity(),
				sessionSite = currentSite,
				popupActive = true,
				verificationRequest = null,
				verificationToken = null,
				verificationLoaderOwner = null,
				remoteDialogOpen = false,
				remoteDialogToken = null,
				remoteDialogLoader = null,
				isSessionCurrent = function() {
					return OSApp.Dashboard.isSessionIdentityCurrent( sessionIdentity );
				},
				canHideOwnedLoader = function() {
					return sessionIdentity.generation === ( OSApp.currentSession.generation || 0 );
				},
				showPopupLoader = function( owner, options ) {
					OSApp.uiState.operationLoaderOwner = owner;
					if ( options ) {
						$.mobile.loading( "show", options );
					} else {
						$.mobile.loading( "show" );
					}
				},
				releasePopupLoader = function( owner, hide ) {
					if ( !owner || OSApp.uiState.operationLoaderOwner !== owner ) return;
					OSApp.uiState.operationLoaderOwner = null;
					if ( hide ) $.mobile.loading( "hide" );
				},
				cleanupStationPopup = function() {
					if ( !popupActive ) return;
					var hideOwnedLoader = canHideOwnedLoader();
					popupActive = false;
					verificationToken = null;
					var request = verificationRequest;
					verificationRequest = null;
					if ( request && typeof request.abort === "function" ) request.abort();
					releasePopupLoader( verificationLoaderOwner, hideOwnedLoader );
					releasePopupLoader( remoteDialogToken, hideOwnedLoader );
					verificationLoaderOwner = null;
					remoteDialogToken = null;
					remoteDialogOpen = false;
					if ( select && typeof select.find === "function" ) {
						select.find( ".attrib-submit" ).removeClass( "ui-disabled" );
					}
					if ( remoteDialogLoader ) remoteDialogLoader.css( "opacity", "" );
					page.off( "pagehide.stationAttributes" );
				},
				showSpecialOptions = function( value ) {
					var opts = select.find( "#specialOpts" ),
						special = OSApp.currentSession.controller.special && Object.prototype.hasOwnProperty.call(OSApp.currentSession.controller.special, sid ) ? OSApp.currentSession.controller.special[ sid ] : null,
						data = special && typeof special === "object" && !Array.isArray( special ) && typeof special.sd === "string" ? special.sd : "",
						type = special && typeof special === "object" && !Array.isArray( special ) &&
							Number.isInteger( special.st ) && special.st >= 0 && special.st <= 6 ? special.st : 0;

					opts.empty();

					if ( value === 0 ) {
						opts.append(
							"<p class='special-desc center small'>" +
							OSApp.Language._( "Select the station type using the dropdown selector above and configure the station properties." ) +
							"</p>"
						).enhanceWithin();
					} else if ( value === 1 ) {
						data = ( type === value ) ? data : "0000000000000000";

						opts.append(
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "RF Code" ) + ":</div>" +
							"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='rf-code' required='true' type='text' value='" + OSApp.Utils.htmlEscape( data ) + "'>"
						).enhanceWithin();
					} else if ( value === 2 ) {
						data = OSApp.Stations.parseRemoteStationData( ( type === value ) ? data : "00000000005000" ) ||
							OSApp.Stations.parseRemoteStationData( "00000000005000" );

						opts.append(
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Address" ) + ":</div>" +
							"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-address' required='true' type='text' pattern='^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$' value='" + OSApp.Utils.htmlEscape( data.ip ) + "'>" +
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Port" ) + ":</div>" +
							"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-port' required='true' type='number' placeholder='80' min='1' max='65535' value='" + data.port + "'>" +
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Station" ) + ":</div>" +
							"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-station' required='true' type='number' min='1' max='200' placeholder='1' value='" + ( data.station + 1 ) + "'>"
						).enhanceWithin();
					} else if ( value === 6 ) {
						data = OSApp.Stations.parseRemoteStationData( ( type === value ) ? data : "OT000000000000000000000000000000,00" ) ||
							OSApp.Stations.parseRemoteStationData( "OT000000000000000000000000000000,00" );
						opts.append(
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote OTC Token" ) + ":</div>" +
							"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-otc' required='true' type='text' pattern='^OT[a-fA-F0-9]{30}$' value='" + OSApp.Utils.htmlEscape( data.otc ) + "'>" +
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Station" ) + ":</div>" +
							"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-station' required='true' type='number' min='1' max='200' placeholder='1' value='" + ( data.station + 1 ) + "'>"
						).enhanceWithin();

					} else if ( value === 3 ) {

						// Extended special station model to support GPIO stations
						// Special data for GPIO Station is three bytes of ascii decimal (not hex)
						// First two bytes are zero padded GPIO pin number (default GPIO05)
						// Third byte is either 0 or 1 for active low (GND) or high (+5V) relays (default 1 for HIGH)
						// Restrict selection to GPIO pins available on the RPi R2.
						var gpioPin = 5, activeState = 1, freePins = [ ], sel,
							configuredPins = OSApp.Dashboard.normalizeGPIOPins( OSApp.currentSession.controller.settings.gpio );

						if ( configuredPins ) {
							freePins = configuredPins;
						} else if ( OSApp.Firmware.getHWVersion() === "OSPi" ) {
							freePins = [ 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 18, 19, 20, 21, 23, 24, 25, 26 ];
						} else if ( OSApp.Firmware.getHWVersion() === "2.3" ) {
							freePins = [ 2, 10, 12, 13, 14, 15, 18, 19 ];
						}

						if ( type === value ) {
							data = data.split( "" );
							gpioPin = parseInt( data[ 0 ] + data[ 1 ] );
							activeState = parseInt( data[ 2 ] );
						}

						if ( freePins.length ) {
							sel = "<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "GPIO Pin" ) + ":</div>" +
								"<select class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='gpio-pin'>";
							for ( var i = 0; i < freePins.length; i++ ) {
								sel += "<option value='" + freePins[ i ] + "' " + ( freePins[ i ] === gpioPin ? "selected='selected'" : "" ) + ">" + freePins[ i ];
							}
							sel += "</select>";
						} else {
							sel = "";
						}

						sel += "<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Active State" ) + ":</div>" +
							"<select class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='active-state'>" +
							"<option value='1' " + ( activeState === 1 ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "HIGH" ) +
							"<option value='0' " + ( activeState === 0 ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "LOW" ) +
							"</select>";

						opts.append( sel ).enhanceWithin();
					} else if ( value === 4 || value === 5 ) {
						data = ( type === value ) ? data.split( "," ) : ( value === 4 ? [ "server", "80", "On", "Off" ] : [ "server", "443", "On", "Off" ] );

						opts.append(
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Server Name" ) + ":</div>" +
							"<input class='center  validate-length' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='http-server' required='true' type='text' value='" + OSApp.Utils.htmlEscape( data[ 0 ] ) + "'>" +
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Server Port" ) + ":</div>" +
							"<input class='center  validate-length' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='http-port' required='true' type='number' min='0' max='65535' value='" + parseInt( data[ 1 ] ) + "'>" +
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "On Command" ) + ":</div>" +
							"<input class='center validate-length' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='http-on' required='true' type='text' value='" + OSApp.Utils.htmlEscape( data[ 2 ] ) + "'>" +
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Off Command" ) + ":</div>" +
							"<input class='center validate-length' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='http-off' required='true' type='text' value='" + OSApp.Utils.htmlEscape( data[ 3 ] ) + "'>" +
							"<div class='center smaller' id='character-tracking' style='color:#999;'>" +
							"<p>" +	OSApp.Language._( "Note: There is a limit on the number of character used to configure this station type." ) + "</p>" +
							"<span>" + OSApp.Language._( "Characters remaining" ) + ": </span><span id='character-count'>placeholder</span>" +
							"</div>"
						).enhanceWithin();

						validateLength();
						$( ".validate-length" ).on( "input", validateLength );
					}
				},
				validateLength = function() {
					var maxSDChars = 240,		// Maximum size of special data when uri encoded. Needs to be less than sizeof(SpecialStationData) i.e. 247 bytes
						sd = select.find( "#http-server" ).val() + "," + select.find( "#http-port" ).val() + "," +
							select.find( "#http-on" ).val() + "," + select.find( "#http-off" ).val(),
						sdLen = encodeURIComponent( sd ).length;

					select.find( "#character-count" ).text( maxSDChars - sdLen );

					if ( sdLen > maxSDChars ) {
						select.find( ".attrib-submit" ).addClass( "ui-disabled" );
						select.find( "#character-tracking" ).addClass( "red-text bold" );
					} else {
						select.find( ".attrib-submit" ).removeClass( "ui-disabled" );
						select.find( "#character-tracking" ).removeClass( "red-text bold" );
					}
				},
				saveChanges = function( checkPassed ) {
					if ( !popupActive || !isSessionCurrent() ) {
						cleanupStationPopup();
						return;
					}
					if ( verificationToken || remoteDialogOpen ) return;
					if ( OSApp.Dashboard.activeStationSubmission &&
						OSApp.Dashboard.isSessionIdentityCurrent( OSApp.Dashboard.activeStationSubmission ) ) return;
					var hs = parseInt( select.find( "#hs" ).val() );

					if ( hs === 1 ) {
						button.data( "specialData", select.find( "#rf-code" ).val() );
					} else if ( hs === 2 || hs === 6 ) {
						var ip, port, otc, station, stationInput, hex = "";
						stationInput = Number( select.find( "#remote-station" ).val() );
						if ( !Number.isInteger( stationInput ) || stationInput < 1 || stationInput > 200 ) {
							OSApp.Errors.showError( OSApp.Language._( "Please check input and try again." ) );
							return;
						}
						station = stationInput - 1;
						if ( hs === 2 ) {
							ip = OSApp.Utils.parseIPv4( select.find( "#remote-address" ).val() );
							port = Number( select.find( "#remote-port" ).val() );
							if ( !ip || !Number.isInteger( port ) || port < 1 || port > 65535 ) {
								OSApp.Errors.showError( OSApp.Language._( "Please check input and try again." ) );
								return;
							}
							for ( var i = 0; i < 4; i++ ) {
								hex += OSApp.Utils.pad( ip[ i ].toString( 16 ) );
							}
							hex += OSApp.Utils.pad( (port>>8).toString( 16 ) ) + OSApp.Utils.pad( (port & 0xff).toString( 16 ) );
							hex += OSApp.Utils.pad( station.toString( 16 ) );
						} else {
							otc = select.find( "#remote-otc" ).val();
							if ( !OSApp.Utils.isValidOTC( otc ) ) {
								OSApp.Errors.showError( OSApp.Language._( "Please check input and try again." ) );
								return;
							}
							hex += otc;
							hex += ",";
							hex += OSApp.Utils.pad( station.toString( 16 ) );
						}

						if ( checkPassed !== true ) {
							var token = {}, callbackCompleted = false;
							verificationToken = token;
							verificationLoaderOwner = token;
							showPopupLoader( token );
							select.find( ".attrib-submit" ).addClass( "ui-disabled" );

							var request = OSApp.Stations.verifyRemoteStation( hex, function( result ) {
								callbackCompleted = true;
								if ( verificationToken !== token || !popupActive || !select.closest( "html" ).length ) return;
								if ( !isSessionCurrent() ) {
									verificationToken = null;
									verificationRequest = null;
									releasePopupLoader( verificationLoaderOwner, canHideOwnedLoader() );
									verificationLoaderOwner = null;
									select.find( ".attrib-submit" ).removeClass( "ui-disabled" );
									return;
								}
								verificationToken = null;
								verificationRequest = null;
								releasePopupLoader( verificationLoaderOwner, true );
								verificationLoaderOwner = null;
								select.find( ".attrib-submit" ).removeClass( "ui-disabled" );

								var text;
								if ( result === true ) {
									saveChanges( true );
									return;
								} else if ( result === false || result === -1 ) {
									text = OSApp.Language._( "Unable to reach the remote station." );
								} else if ( result === -2 ) {

									// Likely an invalid password since the firmware version is present but no other data
									text = OSApp.Language._( "Password on remote controller does not match the password on this OSApp.currentSession.controller." );
								} else if ( result === -3 ) {

									// Remote controller is not configured as an extender
									text = OSApp.Language._( "Remote controller is not configured as an extender. Would you like to do this now?" );
								}

								remoteDialogOpen = true;
								remoteDialogToken = {};
								showPopupLoader( remoteDialogToken, {
									html: "<h1>" + text + "</h1>" +
										"<button class='ui-btn cancel'>" + OSApp.Language._( "Cancel" ) + "</button>" +
										"<button class='ui-btn continue'>" + OSApp.Language._( "Continue" ) + "</button>",
									textVisible: true,
									theme: "b"
								} );

								remoteDialogLoader = $( ".ui-loader" );

								remoteDialogLoader.css( "opacity", ".96" );

								remoteDialogLoader.find( ".cancel" ).one( "click", function() {
									if ( !popupActive ) return;
									if ( !isSessionCurrent() ) {
										remoteDialogOpen = false;
										releasePopupLoader( remoteDialogToken, canHideOwnedLoader() );
										remoteDialogToken = null;
										remoteDialogLoader.css( "opacity", "" );
										return;
									}
									remoteDialogOpen = false;
									releasePopupLoader( remoteDialogToken, true );
									remoteDialogToken = null;
									remoteDialogLoader.css( "opacity", "" );
								} );

								remoteDialogLoader.find( ".continue" ).one( "click", function() {
									if ( !popupActive ) return;
									if ( !isSessionCurrent() ) {
										remoteDialogOpen = false;
										releasePopupLoader( remoteDialogToken, canHideOwnedLoader() );
										remoteDialogToken = null;
										remoteDialogLoader.css( "opacity", "" );
										return;
									}
									remoteDialogOpen = false;
									releasePopupLoader( remoteDialogToken, true );
									remoteDialogToken = null;
									remoteDialogLoader.css( "opacity", "" );

									if ( result === -3 ) {
										var conversionToken = {},
											conversion = OSApp.Stations.convertRemoteToExtender( hex );
										verificationToken = conversionToken;
										verificationLoaderOwner = conversionToken;
										select.find( ".attrib-submit" ).addClass( "ui-disabled" );
										showPopupLoader( conversionToken );

										if ( !conversion || typeof conversion.done !== "function" ) {
											verificationToken = null;
											select.find( ".attrib-submit" ).removeClass( "ui-disabled" );
											releasePopupLoader( verificationLoaderOwner, true );
											verificationLoaderOwner = null;
											OSApp.Errors.showError( OSApp.Language._( "Unable to configure the remote station as an extender." ) );
											return;
										}

										verificationRequest = conversion;
										conversion.done( function() {
											if ( verificationToken !== conversionToken || !popupActive || !select.closest( "html" ).length ) return;
											verificationToken = null;
											verificationRequest = null;
											select.find( ".attrib-submit" ).removeClass( "ui-disabled" );
											releasePopupLoader( verificationLoaderOwner, canHideOwnedLoader() );
											verificationLoaderOwner = null;
											if ( !isSessionCurrent() ) return;
											saveChanges( true );
										} ).fail( function() {
											if ( verificationToken !== conversionToken || !popupActive || !select.closest( "html" ).length ) return;
											verificationToken = null;
											verificationRequest = null;
											select.find( ".attrib-submit" ).removeClass( "ui-disabled" );
											releasePopupLoader( verificationLoaderOwner, canHideOwnedLoader() );
											verificationLoaderOwner = null;
											if ( !isSessionCurrent() ) return;
											OSApp.Errors.showError( OSApp.Language._( "Unable to configure the remote station as an extender." ) );
										} );
										return;
									}

									saveChanges( true );
								} );

							} );
							verificationRequest = callbackCompleted ? null : request;
							return;
						}

						button.data( "specialData", hex );
					} else if ( hs === 3 ) {
						var sd = OSApp.Utils.pad( select.find( "#gpio-pin" ).val() || "05" );
						sd += select.find( "#active-state" ).val() || "1";
						button.data( "specialData", sd );
					} else if ( hs === 4 || hs === 5 ) {
						var sdata = select.find( "#http-server" ).val();
						sdata += "," + select.find( "#http-port" ).val();
						sdata += "," + select.find( "#http-on" ).val();
						sdata += "," + select.find( "#http-off" ).val();
						button.data( "specialData", sdata );
					}
					button.data( "hs", hs );

					button.data( "um", select.find( "#um" ).is( ":checked" ) ? 1 : 0 );
					button.data( "um2", select.find( "#um2" ).is( ":checked" ) ? 1 : 0 );
					button.data( "ir", select.find( "#ir" ).is( ":checked" ) ? 1 : 0 );
					button.data( "sn1", select.find( "#sn1" ).is( ":checked" ) ? 1 : 0 );
					button.data( "sn2", select.find( "#sn2" ).is( ":checked" ) ? 1 : 0 );
					button.data( "ar", select.find( "#ar" ).is( ":checked" ) ? 1 : 0 );
					button.data( "sd", select.find( "#sd" ).is( ":checked" ) ? 1 : 0 );
					button.data( "us", select.find( "#us" ).is( ":checked" ) ? 1 : 0 );
					name.text( select.find( "#stn-name" ).val() );

					var seqGroupName = select.find( "span.seqgrp" ).text();
					button.attr( "data-gid", OSApp.Groups.mapGIDNameToValue( seqGroupName ) );

					// Update the notes section
					sites[ sessionSite ].notes[ sid ] = select.find( "#stn-notes" ).val();
					OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );

					if ( !submitStations( sid ) ) return;
					select.triggerHandler( "stationcleanup" );
					select.popup( "destroy" ).remove();
				},
				select = "<div data-overlay-theme='b' data-role='popup' data-theme='a' id='stn_attrib'>" +
					"<fieldset style='margin:0' data-mini='true' data-corners='false' data-role='controlgroup'><form><div id='station-tabs'>";

			if ( typeof sid !== "number" ) {
				return false;
			}

			// Setup two tabs for station configuration (Basic / Advanced) when applicable
			if ( OSApp.Supported.special() ) {
				select += "<ul class='tabs'>" +
					"<li class='current' data-tab='tab-basic'>" + OSApp.Language._( "Basic" ) + "</li>" +
					"<li data-tab='tab-advanced'>" + OSApp.Language._( "Advanced" ) + "</li>" +
					"</ul>";
			}

			// Start of Basic Tab settings
			select += "<div id='tab-basic' class='tab-content current'>";

			select += "<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Station Name" ) + ":</div>" +
				"<input class='bold center' data-corners='false' data-wrapper-class='tight stn-name ui-btn' id='stn-name' type='text' value=\"" +
				OSApp.Utils.htmlEscape( OSApp.currentSession.controller.stations.snames[sid] ) + "\">";

			select += "<button type='button' class='changeBackground'>" +
				( typeof sites[ sessionSite ].images[ sid ] !== "string" ? OSApp.Language._( "Add" ) : OSApp.Language._( "Change" ) ) + " " + OSApp.Language._( "Image" ) +
				"</button>";

			if ( !OSApp.Stations.isMaster( sid ) ) {
				if ( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_1 ) ) {
					select += "<label for='um'><input class='needsclick' data-iconpos='right' id='um' type='checkbox' " +
						( ( button.data( "um" ) === 1 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Use Master" ) + " " +
						( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_2 ) ? "1" : "" ) + "</label>";
				}

				if ( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_2 ) ) {
					select += "<label for='um2'><input class='needsclick' data-iconpos='right' id='um2' type='checkbox' " +
						( ( button.data( "um2" ) === 1 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Use Master" ) + " 2" +
						"</label>";
				}

				if ( OSApp.Supported.ignoreRain() ) {
					select += "<label for='ir'><input class='needsclick' data-iconpos='right' id='ir' type='checkbox' " +
						( ( button.data( "ir" ) === 1 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Ignore Rain" ) +
						"</label>";
				}

				if ( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_1 ) ) {
					select += "<label for='sn1'><input class='needsclick' data-iconpos='right' id='sn1' type='checkbox' " +
						( ( button.data( "sn1" ) === 1 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Ignore Sensor 1" ) +
						"</label>";
				}

				if ( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_2 ) ) {
					select += "<label for='sn2'><input class='needsclick' data-iconpos='right' id='sn2' type='checkbox' " +
						( ( button.data( "sn2" ) === 1 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Ignore Sensor 2" ) +
						"</label>";
				}

				if ( OSApp.Supported.actRelay() ) {
					select += "<label for='ar'><input class='needsclick' data-iconpos='right' id='ar' type='checkbox' " +
						( ( button.data( "ar" ) === 1 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Activate Relay" ) +
						"</label>";
				}

				if ( OSApp.Supported.disabled() ) {
					select += "<label for='sd'><input class='needsclick' data-iconpos='right' id='sd' type='checkbox' " +
						( ( button.data( "sd" ) === 1 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Disable" ) +
						"</label>";
				}

				if ( OSApp.Supported.sequential() && !OSApp.Supported.groups() ) {
					select += "<label for='us'><input class='needsclick' data-iconpos='right' id='us' type='checkbox' " +
						( ( button.data( "us" ) === 1 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Sequential" ) +
						"</label>";
				}
			}

			select += "<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Station Notes" ) + ":</div>" +
				"<textarea data-corners='false' class='tight stn-notes' id='stn-notes'>" +
				OSApp.Utils.htmlEscape( sites[ sessionSite ].notes[ sid ] || "" ) +
				"</textarea>";

			select += "</div>";

			// Start of Advanced Tab settings.
			select += "<div id='tab-advanced' class='tab-content'>";

			// Create sequential group selection menu
			if ( OSApp.Supported.groups() && !OSApp.Stations.isMaster( sid ) ) {
				select +=
					"<div class='ui-bar-a ui-bar seq-container'>" + OSApp.Language._( "Sequential Group" ) + ":</div>" +
					"<select id='gid' class='seqgrp' data-mini='true'></select>" +
					"<div><p id='prohibit-change' class='center hidden' style='color: #ff0033;'>Changing group designation is prohibited while station is running</p></div>";
			}

			// Station tab is initially set to disabled until we have refreshed station data from firmware
			// Note: HTTPS and Remote OTC stations are supported at the same time with Email notification support
			if ( OSApp.Supported.special() ) {
				select +=
					"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Station Type" ) + ":</div>" +
					"<select data-mini='true' id='hs'"  + ( OSApp.Stations.isSpecial( sid ) ? " class='ui-disabled'" : "" ) + ">" +
					"<option data-hs='0' value='0'" + ( OSApp.Stations.isSpecial( sid ) ? "" : "selected" ) + ">" + OSApp.Language._( "Standard" ) + "</option>" +
					"<option data-hs='1' value='1'>" + OSApp.Language._( "RF" ) + "</option>" +
					"<option data-hs='2' value='2'>" + OSApp.Language._( "Remote Station (IP)" ) + "</option>" +
					"<option data-hs='3' value='3'" + (
						OSApp.Firmware.checkOSVersion( 217 ) && (
							( typeof OSApp.currentSession.controller.settings.gpio !== "undefined" && OSApp.currentSession.controller.settings.gpio.length > 0 ) || OSApp.Firmware.getHWVersion() === "OSPi" || OSApp.Firmware.getHWVersion() === "2.3"
						) ? ">" : " disabled>"
					) + OSApp.Language._( "GPIO" ) + "</option>" +
					"<option data-hs='4' value='4'" + ( OSApp.Firmware.checkOSVersion( 217 ) ? ">" : " disabled>" ) + OSApp.Language._( "HTTP" ) + "</option>" +
					"<option data-hs='5' value='5'" + ( typeof OSApp.currentSession.controller.settings.email === "object" ? ">" : " disabled>" ) + OSApp.Language._( "HTTPS" ) + "</option>" +
					"<option data-hs='6' value='6'" + ( typeof OSApp.currentSession.controller.settings.email === "object" ? ">" : " disabled>" ) + OSApp.Language._( "Remote Station (OTC)" ) + "</option>" +
					"</select>" +
					"<div id='specialOpts'></div>";
			}

			select += "</div>";

			// Common Submit button
			select += "<input data-wrapper-class='attrib-submit' data-theme='b' type='submit' value='" + OSApp.Language._( "Submit" ) + "' /></form></fieldset></div>";

			select = $( select ).enhanceWithin().on( "submit", "form", function() {
				saveChanges( sid );
				return false;
			} ).on( "stationcleanup.stationAttributes popupafterclose.stationAttributes", cleanupStationPopup );
			page.off( "pagehide.stationAttributes" ).one( "pagehide.stationAttributes", cleanupStationPopup );

			// Populate sequential group selection menu
			if ( OSApp.Supported.groups() ) {
				var seqGroupSelect = select.find( "select.seqgrp" ),
					seqGroupLabel = select.find( "span.seqgrp" ),
					stationGID = OSApp.Stations.getGIDValue( sid );

				var isRunning = OSApp.Stations.isRunning( sid ),
					prohibitChange = select.find( "p#prohibit-change" );
				if ( isRunning ) {
					seqGroupSelect.addClass( "ui-state-disabled" );
					prohibitChange.removeClass( "hidden" );
				} else {
					seqGroupSelect.removeClass( "ui-state-disabled" );
					prohibitChange.addClass( "hidden" );
				}

				for ( var i = 0; i <= OSApp.Constants.options.NUM_SEQ_GROUPS; i++ ) {
					var value = OSApp.Groups.mapIndexToGIDValue( i ),
						label = OSApp.Groups.mapGIDValueToName( value ),
						option = $(
							"<option data-gid='" + value + "' value='" +
							value + "'>" +  OSApp.Language._( label ) + "</option>"
						);

					if ( value === stationGID ) {
						option.prop( "selected", true );
						seqGroupLabel.text( label );
					} else {
						option.prop( "selected", false  );
					}
					seqGroupSelect.append( option );
				}
			}

			// Display the selected tab when clicked
			select.find( "ul.tabs li" ).click( function() {
				var tabId = $( this ).attr( "data-tab" );

				$( "ul.tabs li" ).removeClass( "current" );
				$( ".tab-content" ).removeClass( "current" );

				$( this ).addClass( "current" );
				$( "#" + tabId ).addClass( "current" );
			} );

			// Update Advanced tab whenever a new special station type is selected
			select.find( "#hs" ).on( "change", function() {
				var value = parseInt( $( this ).val() );
				showSpecialOptions( value );
				return false;
			} );

			// Refresh station data from firmware and update the Advanced tab to reflect special station type
			if ( OSApp.Stations.isSpecial( sid ) ) {
				var cachedSpecial = OSApp.currentSession.controller.special && OSApp.currentSession.controller.special[ sid ],
					callbackInvoked = false,
					refreshSpecialOptions = function() {
						if ( !popupActive || !isSessionCurrent() ) return;
						var special = OSApp.currentSession.controller.special && OSApp.currentSession.controller.special[ sid ] || cachedSpecial,
							type = special && Number.isInteger( special.st ) && special.st >= 0 && special.st <= 6 ? special.st : 0;

						select.find( "#hs" )
							.removeClass( "ui-disabled" )
							.find( "option[data-hs='" + type + "']" ).prop( "selected", true );
						select.find( "#hs" ).change();
					},
					request = OSApp.Sites.updateControllerStationSpecial( function() {
						callbackInvoked = true;
						refreshSpecialOptions();
					} );

				// updateControllerStationSpecial deliberately converts request failures into a resolved
				// promise. Recover the editor even though its success-only callback was not invoked.
				$.when( request ).always( function() {
					if ( !callbackInvoked ) refreshSpecialOptions();
				} );
			} else {
				select.find( "#hs" ).removeClass( "ui-disabled" );
				select.find( "option[data-hs='0']" ).prop( "selected", true );
				select.find( "#hs" ).change();
			}

			select.find( ".changeBackground" ).on( "click", function( e ) {
				e.preventDefault();
				var button = this;

				OSApp.UIDom.getPicture( function( image ) {
					if ( !popupActive || !isSessionCurrent() || !select.closest( "html" ).length ) return;
					sites[ sessionSite ].images[ sid ] = image;
					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
					updateContent();

					button.innerHTML =  OSApp.Language._( "Change" ) + " " + OSApp.Language._( "Image" );
				} );
			} );

			$.mobile.pageContainer.append( select );

			var opts = { history: false };

			if ( OSApp.currentDevice.isiOS ) {
				var pageTop = OSApp.UIDom.getPageTop();

				opts.x = pageTop.x;
				opts.y = pageTop.y;
			} else {
				opts.positionTo = "window";
			}

			select.popup( opts ).popup( "open" );
			},
			submitStations = function( id ) {
				var is208 = ( OSApp.Firmware.checkOSVersion( 208 ) === true ),
					master = {},
					master2 = {},
				sequential = {},
				special = {},
				rain = {},
				sensor1 = {},
				sensor2 = {},
				relay = {},
				disable = {},
				names = {},
				attrib, bid, sid, gid, s;

			for ( bid = 0; bid < OSApp.currentSession.controller.settings.nbrd; bid++ ) {
				if ( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_1 ) ) {
					master[ "m" + bid ] = 0;
				}
				if ( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_2 ) ) {
					master2[ "n" + bid ] = 0;
				}
				if ( OSApp.Supported.sequential() ) {
					sequential[ "q" + bid ] = 0;
				}
				if ( OSApp.Supported.special() ) {
					special[ "p" + bid ] = 0;
				}
				if ( OSApp.Supported.ignoreRain() ) {
					rain[ "i" + bid ] = 0;
				}
				if ( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_1 ) ) {
					sensor1[ "j" + bid ] = 0;
				}
				if ( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_2 ) ) {
					sensor2[ "k" + bid ] = 0;
				}
				if ( OSApp.Supported.actRelay() ) {
					relay[ "a" + bid ] = 0;
				}
				if ( OSApp.Supported.disabled() ) {
					disable[ "d" + bid ] = 0;
				}

				for ( s = 0; s < 8; s++ ) {
					sid = bid * 8 + s;
					attrib = page.find( "#attrib-" + sid );

					if ( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_1 ) ) {
						master[ "m" + bid ] = ( master[ "m" + bid ] ) + ( attrib.data( "um" ) << s );
					}

					if ( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_2 ) ) {
						master2[ "n" + bid ] = ( master2[ "n" + bid ] ) + ( attrib.data( "um2" ) << s );
					}

					if ( OSApp.Supported.sequential() ) {
						sequential[ "q" + bid ] = ( sequential[ "q" + bid ] ) + ( attrib.data( "us" ) << s );
					}

					if ( OSApp.Supported.special() ) {
						special[ "p" + bid ] = ( special[ "p" + bid ] ) + ( ( attrib.data( "hs" ) ? 1 : 0 ) << s );
					}

					if ( OSApp.Supported.ignoreRain() ) {
						rain[ "i" + bid ] = ( rain[ "i" + bid ] ) + ( attrib.data( "ir" ) << s );
					}

					if ( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_1 ) ) {
						sensor1[ "j" + bid ] = ( sensor1[ "j" + bid ] ) + ( attrib.data( "sn1" ) << s );
					}

					if ( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_2 ) ) {
						sensor2[ "k" + bid ] = ( sensor2[ "k" + bid ] ) + ( attrib.data( "sn2" ) << s );
					}

					if ( OSApp.Supported.actRelay() ) {
						relay[ "a" + bid ] = ( relay[ "a" + bid ] ) + ( attrib.data( "ar" ) << s );
					}

					if ( OSApp.Supported.disabled() ) {
						disable[ "d" + bid ] = ( disable[ "d" + bid ] ) + ( attrib.data( "sd" ) << s );
					}

					// Only send the name of the station being updated
					if ( sid === id ) {

						// Because the firmware has a bug regarding spaces, let us replace them out now with a compatible separator
						if ( is208 ) {
							names[ "s" + sid ] = page.find( "#station_" + sid ).text().replace( /\s/g, "_" );
						} else {
							names[ "s" + sid ] = page.find( "#station_" + sid ).text();
						}

						if ( OSApp.Supported.special() && attrib.data( "hs" ) ) {
							special.st = attrib.data( "hs" );
							special.sd = attrib.data( "specialData" );
							special.sid = id;
						}

						if ( OSApp.Supported.groups() ) {
							gid = attrib.attr( "data-gid" );
						}
					}
				}
			}

				var submission = OSApp.Dashboard.beginStationSubmission();
				if ( !submission ) return false;
				OSApp.Firmware.sendToOS( "/cs?pw=&" + $.param( names ) +
					( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_1 ) ? "&" + $.param( master ) : "" ) +
				( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_2 ) ? "&" + $.param( master2 ) : "" ) +
				( OSApp.Supported.sequential() ? "&" + $.param( sequential ) : "" ) +
				( OSApp.Supported.special() ? "&" + $.param( special ) : "" ) +
				( OSApp.Supported.ignoreRain() ? "&" + $.param( rain ) : "" ) +
				( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_1 ) ? "&" + $.param( sensor1 ) : "" ) +
				( OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_2 ) ? "&" + $.param( sensor2 ) : "" ) +
				( OSApp.Supported.actRelay() ? "&" + $.param( relay ) : "" ) +
				( OSApp.Supported.disabled() ? "&" + $.param( disable ) : "" ) +
					( OSApp.Supported.groups() ? "&g" + id + "=" + gid : "" )
				).then( function() {
					if ( !OSApp.Dashboard.isSessionIdentityCurrent( submission ) ) {
						return $.Deferred().reject( { status:0, statusText:"stale-session" } ).promise();
					}
					return OSApp.Sites.updateController( function() {
						if ( !OSApp.Dashboard.isSessionIdentityCurrent( submission ) ) return;
						$( "html" ).trigger( "datarefresh" );
					} );
				} ).done( function() {
					if ( !OSApp.Dashboard.isSessionIdentityCurrent( submission ) ) return;
					OSApp.Errors.showError( OSApp.Language._( "Stations have been updated" ) );
				} ).always( function() {
					OSApp.Dashboard.finishStationSubmission( submission );
				} );
				return true;
			},
		updateClock = function() {

			// Update the current time
			OSApp.uiState.timers.clock = {
				val: OSApp.currentSession.controller.settings.devt,
				update: function() {
					var timestamp = Number( this.val );
					page.find( "#clock-s" ).text( Number.isSafeInteger( timestamp ) && timestamp > 0 ?
						OSApp.Dates.dateToString( new Date( timestamp * 1000 ), null, 1 ) : "--" );
				}
			};
		},
		compareCardsGroupView = function( a, b ) {

			/* Sorting order: 	master ->
								sequential group id ->
								active status ->
								station id OR alphabetical
			*/

			var cardA = $( a ), cardB = $( b );

			// Station IDs
			var sidA = OSApp.Cards.getSID( cardA );
			var sidB = OSApp.Cards.getSID( cardB );

			// Station Names
			var nameA = OSApp.Stations.getName( sidA );
			var nameB = OSApp.Stations.getName( sidB );

			// Verify if a master station
			var masA = OSApp.Stations.isMaster( sidA ) > 0 ? 1 : 0;
			var masB = OSApp.Stations.isMaster( sidB ) > 0 ? 1 : 0;

			if ( masA > masB ) {
				return -1;
			} else if ( masA < masB ) {
				return 1;
			} else { // If both or neither master check group id

				var gidA = OSApp.Stations.getGIDValue( OSApp.Cards.getSID( cardA ) );
				var gidB = OSApp.Stations.getGIDValue( OSApp.Cards.getSID( cardB ) );

				if ( gidA < gidB ) {
					return -1;
				} else if ( gidA > gidB ) {
					return 1;
				} else { // If same group shift running stations up

					var statusA = OSApp.Stations.getStatus( sidA );
					var statusB = OSApp.Stations.getStatus( sidB );

					if ( statusA > statusB ) {
						return -1;
					} else if ( statusA < statusB ) {
						return 1;
					} else {
						if( OSApp.uiState.sortByStationName ) {
							if ( nameA < nameB ) { return -1; } else if ( nameA > nameB ) { return 1; } else { return 0; }
						}else{
							if ( sidA < sidB ) { return -1; } else if ( sidA > sidB ) { return 1; } else { return 0; }
						}
					}
				}
			}
		},
		compareCardsStandardView = function( a, b ) {

			/* Sorting order: 	running status ->
								station id OR alphabetical
			 */

			var cardA = $( a ), cardB = $( b );

			var sidA = OSApp.Cards.getSID( cardA );
			var sidB = OSApp.Cards.getSID( cardB );

			var nameA = OSApp.Stations.getName( sidA );
			var nameB = OSApp.Stations.getName( sidB );

			var statusA = OSApp.Stations.getStatus( sidA );
			var statusB = OSApp.Stations.getStatus( sidB );

			if ( statusA > statusB ) {
				return -1;
			} else if ( statusA < statusB ) {
				return 1;
			} else {
				if ( OSApp.uiState.sortByStationName){
					if ( nameA < nameB ) {
						return -1;
					} else if ( nameA > nameB ) {
						return 1;
					} else {
						return 0;
					}
				} else {
					if ( sidA < sidB ) {
						return -1;
					}
					if ( sidA > sidB ) {
						return 1;
					}
					return 0;
				}
			}
		},

		updateGroupView = function( cardHolder, cardList ) {
			var thisCard, nextCard, divider, label, idx,
				cardCount = cardHolder.children().length;
			if ( cardCount === 0 ) return;

			for ( idx = 0; idx < cardCount; idx++ ) {
				thisCard = OSApp.CardList.getCardByIndex( cardList, idx );
				OSApp.Cards.setGroupLabel( thisCard, OSApp.Cards.getGIDName( thisCard ) );
			}
			for ( idx = 0; idx < cardCount - 1; idx++ ) {
				thisCard = OSApp.CardList.getCardByIndex( cardList, idx );
				nextCard = OSApp.CardList.getCardByIndex( cardList, idx + 1 );

				divider = OSApp.Cards.getDivider( thisCard );
				label = OSApp.Cards.getGroupLabel( thisCard );

				// Display master separately
				if ( OSApp.Cards.isMasterStation( thisCard ) ) {
					if ( !OSApp.Cards.isMasterStation( nextCard ) ) {
						divider.show();
					} else {
						divider.hide();
					}
					label.addClass( "hidden" );
					continue;
				}

				if ( OSApp.Stations.getGIDValue( OSApp.Cards.getSID( thisCard ) ) !== OSApp.Stations.getGIDValue( OSApp.Cards.getSID( nextCard ) ) ) {
					divider.show();
				} else {
					divider.hide();
				}
			}
			nextCard = OSApp.CardList.getCardByIndex( cardList, cardCount - 1 );
			OSApp.Cards.getDivider( nextCard ).show(); // Last group divider
			OSApp.Cards.setGroupLabel( nextCard, OSApp.Cards.getGIDName( nextCard ) );
		},
		updateStandardView = function( cardHolder, cardList ) {
			var thisCard, nextCard, divider, label, idx,
				cardCount = cardHolder.children().length;
			if ( cardCount === 0 ) return;
			for ( idx = 0; idx < cardCount - 1; idx++ ) {
				thisCard = OSApp.CardList.getCardByIndex( cardList, idx );
				nextCard = OSApp.CardList.getCardByIndex( cardList, idx + 1 );

				divider = OSApp.Cards.getDivider( thisCard );
				divider.hide(); // Remove all dividers when switching from group view

				OSApp.Cards.setGroupLabel( thisCard, OSApp.Groups.mapGIDValueToName( OSApp.Stations.getGIDValue( OSApp.Cards.getSID( thisCard ) ) ) );
				label = OSApp.Cards.getGroupLabel( thisCard );
				if ( typeof label !== "undefined" && OSApp.Cards.isMasterStation( thisCard ) ) {
					label.addClass( "hidden" );
				}

				//  Display divider between active and non-active stations
				if ( OSApp.Stations.isRunning( OSApp.Cards.getSID( thisCard ) ) &&
					!OSApp.Stations.isRunning( OSApp.Cards.getSID( nextCard ) ) ) {
					divider.show();
				}
			}
			nextCard = OSApp.CardList.getCardByIndex( cardList, cardCount - 1 );
			OSApp.Cards.getDivider( nextCard ).hide();
			OSApp.Cards.setGroupLabel( nextCard, OSApp.Groups.mapGIDValueToName( OSApp.Stations.getGIDValue( OSApp.Cards.getSID( nextCard ) ) ) );
			label = OSApp.Cards.getGroupLabel( nextCard );
			if ( typeof label !== "undefined" && OSApp.Cards.isMasterStation( nextCard ) ) {
				label.addClass( "hidden" );
			}
		},
		reorderCards = function() {
			var cardHolder = page.find( "#os-stations-list" ),
				cardList = cardHolder.children(),
				compareCards = OSApp.uiState.groupView ? compareCardsGroupView : compareCardsStandardView;

			// Sort stations
			cardList.sort( compareCards ).detach().appendTo( cardHolder );

			if ( OSApp.Supported.groups() && OSApp.uiState.groupView ) {
				updateGroupView( cardHolder, cardList );
			} else {
				updateStandardView( cardHolder, cardList );
			}
		},
		updateContent = function() {
			var cardHolder = page.find( "#os-stations-list" ),
				cardList = cardHolder.children(),
				isScheduled, isRunning, pname, rem, qPause, card, line, imageSource;

			if ( !page.hasClass( "ui-page-active" ) ) {
				return;
			}

			updateClock();
			updateSites();
			OSApp.Dashboard.updateWaterLevel();
			OSApp.Dashboard.updateRestrictNotice();
			OSApp.Analog.updateSensorShowArea( page );

			page.find( ".sitename" ).text( OSApp.currentSession.local ? OSApp.currentSession.controller.settings?.dname || "" : siteSelect.val() );

			// Remove unused stations
			OSApp.CardList.getAllCards( cardList ).filter( function( _, a ) {
				return parseInt( $( a ).data( "station" ), 10 ) >= OSApp.currentSession.controller.stations.snames.length;
			} ).remove();

			for ( var sid = 0; sid < OSApp.currentSession.controller.stations.snames.length; sid++ ) {
				isScheduled = OSApp.Stations.getPID( sid ) > 0;
				isRunning = OSApp.Stations.getStatus( sid ) > 0;
				pname = isScheduled ? OSApp.Utils.htmlEscape( OSApp.Programs.pidToName( OSApp.Stations.getPID( sid ) ) ) : "";
				rem = OSApp.Stations.getRemainingRuntime( sid ),
					qPause = OSApp.StationQueue.isPaused(),
					imageSource = OSApp.Dashboard.getStationImageSource( sites[ currentSite ].images[ sid ], OSApp.UIDom.getAppURLPath() + "img/placeholder.png" );

				card = OSApp.CardList.getCardBySID( cardList, sid );

				if ( card.length === 0 ) {
					cards = "";
					addCard( sid );
					cardHolder.append( cards );
				} else {
					card.find( ".ui-body > img" ).attr( "src", imageSource );

					if ( OSApp.Stations.isDisabled( sid ) ) {
						if ( !page.hasClass( "show-hidden" ) ) {
							card.hide();
						}
						card.addClass( "station-hidden" );
					} else {
						card.show().removeClass( "station-hidden" );
					}

					card.find( "#station_" + sid ).text( OSApp.Stations.getName( sid) );
					card.find( ".special-station" ).removeClass( "hidden" ).addClass( OSApp.Stations.isSpecial( sid ) ? "" : "hidden" );
					card.find( ".station-status" ).removeClass( "on off wait" ).addClass( isRunning ? "on" : ( isScheduled ? "wait" : "off" ) );
					if ( OSApp.Stations.isMaster( sid ) ) {
						card.find( ".station-settings" ).removeClass( "ui-icon-gear" ).addClass( "ui-icon-master" );
					} else {
						card.find( ".station-settings" ).removeClass( "ui-icon-master" ).addClass( "ui-icon-gear" );
					}

					card.find( ".station-settings" ).data( {
						um: OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_1 ) ? OSApp.StationAttributes.getMasterOperation( sid, OSApp.Constants.options.MASTER_STATION_1 ) : undefined,
						um2: OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_2 ) ? OSApp.StationAttributes.getMasterOperation( sid, OSApp.Constants.options.MASTER_STATION_2 ) : undefined,
						ir: OSApp.Supported.ignoreRain() ? OSApp.StationAttributes.getIgnoreRain( sid ) : undefined,
						sn1: OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_1 ) ? OSApp.StationAttributes.getIgnoreSensor( sid, OSApp.Constants.options.IGNORE_SENSOR_1 ) : undefined,
						sn2: OSApp.Supported.ignoreSensor( OSApp.Constants.options.IGNORE_SENSOR_2 ) ? OSApp.StationAttributes.getIgnoreSensor( sid, OSApp.Constants.options.IGNORE_SENSOR_2 ) : undefined,
						ar: OSApp.Supported.actRelay() ? OSApp.StationAttributes.getActRelay( sid ) : undefined,
						sd: OSApp.Supported.disabled() ? OSApp.StationAttributes.getDisabled( sid ) : undefined,
						us: OSApp.Supported.sequential() ? OSApp.StationAttributes.getSequential( sid ) : undefined,
						hs: OSApp.Supported.special() ? OSApp.StationAttributes.getSpecial( sid ) : undefined,
						gid: OSApp.Supported.groups() ? OSApp.Stations.getGIDValue( sid ) : undefined
					} );

					if ( !OSApp.Stations.isMaster( sid ) && ( isScheduled || isRunning ) ) {
						line = ( isRunning ? OSApp.Language._( "Running" ) + " " + pname : OSApp.Language._( "Scheduled" ) + " " +
							( OSApp.Stations.getStartTime( sid ) ? OSApp.Language._( "for" ) + " " + OSApp.Dates.dateToString( new Date( OSApp.Stations.getStartTime( sid ) * 1000 ) ) : pname ) );
						if ( rem > 0 ) {

							// Show the remaining time if it's greater than 0
							line += " <span id=" + ( qPause ? "'pause" : "'countdown-" ) + sid + "' class='nobr'>(" + OSApp.Dates.sec2hms( rem ) + " " + OSApp.Language._( "remaining" ) + ")</span>";

							if ( isRunning ) {
								addTimer( sid, rem );
							} else {
								// Station is scheduled/paused but not running - remove timer if it exists
								if ( OSApp.uiState.timers[ "station-" + sid ] ) {
									delete OSApp.uiState.timers[ "station-" + sid ];
								}
							}
						}
						if ( card.find( ".rem" ).length === 0 ) {
							card.find( ".ui-body" ).append( "<p class='rem center'>" + line + "</p>" );
						} else {
							card.find( ".rem" ).html( line );
						}
					} else {
						card.find( ".rem" ).remove();
					}

				}
			}

			reorderCards();
		},
		updateSites = function( callback ) {
			callback = callback || function() {};

			currentSite = siteSelect.val();
			OSApp.Storage.get( "sites", function( data ) {
				sites = OSApp.Sites.parseSites( data.sites );
				// Prevent errors during test: page navigation checks
				if ( !sites || $.isEmptyObject(sites) || !currentSite ) {
					return;
				}

				if ( typeof sites[ currentSite ]?.images !== "object" || $.isEmptyObject( sites[ currentSite ].images ) ) {
					sites[ currentSite ].images = {};
					page.removeClass( "has-images" );
				} else {
					page.addClass( "has-images" );
				}
				if ( typeof sites[ currentSite ]?.notes !== "object" ) {
					sites[ currentSite ].notes = {};
				}
				if ( typeof sites[ currentSite ]?.lastRunTime !== "object" ) {
					sites[ currentSite ].lastRunTime = {};
				}

				callback();
			} );
		};


	page.on( "pageshow.dashboardRefresh", function() {
		$( "html" ).off( "datarefresh.dashboard", updateContent ).on( "datarefresh.dashboard", updateContent );
	} ).on( "pagehide.dashboardRefresh pageremove.dashboardRefresh", function() {
		$( "html" ).off( "datarefresh.dashboard", updateContent );
	} );

	function begin( firstLoad ) {
		if ( !OSApp.currentSession.isControllerConnected() ) {
			return false;
		}

		cards = "";
		siteSelect = $( "#site-selector" );

		updateSites( function() {
			for ( i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++ ) {
				addCard( i );
			}

			page.find( "#os-stations-list" ).html( cards );
			reorderCards();
		} );

		page.find( ".sitename" ).toggleClass( "hidden", OSApp.currentSession.local ? (OSApp.currentSession.controller.settings?.dname ? false : true) : false );
		page.find( ".sitename" ).text( OSApp.currentSession.local ? OSApp.currentSession.controller.settings?.dname || "" : siteSelect.val() );
		OSApp.Dashboard.renderWaterLevel( page.find( "#water-level" ), OSApp.currentSession.controller.options.wl );

		OSApp.Analog.updateSensorShowArea( page );
		updateClock();

		page.on( "click", ".station-settings", showAttributes );

		page.on( "click", ".settings-weather", function() {
			OSApp.UIDom.changePage( "#os-options", {
				expandItem: "weather"
			} );
			return false;
		} );

		page.on( "click", ".card", function() {

			// Bind delegate handler to stop specific station (supported on firmware 2.1.0+ on Arduino)
			if ( !OSApp.Firmware.checkOSVersion( 210 ) ) {
				return false;
			}

			var el = $( this ),
				sid = OSApp.Cards.getSID( el ),
				stationGID = OSApp.Cards.getGIDValue( el ),
				actionIdentity = OSApp.Dashboard.captureSessionIdentity(),
				actionSite = currentSite,
				currentStatus = OSApp.Stations.getStatus( sid ),
				name = OSApp.Stations.getName( sid ),
				question, dialogOptions = {};

			if ( OSApp.Stations.isMaster( sid ) ) {
				return false;
			}

			dialogOptions.type = OSApp.Constants.dialog.REMOVE_STATION;
			dialogOptions.station = sid;
			dialogOptions.gid = stationGID;

			if ( currentStatus ) {
				question = OSApp.Language._( "Do you want to stop the selected station?" );
			} else {
				if ( el.find( "span.nobr" ).length ) {
					question = OSApp.Language._( "Do you want to unschedule the selected station?" );
				} else {
					OSApp.UIDom.showDurationBox( {
						title: name,
						incrementalUpdate: false,
						maximum: 64800,
						seconds: sites[ currentSite ].lastRunTime[ sid ] > 0 ? sites[ currentSite ].lastRunTime[ sid ] : 0,
						helptext: OSApp.Language._( "Enter a duration to manually run " ) + name,
						showQOCheckbox: OSApp.Groups.canPreempt( stationGID ) && OSApp.Stations.isSequential( sid ),
						callback: function( duration, qo ) {
							if ( !OSApp.Dashboard.isSessionIdentityCurrent( actionIdentity ) ) return;
							var action = OSApp.Stations.beginAction( actionIdentity );
							if ( !action ) return;
							var preParam = qo ? "&qo=1" : "";
							OSApp.Firmware.sendToOS( "/cm?sid=" + sid + "&en=1&t=" + duration + preParam + "&pw=", "json" ).done( function() {
								if ( !OSApp.Dashboard.isSessionIdentityCurrent( actionIdentity ) ) return;

								// Update local state until next device refresh occurs
								OSApp.Stations.setPID( sid, OSApp.Constants.options.MANUAL_STATION_PID );
								OSApp.Stations.setRemainingRuntime( sid, duration );

								OSApp.Status.refreshStatus();
								OSApp.Errors.showError( OSApp.Language._( "Station has been queued" ) );

								// Save run time for this station
								sites[ actionSite ].lastRunTime[ sid ] = duration;
								OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
							} ).always( function() {
								OSApp.Stations.finishAction( action );
							} );
						}
					} );
					return;
				}
			}

			OSApp.UIDom.areYouSure( question, OSApp.Stations.getName( sid ), function() {
				if ( !OSApp.Dashboard.isSessionIdentityCurrent( actionIdentity ) ) return;
				var action = OSApp.Stations.beginAction( actionIdentity );
				if ( !action ) return;

				var shiftStations = OSApp.uiState.popupData.shift === true ? 1 : 0;

				OSApp.Firmware.sendToOS( "/cm?sid=" + sid + "&ssta=" + shiftStations + "&en=0&pw=" ).done( function() {
					if ( !OSApp.Dashboard.isSessionIdentityCurrent( actionIdentity ) ) return;

					// Update local state until next device refresh occurs
					OSApp.Stations.setPID( sid, 0 );
					OSApp.Stations.setRemainingRuntime( sid, 0 );
					OSApp.Stations.setStatus( sid, 0 );

					// Remove any timer associated with the station
					delete OSApp.uiState.timers[ "station-" + sid ];

					OSApp.Status.refreshStatus();
					OSApp.Errors.showError( OSApp.Language._( "Station has been stopped" ) );
				} ).always( function() {
					OSApp.Stations.finishAction( action );
				} );
			}, null, dialogOptions );
		} )

			.on( "click", "img", function() {
				var image = $( this ),
					id = image.parents( ".card" ).data( "station" ),
					imageIdentity = OSApp.Dashboard.captureSessionIdentity(),
					imageSite = currentSite,
					hasImage = image.attr( "src" ).indexOf( "data:image/jpeg;base64" ) === -1 ? false : true;

				if ( hasImage ) {
					OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to delete the current image?" ), "", function() {
						if ( !OSApp.Dashboard.isSessionIdentityCurrent( imageIdentity ) ) return;
						delete sites[ imageSite ].images[ id ];
						OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
						updateContent();
					} );
				} else {
					OSApp.UIDom.getPicture( function( image ) {
						if ( !OSApp.Dashboard.isSessionIdentityCurrent( imageIdentity ) ) return;
						sites[ imageSite ].images[ id ] = image;
						OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
						updateContent();
					} );
				}

				return false;
			} )

			.on( {
				pagebeforeshow: function() {
					var header = OSApp.UIDom.changeHeader( {
						class: "logo",
						leftBtn: {
							icon: "bullets",
							on: function() {
								OSApp.uiState.openPanel();
								return false;
							}
						},
						rightBtn: {
							icon: "bell",
							class: "notifications",
							text: "<span class='notificationCount ui-li-count ui-btn-corner-all'>" + OSApp.uiState.notifications.length + "</span>",
							on: function() {
								OSApp.Notifications.showNotifications();
								return false;
							}
						},
						animate: ( firstLoad ? false : true )
					} );

					if ( OSApp.uiState.notifications.length === 0 ) {
						$( header[ 2 ] ).hide();
					}
				}
			} );

		$( "html" ).off( "datarefresh.dashboard" );
		$( "#sprinklers" ).remove();
		$.mobile.pageContainer.append( page );

		if ( !$.isEmptyObject( OSApp.currentSession.weather ) ) {
			OSApp.Weather.updateWeatherBox();
		}
	}

	return begin();
};

OSApp.Dashboard.updateWaterLevel = function() {
	// Update the water level displayed on the dashboard
	if ( !OSApp.currentSession.controller.options ) {
		return;
	}
	OSApp.Dashboard.renderWaterLevel( $( "#water-level" ), OSApp.currentSession.controller.options.wl );
};

OSApp.Dashboard.updateRestrictNotice = function() {
	// Swap the restriction notice displayed on the dashboard
	if ( !OSApp.currentSession.controller.settings ) {
		return;
	}
	if ( OSApp.currentSession.controller.settings?.wtrestr > 0 ) {
		$( "#restr-active" ).removeClass("hidden");
	} else {
		$( "#restr-active" ).addClass("hidden");
	}
};

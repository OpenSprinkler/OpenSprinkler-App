/* global $, ThreeDeeTouch, FastClick, StatusBar, md5 */

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
OSApp.UIDom = OSApp.UIDom || {};

// FIXME: this file needs refactoring attention!

// App entry point
OSApp.UIDom.launchApp = function() {
	Number.prototype.clamp = function( min, max ) {
		return Math.min( Math.max( this, min ), max );
	};

	if ( "serviceWorker" in navigator ) {
		window.addEventListener( "load", function() {
			navigator.serviceWorker.register( "/sw.js" );
		} );
	}

	if ( OSApp.currentDevice.isOSXApp ) {
		document.documentElement.classList.add( "macos" );
	}

	// FIXME: This needs to be rewritten and refactored out so it works properly (mellodev)
	var showSites = ( function() {
		var page = $( "<div data-role='page' id='site-control'>" +
				"<div class='ui-content'>" +
				"</div>" +
			"</div>" ),
			makeStart = function() {
				var finish = function() {
					header.eq( 0 ).hide();
					$( "#header" ).show();
					$( "#footer, #footer-menu" ).hide();
				};

				if ( page.hasClass( "ui-page-active" ) ) {
					finish();
				} else {
					page.one( "pagebeforeshow", function( e ) {
						e.stopImmediatePropagation();
						finish();
					} );
				}

				page.on( "swiperight swipeleft", function( e ) {
					e.stopImmediatePropagation();
				} );

				document.title = "OpenSprinkler";
			},
			popup = $( "<div data-role='popup' id='addsite' data-theme='b'>" +
				"<ul data-role='listview'>" +
					"<li data-icon='false'>" +
						"<a href='#' id='site-add-scan'>" + OSApp.Language._( "Scan For Device" ) + "</a>" +
					"</li>" +
					"<li data-icon='false'>" +
						"<a href='#' id='site-add-manual'>" + OSApp.Language._( "Manually Add Device" ) + "</a>" +
					"</li>" +
				"</ul>" +
			"</div>" ),
			sites, header, total;

		popup.find( "#site-add-scan" ).on( "click", function() {
			popup.popup( "close" );
			OSApp.Network.startScan();
			return false;
		} );

		popup.find( "#site-add-manual" ).on( "click", function() {
			OSApp.Sites.showAddNew( false, true );
			return false;
		} );

		page.on( "pagehide", function() {
			popup.popup( "destroy" ).detach();
			page.detach();
		} );

		$( "html" ).on( "siterefresh", function() {
			if ( page.hasClass( "ui-page-active" ) ) {
				updateContent();
			}
		} );

		function updateContent() {
			OSApp.Storage.get( [ "sites", "current_site", "cloudToken" ], function( data ) {
				sites = OSApp.Sites.parseSites( data.sites );

				if ( $.isEmptyObject( sites ) ) {
					if ( typeof data.cloudToken !== "string" ) {
						OSApp.UIDom.changePage( "#start" );

						return;
					} else {
						makeStart();
						page.find( ".ui-content" ).html( "<p class='center'>" +
							OSApp.Language._( "Please add a site by tapping the 'Add' button in the top right corner." ) +
						"</p>" );
					}
				} else {
					var list = "<div data-role='collapsible-set'>",
						siteNames = [],
						i = 0;

					total = Object.keys( sites ).length;

					if ( !OSApp.currentSession.isControllerConnected() || !total || !( data.current_site in sites ) ) {
						makeStart();
					}

					sites = OSApp.Utils.sortObj( sites );

					$.each( sites, function( a, b ) {
						siteNames.push( a );

						a = OSApp.Utils.htmlEscape( a );

						list += "<fieldset " + ( ( total === 1 ) ? "data-collapsed='false'" : "" ) + " id='site-" + i + "' data-role='collapsible'>" +
							"<h3>" +
								"<a class='ui-btn ui-btn-corner-all connectnow yellow' data-site='" + i + "' href='#'>" +
									OSApp.Language._( "connect" ) +
								"</a>" +
							a + "</h3>" +
							"<form data-site='" + i + "' novalidate>" +
								"<div class='ui-field-contain'>" +
									"<label for='cnm-" + i + "'>" + OSApp.Language._( "Change Name" ) + "</label><input id='cnm-" + i + "' type='text' value='" + a + "'>" +
								"</div>" +
								( b.os_token ? "" : "<div class='ui-field-contain'>" +
									"<label for='cip-" + i + "'>" + OSApp.Language._( "Change IP" ) + "</label><input id='cip-" + i + "' type='url' value='" + b.os_ip +
										"' autocomplete='off' autocorrect='off' autocapitalize='off' pattern='' spellcheck='false'>" +
								"</div>" ) +
								( b.os_token ? "<div class='ui-field-contain'>" +
									"<label for='ctoken-" + i + "'>" + OSApp.Language._( "Change Token" ) + "</label><input id='ctoken-" + i + "' type='text' value='" + b.os_token +
										"' autocomplete='off' autocorrect='off' autocapitalize='off' pattern='' spellcheck='false'>" +
								"</div>" : "" ) +
								"<div class='ui-field-contain'>" +
									"<label for='cpw-" + i + "'>" + OSApp.Language._( "Change Password" ) + "</label><input id='cpw-" + i + "' type='password'>" +
								"</div>" +
								( b.os_token ? "" : "<fieldset data-mini='true' data-role='collapsible'>" +
									"<h3>" +
										"<span style='line-height:23px'>" + OSApp.Language._( "Advanced" ) + "</span>" +
										"<button data-helptext='" +
											OSApp.Language._( "These options are only for an OpenSprinkler behind a proxy capable of SSL and/or Basic Authentication." ) +
											"' class='collapsible-button-right help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
									"</h3>" +
									"<label for='usessl-" + i + "'>" +
										"<input data-mini='true' type='checkbox' id='usessl-" + i + "' name='usessl-" + i + "'" +
											( typeof b.ssl !== "undefined" && b.ssl === "1" ? " checked='checked'" : "" ) + ">" +
										OSApp.Language._( "Use SSL" ) +
									"</label>" +
									"<label for='useauth-" + i + "'>" +
										"<input class='useauth' data-user='" + b.auth_user + "' data-pw='" + b.auth_pw +
											"' data-mini='true' type='checkbox' id='useauth-" + i + "' name='useauth-" + i + "'" +
											( typeof b.auth_user !== "undefined" && typeof b.auth_pw !== "undefined" ? " checked='checked'" : "" ) + ">" +
										OSApp.Language._( "Use Auth" ) +
									"</label>" +
								"</fieldset>" ) +
								"<input class='submit' type='submit' value='" + OSApp.Language._( "Save Changes to" ) + " " + a + "'>" +
								"<a data-role='button' class='deletesite' data-site='" + i + "' href='#' data-theme='b'>" + OSApp.Language._( "Delete" ) + " " + a + "</a>" +
							"</form>" +
						"</fieldset>";

						OSApp.Sites.testSite( b, i, function( id, result ) {
							page.find( "#site-" + id + " .connectnow" )
								.removeClass( "yellow" )
								.addClass( result ? "green" : "red" );
						} );

						i++;
					} );

					list = $( list + "</div>" );

					list.find( "form" ).one( "change input", function() {
						$( this ).find( ".submit" ).addClass( "hasChanges" );
					} );

					list.find( ".connectnow" ).on( "click", function() {
						OSApp.Sites.updateSite( siteNames[ $( this ).data( "site" ) ] );
						return false;
					} );

					list.find( ".help-icon" ).on( "click", OSApp.UIDom.showHelpText );

					list.find( ".useauth" ).on( "change", function() {
						var el = $( this );

						if ( el.is( ":checked" ) ) {
							var popup = $( "<div data-role='popup' data-theme='a'>" +
								"<form method='post' class='ui-content' novalidate>" +
									"<label for='auth_user'>" + OSApp.Language._( "Username:" ) + "</label>" +
									"<input autocomplete='off' autocorrect='off' autocapitalize='off' " +
										"spellcheck='false' type='text' name='auth_user' id='auth_user'>" +
									"<label for='auth_pw'>" + OSApp.Language._( "Password:" ) + "</label>" +
									"<input type='password' name='auth_pw' id='auth_pw'>" +
									"<input type='submit' class='submit' value='" + OSApp.Language._( "Submit" ) + "'>" +
								"</form>" +
								"</div>" ).enhanceWithin(),
								didSubmit = false;

							popup.find( ".submit" ).on( "click", function() {
								el.data( {
									user: popup.find( "#auth_user" ).val(),
									pw: popup.find( "#auth_pw" ).val()
								} );

								didSubmit = true;
								popup.popup( "close" );
								return false;
							} );

							popup.one( "popupafterclose", function() {
								if ( !didSubmit ) {
									el.attr( "checked", false ).checkboxradio( "refresh" );
								}
							} );

							OSApp.UIDom.openPopup( popup );
						} else {
							el.data( {
								user: "",
								pw: ""
							} );
						}
					} );

					list.find( "form" ).on( "submit", function() {
						var form = $( this ),
							id = form.data( "site" ),
							site = siteNames[ id ],
							ip = list.find( "#cip-" + id ).val(),
							pw = list.find( "#cpw-" + id ).val(),
							nm = list.find( "#cnm-" + id ).val(),
							useauth = list.find( "#useauth-" + id ).is( ":checked" ),
							usessl = list.find( "#usessl-" + id ).is( ":checked" ) ? "1" : undefined,
							authUser = list.find( "#useauth-" + id ).data( "user" ),
							authPass = list.find( "#useauth-" + id ).data( "pw" ),
							needsReconnect = ( ip !== "" && ip !== sites[ site ].os_ip ) ||
												usessl !== sites[ site ].ssl ||
												authUser !== sites[ site ].auth_user ||
												authPass !== sites[ site ].auth_pw,
							isCurrent = ( site === data.current_site ),
							rename = ( nm !== "" && nm !== site );

						form.find( ".submit" ).removeClass( "hasChanges" );

						if ( useauth ) {
							sites[ site ].auth_user = authUser;
							sites[ site ].auth_pw = authPass;
						} else {
							delete sites[ site ].auth_user;
							delete sites[ site ].auth_pw;
						}

						if ( usessl === "1" ) {
							sites[ site ].ssl = usessl;
						} else {
							delete sites[ site ].ssl;
						}

						if ( ip !== "" && ip !== sites[ site ].os_ip ) {
							sites[ site ].os_ip = ip;
						}
						if ( pw !== "" && pw !== sites[ site ].os_pw ) {
							if ( OSApp.Utils.isMD5( sites[ site ].os_pw ) ) {
								pw = md5( pw );
							}
							sites[ site ].os_pw = pw;
						}
						if ( rename ) {
							sites[ nm ] = sites[ site ];
							delete sites[ site ];
							site = nm;
							if ( isCurrent ) {
								OSApp.Storage.set( { "current_site": site } );
								data.current_site = site;
							}
							OSApp.Sites.updateSiteList( Object.keys( sites ), data.current_site );

							//OSApp.Firmware.sendToOS( "/cv?pw=&cn=" + data.current_site );
						}

						OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );

						OSApp.Errors.showError( OSApp.Language._( "Site updated successfully" ) );

						if ( site === data.current_site ) {
							if ( pw !== "" ) {
								OSApp.currentSession.pass = pw;
							}
							if ( needsReconnect ) {
								OSApp.Sites.checkConfigured();
							}
						}

						if ( rename && !form.find( ".submit" ).hasClass( "preventUpdate" ) ) {
							updateContent();
						}

						return false;
					} );

					list.find( ".deletesite" ).on( "click", function() {
						var site = siteNames[ $( this ).data( "site" ) ];
						OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete " ) + site + "?", "", function() {
							if ( $( "#site-selector" ).val() === site ) {
								makeStart();
							}

							delete sites[ site ];
							OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, function() {
								OSApp.Network.cloudSaveSites();
								OSApp.Sites.updateSiteList( Object.keys( sites ), data.current_site );
								if ( $.isEmptyObject( sites ) ) {
									OSApp.Storage.get( "cloudToken", function() {
										if ( data.cloudToken === null || data.cloudToken === undefined ) {
											OSApp.currentSession.ip = "";
											OSApp.currentSession.pass = "";
											OSApp.UIDom.changePage( "#start" );
											return;
										}
									} );
								} else {
									updateContent();
									OSApp.Errors.showError( OSApp.Language._( "Site deleted successfully" ) );
								}
								return false;
							} );
						} );
						return false;
					} );

					page.find( ".ui-content" ).html( list.enhanceWithin() );
				}

				if ( typeof data.cloudToken === "string" ) {
					page.find( ".ui-content" ).prepend( OSApp.Network.addSyncStatus( data.cloudToken ) );

				}
			} );
		}

		function begin() {
			header = OSApp.UIDom.changeHeader( {
				title: OSApp.Language._( "Manage Sites" ),
				animate: OSApp.currentSession.isControllerConnected() ? true : false,
				leftBtn: {
					icon: "carat-l",
					text: OSApp.Language._( "Back" ),
					class: "ui-toolbar-back-btn",
					on: function() {
						page.find( ".hasChanges" ).addClass( "preventUpdate" );
						OSApp.UIDom.checkChangesBeforeBack();
					}
				},
				rightBtn: {
					icon: "plus",
					text: OSApp.Language._( "Add" ),
					on: function() {
						if ( typeof OSApp.currentDevice.deviceIp === "undefined" ) {
							OSApp.Sites.showAddNew();
						} else {
							popup.popup( "open" ).popup( "reposition", {
								positionTo: header.eq( 2 )
							} );
						}
					}
				}
			} );

			updateContent();

			$.mobile.pageContainer.append( popup );

			popup.popup( {
				history: false,
				positionTo: header.eq( 2 )
			} ).enhanceWithin();

			$( "#site-control" ).remove();
			$.mobile.pageContainer.append( page );
		}

		return begin;
	} )();

	// FIXME: This needs to be rewritten and refactored out so it works properly (mellodev)
	var showHome = ( function() {
		var cards, siteSelect, currentSite, i, sites;
		var page = $( "<div data-role='page' id='sprinklers'>" +
				"<div class='ui-panel-wrapper'>" +
					"<div class='ui-content' role='main'>" +
						"<div class='ui-grid-a ui-body ui-corner-all info-card noweather'>" +
							"<div class='ui-block-a'>" +
								"<div id='weather' class='pointer'></div>" +
							"</div>" +
							"<div class='ui-block-b center home-info pointer'>" +
								"<div class='sitename bold'></div>" +
								"<div id='clock-s' class='nobr'></div>" +
								OSApp.Language._( "Water Level" ) + ": <span class='waterlevel'></span>%" +
							"</div>" +
						"</div>" +
						"<div id='os-stations-list' class='card-group center'></div>" +

						"<div id='os-sensor-show' class='card-group center'></div>" +
					"</div>" +
				"</div>" +
			"</div>" ),
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
				var station = OSApp.Stations.getName( sid ),
					isScheduled = OSApp.Stations.getPID( sid ) > 0,
					isRunning = OSApp.Stations.isRunning( sid ),
					pname = isScheduled ? OSApp.Programs.pidToName( OSApp.Stations.getPID( sid ) ) : "",
					rem = OSApp.Stations.getRemainingRuntime( sid ),
					qPause = OSApp.Supported.pausing() && OSApp.StationQueue.isPaused(),
					hasImage = sites[ currentSite ].images[ sid ] ? true : false;

				if ( OSApp.Stations.getStatus( sid ) && rem > 0 ) {
					addTimer( sid, rem );
				}

				// Group card settings visually
				cards += "<div data-station='" + sid + "' class='ui-corner-all card" +
					( OSApp.Stations.isDisabled( sid ) ? " station-hidden' style='display:none" : "" ) + "'>";

				cards += "<div class='ui-body ui-body-a center'>";

				cards += "<img src='" + ( hasImage ? "data:image/jpeg;base64," + sites[ currentSite ].images[ sid ] : OSApp.UIDom.getAppURLPath() + "img/placeholder.png" ) + "' />";

				cards += "<p class='station-name center inline-icon' id='station_" + sid + "'>" + station + "</p>";

				cards += "<span class='btn-no-border ui-btn ui-btn-icon-notext ui-corner-all card-icon station-status " +
					( isRunning ? "on" : ( isScheduled ? "wait" : "off" ) ) + "'></span>";

				cards += "<span class='btn-no-border ui-btn ui-btn-icon-notext ui-icon-wifi card-icon special-station " +
					( OSApp.Stations.isSpecial( sid ) ? "" : "hidden" ) + "'></span>";

				if ( OSApp.Supported.groups() ) {
					cards += "<span class='btn-no-border ui-btn card-icon station-gid " + ( OSApp.Stations.isMaster( sid ) ? "hidden" : "" ) +
								"'>" + OSApp.Groups.mapGIDValueToName( OSApp.Stations.getGIDValue( sid ) ) + "</span>";
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
					( OSApp.Supported.groups() ? ( "data-gid='" + OSApp.Stations.getGIDValue( sid ) + "' " ) : "" ) +
					"></span>";

				if ( !OSApp.Stations.isMaster( sid ) ) {
					if ( isScheduled || isRunning ) {

						// Generate status line for station
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
					( OSApp.Supported.groups() ? "divider-gid=" + OSApp.Stations.getGIDValue( sid ) : "" ) + "></div>";

			},
			showAttributes = function() {
				$( "#stn_attrib" ).popup( "destroy" ).remove();

				var button = $( this ),
					sid = button.data( "station" ),
					name = button.siblings( "[id='station_" + sid + "']" ),
					showSpecialOptions = function( value ) {
						var opts = select.find( "#specialOpts" ),
							data = OSApp.currentSession.controller.special && Object.prototype.hasOwnProperty.call(OSApp.currentSession.controller.special,  sid ) ? OSApp.currentSession.controller.special[ sid ].sd : "",
							type  = OSApp.currentSession.controller.special && Object.prototype.hasOwnProperty.call(OSApp.currentSession.controller.special,  sid ) ? OSApp.currentSession.controller.special[ sid ].st : 0;

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
								"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='rf-code' required='true' type='text' value='" + data + "'>"
							).enhanceWithin();
						} else if ( value === 2 ) {
							data = OSApp.Stations.parseRemoteStationData( ( type === value ) ? data : "00000000005000" );

							opts.append(
								"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Address" ) + ":</div>" +
								"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-address' required='true' type='text' pattern='^(?:[0-9]{1,3}.){3}[0-9]{1,3}$' value='" + data.ip + "'>" +
								"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Port" ) + ":</div>" +
								"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-port' required='true' type='number' placeholder='80' min='0' max='65535' value='" + data.port + "'>" +
								"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Station" ) + ":</div>" +
								"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-station' required='true' type='number' min='1' max='200' placeholder='1' value='" + ( data.station + 1 ) + "'>"
							).enhanceWithin();
						} else if ( value === 6 ) {
							data = OSApp.Stations.parseRemoteStationData( ( type === value ) ? data : "OT000000000000000000000000000000,00" );
							opts.append(
								"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote OTC Token" ) + ":</div>" +
								"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-otc' required='true' type='text' pattern='^OT[a-fA-F0-9]{30}$' value='" + data.otc + "'>" +
								"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Station" ) + ":</div>" +
								"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-station' required='true' type='number' min='1' max='200' placeholder='1' value='" + ( data.station + 1 ) + "'>"
							).enhanceWithin();

						} else if ( value === 3 ) {

							// Extended special station model to support GPIO stations
							// Special data for GPIO Station is three bytes of ascii decimal (not hex)
							// First two bytes are zero padded GPIO pin number (default GPIO05)
							// Third byte is either 0 or 1 for active low (GND) or high (+5V) relays (default 1 for HIGH)
							// Restrict selection to GPIO pins available on the RPi R2.
							var gpioPin = 5, activeState = 1, freePins = [ ], sel;

							if ( OSApp.currentSession.controller.settings.gpio ) {
								freePins = OSApp.currentSession.controller.settings.gpio;
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
								"<input class='center  validate-length' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='http-server' required='true' type='text' value='" + data[ 0 ] + "'>" +
								"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Server Port" ) + ":</div>" +
								"<input class='center  validate-length' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='http-port' required='true' type='number' min='0' max='65535' value='" + parseInt( data[ 1 ] ) + "'>" +
								"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "On Command" ) + ":</div>" +
								"<input class='center validate-length' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='http-on' required='true' type='text' value='" + data[ 2 ] + "'>" +
								"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Off Command" ) + ":</div>" +
								"<input class='center validate-length' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='http-off' required='true' type='text' value='" + data[ 3 ] + "'>" +
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
						var hs = parseInt( select.find( "#hs" ).val() );
						button.data( "hs", hs );

						if ( hs === 1 ) {
							button.data( "specialData", select.find( "#rf-code" ).val() );
						} else if ( hs === 2 || hs === 6 ) {
							var ip, port, otc, station, hex = "";
							station = ( select.find( "#remote-station" ).val() || 1 ) - 1;
							if ( hs === 2 ) {
								ip = select.find( "#remote-address" ).val().split( "." );
								port = parseInt( select.find( "#remote-port" ).val() ) || 80;
								for ( var i = 0; i < 4; i++ ) {
									hex += OSApp.Utils.pad( parseInt( ip[ i ] ).toString( 16 ) );
								}
								hex += ( port < 256 ? "00" : "" ) + OSApp.Utils.pad( port.toString( 16 ) );
								hex += OSApp.Utils.pad( station.toString( 16 ) );
							} else {
								otc = select.find( "#remote-otc" ).val();
								hex += otc;
								hex += ",";
								hex += OSApp.Utils.pad( station.toString( 16 ) );
							}

							if ( checkPassed !== true ) {
								$.mobile.loading( "show" );
								select.find( ".attrib-submit" ).addClass( "ui-disabled" );

								OSApp.Stations.verifyRemoteStation( hex, function( result ) {
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

									select.one( "popupafterclose", function() {
										$.mobile.loading( "hide" );
										loader.css( "opacity", "" );
									} );

									$.mobile.loading( "show", {
										html: "<h1>" + text + "</h1>" +
											"<button class='ui-btn cancel'>" + OSApp.Language._( "Cancel" ) + "</button>" +
											"<button class='ui-btn continue'>" + OSApp.Language._( "Continue" ) + "</button>",
										textVisible: true,
										theme: "b"
									} );

									var loader = $( ".ui-loader" );

									loader.css( "opacity", ".96" );

									loader.find( ".cancel" ).one( "click", function() {
										$.mobile.loading( "hide" );
										loader.css( "opacity", "" );
									} );

									loader.find( ".continue" ).one( "click", function() {
										$.mobile.loading( "hide" );
										loader.css( "opacity", "" );

										if ( result === -3 ) {
											OSApp.Stations.convertRemoteToExtender( hex );
										}

										saveChanges( true );
									} );

									select.find( ".attrib-submit" ).removeClass( "ui-disabled" );
								} );
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

						button.data( "um", select.find( "#um" ).is( ":checked" ) ? 1 : 0 );
						button.data( "um2", select.find( "#um2" ).is( ":checked" ) ? 1 : 0 );
						button.data( "ir", select.find( "#ir" ).is( ":checked" ) ? 1 : 0 );
						button.data( "sn1", select.find( "#sn1" ).is( ":checked" ) ? 1 : 0 );
						button.data( "sn2", select.find( "#sn2" ).is( ":checked" ) ? 1 : 0 );
						button.data( "ar", select.find( "#ar" ).is( ":checked" ) ? 1 : 0 );
						button.data( "sd", select.find( "#sd" ).is( ":checked" ) ? 1 : 0 );
						button.data( "us", select.find( "#us" ).is( ":checked" ) ? 1 : 0 );
						name.html( select.find( "#stn-name" ).val() );

						var seqGroupName = select.find( "span.seqgrp" ).text();
						button.attr( "data-gid", OSApp.Groups.mapGIDNameToValue( seqGroupName ) );

						// Update the notes section
						sites[ currentSite ].notes[ sid ] = select.find( "#stn-notes" ).val();
						OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );

						submitStations( sid );
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
						name.text() + "\">";

				select += "<button class='changeBackground'>" +
						( typeof sites[ currentSite ].images[ sid ] !== "string" ? OSApp.Language._( "Add" ) : OSApp.Language._( "Change" ) ) + " " + OSApp.Language._( "Image" ) +
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
						( sites[ currentSite ].notes[ sid ] ? sites[ currentSite ].notes[ sid ] : "" ) +
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
				} );

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
					OSApp.Sites.updateControllerStationSpecial( function() {
						select.find( "#hs" )
							.removeClass( "ui-disabled" )
							.find( "option[data-hs='" + OSApp.currentSession.controller.special[ sid ].st + "']" ).prop( "selected", true );
						select.find( "#hs" ).change();
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
						sites[ currentSite ].images[ sid ] = image;
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

				$.mobile.loading( "show" );
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
				).done( function() {
					OSApp.Errors.showError( OSApp.Language._( "Stations have been updated" ) );
					OSApp.Sites.updateController( function() {
						$( "html" ).trigger( "datarefresh" );
					} );
				} );
			},
			updateClock = function() {

				// Update the current time
				OSApp.uiState.timers.clock = {
					val: OSApp.currentSession.controller.settings.devt,
					update: function() {
						page.find( "#clock-s" ).text( OSApp.Dates.dateToString( new Date( this.val * 1000 ), null, 1 ) );
					}
				};
			},
			compareCardsGroupView = function( a, b ) {

				/* Sorting order: 	master ->
									sequential group id ->
									active status ->
									station id
				*/

				var cardA = $( a ), cardB = $( b );

				// Station IDs
				var sidA = OSApp.Cards.getSID( cardA );
				var sidB = OSApp.Cards.getSID( cardB );

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
							if ( sidA < sidB ) { return -1; } else if ( sidA > sidB ) { return 1; } else { return 0; }
						}
					}
				}
			},
			compareCardsStandardView = function( a, b ) {

				/* Sorting order: 	running status ->
									station id
				 */

				var cardA = $( a ), cardB = $( b );

				var sidA = OSApp.Cards.getSID( cardA );
				var sidB = OSApp.Cards.getSID( cardB );

				var statusA = OSApp.Stations.getStatus( sidA );
				var statusB = OSApp.Stations.getStatus( sidB );

				if ( statusA > statusB ) {
					return -1;
				} else if ( statusA < statusB ) {
					return 1;
				} else {
					if ( sidA < sidB ) {
						return -1;
					}
					if ( sidA > sidB ) {
						return 1;
					}
					return 0;
				}
			},

			updateGroupView = function( cardHolder, cardList ) {
				var thisCard, nextCard, divider, label, idx;

				for ( idx = 0; idx < cardHolder.children().length; idx++ ) {
					thisCard = OSApp.CardList.getCardByIndex( cardList, idx );
					OSApp.Cards.setGroupLabel( thisCard, OSApp.Cards.getGIDName( thisCard ) );
				}
				for ( idx = 0; idx < cardHolder.children().length - 1; idx++ ) {
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
				OSApp.Cards.getDivider( nextCard ).show(); // Last group divider
				OSApp.Cards.setGroupLabel( nextCard, OSApp.Cards.getGIDName( nextCard ) );
			},
			updateStandardView = function( cardHolder, cardList ) {
				var thisCard, nextCard, divider, label, idx;
				for ( idx = 0; idx < cardHolder.children().length - 1; idx++ ) {
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
				OSApp.Cards.getDivider( nextCard ).hide();
				OSApp.Cards.setGroupLabel( nextCard, OSApp.Groups.mapGIDValueToName( OSApp.Stations.getGIDValue( idx ) ) );
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
					isScheduled, isRunning, pname, rem, qPause, card, line, hasImage;

				if ( !page.hasClass( "ui-page-active" ) ) {
					return;
				}

				updateClock();
				updateSites();
				OSApp.Analog.updateSensorShowArea( page );

				page.find( ".waterlevel" ).text( OSApp.currentSession.controller.options.wl );
				page.find( ".sitename" ).text( siteSelect.val() );

				// Remove unused stations
				OSApp.CardList.getAllCards( cardList ).filter( function( _, a ) {
					return parseInt( $( a ).data( "station" ), 10 ) >= OSApp.currentSession.controller.stations.snames.length;
				} ).remove();

				for ( var sid = 0; sid < OSApp.currentSession.controller.stations.snames.length; sid++ ) {
					isScheduled = OSApp.Stations.getPID( sid ) > 0;
					isRunning = OSApp.Stations.getStatus( sid ) > 0;
					pname = isScheduled ? OSApp.Programs.pidToName( OSApp.Stations.getPID( sid ) ) : "";
					rem = OSApp.Stations.getRemainingRuntime( sid ),
					qPause = OSApp.StationQueue.isPaused(),
					hasImage = sites[ currentSite ].images[ sid ] ? true : false;

					card = OSApp.CardList.getCardBySID( cardList, sid );

					if ( card.length === 0 ) {
						cards = "";
						addCard( sid );
						cardHolder.append( cards );
					} else {
						card.find( ".ui-body > img" ).attr( "src", ( hasImage ? "data:image/jpeg;base64," + sites[ currentSite ].images[ sid ] : OSApp.UIDom.getAppURLPath() + "img/placeholder.png" ) );

						if ( OSApp.Stations.isDisabled( sid ) ) {
							if ( !page.hasClass( "show-hidden" ) ) {
								card.hide();
							}
							card.addClass( "station-hidden" );
						} else {
							card.show().removeClass( "station-hidden" );
						}

						card.find( "#station_" + sid ).text( OSApp.currentSession.controller.stations.snames[ sid ] );
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
								if ( OSApp.currentSession.controller.status[ sid ] ) {
									addTimer( sid, rem );
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


		page.one( "pageshow", function() {
			$( "html" ).on( "datarefresh", updateContent );
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

			page.find( ".sitename" ).toggleClass( "hidden", OSApp.currentSession.local ? true : false ).text( siteSelect.val() );
			page.find( ".waterlevel" ).text( OSApp.currentSession.controller.options.wl );

			OSApp.Analog.updateSensorShowArea( page );
			updateClock();

			page.on( "click", ".station-settings", showAttributes );

			page.on( "click", ".home-info", function() {
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
							maximum: 65535,
							seconds: sites[ currentSite ].lastRunTime[ sid ] > 0 ? sites[ currentSite ].lastRunTime[ sid ] : 0,
							helptext: OSApp.Language._( "Enter a duration to manually run " ) + name,
							callback: function( duration ) {
								OSApp.Firmware.sendToOS( "/cm?sid=" + sid + "&en=1&t=" + duration + "&pw=", "json" ).done( function() {

									// Update local state until next device refresh occurs
									OSApp.Stations.setPID( sid, OSApp.Constants.options.MANUAL_STATION_PID );
									OSApp.Stations.setRemainingRuntime( sid, duration );

									OSApp.Status.refreshStatus();
									OSApp.Errors.showError( OSApp.Language._( "Station has been queued" ) );

									// Save run time for this station
									sites[ currentSite ].lastRunTime[ sid ] = duration;
									OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
								} );
							}
						} );
						return;
					}
				}

				OSApp.UIDom.areYouSure( question, OSApp.Stations.getName( sid ), function() {

					var shiftStations = OSApp.uiState.popupData.shift === true ? 1 : 0;

					OSApp.Firmware.sendToOS( "/cm?sid=" + sid + "&ssta=" + shiftStations + "&en=0&pw=" ).done( function() {

						// Update local state until next device refresh occurs
						OSApp.Stations.setPID( sid, 0 );
						OSApp.Stations.setRemainingRuntime( sid, 0 );
						OSApp.Stations.setStatus( sid, 0 );

						// Remove any timer associated with the station
						delete OSApp.uiState.timers[ "station-" + sid ];

						OSApp.Status.refreshStatus();
						OSApp.Errors.showError( OSApp.Language._( "Station has been stopped" ) );
					} );
				}, null, dialogOptions );
			} )

			.on( "click", "img", function() {
				var image = $( this ),
					id = image.parents( ".card" ).data( "station" ),
					hasImage = image.attr( "src" ).indexOf( "data:image/jpeg;base64" ) === -1 ? false : true;

				if ( hasImage ) {
					OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to delete the current image?" ), "", function() {
						delete sites[ currentSite ].images[ id ];
						OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
						updateContent();
					} );
				} else {
					OSApp.UIDom.getPicture( function( image ) {
						sites[ currentSite ].images[ id ] = image;
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

			$( "#sprinklers" ).remove();
			$.mobile.pageContainer.append( page );

			if ( !$.isEmptyObject( OSApp.currentSession.weather ) ) {
				OSApp.Weather.updateWeatherBox();
			}
		}

		return begin;
	} )();

	$( document )
	.one( "deviceready", function() {
		/** Replace window.open with InAppBrowser if available */
		if ( window.cordova && window.cordova.InAppBrowser ) {
			window.open = window.cordova.InAppBrowser.open;
		}

		try {

			//Change the status bar to match the headers
			StatusBar.overlaysWebView( false );
			StatusBar.styleLightContent();
			StatusBar.backgroundColorByHexString( OSApp.uiState.theme.statusBarPrimary );

			$.mobile.window.on( "statusTap", function() {
				$( "body, html" ).animate( {
					scrollTop: 0
				}, 700 );
			} );
			//eslint-disable-next-line
		} catch ( err ) {}

		// Hide the splash screen
		setTimeout( function() {
			try {
				navigator.splashscreen.hide();
				//eslint-disable-next-line
			} catch ( err ) {}
		}, 500 );

		// For Android devices catch the back button and redirect it
		$.mobile.document.on( "backbutton", function() {
			OSApp.UIDom.checkChangesBeforeBack();
			return false;
		} );

		OSApp.Network.updateDeviceIP();

		// Check if 3D touch is available and add menu when possible
		if ( OSApp.currentDevice.isiOS ) {
			ThreeDeeTouch.isAvailable( function( available ) {
				if ( available ) {

					// Enable quick preview on web links
					ThreeDeeTouch.enableLinkPreview();

					// Configure menu actions
					ThreeDeeTouch.configureQuickActions( [
						{
							type: "sites",
							title: OSApp.Language._( "Manage Sites" ),
							iconType: "Location"
						},
						{
							type: "addprogram",
							title: OSApp.Language._( "Add Program" ),
							iconType: "Add"
						},
						{
							type: "stopall",
							title: OSApp.Language._( "Stop All Stations" ),
							iconType: "Pause"
						}
					] );

					ThreeDeeTouch.onHomeIconPressed = function( payload ) {
						if ( payload.type === "sites" ) {
							OSApp.UIDom.changePage( "#site-control" );
						} else if ( payload.type === "addprogram" ) {
							OSApp.UIDom.changePage( "#addprogram" );
						} else if ( payload.type === "stopall" ) {
							OSApp.Stations.stopAllStations();
						}
					};
				}
			} );
		}
	} )
	.one( "mobileinit", function() {
		$.support.cors = true;
		$.mobile.allowCrossDomainPages = true;
		OSApp.Storage.loadLocalSettings();
	} )
	.on( "pagebeforechange", function( e, data ) {
		var page = data.toPage,
			currPage = $( ".ui-page-active" ),
			hash;

		// Pagebeforechange event triggers twice (before and after)
		// and this check ensures we get the before state
		if ( typeof data.toPage !== "string" ) {
			return;
		}

		// Grabs the new page hash
		hash = $.mobile.path.parseUrl( page ).hash;

		if ( currPage.length > 0 && hash === "#" + currPage.attr( "id" ) ) {
			return;
		}

		// Animations are patchy if the page isn't scrolled to the top.
		// This scrolls the page before the animation fires off.
		if ( data.options.role !== "popup" && !$( ".ui-popup-active" ).length ) {
			$.mobile.silentScroll( 0 );
		}

		// Cycle through page possibilities and call their init functions
		if ( hash === "#programs" ) {
			OSApp.Programs.displayPage( data.options.programToExpand );
		} else if ( hash === "#addprogram" ) {
			OSApp.Programs.addProgram( data.options.copyID );
		} else if ( hash === "#manual" ) {
			OSApp.Programs.displayPageManual();
		} else if ( hash === "#about" ) {
			OSApp.About.displayPage();
		} else if ( hash === "#runonce" ) {
			OSApp.Programs.displayPageRunOnce();
		} else if ( hash === "#os-options" ) {
			OSApp.Options.showOptions( data.options.expandItem );
		} else if ( OSApp.Analog.checkAnalogSensorAvail() && hash === "#analogsensorconfig" ) {
			OSApp.Analog.showAnalogSensorConfig();
		} else if ( OSApp.Analog.checkAnalogSensorAvail() && hash === "#analogsensorchart" ) {
			OSApp.Analog.showAnalogSensorCharts();
		} else if ( hash === "#preview" ) {
			OSApp.Programs.displayPagePreviewPrograms();
		} else if ( hash === "#logs" ) {
			OSApp.Logs.displayPage();
		} else if ( hash === "#forecast" ) {
			OSApp.Weather.showForecast();
		} else if ( hash === "#loadingPage" ) {
			OSApp.Sites.checkConfigured( true );
		} else if ( hash === "#start" ) {
			OSApp.Welcome.displayPage();
		} else if ( hash === "#site-control" ) {
			showSites();
		} else if ( hash === "#sprinklers" ) {
			if ( $( hash ).length === 0 ) {
				showHome( data.options.firstLoad );
			} else {
				$( hash ).one( "pageshow", function() { OSApp.Status.refreshStatus(); } );
			}
		}
	} )

	// Handle OS resume event triggered by PhoneGap
	.on( "resume", function() {

		// If we don't have a current device IP set, there is nothing else to update
		if ( OSApp.currentSession.ip === undefined ) {
			return;
		}

		// If cloud token is available then sync sites
		OSApp.Network.cloudSync();

		// Indicate the weather and device status are being updated
		OSApp.UIDom.showLoading( "#weather,#footer-running" );

		OSApp.Sites.updateController( OSApp.Weather.updateWeather, OSApp.Network.networkFail );
	} )
	.on( "pause", function() {

		// Handle application being paused/closed
	} )
	.on( "pagebeforeshow", function( e ) {
		var newpage = "#" + e.target.id;

		// Modify the header and footer visibility before page show event
		if ( newpage === "#start" || newpage === "#loadingPage" ) {

			// Hide the header, footer and menu button on the start page
			$( "#header,#footer,#footer-menu" ).hide();
		} else {

			// Show header, footer and menu button on all other pages
			$( "#header,#footer,#footer-menu" ).show();
		}

		OSApp.Storage.get( "showDisabled", function( data ) {
			if ( data.showDisabled && data.showDisabled === "true" ) {
				$( newpage ).addClass( "show-hidden" ).find( ".station-hidden" ).show();
			} else {
				$( newpage ).removeClass( "show-hidden" ).find( ".station-hidden" ).hide();
			}
		} );
	} )
	.on( "pageshow", function( e ) {
		var newpage = "#" + e.target.id,
			$newpage = $( newpage );

		if ( OSApp.uiState.goingBack ) {
			OSApp.uiState.goingBack = false;
		} else {
			OSApp.uiState.pageHistoryCount++;
		}

		// Fix issues between jQuery Mobile and FastClick
		OSApp.UIDom.fixInputClick( $newpage );

		if ( OSApp.currentSession.isControllerConnected() && newpage !== "#site-control" && newpage !== "#start" && newpage !== "#loadingPage" ) {

			// Update the controller status every 5 seconds and the program and station data every 30 seconds
			var refreshStatusInterval = setInterval( function() { OSApp.Status.refreshStatus(); }, 5000 ), // FIXME: refactor this 5000 interval out to Constants or config/settings
				refreshDataInterval;

			if ( !OSApp.Firmware.checkOSVersion( 216 ) ) {
				refreshDataInterval = setInterval( OSApp.Sites.refreshData, 20000 ); // FIXME: move the 20000 interval to Constants (or config/settings)
			}

			$newpage.one( "pagehide", function() {
				clearInterval( refreshStatusInterval );
				clearInterval( refreshDataInterval );
			} );
		}
	} )
	.on( "popupafteropen", function() {

		// When a popup opens that has an overlay, update the status bar background color to match
		if ( $( ".ui-overlay-b:not(.ui-screen-hidden)" ).length ) {
			try {
				StatusBar.backgroundColorByHexString( OSApp.uiState.theme.statusBarOverlay );
				//eslint-disable-next-line
			} catch ( err ) {}
		}
	} )
	.on( "popupafterclose", function() {

		$( ".ui-page-active" ).children().add( "#sprinklers-settings" ).removeClass( "blur-filter" );

		// When a popup is closed, change the header back to the default color
		try {
			StatusBar.backgroundColorByHexString( OSApp.uiState.theme.statusBarPrimary );
			//eslint-disable-next-line
		} catch ( err ) {}
	} )
	.on( "popupbeforeposition", function() {
		$( ".ui-page-active" ).children().add( "#sprinklers-settings" ).addClass( "blur-filter" );
	} )
	.on( "popupbeforeposition", "#localization", OSApp.Language.checkCurrLang )
	.one( "pagebeforeshow", "#loadingPage", OSApp.UIDom.initAppData );

};

// FIXME: This needs to be rewritten and refactored out to OSApp.Sites.showSites so it works properly (mellodev)
OSApp.UIDom.showHomeMenu = ( function() {
	var page, id, showHidden, popup;

	function makeMenu() {
		page = $( ".ui-page-active" );
		id = page.attr( "id" );
		showHidden = page.hasClass( "show-hidden" );
		popup = $( "<div data-role='popup' data-theme='a' id='mainMenu'>" +
			"<ul data-role='listview' data-inset='true' data-corners='false'>" +
				"<li data-role='list-divider'>" + OSApp.Language._( "Information" ) + "</li>" +
				"<li><a href='#preview' class='squeeze'>" + OSApp.Language._( "Preview Programs" ) + "</a></li>" +
				( OSApp.Firmware.checkOSVersion( 206 ) || OSApp.Firmware.checkOSPiVersion( "1.9" ) ? "<li><a href='#logs'>" + OSApp.Language._( "View Logs" ) + "</a></li>" : "" ) +
				"<li data-role='list-divider'>" + OSApp.Language._( "Programs and Settings" ) + "</li>" +
				"<li><a href='#raindelay'>" + OSApp.Language._( "Change Rain Delay" ) + "</a></li>" +
				( OSApp.Supported.pausing() ?
					( OSApp.StationQueue.isPaused() ? "<li><a href='#globalpause'>" + OSApp.Language._( "Resume Station Runs" ) + "</a></li>"
						: ( OSApp.StationQueue.isActive() >= -1 ? "<li><a href='#globalpause'>" + OSApp.Language._( "Pause Station Runs" ) + "</a></li>" : "" ) )
					: "" ) +
				"<li><a href='#runonce'>" + OSApp.Language._( "Run-Once Program" ) + "</a></li>" +
				"<li><a href='#programs'>" + OSApp.Language._( "Edit Programs" ) + "</a></li>" +
				"<li><a href='#os-options'>" + OSApp.Language._( "Edit Options" ) + "</a></li>" +

				( OSApp.Analog.checkAnalogSensorAvail() ? (
					"<li><a href='#analogsensorconfig'>" + OSApp.Language._( "Analog Sensor Config" ) + "</a></li>" +
					"<li><a href='#analogsensorchart'>" + OSApp.Language._( "Show Sensor Log" ) + "</a></li>"
				) : "" ) +
				// FIXME: reset this to version 210 mellodev
				( OSApp.Firmware.checkOSVersion( 555 ) ? "" : "<li><a href='#manual'>" + OSApp.Language._( "Manual Control" ) + "</a></li>" ) +
			( id === "sprinklers" || id === "runonce" || id === "programs" || id === "manual" || id === "addprogram" ?
				"</ul>" +
				"<div class='ui-grid-a ui-mini tight'>" +
					"<div class='ui-block-a'><a class='ui-btn tight' href='#show-hidden'>" +
						( showHidden ? OSApp.Language._( "Hide" ) : OSApp.Language._( "Show" ) ) + " " + OSApp.Language._( "Disabled" ) +
					"</a></div>" +
					"<div class='ui-block-b'><a class='ui-btn red tight' href='#stop-all'>" + OSApp.Language._( "Stop All Stations" ) + "</a></div>" +
				"</div>"
				: "<li><a class='ui-btn red' href='#stop-all'>" + OSApp.Language._( "Stop All Stations" ) + "</a></li></ul>" ) +
		"</div>" );
	}

	function begin( btn ) {
		btn = btn instanceof $ ? btn : $( btn );

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		makeMenu();

		popup.on( "click", "a", function() {
			var clicked = $( this ),
				href = clicked.attr( "href" );

			popup.popup( "close" );

			if ( href === "#stop-all" ) {
				OSApp.Stations.stopAllStations();
			} else if ( href === "#show-hidden" ) {
				if ( showHidden ) {
					$( ".station-hidden" ).hide();
					page.removeClass( "show-hidden" );
				} else {
					$( ".station-hidden" ).show();
					page.addClass( "show-hidden" );
				}
			} else if ( href === "#raindelay" ) {
				OSApp.Weather.showRainDelay();
			} else if ( href === "#globalpause" ) {
				OSApp.UIDom.showPause();
			} else {
				OSApp.UIDom.checkChanges( function() {
					OSApp.UIDom.changePage( href );
				} );
			}

			return false;
		} );

		$( "#mainMenu" ).remove();

		popup.one( "popupafterclose", function() {
			btn.show();
		} );

		OSApp.UIDom.openPopup( popup, { positionTo: btn } );

		btn.hide();
	}

	return begin;
} )();

OSApp.UIDom.initAppData = function() {

	//Update the language on the page using the browser's locale
	OSApp.Language.updateLang();

	//Set AJAX timeout
	if ( !OSApp.currentSession.local ) {
		$.ajaxSetup( {
			timeout: 10000
		} );
	}

	// Prevent caching of AJAX requests on Android and Windows Phone devices
	if ( OSApp.currentDevice.isAndroid ) {

		// Hide the back button for Android (all devices have back button)
		OSApp.UIDom.insertStyle( ".ui-toolbar-back-btn{display:none!important}" );

		$( this ).ajaxStart( function() {
			try {
				navigator.app.clearCache();
				//eslint-disable-next-line
			} catch ( err ) {}
		} );
	} else if ( OSApp.currentDevice.isFireFox ) {

		// Allow cross domain AJAX requests in FireFox OS
		$.ajaxSetup( {
			xhr: function() {
				return new window.XMLHttpRequest( {
					mozSystem: true
				} );
			}
		} );
	} else {
		$.ajaxSetup( {
			"cache": false
		} );
	}

	//After jQuery mobile is loaded set initial configuration
	$.mobile.defaultPageTransition = OSApp.currentDevice.isAndroid ? "fade" : "slide";
	$.mobile.hoverDelay = 0;
	$.mobile.activeBtnClass = "activeButton";

	// Handle In-App browser requests (marked with iab class)
	$.mobile.document.on( "click", ".iab", function() {
		var target = OSApp.currentDevice.isOSXApp ? "_system" : "_blank";

		var button = $( this );
		window.open( this.href, target, "location=" + ( OSApp.currentDevice.isAndroid ? "yes" : "no" ) +
			",enableViewportScale=" + ( button.hasClass( "iabNoScale" ) ? "no" : "yes" ) +
			",toolbar=yes,toolbarposition=top,toolbarcolor=" + OSApp.uiState.theme.statusBarPrimary +
			",closebuttoncaption=" +
				( button.hasClass( "iabNoScale" ) ? OSApp.Language._( "Back" ) : OSApp.Language._( "Done" ) )
		);

		setTimeout( function() {
			button.removeClass( "ui-btn-active" );
		}, 100 );
		return false;
	} );

	// Correctly handle popup events and prevent history navigation on custom selectmenu popup
	$.mobile.document.on( "click", ".ui-select .ui-btn", function() {
		var button = $( this ),
			id = button.attr( "id" ).replace( "-button", "-listbox" ),
			popup = $( "#" + id );

		popup.popup( "destroy" ).detach().addClass( "ui-page-theme-a" );
		$.mobile.pageContainer.append( popup );

		popup.popup( {
			history: false,
			"positionTo": button,
			overlayTheme: "b"
		} ).popup( "open" );

		button.off( "click" ).on( "click", function() {
			popup.popup( "open" );
		} );

		return false;
	} );

	// Bind event handler to open panel when swiping right
	$.mobile.document.on( "swiperight swipeleft", ".ui-page", function( e ) {
		var page = $( ".ui-page-active" );

		if ( e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && page.jqmData( "panel" ) !== "open" && !page.find( ".ui-popup-active" ).length ) {
			if ( e.type === "swiperight" ) {
				 OSApp.uiState.openPanel();
			} else {
				OSApp.Notifications.showNotifications();
			}
		}
	} );

	// Extend collapsible widget with event before change
	$.widget( "mobile.collapsible", $.mobile.collapsible, {
		_handleExpandCollapse: function( isCollapse ) {
			if ( this._trigger( "before" + ( isCollapse ? "collapse" : "expand" ) ) ) {
				this._superApply( arguments );
			}
		}
	} );

	//Update site based on selector
	$( "#site-selector" ).on( "change", function() {
		OSApp.Sites.updateSite( $( this ).val() );
	} );

	// Bind footer menu button
	$( "#footer-menu" ).on( "click", function() {
		OSApp.UIDom.showHomeMenu( this );
	} );

	// Initialize the app header
	$( "#header,#footer" ).toolbar();

	//Attach FastClick handler
	FastClick.attach( document.body );

	// Start interval loop which will update timers/clocks
	OSApp.UIDom.updateTimers();

	// Handle keybinds
	$.mobile.document.on( "keydown", function( e ) {
		var tag = $( e.target ).prop( "tagName" );

		if ( tag === "INPUT" || tag === "TEXTAREA" ) {
			return;
		}

		var code = e.keyCode,
			altDown = e.altKey,
			menuOpen = $( "#mainMenu-popup" ).hasClass( "ui-popup-active" );

		if ( code === 77 ) { // M
			var menu = $( "#mainMenu" );
			if ( menu.length > 0 ) {
				$( "#mainMenu" ).popup( "close" );
			} else {
				OSApp.UIDom.showHomeMenu();
			}
		} else if ( ( menuOpen || altDown ) && code === 80 ) { // P
			e.preventDefault();
			OSApp.UIDom.changePage( "#programs" );
		} else if ( ( menuOpen || altDown ) && code === 79 ) { // O
			e.preventDefault();
			OSApp.UIDom.changePage( "#os-options" );
		} else if ( ( menuOpen || altDown ) && code === 86 ) { // V
			e.preventDefault();
			OSApp.UIDom.changePage( "#preview" );
		} else if ( ( menuOpen || altDown ) && code === 76 ) { // L
			e.preventDefault();
			OSApp.UIDom.changePage( "#logs" );
		} else if ( ( menuOpen || altDown ) && code === 82 ) { // R
			e.preventDefault();
			OSApp.UIDom.changePage( "#runonce" );
		} else if ( ( menuOpen || altDown ) && code === 85 ) { // U
			e.preventDefault();
			OSApp.UIDom.showPause();
		} else if ( ( menuOpen || altDown ) && code === 68 ) { // D
			e.preventDefault();
			OSApp.Weather.showRainDelay();
		}
	} );

	// Initialize external panel
	OSApp.UIDom.bindPanel();

	// Update the IP address of the device running the app
	if ( !OSApp.currentSession.local  && typeof window.cordova === "undefined" ) {
		OSApp.Network.updateDeviceIP();
	}

	// If cloud token is available then sync sites
	OSApp.Network.cloudSync();

	//On initial load check if a valid site exists for auto connect
	setTimeout( function() {
		OSApp.Sites.checkConfigured( true );
	}, 200 );
};

OSApp.UIDom.focusInput = function() {
	$.fn.focusInput = function() {
		if ( this.get( 0 ).setSelectionRange ) {
			this.focus();
			this.get( 0 ).setSelectionRange( 0, this.val().length );
		} else if ( this.get( 0 ).createTextRange ) {
			var range = this.get( 0 ).createTextRange();
			range.collapse( true );
			range.moveEnd( "character", this.val().length );
			range.moveStart( "character", 0 );
			range.select();
		}

		return this;
	};
};

// Return Datatables configuration options
OSApp.UIDom.getDatatablesConfig = function( options ) {
	var defaultConfig = {
		info: false,
		paging: false,
		searching: false
	};

	return Object.assign( {}, defaultConfig, options );
};

// Panel functions
OSApp.UIDom.bindPanel = function() {
	var panel = $( "#sprinklers-settings" ),
		operation = function() {
			return ( OSApp.currentSession.controller && OSApp.currentSession.controller.settings && OSApp.currentSession.controller.settings.en && OSApp.currentSession.controller.settings.en === 1 ) ? OSApp.Language._( "Disable" ) : OSApp.Language._( "Enable" );
		};

	panel.enhanceWithin().panel().removeClass( "hidden" ).panel( "option", "classes.modal", "needsclick ui-panel-dismiss" );

	panel.find( "a[href='#site-control']" ).on( "click", function() {
		OSApp.UIDom.changePage( "#site-control" );
		return false;
	} );

	panel.find( "a[href='#about']" ).on( "click", function() {
		OSApp.UIDom.changePage( "#about" );
		return false;
	} );

	panel.find( ".cloud-login" ).on( "click", function() {
		OSApp.Network.requestCloudAuth();
		return false;
	} );

	panel.find( "a[href='#debugWU']" ).on( "click", OSApp.SystemDiagnostics.showDiagnostics );

	panel.find( "a[href='#localization']" ).on( "click", OSApp.Language.languageSelect );

	panel.find( ".export_config" ).on( "click", function() {

		// Check if the controller has special stations which are enabled
		if ( typeof OSApp.currentSession.controller.stations.stn_spe === "object" && typeof OSApp.currentSession.controller.special !== "object" && !OSApp.currentSession.controller.stations.stn_spe.every( function( e ) { return e === 0; } ) ) {

			// Grab station special data before proceeding
			OSApp.Sites.updateControllerStationSpecial( OSApp.ImportExport.getExportMethod );
		} else {
			OSApp.ImportExport.getExportMethod();
		}

		return false;
	} );

	panel.find( ".import_config" ).on( "click", function() {
		OSApp.Storage.get( "backup", function( newdata ) {
			OSApp.ImportExport.getImportMethod( newdata.backup );
		} );

		return false;
	} );

	panel.find( ".toggleOperation" ).on( "click", function() {
		var self = $( this ),
			toValue = ( 1 - OSApp.currentSession.controller.settings.en );

		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to" ) + " " + operation().toLowerCase() + " " + OSApp.Language._( "operation?" ), "", function() {
			OSApp.Firmware.sendToOS( "/cv?pw=&en=" + toValue ).done( function() {
				$.when(
					OSApp.Sites.updateControllerSettings(),
					OSApp.Sites.updateControllerStatus()
				).done( function() {
					OSApp.Status.checkStatus();
					self.find( "span:first" ).html( operation() ).attr( "data-translate", operation() );
				} );
			} );
		} );

		return false;
	} ).find( "span:first" ).html( operation() ).attr( "data-translate", operation() );

	panel.find( ".reboot-os" ).on( "click", function() {
		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to reboot OpenSprinkler?" ), "", function() {
			$.mobile.loading( "show" );
			OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" ).done( function() {
				$.mobile.loading( "hide" );
				OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
			} );
		} );
		return false;
	} );

	panel.find( ".changePassword > a" ).on( "click", OSApp.Network.changePassword );

	panel.find( "#downgradeui" ).on( "click", function() {
		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to downgrade the UI?" ), "", function() {
			var url = "http://rayshobby.net/scripts/java/svc" + OSApp.Firmware.getOSVersion();

			OSApp.Firmware.sendToOS( "/cu?jsp=" + encodeURIComponent( url ) + "&pw=" ).done( function() {
				OSApp.Storage.remove( [ "sites", "current_site", "lang", "provider", "wapikey", "runonce" ] );
				location.reload();
			} );
		} );
		return false;
	} );

	panel.find( "#logout" ).on( "click", function() {
		OSApp.Network.logout();
		return false;
	} );

	 OSApp.uiState.openPanel = ( function() {
		var panel = $( "#sprinklers-settings" ),
			updateButtons = function() {
				var operation = ( OSApp.currentSession.controller && OSApp.currentSession.controller.settings && OSApp.currentSession.controller.settings.en && OSApp.currentSession.controller.settings.en === 1 ) ? OSApp.Language._( "Disable" ) : OSApp.Language._( "Enable" );
				panel.find( ".toggleOperation span:first" ).html( operation ).attr( "data-translate", operation );
			};

		$( "html" ).on( "datarefresh",  updateButtons );

		function begin() {
			var currPage = $( ".ui-page-active" ).attr( "id" );

			if ( currPage === "start" || currPage === "loadingPage" || !OSApp.currentSession.isControllerConnected() || $( ".ui-page-active" ).length !== 1 ) {
				return;
			}

			updateButtons();
			panel.panel( "open" );
		}

		return begin;
	} )();
};

OSApp.UIDom.changePage = function( toPage, opts ) {
	opts = opts || {};
	if ( toPage.indexOf( "#" ) !== 0 ) {
		toPage = "#" + toPage;
	}

	// Close the panel before page transition to avoid bug in jQM 1.4+
	OSApp.UIDom.closePanel( function() {
		$.mobile.pageContainer.pagecontainer( "change", toPage, opts );
	} );
};

OSApp.UIDom.openPopup = function( popup, args ) {
	args = $.extend( {}, {
		history: false,
		positionTo: "window",
		overlayTheme: "b"
	}, args );

	$.mobile.pageContainer.append( popup );

	popup.one( "popupafterclose", function() {

		// Retrieve popup data
		var updateRemainingStations = $( "#shift-sta" ).is( ":checked" );

		// Save data before view is destroyed
		if ( updateRemainingStations !== undefined ) {
			OSApp.uiState.popupData.shift = updateRemainingStations;
		}

		popup.popup( "destroy" ).remove();
	} ).popup( args ).enhanceWithin();

	popup.popup( "open" );
};

OSApp.UIDom.closePanel = function( callback ) {
	callback = callback || function() {};
	var panel = $( ".ui-panel-open" );
	if ( panel.length > 0 ) {
		panel.one( "panelclose", function() {
			callback();
		} );
		panel.panel( "close" );
		return;
	} else {
		callback();
	}
};

OSApp.UIDom.getAppURLPath = function() {
	return OSApp.currentSession.local ? $.mobile.path.parseUrl( $( "head" ).find( "script[src$='main.js']" ).attr( "src" ) ).hrefNoHash.slice( 0, -10 ) : "";
};

// Accessory functions
OSApp.UIDom.fixInputClick = function( page ) {

	// Handle Fast Click quirks
	if ( !FastClick.notNeeded( document.body ) ) {
		page.find( "input[type='checkbox']:not([data-role='flipswitch']),.ui-select > .ui-btn" ).addClass( "needsclick" );
		page.find( ".ui-collapsible-heading-toggle" ).on( "click", function() {
			var heading = $( this );

			setTimeout( function() {
				heading.removeClass( "ui-btn-active" );
			}, 100 );
		} );
	}
};

// Bind buttons to allow push and hold effects
OSApp.UIDom.holdButton = function( target, callback ) {
	var intervalId;

	target.on( OSApp.currentDevice.isTouchCapable ? "tap" : "click", callback ).on( "taphold", function( e ) {
		intervalId = setInterval( function() {
			callback( e );
		}, 100 );
	} ).on( "vmouseup vmouseout vmousecancel touchend", function() {
		clearInterval( intervalId );
	} ).on( "touchmove", function( e ) {
		e.preventDefault();
	} );
};

// Insert style string into the DOM
OSApp.UIDom.insertStyle = function( style ) {
	var a = document.createElement( "style" );
	a.innerHTML = style;
	document.head.appendChild( a );
};

// Transition to home page after successful load
OSApp.UIDom.goHome = function( firstLoad ) {
	if ( $( ".ui-page-active" ).attr( "id" ) !== "sprinklers" ) {
		$.mobile.document.one( "pageshow", function() {

			// Allow future transitions to properly animate
			delete $.mobile.navigate.history.getActive().transition;
		} );

		var opts = {
			"reverse": true
		};

		if ( firstLoad === true ) {
			opts = {
				"firstLoad": true,
				"OSApp.UIDom.showLoading": false,
				"transition": "none"
			};
		}

		OSApp.UIDom.changePage( "#sprinklers", opts );
	}
};

// Prevent back navigation during active page transition
OSApp.UIDom.goBack = function() {
	var page = $( ".ui-page-active" );

	if ( page.length !== 1 ) {
		return;
	}

	page = page.attr( "id" );

	var managerStart = ( page === "site-control" && !OSApp.currentSession.isControllerConnected() ),
		popup = $( ".ui-popup-active" );

	if ( popup.length ) {
		popup.find( "[data-role='popup']" ).popup( "close" );
		return;
	}

	if ( page === "sprinklers" || page === "start" || managerStart ) {
		try {
			navigator.app.exitApp();
			//eslint-disable-next-line
		} catch ( err ) {}
	} else {
		if ( OSApp.uiState.pageHistoryCount > 0 ) {
			OSApp.uiState.pageHistoryCount--;
		}

		if ( OSApp.uiState.pageHistoryCount === 0 ) {
			navigator.app.exitApp();
		} else {
			OSApp.uiState.goingBack = true;
			$.mobile.back();
		}
	}
};

OSApp.UIDom.checkChangesBeforeBack = function() {
	OSApp.UIDom.checkChanges( OSApp.UIDom.goBack );
};

OSApp.UIDom.checkChanges = function( callback ) {
	callback = callback || function() {};
	var page = $( ".ui-page-active" ),
		changed = page.find( ".hasChanges" );

	if ( changed.length !== 0 ) {
		OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to save your changes?" ), "", function() {
			changed.click();
			if ( !changed.hasClass( "preventBack" ) ) {
				callback();
			}
		}, callback );
		return false;
	} else {
		callback();
	}
};

// Change persistent header
OSApp.UIDom.changeHeader = function( opt ) {

	// Declare function defaults
	var defaults = {
			title: "",
			class: "",
			animate: true,
			leftBtn: {
				icon: "",
				class: "",
				text: "",
				on: function() {}
			},
			rightBtn: {
				icon: "",
				class: "",
				text: "",
				on: function() {}
			}
		},
		header = $( "#header" );

	// Merge defaults with supplied options
	opt = $.extend( true, {}, defaults, opt );

	// Change default page title to the logo
	if ( opt.title === "" && opt.class === "" ) {
		opt.class = "logo";
	}

	// Generate new header content
	var newHeader = $( "<button data-icon='" + opt.leftBtn.icon + "' " + ( opt.leftBtn.text === "" ? "data-iconpos='notext' " : "" ) +
				"class='ui-btn-left " + opt.leftBtn.class + "'>" + opt.leftBtn.text + "</button>" +
			"<h3 class='" + opt.class + "'>" + opt.title + "</h3>" +
			"<button data-icon='" + opt.rightBtn.icon + "' " + ( opt.rightBtn.text === "" ? "data-iconpos='notext' " : "" ) +
				"class='ui-btn-right " + opt.rightBtn.class + "'>" + opt.rightBtn.text + "</button>" ),
		speed = opt.animate ? "fast" : 0;

	// Fade out the header content, replace it, and update the header
	header.children().stop().fadeOut( speed, function() {
		header.html( newHeader ).toolbar( header.hasClass( "ui-header" ) ? "refresh" : null );
		header.find( ".ui-btn-left" ).on( "click", opt.leftBtn.on );
		header.find( ".ui-btn-right" ).on( "click", opt.rightBtn.on );
	} ).fadeIn( speed );

	return newHeader;
};

OSApp.UIDom.getPageTop = function() {
	var theWindow = $.mobile.window;

	return {
		x: ( theWindow[ 0 ].innerWidth || theWindow.width() ) / 2 + theWindow.scrollLeft(),
		y: theWindow.scrollTop() + 22.5
	};
};

// Show loading indicator within element(s)
OSApp.UIDom.showLoading = function( ele ) {
	ele = ( typeof ele === "string" ) ? $( ele ) : ele;
	ele.off( "click" ).html( "<p class='ui-icon ui-icon-loading mini-load'></p>" );

	var footer = ele.filter( "#footer-running" );
	if ( footer.length === 1 ) {
		footer.find( ".mini-load" ).addClass( "bottom" );
	}
};

OSApp.UIDom.getPicture = function( callback ) {
	callback = callback || function() {};
	var imageLoader = $( "<input style='display: none' type='file' accept='image/*' />" )
		.insertAfter( "body" )
		.on( "change", function( event ) {
			var reader = new FileReader();
			reader.onload = function( readerEvent ) {
				var image = new Image();
				image.onload = function() {
					var canvas = document.createElement( "canvas" ),
						maxSize = 200,
						width = image.width,
						height = image.height;
					if ( width > height ) {
						if ( width > maxSize ) {
							height *= maxSize / width;
							width = maxSize;
						}
					} else {
						if ( height > maxSize ) {
							width *= maxSize / height;
							height = maxSize;
						}
					}
					canvas.width = width;
					canvas.height = height;
					canvas.getContext( "2d" ).drawImage( image, 0, 0, width, height );
					var resizedImage = canvas.toDataURL( "image/jpeg", 0.5 ).replace( "data:image/jpeg;base64,", "" );
					imageLoader.remove();
					callback( resizedImage );
				};
				image.src = readerEvent.target.result;
			};
			reader.readAsDataURL( event.target.files[ 0 ] );
		} );

	imageLoader.get( 0 ).click();
};

OSApp.UIDom.showHelpText = function( e ) {
	e.stopImmediatePropagation();

	var button = $( this ),
		text = button.data( "helptext" ),
		popup;

	popup = $( "<div data-role='popup' data-theme='a'>" +
		"<p>" + text + "</p>" +
	"</div>" );

	OSApp.UIDom.openPopup( popup, { positionTo: button } );

	return false;
};

// TODO: possibly move these date/time components to date.js
OSApp.UIDom.showTimeInput = function( opt ) {
	var defaults = {
			minutes: 0,
			title: OSApp.Language._( "Time" ),
			incrementalUpdate: true,
			showBack: true,
			showSun: false,
			callback: function() {}
		};

	opt = $.extend( {}, defaults, opt );

	$( "#timeInput" ).popup( "destroy" ).remove();

	var offset = opt.minutes & 0x7ff,
		type = 0;

	if ( ( opt.minutes >> 12 ) & 1 ) {
		offset = -offset;
	}
	if ( ( opt.minutes >> 14 ) & 1 ) {
		type = 1;
	} else if ( ( opt.minutes >> 13 ) & 1 ) {
		type = 2;
	}

	var isPM = ( opt.minutes > 719 ? true : false ),
		getPeriod = function() {
			return isPM ? OSApp.Language._( "PM" ) : OSApp.Language._( "AM" );
		},
		popup = $( "<div data-role='popup' id='timeInput' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + opt.title + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				( opt.helptext ? "<p class='pad-top rain-desc center smaller'>" + opt.helptext + "</p>" : "" ) +
				"<span>" +
					"<fieldset class='ui-grid-" + ( OSApp.currentDevice.isMetric ? "a" : "b" ) + " incr'>" +
						"<div class='ui-block-a'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
						( OSApp.currentDevice.isMetric ? "" : "<div class='ui-block-c'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" ) +
					"</fieldset>" +
					"<div class='ui-grid-" + ( OSApp.currentDevice.isMetric ? "a" : "b" ) + " inputs'>" +
						"<div class='ui-block-a'>" +
							"<input data-wrapper-class='pad_buttons' class='hour dontPad' type='number' pattern='[0-9]*' value='" +
								( OSApp.currentDevice.isMetric ? OSApp.Utils.pad( ( opt.minutes / 60 >> 0 ) % 24 ) + "'>" : ( parseInt( opt.minutes / 60 ) % 12 === 0 ? 12 : parseInt( opt.minutes / 60 ) % 12 ) + "'>" ) +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<input data-wrapper-class='pad_buttons' class='minute' type='number' pattern='[0-9]*' value='" +
								OSApp.Utils.pad( opt.minutes % 60 ) + "'>" +
						"</div>" +
						( OSApp.currentDevice.isMetric ? "" : "<div class='ui-block-c'>" +
							"<p class='center period'>" + getPeriod() + "</p>" +
						"</div>" ) +
					"</div>" +
					"<fieldset class='ui-grid-" + ( OSApp.currentDevice.isMetric ? "a" : "b" ) + " decr'>" +
						"<div class='ui-block-a'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
						( OSApp.currentDevice.isMetric ? "" : "<div class='ui-block-c'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" ) +
					"</fieldset>" +
				"</span>" +
				( opt.showSun ? "<div class='ui-grid-a useSun'>" +
					"<div class='ui-block-a'>" +
						"<button class='ui-mini ui-btn rise " + ( type === 1 ? "ui-btn-active" : "" ) + "'>" + OSApp.Language._( "Use Sunrise" ) + "</button>" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<button class='ui-mini ui-btn set " + ( type === 2 ? "ui-btn-active" : "" ) + "'>" + OSApp.Language._( "Use Sunset" ) + "</button>" +
					"</div>" +
				"</div>" +
				"<div class='offsetInput'" + ( type === 0 ? " style='display: none;'" : "" ) + ">" +
					"<h5 class='center tight'>" + OSApp.Language._( "Offset (minutes)" ) + "</h5>" +
					"<div class='input_with_buttons'>" +
						"<button class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
						"<input class='dontPad' type='number' pattern='[0-9]*' value='" + offset + "'>" +
						"<button class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
					"</div>" +
				"</div>" : "" ) +
				( opt.showBack ? "<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" : "" ) +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			if ( pos === 0 || pos === 1 ) {
				var curr = getValue(),
					to = curr + ( dir * ( pos === 0 ? 60 : 1 ) ),
					input = popup.find( ".inputs input" ).eq( pos ),
					isHour = input.hasClass( "hour" ),
					val = parseInt( input.val() );

				if ( dir === 1 ) {
					if ( isHour && ( ( OSApp.currentDevice.isMetric && val >= 24 ) || ( !OSApp.currentDevice.isMetric && val >= 12 ) ) ) {
						val = 0;
					}
					if ( !isHour && val >= 59 ) {
						val = -1;
						var hour = popup.find( ".hour" ),
							hourFixed = parseInt( hour.val() );

						if ( !OSApp.currentDevice.isMetric ) {
							if ( hourFixed === 12 ) {
								hourFixed = 0;
							}

							hour.val( hourFixed + 1 );
						}
					}
				} else if ( isHour && val <= 1 ) {
					val = 13;
				} else if ( !isHour && val <= 0 ) {
					return;
				}

				if ( ( !isPM && to > 719 ) || ( isPM && to < 721 ) || ( isPM && to > 1439 ) || ( !isPM && dir === -1 && to < 0 ) ) {
					isPM = !isPM;
					popup.find( ".period" ).text( getPeriod() );
				}

				val = isHour ? val + dir : OSApp.Utils.pad( val + dir );
				input.val( val );
			} else if ( pos === 2 ) {
				isPM = !isPM;
				popup.find( ".period" ).text( getPeriod() );
			}

			if ( opt.incrementalUpdate ) {
				opt.callback( getValue() );
			}
		},
		getValue = function() {
			var useSun = popup.find( ".useSun" ).find( "button.ui-btn-active" );

			if ( useSun.length === 1 ) {
				var st = 0,
					offset = parseInt( popup.find( ".offsetInput input" ).val() );
				if ( useSun.hasClass( "rise" ) ) {
					if ( offset >= 0 ) {
						st = offset;
					} else {
						st = -offset;
						st |= ( 1 << 12 );
					}

					// Set the sunrise bit
					st |= ( 1 << 14 );
				} else {
					if ( offset >= 0 ) {
						st = offset;
					} else {
						st = -offset;

						// Set the sign bit
						st |= ( 1 << 12 );
					}

					// Set the sunset bit
					st |= ( 1 << 13 );
				}

				return st;
			} else {
				var hour = parseInt( popup.find( ".hour" ).val() );

				if ( !OSApp.currentDevice.isMetric ) {
					if ( isPM && hour !== 12 ) {
						hour = hour + 12;
					}

					if ( !isPM && hour === 12 ) {
						hour = 0;
					}
				}

				return ( hour * 60 ) + parseInt( popup.find( ".minute" ).val() );
			}
		};

	popup.find( "button.submit" ).on( "click", function() {
		opt.callback( getValue() );
		popup.popup( "destroy" ).remove();
	} );

	popup.on( "focus", "input[type='number']", function( e ) {
		e.target.value = "";
	} ).on( "blur", "input[type='number']", function( e ) {
		var val = parseInt( e.target.value ) || 0;
		e.target.value = $( e.target ).hasClass( "dontPad" ) ? val : OSApp.Utils.pad( val );
	} );

	OSApp.UIDom.holdButton( popup.find( ".incr" ).children(), function( e ) {
		var button = $( e.currentTarget ),
			pos = button.index();

		if ( button.find( ".ui-disabled" ).length === 0 ) {
			changeValue( pos, 1 );
		}

		return false;
	} );

	OSApp.UIDom.holdButton( popup.find( ".decr" ).children(), function( e ) {
		var button = $( e.currentTarget ),
			pos = button.index();

		if ( button.find( ".ui-disabled" ).length === 0 ) {
			changeValue( pos, -1 );
		}

		return false;
	} );

	if ( opt.showSun ) {
		popup.find( ".useSun" ).on( "click", "button", function() {
			var button = $( this ),
				contraButton = popup.find( ".useSun" ).find( "button" ).not( button ),
				offset = popup.find( ".offsetInput" ),
				timeButtons = popup.find( "span" ).find( ".ui-btn,input,p" );

			contraButton.removeClass( "ui-btn-active" );
			if ( button.hasClass( "ui-btn-active" ) ) {
				button.removeClass( "ui-btn-active" );
				offset.slideUp();

				timeButtons.prop( "disabled", false ).removeClass( "ui-disabled" );
			} else {
				button.addClass( "ui-btn-active" );
				offset.slideDown();

				timeButtons.prop( "disabled", true ).addClass( "ui-disabled" );
			}

			if ( opt.incrementalUpdate ) {
				opt.callback( getValue() );
			}
		} );

		var offsetInput = popup.find( ".offsetInput" ).find( "input" ),
			changeOffset = function( dir ) {
				var val = parseInt( offsetInput.val() );

				if ( ( dir === -1 && val === -240 ) || ( dir === 1 && val === 240 ) ) {
					return;
				}

				offsetInput.val( val + dir );

				if ( opt.incrementalUpdate ) {
					opt.callback( getValue() );
				}
			};

		offsetInput.on( "focus", function() {
			this.value = "";
		} ).on( "blur", function() {
			if ( this.value === "" ) {
				this.value = "0";
			} else if ( this.value > 240 ) {
				this.value = "240";
			} else if ( this.value < -240 ) {
				this.value = "-240";
			}
		} );

		OSApp.UIDom.holdButton( popup.find( ".offsetInput" ).find( ".incr" ), function() {
			changeOffset( 1 );
			return false;
		} );
		OSApp.UIDom.holdButton( popup.find( ".offsetInput" ).find( ".decr" ), function() {
			changeOffset( -1 );
			return false;
		} );
	}

	popup
	.css( "max-width", "350px" )
	.one( "popupafteropen", function() {
		if ( type !== 0 ) {
			popup.find( "span" ).find( ".ui-btn,input,p" ).prop( "disabled", true ).addClass( "ui-disabled" );
		}
	} )
	.one( "popupafterclose", function() {
		if ( opt.incrementalUpdate ) {
			opt.callback( getValue() );
		}
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showDateTimeInput = function( timestamp, callback ) {
	$( "#datetimeInput" ).popup( "destroy" ).remove();

	if ( !( timestamp instanceof Date ) ) {
		timestamp = new Date( timestamp * 1000 );
		timestamp.setMinutes( timestamp.getMinutes() - timestamp.getTimezoneOffset() );
	}

	callback = callback || function() {};

	var keys = [ "Month", "Date", "FullYear", "Hours", "Minutes" ],
		monthNames = [ OSApp.Language._( "Jan" ), OSApp.Language._( "Feb" ), OSApp.Language._( "Mar" ), OSApp.Language._( "Apr" ), OSApp.Language._( "May" ), OSApp.Language._( "Jun" ), OSApp.Language._( "Jul" ),
			OSApp.Language._( "Aug" ), OSApp.Language._( "Sep" ), OSApp.Language._( "Oct" ), OSApp.Language._( "Nov" ), OSApp.Language._( "Dec" ) ],
		popup = $( "<div data-role='popup' id='datetimeInput' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Enter Date/Time" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			timestamp[ "setUTC" + pos ]( timestamp[ "getUTC" + pos ]() + dir );
			callback( new Date( timestamp.getTime() ) );
			updateContent();
		},
		updateContent = function() {
			var incrbts = "<fieldset class='ui-grid-d incr'>",
				inputs = "<div class='ui-grid-d inputs'>",
				decrbts = "<fieldset class='ui-grid-d decr'>",
				val, i;

			for ( i = 0; i < 5; i++ ) {
				val = timestamp[ "getUTC" + keys[ i ] ]();

				if ( keys[ i ] === "Month" ) {
					val = "<p class='center'>" + monthNames[ val ] + "</p>";
				} else if ( keys[ i ] === "Date" ) {
					val = "<p class='center'>" + val + ",</p>";
				} else if ( keys[ i ] === "Hours" ) {
					val = "<p style='width:90%;display:inline-block' class='center'>" + val + "</p><p style='display:inline-block'>:</p>";
				} else {
					val = "<p class='center'>" + val + "</p>";
				}

				incrbts += "<div class='ui-block-" + String.fromCharCode( 97 + i ) + "'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>";
				inputs += "<div id='" + keys[ i ] + "' class='ui-block-" + String.fromCharCode( 97 + i ) + "'>" + val + "</div>";
				decrbts += "<div class='ui-block-" + String.fromCharCode( 97 + i ) + "'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>";
			}

			incrbts += "</fieldset>";
			inputs += "</div>";
			decrbts += "</fieldset>";

			popup.find( ".ui-content" ).html( "<span>" + incrbts + inputs + decrbts + "</span>" ).enhanceWithin();

			popup.find( ".incr" ).children().on( "vclick", function() {
				var pos = $( this ).index();
				changeValue( popup.find( ".inputs" ).children().eq( pos ).attr( "id" ), 1 );
				return false;
			} );

			popup.find( ".decr" ).children().on( "vclick", function() {
				var pos = $( this ).index();
				changeValue( popup.find( ".inputs" ).children().eq( pos ).attr( "id" ), -1 );
				return false;
			} );
	};

	updateContent();

	popup
	.css( "width", "280px" )
	.one( "popupafterclose", function() {
		callback( timestamp );
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showSingleDurationInput = function( opt ) {
	$( "#singleDuration" ).popup( "destroy" ).remove();
	var defaults = {
		data: 0,
		title: OSApp.Language._( "Duration" ),
		minimum: 0,
		label: "",
		updateOnChange: true,
		showBack: true,
		callback: function() {}
	};

	opt = $.extend( {}, defaults, opt );

	var popup = $( "<div data-role='popup' id='singleDuration' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + opt.title + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				( opt.helptext ? "<p class='rain-desc center smaller'>" + opt.helptext + "</p>" : "" ) +
				"<label class='center'>" + opt.label + "</label>" +
				"<div class='input_with_buttons'>" +
					"<button class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
					"<input type='number' pattern='[0-9]*' value='" + opt.data + "'>" +
					"<button class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
				"</div>" +
				( opt.updateOnChange && !opt.showBack ? "" : "<input type='submit' data-theme='b' value='" + OSApp.Language._( "Submit" ) + "'>" ) +
			"</div>" +
		"</div>" ),
		input = popup.find( "input" ),
		reply = function( val ) {
			opt.callback( parseInt( val ).clamp( opt.minimum, opt.maximum ) );
		},
		changeValue = function( dir ) {
			var val = parseInt( input.val() );

			if ( ( dir === -1 && val === opt.minimum ) || ( dir === 1 && val === opt.maximum ) ) {
				return;
			}

			input.val( val + dir );
			if ( opt.updateOnChange ) {
				reply( val + dir );
			}
		};

	OSApp.UIDom.holdButton( popup.find( ".incr" ), function() {
		changeValue( 1 );
		return false;
	} );
	OSApp.UIDom.holdButton( popup.find( ".decr" ), function() {
		changeValue( -1 );
		return false;
	} );

	popup.find( "input[type='number']" ).on( "focus", function() {
		this.value = "";
	} ).on( "blur", function() {
		if ( this.value === "" ) {
			this.value = "0";
		}
	} );

	popup.find( "input[type='submit']" ).on( "click", function() {
		reply( input.val() );
		popup.popup( "destroy" ).remove();
	} );

	popup
	.one( "popupafterclose", function() {
		if ( opt.updateOnChange ) {
			reply( input.val() );
		}
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showDurationBox = function( opt ) {
	var defaults = {
			seconds: 0,
			title: OSApp.Language._( "Duration" ),
			granularity: 0,
			preventCompression: false,
			incrementalUpdate: true,
			showBack: true,
			showSun: false,
			minimum: 0,
			callback: function() {}
		},
		type = 0;

	opt = $.extend( {}, defaults, opt );

	$( "#durationBox" ).popup( "destroy" ).remove();

	opt.seconds = parseInt( opt.seconds );

	if ( opt.seconds === 65535 ) {
		type = 1;
		opt.seconds = 0;
	} else if ( opt.seconds === 65534 ) {
		type = 2;
		opt.seconds = 0;
	}

	if ( OSApp.Firmware.checkOSVersion( 217 ) ) {
		opt.preventCompression = true;
	}

	var keys = [ "days", "hours", "minutes", "seconds" ],
		text = [ OSApp.Language._( "Days" ), OSApp.Language._( "Hours" ), OSApp.Language._( "Minutes" ), OSApp.Language._( "Seconds" ) ],
		conv = [ 86400, 3600, 60, 1 ],
		max = [ 0, 23, 59, 59 ],
		total = 4 - opt.granularity,
		start = 0,
		arr = OSApp.Dates.sec2dhms( opt.seconds ),
		i;

	if ( !opt.preventCompression && ( OSApp.Firmware.checkOSVersion( 210 ) && opt.maximum > 64800 ) ) {
		opt.maximum = OSApp.Firmware.checkOSVersion( 214 ) ? 57600 : 64800;
	}

	if ( opt.maximum ) {
		for ( i = conv.length - 1; i >= 0; i-- ) {
			if ( opt.maximum < conv[ i ] ) {
				start = i + 1;
				total = ( conv.length - start ) - opt.granularity;
				break;
			}
		}
	}

	var incrbts = "<fieldset class='ui-grid-" + String.fromCharCode( 95 + ( total ) ) + " incr'>",
		inputs = "<div class='ui-grid-" + String.fromCharCode( 95 + ( total ) ) + " inputs'>",
		decrbts = "<fieldset class='ui-grid-" + String.fromCharCode( 95 + ( total ) ) + " decr'>",
		popup = $( "<div data-role='popup' id='durationBox' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + opt.title + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				( opt.helptext ? "<p class='rain-desc center smaller'>" + opt.helptext + "</p>" : "" ) +
				"<span>" +
				"</span>" +
				( opt.showSun ? "<div class='ui-grid-a useSun'>" +
					"<div class='ui-block-a'>" +
						"<button value='65534' class='ui-mini ui-btn rise " + ( type === 2 ? "ui-btn-active" : "" ) + "'>" + OSApp.Language._( "Sunrise to Sunset" ) + "</button>" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<button value='65535' class='ui-mini ui-btn set " + ( type === 1 ? "ui-btn-active" : "" ) + "'>" + OSApp.Language._( "Sunset to Sunrise" ) + "</button>" +
					"</div>" +
				"</div>" : "" ) +
				( opt.showBack ? "<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" : "" ) +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			var input = popup.find( ".inputs input" ).eq( pos ),
				apos = pos + start,
				val = parseInt( input.val() );

			if ( input.prop( "disabled" ) ) {
				return;
			}

			if ( ( dir === -1 && ( getValue() <= opt.minimum || val <= 0 ) ) || ( dir === 1 && ( getValue() + conv[ apos ] ) > opt.maximum ) ) {
				return;
			}

			// Increment next time field on current max
			if ( ( max[ apos ] !== 0 && pos !== 0 && Math.abs( val ) >= max[ apos ] ) ) {
				input.val( 0 );
				input = popup.find( ".inputs input" ).eq( pos - 1 );
				val = parseInt( input.val() );
			}

			input.val( val + dir );
			if ( opt.incrementalUpdate ) {
				opt.callback( getValue() );
			}

			if ( !opt.preventCompression && OSApp.Firmware.checkOSVersion( 210 ) ) {
				var state = ( dir === 1 ) ? true : false;

				if ( dir === 1 ) {
					if ( getValue() >= 60 ) {
						toggleInput( "seconds", state );
					}
					if ( getValue() >= 10800 ) {
						toggleInput( "minutes", state );
					}
				} else if ( dir === -1 ) {
					if ( getValue() <= -60 ) {
						toggleInput( "seconds", !state );
					} else if ( getValue() <= -10800 ) {
						toggleInput( "minutes", !state );
					} else if ( getValue() < 60 ) {
						toggleInput( "seconds", state );
					} else if ( getValue() < 10800 ) {
						toggleInput( "minutes", state );
					}
				}
			}
		},
		getValue = function() {
			var useSun = popup.find( ".useSun" ).find( "button.ui-btn-active" );

			if ( useSun.length === 1 ) {
				return parseInt( useSun.val() );
			} else {
				return OSApp.Dates.dhms2sec( {
					"days": parseInt( popup.find( ".days" ).val() ) || 0,
					"hours": parseInt( popup.find( ".hours" ).val() ) || 0,
					"minutes": parseInt( popup.find( ".minutes" ).val() ) || 0,
					"seconds": parseInt( popup.find( ".seconds" ).val() ) || 0
				} );
			}
		},
		toggleInput = function( field, state ) {
			popup.find( "." + field ).toggleClass( "ui-state-disabled", state ).prop( "disabled", state ).val( function() {
				if ( state ) {
					return 0;
				} else {
					return this.value;
				}
			} ).parent( ".ui-input-text" ).toggleClass( "ui-state-disabled", state );
		};

	for ( i = start; i < conv.length - opt.granularity; i++ ) {
		incrbts += "<div " + ( ( total > 1 ) ? "class='ui-block-" + String.fromCharCode( 97 + i - start ) + "'" : "" ) + ">" +
			"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>";
		inputs += "<div " + ( ( total > 1 ) ? "class='ui-block-" + String.fromCharCode( 97 + i - start ) + "'" : "" ) + "><label class='center'>" +
			OSApp.Language._( text[ i ] ) + "</label><input data-wrapper-class='pad_buttons' class='" + keys[ i ] + "' type='number' pattern='[0-9]*' value='" +
			arr[ keys[ i ] ] + "'></div>";
		decrbts += "<div " + ( ( total > 1 ) ? "class='ui-block-" + String.fromCharCode( 97 + i - start ) + "'" : "" ) +
			"><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>";
	}

	incrbts += "</fieldset>";
	inputs += "</div>";
	decrbts += "</fieldset>";

	popup.find( "span" ).prepend( incrbts + inputs + decrbts );

	popup.find( "button.submit" ).on( "click", function() {
		opt.callback( getValue() );
		popup.popup( "destroy" ).remove();
	} );

	if ( !opt.preventCompression && OSApp.Firmware.checkOSVersion( 210 ) ) {
		if ( opt.seconds <= -60 ) {
			toggleInput( "seconds", true );
		}

		if ( opt.seconds <= -10800 ) {
			toggleInput( "minutes", true );
		}

		if ( opt.seconds >= 60 ) {
			toggleInput( "seconds", true );
		}

		if ( opt.seconds >= 10800 ) {
			toggleInput( "minutes", true );
		}
	}

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {
		if ( this.value === "" ) {
			this.value = "0";
		}
	} );

	OSApp.UIDom.holdButton( popup.find( ".incr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, 1 );
		return false;
	} );

	OSApp.UIDom.holdButton( popup.find( ".decr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, -1 );
		return false;
	} );

	if ( opt.showSun ) {
		popup.find( ".useSun" ).on( "click", "button", function() {
			var button = $( this ),
				contraButton = popup.find( ".useSun" ).find( "button" ).not( button ),
				timeButtons = popup.find( "span" ).find( ".ui-btn,input" );

			contraButton.removeClass( "ui-btn-active" );
			if ( button.hasClass( "ui-btn-active" ) ) {
				button.removeClass( "ui-btn-active" );
				timeButtons.prop( "disabled", false ).removeClass( "ui-disabled" );
			} else {
				button.addClass( "ui-btn-active" );
				timeButtons.prop( "disabled", true ).addClass( "ui-disabled" );
			}

			if ( opt.incrementalUpdate ) {
				opt.callback( getValue() );
			}
		} );
	}

	popup
	.css( "max-width", "350px" )
	.one( "popupafteropen", function() {
		if ( type !== 0 ) {
			popup.find( "span" ).find( ".ui-btn,input" ).prop( "disabled", true ).addClass( "ui-disabled" );
		}
	} )
	.one( "popupafterclose", function() {
		if ( opt.incrementalUpdate ) {
			opt.callback( getValue() );
		}
	} );

	OSApp.UIDom.openPopup( popup );
};

// Accessory functions for jQuery Mobile
OSApp.UIDom.areYouSure = function( text1, text2, success, fail, options ) {
	$( "#sure" ).popup( "destroy" ).remove();
	success = success || function() {};
	fail = fail || function() {};

	var showShiftDialog = 0;
	if ( typeof options === "object" ) {
		showShiftDialog = ( options.type === OSApp.Constants.dialog.REMOVE_STATION ) &&
			OSApp.Groups.canShift( options.gid ) && OSApp.Stations.isSequential( options.station );
	}

	var popup = $(
		"<div data-role='popup' data-theme='a' id='sure'>" +
			"<h3 class='sure-1 center'>" + text1 + "</h3>" +
			"<p class='sure-2 center'>" + text2 + "</p>" +
			"<a class='sure-do ui-btn ui-btn-b ui-corner-all ui-shadow' href='#'>" + OSApp.Language._( "Yes" ) + "</a>" +
			"<a class='sure-dont ui-btn ui-corner-all ui-shadow' href='#'>" + OSApp.Language._( "No" ) + "</a>" +
			( showShiftDialog ? "<label><input id='shift-sta' type='checkbox'>Move up remaining stations in the same sequential group?</label>" : "" ) +
		"</div>"
	);

	//Bind buttons
	popup.find( ".sure-do" ).one( "click.sure", function() {
		popup.popup( "close" );
		success();
		return false;
	} );
	popup.find( ".sure-dont" ).one( "click.sure", function() {
		popup.popup( "close" );
		fail();
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showIPRequest = function( opt ) {
	var defaults = {
			title: OSApp.Language._( "Enter IP Address" ),
			ip: [ 0, 0, 0, 0 ],
			showBack: true,
			callback: function() {}
		};

	opt = $.extend( {}, defaults, opt );

	$( "#ipInput" ).popup( "destroy" ).remove();

	var popup = $( "<div data-role='popup' id='ipInput' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + opt.title + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<span>" +
					"<fieldset class='ui-grid-c incr'>" +
						"<div class='ui-block-a'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-b'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-c'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-d'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
					"</fieldset>" +
					"<div class='ui-grid-c inputs'>" +
						"<div class='ui-block-a'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='" + opt.ip[ 0 ] + "'></div>" +
						"<div class='ui-block-b'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='" + opt.ip[ 1 ] + "'></div>" +
						"<div class='ui-block-c'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='" + opt.ip[ 2 ] + "'></div>" +
						"<div class='ui-block-d'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='" + opt.ip[ 3 ] + "'></div>" +
					"</div>" +
					"<fieldset class='ui-grid-c decr'>" +
						"<div class='ui-block-a'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-b'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-c'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-d'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
					"</fieldset>" +
				"</span>" +
				( opt.showBack ? "<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" : "" ) +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			var input = popup.find( ".inputs input" ).eq( pos ),
				val = parseInt( input.val() );

			if ( ( dir === -1 && val === 0 ) || ( dir === 1 && val >= 255 ) ) {
				return;
			}

			input.val( val + dir );
			opt.callback( getIP() );
		},
		getIP = function() {
			return $.makeArray( popup.find( ".ip_addr" ).map( function() {return parseInt( $( this ).val() );} ) );
		};

	popup.find( "button.submit" ).on( "click", function() {
		opt.callback( getIP() );
		popup.popup( "destroy" ).remove();
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {
		if ( this.value === "" ) {
			this.value = "0";
		}
	} );

	OSApp.UIDom.holdButton( popup.find( ".incr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, 1 );
		return false;
	} );

	OSApp.UIDom.holdButton( popup.find( ".decr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, -1 );
		return false;
	} );

	popup
	.css( "max-width", "350px" )
	.one( "popupafterclose", function() {
		opt.callback( getIP() );
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showPause = function() {
	if ( OSApp.StationQueue.isPaused() ) {
		OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to resume program operation?" ), "", function() {
			OSApp.Firmware.sendToOS( "/pq?pw=" );
		} );
	} else {
		OSApp.UIDom.showDurationBox( {
			title: "Pause Station Runs",
			incrementalUpdate: false,
			maximum: 65535,
			callback: function( duration ) {
				OSApp.Firmware.sendToOS( "/pq?dur=" + duration + "&pw=" );
			}
		} );
	}
};

// Handle timer update on the home page and status bar
OSApp.UIDom.updateTimers = function() {
	var lastCheck = new Date().getTime();

	setInterval( function() {

		if ( !OSApp.currentSession.isControllerConnected() ) {
			return false;
		}

		// Handle time drift
		var now = new Date().getTime(),
			diff = now - lastCheck;

		if ( diff > 2000 ) {
			OSApp.Status.checkStatus();
			OSApp.Status.refreshStatus();
		}

		lastCheck = now;

		// If no timers are defined then exit
		if ( $.isEmptyObject( OSApp.uiState.timers ) ) {
			return;
		}

		for ( var timer in OSApp.uiState.timers ) {
			if ( Object.prototype.hasOwnProperty.call(OSApp.uiState.timers,  timer ) ) {
				if ( OSApp.uiState.timers[ timer ].val <= 0 ) {
					if ( timer === "statusbar" ) {
						OSApp.UIDom.showLoading( "#footer-running" );
						OSApp.Status.refreshStatus();
					}

					if ( typeof OSApp.uiState.timers[ timer ].done === "function" ) {
						OSApp.uiState.timers[ timer ].done();
					}

					delete OSApp.uiState.timers[ timer ];
				} else {
					if ( timer === "clock" ) {
						++OSApp.uiState.timers[ timer ].val;
						OSApp.uiState.timers[ timer ].update();
					} else if ( timer === "statusbar" || typeof OSApp.uiState.timers[ timer ].station === "number" ) {
						--OSApp.uiState.timers[ timer ].val;
						OSApp.uiState.timers[ timer ].update();
					}
				}
			}
		}
	}, 1000 ); // FIXME: refactor the 1000 value out to Constants or settings/config
};

// Handle main switches for manual mode
OSApp.UIDom.flipSwitched = function() {
	if ( OSApp.uiState.switching ) {
		return;
	}

	//Find out what the switch was changed to
	var flip = $( this ),
		id = flip.attr( "id" ),
		changedTo = flip.is( ":checked" ),
		method = ( id === "mmm" ) ? "mm" : id,
		defer;

	if ( changedTo ) {
		defer = OSApp.Firmware.sendToOS( "/cv?pw=&" + method + "=1" );
	} else {
		defer = OSApp.Firmware.sendToOS( "/cv?pw=&" + method + "=0" );
	}

	$.when( defer ).then( function() {
		OSApp.Status.refreshStatus();
		if ( id === "mmm" ) {
			$( "#mm_list .green" ).removeClass( "green" );
		}
		OSApp.Status.checkStatus();
	},
	function() {
		OSApp.uiState.switching = true;
		setTimeout( function() {
			OSApp.uiState.switching = false;
		}, 200 );
		flip.prop( "checked", !changedTo ).flipswitch( "refresh" );
	} );
};

OSApp.UIDom.clearPrograms = function( callback ) {
	callback = callback || function() {};
	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete ALL programs?" ), "", function() {
		var url = "/dp?pw=&pid=-1";
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( url ).done( function() {
			if ( typeof callback === "function" ) {
				callback();
			}
			OSApp.Errors.showError( OSApp.Language._( "Programs have been deleted" ) );
		} );
	} );
};

OSApp.UIDom.resetAllOptions = function( callback ) {
	callback = callback || function() {};
	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete all settings and return to the default settings?" ), "", function() {
		var co;

		if ( OSApp.Firmware.isOSPi() ) {
			co = "otz=32&ontp=1&onbrd=0&osdt=0&omas=0&omton=0&omtoff=0&orst=1&owl=100&orlp=0&ouwt=0&olg=1&oloc=Boston,MA";
		} else {
			co = "o2=1&o3=1&o12=80&o13=0&o15=0&o17=0&o18=0&o19=0&o20=0&o22=1&o23=100&o26=0&o27=110&o28=100&o29=15&" +
				"o30=320&o31=0&o36=1&o37=0&o38=0&o39=0&o41=100&o42=0&o43=0&o44=8&o45=8&o46=8&o47=8&" +
				"o48=0&o49=0&o50=0&o51=1&o52=0&o53=1&o54=0&o55=0&o56=0&o57=0&";
			if ( OSApp.Firmware.checkOSVersion( 2199 ) ) {
				co += "o32=0&o33=0&o34=0&o35=0&"; // For newer firmwares, resets ntp to 0.0.0.0
			} else {
				co += "o32=216&o33=239&o34=35&o35=12&"; // Time.google.com
			}
			co += "loc=Boston,MA&wto=%22key%22%3A%22%22";

			co = OSApp.Utils.transformKeysinString( co );
		}

		OSApp.Firmware.sendToOS( "/co?pw=&" + co ).done( function() {
			if ( typeof callback === "function" ) {
				callback();
			}
			OSApp.Sites.updateController( OSApp.Weather.updateWeather );
		} );
	} );
};

OSApp.UIDom.updateLoginButtons = function() {
	var page = $( ".ui-page-active" );

	OSApp.Storage.get( "cloudToken", function( data ) {
		var login = $( ".login-button" ),
			logout = $( ".logout-button" );

		if ( data.cloudToken === null || data.cloudToken === undefined ) {
			login.removeClass( "hidden" );

			if ( !OSApp.currentSession.local ) {
				logout.addClass( "hidden" );
			}

			logout.find( "a" ).text( OSApp.Language._( "Logout" ) );

			if ( page.attr( "id" ) === "site-control" ) {
				page.find( ".logged-in-alert" ).remove();
			}
		} else {
			logout.removeClass( "hidden" ).find( "a" ).text( OSApp.Language._( "Logout" ) + " (" + OSApp.Network.getTokenUser( data.cloudToken ) + ")" );
			login.addClass( "hidden" );

			if ( page.attr( "id" ) === "site-control" && page.find( ".logged-in-alert" ).length === 0 ) {
				page.find( ".ui-content" ).prepend( OSApp.Network.addSyncStatus( data.cloudToken ) );
			}
		}
	} );
};

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
OSApp.Firmware = OSApp.Firmware || {};

OSApp.Firmware.Constants = {

	// Ensure error codes align with reboot causes in Firmware defines.h
	// Do NOT use Language._ to translate these here during definition. Do it when rendering!
	// FIXME: all enums should follow the pattern of an array with objects with id/name. Example: [{id: -4, name: "Empty Response"}]
	rebootReasons: {
		0: "None",
		1: "Factory Reset",
		2: "Reset Button",
		3: "WiFi Change",
		4: "Web Request",
		5: "Web Request",
		6: "WiFi Configure",
		7: "Firmware Update",
		8: "Weather Failure",
		9: "Network Failure",
		10: "Clock Update",
		99: "Power On"
	}
};

OSApp.Firmware.isChangeRequest = function( dest ) {
	return /\/(?:cv|cs|csn|cr|cp|uwa|dp|dsn|dsl|co|cl|cu|up|cm)(?:\?|$)/.test( dest );
};

// Wrapper function to communicate with OpenSprinkler
OSApp.Firmware.sendToOS = function( dest, type ) {

	// Inject password into the request
	dest = dest.replace( "pw=", "pw=" + encodeURIComponent( OSApp.currentSession.pass ) );
	type = type || "text";

	// Designate AJAX queue based on command type
	var isChange = OSApp.Firmware.isChangeRequest( dest ),
		queue = isChange ? "change" : "default",

		// Use POST when sending data to the controller (requires firmware 2.1.8 or newer)
		usePOST = ( isChange && OSApp.Firmware.checkOSVersion( 300 ) ),
		urlDest = usePOST ? dest.split( "?" )[ 0 ] : dest,
		obj = {
			url: OSApp.currentSession.token ? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + urlDest : OSApp.currentSession.prefix + OSApp.currentSession.ip + urlDest,
			type: usePOST ? "POST" : "GET",
			data: usePOST ? OSApp.Firmware.getUrlVars( dest ) : null,
			dataType: type,
			shouldRetry: function( xhr, current ) {
				if ( xhr.status === 0 && xhr.statusText === "abort" || OSApp.Constants.http.RETRY_COUNT < current ) {
					$.ajaxq.abort( queue );
					return false;
				}
				return true;
			}
		},
		defer;

	if ( OSApp.currentSession.auth ) {
		$.extend( obj, {
			beforeSend: function( xhr ) {
				xhr.setRequestHeader(
					"Authorization", "Basic " + btoa( OSApp.currentSession.authUser + ":" + OSApp.currentSession.authPass )
				);
			}
		} );
	}

	if ( OSApp.currentSession.fw183 ) {

		// Firmware 1.8.3 has a bug handling the time stamp in the GET request
		$.extend( obj, {
			cache: "true"
		} );
	}

	function handleFirmwareResponse( data ) {

		// In case the data type was incorrect, attempt to fix.
		// If fix not possible, return string
		if ( typeof data === "string" ) {
			try {
				data = $.parseJSON( data );
			} catch {
				return data;
			}
		}

		// Don't need to handle this situation for OSPi or firmware below 2.1.0
		if ( !data || typeof data !== "object" || typeof data.result !== "number" ) {
			return data;
		}

		// Return as successful
		if ( data.result === 1 ) {
			return data;

		// Handle incorrect password
		} else if ( data.result === 2 ) {
			if ( isChange ) {
				OSApp.Errors.showError( OSApp.Language._( "Check device password and try again." ) );
			}

			// Tell subsequent handlers this request has failed (use 401 to prevent retry)
			return $.Deferred().reject( { "status":401 } );

		// Handle page not found by triggering fail
		} else if ( data.result === 32 ) {

			return $.Deferred().reject( { "status":404 } );
		}

		// All numeric firmware errors reject, including JSON read endpoints such
		// as /jsn and /jsd. Only mutations show the generic firmware toast; read
		// callers provide operation-specific context.
		if ( isChange ) {
				// Friendly text for well-known firmware result codes (see
				// HTML_* in OpenSprinkler firmware/defines.h). Anything not
				// in the map falls back to the generic message. The raw code
				// is always appended so unknown errors can still be looked up.
				var resultMsgs = {
					0x03: OSApp.Language._( "Item mismatch." ),                                // HTML_MISMATCH
					0x10: OSApp.Language._( "A required field is missing." ),                  // HTML_DATA_MISSING
					0x11: OSApp.Language._( "A value is out of range." ),                      // HTML_DATA_OUTOFBOUND
					0x12: OSApp.Language._( "A field has an invalid format." ),                // HTML_DATA_FORMATERROR
					0x13: OSApp.Language._( "RF code error." ),                                // HTML_RFCODE_ERROR
					0x30: OSApp.Language._( "Operation not permitted." ),                      // HTML_NOT_PERMITTED
					0x40: OSApp.Language._( "Upload failed." ),                                // HTML_UPLOAD_FAILED
					0x50: OSApp.Language._( "Internal firmware error." )                       // HTML_INTERNAL_ERROR
				};
				if ( data.result === 0x30 && /\/(?:cm|cs)(?:\?|$)/.test( dest ) ) {
					// Preserve the long-standing station-busy guidance for manual-run commands.
					OSApp.Errors.showError(
						OSApp.Language._( "The selected station is already running or is scheduled to run." )
					);
				} else {
					var message = resultMsgs[ data.result ] || OSApp.Language._( "Please check input and try again." );
					OSApp.Errors.showError( message + " (Error " + data.result + ")" );
				}
		}

		// Tell subsequent handlers this request has failed.
		return $.Deferred().reject( data );
	}

	if ( type === "arraybuffer" || type === "blob" ) {
		const fetchHeaders = {};
		if ( OSApp.currentSession.auth ) {
			fetchHeaders[ "Authorization" ] = "Basic " + btoa( OSApp.currentSession.authUser + ":" + OSApp.currentSession.authPass );
		}
		const abortController = typeof AbortController === "function" ? new AbortController() : null;
		const fetchOptions = { headers: fetchHeaders };
		const isSensorLog = /\/jsl(?:\?|$)/.test( dest );
		if ( abortController ) {
			fetchOptions.signal = abortController.signal;
		}
		defer = $.Deferred();
			const fetchTimeout = setTimeout( function() {
			if ( abortController ) {
				abortController.abort();
			}
			defer.reject( { status: 0, statusText: "timeout" } );
			}, type === "blob" ? 10 * 60 * 1000 : ( $.ajaxSettings.timeout || 10000 ) );
		fetch( obj.url, fetchOptions )
			.then( function( r ) {
				if ( !r.ok ) {
					throw { status: r.status };
				}
				var contentType = r.headers.get( "Content-Type" ) || "";
					if ( isSensorLog && /json/i.test( contentType ) ) {
					return r.json().then( function( data ) {
						// /jsl uses result 80 when no binary log header exists yet.
						if ( data && data.result === 80 ) {
							if ( type === "blob" ) {
								return new Blob( [ "uuid,timestamp,value\n" ], { type: "text/csv;charset=utf-8;" } );
							}
							var emptyLog = new ArrayBuffer( 0 );
							emptyLog.noLogHeader = true;
							return emptyLog;
						}
						// A JSON success response is not a valid binary log payload.
						if ( data && data.result === 1 ) {
							return $.Deferred().reject( { status: 0, statusText: "parsererror" } );
						}
						return handleFirmwareResponse( data );
						} );
					}
					if ( isSensorLog && ( type === "blob" ? !/^text\/csv(?:\s*;|$)/i.test( contentType ) :
						!/^application\/octet-stream(?:\s*;|$)/i.test( contentType ) ) ) {
						return $.Deferred().reject( { status: 0, statusText: "parsererror" } );
					}
					return type === "blob" ? r.blob() : r.arrayBuffer();
			} )
			.then( function( buf ) {
				if ( type === "arraybuffer" && isSensorLog && ( !( buf instanceof ArrayBuffer ) || buf.byteLength % 10 !== 0 ) ) {
					return $.Deferred().reject( { status: 0, statusText: "parsererror" } );
				}
				return buf;
			} )
			.then( function( buf ) { defer.resolve( buf ); } )
			.catch( function( err ) { defer.reject( err ); } )
			.finally( function() { clearTimeout( fetchTimeout ); } );
		return defer.promise();
	}

	defer = $.ajaxq( queue, obj ).then(
		function( data ) {
			return handleFirmwareResponse( data );
		},
		function( e ) {
			if ( ( e.statusText === "timeout" || e.status === 0 ) && isChange ) {

				// Handle the connection timing out but only show error on setting change
				OSApp.Errors.showError( OSApp.Language._( "Connection timed-out. Please try again." ) );
			} else if ( e.status === 401 ) {

				//Handle unauthorized requests
				OSApp.Errors.showError( OSApp.Language._( "Check device password and try again." ) );
			}
			// Preserve transport failure semantics for reads as well as writes. Callers
			// must not treat a failed /jsn (or any other read) as resolved undefined.
			return $.Deferred().reject( e );
		}
	);

	return defer;
};

// OpenSprinkler feature detection functions
OSApp.Firmware.checkOSVersion = function( check ) {
	// Return early if we are missing controller object
	if ( $.isEmptyObject( OSApp.currentSession.controller ) ) {
		return false;
	}
	var version = OSApp.currentSession.controller.options.fwv;

	// If check is 4 digits then we need to include the minor version number as well
	if ( check >= 1000 ) {
		if ( isNaN( OSApp.currentSession.controller.options.fwm ) ) {
			return false;
		} else {
			version = version * 10 + OSApp.currentSession.controller.options.fwm;
		}
	}

	if ( OSApp.Firmware.isOSPi() ) {
		return false;
	} else {
		if ( check === version ) {
			return true;
		} else {
			return OSApp.Firmware.versionCompare( version.toString().split( "" ), check.toString().split( "" ) );
		}
	}
};

OSApp.Firmware.isOSPi = function() {
	if ( OSApp.currentSession.controller &&
		typeof OSApp.currentSession.controller.options === "object" &&
		typeof OSApp.currentSession.controller.options.fwv === "string" &&
		OSApp.currentSession.controller.options.fwv.search( /ospi/i ) !== -1 ) {

		return true;
	}
	return false;
};

OSApp.Firmware.versionCompare = function( ver, check ) {

	// Returns false when check < ver and 1 when check > ver

	var max = Math.max( ver.length, check.length ),
		result;

	while ( ver.length < max ) {
		ver.push( 0 );
	}

	while ( check.length < max ) {
		check.push( 0 );
	}

	for ( var i = 0; i < max; i++ ) {
		result = Math.max( -1, Math.min( 1, ver[ i ] - check[ i ] ) );
		if ( result !== 0 ) {
			break;
		}
	}

	if ( result === -1 ) {
		result = false;
	}

	return result;
};

OSApp.Firmware.getUrlVars = function( url ) {
	var hash,
		json = {},
		hashes = url.slice( url.indexOf( "?" ) + 1 ).split( "&" );

	for ( var i = 0; i < hashes.length; i++ ) {
		hash = hashes[ i ].split( "=" );
		json[ hash[ 0 ] ] = decodeURIComponent( hash[ 1 ].replace( /\+/g, "%20" ) );
	}
	return json;
};

OSApp.Firmware.checkOSPiVersion = function( check ) {
	var ver;

	if ( OSApp.Firmware.isOSPi() ) {
		ver = OSApp.currentSession.controller.options.fwv.split( "-" )[ 0 ];
		if ( ver !== check ) {
			ver = ver.split( "." );
			check = check.split( "." );
			return OSApp.Firmware.versionCompare( ver, check );
		} else {
			return true;
		}
	} else {
		return false;
	}
};

OSApp.Firmware.getOSVersion = function( fwv ) {
	if ( !fwv && typeof OSApp.currentSession.controller.options === "object" ) {
		fwv = OSApp.currentSession.controller.options.fwv;
	}
	if ( typeof fwv === "string" && fwv.search( /ospi/i ) !== -1 ) {
		return fwv;
	} else {
		return ( fwv / 100 >> 0 ) + "." + ( ( fwv / 10 >> 0 ) % 10 ) + "." + ( fwv % 10 );
	}
};

OSApp.Firmware.getOSMinorVersion = function() {
	if ( !OSApp.Firmware.isOSPi() && typeof OSApp.currentSession.controller.options === "object" && typeof OSApp.currentSession.controller.options.fwm === "number" && OSApp.currentSession.controller.options.fwm > 0 ) {
		return " (" + OSApp.currentSession.controller.options.fwm + ")";
	}
	return "";
};

OSApp.Firmware.getHWVersion = function( hwv ) {
	if ( !hwv ) {
		if ( typeof OSApp.currentSession.controller.options === "object" && typeof OSApp.currentSession.controller.options.hwv !== "undefined" ) {
			hwv = OSApp.currentSession.controller.options.hwv;
		} else {
			return false;
		}
	}

	if ( typeof hwv === "string" ) {
		return hwv;
	} else {
		if ( hwv === 64 ) {
			return "OSPi";
		} else if ( hwv === 128 ) {
			return "OSBo";
		} else if ( hwv === 192 ) {
			return "Linux";
		} else if ( hwv === 255 ) {
			return "Demo";
		} else {
			return ( ( hwv / 10 >> 0 ) % 10 ) + "." + ( hwv % 10 );
		}
	}
};

OSApp.Firmware.getHWType = function() {
	if ( OSApp.Firmware.isOSPi() || typeof OSApp.currentSession.controller.options.hwt !== "number" || OSApp.currentSession.controller.options.hwt === 0 ) {
		return "";
	}

	if ( OSApp.currentSession.controller.options.hwt === 172 ) {
		return " - AC";
	} else if ( OSApp.currentSession.controller.options.hwt === 220 ) {
		return " - DC";
	} else if ( OSApp.currentSession.controller.options.hwt === 26 ) {
		return " - Latching";
	} else {
		return "";
	}
};

OSApp.Firmware.getTrustedGithubUrl = function( value ) {
	if ( typeof value !== "string" ) {
		return null;
	}

	try {
		var url = new URL( value );

		if (
			url.protocol !== "https:" ||
			url.hostname.toLowerCase() !== "github.com" ||
			url.port ||
			url.username ||
			url.password
		) {
			return null;
		}

		return url.href;
	} catch {
		return null;
	}
};

OSApp.Firmware.checkFirmwareUpdate = function() {

	// Update checks are only be available for Arduino firmwares
	if ( OSApp.Firmware.checkOSVersion( 200 ) && ( ( typeof parseFloat(OSApp.Firmware.getHWVersion()) === "number" && parseFloat(OSApp.Firmware.getHWVersion()) >= 3 ) || OSApp.Firmware.isOSPi() ) ) {

		// Github API to get releases for OpenSprinkler firmware
		$.getJSON( "https://api.github.com/repos/opensprinkler/opensprinkler-firmware/releases" ).done( function( data ) {
			// Convert both the controller version and the site version to decimals
			let controller = OSApp.currentSession.controller.options.fwv;
			let recent = data[ 0 ].tag_name;

			if ( OSApp.currentSession.controller.options.fwm ) {
				controller += OSApp.currentSession.controller.options.fwm / 10;
			}

			if ( typeof recent === "string" && recent.includes("(") ) {
				recent = parseFloat(recent.replace("(", ".").replace(")", ""));
			}

			if ( controller < recent ) {

				// Grab a local storage variable which defines the firmware version for the last dismissed update
				OSApp.Storage.get( "updateDismiss", function( flag ) {

					// If the variable does not exist or is lower than the newest update, show the update notification
					if ( !flag.updateDismiss || flag.updateDismiss < data[ 0 ].tag_name ) {
						OSApp.Notifications.addNotification( {
							title: OSApp.Language._( "Firmware update available" ),
							on: function() {

								// Modify the changelog by parsing markdown of lists to HTML
								var button = $( this ).parent(),
									hwVersion = OSApp.currentSession.controller.options.hwv,
									isBrowserUpload = hwVersion >= 30 && hwVersion < 40,
									canUpdate = ( isBrowserUpload && !OSApp.currentSession.token && !!OSApp.currentSession.ip ) ||
										( hwVersion > 63 && OSApp.Firmware.checkOSVersion( 216 ) ),
									changelog = OSApp.Firmware.getTrustedGithubUrl( data[ 0 ][ "html_url" ] ),
									popup = $(
										"<div data-role='popup' class='modal' data-theme='a'>" +
											"<h3 class='center firmware-release-title' style='margin-bottom:0'></h3>" +
											"<h5 class='center' style='margin:0'>" + OSApp.Language._( "This Controller" ) + ": " + OSApp.Firmware.getOSVersion() + OSApp.Firmware.getOSMinorVersion() + "</h5>" +
											( changelog ? "<a class='changelog iab ui-btn ui-corner-all ui-shadow' style='width:80%;margin:5px auto;' target='_blank' rel='noopener noreferrer'>" +
												OSApp.Language._( "View Changelog" ) +
											"</a>" : "" ) +
											"<a class='guide ui-btn ui-corner-all ui-shadow' style='width:80%;margin:5px auto;' href='#'>" +
												OSApp.Language._( "Update Guide" ) +
											"</a>" +
											( canUpdate ? "<a class='update ui-btn ui-corner-all ui-shadow' style='width:80%;margin:5px auto;' href='#'>" +
												OSApp.Language._( "Update Now" ) +
											"</a>" : "" ) +
											"<a class='dismiss ui-btn ui-btn-b ui-corner-all ui-shadow' style='width:80%;margin:5px auto;' href='#'>" +
												OSApp.Language._( "Dismiss" ) +
											"</a>" +
										"</div>"
									);

								popup.find( ".firmware-release-title" ).text(
									OSApp.Language._( "Latest" ) + " " + OSApp.Language._( "Firmware" ) + ": " + data[ 0 ].name
								);
								popup.find( ".changelog" ).attr( "href", changelog );

								popup.find( ".update" ).on( "click", function() {
									if ( isBrowserUpload ) {
										$( "<a></a>" )
											.addClass( "hidden iab" )
											.attr( "href", OSApp.currentSession.prefix + OSApp.currentSession.ip + "/update" )
											.appendTo( popup )
											.trigger( "click" );
										return;
									}

									// For OSPi/OSBo with firmware 2.1.6 or newer, trigger the update script from the app
									OSApp.Firmware.sendToOS( "/cv?pw=&update=1", "json" ).then(
										function() {
											OSApp.Errors.showError( OSApp.Language._( "Update successful" ) );
											popup.find( ".dismiss" ).click();
										},
										function() {
											$.mobile.loading( "show", {
												html: "<div class='center'>" + OSApp.Language._( "Update did not complete." ) + "<br>" +
													"<a class='iab ui-btn' href='https://openthings.freshdesk.com/support/solutions/articles/5000631599-installing-and-updating-the-unified-firmware#upgrade'>" + OSApp.Language._( "Update Guide" ) + "</a></div>",
												textVisible: true,
												theme: "b"
											} );
											setTimeout( function() { $.mobile.loading( "hide" ); }, 3000 );
										}
									);
								} );

								popup.find( ".guide" ).on( "click", function() {

										var url = OSApp.currentSession.controller.options.hwv > 63 ?
											"https://openthings.freshdesk.com/support/solutions/articles/5000631599-installing-and-updating-the-unified-firmware#upgrade"
											: "https://openthings.freshdesk.com/support/solutions/articles/5000381694-opensprinkler-firmware-update-guide";

										// Open the firmware upgrade guide in a child browser
										$( "<a class='hidden iab' href='" + url + "'></a>" )
											.appendTo( popup ).click();
								} );

								popup.find( ".dismiss" ).one( "click", function() {

									// Update the notification dismiss variable with the latest available version
									OSApp.Storage.set( { updateDismiss:data[ 0 ].tag_name } );
									popup.popup( "close" );
									OSApp.Notifications.removeNotification( button );
									return false;
								} );

								OSApp.UIDom.openPopup( popup );
							}
						} );
					}
				} );
			}
		} );
	}
};

OSApp.Firmware.detectUnusedExpansionBoards = function() {
	if (
		typeof OSApp.currentSession.controller.options.dexp === "number" &&
		OSApp.currentSession.controller.options.dexp < 255 &&
		OSApp.currentSession.controller.options.dexp >= 0 &&
		OSApp.currentSession.controller.options.ext < OSApp.currentSession.controller.options.dexp
	) {
		OSApp.Notifications.addNotification( {
			title: OSApp.Language._( "Unused Expanders Detected" ),
			desc: OSApp.Language._( "Click here to enable all connected stations." ),
			on: function() {
				OSApp.Notifications.removeNotification( $( this ).parent() );
				OSApp.UIDom.changePage( "#os-options", {
					expandItem: "station"
				} );
				return false;
			}
		} );
	}
};

OSApp.Firmware.showUnifiedFirmwareNotification = function() {
	if ( !OSApp.Firmware.isOSPi() ) {
		return;
	}

	OSApp.Storage.get( "ignoreUnifiedFirmware", function( data ) {
		if ( data.ignoreUnifiedFirmware !== "1" ) {

			// Unable to access the device using it's public IP
			OSApp.Notifications.addNotification( {
				title: OSApp.Language._( "Unified firmware is now available" ),
				desc: OSApp.Language._( "Click here for more details" ),
				on: function() {
					window.open( "https://openthings.freshdesk.com/support/solutions/articles/5000631599",
						"_blank", "location=" + ( OSApp.currentDevice.isAndroid ? "yes" : "no" ) +
						",enableViewportScale=yes,toolbarposition=top,closebuttoncaption=" + OSApp.Language._( "Back" )
					);

					return false;
				},
				off: function() {
					OSApp.Storage.set( { "ignoreUnifiedFirmware": "1" } );
					return true;
				}
			} );
		}
	} );
};

OSApp.Firmware.getRebootReason = function( reason ) {
	var result = OSApp.Language._( "Unrecognised" ) + " (" + reason + ")";

	if ( reason in OSApp.Firmware.Constants.rebootReasons ) {
		result = OSApp.Language._( OSApp.Firmware.Constants.rebootReasons[ reason ] );
	}

	return result;
};

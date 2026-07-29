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

// Configuration restores span many requests and must own the mutation queue for their
// entire lifetime. The active capability is closure-private: callers cannot bypass the
// lock with a URL or data flag, and a lease can only send through its bound function.
( function() {
	var activeMutationCapability = null;

	OSApp.Firmware.acquireMutationLease = function( receiver ) {
		if ( activeMutationCapability !== null || typeof receiver !== "function" ) {
			return null;
		}

		var capability = {},
			released = false,
			lease = {
				sendToOS: function( dest, type ) {
					return OSApp.Firmware.sendToOS( dest, type, capability );
				},
				release: function() {
					if ( released ) return false;
					released = true;
					if ( activeMutationCapability === capability ) {
						activeMutationCapability = null;
						return true;
					}
					return false;
				}
			};

		activeMutationCapability = capability;
		try {
			receiver( Object.freeze( lease ) );
		} catch ( error ) {
			lease.release();
			throw error;
		}
		return lease.release;
	};

	// Wrapper function to communicate with OpenSprinkler. The third argument is an
	// opaque identity created only by acquireMutationLease's closure-bound sender.
	OSApp.Firmware.sendToOS = function( dest, type, mutationCapability ) {

	// Inject password into the request
	dest = dest.replace( "pw=", "pw=" + encodeURIComponent( OSApp.currentSession.pass ) );
	type = type || "text";

	// Designate AJAX queue based on command type
	var isLegacyStationChange = /^\/sn[1-9][0-9]*=/.test( dest ),
		isChange = isLegacyStationChange || /^\/(?:cl|cm|co|cp|cr|cs|csn|cu|cv|dl|dp|dsn|pq|sa|sb|sc|sn|sp|up|uwa)(?:\?|$)/.test( dest ),
		queue = isChange ? "change" : "default",
		sessionGeneration = OSApp.currentSession.generation || 0,
		firmwareVersion = OSApp.currentSession.controller && OSApp.currentSession.controller.options &&
			OSApp.currentSession.controller.options.fwv,
		requireResult = isChange && typeof firmwareVersion === "number" && firmwareVersion >= 210,

		// Reserve POST for the firmware 3.0 protocol; all currently released firmware uses GET.
		usePOST = ( isChange && OSApp.Firmware.checkOSVersion( 300 ) ),
		urlDest = usePOST ? dest.split( "?" )[ 0 ] : dest,
		obj = {
			url: OSApp.currentSession.token ? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + urlDest : OSApp.currentSession.prefix + OSApp.currentSession.ip + urlDest,
			type: usePOST ? "POST" : "GET",
			timeout: OSApp.Constants.http.REQUEST_TIMEOUT_MS,
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

	if ( isChange && activeMutationCapability !== null && mutationCapability !== activeMutationCapability ) {
		return $.Deferred().reject( { status: 0, statusText: "mutation-locked" } ).promise();
	}

	if ( OSApp.currentSession.auth ) {
		$.extend( obj, {
			beforeSend: function( xhr ) {
				var header = OSApp.Utils.getBasicAuthHeader( OSApp.currentSession.authUser, OSApp.currentSession.authPass );
				if ( header ) xhr.setRequestHeader( "Authorization", header );
			}
		} );
	}

	if ( OSApp.currentSession.fw183 ) {

		// Firmware 1.8.3 has a bug handling the time stamp in the GET request
		$.extend( obj, {
			cache: "true"
		} );
	}

	defer = $.ajaxq( queue, obj ).then(
		function( data ) {
			if ( sessionGeneration !== ( OSApp.currentSession.generation || 0 ) ) {
				return $.Deferred().reject( { status: 0, statusText: "stale-session" } ).promise();
			}

			// In case the data type was incorrect, attempt to fix.
			// If parsing fails, only non-mutating reads may return the raw string.
			if ( typeof data === "string" ) {
				try {
					data = $.parseJSON( data );
				} catch {
					if ( requireResult ) {
						return $.Deferred().reject( { status: 0, statusText: "invalid-response" } ).promise();
					}
					return data;
				}
			}
			if ( requireResult && ( !data || typeof data !== "object" || Array.isArray( data ) ||
				!Number.isSafeInteger( data.result ) ) ) {
				return $.Deferred().reject( { status: 0, statusText: "invalid-response" } ).promise();
			}

			// Don't need to handle this situation for OSPi or firmware below 2.1.0
			if ( !data || typeof data !== "object" || Array.isArray( data ) || typeof data.result !== "number" ) {
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
				return $.Deferred().reject( { "status":401, userNotified: isChange } );

			// Handle page not found by triggering fail
			} else if ( data.result === 32 ) {

				return $.Deferred().reject( { "status":404 } );
			}

			// Only show error messages on setting change requests
			if ( isChange ) {
				if ( data.result === 48 ) {
					OSApp.Errors.showError(
						OSApp.Language._( "The selected station is already running or is scheduled to run." )
					);
				} else {
					OSApp.Errors.showError( OSApp.Language._( "Please check input and try again." ) );
				}

				// Tell subsequent handlers this request has failed
				data.userNotified = true;
				return $.Deferred().reject( data );
			}

		},
		function( e ) {
			if ( sessionGeneration !== ( OSApp.currentSession.generation || 0 ) || e.statusText === "stale-session" ) {
				return $.Deferred().reject( e ).promise();
			}

			if ( ( e.statusText === "timeout" || e.status === 0 ) && isChange ) {

				// Handle the connection timing out but only show error on setting change
				OSApp.Errors.showError( OSApp.Language._( "Connection timed-out. Please try again." ) );
				e.userNotified = true;
			} else if ( e.status === 401 ) {

				//Handle unauthorized requests
				OSApp.Errors.showError( OSApp.Language._( "Check device password and try again." ) );
				e.userNotified = true;
			}
			return $.Deferred().reject( e ).promise();
		}
	);

	return defer;
	};
}() );

// Controller errors use an independent toast, so settling a failed operation must
// never leave the progress loader visible.
OSApp.Firmware.settleLoadingFailure = function( error ) {
	if ( error && ( error.statusText === "abort" || error.statusText === "stale-session" ||
		error.statusText === "mutation-locked" ) ) {
		return;
	}

	$.mobile.loading( "hide" );
};

// Select exactly one password protocol from trusted firmware metadata. Cleartext is only
// permitted for a known pre-2.1.3 controller, or for OSPi after explicit legacy approval;
// missing or unapproved metadata fails safe to MD5.
OSApp.Firmware.getPasswordAuth = function( firmwareVersion, password, hashPassword, allowLegacyOSPi ) {
	var isKnownLegacy = typeof firmwareVersion === "number" && Number.isFinite( firmwareVersion ) &&
			firmwareVersion > 0 && firmwareVersion < 213 || allowLegacyOSPi === true &&
			typeof firmwareVersion === "string" && /ospi/i.test( firmwareVersion ),
		isHashed = !isKnownLegacy;

	return {
		password: isHashed ? hashPassword( password ) : password,
		isHashed: isHashed,
		fwv: firmwareVersion
	};
};

// Run one version-selected password check. A failed modern check must never be followed by a
// cleartext retry because the controller credential is replayable on every API endpoint.
OSApp.Firmware.verifyPassword = function( firmwareVersion, password, hashPassword, checkPassword, callback, allowLegacyOSPi ) {
	var auth = OSApp.Firmware.getPasswordAuth( firmwareVersion, password, hashPassword, allowLegacyOSPi );

	return checkPassword( auth.password, function( isValid ) {
		callback( isValid === true ? auth : false );
	} );
};

// `/sp` uses both 0 and 1 as successful authentication results across supported firmware.
// Accept only those exact integer codes so malformed response shapes still fail closed.
OSApp.Firmware.isValidPasswordResult = function( data ) {
	return !!data && typeof data === "object" && !Array.isArray( data ) &&
		Number.isSafeInteger( data.result ) && ( data.result === 0 || data.result === 1 );
};

OSApp.Firmware.isValidFirmwareVersion = function( value ) {
	return typeof value === "number" && Number.isSafeInteger( value ) && value > 0 && value <= 9999 ||
		typeof value === "string" && value.length > 0 && value.length <= 64 &&
		/^[A-Za-z0-9][A-Za-z0-9._+ -]*$/.test( value ) && /ospi/i.test( value );
};

// A rejected /jo request deliberately returns only firmware metadata. `wl` is present in the
// authenticated options object across supported JSON firmware and is the established sentinel.
OSApp.Firmware.isFullOptionsResponse = function( options ) {
	return !!options && typeof options === "object" && !Array.isArray( options ) &&
		OSApp.Firmware.isValidFirmwareVersion( options.fwv ) &&
		typeof options.wl === "number" && Number.isFinite( options.wl );
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
	var hash, separator,
		json = {},
		hashes = url.slice( url.indexOf( "?" ) + 1 ).split( "&" );

	for ( var i = 0; i < hashes.length; i++ ) {
		separator = hashes[ i ].indexOf( "=" );
		hash = separator === -1 ? [ hashes[ i ], "" ] : [ hashes[ i ].slice( 0, separator ), hashes[ i ].slice( separator + 1 ) ];
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

// Fork build tag (kars85 firmware fork) exposed as the string option `fwf` in /jo, e.g. "kars85.3".
// Returns a guarded suffix (" +kars85.3"); official firmware omits fwf, so this yields "".
OSApp.Firmware.getForkTag = function() {
	var o = OSApp.currentSession.controller.options;
	return ( typeof o === "object" && typeof o.fwf === "string" && o.fwf ) ? " +" + o.fwf : "";
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

// GitHub release metadata is remote input. Only expose changelog links that resolve to the
// canonical HTTPS GitHub origin; all other values are treated as unavailable.
OSApp.Firmware.getAllowedChangelogUrl = function( candidate ) {
	if ( typeof candidate !== "string" ) {
		return "";
	}

	try {
		var url = new URL( candidate );
		return url.protocol === "https:" && url.hostname.toLowerCase() === "github.com" && url.port === "" &&
			!url.username && !url.password ? url.href : "";
	} catch {
		return "";
	}
};

// Build the update prompt with DOM APIs so neither GitHub metadata nor controller-supplied
// version/fork text can become markup or attributes.
OSApp.Firmware.createFirmwareUpdatePopup = function( release, canUpdate ) {
	var popup = document.createElement( "div" ),
		latest = document.createElement( "h3" ),
		controller = document.createElement( "h5" ),
		changelog = OSApp.Firmware.getAllowedChangelogUrl( release && release.html_url ),
		appendAction = function( className, label, href ) {
			var action = document.createElement( "a" );
			action.className = className + " ui-btn ui-corner-all ui-shadow";
			action.setAttribute( "style", "width:80%;margin:5px auto;" );
			action.setAttribute( "href", href );
			action.textContent = label;
			popup.appendChild( action );
			return action;
		};

	popup.setAttribute( "data-role", "popup" );
	popup.setAttribute( "data-theme", "a" );
	popup.className = "modal";

	latest.className = "center";
	latest.setAttribute( "style", "margin-bottom:0" );
	latest.textContent = OSApp.Language._( "Latest" ) + " " + OSApp.Language._( "Firmware" ) + ": " +
		String( release && typeof release.name !== "undefined" ? release.name : "" );
	popup.appendChild( latest );

	controller.className = "center";
	controller.setAttribute( "style", "margin:0" );
	controller.textContent = OSApp.Language._( "This Controller" ) + ": " + OSApp.Firmware.getOSVersion() +
		OSApp.Firmware.getOSMinorVersion() + OSApp.Firmware.getForkTag();
	popup.appendChild( controller );

	if ( changelog ) {
		var changelogAction = appendAction( "changelog iab", OSApp.Language._( "View Changelog" ), changelog );
		changelogAction.setAttribute( "target", "_blank" );
		changelogAction.setAttribute( "rel", "noopener noreferrer" );
	}

	appendAction( "guide", OSApp.Language._( "Update Guide" ), "#" );
	if ( canUpdate ) {
		appendAction( "update", OSApp.Language._( "Update Now" ), "#" );
	}
	appendAction( "dismiss ui-btn-b", OSApp.Language._( "Dismiss" ), "#" );

	return $( popup );
};

OSApp.Firmware.createControllerUpdateLink = function( prefix, ip ) {
	var address = OSApp.Sites.normalizeSiteAddress( ip );

	if ( ( prefix !== "http://" && prefix !== "https://" ) || !address ) {
		return $();
	}
	return $( "<a>" ).addClass( "hidden iab" ).attr( "href", prefix + address + "/update" );
};

OSApp.Firmware.normalizeRelease = function( candidate ) {
	if ( !candidate || typeof candidate !== "object" || Array.isArray( candidate ) ||
		typeof candidate.tag_name !== "string" || candidate.tag_name.length > 64 ) return null;
	var tag = candidate.tag_name.trim(),
		match = /^v?(\d)\.(\d)\.(\d)(?:\((\d{1,2})\))?$/.exec( tag ),
		version;
	if ( match ) {
		if ( match[ 4 ] && Number( match[ 4 ] ) > 9 ) return null;
		version = Number( match[ 1 ] ) * 100 + Number( match[ 2 ] ) * 10 + Number( match[ 3 ] ) +
			( match[ 4 ] ? Number( match[ 4 ] ) / 10 : 0 );
	} else if ( ( match = /^v?(\d{3,4})(?:\((\d{1,2})\))?$/.exec( tag ) ) ) {
		if ( match[ 2 ] && Number( match[ 2 ] ) > 9 ) return null;
		version = Number( match[ 1 ] ) + ( match[ 2 ] ? Number( match[ 2 ] ) / 10 : 0 );
	} else if ( /^\d{1,4}(?:\.\d)?$/.test( tag ) ) {
		version = Number( tag );
	}
	if ( !Number.isFinite( version ) || version <= 0 || version > 9999 ) return null;
	return {
		tag_name: tag,
		name: typeof candidate.name === "string" ? candidate.name.slice( 0, 256 ) : tag,
		html_url: OSApp.Firmware.getAllowedChangelogUrl( candidate.html_url ),
		version: version
	};
};

OSApp.Firmware.selectStableRelease = function( releases ) {
	if ( !Array.isArray( releases ) ) return null;
	for ( var i = 0; i < releases.length; i++ ) {
		if ( !releases[ i ] || releases[ i ].draft === true || releases[ i ].prerelease === true ) continue;
		var release = OSApp.Firmware.normalizeRelease( releases[ i ] );
		if ( release ) return release;
	}
	return null;
};

OSApp.Firmware.checkFirmwareUpdate = function() {
	var options = OSApp.currentSession.controller && OSApp.currentSession.controller.options,
		generation = OSApp.currentSession.generation || 0,
		endpoint = String( OSApp.currentSession.token || "" ) + "|" +
			String( OSApp.currentSession.prefix || "" ) + String( OSApp.currentSession.ip || "" ),
		controller = options && options.fwv,
		hardware = Number( OSApp.Firmware.getHWVersion() ),
		isActive = function() {
			return generation === ( OSApp.currentSession.generation || 0 ) &&
				endpoint === String( OSApp.currentSession.token || "" ) + "|" +
					String( OSApp.currentSession.prefix || "" ) + String( OSApp.currentSession.ip || "" );
		};

	// Update checks are only available for supported Arduino firmware/hardware.
	if ( !options || !OSApp.Firmware.checkOSVersion( 200 ) || !Number.isFinite( hardware ) || hardware < 3 ) return;
	if ( options.fwm ) controller += options.fwm / 10;

	$.getJSON( "https://api.github.com/repos/opensprinkler/opensprinkler-firmware/releases" ).done( function( data ) {
		var release = OSApp.Firmware.selectStableRelease( data );
		if ( !isActive() || !release || typeof controller !== "number" || !Number.isFinite( controller ) ||
			controller >= release.version ) return;

		OSApp.Storage.get( "updateDismiss", function( flag ) {
			if ( !isActive() || flag.updateDismiss === release.tag_name ) return;
			OSApp.Notifications.addNotification( {
				title: OSApp.Language._( "Firmware update available" ),
				on: function() {
					if ( !isActive() ) return false;
					var button = $( this ).parent(),
						canUpdate = options.hwv === 30 ? !OSApp.currentSession.token &&
							!!OSApp.Sites.normalizeSiteAddress( OSApp.currentSession.ip ) :
							options.hwv > 63 && OSApp.Firmware.checkOSVersion( 216 ),
						popup = OSApp.Firmware.createFirmwareUpdatePopup( release, canUpdate ),
						updateFirmware = function() {
							if ( !isActive() ) return false;
							var updateButton = popup.find( ".update" );
							updateButton.off( "click", updateFirmware ).addClass( "ui-disabled" )
								.attr( "aria-disabled", "true" );
							if ( options.hwv === 30 ) {
								OSApp.Firmware.createControllerUpdateLink( OSApp.currentSession.prefix, OSApp.currentSession.ip )
									.appendTo( popup ).click();
								return false;
							}
							OSApp.Firmware.sendToOS( "/cv?pw=&update=1", "json" ).then( function() {
								if ( !isActive() ) return;
								OSApp.Errors.showError( OSApp.Language._( "Update successful" ) );
								popup.find( ".dismiss" ).click();
							}, function( error ) {
								if ( !isActive() || error && ( error.statusText === "abort" ||
									error.statusText === "stale-session" ) ) return;
								updateButton.removeClass( "ui-disabled" ).removeAttr( "aria-disabled" )
									.on( "click", updateFirmware );
								OSApp.Errors.showError( OSApp.Language._( "Update did not complete." ), 3000 );
							} );
							return false;
						};

					popup.find( ".update" ).on( "click", updateFirmware );

					popup.find( ".guide" ).on( "click", function() {
						var url = options.hwv > 63 ?
							"https://openthings.freshdesk.com/support/solutions/articles/5000631599-installing-and-updating-the-unified-firmware#upgrade" :
							"https://openthings.freshdesk.com/support/solutions/articles/5000381694-opensprinkler-firmware-update-guide";
						$( "<a>" ).addClass( "hidden iab" ).attr( "href", url ).appendTo( popup ).click();
					} );

					popup.find( ".dismiss" ).one( "click", function() {
						if ( isActive() ) OSApp.Storage.set( { updateDismiss:release.tag_name } );
						popup.popup( "close" );
						OSApp.Notifications.removeNotification( button );
						return false;
					} );
					OSApp.UIDom.openPopup( popup );
				}
			} );
		} );
	} );
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

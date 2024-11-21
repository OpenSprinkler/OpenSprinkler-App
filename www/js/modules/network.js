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
OSApp.Network = OSApp.Network || {};

// Wrapper function to communicate with OpenSprinkler
OSApp.Network.sendToOS = ( dest, type ) => {

	// Inject password into the request
	dest = dest.replace( "pw=", "pw=" + encodeURIComponent( OSApp.currentSession.pass ) );
	type = type || "text";

	// Designate AJAX queue based on command type
	var isChange = /\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|up|cm)/.exec( dest ),
		queue = isChange ? "change" : "default",

		// Use POST when sending data to the controller (requires firmware 2.1.8 or newer)
		usePOST = ( isChange && OSApp.Network.checkOSVersion( 300 ) ),
		urlDest = usePOST ? dest.split( "?" )[ 0 ] : dest,
		obj = {
			url: OSApp.currentSession.token ? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + urlDest : OSApp.currentSession.prefix + OSApp.currentSession.ip + urlDest,
			type: usePOST ? "POST" : "GET",
			data: usePOST ? OSApp.Network.getUrlVars( dest ) : null,
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

	defer = $.ajaxq( queue, obj ).then(
		function( data ) {

			// In case the data type was incorrect, attempt to fix.
			// If fix not possible, return string
			if ( typeof data === "string" ) {
				try {
					data = $.parseJSON( data );
				} catch ( e ) {
					return data;
				}
			}

			// Don't need to handle this situation for OSPi or firmware below 2.1.0
			if ( typeof data !== "object" || typeof data.result !== "number" ) {
				return data;
			}

			// Return as successful
			if ( data.result === 1 ) {
				return data;

			// Handle incorrect password
			} else if ( data.result === 2 ) {
				if ( /\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|up|cm)/.exec( dest ) ) {
					OSApp.Errors.showError( OSApp.Language._( "Check device password and try again." ) );
				}

				// Tell subsequent handlers this request has failed (use 401 to prevent retry)
				return $.Deferred().reject( { "status":401 } );

			// Handle page not found by triggering fail
			} else if ( data.result === 32 ) {

				return $.Deferred().reject( { "status":404 } );
			}

			// Only show error messages on setting change requests
			if ( /\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|up|cm)/.exec( dest ) ) {
				if ( data.result === 48 ) {
					OSApp.Errors.showError(
						OSApp.Language._( "The selected station is already running or is scheduled to run." )
					);
				} else {
					OSApp.Errors.showError( OSApp.Language._( "Please check input and try again." ) );
				}

				// Tell subsequent handlers this request has failed
				return $.Deferred().reject( data );
			}

		},
		function( e ) {
			if ( ( e.statusText === "timeout" || e.status === 0 ) && /\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|cm)/.exec( dest ) ) {

				// Handle the connection timing out but only show error on setting change
				OSApp.Errors.showError( OSApp.Language._( "Connection timed-out. Please try again." ) );
			} else if ( e.status === 401 ) {

				//Handle unauthorized requests
				OSApp.Errors.showError( OSApp.Language._( "Check device password and try again." ) );
			}
			return;
		}
	);

	return defer;
};

// OpenSprinkler feature detection functions
OSApp.Network.checkOSVersion = ( check ) => {
	var version = OSApp.currentSession.controller.options.fwv;

	// If check is 4 digits then we need to include the minor version number as well
	if ( check >= 1000 ) {
		if ( isNaN( OSApp.currentSession.controller.options.fwm ) ) {
			return false;
		} else {
			version = version * 10 + OSApp.currentSession.controller.options.fwm;
		}
	}

	if ( OSApp.Network.isOSPi() ) {
		return false;
	} else {
		if ( check === version ) {
			return true;
		} else {
			return OSApp.Network.versionCompare( version.toString().split( "" ), check.toString().split( "" ) );
		}
	}
};

OSApp.Network.isOSPi = () => {
	if ( OSApp.currentSession.controller &&
		typeof OSApp.currentSession.controller.options === "object" &&
		typeof OSApp.currentSession.controller.options.fwv === "string" &&
		OSApp.currentSession.controller.options.fwv.search( /ospi/i ) !== -1 ) {

		return true;
	}
	return false;
};

OSApp.Network.versionCompare = ( ver, check ) => {

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

OSApp.Network.getUrlVars = ( url ) => {
	var hash,
		json = {},
		hashes = url.slice( url.indexOf( "?" ) + 1 ).split( "&" );

	for ( var i = 0; i < hashes.length; i++ ) {
		hash = hashes[ i ].split( "=" );
		json[ hash[ 0 ] ] = decodeURIComponent( hash[ 1 ].replace( /\+/g, "%20" ) );
	}
	return json;
};

OSApp.Network.checkOSPiVersion = ( check ) => {
	var ver;

	if ( OSApp.Network.isOSPi() ) {
		ver = OSApp.currentSession.controller.options.fwv.split( "-" )[ 0 ];
		if ( ver !== check ) {
			ver = ver.split( "." );
			check = check.split( "." );
			return OSApp.Network.versionCompare( ver, check );
		} else {
			return true;
		}
	} else {
		return false;
	}
}

OSApp.Network.getOSVersion = ( fwv ) => {
	if ( !fwv && typeof OSApp.currentSession.controller.options === "object" ) {
		fwv = OSApp.currentSession.controller.options.fwv;
	}
	if ( typeof fwv === "string" && fwv.search( /ospi/i ) !== -1 ) {
		return fwv;
	} else {
		return ( fwv / 100 >> 0 ) + "." + ( ( fwv / 10 >> 0 ) % 10 ) + "." + ( fwv % 10 );
	}
};

OSApp.Network.getOSMinorVersion = () => {
	if ( !OSApp.Network.isOSPi() && typeof OSApp.currentSession.controller.options === "object" && typeof OSApp.currentSession.controller.options.fwm === "number" && OSApp.currentSession.controller.options.fwm > 0 ) {
		return " (" + OSApp.currentSession.controller.options.fwm + ")";
	}
	return "";
};

OSApp.Network.getHWVersion = ( hwv ) => {
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

OSApp.Network.getHWType = () => {
	if ( OSApp.Network.isOSPi() || typeof OSApp.currentSession.controller.options.hwt !== "number" || OSApp.currentSession.controller.options.hwt === 0 ) {
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
}

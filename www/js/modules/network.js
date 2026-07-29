/* global $, networkinterface, sjcl, md5 */

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
OSApp.Network.deviceIPRequestEpoch = OSApp.Network.deviceIPRequestEpoch || 0;

// Automatic device detection functions
OSApp.Network.updateDeviceIP = function( finishCheck ) {
	var requestEpoch = ++OSApp.Network.deviceIPRequestEpoch,
		sessionGeneration = OSApp.currentSession.generation || 0,
		isCurrent = function() {
			return requestEpoch === OSApp.Network.deviceIPRequestEpoch &&
				sessionGeneration === ( OSApp.currentSession.generation || 0 );
		},
		finish = function( result ) {
		if ( !isCurrent() ) return false;
		OSApp.currentDevice.deviceIp = result;

		if ( typeof finishCheck === "function" ) {
			finishCheck( result );
		}
		return true;
	},
	ip;

	try {

		// Request the device's IP address
		networkinterface.getWiFiIPAddress( function( data ) {
			ip = data && typeof data.ip === "string" ? data.ip : undefined;
			finish( ip );
		} );
		//eslint-disable-next-line no-unused-vars
	} catch ( err ) {
		OSApp.Network.findRouter( function( status, data ) {
			finish( !status ? undefined : data );
		} );
	}
};

OSApp.Network.isLocalIP = function( ip ) {
	if ( typeof ip !== "string" || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test( ip ) ) {
		return false;
	}
	var chk = OSApp.Utils.parseIntArray( ip.split( "." ) );
	if ( chk.some( function( octet ) { return !Number.isInteger( octet ) || octet < 0 || octet > 255; } ) ) {
		return false;
	}

	// Check if the IP is on a private network, if not don't enable automatic scanning
	return ( chk[ 0 ] === 10 || chk[ 0 ] === 127 || ( chk[ 0 ] === 172 && chk[ 1 ] >= 16 && chk[ 1 ] <= 31 ) || ( chk[ 0 ] === 192 && chk[ 1 ] === 168 ) );
};

OSApp.Network.normalizeScannedFirmwareVersion = function( value ) {
	return OSApp.Firmware.isValidFirmwareVersion( value ) ? value : null;
};

// Scan replies are unauthenticated controller input. Build their result rows through DOM APIs
// so a forged firmware label cannot introduce markup or event-handler attributes.
OSApp.Network.createScanResult = function( ip, firmwareVersion ) {
	var address = OSApp.Sites.normalizeSiteAddress( ip ),
		version = OSApp.Network.normalizeScannedFirmwareVersion( firmwareVersion ),
		item, link, description;

	if ( !address || address !== ip || version === null ) {
		return $();
	}

	item = $( "<li>" );
	link = $( "<a>" ).addClass( "ui-btn ui-btn-icon-right ui-icon-carat-r" )
		.attr( "href", "#" ).attr( "data-ip", address ).appendTo( item );
	link.append( document.createTextNode( address ) );
	description = $( "<p>" ).text( OSApp.Language._( "Firmware" ) + ": " + OSApp.Firmware.getOSVersion( version ) );
	link.append( description );
	return item;
};

OSApp.Network.startScan = function( port, type ) {

	/*
		The type represents the OpenSprinkler model as defined below
		0 - OpenSprinkler using firmware 2.0+
		1 - OpenSprinkler Pi (Python) using 1.9+
		2 - OpenSprinkler using firmware 1.8.3
		3 - OpenSprinkler Pi (Python) using 1.8.3
	*/

	if ( !OSApp.Network.isLocalIP( OSApp.currentDevice.deviceIp ) ) {
		OSApp.Errors.showError( OSApp.Language._( "A valid private IPv4 address is required to scan the local network." ) );
		return false;
	}

	type = typeof type === "undefined" ? 0 : type;
	port = typeof port === "undefined" ? 80 : port;
	if ( !Number.isSafeInteger( type ) || type < 0 || type > 3 ||
		!Number.isSafeInteger( port ) || port < 1 || port > 65535 ) {
		OSApp.Errors.showError( OSApp.Language._( "Invalid scan settings." ) );
		return false;
	}

	if ( OSApp.Network.activeScan && typeof OSApp.Network.activeScan.cancel === "function" ) {
		OSApp.Network.activeScan.cancel();
	}

	var ipParts = OSApp.currentDevice.deviceIp.split( "." ),
		baseip, text,
		scan = {
			active:true,
			loaderOwned:false,
			requests:[],
			completed:0,
			nextHost:1,
			inFlight:0,
			oldips:[],
			found:{},
			results:[]
		},
		isActive = function() {
			return scan.active && OSApp.Network.activeScan === scan;
		},
		cleanup = function() {
			if ( !scan.active ) return;
			scan.active = false;
			scan.requests.forEach( function( request ) {
				if ( request && typeof request.abort === "function" ) request.abort();
			} );
			scan.requests = [];
			if ( OSApp.Network.activeScan === scan ) {
				OSApp.Network.activeScan = null;
				if ( scan.loaderOwned ) $.mobile.loading( "hide" );
			}
			scan.loaderOwned = false;
		},
		finish = function() {
			if ( !isActive() || scan.completed !== 244 ) return;
			var results = scan.results;
			cleanup();
			if ( !results.length ) {
				if ( type === 0 ) OSApp.Network.startScan( 8080, 1 );
				else if ( type === 1 ) OSApp.Network.startScan( 80, 2 );
				else if ( type === 2 ) OSApp.Network.startScan( 8080, 3 );
				else OSApp.Errors.showError( OSApp.Language._( "No new devices were detected on your network" ) );
				return;
			}

			var list = $( results );
			list.find( "a" ).on( "click", function() {
				OSApp.Sites.addFound( $( this ).data( "ip" ) );
				return false;
			} );
			OSApp.Sites.showSiteSelect( list );
		},
		handleReply = function( reply, address, dataType ) {
			if ( !isActive() || scan.oldips.indexOf( address ) !== -1 || scan.found[ address ] ) return;
			var fwv, tmp;
			if ( dataType === "text" ) {
				if ( typeof reply !== "string" ) return;
				tmp = reply.match( /var\s*ver=(\d+)/ );
				if ( !tmp ) return;
				fwv = Number( tmp[ 1 ] );
			} else {
				if ( !reply || typeof reply !== "object" || Array.isArray( reply ) ||
					!Object.prototype.hasOwnProperty.call( reply, "fwv" ) ) return;
				fwv = reply.fwv;
			}
			var result = OSApp.Network.createScanResult( address, fwv );
			if ( !result.length ) return;
			scan.found[ address ] = true;
			scan.results.push( result[ 0 ] );
		},
		launchNext = function() {
			if ( !isActive() ) return;
			while ( scan.inFlight < OSApp.Network.SCAN_CONCURRENCY && scan.nextHost <= 244 ) {
				( function( address ) {
					var endpoint = address + ( port !== 80 ? ":" + port : "" ),
						dataType = type < 2 ? "json" : "text",
						suffix = type < 2 ? "/jo" : "",
						url = "http://" + endpoint + suffix,
						request = $.ajax( {
							url:url,
							type:"GET",
							dataType:dataType,
							timeout:6000,
							global:false
						} );
					scan.inFlight++;
					scan.requests.push( request );
					request.done( function( reply ) { handleReply( reply, endpoint, dataType ); } )
						.always( function() {
							if ( !isActive() ) return;
							var index = scan.requests.indexOf( request );
							if ( index !== -1 ) scan.requests.splice( index, 1 );
							scan.inFlight--;
							scan.completed++;
							launchNext();
							finish();
						} );
				} )( baseip + "." + scan.nextHost++ );
			}
		};

	scan.cancel = cleanup;
	OSApp.Network.activeScan = scan;
	ipParts.pop();
	baseip = ipParts.join( "." );

	if ( type === 0 ) {
		text = OSApp.Language._( "Scanning for OpenSprinkler" );
	} else if ( type === 1 ) {
		text = OSApp.Language._( "Scanning for OpenSprinkler Pi" );
	} else if ( type === 2 ) {
		text = OSApp.Language._( "Scanning for OpenSprinkler (1.8.3)" );
	} else if ( type === 3 ) {
		text = OSApp.Language._( "Scanning for OpenSprinkler Pi (1.8.3)" );
	}

	OSApp.Storage.get( "sites", function( data ) {
		if ( !isActive() ) return;
		var oldsites = OSApp.Sites.parseSites( data.sites );
		Object.keys( oldsites ).forEach( function( name ) {
			if ( typeof oldsites[ name ].os_ip === "string" ) scan.oldips.push( oldsites[ name ].os_ip );
		} );

		$.mobile.loading( "show", {
			html: "<h1>" + text + "</h1><p class='cancel tight center inline-icon'>" +
				"<span class='btn-no-border ui-btn ui-icon-delete ui-btn-icon-notext'></span>" + OSApp.Language._( "Cancel" ) + "</p>",
			textVisible: true,
			theme: "b"
		} );
		scan.loaderOwned = true;
		$( ".ui-loader" ).find( ".cancel" ).one( "click", cleanup );

		launchNext();
	} );
	return scan;
};

OSApp.Network.SCAN_CONCURRENCY = 12;

OSApp.Network.findRouter = function( callback ) {
	callback = callback || function() {};

	var routerIPs = [ "192.168.1.1", "10.0.1.1", "192.168.1.220", "192.168.2.1", "10.1.1.1", "192.168.11.1", "192.168.0.1",
					"192.168.0.30", "192.168.0.50", "192.168.10.1", "192.168.20.1", "192.168.30.1", "192.168.62.1", "192.168.102.1",
					"192.168.1.254", "192.168.0.227", "10.0.0.138", "192.168.123.254", "192.168.4.1", "10.0.0.2", "10.0.2.1",
					"10.0.3.1", "10.0.4.1", "10.0.5.1" ],
		total = routerIPs.length,
		scanprogress = 0,
		reply = function( status, ip ) {
			scanprogress++;
			if ( status === true ) {
				routerFound = ip;
			}
		},
		checkScanStatus = function() {
			if ( scanprogress === total || typeof routerFound === "string" ) {
				clearInterval( scanning );
				if ( typeof routerFound === "string" ) {
					callback( true, routerFound );
				} else {
					callback( false );
				}
			}
		},
		scanning, routerFound, i;

	for ( i = 0; i < total; i++ ) {
		if ( typeof routerFound !== "string" ) {
			OSApp.Network.ping( routerIPs[ i ], reply );
		}
	}

	scanning = setInterval( checkScanStatus, 50 );
};

OSApp.Network.ping = function( ip, callback ) {
	callback = callback || function() {};

	if ( !ip || ip === "" ) {
		callback( false );
		return null;
	}

	return $.ajax( {
		url: "http://" + ip,	// TODO: extend this to support https ping?
		type: "GET",
		timeout: 6000,
		global: false
	} ).then(
		function() {
			callback( true, ip );
		},
		function( e ) {
			if ( e.statusText === "timeout" ) {
				callback( false );
			} else {
				callback( true, ip );
			}
		}
	);
};

OSApp.Network.checkPublicAccess = function( eip ) {

	// Check if the device is accessible from it's public IP

	if ( eip === 0 ) {
		return;
	}

	if ( OSApp.currentSession.token ) {
		return;
	}

	var generation = OSApp.currentSession.generation || 0,
		session = {
			ip: OSApp.currentSession.ip,
			prefix: OSApp.currentSession.prefix,
			pass: OSApp.currentSession.pass,
			auth: OSApp.currentSession.auth,
			authUser: OSApp.currentSession.authUser,
			authPass: OSApp.currentSession.authPass,
			fwv: OSApp.currentSession.controller.options.fwv,
			ip4: OSApp.currentSession.controller.options.ip4
		},
		isCurrent = function() {
			return generation === ( OSApp.currentSession.generation || 0 ) && session.ip === OSApp.currentSession.ip &&
				session.prefix === OSApp.currentSession.prefix && session.pass === OSApp.currentSession.pass;
		},
		ip = OSApp.Network.intToIP( eip ),
		controllerUrl, controllerHost, port, path,
		fail = function() {
			if ( !isCurrent() ) return;
			OSApp.Storage.get( "ignoreRemoteFailed", function( data ) {
				if ( isCurrent() && data.ignoreRemoteFailed !== "1" ) {

					// Unable to access the device using it's public IP
					OSApp.Notifications.addNotification( {
						title: OSApp.Language._( "Remote access is not enabled" ),
						desc: OSApp.Language._( "Click here to troubleshoot remote access issues" ),
						on: function() {
							window.open( "https://openthings.freshdesk.com/support/solutions/articles/5000569763",
								"_blank", "location=" + ( OSApp.currentDevice.isAndroid ? "yes" : "no" ) +
								",enableViewportScale=yes,toolbarposition=top,closebuttoncaption=" + OSApp.Language._( "Back" )
							);

							return false;
						},
						off: function() {
							OSApp.Storage.set( { "ignoreRemoteFailed": "1" } );
							return true;
						}
					} );
				}
			} );
		};

	try {
		controllerUrl = new URL( session.prefix + session.ip );
		controllerHost = controllerUrl.hostname.replace( /^\[|\]$/g, "" );
		port = controllerUrl.port ? Number( controllerUrl.port ) : ( controllerUrl.protocol === "https:" ? 443 : 80 );
		path = controllerUrl.pathname.replace( /\/+$/, "" );
	} catch ( error ) { // eslint-disable-line no-unused-vars
		return;
	}
	if ( !Number.isInteger( port ) || port < 1 || port > 65535 || ip === controllerHost ||
		OSApp.Network.isLocalIP( ip ) || !OSApp.Network.isLocalIP( controllerHost ) ) {
		return;
	}

	$.ajax( {
		url: session.prefix + ip + ":" + port + path + "/jo?pw=" + encodeURIComponent( session.pass ),
		global: false,
		dataType: "json",
		type: "GET",
		beforeSend: function( xhr ) {
			if ( session.auth ) {
				var header = OSApp.Utils.getBasicAuthHeader( session.authUser, session.authPass );
				if ( header ) xhr.setRequestHeader( "Authorization", header );
			}
		}
	} ).then(
		function( data ) {
			if ( !isCurrent() ) return;
			if ( !OSApp.Firmware.isFullOptionsResponse( data ) || data.fwv !== session.fwv ||
				( typeof session.fwv === "number" && session.fwv >= 214 && session.ip4 !== data.ip4 ) ) {
					fail();
					return;
			}

			// Public IP worked, update device IP to use the public IP instead
			// OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
			// 	var sites = OSApp.Sites.parseSites( data.sites ),
			// 		current = data.current_site;

			// 	sites[ current ].os_ip = ip + ( port === 80 ? "" : ":" + port );

			// 	OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
			// } );
		},
		fail
	);
};

OSApp.Network.addSyncStatus = function( token ) {
	var ele = $( "<div class='ui-bar smaller ui-bar-a ui-corner-all logged-in-alert'>" +
			"<div class='inline ui-btn ui-icon-recycle btn-no-border ui-btn-icon-notext ui-mini'></div>" +
			"<div class='inline syncStatus'>" + OSApp.Language._( "Synced with OpenSprinkler.com" ) + " (" +
				OSApp.Utils.htmlEscape( OSApp.Network.getTokenUser( token ) ) + ")</div>" +
			"<div class='inline ui-btn ui-icon-delete btn-no-border ui-btn-icon-notext ui-mini logout'></div>" +
		"</div>" );

	ele.find( ".logout" ).on( "click", OSApp.Network.logout );
	ele.find( ".ui-icon-recycle" ).on( "click", function() {
		var btn = $( this );

		btn.addClass( "spin" );
		OSApp.Network.cloudSync( function() {
			btn.removeClass( "spin" );
		} );
	} );
	return ele;
};

OSApp.Network.cloudAuthEpoch = OSApp.Network.cloudAuthEpoch || 0;

OSApp.Network.bumpCloudAuthEpoch = function() {
	OSApp.Network.cloudAuthEpoch++;
	return OSApp.Network.cloudAuthEpoch;
};

OSApp.Network.isCloudAuthCurrent = function( token, epoch, callback ) {
	if ( epoch !== OSApp.Network.cloudAuthEpoch ) {
		callback( false );
		return;
	}
	OSApp.Storage.get( "cloudToken", function( current ) {
		callback( epoch === OSApp.Network.cloudAuthEpoch && current.cloudToken === token );
	} );
};

OSApp.Network.requestCloudAuth = function( callback ) {
	callback = callback || function() {};

	var popup = $( "<div data-role='popup' class='modal' id='requestCloudAuth' data-theme='a'>" +
				"<ul data-role='listview' data-inset='true'>" +
					"<li data-role='list-divider'>" + OSApp.Language._( "OpenSprinkler.com Login" ) + "</li>" +
					"<li><p class='rain-desc tight'>" +
						OSApp.Language._( "Use your OpenSprinkler.com login and password to securely sync sites between all your devices." ) +
						"<br><br>" +
						OSApp.Language._( "Don't have an account?" ) + " <a href='https://opensprinkler.com/my-account/' class='iab'>" +
						OSApp.Language._( "Register here" ) + "</a>" +
					"</p></li>" +
					"<li>" +
						"<form method='post' novalidate>" +
							"<label for='cloudUser'>" + OSApp.Language._( "Username:" ) + "</label>" +
							"<input type='text' name='cloudUser' id='cloudUser' autocomplete='off' autocorrect='off' autocapitalize='off' " +
								"spellcheck='false'>" +
							"<label for='cloudPass'>" + OSApp.Language._( "Password:" ) + "</label>" +
							"<input type='password' name='cloudPass' id='cloudPass'>" +
							"<input type='submit' value='" + OSApp.Language._( "Submit" ) + "'>" +
						"</form>" +
					"</li>" +
				"</ul>" +
		"</div>" ),
			didSucceed = false,
			active = true,
			pending = false,
			attemptId = 0,
			request,
			loaderOwned = false;

	popup.find( "form" ).on( "submit", function() {
		if ( pending || !active ) return false;
		pending = true;
		attemptId++;
		var currentAttempt = attemptId,
			submit = popup.find( "input[type='submit']" );
		submit.prop( "disabled", true );
		loaderOwned = true;
		$.mobile.loading( "show" );
		request = OSApp.Network.cloudLogin( popup.find( "#cloudUser" ).val(), popup.find( "#cloudPass" ).val(), function( result ) {
			if ( !active || currentAttempt !== attemptId ) return;
			pending = false;
			submit.prop( "disabled", false );
			loaderOwned = false;
			$.mobile.loading( "hide" );
			if ( result === false ) {
				OSApp.Errors.showError( OSApp.Language._( "Invalid username/password combination. Please try again." ) );
				return;
			} else {
				didSucceed = true;
				popup.popup( "close" );
			}
		}, function() { return active && currentAttempt === attemptId; } );
		return false;
	} );

	popup.one( "popupafterclose", function() {
		active = false;
		attemptId++;
		if ( request && typeof request.abort === "function" ) request.abort();
		if ( loaderOwned ) $.mobile.loading( "hide" );
		callback( didSucceed );
		if ( didSucceed ) {
			OSApp.Network.cloudSyncStart();
		}
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.Network.cloudLogin = function( user, pass, callback, isCurrent ) {
	callback = callback || function() {};
	isCurrent = typeof isCurrent === "function" ? isCurrent : function() { return true; };
	var authEpoch = OSApp.Network.bumpCloudAuthEpoch();

	return $.ajax( {
		type: "POST",
		dataType: "json",
		url: "https://opensprinkler.com/wp-admin/admin-ajax.php",
		data: {
			action: "ajaxLogin",
			username: user,
			password: pass
		},
		success: function( data ) {
			if ( !isCurrent() || authEpoch !== OSApp.Network.cloudAuthEpoch ) return;
			if ( !data || typeof data !== "object" || Array.isArray( data ) || data.loggedin !== true ||
				typeof data.token !== "string" || !data.token || data.token.length > 8192 ) {
				callback( false );
				return;
			}
			var dataToken;
			try {
				dataToken = sjcl.codec.hex.fromBits( sjcl.hash.sha256.hash( String( pass ) ) );
			} catch ( error ) { // eslint-disable-line no-unused-vars
				callback( false );
				return;
			}
			if ( !isCurrent() || authEpoch !== OSApp.Network.cloudAuthEpoch ) return;
			OSApp.Storage.set( { cloudToken: data.token, cloudDataToken: dataToken }, function() {
				if ( isCurrent() && authEpoch === OSApp.Network.cloudAuthEpoch ) callback( true );
			} );
		},
		error: function() {
			if ( isCurrent() && authEpoch === OSApp.Network.cloudAuthEpoch ) callback( false );
		}
	} );
};

OSApp.Network.cloudSaveState = OSApp.Network.cloudSaveState || { inFlight: false, pending: [] };

OSApp.Network.flushCloudSaveSites = function() {
	var state = OSApp.Network.cloudSaveState;
	if ( state.inFlight || !state.pending.length ) return;
	state.inFlight = true;
	var callbacks = state.pending.splice( 0 ),
		finish = function( result, message ) {
			state.inFlight = false;
			callbacks.forEach( function( callback ) {
				try {
					callback( result, message );
				} catch ( error ) {
					console.error( "Cloud save callback failed", error );
				}
			} );
			OSApp.Network.flushCloudSaveSites();
		};

	OSApp.Storage.get( [ "cloudToken", "cloudDataToken", "sites" ], function( local ) {
		var authEpoch = OSApp.Network.cloudAuthEpoch;
		if ( typeof local.cloudToken !== "string" || !local.cloudToken || local.cloudToken.length > 8192 ||
			typeof local.cloudDataToken !== "string" || !local.cloudDataToken || local.cloudDataToken.length > 8192 ||
			typeof local.sites !== "string" || local.sites.length > 8 * 1024 * 1024 ) {
			finish( false );
			return;
		}
		var encrypted;
		try {
			encrypted = encodeURIComponent( JSON.stringify( sjcl.encrypt( local.cloudDataToken, local.sites ) ) );
		} catch ( error ) { // eslint-disable-line no-unused-vars
			finish( false );
			return;
		}

		$.ajax( {
			type: "POST",
			dataType: "json",
			url: "https://opensprinkler.com/wp-admin/admin-ajax.php",
			data: { action: "saveSites", token: local.cloudToken, sites: encrypted },
			success: function( response ) {
				OSApp.Network.isCloudAuthCurrent( local.cloudToken, authEpoch, function( current ) {
					if ( !current ) {
						finish( false, "STALE_TOKEN" );
						return;
					}
					if ( !response || typeof response !== "object" || Array.isArray( response ) || response.success !== true ) {
						if ( response && response.message === "BAD_TOKEN" ) OSApp.Network.handleExpiredLogin();
						finish( false, response && response.message );
						return;
					}
					if ( typeof response.token === "string" && response.token ) {
						OSApp.Network.bumpCloudAuthEpoch();
						OSApp.Storage.set( { cloudToken: response.token }, function() { finish( true ); } );
					} else {
						finish( true );
					}
				} );
			},
			error: function() { finish( false ); }
		} );
	} );
};

OSApp.Network.cloudSaveSites = function( callback ) {
	OSApp.Network.cloudSaveState.pending.push( typeof callback === "function" ? callback : function() {} );
	OSApp.Network.flushCloudSaveSites();
};

OSApp.Network.cloudGetSites = function( callback ) {
	callback = callback || function() {};

	OSApp.Storage.get( [ "cloudToken", "cloudDataToken" ], function( local ) {
		var authEpoch = OSApp.Network.cloudAuthEpoch;
		if ( typeof local.cloudToken !== "string" || !local.cloudToken || local.cloudToken.length > 8192 ) {
			callback( false );
			return;
		}

		if ( typeof local.cloudDataToken !== "string" || !local.cloudDataToken || local.cloudDataToken.length > 8192 ) {
			OSApp.Network.handleInvalidDataToken();
			callback( false );
			return;
		}

		$.ajax( {
			type: "POST",
			dataType: "json",
			url: "https://opensprinkler.com/wp-admin/admin-ajax.php",
			data: {
				action: "getSites",
				token: local.cloudToken
			},
			success: function( data ) {
				OSApp.Network.isCloudAuthCurrent( local.cloudToken, authEpoch, function( current ) {
					if ( !current ) {
						callback( false, "STALE_TOKEN" );
						return;
					}
					if ( !data || typeof data !== "object" || Array.isArray( data ) || data.success !== true ||
						typeof data.sites !== "string" || !data.sites || data.sites.length > 8 * 1024 * 1024 ) {
						if ( data && data.message === "BAD_TOKEN" ) OSApp.Network.handleExpiredLogin();
						callback( false, data && data.message );
						return;
					}

					var sites;
					try {
						sites = sjcl.decrypt( local.cloudDataToken, data.sites );
					} catch ( err ) {
						if ( err && err.message === "ccm: tag doesn't match" ) OSApp.Network.handleInvalidDataToken();
						callback( false );
						return;
					}
					if ( typeof sites !== "string" || sites.length > 8 * 1024 * 1024 ) {
						callback( false );
						return;
					}
					var parsed = OSApp.Sites.parseSitesStrict( sites );
					if ( parsed === null ) {
						callback( false, "INVALID_SITES" );
						return;
					}
					if ( typeof data.token === "string" && data.token ) {
						var rotatedEpoch = OSApp.Network.bumpCloudAuthEpoch();
						OSApp.Storage.set( { cloudToken:data.token }, function() {
							callback( parsed, undefined, { token:data.token, epoch:rotatedEpoch } );
						} );
					} else {
						callback( parsed, undefined, { token:local.cloudToken, epoch:authEpoch } );
					}
				} );
			},
			error: function() {
				OSApp.Network.isCloudAuthCurrent( local.cloudToken, authEpoch, function( current ) {
					callback( false, current ? undefined : "STALE_TOKEN" );
				} );
			}
		} );
	} );
};

OSApp.Network.cloudSyncStartSequence = OSApp.Network.cloudSyncStartSequence || 0;

OSApp.Network.cloudSyncStart = function() {
	var operationId = ++OSApp.Network.cloudSyncStartSequence;
	OSApp.Network.cloudGetSites( function( sites, message, authContext ) {
		authContext = authContext || { epoch:OSApp.Network.cloudAuthEpoch };
		var isCurrent = function() {
			return operationId === OSApp.Network.cloudSyncStartSequence &&
				authContext.epoch === OSApp.Network.cloudAuthEpoch;
		};
		if ( sites === false || !isCurrent() ) {
			if ( isCurrent() ) OSApp.UIDom.updateLoginButtons();
			return;
		}

		var page = $( ".ui-page-active" ).attr( "id" );
		if ( page === "start" ) {
			if ( Object.keys( sites ).length > 0 ) OSApp.Storage.set( { sites:JSON.stringify( sites ) } );
			if ( isCurrent() ) OSApp.UIDom.changePage( "#site-control" );
			return;
		}

		OSApp.UIDom.updateLoginButtons();
		OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
			if ( !isCurrent() ) return;
			var localSites = OSApp.Sites.parseSites( data.sites ),
				siteNames = Object.keys( sites ),
				hasCurrent = !!data.current_site && Object.prototype.hasOwnProperty.call( sites, data.current_site );
			if ( JSON.stringify( sites ) === data.sites && ( hasCurrent || !siteNames.length && !data.current_site ) ) {
				OSApp.Sites.updateSiteList( siteNames.sort(), data.current_site );
				return;
			}
			var localName = data.current_site && Object.prototype.hasOwnProperty.call( localSites, data.current_site ) ?
					data.current_site : Object.keys( localSites ).find( function( name ) {
						return localSites[ name ] && !localSites[ name ].os_token &&
							OSApp.Sites.normalizeSiteAddress( localSites[ name ].os_ip ) ===
							OSApp.Sites.normalizeSiteAddress( OSApp.currentSession.ip );
					} ),
				commitSites = function( selectedSites, preferredCurrent ) {
					if ( !isCurrent() ) return;
					var names = Object.keys( selectedSites ).sort(),
						oldCurrent = data.current_site,
						nextCurrent = preferredCurrent && Object.prototype.hasOwnProperty.call( selectedSites, preferredCurrent ) ?
							preferredCurrent : oldCurrent && Object.prototype.hasOwnProperty.call( selectedSites, oldCurrent ) ?
								oldCurrent : names[ 0 ],
						changed = nextCurrent !== oldCurrent || nextCurrent &&
							JSON.stringify( localSites[ oldCurrent ] ) !== JSON.stringify( selectedSites[ nextCurrent ] ),
						stored = { sites:JSON.stringify( selectedSites ) };
					if ( nextCurrent ) stored.current_site = nextCurrent;
					if ( changed ) OSApp.Sites.invalidateCurrentSession( false );
					OSApp.Storage.set( stored, function() {
						var finish = function() {
							if ( !isCurrent() ) return;
							OSApp.Network.cloudSaveSites();
							OSApp.Sites.updateSiteList( names, nextCurrent );
							if ( nextCurrent && changed ) OSApp.Sites.checkConfigured();
							else $( "html" ).trigger( "siterefresh" );
						};
						if ( nextCurrent ) finish();
						else OSApp.Storage.remove( "current_site", finish );
					} );
				};

			if ( OSApp.currentSession.local ) {
				OSApp.Sites.findLocalSiteName( sites, function( result ) {
					if ( !isCurrent() ) return;
					if ( result !== false ) {
						commitSites( sites, result );
						return;
					}
					OSApp.UIDom.areYouSure(
						OSApp.Language._( "Do you wish to add this location to your cloud synced site list?" ),
						OSApp.Language._( "This site is not found in the currently synced site list but may be added now." ),
						function() {
							if ( !isCurrent() || !localName || !localSites[ localName ] ) {
								OSApp.Errors.showError( OSApp.Language._( "Unable to find the local site record." ) );
								return;
							}
							var addedName = localName, suffix = 2;
							while ( Object.prototype.hasOwnProperty.call( sites, addedName ) ) addedName = localName + " " + suffix++;
							sites[ addedName ] = localSites[ localName ];
							commitSites( sites, addedName );
						},
						function() {
							if ( !isCurrent() ) return;
							OSApp.Network.bumpCloudAuthEpoch();
							OSApp.Storage.remove( "cloudToken", () => OSApp.UIDom.updateLoginButtons() );
						}
					);
				} );
				return;
			}

			if ( Object.keys( sites ).length === 0 ) {
				OSApp.Network.cloudSaveSites();
				return;
			}
			var popup = $(
				"<div data-role='popup' data-theme='a' data-overlay-theme='b'>" +
					"<div class='ui-bar ui-bar-a'>" + OSApp.Language._( "Select Merge Method" ) + "</div>" +
					"<div data-role='controlgroup' class='tight'>" +
						"<button class='merge'>" + OSApp.Language._( "Merge" ) + "</button>" +
						"<button class='replaceLocal'>" + OSApp.Language._( "Replace local with cloud" ) + "</button>" +
						"<button class='replaceCloud'>" + OSApp.Language._( "Replace cloud with local" ) + "</button>" +
					"</div>" +
				"</div>" ),
				finish = function( selectedSites ) {
					if ( !isCurrent() ) {
						popup.popup( "close" );
						return;
					}
					commitSites( selectedSites );
					popup.popup( "close" );
				};
			popup.find( ".merge" ).on( "click", function() { finish( $.extend( {}, localSites, sites ) ); } );
			popup.find( ".replaceLocal" ).on( "click", function() { finish( sites ); } );
			popup.find( ".replaceCloud" ).on( "click", function() { finish( localSites ); } );
			popup.one( "popupafterclose", function() {
				popup.popup( "destroy" ).remove();
			} ).popup( { history:false, "positionTo":"window" } ).enhanceWithin().popup( "open" );
		} );
	} );
};

OSApp.Network.cloudSyncState = OSApp.Network.cloudSyncState || { nextId:0, active:null };

OSApp.Network.cloudSync = function( callback ) {
	callback = callback || function() {};
	var state = OSApp.Network.cloudSyncState,
		previous = state.active;

	var operation = { id:++state.nextId, settled:false },
		isCurrent = function() {
			return state.active === operation && !operation.settled;
		},
		finish = function( result ) {
			if ( operation.settled ) return;
			operation.settled = true;
			if ( state.active === operation ) state.active = null;
			callback( result );
		},
		invalidateSession = function( clear ) {
			OSApp.Sites.invalidateCurrentSession( clear === false ? false : true );
		};
	operation.finish = finish;
	state.active = operation;
	if ( previous && typeof previous.finish === "function" ) previous.finish( false );

	OSApp.Storage.get( "cloudToken", function( initial ) {
		if ( !isCurrent() ) return;
		if ( typeof initial.cloudToken !== "string" || !initial.cloudToken ) {
			finish( false );
			return;
		}

		OSApp.Network.cloudGetSites( function( data ) {
			if ( !isCurrent() ) return;
			if ( data === false ) {
				finish( false );
				return;
			}

				OSApp.Storage.get( [ "sites", "current_site", "cloudToken" ], function( fresh ) {
					if ( !isCurrent() ) return;
					if ( typeof fresh.cloudToken !== "string" || !fresh.cloudToken ) {
						finish( false );
						return;
					}

				var localSites = OSApp.Sites.parseSites( fresh.sites ),
					names = Object.keys( data ).sort(),
					oldCurrent = fresh.current_site,
					nextCurrent = oldCurrent && Object.prototype.hasOwnProperty.call( data, oldCurrent ) ?
						oldCurrent : names[ 0 ],
					currentRecordChanged = !!nextCurrent && ( nextCurrent !== oldCurrent ||
						JSON.stringify( localSites[ oldCurrent ] ) !== JSON.stringify( data[ nextCurrent ] ) ),
					serialized = JSON.stringify( data ),
					commit = function() {
						if ( !isCurrent() ) return;
						OSApp.Sites.updateSiteList( names, nextCurrent );
						if ( nextCurrent ) {
							if ( currentRecordChanged ) OSApp.Sites.checkConfigured();
							else $( "html" ).trigger( "siterefresh" );
						} else {
							invalidateSession( true );
							$( "html" ).trigger( "siterefresh" );
							if ( $( ".ui-page-active" ).attr( "id" ) !== "site-control" ) {
								OSApp.UIDom.changePage( "#site-control" );
							}
						}
						finish( true );
					};

				if ( serialized === JSON.stringify( localSites ) && nextCurrent === oldCurrent ) {
					OSApp.Sites.updateSiteList( names, nextCurrent );
					finish( true );
					return;
				}

				if ( currentRecordChanged ) invalidateSession( false );
				var stored = { sites:serialized };
				if ( nextCurrent ) stored.current_site = nextCurrent;
				OSApp.Storage.set( stored, function() {
					if ( nextCurrent ) {
						commit();
					} else {
						OSApp.Storage.remove( "current_site", commit );
					}
				} );
			} );
		} );
	} );
};

OSApp.Network.getTokenUser = function( token ) {
	if ( typeof token !== "string" || !token || token.length > 8192 ) return OSApp.Language._( "Unknown" );
	try {
		var decoded = atob( token ),
			separator = decoded.indexOf( "|" ),
			user = separator > 0 ? decoded.slice( 0, separator ) : "",
			hasControl = user.split( "" ).some( function( character ) {
				var code = character.charCodeAt( 0 );
				return code < 32 || code === 127;
			} );
		return user && user.length <= 256 && !hasControl ? user : OSApp.Language._( "Unknown" );
	} catch ( error ) { // eslint-disable-line no-unused-vars
		return OSApp.Language._( "Unknown" );
	}
};

OSApp.Network.handleExpiredLogin = function() {
	OSApp.Network.bumpCloudAuthEpoch();
	OSApp.Storage.remove( [ "cloudToken" ], () => OSApp.UIDom.updateLoginButtons() );

	OSApp.Notifications.addNotification( {
		title: OSApp.Language._( "OpenSprinkler.com Login Expired" ),
		desc: OSApp.Language._( "Click here to re-login to OpenSprinkler.com" ),
		on: function() {
			var button = $( this ).parent();

			OSApp.Network.requestCloudAuth( function( result ) {
				OSApp.Notifications.removeNotification( button );

				if ( result === true ) {
					OSApp.UIDom.updateLoginButtons();
					OSApp.Network.cloudSync();
				}
			} );

			return false;
		}
	} );
};

OSApp.Network.handleInvalidDataToken = function() {
	OSApp.Network.bumpCloudAuthEpoch();
	OSApp.Storage.remove( [ "cloudDataToken" ] );

	OSApp.Notifications.addNotification( {
		title: OSApp.Language._( "Unable to read cloud data" ),
		desc: OSApp.Language._( "Click here to enter a valid password to decrypt the data" ),
		on: function() {
			var button = $( this ).parent(),
				popup = $(
					"<div data-role='popup' data-theme='a' class='modal ui-content' id='dataPassword'>" +
						"<p class='tight rain-desc'>" +
							OSApp.Language._( "Please enter your OpenSprinkler.com password. If you have recently changed your password, you may need to enter your previous password to decrypt the data." ) +
						"</p>" +
						"<form>" +
							"<input type='password' id='dataPasswordInput' name='dataPasswordInput' placeholder='" + OSApp.Language._( "Password" ) + "' />" +
							"<input type='submit' data-theme='b' value='" + OSApp.Language._( "Submit" ) + "' />" +
						"</form>" +
					"</div>"
				),
				didSubmit = false;

			//Bind submit
			popup.find( "form" ).on( "submit", function() {
				OSApp.Notifications.removeNotification( button );
				didSubmit = true;
				OSApp.Storage.set( {
					"cloudDataToken": sjcl.codec.hex.fromBits( sjcl.hash.sha256.hash( popup.find( "#dataPasswordInput" ).val() ) )
				}, function() {
					popup.popup( "close" );
				} );

				return false;
			} );

			popup.one( "popupafterclose", function() {
				if ( didSubmit === true ) {
					OSApp.Network.cloudSync();
				}
			} );

			OSApp.UIDom.openPopup( popup );
			return false;
		}
	} );
};

OSApp.Network.intToIP = function( eip ) {
	return ( ( eip >> 24 ) & 255 ) + "." + ( ( eip >> 16 ) & 255 ) + "." + ( ( eip >> 8 ) & 255 ) + "." + ( eip & 255 );
};

// Device password management functions
OSApp.Network.verifySitePassword = function( site, password, allowLegacy, callback ) {
	if ( typeof allowLegacy === "function" ) {
		callback = allowLegacy;
		allowLegacy = site && site.legacyAuth === true;
	}
	callback = callback || function() {};

	var firmwareVersion = OSApp.Sites.getSiteFirmwareVersion( site ),
		checkPassword = function( pass, done ) {
			return OSApp.Network.checkPW( pass, done, site );
		};

	if ( typeof firmwareVersion === "number" && firmwareVersion >= 213 ) {
		return OSApp.Firmware.verifyPassword( firmwareVersion, password, md5, checkPassword, callback );
	}
	if ( typeof firmwareVersion === "string" ) {
		if ( allowLegacy === true || site.legacyAuth === true ) {
			return OSApp.Firmware.verifyPassword( firmwareVersion, password, md5, checkPassword, callback, true );
		}
		var ospiAuth = OSApp.Firmware.getPasswordAuth( undefined, password, md5 );
		ospiAuth.fwv = firmwareVersion;
		return checkPassword( ospiAuth.password, function( isValid ) {
			callback( isValid === true ? ospiAuth : false );
		} );
	}
	if ( typeof firmwareVersion === "number" && firmwareVersion < 213 &&
		( allowLegacy === true || site.legacyAuth === true ) ) {
		return OSApp.Firmware.verifyPassword( firmwareVersion, password, md5, checkPassword, callback );
	}
	if ( firmwareVersion === undefined && ( allowLegacy === true || site && site.legacyAuth === true ) ) {
		return OSApp.Firmware.verifyPassword( 212, password, md5, checkPassword, callback );
	}

	// Existing saved sites may predate firmware metadata. Discovery remains hash-only: an
	// unauthenticated old version response is not authority to transmit a replayable clear password.
	var discoveryAuth = OSApp.Firmware.getPasswordAuth( undefined, password, md5 );
	return OSApp.Network.checkOptionsPW( discoveryAuth.password, function( options ) {
		if ( OSApp.Firmware.isFullOptionsResponse( options ) &&
			( typeof options.fwv === "string" || options.fwv >= 213 ) ) {
			site.fwv = options.fwv;
			site.isHashed = true;
			delete site.legacyAuth;
			callback( discoveryAuth );
			return;
		}
		callback( false );
	}, site );
};

OSApp.Network.changePassword = function( opt ) {
	var defaults = {
			fixIncorrect: false,
			name: "",
			callback: function() {},
			cancel: function() {}
		};

	opt = $.extend( {}, defaults, opt );

	var isPi = OSApp.Firmware.isOSPi(),
		didSubmit = false,
		verificationPending = false,
		mutationPending = false,
		active = true,
		loaderOwned = false,
		activeRequest,
		generation = OSApp.currentSession.generation || 0,
		controller = OSApp.currentSession.controller,
		endpoint = String( OSApp.currentSession.prefix || "" ) + String( OSApp.currentSession.ip || "" ),
		token = OSApp.currentSession.token,
		siteName = opt.name || $( "#site-selector" ).val(),
		popup = $( "<div data-role='popup' class='modal' id='changePassword' data-theme='a' data-overlay-theme='b'>" +
				"<ul data-role='listview' data-inset='true'>" +
					( opt.fixIncorrect === true ? "" : "<li data-role='list-divider'>" + OSApp.Language._( "Change Password" ) + "</li>" ) +
					"<li>" +
						( opt.fixIncorrect === true ? "<p class='rain-desc red-text bold'>" + OSApp.Language._( "Incorrect password for " ) +
							OSApp.Utils.htmlEscape( opt.name ) + ". " + OSApp.Language._( "Please re-enter password to try again." ) + "</p>" : "" ) +
						"<form method='post' novalidate>" +
							"<label for='npw'>" + ( opt.fixIncorrect === true ? OSApp.Language._( "Password:" ) : OSApp.Language._( "New Password" ) + ":" ) + "</label>" +
							"<input type='password' name='npw' id='npw' value=''" + ( isPi ? "" : " maxlength='32'" ) + ">" +
							( opt.fixIncorrect === true ? "" : "<label for='cpw'>" + OSApp.Language._( "Confirm New Password" ) + ":</label>" +
							"<input type='password' name='cpw' id='cpw' value=''" + ( isPi ? "" : " maxlength='32'" ) + ">" ) +
							( opt.fixIncorrect === true ? "<label for='save_pw'>" + OSApp.Language._( "Save Password" ) + "</label>" +
							"<input type='checkbox' data-wrapper-class='save_pw' name='save_pw' id='save_pw' data-mini='true'>" +
							"<label for='legacy_auth'>" + OSApp.Language._( "Legacy firmware (pre-2.1.3; sends password without hashing)" ) + "</label>" +
							"<input type='checkbox' name='legacy_auth' id='legacy_auth' data-mini='true'>" : "" ) +
							"<input type='submit' value='" + OSApp.Language._( "Submit" ) + "'>" +
						"</form>" +
					"</li>" +
				"</ul>" +
				"</div>" ),
		isSessionCurrent = function() {
			return generation === ( OSApp.currentSession.generation || 0 ) &&
				endpoint === String( OSApp.currentSession.prefix || "" ) + String( OSApp.currentSession.ip || "" ) &&
				token === OSApp.currentSession.token;
		},
		isActive = function() {
			return active && isSessionCurrent();
		},
		persistVerifiedPassword = function( auth, savePassword, onSuccess ) {
			if ( !isActive() ) return;
			OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
				var sites = OSApp.Sites.parseSites( data.sites ),
					site = sites[ opt.name ];
				if ( !isActive() ) return;
				if ( data.current_site !== opt.name || !site ) {
					verificationPending = false;
					OSApp.Errors.showError( OSApp.Language._( "Unable to find site. Please try again." ) );
					return;
				}

				site.os_pw = savePassword ? auth.password : "";
				site.isHashed = auth.isHashed;
				if ( auth.isHashed ) {
					delete site.legacyAuth;
				} else {
					site.legacyAuth = true;
				}
				OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, function() {
					OSApp.Network.cloudSaveSites();
					if ( !isActive() ) return;
					OSApp.currentSession.pass = auth.password;
					didSubmit = true;
					verificationPending = false;
					onSuccess();
				} );
			} );
		};

	popup.find( "form" ).on( "submit", function() {
		var npw = popup.find( "#npw" ).val(),
			cpw = popup.find( "#cpw" ).val();

		if ( opt.fixIncorrect === true ) {
			if ( verificationPending ) {
				return false;
			}
			verificationPending = true;

			var savePassword = popup.find( "#save_pw" ).is( ":checked" ),
				allowLegacy = popup.find( "#legacy_auth" ).is( ":checked" );
			OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
				var sites = OSApp.Sites.parseSites( data.sites ),
					site = sites[ opt.name ];

				if ( !isActive() ) return;

				if ( data.current_site !== opt.name || !site ) {
					verificationPending = false;
					OSApp.Errors.showError( OSApp.Language._( "Unable to find site. Please try again." ) );
					return;
				}

				activeRequest = OSApp.Network.verifySitePassword( site, npw, allowLegacy, function( auth ) {
					if ( !isActive() ) return;
					verificationPending = false;
					if ( auth ) {
						persistVerifiedPassword( auth, savePassword, function() {
							popup.popup( "close" );
							opt.callback();
						} );
					} else {
						OSApp.Errors.showError( OSApp.Language._( "Check device password and try again." ) );
					}
				} );
			} );

			return false;
		}

		if ( npw !== cpw ) {
			OSApp.Errors.showError( OSApp.Language._( "The passwords don't match. Please try again." ) );
			return false;
		}

		if ( npw === "" ) {
			OSApp.Errors.showError( OSApp.Language._( "Password cannot be empty" ) );
			return false;
		}

		if ( !isPi && npw.length > 32 ) {
			OSApp.Errors.showError( OSApp.Language._( "Password cannot be longer than 32 characters" ) );
			return false;
		}

		if ( mutationPending ) return false;
		var firmwareVersion = controller.options && controller.options.fwv,
			newPasswordAuth = OSApp.Firmware.getPasswordAuth( firmwareVersion, npw, md5, isPi );
		npw = newPasswordAuth.password;
		cpw = newPasswordAuth.password;

		$.mobile.loading( "show" );
		loaderOwned = true;
		mutationPending = true;
		popup.find( "input[type='submit']" ).prop( "disabled", true );
		var targetSiteName = siteName;
		activeRequest = OSApp.Firmware.sendToOS( "/sp?pw=&npw=" + encodeURIComponent( npw ) + "&cpw=" + encodeURIComponent( cpw ), "json" ).done( function( info ) {
			if ( !isActive() ) {
				mutationPending = false;
				return;
			}
			$.mobile.loading( "hide" );
			loaderOwned = false;
			var result = info && typeof info === "object" && !Array.isArray( info ) ? info.result : undefined;

			if ( result !== 1 ) {
				mutationPending = false;
				popup.find( "input[type='submit']" ).prop( "disabled", false );
				if ( result === 2 ) {
					OSApp.Errors.showError( OSApp.Language._( "Please check the current device password is correct then try again" ) );
				} else {
					OSApp.Errors.showError( OSApp.Language._( "Unable to change password. Please try again." ) );
				}
			} else {
				didSubmit = true;
				OSApp.currentSession.pass = npw;
				OSApp.Storage.get( "sites", function( data ) {
					var sites = OSApp.Sites.parseSites( data.sites ),
						site = sites[ targetSiteName ],
						options = controller.options;
					if ( data.current_site !== targetSiteName || !site ) {
						mutationPending = false;
						if ( isActive() ) {
							OSApp.Errors.showError( OSApp.Language._( "Password changed on the controller, but the site record could not be saved. Please reconnect using the new password." ), 5000 );
							popup.popup( "close" );
						}
						return;
					}

					site.os_pw = npw;
					site.isHashed = newPasswordAuth.isHashed;
					if ( newPasswordAuth.isHashed ) {
						delete site.legacyAuth;
					} else {
						site.legacyAuth = true;
					}
					if ( options && OSApp.Firmware.isValidFirmwareVersion( options.fwv ) ) {
						site.fwv = options.fwv;
					}
					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, function() {
						OSApp.Network.cloudSaveSites();
						mutationPending = false;
						if ( !isActive() ) return;
						popup.popup( "close" );
						OSApp.Errors.showError( OSApp.Language._( "Password changed successfully" ) );
					} );
				} );
			}
				} ).fail( function( error ) {
					mutationPending = false;
					if ( !isActive() ) return;
					popup.find( "input[type='submit']" ).prop( "disabled", false );
					OSApp.Firmware.settleLoadingFailure( error );
					if ( !error || error.statusText !== "abort" && error.statusText !== "stale-session" ) loaderOwned = false;
				} );

		return false;
	} );

	popup.on( "popupbeforeclose", function( event ) {
		if ( mutationPending ) {
			event.preventDefault();
			return false;
		}
	} ).one( "popupafterclose", function() {
		var wasCurrent = isActive();
		active = false;
		if ( activeRequest && typeof activeRequest.abort === "function" ) activeRequest.abort();
		if ( wasCurrent && loaderOwned ) {
			loaderOwned = false;
			$.mobile.loading( "hide" );
		}
		if ( document.activeElement && typeof document.activeElement.blur === "function" ) document.activeElement.blur();
		popup.remove();
		if ( opt.fixIncorrect && !didSubmit ) {
			opt.cancel();
		}
	} ).popup().enhanceWithin();

	if ( opt.fixIncorrect ) {

		// Safely migrate a mistakenly saved modern cleartext password. Unknown firmware also uses
		// the MD5-only policy; cleartext is only attempted after numeric legacy metadata is known.
		OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
			var sites = OSApp.Sites.parseSites( data.sites ),
				current = data.current_site,
				site = sites[ current ],
				auth = site && OSApp.Sites.prepareStoredSitePassword( site );
			if ( !isActive() ) return;

			if ( current === opt.name && site && site.os_pw && auth.isHashed && !OSApp.Utils.isMD5( site.os_pw ) ) {
				activeRequest = OSApp.Network.checkPW( auth.password, function( result ) {
					if ( !isActive() ) return;
					if ( result === true ) {
						persistVerifiedPassword( auth, true, function() {
							active = false;
							popup.remove();
							opt.callback();
						} );
					} else {
						popup.popup( "open" );
					}
				}, site );
			} else {
				popup.popup( "open" );
			}
		} );
	} else {
		popup.popup( "open" );
	}
};

OSApp.Network.getPasswordProbeContext = function( site ) {
	var hasSiteEndpoint = site && ( typeof site.os_token === "string" && site.os_token ||
			typeof site.os_ip === "string" && site.os_ip ),
		context = {
			generation: OSApp.currentSession.generation || 0,
			sessionBound: !hasSiteEndpoint,
			authEnabled: hasSiteEndpoint ? !site.os_token && typeof site.auth_user !== "undefined" && typeof site.auth_pw !== "undefined" :
				OSApp.currentSession.auth === true,
			token: hasSiteEndpoint ? site.os_token : OSApp.currentSession.token,
			ip: hasSiteEndpoint ? site.os_ip : OSApp.currentSession.ip,
			prefix: hasSiteEndpoint ? ( site.ssl === "1" ? "https://" : "http://" ) : OSApp.currentSession.prefix,
			authUser: hasSiteEndpoint ? site.auth_user : OSApp.currentSession.authUser,
			authPass: hasSiteEndpoint ? site.auth_pw : OSApp.currentSession.authPass
		};

	context.baseUrl = context.token ? "https://cloud.openthings.io/forward/v1/" + context.token :
		context.prefix + context.ip;
	return context;
};

OSApp.Network.isPasswordProbeCurrent = function( context ) {
	return context.generation === ( OSApp.currentSession.generation || 0 ) && ( !context.sessionBound ||
		context.token === OSApp.currentSession.token && context.ip === OSApp.currentSession.ip &&
		context.prefix === OSApp.currentSession.prefix && context.authEnabled === ( OSApp.currentSession.auth === true ) &&
		context.authUser === OSApp.currentSession.authUser &&
		context.authPass === OSApp.currentSession.authPass );
};

OSApp.Network.addPasswordProbeAuth = function( context, xhr ) {
	if ( !context.authEnabled || typeof context.authUser === "undefined" || typeof context.authPass === "undefined" ) return;
	var header = OSApp.Utils.getBasicAuthHeader( context.authUser, context.authPass );
	if ( header ) xhr.setRequestHeader( "Authorization", header );
};

OSApp.Network.checkOptionsPW = function( pass, callback, site ) {
	callback = callback || function() {};
	var urlDest = "/jo?pw=" + encodeURIComponent( pass ),
		context = OSApp.Network.getPasswordProbeContext( site ),
		request = $.ajax( {
		url: context.baseUrl + urlDest,
		cache: false,
		crossDomain: true,
		type: "GET",
		dataType: "json",
		timeout: 10000,
		beforeSend: function( xhr ) {
			OSApp.Network.addPasswordProbeAuth( context, xhr );
		}
	} );
	request.then(
		function( options ) {
			if ( OSApp.Network.isPasswordProbeCurrent( context ) ) callback( options );
		},
		function() {
			if ( OSApp.Network.isPasswordProbeCurrent( context ) ) callback( false );
		}
	);
	return request;
};

// Check if password is valid
OSApp.Network.checkPW = function( pass, callback, site ) {
	callback = callback || function() {};

	var urlDest = "/sp?pw=" + encodeURIComponent( pass ) + "&npw=" + encodeURIComponent( pass ) + "&cpw=" + encodeURIComponent( pass ),
		context = OSApp.Network.getPasswordProbeContext( site ),
		request = $.ajax( {

		url: context.baseUrl + urlDest,
		cache: false,
		crossDomain: true,
		type: "GET",
		timeout: 10000,
		beforeSend: function( xhr ) {
			OSApp.Network.addPasswordProbeAuth( context, xhr );
		}
	} );
	request.then(
		function( data ) {
			if ( OSApp.Network.isPasswordProbeCurrent( context ) ) {
				callback( !!data && typeof data === "object" && !Array.isArray( data ) && data.result === 1 );
			}
		},
		function() {
			if ( OSApp.Network.isPasswordProbeCurrent( context ) ) callback( false );
		}
	);
	return request;
};

OSApp.Network.getWiFiRating = function( rssi ) {
	var rating = "";

	if ( rssi < -80 ) {
		rating = OSApp.Language._( "Unusable" );
	} else if ( rssi < -70 ) {
		rating = OSApp.Language._( "Poor" );
	} else if ( rssi < -60 ) {
		rating = OSApp.Language._( "Fair" );
	} else if ( rssi < -50 ) {
		rating = OSApp.Language._( "Good" );
	} else {
		rating = OSApp.Language._( "Excellent" );
	}

	return Math.round( rssi ) + "dBm (" + rating + ")";
};

OSApp.Network.networkFail = function() {
	OSApp.Status.changeStatus( 0, "red", "<p class='running-text center'>" + OSApp.Language._( "Network Error" ) + "</p>",
		function() {
			OSApp.UIDom.showLoading( "#weather,#footer-running" );
			OSApp.Status.refreshStatus();
			OSApp.Weather.updateWeather();
		}
	);
};

OSApp.Network.logout = function( success ) {
	if ( typeof success !== "function" ) {
		success = function() {};
	}

	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to logout?" ), "", function() {
		OSApp.Network.bumpCloudAuthEpoch();
		if ( OSApp.currentSession.local ) {
			OSApp.Storage.remove( [ "sites", "current_site", "lang", "provider", "wapikey", "runonce", "cloudToken" ], function() {
				location.reload();
			} );
		} else {
			OSApp.Storage.remove( [ "cloudToken" ], function() {
				OSApp.UIDom.updateLoginButtons();
				success();
			} );
		}
	} );
};

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

// Automatic device detection functions
OSApp.Network.updateDeviceIP = function( finishCheck ) {
	var finish = function( result ) {
		OSApp.currentDevice.deviceIp = result;

		if ( typeof finishCheck === "function" ) {
			finishCheck( result );
		}
	},
	ip;

	try {

		// Request the device's IP address
		networkinterface.getWiFiIPAddress( function( data ) {
			ip = data.ip;
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
	var chk = OSApp.Utils.parseIntArray( ip.split( "." ) );

	// Check if the IP is on a private network, if not don't enable automatic scanning
	return ( chk[ 0 ] === 10 || chk[ 0 ] === 127 || ( chk[ 0 ] === 172 && chk[ 1 ] > 17 && chk[ 1 ] < 32 ) || ( chk[ 0 ] === 192 && chk[ 1 ] === 168 ) );
};

OSApp.Network.startScan = function( port, type ) {

	/*
		The type represents the OpenSprinkler model as defined below
		0 - OpenSprinkler using firmware 2.0+
		1 - OpenSprinkler Pi (Python) using 1.9+
		2 - OpenSprinkler using firmware 1.8.3
		3 - OpenSprinkler Pi (Python) using 1.8.3
	*/

	var ip = OSApp.currentDevice.deviceIp.split( "." ),
		scanprogress = 1,
		devicesfound = 0,
		newlist = "",
		suffix = "",
		oldips = [],
		isCanceled = false,
		i, url, notfound, found, baseip, checkScanStatus, scanning, dtype, text;

	type = type || 0;
	port = ( typeof port === "number" ) ? port : 80;

	OSApp.Storage.get( "sites", function( data ) {
		var oldsites = OSApp.Sites.parseSites( data.sites ),
			i;

		for ( i in oldsites ) {
			if ( Object.prototype.hasOwnProperty.call(oldsites,  i ) ) {
				oldips.push( oldsites[ i ].os_ip );
			}
		}
	} );

	notfound = function() {
		scanprogress++;
	};

	found = function( reply ) {
		scanprogress++;
		var ip = $.mobile.path.parseUrl( this.url ).authority,
			fwv, tmp;

		if ( $.inArray( ip, oldips ) !== -1 ) {
			return;
		}

		if ( this.dataType === "text" ) {
			tmp = reply.match( /var\s*ver=(\d+)/ );
			if ( !tmp ) {
				return;
			}
			fwv = tmp[ 1 ];
		} else {
			if ( !Object.prototype.hasOwnProperty.call(reply,  "fwv" ) ) {
				return;
			}
			fwv = reply.fwv;
		}

		devicesfound++;

		newlist += "<li><a class='ui-btn ui-btn-icon-right ui-icon-carat-r' href='#' data-ip='" + ip + "'>" + ip +
				"<p>" + OSApp.Language._( "Firmware" ) + ": " + OSApp.Firmware.getOSVersion( fwv ) + "</p>" +
			"</a></li>";
	};

	// Check if scanning is complete
	checkScanStatus = function() {
		if ( isCanceled === true ) {
			$.mobile.loading( "hide" );
			clearInterval( scanning );
			return false;
		}

		if ( scanprogress === 245 ) {
			$.mobile.loading( "hide" );
			clearInterval( scanning );
			if ( !devicesfound ) {
				if ( type === 0 ) {
					OSApp.Network.startScan( 8080, 1 );

				} else if ( type === 1 ) {
					OSApp.Network.startScan( 80, 2 );

				} else if ( type === 2 ) {
					OSApp.Network.startScan( 8080, 3 );

				} else {
					OSApp.Errors.showError( OSApp.Language._( "No new devices were detected on your network" ) );
				}
			} else {
				newlist = $( newlist );

				newlist.find( "a" ).on( "click", function() {
					OSApp.Sites.addFound( $( this ).data( "ip" ) );
					return false;
				} );

				OSApp.Sites.showSiteSelect( newlist );
			}
		}
	};

	ip.pop();
	baseip = ip.join( "." );

	if ( type === 0 ) {
		text = OSApp.Language._( "Scanning for OpenSprinkler" );
	} else if ( type === 1 ) {
		text = OSApp.Language._( "Scanning for OpenSprinkler Pi" );
	} else if ( type === 2 ) {
		text = OSApp.Language._( "Scanning for OpenSprinkler (1.8.3)" );
	} else if ( type === 3 ) {
		text = OSApp.Language._( "Scanning for OpenSprinkler Pi (1.8.3)" );
	}

	$.mobile.loading( "show", {
		html: "<h1>" + text + "</h1><p class='cancel tight center inline-icon'>" +
			"<span class='btn-no-border ui-btn ui-icon-delete ui-btn-icon-notext'></span>" + OSApp.Language._( "Cancel" ) + "</p>",
		textVisible: true,
		theme: "b"
	} );

	$( ".ui-loader" ).find( ".cancel" ).one( "click", function() {
		isCanceled = true;
	} );

	// Start scan
	for ( i = 1; i <= 244; i++ ) {
		ip = baseip + "." + i;
		if ( type < 2 ) {
			suffix = "/jo";
			dtype = "json";
		} else {
			dtype = "text";
		}
		url = "http://" + ip + ( ( port && port !== 80 ) ? ":" + port : "" ) + suffix;
		$.ajax( {
			url: url,
			type: "GET",
			dataType: dtype,
			timeout: 6000,
			global: false,
			error: notfound,
			success: found
		} );
	}
	scanning = setInterval( checkScanStatus, 200 );
};

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
	}

	$.ajax( {
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

	var ip = OSApp.Network.intToIP( eip ),
		port = OSApp.currentSession.ip.match( /.*:(\d+)/ ),
		fail = function() {
			OSApp.Storage.get( "ignoreRemoteFailed", function( data ) {
				if ( data.ignoreRemoteFailed !== "1" ) {

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

	if ( ip === OSApp.currentSession.ip || OSApp.Network.isLocalIP( ip ) || !OSApp.Network.isLocalIP( OSApp.currentSession.ip ) ) {
		return;
	}

	port = ( port ? parseInt( port[ 1 ] ) : 80 );

	$.ajax( {
		url: OSApp.currentSession.prefix + ip + ":" + port + "/jo?pw=" + OSApp.currentSession.pass,
		global: false,
		dataType: "json",
		type: "GET"
	} ).then(
		function( data ) {
			if ( typeof data !== "object" || !Object.prototype.hasOwnProperty.call(data,  "fwv" ) || data.fwv !== OSApp.currentSession.controller.options.fwv ||
				( OSApp.Firmware.checkOSVersion( 214 ) && OSApp.currentSession.controller.options.ip4 !== data.ip4 ) ) {
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
			"<div class='inline syncStatus'>" + OSApp.Language._( "Synced with OpenSprinkler.com" ) + " (" + OSApp.Network.getTokenUser( token ) + ")</div>" +
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
		didSucceed = false;

	popup.find( "form" ).on( "submit", function() {
		$.mobile.loading( "show" );
		OSApp.Network.cloudLogin( popup.find( "#cloudUser" ).val(), popup.find( "#cloudPass" ).val(), function( result ) {
			if ( result === false ) {
				OSApp.Errors.showError( OSApp.Language._( "Invalid username/password combination. Please try again." ) );
				return;
			} else {
				$.mobile.loading( "hide" );
				didSucceed = true;
				popup.popup( "close" );
			}
		} );
		return false;
	} );

	popup.one( "popupafterclose", function() {
		callback( didSucceed );
		if ( didSucceed ) {
			OSApp.Network.cloudSyncStart();
		}
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.Network.cloudLogin = function( user, pass, callback ) {
	callback = callback || function() {};

	$.ajax( {
		type: "POST",
		dataType: "json",
		url: "https://opensprinkler.com/wp-admin/admin-ajax.php",
		data: {
			action: "ajaxLogin",
			username: user,
			password: pass
		},
		success: function( data ) {
			if ( typeof data.token === "string" ) {
				OSApp.Storage.set( {
					"cloudToken": data.token,
					"cloudDataToken": sjcl.codec.hex.fromBits( sjcl.hash.sha256.hash( pass ) )
				} );
			}
			callback( data.loggedin );
		},
		fail: function() {
			callback( false );
		}
	} );
};

OSApp.Network.cloudSaveSites = function( callback ) {
	callback = callback || function() {};

	OSApp.Storage.get( [ "cloudToken", "cloudDataToken", "sites" ], function( data ) {
		if ( data.cloudToken === null || data.cloudToken === undefined ) {
			callback( false );
			return;
		}

		$.ajax( {
			type: "POST",
			dataType: "json",
			url: "https://opensprinkler.com/wp-admin/admin-ajax.php",
			data: {
				action: "saveSites",
				token: data.cloudToken,
				sites: encodeURIComponent( JSON.stringify( sjcl.encrypt( data.cloudDataToken, data.sites ) ) )
			},
			success: function( data ) {
				if ( data.success === false ) {
					if ( data.message === "BAD_TOKEN" ) {
						OSApp.Network.handleExpiredLogin();
					}
					callback( false, data.message );
				} else {
					OSApp.Storage.set( { "cloudToken":data.token } );
					callback( data.success );
				}
			},
			fail: function() {
				callback( false );
			}
		} );
	} );
};

OSApp.Network.cloudGetSites = function( callback ) {
	callback = callback || function() {};

	OSApp.Storage.get( [ "cloudToken", "cloudDataToken" ], function( local ) {
		if ( local.cloudToken === undefined || local.cloudToken === null ) {
			callback( false );
			return;
		}

		if ( local.cloudDataToken === undefined || local.cloudDataToken === null ) {
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
				if ( data.success === false || data.sites === "" ) {
					if ( data.message === "BAD_TOKEN" ) {
						OSApp.Network.handleExpiredLogin();
					}
					callback( false, data.message );
				} else {
					OSApp.Storage.set( { "cloudToken":data.token } );
					var sites;

					try {
						sites = sjcl.decrypt( local.cloudDataToken, data.sites );
					} catch ( err ) {
						if ( err.message === "ccm: tag doesn't match" ) {
							OSApp.Network.handleInvalidDataToken();
						}
						callback( false );
					}

					try {
						callback( JSON.parse( sites ) );
						//eslint-disable-next-line no-unused-vars
					} catch ( err ) {
						callback( false );
					}
				}
			},
			fail: function() {
				callback( false );
			}
		} );
	} );
};

OSApp.Network.cloudSyncStart = function() {
	OSApp.Network.cloudGetSites( function( sites ) {
		var page = $( ".ui-page-active" ).attr( "id" );

		if ( page === "start" ) {
			if ( Object.keys( sites ).length > 0 ) {
				OSApp.Storage.set( { "sites":JSON.stringify( sites ) } );
			}
			OSApp.UIDom.changePage( "#site-control" );
		} else {
			OSApp.UIDom.updateLoginButtons();

			OSApp.Storage.get( "sites", function( data ) {
				if ( JSON.stringify( sites ) === data.sites ) {
					return;
				}

				data.sites = OSApp.Sites.parseSites( data.sites );

				if ( OSApp.currentSession.local ) {
					OSApp.Sites.findLocalSiteName( sites, function( result ) {

						// Logout if the current site isn't matched in the cloud sites
						if ( result === false ) {
							OSApp.UIDom.areYouSure(
								OSApp.Language._( "Do you wish to add this location to your cloud synced site list?" ),
								OSApp.Language._( "This site is not found in the currently synced site list but may be added now." ),
								function() {
									sites[ OSApp.currentSession.ip ] = data.sites.Local;
									OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
									OSApp.Storage.set( { "current_site": OSApp.currentSession.ip } );
									OSApp.Sites.updateSiteList( Object.keys( sites ), OSApp.currentSession.ip );
								},
								function() {
									OSApp.Storage.remove( "cloudToken", () => OSApp.UIDom.updateLoginButtons() );
								}
							 );
						} else {
							OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
							OSApp.Storage.set( { "current_site": result } );
							OSApp.Sites.updateSiteList( Object.keys( sites ), result );
						}
					} );

					return;
				}

				if ( Object.keys( sites ).length > 0 ) {

					// Handle how to merge when cloud is populated
					var popup = $(
						"<div data-role='popup' data-theme='a' data-overlay-theme='b'>" +
							"<div class='ui-bar ui-bar-a'>" + OSApp.Language._( "Select Merge Method" ) + "</div>" +
							"<div data-role='controlgroup' class='tight'>" +
								"<button class='merge'>" + OSApp.Language._( "Merge" ) + "</button>" +
								"<button class='replaceLocal'>" + OSApp.Language._( "Replace local with cloud" ) + "</button>" +
								"<button class='replaceCloud'>" + OSApp.Language._( "Replace cloud with local" ) + "</button>" +
							"</div>" +
						"</div>" ),
						finish = function() {
							OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
							popup.popup( "close" );

							if ( page === "site-control" ) {
								OSApp.UIDom.changePage( "#site-control" );
							}
						};

					popup.find( ".merge" ).on( "click", function() {
						sites = $.extend( {}, data.sites, sites );
						finish();
					} );

					popup.find( ".replaceLocal" ).on( "click", function() {
						finish();
					} );

					popup.find( ".replaceCloud" ).on( "click", function() {
						sites = data.sites;
						finish();
					} );

					popup.one( "popupafterclose", function() {
						popup.popup( "destroy" ).remove();
					} ).popup( {
						history: false,
						"positionTo": "window"
					} ).enhanceWithin().popup( "open" );
				} else {
					OSApp.Network.cloudSaveSites();
				}
			} );
		}
	} );
};

OSApp.Network.cloudSync = function( callback ) {
	callback = callback || function() {};

	OSApp.Storage.get( [ "cloudToken", "current_site" ], function( local ) {
		if ( typeof local.cloudToken !== "string" ) {
			return;
		}

		OSApp.Network.cloudGetSites( function( data ) {
			if ( data !== false ) {
				OSApp.Storage.set( { "sites":JSON.stringify( data ) }, function() {
					OSApp.Sites.updateSiteList( Object.keys( data ), local.current_site );
					callback();

					$( "html" ).trigger( "siterefresh" );
				} );
			}
		} );
	} );
};

OSApp.Network.getTokenUser = function( token ) {
	return atob( token ).split( "|" )[ 0 ];
};

OSApp.Network.handleExpiredLogin = function() {
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
		popup = $( "<div data-role='popup' class='modal' id='changePassword' data-theme='a' data-overlay-theme='b'>" +
				"<ul data-role='listview' data-inset='true'>" +
					( opt.fixIncorrect === true ? "" : "<li data-role='list-divider'>" + OSApp.Language._( "Change Password" ) + "</li>" ) +
					"<li>" +
						( opt.fixIncorrect === true ? "<p class='rain-desc red-text bold'>" + OSApp.Language._( "Incorrect password for " ) +
							opt.name + ". " + OSApp.Language._( "Please re-enter password to try again." ) + "</p>" : "" ) +
						"<form method='post' novalidate>" +
							"<label for='npw'>" + ( opt.fixIncorrect === true ? OSApp.Language._( "Password:" ) : OSApp.Language._( "New Password" ) + ":" ) + "</label>" +
							"<input type='password' name='npw' id='npw' value=''" + ( isPi ? "" : " maxlength='32'" ) + ">" +
							( opt.fixIncorrect === true ? "" : "<label for='cpw'>" + OSApp.Language._( "Confirm New Password" ) + ":</label>" +
							"<input type='password' name='cpw' id='cpw' value=''" + ( isPi ? "" : " maxlength='32'" ) + ">" ) +
							( opt.fixIncorrect === true ? "<label for='save_pw'>" + OSApp.Language._( "Save Password" ) + "</label>" +
							"<input type='checkbox' data-wrapper-class='save_pw' name='save_pw' id='save_pw' data-mini='true'>" : "" ) +
							"<input type='submit' value='" + OSApp.Language._( "Submit" ) + "'>" +
						"</form>" +
					"</li>" +
				"</ul>" +
		"</div>" );

	popup.find( "form" ).on( "submit", function() {
		var npw = popup.find( "#npw" ).val(),
			cpw = popup.find( "#cpw" ).val();

		if ( opt.fixIncorrect === true ) {
			didSubmit = true;

			OSApp.Storage.get( [ "sites" ], function( data ) {
				var sites = OSApp.Sites.parseSites( data.sites ),
					success = function( pass ) {
						OSApp.currentSession.pass = pass;
						sites[ opt.name ].os_pw = popup.find( "#save_pw" ).is( ":checked" ) ? pass : "";
						OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
						popup.popup( "close" );
						opt.callback();
					};

				OSApp.Network.checkPW( md5( npw ), function( result ) {
					if ( result === true ) {
						success( md5( npw ) );
					} else {
						success( npw );
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
		}

		if ( OSApp.Firmware.checkOSVersion( 213 ) ) {
			npw = md5( npw );
			cpw = md5( cpw );
		}

		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( "/sp?pw=&npw=" + encodeURIComponent( npw ) + "&cpw=" + encodeURIComponent( cpw ), "json" ).done( function( info ) {
			var result = info.result;

			if ( !result || result > 1 ) {
				if ( result === 2 ) {
					OSApp.Errors.showError( OSApp.Language._( "Please check the current device password is correct then try again" ) );
				} else {
					OSApp.Errors.showError( OSApp.Language._( "Unable to change password. Please try again." ) );
				}
			} else {
				OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
					var sites = OSApp.Sites.parseSites( data.sites );

					sites[ data.current_site ].os_pw = npw;
					OSApp.currentSession.pass = npw;
					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
				} );
				$.mobile.loading( "hide" );
				popup.popup( "close" );
				OSApp.Errors.showError( OSApp.Language._( "Password changed successfully" ) );
			}
		} );

		return false;
	} );

	popup.one( "popupafterclose", function() {
		document.activeElement.blur();
		popup.remove();
		if ( opt.fixIncorrect && !didSubmit ) {
			opt.cancel();
		}
	} ).popup().enhanceWithin();

	if ( opt.fixIncorrect ) {

		// Hash password and try again, if it fails then show the password prompt popup
		OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
			var sites = OSApp.Sites.parseSites( data.sites ),
				current = data.current_site,
				pw = md5( sites[ current ].os_pw );

			if ( !OSApp.Utils.isMD5( sites[ current ].os_pw ) ) {
				var urlDest = "/jc?pw=" + pw;

				$.ajax( {
					url: OSApp.currentSession.token ? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + urlDest : OSApp.currentSession.prefix + OSApp.currentSession.ip + urlDest,
					type: "GET",
					dataType: "json"
				} ).then(
					function() {
						sites[ current ].os_pw = OSApp.currentSession.pass = pw;
						OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
						opt.callback();
					},
					function() {
						popup.popup( "open" );
					}
				);
			} else {
				popup.popup( "open" );
			}
		} );
	} else {
		popup.popup( "open" );
	}
};

// Check if password is valid
OSApp.Network.checkPW = function( pass, callback ) {
	callback = callback || function() {};

	var urlDest = "/sp?pw=" + encodeURIComponent( pass ) + "&npw=" + encodeURIComponent( pass ) + "&cpw=" + encodeURIComponent( pass );

	$.ajax( {
		url: OSApp.currentSession.token ? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + urlDest : OSApp.currentSession.prefix + OSApp.currentSession.ip + urlDest,
		cache: false,
		crossDomain: true,
		type: "GET"
	} ).then(
		function( data ) {
			var result = data.result;

			if ( typeof result === "undefined" || result > 1 ) {
				callback( false );
			} else {
				callback( true );
			}
		},
		function() {
			callback( false );
		}
	);
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

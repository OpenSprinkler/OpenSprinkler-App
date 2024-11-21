/* global $, ThreeDeeTouch, navigator, FastClick */
/* global StatusBar, networkinterface, links, SunCalc, md5, sjcl */

/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <https://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Configure module
var OSApp = OSApp || {};

// TODO: refactor away all direct usage of localStorage in favor of OSApp.Storage
// TODO: refactor all weather related functions out to modules/weather.js
// TODO: continue module refactoring
// TODO: add unit tests for each module
// TODO: debug request to undefined host when on manage sites page and click on bogus test site
// TODO: refactor openpopup to general ui module

// App Constants
OSApp.Constants = {
	dialog: { // Dialog constants
		REMOVE_STATION: 1
	},
	http: {
		RETRY_COUNT: 2, // Define the amount of times the app will retry an HTTP request before marking it failed
	},
	keyIndex: { // Define the mapping between options and JSON keys
		"tz":1, "ntp":2, "dhcp":3, "ip1":4, "ip2":5, "ip3":6, "ip4":7, "gw1":8, "gw2":9, "gw3":10, "gw4":11,
		"hp0":12, "hp1":13, "ar":14, "ext":15, "seq":16, "sdt":17, "mas":18, "mton":19, "mtof":20, "urs":21, "rso":22,
		"wl":23, "den":24, "ipas":25, "devid":26, "con":27, "lit":28, "dim":29, "bst":30, "uwt":31, "ntp1":32, "ntp2":33,
		"ntp3":34, "ntp4":35, "lg":36, "mas2":37, "mton2":38, "mtof2":39, "fpr0":41, "fpr1":42, "re":43, "dns1": 44,
		"dns2":45, "dns3":46, "dns4":47, "sar":48, "ife":49, "sn1t":50, "sn1o":51, "sn2t":52, "sn2o":53, "sn1on":54,
		"sn1of":55, "sn2on":56, "sn2of":57, "subn1":58, "subn2":59, "subn3":60, "subn4":61
	},
	options: { // Option constants
		IGNORE_SENSOR_1: 1,
		IGNORE_SENSOR_2: 2,
		MANUAL_STATION_PID: 99,
		MASTER_GID_VALUE: 254,
		MASTER_GROUP_NAME: "M",
		MASTER_STATION_1: 1,
		MASTER_STATION_2: 2,
		NUM_SEQ_GROUPS: 4,
		PARALLEL_GID_VALUE: 255,
		PARALLEL_GROUP_NAME: "P",
	},
	regex: { // Define general regex patterns
		GPS: /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/
	},
	weather: {
		DEFAULT_WEATHER_SERVER_URL: "https://weather.opensprinkler.com"
	}
};

// Current device capabilities
OSApp.currentDevice = {
	deviceIp: undefined,
	isAndroid: /Android|\bSilk\b/.test( navigator.userAgent ),
	isiOS: /iP(ad|hone|od)/.test( navigator.userAgent ),
	isFireFox: /Firefox/.test( navigator.userAgent ),
	isOSXApp: window.cordova && window.cordova.platformId === "ios" && navigator.platform === "MacIntel",
	isTouchCapable: "ontouchstart" in window || "onmsgesturechange" in window,
	isMetric: ( [ "US", "BM", "PW" ].indexOf( navigator.languages[ 0 ].split( "-" )[ 1 ] ) === -1 ),
};
OSApp.currentDevice.isFileCapable = !OSApp.currentDevice.isiOS && !OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isOSXApp && window.FileReader;

// UI state
OSApp.uiState = {
	errorTimeout: undefined,
	goingBack: false,
	groupView: false,
	language: undefined,
	notifications: [], // Array to hold all notifications currently displayed within the app
	openPanel: undefined,
	pageHistoryCount: -1, // Initialize variables to keep track of current page count
	popupData: {
		"shift": undefined
	},
	switching: false,
	theme: { // Define the status bar color(s) and use a darker color for Android
		statusBarPrimary: OSApp.currentDevice.isAndroid ? "#121212" : "#1D1D1D",
		statusBarOverlay: OSApp.currentDevice.isAndroid ? "#151515" : "#202020"
	},
	timers: {},
};

// Current session and site values
OSApp.currentSession = {
	auth: undefined,
	authPass: undefined,
	authUser: undefined,
	controller: {},
	coordinates: [ 0, 0 ],
	fw183: undefined,
	ip: undefined,
	lang: undefined,
	local: undefined,
	pass: undefined,
	prefix: undefined,
	token: undefined,
	weather: undefined, // Current weather observations and future forecast data
	weatherServerUrl: OSApp.Constants.weather.DEFAULT_WEATHER_SERVER_URL
};
OSApp.currentSession.isControllerConnected = () => {
	if ( ( !OSApp.currentSession.ip && !OSApp.currentSession.token ) ||
		$.isEmptyObject( OSApp.currentSession.controller ) ||
		$.isEmptyObject( OSApp.currentSession.controller.options ) ||
		$.isEmptyObject( OSApp.currentSession.controller.programs ) ||
		$.isEmptyObject( OSApp.currentSession.controller.settings ) ||
		$.isEmptyObject( OSApp.currentSession.controller.status ) ||
		$.isEmptyObject( OSApp.currentSession.controller.stations ) ) {

			return false;
	}

	return true;
};

/* Setup DOM handlers and launch app*/
OSApp.UIDom.launchApp();

// Handle main switches for manual mode
function flipSwitched() {
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
		refreshStatus();
		if ( id === "mmm" ) {
			$( "#mm_list .green" ).removeClass( "green" );
		}
		checkStatus();
	},
	function() {
		OSApp.uiState.switching = true;
		setTimeout( function() {
			OSApp.uiState.switching = false;
		}, 200 );
		flip.prop( "checked", !changedTo ).flipswitch( "refresh" );
	} );
}

function networkFail() {
	changeStatus( 0, "red", "<p class='running-text center'>" + OSApp.Language._( "Network Error" ) + "</p>",
		function() {
			OSApp.UIDom.showLoading( "#weather,#footer-running" );
			refreshStatus();
			updateWeather();
		}
	);
}

// Gather new controller information and load home page
function newLoad() {

	// Get the current site name from the site select drop down
	var name = $( "#site-selector" ).val(),
		loading = "<div class='logo'></div>" +
			"<h1 style='padding-top:5px'>" + OSApp.Language._( "Connecting to" ) + " " + name + "</h1>" +
			"<p class='cancel tight center inline-icon'>" +
				"<span class='btn-no-border ui-btn ui-icon-delete ui-btn-icon-notext'></span>" +
				"Cancel" +
			"</p>";

	$.mobile.loading( "show", {
		html: OSApp.currentSession.local ? "<h1>" + OSApp.Language._( "Loading" ) + "</h1>" : loading,
		textVisible: true,
		theme: "b"
	} );

	$( ".ui-loader" ).css( {
		"box-shadow": "none",
		"margin-top": "-4em"
	} ).find( ".cancel" ).one( "click", function() {
		$.ajaxq.abort( "default" );
		OSApp.UIDom.changePage( "#site-control", {
			transition: "none"
		} );
	} );

	//Empty object which will store device data
	OSApp.currentSession.controller = {};

	//Empty notifications
	OSApp.Notifications.clearNotifications();

	//Empty timers object
	OSApp.uiState.timers = {};

	//Clear the current queued AJAX requests (used for previous OSApp.currentSession.controller connection)
	$.ajaxq.abort( "default" );

	updateController(
		function() {
			var weatherAdjust = $( ".weatherAdjust" ),
				changePassword = $( ".changePassword" );

			$.mobile.loading( "hide" );
			checkURLandUpdateWeather();

			if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
				weatherAdjust.css( "display", "" );
			} else {
				weatherAdjust.hide();
			}

			if ( OSApp.Analog.checkAnalogSensorAvail() ) {
				OSApp.Analog.updateAnalogSensor();
				OSApp.Analog.updateProgramAdjustments();
			}

			// Hide change password feature for unsupported devices
			if ( OSApp.Firmware.isOSPi() || OSApp.Firmware.checkOSVersion( 208 ) ) {
				changePassword.css( "display", "" );
			} else {
				changePassword.hide();
			}

			// Show site name instead of default Information bar
			if ( !OSApp.currentSession.local ) {
				$( "#info-list" ).find( "li[data-role='list-divider']" ).text( name );
				document.title = "OpenSprinkler - " + name;
			} else {
				$( "#info-list" ).find( "li[data-role='list-divider']" ).text( OSApp.Language._( "Information" ) );
			}

			// Check if a firmware update is available
			OSApp.Firmware.checkFirmwareUpdate();

			// Check for unused expansion boards
			detectUnusedExpansionBoards();

			// Check if password is plain text (older method) and hash the password, if needed
			if ( OSApp.Firmware.checkOSVersion( 213 ) && OSApp.currentSession.controller.options.hwv !== 255 ) {
				fixPasswordHash( name );
			}

			// Check if the OpenSprinkler can be accessed from the public IP
			if ( !OSApp.currentSession.local && typeof OSApp.currentSession.controller.settings.eip === "number" ) {
				OSApp.Network.checkPublicAccess( OSApp.currentSession.controller.settings.eip );
			}

			// Check if a cloud token is available and if so show logout button otherwise show login
			updateLoginButtons();

			if ( OSApp.Firmware.isOSPi() ) {

				// Show notification of unified firmware availability
				showUnifiedFirmwareNotification();
			}

			if ( OSApp.currentSession.controller.options.firstRun ) {
				showGuidedSetup();
			} else {
				OSApp.UIDom.goHome( true );
			}
		},
		function( error ) {
			$.ajaxq.abort( "default" );
			OSApp.currentSession.controller = {};

			$.mobile.loading( "hide" );

			var fail = function() {
				if ( !OSApp.currentSession.local ) {
					if ( $( ".ui-page-active" ).attr( "id" ) === "site-control" ) {
						showFail();
					} else {
						$.mobile.document.one( "pageshow", showFail );
						OSApp.UIDom.changePage( "#site-control", {
							transition: "none"
						} );
					}
				} else {
					OSApp.Storage.remove( [ "sites" ], function() {
						window.location.reload();
					} );
				}
			},
			showFail = function() {
				OSApp.Errors.showError( OSApp.Language._( "Unable to connect to" ) + " " + name, 3500 );
			};

			if ( typeof error === "object" && error.status === 401 ) {
				$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

				OSApp.Network.changePassword( {
					fixIncorrect: true,
					name: name,
					callback: newLoad,
					cancel: fail
				} );
			} else {
				fail();
			}
		}
	);
}

// Update controller information
function updateController( callback, fail ) {
	callback = callback || function() {};
	fail = fail || function() {};

	var finish = function() {
		$( "html" ).trigger( "datarefresh" );
		checkStatus();
		callback();
	};

	if ( OSApp.currentSession.isControllerConnected() && OSApp.Firmware.checkOSVersion( 216 ) ) {
		OSApp.Firmware.sendToOS( "/ja?pw=", "json" ).then( function( data ) {

			if ( typeof data === "undefined" || $.isEmptyObject( data ) ) {
				fail();
				return;
			}

			// The /ja call does not contain special station data, so let's cache it
			var special = OSApp.currentSession.controller.special;

			OSApp.currentSession.controller = data;

			// Restore the station cache to the object
			OSApp.currentSession.controller.special = special;

			// Fix the station status array
			OSApp.currentSession.controller.status = OSApp.currentSession.controller.status.sn;

			finish();
		}, fail );
	} else {
		$.when(
			updateControllerPrograms(),
			updateControllerStations(),
			updateControllerOptions(),
			updateControllerStatus(),
			updateControllerSettings()
		).then( finish, fail );
	}
}

function updateControllerPrograms( callback ) {
	callback = callback || function() {};

	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/gp?d=0" ).done( function( programs ) {
			var vars = programs.match( /(nprogs|nboards|mnp)=[\w|\d|.\"]+/g ),
				progs = /pd=\[\];(.*);/.exec( programs ),
				newdata = {}, tmp, prog;

			for ( var i = 0; i < vars.length; i++ ) {
				if ( vars[ i ] === "" ) {
					continue;
				}
				tmp = vars[ i ].split( "=" );
				newdata[ tmp[ 0 ] ] = parseInt( tmp[ 1 ] );
			}

			newdata.pd = [];
			if ( progs !== null ) {
				progs = progs[ 1 ].split( ";" );
				for ( i = 0; i < progs.length; i++ ) {
					prog = progs[ i ].split( "=" );
					prog = prog[ 1 ].replace( "[", "" );
					prog = prog.replace( "]", "" );
					newdata.pd[ i ] = OSApp.Utils.parseIntArray( prog.split( "," ) );
				}
			}

			OSApp.currentSession.controller.programs = newdata;
			callback();
		} );
	} else {
		return OSApp.Firmware.sendToOS( "/jp?pw=", "json" ).done( function( programs ) {
			OSApp.currentSession.controller.programs = programs;
			callback();
		} );
	}
}

function updateControllerStations( callback ) {
	callback = callback || function() {};

	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/vs" ).done( function( stations ) {
			var names = /snames=\[(.*?)\];/.exec( stations ),
				masop = stations.match( /(?:masop|mo)\s?[=|:]\s?\[(.*?)\]/ );

			names = names[ 1 ].split( "," );
			names.pop();

			for ( var i = 0; i < names.length; i++ ) {
				names[ i ] = names[ i ].replace( /'/g, "" );
			}

			masop = OSApp.Utils.parseIntArray( masop[ 1 ].split( "," ) );

			OSApp.currentSession.controller.stations = {
				"snames": names,
				"masop": masop,
				"maxlen": names.length
			};
			callback();
		} );
	} else {
		return OSApp.Firmware.sendToOS( "/jn?pw=", "json" ).done( function( stations ) {
			OSApp.currentSession.controller.stations = stations;
			callback();
		} );
	}
}

function updateControllerOptions( callback ) {
	callback = callback || function() {};

	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/vo" ).done( function( options ) {
			var isOSPi = options.match( /var sd\s*=/ ),
				vars = {}, tmp, i, o;

			if ( isOSPi ) {
				var varsRegex = /(tz|htp|htp2|nbrd|seq|sdt|mas|mton|mtoff|urs|rst|wl|ipas)\s?[=|:]\s?([\w|\d|.\"]+)/gm,
					name;

				while ( ( tmp = varsRegex.exec( options ) ) !== null ) {
					name = tmp[ 1 ].replace( "nbrd", "ext" ).replace( "mtoff", "mtof" );
					vars[ name ] = +tmp[ 2 ];
				}
				vars.ext--;
				vars.fwv = "1.8.3-ospi";
			} else {
				var valid = [ 1, 2, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26 ];
				tmp = /var opts=\[(.*)\];/.exec( options );
				tmp = tmp[ 1 ].replace( /"/g, "" ).split( "," );

				for ( i = 0; i < tmp.length - 1; i = i + 4 ) {
					o = +tmp[ i + 3 ];
					if ( $.inArray( o, valid ) !== -1 ) {
						vars[ OSApp.Constants.keyIndex[ o ] ] = +tmp[ i + 2 ];
					}
				}
				vars.fwv = 183;
			}
			OSApp.currentSession.controller.options = vars;
			callback();
		} );
	} else {
		return OSApp.Firmware.sendToOS( "/jo?pw=", "json" ).done( function( options ) {
			OSApp.currentSession.controller.options = options;
			callback();
		} );
	}
}

function updateControllerStatus( callback ) {
	callback = callback || function() {};

	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/sn0" ).then(
			function( status ) {
				var tmp = status.toString().match( /\d+/ );

				tmp = OSApp.Utils.parseIntArray( tmp[ 0 ].split( "" ) );

				OSApp.currentSession.controller.status = tmp;
				callback();
			},
			function() {
				OSApp.currentSession.controller.status = [];
			} );
	} else {
		return OSApp.Firmware.sendToOS( "/js?pw=", "json" ).then(
			function( status ) {
				OSApp.currentSession.controller.status = status.sn;
				callback();
			},
			function() {
				OSApp.currentSession.controller.status = [];
			} );
	}
}

function updateControllerSettings( callback ) {
	callback = callback || function() {};

	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "" ).then(
			function( settings ) {
				var varsRegex = /(ver|devt|nbrd|tz|en|rd|rs|mm|rdst|urs)\s?[=|:]\s?([\w|\d|.\"]+)/gm,
					loc = settings.match( /loc\s?[=|:]\s?[\"|'](.*)[\"|']/ ),
					lrun = settings.match( /lrun=\[(.*)\]/ ),
					ps = settings.match( /ps=\[(.*)\];/ ),
					vars = {}, tmp, i;

				ps = ps[ 1 ].split( "],[" );
				for ( i = ps.length - 1; i >= 0; i-- ) {
					ps[ i ] = OSApp.Utils.parseIntArray( ps[ i ].replace( /\[|\]/g, "" ).split( "," ) );
				}

				while ( ( tmp = varsRegex.exec( settings ) ) !== null ) {
					vars[ tmp[ 1 ] ] = +tmp[ 2 ];
				}

				vars.loc = loc[ 1 ];
				vars.ps = ps;
				vars.lrun = OSApp.Utils.parseIntArray( lrun[ 1 ].split( "," ) );

				OSApp.currentSession.controller.settings = vars;
			},
			function() {
				if ( OSApp.currentSession.controller.settings && OSApp.currentSession.controller.stations ) {
					var ps = [], i;
					for ( i = 0; i < OSApp.currentSession.controller.stations.maxlen; i++ ) {
						ps.push( [ 0, 0 ] );
					}
					OSApp.currentSession.controller.settings.ps = ps;
				}
			} );
	} else {
		return OSApp.Firmware.sendToOS( "/jc?pw=" ).then(
			function( settings ) {
				if ( typeof settings !== "object" ) {
					try {
						settings = JSON.parse( settings );
					} catch ( err ) {
						var matchWTO = /,"wto":\{.*?\}/;
						var wto = settings.match( matchWTO );
						settings = settings.replace( matchWTO, "" );
						try {
							settings = JSON.parse( settings );
							handleCorruptedWeatherOptions( wto );
						} catch ( e ) {
							return false;
						}
					}
				}

				if ( typeof settings.lrun === "undefined" ) {
					settings.lrun = [ 0, 0, 0, 0 ];
				}

				// Update the current coordinates if the user's location is using them
				if ( settings.loc.match( OSApp.Constants.regex.GPS ) ) {
					var location = settings.loc.split( "," );
					OSApp.currentSession.coordinates = [ parseFloat( location[ 0 ] ), parseFloat( location[ 1 ] ) ];
				}

				OSApp.currentSession.controller.settings = settings;
				callback();
			},
			function() {
				if ( OSApp.currentSession.controller.settings && OSApp.currentSession.controller.stations ) {
					var ps = [], i;
					for ( i = 0; i < OSApp.currentSession.controller.stations.maxlen; i++ ) {
						ps.push( [ 0, 0 ] );
					}
					OSApp.currentSession.controller.settings.ps = ps;
				}
			} );
	}
}

function updateControllerStationSpecial( callback ) {
	callback = callback || function() {};

	return OSApp.Firmware.sendToOS( "/je?pw=", "json" ).then(
		function( special ) {
			OSApp.currentSession.controller.special = special;
			callback();
		},
		function() {
			OSApp.currentSession.controller.special = {};
		} );
}

function fixPasswordHash( current ) {
	OSApp.Storage.get( [ "sites" ], function( data ) {
		var sites = OSApp.Sites.parseSites( data.sites );

		if ( !OSApp.Utils.isMD5( OSApp.currentSession.pass ) ) {
			var pw = md5( OSApp.currentSession.pass );

			OSApp.Firmware.sendToOS(
				"/sp?pw=&npw=" + encodeURIComponent( pw ) +
				"&cpw=" + encodeURIComponent( pw ), "json"
			).done( function( info ) {
				var result = info.result;

				if ( !result || result > 1 ) {
					return false;
				} else {
					sites[ current ].os_pw = OSApp.currentSession.pass = pw;
					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, OSApp.Network.cloudSaveSites );
				}
			} );
		}
	} );
}

// Add a new site
function submitNewUser( ssl, useAuth ) {
	document.activeElement.blur();
	$.mobile.loading( "show" );

	var connectionType = $( ".connection-type input[type='radio']:checked" ).val(),
		ip = $.mobile.path.parseUrl( $( "#os_ip" ).val() ).hrefNoHash.replace( /https?:\/\//, "" ),
		token = connectionType === "token" ? $( "#os_token" ).val() : null,
		success = function( data, sites ) {
			$.mobile.loading( "hide" );
			var is183;

			if ( ( typeof data === "string" && data.match( /var (en|sd)\s*=/ ) ) || ( typeof data.fwv === "number" && data.fwv === 203 ) ) {
				is183 = true;
			}

			if ( data.fwv !== undefined || is183 === true ) {
				var name = $( "#os_name" ).val(),
					pw = $( "#os_pw" ).val(),
					savePW = $( "#save_pw" ).is( ":checked" );

				if ( name === "" ) {
					name = "Site " + ( Object.keys( sites ).length + 1 );
				}

				sites[ name ] = {};
				sites[ name ].os_token = OSApp.currentSession.token = token;
				sites[ name ].os_ip = OSApp.currentSession.ip = ip;

				if ( typeof data.fwv === "number" && data.fwv >= 213 ) {
					if ( typeof data.wl === "number" ) {
						pw = md5( pw );
					}
				}

				sites[ name ].os_pw = savePW ? pw : "";
				OSApp.currentSession.pass = pw;

				if ( ssl ) {
					sites[ name ].ssl = "1";
					OSApp.currentSession.prefix = "https://";
				} else {
					OSApp.currentSession.prefix = "http://";
				}

				if ( useAuth ) {
					sites[ name ].auth_user = $( "#os_auth_user" ).val();
					sites[ name ].auth_pw = $( "#os_auth_pw" ).val();
					OSApp.currentSession.auth = true;
					OSApp.currentSession.authUser = sites[ name ].auth_user;
					OSApp.currentSession.authPass = sites[ name ].auth_pw;
				} else {
					OSApp.currentSession.auth = false;
				}

				if ( is183 === true ) {
					sites[ name ].is183 = "1";
					OSApp.currentSession.fw183 = true;
				}

				$( "#os_name,#os_ip,#os_pw,#os_auth_user,#os_auth_pw,#os_token" ).val( "" );
				OSApp.Storage.set( {
					"sites": JSON.stringify( sites ),
					"current_site": name
				}, function() {
					OSApp.Network.cloudSaveSites();
					OSApp.Sites.updateSiteList( Object.keys( sites ), name );
					newLoad();
				} );
			} else {
				OSApp.Errors.showError( OSApp.Language._( "Check IP/Port and try again." ) );
			}
		},
		fail = function( x ) {
			if ( !useAuth && x.status === 401 ) {
				getAuth();
				return;
			}
			if ( ssl ) {
				$.mobile.loading( "hide" );
				OSApp.Errors.showError( OSApp.Language._( "Check IP/Port and try again." ) );
			} else {
				submitNewUser( true );
			}
		},
		getAuth = function() {
			if ( $( "#addnew-auth" ).length ) {
				submitNewUser( ssl, true );
			} else {
				showAuth();
			}
		},
		getAuthInfo = function() {
			return btoa( $( "#os_auth_user" ).val() + ":" + $( "#os_auth_pw" ).val() );
		},
		showAuth = function() {
			$.mobile.loading( "hide" );
			var html = $( "<div class='ui-content' id='addnew-auth'>" +
					"<form method='post' novalidate>" +
						"<p class='center smaller'>" + OSApp.Language._( "Authorization Required" ) + "</p>" +
						"<label for='os_auth_user'>" + OSApp.Language._( "Username:" ) + "</label>" +
						"<input autocomplete='off' autocorrect='off' autocapitalize='off' " +
							"spellcheck='false' type='text' " +
							"name='os_auth_user' id='os_auth_user'>" +
						"<label for='os_auth_pw'>" + OSApp.Language._( "Password:" ) + "</label>" +
						"<input type='password' name='os_auth_pw' id='os_auth_pw'>" +
						"<input type='submit' value='" + OSApp.Language._( "Submit" ) + "'>" +
					"</form>" +
				"</div>" ).enhanceWithin();

			html.on( "submit", "form", function() {
				submitNewUser( ssl, true );
				return false;
			} );

			$( "#addnew-content" ).hide();
			$( "#addnew" ).append( html ).popup( "reposition", { positionTo:"window" } );
		},
		prefix;

	if ( !ip && !token ) {
		OSApp.Errors.showError( OSApp.Language._( "An IP address or token is required to continue." ) );
		return;
	}

	if ( token && token.length !== 32 ) {
		OSApp.Errors.showError( OSApp.Language._( "OpenThings Token must be 32 characters long." ) );
		return;
	}

	if ( useAuth !== true && $( "#os_useauth" ).is( ":checked" ) ) {
		getAuth();
		return;
	}

	if ( $( "#os_usessl" ).is( ":checked" ) === true ) {
		ssl = true;
	}

	if ( ssl ) {
		prefix = "https://";
	} else {
		prefix = "http://";
	}

	if ( useAuth ) {
		$( "#addnew-auth" ).hide();
		$( "#addnew-content" ).show();
		$( "#addnew" ).popup( "reposition", { positionTo:"window" } );
	}

	var urlDest = "/jo?pw=" + md5( $( "#os_pw" ).val() ),
		url = token ? "https://cloud.openthings.io/forward/v1/" + token + urlDest : prefix + ip + urlDest;

	//Submit form data to the server
	$.ajax( {
		url: url,
		type: "GET",
		dataType: "json",
		timeout: 10000,
		global: false,
		beforeSend: function( xhr ) {
			if ( !token && useAuth ) {
				xhr.setRequestHeader(
					"Authorization",
					"Basic " + getAuthInfo()
				);
			}
		},
		error: function( x ) {
			if ( !useAuth && x.status === 401 ) {
				getAuth();
				return;
			}
			$.ajax( {
				url: token ? "https://cloud.openthings.io/forward/v1/" + token : prefix + ip,
				type: "GET",
				dataType: "text",
				timeout: 10000,
				global: false,
				cache: true,
				beforeSend: function( xhr ) {
					if ( !token && useAuth ) {
						xhr.setRequestHeader(
							"Authorization",
							"Basic " + getAuthInfo()
						);
					}
				},
				success: function( reply ) {
					OSApp.Storage.get( "sites", function( data ) {
						var sites = OSApp.Sites.parseSites( data.sites );
						success( reply, sites );
					} );
				},
				error: fail
			} );
		},
		success: function( reply ) {
			OSApp.Storage.get( "sites", function( data ) {
				var sites = OSApp.Sites.parseSites( data.sites );
				success( reply, sites );
			} );
		}
	} );
}

function showSiteSelect( list ) {
	$( "#site-select" ).popup( "destroy" ).remove();

	var popup = $(
		"<div data-role='popup' id='site-select' data-theme='a' data-overlay-theme='b'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Select Site" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<ul data-role='none' class='ui-listview ui-corner-all ui-shadow'>" +
				"</ul>" +
			"</div>" +
		"</div>" );

	if ( list ) {
		popup.find( "ul" ).html( list );
	}

	popup.one( "popupafterclose", function() {
		$( this ).popup( "destroy" ).remove();
	} ).popup( {
		history: false,
		"positionTo": "window"
	} ).enhanceWithin().popup( "open" );
}

function showAddNew( autoIP, closeOld ) {
	$( "#addnew" ).popup( "destroy" ).remove();

	var isAuto = ( autoIP ) ? true : false,
		addnew = $( "<div data-role='popup' id='addnew' data-theme='a' data-overlay-theme='b'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "New Device" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content' id='addnew-content'>" +
				"<form method='post' novalidate>" +
					( isAuto ? "" : "<p class='center smaller'>" +
						OSApp.Language._( "Note: The name is used to identify the OpenSprinkler within the app. OpenSprinkler IP can be either an IP or hostname. You can also specify a port by using IP:Port" ) +
					"</p>" ) +
					"<label for='os_name'>" + OSApp.Language._( "Open Sprinkler Name:" ) + "</label>" +
					"<input autocorrect='off' spellcheck='false' type='text' name='os_name' " +
						"id='os_name' placeholder='Home'>" +
					( isAuto ? "" :
						"<div class='ui-field-contain'>" +
							"<fieldset data-role='controlgroup' class='ui-mini center connection-type' data-type='horizontal'>" +
								"<legend class='left'>" + OSApp.Language._( "Connection Type" ) + ":</legend>" +
								"<input class='noselect' type='radio' name='connectionType' id='type-direct' value='ip' checked='checked'>" +
								"<label for='type-direct'>" + OSApp.Language._( "Direct" ) + "</label>" +
								"<input class='noselect' type='radio' name='connectionType' id='type-token' value='token'>" +
								"<label for='type-token'>" + OSApp.Language._( "OpenThings Cloud" ) + "</label>" +
							"</fieldset>" +
						"</div>" +
						"<label class='ip-field' for='os_ip'>" + OSApp.Language._( "Open Sprinkler IP:" ) + "</label>" ) +
					"<input data-wrapper-class='ip-field' " + ( isAuto ? "data-role='none' style='display:none' " : "" ) +
						"autocomplete='off' autocorrect='off' autocapitalize='off' " +
						"spellcheck='false' type='url' pattern='' name='os_ip' id='os_ip' " +
						"value='" + ( isAuto ? autoIP : "" ) + "' placeholder='home.dyndns.org'>" +
					"<label class='token-field' for='os_token' style='display: none'>" + OSApp.Language._( "OpenThings Token" ) + ":</label>" +
					"<input data-wrapper-class='token-field hidden' " +
						"autocomplete='off' autocorrect='off' autocapitalize='off' " +
						"spellcheck='false' type='text' pattern='' name='os_token' id='os_token' " +
						"value='' placeholder='" + OSApp.Language._( "OpenThings Token" ) + "'>" +
					"<label for='os_pw'>" + OSApp.Language._( "Open Sprinkler Password:" ) + "</label>" +
					"<input type='password' name='os_pw' id='os_pw' value=''>" +
					"<label for='save_pw'>" + OSApp.Language._( "Save Password" ) + "</label>" +
					"<input type='checkbox' data-wrapper-class='save_pw' name='save_pw' " +
						"id='save_pw' data-mini='true' checked='checked'>" +
					( isAuto ? "" :
						"<div data-theme='a' data-mini='true' data-role='collapsible' class='advanced-options'>" +
							"<h4>" + OSApp.Language._( "Advanced" ) + "</h4>" +
							"<fieldset data-role='controlgroup' data-type='horizontal' " +
								"data-mini='true' class='center'>" +
							"<input type='checkbox' name='os_usessl' id='os_usessl'>" +
							"<label for='os_usessl'>" + OSApp.Language._( "Use SSL" ) + "</label>" +
							"<input type='checkbox' name='os_useauth' id='os_useauth'>" +
							"<label for='os_useauth'>" + OSApp.Language._( "Use Auth" ) + "</label>" +
							"</fieldset>" +
						"</div>" ) +
					"<input type='submit' data-theme='b' value='" + OSApp.Language._( "Submit" ) + "'>" +
				"</form>" +
			"</div>" +
		"</div>" );

	addnew.find( "form" ).on( "submit", function() {
		submitNewUser();
		return false;
	} );

	addnew.one( "popupafterclose", function() {
		$( this ).popup( "destroy" ).remove();
	} ).popup( {
		history: false,
		"positionTo": "window"
	} ).enhanceWithin();

	if ( closeOld ) {
		$( ".ui-popup-active" ).children().first().one( "popupafterclose", function() {
			addnew.popup( "open" );
		} ).popup( "close" );
	} else {
		addnew.popup( "open" );
	}

	OSApp.UIDom.fixInputClick( addnew );

	addnew.find( ".ui-collapsible-heading-toggle" ).on( "click", function() {
		var open = $( this ).parents( ".ui-collapsible" ).hasClass( "ui-collapsible-collapsed" ),
			page = $( ".ui-page-active" ),
			height = parseInt( page.css( "min-height" ) );

		if ( open ) {
			page.css( "min-height", ( height + 65 ) + "px" );
		} else {
			page.css( "min-height", ( height - 65 ) + "px" );
		}

		addnew.popup( "reposition", { positionTo:"window" } );
	} );

	addnew.find( ".connection-type input[type='radio']" ).on( "change", function() {
		var previous = this.value === "token" ? "ip" : "token";
		addnew.find( "." + previous + "-field" ).hide();
		addnew.find( "." + this.value + "-field" ).removeClass( "hidden" ).show();
		addnew.find( ".advanced-options" ).toggle( this.value === "ip" );
	} );

	return false;
}

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
		showAddNew( false, true );
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
					updateSite( siteNames[ $( this ).data( "site" ) ] );
					return false;
				} );

				list.find( ".help-icon" ).on( "click", showHelpText );

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
							OSApp.Storage.set( { "current_site":site } );
							data.current_site = site;
						}
						OSApp.Sites.updateSiteList( Object.keys( sites ), data.current_site );

						//OSApp.Firmware.sendToOS( "/cv?pw=&cn=" + data.current_site );
					}

					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, OSApp.Network.cloudSaveSites );

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
					areYouSure( OSApp.Language._( "Are you sure you want to delete " ) + site + "?", "", function() {
						if ( $( "#site-selector" ).val() === site ) {
							makeStart();
						}

						delete sites[ site ];
						OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, function() {
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
				page.find( ".ui-content" ).prepend( addSyncStatus( data.cloudToken ) );

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
						showAddNew();
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


// Show popup for new device after populating device IP with selected result
function addFound( ip ) {
	$( "#site-select" ).one( "popupafterclose", function() {
		showAddNew( ip );
	} ).popup( "close" );
}

// Weather functions
function showZimmermanAdjustmentOptions( button, callback ) {
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	// Sensitivity and baseline values for Humidity, Temp and Rainfall for Zimmerman adjustment
	var options = $.extend( {}, {
			h: 100,
			t: 100,
			r: 100,
			bh: 30,
			bt: 70,
			br: 0
		}, OSApp.Utils.unescapeJSON( button.value ) ),

		// Enable Zimmerman extension to set weather conditions as baseline for adjustment
		hasBaseline = OSApp.Firmware.checkOSVersion( 2162 );

	// OSPi stores in imperial so convert to metric and adjust to nearest 1/10ths of a degree and mm
	if ( OSApp.currentDevice.isMetric ) {
		options.bt = Math.round( ( ( options.bt - 32 ) * 5 / 9 ) * 10 ) / 10;
		options.br = Math.round( ( options.br * 25.4 ) * 10 ) / 10;
	}

	var popup = $( "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Weather Adjustment Options" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "Set the baseline weather conditions for your location. " ) +
					OSApp.Language._( "The Zimmerman method will adjust the watering duration based on differences from this reference point." ) +
				"</p>" +
				"<div class='ui-grid-b'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "Temp" ) + ( OSApp.currentDevice.isMetric ? " &#176;C" : " &#176;F" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='bt' type='number' " + ( OSApp.currentDevice.isMetric ? "min='-20' max='50'" : "min='0' max='120'" ) + " value='" + options.bt + ( hasBaseline ? "'>" : "' disabled='disabled'>" ) +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Rain" ) + ( OSApp.currentDevice.isMetric ? " mm" : " \"" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='br' type='number' " + ( OSApp.currentDevice.isMetric ? "min='0' max='25' step='0.1'" : "min='0' max='1' step='0.01'" ) + " value='" + options.br + ( hasBaseline ? "'>" : "' disabled='disabled'>" ) +
					"</div>" +
					"<div class='ui-block-c'>" +
						"<label class='center'>" +
							OSApp.Language._( "Humidity" ) + " %" +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='bh' type='number'  min='0' max='100' value='" + options.bh + ( hasBaseline ? "'>" : "' disabled='disabled'>" ) +
					"</div>" +
				"</div>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "Set the sensitivity of the watering adjustment to changes in each of the above weather conditions." ) +
				"</p>" +
				"<span>" +
					"<fieldset class='ui-grid-b incr'>" +
						"<div class='ui-block-a'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-c'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
					"</fieldset>" +
					"<div class='ui-grid-b inputs'>" +
						"<div class='ui-block-a'>" +
							"<input data-wrapper-class='pad_buttons' class='t' type='number' min='0' max='100' value='" + options.t + "'>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<input data-wrapper-class='pad_buttons' class='r' type='number'  min='0' max='100' value='" + options.r + "'>" +
						"</div>" +
						"<div class='ui-block-c'>" +
							"<input data-wrapper-class='pad_buttons' class='h' type='number'  min='0' max='100' value='" + options.h + "'>" +
						"</div>" +
					"</div>" +
					"<fieldset class='ui-grid-b decr'>" +
						"<div class='ui-block-a'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-c'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
					"</fieldset>" +
				"</span>" +
				"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			var input = popup.find( ".inputs input" ).eq( pos ),
				val = parseInt( input.val() );

			if ( ( dir === -1 && val === 0 ) || ( dir === 1 && val === 100 ) ) {
				return;
			}

			input.val( val + dir );
		};

	popup.find( ".submit" ).on( "click", function() {
		var options = {
			h: parseInt( popup.find( ".h" ).val() ),
			t: parseInt( popup.find( ".t" ).val() ),
			r: parseInt( popup.find( ".r" ).val() )
		};

		if ( hasBaseline ) {
			$.extend( options, {
				bh: parseInt( popup.find( ".bh" ).val() ),
				bt: parseFloat( popup.find( ".bt" ).val() ),
				br: parseFloat( popup.find( ".br" ).val() )
			} );

			// OSPi stores in imperial so onvert metric at higher precision so we dont lose accuracy
			if ( OSApp.currentDevice.isMetric ) {
				options.bt = Math.round( ( options.bt * 9 / 5 + 32 ) * 100 ) / 100;
				options.br = Math.round( ( options.br / 25.4 ) * 1000 ) / 1000;
			}
		}

		if ( button ) {
			button.value = OSApp.Utils.escapeJSON( options );
		}

		callback();

		popup.popup( "close" );
		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {

		// Generic min/max checker for Temp/Rain/Hum baseline as well as 0-100%
		var min = parseFloat( this.min ),
			max = parseFloat( this.max );

		if ( this.value === "" ) {
			this.value = "0";
		}
		if ( this.value < min || this.value > max ) {
			this.value = this.value < min ? min : max;
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

	$( "#adjustmentOptions" ).remove();

	popup.css( "max-width", "380px" );

	OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
}

function showAutoRainDelayAdjustmentOptions( button, callback ) {
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	var options = $.extend( {}, {
		d: 24
	}, OSApp.Utils.unescapeJSON( button.value ) );

	var popup = $( "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Weather Adjustment Options" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "If the weather reports any condition suggesting rain, a rain delay is automatically issued using the below set delay duration." ) +
				"</p>" +
				"<label class='center' for='delay_duration'>" + OSApp.Language._( "Delay Duration (hours)" ) + "</label>" +
				"<div class='input_with_buttons'>" +
					"<button class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
					"<input id='delay_duration' type='number' pattern='[0-9]*' value='" + options.d + "'>" +
					"<button class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
				"</div>" +
				"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>" ),
		changeValue = function( dir ) {
			var input = popup.find( "#delay_duration" ),
				val = parseInt( input.val() );

			if ( ( dir === -1 && val === 0 ) || ( dir === 1 && val === 8760 ) ) {
				return;
			}

			input.val( val + dir );
		};

	popup.find( ".submit" ).on( "click", function() {
		options = { d: parseInt( popup.find( "#delay_duration" ).val() ) };

		if ( button ) {
			button.value = OSApp.Utils.escapeJSON( options );
		}

		callback();

		popup.popup( "close" );
		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {
		if ( this.value === "" || parseInt( this.value ) < 0 ) {
			this.value = "0";
		}
	} );

	OSApp.UIDom.holdButton( popup.find( ".incr" ), function() {
		changeValue( 1 );
		return false;
	} );

	OSApp.UIDom.holdButton( popup.find( ".decr" ), function() {
		changeValue( -1 );
		return false;
	} );

	$( "#adjustmentOptions" ).remove();

	popup.css( "max-width", "380px" );

	OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
}

function showMonthlyAdjustmentOptions( button, callback ) {
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	var options = $.extend( {}, {
		scales: [ 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100 ]
	}, OSApp.Utils.unescapeJSON( button.value ) );

	var popup = $( "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Weather Adjustment Options" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "Input Monthly Watering Percentage Values" ) +
				"</p>" +
				"<div class='ui-grid-c'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "Jan" )  +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc0' type='number' min=0 max=250 value=" + options.scales[ 0 ] + ">" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Feb" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc1' type='number' min=0 max=250 value=" + options.scales[ 1 ] + ">" +
					"</div>" +
					"<div class='ui-block-c'>" +
						"<label class='center'>" +
							OSApp.Language._( "Mar" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc2' type='number' min=0 max=250 value=" + options.scales[ 2 ] + ">" +
					"</div>" +
					"<div class='ui-block-d'>" +
						"<label class='center'>" +
							OSApp.Language._( "Apr" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc3' type='number' min=0 max=250 value=" + options.scales[ 3 ] + ">" +
					"</div>" +
				"</div>" +
				"<div class='ui-grid-c'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "May" )  +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc4' type='number' min=0 max=250 value=" + options.scales[ 4 ] + ">" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Jun" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc5' type='number' min=0 max=250 value=" + options.scales[ 5 ] + ">" +
					"</div>" +
					"<div class='ui-block-c'>" +
						"<label class='center'>" +
							OSApp.Language._( "Jul" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc6' type='number' min=0 max=250 value=" + options.scales[ 6 ] + ">" +
					"</div>" +
					"<div class='ui-block-d'>" +
						"<label class='center'>" +
							OSApp.Language._( "Aug" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc7' type='number' min=0 max=250 value=" + options.scales[ 7 ] + ">" +
					"</div>" +
				"</div>" +
				"<div class='ui-grid-c'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "Sep" )  +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc8' type='number' min=0 max=250 value=" + options.scales[ 8 ] + ">" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Oct" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc9' type='number' min=0 max=250 value=" + options.scales[ 9 ] + ">" +
					"</div>" +
					"<div class='ui-block-c'>" +
						"<label class='center'>" +
							OSApp.Language._( "Nov" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc10' type='number' min=0 max=250 value=" + options.scales[ 10 ] + ">" +
					"</div>" +
					"<div class='ui-block-d'>" +
						"<label class='center'>" +
							OSApp.Language._( "Dec" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc11' type='number' min=0 max=250 value=" + options.scales[ 11 ] + ">" +
					"</div>" +
				"</div>" +
				"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>" );

	popup.find( ".submit" ).on( "click", function() {
		var _scales = [];
		for ( var i = 0; i < 12; i++ ) {
			_scales[ i ] = parseInt( popup.find( ".sc" + i ).val() );
			if ( _scales[ i ] < 0 ) { _scales[ i ] = 0; }
			if ( _scales[ i ] > 250 ) { _scales[ i ] = 250; }
		}
		options = { scales: _scales };
		if ( button ) {
			button.value = OSApp.Utils.escapeJSON( options );
		}

		callback();

		popup.popup( "close" );
		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {
		if ( this.value === "" || parseInt( this.value ) < 0 ) {
			this.value = "0";
		}
	} );

	$( "#adjustmentOptions" ).remove();

	popup.css( "max-width", "380px" );

	OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
}

// Validates a Weather Underground location to verify it contains the data needed for Weather Adjustments
function validateWULocation( location, callback ) {
	if ( !OSApp.currentSession.controller.settings.wto || typeof OSApp.currentSession.controller.settings.wto.key !== "string" || OSApp.currentSession.controller.settings.wto.key === "" ) {
		callback( false );
	}

	$.ajax( {
		url: "https://api.weather.com/v2/pws/observations/hourly/7day?stationId=" + location + "&format=json&units=e&apiKey=" + OSApp.currentSession.controller.settings.wto.key,
		cache: true
	} ).done( function( data ) {
		if ( !data || data.errors ) {
			callback( false );
			return;
		}

		callback( true );
	} ).fail( function() {
		callback( false );
	} );
}

function showEToAdjustmentOptions( button, callback ) {
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	// Elevation and baseline ETo for ETo adjustment.
	var options = $.extend( {}, {
			baseETo: 0,
			elevation: 600
		},
		OSApp.Utils.unescapeJSON( button.value )
	);

	if ( OSApp.currentDevice.isMetric ) {
		options.baseETo = Math.round( options.baseETo * 25.4 * 10 ) / 10;
		options.elevation = Math.round( options.elevation / 3.28 );
	}

	var popup = $( "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Weather Adjustment Options" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "Set the baseline potential evapotranspiration (ETo) and elevation for your location. " ) +
					OSApp.Language._( "The ETo adjustment method will adjust the watering duration based on the difference between the baseline ETo and the current ETo." ) +
				"</p>" +
				"<div class='ui-grid-a'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "Baseline ETo" ) + ( OSApp.currentDevice.isMetric ? " (mm" : "(in" ) + "/day)" +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='baseline-ETo' type='number' min='0' " + ( OSApp.currentDevice.isMetric ? "max='25' step='0.1'" : "max='1' step='0.01'" ) + " value='" + options.baseETo + "'>" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Elevation" ) + ( OSApp.currentDevice.isMetric ? " (m)" : " (ft)" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='elevation' type='number' step='1'" + ( OSApp.currentDevice.isMetric ? "min='-400' max='9000'" : "min='-1400' max='30000'" ) + " value='" + options.elevation + "'>" +
					"</div>" +
				"</div>" +
				"<button class='detect-baseline-eto'>" + OSApp.Language._( "Detect baseline ETo" ) + "</button>" +
				"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>"
	);

	popup.find( ".submit" ).on( "click", function() {
		options = {
			baseETo: parseFloat( popup.find( ".baseline-ETo" ).val() ),
			elevation: parseInt( popup.find( ".elevation" ).val() )
		};

		// Convert to imperial before storing.
		if ( OSApp.currentDevice.isMetric ) {
			options.baseETo = Math.round( options.baseETo / 25.4 * 100 ) / 100;
			options.elevation = Math.round( options.elevation * 3.28 );
		}

		if ( button ) {
			button.value = OSApp.Utils.escapeJSON( options );
		}

		callback();

		popup.popup( "close" );
		return false;
	} );

	popup.find( ".detect-baseline-eto" ).on( "click", function() {

		// Backup button contents so it can be restored after the request is completed.
		var buttonContents = $( ".detect-baseline-eto" ).html();

		OSApp.UIDom.showLoading( ".detect-baseline-eto" );

		$.ajax( {
			url: OSApp.Weather.WEATHER_SERVER_URL + "/baselineETo?loc=" + encodeURIComponent( OSApp.currentSession.controller.settings.loc ),
			contentType: "application/json; charset=utf-8",
			success: function( data ) {

				var baselineETo = data.eto;

				// Convert to metric if necessary.
				if ( OSApp.currentDevice.isMetric ) {
					baselineETo = Math.round( baselineETo * 25.4 * 100 ) / 100;
				}

				$( ".baseline-ETo" ).val( baselineETo );

				window.alert( "Detected baseline ETo for configured location is " + baselineETo + ( OSApp.currentDevice.isMetric ? "mm" : "in" ) + "/day" );
			},
			error: function( xhr, errorType ) {

				// Use the response body for HTTP errors and the error type for JQuery errors.
				var errorMessage = "Unable to detect baseline ETo: " +
					( xhr.status ? xhr.responseText + "(" + xhr.status + ")" : errorType );
				window.alert( errorMessage );
				window.console.error( errorMessage );
			},
			complete: function( ) {
				$( ".detect-baseline-eto" ).html( buttonContents );
			}
		} );

		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {

		// Generic min/max checker for each option.
		var min = parseFloat( this.min ),
			max = parseFloat( this.max );

		if ( this.value === "" ) {
			this.value = "0";
		}
		if ( this.value < min || this.value > max ) {
			this.value = this.value < min ? min : max;
		}
	} );

	$( "#adjustmentOptions" ).remove();

	popup.css( "max-width", "380px" );

	OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
}

function formatTemp( temp ) {
	if ( OSApp.currentDevice.isMetric ) {
		temp = Math.round( ( temp - 32 ) * ( 5 / 9 ) * 10 ) / 10 + " &#176;C";
	} else {
		temp = Math.round( temp * 10 ) / 10 + " &#176;F";
	}
	return temp;
}

function formatPrecip( precip ) {
	if ( OSApp.currentDevice.isMetric ) {
		precip = Math.round( precip * 25.4 * 10 ) / 10 + " mm";
	} else {
		precip = Math.round( precip * 100 ) / 100 + " in";
	}
	return precip;
}

function formatHumidity( humidity ) {
	return Math.round( humidity ) + " %";
}

function formatSpeed( speed ) {
	if ( OSApp.currentDevice.isMetric ) {
		speed = Math.round( speed * 1.6 * 10 ) / 10 + " km/h";
	} else {
		speed = Math.round( speed * 10 ) / 10 + " mph";
	}
	return speed;
}

function hideWeather() {
	$( "#weather" ).empty().parents( ".info-card" ).addClass( "noweather" );
}

function finishWeatherUpdate() {
	updateWeatherBox();
	$.mobile.document.trigger( "weatherUpdateComplete" );
}

function updateWeather() {
	var now = new Date().getTime();

	if ( OSApp.currentSession.weather && OSApp.currentSession.weather.providedLocation === OSApp.currentSession.controller.settings.loc && now - OSApp.currentSession.weather.lastUpdated < 60 * 60 * 100 ) {
		finishWeatherUpdate();
		return;
	} else if ( localStorage.weatherData ) {
		try {
			var weatherData = JSON.parse( localStorage.weatherData );
			if ( weatherData.providedLocation === OSApp.currentSession.controller.settings.loc && now - weatherData.lastUpdated < 60 * 60 * 100 ) {
				OSApp.currentSession.weather = weatherData;
				finishWeatherUpdate();
				return;
			}
		} catch ( err ) {}
	}

	OSApp.currentSession.weather = undefined;

	if ( OSApp.currentSession.controller.settings.loc === "" ) {
		hideWeather();
		return;
	}

	OSApp.UIDom.showLoading( "#weather" );

	$.ajax( {
		url: OSApp.currentSession.weatherServerUrl + "/weatherData?loc=" +
			encodeURIComponent( OSApp.currentSession.controller.settings.loc ),
		contentType: "application/json; charset=utf-8",
		success: function( data ) {

			// Hide the weather if no data is returned
			if ( typeof data !== "object" ) {
				hideWeather();
				return;
			}

			OSApp.currentSession.coordinates = data.location;

			OSApp.currentSession.weather = data;
			data.lastUpdated = new Date().getTime();
			data.providedLocation = OSApp.currentSession.controller.settings.loc;
			localStorage.weatherData = JSON.stringify( data );
			finishWeatherUpdate();
		}
	} );
}

function checkURLandUpdateWeather() {
	var finish = function( wsp ) {
		if ( wsp ) {
			OSApp.currentSession.weatherServerUrl = OSApp.currentSession.prefix + wsp;
		} else {
			OSApp.currentSession.weatherServerUrl = OSApp.Constants.weather.DEFAULT_WEATHER_SERVER_URL;
		}

		updateWeather();
	};

	if ( OSApp.currentSession.controller.settings.wsp ) {
		if ( OSApp.currentSession.controller.settings.wsp === "weather.opensprinkler.com" ) {
			finish();
			return;
		}

		finish( OSApp.currentSession.controller.settings.wsp );
		return;
	}

	return $.get( OSApp.currentSession.prefix + OSApp.currentSession.ip + "/su" ).then( function( reply ) {
		var wsp = reply.match( /value="([\w|:|/|.]+)" name=wsp/ );
		finish( wsp ? wsp[ 1 ] : undefined );
	} );
}

function updateWeatherBox() {
	$( "#weather" )
		.html(
			( OSApp.currentSession.controller.settings.rd ? "<div class='rain-delay red'><span class='icon ui-icon-alert'></span>Rain Delay<span class='time'>" + OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.rdst * 1000 ), undefined, true ) + "</span></div>" : "" ) +
			"<div title='" + OSApp.currentSession.weather.description + "' class='wicon'><img src='https://openweathermap.org/img/w/" + OSApp.currentSession.weather.icon + ".png'></div>" +
			"<div class='inline tight'>" + formatTemp( OSApp.currentSession.weather.temp ) + "</div><br><div class='inline location tight'>" + OSApp.Language._( "Current Weather" ) + "</div>" +
			( typeof OSApp.currentSession.weather.alert === "object" ? "<div><button class='tight help-icon btn-no-border ui-btn ui-icon-alert ui-btn-icon-notext ui-corner-all'></button>" + OSApp.currentSession.weather.alert.type + "</div>" : "" ) )
		.off( "click" ).on( "click", function( event ) {
			var target = $( event.target );
			if ( target.hasClass( "rain-delay" ) || target.parents( ".rain-delay" ).length ) {
				areYouSure( OSApp.Language._( "Do you want to turn off rain delay?" ), "", function() {
					OSApp.UIDom.showLoading( "#weather" );
					OSApp.Firmware.sendToOS( "/cv?pw=&rd=0" ).done( function() {
						updateController( updateWeather );
					} );
				} );
			} else {
				OSApp.UIDom.changePage( "#forecast" );
			}
			return false;
		} )
		.parents( ".info-card" ).removeClass( "noweather" );
}

function coordsToLocation( lat, lon, callback, fallback ) {
	fallback = fallback || lat + "," + lon;

	$.getJSON( "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + lat + "," + lon + "&key=AIzaSyDaT_HTZwFojXmvYIhwWudK00vFXzMmOKc&result_type=locality|sublocality|administrative_area_level_1|country", function( data ) {
		if ( data.results.length === 0 ) {
			callback( fallback );
			return;
		}

		data = data.results;
		fallback = data[ 0 ].formatted_address;

		var hasEnd = false;

		for ( var item in data ) {
			if ( data.hasOwnProperty( item ) ) {
				if ( $.inArray( "locality", data[ item ].types ) > -1 ||
					 $.inArray( "sublocality", data[ item ].types ) > -1 ||
					 $.inArray( "postal_code", data[ item ].types ) > -1 ||
					 $.inArray( "street_address", data[ item ].types ) > -1 ) {
						hasEnd = true;
						break;
				}
			}
		}

		if ( hasEnd === false ) {
			callback( fallback );
			return;
		}

		data = data[ item ].address_components;

		var location = "",
			country = "";

		hasEnd = false;

		for ( item in data ) {
			if ( data.hasOwnProperty( item ) && !hasEnd ) {
				if ( location === "" && $.inArray( "locality", data[ item ].types ) > -1 ) {
					location = data[ item ].long_name + ", " + location;
				}

				if ( location === "" && $.inArray( "sublocality", data[ item ].types ) > -1 ) {
					location = data[ item ].long_name + ", " + location;
				}

				if ( $.inArray( "administrative_area_level_1", data[ item ].types ) > -1 ) {
					location += data[ item ].long_name;
					hasEnd = true;
				}

				if ( $.inArray( "country", data[ item ].types ) > -1 ) {
					country = data[ item ].long_name;
				}
			}
		}

		if ( !hasEnd ) {
			location += country;
		}

		callback( location );
	} );
}

function getSunTimes( date ) {
	date = date || new Date( OSApp.currentSession.controller.settings.devt * 1000 );

	var times = SunCalc.getTimes( date, OSApp.currentSession.coordinates[ 0 ], OSApp.currentSession.coordinates[ 1 ] ),
		sunrise = times.sunrise,
		sunset = times.sunset,
		tzOffset = OSApp.Dates.getTimezoneOffsetOS();

	sunrise.setUTCMinutes( sunrise.getUTCMinutes() + tzOffset );
	sunset.setUTCMinutes( sunset.getUTCMinutes() + tzOffset );

	sunrise = ( sunrise.getUTCHours() * 60 + sunrise.getUTCMinutes() );
	sunset = ( sunset.getUTCHours() * 60 + sunset.getUTCMinutes() );

	return [ sunrise, sunset ];
}

function makeAttribution( provider ) {
	if ( typeof provider !== "string" ) { return ""; }

	var attrib = "<div class='weatherAttribution'>";
	switch ( provider ) {
		case "Apple":
			attrib += OSApp.Language._( "Powered by Apple" );
			break;
		case "DarkSky":
		case "DS":
			attrib += "<a href='https://darksky.net/poweredby/' target='_blank'>" + OSApp.Language._( "Powered by Dark Sky" ) + "</a>";
			break;
		case "OWM":
			attrib += "<a href='https://openweathermap.org/' target='_blank'>" + OSApp.Language._( "Powered by OpenWeather" ) + "</a>";
			break;
		case "DWD":
				attrib += "<a href='https://brightsky.dev/' target='_blank'>" + OSApp.Language._( "Powered by Bright Sky+DWD" ) + "</a>";
				break;
		case "OpenMeteo":
		case "OM":
				attrib += "<a href='https://open-meteo.com/' target='_blank'>" + OSApp.Language._( "Powered by Open Meteo" ) + "</a>";
				break;
		case "WUnderground":
		case "WU":
			attrib += "<a href='https://wunderground.com/' target='_blank'>" + OSApp.Language._( "Powered by Weather Underground" ) + "</a>";
			break;
		case "local":
			attrib += OSApp.Language._( "Powered by your Local PWS" );
			break;
		case "Manual":
			attrib += OSApp.Language._( "Using manual watering" );
			break;
		default:
			attrib += OSApp.Language._( "Unrecognised weather provider" );
			break;
	}
	return attrib + "</div>";
}

function showForecast() {
	var page = $( "<div data-role='page' id='forecast'>" +
			"<div class='ui-content' role='main'>" +
				"<ul data-role='listview' data-inset='true'>" +
					makeForecast() +
				"</ul>" +
				makeAttribution( OSApp.currentSession.weather.wp || OSApp.currentSession.weather.weatherProvider ) +
			"</div>" +
		"</div>" );

	OSApp.UIDom.changeHeader( {
		title: OSApp.Language._( "Forecast" ),
		leftBtn: {
			icon: "carat-l",
			text: OSApp.Language._( "Back" ),
			class: "ui-toolbar-back-btn",
			on: OSApp.UIDom.goBack
		},
		rightBtn: {
			icon: "refresh",
			text: OSApp.Language._( "Refresh" ),
			on: function() {
				$.mobile.loading( "show" );
				$.mobile.document.one( "weatherUpdateComplete", function() {
					$.mobile.loading( "hide" );
				} );
				updateWeather();
			}
		}
	} );

	page.one( "pagehide", function() {
		page.remove();
	} );

	page.find( ".alert" ).on( "click", function() {
		OSApp.UIDom.openPopup( $( "<div data-role='popup' data-theme='a'>" +
				"<div data-role='header' data-theme='b'>" +
					"<h1>" + OSApp.currentSession.weather.alert.name + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
					"<span style='white-space: pre-wrap'>" + $.trim( OSApp.currentSession.weather.alert.message ) + "</span>" +
				"</div>" +
			"</div>" ) );
	} );

	$( "#forecast" ).remove();
	$.mobile.pageContainer.append( page );
}

function makeForecast() {
	var list = "",
		sunrise = OSApp.currentSession.controller.settings.sunrise ? OSApp.currentSession.controller.settings.sunrise : getSunTimes()[ 0 ],
		sunset = OSApp.currentSession.controller.settings.sunset ? OSApp.currentSession.controller.settings.sunset : getSunTimes()[ 1 ],
		i, date, times;

	var weekdays = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];

	list += "<li data-icon='false' class='center'>" +
			"<div>" + OSApp.Language._( "Now" ) + "</div><br>" +
			"<div title='" + OSApp.currentSession.weather.description + "' class='wicon'><img src='https://openweathermap.org/img/w/" + OSApp.currentSession.weather.icon + ".png'></div>" +
			"<span>" + formatTemp( OSApp.currentSession.weather.temp ) + "</span><br>" +
			"<span>" + OSApp.Language._( "Sunrise" ) + "</span><span>: " + OSApp.Utils.pad( parseInt( sunrise / 60 ) % 24 ) + ":" + OSApp.Utils.pad( sunrise % 60 ) + "</span> " +
			"<span>" + OSApp.Language._( "Sunset" ) + "</span><span>: " + OSApp.Utils.pad( parseInt( sunset / 60 ) % 24 ) + ":" + OSApp.Utils.pad( sunset % 60 ) + "</span>" +
		"</li>";

	for ( i = 1; i < OSApp.currentSession.weather.forecast.length; i++ ) {
		date = new Date( OSApp.currentSession.weather.forecast[ i ].date * 1000 );
		times = getSunTimes( date );

		sunrise = times[ 0 ];
		sunset = times[ 1 ];

		list += "<li data-icon='false' class='center'>" +
				"<div>" + date.toLocaleDateString() + "</div><br>" +
				"<div title='" + OSApp.currentSession.weather.forecast[ i ].description + "' class='wicon'><img src='https://openweathermap.org/img/w/" + OSApp.currentSession.weather.forecast[ i ].icon + ".png'></div>" +
				"<span>" + OSApp.Language._( weekdays[ date.getDay() ] ) + "</span><br>" +
				"<span>" + OSApp.Language._( "Low" ) + "</span><span>: " + formatTemp( OSApp.currentSession.weather.forecast[ i ].temp_min ) + "  </span>" +
				"<span>" + OSApp.Language._( "High" ) + "</span><span>: " + formatTemp( OSApp.currentSession.weather.forecast[ i ].temp_max ) + "</span><br>" +
				"<span>" + OSApp.Language._( "Sunrise" ) + "</span><span>: " + OSApp.Utils.pad( parseInt( sunrise / 60 ) % 24 ) + ":" + OSApp.Utils.pad( sunrise % 60 ) + "</span> " +
				"<span>" + OSApp.Language._( "Sunset" ) + "</span><span>: " + OSApp.Utils.pad( parseInt( sunset / 60 ) % 24 ) + ":" + OSApp.Utils.pad( sunset % 60 ) + "</span>" +
			"</li>";
	}

	return list;
}

function overlayMap( callback ) {

	// Looks up the location and shows a list possible matches for selection
	// Returns the selection to the callback
	$( "#location-list" ).popup( "destroy" ).remove();
	$.mobile.loading( "show" );

	callback = callback || function() {};

	var popup = $( "<div data-role='popup' id='location-list' data-theme='a' style='background-color:rgb(229, 227, 223);'>" +
			"<a href='#' data-rel='back' class='ui-btn ui-corner-all ui-shadow ui-btn-b ui-icon-delete ui-btn-icon-notext ui-btn-right'>" + OSApp.Language._( "Close" ) + "</a>" +
				"<iframe style='border:none' src='" + OSApp.UIDom.getAppURLPath() + "map.html' width='100%' height='100%' seamless=''></iframe>" +
		"</div>" ),
		getCurrentLocation = function( callback ) {
			callback = callback || function( result ) {
				if ( result ) {
					iframe.get( 0 ).contentWindow.postMessage( {
						type: "currentLocation",
						payload: {
							lat: result.coords.latitude,
							lon: result.coords.longitude
						}
					}, "*" );
				}
			};

			var exit = function( result ) {
					clearTimeout( loadMsg );
					$.mobile.loading( "hide" );

					if ( !result ) {
						OSApp.Errors.showError( OSApp.Language._( "Unable to retrieve your current location" ) );
					}

					callback( result );
				},
				loadMsg;

			try {
				loadMsg = setTimeout( function() {
					$.mobile.loading( "show", {
						html: "<div class='logo'></div><h1 style='padding-top:5px'>" + OSApp.Language._( "Attempting to retrieve your current location" ) + "</h1></p>",
						textVisible: true,
						theme: "b"
					} );
				}, 100 );
				navigator.geolocation.getCurrentPosition( function( position ) {
					clearTimeout( loadMsg );
					exit( position );
				}, function() {
					exit( false );
				}, { timeout: 10000 } );
			} catch ( err ) { exit( false ); }
		},
		updateStations = function( latitude, longitude ) {
			var key = $( "#wtkey" ).val();
			if ( key === "" ) {
				return;
			}

			$.ajax( {
				url: "https://api.weather.com/v3/location/near?format=json&product=pws&apiKey=" + key +
						"&geocode=" + encodeURIComponent( latitude ) + "," + encodeURIComponent( longitude ),
				cache: true
			} ).done( function( data ) {
				var sortedData = [];

				data.location.stationId.forEach( function( id, index ) {
					sortedData.push( {
						id: id,
						lat: data.location.latitude[ index ],
						lon: data.location.longitude[ index ],
						message: data.location.stationId[ index ]
					} );
				} );

				if ( sortedData.length > 0 ) {
					sortedData = encodeURIComponent( JSON.stringify( sortedData ) );
					iframe.get( 0 ).contentWindow.postMessage( {
						type: "pwsData",
						payload: sortedData
					}, "*" );
				}
			} );
		},
		iframe = popup.find( "iframe" ),
		locInput = $( "#loc" ).val(),
		current = {
			lat: locInput.match( OSApp.Constants.regex.GPS ) ? locInput.split( "," )[ 0 ] : OSApp.currentSession.coordinates[ 0 ],
			lon: locInput.match( OSApp.Constants.regex.GPS ) ? locInput.split( "," )[ 1 ] : OSApp.currentSession.coordinates[ 1 ]
		},
		dataSent = false;

	// Wire in listener for communication from iframe
	$.mobile.window.off( "message onmessage" ).on( "message onmessage", function( e ) {
		var data = e.originalEvent.data;

		if ( typeof data.WS !== "undefined" ) {
			var coords = data.WS.split( "," );
			callback( coords.length > 1 ? coords : data.WS, data.station );
			dataSent = true;
			popup.popup( "destroy" ).remove();
		} else if ( data.loaded === true ) {
			$.mobile.loading( "hide" );
		} else if ( typeof data.location === "object" ) {
			updateStations( data.location[ 0 ], data.location[ 1 ] );
		} else if ( data.dismissKeyboard === true ) {
			document.activeElement.blur();
		} else if ( data.getLocation === true ) {
			getCurrentLocation();
		}
	} );

	iframe.one( "load", function() {
		if ( current.lat === 0 && current.lon === 0 ) {
			getCurrentLocation();
		}

		this.contentWindow.postMessage( {
			type: "startLocation",
			payload: {
				start: current
			}
		}, "*" );
	} );

	popup.one( "popupafterclose", function() {
		if ( dataSent === false ) {
			callback( false );
		}
	} );

	OSApp.UIDom.openPopup( popup, {
		beforeposition: function() {
			popup.css( {
				width: window.innerWidth - 36,
				height: window.innerHeight - 28
			} );
		},
		x: 0,
		y: 0
	} );

	updateStations( current.lat, current.lon );
}

// Ensure error codes align with reboot causes in Firmware defines.h
var rebootReasons =	{ 0: OSApp.Language._( "None" ), 1: OSApp.Language._( "Factory Reset" ), 2: OSApp.Language._( "Reset Button" ), 3: OSApp.Language._( "WiFi Change" ),
					4: OSApp.Language._( "Web Request" ), 5: OSApp.Language._( "Web Request" ), 6: OSApp.Language._( "WiFi Configure" ), 7: OSApp.Language._( "Firmware Update" ),
					8: OSApp.Language._( "Weather Failure" ), 9: OSApp.Language._( "Network Failure" ), 10: OSApp.Language._( "Clock Update" ), 99: OSApp.Language._( "Power On" ) };

// Ensure error codes align with App errors.ts (codes > 0) and HTTP error codes in Firmware defines.h (codes < 0)
var weatherErrors = {
	"-4":	OSApp.Language._( "Empty Response" ),
	"-3":	OSApp.Language._( "Timed Out" ),
	"-2":	OSApp.Language._( "Connection Failed" ),
	"-1":	OSApp.Language._( "No Response" ),
	"0":	OSApp.Language._( "Success" ),
	"1":	OSApp.Language._( "Weather Data Error" ),
	"10":	OSApp.Language._( "Building Weather History" ),
	"11":	OSApp.Language._( "Weather Provider Response Incomplete" ),
	"12":	OSApp.Language._( "Weather Provider Request Failed" ),
	"2":	OSApp.Language._( "Location Error" ),
	"20":	OSApp.Language._( "Location Request Error" ),
	"21":	OSApp.Language._( "Location Not Found" ),
	"22":	OSApp.Language._( "Invalid Location Format" ),
	"3":	OSApp.Language._( "PWS Error" ),
	"30":	OSApp.Language._( "Invalid WUnderground PWS" ),
	"31":	OSApp.Language._( "Invalid WUnderground Key" ),
	"32":	OSApp.Language._( "WUnderground Authentication Error" ),
	"33":	OSApp.Language._( "Unsupported WUnderground Method" ),
	"34":	OSApp.Language._( "No WUnderground PWS Provided" ),
	"4":	OSApp.Language._( "Adjustment Method Error" ),
	"40":	OSApp.Language._( "Unsupported Adjustment Method" ),
	"41":	OSApp.Language._( "No Adjustment Method Provided" ),
	"5":	OSApp.Language._( "Adjustment Options Error" ),
	"50":	OSApp.Language._( "Corrupt Adjustment Options" ),
	"51":	OSApp.Language._( "Missing Adjustment Option" ),
	"99":	OSApp.Language._( "Unexpected Error" )
};

function getRebootReason( reason ) {
	if ( reason in rebootReasons ) {
		return rebootReasons[ reason ];
	}

	return OSApp.Language._( "Unrecognised" ) + " (" + reason + ")";
}

function getWeatherError( err ) {
	var errType = Math.floor( err / 10 );

	if ( err in weatherErrors ) {
		return weatherErrors[ err ];
	} else if ( err <= 59 && err >= 10 && errType in weatherErrors ) {
		return weatherErrors[ errType ];
	}

	return OSApp.Language._( "Unrecognised" ) + " (" + err + ")";
}

function getWeatherStatus( status ) {
	if ( status < 0 ) {
		return "<font class='debugWUError'>" + OSApp.Language._( "Offline" ) + "</font>";
	} else if ( status > 0 ) {
		return "<font class='debugWUError'>" + OSApp.Language._( "Error" ) + "</font>";
	} else {
		return "<font class='debugWUOK'>" + OSApp.Language._( "Online" ) + "</font>";
	}
}

function getWiFiRating( rssi ) {
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
}

function debugWU() {
	var popup = "<div data-role='popup' id='debugWU' class='ui-content ui-page-theme-a'>";

	popup += "<div class='debugWUHeading'>System Status</div>" +
			"<table class='debugWUTable'>" +
				( typeof OSApp.currentSession.controller.settings.lupt === "number" ? "<tr><td>" + OSApp.Language._( "Last Reboot" ) + "</td><td>" +
					( OSApp.currentSession.controller.settings.lupt < 1000 ? "--" : OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.lupt * 1000 ), null, 2 ) ) + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.lrbtc === "number" ? "<tr><td>" + OSApp.Language._( "Reboot Reason" ) + "</td><td>" + getRebootReason( OSApp.currentSession.controller.settings.lrbtc ) + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.RSSI === "number" ? "<tr><td>" + OSApp.Language._( "WiFi Strength" ) + "</td><td>" + getWiFiRating( OSApp.currentSession.controller.settings.RSSI ) + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.wterr === "number" ? "<tr><td>" + OSApp.Language._( "Weather Service" ) + "</td><td>" + getWeatherStatus( OSApp.currentSession.controller.settings.wterr ) + "</td></tr>" : "" ) +
			"</table>" +
			"<div class='debugWUHeading'>Watering Level</div>" +
			"<table class='debugWUTable'>" +
				( typeof OSApp.currentSession.controller.options.uwt !== "undefined" ? "<tr><td>" + OSApp.Language._( "Method" ) + "</td><td>" + getAdjustmentMethod( OSApp.currentSession.controller.options.uwt ).name + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.options.wl !== "undefined" ? "<tr><td>" + OSApp.Language._( "Watering Level" ) + "</td><td>" + OSApp.currentSession.controller.options.wl + " %</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.lswc === "number" ? "<tr><td>" + OSApp.Language._( "Last Updated" ) + "</td><td>" +
					( OSApp.currentSession.controller.settings.lswc === 0  ? OSApp.Language._( "Never" ) : OSApp.Dates.humaniseDuration( OSApp.currentSession.controller.settings.devt * 1000, OSApp.currentSession.controller.settings.lswc * 1000 ) ) + "</td></tr>" : "" ) +
			"</table>" +
			"<div class='debugWUHeading'>Weather Service Details</div>" +
			"<div class='debugWUScrollable'>" +
			"<table class='debugWUTable'>";

	if ( typeof OSApp.currentSession.controller.settings.wtdata === "object" && Object.keys( OSApp.currentSession.controller.settings.wtdata ).length > 0 ) {
		popup += ( typeof OSApp.currentSession.controller.settings.wtdata.h !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Humidity" ) + "</td><td>" + formatHumidity( OSApp.currentSession.controller.settings.wtdata.h ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.t !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Temp" ) + "</td><td>" + formatTemp( OSApp.currentSession.controller.settings.wtdata.t ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.p !== "undefined" ? "<tr><td>" + OSApp.Language._( "Total Rain" ) + "</td><td>" + formatPrecip( OSApp.currentSession.controller.settings.wtdata.p ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.eto !== "undefined" ? "<tr><td>" + OSApp.Language._( "ETo" ) + "</td><td>" + formatPrecip( OSApp.currentSession.controller.settings.wtdata.eto ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.radiation !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Radiation" ) + "</td><td>" + OSApp.currentSession.controller.settings.wtdata.radiation + " kWh/m2</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.minT !== "undefined" ? "<tr><td>" + OSApp.Language._( "Min Temp" ) + "</td><td>" + formatTemp( OSApp.currentSession.controller.settings.wtdata.minT ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.maxT !== "undefined" ? "<tr><td>" + OSApp.Language._( "Max Temp" ) + "</td><td>" + formatTemp( OSApp.currentSession.controller.settings.wtdata.maxT ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.minH !== "undefined" ? "<tr><td>" + OSApp.Language._( "Min Humidity" ) + "</td><td>" + formatHumidity( OSApp.currentSession.controller.settings.wtdata.minH ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.maxH !== "undefined" ? "<tr><td>" + OSApp.Language._( "Max Humidity" ) + "</td><td>" + formatHumidity( OSApp.currentSession.controller.settings.wtdata.maxH ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.wind !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Wind" ) + "</td><td>" + formatSpeed( OSApp.currentSession.controller.settings.wtdata.wind ) + "</td></tr>" : "" );
	}

	popup += ( typeof OSApp.currentSession.controller.settings.lwc === "number" ? "<tr><td>" + OSApp.Language._( "Last Request" ) + "</td><td>" + OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.lwc * 1000 ), null, 2 ) + "</td></tr>" : "" );
	popup += ( typeof OSApp.currentSession.controller.settings.wterr === "number" ? "<tr><td>" + OSApp.Language._( "Last Response" ) + "</td><td>" + getWeatherError( OSApp.currentSession.controller.settings.wterr ) + "</td></tr>" : "" );
	popup += "</table></div>";

	if ( typeof OSApp.currentSession.controller.settings.otcs === "number" ) {
		popup += "<div class='debugWUHeading'>Integrations</div>" +
			"<table class='debugWUTable'>" +
			"<tr><td>OpenThings Cloud</td><td>" + resolveOTCStatus( OSApp.currentSession.controller.settings.otcs ) + "</td></tr>" +
		"</table>";
	}

	if ( OSApp.currentSession.controller.settings.wtdata && ( typeof OSApp.currentSession.controller.settings.wtdata.wp === "string" || typeof OSApp.currentSession.controller.settings.wtdata.weatherProvider === "string" ) ) {
		popup += "<hr>";
		popup += makeAttribution( OSApp.currentSession.controller.settings.wtdata.wp || OSApp.currentSession.controller.settings.wtdata.weatherProvider );
	}
	popup += "</div>";

	OSApp.UIDom.openPopup( $( popup ) );

	return false;
}

function resolveOTCStatus( status ) {
	switch ( status ) {
		case 0:
			return "Not Enabled";
		case 1:
			return "Connecting...";
		case 2:
			return "<font class='debugWUError'>Disconnected</font>";
		case 3:
			return "<font class='debugWUOK'>Connected</font>";
	}
}

function showRainDelay() {
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	showDurationBox( {
		title: OSApp.Language._( "Change Rain Delay" ),
		callback: raindelay,
		label: OSApp.Language._( "Duration" ),
		maximum: 31536000,
		granularity: 2,
		preventCompression: true,
		incrementalUpdate: false,
		updateOnChange: false,
		helptext:
			OSApp.Language._( "Enable manual rain delay by entering a value into the input below. To turn off a currently enabled rain delay use a value of 0." )
	} );
}

function showPause() {
	if ( OSApp.StationQueue.isPaused() ) {
		areYouSure( OSApp.Language._( "Do you want to resume program operation?" ), "", function() {
			OSApp.Firmware.sendToOS( "/pq?pw=" );
		} );
	} else {
		showDurationBox( {
			title: "Pause Station Runs",
			incrementalUpdate: false,
			maximum: 65535,
			callback: function( duration ) {
				OSApp.Firmware.sendToOS( "/pq?dur=" + duration + "&pw=" );
			}
		} );
	}
}

/** Returns the adjustment method for the corresponding ID, or a list of all methods if no ID is specified. */
function getAdjustmentMethod( id ) {
    var methods = [
        { name: OSApp.Language._( "Manual" ), id: 0 },
        { name: "Zimmerman", id: 1 },
        { name: OSApp.Language._( "Auto Rain Delay" ), id: 2, minVersion: 216 },
		{ name: "ETo", id: 3, minVersion: 216 },
		{ name: "Monthly", id:4, minVersion: 220 }
    ];

    if ( id === undefined ) {
        return methods;
    }

	return methods[ id & ~( 1 << 7 ) ];
}

function getCurrentAdjustmentMethodId() {
	return OSApp.currentSession.controller.options.uwt & ~( 1 << 7 );
}

function getRestriction( id ) {
	return [ {
				isCurrent: 0,
				name: OSApp.Language._( "None" )
			},
			{
				isCurrent: ( ( OSApp.currentSession.controller.options.uwt >> 7 ) & 1 ) ? true : false,
				name: OSApp.Language._( "California Restriction" )
			} ][ id ];
}

function setRestriction( id, uwt ) {
	uwt = uwt || OSApp.currentSession.controller.options.uwt & ~( 1 << 7 );

	if ( id === 1 ) {
		uwt |= ( 1 << 7 );
	}

	return uwt;
}

function testAPIKey( key, callback ) {
	$.ajax( {
		url: "https://api.weather.com/v2/pws/observations/current?stationId=KMAHANOV10&format=json&units=m&apiKey=" + key,
		cache: true
	} ).done( function( data ) {
		if ( data.errors ) {
			callback( false );
			return;
		}
		callback( true );
	} ).fail( function() {
		callback( false );
	} );
}

// Device setting management functions
function showOptions( expandItem ) {
	var list = "",
		page = $( "<div data-role='page' id='os-options'>" +
			"<div class='ui-content' role='main'>" +
				"<div data-role='collapsibleset' id='os-options-list'>" +
				"</div>" +
				"<a class='submit preventBack' style='display:none'></a>" +
			"</div>" +
		"</div>" ),
		generateSensorOptions = function( index, sensorType, number ) {
			return "<div class='ui-field-contain'>" +
				"<fieldset data-role='controlgroup' class='ui-mini center sensor-options' data-type='horizontal'>" +
					"<legend class='left'>" + OSApp.Language._( "Sensor" ) + ( number ? " " + number + " " : " " ) + OSApp.Language._( "Type" ) + "</legend>" +
					"<input class='noselect' type='radio' name='o" + index + "' id='o" + index + "-none' value='0'" + ( sensorType === 0 ? " checked='checked'" : "" ) + ">" +
					"<label for='o" + index + "-none'>" + OSApp.Language._( "None" ) + "</label>" +
					"<input class='noselect' type='radio' name='o" + index + "' id='o" + index + "-rain' value='1'" + ( sensorType === 1 ? " checked='checked'" : "" ) + ">" +
					"<label for='o" + index + "-rain'>" + OSApp.Language._( "Rain" ) + "</label>" +
					( index === 52 ? "" : "<input class='noselect' type='radio' name='o" + index + "' id='o" + index + "-flow' value='2'" + ( sensorType === 2 ? " checked='checked'" : "" ) + ">" +
						"<label for='o" + index + "-flow'>" + OSApp.Language._( "Flow" ) + "</label>" ) +
					( OSApp.Firmware.checkOSVersion( 219 ) ? "<input class='noselect' type='radio' name='o" + index + "' id='o" + index + "-soil' value='3'" + ( sensorType === 3 ? " checked='checked'" : "" ) + ">" +
						"<label for='o" + index + "-soil'>" + OSApp.Language._( "Soil" ) + "</label>" : "" ) +
					( OSApp.Firmware.checkOSVersion( 217 ) ? "<input class='noselect' type='radio' name='o" + index + "' id='o" + index + "-program' value='240'" + ( sensorType === 240 ? " checked='checked'" : "" ) + ">" +
						"<label for='o" + index + "-program'>" + OSApp.Language._( "Program Switch" ) + "</label>" : "" ) +
				"</fieldset>" +
			"</div>";
		},
		submitOptions = function() {
			var opt = {},
				invalid = false,
				isPi = OSApp.Firmware.isOSPi(),
				button = header.eq( 2 ),
				key;

			button.prop( "disabled", true );
			page.find( ".submit" ).removeClass( "hasChanges" );

			page.find( "#os-options-list" ).find( ":input,button" ).filter( ":not(.noselect)" ).each( function() {
				var $item = $( this ),
					id = $item.attr( "id" ),
					data = $item.val(),
					ip;

				if ( !id || ( !data && data !== "" ) ) {
					return true;
				}

				switch ( id ) {
					case "o1":
						var tz = data.split( ":" );
						tz[ 0 ] = parseInt( tz[ 0 ], 10 );
						tz[ 1 ] = parseInt( tz[ 1 ], 10 );
						tz[ 1 ] = ( tz[ 1 ] / 15 >> 0 ) / 4.0;tz[ 0 ] = tz[ 0 ] + ( tz[ 0 ] >= 0 ? tz[ 1 ] : -tz[ 1 ] );
						data = ( ( tz[ 0 ] + 12 ) * 4 ) >> 0;
						break;
					case "datetime":
						var dt = new Date( data * 1000 );

						opt.tyy = dt.getUTCFullYear();
						opt.tmm = dt.getUTCMonth();
						opt.tdd = dt.getUTCDate();
						opt.thh = dt.getUTCHours();
						opt.tmi = dt.getUTCMinutes();
						opt.ttt = Math.round( dt.getTime() / 1000 );

						return true;
					case "ip_addr":
						ip = data.split( "." );

						if ( ip === "0.0.0.0" ) {
							OSApp.Errors.showError( OSApp.Language._( "A valid IP address is required when DHCP is not used" ) );
							invalid = true;
							return false;
						}

						opt.o4 = ip[ 0 ];
						opt.o5 = ip[ 1 ];
						opt.o6 = ip[ 2 ];
						opt.o7 = ip[ 3 ];

						return true;
					case "subnet":
						ip = data.split( "." );

						if ( ip === "0.0.0.0" ) {
							OSApp.Errors.showError( OSApp.Language._( "A valid subnet address is required when DHCP is not used" ) );
							invalid = true;
							return false;
						}

						opt.o58 = ip[ 0 ];
						opt.o59 = ip[ 1 ];
						opt.o60 = ip[ 2 ];
						opt.o61 = ip[ 3 ];

						return true;
					case "gateway":
						ip = data.split( "." );

						if ( ip === "0.0.0.0" ) {
							OSApp.Errors.showError( OSApp.Language._( "A valid gateway address is required when DHCP is not used" ) );
							invalid = true;
							return false;
						}

						opt.o8 = ip[ 0 ];
						opt.o9 = ip[ 1 ];
						opt.o10 = ip[ 2 ];
						opt.o11 = ip[ 3 ];

						return true;
					case "dns":
						ip = data.split( "." );

						if ( ip === "0.0.0.0" ) {
							OSApp.Errors.showError( OSApp.Language._( "A valid DNS address is required when DHCP is not used" ) );
							invalid = true;
							return false;
						}

						opt.o44 = ip[ 0 ];
						opt.o45 = ip[ 1 ];
						opt.o46 = ip[ 2 ];
						opt.o47 = ip[ 3 ];

						return true;
					case "ntp_addr":
						ip = data.split( "." );

						opt.o32 = ip[ 0 ];
						opt.o33 = ip[ 1 ];
						opt.o34 = ip[ 2 ];
						opt.o35 = ip[ 3 ];

						return true;
					case "wtkey":
						return true;
					case "wto":
						data = OSApp.Utils.escapeJSON( $.extend( {}, OSApp.Utils.unescapeJSON( data ), { key: page.find( "#wtkey" ).val() } ) );

						if ( OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.wto ) === data ) {
							return true;
						}
						break;
					case "mqtt":
						if ( OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.mqtt ) === data ) {
							return true;
						}
						break;
					case "email":
						if ( OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.email ) === data ) {
							return true;
						}
						break;
					case "otc":
						if ( OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.otc ) === data ) {
							return true;
						}
						break;
					case "isMetric":
						OSApp.currentDevice.isMetric = $item.is( ":checked" );
						OSApp.Storage.set( { isMetric: OSApp.currentDevice.isMetric } );
						return true;
					case "groupView":
						OSApp.uiState.groupView = $item.is( ":checked" );
						OSApp.Storage.set( { "groupView": OSApp.uiState.groupView } );
						return true;
					case "o12":
						if ( !isPi ) {
							opt.o12 = data & 0xff;
							opt.o13 = ( data >> 8 ) & 0xff;
						}
						return true;
					case "o31":
						if ( parseInt( data ) === 3 && !OSApp.Utils.unescapeJSON( $( "#wto" )[ 0 ].value ).baseETo ) {
							OSApp.Errors.showError( OSApp.Language._( "You must specify a baseline ETo adjustment method option to use the ET adjustment method." ) );
							invalid = true;
							return false;
						}

						var restrict = page.find( "#weatherRestriction" );
						if ( restrict.length ) {
							data = setRestriction( parseInt( restrict.val() ), data );
						}
						break;
					case "o18":
					case "o37":
						if ( parseInt( data ) > ( parseInt( page.find( "#o15" ).val() ) + 1 ) * 8 ) {
							data = 0;
						}
						break;
					case "o41":
						if ( page.find( "#o41-units" ).val() === "gallon" ) {
							data = data * 3.78541;
						}

						opt.o41 = ( data * 100 ) & 0xff;
						opt.o42 = ( ( data * 100 ) >> 8 ) & 0xff;
						return true;
					case "o2":
					case "o3":
					case "o14":
					case "o16":
					case "o21":
					case "o22":
					case "o25":
					case "o36":
					case "o48":
					case "o50":
					case "o51":
					case "o52":
					case "o53":
						data = $item.is( ":checked" ) ? 1 : 0;
						if ( !OSApp.Firmware.checkOSVersion( 219 ) && !data ) {
							return true;
						}
						break;
				}
				if ( isPi ) {
					if ( id === "loc" || id === "lg" ) {
						id = "o" + id;
					} else {
						key = /\d+/.exec( id );
						id = "o" + Object.keys( OSApp.Constants.keyIndex ).find( function( index ) { return OSApp.Constants.keyIndex[ index ] === key; } );
					}
				}

				// Because the firmware has a bug regarding spaces, let us replace them out now with a compatible separator
				if ( OSApp.Firmware.checkOSVersion( 208 ) === true && id === "loc" ) {
					data = data.replace( /\s/g, "_" );
				}

				opt[ id ] = data;
			} );

			if ( invalid ) {
				button.prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
				return;
			}
			if ( typeof OSApp.currentSession.controller.options.fpr0 !== "undefined" ) {
				if ( typeof OSApp.currentSession.controller.options.urs !== "undefined" ) {
					opt.o21 = page.find( "input[name='o21'][type='radio']:checked" ).val();
				} else {
					if ( typeof OSApp.currentSession.controller.options.sn1t !== "undefined" ) {
						opt.o50 = page.find( "input[name='o50'][type='radio']:checked" ).val();
					}

					if ( typeof OSApp.currentSession.controller.options.sn2t !== "undefined" ) {
						opt.o52 = page.find( "input[name='o52'][type='radio']:checked" ).val();
					}
				}
			}

			opt = OSApp.Utils.transformKeys( opt );
			$.mobile.loading( "show" );

			OSApp.Firmware.sendToOS( "/co?pw=&" + $.param( opt ) ).done( function() {
				$.mobile.document.one( "pageshow", function() {
					OSApp.Errors.showError( OSApp.Language._( "Settings have been saved" ) );
				} );
				OSApp.UIDom.goBack();
				updateController( updateWeather );
			} ).fail( function() {
				button.prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
			} );
		},
		header = OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Edit Options" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.checkChangesBeforeBack
			},
			rightBtn: {
				icon: "check",
				text: OSApp.Language._( "Submit" ),
				class: "submit",
				on: submitOptions
			}

		} ),
		timezones, tz, i;

	page.find( ".submit" ).on( "click", submitOptions );

	list = "<fieldset data-role='collapsible'" + ( typeof expandItem !== "string" || expandItem === "system" ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + OSApp.Language._( "System" ) + "</legend>";

	if ( typeof OSApp.currentSession.controller.options.ntp !== "undefined" ) {
		list += "<div class='ui-field-contain datetime-input'><label for='datetime'>" + OSApp.Language._( "Device Time" ) + "</label>" +
			"<button " + ( OSApp.currentSession.controller.options.ntp ? "disabled " : "" ) + "data-mini='true' id='datetime' " +
				"value='" + ( OSApp.currentSession.controller.settings.devt + ( new Date( OSApp.currentSession.controller.settings.devt * 1000 ).getTimezoneOffset() * 60 ) ) + "'>" +
			OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.devt * 1000 ) ).slice( 0, -3 ) + "</button></div>";
	}

	if ( !OSApp.Firmware.isOSPi() && typeof OSApp.currentSession.controller.options.tz !== "undefined" ) {
		timezones = [ "-12:00", "-11:30", "-11:00", "-10:00", "-09:30", "-09:00", "-08:30", "-08:00", "-07:00", "-06:00",
			"-05:00", "-04:30", "-04:00", "-03:30", "-03:00", "-02:30", "-02:00", "+00:00", "+01:00", "+02:00", "+03:00",
			"+03:30", "+04:00", "+04:30", "+05:00", "+05:30", "+05:45", "+06:00", "+06:30", "+07:00", "+08:00", "+08:45",
			"+09:00", "+09:30", "+10:00", "+10:30", "+11:00", "+11:30", "+12:00", "+12:45", "+13:00", "+13:45", "+14:00" ];

		tz = OSApp.currentSession.controller.options.tz - 48;
		tz = ( ( tz >= 0 ) ? "+" : "-" ) + OSApp.Utils.pad( ( Math.abs( tz ) / 4 >> 0 ) ) + ":" + ( ( Math.abs( tz ) % 4 ) * 15 / 10 >> 0 ) + ( ( Math.abs( tz ) % 4 ) * 15 % 10 );
		list += "<div class='ui-field-contain'><label for='o1' class='select'>" + OSApp.Language._( "Timezone" ) + "</label>" +
			"<select " + ( OSApp.Firmware.checkOSVersion( 210 ) && typeof OSApp.currentSession.weather === "object" ? "disabled='disabled' " : "" ) + "data-mini='true' id='o1'>";

		for ( i = 0; i < timezones.length; i++ ) {
			list += "<option " + ( ( timezones[ i ] === tz ) ? "selected" : "" ) + " value='" + timezones[ i ] + "'>" + timezones[ i ] + "</option>";
		}
		list += "</select></div>";
	}

	list += "<div class='ui-field-contain'>" +
		"<label for='loc'>" + OSApp.Language._( "Location" ) + "</label>" +
		"<button data-mini='true' id='loc' value='" + ( OSApp.currentSession.controller.settings.loc.trim() === "''" ? OSApp.Language._( "Not specified" ) : OSApp.currentSession.controller.settings.loc ) + "'>" +
			"<span>" + OSApp.currentSession.controller.settings.loc + "</span>" +
			"<a class='ui-btn btn-no-border ui-btn-icon-notext ui-icon-edit ui-btn-corner-all edit-loc'></a>" +
			"<a class='ui-btn btn-no-border ui-btn-icon-notext ui-icon-delete ui-btn-corner-all clear-loc'></a>" +
		"</button></div>";

	if ( typeof OSApp.currentSession.controller.options.lg !== "undefined" ) {
		list += "<label for='o36'><input data-mini='true' id='o36' type='checkbox' " + ( ( OSApp.currentSession.controller.options.lg === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Enable Logging" ) + "</label>";
	}

	list += "<label for='isMetric'><input data-mini='true' id='isMetric' type='checkbox' " + ( OSApp.currentDevice.isMetric ? "checked='checked'" : "" ) + ">" +
		OSApp.Language._( "Use Metric" ) + "</label>";

	if ( OSApp.Supported.groups() ) {
		list += "<label for='groupView'><input data-mini='true' id='groupView' type='checkbox' " + ( OSApp.uiState.groupView ? "checked='checked'" : "" ) + ">" +
		OSApp.Language._( "Order Stations by Groups" ) + "</label>";
	}

	list += "</fieldset><fieldset data-role='collapsible'" +
		( typeof expandItem === "string" && expandItem === "master" ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + OSApp.Language._( "Configure Master" ) + "</legend>";

	if ( typeof OSApp.currentSession.controller.options.mas !== "undefined" ) {
		list += "<div class='ui-field-contain ui-field-no-border'><label for='o18' class='select'>" +
				OSApp.Language._( "Master Station" ) + " " + ( typeof OSApp.currentSession.controller.options.mas2 !== "undefined" ? "1" : "" ) +
			"</label><select data-mini='true' id='o18'><option value='0'>" + OSApp.Language._( "None" ) + "</option>";

		for ( i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++ ) {
			list += "<option " + ( ( OSApp.Stations.isMaster( i ) === 1 ) ? "selected" : "" ) + " value='" + ( i + 1 ) + "'>" +
				OSApp.currentSession.controller.stations.snames[ i ] + "</option>";

			if ( !OSApp.Firmware.checkOSVersion( 214 ) && i === 7 ) {
				break;
			}
		}
		list += "</select></div>";

		if ( typeof OSApp.currentSession.controller.options.mton !== "undefined" ) {
			list += "<div " + ( OSApp.currentSession.controller.options.mas === 0 ? "style='display:none' " : "" ) +
				"class='ui-field-no-border ui-field-contain duration-field'><label for='o19'>" +
					OSApp.Language._( "Master On Adjustment" ) +
				"</label><button data-mini='true' id='o19' value='" + OSApp.currentSession.controller.options.mton + "'>" + OSApp.currentSession.controller.options.mton + "s</button></div>";
		}

		if ( typeof OSApp.currentSession.controller.options.mtof !== "undefined" ) {
			list += "<div " + ( OSApp.currentSession.controller.options.mas === 0 ? "style='display:none' " : "" ) +
				"class='ui-field-no-border ui-field-contain duration-field'><label for='o20'>" +
					OSApp.Language._( "Master Off Adjustment" ) +
				"</label><button data-mini='true' id='o20' value='" + OSApp.currentSession.controller.options.mtof + "'>" + OSApp.currentSession.controller.options.mtof + "s</button></div>";
		}
	}

	if ( typeof OSApp.currentSession.controller.options.mas2 !== "undefined" ) {
		list += "<hr style='width:95%' class='content-divider'>";

		list += "<div class='ui-field-contain ui-field-no-border'><label for='o37' class='select'>" +
				OSApp.Language._( "Master Station" ) + " 2" +
			"</label><select data-mini='true' id='o37'><option value='0'>" + OSApp.Language._( "None" ) + "</option>";

		for ( i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++ ) {
			list += "<option " + ( ( OSApp.Stations.isMaster( i ) === 2 ) ? "selected" : "" ) + " value='" + ( i + 1 ) + "'>" + OSApp.currentSession.controller.stations.snames[ i ] +
				"</option>";

			if ( !OSApp.Firmware.checkOSVersion( 214 ) && i === 7 ) {
				break;
			}
		}

		list += "</select></div>";

		if ( typeof OSApp.currentSession.controller.options.mton2 !== "undefined" ) {
			list += "<div " + ( OSApp.currentSession.controller.options.mas2 === 0 ? "style='display:none' " : "" ) +
				"class='ui-field-no-border ui-field-contain duration-field'><label for='o38'>" +
					OSApp.Language._( "Master On Adjustment" ) +
				"</label><button data-mini='true' id='o38' value='" + OSApp.currentSession.controller.options.mton2 + "'>" + OSApp.currentSession.controller.options.mton2 + "s</button></div>";
		}

		if ( typeof OSApp.currentSession.controller.options.mtof2 !== "undefined" ) {
			list += "<div " + ( OSApp.currentSession.controller.options.mas2 === 0 ? "style='display:none' " : "" ) +
				"class='ui-field-no-border ui-field-contain duration-field'><label for='o39'>" +
					OSApp.Language._( "Master Off Adjustment" ) +
				"</label><button data-mini='true' id='o39' value='" + OSApp.currentSession.controller.options.mtof2 + "'>" + OSApp.currentSession.controller.options.mtof2 + "s</button></div>";
		}
	}

	list += "</fieldset><fieldset data-role='collapsible'" +
		( typeof expandItem === "string" && expandItem === "station" ? " data-collapsed='false'" : "" ) + "><legend>" +
		OSApp.Language._( "Station Handling" ) + "</legend>";

	if ( typeof OSApp.currentSession.controller.options.ext !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='o15' class='select'>" +
			OSApp.Language._( "Number of Stations" ) +
			( typeof OSApp.currentSession.controller.options.dexp === "number" && OSApp.currentSession.controller.options.dexp < 255 && OSApp.currentSession.controller.options.dexp >= 0 ? " <span class='nobr'>(" +
				( OSApp.currentSession.controller.options.dexp * 8 + 8 ) + " " + OSApp.Language._( "available" ) + ")</span>" : "" ) +
			"</label><select data-mini='true' id='o15'>";

		for ( i = 0; i <= ( OSApp.currentSession.controller.options.mexp || 5 ); i++ ) {
			list += "<option " + ( ( OSApp.currentSession.controller.options.ext === i ) ? "selected" : "" ) + " value='" + i + "'>" + ( i * 8 + 8 ) + " " + OSApp.Language._( "stations" ) +
				"</option>";
		}
		list += "</select></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.sdt !== "undefined" ) {
		list += "<div class='ui-field-contain duration-field'><label for='o17'>" + OSApp.Language._( "Station Delay" ) + "</label>" +
			"<button data-mini='true' id='o17' value='" + OSApp.currentSession.controller.options.sdt + "'>" +
				OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( OSApp.currentSession.controller.options.sdt ) ) +
			"</button></div>";
	}

	list += "<label for='showDisabled'><input data-mini='true' class='noselect' id='showDisabled' type='checkbox' " + ( ( localStorage.showDisabled === "true" ) ? "checked='checked'" : "" ) + ">" +
	OSApp.Language._( "Show Disabled" ) + " " + OSApp.Language._( "(Changes Auto-Saved)" ) + "</label>";

	if ( typeof OSApp.currentSession.controller.options.seq !== "undefined" ) {
		list += "<label for='o16'><input data-mini='true' id='o16' type='checkbox' " +
				( ( OSApp.currentSession.controller.options.seq === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Sequential" ) + "</label>";
	}

	list += "</fieldset><fieldset data-role='collapsible'" +
		( typeof expandItem === "string" && expandItem === "weather" ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + OSApp.Language._( "Weather and Sensors" ) + "</legend>";

	if ( typeof OSApp.currentSession.controller.options.uwt !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='o31' class='select'>" + OSApp.Language._( "Weather Adjustment Method" ) +
				"<button data-helptext='" +
					OSApp.Language._( "Weather adjustment uses DarkSky data in conjunction with the selected method to adjust the watering percentage." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><select data-mini='true' id='o31'>";
		for ( i = 0; i < getAdjustmentMethod().length; i++ ) {
			var adjustmentMethod = getAdjustmentMethod()[ i ];

			// Skip unsupported adjustment options.
			if ( adjustmentMethod.minVersion && !OSApp.Firmware.checkOSVersion( adjustmentMethod.minVersion ) ) {
				continue;
			}
			list += "<option " + ( ( adjustmentMethod.id === getCurrentAdjustmentMethodId() ) ? "selected" : "" ) + " value='" + i + "'>" + adjustmentMethod.name + "</option>";
		}
		list += "</select></div>";

		if ( typeof OSApp.currentSession.controller.settings.wto === "object" ) {
			list += "<div class='ui-field-contain" + ( getCurrentAdjustmentMethodId() === 0 ? " hidden" : "" ) + "'><label for='wto'>" + OSApp.Language._( "Adjustment Method Options" ) + "</label>" +
				"<button data-mini='true' id='wto' value='" + OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.wto ) + "'>" +
					OSApp.Language._( "Tap to Configure" ) +
				"</button></div>";
		}

		if ( OSApp.Firmware.checkOSVersion( 214 ) ) {
			list += "<div class='ui-field-contain'><label for='weatherRestriction' class='select'>" + OSApp.Language._( "Weather-Based Restrictions" ) +
					"<button data-helptext='" + OSApp.Language._( "Prevents watering when the selected restriction is met." ) +
						"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
				"</label>" +
				"<select data-mini='true' class='noselect' id='weatherRestriction'>";

			for ( i = 0; i < 2; i++ ) {
				var restrict = getRestriction( i );
				list += "<option " + ( restrict.isCurrent === true ? "selected" : "" ) + " value='" + i + "'>" + restrict.name + "</option>";
			}
			list += "</select></div>";
		}
	}

	if ( typeof OSApp.currentSession.controller.options.wl !== "undefined" ) {
		list += "<div class='ui-field-contain duration-field'><label for='o23'>" + OSApp.Language._( "% Watering" ) +
				"<button data-helptext='" +
					OSApp.Language._( "The watering percentage scales station run times by the set value." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><button " + ( ( OSApp.currentSession.controller.options.uwt && getCurrentAdjustmentMethodId() > 0 ) ? "disabled='disabled' " : "" ) +
				"data-mini='true' id='o23' value='" + OSApp.currentSession.controller.options.wl + "'>" + OSApp.currentSession.controller.options.wl + "%</button></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.urs !== "undefined" || typeof OSApp.currentSession.controller.options.sn1t !== "undefined" ) {
		if ( typeof OSApp.currentSession.controller.options.fpr0 !== "undefined" ) {
			list += typeof OSApp.currentSession.controller.options.urs !== "undefined" ? generateSensorOptions( OSApp.Constants.keyIndex.urs, OSApp.currentSession.controller.options.urs ) :
					( typeof OSApp.currentSession.controller.options.sn1t !== "undefined" ? generateSensorOptions( OSApp.Constants.keyIndex.sn1t, OSApp.currentSession.controller.options.sn1t, 1 ) : "" );
		} else {
			list += "<label for='o21'>" +
				"<input data-mini='true' id='o21' type='checkbox' " + ( ( OSApp.currentSession.controller.options.urs === 1 ) ? "checked='checked'" : "" ) + ">" +
				OSApp.Language._( "Use Rain Sensor" ) + "</label>";
		}
	}

	if ( typeof OSApp.currentSession.controller.options.rso !== "undefined" ) {
		list += "<label for='o22'><input " + ( OSApp.currentSession.controller.options.urs === 1 || OSApp.currentSession.controller.options.urs === 240 ? "" : "data-wrapper-class='hidden' " ) +
			"data-mini='true' id='o22' type='checkbox' " + ( ( OSApp.currentSession.controller.options.rso === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Normally Open" ) + "</label>";
	}

	if ( typeof OSApp.currentSession.controller.options.sn1o !== "undefined" ) {
		list += "<label for='o51'><input " + ( OSApp.currentSession.controller.options.sn1t === 1 || OSApp.currentSession.controller.options.sn1t === 3 || OSApp.currentSession.controller.options.sn1t === 240 ? "" : "data-wrapper-class='hidden' " ) +
			"data-mini='true' id='o51' type='checkbox' " + ( ( OSApp.currentSession.controller.options.sn1o === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Normally Open" ) + "</label>";
	}

	if ( typeof OSApp.currentSession.controller.options.fpr0 !== "undefined" ) {
		list += "<div class='ui-field-contain" + ( OSApp.currentSession.controller.options.urs === 2 || OSApp.currentSession.controller.options.sn1t === 2 ? "" : " hidden" ) + "'>" +
			"<label for='o41'>" + OSApp.Language._( "Flow Pulse Rate" ) + "</label>" +
			"<table>" +
				"<tr style='width:100%;vertical-align: top;'>" +
					"<td style='width:100%'>" +
						"<div class='ui-input-text controlgroup-textinput ui-btn ui-body-inherit ui-corner-all ui-mini ui-shadow-inset ui-input-has-clear'>" +
							"<input data-role='none' data-mini='true' type='number' pattern='^[-+]?[0-9]*\.?[0-9]*$' id='o41' value='" + ( ( OSApp.currentSession.controller.options.fpr1 * 256 + OSApp.currentSession.controller.options.fpr0 ) / 100 ) + "'>" +
						"</div>" +
					"</td>" +
					"<td class='tight-select'>" +
						"<select id='o41-units' class='noselect' data-mini='true'>" +
							"<option selected='selected' value='liter'>L/pulse</option>" +
							"<option value='gallon'>Gal/pulse</option>" +
						"</select>" +
					"</td>" +
				"</tr>" +
			"</table></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.sn1on !== "undefined" ) {
		list += "<div class='" + ( OSApp.currentSession.controller.options.sn1t === 1 || OSApp.currentSession.controller.options.sn1t === 3 ? "" : "hidden " ) +
			"ui-field-no-border ui-field-contain duration-field'><label for='o54'>" +
				OSApp.Language._( "Sensor 1 Delayed On Time" ) +
			"</label><button data-mini='true' id='o54' value='" + OSApp.currentSession.controller.options.sn1on + "'>" + OSApp.currentSession.controller.options.sn1on + "m</button></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.sn1of !== "undefined" ) {
		list += "<div class='" + ( OSApp.currentSession.controller.options.sn1t === 1 || OSApp.currentSession.controller.options.sn1t === 3 ? "" : "hidden " ) +
			"ui-field-no-border ui-field-contain duration-field'><label for='o55'>" +
				OSApp.Language._( "Sensor 1 Delayed Off Time" ) +
			"</label><button data-mini='true' id='o55' value='" + OSApp.currentSession.controller.options.sn1of + "'>" + OSApp.currentSession.controller.options.sn1of + "m</button></div>";
	}

	if ( OSApp.Firmware.checkOSVersion( 217 ) ) {
		list += "<label id='prgswitch' class='center smaller" + ( OSApp.currentSession.controller.options.urs === 240 || OSApp.currentSession.controller.options.sn1t === 240 || OSApp.currentSession.controller.options.sn2t === 240 ? "" : " hidden" ) + "'>" +
			OSApp.Language._( "When using program switch, a switch is connected to the sensor port to trigger Program 1 every time the switch is pressed for at least 1 second." ) +
		"</label>";
	}

	if ( typeof OSApp.currentSession.controller.options.sn2t !== "undefined" && OSApp.Firmware.checkOSVersion( 219 ) ) {
		list += generateSensorOptions( OSApp.Constants.keyIndex.sn2t, OSApp.currentSession.controller.options.sn2t, 2 );
	}

	if ( typeof OSApp.currentSession.controller.options.sn2o !== "undefined" ) {
		list += "<label for='o53'><input " + ( OSApp.currentSession.controller.options.sn2t === 1 || OSApp.currentSession.controller.options.sn2t === 3 || OSApp.currentSession.controller.options.sn2t === 240 ? "" : "data-wrapper-class='hidden' " ) +
			"data-mini='true' id='o53' type='checkbox' " + ( ( OSApp.currentSession.controller.options.sn2o === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Normally Open" ) + "</label>";
	}

	if ( typeof OSApp.currentSession.controller.options.sn2on !== "undefined" ) {
		list += "<div class='" + ( OSApp.currentSession.controller.options.sn2t === 1 || OSApp.currentSession.controller.options.sn2t === 3 ? "" : "hidden " ) +
			"ui-field-no-border ui-field-contain duration-field'><label for='o56'>" +
				OSApp.Language._( "Sensor 2 Delayed On Time" ) +
			"</label><button data-mini='true' id='o56' value='" + OSApp.currentSession.controller.options.sn2on + "'>" + OSApp.currentSession.controller.options.sn2on + "m</button></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.sn2of !== "undefined" ) {
		list += "<div class='" + ( OSApp.currentSession.controller.options.sn2t === 1 || OSApp.currentSession.controller.options.sn2t === 3 ? "" : "hidden " ) +
			"ui-field-no-border ui-field-contain duration-field'><label for='o57'>" +
				OSApp.Language._( "Sensor 2 Delayed Off Time" ) +
			"</label><button data-mini='true' id='o57' value='" + OSApp.currentSession.controller.options.sn2of + "'>" + OSApp.currentSession.controller.options.sn2of + "m</button></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.sn2t !== "undefined" ) {
		list += "<label id='prgswitch-2' class='center smaller" + ( OSApp.currentSession.controller.options.urs === 240 || OSApp.currentSession.controller.options.sn1t === 240 || OSApp.currentSession.controller.options.sn2t === 240 ? "" : " hidden" ) + "'>" +
			OSApp.Language._( "When using program switch, a switch is connected to the sensor port to trigger Program 2 every time the switch is pressed for at least 1 second." ) +
		"</label>";
	}

	if ( typeof OSApp.currentSession.controller.settings.ifkey !== "undefined" || typeof OSApp.currentSession.controller.settings.mqtt !== "undefined" ||
		typeof OSApp.currentSession.controller.settings.otc !== "undefined" ) {
		list += "</fieldset><fieldset data-role='collapsible'" +
			( typeof expandItem === "string" && expandItem === "integrations" ? " data-collapsed='false'" : "" ) + ">" +
			"<legend>" + OSApp.Language._( "Integrations" ) + "</legend>";

		if ( typeof OSApp.currentSession.controller.settings.otc !== "undefined" ) {
			list += "<div class='ui-field-contain'>" +
						"<label for='otc'>" + OSApp.Language._( "OTC" ) +
							"<button style='display:inline-block;' data-helptext='" +
								OSApp.Language._( "OpenThings Cloud (OTC) allows remote access using OTC Token ." ) +
								"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'>" +
							"</button>" +
						"</label>" +
						"<button data-mini='true' id='otc' value='" + OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.otc ) + "'>" +
							OSApp.Language._( "Tap to Configure" ) +
						"</button>" +
					"</div>";
		}

		if ( typeof OSApp.currentSession.controller.settings.mqtt !== "undefined" ) {
			list += "<div class='ui-field-contain'>" +
						"<label for='mqtt'>" + OSApp.Language._( "MQTT" ) +
							"<button style='display:inline-block;' data-helptext='" +
								OSApp.Language._( "Send notifications to an MQTT broker and/or receive command message from the broker." ) +
								"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'>" +
							"</button>" +
						"</label>" +
						"<button data-mini='true' id='mqtt' value='" + OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.mqtt ) + "'>" +
							OSApp.Language._( "Tap to Configure" ) +
						"</button>" +
					"</div>";
		}

		if ( typeof OSApp.currentSession.controller.settings.email !== "undefined" ) {
			list += "<div class='ui-field-contain'>" +
						"<label for='email'>" + OSApp.Language._( "Email Notifications" ) +
							"<button style='display:inline-block;' data-helptext='" +
								OSApp.Language._( "OpenSprinkler can send notifications to a specified email address using a given email and SMTP server." ) +
								"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'>" +
							"</button>" +
						"</label>" +
						"<button data-mini='true' id='email' value='" + OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.email ) + "'>" +
							OSApp.Language._( "Tap to Configure" ) +
						"</button>" +
					"</div>";
		}

		if ( typeof OSApp.currentSession.controller.settings.ifkey !== "undefined" ) {
			list += "<div class='ui-field-contain'><label for='ifkey'>" + OSApp.Language._( "IFTTT Notifications" ) +
				"<button data-helptext='" +
					OSApp.Language._( "To enable IFTTT, a Webhooks key is required which can be obtained from https://ifttt.com" ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><input autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' data-mini='true' type='text' id='ifkey' placeholder='IFTTT webhooks key' value='" + OSApp.currentSession.controller.settings.ifkey + "'>" +
			"</div>";

			list += "<div class='ui-field-contain'><label for='o49'>" + OSApp.Language._( "Notification Events" ) +
					"<button data-helptext='" +
						OSApp.Language._( "Select which notification events to send to Email and/or IFTTT." ) +
						"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
				"</label><button data-mini='true' id='o49' value='" + OSApp.currentSession.controller.options.ife + "'>" + OSApp.Language._( "Configure Events" ) + "</button></div>";
		}

		if ( typeof OSApp.currentSession.controller.settings.dname !== "undefined" ) {
			list += "<div class='ui-field-contain'><label for='dname'>" + OSApp.Language._( "Device Name" ) +
				"<button data-helptext='" +
					OSApp.Language._( "Device name is attached to all IFTTT and email notifications to help distinguish multiple devices" ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><input autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' data-mini='true' type='text' id='dname' value=\"" + OSApp.currentSession.controller.settings.dname + "\">" +
			"</div>";
		}
	}

	list += "</fieldset><fieldset class='full-width-slider' data-role='collapsible'" +
		( typeof expandItem === "string" && expandItem === "lcd" ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + OSApp.Language._( "LCD Screen" ) + "</legend>";

	if ( typeof OSApp.currentSession.controller.options.con !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='o27'>" + OSApp.Language._( "Contrast" ) + "</label>" +
			"<input type='range' id='o27' min='0' max='255' step='10' data-highlight='true' value='" + ( OSApp.currentSession.controller.options.con ) + "'></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.lit !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='o28'>" + OSApp.Language._( "Brightness" ) + "</label>" +
			"<input type='range' id='o28' min='0' max='255' step='10' data-highlight='true' value='" + ( OSApp.currentSession.controller.options.lit ) + "'></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.dim !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='o29'>" + OSApp.Language._( "Idle Brightness" ) + "</label>" +
		"<input type='range' id='o29' min='0' max='255' step='10' data-highlight='true' value='" + ( OSApp.currentSession.controller.options.dim ) + "'></div>";
	}

	list += "</fieldset><fieldset data-role='collapsible' data-theme='b'" +
		( typeof expandItem === "string" && expandItem === "advanced" ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + OSApp.Language._( "Advanced" ) + "</legend>";

	if ( OSApp.Firmware.checkOSVersion( 219 ) && typeof OSApp.currentSession.controller.options.uwt !== "undefined" && typeof OSApp.currentSession.controller.settings.wto === "object" ) {
		list += "<div class='ui-field-contain'><label for='wtkey'>" + OSApp.Language._( "Wunderground Key" ).replace( "Wunderground", "Wunder&shy;ground" ) +
			"<button data-helptext='" +
				OSApp.Language._( "We use DarkSky normally however with a user provided API key the weather source will switch to Weather Underground." ) +
				"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
		"</label>" +
		"<table>" +
			"<tr style='width:100%;vertical-align: top;'>" +
				"<td style='width:100%'>" +
					"<div class='" +
						( ( OSApp.currentSession.controller.settings.wto.key && OSApp.currentSession.controller.settings.wto.key !== "" ) ? "green " : "" ) +
						"ui-input-text controlgroup-textinput ui-btn ui-body-inherit ui-corner-all ui-mini ui-shadow-inset ui-input-has-clear'>" +
							"<input data-role='none' data-mini='true' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' " +
								"type='text' id='wtkey' value='" + ( OSApp.currentSession.controller.settings.wto.key || "" ) + "'>" +
							"<a href='#' tabindex='-1' aria-hidden='true' data-helptext='" + OSApp.Language._( "An invalid API key has been detected." ) +
								"' class='hidden help-icon ui-input-clear ui-btn ui-icon-alert ui-btn-icon-notext ui-corner-all'>" +
							"</a>" +
					"</div>" +
				"</td>" +
				"<td><button class='noselect' data-mini='true' id='verify-api'>" + OSApp.Language._( "Verify" ) + "</button></td>" +
			"</tr>" +
		"</table></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.hp0 !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='o12'>" + OSApp.Language._( "HTTP Port (restart required)" ) + "</label>" +
			"<input data-mini='true' type='number' pattern='[0-9]*' id='o12' value='" + ( OSApp.currentSession.controller.options.hp1 * 256 + OSApp.currentSession.controller.options.hp0 ) + "'>" +
			"</div>";
	}

	if ( typeof OSApp.currentSession.controller.options.devid !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='o26'>" + OSApp.Language._( "Device ID (restart required)" ) +
			"<button data-helptext='" +
				OSApp.Language._( "Device ID modifies the last byte of the MAC address." ) +
			"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label>" +
			"<input data-mini='true' type='number' pattern='[0-9]*' max='255' id='o26' value='" + OSApp.currentSession.controller.options.devid + "'></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.rlp !== "undefined" ) {
		list += "<div class='ui-field-contain duration-field'>" +
			"<label for='o30'>" + OSApp.Language._( "Relay Pulse" ) +
				"<button data-helptext='" +
					OSApp.Language._( "Relay pulsing is used for special situations where rapid pulsing is needed in the output with a range from 1 to 2000 milliseconds. A zero value disables the pulsing option." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><button data-mini='true' id='o30' value='" + OSApp.currentSession.controller.options.rlp + "'>" + OSApp.currentSession.controller.options.rlp + "ms</button></div>";
	} else if ( OSApp.Firmware.checkOSVersion( 215 ) !== true && typeof OSApp.currentSession.controller.options.bst !== "undefined" ) {
		list += "<div class='ui-field-contain duration-field'>" +
			"<label for='o30'>" + OSApp.Language._( "Boost Time" ) +
				"<button data-helptext='" +
					OSApp.Language._( "Boost time changes how long the boost converter is activated with a range from 0 to 1000 milliseconds." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><button data-mini='true' id='o30' value='" + OSApp.currentSession.controller.options.bst + "'>" + OSApp.currentSession.controller.options.bst + "ms</button></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.ntp !== "undefined" && OSApp.Firmware.checkOSVersion( 210 ) ) {
		var ntpIP = [ OSApp.currentSession.controller.options.ntp1, OSApp.currentSession.controller.options.ntp2, OSApp.currentSession.controller.options.ntp3, OSApp.currentSession.controller.options.ntp4 ].join( "." );
		list += "<div class='" + ( ( OSApp.currentSession.controller.options.ntp === 1 ) ? "" : "hidden " ) + "ui-field-contain duration-field'><label for='ntp_addr'>" +
			OSApp.Language._( "NTP IP Address" ) + "</label><button data-mini='true' id='ntp_addr' value='" + ntpIP + "'>" + ntpIP + "</button></div>";
	}

	if ( typeof OSApp.currentSession.controller.options.dhcp !== "undefined" && OSApp.Firmware.checkOSVersion( 210 ) ) {
		var ip = [ OSApp.currentSession.controller.options.ip1, OSApp.currentSession.controller.options.ip2, OSApp.currentSession.controller.options.ip3, OSApp.currentSession.controller.options.ip4 ].join( "." ),
			gw = [ OSApp.currentSession.controller.options.gw1, OSApp.currentSession.controller.options.gw2, OSApp.currentSession.controller.options.gw3, OSApp.currentSession.controller.options.gw4 ].join( "." );

		list += "<div class='" + ( ( OSApp.currentSession.controller.options.dhcp === 1 ) ? "hidden " : "" ) + "ui-field-contain duration-field'><label for='ip_addr'>" +
			OSApp.Language._( "IP Address" ) + "</label><button data-mini='true' id='ip_addr' value='" + ip + "'>" + ip + "</button></div>";
		list += "<div class='" + ( ( OSApp.currentSession.controller.options.dhcp === 1 ) ? "hidden " : "" ) + "ui-field-contain duration-field'><label for='gateway'>" +
			OSApp.Language._( "Gateway Address" ) + "</label><button data-mini='true' id='gateway' value='" + gw + "'>" + gw + "</button></div>";

		if ( typeof OSApp.currentSession.controller.options.subn1 !== "undefined" ) {
			var subnet = [ OSApp.currentSession.controller.options.subn1, OSApp.currentSession.controller.options.subn2, OSApp.currentSession.controller.options.subn3, OSApp.currentSession.controller.options.subn4 ].join( "." );
			list += "<div class='" + ( ( OSApp.currentSession.controller.options.dhcp === 1 ) ? "hidden " : "" ) + "ui-field-contain duration-field'><label for='subnet'>" +
				OSApp.Language._( "Subnet Mask" ) + "</label><button data-mini='true' id='subnet' value='" + subnet + "'>" + subnet + "</button></div>";
		}

		if ( typeof OSApp.currentSession.controller.options.dns1 !== "undefined" ) {
			var dns = [ OSApp.currentSession.controller.options.dns1, OSApp.currentSession.controller.options.dns2, OSApp.currentSession.controller.options.dns3, OSApp.currentSession.controller.options.dns4 ].join( "." );
			list += "<div class='" + ( ( OSApp.currentSession.controller.options.dhcp === 1 ) ? "hidden " : "" ) + "ui-field-contain duration-field'><label for='dns'>" +
				OSApp.Language._( "DNS Address" ) + "</label><button data-mini='true' id='dns' value='" + dns + "'>" + dns + "</button></div>";
		}

		list += "<label for='o3'><input data-mini='true' id='o3' type='checkbox' " + ( ( OSApp.currentSession.controller.options.dhcp === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Use DHCP (restart required)" ) + "</label>";
	}

	if ( typeof OSApp.currentSession.controller.options.ntp !== "undefined" ) {
		list += "<label for='o2'><input data-mini='true' id='o2' type='checkbox' " + ( ( OSApp.currentSession.controller.options.ntp === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "NTP Sync" ) + "</label>";
	}

	if ( typeof OSApp.currentSession.controller.options.ar !== "undefined" ) {
		list += "<label for='o14'><input data-mini='true' id='o14' type='checkbox' " + ( ( OSApp.currentSession.controller.options.ar === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Auto Reconnect" ) + "</label>";
	}

	if ( typeof OSApp.currentSession.controller.options.ipas !== "undefined" ) {
		list += "<label for='o25'><input data-mini='true' id='o25' type='checkbox' " + ( ( OSApp.currentSession.controller.options.ipas === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Ignore Password" ) + "</label>";
	}

	if ( typeof OSApp.currentSession.controller.options.sar !== "undefined" ) {
		list += "<label for='o48'><input data-mini='true' id='o48' type='checkbox' " + ( ( OSApp.currentSession.controller.options.sar === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Special Station Auto-Refresh" ) + "</label>";
	}

	list += "</fieldset><fieldset data-role='collapsible' data-theme='b'" +
		( typeof expandItem === "string" && expandItem === "reset" ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + OSApp.Language._( "Reset" ) + "</legend>";

	list += "<button data-mini='true' class='center-div reset-log'>" + OSApp.Language._( "Clear Log Data" ) + "</button>";
	list += "<button data-mini='true' class='center-div reset-options'>" + OSApp.Language._( "Reset All Options" ) + "</button>";
	list += "<button data-mini='true' class='center-div reset-programs'>" + OSApp.Language._( "Delete All Programs" ) + "</button>";
	list += "<button data-mini='true' class='center-div reset-stations'>" + OSApp.Language._( "Reset Station Attributes" ) + "</button>";

	if ( OSApp.currentSession.controller.options.hwv >= 30 && OSApp.currentSession.controller.options.hwv < 40 ) {
		list += "<hr class='divider'><button data-mini='true' class='center-div reset-wireless'>" + OSApp.Language._( "Reset Wireless Settings" ) + "</button>";
	}

	list += "</fieldset>";

	// Insert options and remove unused groups
	page.find( "#os-options-list" )
		.html( list )
		.one( "change input", ":not(.noselect)", function() {
			header.eq( 2 ).prop( "disabled", false );
			page.find( ".submit" ).addClass( "hasChanges" );
		} )
		.find( "fieldset" ).each( function() {
			var group = $( this );

			if ( group.children().length === 1 ) {
				group.remove();
			}
		} );

	page.find( ".edit-loc" ).on( "click", function( e ) {
		e.stopImmediatePropagation();

		var popup = $( "<div data-role='popup' data-theme='a' id='locEntry'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Enter GPS Coordinates" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<label id='loc-warning'></label>" +
				"<input class='loc-entry' type='text' id='loc-entry' data-mini='true' maxlength='64' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
				" placeholder='" + OSApp.Language._( "Enter GPS Coordinates" ) + "' value='" + ( OSApp.currentSession.controller.settings.loc.trim() === "''" ? OSApp.Language._( "Not specified" ) : OSApp.currentSession.controller.settings.loc ) + "' required />" +
				"<button class='locSubmit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>" );

		popup.find( ".locSubmit" ).on( "click", function() {
			var input = popup.find( "#loc-entry" ).val();
			var gpsre = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
			if ( gpsre.test( input ) ) {
				page.find( "#loc" ).val( input ).removeClass( "green" ).find( "span" ).text( input );
				page.find( "#o1" ).selectmenu( "disable" );
				header.eq( 2 ).prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
				popup.popup( "close" );
			} else {
				$( "#loc-warning" ).text( "Invalid GPS coordinates, try again" );
			}
		} );

		OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
	} );

	page.find( ".clear-loc" ).on( "click", function( e ) {
		e.stopImmediatePropagation();

		areYouSure( OSApp.Language._( "Are you sure you want to clear the current location?" ), "", function() {
			page.find( "#loc" ).val( "''" ).removeClass( "green" ).find( "span" ).text( OSApp.Language._( "Not specified" ) );
			page.find( "#o1" ).selectmenu( "enable" );
			header.eq( 2 ).prop( "disabled", false );
			page.find( ".submit" ).addClass( "hasChanges" );
		} );
	} );

	page.find( "#showDisabled" ).on( "change", function() {
		OSApp.Storage.set( { showDisabled: this.checked } );
		return false;
	} );

	page.find( "#loc" ).on( "click", function() {
		var loc = $( this );

		loc.prop( "disabled", true );
		overlayMap( function( selected, station ) {
			if ( selected === false ) {
				if ( loc.val() === "" ) {
					loc.removeClass( "green" );
					page.find( "#o1" ).selectmenu( "enable" );
				}
			} else {
				if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
					page.find( "#o1" ).selectmenu( "disable" );
				}

				if ( typeof selected === "string" ) {
					loc.val( selected ).find( "span" ).text( selected );
				} else {
					selected[ 0 ] = parseFloat( selected[ 0 ] ).toFixed( 5 );
					selected[ 1 ] = parseFloat( selected[ 1 ] ).toFixed( 5 );
					if ( typeof station === "string" ) {
						validateWULocation( station, function( isValid ) {
							if ( isValid ) {
								loc.addClass( "green" );
							} else if ( !isValid ) {
								loc.removeClass( "green" );
							}
						} );
					}

					// Update the PWS location (either with the PWS station or reset to undefined)
					var wtoButton = page.find( "#wto" );

					// The value will be undefined if running an older HW version without an SD card.
					if ( wtoButton && wtoButton.val() !== undefined ) {
						wtoButton.val( OSApp.Utils.escapeJSON( $.extend( {}, OSApp.Utils.unescapeJSON( wtoButton.val() ), { pws: station || "" } ) ) );
					}

					loc.val( selected );
					coordsToLocation( selected[ 0 ], selected[ 1 ], function( result ) {
						loc.find( "span" ).text( result );
					} );
				}
				header.eq( 2 ).prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
			}
			loc.prop( "disabled", false );
		} );
	} );

	page.find( "#wto" ).on( "click", function() {
		var self = this,
			options = OSApp.Utils.unescapeJSON( this.value ),
			retainOptions = { pws: options.pws, key: options.key },
			method = parseInt( page.find( "#o31" ).val() ),
			finish = function() {
				self.value = OSApp.Utils.escapeJSON( $.extend( {}, OSApp.Utils.unescapeJSON( self.value ), retainOptions ) );
				header.eq( 2 ).prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
			};

		if ( method === 1 ) {
			showZimmermanAdjustmentOptions( this, finish );
		} else if ( method === 2 ) {
			showAutoRainDelayAdjustmentOptions( this, finish );
		} else if ( method === 3 ) {
			showEToAdjustmentOptions( this, finish );
		} else if ( method === 4 ) {
			showMonthlyAdjustmentOptions( this, finish );
		}
	} );

	page.find( ".reset-log" ).on( "click", clearLogs );

	page.find( ".reset-programs" ).on( "click", clearPrograms );

	page.find( ".reset-options" ).on( "click", function() {
		resetAllOptions( function() {
			$.mobile.document.one( "pageshow", function() {
				OSApp.Errors.showError( OSApp.Language._( "Settings have been saved" ) );
			} );
			OSApp.UIDom.goBack();
		} );
	} );

	page.find( ".reset-stations" ).on( "click", function() {
		var cs = "", i;

		if ( OSApp.Supported.groups() ) {
			for ( i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++ ) {
				cs += "g" + i + "=0&";
			}
		}

		if ( typeof OSApp.currentSession.controller.options.mas !== "undefined" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "m" + i + "=255&";
			}
		}

		if ( typeof OSApp.currentSession.controller.options.mas2 !== "undefined" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "n" + i + "=0&";
			}
		}

		if ( typeof OSApp.currentSession.controller.stations.ignore_rain === "object" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "i" + i + "=0&";
			}
		}

		if ( typeof OSApp.currentSession.controller.stations.ignore_sn1 === "object" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "j" + i + "=0&";
			}
		}

		if ( typeof OSApp.currentSession.controller.stations.ignore_sn2 === "object" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "k" + i + "=0&";
			}
		}

		if ( typeof OSApp.currentSession.controller.stations.act_relay === "object" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "a" + i + "=0&";
			}
		}

		if ( typeof OSApp.currentSession.controller.stations.stn_dis === "object" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "d" + i + "=0&";
			}
		}

		if ( typeof OSApp.currentSession.controller.stations.stn_seq === "object" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "q" + i + "=255&";
			}
		}

		if ( typeof OSApp.currentSession.controller.stations.stn_spe === "object" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "p" + i + "=0&";
			}
		}

		areYouSure( OSApp.Language._( "Are you sure you want to reset station attributes?" ), OSApp.Language._( "This will reset all station attributes" ), function() {
			$.mobile.loading( "show" );
			OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
				var sites = OSApp.Sites.parseSites( data.sites );

				sites[ data.current_site ].notes = {};
				sites[ data.current_site ].images = {};
				sites[ data.current_site ].lastRunTime = {};

				OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, OSApp.Network.cloudSaveSites );
			} );
			OSApp.Firmware.sendToOS( "/cs?pw=&" + cs ).done( function() {
				OSApp.Errors.showError( OSApp.Language._( "Stations have been updated" ) );
				updateController();
			} );
		} );
	} );

	page.find( ".reset-wireless" ).on( "click", function() {
		areYouSure( OSApp.Language._( "Are you sure you want to reset the wireless settings?" ), OSApp.Language._( "This will delete the stored SSID/password for your wireless network and return the device to access point mode" ), function() {
			OSApp.Firmware.sendToOS( "/cv?pw=&ap=1" ).done( function() {
				$.mobile.document.one( "pageshow", function() {
					OSApp.Errors.showError( OSApp.Language._( "Wireless settings have been reset. Please follow the OpenSprinkler user manual on restoring connectivity." ) );
				} );
				OSApp.UIDom.goBack();
			} );
		} );
	} );

	page.find( "#o3" ).on( "change", function() {
		var button = $( this ),
			checked = button.is( ":checked" ),
			manualInputs = page.find( "#ip_addr,#gateway,#dns,#subnet" ).parents( ".ui-field-contain" );

		if ( checked ) {
			manualInputs.addClass( "hidden" );
		} else {
			manualInputs.removeClass( "hidden" );
		}
	} );

	page.find( ".sensor-options input[type='radio']" ).on( "change", function() {
		var currentValue = this.value;
		var index = parseInt( this.id.match( /o(\d+)/ )[ 1 ], 10 );

		if ( currentValue === "2" ) {
			page.find( "#o41" ).parents( ".ui-field-contain" ).removeClass( "hidden" );
		} else if ( index === 21 || index === 50 ) {
			page.find( "#o41" ).parents( ".ui-field-contain" ).addClass( "hidden" );
		}

		if ( currentValue === "1" || currentValue === "3" || currentValue === "240" ) {
			page.find( "#o" + ( index + 1 ) ).parent().removeClass( "hidden" );
		} else {
			page.find( "#o" + ( index + 1 ) ).parent().addClass( "hidden" );
		}

		if (
			$( "input[name='o21'][type='radio']:checked" ).val() === "240" ||
			$( "input[name='o50'][type='radio']:checked" ).val() === "240"
		) {
			page.find( "#prgswitch" ).removeClass( "hidden" );
		} else {
			page.find( "#prgswitch" ).addClass( "hidden" );
		}

		if ( $( "input[name='o52'][type='radio']:checked" ).val() === "240" ) {
			page.find( "#prgswitch-2" ).removeClass( "hidden" );
		} else {
			page.find( "#prgswitch-2" ).addClass( "hidden" );
		}

		if ( currentValue === "1" || currentValue === "3" ) {
			page.find( "#o" + ( index + 4 ) + ",#o" + ( index + 5 ) ).parent().removeClass( "hidden" );
		} else {
			page.find( "#o" + ( index + 4 ) + ",#o" + ( index + 5 ) ).parent().addClass( "hidden" );
		}
	} );

	page.find( "#o21" ).on( "change", function() {
		page.find( "#o22" ).parent().toggleClass( "hidden", $( this ).is( ":checked" ) );
	} );

	page.find( "#verify-api" ).on( "click", function() {
		var key = page.find( "#wtkey" ),
			button = $( this );

		button.prop( "disabled", true );

		testAPIKey( key.val(), function( result ) {
			if ( result === true ) {
				key.parent().find( ".ui-icon-alert" ).hide();
				key.parent().removeClass( "red" ).addClass( "green" );
			} else {
				key.parent().find( ".ui-icon-alert" ).removeClass( "hidden" ).show();
				key.parent().removeClass( "green" ).addClass( "red" );
			}
			button.prop( "disabled", false );
		} );
	} );

	page.find( ".help-icon" ).on( "click", showHelpText );

	page.find( ".duration-field button:not(.help-icon)" ).on( "click", function() {
		var dur = $( this ),
			id = dur.attr( "id" ),
			name = page.find( "label[for='" + id + "']" ).text(),
			helptext = dur.parent().find( ".help-icon" ).data( "helptext" ),
			max = 240;

		header.eq( 2 ).prop( "disabled", false );
		page.find( ".submit" ).addClass( "hasChanges" );

		if ( id === "ip_addr" || id === "gateway" || id === "dns" || id === "ntp_addr" || id === "subnet" ) {
			showIPRequest( {
				title: name,
				ip: dur.val().split( "." ),
				callback: function( ip ) {
					dur.val( ip.join( "." ) ).text( ip.join( "." ) );
				}
			} );
		} else if ( id === "o19" || id === "o38" ) {
			showSingleDurationInput( {
				data: dur.val(),
				title: name,
				callback: function( result ) {
					dur.val( result ).text( result + "s" );
				},
				label: OSApp.Language._( "Seconds" ),
				maximum: OSApp.Firmware.checkOSVersion( 220 ) ? 600 : 60,
				minimum: OSApp.Firmware.checkOSVersion( 220 ) ? -600 : 0,
				helptext: helptext
			} );
		} else if ( id === "o30" ) {
			showSingleDurationInput( {
				data: dur.val(),
				title: name,
				callback: function( result ) {
					dur.val( result ).text( result + "ms" );
				},
				label: OSApp.Language._( "Milliseconds" ),
				maximum: 2000,
				helptext: helptext
			} );
		} else if ( id === "o20" || id === "o39" ) {
			showSingleDurationInput( {
				data: dur.val(),
				title: name,
				callback: function( result ) {
					dur.val( result ).text( result + "s" );
				},
				label: OSApp.Language._( "Seconds" ),
				maximum: OSApp.Firmware.checkOSVersion( 220 ) ? 600 : 0,
				minimum: OSApp.Firmware.checkOSVersion( 220 ) ? -600 : -60,
				helptext: helptext
			} );
		} else if ( id === "o23" ) {
			showSingleDurationInput( {
				data: dur.val(),
				title: name,
				callback: function( result ) {
					dur.val( result ).text( result + "%" );
				},
				label: OSApp.Language._( "% Watering" ),
				maximum: 250,
				helptext: helptext
			} );
		} else if ( id === "o17" ) {
			var min = 0;

			if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
				max = OSApp.Firmware.checkOSVersion( 214 ) ? 57600 : 64800;
			}

			if ( OSApp.Firmware.checkOSVersion( 211 ) ) {
				min = -3540;
				max = 3540;
			}

			if ( OSApp.Firmware.checkOSVersion( 217 ) ) {
				min = -600;
				max = 600;
			}

			showSingleDurationInput( {
				data: dur.val(),
				title: name,
				label: OSApp.Language._( "Seconds" ),
				callback: function( result ) {
					dur.val( result );
					dur.text( OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( result ) ) );
				},
				maximum: max,
				minimum: min
			} );
		} else if ( id === "o54" || id === "o55" || id === "o56" || id === "o57" ) {
			showSingleDurationInput( {
				data: dur.val(),
				title: name,
				callback: function( result ) {
					dur.val( result ).text( result + "m" );
				},
				label: OSApp.Language._( "Minutes" ),
				maximum: 240,
				minimum: 0,
				helptext: helptext
			} );
		}

		return false;
	} );

	page.find( "#o2" ).on( "change", function() {
		var ntp = $( this ).is( ":checked" );

		// Switch state of device time input based on NTP status
		page.find( ".datetime-input button" ).prop( "disabled", ntp );

		// Switch the NTP IP address field when NTP is used
		page.find( "#ntp_addr" ).parents( ".ui-field-contain" ).toggleClass( "hidden", !ntp );
	} );

	page.find( "#o18,#o37" ).on( "change", function() {
		page.find( "#o19,#o20" ).parents( ".ui-field-contain" ).toggle( parseInt( page.find( "#o18" ).val() ) === 0 ? false : true );
		if ( typeof OSApp.currentSession.controller.options.mas2 !== "undefined" ) {
			page.find( "#o38,#o39" ).parents( ".ui-field-contain" ).toggle( parseInt( page.find( "#o37" ).val() ) === 0 ? false : true );
		}
	} );

	page.find( "#o31" ).on( "change", function() {

		// Switch state of water level input based on weather algorithm status
		page.find( "#o23" ).prop( "disabled", ( parseInt( this.value ) === 0 ? false : true ) );

		// Switch the state of adjustment options based on the selected method
		page.find( "#wto" ).click().parents( ".ui-field-contain" ).toggleClass( "hidden", parseInt( this.value ) === 0 ? true : false );
	} );

	page.find( "#wtkey" ).on( "change input", function() {

		// Hide the invalid key status after change
		page.find( "#wtkey" ).siblings( ".help-icon" ).hide();
		page.find( "#wtkey" ).parent().removeClass( "red green" );
	} );

	page.find( "#o49" ).on( "click", function() {
		var events = {
			program: OSApp.Language._( "Program Start" ),
			sensor1: OSApp.Language._( "Sensor 1 Update" ),
			flow: OSApp.Language._( "Flow Sensor Update" ),
			weather: OSApp.Language._( "Weather Adjustment Update" ),
			reboot: OSApp.Language._( "Controller Reboot" ),
			run: OSApp.Language._( "Station Run" ),
			sensor2: OSApp.Language._( "Sensor 2 Update" ),
			rain: OSApp.Language._( "Rain Delay Update" )
		}, button = this, curr = parseInt( button.value ), inputs = "", a = 0, ife = 0;

		$.each( events, function( i, val ) {
			inputs += "<label for='notif-" + i + "'><input class='needsclick' data-iconpos='right' id='notif-" + i + "' type='checkbox' " +
				( OSApp.Utils.getBitFromByte( curr, a ) ? "checked='checked'" : "" ) + ">" + val +
			"</label>";
			a++;
		} );

		var popup = $(
			"<div data-role='popup' data-theme='a'>" +
				"<div data-role='controlgroup' data-mini='true' class='tight'>" +
					"<div class='ui-bar ui-bar-a'>" + OSApp.Language._( "Select Notification Events" ) + "</div>" +
						inputs +
					"<input data-wrapper-class='attrib-submit' class='submit' data-theme='b' type='submit' value='" + OSApp.Language._( "Submit" ) + "' />" +
				"</div>" +
			"</div>" );

		popup.find( ".submit" ).on( "click", function() {
			a = 0;
			$.each( events, function( i ) {
				ife |= popup.find( "#notif-" + i ).is( ":checked" ) << a;
				a++;
			} );
			popup.popup( "close" );
			if ( curr === ife ) {
				return;
			} else {
				button.value = ife;
				header.eq( 2 ).prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
			}
		} );

		OSApp.UIDom.openPopup( popup );
	} );

	function generateDefaultSubscribeTopic() {
		var topic;
		if ( OSApp.currentSession.controller.settings.mac ) {
			topic = OSApp.currentSession.controller.settings.mac;
			topic = topic.replaceAll( ":", "" );
			topic = "OS-" + topic;
		} else {
			topic = "OS-mySprinkler";
		}

		return topic;
	}

	page.find( "#mqtt" ).on( "click", function() {
		var button = this, curr = button.value,
			options = $.extend( {}, {
				en: 0,
				host: "server",
				port: 1883,
				user: "",
				pass: "",
				pubt: "opensprinkler",
				subt: ""
			}, OSApp.Utils.unescapeJSON( curr ) );

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var largeSOPTSupport = OSApp.Firmware.checkOSVersion( 221 );
		var popup = $( "<div data-role='popup' data-theme='a' id='mqttSettings'>" +
				"<div data-role='header' data-theme='b'>" +
					"<h1>" + OSApp.Language._( "MQTT Settings" ) + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
					"<label for='enable'>" + OSApp.Language._( "Enable" ) + "</label>" +
					"<input class='needsclick mqtt_enable' data-mini='true' data-iconpos='right' id='enable' type='checkbox' " +
						( options.en ? "checked='checked'" : "" ) + ">" +
					"<div class='ui-body'>" +
						"<div class='ui-grid-a' style='display:table;'>" +
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='server' style='padding-top:10px'>" + OSApp.Language._( "Broker/Server" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='mqtt-input' type='text' id='server' data-mini='true' maxlength='50' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "broker" ) + "' value='" + options.host + "' required />" +
							"</div>" +
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='port' style='padding-top:10px'>" + OSApp.Language._( "Port" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='mqtt-input' type='number' id='port' data-mini='true' pattern='[0-9]*' min='0' max='65535'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='1883' value='" + options.port + "' required />" +
							"</div>" +
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='username' style='padding-top:10px'>" + OSApp.Language._( "Username" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='mqtt-input' type='text' id='username' data-mini='true' maxlength='" + ( largeSOPTSupport ? "50" : "32" ) + "' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "username (optional)" ) + "' value='" + options.user + "' required />" +
							"</div>" +
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='password' style='padding-top:10px'>" + OSApp.Language._( "Password" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='mqtt-input' type='password' id='password' data-mini='true' maxlength='" + ( largeSOPTSupport ? "100" : "32" ) + "' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "password (optional)" ) + "' value='" + options.pass + "' required />" +
							"</div>" +
							( largeSOPTSupport ?
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='pubt' style='padding-top:10px'>" + OSApp.Language._( "Publish Topic" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='mqtt-input' type='text' id='pubt' data-mini='true' maxlength='24' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "publish topic" ) + "' value='" + options.pubt + "' required />" +
							"</div>" : "" ) +
							( largeSOPTSupport ?
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='subt' style='padding-top:10px'>" + OSApp.Language._( "Subscribe Topic" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='mqtt-input' type='text' id='subt' data-mini='true' maxlength='24' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "subscribe topic" ) + "' value='" + options.subt + "' required />" +
								"<div data-role='controlgroup' data-mini='true' data-type='horizontal'>" +
								"<button data-theme='a' id='defaultsubt'>Use Default</button><button data-theme='a' id='clearsubt'>Clear</button>" +
								"</div>" +
							"</div>" : "" ) +
						"</div>" +
					"</div>" +
					"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
				"</div>" +
			"</div>" );

		popup.find( "#defaultsubt" ).on( "click", function() {
			popup.find( "#subt" ).val( generateDefaultSubscribeTopic() );
		} );

		popup.find( "#clearsubt" ).on( "click", function() {
			popup.find( "#subt" ).val( "" );
		} );

		popup.find( "#enable" ).on( "change", function() {
			if ( this.checked ) {
				popup.find( ".mqtt-input" ).textinput( "enable" );
			} else {
				popup.find( ".mqtt-input" ).textinput( "disable" );
			}
		} );

		popup.find( ".submit" ).on( "click", function() {
			var options = {
				en: ( popup.find( "#enable" ).prop( "checked" ) ? 1 : 0 ),
				host: popup.find( "#server" ).val(),
				port: parseInt( popup.find( "#port" ).val() ),
				user: popup.find( "#username" ).val(),
				pass: popup.find( "#password" ).val(),
				pubt: popup.find( "#pubt" ).val(),
				subt: popup.find( "#subt" ).val()
			};

			popup.popup( "close" );
			if ( curr === OSApp.Utils.escapeJSON( options ) ) {
				return;
			} else {
				button.value = OSApp.Utils.escapeJSON( options );
				header.eq( 2 ).prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
			}
		} );

		popup.css( "max-width", "380px" );

		OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
    } );

	page.find( "#email" ).on( "click", function() {
		var button = this, curr = button.value,
			options = $.extend( {}, {
				en: 0,
				host: "smtp.gmail.com",
				port: 465,
				user: "",
				pass: "",
				recipient: ""
			}, OSApp.Utils.unescapeJSON( curr ) );

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var popup = $( "<div data-role='popup' data-theme='a' id='emailSettings'>" +
				"<div data-role='header' data-theme='b'>" +
					"<h1>" + OSApp.Language._( "Email Settings" ) + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
					"<label for='enable'>" + OSApp.Language._( "Enable" ) + "</label>" +
					"<input class='needsclick email_enable' data-mini='true' data-iconpos='right' id='enable' type='checkbox' " +
						( options.en ? "checked='checked'" : "" ) + ">" +
					"<div class='ui-body'>" +
						"<div class='ui-grid-a' style='display:table;'>" +
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='server' style='padding-top:10px'>" + OSApp.Language._( "SMTP Server" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='email-input' type='text' id='server' data-mini='true' maxlength='64' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "smtp.gmail.com" ) + "' value='" + options.host + "' required />" +
							"</div>" +
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='port' style='padding-top:10px'>" + OSApp.Language._( "Port" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='email-input' type='number' id='port' data-mini='true' pattern='[0-9]*' min='0' max='65535'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='465' value='" + options.port + "' required />" +
							"</div>" +
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='username' style='padding-top:10px'>" + OSApp.Language._( "Sender Email" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='email-input' type='text' id='username' data-mini='true' maxlength='64' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "user@gmail.com" ) + "' value='" + options.user + "' required />" +
							"</div>" +
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='password' style='padding-top:10px'>" + OSApp.Language._( "App Password" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='email-input' type='password' id='password' data-mini='true' maxlength='64' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "app password" ) + "' value='" + options.pass + "' required />" +
							"</div>" +
							"<div class='ui-block-a' style='width:40%'>" +
								"<label for='recipient' style='padding-top:10px'>" + OSApp.Language._( "Recipient Email" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:60%'>" +
								"<input class='email-input' type='text' id='recipient' data-mini='true' maxlength='64' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "user@gmail.com" ) + "' value='" + options.recipient + "' required />" +
							"</div>" +
						"</div>" +
					"</div>" +
					"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
				"</div>" +
			"</div>" );

		popup.find( "#enable" ).on( "change", function() {
			if ( this.checked ) {
				popup.find( ".email-input" ).textinput( "enable" );
			} else {
				popup.find( ".email-input" ).textinput( "disable" );
			}
		} );

		popup.find( ".submit" ).on( "click", function() {
			var options = {
				en: ( popup.find( "#enable" ).prop( "checked" ) ? 1 : 0 ),
				host: popup.find( "#server" ).val(),
				port: parseInt( popup.find( "#port" ).val() ),
				user: popup.find( "#username" ).val(),
				pass: popup.find( "#password" ).val(),
				recipient: popup.find( "#recipient" ).val()
			};

			popup.popup( "close" );
			if ( curr === OSApp.Utils.escapeJSON( options ) ) {
				return;
			} else {
				button.value = OSApp.Utils.escapeJSON( options );
				header.eq( 2 ).prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
			}
		} );

		popup.css( "max-width", "380px" );

		OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
	} );

	page.find( "#otc" ).on( "click", function() {
		var button = this, curr = button.value,
			options = $.extend( {}, {
				en: 0,
				token: "",
				server: "ws.cloud.openthings.io",
				port: 80
			}, OSApp.Utils.unescapeJSON( curr ) );

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var popup = $( "<div data-role='popup' data-theme='a' id='otcSettings'>" +
				"<div data-role='header' data-theme='b'>" +
					"<h1>" + OSApp.Language._( "OpenThings Cloud (OTC) Settings" ) + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
					"<label for='enable'>" + OSApp.Language._( "Enable" ) + "</label>" +
					"<input class='needsclick otc_enable' data-mini='true' data-iconpos='right' id='enable' type='checkbox' " +
						( options.en ? "checked='checked'" : "" ) + ">" +
					"<div class='ui-body'>" +
						"<div class='ui-grid-a' style='display:table;'>" +
							"<div class='ui-block-a' style='width:25%'>" +
								"<label for='token' style='padding-top:10px'>" + OSApp.Language._( "Token" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:75%'>" +
								"<input class='otc-input' type='text' id='token' data-mini='true' maxlength='36' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "token" ) + "' value='" + options.token + "' required />" +
							"</div>" +
							"<div class='ui-block-a' style='width:25%'>" +
								"<label for='server' style='padding-top:10px'>" + OSApp.Language._( "Server" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:75%'>" +
								"<input class='otc-input' type='text' id='server' data-mini='true' maxlength='50' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='" + OSApp.Language._( "server" ) + "' value='" + options.server + "' required />" +
							"</div>" +
							"<div class='ui-block-a' style='width:25%'>" +
								"<label for='port' style='padding-top:10px'>" + OSApp.Language._( "Port" ) + "</label>" +
							"</div>" +
							"<div class='ui-block-b' style='width:75%'>" +
								"<input class='otc-input' type='number' id='port' data-mini='true' pattern='[0-9]*' min='0' max='65535'" +
									( options.en ? "" : "disabled='disabled'" ) + " placeholder='80' value='" + options.port + "' required />" +
							"</div>" +
						"</div>" +
					"</div>" +
					"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
				"</div>" +
			"</div>" );

		popup.find( "#enable" ).on( "change", function() {
			if ( this.checked ) {
				popup.find( ".otc-input" ).textinput( "enable" );
			} else {
				popup.find( ".otc-input" ).textinput( "disable" );
			}
		} );
		popup.find( ".submit" ).on( "click", function() {
			if ( popup.find( "#enable" ).prop( "checked" ) && popup.find( "#token" ).val().length !== 32 ) {
				OSApp.Errors.showError( OSApp.Language._( "OpenThings Token must be 32 characters long." ) );
				return;
			}

			var options = {
				en: ( popup.find( "#enable" ).prop( "checked" ) ? 1 : 0 ),
				token: popup.find( "#token" ).val(),
				server: popup.find( "#server" ).val(),
				port: parseInt( popup.find( "#port" ).val() )
			};

			popup.popup( "close" );
			if ( curr === OSApp.Utils.escapeJSON( options ) ) {
				return;
			} else {
				button.value = OSApp.Utils.escapeJSON( options );
				header.eq( 2 ).prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
			}
		} );

		popup.css( "max-width", "380px" );

		OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
    } );

	page.find( ".datetime-input" ).on( "click", function() {
		var input = $( this ).find( "button" );

		if ( input.prop( "disabled" ) ) {
			return;
		}

		header.eq( 2 ).prop( "disabled", false );
		page.find( ".submit" ).addClass( "hasChanges" );

		// Show date time input popup
		showDateTimeInput( input.val(), function( data ) {
			input.text( OSApp.Dates.dateToString( data ).slice( 0, -3 ) ).val( Math.round( data.getTime() / 1000 ) );
		} );
		return false;
	} );

	page.one( "pagehide", function() {
		page.remove();
	} );

	header.eq( 2 ).prop( "disabled", true );

	$( "#os-options" ).remove();
	$.mobile.pageContainer.append( page );
}

var showHomeMenu = ( function() {
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

				( OSApp.Firmware.checkOSVersion( 210 ) ? "" : "<li><a href='#manual'>" + OSApp.Language._( "Manual Control" ) + "</a></li>" ) +
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
				stopAllStations();
			} else if ( href === "#show-hidden" ) {
				if ( showHidden ) {
					$( ".station-hidden" ).hide();
					page.removeClass( "show-hidden" );
				} else {
					$( ".station-hidden" ).show();
					page.addClass( "show-hidden" );
				}
			} else if ( href === "#raindelay" ) {
				showRainDelay();
			} else if ( href === "#globalpause" ) {
				showPause();
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

var showHome = ( function() {
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
				pname = isScheduled ? pidname( OSApp.Stations.getPID( sid ) ) : "",
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
						data = OSApp.currentSession.controller.special && OSApp.currentSession.controller.special.hasOwnProperty( sid ) ? OSApp.currentSession.controller.special[ sid ].sd : "",
						type  = OSApp.currentSession.controller.special && OSApp.currentSession.controller.special.hasOwnProperty( sid ) ? OSApp.currentSession.controller.special[ sid ].st : 0;

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
						data = parseRemoteStationData( ( type === value ) ? data : "00000000005000" );

						opts.append(
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Address" ) + ":</div>" +
							"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-address' required='true' type='text' pattern='^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$' value='" + data.ip + "'>" +
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Port" ) + ":</div>" +
							"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-port' required='true' type='number' placeholder='80' min='0' max='65535' value='" + data.port + "'>" +
							"<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Remote Station" ) + ":</div>" +
							"<input class='center' data-corners='false' data-wrapper-class='tight ui-btn stn-name' id='remote-station' required='true' type='number' min='1' max='200' placeholder='1' value='" + ( data.station + 1 ) + "'>"
						).enhanceWithin();
					} else if ( value === 6 ) {
						data = parseRemoteStationData( ( type === value ) ? data : "OT000000000000000000000000000000,00" );
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

							verifyRemoteStation( hex, function( result ) {
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
										convertRemoteToExtender( hex );
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
					OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, OSApp.Network.cloudSaveSites );

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
				updateControllerStationSpecial( function() {
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
					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, OSApp.Network.cloudSaveSites );
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
				updateController( function() {
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
				isScheduled, isRunning, pname, rem, qPause, card, line, hasImage, divider;

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
				pname = isScheduled ? pidname( OSApp.Stations.getPID( sid ) ) : "";
				rem = OSApp.Stations.getRemainingRuntime( sid ),
				qPause = OSApp.StationQueue.isPaused(),
				hasImage = sites[ currentSite ].images[ sid ] ? true : false;

				card = OSApp.CardList.getCardBySID( cardList, sid );
				divider = OSApp.Cards.getDivider( card );

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
				if ( typeof sites[ currentSite ].images !== "object" || $.isEmptyObject( sites[ currentSite ].images ) ) {
					sites[ currentSite ].images = {};
					page.removeClass( "has-images" );
				} else {
					page.addClass( "has-images" );
				}
				if ( typeof sites[ currentSite ].notes !== "object" ) {
					sites[ currentSite ].notes = {};
				}
				if ( typeof sites[ currentSite ].lastRunTime !== "object" ) {
					sites[ currentSite ].lastRunTime = {};
				}

				callback();
			} );
		},
		cards, siteSelect, currentSite, i, sites;

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
					showDurationBox( {
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

								refreshStatus();
								OSApp.Errors.showError( OSApp.Language._( "Station has been queued" ) );

								// Save run time for this station
								sites[ currentSite ].lastRunTime[ sid ] = duration;
								OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, OSApp.Network.cloudSaveSites );
							} );
						}
					} );
					return;
				}
			}

			areYouSure( question, OSApp.Stations.getName( sid ), function() {

				var shiftStations = OSApp.uiState.popupData.shift === true ? 1 : 0;

				OSApp.Firmware.sendToOS( "/cm?sid=" + sid + "&ssta=" + shiftStations + "&en=0&pw=" ).done( function() {

					// Update local state until next device refresh occurs
					OSApp.Stations.setPID( sid, 0 );
					OSApp.Stations.setRemainingRuntime( sid, 0 );
					OSApp.Stations.setStatus( sid, 0 );

					// Remove any timer associated with the station
					delete OSApp.uiState.timers[ "station-" + sid ];

					refreshStatus();
					OSApp.Errors.showError( OSApp.Language._( "Station has been stopped" ) );
				} );
			}, null, dialogOptions );
		} )

		.on( "click", "img", function() {
			var image = $( this ),
				id = image.parents( ".card" ).data( "station" ),
				hasImage = image.attr( "src" ).indexOf( "data:image/jpeg;base64" ) === -1 ? false : true;

			if ( hasImage ) {
				areYouSure( OSApp.Language._( "Do you want to delete the current image?" ), "", function() {
					delete sites[ currentSite ].images[ id ];
					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, OSApp.Network.cloudSaveSites );
					updateContent();
				} );
			} else {
				OSApp.UIDom.getPicture( function( image ) {
					sites[ currentSite ].images[ id ] = image;
					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, OSApp.Network.cloudSaveSites );
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
			updateWeatherBox();
		}
	}

	return begin;
} )();

var showStart = ( function() {
	var page = $( "<div data-role='page' id='start'>" +
			"<ul data-role='none' id='welcome_list' class='ui-listview ui-listview-inset ui-corner-all'>" +
				"<li><div class='logo' id='welcome_logo'></div></li>" +
				"<li class='ui-li-static ui-body-inherit ui-first-child ui-last-child ui-li-separate'>" +
					"<p class='rain-desc'>" +
						OSApp.Language._( "Welcome to the OpenSprinkler application. This app only works with the OpenSprinkler controller which must be installed and setup on your home network." ) +
					"</p>" +
					"<a class='iab iabNoScale ui-btn ui-mini center' target='_blank' href='https://opensprinkler.com/product/opensprinkler/'>" +
						OSApp.Language._( "Purchase OpenSprinkler" ) +
					"</a>" +
				"</li>" +
				"<li class='ui-first-child ui-last-child'>" +
					"<a href='#' class='ui-btn center cloud-login'>" + OSApp.Language._( "OpenSprinkler.com Login" ) + "</a>" +
				"</li>" +
				"<hr class='content-divider'>" +
				"<li id='auto-scan' class='ui-first-child'>" +
					"<a href='#' class='ui-btn ui-btn-icon-right ui-icon-carat-r'>" +
						OSApp.Language._( "Scan For Device" ) +
					"</a>" +
				"</li>" +
				"<li class='ui-first-child ui-last-child'>" +
					"<a class='ui-btn ui-btn-icon-right ui-icon-carat-r' data-rel='popup' href='#addnew'>" +
						 OSApp.Language._( "Add Controller" ) +
					"</a>" +
				"</li>" +
			"</ul>" +
		"</div>" ),
		checkAutoScan = function() {
			OSApp.Network.updateDeviceIP( function( ip ) {
				if ( ip === undefined ) {
					resetStartMenu();
					return;
				}

				// Check if the IP is on a private network, if not don't enable automatic scanning
				if ( !OSApp.Network.isLocalIP( ip ) ) {
					resetStartMenu();
					return;
				}

				//Change main menu items to reflect ability to automatically scan
				next.removeClass( "ui-first-child" ).find( "a.ui-btn" ).text( OSApp.Language._( "Manually Add Device" ) );
				auto.show();
			} );
		},
		resetStartMenu = function() {
			next.addClass( "ui-first-child" ).find( "a.ui-btn" ).text( OSApp.Language._( "Add Controller" ) );
			auto.hide();
		},
		auto = page.find( "#auto-scan" ),
		next = auto.next();

	page.find( "#auto-scan" ).find( "a" ).on( "click", function() {
		OSApp.Network.startScan();
		return false;
	} );

	page.find( "a[href='#addnew']" ).on( "click", function() {
		showAddNew();
	} );

	page.find( ".cloud-login" ).on( "click", function() {
		OSApp.Network.requestCloudAuth();
		return false;
	} );

	page.on( "pagehide", function() {
		page.detach();
	} );

	function begin() {
		if ( OSApp.currentSession.isControllerConnected() ) {
			return false;
		}

		$( "#start" ).remove();

		$.mobile.pageContainer.append( page );

		checkAutoScan();
	}

	return begin;
} )();

function showGuidedSetup() {

	// Stub for guided setup page

}

function isValidOTC( token ) {
	return /^OT[a-f0-9]{30}$/i.test( token );
}

function parseRemoteStationData( hex ) {
	var fields = hex.split( "," );
	var result = {};
	if ( fields.length === 2 && isValidOTC( fields[ 0 ] ) ) {
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
}

function verifyRemoteStation( data, callback ) {
	data = parseRemoteStationData( data );

	$.ajax( {
		url: ( data.otc ? ( "https://cloud.openthings.io/forward/v1/" + data.otc ) : ( "http://" + data.ip + ":" + data.port ) ) + "/jo?pw=" + encodeURIComponent( OSApp.currentSession.pass ),
		type: "GET",
		dataType: "json"
	} ).then(
		function( result ) {
			if ( typeof result !== "object" || !result.hasOwnProperty( "fwv" ) ) {
				callback( -1 );
			} else if ( Object.keys( result ).length === 1 ) {
				callback( -2 );
			} else if ( !result.hasOwnProperty( "re" ) || result.re === 0 ) {
				callback( -3 );
			} else {
				callback( true );
			}
		},
		function() {
			callback( false );
		}
	);
}

function convertRemoteToExtender( data ) {
	data = parseRemoteStationData( data );
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
}

// Current status related functions
function refreshStatus( callback ) {
	if ( !OSApp.currentSession.isControllerConnected() ) {
		return;
	}

	callback = callback || function() {};
	var finish = function() {

		// Notify the page container that the data has refreshed
		$( "html" ).trigger( "datarefresh" );
		checkStatus();
		callback();
	};

	if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
		updateController( finish, networkFail );
	} else {
		$.when(
			updateControllerStatus(),
			updateControllerSettings(),
			updateControllerOptions()
		).then( finish, networkFail );
	}
}

function refreshData() {
	if ( !OSApp.currentSession.isControllerConnected() ) {
		return;
	}

	if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
		updateController( null, networkFail );
	} else {
		$.when(
			updateControllerPrograms(),
			updateControllerStations()
		).fail( networkFail );
	}
}

// Actually change the status bar
function changeStatus( seconds, color, line, onclick ) {
	var footer = $( "#footer-running" ),
		html = "";

	onclick = onclick || function() {};

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
		html += "<span style='padding-left:5px'>" + OSApp.Language._( "Flow" ) + ": " + ( flowCountToVolume( OSApp.currentSession.controller.settings.flcrt ) / ( OSApp.currentSession.controller.settings.flwrt / 60 ) ).toFixed( 2 ) + " L/min</span>";
	}

	if ( html !== "" ) {
		html = line + "<p class='running-text smaller center'>" + html + "</p>";
	} else {
		html = line;
	}

	footer.removeClass().addClass( color ).html( html ).off( "click" ).on( "click", onclick );
}

// Update status bar based on device status
function checkStatus() {
	var open, ptotal, sample, pid, pname, line, match, tmp, i;

	if ( !OSApp.currentSession.isControllerConnected() ) {
		changeStatus( 0, "transparent", "<p class='running-text smaller'></p>" );
		return;
	}

	// Handle controller configured as extender
	if ( OSApp.currentSession.controller.options.re === 1 ) {
		changeStatus( 0, "red", "<p class='running-text center pointer'>" + OSApp.Language._( "Configured as Extender" ) + "</p>", function() {
			areYouSure( OSApp.Language._( "Do you wish to disable extender mode?" ), "", function() {
				OSApp.UIDom.showLoading( "#footer-running" );
				OSApp.Firmware.sendToOS( "/cv?pw=&re=0" ).done( function() {
					updateController();
				} );
			} );
		} );
		return;
	}

	// Handle operation disabled
	if ( !OSApp.currentSession.controller.settings.en ) {
		changeStatus( 0, "red", "<p class='running-text center pointer'>" + OSApp.Language._( "System Disabled" ) + "</p>", function() {
			areYouSure( OSApp.Language._( "Do you want to re-enable system operation?" ), "", function() {
				OSApp.UIDom.showLoading( "#footer-running" );
				OSApp.Firmware.sendToOS( "/cv?pw=&en=1" ).done( function() {
					updateController();
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

		changeStatus( OSApp.currentSession.controller.settings.pt || 0, "yellow", line, function() {
			areYouSure( OSApp.Language._( "Do you want to resume station operation?" ), "", function() {
				OSApp.UIDom.showLoading( "#footer-running" );
				OSApp.Firmware.sendToOS( "/pq?pw=&dur=0" ).done( function() {
					setTimeout( refreshStatus, 1000 );
				} );
			} );
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
			if ( open.hasOwnProperty( i ) ) {
				tmp = OSApp.Stations.getRemainingRuntime( i );
				if ( tmp > ptotal ) {
					ptotal = tmp;
				}
			}
		}

		sample = Object.keys( open )[ 0 ];
		pid    = OSApp.Stations.getPID( sample );
		pname  = pidname( pid );
		line   = "<div><div class='running-icon'></div><div class='running-text pointer'>";

		line += pname + " " + OSApp.Language._( "is running on" ) + " " + Object.keys( open ).length + " " + OSApp.Language._( "stations" ) + " ";
		if ( ptotal > 0 ) {
			line += "<span id='countdown' class='nobr'>(" + OSApp.Dates.sec2hms( ptotal ) + " " + OSApp.Language._( "remaining" ) + ")</span>";
		}
		line += "</div></div>";
		changeStatus( ptotal, "green", line, OSApp.UIDom.goHome );
		return;
	}

	// Handle a single station open
	match = false;
	for ( i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++ ) {
		if ( OSApp.currentSession.controller.settings.ps[ i ] && OSApp.Stations.getPID( i ) && OSApp.Stations.getStatus( i ) && !OSApp.Stations.isMaster( i ) ) {
			match = true;
			pid = OSApp.Stations.getPID( i );
			pname = pidname( pid );
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
		changeStatus( OSApp.Stations.getRemainingRuntime( i ), "green", line, OSApp.UIDom.goHome );
		return;
	}

	// Handle rain delay enabled
	if ( OSApp.currentSession.controller.settings.rd ) {
		changeStatus( 0, "red", "<p class='running-text center pointer'>" +
			OSApp.Language._( "Rain delay until" ) + " " + OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.rdst * 1000 ) ) + "</p>",
			function() {
				areYouSure( OSApp.Language._( "Do you want to turn off rain delay?" ), "", function() {
					OSApp.UIDom.showLoading( "#footer-running" );
					OSApp.Firmware.sendToOS( "/cv?pw=&rd=0" ).done( function() {
						refreshStatus( updateWeather );
					} );
				} );
			}
		);
		return;
	}

	// Handle rain sensor triggered
	if ( OSApp.currentSession.controller.options.urs === 1 && OSApp.currentSession.controller.settings.rs === 1 ) {
		changeStatus( 0, "red", "<p class='running-text center'>" + OSApp.Language._( "Rain detected" ) + "</p>" );
		return;
	}

	if ( OSApp.currentSession.controller.settings.sn1 === 1 ) {
		changeStatus( 0, "red", "<p class='running-text center'>Sensor 1 (" + ( OSApp.currentSession.controller.options.sn1t === 3 ? OSApp.Language._( "Soil" ) : OSApp.Language._( "Rain" ) ) + OSApp.Language._( ") Activated" ) + "</p>" );
		return;
	}

	if ( OSApp.currentSession.controller.settings.sn2 === 1 ) {
		changeStatus( 0, "red", "<p class='running-text center'>Sensor 2 (" + ( OSApp.currentSession.controller.options.sn2t === 3 ? OSApp.Language._( "Soil" ) : OSApp.Language._( "Rain" ) ) + OSApp.Language._( ") Activated" ) + "</p>" );
		return;
	}

	// Handle manual mode enabled
	if ( OSApp.currentSession.controller.settings.mm === 1 ) {
		changeStatus( 0, "red", "<p class='running-text center pointer'>" + OSApp.Language._( "Manual mode enabled" ) + "</p>", function() {
			areYouSure( OSApp.Language._( "Do you want to turn off manual mode?" ), "", function() {
				OSApp.UIDom.showLoading( "#footer-running" );
				OSApp.Firmware.sendToOS( "/cv?pw=&mm=0" ).done( function() {
					updateController();
				} );
			} );
		} );
		return;
	}

	var lrdur = OSApp.currentSession.controller.settings.lrun[ 2 ];

	// If last run duration is given, add it to the footer
	if ( lrdur !== 0 ) {
		var lrpid = OSApp.currentSession.controller.settings.lrun[ 1 ];
		pname = pidname( lrpid );

		changeStatus( 0, "transparent", "<p class='running-text smaller center pointer'>" + pname + " " + OSApp.Language._( "last ran station" ) + " " +
			OSApp.currentSession.controller.stations.snames[ OSApp.currentSession.controller.settings.lrun[ 0 ] ] + " " + OSApp.Language._( "for" ) + " " + ( lrdur / 60 >> 0 ) + "m " + ( lrdur % 60 ) + "s " +
			OSApp.Language._( "on" ) + " " + OSApp.Dates.dateToString( new Date( ( OSApp.currentSession.controller.settings.lrun[ 3 ] - lrdur ) * 1000 ) ) + "</p>", OSApp.UIDom.goHome );
		return;
	}

	changeStatus( 0, "transparent", "<p class='running-text smaller center pointer'>" + OSApp.Language._( "System Idle" ) + "</p>", OSApp.UIDom.goHome );
}

function calculateTotalRunningTime( runTimes ) {
	var sdt = OSApp.currentSession.controller.options.sdt,
		sequential, parallel;
	if ( OSApp.Supported.groups() ) {
		sequential = new Array( OSApp.Constants.options.NUM_SEQ_GROUPS ).fill( 0 );
		parallel = 0;
		var sequentialMax = 0;
		$.each( OSApp.currentSession.controller.stations.snames, function( i ) {
			var run = runTimes[ i ];
			var gid = OSApp.Stations.getGIDValue( i );
			if ( run > 0 ) {
				if ( gid !== OSApp.Constants.options.PARALLEL_GID_VALUE ) {
					sequential[ gid ] += ( run + sdt );
				} else {
					if ( run > parallel ) {
						parallel = run;
					}
				}
			}
		} );
		for ( var d = 0; d < OSApp.Constants.options.NUM_SEQ_GROUPS; d++ )	{
			if ( sequential[ d ] > sdt ) { sequential[ d ] -= sdt; }
			if ( sequential[ d ] > sequentialMax ) { sequentialMax = sequential[ d ]; }
		}
		return Math.max( sequentialMax, parallel );
	} else {
		sequential = 0;
		parallel = 0;
		$.each( OSApp.currentSession.controller.stations.snames, function( i ) {
			var run = runTimes[ i ];
			if ( run > 0 ) {
				if ( OSApp.Stations.isSequential( i ) ) {
					sequential += ( run + sdt );
				} else {
					if ( run > parallel ) {
						parallel = run;
					}
				}
			}
		} );
		if ( sequential > sdt ) { sequential -= sdt; } // Discount the last sdt
		return Math.max( sequential, parallel );
	}
}

// Handle timer update on the home page and status bar
function updateTimers() {
	var lastCheck = new Date().getTime();

	setInterval( function() {

		if ( !OSApp.currentSession.isControllerConnected() ) {
			return false;
		}

		// Handle time drift
		var now = new Date().getTime(),
			diff = now - lastCheck;

		if ( diff > 2000 ) {
			checkStatus();
			refreshStatus();
		}

		lastCheck = now;

		// If no timers are defined then exit
		if ( $.isEmptyObject( OSApp.uiState.timers ) ) {
			return;
		}

		for ( var timer in OSApp.uiState.timers ) {
			if ( OSApp.uiState.timers.hasOwnProperty( timer ) ) {
				if ( OSApp.uiState.timers[ timer ].val <= 0 ) {
					if ( timer === "statusbar" ) {
						OSApp.UIDom.showLoading( "#footer-running" );
						refreshStatus();
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
	}, 1000 );
}

function removeStationTimers() {
	for ( var timer in OSApp.uiState.timers ) {
		if ( OSApp.uiState.timers.hasOwnProperty( timer ) ) {
			if ( timer !== "clock" ) {
				delete OSApp.uiState.timers[ timer ];
			}
		}
	}
}

// Manual control functions
var getManual = ( function() {
	var page = $( "<div data-role='page' id='manual'>" +
				"<div class='ui-content' role='main'>" +
					"<p class='center'>" + OSApp.Language._( "With manual mode turned on, tap a station to toggle it." ) + "</p>" +
					"<fieldset data-role='collapsible' data-collapsed='false' data-mini='true'>" +
						"<legend>" + OSApp.Language._( "Options" ) + "</legend>" +
						"<div class='ui-field-contain'>" +
							"<label for='mmm'><b>" + OSApp.Language._( "Manual Mode" ) + "</b></label>" +
							"<input type='checkbox' data-on-text='On' data-off-text='Off' data-role='flipswitch' name='mmm' id='mmm'>" +
						"</div>" +
						"<p class='rain-desc smaller center' style='padding-top:5px'>" +
							OSApp.Language._( "Station timer prevents a station from running indefinitely and will automatically turn it off after the set duration (or when toggled off)" ) +
						"</p>" +
						"<div class='ui-field-contain duration-input'>" +
							"<label for='auto-off'><b>" + OSApp.Language._( "Station Timer" ) + "</b></label>" +
							"<button data-mini='true' name='auto-off' id='auto-off' value='3600'>1h</button>" +
						"</div>" +
					"</fieldset>" +
					"<div id='manual-station-list'>" +
					"</div>" +
				"</div>" +
			"</div>" ),
		checkToggle = function( currPos ) {
			updateControllerStatus().done( function() {
				var item = listitems.eq( currPos ).find( "a" );

				if ( OSApp.currentSession.controller.options.mas ) {
					if ( OSApp.currentSession.controller.status[ OSApp.currentSession.controller.options.mas - 1 ] ) {
						listitems.eq( OSApp.currentSession.controller.options.mas - 1 ).addClass( "green" );
					} else {
						listitems.eq( OSApp.currentSession.controller.options.mas - 1 ).removeClass( "green" );
					}
				}

				item.text( OSApp.currentSession.controller.stations.snames[ currPos ] );

				if ( OSApp.currentSession.controller.status[ currPos ] ) {
					item.removeClass( "yellow" ).addClass( "green" );
				} else {
					item.removeClass( "green yellow" );
				}
			} );
		},
		toggle = function() {
			if ( !OSApp.currentSession.controller.settings.mm ) {
				OSApp.Errors.showError( OSApp.Language._( "Manual mode is not enabled. Please enable manual mode then try again." ) );
				return false;
			}

			var anchor = $( this ),
				item = anchor.closest( "li" ),
				currPos = listitems.index( item ),
				sid = currPos + 1,
				dur = autoOff.val();

			if ( anchor.hasClass( "yellow" ) ) {
				return false;
			}

			if ( OSApp.currentSession.controller.status[ currPos ] ) {
				if ( OSApp.Firmware.checkOSPiVersion( "2.1" ) ) {
					dest = "/sn?sid=" + sid + "&set_to=0&pw=";
				} else {
					dest = "/sn" + sid + "=0";
				}
			} else {
				if ( OSApp.Firmware.checkOSPiVersion( "2.1" ) ) {
					dest = "/sn?sid=" + sid + "&set_to=1&set_time=" + dur + "&pw=";
				} else {
					dest = "/sn" + sid + "=1&t=" + dur;
				}
			}

			anchor.removeClass( "green" ).addClass( "yellow" );
			anchor.html( "<p class='ui-icon ui-icon-loading mini-load'></p>" );

			OSApp.Firmware.sendToOS( dest ).always(
				function() {

					// The device usually replies before the station has actually toggled. Delay in order to wait for the station's to toggle.
					setTimeout( checkToggle, 1000, currPos );
				}
			);

			return false;
		},
		autoOff = page.find( "#auto-off" ),
		dest, mmlist, listitems;

	page.on( "pagehide", function() {
		page.detach();
	} );

	OSApp.Storage.get( "autoOff", function( data ) {
		if ( !data.autoOff ) {
			return;
		}
		autoOff.val( data.autoOff );
		autoOff.text( OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( data.autoOff ) ) );
	} );

	autoOff.on( "click", function() {
		var dur = $( this ),
			name = page.find( "label[for='" + dur.attr( "id" ) + "']" ).text();

		showDurationBox( {
			seconds: dur.val(),
			title: name,
			callback: function( result ) {
				dur.val( result );
				dur.text( OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( result ) ) );
				OSApp.Storage.set( { "autoOff":result } );
			},
			maximum: 32768
		} );

		return false;
	} );

	page.find( "#mmm" ).on( "change", flipSwitched );

	function begin() {
		var list = "<li data-role='list-divider' data-theme='a'>" + OSApp.Language._( "Sprinkler Stations" ) + "</li>";

		page.find( "#mmm" ).prop( "checked", OSApp.currentSession.controller.settings.mm ? true : false );

		$.each( OSApp.currentSession.controller.stations.snames, function( i, station ) {
			if ( OSApp.Stations.isMaster( i ) ) {
				list += "<li data-icon='false' class='center" + ( ( OSApp.currentSession.controller.status[ i ] ) ? " green" : "" ) +
					( OSApp.Stations.isDisabled( i ) ? " station-hidden' style='display:none" : "" ) + "'>" + station + " (" + OSApp.Language._( "Master" ) + ")</li>";
			} else {
				list += "<li data-icon='false'><a class='mm_station center" + ( ( OSApp.currentSession.controller.status[ i ] ) ? " green" : "" ) +
					( OSApp.Stations.isDisabled( i ) ? " station-hidden' style='display:none" : "" ) + "'>" + station + "</a></li>";
			}
		} );

		mmlist = $( "<ul data-role='listview' data-inset='true' id='mm_list'>" + list + "</ul>" );
		listitems = mmlist.children( "li" ).slice( 1 );
		mmlist.find( ".mm_station" ).on( "vclick", toggle );
		page.find( "#manual-station-list" ).html( mmlist ).enhanceWithin();

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Manual Control" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			}
		} );

		$( "#manual" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin;
} )();

// Runonce functions
var getRunonce = ( function() {

	var page = $( "<div data-role='page' id='runonce'>" +
			"<div class='ui-content' role='main' id='runonce_list'>" +
			"</div>" +
		"</div>" ),
		updateLastRun = function( data ) {
			rprogs.l = data;
			$( "<option value='l' selected='selected'>" + OSApp.Language._( "Last Used Program" ) + "</option>" )
				.insertAfter( page.find( "#rprog" ).find( "option[value='t']" ) );
			fillRunonce( data );
		},
		resetRunonce = function() {
			page.find( "[id^='zone-']" ).val( 0 ).text( "0s" ).removeClass( "green" );
			return false;
		},
		fillRunonce = function( data ) {
			page.find( "[id^='zone-']" ).each( function( a, b ) {
				if ( OSApp.Stations.isMaster( a ) ) {
					return;
				}

				var ele = $( b );
				ele.val( data[ a ] ).text( OSApp.Dates.getDurationText( data[ a ] ) );
				if ( data[ a ] > 0 ) {
					ele.addClass( "green" );
				} else {
					ele.removeClass( "green" );
				}
			} );
		},
		i, list, quickPick, progs, rprogs, z, program, name;

	page.on( "pagehide", function() {
		page.detach();
	} );

	function begin() {
		list = "<p class='center'>" + OSApp.Language._( "Zero value excludes the station from the run-once program." ) + "</p>";
		progs = [];
		if ( OSApp.currentSession.controller.programs.pd.length ) {
			for ( z = 0; z < OSApp.currentSession.controller.programs.pd.length; z++ ) {
				program = readProgram( OSApp.currentSession.controller.programs.pd[ z ] );
				var prog = [];

				if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
					prog = program.stations;
				} else {
					var setStations = program.stations.split( "" );
					for ( i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++ ) {
						prog.push( ( parseInt( setStations[ i ] ) ) ? program.duration : 0 );
					}
				}

				progs.push( prog );
			}
		}
		rprogs = progs;

		quickPick = "<select data-mini='true' name='rprog' id='rprog'>" +
			"<option value='t'>" + OSApp.Language._( "Test All Stations" ) + "</option><option value='s' selected='selected'>" + OSApp.Language._( "Quick Programs" ) + "</option>";

		for ( i = 0; i < progs.length; i++ ) {
			if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
				name = OSApp.currentSession.controller.programs.pd[ i ][ 5 ];
			} else {
				name = OSApp.Language._( "Program" ) + " " + ( i + 1 );
			}
			quickPick += "<option value='" + i + "'>" + name + "</option>";
		}
		quickPick += "</select>";
		list += quickPick + "<form>";
		$.each( OSApp.currentSession.controller.stations.snames, function( i, station ) {
			if ( OSApp.Stations.isMaster( i ) ) {
				list += "<div class='ui-field-contain duration-input" + ( OSApp.Stations.isDisabled( i ) ? " station-hidden' style='display:none" : "" ) + "'>" +
					"<label for='zone-" + i + "'>" + station + ":</label>" +
					"<button disabled='true' data-mini='true' name='zone-" + i + "' id='zone-" + i + "' value='0'>Master</button></div>";
			} else {
				list += "<div class='ui-field-contain duration-input" + ( OSApp.Stations.isDisabled( i ) ? " station-hidden' style='display:none" : "" ) + "'>" +
					"<label for='zone-" + i + "'>" + station + ":</label>" +
					"<button data-mini='true' name='zone-" + i + "' id='zone-" + i + "' value='0'>0s</button></div>";
			}
		} );

		list += "</form><a class='ui-btn ui-corner-all ui-shadow rsubmit' href='#'>" + OSApp.Language._( "Submit" ) + "</a>" +
			"<a class='ui-btn ui-btn-b ui-corner-all ui-shadow rreset' href='#'>" + OSApp.Language._( "Reset" ) + "</a>";

		page.find( ".ui-content" ).html( list ).enhanceWithin();

		if ( typeof OSApp.currentSession.controller.settings.rodur === "object" ) {
			var total = 0;

			for ( i = 0; i < OSApp.currentSession.controller.settings.rodur.length; i++ ) {
				total += OSApp.currentSession.controller.settings.rodur[ i ];
			}

			if ( total !== 0 ) {
				updateLastRun( OSApp.currentSession.controller.settings.rodur );
			}
		} else {
			OSApp.Storage.get( "runonce", function( data ) {
				data = data.runonce;
				if ( data ) {
					data = JSON.parse( data );
					updateLastRun( data );
				}
			} );
		}

		page.find( "#rprog" ).on( "change", function() {
			var prog = $( this ).val();
			if ( prog === "s" ) {
				resetRunonce();
				return;
			} else if ( prog === "t" ) {

				// Test all stations
				showDurationBox( {
					incrementalUpdate: false,
					seconds: 60,
					title: "Set Duration",
					callback: function( result ) {
						fillRunonce( Array.apply( null, Array( OSApp.currentSession.controller.stations.snames.length ) ).map( function() {return result;} ) );
					},
					maximum: 65535
				} );
				return;
			}
			if ( typeof rprogs[ prog ] === "undefined" ) {
				return;
			}
			fillRunonce( rprogs[ prog ] );
		} );

		page.find( ".rsubmit" ).on( "click", submitRunonce );
		page.find( ".rreset" ).on( "click", resetRunonce );

		page.find( "[id^='zone-']" ).on( "click", function() {
			var dur = $( this ),
				name = page.find( "label[for='" + dur.attr( "id" ) + "']" ).text().slice( 0, -1 );

			showDurationBox( {
				seconds: dur.val(),
				title: name,
				callback: function( result ) {
					dur.val( result );
					dur.text( OSApp.Dates.getDurationText( result ) );
					if ( result > 0 ) {
						dur.addClass( "green" );
					} else {
						dur.removeClass( "green" );
					}
				},
				maximum: 65535,
				showSun: OSApp.Firmware.checkOSVersion( 214 ) ? true : false
			} );

			return false;
		} );

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Run-Once" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			},
			rightBtn: {
				icon: "check",
				text: OSApp.Language._( "Submit" ),
				on: submitRunonce
			}
		} );

		$( "#runonce" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin;
} )();

function submitRunonce( runonce ) {
	if ( !( runonce instanceof Array ) ) {
		runonce = [];
		$( "#runonce" ).find( "[id^='zone-']" ).each( function() {
			runonce.push( parseInt( this.value ) || 0 );
		} );
		runonce.push( 0 );
	}

	var submit = function() {
			$.mobile.loading( "show" );
			OSApp.Storage.set( { "runonce":JSON.stringify( runonce ) } );
			OSApp.Firmware.sendToOS( "/cr?pw=&t=" + JSON.stringify( runonce ) ).done( function() {
				$.mobile.loading( "hide" );
				$.mobile.document.one( "pageshow", function() {
					OSApp.Errors.showError( OSApp.Language._( "Run-once program has been scheduled" ) );
				} );
				refreshStatus();
				OSApp.UIDom.goBack();
			} );
		},
		isOn = OSApp.StationQueue.isActive();

	if ( isOn !== -1 ) {
		areYouSure( OSApp.Language._( "Do you want to stop the currently running program?" ), pidname( OSApp.Stations.getPID( isOn ) ), function() {
			$.mobile.loading( "show" );
			stopStations( submit );
		} );
	} else {
		submit();
	}
}

// Preview functions
var getPreview = ( function() {
	var page = $( "<div data-role='page' id='preview'>" +
			"<div class='ui-content' role='main'>" +
				"<div id='preview_header' class='input_with_buttons'>" +
					"<button class='preview-minus ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
					"<input class='center' type='date' name='preview_date' id='preview_date'>" +
					"<button class='preview-plus ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
				"</div>" +
				"<div id='timeline'></div>" +
				"<div data-role='controlgroup' data-type='horizontal' id='timeline-navigation'>" +
					"<a class='ui-btn ui-corner-all ui-icon-plus ui-btn-icon-notext btn-no-border' title='" + OSApp.Language._( "Zoom in" ) + "'></a>" +
					"<a class='ui-btn ui-corner-all ui-icon-minus ui-btn-icon-notext btn-no-border' title='" + OSApp.Language._( "Zoom out" ) + "'></a>" +
					"<a class='ui-btn ui-corner-all ui-icon-carat-l ui-btn-icon-notext btn-no-border' title='" + OSApp.Language._( "Move left" ) + "'></a>" +
					"<a class='ui-btn ui-corner-all ui-icon-carat-r ui-btn-icon-notext btn-no-border' title='" + OSApp.Language._( "Move right" ) + "'></a>" +
				"</div>" +
			"</div>" +
		"</div>" ),
		placeholder = page.find( "#timeline" ),
		navi = page.find( "#timeline-navigation" ),
		previewData, processPrograms, checkMatch, checkMatch183, checkMatch21, checkDayMatch, checkMatch216, runSched, runSched216,
		timeToText, changeday, render, date, day, now, is21, is211, is216;

	page.find( "#preview_date" ).on( "change", function() {
		date = this.value.split( "-" );
		day = new Date( date[ 0 ], date[ 1 ] - 1, date[ 2 ] );
		render();
	} );

	page.one( "pagebeforeshow", function() {
		OSApp.UIDom.holdButton( page.find( ".preview-plus" ), function() {
			changeday( 1 );
		} );

		OSApp.UIDom.holdButton( page.find( ".preview-minus" ), function() {
			changeday( -1 );
		} );
	} );

	page.on( {
		pagehide: function() {
			page.detach();
		},
		pageshow: function() {
			render();
		}
	} );

	processPrograms = function( month, day, year ) {
		previewData = [];
		var devday = Math.floor( OSApp.currentSession.controller.settings.devt / ( 60 * 60 * 24 ) ),
			simminutes = 0,
			simt = Date.UTC( year, month - 1, day, 0, 0, 0, 0 ),
			simday = ( simt / 1000 / 3600 / 24 ) >> 0,
			nstations = OSApp.currentSession.controller.settings.nbrd * 8,
			startArray = new Array( nstations ),
			programArray = new Array( nstations ),
			endArray = new Array( nstations ),
			plArray = new Array( nstations ),

			// Runtime queue for FW 2.1.6+
			rtQueue = [],

			// Station qid for FW 2.1.6+
			qidArray = new Array( nstations ),
			lastStopTime = 0,
			lastSeqStopTime = 0,
			lastSeqStopTimes = new Array( OSApp.Constants.options.NUM_SEQ_GROUPS ), // Use this array if seq group is available
			busy, matchFound, prog, sid, qid, d, q, sqi, bid, bid2, s, s2;

		for ( sid = 0; sid < nstations; sid++ ) {
			startArray[ sid ] = -1;
			programArray[ sid ] = 0;
			endArray[ sid ] = 0;
			plArray[ sid ] = 0;
			qidArray[ sid ] = 0xFF;
		}
		for ( d = 0; d < OSApp.Constants.options.NUM_SEQ_GROUPS; d++ ) { lastSeqStopTimes[ d ] = 0; }

		do {
			busy = 0;
			matchFound = 0;
			for ( var pid = 0; pid < OSApp.currentSession.controller.programs.pd.length; pid++ ) {
				prog = OSApp.currentSession.controller.programs.pd[ pid ];
				if ( checkMatch( prog, simminutes, simt, simday, devday ) ) {
					for ( sid = 0; sid < nstations; sid++ ) {
						bid = sid >> 3;
						s = sid % 8;

						// Skip master station
						if ( OSApp.Stations.isMaster( sid ) ) {
							continue;
						}

						if ( is21 ) {

							// Skip disabled stations
							if ( OSApp.currentSession.controller.stations.stn_dis[ bid ] & ( 1 << s ) ) {
								continue;
							}

							// Skip if water time is zero, or station is already scheduled
							if ( prog[ 4 ][ sid ] && endArray[ sid ] === 0 ) {
								var waterTime = 0;

								// Use weather scaling bit on
								// * if options.uwt >0: using an automatic adjustment method, only applies to today
								// * if options.uwt==0: using fixed manual adjustment, does not depend on tday
								if ( prog[ 0 ] & 0x02 && ( ( OSApp.currentSession.controller.options.uwt > 0 && simday === devday ) || OSApp.currentSession.controller.options.uwt === 0 ) ) {
									waterTime = getStationDuration( prog[ 4 ][ sid ], simt ) * OSApp.currentSession.controller.options.wl / 100 >> 0;
								} else {
									waterTime = getStationDuration( prog[ 4 ][ sid ], simt );
								}

								// After weather scaling, we maybe getting 0 water time
								if ( waterTime > 0 ) {
									if ( is216 ) {
										if ( rtQueue.length < nstations ) {

											// Check if there is space in the queue (queue is as large as number of stations)
											rtQueue.push( {
												st: -1,
												dur: waterTime,
												sid: sid,
												pid: pid + 1,
												gid: OSApp.currentSession.controller.stations.stn_grp ? OSApp.currentSession.controller.stations.stn_grp[ sid ] : -1,
												pl: 1
											} );
										}
									} else {
										endArray[ sid ] = waterTime;
										programArray[ sid ] = pid + 1;
									}
									matchFound = 1;
								}
							}
						} else { // If !is21
							if ( prog[ 7 + bid ] & ( 1 << s ) ) {
								endArray[ sid ] = prog[ 6 ] * OSApp.currentSession.controller.options.wl / 100 >> 0;
								programArray[ sid ] = pid + 1;
								matchFound = 1;
							}
						}
					}
			  }
			}
			if ( matchFound ) {
				var acctime = simminutes * 60,
					seqAcctime = acctime,
					seqAcctimes = new Array( OSApp.Constants.options.NUM_SEQ_GROUPS );

				if ( is211 ) {
					if ( lastSeqStopTime > acctime ) {
						seqAcctime = lastSeqStopTime + OSApp.currentSession.controller.options.sdt;
					}

					for ( d = 0; d < OSApp.Constants.options.NUM_SEQ_GROUPS; d++ ) {
						seqAcctimes[ d ] = acctime;
						if ( lastSeqStopTimes[ d ] > acctime ) {
							seqAcctimes[ d ] = lastSeqStopTimes[ d ] + OSApp.currentSession.controller.options.sdt;
						}
					}

					if ( is216 ) {

						// Schedule all stations
						for ( qid = 0; qid < rtQueue.length; qid++ ) {
							q = rtQueue[ qid ];

							// Check if already scheduled or water time is zero
							if ( q.st >= 0 || q.dur === 0 ) {
								continue;
							}
							sid = q.sid;
							bid2 = sid >> 3;
							s2 = sid & 0x07;
							if ( q.gid === -1 ) { // Group id is not available
								if ( OSApp.currentSession.controller.stations.stn_seq[ bid2 ] & ( 1 << s2 ) ) {
									q.st = seqAcctime;
									seqAcctime += q.dur;
									seqAcctime += OSApp.currentSession.controller.options.sdt;
								} else {
									q.st = acctime;
									acctime++;
								}
							} else { // Group id is available
								if ( q.gid !== OSApp.Constants.options.PARALLEL_GID_VALUE ) { // This is a sequential station
									q.st = seqAcctimes[ q.gid ];
									seqAcctimes[ q.gid ] += q.dur;
									seqAcctimes[ q.gid ] += OSApp.currentSession.controller.options.sdt;
								} else { // This is a parallel station
									q.st = acctime;
									acctime++;
								}

							}
							busy = 1;
						}
					} else { // !is216
						for ( sid = 0; sid < nstations; sid++ ) {
							bid2 = sid >> 3;
							s2 = sid & 0x07;
							if ( endArray[ sid ] === 0 || startArray[ sid ] >= 0 ) {
								continue;
							}
							if ( OSApp.currentSession.controller.stations.stn_seq[ bid2 ] & ( 1 << s2 ) ) {
								startArray[ sid ] = seqAcctime;seqAcctime += endArray[ sid ];
								endArray[ sid ] = seqAcctime;seqAcctime += OSApp.currentSession.controller.options.sdt;
								plArray[ sid ] = 1;
							} else {
								startArray[ sid ] = acctime;
								endArray[ sid ] = acctime + endArray[ sid ];
								plArray[ sid ] = 1;
							}
							busy = 1;
						}
					}
				} else { // !is21
					if ( is21 && OSApp.currentSession.controller.options.seq ) {
						if ( lastStopTime > acctime ) {
							acctime = lastStopTime + OSApp.currentSession.controller.options.sdt;
						}
					}
					if ( OSApp.currentSession.controller.options.seq ) {
						for ( sid = 0; sid < OSApp.currentSession.controller.settings.nbrd * 8; sid++ ) {
							if ( endArray[ sid ] === 0 || programArray[ sid ] === 0 ) {
								continue;
							}
							startArray[ sid ] = acctime;acctime += endArray[ sid ];
							endArray[ sid ] = acctime;acctime += OSApp.currentSession.controller.options.sdt;
							busy = 1;
						}
					} else {
						for ( sid = 0; sid < OSApp.currentSession.controller.settings.nbrd * 8; sid++ ) {
							if ( endArray[ sid ] === 0 || programArray[ sid ] === 0 ) {
								continue;
							}
							startArray[ sid ] = acctime;
							endArray[ sid ] = acctime + endArray[ sid ];
							busy = 1;
						}
					}
				} // End of !is21
			}
			if ( is216 ) {

				// Go through queue and assign queue elements to stations
				for ( qid = 0; qid < rtQueue.length; qid++ ) {
					q = rtQueue[ qid ];
					sid = q.sid;
					sqi = qidArray[ sid ];
					if ( sqi < 255 && rtQueue[ sqi ].st < q.st ) {
						continue;
					}
					qidArray[ sid ] = qid;
				}

				// Next, go through stations and calculate the schedules
				runSched216( simminutes * 60, rtQueue, qidArray, simt );

				// Progress 1 minute
				simminutes++;

				// Go through stations and remove jobs that have been done
				for ( sid = 0; sid < OSApp.currentSession.controller.settings.nbrd * 8; sid++ ) {
					sqi = qidArray[ sid ];
					if ( sqi === 255 ) {
						continue;
					}
					q = rtQueue[ sqi ];
					if ( q.st >= 0 && simminutes * 60 >= q.st + q.dur ) {

						// Remove element at index sqi
						var nqueue = rtQueue.length;

						if ( sqi < nqueue - 1 ) {

							// Copy last element to overwrite
							rtQueue[ sqi ] = rtQueue[ nqueue - 1 ];

							// Fix queue index if necessary
							if ( qidArray[ rtQueue[ sqi ].sid ] === nqueue - 1 ) {
								qidArray[ rtQueue[ sqi ].sid ] = sqi;
							}
						}
						rtQueue.pop();
						qidArray[ sid ] = 0xFF;
					}
				}

				// Lastly, calculate lastSeqStopTime
				lastSeqStopTime = 0;
				for ( d = 0; d < OSApp.Constants.options.NUM_SEQ_GROUPS; d++ ) { lastSeqStopTime[ d ] = 0; }
				for ( qid = 0; qid < rtQueue.length; qid++ ) {
					q = rtQueue[ qid ];
					sid = q.sid;
					bid2 = sid >> 3;
					s2 = sid & 0x07;
					var sst = q.st + q.dur;
					if ( q.gid === -1 ) { // Group id is not available
						if ( OSApp.currentSession.controller.stations.stn_seq[ bid2 ] & ( 1 << s2 ) ) {
							if ( sst > lastSeqStopTime ) {
								lastSeqStopTime = sst;
							}
						}
					} else { // Group id is available
						if ( q.gid !== OSApp.Constants.options.PARALLEL_GID_VALUE ) {
							if ( sst > lastSeqStopTimes[ q.gid ] ) {
								lastSeqStopTimes[ q.gid ] = sst;
							}
						}
					}
				}
			} else { // If !is216

				// Handle firmwares prior to 2.1.6
				if ( busy ) {
					if ( is211 ) {
						lastSeqStopTime = runSched( simminutes * 60, startArray, programArray, endArray, plArray, simt );
						simminutes++;
						for ( sid = 0; sid < OSApp.currentSession.controller.settings.nbrd * 8; sid++ ) {
							if ( programArray[ sid ] > 0 && simminutes * 60 >= endArray[ sid ] ) {
								startArray[ sid ] = -1;programArray[ sid ] = 0;endArray[ sid ] = 0;plArray[ sid ] = 0;
							}
						}
					} else if ( is21 ) {
						lastStopTime = runSched( simminutes * 60, startArray, programArray, endArray, plArray, simt );
						simminutes++;
						for ( sid = 0; sid < OSApp.currentSession.controller.settings.nbrd * 8; sid++ ) {
							startArray[ sid ] = -1;programArray[ sid ] = 0;endArray[ sid ] = 0;
						}
					} else {
						var endminutes = runSched( simminutes * 60, startArray, programArray, endArray, plArray, simt ) / 60 >> 0;
						if ( OSApp.currentSession.controller.options.seq && simminutes !== endminutes ) {
							simminutes = endminutes;
						} else {
							simminutes++;
						}
						for ( sid = 0; sid < OSApp.currentSession.controller.settings.nbrd * 8; sid++ ) {
							startArray[ sid ] = -1;programArray[ sid ] = 0;endArray[ sid ] = 0;
						}
					}
				} else {
					simminutes++;
					if ( is211 ) {
					  for ( sid = 0; sid < OSApp.currentSession.controller.settings.nbrd * 8; sid++ ) {
						  if ( programArray[ sid ] > 0 && simminutes * 60 >= endArray[ sid ] ) {
							  startArray[ sid ] = -1;programArray[ sid ] = 0;endArray[ sid ] = 0;plArray[ sid ] = 0;
						  }
					  }
					}
				}
			}
		} while ( simminutes < 24 * 60 );
	};

	runSched216 = function( simseconds, rtQueue, qidArray, simt ) {
		for ( var sid = 0; sid < OSApp.currentSession.controller.settings.nbrd * 8; sid++ ) {
			var sqi = qidArray[ sid ];
			if ( sqi === 255 ) {
				continue;
			}
			var q = rtQueue[ sqi ];
			if ( q.pl ) {

				// If this one hasn't been plotted
				var mas2 = typeof OSApp.currentSession.controller.options.mas2 !== "undefined" ? true : false,
					useMas1 = OSApp.currentSession.controller.stations.masop[ sid >> 3 ] & ( 1 << ( sid % 8 ) ),
					useMas2 = mas2 ? OSApp.currentSession.controller.stations.masop2[ sid >> 3 ] & ( 1 << ( sid % 8 ) ) : false;

				if ( !OSApp.Stations.isMaster( sid ) ) {
					if ( OSApp.currentSession.controller.options.mas > 0 && useMas1 ) {
						previewData.push( {
							"start": ( q.st + OSApp.currentSession.controller.options.mton ),
							"end": ( q.st + q.dur + OSApp.currentSession.controller.options.mtof ),
							"content":"",
							"className":"master",
							"shortname":"M" + ( mas2 ? "1" : "" ),
							"group":"Master",
							"station": sid
						} );
					}

					if ( mas2 && OSApp.currentSession.controller.options.mas2 > 0 && useMas2 ) {
						previewData.push( {
							"start": ( q.st + OSApp.currentSession.controller.options.mton2 ),
							"end": ( q.st + q.dur + OSApp.currentSession.controller.options.mtof2 ),
							"content":"",
							"className":"master",
							"shortname":"M2",
							"group":"Master 2",
							"station": sid
						} );
					}
				}
				timeToText( sid, q.st, q.pid, q.st + q.dur, simt );
				q.pl = 0;
			}
		}
	};

	runSched = function( simseconds, startArray, programArray, endArray, plArray, simt ) {
		var endtime = simseconds;
		for ( var sid = 0; sid < OSApp.currentSession.controller.settings.nbrd * 8; sid++ ) {
			if ( programArray[ sid ] ) {
			  if ( is211 ) {
				if ( plArray[ sid ] ) {
					var mas2 = typeof OSApp.currentSession.controller.options.mas2 !== "undefined" ? true : false,
						useMas1 = OSApp.currentSession.controller.stations.masop[ sid >> 3 ] & ( 1 << ( sid % 8 ) ),
						useMas2 = mas2 ? OSApp.currentSession.controller.stations.masop2[ sid >> 3 ] & ( 1 << ( sid % 8 ) ) : false;

					if ( !OSApp.Stations.isMaster( sid ) ) {
						if ( OSApp.currentSession.controller.options.mas > 0 && useMas1 ) {
							previewData.push( {
								"start": ( startArray[ sid ] + OSApp.currentSession.controller.options.mton ),
								"end": ( endArray[ sid ] + OSApp.currentSession.controller.options.mtof ),
								"content":"",
								"className":"master",
								"shortname":"M" + ( mas2 ? "1" : "" ),
								"group":"Master",
								"station": sid
							} );
						}

						if ( mas2 && OSApp.currentSession.controller.options.mas2 > 0 && useMas2 ) {
							previewData.push( {
								"start": ( startArray[ sid ] + OSApp.currentSession.controller.options.mton2 ),
								"end": ( endArray[ sid ] + OSApp.currentSession.controller.options.mtof2 ),
								"content":"",
								"className":"master",
								"shortname":"M2",
								"group":"Master 2",
								"station": sid
							} );
						}
					}

					timeToText( sid, startArray[ sid ], programArray[ sid ], endArray[ sid ], simt );
					plArray[ sid ] = 0;
					if ( OSApp.currentSession.controller.stations.stn_seq[ sid >> 3 ] & ( 1 << ( sid & 0x07 ) ) ) {
					  endtime = ( endtime > endArray[ sid ] ) ? endtime : endArray[ sid ];
					}
				}
			  } else {
				if ( OSApp.currentSession.controller.options.seq === 1 ) {
					if ( OSApp.Stations.isMaster( sid ) && ( OSApp.currentSession.controller.stations.masop[ sid >> 3 ] & ( 1 << ( sid % 8 ) ) ) ) {
						previewData.push( {
							"start": ( startArray[ sid ] + OSApp.currentSession.controller.options.mton ),
							"end": ( endArray[ sid ] + OSApp.currentSession.controller.options.mtof ),
							"content":"",
							"className":"master",
							"shortname":"M",
							"group":"Master",
							"station": sid
						} );
					}
					timeToText( sid, startArray[ sid ], programArray[ sid ], endArray[ sid ], simt );
					endtime = endArray[ sid ];
				} else {
					timeToText( sid, simseconds, programArray[ sid ], endArray[ sid ], simt );
					if ( OSApp.Stations.isMaster( sid ) && ( OSApp.currentSession.controller.stations.masop[ sid >> 3 ] & ( 1 << ( sid % 8 ) ) ) ) {
						endtime = ( endtime > endArray[ sid ] ) ? endtime : endArray[ sid ];
					}
				}
			  }
			}
		}
		if ( !is211 ) {
		  if ( OSApp.currentSession.controller.options.seq === 0 && OSApp.currentSession.controller.options.mas > 0 ) {
			  previewData.push( {
				  "start": simseconds,
				  "end": endtime,
				  "content":"",
				  "className":"master",
				  "shortname":"M",
				  "group":"Master",
				  "station": sid
			  } );
		  }
		}
		return endtime;
	};

	timeToText = function( sid, start, pid, end, simt ) {
		var className = "program-" + ( ( pid + 3 ) % 4 ),
			pname = "P" + pid;

		if ( ( ( OSApp.currentSession.controller.settings.rd !== 0 ) &&
			( simt + start + ( OSApp.currentSession.controller.options.tz - 48 ) * 900 <= OSApp.currentSession.controller.settings.rdst * 1000 ) ||
			OSApp.currentSession.controller.options.urs === 1 && OSApp.currentSession.controller.settings.rs === 1 ) &&
			( typeof OSApp.currentSession.controller.stations.ignore_rain === "object" &&
				( OSApp.currentSession.controller.stations.ignore_rain[ ( sid / 8 ) >> 0 ] & ( 1 << ( sid % 8 ) ) ) === 0 ) ) {

			className = "delayed";
		}

		if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
			pname = OSApp.currentSession.controller.programs.pd[ pid - 1 ][ 5 ];
		}

		previewData.push( {
			"start": start,
			"end": end,
			"className":className,
			"content":pname,
			"pid": pid - 1,
			"shortname":"S" + ( sid + 1 ),
			"group": OSApp.currentSession.controller.stations.snames[ sid ],
			"station": sid
		} );
	};

	checkMatch = function( prog, simminutes, simt, simday, devday ) {
		if ( is216 ) {
			return checkMatch216( prog, simminutes, simt, simday, devday );
		} else if ( is21 ) {
			return checkMatch21( prog, simminutes, simt, simday, devday );
		} else {
			return checkMatch183( prog, simminutes, simt, simday, devday );
		}
	};

	checkMatch183 = function( prog, simminutes, simt, simday, devday ) {
		if ( prog[ 0 ] === 0 ) {
			return 0;
		}
		if ( ( prog[ 1 ] & 0x80 ) && ( prog[ 2 ] > 1 ) ) {
			var dn = prog[ 2 ],
				drem = prog[ 1 ] & 0x7f;
			if ( ( simday % dn ) !== ( ( devday + drem ) % dn ) ) {
				return 0;
			}
		} else {
			var date = new Date( simt );
			var wd = ( date.getUTCDay() + 6 ) % 7;
			if ( ( prog[ 1 ] & ( 1 << wd ) ) === 0 ) {
				return 0;
			}
			var dt = date.getUTCDate();
			if ( ( prog[ 1 ] & 0x80 ) && ( prog[ 2 ] === 0 ) ) {
				if ( ( dt % 2 ) !== 0 ) {
					return 0;
				}
			}
			if ( ( prog[ 1 ] & 0x80 ) && ( prog[ 2 ] === 1 ) ) {
				if ( dt === 31 || ( dt === 29 && date.getUTCMonth() === 1 ) || ( dt % 2 ) !== 1 ) {
					return 0;
				}
			}
		}
		if ( simminutes < prog[ 3 ] || ( simminutes > prog[ 4 ] || ( OSApp.Firmware.isOSPi() && simminutes >= prog[ 4 ] ) ) ) {
			return 0;
		}
		if ( prog[ 5 ] === 0 ) {
			return 0;
		}
		if ( ( ( simminutes - prog[ 3 ] ) / prog[ 5 ] >> 0 ) * prog[ 5 ] === ( simminutes - prog[ 3 ] ) ) {
			return 1;
		}
		return 0;
	};

	checkDayMatch = function( prog, simt, simday, devday ) {
		var oddeven = ( prog[ 0 ] >> 2 ) & 0x03,
			type = ( prog[ 0 ] >> 4 ) & 0x03,
			date = new Date( simt );

		var dt = date.getUTCDate();
		var mt = date.getUTCMonth() + 1;
		var dr = prog[ 6 ];
		if ( typeof dr === "object" ) { // Daterange is available
			if ( dr[ 0 ] ) { // Check date range if enabled
				var currdate = ( mt << 5 ) + dt;
				if ( dr[ 1 ] <= dr[ 2 ] ) {
					if ( currdate < dr[ 1 ] || currdate > dr[ 2 ] ) { return 0; }
				} else {
					if ( currdate > dr[ 2 ] && currdate < dr[ 1 ] ) { return 0; }
				}
			}
		}

		if ( type === 3 ) {

			// Interval program
			var dn = prog[ 2 ],
				drem = prog[ 1 ];

			if ( ( simday % dn ) !== ( ( devday + drem ) % dn ) ) {
				return 0;
			}
		} else if ( type === 0 ) {

			// Weekly program
			var wd = ( date.getUTCDay() + 6 ) % 7;
			if ( ( prog[ 1 ] & ( 1 << wd ) ) === 0 ) {
				return 0;
			}
		} else {
			return 0;
		}

		// Odd/Even restriction handling

		if ( oddeven === 2 ) {
			if ( ( dt % 2 ) !== 0 ) {
				return 0;
			}
		} else if ( oddeven === 1 ) {
			if ( dt === 31 || ( dt === 29 && date.getUTCMonth() === 1 ) || ( dt % 2 ) !== 1 ) {
				return 0;
			}
		}
		return 1;
	};

	checkMatch21 = function( prog, simminutes, simt, simday, devday ) {
		var en = prog[ 0 ] & 0x01,
			sttype = ( prog[ 0 ] >> 6 ) & 0x01,
			date = new Date( simt );

		if ( en === 0 ) {
			return 0;
		}

		if ( !checkDayMatch( prog, simt, simday, devday ) ) {
		  return 0;
		}

		// Start time matching
		if ( sttype === 0 ) {

			// Repeating program
			var start = getStartTime( prog[ 3 ][ 0 ], date ),
				repeat = prog[ 3 ][ 1 ],
				cycle = prog[ 3 ][ 2 ];

			if ( simminutes < start ) {
				return 0;
			}

			if ( repeat === 0 ) {

				// Single run program
				return ( simminutes === start ) ? 1 : 0;
			}

			if ( cycle === 0 ) {

				// If this is a multi-run, cycle time must be > 0
				return 0;
			}

			var c = Math.round( ( simminutes - start ) / cycle );
			if ( ( c * cycle === ( simminutes - start ) ) && ( c <= repeat ) ) {
				return 1;
			}
		} else {

			// Set start time program
			var sttimes = prog[ 3 ];
			for ( var i = 0; i < 4; i++ ) {

				if ( simminutes === getStartTime( sttimes[ i ], date ) ) {
					return 1;
				}
			}
		}
		return 0;
	};

	checkMatch216 = function( prog, simminutes, simt, simday, devday ) {
		var en = prog[ 0 ] & 0x01,
			sttype = ( prog[ 0 ] >> 6 ) & 0x01,
			date = new Date( simt );

		if ( en === 0 ) {
			return 0;
		}

		var start = getStartTime( prog[ 3 ][ 0 ], date ),
			repeat = prog[ 3 ][ 1 ],
			cycle = prog[ 3 ][ 2 ],
			c;

		// Check if simday matches the program start days
		if ( checkDayMatch( prog, simt, simday, devday ) ) {

			// Match the start time
			if ( sttype === 0 ) {

				// Repeating program
				if ( simminutes === start ) {
					return 1;
				}

				if ( simminutes > start && cycle ) {
					c = Math.round( ( simminutes - start ) / cycle );
					if ( ( c * cycle === ( simminutes - start ) ) && ( c <= repeat ) ) {
						return 1;
					}
				}

			} else {

				// Set start time program
				var sttimes = prog[ 3 ];
				for ( var i = 0; i < 4; i++ ) {

					if ( simminutes === getStartTime( sttimes[ i ], date ) ) {
						return 1;
					}
				}
				return 0;
			}
		}

		// To proceed, the program has to be repeating type,
		// and interval and repeat must be non-zero
		if ( sttype || !cycle ) {
			return 0;
		}

		// Check if the previous day is a program start day
		if ( checkDayMatch( prog, simt - 86400000, simday - 1, devday ) ) {

			// If so, check if a repeating program
			// has start times that fall on today
			c = Math.round( ( simminutes - start + 1440 ) / cycle );
			if ( ( c * cycle === ( simminutes - start + 1440 ) ) && ( c <= repeat ) ) {
				return 1;
			}
		}
		return 0;
	};

	changeday = function( dir ) {
		day.setDate( day.getDate() + dir );

		var m = OSApp.Utils.pad( day.getMonth() + 1 ),
			d = OSApp.Utils.pad( day.getDate() ),
			y = day.getFullYear();

		date = [ y, m, d ];
		page.find( "#preview_date" ).val( date.join( "-" ) );
		render();
	};

	render = function() {
		processPrograms( date[ 1 ], date[ 2 ], date[ 0 ] );

		navi.hide();

		if ( !previewData.length ) {
			page.find( "#timeline" ).html( "<p align='center'>" + OSApp.Language._( "No stations set to run on this day." ) + "</p>" );
			return;
		}

		previewData.sort( OSApp.Utils.sortByStation );

		var shortnames = [],
			max = new Date( date[ 0 ], date[ 1 ] - 1, date[ 2 ], 24 );

		$.each( previewData, function() {
			var total = this.start + this.end;

			this.start = new Date( date[ 0 ], date[ 1 ] - 1, date[ 2 ], 0, 0, this.start );
			if ( total > 86400 ) {
				var extraDays = Math.floor( this.end / 86400 );

				this.end = new Date( date[ 0 ], date[ 1 ] - 1, parseInt( date[ 2 ] ) + extraDays, 0, 0, this.end % 86400 );
				max = max > this.end ? max : this.end;

			} else {
				this.end = new Date( date[ 0 ], date[ 1 ] - 1, date[ 2 ], 0, 0, this.end );
			}
			shortnames[ this.group ] = this.shortname;
		} );

		var options = {
			"width":  "100%",
			"editable": false,
			"axisOnTop": true,
			"eventMargin": 10,
			"eventMarginAxis": 0,
			"min": new Date( date[ 0 ], date[ 1 ] - 1, date[ 2 ], 0 ),
			"max": max,
			"selectable": true,
			"showMajorLabels": false,
			"zoomMax": 1000 * 60 * 60 * 24,
			"zoomMin": 1000 * 60 * 60,
			"groupsChangeable": false,
			"showNavigation": false,
			"groupsOrder": "none",
			"groupMinHeight": 20
		},
		resize = function() {
			timeline.redraw();
		},
		timeline = new links.Timeline( placeholder[ 0 ], options ),
		currentTime = new Date( now );

		currentTime.setMinutes( currentTime.getMinutes() + currentTime.getTimezoneOffset() );

		timeline.setCurrentTime( currentTime );
		links.events.addListener( timeline, "select", function() {
			var sel = timeline.getSelection();

			if ( sel.length ) {
				if ( typeof sel[ 0 ].row !== "undefined" ) {
					OSApp.UIDom.changePage( "#programs", {
						"programToExpand": parseInt( timeline.getItem( sel[ 0 ].row ).pid )
					} );
				}
			}
		} );

		$.mobile.window.on( "resize", resize );

		page.one( "pagehide", function() {
			$.mobile.window.off( "resize", resize );
		} );

		timeline.draw( previewData );

		page.find( ".timeline-groups-text" ).each( function() {
			var stn = $( this );
			var name = shortnames[ stn.text() ];
			stn.attr( "data-shortname", name );
		} );

		page.find( ".timeline-groups-axis" ).children().first().html( "<div class='timeline-axis-text center dayofweek' data-shortname='" +
			OSApp.Dates.getDayName( day, "short" ) + "'>" + OSApp.Dates.getDayName( day ) + "</div>" );

		if ( OSApp.currentDevice.isAndroid ) {
			navi.find( ".ui-icon-plus" ).off( "click" ).on( "click", function() {
				timeline.zoom( 0.4 );
				return false;
			} );
			navi.find( ".ui-icon-minus" ).off( "click" ).on( "click", function() {
				timeline.zoom( -0.4 );
				return false;
			} );
			navi.find( ".ui-icon-carat-l" ).off( "click" ).on( "click", function() {
				timeline.move( -0.2 );
				return false;
			} );
			navi.find( ".ui-icon-carat-r" ).off( "click" ).on( "click", function() {
				timeline.move( 0.2 );
				return false;
			} );

			navi.show();
		} else {
			navi.hide();
		}

		placeholder.on( "swiperight swipeleft", function( e ) {
			e.stopImmediatePropagation();
		} );

	};

	function begin() {
		is21 = OSApp.Firmware.checkOSVersion( 210 );
		is211 = OSApp.Firmware.checkOSVersion( 211 );
		is216 = OSApp.Firmware.checkOSVersion( 216 );

		if ( page.find( "#preview_date" ).val() === "" ) {
			now = new Date( OSApp.currentSession.controller.settings.devt * 1000 );
			date = now.toISOString().slice( 0, 10 ).split( "-" );
			day = new Date( date[ 0 ], date[ 1 ] - 1, date[ 2 ] );
			page.find( "#preview_date" ).val( date.join( "-" ) );
		}

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Program Preview" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			}
		} );

		$( "#preview" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin;
} )();

function getStationDuration( duration, date ) {
	if ( OSApp.Firmware.checkOSVersion( 214 ) ) {
		var sunTimes = getSunTimes( date );

		if ( duration === 65535 ) {
			duration = ( ( sunTimes[ 0 ] + 1440 ) - sunTimes[ 1 ] ) * 60;
		} else if ( duration === 65534 ) {
			duration = ( sunTimes[ 1 ] - sunTimes[ 0 ] ) * 60;
		}
	}

	return duration;
}

// Logging functions
var getLogs = ( function() {

	var page = $( "<div data-role='page' id='logs'>" +
			"<div class='ui-content' role='main'>" +
				"<fieldset data-role='controlgroup' data-type='horizontal' data-mini='true' class='log_type'>" +
					"<input data-mini='true' type='radio' name='log_type' id='log_timeline' value='timeline'>" +
					"<label for='log_timeline'>" + OSApp.Language._( "Timeline" ) + "</label>" +
					"<input data-mini='true' type='radio' name='log_type' id='log_table' value='table'>" +
					"<label for='log_table'>" + OSApp.Language._( "Table" ) + "</label>" +
				"</fieldset>" +
				"<fieldset data-role='collapsible' data-mini='true' id='log_options' class='center'>" +
					"<legend>" + OSApp.Language._( "Options" ) + "</legend>" +
					"<fieldset data-role='controlgroup' data-type='horizontal' id='table_sort'>" +
					  "<p class='tight'>" + OSApp.Language._( "Grouping:" ) + "</p>" +
					  "<input data-mini='true' type='radio' name='table-group' id='table-sort-day' value='day' checked='checked'>" +
					  "<label for='table-sort-day'>" + OSApp.Language._( "Day" ) + "</label>" +
					  "<input data-mini='true' type='radio' name='table-group' id='table-sort-station' value='station'>" +
					  "<label for='table-sort-station'>" + OSApp.Language._( "Station" ) + "</label>" +
					"</fieldset>" +
					"<div class='ui-field-contain'>" +
						"<label for='log_start'>" + OSApp.Language._( "Start:" ) + "</label>" +
						"<input data-mini='true' type='date' id='log_start'>" +
						"<label for='log_end'>" + OSApp.Language._( "End:" ) + "</label>" +
						"<input data-mini='true' type='date' id='log_end'>" +
					"</div>" +
					"<a data-role='button' data-icon='action' class='export_logs' href='#' data-mini='true'>" + OSApp.Language._( "Export" ) + "</a>" +
					"<a data-role='button' class='red clear_logs' href='#' data-mini='true' data-icon='alert'>" +
						OSApp.Language._( "Clear Logs" ) +
					"</a>" +
				"</fieldset>" +
				"<div id='logs_list' class='center'>" +
				"</div>" +
			"</div>" +
		"</div>" ),
		logsList = page.find( "#logs_list" ),
		tableSort = page.find( "#table_sort" ),
		logOptions = page.find( "#log_options" ),
		data = [],
		waterlog = [],
		flowlog = [],
		sortData = function( type, grouping ) {

			var sortedData = [],
				stats = {
					totalRuntime: 0,
					totalCount: 0
				};

			if ( type === "table" && grouping === "station" ) {
				for ( i = 0; i < stations.length; i++ ) {
					sortedData[ i ] = [];
				}
			}

			$.each( data, function() {
				var station = this[ 1 ],
					duration = parseInt( this[ 2 ] );

				// Adjust for negative watering time firmware bug
				if ( duration < 0 ) {
					duration += 65536;
				}

				var date = new Date( parseInt( this[ 3 ] * 1000 ) - ( duration * 1000 ) ),
					utc = new Date( date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),  date.getUTCHours(),
						date.getUTCMinutes(), date.getUTCSeconds() );

				if ( typeof station === "string" ) {
					if ( station === "rd" ) {
						station = stations.length - 1;
					} else if ( station === "s1" ) {
						station = stations.length - 3;
					} else if ( station === "s2" ) {
						station = stations.length - 2;
					} else if ( station === "rs" ) {
						station = stations.length - 2;
					} else {
						return;
					}
				} else if ( typeof station === "number" ) {
					if ( station > stations.length - 2 || OSApp.Stations.isMaster( station ) ) {
						return;
					}

					stats.totalRuntime += duration;
					stats.totalCount++;
				}

				if ( type === "table" ) {
					switch ( grouping ) {
						case "station":
							sortedData[ station ].push( [ utc, OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( duration ) ) ] );
							break;
						case "day":
							var day = Math.floor( date.getTime() / 1000 / 60 / 60 / 24 ),
								item = [ utc, OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( duration ) ), station, new Date( utc.getTime() + ( duration * 1000 ) ) ];

							// Item structure: [startDate, runtime, station, endDate]

							if ( typeof sortedData[ day ] !== "object" ) {
								sortedData[ day ] = [ item ];
							} else {
								sortedData[ day ].push( item );
							}

							break;
					}
				} else if ( type === "timeline" ) {
					var pid = parseInt( this[ 0 ] ),
						className, name, group, shortname;

					if ( this[ 1 ] === "rs" ) {
						className = "delayed";
						name = OSApp.Language._( "Rain Sensor" );
						group = name;
						shortname = OSApp.Language._( "RS" );
					} else if ( this[ 1 ] === "rd" ) {
						className = "delayed";
						name = OSApp.Language._( "Rain Delay" );
						group = name;
						shortname = OSApp.Language._( "RD" );
					} else if ( this[ 1 ] === "s1" ) {
						className = "delayed";
						name = OSApp.currentSession.controller.options.sn1t === 3 ? OSApp.Language._( "Soil Sensor" ) : OSApp.Language._( "Rain Sensor" );
						group = name;
						shortname = OSApp.Language._( "SEN1" );
					} else if ( this[ 1 ] === "s2" ) {
						className = "delayed";
						name = OSApp.currentSession.controller.options.sn2t === 3 ? OSApp.Language._( "Soil Sensor" ) : OSApp.Language._( "Rain Sensor" );
						group = name;
						shortname = OSApp.Language._( "SEN2" );
					} else if ( pid === 0 ) {
						return;
					} else {
						className = "program-" + ( ( pid + 3 ) % 4 );
						name = pidname( pid );
						group = OSApp.currentSession.controller.stations.snames[ station ];
						shortname = "S" + ( station + 1 );
					}

					sortedData.push( {
						"start": utc,
						"end": new Date( utc.getTime() + ( duration * 1000 ) ),
						"className": className,
						"content": name,
						"pid": pid - 1,
						"shortname": shortname,
						"group": group,
						"station": station
					} );
				}
			} );

			if ( type === "timeline" ) {
				sortedData.sort( OSApp.Utils.sortByStation );
			}

			return [ sortedData, stats ];
		},
		sortExtraData = function( stats, type ) {
			var wlSorted = [],
				flSorted = [];

			if ( waterlog.length ) {
				stats.avgWaterLevel = 0;
				$.each( waterlog, function() {
					wlSorted[ Math.floor( this[ 3 ] / 60 / 60 / 24 ) ] = this[ 2 ];
					stats.avgWaterLevel += this[ 2 ];
				} );
				stats.avgWaterLevel = parseFloat( ( stats.avgWaterLevel / waterlog.length ).toFixed( 2 ) );
			}

			if ( flowlog.length ) {
				stats.totalVolume = 0;
				$.each( flowlog, function() {
					var volume = flowCountToVolume( this[ 0 ] );

					if ( type === "timeline" ) {
						var date = new Date( parseInt( this[ 3 ] * 1000 ) ),
							utc = new Date( date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),  date.getUTCHours(),
								date.getUTCMinutes(), date.getUTCSeconds() );

						flSorted.push( {
							"start": new Date( utc.getTime() - parseInt( this[ 2 ] * 1000 ) ),
							"end": utc,
							"className": "",
							"content": volume + " L",
							"shortname": OSApp.Language._( "FS" ),
							"group": OSApp.Language._( "Flow Sensor" )
						} );
					} else {
						var day = Math.floor( this[ 3 ] / 60 / 60 / 24 );

						flSorted[ day ] = flSorted[ day ] ? flSorted[ day ] + volume : volume;
					}
					stats.totalVolume += volume;
				} );
			}

			return [ wlSorted, flSorted, stats ];
		},
		success = function( items, wl, fl ) {
			if ( typeof items !== "object" || items.length < 1 || ( items.result && items.result === 32 ) ) {
				$.mobile.loading( "hide" );
				resetLogsPage();
				return;
			}

			try {
				flowlog = JSON.parse( flowlog.replace( /,\s*inf/g, "" ) );
			} catch ( err ) {
				flowlog = [];
			}

			data = items;
			waterlog = $.isEmptyObject( wl ) ? [] : wl;
			flowlog = $.isEmptyObject( fl ) ? [] : fl;

			updateView();

			OSApp.Utils.exportObj( ".export_logs", data );

			$.mobile.loading( "hide" );
		},
		updateView = function() {
			if ( page.find( "#log_table" ).prop( "checked" ) ) {
				prepTable();
			} else if ( page.find( "#log_timeline" ).prop( "checked" ) ) {
				prepTimeline();
			}
		},
		prepTimeline = function() {
			if ( data.length < 1 ) {
				resetLogsPage();
				return;
			}

			tableSort.hide();
			logsList.show();

			logOptions.collapsible( "collapse" );

			var sortedData = sortData( "timeline" ),
				extraData = sortExtraData( sortedData[ 1 ], "timeline" ),
				fullData = sortedData[ 0 ].concat( extraData[ 1 ] ),
				stats = extraData[ 2 ],
				options = {
					"width":  "100%",
					"editable": false,
					"axisOnTop": true,
					"eventMargin": 10,
					"eventMarginAxis": 0,
					"min": dates().start,
					"max": new Date( dates().end.getTime() + 86340000 ),
					"selectable": false,
					"showMajorLabels": false,
					"groupsChangeable": false,
					"showNavigation": false,
					"groupsOrder": "none",
					"groupMinHeight": 20,
					"zoomMin": 1000 * 60
				},
				resize = function() {
					timeline.redraw();
				},
				reset = function() {
					$.mobile.window.off( "resize", resize );
				},
				shortnames = [];

			logsList.on( "swiperight swipeleft", function( e ) {
				e.stopImmediatePropagation();
			} );

			$.each( fullData, function() {
				shortnames[ this.group ] = this.shortname;
			} );

			var timeline = new links.Timeline( logsList.get( 0 ), options );

			$.mobile.window.on( "resize", resize );
			page.one( "pagehide", reset );
			page.find( "input:radio[name='log_type']" ).one( "change", reset );

			timeline.draw( fullData );

			logsList.find( ".timeline-groups-text" ).each( function() {
				this.setAttribute( "data-shortname", shortnames[ this.textContent ] );
			} );

			logsList.prepend( showStats( stats ) );
		},
		prepTable = function() {
			if ( data.length < 1 ) {
				resetLogsPage();
				return;
			}

			tableSort.show();
			logsList.show();

			var grouping = page.find( "input:radio[name='table-group']:checked" ).val(),
				rawData = sortData( "table", grouping ),
				sortedData = rawData[ 0 ],
				extraData = sortExtraData( rawData [ 1 ] ),
				groupArray = [],
				wlSorted = extraData[ 0 ],
				flSorted = extraData[ 1 ],
				stats = extraData[ 2 ],
				tableHeader = "<table id=\"table-logs\"><thead><tr>" +
					"<th data-priority='1'>" + OSApp.Language._( "Station" ) + "</th>" +
					"<th data-priority='2'>" + OSApp.Language._( "Runtime" ) + "</th>" +
					"<th data-priority='3'>" + OSApp.Language._( "Start Time" ) + "</th>" +
					"<th data-priority='4'>" + OSApp.Language._( "End Time" ) + "</th>" +
					"</tr></thead><tbody>",
				html = showStats( stats ) + "<div data-role='collapsible-set' data-inset='true' data-theme='b' data-collapsed-icon='arrow-d' data-expanded-icon='arrow-u'>",
				i = 0,
				group, ct, k;

			// Return HH:MM:SS formatting for dt datetime object.
			var formatTime = function( dt, g ) {
				return g === "station" ? OSApp.Dates.dateToString( dt, false ) : OSApp.Utils.pad( dt.getHours() ) + ":" + OSApp.Utils.pad( dt.getMinutes() ) + ":" + OSApp.Utils.pad( dt.getSeconds() );
			};

			for ( group in sortedData ) {
				if ( sortedData.hasOwnProperty( group ) ) {
					ct = sortedData[ group ].length;
					if ( ct === 0 ) {
						continue;
					}
					groupArray[ i ] = "<div data-role='collapsible' data-collapsed='true'><h2>" +
							( ( OSApp.Firmware.checkOSVersion( 210 ) && grouping === "day" ) ? "<a class='ui-btn red ui-btn-corner-all delete-day day-" +
								group + "'>" + OSApp.Language._( "delete" ) + "</a>" : "" ) +
							"<div class='ui-btn-up-c ui-btn-corner-all custom-count-pos'>" +
								ct + " " + ( ( ct === 1 ) ? OSApp.Language._( "run" ) : OSApp.Language._( "runs" ) ) +
							"</div>" + ( grouping === "station" ? stations[ group ] : OSApp.Dates.dateToString(
								new Date( group * 1000 * 60 * 60 * 24 )
							).slice( 0, -9 ) ) +
						"</h2>";

					if ( wlSorted[ group ] ) {
						groupArray[ i ] += "<span style='border:none' class='" +
							( wlSorted[ group ] !== 100 ? ( wlSorted[ group ] < 100 ? "green " : "red " ) : "" ) +
							"ui-body ui-body-a'>" + OSApp.Language._( "Average" ) + " " + OSApp.Language._( "Water Level" ) + ": " + wlSorted[ group ] + "%</span>";
					}

					if ( flSorted[ group ] ) {
						groupArray[ i ] += "<span style='border:none' class='ui-body ui-body-a'>" +
							OSApp.Language._( "Total Water Used" ) + ": " + flSorted[ group ] + " L" +
							"</span>";
					}

					groupArray[ i ] += tableHeader;

					for ( k = 0; k < sortedData[ group ].length; k++ ) {
						groupArray[ i ] += "<tr>" +
							"<td>" + stations[ sortedData[ group ][ k ][ 2 ] ] + "</td>" + // Station name
							"<td>" + sortedData[ group ][ k ][ 1 ] + "</td>" + // Runtime
							"<td>" + formatTime( sortedData[ group ][ k ][ 0 ], grouping ) + "</td>" + // Startdate
							"<td>" + formatTime( sortedData[ group ][ k ][ 3 ], grouping ) + "</td>" + // Enddate
							"</tr>";
					}
					groupArray[ i ] += "</tbody></table></div>";

					i++;
				}
			}

			if ( grouping === "day" ) {
				groupArray.reverse();
			}

			logOptions.collapsible( "collapse" );
			logsList.html( html + groupArray.join( "" ) + "</div>" ).enhanceWithin();

			// Initialize datatable
			$( "#table-logs" ).DataTable( OSApp.UIDom.getDatatablesConfig() );

			logsList.find( ".delete-day" ).on( "click", function() {
				var day, date;

				$.each( this.className.split( " " ), function() {
					if ( this.indexOf( "day-" ) === 0 ) {
						day = this.split( "day-" )[ 1 ];
						return false;
					}
				} );

				date = OSApp.Dates.dateToString( new Date( day * 1000 * 60 * 60 * 24 ) ).slice( 0, -9 );

				areYouSure( OSApp.Language._( "Are you sure you want to " ) + OSApp.Language._( "delete" ) + " " + date + "?", "", function() {
					$.mobile.loading( "show" );
					OSApp.Firmware.sendToOS( "/dl?pw=&day=" + day ).done( function() {
						requestData();
						OSApp.Errors.showError( date + " " + OSApp.Language._( "deleted" ) );
					} );
				} );

				return false;
			} );

			OSApp.UIDom.fixInputClick( logsList );
		},
		showStats = function( stats ) {
			if ( stats.totalCount === 0 || stats.totalRuntime === 0 ) {
				return "";
			}

			var hasWater = typeof stats.avgWaterLevel !== "undefined";

			return "<div class='ui-body-a smaller' id='logs_summary'>" +
						"<div><span class='bold'>" + OSApp.Language._( "Total Station Events" ) + "</span>: " + stats.totalCount + "</div>" +
						"<div><span class='bold'>" + OSApp.Language._( "Total Runtime" ) + "</span>: " + OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( stats.totalRuntime ) ) + "</div>" +
						( hasWater ?
							"<div><span class='bold'>" +  OSApp.Language._( "Average" ) + " " + OSApp.Language._( "Water Level" ) + "</span>: <span class='" +
									( stats.avgWaterLevel !== 100 ? ( stats.avgWaterLevel < 100 ? "green-text" : "red-text" ) : "" ) +
								"'>" + stats.avgWaterLevel + "%</span></div>" : ""
						) +
						( typeof stats.totalVolume !== "undefined" && stats.totalVolume > 0 ? "<div><span class='bold'>" + OSApp.Language._( "Total Water Used" ) + "</span>: " + stats.totalVolume + " L" +
							( hasWater && stats.avgWaterLevel < 100 ? " (<span class='green-text'>" + ( stats.totalVolume - ( stats.totalVolume * ( stats.avgWaterLevel / 100 ) ) ).toFixed( 2 ) + "L saved</span>)" : "" ) +
						"</div>" : "" ) +
					"</div>";
		},
		resetLogsPage = function() {
			data = [];
			logOptions.collapsible( "expand" );
			tableSort.hide();
			logsList.show().html( OSApp.Language._( "No entries found in the selected date range" ) );
		},
		fail = function() {
			$.mobile.loading( "hide" );

			tableSort.empty().hide();
			logsList.show().html( OSApp.Language._( "Error retrieving log data. Please refresh to try again." ) );
		},
		dates = function() {
			var sDate = logStart.val().split( "-" ),
				eDate = logEnd.val().split( "-" );
			return {
				start: new Date( sDate[ 0 ], sDate[ 1 ] - 1, sDate[ 2 ] ),
				end: new Date( eDate[ 0 ], eDate[ 1 ] - 1, eDate[ 2 ] )
			};
		},
		parms = function() {
			return "start=" + ( dates().start.getTime() / 1000 ) + "&end=" + ( ( dates().end.getTime() / 1000 ) + 86340 );
		},
		requestData = function() {
			var endtime = dates().end.getTime() / 1000,
				starttime = dates().start.getTime() / 1000;

			if ( endtime < starttime ) {
				resetLogsPage();
				OSApp.Errors.showError( OSApp.Language._( "Start time cannot be greater than end time" ) );
				return;
			}

			var delay = 0;
			$.mobile.loading( "show" );

			if ( ( endtime - starttime ) > 31540000 ) {
				OSApp.Errors.showError( OSApp.Language._( "The requested time span exceeds the maximum of 1 year and has been adjusted" ), 3500 );
				var nDate = dates().start;
				nDate.setFullYear( nDate.getFullYear() + 1 );
				$( "#log_end" ).val( nDate.getFullYear() + "-" + OSApp.Utils.pad( nDate.getMonth() + 1 ) + "-" + OSApp.Utils.pad( nDate.getDate() ) );
				delay = 500;
			}

			var wlDefer = $.Deferred().resolve(),
				flDefer = $.Deferred().resolve();

			if ( OSApp.Firmware.checkOSVersion( 211 ) ) {
				wlDefer = OSApp.Firmware.sendToOS( "/jl?pw=&type=wl&" + parms(), "json" );
			}

			if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
				flDefer = OSApp.Firmware.sendToOS( "/jl?pw=&type=fl&" + parms() );
			}

			setTimeout( function() {
				$.when(
					OSApp.Firmware.sendToOS( "/jl?pw=&" + parms(), "json" ),
					wlDefer,
					flDefer
				).then( success, fail );
			}, delay );
		},
		isNarrow = window.innerWidth < 640 ? true : false,
		logStart = page.find( "#log_start" ),
		logEnd = page.find( "#log_end" ),
		stations, logtimeout, i;

	// Bind clear logs button
	page.find( ".clear_logs" ).on( "click", function() {
		clearLogs( requestData );
		return false;
	} );

	//Automatically update the log viewer when changing the date range
	if ( OSApp.currentDevice.isiOS ) {
		logStart.add( logEnd ).on( "blur", function() {
			if ( page.hasClass( "ui-page-active" ) ) {
				requestData();
			}
		} );
	} else {
		logStart.add( logEnd ).change( function() {
			clearTimeout( logtimeout );
			logtimeout = setTimeout( requestData, 1000 );
		} );
	}

	//Automatically update log viewer when switching table sort
	tableSort.find( "input[name='table-group']" ).change( function() {
		prepTable();
	} );

	//Bind view change buttons
	page.find( "input:radio[name='log_type']" ).change( updateView );

	page.on( {
		pagehide: function() {
			page.detach();
		},
		pageshow: requestData
	} );

	page.find( "#log_timeline" ).prop( "checked", !isNarrow );
	page.find( "#log_table" ).prop( "checked", isNarrow );

	function begin() {
		var additionalMetrics = OSApp.Firmware.checkOSVersion( 219 ) ? [
			OSApp.currentSession.controller.options.sn1t === 3 ? OSApp.Language._( "Soil Sensor" ) : OSApp.Language._( "Rain Sensor" ),
			OSApp.currentSession.controller.options.sn2t === 3 ? OSApp.Language._( "Soil Sensor" ) : OSApp.Language._( "Rain Sensor" ),
			OSApp.Language._( "Rain Delay" )
		] : [ OSApp.Language._( "Rain Sensor" ), OSApp.Language._( "Rain Delay" ) ];

		stations = $.merge( $.merge( [], OSApp.currentSession.controller.stations.snames ), additionalMetrics );
		page.find( ".clear_logs" ).toggleClass( "hidden", ( OSApp.Firmware.isOSPi() || OSApp.Firmware.checkOSVersion( 210 ) ?  false : true ) );

		if ( logStart.val() === "" || logEnd.val() === "" ) {
			var now = new Date( OSApp.currentSession.controller.settings.devt * 1000 );
			logStart.val( new Date( now.getTime() - 604800000 ).toISOString().slice( 0, 10 ) );
			logEnd.val( now.toISOString().slice( 0, 10 ) );
		}

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Logs" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			},
			rightBtn: {
				icon: "refresh",
				text: OSApp.Language._( "Refresh" ),
				on: requestData
			}
		} );

		$( "#logs" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin;
} )();

function clearLogs( callback ) {
	areYouSure( OSApp.Language._( "Are you sure you want to clear ALL your log data?" ), "", function() {
		var url = OSApp.Firmware.isOSPi() ? "/cl?pw=" : "/dl?pw=&day=all";
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( url ).done( function() {
			if ( typeof callback === "function" ) {
				callback();
			}
			OSApp.Errors.showError( OSApp.Language._( "Logs have been cleared" ) );
		} );
	} );
}

function clearPrograms( callback ) {
	areYouSure( OSApp.Language._( "Are you sure you want to delete ALL programs?" ), "", function() {
		var url = "/dp?pw=&pid=-1";
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( url ).done( function() {
			if ( typeof callback === "function" ) {
				callback();
			}
			OSApp.Errors.showError( OSApp.Language._( "Programs have been deleted" ) );
		} );
	} );
}

function resetAllOptions( callback ) {
	areYouSure( OSApp.Language._( "Are you sure you want to delete all settings and return to the default settings?" ), "", function() {
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
			updateController( updateWeather );
		} );
	} );
}

// Program management functions
var getPrograms = ( function() {
	var page = $( "<div data-role='page' id='programs'>" +
			"<div class='ui-content' role='main' id='programs_list'>" +
			"</div>" +
		"</div>" ),
		expandId;

	page
	.on( "programrefresh", updateContent )
	.on( "pagehide", function() {
		page.detach();
	} )
	.on( "pagebeforeshow", function() {
		updateProgramHeader();

		if ( typeof expandId !== "number" && OSApp.currentSession.controller.programs.pd.length === 1 ) {
			expandId = 0;
		}

		if ( typeof expandId === "number" ) {
			page.find( "fieldset[data-collapsed='false']" ).collapsible( "collapse" );
			$( "#program-" + expandId ).collapsible( "expand" );
		}
	} );

	function updateContent() {
		var list = $( makeAllPrograms() );

		list.find( "[id^=program-]" ).on( {
			collapsiblecollapse: function() {
				$( this ).find( ".ui-collapsible-content" ).empty();
			},
			collapsiblebeforecollapse: function( e ) {
				var program = $( this ),
					changed = program.find( ".hasChanges" );

				if ( changed.length ) {
					areYouSure( OSApp.Language._( "Do you want to save your changes?" ), "", function() {
						changed.removeClass( "hasChanges" ).click();
						program.collapsible( "collapse" );
					}, function() {
						changed.removeClass( "hasChanges" );
						program.collapsible( "collapse" );
					} );
					e.preventDefault();
				}
			},
			collapsibleexpand: function() {
				expandProgram( $( this ) );
			}
		} );

		if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
			list.find( ".move-up" ).removeClass( "hidden" ).on( "click", function() {
				var group = $( this ).parents( "fieldset" ),
					pid = parseInt( group.attr( "id" ).split( "-" )[ 1 ] );

				$.mobile.loading( "show" );

				OSApp.Firmware.sendToOS( "/up?pw=&pid=" + pid ).done( function() {
					updateControllerPrograms( function() {
						$.mobile.loading( "hide" );
						page.trigger( "programrefresh" );
					} );
				} );

				return false;
			} );
		}

		list.find( ".program-copy" ).on( "click", function() {
			var copyID = parseInt( $( this ).parents( "fieldset" ).attr( "id" ).split( "-" )[ 1 ] );

			OSApp.UIDom.changePage( "#addprogram", {
				copyID: copyID
			} );

			return false;
		} );

		page.find( "#programs_list" ).html( list.enhanceWithin() );
	}

	function begin( pid ) {
		expandId = pid;

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Programs" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.checkChangesBeforeBack
			},
			rightBtn: {
				icon: "plus",
				text: OSApp.Language._( "Add" ),
				on: function() {
					OSApp.UIDom.checkChanges( function() {
						OSApp.UIDom.changePage( "#addprogram" );
					} );
				}
			}

		} );

		updateContent();

		$( "#programs" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin;
} )();

function expandProgram( program ) {
	var id = parseInt( program.attr( "id" ).split( "-" )[ 1 ] );

	program.find( ".ui-collapsible-content" ).html( makeProgram( id ) ).enhanceWithin().on( "change input click", function( e ) {
		if ( e.type === "click" && e.target.tagName !== "BUTTON" ) {
			return;
		}

		$( this ).off( "change input click" );
		program.find( "[id^='submit-']" ).addClass( "hasChanges" );
	} );

	program.find( "[id^='submit-']" ).on( "click", function() {
		submitProgram( id );
		return false;
	} );

	program.find( "[id^='delete-']" ).on( "click", function() {
		deleteProgram( id );
		return false;
	} );

	program.find( "[id^='run-']" ).on( "click", function() {
		var name = OSApp.Firmware.checkOSVersion( 210 ) ? OSApp.currentSession.controller.programs.pd[ id ][ 5 ] : "Program " + id;

		areYouSure( OSApp.Language._( "Are you sure you want to start " + name + " now?" ), "", function() {
			var runonce = [],
				finish = function() {
					runonce.push( 0 );
					submitRunonce( runonce );
				};

			if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
				runonce = OSApp.currentSession.controller.programs.pd[ id ][ 4 ];

				if ( ( OSApp.currentSession.controller.programs.pd[ id ][ 0 ] >> 1 ) & 1 ) {
					areYouSure( OSApp.Language._( "Do you wish to apply the current watering level?" ), "", function() {
						for ( var i = runonce.length - 1; i >= 0; i-- ) {
							runonce[ i ] = parseInt( runonce[ i ] * ( OSApp.currentSession.controller.options.wl / 100 ) );
						}
						finish();
					}, finish );
					return false;
				}
			} else {
				var durr = parseInt( $( "#duration-" + id ).val() ),
					stations = $( "[id^='station_'][id$='-" + id + "']" );

				$.each( stations, function() {
					if ( $( this ).is( ":checked" ) ) {
						runonce.push( durr );
					} else {
						runonce.push( 0 );
					}
				} );
			}
			finish();
		} );
		return false;
	} );
}

// Translate program array into easier to use data
function readProgram( program ) {
	if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
		return readProgram21( program );
	} else {
		return readProgram183( program );
	}
}

function readProgram183( program ) {
	var days0 = program[ 1 ],
		days1 = program[ 2 ],
		even = false,
		odd = false,
		interval = false,
		days = "",
		stations = "",
		newdata = {};

	newdata.en = program[ 0 ];
	for ( var n = 0; n < OSApp.currentSession.controller.programs.nboards; n++ ) {
		var bits = program[ 7 + n ];
		for ( var s = 0; s < 8; s++ ) {
			stations += ( bits & ( 1 << s ) ) ? "1" : "0";
		}
	}
	newdata.stations = stations;
	newdata.duration = program[ 6 ];

	newdata.start = program[ 3 ];
	newdata.end = program[ 4 ];
	newdata.interval = program[ 5 ];

	if ( ( days0 & 0x80 ) && ( days1 > 1 ) ) {

		//This is an interval program
		days = [ days1, days0 & 0x7f ];
		interval = true;
	} else {

		//This is a weekly program
		for ( var d = 0; d < 7; d++ ) {
			if ( days0 & ( 1 << d ) ) {
				days += "1";
			} else {
				days += "0";
			}
		}
		if ( ( days0 & 0x80 ) && ( days1 === 0 ) ) {even = true;}
		if ( ( days0 & 0x80 ) && ( days1 === 1 ) ) {odd = true;}
	}

	newdata.days = days;
	newdata.is_even = even;
	newdata.is_odd = odd;
	newdata.is_interval = interval;

	return newdata;
}

// Read program for OpenSprinkler 2.1+
function readProgram21( program ) {
	var days0 = program[ 1 ],
		days1 = program[ 2 ],
		restrict = ( ( program[ 0 ] >> 2 ) & 0x03 ),
		type = ( ( program[ 0 ] >> 4 ) & 0x03 ),
		startType = ( ( program[ 0 ] >> 6 ) & 0x01 ),
		days = "",
		newdata = {
			repeat: 0,
			interval: 0
		};

	newdata.en = ( program[ 0 ] >> 0 ) & 1;
	newdata.weather = ( program[ 0 ] >> 1 ) & 1;
	newdata.is_even = ( restrict === 2 ) ? true : false;
	newdata.is_odd = ( restrict === 1 ) ? true : false;
	newdata.is_interval = ( type === 3 ) ? true : false;
	newdata.stations = program[ 4 ];
	newdata.name = program[ 5 ];

	if ( startType === 0 ) {
		newdata.start = program[ 3 ][ 0 ];
		newdata.repeat = program[ 3 ][ 1 ];
		newdata.interval = program[ 3 ][ 2 ];
	} else if ( startType === 1 ) {
		newdata.start = program[ 3 ];
	}

	if ( type === 3 ) {

		//This is an interval program
		days = [ days1, days0 ];
	} else if ( type === 0 ) {

		//This is a weekly program
		for ( var d = 0; d < 7; d++ ) {
			if ( days0 & ( 1 << d ) ) {
				days += "1";
			} else {
				days += "0";
			}
		}
	}

	newdata.days = days;
	return newdata;
}

function getStartTime( time, date ) {
	var offset = time & 0x7ff,
		type = 0,
		times = getSunTimes( date );

	if ( time < 0 ) {
		return time;
	}

	if ( ( time >> 13 ) & 1 ) {
		type = 1;
	} else if ( !( time >> 14 ) & 1 ) {
		return time;
	}

	if ( ( time >> 12 ) & 1 ) {
		offset = -offset;
	}

	time = times[ type ];
	time += offset;

	if ( time < 0 ) {
		time = 0;
	} else if ( time > 1440 ) {
		time = 1440;
	}

	return time;
}

function readStartTime( time ) {
	var offset = time & 0x7ff,
		type = OSApp.Language._( "Sunrise" );

	if ( ( time >> 13 ) & 1 ) {
		type = OSApp.Language._( "Sunset" );
	} else if ( !( time >> 14 ) & 1 ) {
		return OSApp.Dates.minutesToTime( time );
	}

	if ( ( time >> 12 ) & 1 ) {
		offset = -offset;
	}

	return type + ( offset !== 0 ? ( offset > 0 ? "+" : "" ) + OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( offset * 60 ) ) : "" );
}

// Translate program ID to it's name
function pidname( pid ) {
	var pname = OSApp.Language._( "Program" ) + " " + pid;

	if ( pid === 255 || pid === 99 ) {
		pname = OSApp.Language._( "Manual program" );
	} else if ( pid === 254 || pid === 98 ) {
		pname = OSApp.Language._( "Run-once program" );
	} else if ( OSApp.Firmware.checkOSVersion( 210 ) && pid <= OSApp.currentSession.controller.programs.pd.length ) {
		pname = OSApp.currentSession.controller.programs.pd[ pid - 1 ][ 5 ];
	}

	return pname;
}

// Check each program and change the background color to red if disabled
function updateProgramHeader() {
	$( "#programs_list" ).find( "[id^=program-]" ).each( function( a, b ) {
		var item = $( b ),
			heading = item.find( ".ui-collapsible-heading-toggle" ),
			en = OSApp.Firmware.checkOSVersion( 210 ) ? ( OSApp.currentSession.controller.programs.pd[ a ][ 0 ] ) & 0x01 : OSApp.currentSession.controller.programs.pd[ a ][ 0 ];

		if ( en ) {
			heading.removeClass( "red" );
		} else {
			heading.addClass( "red" );
		}
	} );
}

//Make the list of all programs
function makeAllPrograms() {
	if ( OSApp.currentSession.controller.programs.pd.length === 0 ) {
		return "<p class='center'>" + OSApp.Language._( "You have no programs currently added. Tap the Add button on the top right corner to get started." ) + "</p>";
	}
	var list = "<p class='center'>" + OSApp.Language._( "Click any program below to expand/edit. Be sure to save changes." ) + "</p><div data-role='collapsible-set'>",
		name;

	for ( var i = 0; i < OSApp.currentSession.controller.programs.pd.length; i++ ) {
		name = OSApp.Language._( "Program" ) + " " + ( i + 1 );
		if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
			name = OSApp.currentSession.controller.programs.pd[ i ][ 5 ];
		}
		list += "<fieldset id='program-" + i + "' data-role='collapsible'><h3><a " + ( i > 0 ? "" : "style='visibility:hidden' " ) +
				"class='hidden ui-btn ui-btn-icon-notext ui-icon-arrow-u ui-btn-corner-all move-up'></a><a class='ui-btn ui-btn-corner-all program-copy'>" +
			OSApp.Language._( "copy" ) + "</a><span class='program-name'>" + name + "</span></h3>";
		list += "</fieldset>";
	}
	return list + "</div>";
}

function makeProgram( n, isCopy ) {
	if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
		return makeProgram21( n, isCopy );
	} else {
		return makeProgram183( n, isCopy );
	}
}

function makeProgram183( n, isCopy ) {
	var week = [ OSApp.Language._( "Monday" ), OSApp.Language._( "Tuesday" ), OSApp.Language._( "Wednesday" ), OSApp.Language._( "Thursday" ), OSApp.Language._( "Friday" ), OSApp.Language._( "Saturday" ), OSApp.Language._( "Sunday" ) ],
		list = "",
		id = isCopy ? "new" : n,
		days, i, j, setStations, program, page;

	if ( n === "new" ) {
		program = { "en":0, "weather":0, "is_interval":0, "is_even":0, "is_odd":0, "duration":0, "interval":0, "start":0, "end":0, "days":[ 0, 0 ] };
	} else {
		program = readProgram( OSApp.currentSession.controller.programs.pd[ n ] );
	}

	if ( typeof program.days === "string" ) {
		days = program.days.split( "" );
		for ( i = days.length; i--; ) {
			days[ i ] = days[ i ] | 0;
		}
	} else {
		days = [ 0, 0, 0, 0, 0, 0, 0 ];
	}
	if ( typeof program.stations !== "undefined" ) {
		setStations = program.stations.split( "" );
		for ( i = setStations.length - 1; i >= 0; i-- ) {
			setStations[ i ] = setStations[ i ] | 0;
		}
	}
	list += "<label for='en-" + id + "'><input data-mini='true' type='checkbox' " + ( ( program.en || n === "new" ) ? "checked='checked'" : "" ) + " name='en-" + id + "' id='en-" + id + "'>" + OSApp.Language._( "Enabled" ) + "</label>";
	list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
	list += "<input data-mini='true' type='radio' name='rad_days-" + id + "' id='days_week-" + id + "' " +
			"value='days_week-" + id + "' " + ( ( program.is_interval ) ? "" : "checked='checked'" ) + ">" +
		"<label for='days_week-" + id + "'>" + OSApp.Language._( "Weekly" ) + "</label>";
	list += "<input data-mini='true' type='radio' name='rad_days-" + id + "' id='days_n-" + id + "' " +
			"value='days_n-" + id + "' " + ( ( program.is_interval ) ? "checked='checked'" : "" ) + ">" +
		"<label for='days_n-" + id + "'>" + OSApp.Language._( "Interval" ) + "</label>";
	list += "</fieldset><div id='input_days_week-" + id + "' " + ( ( program.is_interval ) ? "style='display:none'" : "" ) + ">";

	list += "<div class='center'><p class='tight'>" + OSApp.Language._( "Restrictions" ) + "</p>" +
		"<select data-inline='true' data-iconpos='left' data-mini='true' id='days_rst-" + id + "'>";
	list += "<option value='none' " + ( ( !program.is_even && !program.is_odd ) ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "None" ) + "</option>";
	list += "<option value='odd' " + ( ( !program.is_even && program.is_odd ) ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "Odd Days Only" ) + "</option>";
	list += "<option value='even' " + ( ( !program.is_odd && program.is_even ) ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "Even Days Only" ) + "</option>";
	list += "</select></div>";

	list += "<div class='center'><p class='tight'>" + OSApp.Language._( "Days of the Week" ) + "</p>" +
		"<select " + ( $.mobile.window.width() > 560 ? "data-inline='true' " : "" ) + "data-iconpos='left' data-mini='true' " +
			"multiple='multiple' data-native-menu='false' id='d-" + id + "'><option>" + OSApp.Language._( "Choose day(s)" ) + "</option>";

	for ( j = 0; j < week.length; j++ ) {
		list += "<option " + ( ( !program.is_interval && days[ j ] ) ? "selected='selected'" : "" ) + " value='" + j + "'>" + week[ j ] + "</option>";
	}
	list += "</select></div></div>";

	list += "<div " + ( ( program.is_interval ) ? "" : "style='display:none'" ) + " id='input_days_n-" + id + "' class='ui-grid-a'>";
	list += "<div class='ui-block-a'><label class='center' for='every-" + id + "'>" + OSApp.Language._( "Interval (Days)" ) + "</label>" +
		"<input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='every-" + id + "' pattern='[0-9]*' id='every-" + id + "' " +
			"value='" + program.days[ 0 ] + "'></div>";
	list += "<div class='ui-block-b'><label class='center' for='starting-" + id + "'>" + OSApp.Language._( "Starting In" ) + "</label>" +
		"<input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='starting-" + id + "' pattern='[0-9]*' " +
			"id='starting-" + id + "' value='" + program.days[ 1 ] + "'></div>";
	list += "</div>";

	list += "<fieldset data-role='controlgroup'><legend>" + OSApp.Language._( "Stations:" ) + "</legend>";

	for ( j = 0; j < OSApp.currentSession.controller.stations.snames.length; j++ ) {
		list += "<label for='station_" + j + "-" + id + "'><input " +
			( OSApp.Stations.isDisabled( j ) ? "data-wrapper-class='station-hidden hidden' " : "" ) +
			"data-mini='true' type='checkbox' " + ( ( ( typeof setStations !== "undefined" ) && setStations[ j ] ) ? "checked='checked'" : "" ) +
			" name='station_" + j + "-" + id + "' id='station_" + j + "-" + id + "'>" + OSApp.currentSession.controller.stations.snames[ j ] + "</label>";
	}

	list += "</fieldset>";
	list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
	list += "<button class='ui-btn ui-mini' name='s_checkall-" + id + "' id='s_checkall-" + id + "'>" + OSApp.Language._( "Check All" ) + "</button>";
	list += "<button class='ui-btn ui-mini' name='s_uncheckall-" + id + "' id='s_uncheckall-" + id + "'>" + OSApp.Language._( "Uncheck All" ) + "</button>";
	list += "</fieldset>";

	list += "<div class='ui-grid-a'>";
	list += "<div class='ui-block-a'><label class='center' for='start-" + id + "'>" + OSApp.Language._( "Start Time" ) + "</label>" +
		"<button class='timefield pad_buttons' data-mini='true' id='start-" + id + "' value='" + program.start + "'>" +
		OSApp.Dates.minutesToTime( program.start ) + "</button></div>";
	list += "<div class='ui-block-b'><label class='center' for='end-" + id + "'>" + OSApp.Language._( "End Time" ) + "</label>" +
		"<button class='timefield pad_buttons' data-mini='true' id='end-" + id + "' value='" + program.end + "'>" +
		OSApp.Dates.minutesToTime( program.end ) + "</button></div>";
	list += "</div>";

	list += "<div class='ui-grid-a'>";
	list += "<div class='ui-block-a'><label class='pad_buttons center' for='duration-" + id + "'>" + OSApp.Language._( "Station Duration" ) + "</label>" +
		"<button class='pad_buttons' data-mini='true' name='duration-" + id + "' id='duration-" + id + "' value='" + program.duration + "'>" +
		OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( program.duration ) ) + "</button></div>";
	list += "<div class='ui-block-b'><label class='pad_buttons center' for='interval-" + id + "'>" + OSApp.Language._( "Program Interval" ) + "</label>" +
		"<button class='pad_buttons' data-mini='true' name='interval-" + id + "' id='interval-" + id + "' value='" + program.interval * 60 + "'>" +
		OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( program.interval * 60 ) ) + "</button></div>";
	list += "</div>";

	if ( isCopy === true || n === "new" ) {
		list += "<input data-mini='true' data-icon='check' type='submit' data-theme='b' name='submit-" + id + "' id='submit-" + id + "' " +
			"value='" + OSApp.Language._( "Save New Program" ) + "'>";
	} else {
		list += "<button data-mini='true' data-icon='check' data-theme='b' name='submit-" + id + "' id='submit-" + id + "'>" +
			OSApp.Language._( "Save Changes to Program" ) + " " + ( n + 1 ) + "</button>";
		list += "<button data-mini='true' data-icon='arrow-r' name='run-" + id + "' id='run-" + id + "'>" +
			OSApp.Language._( "Run Program" ) + " " + ( n + 1 ) + "</button>";
		list += "<button data-mini='true' data-icon='delete' class='red bold' data-theme='b' name='delete-" + id + "' id='delete-" + id + "'>" +
			OSApp.Language._( "Delete Program" ) + " " + ( n + 1 ) + "</button>";
	}

	page = $( list );

	page.find( "input[name^='rad_days']" ).on( "change", function() {
		var type = $( this ).val().split( "-" )[ 0 ],
			old;

		type = type.split( "_" )[ 1 ];
		if ( type === "n" ) {
			old = "week";
		} else {
			old = "n";
		}
		$( "#input_days_" + type + "-" + id ).show();
		$( "#input_days_" + old + "-" + id ).hide();
	} );

	page.find( "[id^='duration-'],[id^='interval-']" ).on( "click", function() {
		var dur = $( this ),
			isInterval = dur.attr( "id" ).match( "interval" ) ? 1 : 0,
			name = page.find( "label[for='" + dur.attr( "id" ) + "']" ).text();

		showDurationBox( {
			seconds: dur.val(),
			title: name,
			callback: function( result ) {
				dur.val( result );
				dur.text( OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( result ) ) );
			},
			maximum: isInterval ? 86340 : 65535,
			granularity: isInterval
		} );
	} );

	page.find( ".timefield" ).on( "click", function() {
		var time = $( this ),
			name = page.find( "label[for='" + time.attr( "id" ) + "']" ).text();

		showTimeInput( {
			minutes: time.val(),
			title: name,
			callback: function( result ) {
				time.val( result );
				time.text( OSApp.Dates.minutesToTime( result ) );
			}
		} );
	} );

	page.find( "[id^='s_checkall-']" ).on( "click", function() {
		page.find( "[id^='station_'][id$='-" + id + "']" ).prop( "checked", true ).checkboxradio( "refresh" );
		return false;
	} );

	page.find( "[id^='s_uncheckall-']" ).on( "click", function() {
		page.find( "[id^='station_'][id$='-" + id + "']" ).prop( "checked", false ).checkboxradio( "refresh" );
		return false;
	} );

	OSApp.UIDom.fixInputClick( page );

	return page;
}

function makeProgram21( n, isCopy ) {
	var week = [ OSApp.Language._( "Monday" ), OSApp.Language._( "Tuesday" ), OSApp.Language._( "Wednesday" ), OSApp.Language._( "Thursday" ), OSApp.Language._( "Friday" ), OSApp.Language._( "Saturday" ), OSApp.Language._( "Sunday" ) ],
		list = "",
		id = isCopy ? "new" : n,
		days, i, j, program, page, times, time, unchecked;

	if ( n === "new" ) {
		program = { "name":"", "en":0, "weather":0, "is_interval":0, "is_even":0, "is_odd":0, "interval":0, "start":0, "days":[ 0, 0 ], "repeat":0, "stations":[] };
	} else {
		program = readProgram( OSApp.currentSession.controller.programs.pd[ n ] );
	}

	if ( typeof program.days === "string" ) {
		days = program.days.split( "" );
		for ( i = days.length; i--; ) {
			days[ i ] = days[ i ] | 0;
		}
	} else {
		days = [ 0, 0, 0, 0, 0, 0, 0 ];
	}

	if ( typeof program.start === "object" ) {
		times = program.start;
	} else {
		times = [ program.start, -1, -1, -1 ];
	}

	// Group basic settings visually
	list += "<div style='margin-top:5px' class='ui-corner-all'>";
	list += "<div class='ui-bar ui-bar-a'><h3>" + OSApp.Language._( "Basic Settings" ) + "</h3></div>";
	list += "<div class='ui-body ui-body-a center'>";

	// Progran name
	list += "<label for='name-" + id + "'>" + OSApp.Language._( "Program Name" ) + "</label>" +
		"<input data-mini='true' type='text' name='name-" + id + "' id='name-" + id + "' maxlength='" + OSApp.currentSession.controller.programs.pnsize + "' " +
		"placeholder='" + OSApp.Language._( "Program" ) + " " + ( OSApp.currentSession.controller.programs.pd.length + 1 ) + "' value=\"" + program.name + "\">";

	// Program enable/disable flag
	list += "<label for='en-" + id + "'><input data-mini='true' type='checkbox' " +
		( ( program.en || n === "new" ) ? "checked='checked'" : "" ) + " name='en-" + id + "' id='en-" + id + "'>" + OSApp.Language._( "Enabled" ) + "</label>";

	// Program weather control flag
	list += "<label for='uwt-" + id + "'><input data-mini='true' type='checkbox' " +
		( ( program.weather ) ? "checked='checked'" : "" ) + " name='uwt-" + id + "' id='uwt-" + id + "'>" + OSApp.Language._( "Use Weather Adjustment" ) + "</label>";

	if ( OSApp.Supported.dateRange() ) {
		var from = OSApp.Dates.getDateRangeStart( id ),
			to = OSApp.Dates.getDateRangeEnd( id );

		list += "<label for='use-dr-" + id + "'>" +
					"<input data-mini='true' type='checkbox' " +
					( ( OSApp.Dates.isDateRangeEnabled( id ) ) ? "checked='checked'" : "" ) + " name='use-dr-" + id + "' id='use-dr-" + id + "'>" +
					 OSApp.Language._( "Enable Date Range" ) +
				"</label>";

		list += "<div id='date-range-options-" + id + "'" + ( ( OSApp.Dates.isDateRangeEnabled( id ) ) ? "" : "style='display:none'" ) + ">";
		list += "<div class='ui-grid-a' style=''>" +
						"<div class='ui-block-a drfrom'>" +
							"<label class='center' for='from-dr-" + id + "'>" + OSApp.Language._( "From (mm/dd)" ) + "</label>" +
							"<div class='dr-input'>" +
								"<input type='text' placeholder='MM/DD' id='from-dr-" + id + "' value=" + OSApp.Dates.decodeDate( from ) + "></input>" +
							"</div>" +
						"</div>" +
						"<div class='ui-block-b drto'>" +
							"<label class='center' for='to-dr-" + id + "'>" + OSApp.Language._( "To (mm/dd)" ) + "</label>" +
							"<div class='dr-input'>" +
								"<input type='text' placeholder='MM/DD' id='to-dr-" + id + "' value=" + OSApp.Dates.decodeDate( to ) + "></input>" +
							"</div>" +
						"</div>" +
					"</div>" +
				"</div>";
	}

	// Show start time menu
	list += "<label class='center' for='start_1-" + id + "'>" + OSApp.Language._( "Start Time" ) + "</label><button class='timefield' data-mini='true' id='start_1-" + id +
		"' value='" + times[ 0 ] + "'>" + readStartTime( times[ 0 ] ) + "</button>";

	// Close basic settings group
	list += "</div></div></div></div>";

	// Group all program type options visually
	list += "<div style='margin-top:10px' class='ui-corner-all'>";
	list += "<div class='ui-bar ui-bar-a'><h3>" + OSApp.Language._( "Program Type" ) + "</h3></div>";
	list += "<div class='ui-body ui-body-a'>";

	// Controlgroup to handle program type (weekly/interval)
	list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
	list += "<input data-mini='true' type='radio' name='rad_days-" + id + "' id='days_week-" + id + "' " +
		"value='days_week-" + id + "' " + ( ( program.is_interval ) ? "" : "checked='checked'" ) + ">" +
		"<label for='days_week-" + id + "'>" + OSApp.Language._( "Weekly" ) + "</label>";
	list += "<input data-mini='true' type='radio' name='rad_days-" + id + "' id='days_n-" + id + "' " +
		"value='days_n-" + id + "' " + ( ( program.is_interval ) ? "checked='checked'" : "" ) + ">" +
		"<label for='days_n-" + id + "'>" + OSApp.Language._( "Interval" ) + "</label>";
	list += "</fieldset>";

	// Show weekly program options
	list += "<div id='input_days_week-" + id + "' " + ( ( program.is_interval ) ? "style='display:none'" : "" ) + ">";
	list += "<div class='center'><p class='tight'>" + OSApp.Language._( "Days of the Week" ) + "</p>" +
		"<select " + ( $.mobile.window.width() > 560 ? "data-inline='true' " : "" ) + "data-iconpos='left' data-mini='true' " +
			"multiple='multiple' data-native-menu='false' id='d-" + id + "'>" +
		"<option>" + OSApp.Language._( "Choose day(s)" ) + "</option>";
	for ( j = 0; j < week.length; j++ ) {
		list += "<option " + ( ( !program.is_interval && days[ j ] ) ? "selected='selected'" : "" ) + " value='" + j + "'>" + week[ j ] + "</option>";
	}
	list += "</select></div></div>";

	// Show interval program options
	list += "<div " + ( ( program.is_interval ) ? "" : "style='display:none'" ) + " id='input_days_n-" + id + "' class='ui-grid-a'>";
	list += "<div class='ui-block-a'><label class='center' for='every-" + id + "'>" + OSApp.Language._( "Interval (Days)" ) + "</label>" +
		"<input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='every-" + id + "' pattern='[0-9]*' " +
			"id='every-" + id + "' value='" + program.days[ 0 ] + "'></div>";
	list += "<div class='ui-block-b'><label class='center' for='starting-" + id + "'>" + OSApp.Language._( "Starting In" ) + "</label>" +
		"<input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='starting-" + id + "' pattern='[0-9]*' " +
			"id='starting-" + id + "' value='" + program.days[ 1 ] + "'></div>";
	list += "</div>";

	// Show restriction options
	list += "<div class='center'><p class='tight'>" + OSApp.Language._( "Restrictions" ) + "</p><select data-inline='true' data-iconpos='left' data-mini='true' id='days_rst-" + id + "'>";
	list += "<option value='none' " + ( ( !program.is_even && !program.is_odd ) ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "None" ) + "</option>";
	list += "<option value='odd' " + ( ( !program.is_even && program.is_odd ) ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "Odd Days Only" ) + "</option>";
	list += "<option value='even' " + ( ( !program.is_odd && program.is_even ) ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "Even Days Only" ) + "</option>";
	list += "</select></div>";

	// Close program type group
	list += "</div></div>";

	// Group all stations visually
	list += "<div style='margin-top:10px' class='ui-corner-all'>";
	list += "<div class='ui-bar ui-bar-a'><h3>" + OSApp.Language._( "Stations" ) + "</h3></div>";
	list += "<div class='ui-body ui-body-a'>";

	var hideDisabled = $( "#programs" ).hasClass( "show-hidden" ) ? "" : "' style='display:none";

	// Show station duration inputs
	for ( j = 0; j < OSApp.currentSession.controller.stations.snames.length; j++ ) {
		if ( OSApp.Stations.isMaster( j ) ) {
			list += "<div class='ui-field-contain duration-input" + ( OSApp.Stations.isDisabled( j ) ? " station-hidden" + hideDisabled : "" ) + "'>" +
				"<label for='station_" + j + "-" + id + "'>" + OSApp.currentSession.controller.stations.snames[ j ] + ":</label>" +
				"<button disabled='true' data-mini='true' name='station_" + j + "-" + id + "' id='station_" + j + "-" + id + "' value='0'>" +
				OSApp.Language._( "Master" ) + "</button></div>";
		} else {
			time = program.stations[ j ] || 0;
			list += "<div class='ui-field-contain duration-input" + ( OSApp.Stations.isDisabled( j ) ? " station-hidden" + hideDisabled : "" ) + "'>" +
				"<label for='station_" + j + "-" + id + "'>" + OSApp.currentSession.controller.stations.snames[ j ] + ":</label>" +
				"<button " + ( time > 0 ? "class='green' " : "" ) + "data-mini='true' name='station_" + j + "-" + id + "' " +
					"id='station_" + j + "-" + id + "' value='" + time + "'>" + OSApp.Dates.getDurationText( time ) + "</button></div>";
		}
	}

	// Close station group
	list += "</div></div>";

	// Group all start time options visually
	list += "<div style='margin-top:10px' class='ui-corner-all'>";
	list += "<div class='ui-bar ui-bar-a'><h3>" + OSApp.Language._( "Additional Start Times" ) + "</h3></div>";
	list += "<div class='ui-body ui-body-a'>";

	// Controlgroup to handle start time type (repeating or set times)
	list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
	list += "<input data-mini='true' type='radio' name='stype-" + id + "' id='stype_repeat-" + id + "' value='stype_repeat-" + id + "' " +
			( ( typeof program.start === "object" ) ? "" : "checked='checked'" ) + ">" +
		"<label for='stype_repeat-" + id + "'>" + OSApp.Language._( "Repeating" ) + "</label>";
	list += "<input data-mini='true' type='radio' name='stype-" + id + "' id='stype_set-" + id + "' value='stype_set-" + id + "' " +
			( ( typeof program.start === "object" ) ? "checked='checked'" : "" ) + ">" +
		"<label for='stype_set-" + id + "'>" + OSApp.Language._( "Fixed" ) + "</label>";
	list += "</fieldset>";

	// Show repeating start time options
	list += "<div " + ( ( typeof program.start === "object" ) ? "style='display:none'" : "" ) + " id='input_stype_repeat-" + id + "'>";
	list += "<div class='ui-grid-a'>";
	list += "<div class='ui-block-a'><label class='pad_buttons center' for='interval-" + id + "'>" + OSApp.Language._( "Repeat Every" ) + "</label>" +
		"<button class='pad_buttons' data-mini='true' name='interval-" + id + "' id='interval-" + id + "' " +
			"value='" + program.interval * 60 + "'>" + OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( program.interval * 60 ) ) + "</button></div>";
	list += "<div class='ui-block-b'><label class='pad_buttons center' for='repeat-" + id + "'>" + OSApp.Language._( "Repeat Count" ) + "</label>" +
		"<button class='pad_buttons' data-mini='true' name='repeat-" + id + "' id='repeat-" + id + "' value='" + program.repeat + "'>" +
			program.repeat + "</button></div>";
	list += "</div></div>";

	// Show set times options
	list += "<table style='width:100%;" + ( ( typeof program.start === "object" ) ? "" : "display:none" ) + "' id='input_stype_set-" + id + "'><tr><th class='center'>" + OSApp.Language._( "Enable" ) + "</th><th>" + OSApp.Language._( "Start Time" ) + "</th></tr>";
	for ( j = 1; j < 4; j++ ) {
		unchecked = ( times[ j ] === -1 );
		list += "<tr><td data-role='controlgroup' data-type='horizontal' class='use_master center'><label for='ust_" + ( j + 1 ) + "'><input id='ust_" + ( j + 1 ) + "' type='checkbox' " + ( unchecked ? "" : "checked='checked'" ) + "></label></td>";
		list += "<td><button class='timefield' data-mini='true' type='time' id='start_" + ( j + 1 ) + "-" + id + "' value='" + ( unchecked ? 0 : times[ j ] ) + "'>" + readStartTime( unchecked ? 0 : times[ j ] ) + "</button></td></tr>";
	}

	list += "</table>";

	// Close start time type group
	list += "</div></div>";

	// Show save, run and delete buttons
	if ( isCopy === true || n === "new" ) {
		list += "<button data-mini='true' data-icon='check' data-theme='b' id='submit-" + id + "'>" + OSApp.Language._( "Save New Program" ) + "</button>";
	} else {
		list += "<button data-mini='true' data-icon='check' data-theme='b' id='submit-" + id + "'>" + OSApp.Language._( "Save Changes to" ) + " <span class='program-name'>" + program.name + "</span></button>";
		list += "<button data-mini='true' data-icon='arrow-r' id='run-" + id + "'>" + OSApp.Language._( "Run" ) + " <span class='program-name'>" + program.name + "</span></button>";
		list += "<button data-mini='true' data-icon='delete' class='bold red' data-theme='b' id='delete-" + id + "'>" + OSApp.Language._( "Delete" ) + " <span class='program-name'>" + program.name + "</span></button>";
	}

	// Take HTML string and convert to jQuery object
	page = $( list );

	// When controlgroup buttons are toggled change relevant options
	page.find( "input[name^='rad_days'],input[name^='stype']" ).on( "change", function() {
		var input = $( this ).val().split( "-" )[ 0 ].split( "_" );

		$( "[id^='input_" + input[ 0 ] + "_']" ).hide();
		$( "#input_" + input[ 0 ] + "_" + input[ 1 ] + "-" + id ).show();
	} );

	// Display date range options when checkbox enabled
	if ( OSApp.Supported.dateRange() ) {
		page.find( "#use-dr-" + id ).on( "click", function() {
			page.find( "#date-range-options-" + id ).toggle();
		} );
	}

	// Handle interval duration input
	page.find( "[id^='interval-']" ).on( "click", function() {
		var dur = $( this ),
			name = page.find( "label[for='" + dur.attr( "id" ) + "']" ).text();

		showDurationBox( {
			seconds: dur.val(),
			title: name,
			callback: function( result ) {
				dur.val( result );
				dur.text( OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( result ) ) );
			},
			maximum: 86340,
			granularity: 1,
			preventCompression: true
		} );
	} );

	page.find( ".timefield" ).on( "click", function() {
		var time = $( this );

		showTimeInput( {
			minutes: time.val(),
			title: OSApp.Language._( "Start Time" ),
			showSun: OSApp.Firmware.checkOSVersion( 213 ) ? true : false,
			callback: function( result ) {
				time.val( result );
				time.text( readStartTime( result ) );
			}
		} );
	} );

	// Handle repeat count button
	page.find( "[id^='repeat-']" ).on( "click", function() {
		var dur = $( this ),
			name = page.find( "label[for='" + dur.attr( "id" ) + "']" ).text();

		showSingleDurationInput( {
			data: dur.val(),
			title: name,
			label: OSApp.Language._( "Repeat Count" ),
			callback: function( result ) {
				dur.val( result ).text( result );
			},
			maximum: 1440
		} );
	} );

	// Handle all station duration inputs
	page.find( "[id^=station_]" ).on( "click", function() {
		var dur = $( this ),
			name = OSApp.currentSession.controller.stations.snames[ dur.attr( "id" ).split( "_" )[ 1 ].split( "-" )[ 0 ] ];

		showDurationBox( {
			seconds: dur.val(),
			title: name,
			callback: function( result ) {
				dur.val( result ).addClass( "green" );
				dur.text( OSApp.Dates.getDurationText( result ) );

				if ( result === 0 ) {
					dur.removeClass( "green" );
				}
			},
			maximum: 65535,
			showSun: OSApp.Firmware.checkOSVersion( 214 ) ? true : false
		} );
	} );

	OSApp.UIDom.fixInputClick( page );

	return page;
}

function addProgram( copyID ) {
	copyID = ( copyID >= 0 ) ? copyID : "new";

	var page = $( "<div data-role='page' id='addprogram'>" +
				"<div class='ui-content' role='main' id='newprogram'>" +
					"<fieldset id='program-new'>" +
					"</fieldset>" +
				"</div>" +
			"</div>" ),
		submit = function() {
			submitProgram( "new" );
			return false;
		},
		header = OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Add Program" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.checkChangesBeforeBack
			},
			rightBtn: {
				icon: "check",
				text: OSApp.Language._( "Submit" ),
				on: submit
			}
		} );

	page.find( "#program-new" ).html( makeProgram( copyID, true ) ).one( "change input", function() {
		header.eq( 2 ).prop( "disabled", false ).addClass( "hasChanges" );
	} );

	page.find( "[id^='submit-']" ).on( "click", function() {
		submitProgram( "new" );
		return false;
	} );

	page.one( "pagehide", function() {
		page.remove();
	} );

	if ( typeof copyID === "string" ) {
		header.eq( 2 ).prop( "disabled", true );
	}

	$( "#addprogram" ).remove();
	$.mobile.pageContainer.append( page );
}

function deleteProgram( id ) {
	var program = pidname( parseInt( id ) + 1 );

	areYouSure( OSApp.Language._( "Are you sure you want to delete program" ) + " " + program + "?", "", function() {
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( "/dp?pw=&pid=" + id ).done( function() {
			$.mobile.loading( "hide" );
			updateControllerPrograms( function() {
				$( "#programs" ).trigger( "programrefresh" );
				OSApp.Errors.showError( OSApp.Language._( "Program" ) + " " + program + " " + OSApp.Language._( "deleted" ) );
			} );
		} );
	} );
}

function submitProgram( id ) {
	$( "#program-" + id ).find( ".hasChanges" ).removeClass( "hasChanges" );

	if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
		submitProgram21( id );
	} else {
		submitProgram183( id );
	}
}

function submitProgram183( id ) {
	var program = [],
		days = [ 0, 0 ],
		stationSelected = 0,
		en = ( $( "#en-" + id ).is( ":checked" ) ) ? 1 : 0,
		daysin, i, s;

	program[ 0 ] = en;

	if ( $( "#days_week-" + id ).is( ":checked" ) ) {
		daysin = $( "#d-" + id ).val();
		daysin = ( daysin === null ) ? [] : OSApp.Utils.parseIntArray( daysin );
		for ( i = 0; i < 7; i++ ) {if ( $.inArray( i, daysin ) !== -1 ) {days[ 0 ] |= ( 1 << i ); }}
		if ( days[ 0 ] === 0 ) {
			OSApp.Errors.showError( OSApp.Language._( "Error: You have not selected any days of the week." ) );
			return;
		}
		if ( $( "#days_rst-" + id ).val() === "odd" ) {
			days[ 0 ] |= 0x80; days[ 1 ] = 1;
		} else if ( $( "#days_rst-" + id ).val() === "even" ) {
			days[ 0 ] |= 0x80; days[ 1 ] = 0;
		}
	} else if ( $( "#days_n-" + id ).is( ":checked" ) ) {
		days[ 1 ] = parseInt( $( "#every-" + id ).val(), 10 );
		if ( !( days[ 1 ] >= 2 && days[ 1 ] <= 128 ) ) {OSApp.Errors.showError( OSApp.Language._( "Error: Interval days must be between 2 and 128." ) );return;}
		days[ 0 ] = parseInt( $( "#starting-" + id ).val(), 10 );
		if ( !( days[ 0 ] >= 0 && days[ 0 ] < days[ 1 ] ) ) {OSApp.Errors.showError( OSApp.Language._( "Error: Starting in days wrong." ) );return;}
		days[ 0 ] |= 0x80;
	}
	program[ 1 ] = days[ 0 ];
	program[ 2 ] = days[ 1 ];

	program[ 3 ] = parseInt( $( "#start-" + id ).val() );
	program[ 4 ] = parseInt( $( "#end-" + id ).val() );

	if ( program[ 3 ] > program[ 4 ] ) {OSApp.Errors.showError( OSApp.Language._( "Error: Start time must be prior to end time." ) );return;}

	program[ 5 ] = parseInt( $( "#interval-" + id ).val() / 60 );

	var sel = $( "[id^=station_][id$=-" + id + "]" ),
		total = sel.length,
		nboards = total / 8;

	program[ 6 ] = parseInt( $( "#duration-" + id ).val() );
	var stations = [ 0 ], bid, sid;
	for ( bid = 0; bid < nboards; bid++ ) {
		stations[ bid ] = 0;
		for ( s = 0; s < 8; s++ ) {
			sid = bid * 8 + s;
			if ( $( "#station_" + sid + "-" + id ).is( ":checked" ) ) {
				stations[ bid ] |= 1 << s; stationSelected = 1;
			}
		}
	}
	program = JSON.stringify( program.concat( stations ) );

	if ( stationSelected === 0 ) {OSApp.Errors.showError( OSApp.Language._( "Error: You have not selected any stations." ) );return;}
	$.mobile.loading( "show" );
	if ( id === "new" ) {
		OSApp.Firmware.sendToOS( "/cp?pw=&pid=-1&v=" + program ).done( function() {
			$.mobile.loading( "hide" );
			updateControllerPrograms( function() {
				$.mobile.document.one( "pageshow", function() {
					OSApp.Errors.showError( OSApp.Language._( "Program added successfully" ) );
				} );
				OSApp.UIDom.goBack();
			} );
		} );
	} else {
		OSApp.Firmware.sendToOS( "/cp?pw=&pid=" + id + "&v=" + program ).done( function() {
			$.mobile.loading( "hide" );
			updateControllerPrograms( function() {
				updateProgramHeader();
			} );
			OSApp.Errors.showError( OSApp.Language._( "Program has been updated" ) );
		} );
	}
}

function submitProgram21( id, ignoreWarning ) {
	var program = [],
		days = [ 0, 0 ],
		start = [ 0, 0, 0, 0 ],
		stationSelected = 0,
		en = ( $( "#en-" + id ).is( ":checked" ) ) ? 1 : 0,
		weather = ( $( "#uwt-" + id ).is( ":checked" ) ) ? 1 : 0,
		j = 0,
		minIntervalDays = OSApp.Firmware.checkOSVersion( 2199 ) ? 1 : 2,
		daysin, i, name, url, daterange;

	// Set enable/disable bit for program
	j |= ( en << 0 );

	// Set use weather flag
	j |= ( weather << 1 );

	// Set restriction flag
	if ( $( "#days_rst-" + id ).val() === "odd" ) {
		j |= ( 1 << 2 );
	} else if ( $( "#days_rst-" + id ).val() === "even" ) {
		j |= ( 2 << 2 );
	}

	// Set program type
	if ( $( "#days_n-" + id ).is( ":checked" ) ) {
		j |= ( 3 << 4 );
		days[ 1 ] = parseInt( $( "#every-" + id ).val(), 10 );

		if ( !( days[ 1 ] >= minIntervalDays && days[ 1 ] <= 128 ) ) {
			OSApp.Errors.showError( OSApp.Language._( "Error: Interval days must be between " + minIntervalDays + " and 128." ) );
			return;
		}

		days[ 0 ] = parseInt( $( "#starting-" + id ).val(), 10 );

		if ( !( days[ 0 ] >= 0 && days[ 0 ] < days[ 1 ] ) ) {
			OSApp.Errors.showError( OSApp.Language._( "Error: Starting in days wrong." ) );
			return;
		}

	} else if ( $( "#days_week-" + id ).is( ":checked" ) ) {
		j |= ( 0 << 4 );
		daysin = $( "#d-" + id ).val();
		daysin = ( daysin === null ) ? [] : OSApp.Utils.parseIntArray( daysin );
		for ( i = 0; i < 7; i++ ) {
			if ( $.inArray( i, daysin ) !== -1 ) {
				days[ 0 ] |= ( 1 << i );
			}
		}
		if ( days[ 0 ] === 0 ) {
			OSApp.Errors.showError( OSApp.Language._( "Error: You have not selected any days of the week." ) );
			return;
		}
	}

	// Set program start time type
	if ( $( "#stype_repeat-" + id ).is( ":checked" ) ) {
		j |= ( 0 << 6 );

		start[ 0 ] = parseInt( $( "#start_1-" + id ).val() );
		start[ 1 ] = parseInt( $( "#repeat-" + id ).val() );
		start[ 2 ] = parseInt( $( "#interval-" + id ).val() / 60 );
	} else if ( $( "#stype_set-" + id ).is( ":checked" ) ) {
		j |= ( 1 << 6 );
		var times = $( "[id^='start_'][id$='-" + id + "']" );

		times.each( function( a, b ) {
			var time = parseInt( b.value );

			if ( typeof time !== "number" || ( a > 0 && !$( "#ust_" + ( a + 1 ) ).is( ":checked" ) ) ) {
				time = -1;
			}

			start[ a ] = time;
		} );
	}

	var sel = $( "[id^=station_][id$=-" + id + "]" ),
		runTimes = [];

	sel.each( function() {
		var dur = parseInt( this.value );
		if ( parseInt( dur ) > 0 ) {
			stationSelected = 1;
		}
		runTimes.push( dur );
	} );

	program[ 0 ] = j;
	program[ 1 ] = days[ 0 ];
	program[ 2 ] = days[ 1 ];
	program[ 3 ] = start;
	program[ 4 ] = runTimes;

	name = $( "#name-" + id ).val();

	daterange = "";

	// Set date range parameters
	if ( OSApp.Supported.dateRange() ) {
		var enableDateRange = $( "#use-dr-" + id ).is( ":checked" ),
			from = $( "#from-dr-" + id ).val(),
			to = $( "#to-dr-" + id ).val();

		var isValidRange = OSApp.Dates.isValidDateRange( from, to );
		if ( !isValidRange ) {
			OSApp.Errors.showError( OSApp.Language._( "Error: date range is malformed" ) );
			return;
		} else {
			daterange = "&endr=" + ( enableDateRange ? 1 : 0 ) + "&from=" + OSApp.Dates.encodeDate( from ) + "&to=" + OSApp.Dates.encodeDate( to );
			program[ 0 ] |= ( enableDateRange ? ( 1 << 7 ) : 0 );
		}
	}

	url = "&v=" + JSON.stringify( program ) + "&name=" + encodeURIComponent( name );

	if ( stationSelected === 0 ) {
		OSApp.Errors.showError( OSApp.Language._( "Error: You have not selected any stations." ) );
		return;
	}

	if ( !ignoreWarning && $( "#stype_repeat-" + id ).is( ":checked" ) && start[ 1 ] > 0 ) {
		var totalruntime = calculateTotalRunningTime( runTimes );
		var repeatinterval = start[ 2 ] * 60;
		if ( totalruntime > repeatinterval ) {
			areYouSure( OSApp.Language._( "Warning: The repeat interval (" + repeatinterval + " sec) is less than the program run time (" + totalruntime + " sec)." ), OSApp.Language._( "Do you want to continue?" ), function() {
				submitProgram21( id, true );
			} );
			return;
		}
	}

	// If the interval is an even number and a restriction is set, notify user of possible conflict
	if ( !ignoreWarning && ( ( j >> 4 ) & 0x03 ) === 3 && !( days[ 1 ] & 1 ) && ( ( j >> 2 ) & 0x03 ) > 0 ) {
		areYouSure( OSApp.Language._( "Warning: The use of odd/even restrictions with the selected interval day may result in the program not running at all." ), OSApp.Language._( "Do you want to continue?" ), function() {
			submitProgram21( id, true );
		} );
		return;
	}

	$.mobile.loading( "show" );
	if ( id === "new" ) {
		OSApp.Firmware.sendToOS( "/cp?pw=&pid=-1" + url + daterange ).done( function() {
			$.mobile.loading( "hide" );
			updateControllerPrograms( function() {
				$.mobile.document.one( "pageshow", function() {
					OSApp.Errors.showError( OSApp.Language._( "Program added successfully" ) );
				} );
				OSApp.UIDom.goBack();
			} );
		} );
	} else {
		OSApp.Firmware.sendToOS( "/cp?pw=&pid=" + id + url + daterange ).done( function() {
			$.mobile.loading( "hide" );
			updateControllerPrograms( function() {
				updateProgramHeader();
				$( "#program-" + id ).find( ".program-name" ).text( name );
			} );
			OSApp.Errors.showError( OSApp.Language._( "Program has been updated" ) );
		} );
	}
}

function raindelay( delay ) {
	$.mobile.loading( "show" );
	OSApp.Firmware.sendToOS( "/cv?pw=&rd=" + ( delay / 3600 ) ).done( function() {
		$.mobile.loading( "hide" );
		OSApp.UIDom.showLoading( "#footer-running" );
		refreshStatus( updateWeather );
		OSApp.Errors.showError( OSApp.Language._( "Rain delay has been successfully set" ) );
	} );
	return false;
}

// Export and Import functions
function getExportMethod() {
	var popup = $(
		"<div data-role='popup' data-theme='a'>" +
			"<div class='ui-bar ui-bar-a'>" + OSApp.Language._( "Select Export Method" ) + "</div>" +
			"<div data-role='controlgroup' class='tight'>" +
				"<a class='ui-btn hidden fileMethod'>" + OSApp.Language._( "File" ) + "</a>" +
				"<a class='ui-btn pasteMethod'>" + OSApp.Language._( "Email" ) + "</a>" +
				"<a class='ui-btn localMethod'>" + OSApp.Language._( "Internal (within app)" ) + "</a>" +
			"</div>" +
		"</div>" ),
		obj = encodeURIComponent( JSON.stringify( OSApp.currentSession.controller ) ),
		subject = "OpenSprinkler Data Export on " + OSApp.Dates.dateToString( new Date() );

	if ( OSApp.currentDevice.isFileCapable ) {
		popup.find( ".fileMethod" ).removeClass( "hidden" ).attr( {
			href: "data:text/json;charset=utf-8," + obj,
			download: "backup-" + new Date().toLocaleDateString().replace( /\//g, "-" ) + ".json"
		} ).on( "click", function() {
			popup.popup( "close" );
		} );
	}

	var href = "mailto:?subject=" + encodeURIComponent( subject ) + "&body=" + obj;
	popup.find( ".pasteMethod" ).attr( "href", href ).on( "click", function() {
		window.open( href, OSApp.currentDevice.isOSXApp ? "_system" : undefined );
		popup.popup( "close" );
	} );

	popup.find( ".localMethod" ).on( "click", function() {
		popup.popup( "close" );
		OSApp.Storage.set( { "backup":JSON.stringify( OSApp.currentSession.controller ) }, function() {
			OSApp.Errors.showError( OSApp.Language._( "Backup saved on this device" ) );
		} );
	} );

	OSApp.UIDom.openPopup( popup, { positionTo: $( "#sprinklers-settings" ).find( ".export_config" ) } );
}

function getImportMethod( localData ) {
	var getPaste = function() {
			var popup = $(
					"<div data-role='popup' data-theme='a' id='paste_config'>" +
						"<p class='ui-bar'>" +
							"<textarea class='textarea' rows='10' placeholder='" + OSApp.Language._( "Paste your backup here" ) + "'></textarea>" +
							"<button data-mini='true' data-theme='b'>" + OSApp.Language._( "Import" ) + "</button>" +
						"</p>" +
					"</div>"
				),
				width = $.mobile.window.width();

			popup.find( "button" ).on( "click", function() {
				var data = popup.find( "textarea" ).val();

				if ( data === "" ) {
					return;
				}

				try {
					data = JSON.parse( $.trim( data ).replace( /“|”|″/g, "\"" ) );
					popup.popup( "close" );
					importConfig( data );
				}catch ( err ) {
					popup.find( "textarea" ).val( "" );
					OSApp.Errors.showError( OSApp.Language._( "Unable to read the configuration file. Please check the file and try again." ) );
				}
			} );

			popup.css( "width", ( width > 600 ? width * 0.4 + "px" : "100%" ) );
			OSApp.UIDom.openPopup( popup );
			return false;
		},
		popup = $(
			"<div data-role='popup' data-theme='a'>" +
				"<div class='ui-bar ui-bar-a'>" + OSApp.Language._( "Select Import Method" ) + "</div>" +
				"<div data-role='controlgroup' class='tight'>" +
					"<button class='hidden fileMethod'>" + OSApp.Language._( "File" ) + "</button>" +
					"<button class='pasteMethod'>" + OSApp.Language._( "Email (copy/paste)" ) + "</button>" +
					"<button class='hidden localMethod'>" + OSApp.Language._( "Internal (within app)" ) + "</button>" +
				"</div>" +
			"</div>" );

	if ( OSApp.currentDevice.isFileCapable ) {
		popup.find( ".fileMethod" ).removeClass( "hidden" ).on( "click", function() {
			popup.popup( "close" );
			var input = $( "<input type='file' id='configInput' data-role='none' style='visibility:hidden;position:absolute;top:-50px;left:-50px'/>" )
				.on( "change", function() {
					var config = this.files[ 0 ],
						reader = new FileReader();

					if ( typeof config !== "object" ) {
						return;
					}

					reader.onload = function( e ) {
						try {
							var obj = JSON.parse( $.trim( e.target.result ) );
							importConfig( obj );
						}catch ( err ) {
							OSApp.Errors.showError( OSApp.Language._( "Unable to read the configuration file. Please check the file and try again." ) );
						}
					};

					reader.readAsText( config );
				} );

			input.appendTo( "#sprinklers-settings" );
			input.click();
			return false;
		} );
	} else {

		// Handle local storage being unavailable and present paste dialog immediately
		if ( !localData ) {
			getPaste();
			return;
		}
	}

	popup.find( ".pasteMethod" ).on( "click", function() {
		popup.popup( "close" );
		getPaste();
		return false;
	} );

	if ( localData ) {
		popup.find( ".localMethod" ).removeClass( "hidden" ).on( "click", function() {
			popup.popup( "close" );
			importConfig( JSON.parse( localData ) );
			return false;
		} );
	}

	OSApp.UIDom.openPopup( popup, { positionTo: $( "#sprinklers-settings" ).find( ".import_config" ) } );
}

function importConfig( data ) {
	var warning = "";

	if ( typeof data !== "object" || !data.settings ) {
		OSApp.Errors.showError( OSApp.Language._( "Invalid configuration" ) );
		return;
	}

	if ( OSApp.Firmware.checkOSVersion( 210 ) && typeof data.options === "object" &&
		( data.options.hp0 !== OSApp.currentSession.controller.options.hp0 || data.options.hp1 !== OSApp.currentSession.controller.options.hp1 ) ||
		( data.options.dhcp !== OSApp.currentSession.controller.options.dhcp ) || ( data.options.devid !== OSApp.currentSession.controller.options.devid ) ) {

		warning = OSApp.Language._( "Warning: Network changes will be made and the device may no longer be accessible from this address." );
	}

	areYouSure( OSApp.Language._( "Are you sure you want to restore the configuration?" ), warning, function() {
		$.mobile.loading( "show" );

		var cs = "/cs?pw=",
			co = "/co?pw=",
			cpStart = "/cp?pw=",
			ncs = Math.ceil( data.stations.snames.length / 16 ),
			csi = new Array( ncs ).fill( "/cs?pw=" ),
			isPi = OSApp.Firmware.isOSPi(),
			i, k, key, option, station;

		var findKey = function( index ) { return OSApp.Constants.keyIndex[ index ] === key; };

		for ( i in data.options ) {
			if ( data.options.hasOwnProperty( i ) && OSApp.Constants.keyIndex.hasOwnProperty( i ) ) {
				key = OSApp.Constants.keyIndex[ i ];
				if ( $.inArray( key, [ 2, 14, 16, 21, 22, 25, 36 ] ) !== -1 && data.options[ i ] === 0 ) {
					continue;
				}
				if ( key === 3 ) {
					if ( OSApp.Firmware.checkOSVersion( 210 ) && OSApp.currentSession.controller.options.dhcp === 1 ) {
						co += "&o3=1";
					}
					continue;
				}
				if ( isPi ) {
					key = Object.keys( OSApp.Constants.keyIndex ).find( findKey );
					if ( key === undefined ) {
						continue;
					}
				}
				if ( OSApp.Firmware.checkOSVersion( 208 ) === true && typeof data.options[ i ] === "string" ) {
					option = data.options[ i ].replace( /\s/g, "_" );
				} else {
					option = data.options[ i ];
				}
				co += "&o" + key + "=" + option;
			}
		}

		// Handle import from versions prior to 2.1.1 for enable logging flag
		if ( !isPi && typeof data.options.fwv === "number" && data.options.fwv < 211 && OSApp.Firmware.checkOSVersion( 211 ) ) {

			// Enables logging since prior firmwares always had logging enabled
			co += "&o36=1";
		}

		// Import Weather Adjustment Options, if available
		if ( typeof data.settings.wto === "object" && OSApp.Firmware.checkOSVersion( 215 ) ) {
			co += "&wto=" + OSApp.Utils.escapeJSON( data.settings.wto );
		}

		// Import IFTTT Key, if available
		if ( typeof data.settings.ifkey === "string" && OSApp.Firmware.checkOSVersion( 217 ) ) {
			co += "&ifkey=" + data.settings.ifkey;
		}

		// Import device name, if available
		if ( typeof data.settings.dname === "string" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			co += "&dname=" + data.settings.dname;
		}

		// Import mqtt options, if available
		if ( typeof data.settings.mqtt === "object" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			co += "&mqtt=" + OSApp.Utils.escapeJSON( data.settings.mqtt );
			}

		//Import email options, if available
		if ( typeof data.settings.email === "object" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			co += "&email=" + OSApp.Utils.escapeJSON( data.settings.email );
			}

		if ( typeof data.settings.otc === "object" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			co += "&otc=" + OSApp.Utils.escapeJSON( data.settings.otc );
		}

		co += "&" + ( isPi ? "o" : "" ) + "loc=" + data.settings.loc;

		// Due to potentially large number of zones, we split zone names import to maximum 16 per group
		for ( k = 0; k < ncs; k++ ) {
			for ( i = k * 16; i < ( k + 1 ) * 16 && i < data.stations.snames.length; i++ ) {
				if ( OSApp.Firmware.checkOSVersion( 208 ) === true ) {
					station = data.stations.snames[ i ].replace( /\s/g, "_" );
				} else {
					station = data.stations.snames[ i ];
				}
				csi[ k ] += "&s" + i + "=" + encodeURIComponent( station );
			}
		}

		for ( i = 0; i < data.stations.masop.length; i++ ) {
			cs += "&m" + i + "=" + data.stations.masop[ i ];
		}

		if ( typeof data.stations.masop2 === "object" ) {
			for ( i = 0; i < data.stations.masop2.length; i++ ) {
				cs += "&n" + i + "=" + data.stations.masop2[ i ];
			}
		}

		if ( typeof data.stations.ignore_rain === "object" ) {
			for ( i = 0; i < data.stations.ignore_rain.length; i++ ) {
				cs += "&i" + i + "=" + data.stations.ignore_rain[ i ];
			}
		}

		if ( typeof data.stations.ignore_sn1 === "object" ) {
			for ( i = 0; i < data.stations.ignore_sn1.length; i++ ) {
				cs += "&j" + i + "=" + data.stations.ignore_sn1[ i ];
			}
		}

		if ( typeof data.stations.ignore_sn2 === "object" ) {
			for ( i = 0; i < data.stations.ignore_sn2.length; i++ ) {
				cs += "&k" + i + "=" + data.stations.ignore_sn2[ i ];
			}
		}

		if ( typeof data.stations.stn_dis === "object" ) {
			for ( i = 0; i < data.stations.stn_dis.length; i++ ) {
				cs += "&d" + i + "=" + data.stations.stn_dis[ i ];
			}
		}

		if ( typeof data.stations.stn_spe === "object" ) {
			for ( i = 0; i < data.stations.stn_spe.length; i++ ) {
				cs += "&p" + i + "=" + data.stations.stn_spe[ i ];
			}
		}

		if ( typeof data.stations.stn_seq === "object" ) {
			for ( i = 0; i < data.stations.stn_seq.length; i++ ) {
				cs += "&q" + i + "=" + data.stations.stn_seq[ i ];
			}
		} else if ( !isPi && typeof data.options.fwv === "number" && data.options.fwv < 211 && !OSApp.Firmware.checkOSVersion( 211 ) ) {
			var bid;
			for ( bid = 0; bid < data.settings.nbrd; bid++ ) {
				cs += "&q" + bid + "=" + ( data.options.seq === 1 ? 255 : 0 );
			}
		}

		if ( typeof data.stations.act_relay === "object" ) {
			for ( i = 0; i < data.stations.act_relay.length; i++ ) {
				cs += "&a" + i + "=" + data.stations.act_relay[ i ];
			}
		}

		// Normalize station special data object
		data.special = data.special || {};

		$.when(
			OSApp.Firmware.sendToOS( OSApp.Utils.transformKeysinString( co ) ),
			OSApp.Firmware.sendToOS( cs ),
			OSApp.Firmware.sendToOS( "/dp?pw=&pid=-1" ),
			$.each( csi, function( i, comm ) {
				OSApp.Firmware.sendToOS( comm );
			} ),
			$.each( data.programs.pd, function( i, prog ) {
				var name = "";

				// Handle data from firmware 2.1+ being imported to OSPi
				if ( isPi && typeof data.options.fwv === "number" && data.options.fwv >= 210 ) {
					OSApp.Errors.showError( OSApp.Language._( "Program data is newer than the device firmware and cannot be imported" ) );
					return false;
				}

				// Handle data from firmware 2.1+ being imported to a firmware prior to 2.1
				if ( !isPi && typeof data.options.fwv === "number" && data.options.fwv >= 210 && !OSApp.Firmware.checkOSVersion( 210 ) ) {
					OSApp.Errors.showError( OSApp.Language._( "Program data is newer than the device firmware and cannot be imported" ) );
					return false;
				}

				// Handle data from firmware 2.1+ being imported to a 2.1+ device
				// The firmware does not accept program name inside the program array and must be submitted separately
				if ( !isPi && typeof data.options.fwv === "number" && data.options.fwv >= 210 && OSApp.Firmware.checkOSVersion( 210 ) ) {
					name = "&name=" + prog[ 5 ];

					// Truncate the program name off the array
					prog = prog.slice( 0, 5 );
				}

				// Handle data from firmware prior to 2.1 being imported to a 2.1+ device
				if ( !isPi && typeof data.options.fwv === "number" && data.options.fwv < 210 && OSApp.Firmware.checkOSVersion( 210 ) ) {
					var program = readProgram183( prog ),
						total = ( prog.length - 7 ),
						allDur = [],
						j = 0,
						bits, n, s;

					// Set enable/disable bit for program
					j |= ( program.en << 0 );

					// Set program restrictions
					if ( program.is_even ) {
						j |= ( 2 << 2 );
					} else if ( program.is_odd ) {
						j |= ( 1 << 2 );
					} else {
						j |= ( 0 << 2 );
					}

					// Set program type
					if ( program.is_interval ) {
						j |= ( 3 << 4 );
					} else {
						j |= ( 0 << 4 );
					}

					// Set start time type (repeating)
					j |= ( 0 << 6 );

					// Save bits to program data
					prog[ 0 ] = j;

					// Using the total number of stations, migrate the duration into each station
					for ( n = 0; n < total; n++ ) {
						bits = prog[ 7 + n ];
						for ( s = 0; s < 8; s++ ) {
							allDur.push( ( bits & ( 1 << s ) ) ? program.duration : 0 );
						}
					}

					// Set the start time, interval time, and repeat count
					prog[ 3 ] = [ program.start, parseInt( ( program.end - program.start ) / program.interval ), program.interval, 0 ];

					// Change the duration from the previous int to the new array
					prog[ 4 ] = allDur;

					// Truncate the station enable/disable flags
					prog = prog.slice( 0, 5 );

					name = "&name=" + OSApp.Language._( "Program" ) + " " + ( i + 1 );
				}

				OSApp.Firmware.sendToOS( cpStart + "&pid=-1&v=" + JSON.stringify( prog ) + name );
			} ),
			$.each( data.special, function( sid, info ) {
				if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
					OSApp.Firmware.sendToOS( "/cs?pw=&sid=" + sid + "&st=" + info.st + "&sd=" + encodeURIComponent( info.sd ) );
				}
			} )
		).then(
			function() {
				setTimeout( function() {
					updateController(
						function() {
							$.mobile.loading( "hide" );
							OSApp.Errors.showError( OSApp.Language._( "Backup restored to your device" ) );
							updateWeather();
							OSApp.UIDom.goHome( true );
						},
						function() {
							$.mobile.loading( "hide" );
							networkFail();
						}
					);
				}, 1500 );
			},
			function() {
				$.mobile.loading( "hide" );
				OSApp.Errors.showError( OSApp.Language._( "Unable to import configuration." ) );
			}
		);
	} );
}

// About page
var showAbout = ( function() {

	var page = $( "<div data-role='page' id='about'>" +
			"<div class='ui-content' role='main'>" +
				"<ul data-role='listview' data-inset='true'>" +
					"<li>" +
						"<p>" + OSApp.Language._( "User manual for OpenSprinkler is available at" ) +
							" <a class='iab' target='_blank' href='https://openthings.freshdesk.com/support/solutions/folders/5000147083'>" +
								"https://support.openthings.io" +
							"</a>" +
						"</p>" +
					"</li>" +
				"</ul>" +
				"<ul data-role='listview' data-inset='true'>" +
					"<li>" +
						"<p>" + OSApp.Language._( "This is open source software: source code and changelog for this application can be found at" ) + " " +
							"<a class='iab squeeze' target='_blank' href='https://github.com/OpenSprinkler/OpenSprinkler-App/'>" +
								"https://github.com/OpenSprinkler/OpenSprinkler-App/" +
							"</a>" +
						"</p>" +
						"<p>" + OSApp.Language._( "Language localization is crowdsourced using Transifex available at" ) + " " +
							"<a class='iab squeeze' target='_blank' href='https://www.transifex.com/albahra/opensprinkler/'>" +
								"https://www.transifex.com/albahra/opensprinkler/" +
							"</a>" +
						"</p>" +
						"<p>" + OSApp.Language._( "Open source attributions" ) + ": " +
							"<a class='iab iabNoScale squeeze' target='_blank' " +
								"href='https://github.com/OpenSprinkler/OpenSprinkler-App/wiki/List-of-Integrated-Libraries'>" +
									"https://github.com/OpenSprinkler/OpenSprinkler-App/wiki/List-of-Integrated-Libraries" +
							"</a>" +
						"</p>" +
					"</li>" +
				"</ul>" +
				"<p class='smaller'>" +
					OSApp.Language._( "App Version" ) + ": 2.4.1" +
					"<br>" + OSApp.Language._( "Firmware" ) + ": <span class='firmware'></span>" +
					"<br><span class='hardwareLabel'>" + OSApp.Language._( "Hardware Version" ) + ":</span> <span class='hardware'></span>" +
				"</p>" +
			"</div>" +
		"</div>" ),
		showHardware;

	function begin() {
		showHardware = typeof OSApp.currentSession.controller.options.hwv !== "undefined" ? false : true;
		page.find( ".hardware" ).toggleClass( "hidden", showHardware ).text( OSApp.Firmware.getHWVersion() + OSApp.Firmware.getHWType() );
		page.find( ".hardwareLabel" ).toggleClass( "hidden", showHardware );

		page.find( ".firmware" ).text( OSApp.Firmware.getOSVersion() + OSApp.Firmware.getOSMinorVersion() + ( OSApp.Analog.checkAnalogSensorAvail() ? " - ASB" : "" ) );

		page.one( "pagehide", function() {
			page.detach();
		} );

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "About" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			}
		} );

		$( "#about" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin;
} )();

function stopStations( callback ) {
	$.mobile.loading( "show" );

	// It can take up to a second before stations actually stop
	OSApp.Firmware.sendToOS( "/cv?pw=&rsn=1" ).done( function() {
		setTimeout( function() {
			$.mobile.loading( "hide" );
			callback();
		}, 1000 );
	} );
}

function flowCountToVolume( count ) {
	return parseFloat( ( count * ( ( OSApp.currentSession.controller.options.fpr1 << 8 ) + OSApp.currentSession.controller.options.fpr0 ) / 100 ).toFixed( 2 ) );
}

var corruptionNotificationShown = false;
function handleCorruptedWeatherOptions( wto ) {
	if ( corruptionNotificationShown ) {
		return;
	}

	OSApp.Notifications.addNotification( {
		title: OSApp.Language._( "Weather Options have Corrupted" ),
		desc: OSApp.Language._( "Click here to retrieve the partial weather option data" ),
		on: function() {
			var button = $( this ).parent(),
				popup = $(
					"<div data-role='popup' data-theme='a' class='modal ui-content' id='weatherOptionCorruption'>" +
						"<h3 class='center'>" +
							OSApp.Language._( "Weather option data has corrupted" ) +
						"</h3>" +
						"<h5 class='center'>" + OSApp.Language._( "Please note this may indicate other data corruption as well, please verify all settings." ) + "</h5>" +
						"<h6 class='center'>" + OSApp.Language._( "Below is the corrupt data which could not be parsed but may be useful for restoration." ) + "</h6>" +
						"<code>" +
							wto[ 0 ].substr( 7 ) +
						"</code>" +
						"<a class='ui-btn ui-corner-all ui-shadow red reset-options' style='width:80%;margin:5px auto;' href='#'>" +
							OSApp.Language._( "Reset All Options" ) +
						"</a>" +
						"<a class='ui-btn ui-corner-all ui-shadow submit' style='width:80%;margin:5px auto;' href='#'>" +
							OSApp.Language._( "Dismiss" ) +
						"</a>" +
					"</div>"
				);

			popup.find( ".submit" ).on( "click", function() {
				OSApp.Notifications.removeNotification( button );
				popup.popup( "close" );

				return false;
			} );

			popup.find( ".reset-options" ).on( "click", function() {
				OSApp.Notifications.removeNotification( button );
				popup.popup( "close" );
				resetAllOptions( function() {
					OSApp.Errors.showError( OSApp.Language._( "Settings have been saved" ) );
				} );

				return false;
			} );

			OSApp.UIDom.openPopup( popup );
			return false;
		}
	} );

	corruptionNotificationShown = true;
}


function detectUnusedExpansionBoards() {
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
}

function showUnifiedFirmwareNotification() {
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
}

function logout( success ) {
	if ( typeof success !== "function" ) {
		success = function() {};
	}

	areYouSure( OSApp.Language._( "Are you sure you want to logout?" ), "", function() {
		if ( OSApp.currentSession.local ) {
			OSApp.Storage.remove( [ "sites", "current_site", "lang", "provider", "wapikey", "runonce", "cloudToken" ], function() {
				location.reload();
			} );
		} else {
			OSApp.Storage.remove( [ "cloudToken" ], function() {
				updateLoginButtons();
				success();
			} );
		}
	} );
}

function updateLoginButtons() {
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
				page.find( ".ui-content" ).prepend( addSyncStatus( data.cloudToken ) );
			}
		}
	} );
}

function stopAllStations() {

	if ( !OSApp.currentSession.isControllerConnected() ) {
		return false;
	}

	areYouSure( OSApp.Language._( "Are you sure you want to stop all stations?" ), "", function() {
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( "/cv?pw=&rsn=1" ).done( function() {
			$.mobile.loading( "hide" );
			removeStationTimers();
			refreshStatus();
			OSApp.Errors.showError( OSApp.Language._( "All stations have been stopped" ) );
		} );
	} );
}

// Accessory functions for jQuery Mobile
function areYouSure( text1, text2, success, fail, options ) {

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
}

function showIPRequest( opt ) {
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
}

function showDurationBox( opt ) {
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
}

function showSingleDurationInput( opt ) {
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
}

function showDateTimeInput( timestamp, callback ) {
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
				val, mark, i;

			for ( i = 0; i < 5; i++ ) {
				val = timestamp[ "getUTC" + keys[ i ] ]();
				mark = "";

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
}

function showTimeInput( opt ) {
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
}

function showHelpText( e ) {
	e.stopImmediatePropagation();

	var button = $( this ),
		text = button.data( "helptext" ),
		popup;

	popup = $( "<div data-role='popup' data-theme='a'>" +
		"<p>" + text + "</p>" +
	"</div>" );

	OSApp.UIDom.openPopup( popup, { positionTo: button } );

	return false;
}

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

Number.prototype.clamp = function( min, max ) {
	return Math.min( Math.max( this, min ), max );
};

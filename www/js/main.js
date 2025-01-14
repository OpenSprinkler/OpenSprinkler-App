/* global $ */

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
// TODO: add unit tests for each module
// TODO: move vendor js (jquery, jqm, datatables, etc) to /js/vendor

/* ************** TODO: remove this, it is temporary ***************/
window.onerror = function( m, s, l, c, e ) {
	console.error( "*** Uncaught Exception", e );
	alert( "*** Uncaught exception! " + e );
	return false;
};

// App Constants
OSApp.Constants = {
	dialog: { // Dialog constants
		REMOVE_STATION: 1
	},
	http: {
		RETRY_COUNT: 2 // Define the amount of times the app will retry an HTTP request before marking it failed
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
		PROGRAM_TYPE_WEEKLY: 0,
		PROGRAM_TYPE_SINGLERUN: 1,
		PROGRAM_TYPE_MONTHLY: 2,
		PROGRAM_TYPE_INTERVAL: 3,
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
	isMetric: ( [ "US", "BM", "PW" ].indexOf( navigator.languages[ 0 ].split( "-" )[ 1 ] ) === -1 )
};
OSApp.currentDevice.isFileCapable = !OSApp.currentDevice.isiOS && !OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isOSXApp && window.FileReader;

// UI state
OSApp.uiState = {
	errorTimeout: undefined,
	goingBack: false,
	is24Hour: false,
	groupView: false,
	sortByStationName: false,
	language: undefined,
	notifications: [], // Array to hold all notifications currently displayed within the app
	openPanel: undefined,
	pageHistoryCount: -1, // Initialize variables to keep track of current page count
	popupData: {
		"shift": undefined
	},
	showWeatherOptionsCorruptedNotification: false,
	switching: false,
	theme: { // Define the status bar color(s) and use a darker color for Android
		statusBarPrimary: OSApp.currentDevice.isAndroid ? "#121212" : "#1D1D1D",
		statusBarOverlay: OSApp.currentDevice.isAndroid ? "#151515" : "#202020"
	},
	timers: {}
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
OSApp.currentSession.isControllerConnected = function() {
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

// Focus any input
OSApp.UIDom.focusInput();

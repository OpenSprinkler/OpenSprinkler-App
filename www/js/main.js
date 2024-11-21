/* global $, navigator, console, alert */
/* global links */

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

// TODO: remove this, it is temporary!
window.onerror = function(m, s, l, c, e) {
	console.error("*** Uncaught Exception", e);
	alert("*** Uncaught exception: " + e);
	return false;
};

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
	showWeatherOptionsCorruptedNotification: false,
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
		var sunTimes = OSApp.Weather.getSunTimes( date );

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
					var volume = OSApp.Utils.flowCountToVolume( this[ 0 ] );

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

				OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to " ) + OSApp.Language._( "delete" ) + " " + date + "?", "", function() {
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
	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to clear ALL your log data?" ), "", function() {
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
}

function resetAllOptions( callback ) {
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
					OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to save your changes?" ), "", function() {
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
					OSApp.Sites.updateControllerPrograms( function() {
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

		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to start " + name + " now?" ), "", function() {
			var runonce = [],
				finish = function() {
					runonce.push( 0 );
					OSApp.Stations.submitRunonce( runonce );
				};

			if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
				runonce = OSApp.currentSession.controller.programs.pd[ id ][ 4 ];

				if ( ( OSApp.currentSession.controller.programs.pd[ id ][ 0 ] >> 1 ) & 1 ) {
					OSApp.UIDom.areYouSure( OSApp.Language._( "Do you wish to apply the current watering level?" ), "", function() {
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
		times = OSApp.Weather.getSunTimes( date );

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

		OSApp.UIDom.showDurationBox( {
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

		OSApp.UIDom.showTimeInput( {
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

		OSApp.UIDom.showDurationBox( {
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

		OSApp.UIDom.showTimeInput( {
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

			OSApp.UIDom.showSingleDurationInput( {
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

		OSApp.UIDom.showDurationBox( {
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

	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete program" ) + " " + program + "?", "", function() {
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( "/dp?pw=&pid=" + id ).done( function() {
			$.mobile.loading( "hide" );
			OSApp.Sites.updateControllerPrograms( function() {
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
			OSApp.Sites.updateControllerPrograms( function() {
				$.mobile.document.one( "pageshow", function() {
					OSApp.Errors.showError( OSApp.Language._( "Program added successfully" ) );
				} );
				OSApp.UIDom.goBack();
			} );
		} );
	} else {
		OSApp.Firmware.sendToOS( "/cp?pw=&pid=" + id + "&v=" + program ).done( function() {
			$.mobile.loading( "hide" );
			OSApp.Sites.updateControllerPrograms( function() {
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
			OSApp.UIDom.areYouSure( OSApp.Language._( "Warning: The repeat interval (" + repeatinterval + " sec) is less than the program run time (" + totalruntime + " sec)." ), OSApp.Language._( "Do you want to continue?" ), function() {
				submitProgram21( id, true );
			} );
			return;
		}
	}

	// If the interval is an even number and a restriction is set, notify user of possible conflict
	if ( !ignoreWarning && ( ( j >> 4 ) & 0x03 ) === 3 && !( days[ 1 ] & 1 ) && ( ( j >> 2 ) & 0x03 ) > 0 ) {
		OSApp.UIDom.areYouSure( OSApp.Language._( "Warning: The use of odd/even restrictions with the selected interval day may result in the program not running at all." ), OSApp.Language._( "Do you want to continue?" ), function() {
			submitProgram21( id, true );
		} );
		return;
	}

	$.mobile.loading( "show" );
	if ( id === "new" ) {
		OSApp.Firmware.sendToOS( "/cp?pw=&pid=-1" + url + daterange ).done( function() {
			$.mobile.loading( "hide" );
			OSApp.Sites.updateControllerPrograms( function() {
				$.mobile.document.one( "pageshow", function() {
					OSApp.Errors.showError( OSApp.Language._( "Program added successfully" ) );
				} );
				OSApp.UIDom.goBack();
			} );
		} );
	} else {
		OSApp.Firmware.sendToOS( "/cp?pw=&pid=" + id + url + daterange ).done( function() {
			$.mobile.loading( "hide" );
			OSApp.Sites.updateControllerPrograms( function() {
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
		OSApp.Status.refreshStatus( OSApp.Weather.updateWeather );
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

	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to restore the configuration?" ), warning, function() {
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
					OSApp.Sites.updateController(
						function() {
							$.mobile.loading( "hide" );
							OSApp.Errors.showError( OSApp.Language._( "Backup restored to your device" ) );
							OSApp.Weather.updateWeather();
							OSApp.UIDom.goHome( true );
						},
						function() {
							$.mobile.loading( "hide" );
							OSApp.Network.networkFail();
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

function logout( success ) {
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
				page.find( ".ui-content" ).prepend( OSApp.Network.addSyncStatus( data.cloudToken ) );
			}
		}
	} );
}

// Focus any input
OSApp.UIDom.focusInput();

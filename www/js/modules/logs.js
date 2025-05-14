/* global $, links */

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
OSApp.Logs = OSApp.Logs || {};

OSApp.Logs.displayPage = function() {
	// Build the log page and add it to DOM
	var page = $(`
		<div data-role="page" id="logs">
			<div class="ui-content" role="main">
				<fieldset data-role="controlgroup" data-type="horizontal" data-mini="true" class="log_type">
					<input data-mini="true" type="radio" name="log_type" id="log_timeline" value="timeline">
					<label for="log_timeline">${OSApp.Language._("Timeline")}</label>
					<input data-mini="true" type="radio" name="log_type" id="log_table" value="table">
					<label for="log_table">${OSApp.Language._("Table")}</label>
				</fieldset>
				<fieldset data-role="collapsible" data-mini="true" id="log_options" class="center">
					<legend>${OSApp.Language._("Options")}</legend>
					<fieldset data-role="controlgroup" data-type="horizontal" id="table_sort">
						<p class="tight">${OSApp.Language._("Grouping:")}</p>
						<input data-mini="true" type="radio" name="table-group" id="table-sort-day" value="day" checked="checked">
						<label for="table-sort-day">${OSApp.Language._("Day")}</label>
						<input data-mini="true" type="radio" name="table-group" id="table-sort-station" value="station">
						<label for="table-sort-station">${OSApp.Language._("Station")}</label>
					</fieldset>
					<div class="ui-field-contain">
						<label for="log_start">${OSApp.Language._("Start:")}</label>
						<input data-mini="true" type="date" id="log_start">
						<label for="log_end">${OSApp.Language._("End:")}</label>
						<input data-mini="true" type="date" id="log_end">
					</div>
					<a data-role="button" data-icon="action" class="export_logs" href="#" data-mini="true">${OSApp.Language._("Export")}</a>
					<a data-role="button" class="red clear_logs" href="#" data-mini="true" data-icon="alert">
						${OSApp.Language._("Clear Logs")}
					</a>
				</fieldset>
				<div id="logs_list" class="center">
				</div>
			</div>
		</div>
	`);

	var logsList = page.find( "#logs_list" ),
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
							var stationItem = [ utc, OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( duration ) ), station, new Date( utc.getTime() + ( duration * 1000 ) ) ];
							sortedData[ station ].push( stationItem );
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
						name = OSApp.Programs.pidToName( pid );
						group = OSApp.Stations.getName(station);
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
				//eslint-disable-next-line no-unused-vars
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
				tableHeader = "<table class=\"table-logs-datatables\"><thead><tr>" +
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
				if ( Object.prototype.hasOwnProperty.call(sortedData,  group ) ) {
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
						var sid = ( grouping === 'station' ) ? group  : sortedData[group][k][2];
						var stationName = OSApp.Stations.getName(sid);
						var runTime = sortedData[ group ][ k ][ 1 ];
						var startTime = formatTime( sortedData[ group ][ k ][ 0 ], grouping ) ;
						var endTime = formatTime( sortedData[ group ][ k ][ 3 ], grouping );

						groupArray[ i ] += "<tr>" +
							"<td>" + stationName + "</td>" + // Station name
							"<td>" + runTime + "</td>" + // Runtime
							"<td>" + startTime + "</td>" + // Startdate
							"<td>" + endTime + "</td>" + // Enddate
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

			// Initialize datatables.net on all tables with class table-logs-datatables
			$( ".table-logs-datatables" ).DataTable( OSApp.UIDom.getDatatablesConfig() );

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
		OSApp.Logs.clearLogs( requestData );
		return false;
	} );

	// Automatically update the log viewer when changing the date range
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

	// Automatically update log viewer when switching table sort
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

		stations = $.merge( $.merge( [], OSApp.currentSession.controller.stations?.snames ), additionalMetrics );
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

	return begin();
};

OSApp.Logs.clearLogs = function( callback ) {
	callback = callback || function() {};
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
};

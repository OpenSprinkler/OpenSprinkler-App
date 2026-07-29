/* global $, vis */

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
OSApp.Logs.MAX_CONTROLLER_EPOCH = 0xffffffff;

OSApp.Logs.logFileDay = function( endTimestamp ) {
	return Number.isSafeInteger( endTimestamp ) && endTimestamp >= 0 && endTimestamp <= OSApp.Logs.MAX_CONTROLLER_EPOCH ?
		Math.floor( endTimestamp / 86400 ) : null;
};

OSApp.Logs.normalizeRows = function( rows, kind ) {
	if ( !Array.isArray( rows ) ) return [];
	return rows.slice( 0, 100000 ).reduce( function( result, row ) {
		if ( !Array.isArray( row ) || row.length < 4 ||
			typeof row[ 3 ] !== "number" || !Number.isSafeInteger( row[ 3 ] ) || row[ 3 ] < 0 || row[ 3 ] > 0xffffffff ) {
			return result;
		}

		if ( kind === "water" ) {
			if ( row[ 1 ] !== "wl" || typeof row[ 0 ] !== "number" || !Number.isFinite( row[ 0 ] ) ||
				typeof row[ 2 ] !== "number" || !Number.isFinite( row[ 2 ] ) || Math.abs( row[ 2 ] ) > 1000000 ) return result;
			result.push( [ row[ 0 ], "wl", row[ 2 ], row[ 3 ] ] );
			return result;
		}

		if ( kind === "flow" ) {
			if ( row[ 1 ] !== "fl" || typeof row[ 0 ] !== "number" || !Number.isSafeInteger( row[ 0 ] ) ||
				row[ 0 ] < 0 || row[ 0 ] > 0xffffffff || typeof row[ 2 ] !== "number" ||
				!Number.isSafeInteger( row[ 2 ] ) || row[ 2 ] < 0 || row[ 2 ] > 0xffffffff ) return result;
			result.push( [ row[ 0 ], "fl", row[ 2 ], row[ 3 ] ] );
			return result;
		}

		var station = row[ 1 ],
			validStation = typeof station === "number" && Number.isSafeInteger( station ) && station >= 0 ||
				[ "rd", "s1", "s2", "rs" ].indexOf( station ) !== -1;
		if ( !validStation || typeof row[ 0 ] !== "number" || !Number.isSafeInteger( row[ 0 ] ) || row[ 0 ] < 0 || row[ 0 ] > 255 ||
				typeof row[ 2 ] !== "number" || !Number.isSafeInteger( row[ 2 ] ) || row[ 2 ] < -65535 || row[ 2 ] > 0xffffffff ||
				( row[ 4 ] !== undefined && ( typeof row[ 4 ] !== "number" || !Number.isFinite( row[ 4 ] ) || Math.abs( row[ 4 ] ) > 1000000000 ) ) ) return result;
		result.push( row[ 4 ] === undefined ? [ row[ 0 ], station, row[ 2 ], row[ 3 ] ] :
			[ row[ 0 ], station, row[ 2 ], row[ 3 ], row[ 4 ] ] );
		return result;
	}, [] );
};

OSApp.Logs.formatTime = function( date, includeDate ) {
	return includeDate ? OSApp.Dates.dateToString( date ) : OSApp.Dates.timeToString( date, undefined, true );
};

OSApp.Logs.parseDateRange = function( startText, endText ) {
	var start = OSApp.Dates.parseDisplayDate( startText ),
		end = OSApp.Dates.parseDisplayDate( endText );
	if ( !start || !end ) return null;

	var startSeconds = start.getTime() / 1000,
		endSeconds = end.getTime() / 1000;
	if ( !Number.isSafeInteger( startSeconds ) || !Number.isSafeInteger( endSeconds ) ||
		startSeconds < 0 || endSeconds < 0 || startSeconds > OSApp.Logs.MAX_CONTROLLER_EPOCH ||
		endSeconds > OSApp.Logs.MAX_CONTROLLER_EPOCH ) return null;

	return { start:start, end:end };
};

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
						<label for="log_start">${OSApp.Language._("Start (MM/DD/YYYY):")}</label>
						<input data-mini="true" type="text" inputmode="numeric" maxlength="10" placeholder="MM/DD/YYYY" id="log_start">
						<label for="log_end">${OSApp.Language._("End (MM/DD/YYYY):")}</label>
						<input data-mini="true" type="text" inputmode="numeric" maxlength="10" placeholder="MM/DD/YYYY" id="log_end">
					</div>
					<a data-role="button" data-icon="action" class="export_logs" href="#" data-mini="true">${OSApp.Language._("Export")}</a>
					<a data-role="button" class="red clear_logs" href="#" data-mini="true" data-icon="alert">
						${OSApp.Language._("Clear Logs")}
					</a>
				</fieldset>
				<div id="logs_list">
				</div>
			</div>
		</div>
	`);

	var logsList = page.find( "#logs_list" ),
		tableSort = page.find( "#table_sort" ),
		logOptions = page.find( "#log_options" ),
		data = [],
		groups = [],
		waterlog = [],
		flowlog = [],
		requestGeneration = 0,
		loadingGeneration = 0,
		timeline,
		destroyTimeline = function() {
			$.mobile.window.off( "resize.logsTimeline" );
			logsList.off( ".logsTimeline" );
			if ( timeline ) {
				timeline.destroy();
				timeline = null;
			}
		},
		clearExport = function() {
			page.find( ".export_logs" ).off( ".exportObj" ).removeAttr( "href download" );
		},
		settleLoading = function( generation ) {
			if ( generation !== 0 && loadingGeneration === generation ) {
				loadingGeneration = 0;
				$.mobile.loading( "hide" );
			}
		},
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
					duration = parseInt( this[ 2 ] ),
					flowRate = ( typeof this[ 4 ] !== "undefined" ) ? OSApp.Utils.flowRateToVolume( parseFloat( this[ 4 ] ) ) : null;

				// Adjust for negative watering time firmware bug
				if ( duration < 0 ) {
					duration += 65536;
				}

				var endDate = new Date( this[ 3 ] * 1000 ),
					date = new Date( endDate.getTime() - ( duration * 1000 ) );

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
							var stationItem = [ date, OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( duration ) ), station, endDate, flowRate ];
							sortedData[ station ].push( stationItem );
							break;
						case "day":
							var day = OSApp.Logs.logFileDay( this[ 3 ] ),
								item = [ date, OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( duration ) ), station, endDate, flowRate ];
							if ( day === null ) return;

							// Item structure: [startDate, runtime, station, endDate, flowRate]

							if ( typeof sortedData[ day ] !== "object" ) {
								sortedData[ day ] = [ item ];
							} else {
								sortedData[ day ].push( item );
							}

							break;
					}
				} else if ( type === "timeline" ) {
					var pid = parseInt( this[ 0 ] ),
						className, name, group;

					if ( this[ 1 ] === "rs" ) {
						className = "delayed";
						name = OSApp.Language._( "Rain Sensor" );
						group = name;
					} else if ( this[ 1 ] === "rd" ) {
						className = "delayed";
						name = OSApp.Language._( "Rain Delay" );
						group = name;
					} else if ( this[ 1 ] === "s1" ) {
						className = "delayed";
						name = OSApp.currentSession.controller.options.sn1t === 3 ? OSApp.Language._( "Soil Sensor" ) : OSApp.Language._( "Rain Sensor" );
						group = name;
					} else if ( this[ 1 ] === "s2" ) {
						className = "delayed";
						name = OSApp.currentSession.controller.options.sn2t === 3 ? OSApp.Language._( "Soil Sensor" ) : OSApp.Language._( "Rain Sensor" );
						group = name;
					} else if ( pid === 0 ) {
						return;
					} else {
						className = "program-" + ( ( pid + 3 ) % 4 );
						name = OSApp.Programs.pidToName( pid );
						group = OSApp.Stations.getName(station);
					}

					sortedData.push( {
						"start": date,
						"end": new Date( date.getTime() + ( duration * 1000 ) ),
						"className": className,
						"content": OSApp.Utils.htmlEscape( name ),
						"pid": pid - 1,
						"group": group,
					} );
					if ( !groups.some( elem => elem.id === group ) ) {
						groups.push( {
							"id": group,
							"content": OSApp.Utils.htmlEscape( group )
						} );
					}
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
						var date = new Date( parseInt( this[ 3 ] * 1000 ) );

						flSorted.push( {
							"start": new Date( date.getTime() - parseInt( this[ 2 ] * 1000 ) ),
							"end": date,
							"className": "",
							"content": volume + " L",
							"group": OSApp.Language._( "Flow Sensor" )
						} );
						if ( !groups.some( elem => elem.id === OSApp.Language._( "Flow Sensor" ) ) ) {
							groups.push( {
								"id": OSApp.Language._( "Flow Sensor" ),
								"content": OSApp.Language._( "Flow Sensor" )
							} );
						}
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
				if ( !Array.isArray( items ) || items.length < 1 ) {
					resetLogsPage();
					return;
			}

			if ( typeof fl === "string" ) {
				try {
					fl = JSON.parse( fl.replace( /,\s*inf/g, "" ) );
					//eslint-disable-next-line no-unused-vars
				} catch ( err ) {
					fl = [];
				}
			}

			data = OSApp.Logs.normalizeRows( items, "station" );
			waterlog = OSApp.Logs.normalizeRows( wl, "water" );
			flowlog = OSApp.Logs.normalizeRows( fl, "flow" );

			updateView();

			if ( data.length > 0 ) {
				OSApp.Utils.exportObj( ".export_logs", data );
			} else {
				clearExport();
			}

			},
		updateView = function() {
			if ( page.find( "#log_table" ).prop( "checked" ) ) {
				prepTable();
			} else if ( page.find( "#log_timeline" ).prop( "checked" ) ) {
				prepTimeline();
			}
		},
		prepTimeline = function() {
			destroyTimeline();
			if ( data.length < 1 ) {
				resetLogsPage();
				return;
			}

			tableSort.hide();
			logsList.show();

			logOptions.collapsible( "collapse" );

			// Sync time format with the user's clock preference.
			var format = {};
			if ( !OSApp.uiState.is24Hour ) {
				format = {
					"minorLabels": {
						"hour": "h:mm A",
						"minute": "h:mm A",
						"day": "MM/DD/YYYY"
					}
				};
			} else {
				format = {
					"minorLabels": {
						"hour": "HH:mm",
						"minute": "HH:mm",
						"day": "MM/DD/YYYY"
					}
				};
			}

			groups = [];
			var sortedData = sortData( "timeline" ),
				extraData = sortExtraData( sortedData[ 1 ], "timeline" ),
				fullData = sortedData[ 0 ].concat( extraData[ 1 ] ),
				stats = extraData[ 2 ],
				options = {
					"width":  "100%",
					"editable": false,
					"margin": {"item": 10, "axis": 0},
					"min": dates().start,
					"max": new Date( dates().end.getTime() + 86400000 ),
					"selectable": false,
					"showMajorLabels": false,
					"groupEditable": false,
					"zoomMin": 1000 * 60 * 60,
					"format": format,
					"moment": function( value ) {
						return vis.moment( value ).utc();
					},
					"zoomFriction": 1,
					"preferZoom": true
				},
				resize = function() {
					if ( timeline ) {
						timeline.redraw();
					}
				};

			logsList.off( ".logsTimeline" ).on( "swiperight.logsTimeline swipeleft.logsTimeline", function( e ) {
				e.stopImmediatePropagation();
			} );

			page.find( "#logs_list" ).empty();

			timeline = new vis.Timeline( logsList.get( 0 ), fullData, options );
			timeline.setGroups( groups );

			$.mobile.window.on( "resize.logsTimeline", resize );

			logsList.prepend( showStats( stats ) );
		},
		prepTable = function() {
			destroyTimeline();
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
					"<th data-priority='5'>" + OSApp.Language._( "Flow Rate" ) + "</th>" +
					"</tr></thead><tbody>",
				html = showStats( stats ) + "<div data-role='collapsible-set' data-inset='true' data-theme='b' data-collapsed-icon='arrow-d' data-expanded-icon='arrow-u'>",
				i = 0,
				group, ct, k;

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
						"</div>" + ( grouping === "station" ? OSApp.Utils.htmlEscape( stations[ group ] ) : OSApp.Dates.dateOnly(
							new Date( group * 1000 * 60 * 60 * 24 )
						) ) +
						"</h2>";

					if ( wlSorted[ group ] ) {
						groupArray[ i ] += "<span style='border:none' class='" +
							( wlSorted[ group ] !== 100 ? ( wlSorted[ group ] < 100 ? "green " : "red " ) : "" ) +
							"ui-body ui-body-a center'>" + OSApp.Language._( "Average" ) + " " + OSApp.Language._( "Water Level" ) + ": " + wlSorted[ group ] + "%</span>";
					}

					if ( flSorted[ group ] ) {
						groupArray[ i ] += "<span style='border:none' class='ui-body ui-body-a'>" +
							OSApp.Language._( "Total Water Used" ) + ": " + flSorted[ group ] + " L" +
							"</span>";
					}

					groupArray[ i ] += tableHeader;

					for ( k = 0; k < sortedData[ group ].length; k++ ) {
						var sid = ( grouping === 'station' ) ? group  : sortedData[group][k][2];
						var stationName = stations[sid];
						var runTime = sortedData[ group ][ k ][ 1 ];
						var startTime = OSApp.Logs.formatTime( sortedData[ group ][ k ][ 0 ], grouping === "station" ) ;
						var endTime = OSApp.Logs.formatTime( sortedData[ group ][ k ][ 3 ], grouping === "station" );
						var fRate = sortedData[ group ][ k ][ 4 ];
						var flowDisplay = ( typeof fRate === "number" ) ? fRate.toFixed( 2 ) + " L/min" : "";

						groupArray[ i ] += "<tr>" +
								"<td>" + OSApp.Utils.htmlEscape( stationName ) + "</td>" + // Station name
							"<td>" + runTime + "</td>" + // Runtime
							"<td>" + startTime + "</td>" + // Startdate
							"<td>" + endTime + "</td>" + // Enddate
							"<td>" + flowDisplay + "</td>" + // Flow rate
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

				date = OSApp.Dates.dateOnly( new Date( day * 1000 * 60 * 60 * 24 ) );

				OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to " ) + OSApp.Language._( "delete" ) + " " + date + "?", "", function() {
					$.mobile.loading( "show" );
					OSApp.Firmware.sendToOS( "/dl?pw=&day=" + day ).done( function() {
						requestData();
						OSApp.Errors.showError( date + " " + OSApp.Language._( "deleted" ) );
					} ).fail( OSApp.Firmware.settleLoadingFailure );
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

			return "<div class='ui-body-a smaller center' id='logs_summary'>" +
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
			destroyTimeline();
			clearExport();
			data = [];
			waterlog = [];
			flowlog = [];
			logOptions.collapsible( "expand" );
			tableSort.hide();
			logsList.show().html( OSApp.Language._( "No entries found in the selected date range" ) );
			},
				fail = function() {
					destroyTimeline();
					clearExport();
					data = [];
					waterlog = [];
					flowlog = [];
					tableSort.hide();
			logsList.show().html( OSApp.Language._( "Error retrieving log data. Please refresh to try again." ) );
		},
		dates = function() {
			return OSApp.Logs.parseDateRange( logStart.val(), logEnd.val() ) || {
				start:new Date( NaN ), end:new Date( NaN )
			};
		},
			requestData = function() {
				var selectedDates = dates(),
					endtime = selectedDates.end.getTime() / 1000,
					starttime = selectedDates.start.getTime() / 1000,
					generation = ++requestGeneration,
					sessionGeneration = OSApp.currentSession.generation || 0;

				if ( !isFinite( starttime ) || !isFinite( endtime ) ) {
					resetLogsPage();
					OSApp.Errors.showError( OSApp.Language._( "Please enter a valid date range" ) );
					return;
				}

				if ( endtime < starttime ) {
				resetLogsPage();
				OSApp.Errors.showError( OSApp.Language._( "Start time cannot be greater than end time" ) );
				return;
			}

					$.mobile.loading( "show" );
					loadingGeneration = generation;

			if ( ( endtime - starttime ) > 31540000 ) {
				OSApp.Errors.showError( OSApp.Language._( "The requested time span exceeds the maximum of 1 year and has been adjusted" ), 3500 );
					var nDate = new Date( selectedDates.start.getTime() );
					nDate.setUTCFullYear( nDate.getUTCFullYear() + 1 );
					logEnd.val( OSApp.Dates.dateOnly( nDate ) );
					endtime = nDate.getTime() / 1000;
				}

				var params = "start=" + Math.floor( starttime ) + "&end=" + Math.floor( endtime );

				var wlDefer = $.Deferred().resolve(),
				flDefer = $.Deferred().resolve();

			if ( OSApp.Firmware.checkOSVersion( 211 ) ) {
					wlDefer = OSApp.Firmware.sendToOS( "/jl?pw=&type=wl&" + params, "json" );
			}

			if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
					flDefer = OSApp.Firmware.sendToOS( "/jl?pw=&type=fl&" + params );
				}

				$.when(
					OSApp.Firmware.sendToOS( "/jl?pw=&" + params, "json" ),
					wlDefer,
					flDefer
					).then( function( items, wl, fl ) {
						try {
							if ( generation === requestGeneration && sessionGeneration === ( OSApp.currentSession.generation || 0 ) ) {
								success( items, wl, fl );
							}
						} finally {
							settleLoading( generation );
						}
					}, function() {
						try {
							if ( generation === requestGeneration && sessionGeneration === ( OSApp.currentSession.generation || 0 ) ) {
								fail();
							}
						} finally {
							settleLoading( generation );
						}
				} );
		},
		isNarrow = window.innerWidth < 640 ? true : false,
		logStart = page.find( "#log_start" ),
		logEnd = page.find( "#log_end" ),
		stations, logtimeout, i;

	logStart.add( logEnd ).on( "input", function() {
		this.value = OSApp.Dates.formatDateInput( this.value );
	} );

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
				destroyTimeline();
				clearExport();
				settleLoading( loadingGeneration );
				requestGeneration++;
			clearTimeout( logtimeout );
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
			// /jl treats both endpoint days as inclusive: today plus the six prior days is seven files.
			logStart.val( OSApp.Dates.dateOnly( new Date( now.getTime() - 6 * 86400000 ) ) );
			logEnd.val( OSApp.Dates.dateOnly( now ) );
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
	var completion = typeof callback === "function" ? callback : null;
	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to clear ALL your log data?" ), "", function() {
		var url = OSApp.Firmware.isOSPi() ? "/cl?pw=" : "/dl?pw=&day=all",
			sessionGeneration = OSApp.currentSession.generation || 0,
			loaderOwned = true,
			settle = function() {
				if ( loaderOwned && sessionGeneration === ( OSApp.currentSession.generation || 0 ) ) {
					$.mobile.loading( "hide" );
				}
				loaderOwned = false;
			};
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( url ).done( function() {
			settle();
			if ( sessionGeneration !== ( OSApp.currentSession.generation || 0 ) ) return;
			if ( completion ) completion();
			OSApp.Errors.showError( OSApp.Language._( "Logs have been cleared" ) );
		} ).fail( settle );
	} );
};

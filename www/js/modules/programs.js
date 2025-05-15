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
OSApp.Programs = OSApp.Programs || {};

OSApp.Programs.displayPage = function(programId) {
	// Program management functions
	var page = $(`
		<div data-role="page" id="programs">
			<div class="ui-content" role="main" id="programs_list">
			</div>
		</div>
	`);

	page
		.on( "programrefresh", updateContent )
		.on( "pagehide", function() {
			page.detach();
		} )
		.on( "pagebeforeshow", function() {
			OSApp.Programs.updateProgramHeader();

			if ( typeof expandId !== "number" && OSApp.currentSession.controller.programs.pd.length === 1 ) {
				programId = 0;
			}

			if ( typeof programId === "number" ) {
				page.find( "fieldset[data-collapsed='false']" ).collapsible( "collapse" );
				$( "#program-" + programId ).collapsible( "expand" );
			}
		} );

	function updateContent() {
		var list = $( OSApp.Programs.makeAllPrograms() );

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
				OSApp.Programs.expandProgram( $( this ) );
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
						OSApp.Programs.updateProgramHeader();
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

	function begin() {
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

	return begin();
};

OSApp.Programs.displayPageManual = function() {
	// Manual control functions
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
			OSApp.Sites.updateControllerStatus().done( function() {
				var item = listitems.eq( currPos ).find( "a" );

				if ( OSApp.currentSession.controller.options.mas ) {
					if ( OSApp.currentSession.controller.status[ OSApp.currentSession.controller.options.mas - 1 ] ) {
						listitems.eq( OSApp.currentSession.controller.options.mas - 1 ).addClass( "green" );
					} else {
						listitems.eq( OSApp.currentSession.controller.options.mas - 1 ).removeClass( "green" );
					}
				}

				item.text( OSApp.Stations.getName(currPos) );

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

		OSApp.UIDom.showDurationBox( {
			seconds: dur.val(),
			title: name,
			callback: function( result ) {
				dur.val( result );
				dur.text( OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( result ) ) );
				OSApp.Storage.set( { "autoOff": result } );
			},
			maximum: 32768
		} );

		return false;
	} );

	page.find( "#mmm" ).on( "change", OSApp.UIDom.flipSwitched );

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

	return begin();
};

OSApp.Programs.displayPageRunOnce = function() {
	// Runonce functions
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
			page.find( "#uwt-runonce" ).prop( "checked", false ).checkboxradio( "refresh" );
			page.find( "#interval-runonce" ).val( 0 ).text( OSApp.Dates.dhms2str(0) );
			page.find( "#repeat-runonce" ).val( 0 ).text( 0 );
			return false;
		},
		fillRunonce = function( data, repeat, interval, weather ) {
			resetRunonce();
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

			if( OSApp.Supported.repeatedRunonce() ){
				if(typeof repeat === "number"){
					page.find("#repeat-runonce").val( repeat ).text( repeat );
				}
				if(typeof interval === "number"){
					page.find("#interval-runonce").val( interval * 60 ).text( OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( interval * 60 ) ) );
				}
				if(typeof weather === "number"){
					page.find("#uwt-runonce").prop( "checked", weather ? true : false).checkboxradio( "refresh" );
				}
			}
		},
		i, list, quickPick, progs, rprogs, repeats, intervals, weathers, z, program, name;

	page.on( "pagehide", function() {
		page.detach();
	} );

	function begin() {
		list = "<p class='center'>" + OSApp.Language._( "Zero value excludes the station from the run-once program." ) + "</p>";
		progs = [];
		repeats = [];
		intervals = [];
		weathers = [];
		if ( OSApp.currentSession.controller.programs.pd.length ) {
			for ( z = 0; z < OSApp.currentSession.controller.programs.pd.length; z++ ) {
				program = OSApp.Programs.readProgram( OSApp.currentSession.controller.programs.pd[ z ] );
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

				if ( OSApp.Supported.repeatedRunonce() ){
					repeats.push( program.repeat );
					intervals.push( program.interval );
					weathers.push ( program.weather );
				}
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
		$.each( OSApp.currentSession.controller.stations.snames, function( i ) {
			if ( OSApp.Stations.isMaster( i ) ) {
				list += "<div class='ui-field-contain duration-input" + ( OSApp.Stations.isDisabled( i ) ? " station-hidden' style='display:none" : "" ) + "'>" +
					"<label for='zone-" + i + "'>" + OSApp.Stations.getName(i) + ":</label>" +
					"<button disabled='true' data-mini='true' name='zone-" + i + "' id='zone-" + i + "' value='0'>Master</button></div>";
			} else {
				list += "<div class='ui-field-contain duration-input" + ( OSApp.Stations.isDisabled( i ) ? " station-hidden' style='display:none" : "" ) + "'>" +
					"<label for='zone-" + i + "'>" + OSApp.Stations.getName(i) + ":</label>" +
					"<button data-mini='true' name='zone-" + i + "' id='zone-" + i + "' value='0'>0s</button></div>";
			}
		} );

		list += "</form>";

		if( OSApp.Supported.repeatedRunonce() ){
			// Program weather control flag
			list += "<label for='uwt-runonce'><input data-mini='true' type='checkbox' name='uwt-runonce' id='uwt-runonce'>" + OSApp.Language._( "Use Weather Adjustment" ) + "</label>";

			// Show repeating start time options
			list += "<div id='input_stype_repeat-runonce'>";
			list += "<div class='ui-grid-a'>";
			list += "<div class='ui-block-a'><label class='pad_buttons center' for='interval-runonce'>" + OSApp.Language._( "Repeat Every" ) + "</label>" +
				"<button class='pad_buttons' data-mini='true' name='interval-runonce' id='interval-runonce' " +
					"value='0'>" + OSApp.Dates.dhms2str( 0 ) + "</button></div>";
			list += "<div class='ui-block-b'><label class='pad_buttons center' for='repeat-runonce'>" + OSApp.Language._( "Repeat Count" ) + "</label>" +
				"<button class='pad_buttons' data-mini='true' name='repeat-runonce' id='repeat-runonce' value='0'>0</button></div>";
			list += "</div></div>";
		}

		list += "<a class='ui-btn ui-corner-all ui-shadow rsubmit' href='#'>" + OSApp.Language._( "Submit" ) + "</a>" +
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
				OSApp.UIDom.showDurationBox( {
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

			if ( OSApp.Supported.repeatedRunonce() ) {
				fillRunonce( rprogs[ prog ], repeats [ prog ], intervals[ prog ], weathers[ prog ]);
			} else {
				fillRunonce( rprogs[ prog ] );
			}
		} );

		page.find( ".rsubmit" ).on( "click", OSApp.Stations.submitRunonce );
		page.find( ".rreset" ).on( "click", resetRunonce );

		page.find( "[id^='zone-']" ).on( "click", function() {
			var dur = $( this ),
				name = page.find( "label[for='" + dur.attr( "id" ) + "']" ).text().slice( 0, -1 );

			OSApp.UIDom.showDurationBox( {
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

		// Handle interval duration input
		page.find( "#interval-runonce" ).on( "click", function() {
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
				on: OSApp.Stations.submitRunonce
			}
		} );

		$( "#runonce" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
}

OSApp.Programs.displayPagePreviewPrograms = function() {
	// Preview functions
	var page = $(`
		<div data-role="page" id="preview">
			<div class="ui-content" role="main">
				<div id="preview_header" class="input_with_buttons">
					<button class="preview-minus ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border"></button>
					<input class="center" type="date" name="preview_date" id="preview_date">
					<button class="preview-plus ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border"></button>
				</div>
				<div id="timeline"></div>
				<div data-role="controlgroup" data-type="horizontal" id="timeline-navigation">
					<a class="ui-btn ui-corner-all ui-icon-plus ui-btn-icon-notext btn-no-border" title="${OSApp.Language._("Zoom in")}"></a>
					<a class="ui-btn ui-corner-all ui-icon-minus ui-btn-icon-notext btn-no-border" title="${OSApp.Language._("Zoom out")}"></a>
					<a class="ui-btn ui-corner-all ui-icon-carat-l ui-btn-icon-notext btn-no-border" title="${OSApp.Language._("Move left")}"></a>
					<a class="ui-btn ui-corner-all ui-icon-carat-r ui-btn-icon-notext btn-no-border" title="${OSApp.Language._("Move right")}"></a>
				</div>
			</div>
		</div>
	`),
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

	function gen_station_runorder( runcount, nstations, prog ) {
		let order = new Array( nstations );
		for ( let i = 0; i < nstations; i++ ) {
			order[ i ] = i;	// initialize
		}
		if ( !OSApp.Firmware.checkOSVersion( 2211 ) ) { // only firmware 2.2.1(1) supports runorder
			return order;
		}
		let pname = prog[ 5 ]; // program name
		let len = pname.length;
		if ( len >= 2 && pname[ len - 2 ] === '>' ) {
			let anno = pname[ len - 1 ];
			switch ( anno ) {
				case 'I':
				case 'a':
				case 'A':
					{
						if ( anno === 'I' || ( anno === 'a' && runcount % 2 == 0 ) || ( anno === 'A' && runcount % 2 == 1 ) ) {
							for ( let i = 0; i < nstations; i++ ) {
								order[ i ] = nstations - 1 - i;
							}
						}
					}
					break;

				case 'n':
				case 'N':
				case 't':
				case 'T':
					{
						let snames = OSApp.currentSession.controller.stations.snames;
						if ( anno === 'n' || ( anno === 't' && runcount % 2 == 1 ) || ( anno === 'T' && runcount % 2 == 0 ) ) {
							order = snames.map((name, index) => ({ name, index })) // Store names with their original indices
							.sort((a, b) => a.name.localeCompare(b.name)) // Sort by name (ascending)
							.map(item => item.index); // Extract the indices
						} else {
							order = snames.map((name, index) => ({ name, index })) // Store names with their original indices
							.sort((a, b) => b.name.localeCompare(a.name)) // Sort by name (descending)
							.map(item => item.index); // Extract the indices
						}
					}
					break;

				case 'r':
				case 'R':
					{
						order = Array.from({ length: nstations }, (_, i) => i);
						for (let i = order.length - 1; i > 0; i--) {
							let j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
							[order[i], order[j]] = [order[j], order[i]]; // Swap elements
						}
					}
					break;
			}
		}
		return order;
	}

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
				let runcount = checkMatch( prog, simminutes, simt, simday, devday );
				if ( runcount > 0 ) {
					// TODO: handle station orders
					let station_order = gen_station_runorder(runcount, nstations, prog);
					for ( let oi = 0; oi < nstations; oi++ ) {
						let sid = station_order[oi];
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
									waterTime = OSApp.Stations.getStationDuration( prog[ 4 ][ sid ], simt ) * OSApp.currentSession.controller.options.wl / 100 >> 0;
								} else {
									waterTime = OSApp.Stations.getStationDuration( prog[ 4 ][ sid ], simt );
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
			"group": OSApp.Stations.getName(sid),
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
		var yr = date.getUTCFullYear();
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
		} else if ( type === 2 ) {

			// Monthly program
			const day = prog[ 1 ] & 0b11111;
			if ( day === 0 ){
				if(!OSApp.Dates.isLastDayOfMonth(mt-1, yr, dt)){
					return 0;
				}
			} else if ( dt !== day ) {
				return 0;
			}
		} else if ( type === 1 ) {

			// Singlerun program
			const epochDays = simt / 86400000;
			if( (prog[1] << 8) + prog[2] != epochDays)
				return 0;

		}else if ( type === 0 ) {

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
			var start = OSApp.Programs.getStartTime( prog[ 3 ][ 0 ], date ),
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

				if ( simminutes === OSApp.Programs.getStartTime( sttimes[ i ], date ) ) {
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

		var start = OSApp.Programs.getStartTime( prog[ 3 ][ 0 ], date ),
			repeat = prog[ 3 ][ 1 ],
			cycle = prog[ 3 ][ 2 ],
			c;

		// Check if simday matches the program start days
		if ( checkDayMatch( prog, simt, simday, devday ) ) {

			// Match the start time
			if ( sttype === 0 ) {

				// Repeating program
				if ( simminutes === start ) {
					return 1; // this is the first run
				}

				if ( simminutes > start && cycle ) {
					c = Math.round( ( simminutes - start ) / cycle );
					if ( ( c * cycle === ( simminutes - start ) ) && ( c <= repeat ) ) {
						return (c+1); // return run count
					}
				}

			} else {

				// Set start time program
				var sttimes = prog[ 3 ];
				for ( var i = 0; i < 4; i++ ) {

					if ( simminutes === OSApp.Programs.getStartTime( sttimes[ i ], date ) ) {
						return (i+1);  // return matches index + 1
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
				return (c+1); // return run count
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

		if ( OSApp.currentSession.controller.settings.devt && page.find( "#preview_date" ).val() === "" ) {
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

	return begin();
}
// Translate program array into easier to use data
OSApp.Programs.readProgram = function( program ) {
	if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
		return OSApp.Programs.readProgram21( program );
	} else {
		return OSApp.Programs.readProgram183( program );
	}
};

OSApp.Programs.readProgram183 = function( program ) {
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
	newdata.type = interval ? OSApp.Constants.options.PROGRAM_TYPE_INTERVAL : OSApp.Constants.options.PROGRAM_TYPE_WEEKLY;

	return newdata;
};

// Read program for OpenSprinkler 2.1+
OSApp.Programs.readProgram21 = function( program ) {
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
	newdata.stations = program[ 4 ];
	newdata.name = program[ 5 ];
	newdata.type = type;

	if ( startType === 0 ) {
		newdata.start = program[ 3 ][ 0 ];
		newdata.repeat = program[ 3 ][ 1 ];
		newdata.interval = program[ 3 ][ 2 ];
	} else if ( startType === 1 ) {
		newdata.start = program[ 3 ];
	}

	if ( type === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL ) {

		//This is an interval program
		days = [ days1, days0 ];
	} else if ( type === OSApp.Constants.options.PROGRAM_TYPE_WEEKLY ) {

		//This is a weekly program
		for ( var d = 0; d < 7; d++ ) {
			if ( days0 & ( 1 << d ) ) {
				days += "1";
			} else {
				days += "0";
			}
		}
	} else if ( type === OSApp.Constants.options.PROGRAM_TYPE_SINGLERUN ) {

		//This is a single run program
		days = [ (days0 << 8) + days1, 0 ];
	} else if ( type === OSApp.Constants.options.PROGRAM_TYPE_MONTHLY ) {

		//This is a monthly program
		days = [ days0, days1 ];
	}

	newdata.days = days;

	return newdata;
};

// FYI this duplicates the function name Stations.getStartTime =/
OSApp.Programs.getStartTime = function( time, date ) {
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
};

OSApp.Programs.readStartTime = function( time ) {
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
};

// Translate program ID to it's name
OSApp.Programs.pidToName = function( pid ) {
	var pname = OSApp.Language._( "Program" ) + " " + pid;

	if ( pid === 255 || pid === 99 ) {
		pname = OSApp.Language._( "Manual program" );
	} else if ( pid === 254 || pid === 98 ) {
		pname = OSApp.Language._( "Run-once program" );
	} else if ( OSApp.Firmware.checkOSVersion( 210 ) && pid <= OSApp.currentSession.controller.programs.pd.length ) {
		pname = OSApp.currentSession.controller.programs.pd[ pid - 1 ][ 5 ];
	}

	return pname;
};

// Check each program and change the background color to red if disabled. Also apply program-disabled class for program hiding feature
OSApp.Programs.updateProgramHeader = function() {
	$( "#programs_list" ).find( "[id^=program-]" ).each( function( a, b ) {
		var item = $( b ),
			heading = item.find( ".ui-collapsible-heading-toggle" ),
			en = OSApp.Firmware.checkOSVersion( 210 ) ? ( OSApp.currentSession.controller.programs.pd[ a ][ 0 ] ) & 0x01 : OSApp.currentSession.controller.programs.pd[ a ][ 0 ];

		if ( en ) {
			heading.removeClass( "red" );
			heading.removeClass( "program-disabled" );
		} else {
			heading.addClass( "red" );
			heading.addClass( "program-disabled" );
		}
	} );
};

// Make the list of all programs, respecting the "hide disabled" option/waffle setting to toggle visibility of disabled programs
OSApp.Programs.makeAllPrograms = function() {
	if ( OSApp.currentSession.controller.programs.pd.length === 0 ) {
		return "<p class='center'>" + OSApp.Language._( "You have no programs currently added. Tap the Add button on the top right corner to get started." ) + "</p>";
	}

	var list = "<p class='center'>" + OSApp.Language._( "Click any program below to expand/edit. Be sure to save changes." ) + "</p><div data-role='collapsible-set'>";

	var numDisabledPrograms = 0;

	for ( var i = 0; i < OSApp.currentSession.controller.programs.pd.length; i++ ) {
		var program = OSApp.Programs.readProgram( OSApp.currentSession.controller.programs.pd[ i ] );
		var name = program.name || OSApp.Language._( "Program" ) + " " + ( i + 1 );

		if ( program.en === 0) {
			numDisabledPrograms++;
		}

		list += `
			<fieldset id='program-${i}' data-role='collapsible'>
				<h3>
					<a ${( i > 0 ? "" : "style='visibility:hidden' " )} class='hidden ui-btn ui-btn-icon-notext ui-icon-arrow-u ui-btn-corner-all move-up'></a>
					<a class='ui-btn ui-btn-corner-all program-copy'>${OSApp.Language._( "copy" )}</a>
					<span class='program-name'>${name}</span>
				</h3>
			</fieldset>`;
	}

	if ( numDisabledPrograms ) {
		var pluralProgram = 'program';
		if ( numDisabledPrograms > 1 ) {
			pluralProgram = 'programs';
		}
		list += "<p class='center disabled-programs-note'>" + numDisabledPrograms + " " + OSApp.Language._( `disabled ${pluralProgram} hidden. Tap 'Show Disabled' in the footer menu to view` ) + "</p>";
	}

	return list + "</div>";
};

OSApp.Programs.makeProgram = function( n, isCopy ) {
	if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
		return OSApp.Programs.makeProgram21( n, isCopy );
	} else {
		return OSApp.Programs.makeProgram183( n, isCopy );
	}
};

OSApp.Programs.makeProgram183 = function( n, isCopy ) {
	// FIXME: see if we can refactor week array out to Constants
	var week = [ OSApp.Language._( "Monday" ), OSApp.Language._( "Tuesday" ), OSApp.Language._( "Wednesday" ), OSApp.Language._( "Thursday" ), OSApp.Language._( "Friday" ), OSApp.Language._( "Saturday" ), OSApp.Language._( "Sunday" ) ],
		list = "",
		id = isCopy ? "new" : n,
		days, i, j, setStations, program, page;

	OSApp.uiState.selectDaysInProgramId = `d-${n}-${Date.now()}`;

	if ( n === "new" ) {
		program = { "en":0, "weather":0, "type":0, "is_even":0, "is_odd":0, "duration":0, "interval":0, "start":0, "end":0, "days":[ 0, 0 ] };
	} else {
		program = OSApp.Programs.readProgram( OSApp.currentSession.controller.programs.pd[ n ] );
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
			"value='days_week-" + id + "' " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL ) ? "" : "checked='checked'" ) + ">" +
		"<label for='days_week-" + id + "'>" + OSApp.Language._( "Weekly" ) + "</label>";
	list += "<input data-mini='true' type='radio' name='rad_days-" + id + "' id='days_n-" + id + "' " +
			"value='days_n-" + id + "' " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL ) ? "checked='checked'" : "" ) + ">" +
		"<label for='days_n-" + id + "'>" + OSApp.Language._( "Interval" ) + "</label>";
	list += "</fieldset><div id='input_days_week-" + id + "' " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL ) ? "style='display:none'" : "" ) + ">";

	list += "<div class='center'><p class='tight'>" + OSApp.Language._( "Restrictions" ) + "</p>" +
		"<select data-inline='true' data-iconpos='left' data-mini='true' id='days_rst-" + id + "'>";
	list += "<option value='none' " + ( ( !program.is_even && !program.is_odd ) ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "None" ) + "</option>";
	list += "<option value='odd' " + ( ( !program.is_even && program.is_odd ) ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "Odd Days Only" ) + "</option>";
	list += "<option value='even' " + ( ( !program.is_odd && program.is_even ) ? "selected='selected'" : "" ) + ">" + OSApp.Language._( "Even Days Only" ) + "</option>";
	list += "</select></div>";

	list += "<div class='center'><p class='tight'>" + OSApp.Language._( "Days of the Week" ) + "</p>" +
		"<select " + ( $.mobile.window.width() > 560 ? "data-inline='true' " : "" ) + "data-iconpos='left' data-mini='true' " +
			"multiple='multiple' data-native-menu='false' id='" + OSApp.uiState.selectDaysInProgramId + "'><option>" + OSApp.Language._( "Choose day(s)" ) + "</option>";

	for ( j = 0; j < week.length; j++ ) {
		list += "<option " + ( ( (program.type !== OSApp.Constants.options.PROGRAM_TYPE_INTERVAL) && days[ j ] ) ? "selected='selected'" : "" ) + " value='" + j + "'>" + week[ j ] + "</option>";
	}
	list += "</select></div></div>";

	list += "<div " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL ) ? "" : "style='display:none'" ) + " id='input_days_n-" + id + "' class='ui-grid-a'>";
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
			" name='station_" + j + "-" + id + "' id='station_" + j + "-" + id + "'>" + OSApp.Stations.getName(j) + "</label>";
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
};

OSApp.Programs.makeProgram21 = function( n, isCopy ) {
	// FIXME: see if we can refactor week array out to Constants
	var week = [ OSApp.Language._( "Monday" ), OSApp.Language._( "Tuesday" ), OSApp.Language._( "Wednesday" ), OSApp.Language._( "Thursday" ), OSApp.Language._( "Friday" ), OSApp.Language._( "Saturday" ), OSApp.Language._( "Sunday" ) ],
		list = "",
		id = isCopy ? "new" : n,
		days, i, j, program, page, times, time, unchecked;

	OSApp.uiState.selectDaysInProgramId = `d-${n}-${Date.now()}`;

	if ( n === "new" ) {
		program = { "name":"", "en":0, "weather":0, "type":0, "is_even":0, "is_odd":0, "interval":0, "start":0, "days":[ 0, 0 ], "repeat":0, "stations":[] };
	} else {
		program = OSApp.Programs.readProgram( OSApp.currentSession.controller.programs.pd[ n ] );
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

	// Program name
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
		"' value='" + times[ 0 ] + "'>" + OSApp.Programs.readStartTime( times[ 0 ] ) + "</button>";

	// Close basic settings group
	list += "</div></div></div></div>";

	// Group all program type options visually
	list += "<div style='margin-top:10px' class='ui-corner-all'>";
	list += "<div class='ui-bar ui-bar-a'><h3>" + OSApp.Language._( "Program Type" ) + "</h3></div>";
	list += "<div class='ui-body ui-body-a'>";

	// Controlgroup to handle program type (weekly/interval/singlerun/monthly)
	list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
	list += "<input data-mini='true' type='radio' name='rad_days-" + id + "' id='days_week-" + id + "' " +
		"value='days_week-" + id + "' " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_WEEKLY ) ? "checked='checked'" : "" ) + ">" +
		"<label for='days_week-" + id + "'>" + OSApp.Language._( "Weekly" ) + "</label>";
	list += "<input data-mini='true' type='radio' name='rad_days-" + id + "' id='days_n-" + id + "' " +
		"value='days_n-" + id + "' " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL ) ? "checked='checked'" : "" ) + ">" +
		"<label for='days_n-" + id + "'>" + OSApp.Language._( "Interval" ) + "</label>";
	if( OSApp.Supported.singleRunAndMonthly() ){
		list += "<input data-mini='true' type='radio' name='rad_days-" + id + "' id='days_single-" + id + "' " +
			"value='days_single-" + id + "' " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_SINGLERUN ) ? "checked='checked'" : "" ) + ">" +
			"<label for='days_single-" + id + "'>" + OSApp.Language._( "Single Run" ) + "</label>";
		list += "<input data-mini='true' type='radio' name='rad_days-" + id + "' id='days_month-" + id + "' " +
			"value='days_month-" + id + "' " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_MONTHLY ) ? "checked='checked'" : "" ) + ">" +
			"<label for='days_month-" + id + "'>" + OSApp.Language._( "Monthly" ) + "</label>";
	}
	list += "</fieldset>";

	// Show weekly program options
	list += "<div id='input_days_week-" + id + "' " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_WEEKLY ) ? "" : "style='display:none'" ) + ">";
	list += "<div class='center'><p class='tight'>" + OSApp.Language._( "Days of the Week" ) + " (" + id + ")" + "</p>" +
		"<select " + ( $.mobile.window.width() > 560 ? "data-inline='true' " : "" ) + "data-iconpos='left' data-mini='true' " +
			"multiple='multiple' data-native-menu='false' id='" + OSApp.uiState.selectDaysInProgramId + "'>" +
		"<option>" + OSApp.Language._( "Choose day(s)" ) + "</option>";
	for ( j = 0; j < week.length; j++ ) {
		list += "<option " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_WEEKLY && days[ j ] ) ? "selected='selected'" : "" ) + " value='" + j + "'>" + week[ j ] + "</option>";
	}
	list += "</select></div></div>";

	// Show interval program options
	list += "<div " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL ) ? "" : "style='display:none'" ) + " id='input_days_n-" + id + "' class='ui-grid-a'>";
	list += "<div class='ui-block-a'><label class='center' for='every-" + id + "'>" + OSApp.Language._( "Interval (Days)" ) + "</label>" +
		"<input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='every-" + id + "' pattern='[0-9]*' " +
			"id='every-" + id + "' value='" + program.days[ 0 ] + "'></div>";
	list += "<div class='ui-block-b'><label class='center' for='starting-" + id + "'>" + OSApp.Language._( "Starting In" ) + "</label>" +
		"<input data-wrapper-class='pad_buttons' data-mini='true' type='number' name='starting-" + id + "' pattern='[0-9]*' " +
			"id='starting-" + id + "' value='" + program.days[ 1 ] + "'></div>";
	list += "</div>";

	// Show singlerun program options
	list += "<div " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_SINGLERUN ) ? "" : "style='display:none'" ) + " id='input_days_single-" + id + "'>";
	list += "<div class='center'><p class='tight'>" + OSApp.Language._( "Start Date (mm/dd/yyyy)" ) + "</p>" +
		"<input type='text' id='singleDate-" + id + "' value='" + OSApp.Dates.epochToDate(program.days[ 0 ]) + "'></div>";
	list += "</div>";

	// Show monthly program options
	list += "<div id='input_days_month-" + id + "' " + ( ( program.type === OSApp.Constants.options.PROGRAM_TYPE_MONTHLY ) ? "" : "style='display:none'" ) + ">";
	list += "<div class='center'><p class='tight'>" + OSApp.Language._( "Day of the Month (Use 0 for the last day)" ) + "</p>" +
		"<input type='text' id='monthDay-" + id + "' value='" + program.days[ 0 ] + "'></div>";
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
	list += "<div class='ui-bar ui-bar-a'><h3 id='station-head'>" + OSApp.Language._( "Stations" ) + "</h3></div>";
	list += "<div class='ui-body ui-body-a'>";
	list += "<div class='ui-field-contain duration-input'>" +
			"<label for='set-all'> </label>" +
			"<button style='background-color:#fcfcfc' data-mini='true' id='set-all'>Quick Set</button></div>";

	var hideDisabled = $( "#programs" ).hasClass( "show-hidden" ) ? "" : "' style='display:none";

	// Show station duration inputs
	for ( j = 0; j < OSApp.currentSession.controller.stations.snames.length; j++ ) {
		if ( OSApp.Stations.isMaster( j ) ) {
			list += "<div class='ui-field-contain duration-input" + ( OSApp.Stations.isDisabled( j ) ? " station-hidden" + hideDisabled : "" ) + "'>" +
				"<label for='station_" + j + "-" + id + "'>" + OSApp.Stations.getName(j) + ":</label>" +
				"<button disabled='true' data-mini='true' name='station_" + j + "-" + id + "' id='station_" + j + "-" + id + "' value='0'>" +
				OSApp.Language._( "Master" ) + "</button></div>";
		} else {
			time = program.stations[ j ] || 0;
			list += "<div class='ui-field-contain duration-input" + ( OSApp.Stations.isDisabled( j ) ? " station-hidden" + hideDisabled : "" ) + "'>" +
				"<label for='station_" + j + "-" + id + "'>" + OSApp.Stations.getName(j) + ":</label>" +
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
		list += "<td><button class='timefield' data-mini='true' type='time' id='start_" + ( j + 1 ) + "-" + id + "' value='" + ( unchecked ? 0 : times[ j ] ) + "'>" + OSApp.Programs.readStartTime( unchecked ? 0 : times[ j ] ) + "</button></td></tr>";
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

	// Function to have live changing program time
	function updateProgramTime(){
		var runtimes = [];
		page.find( "[id^=station_]" ).each( function() {
			var dur = $( this );
			dur = parseInt( dur.val());
			runtimes.push(dur);
		} );
		var runtime = OSApp.Groups.calculateTotalRunningTime( runtimes );
		var hours = Math.floor(runtime / 3600);
		var minutes = Math.floor(runtime % 3600 / 60);
		var seconds = Math.floor(runtime % 3600 % 60);
		var displayRuntime = "" + (hours/10>>0) + (hours%10);
		displayRuntime += ":" + (minutes/10>>0) + (minutes%10);
		displayRuntime += ":" + (seconds/10>>0) + (seconds%10);
		page.find( "#station-head" ).text("Stations (Total Program Run Time: " + displayRuntime + ")");
	}

	updateProgramTime();

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
				time.text( OSApp.Programs.readStartTime( result ) );
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

	// Handle set all button
	page.find( "#set-all" ).on( "click", function (){
		OSApp.UIDom.showDurationBox( {
			seconds: 60,
			title: "Set Duration",
			incrementalUpdate: false,
			callback: function( result ) {
				page.find( "[id^=station_]" ).each( function() {
					var dur = $( this );
					if ( dur.text() === "Master"){
						return;
					}
					dur.val( result ).addClass( "green" );
					dur.text( OSApp.Dates.getDurationText( result ) );
					if ( result === 0 ) {
						dur.removeClass( "green" );
					}
				} );
				updateProgramTime();
			},
			maximum: 65535
		} );
	} );

	// Handle all station duration inputs
	page.find( "[id^=station_]" ).on( "click", function() {
		var dur = $( this ),
			name = OSApp.Stations.getName( dur.attr( "id" ).split( "_" )[ 1 ].split( "-" )[ 0 ] );

		OSApp.UIDom.showDurationBox( {
			seconds: dur.val(),
			title: name,
			callback: function( result ) {
				dur.val( result ).addClass( "green" );
				dur.text( OSApp.Dates.getDurationText( result ) );

				if ( result === 0 ) {
					dur.removeClass( "green" );
				}
				updateProgramTime();
			},
			maximum: 65535,
			showSun: OSApp.Firmware.checkOSVersion( 214 ) ? true : false
		} );
	} );

	OSApp.UIDom.fixInputClick( page );

	return page;
};

OSApp.Programs.addProgram = function( copyID ) {
	copyID = ( copyID >= 0 ) ? copyID : "new";

	var page = $( "<div data-role='page' id='addprogram'>" +
				"<div class='ui-content' role='main' id='newprogram'>" +
					"<fieldset id='program-new'>" +
					"</fieldset>" +
				"</div>" +
			"</div>" ),
		submit = function() {
			OSApp.Programs.submitProgram( "new" );
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

	page.find( "#program-new" ).html( OSApp.Programs.makeProgram( copyID, true ) ).one( "change input", function() {
		header.eq( 2 ).prop( "disabled", false ).addClass( "hasChanges" );
	} );

	page.find( "[id^='submit-']" ).on( "click", function() {
		OSApp.Programs.submitProgram( "new" );
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
};

OSApp.Programs.deleteProgram = function( id ) {
	var program = OSApp.Programs.pidToName( parseInt( id ) + 1 );

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
};

OSApp.Programs.submitProgram = function( id ) {
	$( "#program-" + id ).find( ".hasChanges" ).removeClass( "hasChanges" );

	if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
		OSApp.Programs.submitProgram21( id );
	} else {
		OSApp.Programs.submitProgram183( id );
	}
};

OSApp.Programs.submitProgram183 = function( id ) {
	var program = [],
		days = [ 0, 0 ],
		stationSelected = 0,
		en = ( $( "#en-" + id ).is( ":checked" ) ) ? 1 : 0,
		daysin, i, s;

	program[ 0 ] = en;

	if ( $( "#days_week-" + id ).is( ":checked" ) ) {
		daysin = $( `#${OSApp.uiState.selectDaysInProgramId}` ).val();
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
				$( "#programs" ).trigger( "programrefresh" );
				OSApp.Programs.updateProgramHeader();
			} );
			OSApp.Errors.showError( OSApp.Language._( "Program has been updated" ) );
		} );
	}
};

OSApp.Programs.submitProgram21 = function( id, ignoreWarning ) {
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
			OSApp.Errors.showError( OSApp.Language._( "Error: Interval days must be between") + " " + minIntervalDays + " " + OSApp.Language._( "and 128." ) );
			return;
		}

		days[ 0 ] = parseInt( $( "#starting-" + id ).val(), 10 );

		if ( !( days[ 0 ] >= 0 && days[ 0 ] < days[ 1 ] ) ) {
			OSApp.Errors.showError( OSApp.Language._( "Error: Starting in days wrong." ) );
			return;
		}

	} else if ( $( "#days_month-" + id ).is( ":checked" ) ) {
		j |= ( 2 << 4 );
		days[ 0 ] = parseInt( $( "#monthDay-" + id ).val(), 10 );
		if ( days[ 0 ] < 0 || days[ 0 ] > 31) {
			OSApp.Errors.showerror( OSApp.Language._("Error: Day of month is out of bounds." ) );
			return;
		}

	} else if ( $( "#days_single-" + id ).is( ":checked" ) ) {
		j |= ( 1 << 4 );
		var time = OSApp.Dates.dateToEpoch( $( "#singleDate-" + id ).val());
		if ( time === -1 ){
			OSApp.Errors.showerror( OSApp.Language._( "Error: Start date is input incorrectly." ) );
			return;
		}
		days[ 0 ] = (time >> 8) & 0b11111111;
		days[ 1 ] = time & 0b11111111;

	} else if ( $( "#days_week-" + id ).is( ":checked" ) ) {
		j |= ( 0 << 4 );
		daysin = $( `#${OSApp.uiState.selectDaysInProgramId}` ).val();
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
		var totalruntime = OSApp.Groups.calculateTotalRunningTime( runTimes );
		var repeatinterval = start[ 2 ] * 60;
		if ( totalruntime > repeatinterval ) {
			OSApp.UIDom.areYouSure( OSApp.Language._( "Warning: The repeat interval" ) + " (" + repeatinterval + " " + OSApp.Language._( "sec" ) + ") " + OSApp.Language._( "is less than the program run time" ) + " ( " + totalruntime + " " + OSApp.Language._( "sec" ) +").", OSApp.Language._( "Do you want to continue?" ), function() {
				OSApp.Programs.submitProgram21( id, true );
			} );
			return;
		}
	}

	// If the interval is an even number and a restriction is set, notify user of possible conflict
	if ( !ignoreWarning && ( ( j >> 4 ) & 0x03 ) === 3 && !( days[ 1 ] & 1 ) && ( ( j >> 2 ) & 0x03 ) > 0 ) {
		OSApp.UIDom.areYouSure( OSApp.Language._( "Warning: The use of odd/even restrictions with the selected interval day may result in the program not running at all." ), OSApp.Language._( "Do you want to continue?" ), function() {
			OSApp.Programs.submitProgram21( id, true );
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
				$( "#programs" ).trigger( "programrefresh" );
				OSApp.Programs.updateProgramHeader();
				$( "#program-" + id ).find( ".program-name" ).text( name );
			} );
			OSApp.Errors.showError( OSApp.Language._( "Program has been updated" ) );
		} );
	}
};

OSApp.Programs.expandProgram = function( program ) {
	var id = parseInt( program.attr( "id" ).split( "-" )[ 1 ] );

	program.find( ".ui-collapsible-content" ).html( OSApp.Programs.makeProgram( id ) ).enhanceWithin().on( "change input click", function( e ) {
		if ( e.type === "click" && e.target.tagName !== "BUTTON" ) {
			return;
		}

		$( this ).off( "change input click" );
		program.find( "[id^='submit-']" ).addClass( "hasChanges" );
	} );

	program.find( "[id^='submit-']" ).on( "click", function() {
		OSApp.Programs.submitProgram( id );
		return false;
	} );

	program.find( "[id^='delete-']" ).on( "click", function() {
		OSApp.Programs.deleteProgram( id );
		return false;
	} );

	program.find( "[id^='run-']" ).on( "click", function() {
		var name = OSApp.Firmware.checkOSVersion( 210 ) ? OSApp.currentSession.controller.programs.pd[ id ][ 5 ] : "Program " + id;

		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to start" ) + " " + name + " " + OSApp.Language._( "now?" ), "", function() {
			let repeat, interval;
			if( OSApp.Supported.repeatedRunonce() ) {
				const program = OSApp.currentSession.controller.programs.pd[ id ];
				const startType = ( ( program[ 0 ] >> 6 ) & 0x01 );
				if( startType === 0 ){
					repeat = program[ 3 ][ 1 ];
					interval = program[ 3 ][ 2 ];
				}
			}
			var runonce = [],
				finish = function() {
					runonce.push( 0 );
					OSApp.Stations.submitRunonce( runonce, interval, repeat );
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
};

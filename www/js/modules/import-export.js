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
OSApp.ImportExport = OSApp.ImportExport || {};

// Export and Import functions
OSApp.ImportExport.getExportMethod = function() {
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
};

OSApp.ImportExport.getImportMethod = function( localData ) {
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
					OSApp.ImportExport.importConfig( data );
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
							OSApp.ImportExport.importConfig( obj );
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
			OSApp.ImportExport.importConfig( JSON.parse( localData ) );
			return false;
		} );
	}

	OSApp.UIDom.openPopup( popup, { positionTo: $( "#sprinklers-settings" ).find( ".import_config" ) } );
};

OSApp.ImportExport.importConfig = function( data ) {
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
					var program = OSApp.Programs.readProgram183( prog ),
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
};

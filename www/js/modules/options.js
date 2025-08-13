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
OSApp.Options = OSApp.Options || {};

// FIXME: please, please, please refactor me!
// Device setting management functions
OSApp.Options.showOptions = function( expandItem ) {
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

				// FIXME: please refactor these values to constants
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
					case "is24Hour":
						OSApp.uiState.is24Hour = $item.is( ":checked" );
						OSApp.Storage.set( { "is24Hour": OSApp.uiState.is24Hour } );
						return true;
					case "groupView":
						OSApp.uiState.groupView = $item.is( ":checked" );
						OSApp.Storage.set( { "groupView": OSApp.uiState.groupView } );
						return true;
					case "sortByStationName":
						OSApp.uiState.sortByStationName = $item.is( ":checked" );
						OSApp.Storage.set( { "sortByStationName": OSApp.uiState.sortByStationName } );
						return true;
					case "o12":
						if ( !isPi ) {
							opt.o12 = data & 0xff;
							opt.o13 = ( data >> 8 ) & 0xff;
						}
						return true;
					case "o49":
						opt.o49 = data & 0xff;
						opt.o64 = ( data >> 8 ) & 0xff;
						return true;
					case "o31":
						if ( parseInt( data ) === 3 && !OSApp.Utils.unescapeJSON( $( "#wto" )[ 0 ].value ).baseETo ) {
							OSApp.Errors.showError( OSApp.Language._( "You must specify a baseline ETo adjustment method option to use the ET adjustment method." ) );
							invalid = true;
							return false;
						}

						var restrict = page.find( "#weatherRestriction" );
						if ( restrict.length && !restrict.cali ) {
							data = OSApp.Weather.setRestriction( parseInt( restrict.val() ), data );
						}
						break;
					case "weatherRestriction":
						if ( typeof OSApp.currentSession.controller?.settings?.wto !== "undefined" ){
							if ( OSApp.currentSession.controller.settings.wto && OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.wto ) === data ) {
								return true;
							}
						}
						break;
					case "weatherSelect":
						if ( OSApp.currentSession.controller.settings.wto && OSApp.currentSession.controller.settings.wto.provider && OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.wto.provider ) === data ) {
							return true;
						}
						break;
					case "mda":
						if ( OSApp.currentSession.controller.settings.wto && OSApp.currentSession.controller.settings.wto.mda && OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.wto.mda ) === data ) {
							return true;
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
				OSApp.Sites.updateController( OSApp.Weather.updateWeather );
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

       list += "<div class='center' data-role='controlgroup' data-type='horizontal'>";
               if ( typeof OSApp.currentSession.controller.options.lg !== "undefined" ) {
                       list += "<label for='o36'><input data-mini='true' id='o36' type='checkbox' " + ( ( OSApp.currentSession.controller.options.lg === 1 ) ? "checked='checked'" : "" ) + ">" +
                               OSApp.Language._( "Enable Logging" ) + "</label>";
               }
       list += "</div>";

       list += "</fieldset><fieldset data-role='collapsible'" +
               ( typeof expandItem === "string" && expandItem === "app" ? " data-collapsed='false'" : "" ) + ">" +
               "<legend>" + OSApp.Language._( "App Settings" ) + "</legend>" +
               "<p class='small'>" + OSApp.Language._( "These settings are stored locally with the application and do not affect the controller. Changes are saved automatically." ) + "</p>";

       list += "<div class='center' data-role='controlgroup' data-type='horizontal'>";
               list += "<label for='isMetric'><input data-mini='true' class='noselect' id='isMetric' type='checkbox' " + ( OSApp.currentDevice.isMetric ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Use Metric" ) + "</label>";

               list += "<label for='is24Hour'><input data-mini='true' class='noselect' id='is24Hour' type='checkbox' " + ( OSApp.uiState.is24Hour ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Use 24 Hour Time" ) + "</label>";
       list += "</div>";

       list += "<div data-role='controlgroup' data-type='horizontal' style='text-align:center'>";
               if ( OSApp.Supported.groups() ) {
                       list += "<label for='groupView'><input data-mini='true' class='noselect' id='groupView' type='checkbox' " + ( OSApp.uiState.groupView ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Order Stations by Groups" ) + "</label>";
               }

               list += "<label for='sortByStationName'><input data-mini='true' class='noselect' id='sortByStationName' type='checkbox' " + ( OSApp.uiState.sortByStationName ? "checked='checked'" : "" ) + ">" +
               OSApp.Language._( "Order Stations by Name" ) + "</label>";
       list += "</div>";

       list += "<div data-role='controlgroup' data-type='horizontal' style='text-align:center'>";
               var showDisabled = OSApp.Storage.getItemSync( "showDisabled" ) === "true";
               var showStationNum = OSApp.Storage.getItemSync( "showStationNum" ) === "true";
               list += "<label for='showDisabled'><input data-mini='true' class='noselect' id='showDisabled' type='checkbox' " + ( showDisabled ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Show Disabled" ) + "</label>";

               list += "<label for='showStationNum'><input data-mini='true' class='noselect' id='showStationNum' type='checkbox' " + ( showStationNum ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Show Station Number" ) + "</label>";
       list += "</div>";

	list += "</fieldset><fieldset data-role='collapsible'" +
		( typeof expandItem === "string" && expandItem === "master" ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + OSApp.Language._( "Configure Master" ) + "</legend>";

	if ( typeof OSApp.currentSession.controller.options.mas !== "undefined" ) {
		list += "<div class='ui-field-contain ui-field-no-border'><label for='o18' class='select'>" +
				OSApp.Language._( "Master Station" ) + " " + ( typeof OSApp.currentSession.controller.options.mas2 !== "undefined" ? "1" : "" ) +
			"</label><select data-mini='true' id='o18'><option value='0'>" + OSApp.Language._( "None" ) + "</option>";

		for ( i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++ ) {
			list += "<option " + ( ( OSApp.Stations.isMaster( i ) === 1 ) ? "selected" : "" ) + " value='" + ( i + 1 ) + "'>" +
				OSApp.Stations.getName( i ) + "</option>";

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
			list += "<option " + ( ( OSApp.Stations.isMaster( i ) === 2 ) ? "selected" : "" ) + " value='" + ( i + 1 ) + "'>" + OSApp.Stations.getName(i) +
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

       if ( typeof OSApp.currentSession.controller.options.seq !== "undefined" ) {
               list += "<label for='o16'><input data-mini='true' id='o16' type='checkbox' " +
                               ( ( OSApp.currentSession.controller.options.seq === 1 ) ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Sequential" ) + "</label>";
       }

	list += "</fieldset><fieldset data-role='collapsible'" +
		( typeof expandItem === "string" && expandItem === "weather" ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + OSApp.Language._( "Weather and Sensors" ) + "</legend>";

	if ( typeof OSApp.currentSession.controller.options.uwt !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='o31' class='select'>" + OSApp.Language._( "Adjustment Method" ) +
				"<button data-helptext='" +
					OSApp.Language._( "Weather adjustment retrieves data from the chosen provider and applies the selected method to determine the watering percentage." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><select data-mini='true' id='o31'>";
		for ( i = 0; i < OSApp.Weather.getAdjustmentMethod().length; i++ ) {
			var adjustmentMethod = OSApp.Weather.getAdjustmentMethod()[ i ];

			// Skip unsupported adjustment options.
			if ( adjustmentMethod.minVersion && !OSApp.Firmware.checkOSVersion( adjustmentMethod.minVersion ) ) {
				continue;
			}
			list += "<option " + ( ( adjustmentMethod.id === OSApp.Weather.getCurrentAdjustmentMethodId() ) ? "selected" : "" ) + " value='" + i + "'>" + OSApp.Language._(adjustmentMethod.name) + "</option>";
		}
		list += "</select></div>";

		if ( typeof OSApp.currentSession.controller?.settings?.wto === "object" ) {
			const method = OSApp.Weather.getCurrentAdjustmentMethodId();
			list += "<div class='ui-field-contain" + ( method === 3 || method === 1 ? "" : " hidden" ) + "'><label for='historic'></label>" +
				"<label for='historic'>" +
				"<button data-helptext='" +
					OSApp.Language._( "Use multiple days of historical weather data to calculate ETo or Zimmerman watering percentage for programs that run on a regular interval." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
				"<input data-mini='true' id='mda' type='checkbox' " + ( ( OSApp.currentSession.controller.settings.wto.mda === 100 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Adjust Interval Programs Using Multiple Days of Weather Data" ) +
				"</label></div>";
			list += "<div class='ui-field-contain" + ( method === 0 ? " hidden" : "" ) + "'><label for='wto'>" + OSApp.Language._( "Adjustment Method Options" ) + "</label>" +
				"<button data-mini='true' id='wto' value='" + OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.wto ) + "'>" +
					OSApp.Language._( "Tap to Configure" ) +
				"</button></div>";
		}

		if ( OSApp.Firmware.checkOSVersion( 214 ) ) {
			if ( typeof OSApp.currentSession.controller?.settings?.wto !== "undefined" ) {
				list += "<div class='ui-field-contain'><label for='weatherRestriction' class='select'>" + OSApp.Language._( "Weather Restrictions" ) +
					"<button data-helptext='" + OSApp.Language._( "Prevents watering when the selected restrictions are met." ) +
						"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
					"</label>" +
					"<button data-mini='true' id='weatherRestriction' value='" + ( OSApp.currentSession.controller.settings.wto ? OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.wto ) : "" ) + "'>" +
							OSApp.Language._( "Tap to Configure" ) +
						"</button></div>";
			} else {
				list += "<div class='ui-field-contain'><label for='weatherRestriction' class='select'>" + OSApp.Language._( "Weather Restrictions" ) +
						"<button data-helptext='" + OSApp.Language._( "Prevents watering when the selected restriction is met." ) +
							"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
					"</label>" +
					"<select data-mini='true' class='noselect' id='weatherRestriction'>";

				for ( i = 0; i < 2; i++ ) {
					var restrict = OSApp.Weather.getRestriction( i );
					list += "<option " + ( restrict.isCurrent === true ? "selected" : "" ) + " value='" + i + "'>" + restrict.name + "</option>";
				}
				list += "</select></div>";
			}
		}
	}

		if ( typeof OSApp.currentSession.controller?.settings?.wsp !== "undefined" ) {
			list += "<div class='ui-field-contain'><label for='weatherSelect' class='select'>" + OSApp.Language._( "Weather Data Provider" ) +
					"<button data-helptext='" +
						OSApp.Language._( "Select your preferred weather service provider." ) +
						"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
				"</label><select data-mini='true' id='weatherSelect'>";
			for ( i = 0; i < OSApp.Constants.weather.PROVIDERS.length; i++ ) {
				var weatherProvider = OSApp.Weather.getWeatherProviderById( i );
				list += "<option " + ( ( weatherProvider.id === OSApp.currentSession.controller.settings.wto.provider ) ? "selected" : "" ) + " value='" + weatherProvider.id + "'>" + weatherProvider.name + "</option>";
			}
			list += "</select></div>";
		}

		if ( OSApp.Supported.verifyWeatherAPIKey() ) {
			list += "<div class='ui-field-contain" + ( OSApp.Weather.getCurrentWeatherProvider().needsKey ? "" : " hidden" ) + "'><label for='wtkey'>" + OSApp.Language._( "Weather API Key" ) +
				"<button data-helptext='" +
				OSApp.Language._( "Please enter an API key for your selected weather provider." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label>" +
			"<table>" +
				"<tr style='width:100%;vertical-align: top;'>" +
					"<td style='width:100%'>" +
						"<div class='" +
							( ( OSApp.currentSession.controller.settings.wto.key && OSApp.currentSession.controller.settings.wto.key !== "" ) ? "" : "red " ) +
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

	if ( typeof OSApp.currentSession.controller.options.wl !== "undefined" ) {
		list += "<div class='ui-field-contain duration-field'><label for='o23'>" + OSApp.Language._( "% Watering" ) +
				"<button data-helptext='" +
					OSApp.Language._( "The watering percentage scales station run times by the set value." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><button " + ( ( OSApp.currentSession.controller.options.uwt && OSApp.Weather.getCurrentAdjustmentMethodId() > 0 ) ? "disabled='disabled' " : "" ) +
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
							"<input data-role='none' data-mini='true' type='number' pattern='^[-+]?[0-9]*.?[0-9]*$' id='o41' value='" + ( ( OSApp.currentSession.controller.options.fpr1 * 256 + OSApp.currentSession.controller.options.fpr0 ) / 100 ) + "'>" +
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
		list += "<label id='prgswitch' class='center smaller" + ( OSApp.currentSession.controller.options.urs === 240 ||
			OSApp.currentSession.controller.options.sn1t === 240 || OSApp.currentSession.controller.options.sn2t === 240 ? "" : " hidden" ) + "'>" +
			OSApp.Language._( "When using program switch, a switch is connected to the sensor port to trigger Program 1 every time the switch is pressed for at least 1 second." ) +
		"</label>";
	}

	if ( typeof OSApp.currentSession.controller.options.sn2t !== "undefined" && OSApp.Firmware.checkOSVersion( 219 ) ) {
		list += generateSensorOptions( OSApp.Constants.keyIndex.sn2t, OSApp.currentSession.controller.options.sn2t, 2 );
	}

	if ( typeof OSApp.currentSession.controller.options.sn2o !== "undefined" ) {
		list += "<label for='o53'><input " + ( OSApp.currentSession.controller.options.sn2t === 1 || OSApp.currentSession.controller.options.sn2t === 3 ||
			OSApp.currentSession.controller.options.sn2t === 240 ? "" : "data-wrapper-class='hidden' " ) +
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
		list += "<label id='prgswitch-2' class='center smaller" + ( OSApp.currentSession.controller.options.urs === 240 || OSApp.currentSession.controller.options.sn1t === 240 ||
			OSApp.currentSession.controller.options.sn2t === 240 ? "" : " hidden" ) + "'>" +
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
						"<button data-mini='true' id='otc' class=" + (OSApp.currentSession.controller.settings.otc.en ? "'blue'" : "''") + " value='" + OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.otc ) + "'>" +
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
						"<button data-mini='true' id='mqtt' class=" + (OSApp.currentSession.controller.settings.mqtt.en ? "'blue'" : "''") + " value='" + OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.mqtt ) + "'>" +
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
						"<button data-mini='true' id='email' class=" + (OSApp.currentSession.controller.settings.email.en ? "'blue'" : "''") + " value='" + OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.email ) + "'>" +
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

			let ife2 = OSApp.currentSession.controller.options.ife2;
			let ifev = ( ( typeof ife2 !== "undefined" ) ? ife2 * 256 : 0 ) + OSApp.currentSession.controller.options.ife;
			list += "<div class='ui-field-contain'><label for='o49'>" + OSApp.Language._( "Notification Events" ) +
					"<button data-helptext='" +
						OSApp.Language._( "Select notification events. Applicable to all of MQTT, Email, and IFTTT. <b>NOTE</b>: enabling too many events or notification methods may cause delays, missed responses, or skipped short watering events." ) +
						"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
				"</label><button data-mini='true' id='o49' class=" + (ifev == 0 ?  "''" : "'blue'") + " value='" + ifev + "'>" + OSApp.Language._( "Configure Events" ) + "</button></div>";
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
	} else if ( OSApp.Firmware.checkOSVersion( 215 ) && typeof OSApp.currentSession.controller.options.bst !== "undefined" ) {
		list += "<div class='ui-field-contain duration-field'>" +
			"<label for='o30'>" + OSApp.Language._( "Boost Time" ) +
				"<button data-helptext='" +
					OSApp.Language._( "Boost time changes how long the boost converter is activated with a range from 0 to 1000 milliseconds." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><button data-mini='true' id='o30' value='" + OSApp.currentSession.controller.options.bst + "'>" + OSApp.currentSession.controller.options.bst + "ms</button></div>";
	}

	if ( OSApp.Firmware.checkOSVersion( 222 ) && typeof OSApp.currentSession.controller.options.imin !== "undefined" ) {
		list += "<div class='ui-field-contain duration-field'>" +
			"<label for='imin'>" + OSApp.Language._( "Minimum Current Threshold" ) +
				"<button data-helptext='" +
					OSApp.Language._( "Minimum current threshold is the value that is used to trigger a station low current fault notification with a range from 0 to 1000 milliampere." ) +
					"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			"</label><button data-mini='true' id='imin' value='" + OSApp.currentSession.controller.options.imin + "'>" + OSApp.currentSession.controller.options.imin + "mA</button></div>";
	}

	if ( OSApp.Firmware.checkOSVersion( 220 ) && typeof OSApp.currentSession.controller.options.laton !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='laton'>" + OSApp.Language._( "Latch On Voltage" ) +
			"<button data-helptext='" +
				OSApp.Language._( "Maximum is 24V. Set to 0 for default." ) +
			"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label>" +
			"<input type='range' id='laton' min='0' max='24' step='1' data-highlight='true' value='" + ( OSApp.currentSession.controller.options.laton ) + "'></div>";
	}

	if ( OSApp.Firmware.checkOSVersion( 220 ) && typeof OSApp.currentSession.controller.options.latof !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='latof'>" + OSApp.Language._( "Latch Off Voltage" ) +
			"<button data-helptext='" +
				OSApp.Language._( "Maximum is 24V. Set to 0 for default." ) +
			"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label>" +
			"<input type='range' id='latof' min='0' max='24' step='1' data-highlight='true' value='" + ( OSApp.currentSession.controller.options.latof ) + "'></div>";
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
				" placeholder='" + OSApp.Language._( "Enter GPS Coordinates" ) +
				"' value='" + ( OSApp.currentSession.controller.settings.loc.trim() === "''" ? OSApp.Language._( "Not specified" ) : OSApp.currentSession.controller.settings.loc ) + "' required />" +
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

		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to clear the current location?" ), "", function() {
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

        page.find( "#showStationNum" ).on( "change", function() {
                OSApp.Storage.set( { showStationNum: this.checked } );
                return false;
        } );

        page.find( "#isMetric" ).on( "change", function() {
                OSApp.currentDevice.isMetric = this.checked;
                OSApp.Storage.set( { isMetric: this.checked } );
                OSApp.Language.updateUIElements();
                return false;
        } );

        page.find( "#is24Hour" ).on( "change", function() {
                OSApp.uiState.is24Hour = this.checked;
                OSApp.Storage.set( { is24Hour: this.checked } );
                return false;
        } );

        page.find( "#groupView" ).on( "change", function() {
                OSApp.uiState.groupView = this.checked;
                OSApp.Storage.set( { groupView: this.checked } );
                return false;
        } );

        page.find( "#sortByStationName" ).on( "change", function() {
                OSApp.uiState.sortByStationName = this.checked;
                OSApp.Storage.set( { sortByStationName: this.checked } );
                return false;
        } );

	page.find( "#loc" ).on( "click", function() {
		var loc = $( this );

		loc.prop( "disabled", true );
		OSApp.Options.overlayMap( function( selected, station ) {
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
						OSApp.Weather.validateWULocation( station, function( isValid ) {
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
					OSApp.Options.coordsToLocation( selected[ 0 ], selected[ 1 ], function( result ) {
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
			retainOptions = { pws: options.pws, key: options.key, provider: options.provider, mda: options.mda, cali: options.cali, rainAmt: options.rainAmt, rainDays: options.rainDays, minTemp: options.minTemp },
			method = parseInt( page.find( "#o31" ).val() ),
			finish = function() {
				self.value = OSApp.Utils.escapeJSON( $.extend( {}, OSApp.Utils.unescapeJSON( self.value ), retainOptions ) );
				header.eq( 2 ).prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
			};

		if ( method === 1 ) {
			OSApp.Weather.showZimmermanAdjustmentOptions( this, finish );
		} else if ( method === 2 ) {
			OSApp.Weather.showAutoRainDelayAdjustmentOptions( this, finish );
		} else if ( method === 3 ) {
			OSApp.Weather.showEToAdjustmentOptions( this, finish );
		} else if ( method === 4 ) {
			OSApp.Weather.showMonthlyAdjustmentOptions( this, finish );
		}
	} );

	page.find( "#weatherRestriction" ).on( "click", function() {
		if (typeof OSApp.currentSession.controller?.settings?.wto === "undefined" ){
			return;
		}
		var self = this,
			options = $.extend( {}, {
				cali: false,
				rainDays: 0,
				rainAmt: 0,
				minTemp: -40
			}, OSApp.currentSession.controller.settings.wto,
			OSApp.Utils.unescapeJSON( self.value ) );

		var rainUnit = " in";
		var tempUnit = " \u00B0F";
		if ( OSApp.currentDevice.isMetric ) {
			rainUnit = " mm";
			tempUnit = " \u00B0C";

			options.rainAmt = Math.round( options.rainAmt * 25.4 * 10 ) / 10;
			options.minTemp = Math.round( ( ( options.minTemp - 32 ) * 5 / 9 ) * 10 ) / 10;
		}

		var popup = $( "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
				"<div data-role='header' data-theme='b'>" +
					"<h1>" + OSApp.Language._( "Weather Restriction Options" ) + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
					"<div class='ui-body'>" +
						"<label class='center' style='font-weight: bold;'>" + OSApp.Language._( "Rain Restriction" )+ "</label>" +
						"<label class='center'>" + OSApp.Language._( "Disallow watering if:" ) + "</label>" +
						"<div class='input_with_buttons'>" +
							"<button id='decr1' class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
							"<input id='rainAmt' type='text' value='" + options.rainAmt + rainUnit + "'>" +
							"<button id='incr1' class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
						"</div>" +
						"<label class='center'>" + OSApp.Language._( "of rain is forecasted in the next:" ) + "</label>" +
						"<div class='input_with_buttons'>" +
							"<button id='decr2' class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
							"<input id='rainDays' type='text' value='" + options.rainDays + " days'>" +
							"<button id='incr2' class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
							"<p class='pad-top rain-desc center smaller'>" + OSApp.Language._("Set either to 0 to disable.") +
						"</div><hr>" +
						"<label class='center' style='font-weight: bold;'>" + OSApp.Language._( "Temperature Restriction" )+ "</label>" +
						"<label class='center' style='white-space: pre-wrap;'>" + OSApp.Language._("Disallow watering if the current\ntemperature is below:") + "</label>" +
						"<div class='input_with_buttons'>" +
							"<button id='decr3' class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
							"<input id='minTemp' type='text' value='" + options.minTemp + tempUnit + "'>" +
							"<button id='incr3' class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
							"<p class='pad-top rain-desc center smaller'>" + OSApp.Language._("Set to -40 (either \u00B0F or \u00B0C) to disable.") +
						"</div><hr>" +
						"<label for='cali'>" + OSApp.Language._( "Enable California Restriction" ) + "</label>" +
						"<input class='restriction-input' data-mini='true' data-inconpos='right' id='cali' type='checkbox' " +
						( ( options.cali ) ? "checked='checked'" : "" ) + ">" +
					"</div>" +
					"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
				"</div>" +
			"</div>" );

		OSApp.UIDom.holdButton( popup.find( "#incr1" ), function() {
			const input = popup.find( "#rainAmt" );
			const value = parseFloat( input.val().match( /[0-9.]+/g )[0] ) + 0.1;
			if ( value > 100 ) return;
			input.val( Math.round( value * 100 ) / 100 + rainUnit);
			return false;
		} );
		OSApp.UIDom.holdButton( popup.find( "#decr1" ), function() {
			const input = popup.find( "#rainAmt" );
			const value = parseFloat( input.val().match( /[0-9.]+/g )[0] ) - 0.1;
			if ( value < 0 ) return;
			input.val( Math.round( value * 100 ) / 100 + rainUnit);
			return false;
		} );

		OSApp.UIDom.holdButton( popup.find( "#incr2" ), function() {
			const input = popup.find( "#rainDays" );
			const value = parseInt( input.val().match( /\d+/g )[0] ) + 1;
			if ( value > 10 ) return;
			input.val( value + " days");
			return false;
		} );
		OSApp.UIDom.holdButton( popup.find( "#decr2" ), function() {
			const input = popup.find( "#rainDays" );
			const value = parseInt( input.val().match( /\d+/g )[0] ) - 1;
			if ( value < 0 ) return;
			input.val( value + " days");
			return false;
		} );

		OSApp.UIDom.holdButton( popup.find( "#incr3" ), function() {
			const input = popup.find( "#minTemp" );
			const value = parseInt( input.val().match( /^-?\d+/g )[0] ) + 1;
			if ( value > 100 ) return;
			input.val( value + tempUnit);
			return false;
		} );

		OSApp.UIDom.holdButton( popup.find( "#decr3" ), function() {
			const input = popup.find( "#minTemp" );
			const value = parseInt( input.val().match( /^-?\d+/g )[0] ) - 1;
			if ( value < -100 ) return;
			input.val( value + tempUnit);
			return false;
		} );

		var old;
		popup.find( "input[type='text']" ).on( "focus", function() {
			old = this.value;
			this.value = "";
		} ).on( "blur", function() {
			if ( this.value === "" ) {
				this.value = old;
			}
		} );

		popup.find( ".submit" ).on( "click", function() {
			options.cali = ( popup.find( "#cali" ).prop( "checked" ) ? 1 : 0 );
			options.rainAmt = parseFloat(popup.find( "#rainAmt" ).val().match( /[0-9.]+/g )[0]);
			options.rainDays = parseInt(popup.find( "#rainDays" ).val().match( /\d+/g )[0]);
			options.minTemp = parseInt(popup.find( "#minTemp" ).val().match( /^-?\d+/g )[0])


			// Do metric conversions
			if ( OSApp.currentDevice.isMetric ) {
				options.rainAmt = Math.round( options.rainAmt / 25.4 * 100 ) / 100;
				options.minTemp = Math.round( ( options.minTemp * 9 / 5 + 32 ) * 100 ) / 100;
			}

			// Change wto based on new values
			const wto = OSApp.Utils.unescapeJSON(page.find( "#wto" ).val());
			page.find( "#wto" ).prop( "value", OSApp.Utils.escapeJSON( options ));

			popup.popup( "close" );

			if ( OSApp.Utils.escapeJSON(options) === OSApp.Utils.escapeJSON(wto) ) {
				return;
			} else {
				self.value = OSApp.Utils.escapeJSON( options );
				header.eq( 2 ).prop( "disabled", false );
				page.find( ".submit" ).addClass( "hasChanges" );
			}
		} );

		OSApp.UIDom.openPopup( popup );

	} );

	page.find( ".reset-log" ).on( "click", OSApp.Logs.clearLogs );

	page.find( ".reset-programs" ).on( "click", OSApp.UIDom.clearPrograms );

	page.find( ".reset-options" ).on( "click", function() {
		OSApp.UIDom.resetAllOptions( function() {
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

		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to reset station attributes?" ), OSApp.Language._( "This will reset all station attributes" ), function() {
			$.mobile.loading( "show" );
			OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
				var sites = OSApp.Sites.parseSites( data.sites );

				sites[ data.current_site ].notes = {};
				sites[ data.current_site ].images = {};
				sites[ data.current_site ].lastRunTime = {};

				OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
			} );
			OSApp.Firmware.sendToOS( "/cs?pw=&" + cs ).done( function() {
				OSApp.Errors.showError( OSApp.Language._( "Stations have been updated" ) );
				OSApp.Sites.updateController();
			} );
		} );
	} );

	page.find( ".reset-wireless" ).on( "click", function() {
		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to reset the wireless settings?" ),
			OSApp.Language._( "This will delete the stored SSID/password for your wireless network and return the device to access point mode" ), function() {
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
			button = $( this ),
			provider = page.find( "#weatherSelect" );

		button.prop( "disabled", true );

		OSApp.Weather.testAPIKey( key.val(), provider.val(), function( result ) {
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

	page.find( "#weatherSelect" ).on( "change", function() {
		//remove status from API key entry to prompt re-verify
		page.find( "#wtkey" ).siblings( ".help-icon" ).hide();
		page.find( "#wtkey" ).parent().removeClass( "red green" );
		//make API key input appear if needed
		page.find( "#wtkey" ).parents( ".ui-field-contain" ).toggleClass( "hidden", !(OSApp.Weather.getWeatherProviderById( this.value ).needsKey));
		//change wto value based on new selection
		let curr = OSApp.Utils.unescapeJSON(page.find( "#wto" ).val());
		curr.provider = this.value;
		page.find( "#wtkey" ).prop( "value", "" );
		page.find( "#wtkey" ).parent().addClass( "red" );
		page.find( "#wto" ).prop( "value", OSApp.Utils.escapeJSON(curr));
	} );

	page.find( "#mda" ).on( "click", function() {
		//change wto value based on selected or not
		const curr = OSApp.Utils.unescapeJSON(page.find( "#wto" ).val());
		if ( this.checked ){
			curr.mda = 100;
		} else {
			curr.mda = 0;
		}
		page.find( "#wto" ).prop( "value", OSApp.Utils.escapeJSON(curr));
	} );

	page.find( ".help-icon" ).on( "click", OSApp.UIDom.showHelpText );

	page.find( ".duration-field button:not(.help-icon)" ).on( "click", function() {
		var dur = $( this ),
			id = dur.attr( "id" ),
			name = page.find( "label[for='" + id + "']" ).text(),
			helptext = dur.parent().find( ".help-icon" ).data( "helptext" ),
			max = 240;

		header.eq( 2 ).prop( "disabled", false );
		page.find( ".submit" ).addClass( "hasChanges" );

		if ( id === "ip_addr" || id === "gateway" || id === "dns" || id === "ntp_addr" || id === "subnet" ) {
			OSApp.UIDom.showIPRequest( {
				title: name,
				ip: dur.val().split( "." ),
				callback: function( ip ) {
					dur.val( ip.join( "." ) ).text( ip.join( "." ) );
				}
			} );
		} else if ( id === "o19" || id === "o38" ) {
			OSApp.UIDom.showSingleDurationInput( {
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
			OSApp.UIDom.showSingleDurationInput( {
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
			OSApp.UIDom.showSingleDurationInput( {
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
			OSApp.UIDom.showSingleDurationInput( {
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

			OSApp.UIDom.showSingleDurationInput( {
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
			OSApp.UIDom.showSingleDurationInput( {
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
		} else if ( id === "imin" ) {
			OSApp.UIDom.showSingleDurationInput( {
				data: dur.val(),
				title: name,
				callback: function( result ) {
					dur.val( result ).text( result + "mA" );
				},
				label: OSApp.Language._( "Milliamperes" ),
				maximum: 1000,
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
		page.find( "#mda" ).click().parents( ".ui-field-contain" ).toggleClass("hidden", parseInt( this.value ) === 3 || parseInt( this.value ) === 1 ? false : true );
	} );

	page.find( "#wtkey" ).on( "change input", function() {

		// Hide the invalid key status after change
		page.find( "#wtkey" ).siblings( ".help-icon" ).hide();
		page.find( "#wtkey" ).parent().removeClass( "red green" );
		if( page.find( "#wtkey" ).prop( "value" ) === "" ) page.find( "#wtkey" ).parent().addClass( "red" );
	} );

	page.find( "#o49" ).on( "click", function() {
		var events = {
			program: OSApp.Language._( "Program Start" ),
			sensor1: OSApp.Language._( "Sensor 1 Update" ),
			flow: OSApp.Language._( "Flow Sensor Update" ),
			weather: OSApp.Language._( "Weather Adjustment Update" ),
			reboot: OSApp.Language._( "Controller Reboot" ),
			run: OSApp.Language._( "Station Finish" ),
			sensor2: OSApp.Language._( "Sensor 2 Update" ),
			rain: OSApp.Language._( "Rain Delay Update" ),
			station: OSApp.Language._( "Station Start" ),
			flow_alert: OSApp.Language._( "Flow Alert" ),
		}, button = this, curr = parseInt( button.value ), inputs = "", a = 0, ife = 0;

		let no_ife2 = typeof OSApp.currentSession.controller.options.ife2 === "undefined";
		$.each( events, function( i, val ) {
			inputs += "<label for='notif-" + i + "'><input class='needsclick' data-iconpos='right' id='notif-" + i + "' type='checkbox' " +
				( OSApp.Utils.getBitFromByte( curr, a ) ? "checked='checked'" : "" ) + ( no_ife2 && a >= 8 ? " disabled" : "" ) + ">" + val +
			"</label>"
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

			if ( ife > 0 ) {
				page.find( "#o49" ).addClass( "blue" );
			} else {
				page.find( "#o49" ).removeClass( "blue" );
			}

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

			if ( options.en ) {
				page.find( "#mqtt" ).addClass( "blue" )
			} else {
				page.find( "#mqtt" ).removeClass( "blue" )
			}

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

			if ( options.en ) {
				page.find( "#email" ).addClass( "blue" )
			} else {
				page.find( "#email" ).removeClass( "blue" )
			}

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

			if ( options.en ) {
				page.find( "#otc" ).addClass( "blue" )
			} else {
				page.find( "#otc" ).removeClass("blue")
			}

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
		OSApp.UIDom.showDateTimeInput( input.val(), function( data ) {
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
};

OSApp.Options.coordsToLocation = function( lat, lon, callback, fallback ) {
	callback = callback || function() {};
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
			if ( Object.prototype.hasOwnProperty.call(data,  item ) ) {
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
			if ( Object.prototype.hasOwnProperty.call(data,  item ) && !hasEnd ) {
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
};

OSApp.Options.overlayMap = function( callback ) {
	callback = callback || function() {};

	// Looks up the location and shows a list possible matches for selection
	// Returns the selection to the callback
	$( "#location-list" ).popup( "destroy" ).remove();
	$.mobile.loading( "show" );

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
				//eslint-disable-next-line no-unused-vars
			} catch ( err ) { exit( false ); }
		},
		updateMapStations = function( latitude, longitude ) {
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
			updateMapStations( data.location[ 0 ], data.location[ 1 ] );
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

	updateMapStations( current.lat, current.lon );
};

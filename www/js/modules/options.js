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

OSApp.Options.getNotificationEvents = function( options ) {
	options = options || {};
	var events = [
		{ id: "program", bit: 0, label: OSApp.Language._( "Program Start" ) },
		{ id: "sensor1", bit: 1, label: OSApp.Language._( "Sensor 1 Update" ) },
		{ id: "flow", bit: 2, label: OSApp.Language._( "Flow Sensor Update" ) },
		{ id: "weather", bit: 3, label: OSApp.Language._( "Weather Adjustment Update" ) },
		{ id: "reboot", bit: 4, label: OSApp.Language._( "Controller Reboot" ) },
		{ id: "run", bit: 5, label: OSApp.Language._( "Station Finish" ) },
		{ id: "sensor2", bit: 6, label: OSApp.Language._( "Sensor 2 Update" ) },
		{ id: "rain", bit: 7, label: OSApp.Language._( "Rain Delay Update" ) },
		{ id: "station", bit: 8, label: OSApp.Language._( "Station Start" ) },
		{ id: "flow_alert", bit: 9, label: OSApp.Language._( "Flow Alert" ) },
		{ id: "curr_alert", bit: 10, label: OSApp.Language._( "Under/Overcurrent Fault" ) },
		{ id: "sensor3", bit: 11, label: OSApp.Language._( "Sensor 3 Update" ), option: "sn3t" },
		{ id: "sensor4", bit: 12, label: OSApp.Language._( "Sensor 4 Update" ), option: "sn4t" }
	];

	return events.filter( function( event ) {
		return !event.option || typeof options[ event.option ] !== "undefined";
	} );
};

OSApp.Options.updateNotificationEventValue = function( value, events, getSelection ) {
	events.forEach( function( event ) {
		var selected = getSelection( event );
		if ( typeof selected !== "boolean" ) {
			return;
		}
		if ( selected ) {
			value |= 1 << event.bit;
		} else {
			value &= ~( 1 << event.bit );
		}
	} );
	return value;
};

OSApp.Options.resetStationAttributes = function( attributes ) {
	var operation = $.Deferred();

	$.mobile.loading( "show" );
	OSApp.Storage.get( "current_site", function( data ) {
		var targetSite = data.current_site;

		OSApp.Firmware.sendToOS( "/cs?pw=&" + attributes ).done( function( result ) {
			OSApp.Storage.get( "sites", function( latestData ) {
				var sites = OSApp.Sites.parseSites( latestData.sites );

				if ( sites[ targetSite ] ) {
					sites[ targetSite ].notes = {};
					sites[ targetSite ].images = {};
					sites[ targetSite ].lastRunTime = {};
					OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
				}
				OSApp.Errors.showError( OSApp.Language._( "Stations have been updated" ) );
				OSApp.Sites.updateController();
				operation.resolve( result );
			} );
		} ).fail( function( error ) {
			operation.reject( error );
		} );
	} );

	return operation.promise();
};

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
						opt.o65 = ( data >> 8 ) & 0xff;
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
					case "tpdv":
						var v = parseFloat( data );
						if ( isNaN( v ) ) {
								v = 0;
						}
						opt.tpdv = Math.round( v * 10 );
						return true;
					case "master1":
					case "master2":
					case "master3":
					case "master4": {
						var mconf = OSApp.Utils.unescapeJSON( data ) || { mas: 0, mton: 0, mtof: 0 };
						var maxStation = ( parseInt( page.find( "#o15" ).val() ) + 1 ) * 8;
						if ( parseInt( mconf.mas ) > maxStation ) { mconf.mas = 0; }
						// Master 1/2 use legacy o-IDs so transformKeys converts them
						// to mas/mton/mtof on firmware ≥ 2.1.9; master 3/4 use named
						// keys directly because they are only supported by modern firmware.
						if ( id === "master1" ) {
							opt.o18 = mconf.mas;
							opt.o19 = mconf.mton;
							opt.o20 = mconf.mtof;
						} else if ( id === "master2" ) {
							opt.o37 = mconf.mas;
							opt.o38 = mconf.mton;
							opt.o39 = mconf.mtof;
						} else if ( id === "master3" ) {
							opt.mas3 = mconf.mas;
							opt.mton3 = mconf.mton;
							opt.mtof3 = mconf.mtof;
						} else {
							opt.mas4 = mconf.mas;
							opt.mton4 = mconf.mton;
							opt.mtof4 = mconf.mtof;
						}
						return true;
					}
					case "o2":
					case "o3":
					case "o14":
					case "o16":
					case "o25":
					case "o36":
					case "o48":
						data = $item.is( ":checked" ) ? 1 : 0;
						if ( !OSApp.Firmware.checkOSVersion( 219 ) && !data ) {
							return true;
						}
						break;
					case "sensor1":
					case "sensor2":
					case "sensor3":
					case "sensor4": {
						var sconf = OSApp.Utils.unescapeJSON( data ) || { type: 0, no: 0, on: 0, off: 0 };
						var optsRef = OSApp.currentSession.controller.options;
						var snum = parseInt( id.substring( 6 ) );
						if ( snum === 1 ) {
							// Legacy firmware uses urs/rso; modern uses sn1t/sn1o.
							if ( typeof optsRef.urs !== "undefined" ) {
								opt.o21 = sconf.type;
								if ( typeof optsRef.rso !== "undefined" ) { opt.o22 = sconf.no; }
							} else {
								opt.o50 = sconf.type;
								if ( typeof optsRef.sn1o !== "undefined" ) { opt.o51 = sconf.no; }
							}
							if ( typeof optsRef.sn1on !== "undefined" ) { opt.o54 = sconf.on; }
							if ( typeof optsRef.sn1of !== "undefined" ) { opt.o55 = sconf.off; }
							// Flow pulse rate: only meaningful when type=Flow; pack into o41/o42.
							if ( typeof optsRef.fpr0 !== "undefined" && parseInt( sconf.type ) === 2 ) {
								var fpr = parseFloat( sconf.fpr ) || 0;
								if ( sconf.fprUnit === "gallon" ) { fpr = fpr * 3.78541; }
								opt.o41 = Math.round( fpr * 100 ) & 0xff;
								opt.o42 = ( Math.round( fpr * 100 ) >> 8 ) & 0xff;
							}
						} else if ( snum === 2 ) {
							// Sensor 2 retains legacy o-IDs (52/53/56/57) so transformKeys
							// can convert them on firmware ≥ 2.1.9.
							opt.o52 = sconf.type;
							if ( typeof optsRef.sn2o !== "undefined" ) { opt.o53 = sconf.no; }
							if ( typeof optsRef.sn2on !== "undefined" ) { opt.o56 = sconf.on; }
							if ( typeof optsRef.sn2of !== "undefined" ) { opt.o57 = sconf.off; }
						} else {
							// Sensor 3/4 use named keys directly because they are only
							// supported by modern firmware; transformKeys passes them through.
							opt[ "sn" + snum + "t" ] = sconf.type;
							if ( typeof optsRef[ "sn" + snum + "o" ] !== "undefined" ) {
								opt[ "sn" + snum + "o" ] = sconf.no;
							}
							if ( typeof optsRef[ "sn" + snum + "on" ] !== "undefined" ) {
								opt[ "sn" + snum + "on" ] = sconf.on;
							}
							if ( typeof optsRef[ "sn" + snum + "of" ] !== "undefined" ) {
								opt[ "sn" + snum + "of" ] = sconf.off;
							}
						}
						return true;
					}
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

			opt = OSApp.Utils.transformKeys( opt );

			// Firmware ≥ 2.2.0 accepts partial /co updates (omitted keys keep
			// their existing values), so drop keys whose values match the
			// session state. This shrinks the URL substantially and reduces
			// the firmware-side receive buffer pressure. Only keys present in
			// controller.options are eligible for pruning — anything else
			// (datetime, settings stored as objects, credentials) is sent as-is.
			if ( OSApp.Firmware.checkOSVersion( 220 ) ) {
				var sessionOpts = OSApp.currentSession.controller.options || {};
				var pruned = {};
				Object.keys( opt ).forEach( function( k ) {
					if ( Object.prototype.hasOwnProperty.call( sessionOpts, k ) ) {
						// Loose compare — firmware sends numbers, the form
						// reads strings; coercion handles both safely.
						if ( String( opt[ k ] ) !== String( sessionOpts[ k ] ) ) {
							pruned[ k ] = opt[ k ];
						}
					} else {
						pruned[ k ] = opt[ k ];
					}
				} );
				opt = pruned;
			}

			$.mobile.loading( "show" );

			OSApp.Firmware.sendToOS( "/co?pw=&" + $.param( opt ) ).done( function() {
				$.mobile.document.one( "pageshow", function() {
					OSApp.Errors.showError( OSApp.Language._( "Settings have been saved" ) );
				} );
				OSApp.UIDom.goBack();
				OSApp.Sites.updateController( OSApp.Weather.updateWeather );
			} ).fail( function() {
				$.mobile.loading( "hide" );
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
	// Snap Target PD Voltage slider to 0 or ≥5.0 V
	page.on("input change", "#tpdv", function() {
		let v = parseFloat(this.value);
		if (v > 0 && v < 5) {
			// Decide which side to snap to: closer to 0 or 5
			this.value = (v < 2.5) ? 0 : 5.0;
			$(this).slider("refresh"); // update the UI
		}
	});
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

       list += "<div class='center ui-field-contain' data-type='horizontal'>";
               if ( typeof OSApp.currentSession.controller.options.lg !== "undefined" ) {
                       list += "<label></label>" +
					   "<label for='o36'>" + OSApp.Language._( "Enable Logging" ) + "</label>" +
					   "<input data-mini='true' id='o36' type='checkbox' " + ( ( OSApp.currentSession.controller.options.lg === 1 ) ? "checked='checked'" : "" ) + ">";
               }
       list += "</div>";

       list += "</fieldset><fieldset data-role='collapsible'" +
               ( typeof expandItem === "string" && expandItem === "app" ? " data-collapsed='false'" : "" ) + ">" +
               "<legend>" + OSApp.Language._( "App Settings" ) + "</legend>" +
               "<p class='small'>" + OSApp.Language._( "These settings are stored locally with the application and do not affect the controller. Changes are saved automatically." ) + "</p>";

       var showDisabled = OSApp.Storage.getItemSync( "showDisabled" ) === "true";
       var showStationNum = OSApp.Storage.getItemSync( "showStationNum" ) === "true";

       // All six App Settings toggles in one horizontal controlgroup so they
       // sit on a single row on wide screens and wrap onto extra rows as
       // viewport width shrinks.
       list += "<div class='app-settings-row' data-role='controlgroup' data-type='horizontal' style='text-align:center'>";
               list += "<label for='isMetric'><input data-mini='true' class='noselect' id='isMetric' type='checkbox' " + ( OSApp.currentDevice.isMetric ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Use Metric" ) + "</label>";

               list += "<label for='is24Hour'><input data-mini='true' class='noselect' id='is24Hour' type='checkbox' " + ( OSApp.uiState.is24Hour ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Use 24 Hour Time" ) + "</label>";

               if ( OSApp.Supported.groups() ) {
                       list += "<label for='groupView'><input data-mini='true' class='noselect' id='groupView' type='checkbox' " + ( OSApp.uiState.groupView ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Order Stations by Groups" ) + "</label>";
               }

               list += "<label for='sortByStationName'><input data-mini='true' class='noselect' id='sortByStationName' type='checkbox' " + ( OSApp.uiState.sortByStationName ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Order Stations by Name" ) + "</label>";

               list += "<label for='showDisabled'><input data-mini='true' class='noselect' id='showDisabled' type='checkbox' " + ( showDisabled ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Show Disabled" ) + "</label>";

               list += "<label for='showStationNum'><input data-mini='true' class='noselect' id='showStationNum' type='checkbox' " + ( showStationNum ? "checked='checked'" : "" ) + ">" +
                       OSApp.Language._( "Show Station Number" ) + "</label>";
       list += "</div>";

	list += "</fieldset><fieldset data-role='collapsible'" +
		( typeof expandItem === "string" && expandItem === "master" ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + OSApp.Language._( "Configure Master" ) + "</legend>";

	// Each master gets a single button that opens a popup for its zone + on/off
	// adjustments. Button stores the config as JSON in `value`; the page-level
	// submit handler unpacks it into the firmware's separate option keys. Blue
	// when configured (zone != None).
	var renderMasterButton = function( num, masKey, mtonKey, mtofKey ) {
		var opts = OSApp.currentSession.controller.options;
		if ( typeof opts[ masKey ] === "undefined" ) { return ""; }
		var conf = {
			mas: opts[ masKey ] || 0,
			mton: typeof opts[ mtonKey ] === "number" ? opts[ mtonKey ] : 0,
			mtof: typeof opts[ mtofKey ] === "number" ? opts[ mtofKey ] : 0
		};
		return "<div class='master-config-button'>" +
				"<button data-mini='true' id='master" + num + "' class=" + ( conf.mas > 0 ? "'blue'" : "''" ) +
					" value='" + OSApp.Utils.escapeJSON( conf ) + "'>" +
					OSApp.Language._( "Tap to Configure Master" ) + " " + num +
				"</button>" +
			"</div>";
	};

	list += renderMasterButton( 1, "mas", "mton", "mtof" );
	list += renderMasterButton( 2, "mas2", "mton2", "mtof2" );
	list += renderMasterButton( 3, "mas3", "mton3", "mtof3" );
	list += renderMasterButton( 4, "mas4", "mton4", "mtof4" );

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
		"<legend>" + OSApp.Language._( "Weather Adjustment" ) + "</legend>";

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
			if( OSApp.Firmware.checkOSVersion( 2213) ) {
				list += "<div class='ui-field-contain" + ( method === 3 || method === 1 ? "" : " hidden" ) + "'><label for='historic'></label>" +
					"<label for='historic' id='mdaLabel'>" +
					"<button data-helptext='" +
						OSApp.Language._( "Uses multiple days of historical weather data to calculate ETo or Zimmerman watering percentage for programs that run on a regular interval." ) +
						"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
					"<input data-mini='true' id='mda' type='checkbox' " + ( ( OSApp.currentSession.controller.settings.wto.mda === 100 ) ? "checked='checked'" : "" ) + ">" + OSApp.Language._( "Adjust Interval Programs Using Multiple Days of Weather Data" ) + "</label></div>";
			}
			list += "<div class='ui-field-contain" + ( method === 0  ? " hidden" : "" ) + "'><label for='wto'>" + OSApp.Language._( "Adjustment Method Options" ) + "</label>" +
				"<button data-mini='true' id='wto' value='" + OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.wto ) + "'>" +
					OSApp.Language._( "Tap to Configure" ) +
				"</button></div>";
		}

		if ( OSApp.Firmware.checkOSVersion( 214 ) ) {
			if ( OSApp.Supported.restrictions() ) {
				var wto = OSApp.currentSession.controller.settings.wto;
				list += "<div class='ui-field-contain'><label for='weatherRestriction' class='select'>" + OSApp.Language._( "Weather Restrictions" ) +
					"<button data-helptext='" + OSApp.Language._( "Prevents watering when the selected restrictions are met." ) +
						"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
					"</label>" +
					"<button data-mini='true' id='weatherRestriction' " +
						( ( ( typeof wto.rainDays !== "undefined" && typeof wto.rainAmt !== "undefined" && wto.rainDays > 0 && wto.rainAmt > 0 ) || ( typeof wto.minTemp !== "undefined" && wto.minTemp !== -40 ) || ( typeof wto.cali !== "undefined" && wto.cali ) ) ? "class='blue' " : "" ) +
						"value='" + (OSApp.Utils.escapeJSON( OSApp.currentSession.controller.settings.wto )) + "'>" +
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

	// Each built-in sensor (port 1 / port 2) gets a single button that opens a
	// popup for its type and parameters. Button stores config as JSON in
	// `value`; the page-level submit unpacks it into the firmware option keys
	// (urs/rso for legacy, sn1t/sn1o/sn2t/sn2o for modern, plus the on/off
	// delays and packed flow pulse rate). Blue when configured (type ≠ None).
	var sensorTypeName = function( t ) {
		switch ( parseInt( t ) ) {
			case 1: return OSApp.Language._( "Rain" );
			case 2: return OSApp.Language._( "Flow" );
			case 3: return OSApp.Language._( "Soil" );
			case 240: return OSApp.Language._( "Program Switch" );
			default: return "";
		}
	};

	var renderSensorButton = function( num ) {
		var opts = OSApp.currentSession.controller.options;
		var conf;
		if ( num === 1 ) {
			if ( typeof opts.urs === "undefined" && typeof opts.sn1t === "undefined" ) { return ""; }
			var t1 = ( typeof opts.urs !== "undefined" ) ? opts.urs : opts.sn1t;
			var no1 = ( typeof opts.rso !== "undefined" ) ? opts.rso : ( opts.sn1o || 0 );
			conf = {
				type: t1 || 0,
				no: no1 || 0,
				on: typeof opts.sn1on === "number" ? opts.sn1on : 0,
				off: typeof opts.sn1of === "number" ? opts.sn1of : 0
			};
			if ( typeof opts.fpr0 !== "undefined" ) {
				conf.fpr = ( ( opts.fpr1 * 256 + opts.fpr0 ) / 100 );
				conf.fprUnit = "liter";
			}
		} else {
			// Sensor 2/3/4 share the same shape (sn{N}t / sn{N}o / sn{N}on /
			// sn{N}of); render only when the firmware exposes the type key.
			var tKey = "sn" + num + "t",
				oKey = "sn" + num + "o",
				onKey = "sn" + num + "on",
				ofKey = "sn" + num + "of";
			if ( typeof opts[ tKey ] === "undefined" || !OSApp.Firmware.checkOSVersion( 219 ) ) { return ""; }
			conf = {
				type: opts[ tKey ] || 0,
				no: opts[ oKey ] || 0,
				on: typeof opts[ onKey ] === "number" ? opts[ onKey ] : 0,
				off: typeof opts[ ofKey ] === "number" ? opts[ ofKey ] : 0
			};
		}
		var label = conf.type > 0 ? sensorTypeName( conf.type ) : OSApp.Language._( "Tap to Configure" );
		return "<div class='ui-field-contain'>" +
				"<label for='sensor" + num + "'>" + OSApp.Language._( "Sensor" ) + " " + num + "</label>" +
				"<button data-mini='true' id='sensor" + num + "' class=" + ( conf.type > 0 ? "'blue'" : "''" ) +
					" value='" + OSApp.Utils.escapeJSON( conf ) + "'>" + label + "</button>" +
			"</div>";
	};

	var sensorButtons = renderSensorButton( 1 ) + renderSensorButton( 2 ) +
		renderSensorButton( 3 ) + renderSensorButton( 4 );
	if ( sensorButtons ) {
		list += "</fieldset><fieldset data-role='collapsible'" +
			( typeof expandItem === "string" && expandItem === "sensors" ? " data-collapsed='false'" : "" ) + ">" +
			"<legend>" + OSApp.Language._( "Built-in Sensors" ) + "</legend>" + sensorButtons;
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

	if ( OSApp.Firmware.checkOSVersion( 2214 ) && typeof OSApp.currentSession.controller.options.tpdv !== "undefined" && typeof OSApp.currentSession.controller.settings.apdv !== "undefined" && OSApp.currentSession.controller.settings.apdv > 0) {
		list += "<div class='ui-field-contain'><label for='tpdv'>" + OSApp.Language._( "Target PD Voltage" ) +
			"<button data-helptext='" +
				OSApp.Language._( "The holding current of your solenoid multiplied by its coil resistance (e.g. 0.25A×30Ω=7.5V). Set to 0 to use system default." ) +
			"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
			( typeof OSApp.currentSession.controller.settings.apdv !== "undefined" ?
				"<br><span class='nobr'>(" + OSApp.Language._( "Actual" ) + ": " + ( OSApp.currentSession.controller.settings.apdv / 10 ).toFixed(1) + " V)</span>" :
				"" ) +
			"</label>" +
			"<input type='range' id='tpdv' min='0' max='21' step='0.1' data-highlight='true' value='" + ( OSApp.currentSession.controller.options.tpdv / 10 ) + "'></div>";
		}

	if ( OSApp.Firmware.checkOSVersion( 2213 ) && typeof OSApp.currentSession.controller.options.imin !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='imin'>" + OSApp.Language._( "Undercurrent Threshold" ) +
			"<button data-helptext='" +
				OSApp.Language._( "If the current draw (mA) falls below this threshold when a station finishes running, a low-current fault notification is triggered. The recommended value is 100. Set to 0 to disable this feature." ) +
			"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label>" +
			"<input type='range' id='imin' min='0' max='1000' step='10' data-highlight='true' value='" + ( OSApp.currentSession.controller.options.imin ) + "'></div>";
	}

	if ( OSApp.Firmware.checkOSVersion( 2213 ) && typeof OSApp.currentSession.controller.options.imax !== "undefined" ) {
		list += "<div class='ui-field-contain'><label for='imax'>" + OSApp.Language._( "Overcurrent Limit" ) +
			"<button data-helptext='" +
				OSApp.Language._( "If the current draw (mA) exceeds this threshold when stations are running, an overcurrent fault notification is triggered. Set to 0 to use the system default. Set to maximum (2550) to disable this feature." ) +
			"' class='help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button></label>" +
			"<input type='range' id='imax' min='0' max='2550' step='50' data-highlight='true' value='" + ( OSApp.currentSession.controller.options.imax ) + "'></div>";
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
		if ( !OSApp.Supported.restrictions() ){
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
			options.minTemp = parseInt(popup.find( "#minTemp" ).val().match( /^-?\d+/g )[0]);


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

			// Adjust blue if restrictions are now active
			if (options.cali || (options.rainDays > 0 && options.rainAmt > 0) || options.minTemp !== -40) {
				page.find("#weatherRestriction").addClass("blue");
			} else {
				page.find("#weatherRestriction").removeClass("blue");
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

		if ( typeof OSApp.currentSession.controller.options.mas3 !== "undefined" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "u" + i + "=0&";
			}
		}

		if ( typeof OSApp.currentSession.controller.options.mas4 !== "undefined" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "v" + i + "=0&";
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

		if ( typeof OSApp.currentSession.controller.stations.ignore_sn3 === "object" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "o" + i + "=0&";
			}
		}

		if ( typeof OSApp.currentSession.controller.stations.ignore_sn4 === "object" ) {
			for ( i = 0; i < OSApp.currentSession.controller.settings.nbrd; i++ ) {
				cs += "r" + i + "=0&";
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
			OSApp.Options.resetStationAttributes( cs );
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

	page.find( "#o31" ).on( "change", function() {

		// Switch state of water level input based on weather algorithm status
		page.find( "#o23" ).prop( "disabled", ( parseInt( this.value ) === 0 ? false : true ) );

		// Switch the state of adjustment options based on the selected method
		page.find( "#wto" ).click().parents( ".ui-field-contain" ).toggleClass( "hidden", parseInt( this.value ) === 0 ? true : false );
		page.find( "#mda" ).parents( ".ui-field-contain" ).toggleClass("hidden", parseInt( this.value ) === 3 || parseInt( this.value ) === 1 ? false : true );

		// Ensure checkbox display is correct
		if ( page.find( "#mda" ).is(':checked')) {
			page.find( "#mdaLabel").removeClass("ui-checkbox-off").addClass("ui-checkbox-on");
			page.find( "#mda" ).prop("checked", true);
		} else {
			page.find( "#mdaLabel").removeClass("ui-checkbox-on").addClass("ui-checkbox-off");
			page.find( "#mda" ).prop("checked", false);
		}
	} );

	page.find( "#wtkey" ).on( "change input", function() {

		// Hide the invalid key status after change
		page.find( "#wtkey" ).siblings( ".help-icon" ).hide();
		page.find( "#wtkey" ).parent().removeClass( "red green" );
		if( page.find( "#wtkey" ).prop( "value" ) === "" ) page.find( "#wtkey" ).parent().addClass( "red" );
	} );

	page.find( "#o49" ).on( "click", function() {
		var events = OSApp.Options.getNotificationEvents( OSApp.currentSession.controller.options ),
			button = this,
			curr = parseInt( button.value ),
			inputs = "";

		let no_ife2 = typeof OSApp.currentSession.controller.options.ife2 === "undefined";
		events.forEach( function( event ) {
			inputs += "<label for='notif-" + event.id + "'><input class='needsclick' data-iconpos='right' id='notif-" + event.id + "' type='checkbox' " +
				( OSApp.Utils.getBitFromByte( curr, event.bit ) ? "checked='checked'" : "" ) + ( no_ife2 && event.bit >= 8 ? " disabled" : "" ) + ">" + event.label +
			"</label>";
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
			var ife = OSApp.Options.updateNotificationEventValue( curr, events, function( event ) {
				var input = popup.find( "#notif-" + event.id );
				if ( input.is( ":disabled" ) ) {
					return undefined;
				}
				return input.is( ":checked" );
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

	var showPopupInputError = function() {
		OSApp.Errors.showError( OSApp.Language._( "Please check input and try again." ) );
	};

	// Build station <option> nodes for a master-zone <select>. Station names are
	// controller data, so assign them with .text() rather than treating them as HTML.
	var buildMasterStationOptions = function() {
		var options = $( "<select></select>" ),
			snames = OSApp.currentSession.controller.stations.snames;
		$( "<option></option>" )
			.val( 0 )
			.text( OSApp.Language._( "None" ) )
			.appendTo( options );
		for ( var si = 0; si < snames.length; si++ ) {
			var val = si + 1;
			$( "<option></option>" )
				.val( val )
				.text( OSApp.Stations.getName( si ) )
				.appendTo( options );
			if ( !OSApp.Firmware.checkOSVersion( 214 ) && si === 7 ) { break; }
		}
		return options.children();
	};

	// Build the type options for a sensor popup. Sensor 1 may include Flow,
	// Sensor 2 may not (per firmware spec). Soil and Program Switch are gated
	// by firmware version, matching the legacy radio-button rendering.
	var buildSensorTypeOptions = function( num, current, hasFlowSupport ) {
		var html = "<option value='0'" + ( current === 0 ? " selected" : "" ) + ">" + OSApp.Language._( "None" ) + "</option>" +
			"<option value='1'" + ( current === 1 ? " selected" : "" ) + ">" + OSApp.Language._( "Rain" ) + "</option>";
		if ( num === 1 && hasFlowSupport ) {
			html += "<option value='2'" + ( current === 2 ? " selected" : "" ) + ">" + OSApp.Language._( "Flow" ) + "</option>";
		}
		if ( OSApp.Firmware.checkOSVersion( 219 ) ) {
			html += "<option value='3'" + ( current === 3 ? " selected" : "" ) + ">" + OSApp.Language._( "Soil" ) + "</option>";
		}
		if ( OSApp.Firmware.checkOSVersion( 217 ) ) {
			html += "<option value='240'" + ( current === 240 ? " selected" : "" ) + ">" + OSApp.Language._( "Program Switch" ) + "</option>";
		}
		return html;
	};

	page.find( "#sensor1, #sensor2, #sensor3, #sensor4" ).on( "click", function() {
		var button = this, curr = button.value,
			conf = $.extend( {}, { type: 0, no: 0, on: 0, off: 0, fpr: 0, fprUnit: "liter" }, OSApp.Utils.unescapeJSON( curr ) ),
			num = parseInt( button.id.substring( 6 ) ),
			hasFlow = num === 1 && typeof OSApp.currentSession.controller.options.fpr0 !== "undefined",
			currentType = parseInt( conf.type ) || 0,
			normallyOpen = parseInt( conf.no ) === 1 || currentType === 0;

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var fprRow = "";
		if ( hasFlow ) {
			fprRow = "<div class='ui-field-contain sn-fpr'>" +
					"<label for='sn-fpr'>" + OSApp.Language._( "Flow Pulse Rate" ) + "</label>" +
					"<table style='width:100%'><tr style='vertical-align:top'>" +
						"<td style='width:60%'><input data-mini='true' type='number' min='0' step='any' id='sn-fpr' value='" + ( parseFloat( conf.fpr ) || 0 ) + "'></td>" +
						"<td class='tight-select' style='width:40%'>" +
							"<select id='sn-fpr-unit' data-mini='true'>" +
								"<option value='liter'" + ( conf.fprUnit === "gallon" ? "" : " selected" ) + ">L/pulse</option>" +
								"<option value='gallon'" + ( conf.fprUnit === "gallon" ? " selected" : "" ) + ">Gal/pulse</option>" +
							"</select>" +
						"</td>" +
					"</tr></table>" +
				"</div>";
		}

		// Keep each program-switch hint as a separate string literal so
		// `grunt pushEng` can extract them for translation.
		var prgHint;
		if ( num === 1 ) {
			prgHint = OSApp.Language._( "When using program switch, a switch is connected to the sensor port to trigger Program 1 every time the switch is pressed for at least 1 second." );
		} else if ( num === 2 ) {
			prgHint = OSApp.Language._( "When using program switch, a switch is connected to the sensor port to trigger Program 2 every time the switch is pressed for at least 1 second." );
		} else if ( num === 3 ) {
			prgHint = OSApp.Language._( "When using program switch, a switch is connected to the sensor port to trigger Program 3 every time the switch is pressed for at least 1 second." );
		} else {
			prgHint = OSApp.Language._( "When using program switch, a switch is connected to the sensor port to trigger Program 4 every time the switch is pressed for at least 1 second." );
		}

		var popup = $( "<div data-role='popup' data-theme='a' id='sensorSettings'>" +
				"<div data-role='header' data-theme='b'>" +
					"<h1>" + OSApp.Language._( "Sensor" ) + " " + num + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
					"<div class='ui-field-contain'>" +
						"<label for='sn-type' class='select'>" + OSApp.Language._( "Type" ) + "</label>" +
						"<select data-mini='true' id='sn-type'>" + buildSensorTypeOptions( num, currentType, hasFlow ) + "</select>" +
					"</div>" +
					"<div class='ui-field-contain sn-no'>" +
						"<label class='select sn-option-label'>" + OSApp.Language._( "Option" ) + "</label>" +
						"<label class='sn-no-toggle' for='sn-no'>" +
							"<input data-mini='true' data-iconpos='right' id='sn-no' type='checkbox'" + ( normallyOpen ? " checked='checked'" : "" ) + ">" +
							OSApp.Language._( "Normally Open" ) +
						"</label>" +
					"</div>" +
					"<div class='ui-field-contain sn-on-off'>" +
						"<label for='sn-on'>" + OSApp.Language._( "Delayed On Time" ) + " (" + OSApp.Language._( "minutes" ) + ")</label>" +
						"<input data-mini='true' type='number' id='sn-on' min='0' max='240' step='1' value='" + ( parseInt( conf.on ) || 0 ) + "'>" +
					"</div>" +
					"<div class='ui-field-contain sn-on-off'>" +
						"<label for='sn-off'>" + OSApp.Language._( "Delayed Off Time" ) + " (" + OSApp.Language._( "minutes" ) + ")</label>" +
						"<input data-mini='true' type='number' id='sn-off' min='0' max='240' step='1' value='" + ( parseInt( conf.off ) || 0 ) + "'>" +
					"</div>" +
					fprRow +
					"<p class='sn-prg-hint smaller'>" + prgHint + "</p>" +
					"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
				"</div>" +
			"</div>" );

		var refreshFields = function() {
			var t = parseInt( popup.find( "#sn-type" ).val() ) || 0;
			// Normally Open: rain (1) / soil (3) / program switch (240)
			popup.find( ".sn-no" ).toggle( t === 1 || t === 3 || t === 240 );
			// On/Off delays: rain (1) / soil (3)
			popup.find( ".sn-on-off" ).toggle( t === 1 || t === 3 );
			// Flow pulse rate: flow (2), sensor 1 only
			popup.find( ".sn-fpr" ).toggle( t === 2 );
			// Program switch hint: program switch (240)
			popup.find( ".sn-prg-hint" ).toggle( t === 240 );
		};
		popup.find( "#sn-type" ).on( "change", refreshFields );

		popup.find( ".submit" ).on( "click", function() {
			var onInput = popup.find( "#sn-on" ),
				offInput = popup.find( "#sn-off" ),
				type = parseInt( popup.find( "#sn-type" ).val() ) || 0,
				usesDelays = type === 1 || type === 3,
				fprValue = parseFloat( popup.find( "#sn-fpr" ).val() ),
				fprUnit = popup.find( "#sn-fpr-unit" ).val(),
				fprLiters = fprUnit === "gallon" ? fprValue * 3.78541 : fprValue;
			if ( usesDelays && ( !onInput[ 0 ].checkValidity() || !offInput[ 0 ].checkValidity() ) ) {
				showPopupInputError();
				return;
			}
			if ( type === 2 && ( !Number.isFinite( fprValue ) || fprValue < 0 || fprLiters > 655.35 ) ) {
				showPopupInputError();
				return;
			}

			var newConf = {
				type: type,
				// Preserve this option while hidden for Flow so changing between
				// active sensor types does not silently change the wiring mode.
				no: type !== 0 && popup.find( "#sn-no" ).prop( "checked" ) ? 1 : 0,
				on: usesDelays ? parseInt( onInput.val() ) || 0 : 0,
				off: usesDelays ? parseInt( offInput.val() ) || 0 : 0
			};
			if ( hasFlow ) {
				newConf.fpr = Number.isFinite( fprValue ) ? fprValue : 0;
				newConf.fprUnit = fprUnit;
			}
			if ( newConf.type > 0 ) {
				$( button ).addClass( "blue" ).text( sensorTypeName( newConf.type ) );
			} else {
				$( button ).removeClass( "blue" ).text( OSApp.Language._( "Tap to Configure" ) );
			}
			popup.popup( "close" );
			var encoded = OSApp.Utils.escapeJSON( newConf );
			if ( curr === encoded ) { return; }
			button.value = encoded;
			header.eq( 2 ).prop( "disabled", false );
			page.find( ".submit" ).addClass( "hasChanges" );
		} );

		popup.css( { "box-sizing": "border-box", "width": "calc(100vw - 24px)", "max-width": "360px" } );
		OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
		refreshFields();
	} );

	page.find( "#master1, #master2, #master3, #master4" ).on( "click", function() {
		var button = this, curr = button.value,
			conf = $.extend( {}, { mas: 0, mton: 0, mtof: 0 }, OSApp.Utils.unescapeJSON( curr ) ),
			num = button.id.substring( 6 ),
			is220 = OSApp.Firmware.checkOSVersion( 220 ),
			onMin = is220 ? -600 : 0, onMax = is220 ? 600 : 60,
			offMin = is220 ? -600 : -60, offMax = is220 ? 600 : 0;

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var popup = $( "<div data-role='popup' data-theme='a' id='masterSettings'>" +
				"<div data-role='header' data-theme='b'>" +
					"<h1>" + OSApp.Language._( "Master Station" ) + " " + num + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
					"<div class='ui-field-contain'>" +
						"<label for='mas-zone' class='select'>" + OSApp.Language._( "Zone" ) + "</label>" +
						"<select data-mini='true' id='mas-zone'></select>" +
					"</div>" +
					"<div class='ui-field-contain master-on-off'>" +
						"<label for='mas-on'>" + OSApp.Language._( "On Adj." ) + " (" + OSApp.Language._( "seconds" ) + ")</label>" +
						"<input type='number' id='mas-on' data-mini='true' min='" + onMin + "' max='" + onMax + "' step='5' value='" + ( parseInt( conf.mton ) || 0 ) + "'>" +
					"</div>" +
					"<div class='ui-field-contain master-on-off'>" +
						"<label for='mas-off'>" + OSApp.Language._( "Off Adj." ) + " (" + OSApp.Language._( "seconds" ) + ")</label>" +
						"<input type='number' id='mas-off' data-mini='true' min='" + offMin + "' max='" + offMax + "' step='5' value='" + ( parseInt( conf.mtof ) || 0 ) + "'>" +
					"</div>" +
					"<p class='master-on-off master-step-hint'>" + OSApp.Language._( "On/Off adjustments are in 5-second increments." ) + "</p>" +
					"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
				"</div>" +
			"</div>" );
		var masterZone = popup.find( "#mas-zone" ),
			configuredZone = String( parseInt( conf.mas ) || 0 );
		masterZone.append( buildMasterStationOptions() ).val( configuredZone );
		if ( masterZone.val() === null ) {
			masterZone.val( "0" );
		}

		// Hide on/off adjustments when no zone is selected.
		var toggleAdjustments = function() {
			popup.find( ".master-on-off" ).toggle( parseInt( popup.find( "#mas-zone" ).val() ) !== 0 );
		};
		popup.find( "#mas-zone" ).on( "change", toggleAdjustments );

		// On/off adjustments must be multiples of 5 seconds. Snap typed values
		// on blur/change so the user gets immediate feedback.
		var snapToFive = function( v ) { return Math.round( ( parseInt( v ) || 0 ) / 5 ) * 5; };
		popup.find( "#mas-on, #mas-off" ).on( "change blur", function() {
			$( this ).val( snapToFive( $( this ).val() ) );
		} );

		popup.find( ".submit" ).on( "click", function() {
			var masterZone = parseInt( popup.find( "#mas-zone" ).val() ) || 0,
				onValue = masterZone ? snapToFive( popup.find( "#mas-on" ).val() ) : 0,
				offValue = masterZone ? snapToFive( popup.find( "#mas-off" ).val() ) : 0;
			popup.find( "#mas-on" ).val( onValue );
			popup.find( "#mas-off" ).val( offValue );

			if ( onValue < onMin || onValue > onMax || offValue < offMin || offValue > offMax ) {
				showPopupInputError();
				return;
			}

			var newConf = {
				mas: masterZone,
				mton: onValue,
				mtof: offValue
			};
			if ( newConf.mas > 0 ) {
				$( button ).addClass( "blue" );
			} else {
				$( button ).removeClass( "blue" );
			}
			popup.popup( "close" );
			var encoded = OSApp.Utils.escapeJSON( newConf );
			if ( curr === encoded ) { return; }
			button.value = encoded;
			header.eq( 2 ).prop( "disabled", false );
			page.find( ".submit" ).addClass( "hasChanges" );
		} );

		popup.css( { "box-sizing": "border-box", "width": "calc(100vw - 24px)", "max-width": "380px" } );
		OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
		toggleAdjustments();
	} );

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
								"<input class='mqtt-input' type='text' id='server' data-mini='true' maxlength='64' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'" +
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
				page.find( "#mqtt" ).addClass( "blue" );
			} else {
				page.find( "#mqtt" ).removeClass( "blue" );
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
				page.find( "#email" ).addClass( "blue" );
			} else {
				page.find( "#email" ).removeClass( "blue" );
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
				page.find( "#otc" ).addClass( "blue" );
			} else {
				page.find( "#otc" ).removeClass("blue");
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

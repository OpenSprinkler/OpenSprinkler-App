/* global $, ApexCharts */

/*!
 * Analog Sensor API - GUI for OpenSprinkler App
 * https://github.com/opensprinklershop/
 * (c) 2023 OpenSprinklerShop
 * Released under the MIT License
 */

// Configure module
var OSApp = OSApp || {};

OSApp.Analog = {
	analogSensors: {},
	progAdjusts: {},
	Constants: {
		CHARTS: 11,
		USERDEF_SENSOR: 49,
		USERDEF_UNIT: 99
	}
};

OSApp.Analog.checkAnalogSensorAvail = function() {
	return OSApp.currentSession.controller.options && OSApp.currentSession.controller.options.feature === "ASB";
};

OSApp.Analog.refresh = function() {
	setTimeout( function() {
		location.reload();
	}, 100 );
};

OSApp.Analog.updateProgramAdjustments = function( callback ) {
	callback = callback || function() { };
	return OSApp.Firmware.sendToOS( "/se?pw=", "json" ).then( function( data ) {
		OSApp.Analog.progAdjusts = data.progAdjust;
		callback();
	} );
};

OSApp.Analog.updateAnalogSensor = function( callback ) {
	callback = callback || function() { };
	return OSApp.Firmware.sendToOS( "/sl?pw=", "json" ).then( function( data ) {
		OSApp.Analog.analogSensors = data.sensors;
		callback();
	} );
};

OSApp.Analog.updateSensorShowArea = function( page ) {
	var showArea = page.find( "#os-sensor-show" ),
		html = "";

	if ( OSApp.Analog.checkAnalogSensorAvail() ) {
		var i, j;
		for ( i = 0; i < OSApp.Analog.progAdjusts.length; i++ ) {
			var progAdjust = OSApp.Analog.progAdjusts[ i ];
			var sensorName = "";
			for ( j = 0; j < OSApp.Analog.analogSensors.length; j++ ) {
				if ( OSApp.Analog.analogSensors[ j ].nr === progAdjust.sensor ) {
					sensorName = OSApp.Analog.analogSensors[ j ].name;
				}
			}
			var progName = "?";
			if ( progAdjust.prog >= 1 && progAdjust.prog <= OSApp.currentSession.controller.programs.pd.length ) {
				progName = OSApp.Programs.readProgram( OSApp.currentSession.controller.programs.pd[ progAdjust.prog - 1 ] ).name;
			}

			html += "<div id='progAdjust-show-" + progAdjust.nr + "' class='ui-body ui-body-a center'>";
			html += "<label>" + sensorName + " - " + progName + ": " + Math.round( progAdjust.current * 100 ) + "%</label>";
			html += "</div>";
		}

		for ( i = 0; i < OSApp.Analog.analogSensors.length; i++ ) {
			var sensor = OSApp.Analog.analogSensors[ i ];
			if ( sensor.show ) {
				html += "<div id='sensor-show-" + sensor.nr + "' class='ui-body ui-body-a center'>";
				html += "<label>" + sensor.name + ": " + ( Number( Math.round( sensor.data + "e+2" ) + "e-2" ) ) + sensor.unit + "</label>";
				html += "</div>";
			}
		}
	}

	while ( showArea.firstChild ) {
		showArea.removeChild( showArea.firstChild );
	}
	showArea.html( html );
};

OSApp.Analog.toByteArray = function( b ) {
	var result = [];
	var n = 4;
	while ( n-- ) {
		result.push( Number( b % 0x100 ) );
		b /= 0x100;
	}
	return Uint8Array.from( result );
};

OSApp.Analog.intFromBytes = function( x ) {
	try {
		var val = 0;
		for ( var i = x.length - 1; i >= 0; i-- ) {
			val *= 0x100;
			val += parseInt( x[ i ] );
		}
		return val;
		//eslint-disable-next-line no-unused-vars
	} catch ( e ) {
		return 0;
	}
};

//Program adjustments editor
OSApp.Analog.showAdjustmentsEditor = function( progAdjust, callback ) {

	return OSApp.Firmware.sendToOS( "/sh?pw=", "json" ).then( function( data ) {
		var supportedAdjustmentTypes = data.progTypes;
		var i;

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var list = "<div data-role='popup' data-theme='a' id='progAdjustEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<h1>" + ( progAdjust.nr > 0 ? OSApp.Language._( "Edit Program Adjustment" ) : OSApp.Language._( "New Program Adjustment" ) ) + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			OSApp.Language._( "Notice: If you want to combine multiple sensors, then build a sensor group. " ) +
			OSApp.Language._( "See help documentation for details." ) +
			"</p>" +

			"<div class='ui-field-contain'>" +

			//Adjustment-Nr:
			"<label>" +
			OSApp.Language._( "Adjustment-Nr" ) +
			"</label>" +
			"<input class='nr' type='number' min='1' max='99999' value='" + progAdjust.nr + ( progAdjust.nr > 0 ? "' disabled='disabled'>" : "'>" ) +

			//Select Type:
			"<div class='ui-field-contain'><label for='type' class='select'>" +
			OSApp.Language._( "Type" ) +
			"</label><select data-mini='true' id='type'>";

		for ( i = 0; i < supportedAdjustmentTypes.length; i++ ) {
			list += "<option " + ( ( progAdjust.type === supportedAdjustmentTypes[ i ].type ) ? "selected" : "" ) +
				" value='" + supportedAdjustmentTypes[ i ].type + "'>" +
				supportedAdjustmentTypes[ i ].name + "</option>";
		}
		list += "</select></div>" +

			//Select Sensor:
			"<div class='ui-field-contain'><label for='sensor' class='select'>" +
			OSApp.Language._( "Sensor" ) +
			"</label><select data-mini='true' id='sensor'>";

		for ( i = 0; i < OSApp.Analog.analogSensors.length; i++ ) {
			list += "<option " + ( ( progAdjust.sensor === OSApp.Analog.analogSensors[ i ].nr ) ? "selected" : "" ) +
				" value='" + OSApp.Analog.analogSensors[ i ].nr + "'>" +
				OSApp.Analog.analogSensors[ i ].nr + " - " + OSApp.Analog.analogSensors[ i ].name + "</option>";
		}
		list += "</select></div>" +

			//Select Program:
			"<div class='ui-field-contain'><label for='prog' class='select'>" +
			OSApp.Language._( "Program to adjust" ) +
			"</label><select data-mini='true' id='prog'>";

		for ( i = 0; i < OSApp.currentSession.controller.programs.pd.length; i++ ) {
			var progName = OSApp.Programs.readProgram( OSApp.currentSession.controller.programs.pd[ i ] ).name;
			var progNr = i + 1;

			list += "<option " + ( ( progAdjust.prog === progNr ) ? "selected" : "" ) +
				" value='" + progNr + "'>" +
				progName + "</option>";
		}
		list += "</select></div>" +

			"<label>" +
			OSApp.Language._( "Factor 1 (adjustment for min)" ) +
			"</label>" +
			"<input class='factor1' type='number' value='" + progAdjust.factor1 + "'>" +

			"<label>" +
			OSApp.Language._( "Factor 2 (adjustment for max)" ) +
			"</label>" +
			"<input class='factor2' type='number' value='" + progAdjust.factor2 + "'>" +

			"<label>" +
			OSApp.Language._( "Min sensor value" ) +
			"</label>" +
			"<input class='min' type='number' value='" + progAdjust.min + "'>" +

			"<label>" +
			OSApp.Language._( "Max sensor value" ) +
			"</label>" +
			"<input class='max' type='number' value='" + progAdjust.max + "'>" +

			"</div>" +
			"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
			"</div>";

		var popup = $( list ),

			changeValue = function( pos, dir ) {
				var input = popup.find( ".inputs input" ).eq( pos ),
					val = parseInt( input.val() );

				if ( ( dir === -1 && val === 0 ) || ( dir === 1 && val === 100 ) ) {
					return;
				}

				input.val( val + dir );
			};

		popup.find( ".submit" ).on( "click", function() {

			var progAdjust = {
				nr: parseInt( popup.find( ".nr" ).val() ),
				type: parseInt( popup.find( "#type" ).val() ),
				sensor: parseInt( popup.find( "#sensor" ).val() ),
				prog: parseInt( popup.find( "#prog" ).val() ),
				factor1: parseFloat( popup.find( ".factor1" ).val() ),
				factor2: parseFloat( popup.find( ".factor2" ).val() ),
				min: parseFloat( popup.find( ".min" ).val() ),
				max: parseFloat( popup.find( ".max" ).val() )
			};
			callback( progAdjust );

			popup.popup( "close" );
			return false;
		} );

		popup.on( "focus", "input[type='number']", function() {
			this.select();
		} ).on( "blur", "input[type='number']", function() {

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

		$( "#progAdjustEditor" ).remove();

		popup.css( "max-width", "580px" );

		OSApp.UIDom.openPopup( popup, { positionTo: "window" } );

	} );
};

OSApp.Analog.isSmt100 = function( sensorType ) {
	if ( !sensorType ) {
		return false;
	}
	return sensorType === 1 || sensorType === 2;
};

// Analog sensor editor
OSApp.Analog.showSensorEditor = function( sensor, callback ) {

	OSApp.Firmware.sendToOS( "/sf?pw=", "json" ).then( function( data ) {
		var supportedSensorTypes = data.sensorTypes;
		var i;

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var list = "<div data-role='popup' data-theme='a' id='sensorEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<h1>" + ( sensor.nr > 0 ? OSApp.Language._( "Edit Sensor" ) : OSApp.Language._( "New Sensor" ) ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			OSApp.Language._( "Edit Sensor Configuration. " ) +
			OSApp.Language._( "See help documentation for details." ) +
			"</p>" +
			"<div class='ui-field-contain'>" +
			"<label>" +
			OSApp.Language._( "Sensor-Nr" ) +
			"</label>" +
			"<input class='nr' type='number' min='1' max='99999' value='" + sensor.nr + ( sensor.nr > 0 ? "' disabled='disabled'>" : "'>" ) +

			"<div class='ui-field-contain'><label for='type' class='select'>" +
			OSApp.Language._( "Type" ) +
			"</label><select data-mini='true' id='type'>";

		for ( i = 0; i < supportedSensorTypes.length; i++ ) {
			list += "<option " + ( ( sensor.type === supportedSensorTypes[ i ].type ) ? "selected" : "" ) +
				" value='" + supportedSensorTypes[ i ].type + "'>" +
				supportedSensorTypes[ i ].name + "</option>";
		}
		list += "</select></div>";

		list += "<button data-mini='true' class='center-div' id='smt100id' style='display:" + ( OSApp.Analog.isSmt100( sensor.type ) ? "block" : "none" ) + "'>" + OSApp.Language._( "Set SMT100 Modbus ID" ) + "</button>";

		list += "<label>" +
			OSApp.Language._( "Group" ) +
			"</label>" +
			"<input class='group' type='number'  min='0' max='99999' value='" + sensor.group + "'>" +

			"<label>" +
			OSApp.Language._( "Name" ) +
			"</label>" +
			"<input class='name' type='text'  value='" + sensor.name + "'>" +

			"<label>" +
			OSApp.Language._( "IP Address" ) +
			"</label>" +
			"<input class='ip' type='text'  value='" + ( sensor.ip ? OSApp.Analog.toByteArray( sensor.ip ).join( "." ) : "" ) + "'>" +

			"<label>" +
			OSApp.Language._( "Port" ) +
			"</label>" +
			"<input class='port' type='number' min='0' max='65535' value='" + sensor.port + "'>" +

			"<label>" +
			OSApp.Language._( "ID" ) +
			"</label>" +
			"<input class='id' type='number' min='0' max='65535' value='" + sensor.id + "'>" +

					( ( sensor.type === OSApp.Analog.Constants.USERDEF_SENSOR ) ?
						( "<label>" +
							OSApp.Language._( "Factor" ) +
						"</label>" +
						"<input class='fac' type='number' min='-32768' max='32767' value='" + sensor.fac + "'>" +

						"<label>" +
							OSApp.Language._( "Divider" ) +
						"</label>" +
						"<input class='div' type='number' min='-32768' max='32767' value='" + sensor.div + "'>" +

						"<label>" +
							OSApp.Language._( "Unit" ) +
						"</label>" +
						"<input class='unit' type='text'  value='" + sensor.unit + "'>"
						) : "" ) +

			"<label>" +
			OSApp.Language._( "Read Interval (s)" ) +
			"</label>" +
			"<input class='ri' type='number' min='1' max='999999' value='" + sensor.ri + "'>" +

			"<label for='enable'><input data-mini='true' id='enable' type='checkbox' " + ( ( sensor.enable === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Sensor Enabled" ) +
			"</label>" +

			"<label for='log'><input data-mini='true' id='log' type='checkbox' " + ( ( sensor.log === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Enable Data Logging" ) +
			"</label>" +

			"<label for='show'><input data-mini='true' id='show' type='checkbox' " + ( ( sensor.show === 1 ) ? "checked='checked'" : "" ) + ">" +
			OSApp.Language._( "Show on Mainpage" ) +
			"</label>" +

			"</div>" +

			"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>";

		var popup = $( list ),

			changeValue = function( pos, dir ) {
				var input = popup.find( ".inputs input" ).eq( pos ),
					val = parseInt( input.val() );

				if ( ( dir === -1 && val === 0 ) || ( dir === 1 && val === 100 ) ) {
					return;
				}

				input.val( val + dir );
			};

		//SMT 100 Toolbox function: SET ID
		popup.find( "#smt100id" ).on( "click", function() {
			var nr = parseInt( popup.find( ".nr" ).val() ),
				newid = parseInt( popup.find( ".id" ).val() );
			popup.popup( "close" );
			OSApp.UIDom.areYouSure( OSApp.Language._( "This function sets the Modbus ID for one SMT100 sensor. Disconnect all other sensors on this Modbus port. Please confirm." ),
				"new id=" + newid, function() {
					OSApp.Firmware.sendToOS( "/sa?pw=&nr=" + nr + "&id=" + newid ).done( function() {
						window.alert( OSApp.Language._( "SMT100 id assigned!" ) );
						OSApp.Analog.updateAnalogSensor( OSApp.Analog.refresh );
					} );
				} );
		} );
		popup.find( "#type" ).change( function() {
			var type = parseInt( popup.find( "#type" ).val() );
			document.getElementById( "smt100id" ).style.display = OSApp.Analog.isSmt100( type ) ? "block" : "none";
		} );

		popup.find( ".submit" ).on( "click", function() {

			if ( !sensor.nr ) { //New Sensor - check existing Nr to avoid overwriting
				var nr = parseInt( popup.find( ".nr" ).val() );
				for ( var i = 0; i < OSApp.Analog.analogSensors.length; i++ ) {
					if ( OSApp.Analog.analogSensors[ i ].nr === nr ) {
						window.alert( OSApp.Language._( "Sensor number exists!" ) );
						return;
					}
				}
			}
			var sensorOut = {
				nr: parseInt( popup.find( ".nr" ).val() ),
				type: parseInt( popup.find( "#type" ).val() ),
				group: parseInt( popup.find( ".group" ).val() ),
				name: popup.find( ".name" ).val(),
				ip: OSApp.Analog.intFromBytes( popup.find( ".ip" ).val().split( "." ) ),
				port: parseInt( popup.find( ".port" ).val() ),
				id: parseInt( popup.find( ".id" ).val() ),
				ri: parseInt( popup.find( ".ri" ).val() ),
				fac: parseInt( popup.find( ".fac" ).val() ),
				div: parseInt( popup.find( ".div" ).val() ),
				unit: popup.find( ".unit" ).val(),
				enable: popup.find( "#enable" ).is( ":checked" ) ? 1 : 0,
				log: popup.find( "#log" ).is( ":checked" ) ? 1 : 0,
				show: popup.find( "#show" ).is( ":checked" ) ? 1 : 0
			};

			callback( sensorOut );

			popup.popup( "close" );
			return false;
		} );

		popup.on( "focus", "input[type='number']", function() {
			this.select();
		} ).on( "blur", "input[type='number']", function() {

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

		$( "#sensorEditor" ).remove();

		popup.css( "max-width", "580px" );

		OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
	} );
};

// Config Page
OSApp.Analog.showAnalogSensorConfig = ( function() {
	var page = $( "<div data-role='page' id='analogsensorconfig'>" +
		"<div class='ui-content' role='main' id='analogsensorlist'>" +
		"</div></div>" );

	page
		.on( "sensorrefresh", updateSensorContent )
		.on( "pagehide", function() {
			page.detach();
		} );

	function updateSensorContent() {
		var list = $( OSApp.Analog.buildSensorConfig() );

		//Delete a sensor:
		list.find( "#delete-sensor" ).on( "click", function() {
			var dur = $( this ),
				value = dur.attr( "value" ),
				row = dur.attr( "row" );

			OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete the sensor?" ), value, function() {
				OSApp.Firmware.sendToOS( "/sc?pw=&nr=" + value + "&type=0" ).done( function() {
					OSApp.Analog.analogSensors.splice( row, 1 );
					updateSensorContent();
				} );
			} );
		} );

		//Edit a sensor:
		list.find( "#edit-sensor" ).on( "click", function() {
			var dur = $( this ),
				row = dur.attr( "row" );

			var sensor = OSApp.Analog.analogSensors[ row ];

			OSApp.Analog.showSensorEditor( sensor, function( sensorOut ) {
				sensorOut.nativedata = sensor.nativedata;
				sensorOut.data = sensor.data;
				sensorOut.last = sensor.last;
				OSApp.Firmware.sendToOS( "/sc?pw=&nr=" + sensorOut.nr +
					"&type=" + sensorOut.type +
					"&group=" + sensorOut.group +
					"&name=" + sensorOut.name +
					"&ip=" + sensorOut.ip +
					"&port=" + sensorOut.port +
					"&id=" + sensorOut.id +
					"&ri=" + sensorOut.ri +
					( ( sensorOut.type === OSApp.Analog.Constants.USERDEF_SENSOR ) ?
						( "&fac=" + sensorOut.fac +
						"&div=" + sensorOut.div +
						"&unit=" + sensorOut.unit
						) : "" ) +
					"&enable=" + sensorOut.enable +
					"&log=" + sensorOut.log +
					"&show=" + sensorOut.show
				).done( function() {
					OSApp.Analog.analogSensors[ row ] = sensorOut;
					updateSensorContent();
				} );
			} );
		} );

		// Add a new analog sensor:
		list.find( "#add-sensor" ).on( "click", function() {
			var sensor = {
				name: "new sensor",
				type: 1,
				ri: 600,
				enable: 1,
				log: 1
			};

			OSApp.Analog.showSensorEditor( sensor, function( sensorOut ) {
				OSApp.Firmware.sendToOS( "/sc?pw=&nr=" + sensorOut.nr +
					"&type=" + sensorOut.type +
					"&group=" + sensorOut.group +
					"&name=" + sensorOut.name +
					"&ip=" + sensorOut.ip +
					"&port=" + sensorOut.port +
					"&id=" + sensorOut.id +
					"&ri=" + sensorOut.ri +
				( ( sensorOut.type === OSApp.Analog.Constants.USERDEF_SENSOR ) ?
					( "&fac=" + sensorOut.fac +
					"&div=" + sensorOut.div +
					"&unit=" + sensorOut.unit
				) : "" ) +
					"&enable=" + sensorOut.enable +
					"&log=" + sensorOut.log +
					"&show=" + sensorOut.show
				).done( function() {
					OSApp.Analog.analogSensors.push( sensorOut );
					updateSensorContent();
				} );
			} );
		} );

		// Refresh sensor data:
		list.find( "#refresh-sensor" ).on( "click", function() {
			OSApp.Analog.updateProgramAdjustments( function() {
				OSApp.Analog.updateAnalogSensor( function() {
					updateSensorContent();
				} );
			} );
		} );

		//Delete a program adjust:
		list.find( "#delete-progadjust" ).on( "click", function() {
			var dur = $( this ),
				value = dur.attr( "value" ),
				row = dur.attr( "row" );

			OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete this program adjustment?" ), value, function() {
				OSApp.Firmware.sendToOS( "/sb?pw=&nr=" + value + "&type=0" ).done( function() {
					OSApp.Analog.progAdjusts.splice( row, 1 );
					updateSensorContent();
				} );
			} );
		} );

		//Edit a program adjust:
		list.find( "#edit-progadjust" ).on( "click", function() {
			var dur = $( this ),
				row = dur.attr( "row" );

			var progAdjust = OSApp.Analog.progAdjusts[ row ];

			OSApp.Analog.showAdjustmentsEditor( progAdjust, function( progAdjustOut ) {

				OSApp.Firmware.sendToOS( "/sb?pw=&nr=" + progAdjustOut.nr +
					"&type=" + progAdjustOut.type +
					"&sensor=" + progAdjustOut.sensor +
					"&prog=" + progAdjustOut.prog +
					"&factor1=" + progAdjustOut.factor1 +
					"&factor2=" + progAdjustOut.factor2 +
					"&min=" + progAdjustOut.min +
					"&max=" + progAdjustOut.max
				).done( function() {
					OSApp.Analog.progAdjusts[ row ] = progAdjustOut;
					updateSensorContent();
				} );
			} );
		} );

		//Add a new program adjust:
		list.find( "#add-progadjust" ).on( "click", function() {
			var progAdjust = {
				type: 1
			};

			OSApp.Analog.showAdjustmentsEditor( progAdjust, function( progAdjustOut ) {
				OSApp.Firmware.sendToOS( "/sb?pw=&nr=" + progAdjustOut.nr +
					"&type=" + progAdjustOut.type +
					"&sensor=" + progAdjustOut.sensor +
					"&prog=" + progAdjustOut.prog +
					"&factor1=" + progAdjustOut.factor1 +
					"&factor2=" + progAdjustOut.factor2 +
					"&min=" + progAdjustOut.min +
					"&max=" + progAdjustOut.max
				).done( function() {
					OSApp.Analog.progAdjusts.push( progAdjustOut );
					updateSensorContent();
				} );
			} );
		} );

		// Clear sensor log
		list.find( "#clear-log" ).on( "click", function() {
			OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to clear the sensor log?" ), "", function() {
				OSApp.Firmware.sendToOS( "/sn?pw=&" ).done( function( result ) {
					window.alert( OSApp.Language._( "Log cleared:" ) + " " + result.deleted + " " + OSApp.Language._( "records" ) );
					updateSensorContent();
				} );
			} );
		} );

		list.find( "#download-log" ).on( "click", function() {
			var link = document.createElement( "a" );
			link.style.display = "none";
			link.setAttribute( "download", "sensorlog-" + new Date().toLocaleDateString().replace( /\//g, "-" ) + ".csv" );

			var dest = "/so?pw=&csv=1";
			dest = dest.replace( "pw=", "pw=" + encodeURIComponent( OSApp.currentSession.pass ) );
			link.target = "_blank";
			link.href = OSApp.currentSession.token ? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + dest : OSApp.currentSession.prefix + OSApp.currentSession.ip + dest;
			document.body.appendChild( link ); // Required for FF
			link.click();
		} );

		list.find( "#show-log" ).on( "click", function() {
			OSApp.UIDom.changePage( "#analogsensorchart" );
			return false;
		} );

		page.find( "#analogsensorlist" ).html( list.enhanceWithin() );
	}

	function begin() {
		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Analog Sensor Config" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			}
		} );

		updateSensorContent();

		$( "#analogsensorconfig" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin;
} )();

OSApp.Analog.buildSensorConfig = function() {
	var list = "<table id='analog_sensor_table'><tr style='width:100%;vertical-align: top;'>" +
		"<tr><th>Nr</th><th class=\"hidecol\">Type</th><th class=\"hidecol\">Group</th><th>Name</th>" +
		"<th class=\"hidecol\">IP</th><th class=\"hidecol\">Port</th><th class=\"hidecol\">ID</th>" +
		"<th class=\"hidecol\">Read<br>Interval</th><th>Data</th><th>En</th>" +
		"<th class=\"hidecol\">Log</th><th class=\"hidecol\">Show</th><th class=\"hidecol2\">Last</th></tr>";

	var checkpng = "<img src=\"" + OSApp.UIDom.getAppURLPath() + "img/check-black.png\">";

	var row = 0;
	$.each( OSApp.Analog.analogSensors, function( i, item ) {

		var $tr = $( "<tr>" ).append(
			$( "<td>" ).text( item.nr ),
			$( "<td class=\"hidecol\">" ).text( item.type ),
			$( "<td class=\"hidecol\">" ).text( item.group ? item.group : "" ),
			$( "<td>" ).text( item.name ),
			$( "<td class=\"hidecol\">" ).text( item.ip ? OSApp.Analog.toByteArray( item.ip ).join( "." ) : "" ),
			$( "<td class=\"hidecol\">" ).text( item.port ? item.port : "" ),
			$( "<td class=\"hidecol\">" ).text( item.type < 1000 ? item.id : "" ),
			$( "<td class=\"hidecol\">" ).text( item.ri ),
			$( "<td>" ).text( Math.round( item.data ) + item.unit ),
			"<td>" + ( item.enable ? checkpng : "" ) + "</td>",
			"<td class=\"hidecol\">" + ( item.log ? checkpng : "" ) + "</td>",
			"<td class=\"hidecol\">" + ( item.show ? checkpng : "" ) + "</td>",
			$( "<td class=\"hidecol2\">" ).text( ( item.data_ok === undefined || item.data_ok ) ? OSApp.Dates.dateToString( new Date( item.last * 1000 ) ) : "Error", null, 2 ),
			"<td><button data-mini='true' class='center-div' id='edit-sensor' value='" + item.nr + "' row='" + row + "'>" + OSApp.Language._( "Edit" ) + "</button></td>",
			"<td><button data-mini='true' class='center-div' id='delete-sensor' value='" + item.nr + "' row='" + row + "'>" + OSApp.Language._( "Delete" ) + "</button></td>"
		);
		list += $tr.wrap( "<p>" ).html() + "</tr>";
		row++;
	} );
	list += "</table>";
	list += "<p><button data-mini='true' class='center-div' id='add-sensor' value='1'>" + OSApp.Language._( "Add Sensor" ) + "</button></p>";
	list += "<p><button data-mini='true' class='center-div' id='refresh-sensor' value='2'>" + OSApp.Language._( "Refresh Sensor data" ) + "</button></p>";

	//Program adjustments table:
	list += "<table id='progadjusttable'><tr style='width:100%;vertical-align: top;'>" +
		"<tr><th>Nr</th>" +
		"<th class=\"hidecol\">Type</th>" +
		"<th>S.Nr</th>" +
		"<th>Name</th>" +
		"<th class=\"hidecol\">Program-Nr</th>" +
		"<th>Program</th>" +
		"<th class=\"hidecol2\">Factor 1</th>" +
		"<th class=\"hidecol2\">Factor 2</th>" +
		"<th class=\"hidecol2\">Min Value</th>" +
		"<th class=\"hidecol2\">Max Value</th>" +
		"<th>Current</th></tr>";

	row = 0;
	$.each( OSApp.Analog.progAdjusts, function( i, item ) {

		var sensorName = "";
		for ( var j = 0; j < OSApp.Analog.analogSensors.length; j++ ) {
			if ( OSApp.Analog.analogSensors[ j ].nr === item.sensor ) {
				sensorName = OSApp.Analog.analogSensors[ j ].name;
			}
		}
		var progName = "?";
		if ( item.prog >= 1 && item.prog <= OSApp.currentSession.controller.programs.pd.length ) {
			progName = OSApp.Programs.readProgram( OSApp.currentSession.controller.programs.pd[ item.prog - 1 ] ).name;
		}

		var $tr = $( "<tr>" ).append(
			$( "<td>" ).text( item.nr ),
			$( "<td class=\"hidecol\">" ).text( item.type ),
			$( "<td>" ).text( item.sensor ),
			$( "<td>" ).text( sensorName ),
			$( "<td class=\"hidecol\">" ).text( item.prog ),
			$( "<td>" ).text( progName ),
			$( "<td class=\"hidecol2\">" ).text( item.factor1 ),
			$( "<td class=\"hidecol2\">" ).text( item.factor2 ),
			$( "<td class=\"hidecol2\">" ).text( item.min ),
			$( "<td class=\"hidecol2\">" ).text( item.max ),
			$( "<td>" ).text( Math.round( item.current * 100.0 ) + "%" ),
			"<td><button data-mini='true' class='center-div' id='edit-progadjust' value='" + item.nr + "' row='" + row + "'>" + OSApp.Language._( "Edit" ) + "</button></td>",
			"<td><button data-mini='true' class='center-div' id='delete-progadjust' value='" + item.nr + "' row='" + row + "'>" + OSApp.Language._( "Delete" ) + "</button></td>"
		);
		list += $tr.wrap( "<p>" ).html() + "</tr>";
		row++;
	} );
	list += "</table>";
	list += "<p><button data-mini='true' class='center-div' id='add-progadjust' value='3'>" + OSApp.Language._( "Add program adjustment" ) + "</button></p>";

	//Analog sensor logs:
	list += "<table id='logfunctions'><tr style='width:100%;vertical-align: top;'><tr>" +
		"<th><button data-mini='true' class='center-div' id='clear-log'>" + OSApp.Language._( "Clear Log" ) + "</button></th>" +
		"<th><button data-mini='true' class='center-div' id='download-log'>" + OSApp.Language._( "Download Log" ) + "</button></th>" +
		"<th><a href='#analogsensorchart'><button data-mini='true' class='center-div' id='show-log'>" + OSApp.Language._( "Show Log" ) + "</button></a></th>" +
		"</tr></table>";
	return list;
};

// Show Sensor Charts with apexcharts
OSApp.Analog.showAnalogSensorCharts = ( function() {

	var max = OSApp.Analog.Constants.CHARTS;
	for ( var j = 0; j < OSApp.Analog.analogSensors.length; j++ ) {
		if ( !OSApp.Analog.analogSensors[ j ].log ) {
			continue;
		}
		var unitid = OSApp.Analog.analogSensors[ j ].unitid;
		if ( unitid === OSApp.Analog.Constants.USERDEF_UNIT ) {
			max++;
		}
	}

	var last = "", week = "", month = "";
	for ( j = 1; j <= max; j++ ) {
		last  += "<div id='myChart" + j + "'></div>";
		week  += "<div id='myChartW" + j + "'></div>";
		month += "<div id='myChartM" + j + "'></div>";
	}

	var page = $( "<div data-role='page' id='analogsensorchart'>" +
		"<div class='ui-content' role='main' style='width: 95%'>" +
		last + week + month +
		"</div></div>" );

	function begin() {
		$.mobile.loading( "show" );

		var chart1 = new Array( OSApp.Analog.Constants.CHARTS ),
			chart2 = new Array( OSApp.Analog.Constants.CHARTS ),
			chart3 = new Array( OSApp.Analog.Constants.CHARTS );

		page.one( "pagehide", function() {
			page.detach();
		} );

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Analog Sensor Log" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			}
		} );

		$( "#analogsensorchart" ).remove();
		$.mobile.pageContainer.append( page );

		OSApp.Firmware.sendToOS( "/so?pw=&lasthours=24&csv=2", "text" ).then( function( csv1 ) {
			OSApp.Analog.buildGraph( "#myChart", chart1, csv1, OSApp.Language._( "last 24h" ), "HH:mm" );

			OSApp.Firmware.sendToOS( "/so?pw=&csv=2&log=1", "text" ).then( function( csv2 ) {
				OSApp.Analog.buildGraph( "#myChartW", chart2, csv2, OSApp.Language._( "last weeks" ), "dd.MM.yyyy" );

				OSApp.Firmware.sendToOS( "/so?pw=&csv=2&log=2", "text" ).then( function( csv3 ) {
					OSApp.Analog.buildGraph( "#myChartM", chart3, csv3, OSApp.Language._( "last months" ), "MM.yyyy" );
					$.mobile.loading( "hide" );
				} );
			} );
		} );
	}

	return begin;
} )();

OSApp.Analog.buildGraph = function( prefix, chart, csv, titleAdd, timestr ) {
	var csvlines = csv.split( /(?:\r\n|\n)+/ ).filter( function( el ) { return el.length !== 0; } );

	for ( var j = 0; j < OSApp.Analog.analogSensors.length; j++ ) {
		if ( !OSApp.Analog.analogSensors[ j ].log ) {
			continue;
		}

		var nr = OSApp.Analog.analogSensors[ j ].nr,
			logdata = [],
			unitid = OSApp.Analog.analogSensors[ j ].unitid;

		for ( var k = 1; k < csvlines.length; k++ ) {
			var line = csvlines[ k ].split( ";" );
			if ( line.length >= 3 && Number( line[ 0 ] ) === nr ) {
				logdata.push( { x: Number( line[ 1 ] ) * 1000, y: Number( line[ 2 ] ) } );
			}
		}
		var series = { name: OSApp.Analog.analogSensors[ j ].name, data: logdata };

		// User defined sensor:
		if ( unitid === OSApp.Analog.Constants.USERDEF_UNIT ) {
			unitid = chart.length;
			chart.push( undefined );
		} else if ( unitid >= OSApp.Analog.Constants.CHARTS ) {
			unitid = 0;
		}

		if ( !chart[ unitid ] ) {
			var unit, title, unitStr,
				minFunc = function( val ) { return Math.floor( Math.max( 0, val - 4 ) ); },
				maxFunc = function( val ) { return Math.ceil( val ); },
				autoY = true;
			switch ( unitid ) {
				case 1: unit = OSApp.Language._( "Soil moisture" );
					title = OSApp.Language._( "Soil moisture" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case 2: unit = OSApp.Language._( "degree celsius temperature" );
					title = OSApp.Language._( "Temperature" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + String.fromCharCode( 176 ) + "C"; };
					break;
				case 3: unit = OSApp.Language._( "degree fahrenheit temperature" );
					title = OSApp.Language._( "Temperature" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + String.fromCharCode( 176 ) + "F"; };
					break;
				case 4: unit = OSApp.Language._( "Volt" );
					title = OSApp.Language._( "Voltage" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + " V"; };
					minFunc = 0;
					maxFunc = 4;
					autoY = false;
					break;
				case 5: unit = OSApp.Language._( "Humidity" );
					title = OSApp.Language._( "Air Humidity" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case 6: unit = OSApp.Language._( "Rain" );
					title = OSApp.Language._( "Rainfall" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + " in"; };
					break;
				case 7: unit = OSApp.Language._( "Rain" );
					title = OSApp.Language._( "Rainfall" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + " mm"; };
					minFunc = 0;
					break;
				case 8: unit = OSApp.Language._( "Wind" );
					title = OSApp.Language._( "Wind" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + " mph"; };
					minFunc = 0;
					break;
				case 9: unit = OSApp.Language._( "Wind" );
					title = OSApp.Language._( "Wind" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + " kmh"; };
					minFunc = 0;
					break;
				case 10: unit = OSApp.Language._( "Level" );
					title = OSApp.Language._( "Level" ) + " " + titleAdd;
					unitStr = function( val ) { return +( Math.round( val + "e+2" )  + "e-2" ) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					autoY = false;
					break;

				default: unit = "";
					title = titleAdd;
					unitStr = null;
			}

			var options = {
				chart: {
					type: "line",
					stacked: false,
					width: "100%"
				},
				dataLabels: {
					enabled: false
				},
				series: [ series ],
				stroke: {
					curve: "smooth",
					width: 4
				},
				grid: {
					xaxis: {
						lines: {
							show: true
						}
					},
					yaxis: {
						lines: {
							show: true
						}
					}
				},
				plotOptions: {
					bar: {
						columnWidth: "20%"
					}
				},
				tooltip: {
					x: {
						format: "dd.MM.yyyy HH:mm:ss"
					}
				},
				xaxis: {
					type: "datetime",
					labels: {
						datetimeUTC: true,
						format: timestr
					}
				},
				yaxis: {
					title: { text: unit },
					decimalsInFloat: 0,
					forceNiceScale: autoY,
					labels: {
						formatter: unitStr
					},
					min: minFunc,
					max: autoY ? undefined : maxFunc
				},
				title: { text: title }
			};

			chart[ unitid ] = new ApexCharts( document.querySelector( prefix + unitid ), options );
			chart[ unitid ].render();
		} else {
			chart[ unitid ].appendSeries( series );
		}
	}

	for ( var c = 1; c < OSApp.Analog.Constants.CHARTS; c++ ) {
		if ( !chart[ c ] ) {
			var x = document.querySelector( prefix + c );
			if ( x ) {
				x.parentElement.removeChild( x );
			}
		}
	}
};

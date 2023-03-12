/*!
 * Analog Sensor API - GUI for OpenSprinkker App
 * https://github.com/opensprinklershop/
 * (c) 2023 OpenSprinklerShop
 * Released under the MIT License
 */

var analogSensors = {},
	progAdjusts = {};

function refresh() {
    setTimeout( function() {
        location.reload();
    }, 100 );
}

function updateProgramAdjustments( callback ) {
	callback = callback || function() {};
	return sendToOS( "/se?pw=", "json" ).then( function( data ) {
		progAdjusts = data.progAdjust;
		callback();
	} );
}

function updateAnalogSensor( callback ) {
	callback = callback || function() {};
	return sendToOS( "/sl?pw=", "json" ).then( function( data ) {
		analogSensors = data.sensors;
		callback();
	} );
}

function updateSensorShowArea( page ) {
	if ( checkOSVersion( 230 ) ) {
		var showArea =  page.find( "#os-sensor-show" );
		var html = "", i, j;
		for ( i = 0; i < progAdjusts.length; i++ ) {
			var progAdjust = progAdjusts[ i ];
			var sensorName = "";
			for ( j = 0; j < analogSensors.length; j++ ) {
				if ( analogSensors[ j ].nr === progAdjust.sensor ) {
					sensorName = analogSensors[ j ].name;
				}
			}
			var progName = "?";
			if ( progAdjust.prog >= 1 && progAdjust.prog <= controller.programs.pd.length ) {
				progName = readProgram( controller.programs.pd[ progAdjust.prog - 1 ] ).name;
			}

			html += "<div id='progAdjust-show-" + progAdjust.nr + "' class='ui-body ui-body-a center'>";
			html += "<label>" + sensorName + " - " + progName + ": " + Math.round( progAdjust.current * 100 ) + "%</label>";
			html += "</div>";
		}

		for ( i = 0; i < analogSensors.length; i++ ) {
			var sensor = analogSensors[ i ];
			if ( sensor.show ) {
				html += "<div id='sensor-show-" + sensor.nr + "' class='ui-body ui-body-a center'>";
				html += "<label>" + sensor.name + ": " + Math.round( sensor.data ) + sensor.unit + "</label>";
				html += "</div>";
			}
		}
		while ( showArea.firstChild ) {
			showArea.removeChild( showArea.firstChild );
		}
		showArea.html( html );
	}
}

function toByteArray( b ) {
	var result = [];
	var n = 4;
	while ( n-- ) {
	  result.push( Number( b % 0x100 ) );
	  b /= 0x100;
	}
	return Uint8Array.from( result );
}

function intFromBytes( x ) {
	try {
	    var val = 0;
	    for ( var i = x.length - 1; i >= 0; i-- ) {
			val *= 0x100;
        	val += parseInt( x[ i ] );
    	}
    	return val;
	} catch ( error ) {
		return 0;
	}
}


//Program adjustments editor
function showAdjustmentsEditor( progAdjust, callback ) {

	sendToOS( "/sh?pw=", "json" ).then( function( data ) {
		var supportedAdjustmentTypes = data.progTypes;
		var i;

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var list = "<div data-role='popup' data-theme='a' id='progAdjustEditor'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + _( progAdjust.nr > 0 ? "Edit Program Adjustment" : "New Program Adjustment" ) + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					_( "Notice: If you want to combine multiple sensors, then build a sensor group. " ) +
					_( "See Help Documentation for details." ) +
				"</p>" +

			"<div class='ui-field-contain'>" +
				//Adjustment-Nr:
				"<label>" +
					_( "Adjustment-Nr" ) +
				"</label>" +
				"<input class='nr' type='number' min='1' max='99999' value='" + progAdjust.nr + ( progAdjust.nr > 0 ? "' disabled='disabled'>" : "'>" ) +

				//Select Type:
				"<div class='ui-field-contain'><label for='type' class='select'>" +
					_( "Type" ) +
					"</label><select data-mini='true' id='type'>";

				for ( i = 0; i < supportedAdjustmentTypes.length; i++ ) {
					list += "<option " + ( ( progAdjust.type === supportedAdjustmentTypes[ i ].type ) ? "selected" : "" ) +
					" value='" + supportedAdjustmentTypes[ i ].type + "'>" +
					supportedAdjustmentTypes[ i ].name + "</option>";
				}
				list += "</select></div>" +

				//Select Sensor:
				"<div class='ui-field-contain'><label for='sensor' class='select'>" +
					_( "Sensor" ) +
					"</label><select data-mini='true' id='sensor'>";

				for ( i = 0; i < analogSensors.length; i++ ) {
					list += "<option " + ( ( progAdjust.sensor === analogSensors[ i ].nr ) ? "selected" : "" ) +
					" value='" + analogSensors[ i ].nr + "'>" +
					analogSensors[ i ].nr + " - " + analogSensors[ i ].name + "</option>";
				}
				list += "</select></div>" +

				//Select Program:
				"<div class='ui-field-contain'><label for='prog' class='select'>" +
					_( "Program to adjust" ) +
					"</label><select data-mini='true' id='prog'>";

				for ( i = 0; i < controller.programs.pd.length; i++ ) {
					var progName = readProgram( controller.programs.pd[ i ] ).name;
					var progNr = i + 1;

					list += "<option " + ( ( progAdjust.prog === progNr ) ? "selected" : "" ) +
					" value='" + progNr + "'>" +
					progName + "</option>";
				}
				list += "</select></div>" +

				"<label>" +
					_( "Factor 1 (adjustment for Min)" ) +
					"</label>" +
					"<input class='factor1' type='number' value='" + progAdjust.factor1 + "'>" +

				"<label>" +
					_( "Factor 2 (adjustment for Max)" ) +
					"</label>" +
					"<input class='factor2' type='number' value='" + progAdjust.factor2 + "'>" +

				"<label>" +
					_( "Min Sensor value" ) +
					"</label>" +
					"<input class='min' type='number' value='" + progAdjust.min + "'>" +

				"<label>" +
					_( "Max Sensor value" ) +
					"</label>" +
					"<input class='max' type='number' value='" + progAdjust.max + "'>" +

				"</div>" +
				"<button class='submit' data-theme='b'>" + _( "Submit" ) + "</button>" +
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
				nr:      parseInt( popup.find( ".nr" ).val() ),
				type:    parseInt( popup.find( "#type" ).val() ),
				sensor:  parseInt( popup.find( "#sensor" ).val() ),
				prog:    parseInt( popup.find( "#prog" ).val() ),
				factor1: parseFloat( popup.find( ".factor1" ).val() ),
				factor2: parseFloat( popup.find( ".factor2" ).val() ),
				min: 	 parseFloat( popup.find( ".min" ).val() ),
				max: 	 parseFloat( popup.find( ".max" ).val() )
			};
			callback( progAdjust );

			popup.popup( "close" );
			return false;
		} );

		popup.on( "focus", "input[type='number']", function() {
			this.value = "";
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

		holdButton( popup.find( ".incr" ).children(), function( e ) {
			var pos = $( e.currentTarget ).index();
			changeValue( pos, 1 );
			return false;
		} );

		holdButton( popup.find( ".decr" ).children(), function( e ) {
			var pos = $( e.currentTarget ).index();
			changeValue( pos, -1 );
			return false;
		} );

		$( "#sensorEditor" ).remove();

		popup.css( "max-width", "580px" );

		openPopup( popup, { positionTo: "window" } );
	} );
}

function isSmt100( sensorType ) {
	if ( !sensorType ) {
		return false;
	}
	return sensorType === 1 || sensorType === 2;
}

// Analog sensor editor
function showSensorEditor( sensor, callback ) {

	sendToOS( "/sf?pw=", "json" ).then( function( data ) {
		var supportedSensorTypes = data.sensorTypes;
		var i;

	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	var list = "<div data-role='popup' data-theme='a' id='sensorEditor'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + _( sensor.nr > 0 ? "Edit Sensor" : "New Sensor" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					_( "Edit Sensor Configuration. " ) +
					_( "See Help Documentation for details." ) +
				"</p>" +
				"<div class='ui-field-contain'>" +
					"<label>" +
						_( "Sensor-Nr" ) +
					"</label>" +
					"<input class='nr' type='number' min='1' max='99999' value='" + sensor.nr + ( sensor.nr > 0 ? "' disabled='disabled'>" : "'>" ) +

					"<div class='ui-field-contain'><label for='type' class='select'>" +
						_( "Type" ) +
						"</label><select data-mini='true' id='type'>";

						for ( i = 0; i < supportedSensorTypes.length; i++ ) {
							list += "<option " + ( ( sensor.type === supportedSensorTypes[ i ].type ) ? "selected" : "" ) +
							" value='" + supportedSensorTypes[ i ].type + "'>" +
							supportedSensorTypes[ i ].name + "</option>";
						}
						list += "</select></div>";

					list += "<button data-mini='true' class='center-div' id='smt100id' style='display:" + ( isSmt100( sensor.type ) ? "block" : "none" ) + "'>" + _( "Set SMT100 Modbus ID" ) + "</button>";

					list += "<label>" +
						_( "Group" ) +
					"</label>" +
					"<input class='group' type='number'  min='0' max='99999' value='" + sensor.group + "'>" +

					"<label>" +
						_( "Name" ) +
					"</label>" +
					"<input class='name' type='text'  value='" + sensor.name + "'>" +

					"<label>" +
						_( "IP-Address" ) +
					"</label>" +
					"<input class='ip' type='text'  value='" + ( sensor.ip ? toByteArray( sensor.ip ).join( "." ) : "" ) + "'>" +

					"<label>" +
						_( "Port" ) +
					"</label>" +
					"<input class='port' type='number' min='0' max='65535' value='" + sensor.port + "'>" +

					"<label>" +
						_( "ID" ) +
					"</label>" +
					"<input class='id' type='number' min='0' max='65535' value='" + sensor.id + "'>" +

					"<label>" +
						_( "Read Interval (s)" ) +
					"</label>" +
					"<input class='ri' type='number' min='1' max='999999' value='" + sensor.ri + "'>" +

					"<label for='enable'><input data-mini='true' id='enable' type='checkbox' " + ( ( sensor.enable === 1 ) ? "checked='checked'" : "" ) + ">" +
					_( "Sensor Enabled" ) +
					"</label>" +

					"<label for='log'><input data-mini='true' id='log' type='checkbox' " + ( ( sensor.log === 1 ) ? "checked='checked'" : "" ) + ">" +
					_( "Enable Data Logging" ) +
					"</label>" +

					"<label for='log'><input data-mini='true' id='show' type='checkbox' " + ( ( sensor.show === 1 ) ? "checked='checked'" : "" ) + ">" +
					_( "Show on Mainpage" ) +
					"</label>" +

				"</div>" +

				"<button class='submit' data-theme='b'>" + _( "Submit" ) + "</button>" +
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
		var nr    = parseInt( popup.find( ".nr" ).val() ),
			newid = parseInt( popup.find( ".id" ).val() );
		popup.popup( "close" );
		areYouSure( _( "This function sets the Modbus ID for one SMT100 sensor. Disconnect all other sensors on this Modbus port. Please confirm." ),
		"new id=" + newid, function() {
			sendToOS( "/sa?pw=&nr=" + nr + "&id=" + newid ).done( function() {
				window.alert( "SMT100 id assigned!" );
				updateAnalogSensor( refresh );
			} );
		} );
	} );
	popup.find( "#type" ).change( function() {
		var type = parseInt( popup.find( "#type" ).val() );
		document.getElementById( "smt100id" ).style.display = isSmt100( type ) ? "block" : "none";
	} );

	popup.find( ".submit" ).on( "click", function() {

		if ( !sensor.nr ) { //New Sensor - check existing Nr to avoid overwriting
			var nr = parseInt( popup.find( ".nr" ).val() );
			for ( var i = 0; i < analogSensors.length; i++ ) {
				if ( analogSensors[ i ].nr === nr ) {
					window.alert( _( "Sensor-Number exists!" ) );
					return;
				}
			}
		}
		var sensorOut = {
			nr:     parseInt( popup.find( ".nr" ).val() ),
			type:   parseInt( popup.find( "#type" ).val() ),
			group:  parseInt( popup.find( ".group" ).val() ),
			name:   popup.find( ".name" ).val(),
			ip:     intFromBytes( popup.find( ".ip" ).val().split( "." ) ),
			port:   parseInt( popup.find( ".port" ).val() ),
			id:     parseInt( popup.find( ".id" ).val() ),
			ri:     parseInt( popup.find( ".ri" ).val() ),
			enable: popup.find( "#enable" ).is( ":checked" ) ? 1 : 0,
			log:    popup.find( "#log" ).is( ":checked" ) ? 1 : 0,
			show:   popup.find( "#show" ).is( ":checked" ) ? 1 : 0
		};
		//Alert(sensorOut.ip);

		callback( sensorOut );

		popup.popup( "close" );
		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
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

	holdButton( popup.find( ".incr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, 1 );
		return false;
	} );

	holdButton( popup.find( ".decr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, -1 );
		return false;
	} );

	$( "#sensorEditor" ).remove();

	popup.css( "max-width", "580px" );

	openPopup( popup, { positionTo: "window" } );
} );
}

// Config Page
var showAnalogSensorConfig = ( function() {
	var page = $( "<div data-role='page' id='analogsensorconfig'>" +
			"<div class='ui-content' role='main' id='analogsensorlist'>" +
			"</div></div>" );

	page
		.on( "sensorrefresh", updateSensorContent )
		.on( "pagehide", function() {
			page.detach();
		} );

	function updateSensorContent() {
		var list = $( buildSensorConfig() );

		//Delete a sensor:
		list.find( "#delete-sensor" ).on( "click", function( ) {
			var dur = $( this ),
			value = dur.attr( "value" ),
			row = dur.attr( "row" );

			areYouSure( _( "Are you sure you want to delete the sensor?" ), value, function() {
				sendToOS( "/sc?pw=&nr=" + value + "&type=0"  ).done( function() {
                    analogSensors.splice( row, 1 );
					updateSensorContent();
				} );
			} );
		} );

		//Edit a sensor:
		list.find( "#edit-sensor" ).on( "click", function( ) {
			var dur = $( this ),
			//Value = dur.attr( "value" ),
			row = dur.attr( "row" );

			var sensor = analogSensors[ row ];

			showSensorEditor( sensor, function( sensorOut ) {
				sensorOut.nativedata = sensor.nativedata;
				sensorOut.data = sensor.data;
				sensorOut.last = sensor.last;
				sendToOS( "/sc?pw=&nr=" + sensorOut.nr +
					"&type=" + sensorOut.type +
					"&group=" + sensorOut.group +
					"&name=" + sensorOut.name +
					"&ip=" + sensorOut.ip +
					"&port=" + sensorOut.port +
					"&id=" + sensorOut.id +
					"&ri=" + sensorOut.ri +
					"&enable=" + sensorOut.enable +
					"&log=" + sensorOut.log +
					"&show=" + sensorOut.show
				).done( function() {
					analogSensors[ row ] = sensorOut;
					updateSensorContent();
				} );
			} );
		} );

		// Add a new analog sensor:
		list.find( "#add-sensor" ).on( "click", function( ) {
			var sensor = {
				name: "new sensor",
				type: 1,
				ri: 60,
				enable: 1,
				log: 1 };

			showSensorEditor( sensor, function( sensorOut ) {
				sendToOS( "/sc?pw=&nr=" + sensorOut.nr +
				"&type=" + sensorOut.type +
				"&group=" + sensorOut.group +
				"&name=" + sensorOut.name +
				"&ip=" + sensorOut.ip +
				"&port=" + sensorOut.port +
				"&id=" + sensorOut.id +
				"&ri=" + sensorOut.ri +
				"&enable=" + sensorOut.enable +
				"&log=" + sensorOut.log +
				"&show=" + sensorOut.show
				).done( function() {
					analogSensors.push( sensorOut );
					updateSensorContent();
				} );
			} );
		} );

		// Refresh sensor data:
		list.find( "#refresh-sensor" ).on( "click", function( ) {
			updateProgramAdjustments( function( ) {
				updateAnalogSensor( function( ) {
					updateSensorContent();
				} );
			} );
		} );

		//Delete a program adjust:
		list.find( "#delete-progadjust" ).on( "click", function( ) {
			var dur = $( this ),
			value = dur.attr( "value" );
			row = dur.attr( "row" );

			areYouSure( _( "Are you sure you want to delete this program adjustment?" ), value, function() {
				sendToOS( "/sb?pw=&nr=" + value + "&type=0"  ).done( function() {
                    progAdjusts.splice( row, 1 );
					updateSensorContent();
				} );
			} );
		} );

		//Edit a program adjust:
		list.find( "#edit-progadjust" ).on( "click", function( ) {
			var dur = $( this ),
			//Value = dur.attr( "value" ),
			row = dur.attr( "row" );

			var progAdjust = progAdjusts[ row ];

			showAdjustmentsEditor( progAdjust, function( progAdjustOut ) {

				sendToOS( "/sb?pw=&nr=" + progAdjustOut.nr +
					"&type=" + progAdjustOut.type +
					"&sensor=" + progAdjustOut.sensor +
					"&prog=" + progAdjustOut.prog +
					"&factor1=" + progAdjustOut.factor1 +
					"&factor2=" + progAdjustOut.factor2 +
					"&min=" + progAdjustOut.min +
					"&max=" + progAdjustOut.max
				).done( function() {
					progAdjusts[ row ] = progAdjustOut;
					updateSensorContent();
				} );
			} );
		} );

		//Add a new program adjust:
		list.find( "#add-progadjust" ).on( "click", function( ) {
			var progAdjust = {
				type: 1
			};

			showAdjustmentsEditor( progAdjust, function( progAdjustOut ) {
				sendToOS( "/sb?pw=&nr=" + progAdjustOut.nr +
					"&type=" + progAdjustOut.type +
					"&sensor=" + progAdjustOut.sensor +
					"&prog=" + progAdjustOut.prog +
					"&factor1=" + progAdjustOut.factor1 +
					"&factor2=" + progAdjustOut.factor2 +
					"&min=" + progAdjustOut.min +
					"&max=" + progAdjustOut.max
				).done( function() {
					progAdjusts.push( progAdjustOut );
					updateSensorContent();
				} );
			} );
		} );

		// Clear sensor log
		list.find( "#clear-log" ).on( "click", function() {
			areYouSure( _( "Are you sure you want to clear the sensor log?" ), "", function() {
				sendToOS( "/sn?pw=&" ).done( function( result ) {
					window.alert( _( "Log cleared: " + result.deleted + _( " records" ) ) );
					updateSensorContent();
				} );
			} );
		} );

		list.find( "#download-log" ).on( "click", function() {
			var link = document.createElement( "a" );
			link.setAttribute( "download", "sensorlog-" + new Date().toLocaleDateString().replace( /\//g, "-" ) + ".csv" );

			dest = "/so?pw=&csv=1";
			dest = dest.replace( "pw=", "pw=" + encodeURIComponent( currPass ) );
			link.href = currToken ? "https://cloud.openthings.io/forward/v1/" + currToken + dest : currPrefix + currIp + dest;
			alert(link.href);
			document.body.appendChild( link ); // Required for FF
			link.click();
		} );

		list.find( "#show-log" ).on( "click", function() {
				changePage( "#analogsensorchart" );
				return false;
		} );

		page.find( "#analogsensorlist" ).html( list.enhanceWithin() );
	}

	function begin() {
		changeHeader( {
			title: _( "Analog Sensor Config" ),
			leftBtn: {
				icon: "carat-l",
				text: _( "Back" ),
				class: "ui-toolbar-back-btn",
				on: goBack
			}
		} );

		updateSensorContent();

		$( "#analogsensorconfig" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin;
} )();

function buildSensorConfig() {
	// Analog sensor api support:
	var list = "<table id='analog_sensor_table'><tr style='width:100%;vertical-align: top;'>" +
		"<tr><th>Nr</th><th class=\"hidecol\">Type</th><th class=\"hidecol\">Group</th><th>Name</th>"+
		"<th class=\"hidecol\">IP</th><th class=\"hidecol\">Port</th><th class=\"hidecol\">ID</th>"+
		"<th class=\"hidecol\">Read<br>Interval</th><th class=\"hidecol\">Data</th><th>Enabled</th>"+
		"<th class=\"hidecol\">Log</th><th class=\"hidecol\">Show</th><th class=\"hidecol2\">Last</th></tr>";

		var row = 0;
		$.each( analogSensors, function( i, item ) {

			var $tr = $( "<tr>" ).append(
				$("<td>").text(item.nr),
				$("<td class=\"hidecol\">").text(item.type),
				$("<td class=\"hidecol\">").text(item.group?item.group:""),
				$("<td>").text(item.name),
				$("<td class=\"hidecol\">").text(item.ip?toByteArray(item.ip).join( "." ):""),
				$("<td class=\"hidecol\">").text(item.port?item.port:""),
				$("<td class=\"hidecol\">").text(item.type < 1000?item.id:""),
				$("<td class=\"hidecol\">").text(item.ri),
				$("<td class=\"hidecol\">").text(Math.round(item.data)+item.unit),
				$("<td>").text(item.enable),
				$("<td class=\"hidecol\">").text(item.log),
				$("<td class=\"hidecol\">").text(item.show),
				$("<td class=\"hidecol2\">").text(dateToString(new Date(item.last*1000)), null, 2),
				"<td><button data-mini='true' class='center-div' id='edit-sensor' value='" + item.nr + "' row='" + row + "'>" + _( "Edit" ) + "</button></td>",
				"<td><button data-mini='true' class='center-div' id='delete-sensor' value='" + item.nr + "' row='" + row + "'>" + _( "Delete" ) + "</button></td>"
			);
			list += $tr.wrap( "<p>" ).html() + "</tr>";
			row++;
		} );
		list += "</table>";
		list += "<p><button data-mini='true' class='center-div' id='add-sensor' value='1'>" + _( "Add Sensor" ) + "</button></p>";
		list += "<p><button data-mini='true' class='center-div' id='refresh-sensor' value='2'>" + _( "Refresh Sensordata" ) + "</button></p>";

		//Program adjustments table:
		list += "<table id='progadjusttable'><tr style='width:100%;vertical-align: top;'>" +
		"<tr><th>Nr</th>"+
		"<th class=\"hidecol\">Type</th>"+
		"<th>Sensor-Nr</th>"+
		"<th>Name</th>"+
		"<th class=\"hidecol2\">Program-Nr</th><th>Program</th>"+
		"<th class=\"hidecol2\">Factor 1</th>"+
		"<th class=\"hidecol2\">Factor 2</th>"+
		"<th class=\"hidecol2\">Min Value</th>"+
		"<th class=\"hidecol2\">Max Value</th>"+
		"<th class=\"hidecol\">Current</th></tr>";

		row = 0;
		$.each( progAdjusts, function( i, item ) {

			var sensorName = "";
			for ( var j = 0; j < analogSensors.length; j++ ) {
				if ( analogSensors[ j ].nr === item.sensor ) {
					sensorName = analogSensors[ j ].name;
				}
			}
			var progName = "?";
			if ( item.prog >= 1 && item.prog <= controller.programs.pd.length ) {
				progName = readProgram( controller.programs.pd[ item.prog - 1 ] ).name;
			}

			var $tr = $( "<tr>" ).append(
				$("<td>").text(item.nr),
				$("<td class=\"hidecol\">").text(item.type),
				$("<td class=\"hidecol\">").text(item.sensor),
				$("<td class=\"hidecol2\">").text(sensorName),
				$("<td>").text(item.prog),
				$("<td>").text(progName),
				$("<td class=\"hidecol2\">").text(item.factor1),
				$("<td class=\"hidecol2\">").text(item.factor2),
				$("<td class=\"hidecol2\">").text(item.min),
				$("<td class=\"hidecol2\">").text(item.max),
				$("<td class=\"hidecol\">").text(Math.round(item.current*100.0)+"%"),
				"<td><button data-mini='true' class='center-div' id='edit-progadjust' value='" + item.nr + "' row='" + row + "'>" + _( "Edit" ) + "</button></td>",
				"<td><button data-mini='true' class='center-div' id='delete-progadjust' value='" + item.nr + "' row='" + row + "'>" + _( "Delete" ) + "</button></td>"
			);
			list += $tr.wrap( "<p>" ).html() + "</tr>";
			row++;
		} );
		list += "</table>";
		list += "<p><button data-mini='true' class='center-div' id='add-progadjust' value='3'>" + _( "Add program adjustment" ) + "</button></p>";

		//Analog sensor logs:
		list += "<table id='logfunctions'><tr style='width:100%;vertical-align: top;'><tr>" +
			"<th><button data-mini='true' class='center-div' id='clear-log'>" + _( "Clear Log" ) + "</button></th>" +
			"<th><button data-mini='true' class='center-div' id='download-log'>" + _( "Download Log" ) + "</button></th>" +
			"<th><a href='#analogsensorchart'><button data-mini='true' class='center-div' id='show-log'>" + _( "Show Log" ) + "</button></a></th>" +
			"</tr></table>";
	return list;
}

// About page
var showAnalogSensorCharts = ( function() {

	var page = $( "<div data-role='page' id='analogsensorchart'>" +
			"<div class='ui-content' role='main'>" +
			"<ul data-role='listview' data-inset='true'>" +
			"<h1>Analog sensor log last 24h</h1>" +
			"<canvas id='myChart'></canvas>" +
			"</div>" +
			"</div>" ),
		chart;

	function begin() {
		chart = null;

		page.one( "pagehide", function() {
			chart.destroy();
			page.detach();
		} );

		changeHeader( {
			title: _( "Analog sensor log last 24h" ),
			leftBtn: {
				icon: "carat-l",
				text: _( "Back" ),
				class: "ui-toolbar-back-btn",
				on: goBack
			}
		} );

		$( "#analogsensorchart" ).remove();
		$.mobile.pageContainer.append( page );

		sendToOS( "/so?pw=&lasthours=24", "json" ).then( function( data ) {
			var datasets = [], scales = [], j, k;
			var dateopts = {hour: "2-digit", minute: "2-digit", timeZone: "UTC"};
			scales[ "x" ] = {
					type: "time",
					time : {
						unit: "hour",
						unitStepSize: 1,
						displayFormats: {
							hour: "hh:mm",
						},
					},
					display: true,
					ticks: {
						callback: function(value) {
							return new Date(value).toLocaleTimeString([], dateopts);
						},
					},
				};
			for ( j = 0; j < analogSensors.length; j++ ) {
				var nr = analogSensors[ j ].nr;
				var logdata = [];
				for ( k = 0; k < data.log.length; k++ ) {
					if ( data.log[ k ].nr === nr ) {
						logdata.push( { x: data.log[ k ].time * 1000, y: data.log[ k ].data } );
					}
				}
				if ( logdata.length > 0 ) {
					var unitid = analogSensors[ j ].unitid;
					datasets.push( {
						label: analogSensors[ j ].name,
						data: logdata,
						fill: false,
						xAxisID: "x",
						yAxisID: "y" + unitid,
					} );

					if ( unitid === 1 ) { // % soil
						scales[ "y" + unitid ] = {
							type: "linear",
							display: true,
							position: "left",
							title: {
								display: true,
								text: analogSensors[ j ].unit,
							},
							suggestedMin: 0,
							suggestedMax: 50
						};
					} else {
						scales[ "y" + unitid ] = {
							type: "linear",
							display: true,
							position: ( unitid % 2 ) ? "left" : "right",
							title: {
								display: true,
								text: analogSensors[ j ].unit,
							},
						};
					}
				}
			}

			// Set chart js labels and datasets
			var ctx = document.getElementById( "myChart" ).getContext( "2d" );
			chart = new Chart( ctx, {
				type: "line",
				data: { datasets: datasets },
				options: {
					responsive: true,
					interaction: {
						mode: "index",
						intersect: false
					  },
					scales: scales,
				},
			} );
		} );

	}

	return begin;
} )();


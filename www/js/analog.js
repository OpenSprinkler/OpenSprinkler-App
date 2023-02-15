/*!
 * Analog Sensor API - GUI for OpenSprinkker App
 * https://github.com/opensprinklershop/
 * (c) 2023 OpenSprinklerShop
 * Released under the MIT License
 */

var analogSensors = {},
	progAdjusts = {};

function refresh() {
    setTimeout(function () {
        location.reload();
    }, 100);
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
		var showArea =  page.find( "#os-sensor-show");
		var html = "";
		for (var i = 0; i < progAdjusts.length; i++) {
			var progAdjust = progAdjusts[i];
			var sensorName = "";
			for (j = 0; j < analogSensors.length; j++) {
				if (analogSensors[j].nr === progAdjust.sensor) {
					sensorName = analogSensors[j].name;
				}
			}
			var progName = "?";
			if (progAdjust.prog >= 1 && progAdjust.prog <= controller.programs.pd.length) {
				progName = readProgram(controller.programs.pd[ progAdjust.prog-1]).name;
			}

			html += "<div id='progAdjust-show-"+progAdjust.nr+"' class='ui-body ui-body-a center'>";
			html += "<label>"+sensorName+" - " + progName+": "+Math.round(progAdjust.current*100)+"%</label>";
			html += "</div>";
		}

		for (var i = 0; i < analogSensors.length; i++) {
			var sensor = analogSensors[i];
			if (sensor.show) {
				html += "<div id='sensor-show-"+sensor.nr+"' class='ui-body ui-body-a center'>";
				html += "<label>"+sensor.name+": "+Math.round(sensor.data)+sensor.unit+"</label>";
				html += "</div>";
			}
		}
		while (showArea.firstChild) {
			showArea.removeChild(showArea.firstChild);
		}
		showArea.html(html);
	}
};

function toByteArray(b) {
	var result = [];
	while (b > 0.1) {
	  result.push(Number(b % 0x100));
	  b /= 0x100;
	}
	return Uint8Array.from(result);
}

function intFromBytes( x ){
	try {
	    var val = 0;
	    for (var i = x.length-1; i >= 0; i--) {
			val *= 0x100;
        	val += parseInt(x[i]);
    	}
    	return val;
	} catch(error) {
		return 0;
	}
}


//program adjustments editor
function showAdjustmentsEditor( progAdjust, callback) {

	sendToOS( "/sh?pw=", "json" ).then( function( data ) {
		var supportedAdjustmentTypes = data.progTypes;
		var i;

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var list = "<div data-role='popup' data-theme='a' id='progAdjustEditor'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + _( progAdjust.nr>0?"Edit Program Adjustment":"New Program Adjustment" ) + "</h1>" +
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
				"<input class='nr' type='number' min='1' max='99999' value='" + progAdjust.nr + ( progAdjust.nr > 0? "' disabled='disabled'>" : "'>" ) +

				//Select Type:
				"<div class='ui-field-contain'><label for='type' class='select'>" +
					_( "Type" ) +
					"</label><select data-mini='true' id='type'>";

				for ( i = 0; i < supportedAdjustmentTypes.length; i++ ) {
					list += "<option " + ( ( progAdjust.type === supportedAdjustmentTypes[i].type ) ? "selected" : "" ) +
					" value='" + supportedAdjustmentTypes[i].type + "'>" +
					supportedAdjustmentTypes[i].name + "</option>";
				}
				list += "</select></div>" +

				//Select Sensor:
				"<div class='ui-field-contain'><label for='sensor' class='select'>" +
					_( "Sensor" ) +
					"</label><select data-mini='true' id='sensor'>";

				for ( i = 0; i < analogSensors.length; i++ ) {
					list += "<option " + ( ( progAdjust.sensor === analogSensors[i].nr ) ? "selected" : "" ) +
					" value='" + analogSensors[i].nr + "'>" +
					analogSensors[i].nr+" - "+analogSensors[i].name + "</option>";
				}
				list += "</select></div>" +

				//Select Program:
				"<div class='ui-field-contain'><label for='prog' class='select'>" +
					_( "Program to adjust" ) +
					"</label><select data-mini='true' id='prog'>";

				for ( i = 0; i < controller.programs.pd.length; i++ ) {
					var progName = readProgram(controller.programs.pd[ i ] ).name;
					var progNr = i+1;

					list += "<option " + ( ( progAdjust.prog === progNr ) ? "selected" : "" ) +
					" value='" +progNr + "'>" +
					progName + "</option>";
				}
				list += "</select></div>" +

				"<label>" +
					_( "Factor 1 (adjustment for Min)" ) +
					"</label>" +
					"<input class='factor1' type='number' value='" + progAdjust.factor1+ "'>" +

				"<label>" +
					_( "Factor 2 (adjustment for Max)" ) +
					"</label>" +
					"<input class='factor2' type='number' value='" + progAdjust.factor2+ "'>" +

				"<label>" +
					_( "Min Sensor value" ) +
					"</label>" +
					"<input class='min' type='number' value='" + progAdjust.min+ "'>" +

				"<label>" +
					_( "Max Sensor value" ) +
					"</label>" +
					"<input class='max' type='number' value='" + progAdjust.max+ "'>" +

				"</div>" +
				"<button class='submit' data-theme='b'>" + _( "Submit" ) + "</button>" +
				"</div>" +
			"</div>";

			var popup = $(list),

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
				max: 	 parseFloat( popup.find( ".max" ).val() ),
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
	});
}

function isSmt100(sensorType) {
	if (!sensorType) {
		return false;
	}
	return sensorType === 1 || sensorType === 2;
}

// analog sensor editor
function showSensorEditor( sensor, callback) {

	sendToOS( "/sf?pw=", "json" ).then( function( data ) {
		var supportedSensorTypes = data.sensorTypes;
		var i;

	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	var list = "<div data-role='popup' data-theme='a' id='sensorEditor'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + _( sensor.nr>0?"Edit Sensor":"New Sensor" ) + "</h1>" +
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
					"<input class='nr' type='number' min='1' max='99999' value='" + sensor.nr + ( sensor.nr > 0? "' disabled='disabled'>" : "'>" ) +

					"<div class='ui-field-contain'><label for='type' class='select'>" +
						_( "Type" ) +
						"</label><select data-mini='true' id='type'>";

						for ( i = 0; i < supportedSensorTypes.length; i++ ) {
							list += "<option " + ( ( sensor.type === supportedSensorTypes[i].type ) ? "selected" : "" ) +
							" value='" + supportedSensorTypes[i].type + "'>" +
							supportedSensorTypes[i].name + "</option>";
						}
						list += "</select></div>";

					list += "<button data-mini='true' class='center-div' id='smt100id' style='display:"+(isSmt100(sensor.type)?"block":"none")+"'>"+ _( "Set SMT100 Modbus ID" )+"</button>";

					list += "<label>" +
						_( "Group" ) +
					"</label>" +
					"<input class='group' type='number'  min='0' max='99999' value='" + sensor.group+ "'>" +

					"<label>" +
						_( "Name" ) +
					"</label>" +
					"<input class='name' type='text'  value='" + sensor.name+ "'>" +

					"<label>" +
						_( "IP-Address" ) +
					"</label>" +
					"<input class='ip' type='text'  value='" + (sensor.ip? toByteArray(sensor.ip).join( "." ):"") + "'>" +

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

		var popup = $(list),

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
		"new id="+newid, function() {
			sendToOS("/sa?pw=&nr="+nr+"&id="+newid ).done( function() {
				window.alert( "SMT100 id assigned!" );
				updateAnalogSensor(refresh);
			});
		});
	});
	popup.find( "#type" ).change(function() {
		var type = parseInt( popup.find( "#type" ).val());
		document.getElementById("smt100id").style.display=isSmt100(type)?"block":"none";
	});

	popup.find( ".submit" ).on( "click", function() {

		if (!sensor.nr) { //New Sensor - check existing Nr to avoid overwriting
			var nr = parseInt( popup.find( ".nr" ).val() );
			for (var i = 0; i < analogSensors.length; i++) {
				if (analogSensors[i].nr === nr) {
					window.alert(_("Sensor-Number exists!"));
					return;
				}
			}
		}
		var sensorOut = {
			nr:     parseInt( popup.find( ".nr" ).val() ),
			type:   parseInt( popup.find( "#type" ).val() ),
			group:  parseInt( popup.find( ".group" ).val() ),
			name:   popup.find(".name").val(),
			ip:     intFromBytes(popup.find(".ip").val().split( "." )),
			port:   parseInt( popup.find( ".port" ).val() ),
			id:     parseInt( popup.find( ".id" ).val() ),
			ri:     parseInt( popup.find( ".ri" ).val() ),
			enable: popup.find("#enable").is(":checked")?1:0,
			log:    popup.find("#log").is(":checked")?1:0,
			show:   popup.find("#show").is(":checked")?1:0,
		};
		//alert(sensorOut.ip);

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
});
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

		//delete a sensor:
		list.find( "#delete-sensor" ).on( "click", function( ) {
			var dur = $( this ),
			value = dur.attr( "value" ),
			row = dur.attr( "row" );

			areYouSure( _( "Are you sure you want to delete the sensor?" ), value, function() {
				sendToOS( "/sc?pw=&nr="+value+"&type=0"  ).done( function() {
                    analogSensors.splice(row, 1);
					updateSensorContent();
				} );
			} );
		} );

		//edit a sensor:
		list.find( "#edit-sensor" ).on( "click", function( ) {
			var dur = $( this ),
			//value = dur.attr( "value" ),
			row = dur.attr( "row" );

			var sensor = analogSensors[row];

			showSensorEditor(sensor, function( sensorOut ) {
				sensorOut.nativedata = sensor.nativedata;
				sensorOut.data = sensor.data;
				sensorOut.last = sensor.last;
				sendToOS("/sc?pw=&nr="+sensorOut.nr+
					"&type="+sensorOut.type+
					"&group="+sensorOut.group+
					"&name="+sensorOut.name+
					"&ip="+sensorOut.ip+
					"&port="+sensorOut.port+
					"&id="+sensorOut.id+
					"&ri="+sensorOut.ri+
					"&enable="+sensorOut.enable+
					"&log="+sensorOut.log+
					"&show="+sensorOut.show
				).done( function() {
					analogSensors[row] = sensorOut;
					updateSensorContent();
				});
			});
		} );

		// add a new analog sensor:
		list.find( "#add-sensor").on( "click", function( ) {
			var sensor = {
				name: "new sensor",
				type: 1,
				ri: 60,
				enable: 1,
				log: 1};

			showSensorEditor(sensor, function( sensorOut ) {
				sendToOS("/sc?pw=&nr="+sensorOut.nr+
				"&type="+sensorOut.type+
				"&group="+sensorOut.group+
				"&name="+sensorOut.name+
				"&ip="+sensorOut.ip+
				"&port="+sensorOut.port+
				"&id="+sensorOut.id+
				"&ri="+sensorOut.ri+
				"&enable="+sensorOut.enable+
				"&log="+sensorOut.log+
				"&show="+sensorOut.show
				).done( function() {
					analogSensors.push(sensorOut);
					updateSensorContent();
				});
			});
		} );

		// refresh sensor data:
		list.find( "#refresh-sensor").on( "click", function( ) {
			updateProgramAdjustments( function( ) {
				updateAnalogSensor( function( ) {
					updateSensorContent();
				});
			});
		});

		//delete a program adjust:
		list.find( "#delete-progadjust" ).on( "click", function( ) {
			var dur = $( this ),
			value = dur.attr( "value" );
			row = dur.attr( "row" );

			areYouSure( _( "Are you sure you want to delete this program adjustment?" ), value, function() {
				sendToOS( "/sb?pw=&nr="+value+"&type=0"  ).done( function() {
                    progAdjusts.splice(row, 1);
					updateSensorContent();
				} );
			} );
		} );

		//edit a program adjust:
		list.find( "#edit-progadjust" ).on( "click", function( ) {
			var dur = $( this ),
			//value = dur.attr( "value" ),
			row = dur.attr( "row" );

			var progAdjust = progAdjusts[row];

			showAdjustmentsEditor(progAdjust, function( progAdjustOut ) {

				sendToOS("/sb?pw=&nr="+progAdjustOut.nr+
					"&type="+progAdjustOut.type+
					"&sensor="+progAdjustOut.sensor+
					"&prog="+progAdjustOut.prog+
					"&factor1="+progAdjustOut.factor1+
					"&factor2="+progAdjustOut.factor2+
					"&min="+progAdjustOut.min+
					"&max="+progAdjustOut.max
				).done( function() {
					progAdjusts[row] = progAdjustOut;
					updateSensorContent();
				});
			});
		} );

		//add a new program adjust:
		list.find( "#add-progadjust").on( "click", function( ) {
			var progAdjust = {
				type: 1
			};

			showAdjustmentsEditor(progAdjust, function( progAdjustOut ) {
				sendToOS("/sb?pw=&nr="+progAdjustOut.nr+
					"&type="+progAdjustOut.type+
					"&sensor="+progAdjustOut.sensor+
					"&prog="+progAdjustOut.prog+
					"&factor1="+progAdjustOut.factor1+
					"&factor2="+progAdjustOut.factor2+
					"&min="+progAdjustOut.min+
					"&max="+progAdjustOut.max
				).done( function() {
					progAdjusts.push(progAdjustOut);
					updateSensorContent();
				});
			});
		} );

		// clear sensor log
		list.find("#clear-log").on( "click", function() {
			areYouSure( _( "Are you sure you want to clear the sensor log?" ), "", function() {
				sendToOS("/sn?pw=&").done( function(result) {
					window.alert(_("Log cleared: "+ result.deleted+_(" records")));
					updateSensorContent();
				});
			});
		});

		// download log as csv
		list.find("#download-log").on( "click", function() {
			sendToOS("/so?pw=&").done( function(result) {

				var json = result.log;
				var fields = Object.keys(json[0]);
				var replacer = function(key, value) { return value === null ? "" : value; };
				var csv = json.map(function(row){
				  return fields.map(function(fieldName){
					return replacer(row[fieldName]);
				  }).join(",");
				});
				csv.unshift(fields.join(",")); // add header column
				csv = csv.join("\r\n");

				var csvContent = new Blob([csv], { type: "text/csv" });
				var encodedUri = encodeURI(csvContent);
				var link = document.createElement("a");
				link.setAttribute("href", encodedUri);
				link.setAttribute("download", "sensorlog-" + new Date().toLocaleDateString().replace( /\//g, "-" ) + ".csv");
				document.body.appendChild(link); // Required for FF
				link.click();
			});
		} );

		list.find("#show-log").on( "click", function() {
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

		$( "#analogsensorconfig").remove();
		$.mobile.pageContainer.append( page );
	}

	return begin;
} ) ();

function buildSensorConfig() {
	// analog sensor api support:
	var list = "<table id='analog_sensor_table'><tr style='width:100%;vertical-align: top;'>"+
		"<tr><th>Nr</th><th>Type</th><th>Group</th><th>Name</th><th>IP</th><th>Port</th><th>ID</th><th>Read<br>Interval</th><th>Data</th><th>Enabled</th><th>Log</th><th>Show</th><th>Last</th></tr>";

		var row = 0;
		$.each(analogSensors, function(i, item) {

			var $tr = $("<tr>").append(
				$("<td>").text(item.nr),
				$("<td>").text(item.type),
				$("<td>").text(item.group?item.group:""),
				$("<td>").text(item.name),
				$("<td>").text(item.ip?toByteArray(item.ip).join( "." ):""),
				$("<td>").text(item.port?item.port:""),
				$("<td>").text(item.type < 1000?item.id:""),
				$("<td>").text(item.ri),
				$("<td>").text(Math.round(item.data)+item.unit),
				$("<td>").text(item.enable),
				$("<td>").text(item.log),
				$("<td>").text(item.show),
				$("<td>").text(dateToString(new Date(item.last*1000)), null, 2),
				"<td><button data-mini='true' class='center-div' id='edit-sensor' value='"+item.nr+"' row='"+row+"'>"+ _( "Edit" )+"</button></td>",
				"<td><button data-mini='true' class='center-div' id='delete-sensor' value='"+item.nr+"' row='"+row+"'>"+ _( "Delete" )+"</button></td>"
			);
			list += $tr.wrap("<p>").html() + "</tr>";
			row++;
		});
		list += "</table>";
		list += "<p><button data-mini='true' class='center-div' id='add-sensor' value='1'>" + _( "Add Sensor" ) + "</button></p>";
		list += "<p><button data-mini='true' class='center-div' id='refresh-sensor' value='2'>" + _( "Refresh Sensordata" ) + "</button></p>";

		//Program adjustments table:
		list += "<table id='progadjusttable'><tr style='width:100%;vertical-align: top;'>" +
		"<tr><th>Nr</th><th>Type</th><th>Sensor-Nr</th><th>Name</th><th>Program-Nr</th><th>Program</th><th>Factor 1</th><th>Factor 2</th><th>Min Value</th><th>Max Value</th><th>Current</th></tr>";

		row = 0;
		$.each(progAdjusts, function(i, item) {

			var sensorName = "";
			for (var j = 0; j < analogSensors.length; j++) {
				if (analogSensors[j].nr === item.sensor) {
					sensorName = analogSensors[j].name;
				}
			}
			var progName = "?";
			if (item.prog >= 1 && item.prog <= controller.programs.pd.length) {
				progName = readProgram(controller.programs.pd[ item.prog-1 ] ).name;
			}

			var $tr = $("<tr>").append(
				$("<td>").text(item.nr),
				$("<td>").text(item.type),
				$("<td>").text(item.sensor),
				$("<td>").text(sensorName),
				$("<td>").text(item.prog),
				$("<td>").text(progName),
				$("<td>").text(item.factor1),
				$("<td>").text(item.factor2),
				$("<td>").text(item.min),
				$("<td>").text(item.max),
				$("<td>").text(Math.round(item.current*100.0)+"%"),
				"<td><button data-mini='true' class='center-div' id='edit-progadjust' value='"+item.nr+"' row='"+row+"'>"+ _( "Edit" )+"</button></td>",
				"<td><button data-mini='true' class='center-div' id='delete-progadjust' value='"+item.nr+"' row='"+row+"'>"+ _( "Delete" )+"</button></td>"
			);
			list += $tr.wrap("<p>").html() + "</tr>";
			row++;
		});
		list += "</table>";
		list += "<p><button data-mini='true' class='center-div' id='add-progadjust' value='3'>" + _( "Add program adjustment" ) + "</button></p>";

		//analog sensor logs:
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
			"<h1>Analog sensor log</h1>" +
			"<canvas id='myChart'></canvas>" +
			"</div>" +
			"</div>" ),
		chart;

	function begin() {
		chart = null;

		page.one( "pagehide", function() {
			page.detach();
		} );

		changeHeader( {
			title: _( "Analog sensor log" ),
			leftBtn: {
				icon: "carat-l",
				text: _( "Back" ),
				class: "ui-toolbar-back-btn",
				on: goBack
			}
		} );

		$( "#analogsensorchart").remove();
		$.mobile.pageContainer.append( page );

		var labels = [];
		var sensordata = [];
		$.each(analogSensors, function(i, item) {

			labels.push(item.name);

			sendToOS( "/ja?pw=&lasthours=24", "json" ).then( function( data ) {

			});
		});

		// set chart js labels and datasets
		var data = {
			labels: labels,
			datasets: [{
				label: 'My First Dataset',
				data: [65, 59, 80, 81, 56, 55, 40],
				backgroundColor: [
					'rgba(255, 99, 132, 0.2)',
					'rgba(255, 159, 64, 0.2)',
					'rgba(255, 205, 86, 0.2)',
					'rgba(75, 192, 192, 0.2)',
					'rgba(54, 162, 235, 0.2)',
					'rgba(153, 102, 255, 0.2)',
					'rgba(201, 203, 207, 0.2)'
				],
				borderColor: [
					'rgb(255, 99, 132)',
					'rgb(255, 159, 64)',
					'rgb(255, 205, 86)',
					'rgb(75, 192, 192)',
					'rgb(54, 162, 235)',
					'rgb(153, 102, 255)',
					'rgb(201, 203, 207)'
				],
				borderWidth: 1
			}]
		};



		// var ctx = page.find("myChart");
		var ctx = document.getElementById('myChart');

		new Chart(ctx, {
			type: 'bar',
			data: data,
			options: {
				scales: {
					y: {
						beginAtZero: true
					}
				}
			}
		});



	}

	return begin;
} )();


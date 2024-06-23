/*!
 * Analog Sensor API - GUI for OpenSprinkker App
 * https://github.com/opensprinklershop/
 * (c) 2023 OpenSprinklerShop
 * Released under the MIT License
 */

var analogSensors = {},
    progAdjusts = {},
    analogSensorAvail = false;

const CHARTS = 11;
const USERDEF_SENSOR = 49;
const USERDEF_UNIT   = 99;
const SENSOR_MQTT    = 90;

const CURRENT_FW     = "2.3.1(150)";
const CURRENT_FW_ID  = 231;
const CURRENT_FW_MIN = 150;

const COLORS = ["#F3B415", "#F27036", "#663F59", "#6A6E94", "#4E88B4", "#00A7C6", "#18D8D8", '#A9D794','#46AF78', '#A93F55', '#8C5E58', '#2176FF', '#33A1FD', '#7A918D', '#BAFF29'];
const COLCOUNT = 15;

function checkAnalogSensorAvail( callback ) {
	callback = callback || function() {};
	return sendToOS( "/sl?pw=", "json" ).then( function( data ) {
		if ( typeof data === "undefined" || $.isEmptyObject( data ) ) {
			analogSensorAvail = false;
			return;
		}
		analogSensorAvail = true;
		callback();
	}, function( data ) {
		analogSensorAvail = false;
	} );

}

function refresh() {
    setTimeout( function() {
        location.reload();
    }, 100 );
}

function enc(s) {
	//encodeURIComponent does not encode a single "%" !
	if (s) {
		return encodeURIComponent(s);
	}
	return s;
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
		analogSensors.expandItem = new Set(["sensors"]);
		callback();
	} );
}

function updateSensorShowArea( page ) {
	if ( analogSensorAvail ) {
		var showArea =  page.find( "#os-sensor-show" );
		var html = "", i, j;
		html += "<div class='ui-body ui-body-a center'><table style='margin: 0px auto;'>";
		var cols = Math.round(window.innerWidth / 300);

		for ( i = 0; i < progAdjusts.length; i++ ) {
			if (i % cols == 0) {
				if (i > 0)
					html += "</tr>";
				html += "<tr>";
			}
			html += "<td id='mainpageChart-"+i+"'/>";
		}
		if (i > 0)
			html += "</tr>";
		html += "</table></div>";

		for ( i = 0; i < analogSensors.length; i++ ) {
			var sensor = analogSensors[ i ];
			if ( sensor.show ) {
				html += "<div id='sensor-show-" + sensor.nr + "' class='ui-body ui-body-a center'>";
				html += "<label>" + sensor.name + ": " + formatValUnit( sensor.data, getUnit(sensor)) + "</label>";
				html += "</div>";
			}
		}
		while ( showArea.firstChild ) {
			showArea.removeChild( showArea.firstChild );
		}
		showArea.html( html );

		for ( i = 0; i < progAdjusts.length; i++ ) {
			var progAdjust = progAdjusts[ i ];
			var current = Math.round(progAdjust.current*100);

			var progName = "?";
			if ( progAdjust.prog >= 1 && progAdjust.prog <= controller.programs.pd.length ) {
				progName = readProgram( controller.programs.pd[ progAdjust.prog - 1 ] ).name;
			}

			var sensorName = "";
			for ( j = 0; j < analogSensors.length; j++ ) {
				if ( analogSensors[ j ].nr === progAdjust.sensor ) {
					sensorName = analogSensors[ j ].name;
				}
			}

			//current = 80; //testvalue!
			var color = ["#87D4F9"];
			if (current > 100)
				color = ["#FF8C00"];
			if (current > 150)
				color = ["#CD5C5C"];

			var min = Math.min(progAdjust.factor1, progAdjust.factor2) * 100;
			var max = Math.max(progAdjust.factor1, progAdjust.factor2) * 100;
			if (current < min) current = min;
			if (current > max) current = max;

			var options = {
				chart: {
				  height: 180,
				  type: "radialBar",
				  animations: {
				  	enabled: false,
				  	dynamicAnimation: {
				  		enabled: false
				  	}
				  }
				},

				series: [current],
				colors: ["#20E647"],
				plotOptions: {
				  radialBar: {
					startAngle: -135,
            		endAngle: 135,
					//hollow: {
					//  margin: 15,
					//  size: "70%"
					//},
					track: {
						dropShadow: {
						  enabled: true,
						  top: 2,
						  left: 0,
						  blur: 4,
						  opacity: 0.15
						}
					  },
					dataLabels: {
					  showOn: "always",
					  name: {
						offsetY: -10,
						show: true,
						color: "#222",
						fontSize: "13px"
					  },
					  value: {
						color: "#111",
						fontSize: "30px",
						show: true,
						formatter: function(val) {
							return formatValUnit(val, "%");
						}
					  }
					}
				  }
				},

				fill: {
					type: "gradient",
					gradient: {
					  shade: "dark",
					  type: "horizontal",
					  gradientToColors: color,
					  stops: [0,100]
					}
				  },
				stroke: {
				  lineCap: "round",
				},
				labels: [progName+" ("+sensorName+")"]
			  };

			  var chart = new ApexCharts(document.querySelector("#mainpageChart-"+i), options);

			  chart.render();
		}
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

// Restore from Backup - Dialog
function getImportMethodSensors( restore_type, callback) {

	let storageName = (restore_type==1)?"backupSensors":(restore_type==2)?"backupAdjustments":"backupAll";
	let localData = localStorage.getItem( storageName );

		callback = callback || function() {};
		var getPaste = function() {
			var popup = $(
				"<div data-role='popup' data-theme='a' id='paste_config'>" +
				"<p class='ui-bar'>" +
				"<textarea class='textarea' rows='10' placeholder='" + _( "Paste your backup here" ) + "'></textarea>" +
				"<button data-mini='true' data-theme='b'>" + _( "Import" ) + "</button>" +
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
					importConfigSensors( data, restore_type, callback );
				}catch ( err ) {
					popup.find( "textarea" ).val( "" );
					showerror( _( "Unable to read the configuration file. Please check the file and try again." ) );
				}
			} );

			popup.css( "width", ( width > 600 ? width * 0.4 + "px" : "100%" ) );
			openPopup( popup );
			return false;
		},
		popup = $(
			"<div data-role='popup' data-theme='a'>" +
			"<div class='ui-bar ui-bar-a'>" + _( "Select Import Method" ) + "</div>" +
			"<div data-role='controlgroup' class='tight'>" +
			"<button class='hidden fileMethod'>" + _( "File" ) + "</button>" +
			"<button class='pasteMethod'>" + _( "Email (copy/paste)" ) + "</button>" +
			"<button class='hidden localMethod'>" + _( "Internal (within app)" ) + "</button>" +
			"</div>" +
			"</div>" );

		if ( isFileCapable ) {
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
							importConfigSensors( obj, restore_type, callback );
						}catch ( err ) {
							showerror( _( "Unable to read the configuration file. Please check the file and try again." ) );
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
				importConfigSensors( JSON.parse( localData ), restore_type, callback );
				return false;
			} );
		}

		openPopup( popup );
}

// Restore from backup - send to OS
function importConfigSensors( data, restore_type, callback ) {
	callback = callback || function() {};
	var warning = "";

	if ( typeof data !== "object" || !data.backup ) {
		showerror( _( "Invalid configuration" ) );
		return;
	}

	areYouSure( _( "Are you sure you want to restore the configuration?" ), warning, function() {
		$.mobile.loading( "show" );

		if ((restore_type & 1) == 1 && data.hasOwnProperty("sensors")) { //restore Sensor
			var sensorOut;
			for (var i = 0; i < data.sensors.length; i++)
			{
				sensorOut = data.sensors[i];
				sendToOS( "/sc?pw=&nr=" + sensorOut.nr +
					"&type=" + sensorOut.type +
					"&group=" + sensorOut.group +
					"&name=" + enc( sensorOut.name ) +
					"&ip=" + sensorOut.ip +
					"&port=" + sensorOut.port +
					"&id=" + sensorOut.id +
					"&ri=" + sensorOut.ri +
					((sensorOut.type === USERDEF_SENSOR) ?
						("&fac=" + sensorOut.fac +
						"&div=" + sensorOut.div +
						"&offset=" + sensorOut.offset +
						"&unit="+ enc( sensorOut.unit )
						):"") +
					((sensorOut.type === SENSOR_MQTT) ?
						("&topic=" + enc( sensorOut.topic ) +
						"&filter=" + enc( sensorOut.filter ) +
						"&unit=" + enc( sensorOut.unit )
						):"") +
					"&enable=" + sensorOut.enable +
					"&log=" + sensorOut.log +
					"&show=" + sensorOut.show,
					"json");
			}
		}

		if ((restore_type & 2) == 2 && data.hasOwnProperty("progadjust")) { //restore program adjustments
			var progAdjustOut;
			for (var i = 0; i < data.progadjust.length; i++) {
				progAdjustOut = data.progadjust[i];
				return sendToOS( "/sb?pw=&nr=" + progAdjustOut.nr +
					"&type=" + progAdjustOut.type +
					"&sensor=" + progAdjustOut.sensor +
					"&prog=" + progAdjustOut.prog +
					"&factor1=" + progAdjustOut.factor1 +
					"&factor2=" + progAdjustOut.factor2 +
					"&min=" + progAdjustOut.min +
					"&max=" + progAdjustOut.max,
					"json");
			}
		}

		//analogSensors.expandItem.add("sensors");
		analogSensors.expandItem.clear();
		analogSensors.expandItem.add("progadjust");
		updateProgramAdjustments( function( ) {
			updateAnalogSensor( function( ) {
				$.mobile.loading( "hide" );
				showerror( _( "Backup restored to your device" ) );
				callback();
			} );
		} );

	} );
}

function getExportMethodSensors(backuptype) {
    let storageName = (backuptype==1)?"backupSensors":(backuptype==2)?"backupAdjustments":"backupAll";
    let filename = (backuptype==1)?"BackupSensorConfig":(backuptype==2)?"BackupSensorAdjustments":"BackupAll";

    sendToOS( "/sx?pw=&backup="+backuptype, "json" ).then( function( data ) {
        var popup = $(
                      "<div data-role='popup' data-theme='a'>" +
                      "<div class='ui-bar ui-bar-a'>" + _( "Select Export Method" ) + "</div>" +
                      "<div data-role='controlgroup' class='tight'>" +
                      "<a class='ui-btn hidden fileMethod'>" + _( "File" ) + "</a>" +
                      "<a class='ui-btn pasteMethod'>" + _( "Email" ) + "</a>" +
                      "<a class='ui-btn localMethod'>" + _( "Internal (within app)" ) + "</a>" +
                      "</div>" +
                      "</div>" ),
        obj = encodeURIComponent( JSON.stringify( data ) ),
        subject = "OpenSprinkler Sensor Export on " + dateToString( new Date() );

        if ( isFileCapable ) {
            popup.find( ".fileMethod" ).removeClass( "hidden" ).attr( {
                href: "data:text/json;charset=utf-8," + obj,
                download: filename+"-" + new Date().toLocaleDateString().replace( /\//g, "-" ) + ".json"
            } ).on( "click", function() {
                popup.popup( "close" );
            } );
        }

        var href = "mailto:?subject=" + encodeURIComponent( subject ) + "&body=" + obj;
        popup.find( ".pasteMethod" ).attr( "href", href ).on( "click", function() {
            window.open( href, isOSXApp ? "_system" : undefined );
            popup.popup( "close" );
        } );

        popup.find( ".localMethod" ).on( "click", function() {
            popup.popup( "close" );
            localStorage.setItem( storageName, JSON.stringify( data ) );
	    showerror( _( "Backup saved on this device" ) );
        } );

        openPopup( popup );
    });
}


//Program adjustments editor
function showAdjustmentsEditor( progAdjust, row, callback, callbackCancel ) {

	sendToOS( "/sh?pw=", "json" ).then( function( data ) {
		var supportedAdjustmentTypes = data.progTypes;
		var i;

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		var list = 
			"<div data-role='popup' data-theme='a' id='progAdjustEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<h1>" + ( progAdjust.nr > 0 ? _( "Edit Program Adjustment" ) : _( "New Program Adjustment" ) ) + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			_( "Notice: If you want to combine multiple sensors, then build a sensor group. " ) +
			_( "See help documentation for details." ) +
				"</p>" +

			"<div class='ui-field-contain'>" +

				//Adjustment-Nr:
				"<label>" +
					_( "Adjustment-Nr" ) +
				"</label>" +
				"<input class='nr' type='number' inputmode='decimal' min='1' max='99999' value='" + progAdjust.nr + ( progAdjust.nr > 0 ? "' disabled='disabled'>" : "'>" ) +

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
			_( "Factor 1 in % (adjustment for min)" ) +
					"</label>" +
					"<input class='factor1' type='number' inputmode='decimal' value='" + Math.round(progAdjust.factor1*100) + "'>" +

				"<label>" +
			_( "Factor 2 in % (adjustment for max)" ) +
					"</label>" +
					"<input class='factor2' type='number' inputmode='decimal' value='" + Math.round(progAdjust.factor2*100) + "'>" +

				"<label>" +
			_( "Min sensor value" ) +
					"</label>" +
					"<input class='min' type='number' value='" + progAdjust.min + "'>" +

				"<label>" +
			_( "Max sensor value" ) +
					"</label>" +
					"<input class='max' type='number' inputmode='decimal' value='" + progAdjust.max + "'>" +

				"</div>" +
				"<div id='adjchart'></div>"+
				"<button class='submit' data-theme='b'>" + _( "Submit" ) + "</button>" +

				((row < 0) ? "" : ("<a data-role='button' class='black delete-progadjust' value='" + progAdjust.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				_( "Delete" ) + "</a>")) +

				"</div>" +
			"</div>";

			let popup = $( list ),

			changeValue = function( pos, dir ) {
				var input = popup.find( ".inputs input" ).eq( pos ),
					val = parseInt( input.val() );

				if ( ( dir === -1 && val === 0 ) || ( dir === 1 && val === 100 ) ) {
					return;
				}

				input.val( val + dir );
			};

		//Delete a program adjust:
		popup.find( ".delete-progadjust" ).on( "click", function( ) {
			var dur = $( this ),
				value = dur.attr( "value" ),
				row = dur.attr( "row" );

			popup.popup( "close" );

			areYouSure( _( "Are you sure you want to delete this program adjustment?" ), value, function() {
				return sendToOS( "/sb?pw=&nr=" + value + "&type=0", "json" ).done( function( info ) {
					var result = info.result;
					if ( !result || result > 1 )
						showerror(_("Error calling rest service: ")+" "+result);
					else
						progAdjusts.splice( row, 1 );
					callbackCancel();
				} );
			} );
		} );

		let adjFunc = function() {
			updateAdjustmentChart(popup);
		};
		popup.find( "#sensor" ).change(adjFunc);
		popup.find( "#type" ).change(adjFunc);
		popup.find( ".factor1" ).change(adjFunc);
		popup.find( ".factor2" ).change(adjFunc);
		popup.find( ".min" ).change(adjFunc);
		popup.find( ".max" ).change(adjFunc);

		popup.find( ".submit" ).on( "click", function() {

			var progAdjust = getProgAdjust(popup);
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

		$( "#progAdjustEditor" ).remove();

		popup.css( "max-width", "580px" );

		adjFunc();
		openPopup( popup, { positionTo: "window" } );
	} );
}

const PROG_LINEAR =     	1; //formula see above
const PROG_DIGITAL_MIN = 	2; //under or equal min : factor1 else factor2
const PROG_DIGITAL_MAX =	3; //over or equal max  : factor2 else factor1
const PROG_DIGITAL_MINMAX = 4; //under min or over max : factor1 else factor2

function getProgAdjust(popup) {
	return {
		nr:      parseInt( popup.find( ".nr" ).val() ),
		type:    parseInt( popup.find( "#type" ).val() ),
		sensor:  parseInt( popup.find( "#sensor" ).val() ),
		prog:    parseInt( popup.find( "#prog" ).val() ),
		factor1: parseFloat( popup.find( ".factor1" ).val() / 100 ),
		factor2: parseFloat( popup.find( ".factor2" ).val() / 100 ),
		min: 	 parseFloat( popup.find( ".min" ).val() ),
		max: 	 parseFloat( popup.find( ".max" ).val() )
	};
}

function updateAdjustmentChart(popup) {

	let p = getProgAdjust(popup);
	sendToOS("/sd?pw=&type="+p.type+"&sensor="+p.sensor+"&factor1="+p.factor1+"&factor2="+p.factor2+"&min="+p.min+"&max="+p.max, "json").done( function(values) {
		if (!values || !values.hasOwnProperty("adjustment"))
			return;
		let adj = values.adjustment;
		if (!adj.hasOwnProperty("inval"))
			return;

		var sensor;
		for ( i = 0; i < analogSensors.length; i++ ) {
			if (p.sensor == analogSensors[ i ].nr) {
				sensor = analogSensors[ i ];
				break;
			}
		}

		let options = {
			chart: {
				height: 200,
				type: 'line',
				zoom: {
					enabled: false
				}
			},
			dataLabels: {
				enabled: false
			},
			stroke: {
				curve: 'straight'
			},
			title: {
				text: _("Adjustment preview"),
				align: 'left'
			},
			xaxis: {
				categories: adj.inval,
				tickAmount: Math.min(20, Math.min( screen.width / 30, adj.inval.length)),
				labels: {
					formatter: function(value) {
						return formatVal(value);
						},
					rotate: 0
				},
				title: {
					text: sensor.name + " " + adj.unit
				}
			},
			yaxis: {
				forceNiceScale: true,
				labels: {
					formatter: function(value) {
						return formatVal(value*100);
					}
				},
				title: {
					text: _("Adjustments in %")
				}
			},
			series: [{
				name: "Adjustment",
				type: "line",
				data: adj.outval
			}]
		};
		let sel = document.querySelector("#adjchart");
		if (sel) {
			while (sel.firstChild)
				sel.removeChild(sel.lastChild);
			let chart = new ApexCharts(sel, options);
			chart.render();
		}
	});
}

function isSmt100( sensorType ) {
	if ( !sensorType ) {
		return false;
	}
	return sensorType === 1 || sensorType == 2;
}

function isIPSensor( sensorType ) {
	return sensorType <= 2 || sensorType == 100;
}

function isIDNeeded( sensorType) {
	return sensorType < 90 || sensorType == 100;
}

//show and hide sensor editor fields
function updateSensorVisibility(popup, type) {
	if (isIPSensor(type)) {
		popup.find(".ip_label").show();
		popup.find(".port_label").show();
		popup.find(".ip").show();
		popup.find(".port").show();
	} else {
		popup.find(".ip_label").hide();
		popup.find(".port_label").hide();
		popup.find(".ip").hide();
		popup.find(".port").hide();
	}
	if (isIDNeeded(type)) {
		popup.find(".id_label").show();
		popup.find(".id").show();
	} else {
		popup.find(".id_label").hide();
		popup.find(".id").hide();
	}
	if (isSmt100(type)) {
		popup.find("#smt100id").show();
	} else {
		popup.find("#smt100id").hide();
	}
	if (type == USERDEF_SENSOR) {
		popup.find(".fac_label").show();
		popup.find(".fac").show();
		popup.find(".div_label").show();
		popup.find(".div").show();
		popup.find(".offset_label").show();
		popup.find(".offset").show();
	} else {
		popup.find(".fac_label").hide();
		popup.find(".fac").hide();
		popup.find(".div_label").hide();
		popup.find(".div").hide();
		popup.find(".offset_label").hide();
		popup.find(".offset").hide();
	}
	if (type == SENSOR_MQTT) {
		popup.find(".unit_label").show();
		popup.find(".unit").show();
		popup.find(".topic_label").show();
		popup.find(".topic").show();
		popup.find(".filter_label").show();
		popup.find(".filter").show();
	} else {
		popup.find(".unit_label").hide();
		popup.find(".unit").hide();
		popup.find(".topic_label").hide();
		popup.find(".topic").hide();
		popup.find(".filter_label").hide();
		popup.find(".filter").hide();
	}
	if (type == SENSOR_MQTT || type == USERDEF_SENSOR) {
		popup.find(".unit_label").show();
		popup.find(".unit").show();
	} else {
		popup.find(".unit_label").hide();
		popup.find(".unit").hide();
	}
}

// Analog sensor editor
 function showSensorEditor( sensor, row, callback, callbackCancel ) {

	sendToOS( "/sf?pw=", "json" ).then( function( data ) {
		var supportedSensorTypes = data.sensorTypes;
		var i;

	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	var list = "<div data-role='popup' data-theme='a' id='sensorEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<h1>" + ( sensor.nr > 0 ? _( "Edit Sensor" ) : _( "New Sensor" ) ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			_( "Edit Sensor Configuration. " ) +
			_( "See help documentation for details." ) +
			"<br>"+
			_("Last")+": "+(sensor.last === undefined?"" : dateToString(new Date(sensor.last*1000)))+
			"</p>" +
			"<div class='ui-field-contain'>" +
			"<label>" +
			_( "Sensor-Nr" ) +
			"</label>" +
			"<input class='nr' type='number' inputmode='decimal' min='1' max='99999' value='" + sensor.nr + ( sensor.nr > 0 ? "' disabled='disabled'>" : "'>" ) +

			"<div class='ui-field-contain'><label for='type' class='select'>" +
			_( "Type" ) +
			"</label><select data-mini='true' id='type'>";

		for ( i = 0; i < supportedSensorTypes.length; i++ ) {
			list += "<option " + ( ( sensor.type === supportedSensorTypes[ i ].type ) ? "selected" : "" ) +
				" value='" + supportedSensorTypes[ i ].type + "'>" +
				supportedSensorTypes[ i ].name + "</option>";
		}
		list += "</select></div>";

		list += "<button data-mini='true' class='center-div' id='smt100id'>" + _( "Set SMT100 Modbus ID" ) + "</button>";

		list += "<label>" + _( "Group" ) +
			"</label>" +
			"<input class='group' type='number'  inputmode='decimal' min='0' max='99999' value='" + sensor.group + "'>" +

			"<label>" + _( "Name" ) +
			"</label>" +
			"<input class='name' type='text'  value='" + sensor.name + "'>" +

			"<label class='ip_label'>" + _( "IP Address" ) +
			"</label>" +
			"<input class='ip' type='text'  value='" + ( sensor.ip ? toByteArray( sensor.ip ).join( "." ) : "" ) + "'>" +

			"<label class='port_label'>" + 	_( "Port" ) +
			"</label>" +
			"<input class='port' type='number' inputmode='decimal' min='0' max='65535' value='" + sensor.port + "'>" +

			"<label class='id_label'>" + _( "ID" ) +
			"</label>" +
			"<input class='id' type='number' inputmode='decimal' min='0' max='65535' value='" + sensor.id + "'>" +

			"<label class='fac_label'>" + _( "Factor" ) +
			"</label>" +
			"<input class='fac' type='number' inputmode='decimal' min='-32768' max='32767' value='" + sensor.fac + "'>" +

			"<label class='div_label'>" + _( "Divider" ) +
			"</label>" +
			"<input class='div' type='number' inputmode='decimal' min='-32768' max='32767' value='" + sensor.div + "'>" +

			"<label class='offset_label'>" + _( "Offset in millivolt" ) +
			"</label>" +
			"<input class='offset' type='number' inputmode='decimal' min='-32768' max='32767' value='" + sensor.offset + "'>" +

			"<label class='chartunit_label'>" + _( "Chart Unit" ) +
			"</label>" +
            "<select data-mini='true' id='chartunits'>" +
            "<option value='0'>" + _("Default") + "</option>" +
            "<option value='1'>" + _("Soil Moisture %") + "</option>" +
            "<option value='2'>" + _("Degree Celcius "+String.fromCharCode( 176 ) + "C") + "</option>" +
            "<option value='3'>" + _("Degree Fahrenheit "+String.fromCharCode( 176 ) + "F") + "</option>" +
            "<option value='4'>" + _("Volt V") + "</option>" +
            "<option value='5'>" + _("Air Humidity %") + "</option>" +
            "<option value='6'>" + _("Inch in") + "</option>" +
            "<option value='7'>" + _("Millimeter mm") + "</option>" +
            "<option value='8'>" + _("MPH") + "</option>" +
            "<option value='9'>" + _("KM/H") + "</option>" +
            "<option value='10'>" + _("Level %") + "</option>" +
            "<option value='99'>" + _("Own Unit") + "</option>" +
            "</select>" +

            "<label class='unit_label'>" + _( "Unit" ) +
            "</label>" +
            "<input class='unit' type='text'  value='" + (sensor.unit?sensor.unit:"") + "'>" +

			"<label class='topic_label'>" + _( "MQTT Topic" ) +
			"</label>" +
			"<input class='topic' type='text'  value='" + (sensor.topic?sensor.topic:"") + "'>" +

			"<label class='filter_label'>" + _( "MQTT Filter" ) +
			"</label>" +
			"<input class='filter' type='text'  value='" + (sensor.filter?sensor.filter:"") + "'>" +

			"<label>" + _( "Read Interval (s)" ) +
			"</label>" +
			"<input class='ri' type='number' inputmode='decimal' min='1' max='999999' value='" + sensor.ri + "'>" +

			"<label for='enable'><input data-mini='true' id='enable' type='checkbox' " + ( ( sensor.enable === 1 ) ? "checked='checked'" : "" ) + ">" +
			_( "Sensor Enabled" ) +
			"</label>" +

			"<label for='log'><input data-mini='true' id='log' type='checkbox' " + ( ( sensor.log === 1 ) ? "checked='checked'" : "" ) + ">" +
			_( "Enable Data Logging" ) +
			"</label>" +

			"<label for='show'><input data-mini='true' id='show' type='checkbox' " + ( ( sensor.show === 1 ) ? "checked='checked'" : "" ) + ">" +
			_( "Show on Mainpage" ) +
			"</label>" +

			"</div>" +

			"<button class='submit' data-theme='b'>" + _( "Submit" ) + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-sensor' value='" + sensor.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				_( "Delete" ) + "</a>")) +

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

	popup.find( "#type" ).change(function() {
		var type = $(this).val();
		updateSensorVisibility(popup, type);
	});

	//SMT 100 Toolbox function: SET ID
	popup.find( "#smt100id" ).on( "click", function() {
		var nr    = parseInt( popup.find( ".nr" ).val() ),
			newid = parseInt( popup.find( ".id" ).val() );
		popup.popup( "close" );
		areYouSure( _( "This function sets the Modbus ID for one SMT100 sensor. Disconnect all other sensors on this Modbus port. Please confirm." ),
		"new id=" + newid, function() {
			sendToOS( "/sa?pw=&nr=" + nr + "&id=" + newid ).done( function() {
				window.alert( _( "SMT100 id assigned!" ) );
				updateAnalogSensor( callbackCancel );
			} );
		} );
	} );
	popup.find( "#type" ).change( function() {
		var type = parseInt( popup.find( "#type" ).val() );
		document.getElementById( "smt100id" ).style.display = isSmt100( type ) ? "block" : "none";
	} );

	//Delete a sensor:
	popup.find( ".delete-sensor" ).on( "click", function() {

		var dur = $( this ),
		value = dur.attr( "value" ),
		row = dur.attr( "row" );

		popup.popup( "close" );

		areYouSure( _( "Are you sure you want to delete the sensor?" ), value, function() {
			return sendToOS( "/sc?pw=&nr=" + value + "&type=0", "json" ).done( function( info ) {
				var result = info.result;
				if ( !result || result > 1 )
					showerror(_("Error calling rest service: ")+" "+result);
				else
					analogSensors.splice( row, 1 );
				updateAnalogSensor( callbackCancel );
			} );
		} );
	} );

	popup.find("#chartunits").val(sensor.unitid?sensor.unitid:0).change();

	popup.find( ".submit" ).on( "click", function() {

		if ( !sensor.nr ) { //New Sensor - check existing Nr to avoid overwriting
			var nr = parseInt( popup.find( ".nr" ).val() );
			for ( var i = 0; i < analogSensors.length; i++ ) {
				if ( analogSensors[ i ].nr === nr ) {
					window.alert( _( "Sensor number exists!" ) );
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
			fac:    parseInt( popup.find( ".fac" ).val() ),
			div:    parseInt( popup.find( ".div" ).val() ),
			offset: parseInt( popup.find( ".offset" ).val() ),
			unit:   popup.find( ".unit" ).val(),
            unitid: popup.find( "#chartunits" ).val(),
			enable: popup.find( "#enable" ).is( ":checked" ) ? 1 : 0,
			log:    popup.find( "#log" ).is( ":checked" ) ? 1 : 0,
			show:   popup.find( "#show" ).is( ":checked" ) ? 1 : 0,
			topic:  popup.find( ".topic" ).val(),
			filter: popup.find( ".filter" ).val()
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

	updateSensorVisibility(popup, sensor.type);

	openPopup( popup, { positionTo: "window" } );
} );
}

// Config Page
function showAnalogSensorConfig() {
	var page = $( "<div data-role='page' id='analogsensorconfig'>" +
			"<div class='ui-content' role='main' id='analogsensorlist'>" +
			"</div></div>" );

	page
		.on( "sensorrefresh", updateSensorContent )
		.on( "pagehide", function() {
			page.detach();
		} );

	function updateSensorContent() {
		var list = $( buildSensorConfig( analogSensors.expandItem ) );

		//Edit a sensor:
		list.find( ".edit-sensor" ).on( "click", function( ) {
			var dur = $( this ),
			row = dur.attr( "row" );

			var sensor = analogSensors[ row ];

			analogSensors.expandItem.clear();
			analogSensors.expandItem.add("sensors");
			showSensorEditor( sensor, row, function( sensorOut ) {
				sensorOut.nativedata = sensor.nativedata;
				sensorOut.data = sensor.data;
				sensorOut.last = sensor.last;
				return sendToOS( "/sc?pw=&nr=" + sensorOut.nr +
					"&type=" + sensorOut.type +
					"&group=" + sensorOut.group +
					"&name=" + enc( sensorOut.name ) +
					"&ip=" + sensorOut.ip +
					"&port=" + sensorOut.port +
					"&id=" + sensorOut.id +
					"&ri=" + sensorOut.ri +
                    "&unitid=" + sensorOut.unitid +
					((sensorOut.type === USERDEF_SENSOR) ?
						("&fac=" + sensorOut.fac +
						"&div=" + sensorOut.div +
						"&offset=" + sensorOut.offset +
						"&unit="+ enc( sensorOut.unit )
						):"") +
					((sensorOut.type === SENSOR_MQTT) ?
						("&topic=" + enc( sensorOut.topic ) +
						"&filter=" + enc( sensorOut.filter ) +
						"&unit=" + enc( sensorOut.unit )
						):"") +
					"&enable=" + sensorOut.enable +
					"&log=" + sensorOut.log +
					"&show=" + sensorOut.show,
					"json"
				).done( function( info ) {
					var result = info.result;
					if ( !result || result > 1 )
						showerror(_("Error calling rest service: ")+" "+result);
					else
						analogSensors[ row ] = sensorOut;
					updateSensorContent();
				} );
			}, updateSensorContent );
		} );

		// Add a new analog sensor:
		list.find( ".add-sensor" ).on( "click", function( ) {
			var sensor = {
				name: "new sensor",
				type: 1,
				ri: 600,
				enable: 1,
				log: 1
			};

			showSensorEditor( sensor, -1, function( sensorOut ) {
				return sendToOS( "/sc?pw=&nr=" + sensorOut.nr +
				"&type=" + sensorOut.type +
				"&group=" + sensorOut.group +
				"&name=" + enc( sensorOut.name ) +
				"&ip=" + sensorOut.ip +
				"&port=" + sensorOut.port +
				"&id=" + sensorOut.id +
				"&ri=" + sensorOut.ri +
                "&unitid=" + sensorOut.unitid +
				((sensorOut.type === USERDEF_SENSOR) ?
					("&fac=" + sensorOut.fac +
					"&div=" + sensorOut.div +
					"&offset=" + sensorOut.offset +
					"&unit=" + enc( sensorOut.unit )
					):"") +
				((sensorOut.type === SENSOR_MQTT) ?
					("&topic=" + enc( sensorOut.topic ) +
					"&filter=" + enc( sensorOut.filter ) +
					"&unit=" + enc( sensorOut.unit )
					):"") +
				"&enable=" + sensorOut.enable +
				"&log=" + sensorOut.log +
				"&show=" + sensorOut.show,
				"json"
				).done( function( info ) {
					var result = info.result;
					if ( !result || result > 1 )
						showerror(_("Error calling rest service: ")+" "+result);
					else {
						analogSensors.push( sensorOut );
						analogSensors.expandItem.clear();
						analogSensors.expandItem.add("sensors");
					}
					updateSensorContent();
				} );
			}, updateSensorContent );
		} );

		// Refresh sensor data:
		list.find( ".refresh-sensor" ).on( "click", function( ) {
			analogSensors.expandItem.clear();
			analogSensors.expandItem.add("sensors");
			updateProgramAdjustments( function( ) {
				updateAnalogSensor( function( ) {
					updateSensorContent();
				} );
			} );
		} );

		//Edit a program adjust:
		list.find( ".edit-progadjust" ).on( "click", function( ) {
			var dur = $( this ),
			row = dur.attr( "row" );

			var progAdjust = progAdjusts[ row ];

			analogSensors.expandItem.clear();
			analogSensors.expandItem.add("progadjust");
			showAdjustmentsEditor( progAdjust, row, function( progAdjustOut ) {

				return sendToOS( "/sb?pw=&nr=" + progAdjustOut.nr +
					"&type=" + progAdjustOut.type +
					"&sensor=" + progAdjustOut.sensor +
					"&prog=" + progAdjustOut.prog +
					"&factor1=" + progAdjustOut.factor1 +
					"&factor2=" + progAdjustOut.factor2 +
					"&min=" + progAdjustOut.min +
					"&max=" + progAdjustOut.max,
					"json"
				).done( function( info ) {
					var result = info.result;
					if ( !result || result > 1 )
						showerror(_("Error calling rest service: ")+" "+result);
					else
						progAdjusts[ row ] = progAdjustOut;
					updateProgramAdjustments( updateSensorContent );
				} );
			}, updateSensorContent );
		} );

		//Add a new program adjust:
		list.find( ".add-progadjust" ).on( "click", function( ) {
			var progAdjust = {
				type: 1
			};

			analogSensors.expandItem.clear();
			analogSensors.expandItem.add("progadjust");
			showAdjustmentsEditor( progAdjust, -1, function( progAdjustOut ) {
				return sendToOS( "/sb?pw=&nr=" + progAdjustOut.nr +
					"&type=" + progAdjustOut.type +
					"&sensor=" + progAdjustOut.sensor +
					"&prog=" + progAdjustOut.prog +
					"&factor1=" + progAdjustOut.factor1 +
					"&factor2=" + progAdjustOut.factor2 +
					"&min=" + progAdjustOut.min +
					"&max=" + progAdjustOut.max,
					"json"
				).done( function( info ) {
					var result = info.result;
					if ( !result || result > 1 )
						showerror(_("Error calling rest service: ")+" "+result);
					else
						progAdjusts.push( progAdjustOut );
					updateProgramAdjustments( updateSensorContent );
				} );
			}, updateSensorContent );
		} );

		// Clear sensor log
		list.find( ".clear_sensor_logs" ).on( "click", function() {
			analogSensors.expandItem.clear();
			analogSensors.expandItem.add("sensorlog");
			areYouSure( _( "Are you sure you want to clear the sensor log?" ), "", function() {
				return sendToOS( "/sn?pw=&", "json" ).done( function( result ) {
					window.alert( _( "Log cleared:" ) + " " + result.deleted + " " + _( "records" ) );
					updateSensorContent();
				} );
			} );
		} );

		list.find( ".download-log" ).on( "click", function() {
			analogSensors.expandItem.clear();
			analogSensors.expandItem.add("sensorlog");
			var link = document.createElement( "a" );
			link.style.display = "none";
			link.setAttribute( "download", "sensorlog-" + new Date().toLocaleDateString().replace( /\//g, "-" ) + ".csv" );

			var limit = currToken?"&max=5500":""; //download limit is 140kb, 5500 lines ca 137kb
			var dest = "/so?pw=&csv=1"+limit;
			dest = dest.replace( "pw=", "pw=" + enc( currPass ) );
			link.target = "_blank";
			link.href = currToken ? ("https://cloud.openthings.io/forward/v1/" + currToken + dest) : (currPrefix + currIp + dest);
			document.body.appendChild( link ); // Required for FF
			link.click();
			return false;
		} );

		list.find( ".show-log" ).on( "click", function() {
			analogSensors.expandItem.clear();
			analogSensors.expandItem.add("sensorlog");
			changePage( "#analogsensorchart" );
			return false;
		} );

		list.find( ".backup-sensors" ).on( "click", function() {
			analogSensors.expandItem.clear();
            analogSensors.expandItem.add("backup");
            getExportMethodSensors(1);
            return false;
		} );

		list.find( ".restore-sensors" ).on( "click", function() {
			analogSensors.expandItem.clear();
			analogSensors.expandItem.add("backup");
			getImportMethodSensors(1, updateSensorContent);
			return false;
		} );

		list.find( ".backup-adjustments" ).on( "click", function() {
			analogSensors.expandItem.clear();
            analogSensors.expandItem.add("backup");
            getExportMethodSensors(2);
            return false;
		} );

		list.find( ".restore-adjustments" ).on( "click", function() {
			analogSensors.expandItem.clear();
			analogSensors.expandItem.add("backup");
			getImportMethodSensors(2, updateSensorContent);
			return false;
		} );

		page.find( "#analogsensorlist" ).html( list ) .enhanceWithin();
	}

	changeHeader( {
		title: _( "Analog Sensor Config" ),
		leftBtn: {
			icon: "carat-l",
			text: _( "Back" ),
			class: "ui-toolbar-back-btn",
			on: goBack
		},
		rightBtn: {
			icon: "refresh",
			text: screen.width >= 500 ?_( "Refresh" ) : "",
			on: updateSensorContent
		}
	} );

	updateSensorContent();

	$( "#analogsensorconfig" ).remove();
	$.mobile.pageContainer.append( page );
}

function checkFirmwareUpdate() {
	return (checkOSVersion(CURRENT_FW_ID) && controller.options.fwm >= CURRENT_FW_MIN)?"" : (_("Please update firmware to ") + CURRENT_FW);
}

function buildSensorConfig( expandItem ) {
	var list = "<fieldset data-role='collapsible'" + ( expandItem.has("sensors") ? " data-collapsed='false'" : "" ) + ">" +
	"<legend>" + _( "Sensors" ) + "</legend>";

	list += "<table id='analog_sensor_table'><tr style='width:100%;vertical-align: top;'>" +
		checkFirmwareUpdate()+
		"<tr><th>"+_("Nr")+"</th><th class=\"hidecol\">"+_("Type")+"</th><th class=\"hidecol\">"+_("Group")+"</th><th>"+_("Name")+"</th>"+
		"<th class=\"hidecol\">"+_("IP")+"</th><th class=\"hidecol\">"+_("Port")+"</th><th class=\"hidecol\">"+_("ID")+"</th>"+
		"<th class=\"hidecol\">"+_("Read")+"<br>"+_("Interval")+"</th><th>"+_("Data")+"</th><th>"+_("En")+"</th>"+
		"<th class=\"hidecol\">"+_("Log")+"</th><th class=\"hidecol\">"+_("Show")+"</th><th class=\"hidecol2\">"+_("Last")+"</th></tr>";

		var checkpng = "<img src=\""+getAppURLPath() + "img/check-blue.png\">";

		var row = 0;
		$.each( analogSensors, function( i, item ) {

			var $tr = $( "<tr>" ).append(
				$("<td>"                  ).text(item.nr),
				$("<td class=\"hidecol\">").text(item.type),
				$("<td class=\"hidecol\">").text(item.group?item.group:""),
				"<td><a data-role='button' class='edit-sensor' value='" + item.nr + "' row='" + row + "' href='#' data-mini='true' data-icon='edit'>" +
				item.name + "</a></td>",
				$("<td class=\"hidecol\">").text(item.ip?toByteArray(item.ip).join( "." ):""),
				$("<td class=\"hidecol\">").text(item.port?(":"+item.port):""),
				$("<td class=\"hidecol\">").text(isNaN(item.id)?"":(item.type < 1000?item.id:"")),
				$("<td class=\"hidecol\">").text(isNaN(item.ri)?"":item.ri),
				$("<td>"                  ).text(isNaN(item.data)?"":(formatVal( item.data ) + item.unit) ),
				"<td>"                  +(item.enable?checkpng:"")+"</td>",
				"<td class=\"hidecol\">"+(item.log?checkpng:"")+"</td>",
				"<td class=\"hidecol\">"+(item.show?checkpng:"")+"</td>",
				$("<td class=\"hidecol2\">").text(item.last === undefined?"" : (item.data_ok?dateToString(new Date(item.last*1000)):""), null, 2)
			);
			list += $tr.wrap( "<p>" ).html() + "</tr>";
			row++;
		} );
		list += "</table>";
		list += "<a data-role='button' class='add-sensor'     href='#' data-mini='true' data-icon='plus'   >" +
			_( "Add Sensor" ) + "</a>";
		list += "<a data-role='button' class='refresh-sensor' href='#' data-mini='true' data-icon='refresh'>" +
			_( "Refresh Sensordata" ) + "</a>";
		list += "</fieldset>";

		//Program adjustments table:
		list += "<fieldset data-role='collapsible'" + ( expandItem.has("progadjust") ? " data-collapsed='false'" : "" ) + ">" +
		"<legend>" + _( "Program Adjustments" ) + "</legend>";
		list += "<table id='progadjusttable'><tr style='width:100%;vertical-align: top;'>" +
		"<tr><th>"+_("Nr")+"</th>"+
		"<th class=\"hidecol\">"+_("Type")+"</th>"+
		"<th class=\"hidecol2\">"+_("S.Nr")+"</th>"+
		"<th>"+_("Name")+"</th>"+
		"<th class=\"hidecol\">Program-Nr</th>"+
		"<th class=\"hidecol2\">"+_("Program")+"</th>"+
		"<th class=\"hidecol2\">"+_("Factor 1")+"</th>"+
		"<th class=\"hidecol2\">"+_("Factor 2")+"</th>"+
		"<th class=\"hidecol2\">"+_("Min Value")+"</th>"+
		"<th class=\"hidecol2\">"+_("Max Value")+"</th>"+
		"<th>"+_("Cur")+"</th></tr>";


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
				$("<td class=\"hidecol2\">").text(item.sensor),
				"<td><a data-role='button' class='edit-progadjust' value='" + item.nr + "' row='" + row + "' href='#' data-mini='true' data-icon='edit'>" +
				sensorName + "</a></td>",
				$("<td class=\"hidecol\">").text(item.prog),
				$("<td class=\"hidecol2\">").text(progName),
				$("<td class=\"hidecol2\">").text(Math.round(item.factor1*100)+"%"),
				$("<td class=\"hidecol2\">").text(Math.round(item.factor2*100)+"%"),
				$("<td class=\"hidecol2\">").text(item.min),
				$("<td class=\"hidecol2\">").text(item.max),
				$("<td>").text(item.current === undefined?"":(Math.round(item.current*100.0)+"%"))
			);
			list += $tr.wrap( "<p>" ).html() + "</tr>";
			row++;
		} );
		list += "</table>";
		list += "<a data-role='button' class='add-progadjust' href='#' data-mini='true' data-icon='plus'>" + _( "Add program adjustment" ) + "</a>";
		list += "</fieldset>";

		//Analog sensor logs:
		list += "<fieldset data-role='collapsible'" + ( expandItem.has("sensorlog") ? " data-collapsed='false'" : "" ) + ">" +
				"<legend>" + _( "Sensor Log" ) + "</legend>";
		list += "<a data-role='button' class='red clear_sensor_logs' href='#' data-mini='true' data-icon='alert'>" +
						_( "Clear Log" ) +
					"</a>" +
			"<a data-role='button' data-icon='action' class='download-log' href='#' data-mini='true'>" + _( "Download Log" ) + "</a>" +
			"<a data-role='button' data-icon='grid' class='show-log' href='#' data-mini='true'>" + _( "Show Log" ) + "</a>" +

			"</div></fieldset>";

		//backup:
		if (checkOSVersion( 231 )) {
			list += "<fieldset data-role='collapsible'" + ( expandItem.has("backup") ? " data-collapsed='false'" : "" ) + ">" +
				"<legend>" + _( "Backup and Restore" ) + "</legend>";
			list += "<a data-role='button' data-icon='arrow-d-r' class='backup-sensors'  href='#' data-mini='true'>" + _( "Backup Sensor Config" ) + "</a>" +
				"<a data-role='button' data-icon='back'      class='restore-sensors' href='#' data-mini='true'>" + _( "Restore Sensor Config" ) + "</a>";
			list += "<a data-role='button' data-icon='arrow-d-r' class='backup-adjustments'  href='#' data-mini='true'>" + _( "Backup Program Adjustments" ) + "</a>" +
				"<a data-role='button' data-icon='back'      class='restore-adjustments' href='#' data-mini='true'>" + _( "Restore Program Adjustments" ) + "</a>";
			list += "</div></fieldset>";
		}
	return list;
}

// Show Sensor Charts with apexcharts
function showAnalogSensorCharts() {

		var max = CHARTS;
		for ( var j = 0; j < analogSensors.length; j++ ) {
			if (!analogSensors[j].log || !analogSensors[j].enable)
				continue;
			var unitid = analogSensors[j].unitid;
			if (unitid === USERDEF_UNIT) max++;
		}

		var last = "", week = "", month = "";
		for ( var j = 1; j <= max; j++ ) {
			last  += "<div id='myChart"+j+"'></div>";
			week  += "<div id='myChartW"+j+"'></div>";
			month += "<div id='myChartM"+j+"'></div>";
		}

		var page = $( "<div data-role='page' id='analogsensorchart'>" +
			"<div class='ui-content' role='main' style='width: 95%'>" +
			last + week + month +
			"</div></div>" );

		changeHeader( {
			title: _( "Analog Sensor Log" ),
			leftBtn: {
				icon: "carat-l",
				text: _( "Back" ),
				class: "ui-toolbar-back-btn",
				on: goBack
			},
			rightBtn: {
				icon: "refresh",
				text: screen.width >= 500 ?_( "Refresh" ) : "",
				on: updateCharts
			}
		} );

		page.one( "pagehide", function() {
			page.detach();
		} );

		$( "#analogsensorchart" ).remove();
		$.mobile.pageContainer.append( page );

		updateCharts();
}

function updateCharts() {
	var chart1 = new Array(CHARTS),
		chart2 = new Array(CHARTS),
		chart3 = new Array(CHARTS),
		datalimit = false;

	var limit = currToken?"&max=5500":""; //download limit is 140kb, 5500 lines ca 137kb

	$.mobile.loading( "show" );
	sendToOS("/so?pw=&lasthours=48&csv=2"+limit, "text").then(function (csv1) {
		buildGraph( "#myChart", chart1, csv1, _( "last 48h" ), "HH:mm", 0 );

		sendToOS("/so?pw=&csv=2&log=1"+limit, "text").then(function (csv2) {
			buildGraph( "#myChartW", chart2, csv2, _( "last weeks" ), "dd.MM.yyyy", 1 );

			sendToOS("/so?pw=&csv=2&log=2"+limit, "text").then(function (csv3) {
				buildGraph( "#myChartM", chart3, csv3, _( "last months" ), "MM.yyyy", 2 );
				$.mobile.loading( "hide" );
			});
		});
	});
}

function buildGraph( prefix, chart, csv, titleAdd, timestr, lvl ) {
	var csvlines = csv.split( /(?:\r\n|\n)+/ ).filter( function( el ) { return el.length !== 0; } );

	var legends = [], opacities = [], widths = [], colors = [], coloridx = 0;
	for ( var j = 0; j < analogSensors.length; j++ ) {
		var sensor = analogSensors[j];
		let color = COLORS[coloridx++ % COLCOUNT];
		if (!sensor.log || !sensor.enable) {
			continue;
		}
		var nr = sensor.nr,
			logdata = [],
			rngdata = [],
			logmap = new Map(),
			unitid = sensor.unitid;

		for ( var k = 1; k < csvlines.length; k++ ) {
			var line = csvlines[ k ].split( ";" );
			if (line.length >= 3 && Number(line[0]) === nr ) {
				let date = Number(line[1]);
				let value = Number(line[2]);
				if (value === undefined || date === undefined) continue;
				if (unitid != 3 && value > 100) continue;
				if (unitid == 1 && value < 0) continue;
				if (lvl == 0) //day values
					logdata.push( { x: date * 1000, y: value } );
				else {
					var key;
					var fac;
					if (lvl == 1) //week values
						fac = 7*24*60*60;
					else //month values
						fac = 30*24*60*60;
					key = Math.trunc(date / fac) * fac * 1000;

					var minmax = logmap.get(key);
					if (!minmax)
						minmax = {min: value, max: value};
					else
						minmax = {min: Math.min(minmax.min, value), max: Math.max(minmax.max, value)};
					logmap.set(key, minmax);
				}
			}
		}

		if (lvl > 0) {
			for (let [ key, value ] of logmap) {
				rngdata.push( { x : key, y : [ value.min, value.max ] } );
				logdata.push( { x : key, y : ( value.max + value.min ) / 2 } );
			}
		}

		if (logdata.length < 3) continue;

		//add current value as forecast data:
		let date = new Date();
		date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

		let value = sensor.data? sensor.data : logdata.slice(-1)[0].y;
		logdata.push( { x : date, y : sensor.data } );

		if (lvl > 0) {
			let rng = rngdata.slice(-1)[0].y;
			let diff = ( rng[1] - rng[0] ) / 2;
			rngdata.push( { x : date, y : [ value - diff, value + diff ] } );
		}

		// User defined sensor:
		if (unitid === USERDEF_UNIT) {
			unitid = chart.length;
			chart.push(undefined);
		} else if (unitid >= CHARTS) {
			unitid = 0;
		}

		if (!legends[unitid])
			legends[unitid] = [sensor.name];
		else
			legends[unitid].push(sensor.name);
		if (!opacities[unitid])
			opacities[unitid] = [1];
		else
			opacities[unitid].push(1);
		if (!widths[unitid])
			widths[unitid] = [4];
		else
			widths[unitid].push(4);

		if (!colors[unitid])
			colors[unitid] = [color];
		else
			colors[unitid].push(color);

		var series = { name: sensor.name, type: "line", data: logdata, color: color };

		if (!chart[unitid]) {
			var unit, title, unitStr,
				minFunc = function( val ) { return Math.floor( val > 0 ? Math.max( 0, val - 4 ) : val - 1 ); },
				maxFunc = function( val ) { return Math.ceil( val ); },
				autoY = true;
			switch (unitid) {
				case 1: unit = _("Soil moisture");
					title = _( "Soil moisture" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case 2: unit = _("degree celsius temperature");
					title = _( "Temperature" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + String.fromCharCode( 176 ) + "C"; };
					break;
				case 3: unit = _("degree fahrenheit temperature");
					title = _( "Temperature" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + String.fromCharCode( 176 ) + "F"; };
					break;
				case 4: unit = _("Volt");
					title = _( "Voltage" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + " V"; };
					minFunc = 0;
					maxFunc = 4;
					autoY = false;
					break;
				case 5: unit = _("Humidity");
					title = _( "Air Humidity" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case 6: unit = _("Rain");
					title = _( "Rainfall" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + " in"; };
					break;
				case 7: unit = _("Rain");
					title = _( "Rainfall" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + " mm"; };
					minFunc = 0;
					break;
				case 8: unit = _("Wind");
					title = _( "Wind" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + " mph"; };
					minFunc = 0;
					break;
				case 9: unit = _("Wind");
					title = _( "Wind" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + " kmh"; };
					minFunc = 0;
					break;
				case 10: unit = _("Level");
					title = _( "Level" ) + " " + titleAdd;
					unitStr = function( val ) { return formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					autoY = false;
					break;

				default: unit = sensor.unit;
					title = sensor.name + "~ " + titleAdd;
					unitStr = function( val ) { return formatVal(val); };
			};

			let canExport = !window.hasOwnProperty("cordova");
			let options = {
				chart: {
					type: 'rangeArea',
	          			animations: {
	        	    			speed: 500
          				},
					stacked: false,
					width: '100%',
					height: (screen.height>screen.width?screen.height:screen.width) / 3,
					toolbar: {
						download: canExport
					}
				},
				dataLabels: {
					enabled: false
				},
				fill: {
					colors: colors[unitid],
					opacity: opacities[unitid],
				},
				series: [series],
				stroke: {
					curve: "smooth",
					colors: colors[unitid],
					width: widths[unitid],
					dashArray: 0
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
						format: timestr
					}
				},
				xaxis: {
					type: "datetime",
					labels: {
						datetimeUTC : true,
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
				legend: {
					showForSingleSeries: true,
					fontSize: "10px"
				},
				title: { text: title }
			};

			chart[unitid] = new ApexCharts(document.querySelector(prefix + unitid), options);
			chart[unitid].render();
		} else {
			chart[unitid].appendSeries(series);
		}

		if (lvl > 0) {
			opacities[unitid].push(0.24);
			widths[unitid].push(0);
			colors[unitid].push(color);
			rangeArea = {
				type: 'rangeArea',
				name: [],
				color: color,
				data: rngdata
			};
			var otherOptions = {
				fill: {
					colors: colors[unitid],
					opacity: opacities[unitid]
				},
				stroke: {
					curve: "smooth",
					colors: colors[unitid],
					width: widths[unitid],
					dashArray: 0
				}
			};
			chart[unitid].appendSeries(rangeArea);
			chart[unitid].updateOptions(otherOptions);
		}

		if (!sensor.chart)
			sensor.chart = new Map();
		sensor.chart.set(prefix, chart[unitid]);
	}

	for ( var p = 0; p < progAdjusts.length; p++) {
		var adjust = progAdjusts[p];
		var sensor = adjust.sensor;
		for ( var j = 0; j < analogSensors.length; j++ ) {
			if (analogSensors[j].nr == sensor && analogSensors[j].chart != undefined) {
				var mchart = analogSensors[j].chart.get(prefix);
				if (mchart) {
					var unitStr = analogSensors[j].unit;

					//var progName = "";
					//if ( adjust.prog >= 1 && adjust.prog <= controller.programs.pd.length ) {
					//	progName = readProgram( controller.programs.pd[ adjust.prog - 1 ] ).name;
					//}

					var options = {
						annotations: {
							yaxis: [
								{
									y: adjust.min,
									strokeDashArray: 8,
									borderColor: "#00E396",
									borderWidth: 4,
									label: {
										borderColor: "#00E396",
										textAnchor: "start",
										position: "left",
										offsetX: 60,
										text: _( "Min" )+" "+adjust.min+" "+unitStr,
										style: {
											color: "#fff",
											background: "#00E396"
										}
									}
								},
								{
									y: adjust.max,
									strokeDashArray: 8,
									borderColor: "#ffadad",
									borderWidth: 4,
									label: {
										borderColor: "#ffadad",
										textAnchor: "start",
										position: "left",
										offsetX: 60,
										text: _( "Max" )+" "+adjust.max+" "+unitStr,
										style: {
											color: "#fff",
											background: "#ffadad"
										}
									}
								}
							]
						}
					};
					mchart.updateOptions(options);
				}
			}
		}
	}

	for ( var c = 1; c < chart.length; c++ ) {
		if ( !chart[ c ] ) {
			var x = document.querySelector( prefix + c );
			if (x) {
				x.parentElement.removeChild(x);
			}
		}
	}
}

/**
* format value output with 2 decimals.
* Empty string result if value is undefined or invalid
*/
function formatVal( val ) {
	if (val === undefined || isNaN(val))
		return "";
	return (+( Math.round( val + "e+2" )  + "e-2" ));
}

/**
* format value output. unit is only printed, if value valid
*/
function formatValUnit( val, unit ) {
	if (val === undefined || isNaN(val))
		return "";
	return (+( Math.round( val + "e+2" )  + "e-2" )) + unit;

}

function getUnit( sensor ) {
	var unitid = sensor.unitid;
	switch ( unitid ) {
		case 1: return "%";
		case 2: return String.fromCharCode( 176 ) + "C";
		case 3: return String.fromCharCode( 176 ) + "F";
		case 4: return "V";
		case 5: return "%";
		case 6: return "in";
		case 7: return "mm";
		case 8: return "mph";
		case 9: return "kmh";
		case 10: return "%";
		default: return sensor.unit;
	}
}

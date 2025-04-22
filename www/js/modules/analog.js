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
	analogSensors: [],
	progAdjusts: [],
	monitors : [],
	monitorAlerts : [],
	expandItem : new Set(["sensors"]),
	timer : null,

	lastSensorHtml : "",

	Constants: {
		CHARTS: 14,
		USERDEF_UNIT: 99,

		// Firmware version(s) required for analog sensor support
		MIN_REQ_FW_VERSION : "2.3.3(172)", // Suggested upgrade for users with insufficient fw (see checkFirmwareUpdate)
		MIN_REQ_FW_ID : 231,
		MIN_REQ_FW_MIN : 150,

		COLORS : ["#F3B415", "#F27036", "#663F59", "#6A6E94", "#4E88B4", "#00A7C6", "#18D8D8", '#A9D794', '#46AF78', '#A93F55', '#8C5E58', '#2176FF', '#33A1FD', '#7A918D', '#BAFF29'],
		COLCOUNT : 15,

		// channel ids for cordova notifications
		CHANNELS: {
			LOW: 'os_low',
			MEDIUM: 'os_med',
			HIGH: 'os_high'
		},

		// units used for sensor config, chart titles, etc
		UNITS: {
			DEFAULT: {ID: 0, NAME: 'Default'},
			SOIL_MOISTURE_PCT: {ID: 1, NAME: 'Soil Moisture %'},
			DEGREE_CELCIUS: {ID: 2, NAME: `Degree Celcius ${String.fromCharCode(176)}C`},
			DEGREE_FARENHEIT: {ID: 3, NAME: `Degree Fahrenheit ${String.fromCharCode(176)}F`},
			VOLT_V: {ID: 4, NAME: 'Volt V'},
			AIR_HUMIDITY_PCT: {ID: 5, NAME: 'Air Humidity %'},
			INCH_IN: {ID: 6, NAME: 'Inch in'},
			MILLIMETER_MM: {ID: 7, NAME: 'Millimeter mm'},
			MPH: {ID: 8, NAME: 'MPH'},
			KMH: {ID: 9, NAME: 'KM/H'},
			LEVEL_PCT: {ID: 10, NAME: 'Level %'},
			DK: {ID: 11, NAME: 'DK'},
			LUMEN_LM: {ID: 12, NAME: 'Lumen (lm)'},
			LUX_LX: {ID: 13, NAME: 'Lux (lx)'},
			OWN_UNIT: {ID: 99, NAME: 'Own Unit'},
		},

		// backup related items for import/export functionality
		BACKUPS: {
			SENSORS: {ID: 1, STORAGE_NAME: 'backupSensors', FILENAME: 'BackupSensorConfig'},
			ADJUSTMENTS: {ID: 2, STORAGE_NAME: 'backupAdjustments', FILENAME: 'BackupSensorAdjustments'},
			MONITOR: {ID: 4, STORAGE_NAME: 'backupMonitor', FILENAME: 'BackupMonitorConfig'},
			ALL: {ID: 7, STORAGE_NAME: 'backupAll', FILENAME: 'BackupAllConfig'},
		},

		//detected Analog Sensor Boards:
		ASB_BOARD1 : 0x01,
		ASB_BOARD2 : 0x02,
		OSPI_PCF8591 : 0x04,
		OSPI_ADS1115 : 0x08,
		UART_SC16IS752 : 0x10,
		RS485_TRUEBNER1 : 0x20,
		RS485_TRUEBNER2 : 0x40,
		RS485_TRUEBNER3 : 0x80,
		RS485_TRUEBNER4 : 0x100,
		OSPI_USB_RS485 : 0x200,

		NOTIFICATION_COLORS : ["#baffc9", "#faf0be", "#ffb3ba"],

		MONITOR_DELETE   : 0,
		MONITOR_MIN      : 1,
		MONITOR_MAX      : 2,
		MONITOR_SENSOR12 : 3, //Digital OS Sensors
		MONITOR_SET_SENSOR12 : 4, //Set Digital OS Sensors
		MONITOR_AND      : 10,
		MONITOR_OR       : 11,
		MONITOR_XOR      : 12,
		MONITOR_NOT      : 13,
		MONITOR_TIME     : 14,
		MONITOR_REMOTE   : 100,

		//SENSOR TYPES:
		SENSOR_NONE                     : 0,  // None or deleted sensor
		SENSOR_SMT100_MOIS              : 1,  // Truebner SMT100 RS485, moisture mode
		SENSOR_SMT100_TEMP              : 2,  // Truebner SMT100 RS485, temperature mode
		SENSOR_SMT100_PMTY              : 3,  // Truebner SMT100 RS485, permittivity mode
		SENSOR_TH100_MOIS               : 4,  // Truebner TH100 RS485,  humidity mode
		SENSOR_TH100_TEMP               : 5,  // Truebner TH100 RS485,  temperature mode
		SENSOR_ANALOG_EXTENSION_BOARD   : 10, // New OpenSprinkler analog extension board x8 - voltage mode 0..4V
		SENSOR_ANALOG_EXTENSION_BOARD_P : 11, // New OpenSprinkler analog extension board x8 - percent 0..3.3V to 0..100%
		SENSOR_SMT50_MOIS               : 15, // New OpenSprinkler analog extension board x8 - SMT50 VWC [%] = (U * 50) : 3
		SENSOR_SMT50_TEMP               : 16, // New OpenSprinkler analog extension board x8 - SMT50 T [°C] = (U – 0,5) * 100
		SENSOR_SMT100_ANALOG_MOIS       : 17, // New OpenSprinkler analog extension board x8 - SMT100 VWC [%] = (U * 100) : 3
		SENSOR_SMT100_ANALOG_TEMP       : 18, // New OpenSprinkler analog extension board x8 - SMT50 T [°C] = (U * 100) : 3 - 40
		SENSOR_VH400                    : 30, // New OpenSprinkler analog extension board x8 - Vegetronix VH400
		SENSOR_THERM200                 : 31, // New OpenSprinkler analog extension board x8 - Vegetronix THERM200
		SENSOR_AQUAPLUMB                : 32, // New OpenSprinkler analog extension board x8 - Vegetronix Aquaplumb
		SENSOR_USERDEF                  : 49, // New OpenSprinkler analog extension board x8 - User defined sensor
		SENSOR_OSPI_ANALOG              : 50, // Old OSPi analog input - voltage mode 0..3.3V
		SENSOR_OSPI_ANALOG_P            : 51, // Old OSPi analog input - percent 0..3.3V to 0...100%
		SENSOR_OSPI_ANALOG_SMT50_MOIS   : 52, // Old OSPi analog input - SMT50 VWC [%] = (U * 50) : 3
		SENSOR_OSPI_ANALOG_SMT50_TEMP   : 53, // Old OSPi analog input - SMT50 T [°C] = (U – 0,5) * 100
		SENSOR_OSPI_INTERNAL_TEMP       : 54, // Internal OSPI Temperature

		SENSOR_MQTT                     : 90, // subscribe to a MQTT server and query a value

		SENSOR_REMOTE                   : 100, // Remote sensor of an remote opensprinkler
		SENSOR_WEATHER_TEMP_F           : 101, // Weather service - temperature (Fahrenheit)
		SENSOR_WEATHER_TEMP_C           : 102, // Weather service - temperature (Celcius)
		SENSOR_WEATHER_HUM              : 103, // Weather service - humidity (%)
		SENSOR_WEATHER_PRECIP_IN        : 105, // Weather service - precip (inch)
		SENSOR_WEATHER_PRECIP_MM        : 106, // Weather service - precip (mm)
		SENSOR_WEATHER_WIND_MPH         : 107, // Weather service - wind (mph)
		SENSOR_WEATHER_WIND_KMH         : 108, // Weather service - wind (kmh)

		SENSOR_GROUP_MIN                : 1000,  // Sensor group with min value
		SENSOR_GROUP_MAX                : 1001,  // Sensor group with max value
		SENSOR_GROUP_AVG                : 1002,  // Sensor group with avg value
		SENSOR_GROUP_SUM                : 1003,  // Sensor group with sum value

		PROG_LINEAR                     : 1, //formula see above
		PROG_DIGITAL_MIN                : 2, //under or equal min : factor1 else factor2
		PROG_DIGITAL_MAX                : 3, //over or equal max  : factor2 else factor1
		PROG_DIGITAL_MINMAX             : 4, //under min or over max : factor1 else factor2
	}
};

OSApp.Analog.success_callback = function() {
};


OSApp.Analog.asb_init = function() {
	if (!OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isiOS) return;

	if (OSApp.currentDevice.isAndroid) {
		window.cordova.plugins.notification.local.createChannel({
			channelId: OSApp.Analog.Constants.CHANNELS.LOW,
			channel:   OSApp.Analog.Constants.CHANNELS.LOW,
			channelName:'OpenSprinklerLowNotifications',
			vibrate: false, // bool (optional), default is false
			importance: 2, // int (optional) 0 to 4, default is IMPORTANCE_DEFAULT (3)
			soundUsage: 5, // int (optional), default is USAGE_NOTIFICATION
			}, OSApp.Analog.success_callback, this);
		window.cordova.plugins.notification.local.createChannel({
			channelId: OSApp.Analog.Constants.CHANNELS.MEDIUM,
			channel:   OSApp.Analog.Constants.CHANNELS.MEDIUM,
			channelName:'OpenSprinklerMedNotifications',
			vibrate: false, // bool (optional), default is false
			importance: 3, // int (optional) 0 to 4, default is IMPORTANCE_DEFAULT (3)
			soundUsage: 5, // int (optional), default is USAGE_NOTIFICATION
			}, OSApp.Analog.success_callback, this);
		window.cordova.plugins.notification.local.createChannel({
			channelId: OSApp.Analog.Constants.CHANNELS.HIGH,
			channel:   OSApp.Analog.Constants.CHANNELS.HIGH,
			channelName:'OpenSprinklerHighNotifications',
			vibrate: true, // bool (optional), default is false
			importance: 4, // int (optional) 0 to 4, default is IMPORTANCE_DEFAULT (3)
			soundUsage: 5, // int (optional), default is USAGE_NOTIFICATION
			}, OSApp.Analog.success_callback, this);
	}
	if (window.cordova && window.cordova.plugins) {

		OSApp.Analog.timer = new window.nativeTimer();
		OSApp.Analog.timer.onTick = function() {
			OSApp.Analog.updateAnalogSensor( function() {
				OSApp.Analog.updateMonitors();
			});
		};

		window.cordova.plugins.backgroundMode.on('activate', function() {
			OSApp.Analog.timer.start(1, 30*1000);
		});
	 	window.cordova.plugins.backgroundMode.on('deactivate', function() {
			OSApp.Analog.timer.stop();
		});

		window.cordova.plugins.backgroundMode.setDefaults({
			title: "OpenSprinklerASB",
			text: OSApp.Language._("OpenSprinkler is running in background mode"),
			subText: OSApp.Language._("active monitor and controlling notifications"),
			channelName: "BackgroundChannel",
			allowClose: false,
			visibility: "public",
		});
	}
	if (window.cordova && window.BackgroundFetch) {
		var BackgroundFetch = window.BackgroundFetch;
		var fetchCallback = function(taskId) {
			console.log('[js] BackgroundFetch event received: ', taskId);
			OSApp.Analog.updateAnalogSensor( function() {
				OSApp.Analog.updateMonitors( function() {
					BackgroundFetch.finish(taskId);
				});
			});
		};

		var failureCallback = function(taskId) {
			console.log('- BackgroundFetch failed');
			BackgroundFetch.finish(taskId);
		};

		BackgroundFetch.configure({
			minimumFetchInterval: 15,
			requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY
		}, fetchCallback, failureCallback);
	}
};

OSApp.Analog.checkAnalogSensorAvail = function() {
	return OSApp.currentSession.controller.options && OSApp.currentSession.controller.options.feature?.includes("ASB");
};

OSApp.Analog.refresh = function() {
	setTimeout( function() {
		location.reload();
	}, 100 );
};

OSApp.Analog.enc = function(s) {
	//encodeURIComponent does not encode a single "%" !
	if (s) {
		return encodeURIComponent(s);
	}
	return s;
};

OSApp.Analog.updateProgramAdjustments = function( callback ) {
	callback = callback || function() { };
	return OSApp.Firmware.sendToOS( "/se?pw=", "json" ).then( function( data ) {
		OSApp.Analog.progAdjusts = data.progAdjust;
		callback();
	} );
};

OSApp.Analog.checkBackgroundMode = function() {
	if (!OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isiOS) return;
	if (!window.cordova) return;
	//Enable background mode only if we have a monitor configured:
	if (OSApp.Analog.monitors && OSApp.Analog.monitors.length > 0) {
		if (!window.cordova.plugins.backgroundMode.isActive() && !window.cordova.plugins.backgroundMode.isEnabled())
			window.cordova.plugins.backgroundMode.setEnabled(true);
	} else if (window.cordova.plugins.backgroundMode.isEnabled()) {
		window.cordova.plugins.backgroundMode.setEnabled(false);
	}
};

OSApp.Analog.updateMonitors = function(callback) {
	callback = callback || function () { };

	OSApp.Analog.checkBackgroundMode();

	if (OSApp.Firmware.checkOSVersion(233)) {
		return OSApp.Firmware.sendToOS("/ml?pw=", "json").then(function (data) {

			OSApp.Analog.monitors = data.monitors;
			OSApp.Analog.checkMonitorAlerts();
			callback();
		});
	} else callback();
};

OSApp.Analog.updateAnalogSensor = function( callback ) {
	callback = callback || function() { };
	return OSApp.Firmware.sendToOS( "/sl?pw=", "json" ).then( function( data ) {
		OSApp.Analog.analogSensors = data.sensors;
		if (Object.prototype.hasOwnProperty.call(data, "detected"))
			OSApp.Analog.analogSensors.detected = data.detected;
		callback();
	} );
};

OSApp.Analog.notification_action_callback = function() {
	//	monitorAlerts[monitor.nr] = false;
};

OSApp.Analog.checkMonitorAlerts = function() {
	if (!window.cordova || !window.cordova.plugins || !OSApp.Analog.monitors || (!OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isiOS))
		return;

	for (let i = 0; i < OSApp.Analog.monitors.length; i++) {
		var monitor = OSApp.Analog.monitors[i];
		if (monitor.active) {

			if (!OSApp.Analog.monitorAlerts[monitor.nr]) {
				OSApp.Analog.monitorAlerts[monitor.nr] = true;
				var dname, chan;
				if ( typeof OSApp.currentSession.controller.settings.dname !== "undefined" )
					dname = OSApp.currentSession.controller.settings.dname;
				else
				 	dname = "OpenSprinkler";
				let prio = Object.prototype.hasOwnProperty.call(monitor, "prio")?monitor.prio:0;

				switch (prio) {
					case 0:
						chan = OSApp.Analog.Constants.CHANNELS.LOW;
						break;
					case 1:
						chan = OSApp.Analog.Constants.CHANNELS.MEDIUM;
						break;
					default:
						chan = OSApp.Analog.Constants.CHANNELS.HIGH;
				}

				window.cordova.plugins.notification.local.schedule({
					id: monitor.nr,
					channelId: chan,
					channel: chan,
					title: dname,
					text: monitor.name,
					priority: prio,
					beep: prio>=2,
					lockscreen: true,
					color: OSApp.Analog.Constants.NOTIFICATION_COLORS[prio],
				}, OSApp.Analog.notification_action_callback, monitor);
			}
		}
		else if (OSApp.Analog.monitorAlerts[monitor.nr]) {
			OSApp.Analog.monitorAlerts[monitor.nr] = false;
		}
	}
};

OSApp.Analog.updateSensorShowArea = function( page ) {
	if (OSApp.Analog.checkAnalogSensorAvail()) {
		var showArea = page.find("#os-sensor-show");
		var html = "", i, j;
		html += "<div class='ui-body ui-body-a center'><table style='margin: 0px auto;'>";
		var cols = Math.round(window.innerWidth / 300);

		for (i = 0; i < OSApp.Analog.progAdjusts.length; i++) {
			if (i % cols == 0) {
				if (i > 0)
					html += "</tr>";
				html += "<tr>";
			}
			html += "<td id='mainpageChart-" + i + "'/>";
		}
		if (i > 0)
			html += "</tr>";
		html += "</table></div>";

		if (OSApp.Firmware.checkOSVersion(233) && OSApp.Analog.monitors) {
			for (i = 0; i < OSApp.Analog.monitors.length; i++) {
				var monitor = OSApp.Analog.monitors[i];
				if (monitor.active) {
					let prio = Object.prototype.hasOwnProperty.call(monitor, "prio")?monitor.prio:0;
					let pcolor = OSApp.Analog.Constants.NOTIFICATION_COLORS[prio];
					html += "<div id='monitor-" + monitor.nr + "' class='ui-body ui-body-a center' style='background-color:"+pcolor+"'>";
					html += "<label>" + monitor.name + "</label>";
					html += "</div>";
				}
			}
		}

		for (i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			var sensor = OSApp.Analog.analogSensors[i];
			if (sensor.show) {
				html += "<div id='sensor-show-" + sensor.nr + "' class='ui-body ui-body-a center'>";
				html += "<label>" + sensor.name + ": " + OSApp.Analog.formatValUnit(sensor.data, OSApp.Analog.getUnit(sensor)) + "</label>";
				html += "</div>";
			}
		}

		var progAdjustDisp = new Array(OSApp.Analog.progAdjusts.length);

		for (i = 0; i < OSApp.Analog.progAdjusts.length; i++) {
			var progAdjust = OSApp.Analog.progAdjusts[i];
			var disp = {};
			var current = Math.round(progAdjust.current * 100);

			if (!progAdjust.name || progAdjust.name === "") {
				var progName = "?";
				if (progAdjust.prog >= 1 && progAdjust.prog <= OSApp.currentSession.controller.programs.pd.length) {
					progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[progAdjust.prog - 1]).name;
				}

				var sensorName = "";
				for (j = 0; j < OSApp.Analog.analogSensors.length; j++) {
					if (OSApp.Analog.analogSensors[j].nr === progAdjust.sensor) {
						sensorName = OSApp.Analog.analogSensors[j].name;
					}
				}
				disp.label = progName + " (" + sensorName + ")"
			} else
				disp.label = progAdjust.name;

			var color = ["#87D4F9"];
			if (current > 100)
				color = ["#FF8C00"];
			if (current > 150)
				color = ["#CD5C5C"];
			disp.color = color;

			var min = Math.min(progAdjust.factor1, progAdjust.factor2) * 100;
			var max = Math.max(progAdjust.factor1, progAdjust.factor2) * 100;
			if (current < min) current = min;
			if (current > max) current = max;
			disp.current = current;
			progAdjustDisp[i] = disp;
		}

		if (OSApp.Analog.lastSensorHtml != html) {
			OSApp.Analog.lastSensorHtml = html;
			while (showArea.firstChild) {
				showArea.removeChild(showArea.firstChild);
			}
			showArea.html(html);

			for (i = 0; i < progAdjustDisp.length; i++) {
				disp = progAdjustDisp[i];
				if (!disp) continue;
				var options = {
					chart: {
						height: 180,
						parentHeightOffset: 0,
						type: "radialBar",
						animations: {
							enabled: true,
							dynamicAnimation: {
								enabled: true
							}
						}
					},
					series: [disp.current],
					colors: ["#20E647"],
					plotOptions: {
						radialBar: {
							startAngle: -135,
							endAngle: 135,
							hollow: {
								margin: 0,
								size: '60%',
								background: '#fff',
								position: 'front',
								dropShadow: {
									enabled: true,
									top: 3,
									left: 0,
									blur: 4,
									opacity: 0.5
								},
							},
							track: {
								background: '#fff',
								  strokeWidth: '67%',
								  margin: 0, // margin is in pixels
								dropShadow: {
									enabled: true,
									top: -3,
									left: 0,
									blur: 4,
									opacity: 0.7
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
									formatter: function (val) {
										return OSApp.Analog.formatValUnit(val, "%");
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
							gradientToColors: disp.color,
							stops: [0, 100]
						}
					},
					stroke: {
						lineCap: "round",
					},
					labels: [disp.label]
				};

				var chart = new ApexCharts(document.querySelector("#mainpageChart-" + i), options);
				chart.render();
				disp.chart = chart;
			}
		} else {
			for (i = 0; i < progAdjustDisp.length; i++) {
				disp = progAdjustDisp[i];
				if (disp && disp.chart) {
					disp.chart.updateSeries([disp.current]);
					disp.chart.updateOptions({labels: [disp.label]});
				}
			}
		}
	}
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

// Restore from Backup - Dialog
OSApp.Analog.getImportMethodSensors = function(restore_type, callback) {

	let storageName = (restore_type == 1) ? "backupSensors" : (restore_type == 2) ? "backupAdjustments" : "backupAll";
	let localData = localStorage.getItem(storageName);

	callback = callback || function () { };
	var getPaste = function () {
		var popup = $(
			"<div data-role='popup' data-theme='a' id='paste_config'>" +
			"<p class='ui-bar'>" +
			"<textarea class='textarea' rows='10' placeholder='" + OSApp.Language._("Paste your backup here") + "'></textarea>" +
			"<button data-mini='true' data-theme='b'>" + OSApp.Language._("Import") + "</button>" +
			"</p>" +
			"</div>"
		),
			width = $.mobile.window.width();

		popup.find("button").on("click", function () {
			var data = popup.find("textarea").val();

			if (data === "") {
				return;
			}

			try {
				data = JSON.parse($.trim(data).replace(/“|”|″/g, "\""));
				popup.popup("close");
				OSApp.Analog.importConfigSensors(data, restore_type, callback);
			} catch {
				popup.find("textarea").val("");
				OSApp.Errors.showError(OSApp.Language._("Unable to read the configuration file. Please check the file and try again."));
			}
		});

		popup.css("width", (width > 600 ? width * 0.4 + "px" : "100%"));
		OSApp.UIDom.openPopup(popup);
		return false;
	},
		popup = $(
			"<div data-role='popup' data-theme='a'>" +
			"<div class='ui-bar ui-bar-a'>" + OSApp.Language._("Select Import Method") + "</div>" +
			"<div data-role='controlgroup' class='tight'>" +
			"<button class='hidden fileMethod'>" + OSApp.Language._("File") + "</button>" +
			"<button class='pasteMethod'>" + OSApp.Language._("Email (copy/paste)") + "</button>" +
			"<button class='hidden localMethod'>" + OSApp.Language._("Internal (within app)") + "</button>" +
			"</div>" +
			"</div>");

	if (OSApp.currentDevice.isFileCapable) {
		popup.find(".fileMethod").removeClass("hidden").on("click", function () {
			popup.popup("close");
			var input = $("<input type='file' id='configInput' data-role='none' style='visibility:hidden;position:absolute;top:-50px;left:-50px'/>")
				.on("change", function () {
					var config = this.files[0],
						reader = new FileReader();

					if (typeof config !== "object") {
						return;
					}

					reader.onload = function (e) {
						try {
							var obj = JSON.parse($.trim(e.target.result));
							OSApp.Analog.importConfigSensors(obj, restore_type, callback);
						} catch (err) {
							OSApp.Errors.showError(OSApp.Language._("Unable to read the configuration file. Please check the file and try again.", err));
						}
					};

					reader.readAsText(config);
				});

			input.appendTo("#sprinklers-settings");
			input.click();
			return false;
		});
	} else {

		// Handle local storage being unavailable and present paste dialog immediately
		if (!localData) {
			getPaste();
			return;
		}
	}

	popup.find(".pasteMethod").on("click", function () {
		popup.popup("close");
		getPaste();
		return false;
	});

	if (localData) {
		popup.find(".localMethod").removeClass("hidden").on("click", function () {
			popup.popup("close");
			OSApp.Analog.importConfigSensors(JSON.parse(localData), restore_type, callback);
			return false;
		});
	}

	OSApp.UIDom.openPopup(popup);
};

// Restore from backup - send to OS
OSApp.Analog.importConfigSensors = function(data, restore_type, callback) {
	callback = callback || function () { };
	var warning = "";

	if (typeof data !== "object" || !data.backup) {
		OSApp.Errors.showError(OSApp.Language._("Invalid configuration"));
		return;
	}

	OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to restore the configuration?"), warning, function () {
		$.mobile.loading("show");

		if ((restore_type & 1) == 1 && Object.prototype.hasOwnProperty.call(data, "sensors")) { //restore Sensor
			var sensorOut;
			for (let i = 0; i < data.sensors.length; i++) {
				sensorOut = data.sensors[i];
				OSApp.Analog.sendToOsObj("/sc?pw=", sensorOut);
			}
		}

		if ((restore_type & 2) == 2 && Object.prototype.hasOwnProperty.call(data, "progadjust")) { //restore program adjustments
			var progAdjustOut;
			for (let i = 0; i < data.progadjust.length; i++) {
				progAdjustOut = data.progadjust[i];
				OSApp.Analog.sendToOsObj("/sb?pw?=", progAdjustOut);
			}
		}

		if ((restore_type & 4) == 4 && Object.prototype.hasOwnProperty.call(data, "monitors")) { //restore monitors
			var monitor;
			for (var i = 0; i < data.monitors.length; i++) {
				monitor = data.monitors[i];
				OSApp.Analog.sendToOsObj("/mc?pw=", monitor);
			}
		}

		OSApp.Analog.expandItem.add("progadjust");
		OSApp.Analog.updateProgramAdjustments(function () {
			OSApp.Analog.updateMonitors(function () {
				OSApp.Analog.updateAnalogSensor(function () {
					$.mobile.loading("hide");
					OSApp.Errors.showError(OSApp.Language._("Backup restored to your device"));
					callback();
				});

			});
		});

	});
};

OSApp.Analog.sendToOsObj = function(params, obj) {
	for (var key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			var value = obj[key];
			if (key == "name" || key == "unit" || key == "topic" || key == "filter")
				value = OSApp.Analog.enc(value);
			params += "&"+key+"="+value;
		}
	}
	return OSApp.Firmware.sendToOS(params, "json");
};

OSApp.Analog.getExportMethodSensors = function(backuptype) {
	let storageName, filename;
	switch (backuptype) {
		case OSApp.Analog.Constants.BACKUPS.SENSORS.ID:
			storageName = OSApp.Analog.Constants.BACKUPS.SENSORS.STORAGE_NAME;
			filename = OSApp.Analog.Constants.BACKUPS.SENSORS.FILENAME;
			break;

		case OSApp.Analog.Constants.BACKUPS.ADJUSTMENTS.ID:
			storageName = OSApp.Analog.Constants.BACKUPS.ADJUSTMENTS.STORAGE_NAME;
			filename = OSApp.Analog.Constants.BACKUPS.ADJUSTMENTS.FILENAME;
			break;

		case OSApp.Analog.Constants.BACKUPS.MONITOR.ID:
			storageName = OSApp.Analog.Constants.BACKUPS.MONITOR.STORAGE_NAME;
			filename = OSApp.Analog.Constants.BACKUPS.MONITOR.FILENAME;
			break;

		case OSApp.Analog.Constants.BACKUPS.ALL.ID:
		default:
			storageName = OSApp.Analog.Constants.BACKUPS.ALL.STORAGE_NAME;
			filename = OSApp.Analog.Constants.BACKUPS.ALL.FILENAME;
			break;
	}

	OSApp.Firmware.sendToOS("/sx?pw=&backup=" + backuptype, "json").then(function (data) {
		var popup = $(
			"<div data-role='popup' data-theme='a'>" +
			"<div class='ui-bar ui-bar-a'>" + OSApp.Language._("Select Export Method") + "</div>" +
			"<div data-role='controlgroup' class='tight'>" +
			"<a class='ui-btn hidden fileMethod'>" + OSApp.Language._("File") + "</a>" +
			"<a class='ui-btn pasteMethod'>" + OSApp.Language._("Email") + "</a>" +
			"<a class='ui-btn localMethod'>" + OSApp.Language._("Internal (within app)") + "</a>" +
			"</div>" +
			"</div>"),
			obj = encodeURIComponent(JSON.stringify(data)),
			subject = OSApp.Language._("OpenSprinkler Sensor Export on") + " " + OSApp.Dates.dateToString(new Date());

		if (OSApp.currentDevice.isFileCapable) {
			popup.find(".fileMethod").removeClass("hidden").attr({
				href: "data:text/json;charset=utf-8," + obj,
				download: filename + "-" + new Date().toLocaleDateString().replace(/\//g, "-") + ".json"
			}).on("click", function () {
				popup.popup("close");
			});
		}

		var href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + obj;
		popup.find(".pasteMethod").attr("href", href).on("click", function () {
			window.open(href, OSApp.currentDevice.isOSXApp ? "_system" : undefined);
			popup.popup("close");
		});

		popup.find(".localMethod").on("click", function () {
			popup.popup("close");
			localStorage.setItem(storageName, JSON.stringify(data));
			OSApp.Errors.showError(OSApp.Language._("Backup saved on this device"));
		});

		OSApp.UIDom.openPopup(popup);
	});
};


//Program adjustments editor
OSApp.Analog.showAdjustmentsEditor = function( progAdjust, row, callback, callbackCancel ) {

	OSApp.Firmware.sendToOS("/sh?pw=", "json").then(function (data) {
		var supportedAdjustmentTypes = data.progTypes;
		var i;

		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var list =
			"<div data-role='popup' data-theme='a' id='progAdjustEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+OSApp.Language._("Close")+"</a>"+
			"<h1>" + (progAdjust.nr > 0 ? OSApp.Language._("Edit Program Adjustment") : OSApp.Language._("New Program Adjustment")) + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			OSApp.Language._("Notice: If you want to combine multiple sensors, then build a sensor group. ") +
			OSApp.Language._("See help documentation for details.") +
			"</p>" +

			"<div class='ui-field-contain'>" +

			//Adjustment-Nr:
			"<label>" +
			OSApp.Language._("Adjustment-Nr") +
			"</label>" +
			"<input class='nr' type='number' inputmode='decimal' min='1' max='99999' value='" + progAdjust.nr + (progAdjust.nr > 0 ? "' disabled='disabled'>" : "'>");

			//Adjustment-Name:
			if (OSApp.Firmware.checkOSVersion(233)) {
				if (!Object.prototype.hasOwnProperty.call(progAdjust, "name"))
					progAdjust.name = "";
				list += "<label>" +
				OSApp.Language._("Adjustment Name") +
				"</label>" +
				"<input class='adj-name' type='text' maxlength='29' value='" + progAdjust.name + "' >";
			}

			//Select Type:
			list += "<div class='ui-field-contain'><label for='type' class='select'>" +
			OSApp.Language._("Type") +
			"</label><select data-mini='true' id='type'>";

		for (i = 0; i < supportedAdjustmentTypes.length; i++) {
			list += "<option " + ((progAdjust.type === supportedAdjustmentTypes[i].type) ? "selected" : "") +
				" value='" + supportedAdjustmentTypes[i].type + "'>" +
				OSApp.Language._(supportedAdjustmentTypes[i].name) + "</option>";
		}
		list += "</select></div>" +

			//Select Sensor:
			"<div class='ui-field-contain'><label for='sensor' class='select'>" +
			OSApp.Language._("Sensor") +
			"</label><select data-mini='true' id='sensor'>";

		for (i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			list += "<option " + ((progAdjust.sensor === OSApp.Analog.analogSensors[i].nr) ? "selected" : "") +
				" value='" + OSApp.Analog.analogSensors[i].nr + "'>" +
				OSApp.Analog.analogSensors[i].nr + " - " + OSApp.Analog.analogSensors[i].name + "</option>";
		}
		list += "</select></div>" +

			//Select Program:
			"<div class='ui-field-contain'><label for='prog' class='select'>" +
			OSApp.Language._("Program to adjust") +
			"</label><select data-mini='true' id='prog'>";

		for (i = 0; i < OSApp.currentSession.controller.programs.pd.length; i++) {
			var progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[i]).name;
			var progNr = i + 1;

			list += "<option " + ((progAdjust.prog === progNr) ? "selected" : "") +
				" value='" + progNr + "'>" +
				progName + "</option>";
		}
		list += "</select></div>" +

			"<label>" +
			OSApp.Language._("Factor 1 in % (adjustment for min)") +
			"</label>" +
			"<input class='factor1' type='number' inputmode='decimal' value='" + Math.round(progAdjust.factor1 * 100) + "'>" +

			"<label>" +
			OSApp.Language._("Factor 2 in % (adjustment for max)") +
			"</label>" +
			"<input class='factor2' type='number' inputmode='decimal' value='" + Math.round(progAdjust.factor2 * 100) + "'>" +

			"<label>" +
			OSApp.Language._("Min sensor value") +
			"</label>" +
			"<input class='min' type='number' value='" + progAdjust.min + "'>" +

			"<label>" +
			OSApp.Language._("Max sensor value") +
			"</label>" +
			"<input class='max' type='number' inputmode='decimal' value='" + progAdjust.max + "'>" +

			"</div>" +
			"<div id='adjchart'></div>" +
			"<button class='submit' data-theme='b'>" + OSApp.Language._("Submit") + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-progadjust' value='" + progAdjust.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				OSApp.Language._("Delete") + "</a>")) +

			"</div>" +
			"</div>";

		let popup = $(list),

			changeValue = function (pos, dir) {
				var input = popup.find(".inputs input").eq(pos),
					val = parseInt(input.val());

				if ((dir === -1 && val === 0) || (dir === 1 && val === 100)) {
					return;
				}

				input.val(val + dir);
			};

		//Delete a program adjust:
		popup.find(".delete-progadjust").on("click", function () {
			var dur = $(this),
				value = dur.attr("value"),
				row = dur.attr("row");

			popup.popup("close");

			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to delete this program adjustment?"), value, function () {
				return OSApp.Firmware.sendToOS("/sb?pw=&nr=" + value + "&type=0", "json").done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.progAdjusts.splice(row, 1);
					callbackCancel();
				});
			});
		});

		let adjFunc = function () {
			OSApp.Analog.updateAdjustmentChart(popup);
		};

		popup.find("#sensor").change(adjFunc);
		popup.find("#type").change(adjFunc);
		popup.find(".factor1").change(adjFunc);
		popup.find(".factor2").change(adjFunc);
		popup.find(".min").change(adjFunc);
		popup.find(".max").change(adjFunc);

		popup.find(".submit").on("click", function () {

			var progAdjust = OSApp.Analog.getProgAdjust(popup);
			callback(progAdjust);

			popup.popup("close");
			return false;
		});

		popup.on("focus", "input[type='number']", function () {
			this.select();
		}).on("blur", "input[type='number']", function () {

			var min = parseFloat(this.min),
				max = parseFloat(this.max);

			if (this.value === "") {
				this.value = "0";
			}
			if (this.value < min || this.value > max) {
				this.value = this.value < min ? min : max;
			}
		});

		OSApp.UIDom.holdButton(popup.find(".incr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, 1);
			return false;
		});

		OSApp.UIDom.holdButton(popup.find(".decr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, -1);
			return false;
		});

		$("#progAdjustEditor").remove();

		popup.css("max-width", "580px");

		adjFunc();
		OSApp.UIDom.openPopup(popup, { positionTo: "origin" });
	});
};

OSApp.Analog.getProgAdjust = function(popup) {
	return {
		nr: parseInt(popup.find(".nr").val()),
		name: popup.find(".adj-name").val(),
		type: parseInt(popup.find("#type").val()),
		sensor: parseInt(popup.find("#sensor").val()),
		prog: parseInt(popup.find("#prog").val()),
		factor1: parseFloat(popup.find(".factor1").val() / 100),
		factor2: parseFloat(popup.find(".factor2").val() / 100),
		min: parseFloat(popup.find(".min").val()),
		max: parseFloat(popup.find(".max").val())
	};
};

OSApp.Analog.getProgAdjustForCalc = function(popup) {
	return {
		type: parseInt(popup.find("#type").val()),
		sensor: parseInt(popup.find("#sensor").val()),
		factor1: parseFloat(popup.find(".factor1").val() / 100),
		factor2: parseFloat(popup.find(".factor2").val() / 100),
		min: parseFloat(popup.find(".min").val()),
		max: parseFloat(popup.find(".max").val())
	};
};

OSApp.Analog.updateAdjustmentChart = function(popup) {

	let p = OSApp.Analog.getProgAdjustForCalc(popup);
	OSApp.Analog.sendToOsObj("/sd?pw=", p).done(function (values) {
		if (!values || !Object.prototype.hasOwnProperty.call(values, "adjustment"))
			return;
		let adj = values.adjustment;
		if (!Object.prototype.hasOwnProperty.call(adj, "inval"))
			return;

		var sensor;
		for (let i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			if (p.sensor == OSApp.Analog.analogSensors[i].nr) {
				sensor = OSApp.Analog.analogSensors[i];
				break;
			}
		}
		if (sensor === undefined)
			return;

		var yaxis;
		if (Object.prototype.hasOwnProperty.call(adj, 'adjust'))
			yaxis = [
				{
					y: adj.adjust,
					strokeDashArray: 8,
					borderColor: "#00E396",
					borderWidth: 4,
					label: {
						borderColor: "#00E396",
						textAnchor: "end",
						position: "right",
						offsetX: -60,
						text: OSApp.Analog.formatValUnit(adj.adjust*100, "%"),
						style: {
							color: "#fff",
							background: "#00E396"
						}
					}
				}
			];

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
				text: OSApp.Language._("Adjustment preview"),
				align: 'left'
			},
			xaxis: {
				categories: adj.inval,
				tickAmount: Math.min(20, Math.min(screen.width / 30, adj.inval.length)),
				labels: {
					formatter: function (value) {
						return OSApp.Analog.formatVal(value);
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
					formatter: function (value) {
						return OSApp.Analog.formatVal(value * 100);
					}
				},
				title: {
					text: OSApp.Language._("Adjustments in %")
				}
			},
			series: [{
				name: OSApp.Language._("Adjustment"),
				type: "line",
				data: adj.outval
			}],
			annotations: {
				xaxis: [
					{
						x: Math.round(sensor.data),
						strokeDashArray: 8,
						borderColor: "#00E396",
						borderWidth: 4,
						label: {
							borderColor: "#00E396",
							textAnchor: "start",
							position: "left",
							text: sensor.name,
							style: {
								color: "#fff",
								background: "#00E396"
							}
						}
					}
				],
				yaxis: yaxis
			}
		};
		let sel = document.querySelector("#adjchart");
		if (sel) {
			while (sel.firstChild)
				sel.removeChild(sel.lastChild);
			let chart = new ApexCharts(sel, options);
			chart.render();
		}
	});
};

OSApp.Analog.requiredCheck = function(field, obj, property) {
	if (obj['missingValue']) return;
	if (field.is(":visible") && field.prop("required") && !obj[property])
		obj['missingValue'] = field;
};

OSApp.Analog.addToObjectChk = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = field.is(":checked") ? 1 : 0;
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.addToObjectInt = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = parseInt(field.val());
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.addToObjectFlt = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = parseFloat(field.val());
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.addToObjectStr = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = field.val();
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.addToObjectTime = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		let time = field.val();
		if (time) {
			let timeParts = time.split(":");
			if (timeParts.length === 2) {
				let hours = parseInt(timeParts[0]);
				let minutes = parseInt(timeParts[1]);
				if (!isNaN(hours) && !isNaN(minutes)) {
					obj[property] = (hours * 100) + minutes;
				} else {
					obj[property] = 0;
				}
			} else {
				obj[property] = 0;
			}
		} else {
			obj[property] = 0;
		}
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};


OSApp.Analog.addToObjectIPs = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		var ipstr = field.val();
		obj[property] = ipstr?ipstr.split("."):0;
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.getMonitor = function(popup) {
	var result = {};
	OSApp.Analog.addToObjectInt(popup, "#nr", result);
	OSApp.Analog.addToObjectStr(popup, "#name", result);
	OSApp.Analog.addToObjectInt(popup, "#type", result);
	OSApp.Analog.addToObjectInt(popup, "#sensor", result);
	OSApp.Analog.addToObjectInt(popup, "#prog", result);
	OSApp.Analog.addToObjectInt(popup, "#zone", result);
	OSApp.Analog.addToObjectFlt(popup, "#maxrun", result);
	OSApp.Analog.addToObjectInt(popup, "#prio", result);

	//Min+Max
	OSApp.Analog.addToObjectFlt(popup, "#value1", result);
	OSApp.Analog.addToObjectFlt(popup, "#value2", result);
	//Sensor12
	OSApp.Analog.addToObjectInt(popup, "#sensor12", result);
	OSApp.Analog.addToObjectChk(popup, "#invers", result);
	//AND+OR+XOR
	OSApp.Analog.addToObjectInt(popup, "#monitor1", result);
	OSApp.Analog.addToObjectInt(popup, "#monitor2", result);
	OSApp.Analog.addToObjectInt(popup, "#monitor3", result);
	OSApp.Analog.addToObjectInt(popup, "#monitor4", result);
	OSApp.Analog.addToObjectChk(popup, "#invers1", result);
	OSApp.Analog.addToObjectChk(popup, "#invers2", result);
	OSApp.Analog.addToObjectChk(popup, "#invers3", result);
	OSApp.Analog.addToObjectChk(popup, "#invers4", result);
	//NOT
	OSApp.Analog.addToObjectInt(popup, "#monitor", result);
	//TIME
	OSApp.Analog.addToObjectTime(popup, "#from", result);
	OSApp.Analog.addToObjectTime(popup, "#to", result);
	OSApp.Analog.addToObjectInt(popup, "#wdays", result); //todo: weekdays as checkboxes
	//REMOTE
	result["ip"] = OSApp.Analog.intFromBytes(popup.find("#ip").val().split("."));
	result["port"] = parseInt(popup.find("#port").val());

	return result;
};

OSApp.Analog.monitorSelection = function(id, sel, ignore) {
	var list = "<select data-mini='true' id='"+id+"'>";

	list += "<option " + (!sel ? "selected" : "") +
	" value=''>" + OSApp.Language._("unselected") + "</option>";

	for (let i = 0; i < OSApp.Analog.monitors.length; i++) {
		let monitor = OSApp.Analog.monitors[i];
		if (monitor.nr === ignore) continue;
		list += "<option " + ((monitor.nr === sel) ? "selected" : "") +
			" value='" +monitor.nr + "'>" +
			monitor.name + "</option>";
	}
	list += "</select>";
	return list;
}

//Monitor editor
OSApp.Analog.showMonitorEditor = function(monitor, row, callback, callbackCancel) {

	OSApp.Firmware.sendToOS("/mt?pw=", "json").then(function (data) {
		var supportedMonitorTypes = data.monitortypes;
		var i;

		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var list =
			"<div data-role='popup' data-theme='a' id='monitorEditor' style='max-width:580px;'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+OSApp.Language._("Close")+"</a>"+
			"<h1>" + (monitor.nr > 0 ? OSApp.Language._("Edit monitor and control") : OSApp.Language._("New Monitor")) + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			OSApp.Language._("Notice: If you want to combine multiple sensors, then build a sensor group. ") +
			OSApp.Language._("See help documentation for details.") +
			"</p>" +

			"<div class='ui-field-contain'>" +

			//Monitor-Nr:
			"<label for='id'>" +
			OSApp.Language._("Monitor-Nr") +
			"<input id='nr' type='number' inputmode='decimal' min='1' max='99999' required value='" + monitor.nr + (monitor.nr > 0 ? "' disabled='disabled'>" : "'>") +
			"</label>" +

			//Monitor-Name:
			"<label for='name'>" +
			OSApp.Language._("Monitor-Name") +
			"<input id='name' type='text' maxlength='29' value='" + monitor.name + "' required>" +
			"</label>" +

			//Select Type:
			"<label for='type' class='select'>" +
			OSApp.Language._("Type") +
			"</label><select data-mini='true' id='type' required>";

		for (i = 0; i < supportedMonitorTypes.length; i++) {
			list += "<option " + ((monitor.type === supportedMonitorTypes[i].type) ? "selected" : "") +
				" value='" + supportedMonitorTypes[i].type + "'>" +
				OSApp.Language._(supportedMonitorTypes[i].name) + "</option>";
		}
		list += "</select>" +

			//Select Sensor:
			"<div id='sel_sensor'><label for='sensor' class='select'>" +
			OSApp.Language._("Sensor") +
			"</label><select data-mini='true' id='sensor'>";

		for (i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			list += "<option " + ((monitor.sensor === OSApp.Analog.analogSensors[i].nr) ? "selected" : "") +
				" value='" + OSApp.Analog.analogSensors[i].nr + "'>" +
				OSApp.Analog.analogSensors[i].nr + " - " + OSApp.Analog.analogSensors[i].name + "</option>";
		}
		list += "</select></div>" +

			//Select Program:
			"<label for='prog' class='select'>" +
			OSApp.Language._("Program to start") +
			"</label><select data-mini='true' id='prog'>" +
			"<option " + (monitor.prog == 0? "selected" : "") + " value='0'>" + OSApp.Language._("Disabled") + "</option>";

		for (i = 0; i < OSApp.currentSession.controller.programs.pd.length; i++) {
			var progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[i]).name;
			var progNr = i + 1;

			list += "<option " + ((monitor.prog === progNr) ? "selected" : "") +
				" value='" + progNr + "'>" +
				progName + "</option>";
		}
		list += "</select>" +

			//Select Zone:
			"<label for='zone' class='select'>" +
			OSApp.Language._("Zone to start") +
			"</label><select data-mini='true' id='zone'>" +
			"<option " + (monitor.zone == 0? "selected" : "") + " value='0'>" + OSApp.Language._("Disabled") + "</option>";

		for (i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++) {
			if ( !OSApp.Stations.isMaster( i ) ) {
				list += "<option " + ( monitor.zone == (i + 1) ? "selected" : "" ) + " value='" + ( i + 1 ) + "'>" +
				OSApp.currentSession.controller.stations.snames[ i ] + "</option>";
			}
		}

		//maxrun
		list += "</select>" +
			"<label for='maxrun'>" + OSApp.Language._("Max runtime (s)") +
			"</label><input id='maxrun' type='number' inputmode='decimal' min='1' max='99999' value='" + monitor.maxrun + "'>" +

		//Priority
			"<label>"+OSApp.Language._("Priority") +
			"</label><select data-mini='true' id='prio'>";
		const prios = [OSApp.Language._("Low"), OSApp.Language._("Medium"), OSApp.Language._("High")];
		if (!monitor.prio)
			monitor.prio = 0;
		for (i = 0; i < 3; i++) {
			list += "<option " + (monitor.prio == i ? "selected" : "") + " value='" + i + "'>" + prios[i] + "</option>";
		}
		list += "</select></div>" +

			//typ = MIN+MAX
			"<div id='type_minmax'>"+
			"<label for='value1'>" +
			OSApp.Language._("Value for activate") +
			"</label><input id='value1' type='number' inputmode='decimal' value='" + OSApp.Analog.formatVal(monitor.value1) + "'>" +

			"<label for='value2'>" +
			OSApp.Language._("Value for deactivate") +
			"</label><input id='value2' type='number' inputmode='decimal' value='" + OSApp.Analog.formatVal(monitor.value2) + "'>" +
			"</div>" +

			//typ = SENSOR12
			"<div id='type_sensor12'>"+
			"<label for='sensor12'>" +
			OSApp.Language._("Digital Sensor Port") +
			"</label>" +
			"<select data-mini='true' id='sensor12'>" +
			"<option " + (monitor.sensor12 <= 1? "selected" : "") + " value='1'>" + OSApp.Language._("Sensor 1") + "</option>" +
			"<option " + (monitor.sensor12 >= 2? "selected" : "") + " value='2'>" + OSApp.Language._("Sensor 2") + "</option>" +
			"</select>"+
			"<label for='invers'>" +
			"<input data-mini='true' id='invers' type='checkbox' " + (monitor.invers ? "checked='checked'" : "") + ">" + OSApp.Language._("Inverse") + "</input>" +
			"</label></div>" +

			//typ = SET_SENSOR12
			"<div id='type_set_sensor12'>"+
			"<label for='sensor12'>" +
			OSApp.Language._("Set Digital Sensor Port") +
			"</label>" +
			"<select data-mini='true' id='sensor12'>" +
			"<option " + (monitor.sensor12 <= 1? "selected" : "") + " value='1'>" + OSApp.Language._("Sensor 1") + "</option>" +
			"<option " + (monitor.sensor12 >= 2? "selected" : "") + " value='2'>" + OSApp.Language._("Sensor 2") + "</option>" +
			"</select>"+
			"<label for='monitor'>"+OSApp.Language._("Monitor")+"</label>"+OSApp.Analog.monitorSelection("monitor", monitor.monitor, monitor.nr)+
			"</label></div>" +

			//typ == ANDORXOR
			"<div id='type_andorxor'>"+
			"<label for='monitor1'>"+OSApp.Language._("Monitor 1")+"</label>"+OSApp.Analog.monitorSelection("monitor1", monitor.monitor1, monitor.nr)+
			"<label for='invers1'><input data-mini='true' id='invers1' type='checkbox' " + (monitor.invers1 ? "checked='checked'" : "") + ">" + OSApp.Language._("Inverse") + "</input></label>" +
			"<label for='monitor2'>"+OSApp.Language._("Monitor 2")+"</label>"+OSApp.Analog.monitorSelection("monitor2", monitor.monitor2, monitor.nr)+
			"<label for='invers2'><input data-mini='true' id='invers2' type='checkbox' " + (monitor.invers2 ? "checked='checked'" : "") + ">" + OSApp.Language._("Inverse") + "</input></label>" +
			"<label for='monitor3'>"+OSApp.Language._("Monitor 3")+"</label>"+OSApp.Analog.monitorSelection("monitor3", monitor.monitor3, monitor.nr)+
			"<label for='invers3'><input data-mini='true' id='invers3' type='checkbox' " + (monitor.invers3 ? "checked='checked'" : "") + ">" + OSApp.Language._("Inverse") + "</input></label>" +
			"<label for='monitor4'>"+OSApp.Language._("Monitor 4")+"</label>"+OSApp.Analog.monitorSelection("monitor4", monitor.monitor4, monitor.nr)+
			"<label for='invers4'><input data-mini='true' id='invers4' type='checkbox' " + (monitor.invers4 ? "checked='checked'" : "") + ">" + OSApp.Language._("Inverse") + "</input></label>" +
			"</div>" +

			//typ == NOT
			"<div id='type_not'>"+
			"<label for='monitor'>"+OSApp.Language._("Monitor")+"</label>"+OSApp.Analog.monitorSelection("monitor", monitor.monitor, monitor.nr)+
			"</div>"+

			//typ == TIME
			"<div id='type_time'>"+
			"<label for='from'>"+OSApp.Language._("From")+"</label>"+
			"<input id='from' type='text' maxlength='5' value='" + OSApp.Utils.pad(Math.round(monitor.from / 100)) + ":" + OSApp.Utils.pad(monitor.from % 100) + "'>" +
			"<label for='to'>"+OSApp.Language._("To")+"</label>"+
			"<input id='to' type='text' maxlength='5' value='" + OSApp.Utils.pad(Math.round(monitor.to / 100)) + ":" + OSApp.Utils.pad(monitor.to % 100) + "'>" +
			"<label for='wdays'>"+OSApp.Language._("Weekdays")+"</label>"+ //Todo: days as checkboxes
			"<input id='wdays' type='number' inputmode='decimal' min='0' max ='255' value='" + monitor.wdays + "'>" +
			"</div>"+

			//typ == REMOTE
			"<div id='type_remote'>"+
			"<label for='rmonitor'>"+OSApp.Language._("Remote Monitor nr")+"</label>"+
			"<input id='rmonitor' type='number' inputmode='decimal' min='1' max='99999' value='" + monitor.rmonitor + "'>" +
			"<label for='ip'>"+OSApp.Language._("IP")+"</label>"+
			"<input id='ip' type='text'  value='" + (monitor.ip ? OSApp.Analog.toByteArray(monitor.ip).join(".") : "") + "'>" +
			"<label for='port'>"+OSApp.Language._("Port")+"</label>"+
			"<input id='port' type='number' inputmode='decimal' min='1' max='99999' value='" + monitor.port + "'>" +
			"</div>"+

			//END
			"<button class='submit' data-theme='b'>" + OSApp.Language._("Submit") + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-monitor' value='" + monitor.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				OSApp.Language._("Delete") + "</a>")) +

			"</div>" +
			"</div>";

		let popup = $(list),

			changeValue = function (pos, dir) {
				var input = popup.find(".inputs input").eq(pos),
					val = parseInt(input.val());

				if ((dir === -1 && val === 0) || (dir === 1 && val === 100)) {
					return;
				}

				input.val(val + dir);
			};

		//Delete a program adjust:
		popup.find(".delete-monitor").on("click", function () {
			var dur = $(this),
				value = dur.attr("value"),
				row = dur.attr("row");

			popup.popup("close");

			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to delete this monitor?"), value, function () {
				return OSApp.Firmware.sendToOS("/mc?pw=&nr=" + value + "&type=0", "json").done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.monitors.splice(row, 1);
					callbackCancel();
				});
			});
		});

		popup.find(".submit").on("click", function () {

			var monitor = OSApp.Analog.getMonitor(popup);
			if (monitor.missingValue) {
				OSApp.Errors.showError(OSApp.Language._('Please fill the required fields'));
				monitor.missingValue.focus();
			} else {
				callback(monitor);
				popup.popup("close");
			}
			return false;
		});

		OSApp.UIDom.holdButton(popup.find(".incr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, 1);
			return false;
		});

		OSApp.UIDom.holdButton(popup.find(".decr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, -1);
			return false;
		});

		popup.find("#type").change(function () {
			var type = parseInt($(this).val());
			OSApp.Analog.updateMonitorEditorType(popup, type);
		});

		$("#monitorEditor").remove();

		OSApp.Analog.updateMonitorEditorType(popup, monitor.type);

		OSApp.UIDom.openPopup(popup, { positionTo: "origin" });
	});
};

OSApp.Analog.updateMonitorEditorType = function(popup, type) {
	popup.find("#type_minmax").hide();
	popup.find("#type_sensor12").hide();
	popup.find("#type_set_sensor12").hide();
	popup.find("#type_andorxor").hide();
	popup.find("#type_not").hide();
	popup.find("#type_time").hide();
	popup.find("#type_remote").hide();
	popup.find("#sel_sensor").hide();
	switch(type) {
		case OSApp.Analog.Constants.MONITOR_MIN:
		case OSApp.Analog.Constants.MONITOR_MAX:
			popup.find("#sel_sensor").show();
			popup.find("#type_minmax").show();
			break;
		case OSApp.Analog.Constants.MONITOR_SENSOR12:
			popup.find("#type_sensor12").show();
			break;
		case OSApp.Analog.Constants.MONITOR_SET_SENSOR12:
			popup.find("#type_set_sensor12").show();
			break;
		case OSApp.Analog.Constants.MONITOR_AND:
		case OSApp.Analog.Constants.MONITOR_OR:
		case OSApp.Analog.Constants.MONITOR_XOR:
			popup.find("#type_andorxor").show();
			break;
		case OSApp.Analog.Constants.MONITOR_NOT:
			popup.find("#type_not").show();
			break;
		case OSApp.Analog.Constants.MONITOR_TIME:
			popup.find("#type_time").show();
			break;
		case OSApp.Analog.Constants.MONITOR_REMOTE:
			popup.find("#type_remote").show();
			break;
		}
};

OSApp.Analog.isSmt100 = function( sensorType ) {
	if ( !sensorType ) {
		return false;
	}
	return sensorType >= OSApp.Analog.Constants.SENSOR_SMT100_MOIS && sensorType <= OSApp.Analog.Constants.SENSOR_TH100_TEMP;
};


OSApp.Analog.isIPSensor = function(sensorType) {
	return OSApp.Analog.isSmt100(sensorType) || sensorType == OSApp.Analog.Constants.SENSOR_REMOTE;
}

OSApp.Analog.isIDNeeded = function(sensorType) {
	return sensorType < OSApp.Analog.Constants.SENSOR_OSPI_INTERNAL_TEMP || sensorType == OSApp.Analog.Constants.SENSOR_REMOTE;
}

//show and hide sensor editor fields
OSApp.Analog.updateSensorVisibility = function(popup, type) {
	if (OSApp.Analog.isIPSensor(type)) {
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
	if (OSApp.Analog.isIDNeeded(type)) {
		popup.find(".id_label").show();
		popup.find(".id").show();
	} else {
		popup.find(".id_label").hide();
		popup.find(".id").hide();
	}
	if (OSApp.Analog.isSmt100(type)) {
		popup.find("#smt100id").show();
	} else {
		popup.find("#smt100id").hide();
	}
	if (type == OSApp.Analog.Constants.SENSOR_USERDEF) {
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
	if (type == OSApp.Analog.Constants.SENSOR_MQTT) {
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

	var unitid = popup.find("#unitid").val();
	if (type == OSApp.Analog.Constants.SENSOR_MQTT || type == OSApp.Analog.Constants.SENSOR_USERDEF || unitid == OSApp.Analog.Constants.USERDEF_UNIT) {
		popup.find(".unit_label").show();
		popup.find(".unit").show();
	} else {
		popup.find(".unit_label").hide();
		popup.find(".unit").hide();
	}
};

OSApp.Analog.saveSensor = function(popup, sensor, callback) {

	if (!sensor.nr) { //New Sensor - check existing Nr to avoid overwriting
		var nr = parseInt(popup.find(".nr").val());
		for (var i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			if (OSApp.Analog.analogSensors[i].nr === nr) {
				OSApp.Errors.showError(OSApp.Language._("Sensor number exists!"));
				return;
			}
		}
	}
	var sensorOut = {};
	OSApp.Analog.addToObjectInt(popup, ".nr", sensorOut);
	OSApp.Analog.addToObjectInt(popup, "#type", sensorOut);
	OSApp.Analog.addToObjectInt(popup, ".group", sensorOut);
	OSApp.Analog.addToObjectStr(popup, ".name", sensorOut);
	OSApp.Analog.addToObjectIPs(popup, ".ip", sensorOut);
	OSApp.Analog.addToObjectInt(popup, ".port", sensorOut);
	OSApp.Analog.addToObjectInt(popup, ".id", sensorOut);
	OSApp.Analog.addToObjectInt(popup, ".ri", sensorOut);
	OSApp.Analog.addToObjectInt(popup, ".fac", sensorOut);
	OSApp.Analog.addToObjectInt(popup, ".div", sensorOut);
	OSApp.Analog.addToObjectInt(popup, ".offset", sensorOut);
	OSApp.Analog.addToObjectStr(popup, ".unit", sensorOut);
	OSApp.Analog.addToObjectInt(popup, "#unitid", sensorOut);
	OSApp.Analog.addToObjectChk(popup, "#enable", sensorOut);
	OSApp.Analog.addToObjectChk(popup, "#log", sensorOut);
	OSApp.Analog.addToObjectChk(popup, "#show", sensorOut);
	OSApp.Analog.addToObjectStr(popup, ".topic", sensorOut);
	OSApp.Analog.addToObjectStr(popup, ".filter", sensorOut);

	if (sensorOut.missingValue) {
		OSApp.Errors.showError(OSApp.Language._('Please fill the required fields'));
		sensorOut.missingValue.focus();
	} else {
		callback(sensorOut);
		popup.popup("close");
	}
	return false;
}


// Analog sensor editor
OSApp.Analog.showSensorEditor = function(sensor, row, callback, callbackCancel) {

	OSApp.Firmware.sendToOS("/sf?pw=", "json").then(function (data) {
		var supportedSensorTypes = data.sensorTypes;
		var i;

		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var list = "<div data-role='popup' data-theme='a' id='sensorEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+OSApp.Language._("Close")+"</a>"+
			"<h1>" + (sensor.nr > 0 ? OSApp.Language._("Edit Sensor") : OSApp.Language._("New Sensor")) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			OSApp.Language._("Edit Sensor Configuration. ") +
			OSApp.Language._("See help documentation for details.") +
			"<br>" +
			OSApp.Language._("Last") + ": " + (sensor.last === undefined ? "" : OSApp.Dates.dateToString(new Date(sensor.last * 1000))) +
			"</p>" +
			"<div class='ui-field-contain'>" +
			"<label>" +
			OSApp.Language._("Sensor Nr") +
			"</label>" +
			"<input class='nr' type='number' inputmode='decimal' min='1' max='99999' required value='" + sensor.nr + (sensor.nr > 0 ? "' disabled='disabled'>" : "'>") +

			"<div class='ui-field-contain'><label for='type' class='select'>" +
			OSApp.Language._("Type") +
			"</label><select data-mini='true' id='type' required>";

		for (i = 0; i < supportedSensorTypes.length; i++) {
			list += "<option " + ((sensor.type === supportedSensorTypes[i].type) ? "selected" : "") +
				" value='" + supportedSensorTypes[i].type + "'>" +
				supportedSensorTypes[i].name + "</option>";
		}
		list += "</select></div>";

		list += "<button data-mini='true' class='center-div' id='smt100id'>" + OSApp.Language._("Set SMT100 Modbus ID") + "</button>";

		list += "<label>" + OSApp.Language._("Group") +
			"</label>" +
			"<input class='group' type='number'  inputmode='decimal' min='0' max='99999' value='" + sensor.group + "'>" +

			"<label>" + OSApp.Language._("Name") +
			"</label>" +
			"<input class='name' type='text' maxlength='29' value='" + sensor.name + "' required>" +

			"<label class='ip_label'>" + OSApp.Language._("IP Address") +
			"</label>" +
			"<input class='ip' type='text'  value='" + (sensor.ip ? OSApp.Analog.toByteArray(sensor.ip).join(".") : "") + "'>" +

			"<label class='port_label'>" + OSApp.Language._("Port") +
			"</label>" +
			"<input class='port' type='number' inputmode='decimal' min='0' max='65535' value='" + sensor.port + "'>" +

			"<label class='id_label'>" + OSApp.Language._("ID") +
			"</label>" +
			"<input class='id' type='number' inputmode='decimal' min='0' max='65535' value='" + sensor.id + "'>" +

			"<label class='fac_label'>" + OSApp.Language._("Factor") +
			"</label>" +
			"<input class='fac' type='number' inputmode='decimal' min='-32768' max='32767' value='" + sensor.fac + "'>" +

			"<label class='div_label'>" + OSApp.Language._("Divider") +
			"</label>" +
			"<input class='div' type='number' inputmode='decimal' min='-32768' max='32767' value='" + sensor.div + "'>" +

			"<label class='offset_label'>" + OSApp.Language._("Offset in millivolt") +
			"</label>" +
			"<input class='offset' type='number' inputmode='decimal' min='-32768' max='32767' value='" + sensor.offset + "'>" +

			"<label class='chartunit_label'>" + OSApp.Language._("Chart Unit") +
			"</label>" +
			"<select data-mini='true' id='unitid'>";

			for (const key in OSApp.Analog.Constants.UNITS) {
				if (OSApp.Analog.Constants.UNITS.hasOwnProperty(key)) {
					const unit = OSApp.Analog.Constants.UNITS[key];
					list += `<option value="${unit.ID}">${unit.NAME}</option>`;
				}
			}

			list += "</select>" +

			"<label class='unit_label'>" + OSApp.Language._("Unit") +
			"</label>" +
			"<input class='unit' type='text'  value='" + (sensor.unit ? sensor.unit : "") + "'>" +

			"<label class='topic_label'>" + OSApp.Language._("MQTT Topic") +
			"</label>" +
			"<input class='topic' type='text'  value='" + (sensor.topic ? sensor.topic : "") + "'>" +

			"<label class='filter_label'>" + OSApp.Language._("MQTT Filter") +
			"</label>" +
			"<input class='filter' type='text'  value='" + (sensor.filter ? sensor.filter : "") + "'>" +

			"<label>" + OSApp.Language._("Read Interval (s)") +
			"</label>" +
			"<input class='ri' type='number' inputmode='decimal' min='1' max='999999' value='" + sensor.ri + "'>" +

			"<label for='enable'><input data-mini='true' id='enable' type='checkbox' " + ((sensor.enable === 1) ? "checked='checked'" : "") + ">" +
			OSApp.Language._("Sensor Enabled") +
			"</label>" +

			"<label for='log'><input data-mini='true' id='log' type='checkbox' " + ((sensor.log === 1) ? "checked='checked'" : "") + ">" +
			OSApp.Language._("Enable Data Logging") +
			//"<a href='#' data-role='button' data-mini='true' id='display-log' value='"+sensor.nr+"' data-icon='action' data-inline='true' style='margin-left: 9px;'>" +
			//OSApp.Language._("display log") + "</a>" +
			"<a href='#' data-role='button' data-mini='true' id='download-log' data-icon='action' data-inline='true' style='margin-left: 9px;'>" +
			OSApp.Language._("Download Log") + "</a>" +
			"<a href='#' data-role='button' data-mini='true' id='delete-sen-log' value='" + sensor.nr + "' data-icon='delete' data-inline='true' style='margin-left: 9px;'>" +
			OSApp.Language._("Delete Log") + "</a>" +
			"</label>" +

			"<label for='show'><input data-mini='true' id='show' type='checkbox' " + ((sensor.show === 1) ? "checked='checked'" : "") + ">" +
			OSApp.Language._("Show on Mainpage") +
			"</label>" +

			"</div>" +

			"<button class='submit' data-theme='b'>" + OSApp.Language._("Submit") + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-sensor' value='" + sensor.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				OSApp.Language._("Delete") + "</a>")) +

			"</div>" +
			"</div>";

		var popup = $(list),

			changeValue = function (pos, dir) {
				var input = popup.find(".inputs input").eq(pos),
					val = parseInt(input.val());

				if ((dir === -1 && val === 0) || (dir === 1 && val === 100)) {
					return;
				}

				input.val(val + dir);
			};

		popup.find("#type").change(function () {
			var type = $(this).val();
			OSApp.Analog.updateSensorVisibility(popup, type);
		});

		//SMT 100 Toolbox function: SET ID
		popup.find("#smt100id").on("click", function () {
			var nr = parseInt(popup.find(".nr").val()),
				newid = parseInt(popup.find(".id").val());
			OSApp.Analog.saveSensor(popup, sensor, callback);
			OSApp.UIDom.areYouSure(OSApp.Language._("This function sets the Modbus ID for one SMT100 sensor. Disconnect all other sensors on this Modbus port. Please confirm."),
				"new id=" + newid, function () {
					OSApp.Firmware.sendToOS("/sa?pw=&nr=" + nr + "&id=" + newid).done(function () {
						OSApp.Errors.showError(OSApp.Language._("SMT100 id assigned!"));
						OSApp.Analog.updateAnalogSensor(callbackCancel);
					});
				});
		});
		popup.find("#type").change(function () {
			var type = parseInt(popup.find("#type").val());
			document.getElementById("smt100id").style.display = OSApp.Analog.isSmt100(type) ? "block" : "none";
		});

		//download log:
		popup.find("#display-log").on("click", function () {
			var dur = $(this),
				value = dur.attr("value");
			popup.popup("close");

			OSApp.UIDom.changePage("#analogsensorchart_"+value);
			return false;
		});

		//download log:
		popup.find("#download-log").on("click", function () {
			var link = document.createElement("a");
			link.style.display = "none";
			link.setAttribute("download", "sensorlog-" + sensor.name + "-" + new Date().toLocaleDateString().replace(/\//g, "-") + ".csv");

			var limit = OSApp.currentSession.token ? "&max=5500" : ""; //download limit is 140kb, 5500 lines ca 137kb
			var dest = "/so?pw=&csv=1&nr="+ sensor.nr + limit;
			dest = dest.replace("pw=", "pw=" + OSApp.Analog.enc(OSApp.currentSession.pass));
			link.target = "_blank";
			link.href = OSApp.currentSession.token ? ("https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + dest) : (OSApp.currentSession.prefix + OSApp.currentSession.ip + dest);
			document.body.appendChild(link); // Required for FF
			link.click();
			return false;
		});

		//delete sensor log:
		popup.find("#delete-sen-log").on("click", function () {
			var dur = $(this),
			value = dur.attr("value");

			OSApp.Analog.saveSensor(popup, sensor, callback);
			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to delete the log?"), value, function () {
				return OSApp.Firmware.sendToOS("/sn?pw=&nr=" + value, "json").done(function (info) {
					var result = info.deleted;
					if (!result)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + result);
					else
						OSApp.Errors.showError(OSApp.Language._("Deleted log values: ") + result);
				});
			});
			return false;
		});

		//Delete a sensor:
		popup.find(".delete-sensor").on("click", function () {

			var dur = $(this),
				value = dur.attr("value"),
				row = dur.attr("row");

			popup.popup("close");

			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to delete the sensor?"), value, function () {
				return OSApp.Firmware.sendToOS("/sc?pw=&nr=" + value + "&type=0", "json").done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
					OSApp.Analog.analogSensors.splice(row, 1);
					OSApp.Analog.updateAnalogSensor(callbackCancel);
				});
			});
		});

		popup.find("#unitid").val(sensor.unitid ? sensor.unitid : 0).change();

		popup.find(".submit").on("click", function () {
			OSApp.Analog.saveSensor(popup, sensor, callback);
		});

		popup.on("focus", "input[type='number']", function () {
			this.select();
		}).on("blur", "input[type='number']", function () {

			var min = parseFloat(this.min),
				max = parseFloat(this.max);

			if (this.value === "") {
				this.value = "0";
			}
			if (this.value < min || this.value > max) {
				this.value = this.value < min ? min : max;
			}
		});

		OSApp.UIDom.holdButton(popup.find(".incr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, 1);
			return false;
		});

		OSApp.UIDom.holdButton(popup.find(".decr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, -1);
			return false;
		});

		$("#sensorEditor").remove();

		popup.css("max-width", "580px");

		OSApp.Analog.updateSensorVisibility(popup, sensor.type);

		OSApp.UIDom.openPopup(popup, { positionTo: "origin" });
	});
};


// Config Page
OSApp.Analog.showAnalogSensorConfig = function() {

	var page = $("<div data-role='page' id='analogsensorconfig'>" +
		"<div class='ui-content' role='main' id='analogsensorlist'>" +
		"</div></div>");

	page
		.on("sensorrefresh", updateSensorContent)
		.on("pagehide", function () {
			page.detach();
		});

	function updateSensorContent() {
		var list = $(OSApp.Analog.buildSensorConfig());

		//Edit a sensor:
		list.find(".edit-sensor").on("click", function () {
			var dur = $(this),
				row = dur.attr("row");

			var sensor = OSApp.Analog.analogSensors[row];

			OSApp.Analog.expandItem.add("sensors");
			OSApp.Analog.showSensorEditor(sensor, row, function (sensorOut) {
				sensorOut.nativedata = sensor.nativedata;
				sensorOut.data = sensor.data;
				sensorOut.last = sensor.last;
				return OSApp.Analog.sendToOsObj("/sc?pw=", sensorOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.analogSensors[row] = sensorOut;
					updateSensorContent();
				});
			}, updateSensorContent);
		});

		// Add a new analog sensor:
		list.find(".add-sensor").on("click", function () {
			var sensor = {
				name: "new sensor",
				type: 1,
				ri: 600,
				enable: 1,
				log: 1
			};

			OSApp.Analog.showSensorEditor(sensor, -1, function (sensorOut) {
				return OSApp.Analog.sendToOsObj("/sc?pw=", sensorOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					OSApp.Analog.updateAnalogSensor(function () {
						updateSensorContent();
					});
				});
			}, updateSensorContent);
		});

		// Refresh sensor data:
		list.find(".refresh-sensor").on("click", function () {
			OSApp.Analog.expandItem.add("sensors");
			OSApp.Analog.updateProgramAdjustments(function () {
				OSApp.Analog.updateMonitors(function () {
					OSApp.Analog.updateAnalogSensor(function () {
						updateSensorContent();
					});
				});
			});
		});

		//Edit a program adjust:
		list.find(".edit-progadjust").on("click", function () {
			var dur = $(this),
				row = dur.attr("row");

			var progAdjust = OSApp.Analog.progAdjusts[row];

			OSApp.Analog.expandItem.add("progadjust");
			OSApp.Analog.showAdjustmentsEditor(progAdjust, row, function (progAdjustOut) {

				return OSApp.Analog.sendToOsObj("/sb?pw=", progAdjustOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.progAdjusts[row] = progAdjustOut;
					OSApp.Analog.updateProgramAdjustments(updateSensorContent);
				});
			}, updateSensorContent);
		});

		//Add a new program adjust:
		list.find(".add-progadjust").on("click", function () {
			var progAdjust = {
				type: 1
			};

			OSApp.Analog.expandItem.add("progadjust");
			OSApp.Analog.showAdjustmentsEditor(progAdjust, -1, function (progAdjustOut) {
				return OSApp.Analog.sendToOsObj("/sb?pw=", progAdjustOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.progAdjusts.push(progAdjustOut);
						OSApp.Analog.updateProgramAdjustments(updateSensorContent);
				});
			}, updateSensorContent);
		});

		if (OSApp.Firmware.checkOSVersion(233) && OSApp.Analog.monitors)
		{
			//Edit a monitor:
			list.find(".edit-monitor").on("click", function () {
				var dur = $(this),
					row = dur.attr("row");

				var monitor = OSApp.Analog.monitors[row];

				OSApp.Analog.expandItem.add("monitors");
				OSApp.Analog.showMonitorEditor(monitor, row, function (monitorOut) {

					return OSApp.Analog.sendToOsObj("/mc?pw=", monitorOut).done(function (info) {
						var result = info.result;
						if (!result || result > 1)
							OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
						else
							OSApp.Analog.monitors[row] = monitorOut;
							OSApp.Analog.updateProgramAdjustments(updateSensorContent);
					});
				}, updateSensorContent);
			});

			//Add a monitor:
			list.find(".add-monitor").on("click", function () {
				var monitor = {
					type: 1
				};

				OSApp.Analog.expandItem.add("monitors");
				OSApp.Analog.showMonitorEditor(monitor, -1, function (monitorOut) {
					return OSApp.Analog.sendToOsObj("/mc?pw=", monitorOut).done(function (info) {
						var result = info.result;
						if (!result || result > 1)
							OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
						else
							OSApp.Analog.monitors.push(monitorOut);
						OSApp.Analog.updateMonitors(updateSensorContent);
					});
				}, updateSensorContent);
			});
		}
		// Clear sensor log
		list.find(".clear_sensor_logs").on("click", function () {
			OSApp.Analog.expandItem.add("sensorlog");
			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to clear the sensor log?"), "", function () {
				return OSApp.Firmware.sendToOS("/sn?pw=&", "json").done(function (result) {
					OSApp.Errors.showError(OSApp.Language._("Log cleared:") + " " + result.deleted + " " + OSApp.Language._("records"));
					updateSensorContent();
				});
			});
		});

		list.find(".download-log").on("click", function () {
			OSApp.Analog.expandItem.add("sensorlog");
			var link = document.createElement("a");
			link.style.display = "none";
			link.setAttribute("download", "sensorlog-" + new Date().toLocaleDateString().replace(/\//g, "-") + ".csv");

			var limit = OSApp.currentSession.token ? "&max=5500" : ""; //download limit is 140kb, 5500 lines ca 137kb
			var dest = "/so?pw=&csv=1" + limit;
			dest = dest.replace("pw=", "pw=" + OSApp.Analog.enc(OSApp.currentSessing.pass));
			link.target = "_blank";
			link.href = OSApp.currentSession.token ? ("https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + dest) : (OSApp.currentSession.prefix + OSApp.currentSession.ip + dest);
			document.body.appendChild(link); // Required for FF
			link.click();
			return false;
		});

		list.find(".show-log").on("click", function () {
			OSApp.Analog.expandItem.add("sensorlog");
			OSApp.UIDom.changePage("#analogsensorchart");
			return false;
		});

		list.find(".backup-all").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getExportMethodSensors(OSApp.Analog.Constants.BACKUPS.ALL.ID);
			return false;
		});

		list.find(".restore-all").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getImportMethodSensors(OSApp.Analog.Constants.BACKUPS.ALL.ID, updateSensorContent);
			return false;
		});

		list.find(".backup-sensors").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getExportMethodSensors(OSApp.Analog.Constants.BACKUPS.SENSORS.ID);
			return false;
		});

		list.find(".restore-sensors").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getImportMethodSensors(OSApp.Analog.Constants.BACKUPS.SENSORS.ID, updateSensorContent);
			return false;
		});

		list.find(".backup-adjustments").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getExportMethodSensors(OSApp.Analog.Constants.BACKUPS.ADJUSTMENTS.ID);
			return false;
		});

		list.find(".restore-adjustments").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getImportMethodSensors(OSApp.Analog.Constants.BACKUPS.ADJUSTMENTS.ID, updateSensorContent);
			return false;
		});

		list.find(".backup-monitors").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getExportMethodSensors(OSApp.Analog.Constants.BACKUPS.MONITOR.ID);
			return false;
		});

		list.find(".restore-monitors").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getImportMethodSensors(OSApp.Analog.Constants.BACKUPS.MONITOR.ID, OSApp.Analog.updateMonitors);
			return false;
		});

		page.find("#analogsensorlist").html(list).enhanceWithin();
	}

	OSApp.UIDom.changeHeader({
		title: OSApp.Language._("Analog Sensor Config"),
		leftBtn: {
			icon: "carat-l",
			text: OSApp.Language._("Back"),
			class: "ui-toolbar-back-btn",
			on: function() { OSApp.UIDom.goBack(); }
		},
		rightBtn: {
			icon: "refresh",
			text: screen.width >= 500 ? OSApp.Language._("Refresh") : "",
			on: function() { updateSensorContent(); }
		}
	});

	updateSensorContent();

	$("#analogsensorconfig").remove();
	$.mobile.pageContainer.append(page);
};

OSApp.Analog.checkFirmwareUpdate = function() {
	if (OSApp.Firmware.checkOSVersion(OSApp.Analog.Constants.MIN_REQ_FW_ID) && OSApp.currentSession.controller.options.fwm >= OSApp.Analog.Constants.MIN_REQ_FW_MIN)
		return "";
	return OSApp.Language._("Please update to firmware version ") + OSApp.Analog.Constants.MIN_REQ_FW_VERSION + " " + OSApp.Language._("or later");
};

OSApp.Analog.buildSensorConfig = function() {

	//detected Analog Sensor Boards:
	var detected_boards = "";
	if (Object.prototype.hasOwnProperty.call(OSApp.Analog.analogSensors, "detected")) {
		var boards = [];
		let detected = OSApp.Analog.analogSensors.detected;
		if (detected & OSApp.Analog.Constants.ASB_BOARD1) boards.push("ASB 1");
		if (detected & OSApp.Analog.Constants.ASB_BOARD2) boards.push("ASB 2");
		if (detected & OSApp.Analog.Constants.OSPI_PCF8591) boards.push("OSPI PCF8591");
		if (detected & OSApp.Analog.Constants.OSPI_ADS1115) boards.push("OSPI 2xADS1115");
		if (detected & OSApp.Analog.Constants.UART_SC16IS752) boards.push("UART-Adapter I2C");
		if (detected & OSApp.Analog.Constants.RS485_TRUEBNER1) boards.push("RS485-Adapter Truebner");
		if (detected & OSApp.Analog.Constants.RS485_TRUEBNER2) boards.push("RS485-Adapter Truebner 2");
		if (detected & OSApp.Analog.Constants.RS485_TRUEBNER3) boards.push("RS485-Adapter Truebner 3");
		if (detected & OSApp.Analog.Constants.RS485_TRUEBNER4) boards.push("RS485-Adapter Truebner 4");
		if (detected & OSApp.Analog.Constants.OSPI_USB_RS485) boards.push("OSPI USB-RS485-Adapter");
		if (detected == 0) boards.push(OSApp.Language._("No Boards detected"));
		if (detected && boards.length == 0) boards.push(OSApp.Language._("Unknown Adapter"));
		detected_boards = ": " + boards.filter(Boolean).join(", ");
	}

	var list = "<fieldset data-role='collapsible'" + (OSApp.Analog.expandItem.has("sensors") ? " data-collapsed='false'" : "") + ">" +
		"<legend>" + OSApp.Language._("Sensors") + detected_boards + "</legend>";

	var info = OSApp.Analog.checkFirmwareUpdate();
	if (info === undefined)
		info = "";
	list += "<table style='width: 100%;' id='analog_sensor_table'><tr>" +
		info +
		"<tr><th>" + OSApp.Language._("Nr") + "</th><th class=\"hidecol\">" + OSApp.Language._("Type") + "</th><th class=\"hidecol\">" + OSApp.Language._("Group") + "</th><th>" + OSApp.Language._("Name") + "</th>" +
		"<th class=\"hidecol\">" + OSApp.Language._("IP") + "</th><th class=\"hidecol\">" + OSApp.Language._("Port") + "</th><th class=\"hidecol\">" + OSApp.Language._("ID") + "</th>" +
		"<th class=\"hidecol\">" + OSApp.Language._("Read") + "<br>" + OSApp.Language._("Interval") + "</th><th>" + OSApp.Language._("Data") + "</th><th>" + OSApp.Language._("En") + "</th>" +
		"<th class=\"hidecol\">" + OSApp.Language._("Log") + "</th><th class=\"hidecol\">" + OSApp.Language._("Show") + "</th><th class=\"hidecol2\">" + OSApp.Language._("Last") + "</th></tr>";

	var checkpng = "<img src=\"" + OSApp.UIDom.getAppURLPath() + "img/check-blue.png\">";

	var row = 0;
	$.each(OSApp.Analog.analogSensors, function (_i, item) {

		var $tr = $("<tr>").append(
			$("<td>").text(item.nr),
			$("<td class=\"hidecol\">").text(item.type),
			$("<td class=\"hidecol\">").text(item.group ? item.group : ""),
			"<td><a data-role='button' class='edit-sensor' value='" + item.nr + "' row='" + row + "' href='#' data-mini='true' data-icon='edit'>" +
			item.name + "</a></td>",
			$("<td class=\"hidecol\">").text(item.ip ? OSApp.Analog.toByteArray(item.ip).join(".") : ""),
			$("<td class=\"hidecol\">").text(item.port ? (":" + item.port) : ""),
			$("<td class=\"hidecol\">").text(isNaN(item.id) ? "" : (item.type < OSApp.Analog.Constants.SENSOR_GROUP_MIN ? item.id : "")),
			$("<td class=\"hidecol\">").text(isNaN(item.ri) ? "" : item.ri),
			$("<td>").text(isNaN(item.data) ? "" : (OSApp.Analog.formatVal(item.data) + item.unit)),
			"<td>" + (item.enable ? checkpng : "") + "</td>",
			"<td class=\"hidecol\">" + (item.log ? checkpng : "") + "</td>",
			"<td class=\"hidecol\">" + (item.show ? checkpng : "") + "</td>",
			$("<td class=\"hidecol2\">").text(item.last === undefined ? "" : (item.data_ok ? OSApp.Dates.dateToString(new Date(item.last * 1000)) : ""), null, 2)
		);
		list += $tr.wrap("<p>").html() + "</tr>";
		row++;
	});
	list += "</table>";
	list += "<a data-role='button' class='add-sensor'     href='#' data-mini='true' data-icon='plus'   >" +
		OSApp.Language._("Add Sensor") + "</a>";
	list += "<a data-role='button' class='refresh-sensor' href='#' data-mini='true' data-icon='refresh'>" +
		OSApp.Language._(" data") + "</a>";
	list += "</fieldset>";

	//Program adjustments table:
	list += "<fieldset data-role='collapsible'" + (OSApp.Analog.expandItem.has("progadjust") ? " data-collapsed='false'" : "") + ">" +
		"<legend>" + OSApp.Language._("Program Adjustments") + "</legend>";
	list += "<table style='width: 100%;' id='progadjusttable'><tr style='width:100%;vertical-align: top;'>" +
		"<tr><th>" + OSApp.Language._("Nr") + "</th>" +
		"<th class=\"hidecol\">" + OSApp.Language._("Type") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("S.Nr") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Sensor") + "</th>" +
		"<th>" + OSApp.Language._("Name") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Program") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Factor 1") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Factor 2") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Min Value") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Max Value") + "</th>" +
		"<th>" + OSApp.Language._("Cur") + "</th></tr>";

	row = 0;
	$.each(OSApp.Analog.progAdjusts, function (_i, item) {

		var sensorName = "";
		for (var j = 0; j < OSApp.Analog.analogSensors.length; j++) {
			if (OSApp.Analog.analogSensors[j].nr === item.sensor) {
				sensorName = OSApp.Analog.analogSensors[j].name;
			}
		}
		var progName = "?";
		if (item.prog >= 1 && item.prog <= OSApp.currentSession.controller.programs.pd.length) {
			progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[item.prog - 1]).name;
		}

		if (!OSApp.Firmware.checkOSVersion(233))
			item.name = sensorName+"/"+progName;

		var $tr = $("<tr>").append(
			$("<td>").text(item.nr),
			$("<td class=\"hidecol\">").text(item.type),
			$("<td class=\"hidecol2\">").text(item.sensor),
			$("<td class=\"hidecol2\">").text(sensorName),
			"<td><a data-role='button' class='edit-progadjust' value='" + item.nr + "' row='" + row + "' href='#' data-mini='true' data-icon='edit'>" +
			item.name + "</a></td>",
			$("<td class=\"hidecol2\">").text(progName),
			$("<td class=\"hidecol2\">").text(Math.round(item.factor1 * 100) + "%"),
			$("<td class=\"hidecol2\">").text(Math.round(item.factor2 * 100) + "%"),
			$("<td class=\"hidecol2\">").text(item.min),
			$("<td class=\"hidecol2\">").text(item.max),
			$("<td>").text(item.current === undefined ? "" : (Math.round(item.current * 100.0) + "%"))
		);
		list += $tr.wrap("<p>").html() + "</tr>";
		row++;
	});
	list += "</table>";
	list += "<a data-role='button' class='add-progadjust' href='#' data-mini='true' data-icon='plus'>" + OSApp.Language._("Add program adjustment") + "</a>";
	list += "</fieldset>";

	//Monitors table:
	if (OSApp.Firmware.checkOSVersion(233) && OSApp.Analog.monitors) {
		list += "<fieldset data-role='collapsible'" + (OSApp.Analog.expandItem.has("monitors") ? " data-collapsed='false'" : "") + ">" +
			"<legend>" + OSApp.Language._("Monitoring and control") + "</legend>";
		list += "<table style='width: 100%; id='monitorstable'><tr style='width:100%;vertical-align: top;'>" +
			"<tr><th>" + OSApp.Language._("Nr") + "</th>" +
			"<th class=\"hidecol\">" + OSApp.Language._("Type") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("S.Nr") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Source") + "</th>" +
			"<th>" + OSApp.Language._("Name") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Program") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Zone") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Value 1") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Value 2") + "</th>" +
			"<th>" + OSApp.Language._("Activated") + "</th></tr>";

		row = 0;
		$.each(OSApp.Analog.monitors, function (_i, item) {
			var progName = "";
			if (item.prog > 0 && item.prog <= OSApp.currentSession.controller.programs.pd.length) {
				progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[item.prog - 1]).name;
			}
			var zoneName = "";
			if (item.zone > 0 && item.zone <= OSApp.currentSession.controller.stations.snames.length) {
				zoneName = OSApp.currentSession.controller.stations.snames[item.zone - 1];
			}
			var source = "";
			var unit = "";
			var sensorNr = "";
			switch(item.type) {
				case OSApp.Analog.Constants.MONITOR_MIN:
				case OSApp.Analog.Constants.MONITOR_MAX: {
					for (var j = 0; j < OSApp.Analog.analogSensors.length; j++) {
						if (OSApp.Analog.analogSensors[j].nr === item.sensor) {
							source = OSApp.Analog.analogSensors[j].name;
							unit = OSApp.Analog.analogSensors[j].unit;
						}
					}
					sensorNr = item.sensor;
					break;
				}
				case OSApp.Analog.Constants.MONITOR_SENSOR12: {
					if (item.sensor12 == 1)
						source = OSApp.currentSession.controller.options.sn1t === 3 ? OSApp.Language._( "Soil" ) : OSApp.Language._( "Rain" );
					else if (item.sensor12 == 2)
						source = OSApp.currentSession.controller.options.sn2t === 3 ? OSApp.Language._( "Soil" ) : OSApp.Language._( "Rain" );
					else
						source = "??";
					if (item.invers) source = OSApp.Language._("NOT") + " " + source;
					break;
				}
				case OSApp.Analog.Constants.MONITOR_SET_SENSOR12: {
					source = OSApp.Analog.getMonitorName(item.monitor);
					break;
				}

				case OSApp.Analog.Constants.MONITOR_AND:
				case OSApp.Analog.Constants.MONITOR_OR:
				case OSApp.Analog.Constants.MONITOR_XOR: {
					source = OSApp.Utils.combineWithSep(" " + OSApp.Analog.getMonitorLogical(item.type) + " ",
						OSApp.Analog.getMonitorSourceName(item.invers1, item.monitor1),
						OSApp.Analog.getMonitorSourceName(item.invers2, item.monitor2),
						OSApp.Analog.getMonitorSourceName(item.invers3, item.monitor3),
						OSApp.Analog.getMonitorSourceName(item.invers4, item.monitor4));
					break;
				}
				case OSApp.Analog.Constants.MONITOR_NOT: {
					source = OSApp.Analog.getMonitorLogical(item.type)+" "+OSApp.Analog.getMonitorName(item.monitor);
					break;
				}
				case OSApp.Analog.Constants.MONITOR_REMOTE: {
					source = OSApp.Analog.getMonitorLogical(item.type)+" "+OSApp.Analog.getMonitorName(item.monitor);
					break;
				}
			}
			var $tr = $("<tr>").append(
				$("<td>").text(item.nr),
				$("<td class=\"hidecol\">").text(item.type),
				$("<td class=\"hidecol2\">").text(sensorNr),
				$("<td class=\"hidecol2\">").text(source),
				"<td><a data-role='button' class='edit-monitor' value='" + item.nr + "' row='" + row + "' href='#' data-mini='true' data-icon='edit'>" +
				item.name + "</a></td>",
				$("<td class=\"hidecol2\">").text(progName),
				$("<td class=\"hidecol2\">").text(zoneName),
				$("<td class=\"hidecol2\">").text(OSApp.Analog.formatValUnit(item.value1, unit)),
				$("<td class=\"hidecol2\">").text(OSApp.Analog.formatValUnit(item.value2, unit)),
				$("<td>"+(item.active ? checkpng : ""))
			);
			list += $tr.wrap("<p>").html() + "</tr>";
			row++;
		});
		list += "</table>";
		list += "<a data-role='button' class='add-monitor' href='#' data-mini='true' data-icon='plus'>" + OSApp.Language._("Add monitor") + "</a>";
		list += "</fieldset>";
	}

	//Analog sensor logs:
	list += "<fieldset data-role='collapsible'" + (OSApp.Analog.expandItem.has("sensorlog") ? " data-collapsed='false'" : "") + ">" +
		"<legend>" + OSApp.Language._("Sensor Log") + "</legend>";
	list += "<a data-role='button' class='red clear_sensor_logs' href='#' data-mini='true' data-icon='alert'>" +
		OSApp.Language._("Clear Log") +
		"</a>" +
		"<a data-role='button' data-icon='action' class='download-log' href='#' data-mini='true'>" + OSApp.Language._("Download Log") + "</a>" +
		"<a data-role='button' data-icon='grid' class='show-log' href='#' data-mini='true'>" + OSApp.Language._("Show Log") + "</a>" +

		"</div></fieldset>";

	//backup:
	if (OSApp.Firmware.checkOSVersion(231)) {
		list += "<fieldset data-role='collapsible'" + (OSApp.Analog.expandItem.has("backup") ? " data-collapsed='false'" : "") + ">" +
			"<legend>" + OSApp.Language._("Backup and Restore") + "</legend>";
		list += "<a data-role='button' data-icon='arrow-d-r' class='backup-all'  href='#' data-mini='true'>" + OSApp.Language._("Backup Config") + "</a>" +
			"<a data-role='button' data-icon='back'      class='restore-all' href='#' data-mini='true'>" + OSApp.Language._("Restore Config") + "</a>";
		list += "<a data-role='button' data-icon='arrow-d-r' class='backup-sensors'  href='#' data-mini='true'>" + OSApp.Language._("Backup Sensor Config") + "</a>" +
			"<a data-role='button' data-icon='back'      class='restore-sensors' href='#' data-mini='true'>" + OSApp.Language._("Restore Sensor Config") + "</a>";
		list += "<a data-role='button' data-icon='arrow-d-r' class='backup-adjustments'  href='#' data-mini='true'>" + OSApp.Language._("Backup Program Adjustments") + "</a>" +
			"<a data-role='button' data-icon='back'      class='restore-adjustments' href='#' data-mini='true'>" + OSApp.Language._("Restore Program Adjustments") + "</a>";
		if (OSApp.Firmware.checkOSVersion(233)) {
			list += "<a data-role='button' data-icon='arrow-d-r' class='backup-monitors'  href='#' data-mini='true'>" + OSApp.Language._("Backup Monitors") + "</a>" +
				"<a data-role='button' data-icon='back'      class='restore-monitors' href='#' data-mini='true'>" + OSApp.Language._("Restore Monitors") + "</a>";
			list += "</div></fieldset>";
		}
	}
	return list;
};

OSApp.Analog.getMonitorLogical = function(type) {
	switch(type) {
		case OSApp.Analog.Constants.MONITOR_MIN: return OSApp.Language._("Min");
		case OSApp.Analog.Constants.MONITOR_MAX: return OSApp.Language._("Max");
		case OSApp.Analog.Constants.MONITOR_SENSOR12: return OSApp.Language._("SN 1/2");
		case OSApp.Analog.Constants.MONITOR_SET_SENSOR12: return OSApp.Language._("SET SN 1/2");
		case OSApp.Analog.Constants.MONITOR_AND: return OSApp.Language._("AND");
		case OSApp.Analog.Constants.MONITOR_OR: return OSApp.Language._("OR");
		case OSApp.Analog.Constants.MONITOR_XOR: return OSApp.Language._("XOR");
		case OSApp.Analog.Constants.MONITOR_NOT: return OSApp.Language._("NOT");
		case OSApp.Analog.Constants.MONITOR_TIME: return OSApp.Language._("TIME");
		case OSApp.Analog.Constants.MONITOR_REMOTE: return OSApp.Language._("REMOTE");
		default: return "??";
	}
};

OSApp.Analog.getMonitorSourceName = function(invers, monitorNr) {
	if (!monitorNr) return "";
	return (invers? (OSApp.Language._("NOT") + " ") : "")+ OSApp.Analog.getMonitorName(monitorNr);
};

OSApp.Analog.getMonitorName = function(monitorNr) {
	for (var i = 0; i < OSApp.Analog.monitors.length; i++) {
		let monitor = OSApp.Analog.monitors[i];
		if (monitor.nr === monitorNr)
			return monitor.name;
	}
	return "";
};

// Show Sensor Charts with apexcharts
OSApp.Analog.showAnalogSensorCharts = function(limit2sensor) {

	var max = OSApp.Analog.Constants.CHARTS;
	for (let j = 0; j < OSApp.Analog.analogSensors.length; j++) {
		if (!OSApp.Analog.analogSensors[j].log || !OSApp.Analog.analogSensors[j].enable)
			continue;
		var unitid = OSApp.Analog.analogSensors[j].unitid;
		if (unitid === OSApp.Analog.Constants.USERDEF_UNIT) max++;
	}

	var last = "", week = "", month = "";
	for (let j = 0; j <= max; j++) {
		last += "<div id='myChart" + j + "'></div>";
		week += "<div id='myChartW" + j + "'></div>";
		month += "<div id='myChartM" + j + "'></div>";
	}

	var page = $("<div data-role='page' id='analogsensorchart'>" +
		"<div class='ui-content' role='main' style='width: 95%'>" +
		last + week + month +
		"</div></div>");

	OSApp.UIDom.changeHeader({
		title: OSApp.Language._("Analog Sensor Log"),
		leftBtn: {
			icon: "carat-l",
			text: OSApp.Language._("Back"),
			class: "ui-toolbar-back-btn",
			on: function() {
				OSApp.UIDom.goBack();
			},
		},
		rightBtn: {
			icon: "refresh",
			text: screen.width >= 500 ? OSApp.Language._("Refresh") : "",
			class: "refresh-sensorlog",
			on: function() {
				OSApp.Analog.updateCharts(limit2sensor);
			},
		}
	});

	page.one("pagehide", function () {
		page.detach();
	});

	$("#analogsensorchart").remove();
	$.mobile.pageContainer.append(page);

	OSApp.Analog.updateCharts(limit2sensor);
}

OSApp.Analog.updateCharts = function(limit2sensor) {
	var chart1 = new Array(OSApp.Analog.Constants.CHARTS),
		chart2 = new Array(OSApp.Analog.Constants.CHARTS),
		chart3 = new Array(OSApp.Analog.Constants.CHARTS);

	var limit = OSApp.currentSession.token ? "&max=5500" : ""; //download limit is 140kb, 5500 lines ca 137kb
	var tzo = OSApp.Dates.getTimezoneOffsetOS() * 60;
	if (limit2sensor)
		limit += "&nr="+limit2sensor;

	OSApp.UIDom.showLoading( "#myChart0" );
	OSApp.Firmware.sendToOS("/so?pw=&lasthours=48&csv=2" + limit, "text", 90000).then(function (csv1) {
		OSApp.Analog.buildGraph("#myChart", chart1, csv1, OSApp.Language._("last 48h"), "HH:mm", tzo, 0);

		OSApp.UIDom.showLoading( "#myChartW0" );
		OSApp.Firmware.sendToOS("/so?pw=&csv=2&log=1" + limit, "text", 90000).then(function (csv2) {
			OSApp.Analog.buildGraph("#myChartW", chart2, csv2, OSApp.Language._("last weeks"), "dd.MM.yyyy", tzo, 1);

			OSApp.UIDom.showLoading( "#myChartM0" );
			OSApp.Firmware.sendToOS("/so?pw=&csv=2&log=2" + limit, "text", 90000).then(function (csv3) {
				OSApp.Analog.buildGraph("#myChartM", chart3, csv3, OSApp.Language._("last months"), "MM.yyyy", tzo, 2);
			});
		});
	});
}

OSApp.Analog.buildGraph = function(prefix, chart, csv, titleAdd, timestr, tzo, lvl) {
	var csvlines = csv.split(/(?:\r\n|\n)+/).filter(function (el) { return el.length !== 0; });

	var legends = [], opacities = [], widths = [], colors = [], coloridx = 0;
	let canExport = !!window.cordova;
	let combine = false; //lvl==0;
	let AllOptions = [];
	for (var j = 0; j < OSApp.Analog.analogSensors.length; j++) {
		var sensor = OSApp.Analog.analogSensors[j];
		let color = OSApp.Analog.Constants.COLORS[coloridx++ % OSApp.Analog.Constants.COLCOUNT];
		if (!sensor.log || !sensor.enable) {
			continue;
		}
		var nr = sensor.nr,
			logdata = [],
			rngdata = [],
			logmap = new Map(),
			unitid = sensor.unitid,
			lastdate = 0;

		for (var k = 1; k < csvlines.length; k++) {
			var line = csvlines[k].split(";");
			if (line.length >= 3 && Number(line[0]) === nr) {
				let date = Number(line[1]);
				if (date < lastdate) continue;
				lastdate = date;
				let value = Number(line[2]);
				if (value === undefined || date === undefined) continue;
				if (unitid != 3 && unitid != OSApp.Analog.Constants.USERDEF_UNIT && value > 100) continue;
				if (unitid == 1 && value < 0) continue;
				if (lvl == 0) //day values
					logdata.push({ x: (date - tzo) * 1000, y: value });
				else {
					var key;
					var fac;
					if (lvl == 1) //week values
						fac = 7 * 24 * 60 * 60;
					else //month values
						fac = 30 * 24 * 60 * 60;
					key = Math.trunc(date / fac) * fac * 1000;

					var minmax = logmap.get(key);
					if (!minmax)
						minmax = { min: value, max: value };
					else
						minmax = { min: Math.min(minmax.min, value), max: Math.max(minmax.max, value) };
					logmap.set(key, minmax);
				}
			}
		}

		if (lvl > 0) {
			for (let [key, value] of logmap) {
				rngdata.push({ x: key, y: [value.min, value.max] });
				logdata.push({ x: key, y: (value.max + value.min) / 2 });
			}
		}

		if (logdata.length < 3) continue;

		//add current value as forecast data:
		let date = new Date();
		date.setMinutes(date.getMinutes() - date.getTimezoneOffset() - tzo / 60);

		let value = sensor.data ? sensor.data : logdata.slice(-1)[0].y;
		logdata.push({ x: date, y: value });
		var fkdp = lvl < 1 ? 1 : 0;

		if (lvl > 0) {
			let rng = rngdata.slice(-1)[0].y;
			let diff = (rng[1] - rng[0]) / 2;
			rngdata.push({ x: date, y: [value - diff, value + diff] });
		}

		// User defined sensor:
		if (unitid === OSApp.Analog.Constants.USERDEF_UNIT) {
			unitid = chart.length;
			chart.push(undefined);
		} else if (unitid >= OSApp.Analog.Constants.CHARTS) {
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

		var series = { name: sensor.name, type: (sensor.unitid === OSApp.Analog.Constants.USERDEF_UNIT? "area" : "line"), data: logdata, color: color };

		if (!AllOptions[unitid]) {
			var unit, title, unitStr,
				minFunc = function (val) { return Math.floor(val > 0 ? Math.max(0, val - 4) : val - 1); },
				maxFunc = function (val) { return Math.ceil(val); },
				autoY = true;
			switch (unitid) {
				case OSApp.Analog.Constants.UNITS.SOIL_MOISTURE_PCT.ID: unit = OSApp.Language._("Soil moisture");
					title = OSApp.Language._("Soil moisture") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case OSApp.Analog.Constants.UNITS.DEGREE_CELCIUS.ID: unit = OSApp.Language._("Degree celsius temperature");
					title = OSApp.Language._("Temperature") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + String.fromCharCode(176) + "C"; };
					break;
				case OSApp.Analog.Constants.UNITS.DEGREE_FARENHEIT.ID: unit = OSApp.Language._("Degree fahrenheit temperature");
					title = OSApp.Language._("Temperature") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + String.fromCharCode(176) + "F"; };
					break;
				case OSApp.Analog.Constants.UNITS.VOLT_V.ID: unit = OSApp.Language._("Volt");
					title = OSApp.Language._("Voltage") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " V"; };
					minFunc = 0;
					maxFunc = 4;
					autoY = false;
					break;
				case OSApp.Analog.Constants.UNITS.AIR_HUMIDITY_PCT.ID: unit = OSApp.Language._("Humidity");
					title = OSApp.Language._("Air Humidity") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case OSApp.Analog.Constants.UNITS.INCH_IN.ID: unit = OSApp.Language._("Rain");
					title = OSApp.Language._("Rainfall") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " in"; };
					break;
				case OSApp.Analog.Constants.UNITS.MILLIMETER_MM.ID: unit = OSApp.Language._("Rain");
					title = OSApp.Language._("Rainfall") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " mm"; };
					minFunc = 0;
					break;
				case OSApp.Analog.Constants.UNITS.MPH.ID: unit = OSApp.Language._("Wind");
					title = OSApp.Language._("Wind") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " mph"; };
					minFunc = 0;
					break;
				case OSApp.Analog.Constants.UNITS.KMH.ID: unit = OSApp.Language._("Wind");
					title = OSApp.Language._("Wind") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " kmh"; };
					minFunc = 0;
					break;
				case OSApp.Analog.Constants.UNITS.LEVEL_PCT.ID: unit = OSApp.Language._("Level");
					title = OSApp.Language._("Level") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					autoY = false;
					break;
				case OSApp.Analog.Constants.UNITS.DK.ID: unit = OSApp.Language._("DK");
					title = OSApp.Language._("DK") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val); };
					minFunc = 0;
					break;
				case OSApp.Analog.Constants.UNITS.LUMEN_LM.ID: unit = OSApp.Language._("lm");
					title = OSApp.Language._("Lumen") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val); };
					minFunc = 0;
					break;
				case OSApp.Analog.Constants.UNITS.LUX_LX.ID: unit = OSApp.Language._("lx");
					title = OSApp.Language._("LUX") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val); };
					minFunc = 0;
					break;


				default: unit = sensor.unit;
					title = sensor.name + "~ " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val); };
			};

			let options = {
				chart: {
					type: lvl > 0 ? 'rangeArea' : 'area',
					animations: {
						speed: 500
					},
					stacked: false,
					width: '100%',
					height: (screen.height > screen.width ? screen.height : screen.width) / 3,
					toolbar: {
						download: canExport,
						autoSelected: 'zoom'
					},
					dropShadow: {
						enabled: true
					}
				},
				forecastDataPoints: {
					count: fkdp
				},
				dataLabels: {
					enabled: false
				},
				fill: {
					colors: colors[unitid],
					opacity: opacities[unitid],
					type: 'solid'
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
						datetimeUTC: false,
						format: timestr
					}
				},
				xaxis: {
					type: "datetime",
					labels: {
						datetimeUTC: false,
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
			AllOptions[unitid] = options;
		} else {
			AllOptions[unitid].series = AllOptions[unitid].series.concat(series);
		}

		if (lvl > 0) {
			opacities[unitid].push(0.24);
			widths[unitid].push(0);
			colors[unitid].push(color);
			let rangeArea = {
				type: 'rangeArea',
				name: [],
				color: color,
				data: rngdata
			};
			let otherOptions = {
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
			AllOptions[unitid].series = AllOptions[unitid].series.concat(rangeArea);
			AllOptions[unitid] = Object.assign(AllOptions[unitid], otherOptions);
		}
	}

	for (let p = 0; p < OSApp.Analog.progAdjusts.length; p++) {
		var adjust = OSApp.Analog.progAdjusts[p];
		sensor = adjust.sensor;
		for (let j = 0; j < OSApp.Analog.analogSensors.length; j++) {
			if (OSApp.Analog.analogSensors[j].nr == sensor && AllOptions[OSApp.Analog.analogSensors[j].unitid]) {
				let unitid = OSApp.Analog.analogSensors[j].unitid;
				let unitStr = OSApp.Analog.analogSensors[j].unit;

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
									text: OSApp.Language._("Min") + " " + adjust.min + " " + unitStr,
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
									text: OSApp.Language._("Max") + " " + adjust.max + " " + unitStr,
									style: {
										color: "#fff",
										background: "#ffadad"
									}
								}
							}
						]
					}
				};
				AllOptions[unitid] = Object.assign(AllOptions[unitid], options);
			}
		}
	}

	if (combine && AllOptions[1] && AllOptions[2]) {

		let series = AllOptions[1].series.concat(AllOptions[2].series);
		let yaxis = [AllOptions[1].yaxis, AllOptions[2].yaxis];
		yaxis[1].opposite = true;
		let annotations = [];
		if (AllOptions[1].annotations)
			annotations = annotations.concat(AllOptions[1].annotations.yaxis);
		if (AllOptions[2].annotations)
			annotations = annotations.concat(AllOptions[2].annotations.yaxis);

		let options = {
			chart: {
				type: 'area',
				animations: {
					speed: 500
				},
				stacked: false,
				width: '100%',
				height: (screen.height > screen.width ? screen.height : screen.width) / 3,
				toolbar: {
					download: canExport,
					autoSelected: 'zoom'
				},
				dropShadow: {
					enabled: true
				}
			},
			forecastDataPoints: {
				count: 1
			},
			dataLabels: {
				enabled: false
			},
			fill: {
				colors: colors[1],
				opacity: opacities[1],
				type: 'solid'
			},
			stroke: {
				curve: "smooth",
				colors: colors[1],
				width: widths[1],
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
					datetimeUTC: false,
					format: timestr
				}
			},
			xaxis: {
				type: "datetime",
				labels: {
					datetimeUTC: false,
					format: timestr
				}
			},
			legend: {
				showForSingleSeries: true,
				fontSize: "10px"
			},

			series: series,
			yaxis: yaxis,
			title: { text: AllOptions[1].title.text + "/" + AllOptions[2].title.text },
			annotations: {
				yaxis: annotations
			},
		};
		AllOptions[1] = options;
		AllOptions[2] = null;
	}

	for (var c = 0; c < chart.length; c++) {
		var x = document.querySelector(prefix + c);
		if (x) x.replaceChildren();
		let options = AllOptions[c];
		if (options) {
			chart[c] = new ApexCharts(document.querySelector(prefix + c), options);
			chart[c].render();
		}
	}
};

OSApp.Analog.isNumber = function(n) { return !isNaN(parseFloat(n)) && !isNaN(n - 0) };

/**
* format value output with 2 decimals.
* Empty string result if value is undefined or invalid
*/
OSApp.Analog.formatVal = function(val) {
	if (val === undefined || isNaN(val))
		return "";
	return (+(Math.round(val + "e+2") + "e-2"));
};

/**
* format value output. unit is only printed, if value valid
*/
OSApp.Analog.formatValUnit = function(val, unit) {
	if (val === undefined || isNaN(val))
		return "";
	return (+(Math.round(val + "e+2") + "e-2")) + unit;
};

OSApp.Analog.getUnit = function(sensor) {
	var unitid = sensor.unitid;
	switch (unitid) {
		case 1: return "%";
		case 2: return String.fromCharCode(176) + "C";
		case 3: return String.fromCharCode(176) + "F";
		case 4: return "V";
		case 5: return "%";
		case 6: return "in";
		case 7: return "mm";
		case 8: return "mph";
		case 9: return "kmh";
		case 10: return "%";
		case 11: return "DK";
		case 12: return "lm";
		case 13: return "lx";
		default: return sensor.unit;
	}
};

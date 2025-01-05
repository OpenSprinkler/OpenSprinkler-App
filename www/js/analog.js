/*!
 * Analog Sensor API - GUI for OpenSprinkker App
 * https://github.com/opensprinklershop/
 * (c) 2024 OpenSprinklerShop
 * Released under the MIT License
 */

var analogSensors = {},
	progAdjusts = {},
	monitors = {},
	monitorAlerts = {},
	expandItem = new Set(["sensors"]);

var timer;


const CHARTS = 12;
const USERDEF_SENSOR = 49;
const USERDEF_UNIT = 99;
const SENSOR_MQTT = 90;

const CURRENT_FW = "2.3.3(168)";
const CURRENT_FW_ID = 231;
const CURRENT_FW_MIN = 150;

const COLORS = ["#F3B415", "#F27036", "#663F59", "#6A6E94", "#4E88B4", "#00A7C6", "#18D8D8", '#A9D794', '#46AF78', '#A93F55', '#8C5E58', '#2176FF', '#33A1FD', '#7A918D', '#BAFF29'];
const COLCOUNT = 15;

//detected Analog Sensor Boards:
const ASB_BOARD1 = 0x01;
const ASB_BOARD2 = 0x02;
const OSPI_PCF8591 = 0x04;
const OSPI_ADS1115 = 0x08;
const UART_SC16IS752 = 0x10;
const RS485_TRUEBNER1 = 0x20;
const RS485_TRUEBNER2 = 0x40;
const RS485_TRUEBNER3 = 0x80;
const RS485_TRUEBNER4 = 0x100;
const OSPI_USB_RS485 = 0x200;

const NOTIFICATION_COLORS = ["#baffc9", "#faf0be", "#ffb3ba"];

const MONITOR_DELETE   = 0;
const MONITOR_MIN      = 1;
const MONITOR_MAX      = 2;
const MONITOR_SENSOR12 = 3; //Digital OS Sensors
const MONITOR_AND      = 10;
const MONITOR_OR       = 11;
const MONITOR_XOR      = 12;
const MONITOR_NOT      = 13;
const MONITOR_REMOTE   = 100;


function success_callback(scope) {
}


function asb_init() {
	if (!isAndroid && !isiOS) return;

	if (isAndroid) {
		cordova.plugins.notification.local.createChannel({
			channelId: 'os_low',
			channel:   'os_low',
			channelName:'OpenSprinklerLowNotifications',
			vibrate: false, // bool (optional), default is false
			importance: 2, // int (optional) 0 to 4, default is IMPORTANCE_DEFAULT (3)
			soundUsage: 5, // int (optional), default is USAGE_NOTIFICATION
			}, success_callback, this);
		cordova.plugins.notification.local.createChannel({
			channelId: 'os_med',
			channel:   'os_med',
			channelName:'OpenSprinklerMedNotifications',
			vibrate: false, // bool (optional), default is false
			importance: 3, // int (optional) 0 to 4, default is IMPORTANCE_DEFAULT (3)
			soundUsage: 5, // int (optional), default is USAGE_NOTIFICATION
			}, success_callback, this);
		cordova.plugins.notification.local.createChannel({
			channelId: 'os_high',
			channel:   'os_high',
			channelName:'OpenSprinklerHighNotifications',
			vibrate: true, // bool (optional), default is false
			importance: 4, // int (optional) 0 to 4, default is IMPORTANCE_DEFAULT (3)
			soundUsage: 5, // int (optional), default is USAGE_NOTIFICATION
			}, success_callback, this);
	}
	if (window.cordova && cordova.plugins) {

		timer = new window.nativeTimer();
		timer.onTick = function(tick) {
			updateAnalogSensor( function() {
				updateMonitors();
			});
		};

		cordova.plugins.backgroundMode.on('activate', function() {
			timer.start(1, 30*1000);
		});
	 	cordova.plugins.backgroundMode.on('deactivate', function() {
			timer.stop();
		});

		cordova.plugins.backgroundMode.setDefaults({
			title: "OpenSprinklerASB",
			text: _("OpenSprinkler is running in background mode"),
			subText: _("active monitor and controlling notifications"),
			channelName: "BackgroundChannel",
			allowClose: false,
			visibility: "public",
		});
	}
	if (window.cordova && window.BackgroundFetch) {
		var BackgroundFetch = window.BackgroundFetch;
		var fetchCallback = function(taskId) {
			console.log('[js] BackgroundFetch event received: ', taskId);
			updateAnalogSensor( function() {
				updateMonitors( function() {
					BackgroundFetch.finish(taskId);
				});
			});
		};

		var failureCallback = function(taskId) {
			console.log('- BackgroundFetch failed', error);
			BackgroundFetch.finish(taskId);
		};

		BackgroundFetch.configure({
			minimumFetchInterval: 15,
			requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY
		}, fetchCallback, failureCallback);
	}
}

function checkAnalogSensorAvail() {
	return controller.options && controller.options.feature === "ASB";
}

function refresh() {
	setTimeout(function () {
		location.reload();
	}, 100);
}

function enc(s) {
	//encodeURIComponent does not encode a single "%" !
	if (s) {
		return encodeURIComponent(s);
	}
	return s;
}

function updateProgramAdjustments(callback) {
	callback = callback || function () { };
	return sendToOS("/se?pw=", "json").then(function (data) {
		progAdjusts = data.progAdjust;
		callback();
	});
}

function checkBackgroundMode() {
	if (!isAndroid && !isiOS) return;
	if (!window.cordova) return;
	//Enable background mode only if we have a monitor configured:
	if (monitors && monitors.length > 0) {
		if (!cordova.plugins.backgroundMode.isActive() && !cordova.plugins.backgroundMode.isEnabled())
			cordova.plugins.backgroundMode.setEnabled(true);
	} else if (cordova.plugins.backgroundMode.isEnabled()) {
		cordova.plugins.backgroundMode.setEnabled(false);
	}
}

function updateMonitors(callback) {
	callback = callback || function () { };

	checkBackgroundMode();

	if (checkOSVersion(233)) {
		return sendToOS("/ml?pw=", "json").then(function (data) {

			monitors = data.monitors;
			checkMonitorAlerts();
			callback();
		});
	} else callback();
}

function updateAnalogSensor(callback) {
	callback = callback || function () { };
	return sendToOS("/sl?pw=", "json").then(function (data) {
		analogSensors = data.sensors;
		if (data.hasOwnProperty("detected"))
			analogSensors.detected = data.detected;
		callback();
	});
}

function notification_action_callback(monitor) {
//	monitorAlerts[monitor.nr] = false;
}

function checkMonitorAlerts() {
	if (!window.cordova || !cordova.plugins || !monitors || (!isAndroid && !isiOS))
		return;

	for (i = 0; i < monitors.length; i++) {
		var monitor = monitors[i];
		if (monitor.active) {

			if (!monitorAlerts[monitor.nr]) {
				monitorAlerts[monitor.nr] = true;
				var dname, chan;
				if ( typeof controller.settings.dname !== "undefined" )
					dname = controller.settings.dname;
				else
				 	dname = "OpenSprinkler";
				let prio = monitor.hasOwnProperty("prio")?monitor.prio:0;

				if (prio === 0) chan = 'os_low';
				else if (prio === 1) chan = 'os_med';
				else chan = 'os_high';

				cordova.plugins.notification.local.schedule({
					id: monitor.nr,
					channelId: chan,
					channel: chan,
					title: dname,
					text: monitor.name,
					priority: prio,
					beep: prio>=2,
					lockscreen: true,
					color: NOTIFICATION_COLORS[prio],
				}, notification_action_callback, monitor);
			}
		}
		else if (monitorAlerts[monitor.nr]) {
			monitorAlerts[monitor.nr] = false;
		}
	}
}

var lastSensorHtml ="";

function updateSensorShowArea(page) {
	if (checkAnalogSensorAvail()) {
		var showArea = page.find("#os-sensor-show");
		var html = "", i, j;
		html += "<div class='ui-body ui-body-a center'><table style='margin: 0px auto;'>";
		var cols = Math.round(window.innerWidth / 300);

		for (i = 0; i < progAdjusts.length; i++) {
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

		if (checkOSVersion(233) && monitors) {
			for (i = 0; i < monitors.length; i++) {
				var monitor = monitors[i];
				if (monitor.active) {
					let prio = monitor.hasOwnProperty("prio")?monitor.prio:0;
					let pcolor = NOTIFICATION_COLORS[prio];
					html += "<div id='monitor-" + monitor.nr + "' class='ui-body ui-body-a center' style='background-color:"+pcolor+"'>";
					html += "<label>" + monitor.name + "</label>";
					html += "</div>";
				}
			}
		}

		for (i = 0; i < analogSensors.length; i++) {
			var sensor = analogSensors[i];
			if (sensor.show) {
				html += "<div id='sensor-show-" + sensor.nr + "' class='ui-body ui-body-a center'>";
				html += "<label>" + sensor.name + ": " + formatValUnit(sensor.data, getUnit(sensor)) + "</label>";
				html += "</div>";
			}
		}

		var progAdjustDisp = new Array(progAdjusts.length);

		for (i = 0; i < progAdjusts.length; i++) {
			var progAdjust = progAdjusts[i];
			var disp = {};
			var current = Math.round(progAdjust.current * 100);

			if (!progAdjust.name || progAdjust.name === "") {
				var progName = "?";
				if (progAdjust.prog >= 1 && progAdjust.prog <= controller.programs.pd.length) {
					progName = readProgram(controller.programs.pd[progAdjust.prog - 1]).name;
				}

				var sensorName = "";
				for (j = 0; j < analogSensors.length; j++) {
					if (analogSensors[j].nr === progAdjust.sensor) {
						sensorName = analogSensors[j].name;
					}
				}
				disp.label = disp.progName + " (" + disp.sensorName + ")"
			} else
				disp.label = progAdjust.name;

			//current = 80; //testvalue!
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

		if (lastSensorHtml != html) {
			lastSensorHtml = html;
			while (showArea.firstChild) {
				showArea.removeChild(showArea.firstChild);
			}
			showArea.html(html);

			for (i = 0; i < progAdjustDisp.length; i++) {
				var disp = progAdjustDisp[i];
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
				var disp = progAdjustDisp[i];
				if (disp && disp.chart) {
					disp.chart.updateSeries([disp.current]);
					disp.chart.updateOptions({labels: [disp.label]});
				}
			}
		}
	}
}

function toByteArray(b) {
	var result = [];
	var n = 4;
	while (n--) {
		result.push(Number(b % 0x100));
		b /= 0x100;
	}
	return Uint8Array.from(result);
}

function intFromBytes(x) {
	try {
		var val = 0;
		for (var i = x.length - 1; i >= 0; i--) {
			val *= 0x100;
			val += parseInt(x[i]);
		}
		return val;
	} catch (error) {
		return 0;
	}
}

// Restore from Backup - Dialog
function getImportMethodSensors(restore_type, callback) {

	let storageName = (restore_type == 1) ? "backupSensors" : (restore_type == 2) ? "backupAdjustments" : "backupAll";
	let localData = localStorage.getItem(storageName);

	callback = callback || function () { };
	var getPaste = function () {
		var popup = $(
			"<div data-role='popup' data-theme='a' id='paste_config'>" +
			"<p class='ui-bar'>" +
			"<textarea class='textarea' rows='10' placeholder='" + _("Paste your backup here") + "'></textarea>" +
			"<button data-mini='true' data-theme='b'>" + _("Import") + "</button>" +
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
				importConfigSensors(data, restore_type, callback);
			} catch (err) {
				popup.find("textarea").val("");
				showerror(_("Unable to read the configuration file. Please check the file and try again."));
			}
		});

		popup.css("width", (width > 600 ? width * 0.4 + "px" : "100%"));
		openPopup(popup);
		return false;
	},
		popup = $(
			"<div data-role='popup' data-theme='a'>" +
			"<div class='ui-bar ui-bar-a'>" + _("Select Import Method") + "</div>" +
			"<div data-role='controlgroup' class='tight'>" +
			"<button class='hidden fileMethod'>" + _("File") + "</button>" +
			"<button class='pasteMethod'>" + _("Email (copy/paste)") + "</button>" +
			"<button class='hidden localMethod'>" + _("Internal (within app)") + "</button>" +
			"</div>" +
			"</div>");

	if (isFileCapable) {
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
							importConfigSensors(obj, restore_type, callback);
						} catch (err) {
							showerror(_("Unable to read the configuration file. Please check the file and try again."));
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
			importConfigSensors(JSON.parse(localData), restore_type, callback);
			return false;
		});
	}

	openPopup(popup);
}

// Restore from backup - send to OS
function importConfigSensors(data, restore_type, callback) {
	callback = callback || function () { };
	var warning = "";

	if (typeof data !== "object" || !data.backup) {
		showerror(_("Invalid configuration"));
		return;
	}

	areYouSure(_("Are you sure you want to restore the configuration?"), warning, function () {
		$.mobile.loading("show");

		if ((restore_type & 1) == 1 && data.hasOwnProperty("sensors")) { //restore Sensor
			var sensorOut;
			for (var i = 0; i < data.sensors.length; i++) {
				sensorOut = data.sensors[i];
				sendToOsObj("/sc?pw=", sensorOut);
			}
		}

		if ((restore_type & 2) == 2 && data.hasOwnProperty("progadjust")) { //restore program adjustments
			var progAdjustOut;
			for (var i = 0; i < data.progadjust.length; i++) {
				progAdjustOut = data.progadjust[i];
				sendToOsObj("/sb?pw?=", progAdjustOut);
			}
		}

		if ((restore_type & 4) == 4 && data.hasOwnProperty("monitors")) { //restore monitors
			var monitor;
			for (var i = 0; i < data.monitors.length; i++) {
				monitor = data.monitors[i];
				sendToOsObj("/mc?pw=", monitor);
			}
		}

		expandItem.add("progadjust");
		updateProgramAdjustments(function () {
			updateMonitors(function () {
				updateAnalogSensor(function () {
					$.mobile.loading("hide");
					showerror(_("Backup restored to your device"));
					callback();
				});

			});
		});

	});
}

function sendToOsObj(params, obj) {
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) {
			var value = obj[key];
			if (key == "name" || key == "unit" || key == "topic" || key == "filter")
				value = enc(value);
			params += "&"+key+"="+value;
		}
	}
	return sendToOS(params, "json");
}


function getExportMethodSensors(backuptype) {
	let storageName = (backuptype == 1) ? "backupSensors" : (backuptype == 2) ? "backupAdjustments" : "backupAll";
	let filename = (backuptype == 1) ? "BackupSensorConfig" : (backuptype == 2) ? "BackupSensorAdjustments" : "BackupAll";

	sendToOS("/sx?pw=&backup=" + backuptype, "json").then(function (data) {
		var popup = $(
			"<div data-role='popup' data-theme='a'>" +
			"<div class='ui-bar ui-bar-a'>" + _("Select Export Method") + "</div>" +
			"<div data-role='controlgroup' class='tight'>" +
			"<a class='ui-btn hidden fileMethod'>" + _("File") + "</a>" +
			"<a class='ui-btn pasteMethod'>" + _("Email") + "</a>" +
			"<a class='ui-btn localMethod'>" + _("Internal (within app)") + "</a>" +
			"</div>" +
			"</div>"),
			obj = encodeURIComponent(JSON.stringify(data)),
			subject = "OpenSprinkler Sensor Export on " + dateToString(new Date());

		if (isFileCapable) {
			popup.find(".fileMethod").removeClass("hidden").attr({
				href: "data:text/json;charset=utf-8," + obj,
				download: filename + "-" + new Date().toLocaleDateString().replace(/\//g, "-") + ".json"
			}).on("click", function () {
				popup.popup("close");
			});
		}

		var href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + obj;
		popup.find(".pasteMethod").attr("href", href).on("click", function () {
			window.open(href, isOSXApp ? "_system" : undefined);
			popup.popup("close");
		});

		popup.find(".localMethod").on("click", function () {
			popup.popup("close");
			localStorage.setItem(storageName, JSON.stringify(data));
			showerror(_("Backup saved on this device"));
		});

		openPopup(popup);
	});
}


//Program adjustments editor
function showAdjustmentsEditor(progAdjust, row, callback, callbackCancel) {

	sendToOS("/sh?pw=", "json").then(function (data) {
		var supportedAdjustmentTypes = data.progTypes;
		var i;

		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var list =
			"<div data-role='popup' data-theme='a' id='progAdjustEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+_("close")+"</a>"+
			"<h1>" + (progAdjust.nr > 0 ? _("Edit Program Adjustment") : _("New Program Adjustment")) + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			_("Notice: If you want to combine multiple sensors, then build a sensor group. ") +
			_("See help documentation for details.") +
			"</p>" +

			"<div class='ui-field-contain'>" +

			//Adjustment-Nr:
			"<label>" +
			_("Adjustment-Nr") +
			"</label>" +
			"<input class='nr' type='number' inputmode='decimal' min='1' max='99999' value='" + progAdjust.nr + (progAdjust.nr > 0 ? "' disabled='disabled'>" : "'>");

			//Adjustment-Name:
			if (checkOSVersion(233)) {
				if (!progAdjust.hasOwnProperty("name"))
					progAdjust.name = "";
				list += "<label>" +
				_("Adjustment-Name") +
				"</label>" +
				"<input class='adj-name' type='text' maxlength='29' value='" + progAdjust.name + "' >";
			}

			//Select Type:
			list += "<div class='ui-field-contain'><label for='type' class='select'>" +
			_("Type") +
			"</label><select data-mini='true' id='type'>";

		for (i = 0; i < supportedAdjustmentTypes.length; i++) {
			list += "<option " + ((progAdjust.type === supportedAdjustmentTypes[i].type) ? "selected" : "") +
				" value='" + supportedAdjustmentTypes[i].type + "'>" +
				_(supportedAdjustmentTypes[i].name) + "</option>";
		}
		list += "</select></div>" +

			//Select Sensor:
			"<div class='ui-field-contain'><label for='sensor' class='select'>" +
			_("Sensor") +
			"</label><select data-mini='true' id='sensor'>";

		for (i = 0; i < analogSensors.length; i++) {
			list += "<option " + ((progAdjust.sensor === analogSensors[i].nr) ? "selected" : "") +
				" value='" + analogSensors[i].nr + "'>" +
				analogSensors[i].nr + " - " + analogSensors[i].name + "</option>";
		}
		list += "</select></div>" +

			//Select Program:
			"<div class='ui-field-contain'><label for='prog' class='select'>" +
			_("Program to adjust") +
			"</label><select data-mini='true' id='prog'>";

		for (i = 0; i < controller.programs.pd.length; i++) {
			var progName = readProgram(controller.programs.pd[i]).name;
			var progNr = i + 1;

			list += "<option " + ((progAdjust.prog === progNr) ? "selected" : "") +
				" value='" + progNr + "'>" +
				progName + "</option>";
		}
		list += "</select></div>" +

			"<label>" +
			_("Factor 1 in % (adjustment for min)") +
			"</label>" +
			"<input class='factor1' type='number' inputmode='decimal' value='" + Math.round(progAdjust.factor1 * 100) + "'>" +

			"<label>" +
			_("Factor 2 in % (adjustment for max)") +
			"</label>" +
			"<input class='factor2' type='number' inputmode='decimal' value='" + Math.round(progAdjust.factor2 * 100) + "'>" +

			"<label>" +
			_("Min sensor value") +
			"</label>" +
			"<input class='min' type='number' value='" + progAdjust.min + "'>" +

			"<label>" +
			_("Max sensor value") +
			"</label>" +
			"<input class='max' type='number' inputmode='decimal' value='" + progAdjust.max + "'>" +

			"</div>" +
			"<div id='adjchart'></div>" +
			"<button class='submit' data-theme='b'>" + _("Submit") + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-progadjust' value='" + progAdjust.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				_("Delete") + "</a>")) +

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

			areYouSure(_("Are you sure you want to delete this program adjustment?"), value, function () {
				return sendToOS("/sb?pw=&nr=" + value + "&type=0", "json").done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						showerror(_("Error calling rest service: ") + " " + result);
					else
						progAdjusts.splice(row, 1);
					callbackCancel();
				});
			});
		});

		let adjFunc = function () {
			updateAdjustmentChart(popup);
		};

		popup.find("#sensor").change(adjFunc);
		popup.find("#type").change(adjFunc);
		popup.find(".factor1").change(adjFunc);
		popup.find(".factor2").change(adjFunc);
		popup.find(".min").change(adjFunc);
		popup.find(".max").change(adjFunc);

		popup.find(".submit").on("click", function () {

			var progAdjust = getProgAdjust(popup);
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

		holdButton(popup.find(".incr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, 1);
			return false;
		});

		holdButton(popup.find(".decr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, -1);
			return false;
		});

		$("#progAdjustEditor").remove();

		popup.css("max-width", "580px");

		adjFunc();
		openPopup(popup, { positionTo: "origin" });
	});
}

const PROG_LINEAR = 1; //formula see above
const PROG_DIGITAL_MIN = 2; //under or equal min : factor1 else factor2
const PROG_DIGITAL_MAX = 3; //over or equal max  : factor2 else factor1
const PROG_DIGITAL_MINMAX = 4; //under min or over max : factor1 else factor2

function getProgAdjust(popup) {
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
}

function updateAdjustmentChart(popup) {

	let p = getProgAdjust(popup);
	sendToOsObj("/sd?pw=", p).done(function (values) {
		if (!values || !values.hasOwnProperty("adjustment"))
			return;
		let adj = values.adjustment;
		if (!adj.hasOwnProperty("inval"))
			return;

		var sensor;
		for (i = 0; i < analogSensors.length; i++) {
			if (p.sensor == analogSensors[i].nr) {
				sensor = analogSensors[i];
				break;
			}
		}
		if (sensor === undefined)
			return;

		var yaxis;
		if (adj.hasOwnProperty('adjust'))
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
						text: formatValUnit(adj.adjust*100, "%"),
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
				text: _("Adjustment preview"),
				align: 'left'
			},
			xaxis: {
				categories: adj.inval,
				tickAmount: Math.min(20, Math.min(screen.width / 30, adj.inval.length)),
				labels: {
					formatter: function (value) {
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
					formatter: function (value) {
						return formatVal(value * 100);
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
}

function requiredCheck(field, obj, property) {
	if (obj['missingValue']) return;
	if (field.is(":visible") && field.prop("required") && !obj[property])
		obj['missingValue'] = field;
}

function addToObjectChk(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = field.is(":checked") ? 1 : 0;
		requiredCheck(field, obj, property);
	}
}

function addToObjectInt(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = parseInt(field.val());
		requiredCheck(field, obj, property);
	}
}

function addToObjectFlt(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = parseFloat(field.val());
		requiredCheck(field, obj, property);
	}
}

function addToObjectStr(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = field.val();
		requiredCheck(field, obj, property);
	}
}

function addToObjectIPs(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		var ipstr = field.val();
		obj[property] = ipstr?ipstr.split("."):0;
		requiredCheck(field, obj, property);
	}
}

function getMonitor(popup) {
	var result = {};
	addToObjectInt(popup, "#nr", result);
	addToObjectStr(popup, "#name", result);
	addToObjectInt(popup, "#type", result);
	addToObjectInt(popup, "#sensor", result);
	addToObjectInt(popup, "#prog", result);
	addToObjectInt(popup, "#zone", result);
	addToObjectFlt(popup, "#maxrun", result);
	addToObjectInt(popup, "#prio", result);

	//Min+Max
	addToObjectFlt(popup, "#value1", result);
	addToObjectFlt(popup, "#value2", result);
	//Sensor12
	addToObjectInt(popup, "#sensor12", result);
	addToObjectChk(popup, "#invers", result);
	//AND+OR+XOR
	addToObjectInt(popup, "#monitor1", result);
	addToObjectInt(popup, "#monitor2", result);
	addToObjectInt(popup, "#monitor3", result);
	addToObjectInt(popup, "#monitor4", result);
	addToObjectChk(popup, "#invers1", result);
	addToObjectChk(popup, "#invers2", result);
	addToObjectChk(popup, "#invers3", result);
	addToObjectChk(popup, "#invers4", result);
	//NOT
	addToObjectInt(popup, "#monitor", result);
	//REMOTE
	result[ip] = intFromBytes(popup.find("#ip").val().split("."));
	result[port] = parseInt(popup.find("#port").val());

	return result;
}

function monitorSelection(id, sel, ignore) {
	var list = "<select data-mini='true' id='"+id+"'>";

	list += "<option " + (!sel ? "selected" : "") +
	" value=''>" + _("unselected") + "</option>";

	for (i = 0; i < monitors.length; i++) {
		let monitor = monitors[i];
		if (monitor.nr === ignore) continue;
		list += "<option " + ((monitor.nr === sel) ? "selected" : "") +
			" value='" +monitor.nr + "'>" +
			monitor.name + "</option>";
	}
	list += "</select>";
	return list;
}

//Monitor editor
function showMonitorEditor(monitor, row, callback, callbackCancel) {

	sendToOS("/mt?pw=", "json").then(function (data) {
		var supportedMonitorTypes = data.monitortypes;
		var i;

		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var list =
			"<div data-role='popup' data-theme='a' id='monitorEditor' style='max-width:580px;'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+_("close")+"</a>"+
			"<h1>" + (monitor.nr > 0 ? _("Edit monitor and control") : _("New Monitor")) + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			_("Notice: If you want to combine multiple sensors, then build a sensor group. ") +
			_("See help documentation for details.") +
			"</p>" +

			"<div class='ui-field-contain'>" +

			//Monitor-Nr:
			"<label for='id'>" +
			_("Monitor-Nr") +
			"<input id='nr' type='number' inputmode='decimal' min='1' max='99999' required value='" + monitor.nr + (monitor.nr > 0 ? "' disabled='disabled'>" : "'>") +
			"</label>" +

			//Monitor-Name:
			"<label for='name'>" +
			_("Monitor-Name") +
			"<input id='name' type='text' maxlength='29' value='" + monitor.name + "' required>" +
			"</label>" +

			//Select Type:
			"<label for='type' class='select'>" +
			_("Type") +
			"</label><select data-mini='true' id='type' required>";

		for (i = 0; i < supportedMonitorTypes.length; i++) {
			list += "<option " + ((monitor.type === supportedMonitorTypes[i].type) ? "selected" : "") +
				" value='" + supportedMonitorTypes[i].type + "'>" +
				_(supportedMonitorTypes[i].name) + "</option>";
		}
		list += "</select>" +

			//Select Sensor:
			"<div id='sel_sensor'><label for='sensor' class='select'>" +
			_("Sensor") +
			"</label><select data-mini='true' id='sensor'>";

		for (i = 0; i < analogSensors.length; i++) {
			list += "<option " + ((monitor.sensor === analogSensors[i].nr) ? "selected" : "") +
				" value='" + analogSensors[i].nr + "'>" +
				analogSensors[i].nr + " - " + analogSensors[i].name + "</option>";
		}
		list += "</select></div>" +

			//Select Program:
			"<label for='prog' class='select'>" +
			_("Program to start") +
			"</label><select data-mini='true' id='prog'>" +
			"<option " + (monitor.prog == 0? "selected" : "") + " value='0'>" + _("Disabled") + "</option>";

		for (i = 0; i < controller.programs.pd.length; i++) {
			var progName = readProgram(controller.programs.pd[i]).name;
			var progNr = i + 1;

			list += "<option " + ((monitor.prog === progNr) ? "selected" : "") +
				" value='" + progNr + "'>" +
				progName + "</option>";
		}
		list += "</select>" +

			//Select Zone:
			"<label for='zone' class='select'>" +
			_("Zone to start") +
			"</label><select data-mini='true' id='zone'>" +
			"<option " + (monitor.zone == 0? "selected" : "") + " value='0'>" + _("Disabled") + "</option>";

		for (i = 0; i < controller.stations.snames.length; i++) {
			if ( !Station.isMaster( i ) ) {
				list += "<option " + ( monitor.zone == (i + 1) ? "selected" : "" ) + " value='" + ( i + 1 ) + "'>" +
					controller.stations.snames[ i ] + "</option>";
			}
		}

		//maxrun
		list += "</select>" +
			"<label for='maxrun'>" + _("Max runtime (s)") +
			"</label><input id='maxrun' type='number' inputmode='decimal' min='1' max='99999' value='" + monitor.maxrun + "'>" +

		//Priority
			"<label>"+_("Priority") +
			"</label><select data-mini='true' id='prio'>";
		const prios = [_("Low"), _("Medium"), _("High")];
		if (!monitor.prio)
			monitor.prio = 0;
		for (i = 0; i < 3; i++) {
			list += "<option " + (monitor.prio == i ? "selected" : "") + " value='" + i + "'>" + prios[i] + "</option>";
		}
		list += "</select></div>" +

			//typ = MIN+MAX
			"<div id='type_minmax'>"+
			"<label for='value1'>" +
			_("Value for activate") +
			"</label><input id='value1' type='number' inputmode='decimal' value='" + formatVal(monitor.value1) + "'>" +

			"<label for='value2'>" +
			_("Value for deactivate") +
			"</label><input id='value2' type='number' inputmode='decimal' value='" + formatVal(monitor.value2) + "'>" +
			"</div>" +

			//typ = SENSOR12
			"<div id='type_sensor12'>"+
			"<label for='sensor12'>" +
			_("Digital Sensor Port") +
			"</label>" +
			"<select data-mini='true' id='sensor12'>" +
			"<option " + (monitor.sensor12 <= 1? "selected" : "") + " value='1'>" + _("Sensor 1") + "</option>" +
			"<option " + (monitor.sensor12 >= 2? "selected" : "") + " value='2'>" + _("Sensor 2") + "</option>" +
			"</select>"+
			"<label for='invers'>" +
			"<input data-mini='true' id='invers' type='checkbox' " + (monitor.invers ? "checked='checked'" : "") + ">" + _("inverse") + "</input>" +
			"</label></div>" +

			//typ == ANDORXOR
			"<div id='type_andorxor'>"+
			"<label for='monitor1'>"+_("Monitor 1")+"</label>"+monitorSelection("monitor1", monitor.monitor1, monitor.nr)+
			"<label for='invers1'><input data-mini='true' id='invers1' type='checkbox' " + (monitor.invers1 ? "checked='checked'" : "") + ">" + _("inverse") + "</input></label>" +
			"<label for='monitor2'>"+_("Monitor 2")+"</label>"+monitorSelection("monitor2", monitor.monitor2, monitor.nr)+
			"<label for='invers2'><input data-mini='true' id='invers2' type='checkbox' " + (monitor.invers2 ? "checked='checked'" : "") + ">" + _("inverse") + "</input></label>" +
			"<label for='monitor3'>"+_("Monitor 3")+"</label>"+monitorSelection("monitor3", monitor.monitor3, monitor.nr)+
			"<label for='invers3'><input data-mini='true' id='invers3' type='checkbox' " + (monitor.invers3 ? "checked='checked'" : "") + ">" + _("inverse") + "</input></label>" +
			"<label for='monitor4'>"+_("Monitor 4")+"</label>"+monitorSelection("monitor4", monitor.monitor4, monitor.nr)+
			"<label for='invers4'><input data-mini='true' id='invers4' type='checkbox' " + (monitor.invers4 ? "checked='checked'" : "") + ">" + _("inverse") + "</input></label>" +
			"</div>" +

			//typ == NOT
			"<div id='type_not'>"+
			"<label for='monitor'>"+_("Monitor")+"</label>"+monitorSelection("monitor", monitor.monitor, monitor.nr)+
			"</div>"+

			//typ == REMOTE
			"<div id='type_remote'>"+
			"<label for='rmonitor'>"+_("Remote Monitor nr")+"</label>"+
			"<input id='rmonitor' type='number' inputmode='decimal' min='1' max='99999' value='" + monitor.rmonitor + "'>" +
			"<label for='ip'>"+_("IP")+"</label>"+
			"<input id='ip' type='text'  value='" + (monitor.ip ? toByteArray(monitor.ip).join(".") : "") + "'>" +
			"<label for='port'>"+_("Port")+"</label>"+
			"<input id='port' type='number' inputmode='decimal' min='1' max='99999' value='" + monitor.port + "'>" +
			"</div>"+

			//END
			"<button class='submit' data-theme='b'>" + _("Submit") + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-monitor' value='" + monitor.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				_("Delete") + "</a>")) +

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

			areYouSure(_("Are you sure you want to delete this monitor?"), value, function () {
				return sendToOS("/mc?pw=&nr=" + value + "&type=0", "json").done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						showerror(_("Error calling rest service: ") + " " + result);
					else
						monitors.splice(row, 1);
					callbackCancel();
				});
			});
		});

		popup.find(".submit").on("click", function () {

			var monitor = getMonitor(popup);
			if (monitor.missingValue) {
				alert(_('Please fill the required fields'));
				monitor.missingValue.focus();
			} else {
				callback(monitor);
				popup.popup("close");
			}
			return false;
		});

		holdButton(popup.find(".incr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, 1);
			return false;
		});

		holdButton(popup.find(".decr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, -1);
			return false;
		});

		popup.find("#type").change(function () {
			var type = parseInt($(this).val());
			updateMonitorEditorType(popup, type);
		});

		$("#monitorEditor").remove();

		updateMonitorEditorType(popup, monitor.type);

		openPopup(popup, { positionTo: "origin" });
	});
}

function updateMonitorEditorType(popup, type) {
	popup.find("#type_minmax").hide();
	popup.find("#type_sensor12").hide();
	popup.find("#type_andorxor").hide();
	popup.find("#type_not").hide();
	popup.find("#type_remote").hide();
	popup.find("#sel_sensor").hide();
	switch(type) {
		case MONITOR_MIN:
		case MONITOR_MAX:
			popup.find("#sel_sensor").show();
			popup.find("#type_minmax").show();
			break;
		case MONITOR_SENSOR12:
			popup.find("#type_sensor12").show();
			break;
		case MONITOR_AND:
		case MONITOR_OR:
		case MONITOR_XOR:
			popup.find("#type_andorxor").show();
			break;
		case MONITOR_NOT:
			popup.find("#type_not").show();
			break;
		case MONITOR_REMOTE:
			popup.find("#type_remote").show();
			break;
		}
}

function isSmt100(sensorType) {
	if (!sensorType) {
		return false;
	}
	return sensorType === 1 || sensorType == 2 || sensorType == 3;
}

function isIPSensor(sensorType) {
	return sensorType <= 3 || sensorType == 100;
}

function isIDNeeded(sensorType) {
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

	var unitid = popup.find("#unitid").val();
	if (type == SENSOR_MQTT || type == USERDEF_SENSOR || unitid == USERDEF_UNIT) {
		popup.find(".unit_label").show();
		popup.find(".unit").show();
	} else {
		popup.find(".unit_label").hide();
		popup.find(".unit").hide();
	}
}

function saveSensor(popup, sensor, callback) {

	if (!sensor.nr) { //New Sensor - check existing Nr to avoid overwriting
		var nr = parseInt(popup.find(".nr").val());
		for (var i = 0; i < analogSensors.length; i++) {
			if (analogSensors[i].nr === nr) {
				window.alert(_("Sensor number exists!"));
				return;
			}
		}
	}
	var sensorOut = {};
	addToObjectInt(popup, ".nr", sensorOut);
	addToObjectInt(popup, "#type", sensorOut);
	addToObjectInt(popup, ".group", sensorOut);
	addToObjectStr(popup, ".name", sensorOut);
	addToObjectIPs(popup, ".ip", sensorOut);
	addToObjectInt(popup, ".port", sensorOut);
	addToObjectInt(popup, ".id", sensorOut);
	addToObjectInt(popup, ".ri", sensorOut);
	addToObjectInt(popup, ".fac", sensorOut);
	addToObjectInt(popup, ".div", sensorOut);
	addToObjectInt(popup, ".offset", sensorOut);
	addToObjectStr(popup, ".unit", sensorOut);
	addToObjectInt(popup, "#unitid", sensorOut);
	addToObjectChk(popup, "#enable", sensorOut);
	addToObjectChk(popup, "#log", sensorOut);
	addToObjectChk(popup, "#show", sensorOut);
	addToObjectStr(popup, ".topic", sensorOut);
	addToObjectStr(popup, ".filter", sensorOut);

	if (sensorOut.missingValue) {
		alert(_('Please fill the required fields'));
		sensorOut.missingValue.focus();
	} else {
		callback(sensorOut);
		popup.popup("close");
	}
	return false;
}

// Analog sensor editor
function showSensorEditor(sensor, row, callback, callbackCancel) {

	sendToOS("/sf?pw=", "json").then(function (data) {
		var supportedSensorTypes = data.sensorTypes;
		var i;

		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var list = "<div data-role='popup' data-theme='a' id='sensorEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+_("close")+"</a>"+
			"<h1>" + (sensor.nr > 0 ? _("Edit Sensor") : _("New Sensor")) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			_("Edit Sensor Configuration. ") +
			_("See help documentation for details.") +
			"<br>" +
			_("Last") + ": " + (sensor.last === undefined ? "" : dateToString(new Date(sensor.last * 1000))) +
			"</p>" +
			"<div class='ui-field-contain'>" +
			"<label>" +
			_("Sensor-Nr") +
			"</label>" +
			"<input class='nr' type='number' inputmode='decimal' min='1' max='99999' required value='" + sensor.nr + (sensor.nr > 0 ? "' disabled='disabled'>" : "'>") +

			"<div class='ui-field-contain'><label for='type' class='select'>" +
			_("Type") +
			"</label><select data-mini='true' id='type' required>";

		for (i = 0; i < supportedSensorTypes.length; i++) {
			list += "<option " + ((sensor.type === supportedSensorTypes[i].type) ? "selected" : "") +
				" value='" + supportedSensorTypes[i].type + "'>" +
				supportedSensorTypes[i].name + "</option>";
		}
		list += "</select></div>";

		list += "<button data-mini='true' class='center-div' id='smt100id'>" + _("Set SMT100 Modbus ID") + "</button>";

		list += "<label>" + _("Group") +
			"</label>" +
			"<input class='group' type='number'  inputmode='decimal' min='0' max='99999' value='" + sensor.group + "'>" +

			"<label>" + _("Name") +
			"</label>" +
			"<input class='name' type='text' maxlength='29' value='" + sensor.name + "' required>" +

			"<label class='ip_label'>" + _("IP Address") +
			"</label>" +
			"<input class='ip' type='text'  value='" + (sensor.ip ? toByteArray(sensor.ip).join(".") : "") + "'>" +

			"<label class='port_label'>" + _("Port") +
			"</label>" +
			"<input class='port' type='number' inputmode='decimal' min='0' max='65535' value='" + sensor.port + "'>" +

			"<label class='id_label'>" + _("ID") +
			"</label>" +
			"<input class='id' type='number' inputmode='decimal' min='0' max='65535' value='" + sensor.id + "'>" +

			"<label class='fac_label'>" + _("Factor") +
			"</label>" +
			"<input class='fac' type='number' inputmode='decimal' min='-32768' max='32767' value='" + sensor.fac + "'>" +

			"<label class='div_label'>" + _("Divider") +
			"</label>" +
			"<input class='div' type='number' inputmode='decimal' min='-32768' max='32767' value='" + sensor.div + "'>" +

			"<label class='offset_label'>" + _("Offset in millivolt") +
			"</label>" +
			"<input class='offset' type='number' inputmode='decimal' min='-32768' max='32767' value='" + sensor.offset + "'>" +

			"<label class='chartunit_label'>" + _("Chart Unit") +
			"</label>" +
			"<select data-mini='true' id='unitid'>" +
			"<option value='0'>" + _("Default") + "</option>" +
			"<option value='1'>" + _("Soil Moisture %") + "</option>" +
			"<option value='2'>" + _("Degree Celcius " + String.fromCharCode(176) + "C") + "</option>" +
			"<option value='3'>" + _("Degree Fahrenheit " + String.fromCharCode(176) + "F") + "</option>" +
			"<option value='4'>" + _("Volt V") + "</option>" +
			"<option value='5'>" + _("Air Humidity %") + "</option>" +
			"<option value='6'>" + _("Inch in") + "</option>" +
			"<option value='7'>" + _("Millimeter mm") + "</option>" +
			"<option value='8'>" + _("MPH") + "</option>" +
			"<option value='9'>" + _("KM/H") + "</option>" +
			"<option value='10'>" + _("Level %") + "</option>" +
			"<option value='99'>" + _("Own Unit") + "</option>" +
			"</select>" +

			"<label class='unit_label'>" + _("Unit") +
			"</label>" +
			"<input class='unit' type='text'  value='" + (sensor.unit ? sensor.unit : "") + "'>" +

			"<label class='topic_label'>" + _("MQTT Topic") +
			"</label>" +
			"<input class='topic' type='text'  value='" + (sensor.topic ? sensor.topic : "") + "'>" +

			"<label class='filter_label'>" + _("MQTT Filter") +
			"</label>" +
			"<input class='filter' type='text'  value='" + (sensor.filter ? sensor.filter : "") + "'>" +

			"<label>" + _("Read Interval (s)") +
			"</label>" +
			"<input class='ri' type='number' inputmode='decimal' min='1' max='999999' value='" + sensor.ri + "'>" +

			"<label for='enable'><input data-mini='true' id='enable' type='checkbox' " + ((sensor.enable === 1) ? "checked='checked'" : "") + ">" +
			_("Sensor Enabled") +
			"</label>" +

			"<label for='log'><input data-mini='true' id='log' type='checkbox' " + ((sensor.log === 1) ? "checked='checked'" : "") + ">" +
			_("Enable Data Logging") +
			"<a href='#' data-role='button' data-mini='true' id='download-log' data-icon='action' data-inline='true' style='margin-left: 10px;'>" +
			_("download log") + "</a>" +
			"<a href='#' data-role='button' data-mini='true' id='delete-sen-log' value='" + sensor.nr + "' data-icon='delete' data-inline='true' style='margin-left: 10px;'>" +
			_("delete log") + "</a>" +
			"</label>" +

			"<label for='show'><input data-mini='true' id='show' type='checkbox' " + ((sensor.show === 1) ? "checked='checked'" : "") + ">" +
			_("Show on Mainpage") +
			"</label>" +

			"</div>" +

			"<button class='submit' data-theme='b'>" + _("Submit") + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-sensor' value='" + sensor.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				_("Delete") + "</a>")) +

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
			updateSensorVisibility(popup, type);
		});

		//SMT 100 Toolbox function: SET ID
		popup.find("#smt100id").on("click", function () {
			var nr = parseInt(popup.find(".nr").val()),
				newid = parseInt(popup.find(".id").val());
			saveSensor(popup, sensor, callback);
			areYouSure(_("This function sets the Modbus ID for one SMT100 sensor. Disconnect all other sensors on this Modbus port. Please confirm."),
				"new id=" + newid, function () {
					sendToOS("/sa?pw=&nr=" + nr + "&id=" + newid).done(function () {
						window.alert(_("SMT100 id assigned!"));
						updateAnalogSensor(callbackCancel);
					});
				});
		});
		popup.find("#type").change(function () {
			var type = parseInt(popup.find("#type").val());
			document.getElementById("smt100id").style.display = isSmt100(type) ? "block" : "none";
		});

		//download log:
		popup.find("#download-log").on("click", function () {
			var link = document.createElement("a");
			link.style.display = "none";
			link.setAttribute("download", "sensorlog-" + sensor.name + "-" + new Date().toLocaleDateString().replace(/\//g, "-") + ".csv");

			var limit = currToken ? "&max=5500" : ""; //download limit is 140kb, 5500 lines ca 137kb
			var dest = "/so?pw=&csv=1&nr="+ sensor.nr + limit;
			dest = dest.replace("pw=", "pw=" + enc(currPass));
			link.target = "_blank";
			link.href = currToken ? ("https://cloud.openthings.io/forward/v1/" + currToken + dest) : (currPrefix + currIp + dest);
			document.body.appendChild(link); // Required for FF
			link.click();
			return false;
		});

		//delete sensor log:
		popup.find("#delete-sen-log").on("click", function () {
			var dur = $(this),
			value = dur.attr("value");

			saveSensor(popup, sensor, callback);
			areYouSure(_("Are you sure you want to delete the log?"), value, function () {
				return sendToOS("/sn?pw=&nr=" + value, "json").done(function (info) {
					var result = info.deleted;
					if (!result)
						showerror(_("Error calling rest service: ") + result);
					else
						showerror(_("Deleted log values: ") + result);
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

			areYouSure(_("Are you sure you want to delete the sensor?"), value, function () {
				return sendToOS("/sc?pw=&nr=" + value + "&type=0", "json").done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						showerror(_("Error calling rest service: ") + " " + result);
					else
						analogSensors.splice(row, 1);
					updateAnalogSensor(callbackCancel);
				});
			});
		});

		popup.find("#unitid").val(sensor.unitid ? sensor.unitid : 0).change();

		popup.find(".submit").on("click", function () {
			saveSensor(popup, sensor, callback);
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

		holdButton(popup.find(".incr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, 1);
			return false;
		});

		holdButton(popup.find(".decr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, -1);
			return false;
		});

		$("#sensorEditor").remove();

		popup.css("max-width", "580px");

		updateSensorVisibility(popup, sensor.type);

		openPopup(popup, { positionTo: "origin" });
	});
}

// Config Page
function showAnalogSensorConfig() {
	var page = $("<div data-role='page' id='analogsensorconfig'>" +
		"<div class='ui-content' role='main' id='analogsensorlist'>" +
		"</div></div>");

	page
		.on("sensorrefresh", updateSensorContent)
		.on("pagehide", function () {
			page.detach();
		});

	function updateSensorContent() {
		var list = $(buildSensorConfig());

		//Edit a sensor:
		list.find(".edit-sensor").on("click", function () {
			var dur = $(this),
				row = dur.attr("row");

			var sensor = analogSensors[row];

			expandItem.add("sensors");
			showSensorEditor(sensor, row, function (sensorOut) {
				sensorOut.nativedata = sensor.nativedata;
				sensorOut.data = sensor.data;
				sensorOut.last = sensor.last;
				return sendToOsObj("/sc?pw=", sensorOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						showerror(_("Error calling rest service: ") + " " + result);
					else
						analogSensors[row] = sensorOut;
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

			showSensorEditor(sensor, -1, function (sensorOut) {
				return sendToOsObj("/sc?pw=", sensorOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						showerror(_("Error calling rest service: ") + " " + result);
					updateAnalogSensor(function () {
						updateSensorContent();
					});
				});
			}, updateSensorContent);
		});

		// Refresh sensor data:
		list.find(".refresh-sensor").on("click", function () {
			expandItem.add("sensors");
			updateProgramAdjustments(function () {
				updateMonitors(function () {
					updateAnalogSensor(function () {
						updateSensorContent();
					});
				});
			});
		});

		//Edit a program adjust:
		list.find(".edit-progadjust").on("click", function () {
			var dur = $(this),
				row = dur.attr("row");

			var progAdjust = progAdjusts[row];

			expandItem.add("progadjust");
			showAdjustmentsEditor(progAdjust, row, function (progAdjustOut) {

				return sendToOsObj("/sb?pw=", progAdjustOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						showerror(_("Error calling rest service: ") + " " + result);
					else
						progAdjusts[row] = progAdjustOut;
					updateProgramAdjustments(updateSensorContent);
				});
			}, updateSensorContent);
		});

		//Add a new program adjust:
		list.find(".add-progadjust").on("click", function () {
			var progAdjust = {
				type: 1
			};

			expandItem.add("progadjust");
			showAdjustmentsEditor(progAdjust, -1, function (progAdjustOut) {
				return sendToOsObj("/sb?pw=", progAdjustOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						showerror(_("Error calling rest service: ") + " " + result);
					else
						progAdjusts.push(progAdjustOut);
					updateProgramAdjustments(updateSensorContent);
				});
			}, updateSensorContent);
		});

		if (checkOSVersion(233) && monitors)
		{
			//Edit a monitor:
			list.find(".edit-monitor").on("click", function () {
				var dur = $(this),
					row = dur.attr("row");

				var monitor = monitors[row];

				expandItem.add("monitors");
				showMonitorEditor(monitor, row, function (monitorOut) {

					return sendToOsObj("/mc?pw=", monitorOut).done(function (info) {
						var result = info.result;
						if (!result || result > 1)
							showerror(_("Error calling rest service: ") + " " + result);
						else
							monitors[row] = monitorOut;
						updateProgramAdjustments(updateSensorContent);
					});
				}, updateSensorContent);
			});

			//Add a monitor:
			list.find(".add-monitor").on("click", function () {
				var monitor = {
					type: 1
				};

				expandItem.add("monitors");
				showMonitorEditor(monitor, -1, function (monitorOut) {
					return sendToOsObj("/mc?pw=", monitorOut).done(function (info) {
						var result = info.result;
						if (!result || result > 1)
							showerror(_("Error calling rest service: ") + " " + result);
						else
							monitors.push(monitorOut);
						updateMonitors(updateSensorContent);
					});
				}, updateSensorContent);
			});
		}
		// Clear sensor log
		list.find(".clear_sensor_logs").on("click", function () {
			expandItem.add("sensorlog");
			areYouSure(_("Are you sure you want to clear the sensor log?"), "", function () {
				return sendToOS("/sn?pw=&", "json").done(function (result) {
					window.alert(_("Log cleared:") + " " + result.deleted + " " + _("records"));
					updateSensorContent();
				});
			});
		});

		list.find(".download-log").on("click", function () {
			expandItem.add("sensorlog");
			var link = document.createElement("a");
			link.style.display = "none";
			link.setAttribute("download", "sensorlog-" + new Date().toLocaleDateString().replace(/\//g, "-") + ".csv");

			var limit = currToken ? "&max=5500" : ""; //download limit is 140kb, 5500 lines ca 137kb
			var dest = "/so?pw=&csv=1" + limit;
			dest = dest.replace("pw=", "pw=" + enc(currPass));
			link.target = "_blank";
			link.href = currToken ? ("https://cloud.openthings.io/forward/v1/" + currToken + dest) : (currPrefix + currIp + dest);
			document.body.appendChild(link); // Required for FF
			link.click();
			return false;
		});

		list.find(".show-log").on("click", function () {
			expandItem.add("sensorlog");
			changePage("#analogsensorchart");
			return false;
		});

		list.find(".backup-all").on("click", function () {
			expandItem.add("backup");
			getExportMethodSensors(1+2+4);
			return false;
		});

		list.find(".restore-all").on("click", function () {
			expandItem.add("backup");
			getImportMethodSensors(1+2+4, updateSensorContent);
			return false;
		});

		list.find(".backup-sensors").on("click", function () {
			expandItem.add("backup");
			getExportMethodSensors(1);
			return false;
		});

		list.find(".restore-sensors").on("click", function () {
			expandItem.add("backup");
			getImportMethodSensors(1, updateSensorContent);
			return false;
		});

		list.find(".backup-adjustments").on("click", function () {
			expandItem.add("backup");
			getExportMethodSensors(2);
			return false;
		});

		list.find(".restore-adjustments").on("click", function () {
			expandItem.add("backup");
			getImportMethodSensors(2, updateSensorContent);
			return false;
		});

		list.find(".backup-monitors").on("click", function () {
			expandItem.add("backup");
			getExportMethodSensors(4);
			return false;
		});

		list.find(".restore-monitors").on("click", function () {
			expandItem.add("backup");
			getImportMethodSensors(4, updateMonitors);
			return false;
		});

		page.find("#analogsensorlist").html(list).enhanceWithin();
	}

	changeHeader({
		title: _("Analog Sensor Config"),
		leftBtn: {
			icon: "carat-l",
			text: _("Back"),
			class: "ui-toolbar-back-btn",
			on: goBack
		},
		rightBtn: {
			icon: "refresh",
			text: screen.width >= 500 ? _("Refresh") : "",
			on: updateSensorContent
		}
	});

	updateSensorContent();

	$("#analogsensorconfig").remove();
	$.mobile.pageContainer.append(page);
}

function checkFirmwareUpdate() {
	if (checkOSVersion(CURRENT_FW_ID) && controller.options.fwm >= CURRENT_FW_MIN)
		return "";
	return _("Please update firmware to ") + CURRENT_FW;
}

function buildSensorConfig() {

	//detected Analog Sensor Boards:
	var detected_boards = "";
	if (analogSensors.hasOwnProperty("detected")) {
		var boards = [];
		let detected = analogSensors.detected;
		if (detected & ASB_BOARD1) boards.push("ASB 1");
		if (detected & ASB_BOARD2) boards.push("ASB 2");
		if (detected & OSPI_PCF8591) boards.push("OSPI PCF8591");
		if (detected & OSPI_ADS1115) boards.push("OSPI 2xADS1115");
		if (detected & UART_SC16IS752) boards.push("UART-Adapter I2C");
		if (detected & RS485_TRUEBNER1) boards.push("RS485-Adapter Truebner");
		if (detected & RS485_TRUEBNER2) boards.push("RS485-Adapter Truebner 2");
		if (detected & RS485_TRUEBNER3) boards.push("RS485-Adapter Truebner 3");
		if (detected & RS485_TRUEBNER4) boards.push("RS485-Adapter Truebner 4");
		if (detected & OSPI_USB_RS485) boards.push("OSPI USB-RS485-Adapter");
		if (detected == 0) boards.push("No Boards detected");
		if (detected && boards.length == 0) boards.push("Unknown Adapter");
		detected_boards = ": " + boards.filter(Boolean).join(", ");
	}

	var list = "<fieldset data-role='collapsible'" + (expandItem.has("sensors") ? " data-collapsed='false'" : "") + ">" +
		"<legend>" + _("Sensors") + detected_boards + "</legend>";

	var info = checkFirmwareUpdate();
	if (info === undefined)
		info = "";
	list += "<table style='width: 100%;' id='analog_sensor_table'><tr>" +
		info +
		"<tr><th>" + _("Nr") + "</th><th class=\"hidecol\">" + _("Type") + "</th><th class=\"hidecol\">" + _("Group") + "</th><th>" + _("Name") + "</th>" +
		"<th class=\"hidecol\">" + _("IP") + "</th><th class=\"hidecol\">" + _("Port") + "</th><th class=\"hidecol\">" + _("ID") + "</th>" +
		"<th class=\"hidecol\">" + _("Read") + "<br>" + _("Interval") + "</th><th>" + _("Data") + "</th><th>" + _("En") + "</th>" +
		"<th class=\"hidecol\">" + _("Log") + "</th><th class=\"hidecol\">" + _("Show") + "</th><th class=\"hidecol2\">" + _("Last") + "</th></tr>";

	var checkpng = "<img src=\"" + getAppURLPath() + "img/check-blue.png\">";

	var row = 0;
	$.each(analogSensors, function (i, item) {

		var $tr = $("<tr>").append(
			$("<td>").text(item.nr),
			$("<td class=\"hidecol\">").text(item.type),
			$("<td class=\"hidecol\">").text(item.group ? item.group : ""),
			"<td><a data-role='button' class='edit-sensor' value='" + item.nr + "' row='" + row + "' href='#' data-mini='true' data-icon='edit'>" +
			item.name + "</a></td>",
			$("<td class=\"hidecol\">").text(item.ip ? toByteArray(item.ip).join(".") : ""),
			$("<td class=\"hidecol\">").text(item.port ? (":" + item.port) : ""),
			$("<td class=\"hidecol\">").text(isNaN(item.id) ? "" : (item.type < 1000 ? item.id : "")),
			$("<td class=\"hidecol\">").text(isNaN(item.ri) ? "" : item.ri),
			$("<td>").text(isNaN(item.data) ? "" : (formatVal(item.data) + item.unit)),
			"<td>" + (item.enable ? checkpng : "") + "</td>",
			"<td class=\"hidecol\">" + (item.log ? checkpng : "") + "</td>",
			"<td class=\"hidecol\">" + (item.show ? checkpng : "") + "</td>",
			$("<td class=\"hidecol2\">").text(item.last === undefined ? "" : (item.data_ok ? dateToString(new Date(item.last * 1000)) : ""), null, 2)
		);
		list += $tr.wrap("<p>").html() + "</tr>";
		row++;
	});
	list += "</table>";
	list += "<a data-role='button' class='add-sensor'     href='#' data-mini='true' data-icon='plus'   >" +
		_("Add Sensor") + "</a>";
	list += "<a data-role='button' class='refresh-sensor' href='#' data-mini='true' data-icon='refresh'>" +
		_("Refresh Sensordata") + "</a>";
	list += "</fieldset>";

	//Program adjustments table:
	list += "<fieldset data-role='collapsible'" + (expandItem.has("progadjust") ? " data-collapsed='false'" : "") + ">" +
		"<legend>" + _("Program Adjustments") + "</legend>";
	list += "<table style='width: 100%;' id='progadjusttable'><tr style='width:100%;vertical-align: top;'>" +
		"<tr><th>" + _("Nr") + "</th>" +
		"<th class=\"hidecol\">" + _("Type") + "</th>" +
		"<th class=\"hidecol2\">" + _("S.Nr") + "</th>" +
		"<th class=\"hidecol2\">" + _("Sensor") + "</th>" +
		"<th>" + _("Name") + "</th>" +
		"<th class=\"hidecol2\">" + _("Program") + "</th>" +
		"<th class=\"hidecol2\">" + _("Factor 1") + "</th>" +
		"<th class=\"hidecol2\">" + _("Factor 2") + "</th>" +
		"<th class=\"hidecol2\">" + _("Min Value") + "</th>" +
		"<th class=\"hidecol2\">" + _("Max Value") + "</th>" +
		"<th>" + _("Cur") + "</th></tr>";

	row = 0;
	$.each(progAdjusts, function (i, item) {

		var sensorName = "";
		for (var j = 0; j < analogSensors.length; j++) {
			if (analogSensors[j].nr === item.sensor) {
				sensorName = analogSensors[j].name;
			}
		}
		var progName = "?";
		if (item.prog >= 1 && item.prog <= controller.programs.pd.length) {
			progName = readProgram(controller.programs.pd[item.prog - 1]).name;
		}

		if (!checkOSVersion(233))
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
	list += "<a data-role='button' class='add-progadjust' href='#' data-mini='true' data-icon='plus'>" + _("Add program adjustment") + "</a>";
	list += "</fieldset>";

	//Monitors table:
	if (checkOSVersion(233) && monitors) {
		list += "<fieldset data-role='collapsible'" + (expandItem.has("monitors") ? " data-collapsed='false'" : "") + ">" +
			"<legend>" + _("Monitoring and control") + "</legend>";
		list += "<table style='width: 100%; id='monitorstable'><tr style='width:100%;vertical-align: top;'>" +
			"<tr><th>" + _("Nr") + "</th>" +
			"<th class=\"hidecol\">" + _("Type") + "</th>" +
			"<th class=\"hidecol2\">" + _("S.Nr") + "</th>" +
			"<th class=\"hidecol2\">" + _("Source") + "</th>" +
			"<th>" + _("Name") + "</th>" +
			"<th class=\"hidecol2\">" + _("Program") + "</th>" +
			"<th class=\"hidecol2\">" + _("Zone") + "</th>" +
			"<th class=\"hidecol2\">" + _("Value 1") + "</th>" +
			"<th class=\"hidecol2\">" + _("Value 2") + "</th>" +
			"<th>" + _("Activated") + "</th></tr>";

		row = 0;
		$.each(monitors, function (i, item) {
			var progName = "";
			if (item.prog > 0 && item.prog <= controller.programs.pd.length) {
				progName = readProgram(controller.programs.pd[item.prog - 1]).name;
			}
			var zoneName = "";
			if (item.zone > 0 && item.zone <= controller.stations.snames.length) {
				zoneName = controller.stations.snames[item.zone - 1];
			}
			var source = "";
			var unit = "";
			var sensorNr = "";
			switch(item.type) {
				case MONITOR_MIN:
				case MONITOR_MAX: {
					for (var j = 0; j < analogSensors.length; j++) {
						if (analogSensors[j].nr === item.sensor) {
							source = analogSensors[j].name;
							unit = analogSensors[j].unit;
						}
					}
					sensorNr = item.sensor;
					break;
				}
				case MONITOR_SENSOR12: {
					if (item.sensor12 == 1)
						source = controller.options.sn1t === 3 ? _( "Soil" ) : _( "Rain" );
					else if (item.sensor12 == 2)
						source = controller.options.sn2t === 3 ? _( "Soil" ) : _( "Rain" );
					else
						source = "??";
					if (item.invers) source = _("NOT") + " " + source;
					break;
				}
				case MONITOR_AND:
				case MONITOR_OR:
				case MONITOR_XOR: {
					source = combineWithSep(" " + getMonitorLogical(item.type) + " ",
						getMonitorSourceName(item.invers1, item.monitor1),
						getMonitorSourceName(item.invers2, item.monitor2),
						getMonitorSourceName(item.invers3, item.monitor3),
						getMonitorSourceName(item.invers4, item.monitor4));
					break;
				}
				case MONITOR_NOT: {
					source = getMonitorLogical(item.type)+" "+getMonitorName(item.monitor);
					break;
				}
				case MONITOR_REMOTE: {
					source = getMonitorLogical(item.type)+" "+getMonitorName(item.monitor);
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
				$("<td class=\"hidecol2\">").text(formatValUnit(item.value1, unit)),
				$("<td class=\"hidecol2\">").text(formatValUnit(item.value2, unit)),
				$("<td>"+(item.active ? checkpng : ""))
			);
			list += $tr.wrap("<p>").html() + "</tr>";
			row++;
		});
		list += "</table>";
		list += "<a data-role='button' class='add-monitor' href='#' data-mini='true' data-icon='plus'>" + _("Add monitor") + "</a>";
		list += "</fieldset>";
	}

	//Analog sensor logs:
	list += "<fieldset data-role='collapsible'" + (expandItem.has("sensorlog") ? " data-collapsed='false'" : "") + ">" +
		"<legend>" + _("Sensor Log") + "</legend>";
	list += "<a data-role='button' class='red clear_sensor_logs' href='#' data-mini='true' data-icon='alert'>" +
		_("Clear Log") +
		"</a>" +
		"<a data-role='button' data-icon='action' class='download-log' href='#' data-mini='true'>" + _("Download Log") + "</a>" +
		"<a data-role='button' data-icon='grid' class='show-log' href='#' data-mini='true'>" + _("Show Log") + "</a>" +

		"</div></fieldset>";

	//backup:
	if (checkOSVersion(231)) {
		list += "<fieldset data-role='collapsible'" + (expandItem.has("backup") ? " data-collapsed='false'" : "") + ">" +
			"<legend>" + _("Backup and Restore") + "</legend>";
		list += "<a data-role='button' data-icon='arrow-d-r' class='backup-all'  href='#' data-mini='true'>" + _("Backup Config") + "</a>" +
			"<a data-role='button' data-icon='back'      class='restore-all' href='#' data-mini='true'>" + _("Restore Config") + "</a>";
		list += "<a data-role='button' data-icon='arrow-d-r' class='backup-sensors'  href='#' data-mini='true'>" + _("Backup Sensor Config") + "</a>" +
			"<a data-role='button' data-icon='back'      class='restore-sensors' href='#' data-mini='true'>" + _("Restore Sensor Config") + "</a>";
		list += "<a data-role='button' data-icon='arrow-d-r' class='backup-adjustments'  href='#' data-mini='true'>" + _("Backup Program Adjustments") + "</a>" +
			"<a data-role='button' data-icon='back'      class='restore-adjustments' href='#' data-mini='true'>" + _("Restore Program Adjustments") + "</a>";
		if (checkOSVersion(233)) {
			list += "<a data-role='button' data-icon='arrow-d-r' class='backup-monitors'  href='#' data-mini='true'>" + _("Backup Monitors") + "</a>" +
				"<a data-role='button' data-icon='back'      class='restore-monitors' href='#' data-mini='true'>" + _("Restore Monitors") + "</a>";
			list += "</div></fieldset>";
		}
	}
	return list;
}

/*
	Combines all parameters to a string. First parameter is the separator
*/
function combineWithSep(sep, ...args) {
	if (!args.length) return "";
	var result = "";
	for (var i = 0; i < args.length; i++) {
		let arg = args[i];
		if (!arg) continue;
		if (result.length > 0) result += sep;
		result += arg;
	}
	return result;
}

function getMonitorLogical(type) {
	switch(type) {
		case MONITOR_MIN: return _("Min");
		case MONITOR_MAX: return _("Max");
		case MONITOR_SENSOR12: return _("SN 1/2");
		case MONITOR_AND: return _("AND");
		case MONITOR_OR: return _("OR");
		case MONITOR_XOR: return _("XOR");
		case MONITOR_NOT: return _("NOT");
		case MONITOR_REMOTE: return _("REMOTE");
		default: return "??";
	}
}

function getMonitorSourceName(invers, monitorNr) {
	if (!monitorNr) return "";
	return (invers? (_("NOT") + " ") : "")+ getMonitorName(monitorNr);
}

function getMonitorName(monitorNr) {
	for (var i = 0; i < monitors.length; i++) {
		let monitor = monitors[i];
		if (monitor.nr === monitorNr)
			return monitor.name;
	}
	return "";
}

// Show Sensor Charts with apexcharts
function showAnalogSensorCharts() {

	var max = CHARTS;
	for (var j = 0; j < analogSensors.length; j++) {
		if (!analogSensors[j].log || !analogSensors[j].enable)
			continue;
		var unitid = analogSensors[j].unitid;
		if (unitid === USERDEF_UNIT) max++;
	}

	var last = "", week = "", month = "";
	for (var j = 1; j <= max; j++) {
		last += "<div id='myChart" + j + "'></div>";
		week += "<div id='myChartW" + j + "'></div>";
		month += "<div id='myChartM" + j + "'></div>";
	}

	var page = $("<div data-role='page' id='analogsensorchart'>" +
		"<div class='ui-content' role='main' style='width: 95%'>" +
		last + week + month +
		"</div></div>");

	changeHeader({
		title: _("Analog Sensor Log"),
		leftBtn: {
			icon: "carat-l",
			text: _("Back"),
			class: "ui-toolbar-back-btn",
			on: goBack
		},
		rightBtn: {
			icon: "refresh",
			text: screen.width >= 500 ? _("Refresh") : "",
			on: updateCharts
		}
	});

	page.one("pagehide", function () {
		page.detach();
	});

	$("#analogsensorchart").remove();
	$.mobile.pageContainer.append(page);

	updateCharts();
}

function updateCharts() {
	var chart1 = new Array(CHARTS),
		chart2 = new Array(CHARTS),
		chart3 = new Array(CHARTS),
		datalimit = false;

	var limit = currToken ? "&max=5500" : ""; //download limit is 140kb, 5500 lines ca 137kb
	var tzo = getTimezoneOffset() * 60;

	showLoading( "#myChart1" );
	sendToOS("/so?pw=&lasthours=48&csv=2" + limit, "text").then(function (csv1) {
		buildGraph("#myChart", chart1, csv1, _("last 48h"), "HH:mm", tzo, 0);

		sendToOS("/so?pw=&csv=2&log=1" + limit, "text").then(function (csv2) {
			buildGraph("#myChartW", chart2, csv2, _("last weeks"), "dd.MM.yyyy", tzo, 1);

			sendToOS("/so?pw=&csv=2&log=2" + limit, "text").then(function (csv3) {
				buildGraph("#myChartM", chart3, csv3, _("last months"), "MM.yyyy", tzo, 2);
			});
		});
	});
}

function buildGraph(prefix, chart, csv, titleAdd, timestr, tzo, lvl) {
	var csvlines = csv.split(/(?:\r\n|\n)+/).filter(function (el) { return el.length !== 0; });

	var legends = [], opacities = [], widths = [], colors = [], coloridx = 0;
	for (var j = 0; j < analogSensors.length; j++) {
		var sensor = analogSensors[j];
		let color = COLORS[coloridx++ % COLCOUNT];
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
				if (unitid != 3 && unitid != USERDEF_UNIT && value > 100) continue;
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

		var series = { name: sensor.name, type: (sensor.unitid === USERDEF_UNIT? "area" : "line"), data: logdata, color: color };

		if (!chart[unitid]) {
			var unit, title, unitStr,
				minFunc = function (val) { return Math.floor(val > 0 ? Math.max(0, val - 4) : val - 1); },
				maxFunc = function (val) { return Math.ceil(val); },
				autoY = true;
			switch (unitid) {
				case 1: unit = _("Soil moisture");
					title = _("Soil moisture") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case 2: unit = _("degree celsius temperature");
					title = _("Temperature") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + String.fromCharCode(176) + "C"; };
					break;
				case 3: unit = _("degree fahrenheit temperature");
					title = _("Temperature") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + String.fromCharCode(176) + "F"; };
					break;
				case 4: unit = _("Volt");
					title = _("Voltage") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + " V"; };
					minFunc = 0;
					maxFunc = 4;
					autoY = false;
					break;
				case 5: unit = _("Humidity");
					title = _("Air Humidity") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case 6: unit = _("Rain");
					title = _("Rainfall") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + " in"; };
					break;
				case 7: unit = _("Rain");
					title = _("Rainfall") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + " mm"; };
					minFunc = 0;
					break;
				case 8: unit = _("Wind");
					title = _("Wind") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + " mph"; };
					minFunc = 0;
					break;
				case 9: unit = _("Wind");
					title = _("Wind") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + " kmh"; };
					minFunc = 0;
					break;
				case 10: unit = _("Level");
					title = _("Level") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					autoY = false;
					break;
				case 11: unit = _("DK");
					title = _("DK") + " " + titleAdd;
					unitStr = function (val) { return formatVal(val); };
					minFunc = 0;
					break;

				default: unit = sensor.unit;
					title = sensor.name + "~ " + titleAdd;
					unitStr = function (val) { return formatVal(val); };
			};

			let canExport = !!window.cordova;
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

			chart[unitid] = new ApexCharts(document.querySelector(prefix + unitid), options);
			chart[unitid].render();
		} else {
			chart[unitid].appendSeries(series);
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
			chart[unitid].appendSeries(rangeArea);
			chart[unitid].updateOptions(otherOptions);
		}

		if (!sensor.chart)
			sensor.chart = new Map();
		sensor.chart.set(prefix, chart[unitid]);
	}

	for (var p = 0; p < progAdjusts.length; p++) {
		var adjust = progAdjusts[p];
		var sensor = adjust.sensor;
		for (var j = 0; j < analogSensors.length; j++) {
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
										text: _("Min") + " " + adjust.min + " " + unitStr,
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
										text: _("Max") + " " + adjust.max + " " + unitStr,
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

	for (var c = 1; c < chart.length; c++) {
		if (!chart[c]) {
			var x = document.querySelector(prefix + c);
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
function formatVal(val) {
	if (val === undefined || isNaN(val))
		return "";
	return (+(Math.round(val + "e+2") + "e-2"));
}

/**
* format value output. unit is only printed, if value valid
*/
function formatValUnit(val, unit) {
	if (val === undefined || isNaN(val))
		return "";
	return (+(Math.round(val + "e+2") + "e-2")) + unit;

}

function getUnit(sensor) {
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
		default: return sensor.unit;
	}
}

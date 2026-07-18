/* eslint-disable */

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

describe("Sensor UI Checks", function () {
	function sensorLogBuffer(recordCount) {
		recordCount = typeof recordCount === "number" ? recordCount : 1;
		var buffer = new ArrayBuffer(recordCount * 10);
		var view = new DataView(buffer);
		for (var index = 0; index < recordCount; index++) {
			var offset = index * 10;
			view.setUint32(offset, 1700000000 + index, true);
			view.setFloat32(offset + 4, 42, true);
			view.setUint16(offset + 8, 7, true);
		}
		return buffer;
	}

	function sensorEditorData() {
		return {
			enums: {},
			units: [],
			args: [
				{ name: "Name", arg: "name", type: "string::[1,32]", default: "Test" },
				{ name: "Interval", arg: "interval", type: "int::[1,any]", default: 60 },
				{ name: "Minimum", arg: "min", type: "double::[any,any]", default: 0 },
				{ name: "Maximum", arg: "max", type: "double::[any,any]", default: 100 }
			],
			flags: [],
			sensors: [ { name: "Test Sensor", args: [] } ]
		};
	}

	it("should render the home card as a keyboard-accessible navigation link", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var changePage = sinon.stub(OSApp.UIDom, "changePage");
		var parent = $("<div></div>");

		try {
			controller.sensors = { sn: [ {
				uuid: 7,
				name: "Soil Moisture",
				unit: 1,
				status: OSApp.Sensors.STATUS.VALID,
				value: 42,
				flag: 4
			} ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };

			OSApp.Sensors.renderHomeCards(parent);
			var card = parent.find(".sensors-home-combined");

			assert.equal(card.prop("tagName"), "A");
			assert.equal(card.attr("href"), "#sensors");
			assert.equal(card.prop("tabIndex"), 0);
			assert.include(card.text(), "Soil Moisture");

			card[0].click();
			assert.isTrue(changePage.calledOnceWith("#sensors"));
		} finally {
			parent.remove();
			changePage.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should update unchanged home cards in place and rebuild on configuration changes", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var parent = $("<div></div>");

		try {
			controller.sensors = { sn: [ {
				uuid: 7,
				name: "Soil",
				unit: 1,
				status: OSApp.Sensors.STATUS.VALID,
				value: 42,
				flag: 4
			} ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };

			OSApp.Sensors.updateHomeCards(parent);
			var originalCard = parent.find(".sensors-home-combined")[0];
			controller.sensors.sn[0].value = 43;
			OSApp.Sensors.updateHomeCards(parent);

			assert.strictEqual(parent.find(".sensors-home-combined")[0], originalCard);
			assert.include(parent.find(".sensor-home-value").text(), "43");

			controller.sensors.sn[0].name = "Garden Soil";
			OSApp.Sensors.updateHomeCards(parent);
			assert.notStrictEqual(parent.find(".sensors-home-combined")[0], originalCard);
			assert.include(parent.text(), "Garden Soil");
		} finally {
			parent.remove();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should use labeled keyboard-accessible buttons to delete calibration points", function () {
		var parent = $("<div></div>").appendTo("body");
		try {
			OSApp.Sensors.createSensorPage(parent, "", {
				enums: {},
				units: [],
				args: [],
				flags: [],
				sensors: [ {
					name: "Test Sensor",
					args: [ {
						name: "Calibration",
						arg: "points",
						type: "points::[2,8]",
						default: ""
					} ]
				} ]
			});

			var removeButton = parent.find(".split-remove").first();
			assert.equal(removeButton.prop("tagName"), "BUTTON");
			assert.equal(removeButton.attr("type"), "button");
			assert.isAtLeast(removeButton.prop("tabIndex"), 0);
			assert.match(removeButton.attr("aria-label"), /1$/);

			removeButton[0].click();
			assert.lengthOf(parent.find(".split-remove"), 1);
		} finally {
			parent.remove();
		}
	});

	it("should require two complete points even when the description advertises zero", function () {
		var parent = $("<div></div>").appendTo("body");
		try {
			var editor = OSApp.Sensors.createSensorPage(parent, "", {
				enums: {},
				units: [],
				args: [],
				flags: [],
				sensors: [ {
					name: "Piecewise Linear",
					args: [ {
						name: "Calibration",
						arg: "points",
						type: "points::[0,8]",
						default: ""
					} ]
				} ]
			});

			assert.lengthOf(parent.find(".split-x"), 2);
			assert.isUndefined(editor.getURL());
			parent.find(".split-x").eq(0).val("0").trigger("change");
			parent.find(".split-y").eq(0).val("1").trigger("change");
			assert.isUndefined(editor.getURL());
			parent.find(".split-x").eq(1).val("10").trigger("change");
			parent.find(".split-y").eq(1).val("2").trigger("change");
			assert.match(editor.getURL(), /^\/csn\?/);
		} finally {
			parent.remove();
		}
	});

	it("should require integer fields without emitting min or max attributes for any", function () {
		var parent = $("<div></div>").appendTo("body");
		try {
			var editor = OSApp.Sensors.createSensorPage(parent, "", sensorEditorData());
			var name = parent.find('input[id*="-name-"]');
			var interval = parent.find('input[id*="-interval-"]');
			var minimum = parent.find('input[id*="-min-"]');

			assert.isTrue(name.prop("required"));
			assert.equal(name.attr("minlength"), "1");
			assert.isTrue(interval.prop("required"));
			assert.equal(interval.attr("min"), "1");
			assert.isUndefined(interval.attr("max"));
			assert.isUndefined(minimum.attr("min"));
			assert.isUndefined(minimum.attr("max"));

			name.val("");
			assert.isUndefined(editor.getURL());
			name.val("Test");
			interval.val("");
			assert.isUndefined(editor.getURL());
		} finally {
			parent.remove();
		}
	});

	it("should deactivate the old type before applying a lower-index type's shared constraints", function () {
		var parent = $("<div></div>").appendTo("body");
		try {
			var editor = OSApp.Sensors.createSensorPage(parent, "", {
				enums: { SensorUnitGroup: [ "Voltage", "Percent" ] },
				units: [
					{ value: 10, index: 10, group: 0, name: "Volts", short: "V" },
					{ value: 20, index: 20, group: 1, name: "Percent", short: "%" }
				],
				args: [
					{ name: "Name", arg: "name", type: "string::[1,32]", default: "Probe" },
					{ name: "Type", arg: "type", type: "type", default: 1 },
					{ name: "Unit", arg: "unit", type: "unit", default: 20 }
				],
				flags: [],
				sensors: [
					{
						name: "ADS1115",
						args: [ {
							name: "ADS Mode",
							arg: "ads_mode",
							type: "enum",
							default: "0",
							options: [ { id: "0", label: "Analog", locked: [ "unit" ], unit_group: 0 } ]
						} ]
					},
					{
						name: "System",
						args: [ {
							name: "System Mode",
							arg: "system_mode",
							type: "enum",
							default: "0",
							options: [ { id: "0", label: "Onboard", locked: [ "unit" ], unit_group: 1 } ]
						} ]
					}
				]
			});
			editor.reset();

			var type = parent.find('select[id*="-type-"]');
			var unit = parent.find('select[id*="-unit-"]');
			assert.equal(type.val(), "1");
			assert.equal(unit.val(), "20");
			assert.isTrue(unit.prop("disabled"));

			type.val("0").trigger("input");

			assert.equal(unit.val(), "10");
			assert.isTrue(unit.prop("disabled"));
			assert.isTrue(unit.find('option[value="20"]').prop("disabled"));
			assert.isFalse(unit.find('option[value="10"]').prop("disabled"));
		} finally {
			parent.remove();
		}
	});

	it("should reject a blank required sensor name without starting a /csn mutation", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var headerOptions;
		var changeSensor = sinon.stub(OSApp.Sensors, "changeSensor");
		var showError = sinon.stub(OSApp.Errors, "showError");
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader").callsFake(function (options) {
			headerOptions = options;
		});

		try {
			controller.sensor_desc = sensorEditorData();
			controller.sensors = { sn: [] };

			OSApp.Sensors.addSensor();
			var name = $("#add-sensor").find('input[id*="-name-"]');
			assert.isTrue(name.prop("required"));
			name.val("");
			headerOptions.rightBtn.on();

			assert.isFalse(changeSensor.called);
			assert.isTrue(showError.calledWith(OSApp.Language._("Please fill in all required fields")));
		} finally {
			$("#add-sensor").trigger("pagehide").remove();
			changeHeader.restore();
			loading.restore();
			showError.restore();
			changeSensor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should reject sensor clamp ranges where minimum exceeds maximum", function () {
		var parent = $("<div></div>").appendTo("body");
		try {
			var editor = OSApp.Sensors.createSensorPage(parent, "", sensorEditorData());
			editor.update({ name: "Range", interval: 60, min: 10, max: 5 });
			assert.isUndefined(editor.getURL());

			editor.update({ max: 15 });
			assert.match(editor.getURL(), /^\/csn\?/);
		} finally {
			parent.remove();
		}
	});

	it("should show a validation error without sending a reversed sensor clamp range", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var changeSensor = sinon.stub(OSApp.Sensors, "changeSensor");
		var showError = sinon.stub(OSApp.Errors, "showError");
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");

		try {
			controller.sensor_desc = sensorEditorData();
			controller.sensors = { sn: [ {
				uuid: 7,
				name: "Range",
				interval: 60,
				min: 10,
				max: 5,
				flag: 1,
				extra: {}
			} ] };

			OSApp.Sensors.displayPage();
			var page = $("#sensors");
			page.find('input[type="button"]').filter(function () {
				return $(this).val() === OSApp.Language._("Update Sensor");
			}).first().trigger("click");

			assert.isFalse(changeSensor.called);
			assert.isTrue(showError.calledWith(OSApp.Language._("Please fill in all required fields")));
		} finally {
			$("#sensors").remove();
			changeHeader.restore();
			loading.restore();
			showError.restore();
			changeSensor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should build a capped three-hour sensor log request", function () {
		assert.equal(
			OSApp.Sensors.getChartLogURL(1700000000),
			"/jsl?pw=&fmt=binary&after=1699989200&count=20000"
		);
	});

	it("should cap rendered sensor records and expose only honest three-hour controls", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var originalDevt = controller.settings.devt;
		var chart = {
			data: {},
			destroy: sinon.spy(),
			resetZoom: sinon.spy(),
			update: sinon.spy()
		};
		var chartConstructor = sinon.stub(window, "Chart").returns(chart);
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve(sensorLogBuffer(OSApp.Sensors.LOG_CHART_MAX_RECORDS + 1)).promise());
		var page;

		try {
			controller.settings.devt = 1700000000;
			controller.sensors = { sn: [ { uuid: 7, name: "Soil", unit: 1 } ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };
			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");

			assert.isTrue(sendToOS.firstCall.calledWith(
				"/jsl?pw=&fmt=binary&after=1699989200&count=20000",
				"arraybuffer"
			));
			assert.lengthOf(chart.data.datasets[0].data, OSApp.Sensors.LOG_CHART_MAX_RECORDS);
			assert.include(page.find(".sensor-log-window-note").text(), "3 hours");
			assert.lengthOf(page.find('input[value="1D"], input[value="1W"], input[value="1M"], input[value="All"]'), 0);
			assert.lengthOf(page.find('input[value="Download 3H"]'), 1);
		} finally {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			controller.settings.devt = originalDevt;
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should show a normal empty state and disable full download when no log exists", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var emptyLog = new ArrayBuffer(0);
		emptyLog.noLogHeader = true;
		var chartConstructor = sinon.stub(window, "Chart");
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve(emptyLog).promise());
		var page;

		try {
			controller.sensors = { sn: [] };
			controller.sensor_desc = { units: [] };
			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");

			assert.equal(page.find(".sensor-log-empty").text(), OSApp.Language._("No sensor logs found."));
			assert.isTrue(page.find("input.sensor-log-download-btn").prop("disabled"));
			assert.isFalse(chartConstructor.called);
		} finally {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should download the server CSV Blob and restore the Download All UI", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var csvRequest = $.Deferred();
		var csvBlob = new Blob([ "uuid,timestamp,value\n7,1700000000,42\n" ], {
			type: "text/csv;charset=utf-8"
		});
		var chart = {
			data: {},
			destroy: sinon.spy(),
			resetZoom: sinon.spy(),
			update: sinon.spy()
		};
		var chartConstructor = sinon.stub(window, "Chart").returns(chart);
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var showError = sinon.stub(OSApp.Errors, "showError");
		var createObjectURL = sinon.stub(URL, "createObjectURL").returns("blob:sensor-log-download");
		var revokeObjectURL = sinon.stub(URL, "revokeObjectURL");
		var anchorClick = sinon.stub(HTMLAnchorElement.prototype, "click");
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").callsFake(function (_url, type) {
			return type === "blob"
				? csvRequest.promise()
				: $.Deferred().resolve(sensorLogBuffer()).promise();
		});
		var page;

		function cleanup() {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			anchorClick.restore();
			revokeObjectURL.restore();
			createObjectURL.restore();
			showError.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}

		try {
			controller.sensors = { sn: [ { uuid: 7, name: "Soil", unit: 1 } ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };
			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");

			assert.isTrue(sendToOS.calledOnce);
			var downloadButton = page.find("input.sensor-log-download-btn");
			assert.isFalse(downloadButton.prop("disabled"));
			loading.resetHistory();
			downloadButton.trigger("click");
			assert.isTrue(sendToOS.secondCall.calledWith(
				"/jsl?pw=&fmt=csv&count=max",
				"blob"
			));
			assert.isTrue(downloadButton.prop("disabled"));
			assert.isTrue(loading.calledWith("show"));

			csvRequest.resolve(csvBlob);
			return new Promise(function (resolve) { setTimeout(resolve, 0); }).then(function () {
				assert.isTrue(createObjectURL.calledOnceWithExactly(csvBlob));
				assert.isTrue(anchorClick.calledOnce);
				var link = anchorClick.firstCall.thisValue;
				assert.equal(link.href, "blob:sensor-log-download");
				assert.match(link.download, /^sensorlog-\d{4}-\d{2}-\d{2}\.csv$/);
				assert.isFalse(document.body.contains(link));
				assert.isTrue(revokeObjectURL.calledOnceWithExactly("blob:sensor-log-download"));
				assert.isTrue(loading.calledWith("hide"));
				assert.isFalse(downloadButton.prop("disabled"));
				assert.isFalse(showError.called);
			}).finally(cleanup);
		} catch (error) {
			cleanup();
			throw error;
		}
	});

	it("should destroy sensor charts when the log page is hidden", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var chart = {
			data: {},
			destroy: sinon.spy(),
			resetZoom: sinon.spy(),
			update: sinon.spy()
		};
		var chartConstructor = sinon.stub(window, "Chart").returns(chart);
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve(sensorLogBuffer()).promise());
		var page;

		try {
			controller.sensors = { sn: [ { uuid: 7, name: "Soil", unit: 1 } ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };
			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");

			assert.isTrue(chartConstructor.calledOnce);
			page.trigger("pagehide");
			assert.isTrue(chart.destroy.calledOnce);
		} finally {
			if (page) page.remove();
			sendToOS.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should ignore sensor log responses that arrive after pagehide", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var pending = $.Deferred();
		var chartConstructor = sinon.stub(window, "Chart");
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").returns(pending.promise());
		var page;

		try {
			controller.sensors = { sn: [ { uuid: 7, name: "Soil", unit: 1 } ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };
			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");

			page.trigger("pagehide");
			pending.resolve(sensorLogBuffer());

			assert.isFalse(chartConstructor.called);
			assert.isTrue(loading.calledWith("hide"));
		} finally {
			if (page) page.remove();
			sendToOS.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	[ "displayPage", "addSensor" ].forEach(function (method) {
		it("should ignore late sensor-description responses after a site switch in " + method, function () {
			var session = OSApp.currentSession;
			var controller = session.controller;
			var originalController = controller;
			var originalDescription = controller.sensor_desc;
			var originalSensors = controller.sensors;
			var request = $.Deferred();
			var replacementDescription = { marker: "replacement-description" };
			var replacementController = {
				sensor_desc: replacementDescription,
				sensors: { sn: [] },
				settings: {}
			};
			var loading = sinon.stub($.mobile, "loading");
			var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
			var showError = sinon.stub(OSApp.Errors, "showError");
			var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").returns(request.promise());
			var page;

			try {
				delete controller.sensor_desc;
				controller.sensors = { sn: [] };
				OSApp.Sensors[method]();
				page = method === "displayPage" ? $("#sensors") : $("#add-sensor");
				loading.resetHistory();
				session.controller = replacementController;
				request.resolve(sensorEditorData());

				assert.strictEqual(replacementController.sensor_desc, replacementDescription);
				assert.notProperty(controller, "sensor_desc");
				assert.isFalse(showError.called);
				assert.isFalse(loading.calledWith("hide"));
			} finally {
				if (page) page.trigger("pagehide").remove();
				session.controller = originalController;
				controller.sensor_desc = originalDescription;
				controller.sensors = originalSensors;
				sendToOS.restore();
				showError.restore();
				changeHeader.restore();
				loading.restore();
			}
		});
	});

	it("should ignore late sensor-log responses after a site switch", function () {
		var session = OSApp.currentSession;
		var controller = session.controller;
		var originalDescription = controller.sensor_desc;
		var originalSensors = controller.sensors;
		var originalDevt = controller.settings.devt;
		var logRequest = $.Deferred();
		var descriptionRequest = $.Deferred();
		var replacementDescription = { marker: "replacement-description" };
		var replacementController = {
			sensor_desc: replacementDescription,
			sensors: { sn: [] },
			settings: { devt: 1800000000 }
		};
		var chartConstructor = sinon.stub(window, "Chart");
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var showError = sinon.stub(OSApp.Errors, "showError");
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").callsFake(function (_url, type) {
			return type === "arraybuffer" ? logRequest.promise() : descriptionRequest.promise();
		});
		var page;

		try {
			delete controller.sensor_desc;
			controller.sensors = { sn: [ { uuid: 7, name: "Old", unit: 1 } ] };
			controller.settings.devt = 1700000000;
			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");
			loading.resetHistory();
			session.controller = replacementController;
			logRequest.resolve(sensorLogBuffer());
			descriptionRequest.resolve(sensorEditorData());

			assert.strictEqual(replacementController.sensor_desc, replacementDescription);
			assert.notProperty(controller, "sensor_desc");
			assert.isFalse(chartConstructor.called);
			assert.isFalse(showError.called);
			assert.isFalse(loading.calledWith("hide"));
		} finally {
			if (page) page.trigger("pagehide").remove();
			session.controller = controller;
			controller.sensor_desc = originalDescription;
			controller.sensors = originalSensors;
			controller.settings.devt = originalDevt;
			sendToOS.restore();
			showError.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
		}
	});

	it("should export RFC4180-safe text with Unix-second timestamps", function () {
		var row = OSApp.Sensors.formatLogCsvRow(
			7,
			'  =cmd,"soil"',
			new Date(1700000000123),
			-2.5,
			" \t+V"
		);

		assert.equal(row, '7,"\'  =cmd,""soil""",1700000000,-2.5,"\' \t+V"');
	});
});

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
	function sensorLogBuffer(recordCount, uuids, timestamps) {
		recordCount = typeof recordCount === "number" ? recordCount : 1;
		var buffer = new ArrayBuffer(recordCount * 10);
		var view = new DataView(buffer);
		for (var index = 0; index < recordCount; index++) {
			var offset = index * 10;
			view.setUint32(offset, Array.isArray(timestamps) ? timestamps[index] : 1700000000 + index, true);
			view.setFloat32(offset + 4, 42, true);
			view.setUint16(offset + 8, Array.isArray(uuids) ? uuids[index % uuids.length] : 7, true);
		}
		return buffer;
	}

	function pagedLogResponse(buffer, nextCursor, totalSlots, done, windowStart, windowEnd) {
		var values = {
			"x-os-next-cursor": String(nextCursor),
			"x-os-total-slots": String(totalSlots),
			"x-os-page-done": done ? "1" : "0"
		};
		if (typeof windowStart === "number") values["x-os-window-start"] = String(windowStart);
		if (typeof windowEnd === "number") values["x-os-window-end"] = String(windowEnd);
		return {
			data: buffer,
			headers: {
				get: function (name) { return values[name.toLowerCase()] || null; }
			}
		};
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

	it("should omit hidden sensor arrays and ignore their stale validation state", function () {
		var parent = $("<div></div>").appendTo("body");
		try {
			var editor = OSApp.Sensors.createSensorPage(parent, "", {
				enums: {},
				units: [],
				args: [
					{ name: "Name", arg: "name", type: "string::[1,32]", default: "Aggregate" },
					{ name: "Type", arg: "type", type: "type", default: 0 }
				],
				flags: [],
				sensors: [ {
					name: "Aggregate",
					args: [
						{
							name: "Mode",
							arg: "mode",
							type: "enum",
							default: "0",
							options: [
								{ id: "0", label: "With children" },
								{ id: "1", label: "Without children", hides: [ "children" ] }
							]
						},
						{
							name: "Children",
							arg: "children",
							type: "array::1",
							default: "",
							extra: [ { name: "Value", arg: "value", type: "int::[0,10]", default: 7 } ]
						}
					]
				} ]
			});

			var visibleURL = editor.getURL();
			assert.include(visibleURL, "children=7%3B");

			parent.find('input[type="number"]').val("");
			parent.find('select[id*="-mode-"]').val("1").trigger("change");
			var hiddenURL = editor.getURL();

			assert.match(hiddenURL, /^\/csn\?/);
			assert.notInclude(hiddenURL, "children=");
		} finally {
			parent.remove();
		}
	});

	it("should reject blank and whitespace-only sensor names without starting a /csn mutation", function () {
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

				showError.resetHistory();
				name.val("   ");
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
			page.find("[data-uuid='7']").collapsible("expand");
			page.find('input[type="button"]').filter(function () {
				return $(this).val() === OSApp.Language._("Update Sensor");
			}).first().trigger("click");

			assert.isFalse(changeSensor.called);
			assert.isTrue(showError.calledWith(OSApp.Language._("Please fill in all required fields")));
		} finally {
				$("#sensors").trigger("pagehide").remove();
			changeHeader.restore();
			loading.restore();
			showError.restore();
			changeSensor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should build sensor editors only when their collapsibles are first expanded", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var editors = [];
		var createSensorPage = sinon.stub(OSApp.Sensors, "createSensorPage").callsFake(function (_parent, uuid) {
			var editor = { uuid: uuid, update: sinon.spy(), getURL: sinon.stub().returns("/csn?pw=") };
			editors.push(editor);
			return editor;
		});

		try {
			controller.sensor_desc = sensorEditorData();
			controller.sensors = { sn: Array.from({ length: 20 }, function (_value, index) {
				return {
					uuid: index + 1,
					name: "Sensor " + (index + 1),
					unit: 0,
					value: index,
					status: OSApp.Sensors.STATUS.VALID,
					flag: 1,
					extra: {}
				};
			}) };

			OSApp.Sensors.displayPage();
			var page = $("#sensors");
			var collapsibles = page.find("[data-uuid]");

			assert.lengthOf(collapsibles, 20);
			assert.isFalse(createSensorPage.called);
			assert.lengthOf(page.find(".sensor-current-value-text"), 20);

			collapsibles.eq(0).collapsible("expand");
			assert.isTrue(createSensorPage.calledOnceWith(sinon.match.any, 1, controller.sensor_desc));
			assert.isTrue(editors[0].update.calledOnceWith(controller.sensors.sn[0]));

			collapsibles.eq(0).collapsible("collapse").collapsible("expand");
			assert.isTrue(createSensorPage.calledOnce);

			collapsibles.eq(1).collapsible("expand");
			assert.equal(createSensorPage.callCount, 2);
			assert.equal(createSensorPage.secondCall.args[1], 2);
		} finally {
			$("#sensors").trigger("pagehide").remove();
			createSensorPage.restore();
			changeHeader.restore();
			loading.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should lazily build the homepage-selected sensor before auto-expanding it", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var createSensorPage = sinon.stub(OSApp.Sensors, "createSensorPage").returns({
			update: sinon.spy(),
			getURL: sinon.stub().returns("/csn?pw=")
		});

		try {
			controller.sensor_desc = sensorEditorData();
			controller.sensors = { sn: [
				{ uuid: 7, name: "First", flag: 1, extra: {} },
				{ uuid: 8, name: "Selected", flag: 1, extra: {} }
			] };

			OSApp.Sensors.displayPage(8);
			var page = $("#sensors");
			var selected = page.find("[data-uuid='8']");

			assert.isTrue(createSensorPage.calledOnce);
			assert.equal(createSensorPage.firstCall.args[1], 8);
			assert.isFalse(selected.hasClass("ui-collapsible-collapsed"));
			assert.isFalse(page.find("[data-uuid='7']").data("sensor-editor-built") === true);
		} finally {
			$("#sensors").trigger("pagehide").remove();
			createSensorPage.restore();
			changeHeader.restore();
			loading.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should clear a stale Edit Sensors reading when its refreshed value is unavailable", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");

		try {
			controller.sensor_desc = sensorEditorData();
			controller.sensors = { sn: [ {
				uuid: 7,
				name: "Available",
				interval: 60,
				min: 0,
				max: 100,
				unit: 0,
				value: 42,
				status: OSApp.Sensors.STATUS.VALID,
				flag: 1,
				extra: {}
			} ] };

			OSApp.Sensors.displayPage();
			var value = $("#sensors .sensor-current-value-text");
			assert.equal(value.text(), "42");
			assert.isTrue(value.hasClass("sensor-value-valid"));

			controller.sensors.sn[0].value = null;
			$("html").trigger("datarefresh");

			assert.equal(value.text(), "—");
			assert.isFalse(value.hasClass("sensor-value-valid"));
			assert.isFalse(value.hasClass("sensor-value-warning"));
			assert.isFalse(value.hasClass("sensor-value-clamped"));
		} finally {
			$("#sensors").trigger("pagehide").remove();
			changeHeader.restore();
			loading.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should request one day of binary sensor logs initially", function () {
		assert.equal(
			OSApp.Sensors.getChartLogURL("1d", 1700000000),
			"/jsl?pw=&fmt=binary&after=1699913600&count=max"
		);
	});

	it("should paginate all logs by physical cursor and continue through empty pages", function () {
		var firstPage = sensorLogBuffer();
		var progress = [];
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS");
		sendToOS.onFirstCall().returns($.Deferred().resolve(
			pagedLogResponse(firstPage, 5000, 10000, false)
		).promise());
		sendToOS.onSecondCall().returns($.Deferred().resolve(
			pagedLogResponse(sensorLogBuffer(0), 10000, 10000, true)
		).promise());

		return new Promise(function (resolve, reject) {
			OSApp.Sensors.fetchAllLogPages({
				onProgress: function (value) { progress.push(value); }
			}).done(function (buffer) {
				try {
					assert.equal(buffer.byteLength, firstPage.byteLength);
					assert.deepEqual(progress, [ 0.5, 1 ]);
					assert.equal(
						sendToOS.firstCall.args[0],
						"/jsl?pw=&page=1&cursor=0&count=5000&fmt=binary"
					);
					assert.equal(
						sendToOS.secondCall.args[0],
						"/jsl?pw=&page=1&cursor=5000&count=5000&fmt=binary"
					);
					assert.equal(sendToOS.firstCall.args[1], "arraybuffer-response");
					assert.equal(sendToOS.secondCall.args[1], "arraybuffer-response");
					resolve();
				} catch (error) {
					reject(error);
				}
			}).fail(reject);
		}).finally(function () { sendToOS.restore(); });
	});

	it("should paginate a fixed sensor-log time window using window progress", function () {
		var firstPage = sensorLogBuffer();
		var progress = [];
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS");
		sendToOS.onFirstCall().returns($.Deferred().resolve(
			pagedLogResponse(firstPage, 6000, 20000, false, 5000, 10000)
		).promise());
		sendToOS.onSecondCall().returns($.Deferred().resolve(
			pagedLogResponse(sensorLogBuffer(0), 10000, 20000, true, 5000, 10000)
		).promise());

		return new Promise(function (resolve, reject) {
			OSApp.Sensors.fetchAllLogPages({
				after: 1699395200,
				before: 1700000000,
				onProgress: function (value, processed, total) {
					progress.push([ value, processed, total ]);
				}
			}).done(function (buffer) {
				try {
					assert.equal(buffer.byteLength, firstPage.byteLength);
					assert.deepEqual(progress, [ [ 0.2, 1000, 5000 ], [ 1, 5000, 5000 ] ]);
					assert.equal(sendToOS.firstCall.args[0],
						"/jsl?pw=&page=1&after=1699395200&before=1700000000&cursor=0&count=5000&fmt=binary");
					assert.equal(sendToOS.secondCall.args[0],
						"/jsl?pw=&page=1&after=1699395200&before=1700000000&cursor=6000&count=5000&fmt=binary");
					resolve();
				} catch (error) {
					reject(error);
				}
			}).fail(reject);
		}).finally(function () { sendToOS.restore(); });
	});

	it("should retry a transient sensor-log page failure at the same cursor", function () {
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS");
		sendToOS.onFirstCall().returns($.Deferred().reject({ status: 0, statusText: "timeout" }).promise());
		sendToOS.onSecondCall().returns($.Deferred().resolve(
			pagedLogResponse(sensorLogBuffer(), 5000, 5000, true)
		).promise());

		return new Promise(function (resolve, reject) {
			OSApp.Sensors.fetchAllLogPages()
				.done(function () {
					try {
						assert.equal(sendToOS.callCount, 2);
						assert.equal(sendToOS.firstCall.args[0], sendToOS.secondCall.args[0]);
						resolve();
					} catch (error) {
						reject(error);
					}
				})
				.fail(reject);
		}).finally(function () { sendToOS.restore(); });
	});

	it("should use larger sensor-log pages on OSPi and Linux controllers", function () {
		var isOSPi = sinon.stub(OSApp.Firmware, "isOSPi");
		var getHWVersion = sinon.stub(OSApp.Firmware, "getHWVersion");

		try {
			isOSPi.returns(true);
			getHWVersion.returns("OSPi");
			assert.equal(OSApp.Sensors.getLogPageSize(), 100000);

			isOSPi.returns(false);
			getHWVersion.returns("Linux");
			assert.equal(OSApp.Sensors.getLogPageSize(), 100000);

			getHWVersion.returns("Demo");
			assert.equal(OSApp.Sensors.getLogPageSize(), 100000);

			getHWVersion.returns("3.3");
			assert.equal(OSApp.Sensors.getLogPageSize(), 5000);
		} finally {
			getHWVersion.restore();
			isOSPi.restore();
		}
	});

	it("should reject pagination metadata that cannot advance", function () {
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().resolve(
			pagedLogResponse(sensorLogBuffer(0), 0, 10, false)
		).promise());

		return new Promise(function (resolve, reject) {
			OSApp.Sensors.fetchAllLogPages()
				.done(function () { reject(new Error("Invalid pagination metadata was accepted")); })
				.fail(function (error) {
					try {
						assert.deepEqual(error, { status: 0, statusText: "parsererror" });
						assert.isTrue(sendToOS.calledOnce);
						resolve();
					} catch (assertionError) {
						reject(assertionError);
					}
				});
		}).finally(function () { sendToOS.restore(); });
	});

	it("should delete one sensor's logs using returned physical cursors", function () {
		var progress = [];
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS");
		sendToOS.onFirstCall().returns($.Deferred().resolve({
			result: 1, next: 819, total: 20000, deleted: 0, done: 0
		}).promise());
		sendToOS.onSecondCall().returns($.Deferred().resolve({
			result: 1, next: 17203, total: 21000, deleted: 5, done: 0
		}).promise());
		sendToOS.onThirdCall().returns($.Deferred().resolve({
			result: 1, next: 20000, total: 21000, deleted: 2, done: 0
		}).promise());

		return new Promise(function (resolve, reject) {
			OSApp.Sensors.deleteLogPages(42, {
				onProgress: function (value) { progress.push(value); }
			}).done(function (result) {
				try {
					assert.deepEqual(result, { deleted: 7, stopped: false });
					assert.equal(sendToOS.firstCall.args[0],
						"/dsl?pw=&uuid=42&page=1&cursor=0&count=16384");
					assert.equal(sendToOS.secondCall.args[0],
						"/dsl?pw=&uuid=42&page=1&cursor=819&count=16384");
					assert.equal(sendToOS.thirdCall.args[0],
						"/dsl?pw=&uuid=42&page=1&cursor=17203&count=2797");
					assert.equal(sendToOS.firstCall.args[1], "json");
					assert.deepEqual(progress.map(function (item) { return item.deleted; }), [ 0, 5, 7 ]);
					assert.deepEqual(progress.map(function (item) { return item.total; }), [ 20000, 20000, 20000 ]);
					assert.equal(progress[2].percent, 100);
					resolve();
				} catch (error) {
					reject(error);
				}
			}).fail(reject);
		}).finally(function () { sendToOS.restore(); });
	});

	it("should reject sensor log deletion when the returned cursor stalls", function () {
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().resolve({
			result: 1, next: 0, total: 10, deleted: 0, done: 0
		}).promise());

		return new Promise(function (resolve, reject) {
			OSApp.Sensors.deleteLogPages(42)
				.done(function () { reject(new Error("A stalled deletion cursor was accepted")); })
				.fail(function (error) {
					try {
						assert.equal(error.statusText, "stalled");
						assert.isTrue(sendToOS.calledOnce);
						resolve();
					} catch (assertionError) {
						reject(assertionError);
					}
				});
		}).finally(function () { sendToOS.restore(); });
	});

	it("should stop sensor log deletion after the current page", function () {
		var stopRequested = false;
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().resolve({
			result: 1, next: 819, total: 20000, deleted: 3, done: 0
		}).promise());

		return new Promise(function (resolve, reject) {
			OSApp.Sensors.deleteLogPages(42, {
				shouldStop: function () { return stopRequested; },
				onProgress: function () { stopRequested = true; }
			}).done(function (result) {
				try {
					assert.deepEqual(result, { deleted: 3, stopped: true });
					assert.isTrue(sendToOS.calledOnce);
					resolve();
				} catch (error) {
					reject(error);
				}
			}).fail(reject);
		}).finally(function () { sendToOS.restore(); });
	});

	it("should preserve the empty-log marker without requiring pagination headers", function () {
		var emptyLog = new ArrayBuffer(0);
		emptyLog.noLogHeader = true;
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").returns(
			$.Deferred().resolve({ data: emptyLog, headers: { get: function () { return null; } } }).promise()
		);

		return new Promise(function (resolve, reject) {
			OSApp.Sensors.fetchAllLogPages()
				.done(function (buffer) {
					try {
						assert.strictEqual(buffer, emptyLog);
						assert.isTrue(buffer.noLogHeader);
						assert.isTrue(sendToOS.calledOnce);
						resolve();
					} catch (error) {
						reject(error);
					}
				})
				.fail(reject);
		}).finally(function () { sendToOS.restore(); });
	});

	it("should filter raw sensor log downloads to the selected chart range", function () {
		var points = [
			{ x: 1699300000000, y: 10 },
			{ x: 1699950000000, y: 20 },
			{ x: 1699995000000, y: 30 }
		];

		assert.deepEqual(
			OSApp.Sensors.filterLogPointsByRange(points, "3h", 1700000000),
			[ points[2] ]
		);
		assert.deepEqual(
			OSApp.Sensors.filterLogPointsByRange(points, "1d", 1700000000),
			[ points[1], points[2] ]
		);
		assert.strictEqual(OSApp.Sensors.filterLogPointsByRange(points, "all", 1700000000), points);
	});

	it("should fetch wider chart ranges on demand and cache the largest range", function () {
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
		// The chart window must follow controller time even when the client clock differs.
		var now = sinon.stub(Date, "now").returns(1800000000 * 1000);
		var allRecords = sensorLogBuffer(20001);
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").callsFake(function (url, type) {
			var response = allRecords;
			if (type === "arraybuffer-response") {
				response = url.indexOf("after=") === -1
					? pagedLogResponse(allRecords, 20001, 20001, true)
					: pagedLogResponse(allRecords, 20001, 20001, true, 0, 20001);
			}
			return $.Deferred().resolve(response).promise();
		});
		var page;

		try {
			controller.settings.devt = 1700000000;
			controller.sensors = { sn: [ { uuid: 7, name: "Soil", unit: 1 } ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };
			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");

			assert.isTrue(sendToOS.firstCall.calledWith(
				"/jsl?pw=&fmt=binary&after=1699913600&count=max",
				"arraybuffer"
			));
			assert.lengthOf(page.find('input[value="3H"], input[value="1D"], input[value="1W"], input[value="All"]'), 4);
			assert.lengthOf(page.find('input[value="1M"]'), 0);
			assert.lengthOf(page.find('input[value="Download"]'), 1);
			assert.lengthOf(page.find(".sensor-log-control-group"), 2);
			assert.lengthOf(page.find(".sensor-log-range-controls .sensor-log-range-btn"), 4);
			assert.lengthOf(page.find(".sensor-log-action-controls input"), 2);
			assert.lengthOf(page.find(".sensor-log-card .sensor-log-range-btn"), 0);
			assert.equal(page.find(".sensor-log-range-btn[data-range='1d']").attr("aria-pressed"), "true");
			assert.isTrue(page.find(".sensor-log-range-btn[data-range='1d']").closest(".ui-btn").hasClass("sensor-log-range-selected"));

			page.find('input[value="3H"]').trigger("click");
			assert.equal(sendToOS.callCount, 1);
			assert.equal(page.find(".sensor-log-range-btn[data-range='3h']").attr("aria-pressed"), "true");
			assert.equal(page.find(".sensor-log-range-btn[data-range='1d']").attr("aria-pressed"), "false");

			page.find('input[value="1W"]').trigger("click");
			assert.isTrue(sendToOS.secondCall.calledWith(
				"/jsl?pw=&page=1&after=1699395200&before=1700000000&cursor=0&count=5000&fmt=binary",
				"arraybuffer-response"
			));

			page.find('input[value="1D"]').trigger("click");
			assert.equal(sendToOS.callCount, 2);

			page.find('input[value="All"]').trigger("click");
			assert.isTrue(sendToOS.getCall(2).calledWith(
				"/jsl?pw=&page=1&cursor=0&count=5000&fmt=binary",
				"arraybuffer-response"
			));
			assert.lengthOf(chart.data.datasets[0].data, 20001);
		} finally {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			now.restore();
			controller.settings.devt = originalDevt;
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should apply the global range to every sensor chart", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var originalDevt = controller.settings.devt;
		var charts = [];
		var chartConfigs = [];
		var chartConstructor = sinon.stub(window, "Chart").callsFake(function (_canvas, config) {
			var chart = { data: {}, destroy: sinon.spy(), resetZoom: sinon.spy(), update: sinon.spy() };
			charts.push(chart);
			chartConfigs.push(config);
			return chart;
		});
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve(sensorLogBuffer(
				4,
				[ 7, 8 ],
				[ 1700000002, 1700000002, 1700000000, 1700000000 ]
			)).promise());
		var page;

		try {
			controller.settings.devt = 1700000000;
			controller.sensors = { sn: [
				{ uuid: 7, name: "Soil", unit: 1 },
				{ uuid: 8, name: "Temperature", unit: 2 }
			] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" }, { value: 2, short: "C" } ] };

			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");
			assert.lengthOf(charts, 2);
			assert.isTrue(charts[0].update.calledOnce);
			assert.isTrue(charts[1].update.calledOnce);
			assert.isFalse(chartConfigs[0].options.parsing);
			assert.deepEqual(chartConfigs[0].options.plugins.decimation, {
				enabled: true,
				algorithm: "min-max",
				threshold: 2000
			});
			assert.deepEqual(
				charts[0].data.datasets[0].data.map(function (point) { return point.x; }),
				[ 1700000000000, 1700000002000 ]
			);

			assert.lengthOf(page.find(".sensor-log-card .sensor-log-range-btn"), 0);
			assert.deepEqual(
				page.find(".sensor-log-card").first().find(".sensor-chart-controls input").map(function () {
					return $(this).val();
				}).get(),
				[ "Reset Zoom", "Download", "Delete" ]
			);

			page.find(".sensor-log-range-btn[data-range='3h']").trigger("click");

			assert.isTrue(charts[0].update.calledTwice);
			assert.isTrue(charts[1].update.calledTwice);
			assert.isTrue(sendToOS.calledOnce);
			assert.equal(page.find(".sensor-log-range-btn[data-range='3h']").attr("aria-pressed"), "true");
			assert.isTrue(page.find(".sensor-log-range-btn[data-range='3h']").closest(".ui-btn").hasClass("sensor-log-range-selected"));
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

	it("should cancel a wider pending request when the global range changes", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var originalDevt = controller.settings.devt;
		var allRequest = $.Deferred();
		var charts = [];
		var chartConstructor = sinon.stub(window, "Chart").callsFake(function () {
			var chart = { data: {}, destroy: sinon.spy(), resetZoom: sinon.spy(), update: sinon.spy() };
			charts.push(chart);
			return chart;
		});
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var now = sinon.stub(Date, "now").returns(1700000000 * 1000);
		var records = sensorLogBuffer(
			4,
			[ 7, 8 ],
			[ 1699300000, 1699300000, 1699995000, 1699995000 ]
		);
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS");
		var page;

		try {
			controller.settings.devt = 1700000000;
			controller.sensors = { sn: [
				{ uuid: 7, name: "Soil", unit: 1 },
				{ uuid: 8, name: "Temperature", unit: 2 }
			] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" }, { value: 2, short: "C" } ] };
			sendToOS.onFirstCall().returns($.Deferred().resolve(records).promise());
			sendToOS.onSecondCall().returns(allRequest.promise());
			sendToOS.onThirdCall().returns($.Deferred().resolve(
				pagedLogResponse(records, 4, 4, true, 0, 4)
			).promise());

			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");
			loading.resetHistory();
			page.find(".sensor-log-range-btn[data-range='all']").trigger("click");

			assert.isFalse(loading.calledWith("show"));
			assert.isFalse(page.find(".sensor-log-progress").prop("hidden"));
			assert.equal(page.find(".sensor-log-progress-label").text(), "Loading log data: 0 (0%)");
			var allSignal = sendToOS.secondCall.args[2].signal;
			assert.isFalse(allSignal.aborted);

			page.find(".sensor-log-range-btn[data-range='1w']").trigger("click");

			assert.isTrue(allSignal.aborted);
			assert.equal(sendToOS.callCount, 3);
			assert.equal(sendToOS.thirdCall.args[0],
				"/jsl?pw=&page=1&after=1699395200&before=1700000000&cursor=0&count=5000&fmt=binary");
			allRequest.resolve(pagedLogResponse(records, 4, 4, true));

			assert.lengthOf(charts, 4);
			assert.lengthOf(charts[2].data.datasets[0].data, 1);
			assert.lengthOf(charts[3].data.datasets[0].data, 1);
			assert.isTrue(page.find(".sensor-log-progress").prop("hidden"));
		} finally {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			now.restore();
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

	it("should allow a wider range when the initial day has no readings", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var originalDevt = controller.settings.devt;
		var chart = { data: {}, destroy: sinon.spy(), resetZoom: sinon.spy(), update: sinon.spy() };
		var chartConstructor = sinon.stub(window, "Chart").returns(chart);
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var now = sinon.stub(Date, "now").returns(1700000000 * 1000);
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS");
		var page;

		try {
			controller.settings.devt = 1700000000;
			controller.sensors = { sn: [ { uuid: 7, name: "Soil", unit: 1 } ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };
			sendToOS.onFirstCall().returns($.Deferred().resolve(sensorLogBuffer(0)).promise());
			sendToOS.onSecondCall().returns($.Deferred().resolve(
				pagedLogResponse(sensorLogBuffer(), 1, 1, true, 0, 1)
			).promise());

			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");
			assert.include(page.find(".sensor-log-empty").text(), "No sensor data in the selected time range");
			assert.lengthOf(page.find(".sensor-log-empty-range-controls"), 0);
			assert.equal(page.find(".sensor-log-range-btn[data-range='1d']").attr("aria-pressed"), "true");

			page.find(".sensor-log-range-btn[data-range='1w']").trigger("click");
			assert.isTrue(sendToOS.secondCall.calledWith(
				"/jsl?pw=&page=1&after=1699395200&before=1700000000&cursor=0&count=5000&fmt=binary",
				"arraybuffer-response"
			));
			assert.isTrue(chartConstructor.calledOnce);
			assert.equal(page.find(".sensor-log-range-btn[data-range='1w']").attr("aria-pressed"), "true");
		} finally {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			now.restore();
			controller.settings.devt = originalDevt;
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should build the full CSV from paginated binary data and restore the Download All UI", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var csvRequest = $.Deferred();
		var downloadedBlob;
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
		var createObjectURL = sinon.stub(URL, "createObjectURL").callsFake(function (blob) {
			downloadedBlob = blob;
			return "blob:sensor-log-download";
		});
		var revokeObjectURL = sinon.stub(URL, "revokeObjectURL");
		var anchorClick = sinon.stub(HTMLAnchorElement.prototype, "click");
		var areYouSure = sinon.stub(OSApp.UIDom, "areYouSure").callsFake(function (_t1, _t2, success) {
			if (success) success();
		});
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").callsFake(function (_url, type) {
			return type === "arraybuffer-response"
				? csvRequest.promise()
				: $.Deferred().resolve(sensorLogBuffer()).promise();
		});
		var page;

		function cleanup() {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			areYouSure.restore();
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
				"/jsl?pw=&page=1&cursor=0&count=5000&fmt=binary",
				"arraybuffer-response"
			));
			assert.isTrue(downloadButton.prop("disabled"));
			assert.isFalse(loading.called);
			assert.isFalse(page.find(".sensor-log-progress").prop("hidden"));
			assert.equal(page.find(".sensor-log-progress-label").text(), "Loading log data: 0 (0%)");

			csvRequest.resolve(pagedLogResponse(sensorLogBuffer(), 1, 1, true));
			return new Promise(function (resolve) { setTimeout(resolve, 0); }).then(function () {
				assert.isTrue(createObjectURL.calledOnce);
				assert.instanceOf(downloadedBlob, Blob);
				assert.isTrue(anchorClick.calledOnce);
				var link = anchorClick.firstCall.thisValue;
				assert.equal(link.href, "blob:sensor-log-download");
			assert.match(link.download, /^sensorlog-\d{4}-\d{2}-\d{2}\.csv$/);
			assert.isFalse(document.body.contains(link));
			assert.isTrue(revokeObjectURL.calledOnceWithExactly("blob:sensor-log-download"));
			assert.isFalse(loading.called);
				assert.isTrue(page.find(".sensor-log-progress").prop("hidden"));
				assert.isFalse(downloadButton.prop("disabled"));
				assert.isFalse(showError.called);
				return downloadedBlob.text();
			}).then(function (csv) {
				assert.equal(
					csv,
					"sensor_uuid,sensor_name,timestamp,value,unit\r\n" +
					"7,\"Soil\",1700000000,42,\"%\"\r\n"
				);
			}).finally(cleanup);
		} catch (error) {
			cleanup();
			throw error;
		}
	});

	it("should confirm before downloading all sensor logs", function () {
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
		var confirmArgs = null;
		var areYouSure = sinon.stub(OSApp.UIDom, "areYouSure").callsFake(function (t1, t2, success) {
			confirmArgs = { title: t1, detail: t2, success: success };
		});
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").callsFake(function (_url, type) {
			return type === "arraybuffer-response"
				? $.Deferred().promise()
				: $.Deferred().resolve(sensorLogBuffer()).promise();
		});
		var page;

		function cleanup() {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			areYouSure.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}

		function pageCalls() {
			return sendToOS.getCalls().filter(function (call) { return call.args[1] === "arraybuffer-response"; });
		}

		try {
			controller.sensors = { sn: [ { uuid: 7, name: "Soil", unit: 1 } ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };
			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");

			page.find("input.sensor-log-download-btn").trigger("click");

			// The confirmation must be shown, and no CSV export may start yet.
			assert.isTrue(areYouSure.calledOnce);
			assert.equal(confirmArgs.title, "Are you sure you want to download all log data?");
			assert.include(confirmArgs.detail, "sensor-log-warning-label");
			assert.include(confirmArgs.detail, ">Warning</span>:");
			assert.include(confirmArgs.detail, "This action can take a while");
			assert.lengthOf(pageCalls(), 0);

			// Confirming triggers the export.
			confirmArgs.success();
			assert.lengthOf(pageCalls(), 1);
			assert.equal(pageCalls()[0].args[0], "/jsl?pw=&page=1&cursor=0&count=5000&fmt=binary");
			cleanup();
		} catch (error) {
			cleanup();
			throw error;
		}
	});

	it("should show progress while deleting one sensor's logs and refresh afterward", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var firstDeletePage = $.Deferred();
		var secondDeletePage = $.Deferred();
		var thirdDeletePage = $.Deferred();
		var confirmation;
		var fakeNow = 0;
		var chart = { data: {}, destroy: sinon.spy(), resetZoom: sinon.spy(), update: sinon.spy() };
		var chartConstructor = sinon.stub(window, "Chart").returns(chart);
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var areYouSure = sinon.stub(OSApp.UIDom, "areYouSure").callsFake(function (t1, t2, success) {
			confirmation = { title: t1, detail: t2 };
			if (success) success();
		});
		var now = sinon.stub(Date, "now");
		now.callsFake(function () { return fakeNow; });
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS");
		var page;

		function cleanup() {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			areYouSure.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			now.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}

		try {
			controller.sensors = { sn: [ { uuid: 7, name: "Soil", unit: 1 } ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };
			sendToOS.onFirstCall().returns($.Deferred().resolve(sensorLogBuffer()).promise());
			sendToOS.onSecondCall().returns(firstDeletePage.promise());
			sendToOS.onThirdCall().returns(secondDeletePage.promise());
			sendToOS.onCall(3).returns(thirdDeletePage.promise());
			sendToOS.onCall(4).returns($.Deferred().resolve(sensorLogBuffer(0)).promise());

			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");
			loading.resetHistory();
			page.find(".sensor-log-delete-btn input").trigger("click");

			assert.equal(sendToOS.secondCall.args[0],
				"/dsl?pw=&uuid=7&page=1&cursor=0&count=16384");
			assert.equal(confirmation.title, "Delete the entire log of Soil?");
			assert.include(confirmation.detail, "sensor-log-warning-label");
			assert.include(confirmation.detail, ">Warning</span>:");
			assert.include(confirmation.detail, "This may take several minutes");
			assert.isFalse(page.find(".sensor-log-progress").prop("hidden"));
			assert.equal(window.getComputedStyle(page.find(".sensor-log-progress")[0]).position, "fixed");
			assert.include(page.find(".sensor-log-progress-label").text(), "Deleting sensor log");
			assert.isFalse(page.find(".sensor-log-stop-btn").prop("hidden"));
			assert.isTrue(page.find(".sensor-log-delete-btn input").prop("disabled"));
			assert.isFalse(loading.calledWith("show"));

			fakeNow = 6000;
			firstDeletePage.resolve({ result: 1, next: 819, total: 40950, deleted: 4, done: 0 });
			return new Promise(function (resolve) { setTimeout(resolve, 0); }).then(function () {
				assert.equal(sendToOS.thirdCall.args[0],
					"/dsl?pw=&uuid=7&page=1&cursor=819&count=16384");
				fakeNow = 12000;
				secondDeletePage.resolve({ result: 1, next: 1638, total: 40950, deleted: 1, done: 0 });
				return new Promise(function (resolve) { setTimeout(resolve, 0); });
			}).then(function () {
				assert.include(page.find(".sensor-log-progress-estimate").text(), "About 5 minutes remaining");
				assert.equal(sendToOS.getCall(3).args[0],
					"/dsl?pw=&uuid=7&page=1&cursor=1638&count=16384");
				thirdDeletePage.resolve({ result: 1, next: 40950, total: 40950, deleted: 1, done: 1 });
				return new Promise(function (resolve) { setTimeout(resolve, 0); });
			}).then(function () {
				assert.match(sendToOS.getCall(4).args[0],
					/^\/jsl\?pw=&fmt=binary&after=\d+&count=max$/);
				assert.equal(sendToOS.getCall(4).args[1], "arraybuffer");
				assert.isTrue(page.find(".sensor-log-progress").prop("hidden"));
				assert.isFalse(page.find("input.sensor-log-delete-all-btn").prop("disabled"));
			}).finally(cleanup);
		} catch (error) {
			cleanup();
			throw error;
		}
	});

	it("should abort a paginated sensor-log deletion when leaving the page", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var deletionRequest = $.Deferred();
		var chart = { data: {}, destroy: sinon.spy(), resetZoom: sinon.spy(), update: sinon.spy() };
		var chartConstructor = sinon.stub(window, "Chart").returns(chart);
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var areYouSure = sinon.stub(OSApp.UIDom, "areYouSure").callsFake(function (_t1, _t2, success) {
			if (success) success();
		});
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS");
		var page;

		try {
			controller.sensors = { sn: [ { uuid: 7, name: "Soil", unit: 1 } ] };
			controller.sensor_desc = { units: [ { value: 1, short: "%" } ] };
			sendToOS.onFirstCall().returns($.Deferred().resolve(sensorLogBuffer()).promise());
			sendToOS.onSecondCall().returns(deletionRequest.promise());

			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");
			page.find(".sensor-log-delete-btn input").trigger("click");
			var signal = sendToOS.secondCall.args[2].signal;
			assert.isFalse(signal.aborted);
			page.find(".sensor-log-stop-btn").trigger("click");
			assert.isFalse(signal.aborted);
			assert.isTrue(page.find(".sensor-log-stop-btn").prop("disabled"));
			assert.equal(page.find(".sensor-log-stop-btn").text(), "Stopping");
			assert.include(page.find(".sensor-log-progress-estimate").text(), "Stopping after the current page");

			page.trigger("pagehide");
			assert.isTrue(signal.aborted);
		} finally {
			if (page) page.remove();
			sendToOS.restore();
			areYouSure.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
		}
	});

	it("should keep Delete All on the non-paginated endpoint", function () {
		var controller = OSApp.currentSession.controller;
		var originalSensors = controller.sensors;
		var originalDescription = controller.sensor_desc;
		var chartConstructor = sinon.stub(window, "Chart");
		var loading = sinon.stub($.mobile, "loading");
		var changeHeader = sinon.stub(OSApp.UIDom, "changeHeader");
		var areYouSure = sinon.stub(OSApp.UIDom, "areYouSure").callsFake(function (_t1, _t2, success) {
			if (success) success();
		});
		var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve(sensorLogBuffer(0)).promise());
		var page;

		try {
			controller.sensors = { sn: [] };
			controller.sensor_desc = { units: [] };
			OSApp.Sensors.displayLogs();
			page = $("#sensor-logs");
			page.find("input.sensor-log-delete-all-btn").trigger("click");

			assert.equal(sendToOS.secondCall.args[0], "/dsl?pw=&uuid=-1");
			assert.notInclude(sendToOS.secondCall.args[0], "page=1");
			assert.match(sendToOS.thirdCall.args[0],
				/^\/jsl\?pw=&fmt=binary&after=\d+&count=max$/);
			assert.equal(sendToOS.thirdCall.args[1], "arraybuffer");
		} finally {
			if (page) page.trigger("pagehide").remove();
			sendToOS.restore();
			areYouSure.restore();
			changeHeader.restore();
			loading.restore();
			chartConstructor.restore();
			controller.sensors = originalSensors;
			controller.sensor_desc = originalDescription;
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
		assert.equal(
			OSApp.Sensors.formatLogCsvRow(7, "Soil", 1700000000123, 42, "%"),
			'7,"Soil",1700000000,42,"%"'
		);
	});
});

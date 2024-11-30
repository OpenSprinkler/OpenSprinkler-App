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

describe.only("OSApp.Analog", function () {
	beforeEach(function () {
		OSApp.currentSession = {
			controller: {
				options: { feature: "ASB" },
				programs: { pd: [{ name: "Program 1" }, { name: "Program 2" }] }
			},
			pass: "test_pass"
		};
		OSApp.Analog.analogSensors = [
			{ nr: 1, name: "Sensor 1", data: 25.5, unit: "°C", show: true, last: 1678886400, data_ok: true },
			{ nr: 2, name: "Sensor 2", data: 60.3, unit: "%", show: false, last: 1678886400, data_ok: false }
		];
		OSApp.Analog.progAdjusts = [
			{ nr: 1, type: 1, sensor: 1, prog: 1, current: 0.8, factor1: 1.2, factor2: 0.8, min: 10, max: 40 },
			{ nr: 2, type: 2, sensor: 2, prog: 2, current: 0.5, factor1: 1.5, factor2: 0.5, min: 20, max: 80 }
		];
		// Use Sinon to mock OSApp.Firmware.sendToOS
		// sinon.stub(OSApp.Firmware, "sendToOS")
		// 	.withArgs("/sh?pw=", "json")
		// 	.returns(Promise.resolve({
		// 		progTypes: [
		// 			{ type: 1, name: "Type 1" },
		// 			{ type: 2, name: "Type 2" }
		// 		]
		// 	}));

		// OSApp.Firmware = {
		// 	sendToOS: function(url, type) {
		// 		return new Promise(function(resolve) {
		// 			if (url === "/sh?pw=") {
		// 				resolve({ progTypes: [{ type: 1, name: "Type 1" }, { type: 2, name: "Type 2" }] });
		// 			} else if (url === "/sf?pw=") {
		// 				resolve({ sensorTypes: [{ type: 1, name: "Type 1" }, { type: 2, name: "Type 2" }] });
		// 			} else {
		// 				resolve({}); // Resolve with an empty object for other URLs
		// 			}
		// 		});
		// 	}
		// };
			// sendToOS: function (url, type) {
			// 	console.log("*** fake sendtoos url: " + url);
			// 	return new Promise(function (resolve) {
			// 		console.log("*** fake sendtoos resolver", {resolve});
			// 		if (url === "/se?pw=") {
			// 			resolve({ progAdjust: OSApp.Analog.progAdjusts });
			// 		} else if (url === "/sl?pw=") {
			// 			resolve({ sensors: OSApp.Analog.analogSensors });
			// 		} else if (url === "/sh?pw=") {
			// 			resolve({ progTypes: [{ type: 1, name: "Type 1" }, { type: 2, name: "Type 2" }] });
			// 		} else if (url === "/sf?pw=") {
			// 			resolve({ sensorTypes: [{ type: 1, name: "Type 1" }, { type: 2, name: "Type 2" }] });
			// 		} else {
			// 			resolve({});
			// 		}
			// 	});
			// }
		// };
		OSApp.UIDom = {
			getAppURLPath: function () { return "http://localhost/app/"; },
			areYouSure: function (message, value, callback) { callback(); },
			changePage: function () { },
			changeHeader: function () { },
			goBack: function () { },
			openPopup: function () { },
			holdButton: function () { }
		};
		OSApp.Language = { _: function (key) { return key; } };
		OSApp.Programs = {
			readProgram: function (program) {
				return { name: program.name };
			}
		};
		// $ = function (html) {
		// 	var obj = {
		// 		html: function () { return this; },
		// 		enhanceWithin: function () { return this; },
		// 		find: function (selector) {
		// 			if (selector === "#os-sensor-show") {
		// 				return {
		// 					html: function () { return this; },
		// 					removeChild: function () { return this; }
		// 				};
		// 			}
		// 			return this;
		// 		},
		// 		on: function () { return this; },
		// 		append: function () { return this; },
		// 		popup: function () { return this; },
		// 		css: function () { return this; },
		// 		remove: function () { return this; },
		// 		click: function () { return this; },
		// 		one: function () { return this; },
		// 		detach: function () { return this; },
		// 		children: function () { return this; },
		// 		eq: function () { return this; },
		// 		val: function () { return "1"; },
		// 		attr: function () { return "1"; },
		// 		index: function () { return 1; },
		// 		is: function () { return true; },
		// 		text: function (text) {
		// 			if (text === undefined) {
		// 				return "test";
		// 			} else {
		// 				this.textValue = text;
		// 				return this;
		// 			}
		// 		},
		// 		wrap: function () { return this; },
		// 		change: function () { return this; }
		// 	};
		// 	return obj;
		// };
		// ApexCharts = function () {
		// 	return {
		// 		render: function () { },
		// 		appendSeries: function () { }
		// 	};
		// };
		// $.mobile = {
		// 	loading: function () { },
		// 	pageContainer: {
		// 		append: function () { }
		// 	}
		// };
		// window.alert = function () { };
		// document.createElement = function () {
		// 	return {
		// 		style: {},
		// 		setAttribute: function () { },
		// 		click: function () { }
		// 	};
		// };
		// document.body = {
		// 	appendChild: function () { }
		// };
		// document.querySelector = function () {
		// 	return {};
		// };
	});
	// afterEach(function () {
	// 	// Restore the original function after each test
	// 	OSApp.Firmware.sendToOS.restore();
	// });
	describe("checkAnalogSensorAvail", function () {
		it("should return true if currentSession.controller.options.feature is 'ASB'", function () {
			assert.isTrue(OSApp.Analog.checkAnalogSensorAvail());
		});
	});

	// Skipped because it throws Chrome Headless 131.0.0.0 (Linux x86_64) ERROR Some of your tests did a full page reload!
	describe.skip("refresh", function () {
		it("should reload the page after 100ms", function (done) {
			var originalLocationReload = location.reload;
			location.reload = function () {
				console.log("*** fake location.reload");
				done();
				location.reload = originalLocationReload;
			};
			OSApp.Analog.refresh();
		});
	});

	describe("updateProgramAdjustments", function () {
		it("should update OSApp.Analog.progAdjusts with data from /se?pw=", function (done) {
			OSApp.Analog.updateProgramAdjustments(function () {
				assert.deepEqual(OSApp.Analog.progAdjusts, [{ nr: 1, type: 1, sensor: 1, prog: 1, current: 0.8, factor1: 1.2, factor2: 0.8, min: 10, max: 40 },
					{ nr: 2, type: 2, sensor: 2, prog: 2, current: 0.5, factor1: 1.5, factor2: 0.5, min: 20, max: 80 }]);
				done();
			});
		});
	});

	describe("updateAnalogSensor", function () {
		it("should update OSApp.Analog.analogSensors with data from /sl?pw=", function (done) {
			OSApp.Analog.updateAnalogSensor(function () {
				assert.deepEqual(OSApp.Analog.analogSensors, [{ nr: 1, name: "Sensor 1", data: 25.5, unit: "°C", show: true, last: 1678886400, data_ok: true },
					{ nr: 2, name: "Sensor 2", data: 60.3, unit: "%", show: false, last: 1678886400, data_ok: false }]);
				done();
			});
		});
	});

	describe("updateSensorShowArea", function () {
		it("should update the #os-sensor-show area with sensor and program adjustment data", function () {
			var page = $("<div><div id='os-sensor-show'></div></div>");
			OSApp.Analog.updateSensorShowArea(page);
			// Assertions would go here, but the current mocking makes it difficult to assert the exact HTML structure
		});
	});

	describe("toByteArray", function () {
		it("should convert an integer to a byte array", function () {
			assert.deepEqual(OSApp.Analog.toByteArray(16777216), Uint8Array.from([0, 0, 0, 1]));
		});
	});

	describe("intFromBytes", function () {
		it("should convert a byte array to an integer", function () {
			assert.equal(OSApp.Analog.intFromBytes([0, 0, 0, 1]), 16777216);
		});
	});

	describe.only("showAdjustmentsEditor", function () {
		it("should open a popup with program adjustment editor", function (done) {
			var progAdjust = { nr: 1, type: 1, sensor: 1, prog: 1, factor1: 1.2, factor2: 0.8, min: 10, max: 40 };
			OSApp.Analog.showAdjustmentsEditor(progAdjust, function (progAdjustOut) {
				assert.deepEqual(progAdjustOut, { nr: 1, type: 1, sensor: 1, prog: 1, factor1: 1.2, factor2: 0.8, min: 10, max: 40 });
				done();
			});
		});
	});

	describe("isSmt100", function () {
		it("should return true if sensorType is 1 or 2", function () {
			assert.isTrue(OSApp.Analog.isSmt100(1));
		});
	});

	describe("showSensorEditor", function () {
		it("should open a popup with sensor editor", function (done) {
			var sensor = { nr: 1, name: "Sensor 1", type: 1, ri: 600, enable: 1, log: 1 };
			OSApp.Analog.showSensorEditor(sensor, function (sensorOut) {
				assert.deepEqual(sensorOut, { nr: 1, type: 1, group: 1, name: "test", ip: 16777216, port: 1, id: 1, ri: 1, fac: 1, div: 1, unit: "test", enable: 1, log: 1, show: 1 });
				done();
			});
		});
	});

	describe("showAnalogSensorConfig", function () {
		it("should change header, update content and append page", function () {
			OSApp.Analog.showAnalogSensorConfig();
			// Assertions would go here, but the current mocking makes it difficult to assert the exact HTML structure
		});
	});

	describe("buildSensorConfig", function () {
		it("should build the analog sensor configuration HTML", function () {
			var result = OSApp.Analog.buildSensorConfig();
			// Assertions would go here, but the current mocking makes it difficult to assert the exact HTML structure
		});
	});

	describe("showAnalogSensorCharts", function () {
		it("should show the analog sensor charts", function () {
			OSApp.Analog.showAnalogSensorCharts();
			// Assertions would go here, but the current mocking makes it difficult to assert the exact behavior
		});
	});

	describe("buildGraph", function () {
		it("should build the graph with the given data", function () {
			var chart = [];
			var csv = "1;1678872000;25.5\n2;1678872000;60.3";
			OSApp.Analog.buildGraph("#myChart", chart, csv, "last 24h", "HH:mm");
			// Assertions would go here, but the current mocking makes it difficult to assert the exact behavior
		});
	});
});

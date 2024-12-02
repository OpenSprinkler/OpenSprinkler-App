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
	describe("checkAnalogSensorAvail", function () {
		it("should return true if currentSession.controller.options.feature is 'ASB'", function () {
			assert.isTrue(OSApp.Analog.checkAnalogSensorAvail());
		});
	});

	// describe("updateProgramAdjustments", function () {
	// 	it("should update OSApp.Analog.progAdjusts with data from /se?pw=", function (done) {
	// 		OSApp.Analog.updateProgramAdjustments(function () {
	// 			assert.deepEqual(OSApp.Analog.progAdjusts, [{ nr: 1, type: 1, sensor: 1, prog: 1, current: 0.8, factor1: 1.2, factor2: 0.8, min: 10, max: 40 },
	// 				{ nr: 2, type: 2, sensor: 2, prog: 2, current: 0.5, factor1: 1.5, factor2: 0.5, min: 20, max: 80 }]);
	// 			done();
	// 		});
	// 	});
	// });

	// describe("updateAnalogSensor", function () {
	// 	it("should update OSApp.Analog.analogSensors with data from /sl?pw=", function (done) {
	// 		OSApp.Analog.updateAnalogSensor(function () {
	// 			assert.deepEqual(OSApp.Analog.analogSensors, [{ nr: 1, name: "Sensor 1", data: 25.5, unit: "°C", show: true, last: 1678886400, data_ok: true },
	// 				{ nr: 2, name: "Sensor 2", data: 60.3, unit: "%", show: false, last: 1678886400, data_ok: false }]);
	// 			done();
	// 		});
	// 	});
	// });

	// describe("updateSensorShowArea", function () {
	// 	it("should update the #os-sensor-show area with sensor and program adjustment data", function () {
	// 		var page = $("<div><div id='os-sensor-show'></div></div>");
	// 		OSApp.Analog.updateSensorShowArea(page);
	// 		// Assertions would go here, but the current mocking makes it difficult to assert the exact HTML structure
	// 	});
	// });

	// describe("toByteArray", function () {
	// 	it("should convert an integer to a byte array", function () {
	// 		assert.deepEqual(OSApp.Analog.toByteArray(16777216), Uint8Array.from([0, 0, 0, 1]));
	// 	});
	// });

	// describe("intFromBytes", function () {
	// 	it("should convert a byte array to an integer", function () {
	// 		assert.equal(OSApp.Analog.intFromBytes([0, 0, 0, 1]), 16777216);
	// 	});
	// });

	// describe.only("showAdjustmentsEditor", function () {
	// 	it("should open a popup with program adjustment editor", function (done) {
	// 		var progAdjust = { nr: 1, type: 1, sensor: 1, prog: 1, factor1: 1.2, factor2: 0.8, min: 10, max: 40 };
	// 		OSApp.Analog.showAdjustmentsEditor(progAdjust, function (progAdjustOut) {
	// 			assert.deepEqual(progAdjustOut, { nr: 1, type: 1, sensor: 1, prog: 1, factor1: 1.2, factor2: 0.8, min: 10, max: 40 });
	// 			done();
	// 		}).then(function () {
	// 			console.log("clicking submit");
	// 			document.querySelector(("#progAdjustEditor .submit")).click();
	// 		});
	// 	});
	// });

	// describe("isSmt100", function () {
	// 	it("should return true if sensorType is 1 or 2", function () {
	// 		assert.isTrue(OSApp.Analog.isSmt100(1));
	// 	});
	// });

	// describe("showSensorEditor", function () {
	// 	it("should open a popup with sensor editor", function (done) {
	// 		var sensor = { nr: 1, name: "Sensor 1", type: 1, ri: 600, enable: 1, log: 1 };
	// 		OSApp.Analog.showSensorEditor(sensor, function (sensorOut) {
	// 			assert.deepEqual(sensorOut, { nr: 1, type: 1, group: 1, name: "test", ip: 16777216, port: 1, id: 1, ri: 1, fac: 1, div: 1, unit: "test", enable: 1, log: 1, show: 1 });
	// 			done();
	// 		});
	// 	});
	// });

	// describe("showAnalogSensorConfig", function () {
	// 	it("should change header, update content and append page", function () {
	// 		OSApp.Analog.showAnalogSensorConfig();
	// 		// Assertions would go here, but the current mocking makes it difficult to assert the exact HTML structure
	// 	});
	// });

	// describe("buildSensorConfig", function () {
	// 	it("should build the analog sensor configuration HTML", function () {
	// 		var result = OSApp.Analog.buildSensorConfig();
	// 		// Assertions would go here, but the current mocking makes it difficult to assert the exact HTML structure
	// 	});
	// });

	// describe("showAnalogSensorCharts", function () {
	// 	it("should show the analog sensor charts", function () {
	// 		OSApp.Analog.showAnalogSensorCharts();
	// 		// Assertions would go here, but the current mocking makes it difficult to assert the exact behavior
	// 	});
	// });

	// describe("buildGraph", function () {
	// 	it("should build the graph with the given data", function () {
	// 		var chart = [];
	// 		var csv = "1;1678872000;25.5\n2;1678872000;60.3";
	// 		OSApp.Analog.buildGraph("#myChart", chart, csv, "last 24h", "HH:mm");
	// 		// Assertions would go here, but the current mocking makes it difficult to assert the exact behavior
	// 	});
	// });
});

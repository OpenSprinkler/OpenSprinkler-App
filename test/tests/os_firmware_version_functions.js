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

describe("OpenSprinkler Firmware Version Functions", function () {

	describe("Test against Arduino Firmware Version", function () {
		before(function () {
			OSApp.currentSession.controller.options = {
				fwv: 210
			};
		});
		it("isOPSi() should identify if the device is an OSPi", function () {
			assert.equal(false, OSApp.Firmware.isOSPi());
		});
		it("versionCompare(device,compare) should check the given firmware (device) against the compare firmware where the input is an array", function () {
			assert.strictEqual(false, OSApp.Firmware.versionCompare([1], [1, 5]));
			assert.strictEqual(0, OSApp.Firmware.versionCompare([1, 5], [1, 5]));
			assert.strictEqual(1, OSApp.Firmware.versionCompare([2, 1], [1, 5]));
		});
		it("checkOSVersion(compare) should compare the input firmware version against the Arduino firmware version.", function () {
			assert.strictEqual(false, OSApp.Firmware.checkOSVersion(211));
			assert.strictEqual(true, OSApp.Firmware.checkOSVersion(210));
			assert.strictEqual(1, OSApp.Firmware.checkOSVersion(208));
		});
		it("checkOSPiVersion(compare) should compare the input firmware version against the OSPi firmware version.", function () {
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("2.0"));
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("1.9"));
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("2.1"));
		});
	});

	describe("Test against OSPi Firmware Version", function () {
		before(function () {
			OSApp.currentSession.controller.options = {
				fwv: "1.9.0-OSPi"
			};
		});
		it("isOPSi() should identify if the device is an OSPi", function () {
			assert.equal(true, OSApp.Firmware.isOSPi());
		});
		it("versionCompare(device,compare) should check the given firmware (device) against the compare firmware where the input is an array", function () {
			assert.strictEqual(false, OSApp.Firmware.versionCompare([1], [1, 5]));
			assert.strictEqual(0, OSApp.Firmware.versionCompare([1, 5], [1, 5]));
			assert.strictEqual(1, OSApp.Firmware.versionCompare([2, 1], [1, 5]));
		});
		it("checkOSVersion(compare) should compare the input firmware version against the Arduino firmware version.", function () {
			assert.strictEqual(false, OSApp.Firmware.checkOSVersion(211));
			assert.strictEqual(false, OSApp.Firmware.checkOSVersion(210));
			assert.strictEqual(false, OSApp.Firmware.checkOSVersion(208));
		});
		it("checkOSPiVersion(compare) should compare the input firmware version against the OSPi firmware version.", function () {
			assert.strictEqual(1, OSApp.Firmware.checkOSPiVersion("1.8"));
			assert.strictEqual(true, OSApp.Firmware.checkOSPiVersion("1.9.0"));
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("2.0"));
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("2.1"));
		});
	});

	describe("Retrieve the formatted firmware version", function () {
		before(function () {
			OSApp.currentSession.controller.options = {
				fwv: 204
			};
		});
		it("getOSVersion(fwv) should return the firmware in a string representation", function () {
			assert.equal("1.8.3-OSPi", OSApp.Firmware.getOSVersion("1.8.3-OSPi"));
			assert.equal("2.1.193-OSPi", OSApp.Firmware.getOSVersion("2.1.193-OSPi"));
			assert.equal("2.0.8", OSApp.Firmware.getOSVersion(208));
			assert.equal("2.0.4", OSApp.Firmware.getOSVersion());
		});
	});
});

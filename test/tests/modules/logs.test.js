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

/* global OSApp, assert, describe, it, beforeEach, afterEach */

describe('OSApp.Logs', function () {

	describe('clearLogs', function () {
		var originalAreYouSure, originalIsOSPi, originalSendToOS, originalShowError;

		beforeEach(function () {
			// Mock OSApp.UIDom.areYouSure
			originalAreYouSure = OSApp.UIDom.areYouSure;
			OSApp.UIDom.areYouSure = function (message, title, callback) {
				callback(); // Simulate confirming the action
			};

			// Mock OSApp.Firmware.isOSPi
			originalIsOSPi = OSApp.Firmware.isOSPi;
			OSApp.Firmware.isOSPi = function () {
				return false; // or true, depending on what you want to test
			};

			// Mock OSApp.Firmware.sendToOS
			originalSendToOS = OSApp.Firmware.sendToOS;
			OSApp.Firmware.sendToOS = function () {
				return {
					done: function (callback) {
						callback(); // Simulate successful sendToOS
						return this;
					}
				};
			};

			// Mock OSApp.Errors.showError
			originalShowError = OSApp.Errors.showError;
			OSApp.Errors.showError = function (message) { /* Mock implementation */ };
		});

		afterEach(function () {
			// Restore original functions
			OSApp.UIDom.areYouSure = originalAreYouSure;
			OSApp.Firmware.isOSPi = originalIsOSPi;
			OSApp.Firmware.sendToOS = originalSendToOS;
			OSApp.Errors.showError = originalShowError;
		});

		it('should clear logs when confirmed', function () {
			var callbackCalled = false;
			OSApp.Logs.clearLogs(function () {
				callbackCalled = true;
			});
			assert.isTrue(callbackCalled);
		});

		it('should use the correct URL for OSPi devices', function () {
			OSApp.Firmware.isOSPi = function () { return true; };
			var sentURL = null;
			OSApp.Firmware.sendToOS = function (url) {
				sentURL = url;
				return { done: function (callback) { callback(); return this; } };
			};
			OSApp.Logs.clearLogs();
			assert.equal(sentURL, '/cl?pw=');
		});

		it('should use the correct URL for non-OSPi devices', function () {
			OSApp.Firmware.isOSPi = function () { return false; };
			var sentURL = null;
			OSApp.Firmware.sendToOS = function (url) {
				sentURL = url;
				return { done: function (callback) { callback(); return this; } };
			};
			OSApp.Logs.clearLogs();
			assert.equal(sentURL, '/dl?pw=&day=all');
		});
	});

});

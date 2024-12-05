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

/* global OSApp, assert, beforeEach, afterEach, describe, it, $ */

describe('OSApp.Firmware', function () {
	var originalCurrentSession, originalAjax, originalJSON, originalStorage, originalNotifications, originalUIDom;

	beforeEach(function () {
		originalCurrentSession = OSApp.currentSession;
		originalAjax = $;
		originalJSON = $;
		originalStorage = OSApp.Storage;
		originalNotifications = OSApp.Notifications;
		originalUIDom = OSApp.UIDom;

		OSApp.currentSession = {
			pass: 'password',
			token: 'test-token',
			prefix: 'http://',
			ip: '192.168.1.100',
			auth: true,
			authUser: 'user',
			authPass: 'pass',
			fw183: false,
			controller: {
				options: {
					fwv: 300, // Example firmware version
					fwm: 1,   // Example minor firmware version
					hwv: 30,  // Example hardware version
					ext: 8,   // Example number of expanders
					dexp: 8  // Example number of detected expanders
				}
			}
		};

		$.ajaxq = function (queue, obj) {
			return $.Deferred().resolve({result: 1}); // Mock successful response
		};

		$.getJSON = function (url) {
			return $.Deferred().resolve([{tag_name: '3.0.0'}]); // Mock firmware version data
		};

		OSApp.Storage = {
			get: function (key, callback) {
				callback({updateDismiss: '2.9.9'}); // Mock storage data
			},
			set: function (data) { }
		};

		OSApp.Notifications = {
			addNotification: function (notification) { },
			removeNotification: function (button) { }
		};

		OSApp.UIDom = {
			openPopup: function (popup) { },
			changePage: function (page, options) { }
		};

		OSApp.Errors = {
			showError: function (message) { }
		};
	});

	afterEach(function () {
		OSApp.currentSession = originalCurrentSession;
		$ = originalAjax;
		$.getJSON = originalJSON;
		OSApp.Storage = originalStorage;
		OSApp.Notifications = originalNotifications;
		OSApp.UIDom = originalUIDom;
	});

	describe('sendToOS', function () {
		it('should send a command to the device', function () {
			var result = OSApp.Firmware.sendToOS('/cm?pw=');
			assert.equal(typeof result.then, 'function'); // Check if it returns a promise
		});
	});

	describe('checkOSVersion', function () {
		it('should check the OS version (equal)', function () {
			var result = OSApp.Firmware.checkOSVersion(300);
			assert.equal(result, true);
		});

		it('should check the OS version (greater than)', function () {
			var result = OSApp.Firmware.checkOSVersion(299);
			assert.equal(result, true);
		});

		it('should check the OS version (less than)', function () {
			var result = OSApp.Firmware.checkOSVersion(301);
			assert.equal(result, false);
		});

		it('should check the OS version with minor version', function () {
			var result = OSApp.Firmware.checkOSVersion(3001);
			assert.equal(result, true);
		});
	});

	describe('isOSPi', function () {
		it('should check if the device is OSPi', function () {
			var result = OSApp.Firmware.isOSPi();
			assert.equal(result, false);
		});
	});

	describe('versionCompare', function () {
		// FIXME: sometimes versionCompare returns an integer, other times it returns a boolean!
		it('should compare versions (equal)', function () {
			var result = OSApp.Firmware.versionCompare('3.0.0'.split('.'), '3.0.0'.split('.'));
			assert.equal(result, 0);
		});

		it('should compare versions (greater than)', function () {
			var result = OSApp.Firmware.versionCompare('3.0.0'.split('.'), '3.0.1'.split('.'));
			assert.equal(result, false);
		});

		it('should compare versions (less than)', function () {
			var result = OSApp.Firmware.versionCompare('3.0.1'.split('.'), '3.0.0'.split('.'));
			assert.equal(result, 1);
		});

		it('should compare versions (check has more parts)', function() {
			var result = OSApp.Firmware.versionCompare('3.0'.split('.'), '3.0.1'.split('.'));
			assert.equal(result, 0);
		});

		it('should compare versions (ver has more parts)', function() {
			var result = OSApp.Firmware.versionCompare('3.0.1'.split('.'), '3.0'.split('.'));
			assert.equal(result, 1);
		});
	});

	describe('getUrlVars', function () {
		it('should extract variables from a URL', function () {
			var result = OSApp.Firmware.getUrlVars('/cm?pw=&test=value');
			assert.equal(result.pw, '');
			assert.equal(result.test, 'value');
		});
	});

	describe('checkOSPiVersion', function () {
		it('should check the OSPi version', function () {
			OSApp.currentSession.controller.options.fwv = '1.0.0-ospi';
			var result = OSApp.Firmware.checkOSPiVersion('1.0.0');
			assert.equal(result, true);
		});
	});

	describe('getOSVersion', function () {
		it('should get the OS version for non-OSPi', function () {
			var result = OSApp.Firmware.getOSVersion(300);
			assert.equal(result, '3.0.0');
		});

		it('should get the OS version for OSPi', function () {
			var result = OSApp.Firmware.getOSVersion('ospi-1.0.0');
			assert.equal(result, 'ospi-1.0.0');
		});
	});

	describe('getOSMinorVersion', function () {
		it('should get the OS minor version', function () {
			var result = OSApp.Firmware.getOSMinorVersion();
			assert.equal(result, ' (1)');
		});
	});

	describe('getHWVersion', function () {
		it('should get the hardware version for non-OSPi', function () {
			var result = OSApp.Firmware.getHWVersion(30);
			assert.equal(result, '3.0');
		});

		it('should get the hardware version for OSPi', function () {
			var result = OSApp.Firmware.getHWVersion(64);
			assert.equal(result, 'OSPi');
		});
	});

	describe('getHWType', function () {
		it('should get the hardware type', function () {
			OSApp.currentSession.controller.options.hwt = 172;
			var result = OSApp.Firmware.getHWType();
			assert.equal(result, ' - AC');
		});
	});

	describe('checkFirmwareUpdate', function () {
		it('should check for firmware updates', function () {
			OSApp.Firmware.checkFirmwareUpdate();
			// Assertions would depend on the behavior of addNotification
		});
	});

	describe('detectUnusedExpansionBoards', function () {
		it('should detect unused expansion boards', function () {
			OSApp.currentSession.controller.options.dexp = 10;
			OSApp.Firmware.detectUnusedExpansionBoards();
			// Assertions would depend on the behavior of addNotification
		});
	});

	describe('showUnifiedFirmwareNotification', function () {
		it('should show the unified firmware notification', function () {
			OSApp.currentSession.controller.options.fwv = 'ospi-1.0.0';
			OSApp.Firmware.showUnifiedFirmwareNotification();
			// Assertions would depend on the behavior of addNotification
		});
	});

	describe('getRebootReason', function () {
		it('should get the reboot reason for a known reason', function () {
			var result = OSApp.Firmware.getRebootReason(1);
			assert.equal(result, 'Factory Reset'); // Assuming Language._ returns the same string
		});

		it('should get the reboot reason for an unknown reason', function () {
			var result = OSApp.Firmware.getRebootReason(999);
			assert.equal(result, 'Unrecognised (999)'); // Assuming Language._ returns 'Unrecognised'
		});
	});
});

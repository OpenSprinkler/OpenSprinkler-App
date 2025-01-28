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

/* global OSApp, assert, beforeEach, afterEach, describe, it */

describe('OSApp.Stations', function () {

	var originalCurrentSession;
	var originalSupported; // Store original OSApp.Supported
	var originalUiState; // Store original OSApp.uiState
	var originalFirmware; // Store original OSApp.Firmware
	var originalStorage; // Store original OSApp.Storage
	var originalUIDom; // Store original OSApp.UIDom
	var originalErrors; // Store original OSApp.Errors
	var originalStatus; // Store original OSApp.Status
	var originalLanguage; // Store original OSApp.Language

	beforeEach(function () {
		// Store originals
		originalCurrentSession = OSApp.currentSession;
		originalSupported = OSApp.Supported;
		originalUiState = OSApp.uiState;
		originalFirmware = OSApp.Firmware;
		originalStorage = OSApp.Storage;
		originalUIDom = OSApp.UIDom;
		originalErrors = OSApp.Errors;
		originalStatus = OSApp.Status;
		originalLanguage = OSApp.Language;

			// Set up a mock OSApp.currentSession
			OSApp.currentSession = {
				controller: {
					status: [0, 0, 0],
					settings: {
						ps: [
							[1, 10, 100, 1], // Example data for program status
							[2, 20, 200, 2],
							[3, 30, 300, 3]
						],
						snames: ['Zone 1', 'Zone 2', 'Zone 3'],
						nq: 0
					},
					stations: {
						snames: ['Zone 1', 'Zone 2', 'Zone 3']
					},
					options: {
						mas: 1, // Example master station
						mas2: 2 // Example second master station
					}
				},
				pass: 'test_password',
				isControllerConnected: function () { return true; }
			};

			// Mock OSApp.Supported
			OSApp.Supported = {
				groups: function () { return true; }
			};

			// Mock OSApp.Firmware
			OSApp.Firmware = {
				sendToOS: function () {
					return $.Deferred().resolve(); // Resolve the deferred object
				},
				checkOSVersion: function () { return false; }
			};

			// Mock OSApp.Storage
			OSApp.Storage = {
				set: function () { }
			};

			// Mock OSApp.UIDom
			OSApp.UIDom = {
				areYouSure: function (message, title, callback) { callback(); },
				goBack: function () { }
			};

			// Mock OSApp.Errors
			OSApp.Errors = {
				showError: function () { }
			};

			// Mock OSApp.Status
			OSApp.Status = {
				refreshStatus: function () { }
			};

			// Mock OSApp.uiState
			OSApp.uiState = {
				timers: {
					clock: 'clockTimer',
					station1: 'station1Timer'
				}
			};

			// Mock OSApp.Language
			OSApp.Language = {
				_: function (str) { return str; }
			};
		});

		afterEach(function () {
			// Restore originals
			OSApp.currentSession = originalCurrentSession;
			OSApp.Supported = originalSupported;
			OSApp.uiState = originalUiState;
			OSApp.Firmware = originalFirmware;
			OSApp.Storage = originalStorage;
			OSApp.UIDom = originalUIDom;
			OSApp.Errors = originalErrors;
			OSApp.Status = originalStatus;
			OSApp.Language = originalLanguage;
		});

	// Tests for OSApp.Stations functions (excluding jQuery-dependent functions)

	describe('getNumberProgramStatusOptions', function () {
		it('should return the number of program status options', function () {
			assert.equal(OSApp.Stations.getNumberProgramStatusOptions(), 4);
		});

		it('should return undefined if program status options are not defined', function () {
			OSApp.currentSession.controller.settings.ps = [];
			assert.equal(OSApp.Stations.getNumberProgramStatusOptions(), undefined);
		});
	});

	describe('getName', function () {
		it('should return the correct station name', function () {
			assert.equal(OSApp.Stations.getName(0), 'Zone 1');
			assert.equal(OSApp.Stations.getName(1), 'Zone 2');
		});
	});

	describe('setName', function () {
		it('should set the station name correctly', function () {
			OSApp.Stations.setName(0, 'New Zone 1');
			assert.equal(OSApp.currentSession.controller.settings.snames[0], 'New Zone 1');
		});
	});

	describe('getPID', function () {
		it('should return the correct PID value', function () {
			assert.equal(OSApp.Stations.getPID(0), 1);
			assert.equal(OSApp.Stations.getPID(1), 2);
		});
	});

	describe('setPID', function () {
		it('should set the PID value correctly', function () {
			OSApp.Stations.setPID(0, 4);
			assert.equal(OSApp.currentSession.controller.settings.ps[0][OSApp.Stations.Constants.programStatusOptions.PID], 4);
		});
	});

	describe('getRemainingRuntime', function () {
		it('should return the correct remaining runtime', function () {
			assert.equal(OSApp.Stations.getRemainingRuntime(0), 10);
			assert.equal(OSApp.Stations.getRemainingRuntime(1), 20);
		});
	});

	describe('setRemainingRuntime', function () {
		it('should set the remaining runtime correctly', function () {
			OSApp.Stations.setRemainingRuntime(0, 40);
			assert.equal(OSApp.currentSession.controller.settings.ps[0][OSApp.Stations.Constants.programStatusOptions.REM], 40);
		});
	});

	describe('getStartTime', function () {
		it('should return the correct start time', function () {
			assert.equal(OSApp.Stations.getStartTime(0), 100);
			assert.equal(OSApp.Stations.getStartTime(1), 200);
		});
	});

	describe('setStartTime', function () {
		it('should set the start time correctly', function () {
			OSApp.Stations.setStartTime(0, 400);
			assert.equal(OSApp.currentSession.controller.settings.ps[0][OSApp.Stations.Constants.programStatusOptions.START], 400);
		});
	});

	describe('getGIDValue', function () {
		it('should return the correct GID value', function () {
			assert.equal(OSApp.Stations.getGIDValue(0), 1);
			assert.equal(OSApp.Stations.getGIDValue(1), 2);
		});
	});

	describe('setGIDValue', function () {
		it('should set the GID value correctly', function () {
			OSApp.Stations.setGIDValue(0, 4);
			assert.equal(OSApp.currentSession.controller.settings.ps[0][OSApp.Stations.Constants.programStatusOptions.GID], 4);
		});
	});

	describe('getStatus', function () {
		it('should return the correct status value', function () {
			assert.equal(OSApp.Stations.getStatus(0), 0);
		});
	});

	describe('setStatus', function () {
		it('should set the status value correctly', function () {
			OSApp.Stations.setStatus(0, 1);
			assert.equal(OSApp.currentSession.controller.status[0], 1);
		});
	});

	describe('isRunning', function () {
		it('should return true if the station is running', function () {
			OSApp.Stations.setStatus(0, 1);
			assert.equal(OSApp.Stations.isRunning(0), true);
		});

		it('should return false if the station is not running', function () {
			OSApp.Stations.setStatus(0, 0);
			assert.equal(OSApp.Stations.isRunning(0), false);
		});
	});

	describe('isMaster', function () {
		it('should return 1 if the station is the first master', function () {
			assert.equal(OSApp.Stations.isMaster(0), 1);
		});

		it('should return 2 if the station is the second master', function () {
			assert.equal(OSApp.Stations.isMaster(1), 2);
		});

		it('should return 0 if the station is not a master', function () {
			assert.equal(OSApp.Stations.isMaster(2), 0);
		});
	});

	// ... (Tests for isSequential, isSpecial, isDisabled, removeStationTimers) ...

	describe('removeStationTimers', function () {
		it('should remove all station timers except the clock timer', function () {
			OSApp.Stations.removeStationTimers();
			assert.equal(Object.keys(OSApp.uiState.timers).length, 1);
			assert.equal(OSApp.uiState.timers.clock, 'clockTimer');
		});
	});

	describe('getStationDuration', function () {
		var originalCheckOSVersion;
		var originalWeather;

		beforeEach(function() {
			originalCheckOSVersion = OSApp.Firmware.checkOSVersion; // Store original function
			originalWeather = OSApp.Weather;
		});

		afterEach(function() {
			OSApp.Firmware.checkOSVersion = originalCheckOSVersion; // Restore original function
			OSApp.Weather = originalWeather;
		});

		it('should return the original duration if not a special value and OS version < 214', function () {
			assert.equal(OSApp.Stations.getStationDuration(120, new Date()), 120);
		});

		it('should return the calculated duration for special value 65535 and OS version >= 214', function () {
			OSApp.Firmware.checkOSVersion = function () { return true; }; // Mock the function
			OSApp.Weather = {
				getSunTimes: function () { return [480, 1140]; } // Example sunrise and sunset times
			};
			assert.equal(OSApp.Stations.getStationDuration(65535, new Date()), 46800);
		});

		it('should return the calculated duration for special value 65534 and OS version >= 214', function () {
			OSApp.Firmware.checkOSVersion = function () { return true; }; // Mock the function
			OSApp.Weather = {
				getSunTimes: function () { return [480, 1140]; } // Example sunrise and sunset times
			};
			assert.equal(OSApp.Stations.getStationDuration(65534, new Date()), 39600);
		});
	});
});

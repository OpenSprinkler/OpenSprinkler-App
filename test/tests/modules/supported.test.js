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

describe('OSApp.Supported', function() {

	// Mock OSApp.currentSession.controller
	var originalController;
	beforeEach(function() {
		originalController = OSApp.currentSession.controller;
		OSApp.currentSession.controller = {
			options: {},
			stations: {},
			settings: {}
		};
	});

	afterEach(function() {
		OSApp.currentSession.controller = originalController;
	});

	describe('master', function() {
		it('should return true for MASTER_STATION_1 when mas is true', function() {
			OSApp.currentSession.controller.options.mas = true;
			assert.equal(OSApp.Supported.master(OSApp.Constants.options.MASTER_STATION_1), true);
		});

		it('should return false for MASTER_STATION_1 when mas is false', function() {
			OSApp.currentSession.controller.options.mas = false;
			assert.equal(OSApp.Supported.master(OSApp.Constants.options.MASTER_STATION_1), false);
		});

		it('should return true for MASTER_STATION_2 when mas2 is true', function() {
			OSApp.currentSession.controller.options.mas2 = true;
			assert.equal(OSApp.Supported.master(OSApp.Constants.options.MASTER_STATION_2), true);
		});

		it('should return false for MASTER_STATION_2 when mas2 is false', function() {
			OSApp.currentSession.controller.options.mas2 = false;
			assert.equal(OSApp.Supported.master(OSApp.Constants.options.MASTER_STATION_2), false);
		});

		it('should return false for an invalid master station ID', function() {
			assert.equal(OSApp.Supported.master(3), false);
		});
	});

	describe('ignoreRain', function() {
		it('should return true when ignore_rain is an object', function() {
			OSApp.currentSession.controller.stations.ignore_rain = {};
			assert.equal(OSApp.Supported.ignoreRain(), true);
		});

		it('should return false when ignore_rain is not an object', function() {
			OSApp.currentSession.controller.stations.ignore_rain = undefined;
			assert.equal(OSApp.Supported.ignoreRain(), false);
		});
	});

	describe('ignoreSensor', function() {
		it('should return true for IGNORE_SENSOR_1 when ignore_sn1 is an object', function() {
			OSApp.currentSession.controller.stations.ignore_sn1 = {};
			assert.equal(OSApp.Supported.ignoreSensor(OSApp.Constants.options.IGNORE_SENSOR_1), true);
		});

		it('should return false for IGNORE_SENSOR_1 when ignore_sn1 is not an object', function() {
			OSApp.currentSession.controller.stations.ignore_sn1 = undefined;
			assert.equal(OSApp.Supported.ignoreSensor(OSApp.Constants.options.IGNORE_SENSOR_1), false);
		});

		it('should return true for IGNORE_SENSOR_2 when ignore_sn2 is an object', function() {
			OSApp.currentSession.controller.stations.ignore_sn2 = {};
			assert.equal(OSApp.Supported.ignoreSensor(OSApp.Constants.options.IGNORE_SENSOR_2), true);
		});

		it('should return false for IGNORE_SENSOR_2 when ignore_sn2 is not an object', function() {
			OSApp.currentSession.controller.stations.ignore_sn2 = undefined;
			assert.equal(OSApp.Supported.ignoreSensor(OSApp.Constants.options.IGNORE_SENSOR_2), false);
		});

		it('should return false for an invalid sensor ID', function() {
			assert.equal(OSApp.Supported.ignoreSensor(3), false);
		});
	});

	describe('actRelay', function() {
		it('should return true when act_relay is an object', function() {
			OSApp.currentSession.controller.stations.act_relay = {};
			assert.equal(OSApp.Supported.actRelay(), true);
		});

		it('should return false when act_relay is not an object', function() {
			OSApp.currentSession.controller.stations.act_relay = undefined;
			assert.equal(OSApp.Supported.actRelay(), false);
		});
	});

	describe('disabled', function() {
		it('should return true when stn_dis is an object', function() {
			OSApp.currentSession.controller.stations.stn_dis = {};
			assert.equal(OSApp.Supported.disabled(), true);
		});

		it('should return false when stn_dis is not an object', function() {
			OSApp.currentSession.controller.stations.stn_dis = undefined;
			assert.equal(OSApp.Supported.disabled(), false);
		});
	});

	describe('sequential', function() {

		it('should return false if OS version is 220 or higher', function() {
			var originalCheckOSVersion = OSApp.Firmware.checkOSVersion;
			OSApp.Firmware.checkOSVersion = function() { return true; };
			assert.equal(OSApp.Supported.sequential(), false);
			OSApp.Firmware.checkOSVersion = originalCheckOSVersion;
		});

		it('should return true when stn_seq is an object and OS version is lower than 220', function() {
			var originalCheckOSVersion = OSApp.Firmware.checkOSVersion;
			OSApp.Firmware.checkOSVersion = function() { return false; };
			OSApp.currentSession.controller.stations.stn_seq = {};
			assert.equal(OSApp.Supported.sequential(), true);
			OSApp.Firmware.checkOSVersion = originalCheckOSVersion;
		});

		it('should return false when stn_seq is not an object and OS version is lower than 220', function() {
			var originalCheckOSVersion = OSApp.Firmware.checkOSVersion;
			OSApp.Firmware.checkOSVersion = function() { return false; };
			OSApp.currentSession.controller.stations.stn_seq = undefined;
			assert.equal(OSApp.Supported.sequential(), false);
			OSApp.Firmware.checkOSVersion = originalCheckOSVersion;
		});
	});

	describe('special', function() {
		it('should return true when stn_spe is an object', function() {
			OSApp.currentSession.controller.stations.stn_spe = {};
			assert.equal(OSApp.Supported.special(), true);
		});

		it('should return false when stn_spe is not an object', function() {
			OSApp.currentSession.controller.stations.stn_spe = undefined;
			assert.equal(OSApp.Supported.special(), false);
		});
	});

	describe('pausing', function() {
		it('should return true when settings.pq is defined', function() {
			OSApp.currentSession.controller.settings.pq = 0;
			assert.equal(OSApp.Supported.pausing(), true);
		});

		it('should return false when settings.pq is undefined', function() {
			OSApp.currentSession.controller.settings.pq = undefined;
			assert.equal(OSApp.Supported.pausing(), false);
		});
	});

	describe('groups', function() {
		it('should return true when getNumberProgramStatusOptions returns 4 or greater', function() {
			var originalGetNumberProgramStatusOptions = OSApp.Stations.getNumberProgramStatusOptions;
			OSApp.Stations.getNumberProgramStatusOptions = function() { return 4; };
			assert.equal(OSApp.Supported.groups(), true);
			OSApp.Stations.getNumberProgramStatusOptions = originalGetNumberProgramStatusOptions;
		});

		it('should return false when getNumberProgramStatusOptions returns less than 4', function() {
			var originalGetNumberProgramStatusOptions = OSApp.Stations.getNumberProgramStatusOptions;
			OSApp.Stations.getNumberProgramStatusOptions = function() { return 3; };
			assert.equal(OSApp.Supported.groups(), false);
			OSApp.Stations.getNumberProgramStatusOptions = originalGetNumberProgramStatusOptions;
		});
	});

	describe('dateRange', function() {
		it('should return true when checkOSVersion returns true for 220', function() {
			var originalCheckOSVersion = OSApp.Firmware.checkOSVersion;
			OSApp.Firmware.checkOSVersion = function() { return true; };
			assert.equal(OSApp.Supported.dateRange(), true);
			OSApp.Firmware.checkOSVersion = originalCheckOSVersion;
		});

		it('should return false when checkOSVersion returns false for 220', function() {
			var originalCheckOSVersion = OSApp.Firmware.checkOSVersion;
			OSApp.Firmware.checkOSVersion = function() { return false; };
			assert.equal(OSApp.Supported.dateRange(), false);
			OSApp.Firmware.checkOSVersion = originalCheckOSVersion;
		});
	});

});

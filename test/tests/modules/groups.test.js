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

describe.only('OSApp.Groups', function () {

	beforeEach(function () {
		// Mock necessary dependencies
		OSApp.Constants = {
			options: {
				NUM_SEQ_GROUPS: 8,
				PARALLEL_GID_VALUE: 8,
				PARALLEL_GROUP_NAME: 'Par',
				MASTER_GID_VALUE: 9,
				MASTER_GROUP_NAME: 'M'
			}
		};
		OSApp.Cards = {
			getGIDValue: function (card) {
				// Mock card GID values
				return card.data('gid') || 0;
			},
			isMasterStation: function (card) {
				// Mock master station check
				return card.data('master') || false;
			}
		};
		OSApp.Stations = {
			getGIDValue: function (sid) {
				// Mock station GID values
				return sid % 9; // Example mapping, adjust as needed
			},
			isSequential: function (sid) {
				// Mock sequential station check
				return sid < 8; // Example, adjust as needed
			}
		};
		OSApp.Supported = {
			groups: function () {
				return true;
			}
		};
		OSApp.currentSession = {
			controller: {
				options: {
					sdt: 10 // Example station delay time
				},
				stations: {
					snames: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12']
				}
			}
		};
	});

	afterEach(function () {
		// Restore any mocked functionality if necessary
	});

	describe('mapIndexToGIDValue', function () {
		it('should map index to GID value (sequential)', function () {
			var gid = OSApp.Groups.mapIndexToGIDValue(3);
			assert.equal(gid, 8); // Should return PARALLEL_GID_VALUE for sequential groups
		});

		it('should map index to GID value (parallel)', function () {
			var gid = OSApp.Groups.mapIndexToGIDValue(10);
			assert.equal(gid, 10); // Should return the index for parallel groups
		});
	});

	describe('mapGIDValueToName', function () {
		it('should map GID value to name (parallel)', function () {
			var name = OSApp.Groups.mapGIDValueToName(8);
			assert.equal(name, 'Par');
		});

		it('should map GID value to name (master)', function () {
			var name = OSApp.Groups.mapGIDValueToName(9);
			assert.equal(name, 'M');
		});

		it('should map GID value to name (sequential)', function () {
			var name = OSApp.Groups.mapGIDValueToName(3);
			assert.equal(name, 'D');
		});
	});

	describe('mapGIDNameToValue', function () {
		it('should map GID name to value (parallel)', function () {
			var value = OSApp.Groups.mapGIDNameToValue('Par');
			assert.equal(value, 8);
		});

		it('should map GID name to value (master)', function () {
			var value = OSApp.Groups.mapGIDNameToValue('M');
			assert.equal(value, 9);
		});

		it('should map GID name to value (sequential)', function () {
			var value = OSApp.Groups.mapGIDNameToValue('D');
			assert.equal(value, 3);
		});
	});

	describe('numActiveStations', function () {
		it('should return the number of active stations in a group', function () {
			// Mock activeCards
			var activeCards = $(
				"<div class='card' data-gid='0'><span class='station-status on'></span></div>" +
				"<div class='card' data-gid='1'><span class='station-status wait'></span></div>" +
				"<div class='card' data-gid='0'><span class='station-status off'></span></div>"
			);
			var numActive = OSApp.Groups.numActiveStations(0);
			assert.equal(numActive, 1);
		});
	});

	describe('canShift', function () {
		it('should check if a group can shift', function () {
			// Mock activeCards (more than 1 active station in group 0)
			var activeCards = $(
				"<div class='card' data-gid='0'><span class='station-status on'></span></div>" +
				"<div class='card' data-gid='0'><span class='station-status wait'></span></div>"
			);
			var canShift = OSApp.Groups.canShift(0);
			assert.equal(canShift, true);
		});
	});

	describe('calculateTotalRunningTime', function () {
		it('should calculate total running time with groups', function () {
			var runTimes = [10, 20, 30, 0, 0, 0, 0, 0, 40, 0, 0, 0]; // Example run times
			var totalTime = OSApp.Groups.calculateTotalRunningTime(runTimes);
			assert.equal(totalTime, 70); // Expected total time with station delay
		});

		it('should calculate total running time without groups', function () {
			OSApp.Supported.groups = function () { return false; };
			var runTimes = [10, 20, 30, 0, 0, 0, 0, 0, 40, 0, 0, 0]; // Example run times
			var totalTime = OSApp.Groups.calculateTotalRunningTime(runTimes);
			assert.equal(totalTime, 70); // Expected total time with station delay
		});
	});
});

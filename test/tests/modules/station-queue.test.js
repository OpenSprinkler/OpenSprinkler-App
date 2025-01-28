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

describe('OSApp.StationQueue', function () {

	var originalCurrentSession;
	var originalStations; // Store the original OSApp.Stations

	beforeEach(function () {
		// Store original OSApp.currentSession
		originalCurrentSession = OSApp.currentSession;

		// Set up a mock OSApp.currentSession
		OSApp.currentSession = {
			controller: {
				status: [],
				settings: {
					pq: false,
					nq: 0
				}
			}
		};

		// Store the original OSApp.Stations
		originalStations = OSApp.Stations;

		// Mock OSApp.Stations
		OSApp.Stations = {
			getStatus: function () { return 0; },
			getPID: function () { return 0; }
		};
	});

	afterEach(function () {
		// Restore original OSApp.currentSession
		OSApp.currentSession = originalCurrentSession;

		// Restore original OSApp.Stations
		OSApp.Stations = originalStations;
	});

	describe('isActive', function () {
		it('should return -1 when no stations are active', function () {
			OSApp.currentSession.controller.status = [0, 0, 0];
			assert.equal(OSApp.StationQueue.isActive(), -1);
		});

		it('should return the index of the first active station', function () {
			OSApp.currentSession.controller.status = [1, 0, 0];
			OSApp.Stations.getStatus = function (i) { return i === 0 ? 1 : 0; };
			OSApp.Stations.getPID = function (i) { return i === 0 ? 1 : 0; };
			assert.equal(OSApp.StationQueue.isActive(), 0);
		});

		it('should return the index of the active station even if not the first', function () {
			OSApp.currentSession.controller.status = [0, 1, 0];
			OSApp.Stations.getStatus = function (i) { return i === 1 ? 1 : 0; };
			OSApp.Stations.getPID = function (i) { return i === 1 ? 1 : 0; };
			assert.equal(OSApp.StationQueue.isActive(), 1);
		});
	});

	describe('isPaused', function () {
		it('should return true if the queue is paused', function () {
			OSApp.currentSession.controller.settings.pq = true;
			assert.equal(OSApp.StationQueue.isPaused(), true);
		});

		it('should return false if the queue is not paused', function () {
			OSApp.currentSession.controller.settings.pq = false;
			assert.equal(OSApp.StationQueue.isPaused(), false);
		});
	});

	describe('size', function () {
		it('should return the size of the queue', function () {
			OSApp.currentSession.controller.settings.nq = 5;
			assert.equal(OSApp.StationQueue.size(), 5);
		});
	});

});

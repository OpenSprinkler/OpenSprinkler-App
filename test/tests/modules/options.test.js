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

/* global OSApp, assert, describe, it, beforeEach, afterEach, $ */

describe('OSApp.Options', function () {
	// Skipping showOptions because it uses jQuery and has complex logic

	describe('coordsToLocation', function () {
		var original$;

		beforeEach(function () {
			original$ = $;
		});

		afterEach(function () {
			$ = original$;
		});

		it('should call the callback with the fallback if the geocoding request fails', function () {
			var callbackCalled = false;
			var locationPassedToCallback = null;
			$.getJSON = function (url, callback) {
				// Simulate a failed request
				callback({ results: [] });
			};

			OSApp.Options.coordsToLocation(37.7749, -122.4194, function (location) {
				callbackCalled = true;
				locationPassedToCallback = location;
			}, 'Fallback Location');

			assert.isTrue(callbackCalled);
			assert.equal(locationPassedToCallback, 'Fallback Location');
		});

		it('should call the callback with the formatted address if the geocoding request succeeds', function () {
			var callbackCalled = false;
			var locationPassedToCallback = null;
			$.getJSON = function (url, callback) {
				// Simulate a successful request with mock data
				callback({
					results: [
						{
							formatted_address: 'Mountain View, CA',
							address_components: [
								{ long_name: 'Mountain View', types: ['locality'] },
								{ long_name: 'CA', types: ['administrative_area_level_1'] },
								{ long_name: 'USA', types: ['country'] }
							]
						}
					]
				});
			};

			OSApp.Options.coordsToLocation(37.7749, -122.4194, function (location) {
				callbackCalled = true;
				locationPassedToCallback = location;
			});

			assert.isTrue(callbackCalled);
			assert.equal(locationPassedToCallback, 'Mountain View, CA');
		});
	});

	// Skipping overlayMap because it uses jQuery and has complex logic
});

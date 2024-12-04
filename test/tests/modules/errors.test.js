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

/* global OSApp, assert, beforeEach, afterEach, describe, it, $, setTimeout, clearTimeout */

describe('OSApp.Errors', function() {
	var originalUiState, originalMobileLoading, originalSetTimeout, originalClearTimeout, loadingOptions;

	beforeEach(function() {
		originalUiState = OSApp.uiState;
		originalMobileLoading = $.mobile.loading;
		originalSetTimeout = setTimeout;
		originalClearTimeout = clearTimeout;

		OSApp.uiState = { errorTimeout: null };
		loadingOptions = null; // To capture the options passed to $.mobile.loading

		$.mobile.loading = function(action, options) {
			if (action === 'show') {
				loadingOptions = options;
			}
		};
		setTimeout = function(func, delay) {};
		clearTimeout = function(timeout) {};
	});

	afterEach(function() {
		OSApp.uiState = originalUiState;
		$.mobile.loading = originalMobileLoading;
		setTimeout = originalSetTimeout;
		clearTimeout = originalClearTimeout;
	});

	describe('showError', function() {
		it('should show an error message with the default duration', function() {
			OSApp.Errors.showError('Test error');
			assert.equal(loadingOptions.text, 'Test error');
			assert.equal(loadingOptions.textVisible, true);
			assert.equal(loadingOptions.textonly, true);
			assert.equal(loadingOptions.theme, 'b');
		});

		it('should show an error message with a custom duration', function() {
			OSApp.Errors.showError('Test error 2', 5000);
			assert.equal(loadingOptions.text, 'Test error 2');
		});
	});
});

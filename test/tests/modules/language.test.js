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

/* global $ */

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

describe('OSApp.Language', function () {
	describe('_', function() {
		var originalLanguage;

		beforeEach(function() {
			originalLanguage = OSApp.uiState.language; // Store the original language object
		});

		afterEach(function() {
			OSApp.uiState.language = originalLanguage; // Restore the original language object
		});

		it('should return the translated text if available', function() {
			OSApp.uiState.language = { 'testKey': 'translatedText' };
			assert.equal(OSApp.Language._('testKey'), 'translatedText');
		});

		it('should return the key if no translation is found', function() {
			OSApp.uiState.language = { };
			assert.equal(OSApp.Language._('testKey'), 'testKey');
		});

		it('should return the key if OSApp.uiState.language is not an object', function() {
			OSApp.uiState.language = 'notAnObject';
			assert.equal(OSApp.Language._('testKey'), 'testKey');
		});
	});



	describe.skip('updateLang', function() {
		// Skipped due test not properly mocking DOM for jquery
		var originalStorageSet, originalGetJSON;

		beforeEach(function() {
			originalStorageSet = OSApp.Storage.set;
			OSApp.Storage.set = function(data) { /* Mock implementation */ };

			originalGetJSON = $.getJSON; // Store original $.getJSON
			$.getJSON = function(url, success, fail) {
				if (url.endsWith('en.js')) {
					fail();
				} else {
					success({ messages: { 'testKey': 'translatedText' } });
				}
			};
		});

		afterEach(function() {
			OSApp.Storage.set = originalStorageSet;
			$.getJSON = originalGetJSON; // Restore original $.getJSON
		});

		it('should update the language from storage if no lang parameter is provided', function() {
			var originalStorageGet = OSApp.Storage.get;
			OSApp.Storage.get = function(key, callback) {
				callback({ lang: 'es' });
			};

			OSApp.Language.updateLang();
			assert.equal(OSApp.currentSession.lang, 'es');

			OSApp.Storage.get = originalStorageGet;
		});

		it('should set the language to English and call setLang if lang is "en"', function() {
			var setLangCalled = false;
			var originalSetLang = OSApp.Language.setLang; // Store original OSApp.Language.setLang
			OSApp.Language.setLang = function() { setLangCalled = true; };

			OSApp.Language.updateLang('en');
			assert.equal(OSApp.currentSession.lang, 'en');
			assert.isTrue(setLangCalled);

			OSApp.Language.setLang = originalSetLang; // Restore original OSApp.Language.setLang
		});

		it('should fetch the language file, update uiState.language, and call setLang for non-English languages', function() {
			OSApp.Language.updateLang('es');
			assert.equal(OSApp.uiState.language.testKey, 'translatedText');
		});
	});

});

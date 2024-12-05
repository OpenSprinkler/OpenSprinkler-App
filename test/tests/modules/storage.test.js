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

/* Global variables: OSApp, assert, beforeEach, afterEach, describe, it */

describe("OSApp.Storage", function() {

	describe("get", function() {
		it("should retrieve a single value from localStorage", function() {
			localStorage.setItem("testKey", "testValue");
			OSApp.Storage.get("testKey", function(data) {
				assert.equal(data.testKey, "testValue");
			});
			localStorage.removeItem("testKey");
		});

		it("should retrieve multiple values from localStorage", function() {
			localStorage.setItem("testKey1", "testValue1");
			localStorage.setItem("testKey2", "testValue2");
			OSApp.Storage.get(["testKey1", "testKey2"], function(data) {
				assert.equal(data.testKey1, "testValue1");
				assert.equal(data.testKey2, "testValue2");
			});
			localStorage.removeItem("testKey1");
			localStorage.removeItem("testKey2");
		});

		it("should handle a callback function that is not provided", function() {
			localStorage.setItem("testKey", "testValue");
			OSApp.Storage.get("testKey");
			assert.equal(localStorage.getItem("testKey"), "testValue");
			localStorage.removeItem("testKey");
		});
	});

	describe("set", function() {
		it("should store a single value in localStorage", function() {
			OSApp.Storage.set({ "testKey": "testValue" }, function(result) {
				assert.equal(result, true);
				assert.equal(localStorage.getItem("testKey"), "testValue");
			});
			localStorage.removeItem("testKey");
		});

		it("should store multiple values in localStorage", function() {
			OSApp.Storage.set({ "testKey1": "testValue1", "testKey2": "testValue2" }, function(result) {
				assert.equal(result, true);
				assert.equal(localStorage.getItem("testKey1"), "testValue1");
				assert.equal(localStorage.getItem("testKey2"), "testValue2");
			});
			localStorage.removeItem("testKey1");
			localStorage.removeItem("testKey2");
		});

		it("should handle a callback function that is not provided", function() {
			OSApp.Storage.set({ "testKey": "testValue" });
			assert.equal(localStorage.getItem("testKey"), "testValue");
			localStorage.removeItem("testKey");
		});
	});

	describe("remove", function() {
		it("should remove a single value from localStorage", function() {
			localStorage.setItem("testKey", "testValue");
			OSApp.Storage.remove("testKey", function(result) {
				assert.equal(result, true);
				assert.equal(localStorage.getItem("testKey"), null);
			});
		});

		it("should remove multiple values from localStorage", function() {
			localStorage.setItem("testKey1", "testValue1");
			localStorage.setItem("testKey2", "testValue2");
			OSApp.Storage.remove(["testKey1", "testKey2"], function(result) {
				assert.equal(result, true);
				assert.equal(localStorage.getItem("testKey1"), null);
				assert.equal(localStorage.getItem("testKey2"), null);
			});
		});

		it("should handle a callback function that is not provided", function() {
			localStorage.setItem("testKey", "testValue");
			OSApp.Storage.remove("testKey");
			assert.equal(localStorage.getItem("testKey"), null);
		});
	});

	describe("loadLocalSettings", function() {

		beforeEach(function() {
			this.originalOSAppCurrentDevice = OSApp.currentDevice;
			this.originalOSAppUiState = OSApp.uiState;
			OSApp.currentDevice = {};
			OSApp.uiState = {};
		});

		afterEach(function() {
			OSApp.currentDevice = this.originalOSAppCurrentDevice;
			OSApp.uiState = this.originalOSAppUiState;
		});

		it("should load isMetric setting from localStorage and set OSApp.currentDevice.isMetric to true", function() {
			localStorage.setItem("isMetric", "true");
			OSApp.Storage.loadLocalSettings();
			assert.equal(OSApp.currentDevice.isMetric, true);
			localStorage.removeItem("isMetric");
		});

		it("should load isMetric setting from localStorage and set OSApp.currentDevice.isMetric to false", function() {
			localStorage.setItem("isMetric", "false");
			OSApp.Storage.loadLocalSettings();
			assert.equal(OSApp.currentDevice.isMetric, false);
			localStorage.removeItem("isMetric");
		});

		it("should not change OSApp.currentDevice.isMetric if isMetric is not in localStorage", function() {
			localStorage.removeItem("isMetric");
			OSApp.Storage.loadLocalSettings();
			assert.equal(OSApp.currentDevice.isMetric, undefined);
		});

		it("should load groupView setting from localStorage and set OSApp.uiState.groupView to true", function() {
			localStorage.setItem("groupView", "true");
			OSApp.Storage.loadLocalSettings();
			assert.equal(OSApp.uiState.groupView, true);
			localStorage.removeItem("groupView");
		});

		it("should load groupView setting from localStorage and set OSApp.uiState.groupView to false", function() {
			localStorage.setItem("groupView", "false");
			OSApp.Storage.loadLocalSettings();
			assert.equal(OSApp.uiState.groupView, false);
			localStorage.removeItem("groupView");
		});

		it("should not change OSApp.uiState.groupView if groupView is not in localStorage", function() {
			localStorage.removeItem("groupView");
			OSApp.Storage.loadLocalSettings();
			assert.equal(OSApp.uiState.groupView, undefined);
		});
	});
});

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

describe("Storage Namespacing Tests", function () {
	it("_getNamespace() should generate namespace based on URL path", function () {
		// Save original getPathname function if it exists
		var originalGetPathname = OSApp.Storage._getPathname;
		
		try {
			// Mock different URL paths using dependency injection
			OSApp.Storage._getPathname = function() { return "/sprinkler/front"; };
			assert.equal(OSApp.Storage._getNamespace(), "OSApp_sprinkler_front_");
			
			OSApp.Storage._getPathname = function() { return "/sprinkler/rear/"; };
			assert.equal(OSApp.Storage._getNamespace(), "OSApp_sprinkler_rear_");
			
			OSApp.Storage._getPathname = function() { return "/"; };
			assert.equal(OSApp.Storage._getNamespace(), "OSApproot_");
			
			OSApp.Storage._getPathname = function() { return ""; };
			assert.equal(OSApp.Storage._getNamespace(), "OSApproot_");
		} finally {
			// Restore original function
			if (originalGetPathname) {
				OSApp.Storage._getPathname = originalGetPathname;
			} else {
				delete OSApp.Storage._getPathname;
			}
		}
	});

	it("_namespacedKey() should add namespace prefix to keys", function () {
		var originalGetPathname = OSApp.Storage._getPathname;
		
		try {
			OSApp.Storage._getPathname = function() { return "/sprinkler/front"; };
			
			assert.equal(OSApp.Storage._namespacedKey("testkey"), "OSApp_sprinkler_front_testkey");
			assert.equal(OSApp.Storage._namespacedKey("sites"), "OSApp_sprinkler_front_sites");
		} finally {
			if (originalGetPathname) {
				OSApp.Storage._getPathname = originalGetPathname;
			} else {
				delete OSApp.Storage._getPathname;
			}
		}
	});

	it("Storage operations should use namespaced keys", function (done) {
		var originalGetPathname = OSApp.Storage._getPathname;
		var testData = { "namespaceTestKey": "namespaceTestValue" };
		
		try {
			OSApp.Storage._getPathname = function() { return "/test/namespace"; };
			
			// Set a value using OSApp.Storage
			OSApp.Storage.set(testData, function (result) {
				assert.equal(result, true);
				
				// Verify the key was stored with namespace prefix
				var namespacedKey = OSApp.Storage._namespacedKey("namespaceTestKey");
				var rawValue = localStorage.getItem(namespacedKey);
				assert.equal(rawValue, "namespaceTestValue");
				
				// Verify OSApp.Storage.get returns the value correctly
				OSApp.Storage.get("namespaceTestKey", function (data) {
					assert.equal(data.namespaceTestKey, "namespaceTestValue");
					
					// Clean up
					OSApp.Storage.remove("namespaceTestKey", function () {
						assert.isNull(localStorage.getItem(namespacedKey));
						done();
					});
				});
			});
		} finally {
			if (originalGetPathname) {
				OSApp.Storage._getPathname = originalGetPathname;
			} else {
				delete OSApp.Storage._getPathname;
			}
		}
	});

	it("Different namespaces should not interfere with each other", function (done) {
		var originalGetPathname = OSApp.Storage._getPathname;
		
		try {
			// Set value with first namespace
			OSApp.Storage._getPathname = function() { return "/sprinkler/front"; };
			
			OSApp.Storage.set({ "testKey": "frontValue" }, function () {
				// Switch to second namespace
				OSApp.Storage._getPathname = function() { return "/sprinkler/rear"; };
				
				// Set different value with same key
				OSApp.Storage.set({ "testKey": "rearValue" }, function () {
					// Verify each namespace has its own value
					OSApp.Storage.get("testKey", function (rearData) {
						assert.equal(rearData.testKey, "rearValue");
						
						// Switch back to first namespace
						OSApp.Storage._getPathname = function() { return "/sprinkler/front"; };
						OSApp.Storage.get("testKey", function (frontData) {
							assert.equal(frontData.testKey, "frontValue");
							
							// Clean up both namespaces
							OSApp.Storage.remove("testKey", function () {
								OSApp.Storage._getPathname = function() { return "/sprinkler/rear"; };
								OSApp.Storage.remove("testKey", function () {
									done();
								});
							});
						});
					});
				});
			});
		} finally {
			if (originalGetPathname) {
				OSApp.Storage._getPathname = originalGetPathname;
			} else {
				delete OSApp.Storage._getPathname;
			}
		}
	});
});
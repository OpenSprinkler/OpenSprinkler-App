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

describe("Initial Definition Check", function () {
	it("storage.set(object,callback) should accept an object of key/value pairs to be set into localStorage and respond with callback", function (done) {
		assert.doesNotThrow(function () {
			OSApp.Storage.set({
				"testkey": "helloworld",
				"sites": JSON.stringify({
					"Test": {
						"os_ip": "127.0.0.1:8080",
						"os_pw": "opendoor"
					}
				}),
				"current_site": "Test"
			}, function (result) {
				result === true ? done() : done(new Error("Failed to set key/value pairs", result.Error));
			});
		});
	});

	it("storage.get(object,callback) should accept an array of keys to be retrieved from localStorage and respond with callback", function (done) {
		assert.doesNotThrow(function () {
			OSApp.Storage.get(["testkey"], function (result) {
				if (result.testkey === "helloworld") {
					done();
				}
			});
		});
	});

	it("storage.remove(object,callback) should accept an array of keys to be deleted from localStorage and respond with callback", function (done) {
		assert.doesNotThrow(function () {
			OSApp.Storage.remove(["testkey"], function (result) {
				if (result === true) {
					done();
				}
			});
		});
	});

	it("storage.remove(string,callback) should accept a key to be deleted from localStorage and respond with callback", function (done) {
		assert.doesNotThrow(function () {
			OSApp.Storage.remove("fakekey", function (result) {
				if (result === true) {
					done();
				}
			});
		});
	});
});

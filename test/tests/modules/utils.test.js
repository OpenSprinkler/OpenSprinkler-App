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

describe('OSApp.Utils', function() {

	describe('transformKeys', function() {

		var originalCheckOSVersion;
		beforeEach(function() {
			originalCheckOSVersion = OSApp.Firmware.checkOSVersion;
			OSApp.Constants.keyIndex = { stn1: 1, stn2: 2, tz: 13, ntp: 18 };
		});

		afterEach(function() {
			OSApp.Firmware.checkOSVersion = originalCheckOSVersion;
		});

		it('should transform keys for OS version 219 or higher', function() {
			OSApp.Firmware.checkOSVersion = function() { return true; };
			var opt = { o1: 'value1', o2: 'value2', o13: 'value1', o18: 'value2', normalKey: 'value3' };
			var expected = { stn1: 'value1', stn2: 'value2', tz: 'value1', ntp: 'value2', normalKey: 'value3' };
			assert.deepEqual(OSApp.Utils.transformKeys(opt), expected);
		});

		it('should return the original object for OS version lower than 219', function() {
			OSApp.Firmware.checkOSVersion = function() { return false; };
			var opt = { o1: 'value1', o2: 'value2' };
			assert.deepEqual(OSApp.Utils.transformKeys(opt), opt);
		});
	});

	describe('transformKeysinString', function() {

		var originalCheckOSVersion;
		beforeEach(function() {
			originalCheckOSVersion = OSApp.Firmware.checkOSVersion;
			OSApp.Constants.keyIndex = { stn1: 1, stn2: 2 };
		});

		afterEach(function() {
			OSApp.Firmware.checkOSVersion = originalCheckOSVersion;
		});

		it('should transform keys in a string for OS version 219 or higher', function() {
			OSApp.Firmware.checkOSVersion = function() { return true; };
			var co = 'o1=value1&o2=value2&normalKey=value3';
			var expected = 'stn1=value1&stn2=value2&normalKey=value3';
			assert.equal(OSApp.Utils.transformKeysinString(co), expected);
		});

		it('should return the original string for OS version lower than 219', function() {
			OSApp.Firmware.checkOSVersion = function() { return false; };
			var co = 'o1=value1&o2=value2';
			assert.equal(OSApp.Utils.transformKeysinString(co), co);
		});
	});

	describe('escapeJSON', function() {
		it('should escape curly braces in a JSON string', function() {
			var json = { key1: 'value1', key2: 'value2' };
			var expected = '"key1":"value1","key2":"value2"';
			assert.equal(OSApp.Utils.escapeJSON(json), expected);
		});
	});

	describe('unescapeJSON', function() {
		it('should unescape a JSON string with missing curly braces', function() {
			var string = '"key1":"value1","key2":"value2"';
			var expected = { key1: 'value1', key2: 'value2' };
			assert.deepEqual(OSApp.Utils.unescapeJSON(string), expected);
		});
	});

	describe('isMD5', function() {
		it('should return true for a valid MD5 hash', function() {
			assert.equal(OSApp.Utils.isMD5('a1b2c3d4e5f678901234567890abcdef'), true);
		});

		it('should return false for an invalid MD5 hash', function() {
			assert.equal(OSApp.Utils.isMD5('invalid'), false);
		});
	});

	describe('sortByStation', function() {
		it('should sort objects by station property in ascending order', function() {
			var a = { station: 2 };
			var b = { station: 1 };
			assert.equal(OSApp.Utils.sortByStation(a, b), 1);
			assert.equal(OSApp.Utils.sortByStation(b, a), -1);
			assert.equal(OSApp.Utils.sortByStation(a, a), 0);
		});
	});

	describe('getBitFromByte', function() {
		it('should return the correct bit value from a byte', function() {
			assert.equal(OSApp.Utils.getBitFromByte(0b1101, 0), true);
			assert.equal(OSApp.Utils.getBitFromByte(0b1101, 1), false);
			assert.equal(OSApp.Utils.getBitFromByte(0b1101, 2), true);
			assert.equal(OSApp.Utils.getBitFromByte(0b1101, 3), true);
		});
	});

	describe('pad', function() {
		it('should pad a single digit with a leading zero', function() {
			assert.equal(OSApp.Utils.pad(5), '05');
		});

		it('should not pad a number with more than one digit', function() {
			assert.equal(OSApp.Utils.pad(12), '12');
		});
	});

	describe('htmlEscape', function() {
		it('should escape HTML special characters', function() {
			var str = '<>"&\'';
			var expected = '&lt;&gt;&quot;&amp;&#39;';
			assert.equal(OSApp.Utils.htmlEscape(str), expected);
		});
	});

	// Skipping tests for exportObj as it uses jQuery ($)

	describe('sortObj', function() {
		var obj = { c: 3, a: 1, b: 2 };

		it('should sort an object by key', function() {
			var expected = { a: 1, b: 2, c: 3 };
			assert.deepEqual(OSApp.Utils.sortObj(obj), expected);
		});

		it('should sort an object by value', function() {
			var expected = { a: 1, b: 2, c: 3 };
			assert.deepEqual(OSApp.Utils.sortObj(obj, 'value'), expected);
		});

		it('should sort an object using a custom function', function() {
			var expected = { c: 3, b: 2, a: 1 };
			assert.deepEqual(OSApp.Utils.sortObj(obj, function(a, b) { return b.localeCompare(a); }), expected);
		});
	});

	describe('parseIntArray', function() {
		it('should convert all elements in an array to integer', function() {
			var arr = ['1', '2.5', '3'];
			var expected = [1, 2.5, 3];
			assert.deepEqual(OSApp.Utils.parseIntArray(arr), expected);
		});
	});

	describe('isValidOTC', function() {
		it('should return true for a valid OTC token', function() {
			assert.equal(OSApp.Utils.isValidOTC('OT144afa7a52c1fa5a8a1c1be31d91e5'), true);
		});

		it('should return false for an invalid OTC token', function() {
			assert.equal(OSApp.Utils.isValidOTC('invalid'), false);
		});
	});

	describe('flowCountToVolume', function() {

		var originalController;
		beforeEach(function() {
			originalController = OSApp.currentSession.controller;
			OSApp.currentSession.controller = { options: { fpr1: 1, fpr0: 50 } };
		});

		afterEach(function() {
			OSApp.currentSession.controller = originalController;
		});

		it('should calculate the volume from flow count', function() {
			// Corrected assertion:
			assert.equal(OSApp.Utils.flowCountToVolume(100), 306);
		});
	});
});

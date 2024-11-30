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

describe("General Function Checks", function () {
	it("OSApp.Utils.parseIntArray(array) should convert all members into integers", function () {
		assert.deepEqual([9, 394, 29193, -1], OSApp.Utils.parseIntArray(["9", "394", "29193", "-1"]));
	});

	it("OSApp.Dates.sec2hms(number) should return a string representation of the difference the input represents (seconds)", function () {
		assert.equal("23:59:59", OSApp.Dates.sec2hms(86399));
		assert.equal("15:00", OSApp.Dates.sec2hms(900));
	});

	it("OSApp.Dates.sec2dhms(number) should return an object containing days, hours, minutes and seconds from the input (seconds)", function () {
		assert.deepEqual({
			days: 936,
			hours: 17,
			minutes: 20,
			seconds: 9
		}, OSApp.Dates.sec2dhms(80932809));
	});

	it("OSApp.Dates.dhms2str(object) should convert an object with elements days, hours, minutes and seconds into a string representation", function () {
		assert.equal("5d 4h 3m 1s", OSApp.Dates.dhms2str({ days: 5, hours: 4, minutes: 3, seconds: 1 }));
		assert.equal("0s", OSApp.Dates.dhms2str({}));
	});

	it("OSApp.Dates.dhms2sec(object) should convert an object with elements days, hours, minutes and seconds into a second value", function () {
		assert.equal(100981, OSApp.Dates.dhms2sec({ days: 1, hours: 4, minutes: 3, seconds: 1 }));
	});

	it("OSApp.Dates.getDayName(day,type) should return the day of the week and can be of type 'short'", function () {
		assert.equal("Monday", OSApp.Dates.getDayName(new Date(Date.UTC(2014, 8, 15, 12, 45, 28))));
		assert.equal("Thu", OSApp.Dates.getDayName(new Date(Date.UTC(2014, 8, 11, 12, 45, 28)), "short"));
	});

	it("OSApp.Utils.pad(number) should successfully prepend a 0 to a single digit", function () {
		assert.equal("00", OSApp.Utils.pad(0));
		assert.equal("01", OSApp.Utils.pad(1));
		assert.equal("10", OSApp.Utils.pad(10));
		assert.equal("999", OSApp.Utils.pad(999));
	});

	it("OSApp.Weather.getCurrentAdjustmentMethodId() should return the adjustment method ID", function () {
		// FIXME: this test was failing after test refactoring due to uwt undefined. Resolved with elvis operator
		assert.equal(0, OSApp.Weather.getCurrentAdjustmentMethodId());
	});

	it("OSApp.Weather.getAdjustmentMethod(uwt) should return the adjustment method for the corresponding ID", function () {
		assert.equal("Manual", OSApp.Weather.getAdjustmentMethod(0).name);
		assert.equal("Manual", OSApp.Weather.getAdjustmentMethod(128).name);
		assert.equal("Zimmerman", OSApp.Weather.getAdjustmentMethod(1).name);
		assert.equal("Zimmerman", OSApp.Weather.getAdjustmentMethod(129).name);
	});
});

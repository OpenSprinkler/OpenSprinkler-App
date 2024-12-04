

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

describe('OSApp.Dates', function() {
	var originalCurrentSession, originalCurrentDevice, originalLanguage, originalUtils;

	beforeEach(function() {
		originalCurrentSession = OSApp.currentSession;
		originalCurrentDevice = OSApp.currentDevice;
		originalLanguage = OSApp.Language;
		originalUtils = OSApp.Utils;

		OSApp.currentSession = {
			controller: {
				programs: {
					pd: {
						1: [null, null, null, null, null, null, [1, 128, 255]]
					}
				},
				options: {
					tz: 48
				}
			},
			lang: 'en'
		};
		OSApp.currentDevice = { isMetric: false };
		OSApp.Language = { _: function(key) { return key; } };
		OSApp.Utils = { pad: function(num) { return ('0' + num).slice(-2); } };
	});

	afterEach(function() {
		OSApp.currentSession = originalCurrentSession;
		OSApp.currentDevice = originalCurrentDevice;
		OSApp.Language = originalLanguage;
		OSApp.Utils = originalUtils;
	});


	describe('getDateRange', function() {
		it('should return the date range array', function() {
			var dateRange = OSApp.Dates.getDateRange(1);
			assert.equal(dateRange[0], 1);
			assert.equal(dateRange[1], 128);
			assert.equal(dateRange[2], 255);
		});
	});

	describe('isDateRangeEnabled', function() {
		it('should return 0 for new program', function() {
			var enabled = OSApp.Dates.isDateRangeEnabled('new');
			assert.equal(enabled, 0);
		});

		it('should return the first element of the date range array', function() {
			var enabled = OSApp.Dates.isDateRangeEnabled(1);
			assert.equal(enabled, 1);
		});
	});

	describe('getDateRangeStart', function() {
		it('should return minEncodedDate for new program', function() {
			var start = OSApp.Dates.getDateRangeStart('new');
			assert.equal(start, OSApp.Dates.Constants.minEncodedDate);
		});

		it('should return the second element of the date range array', function() {
			var start = OSApp.Dates.getDateRangeStart(1);
			assert.equal(start, 128);
		});
	});

	describe('getDateRangeEnd', function() {
		it('should return maxEncodedDate for new program', function() {
			var end = OSApp.Dates.getDateRangeEnd('new');
			assert.equal(end, OSApp.Dates.Constants.maxEncodedDate);
		});

		it('should return the third element of the date range array', function() {
			var end = OSApp.Dates.getDateRangeEnd(1);
			assert.equal(end, 255);
		});
	});

	describe('extractDateFromString', function() {
		it('should extract date from string', function() {
			var dates = OSApp.Dates.extractDateFromString('Start 12/01, End 12/24');
			assert.equal(dates[0], '12/01');
			assert.equal(dates[1], '12/24');
		});
	});

	describe('isValidDateFormat', function() {
		it('should validate date format (valid)', function() {
			var isValid = OSApp.Dates.isValidDateFormat('12/01');
			assert.equal(isValid, true);
		});

		it('should validate date format (invalid)', function() {
			var isValid = OSApp.Dates.isValidDateFormat('12-01');
			assert.equal(isValid, false);
		});
	});

	describe('isValidDateRange', function() {
		it('should validate date range (valid)', function() {
			var isValid = OSApp.Dates.isValidDateRange('12/01', '12/24');
			assert.equal(isValid, true);
		});

		it('should validate date range (invalid)', function() {
			var isValid = OSApp.Dates.isValidDateRange('12-01', '12/24');
			assert.equal(isValid, false);
		});
	});

	describe('encodeDate', function() {
		it('should encode date string', function() {
			var encoded = OSApp.Dates.encodeDate('12/01');
			assert.equal(encoded, 385);
		});

		it('should return -1 for invalid format', function() {
			var encoded = OSApp.Dates.encodeDate('12-01');
			assert.equal(encoded, -1);
		});
	});

	describe('decodeDate', function() {
		it('should decode a valid date value', function() {
			var decoded = OSApp.Dates.decodeDate(385); // 12/01
			assert.equal(decoded, '12/01');
		});

		it('should decode a date value below the minimum to the MIN_DATE', function() {
			var decoded = OSApp.Dates.decodeDate(-100);
			assert.equal(decoded, '01/01');
		});

		it('should decode a date value above the maximum to the MAX_DATE', function() {
			var decoded = OSApp.Dates.decodeDate(1000);
			assert.equal(decoded, '12/31');
		});
	});

	describe('getTimezoneOffsetOS', function() {
		it('should calculate timezone offset', function() {
			var offset = OSApp.Dates.getTimezoneOffsetOS();
			assert.equal(offset, 0);
		});
	});

	describe('humaniseDuration', function() {
		it('should humanize duration (just now)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base + 5000;
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, 'Just Now');
		});

		it('should humanize duration (future - years)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base + (31536000000 * 2);
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, 'In 2 years');
		});

		it('should humanize duration (future - year)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base + 31536000000;
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, 'In 1 year');
		});

		it('should humanize duration (past - months)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - (2592000000 * 3);
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, '3 months ago');
		});

		it('should humanize duration (past - month)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - 2592000000;
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, '1 month ago');
		});

		it('should humanize duration (past - days)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - (86400000 * 5);
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, '5 days ago');
		});

		it('should humanize duration (past - day)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - 86400000;
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, '1 day ago');
		});

		it('should humanize duration (past - hours)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - (3600000 * 8);
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, '8 hours ago');
		});

		it('should humanize duration (past - hour)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - 3600000;
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, '1 hour ago');
		});

		it('should humanize duration (past - minutes)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - (60000 * 15);
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, '15 minutes ago');
		});

		it('should humanize duration (past - minute)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - 60000;
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, '1 minute ago');
		});

		it('should humanize duration (past - seconds)', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - (1000 * 30);
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, '30 seconds ago');
		});

		it('should humanize duration Just Now', function() {
			var base = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)).getTime();
			var relative = base - 9000;
			var result = OSApp.Dates.humaniseDuration(base, relative);
			assert.equal(result, 'Just Now');
		});
	});

	describe('dateToString', function() {
		it('should format date as string (default)', function() {
			var date = new Date(Date.UTC(2024, 11, 4, 12, 30, 0));
			OSApp.currentSession.controller.options.tz = 0; // Set timezone to UTC in mock
			var result = OSApp.Dates.dateToString(date); // toUTC is true by default
			assert.equal(result, 'Wed, 04 Dec 2024 12:30:00');
		});

		it('should format date as string (shorten 1)', function() {
			var date = new Date(Date.UTC(2024, 11, 4, 12, 30, 0));
			OSApp.currentSession.controller.options.tz = 0;
			var result = OSApp.Dates.dateToString(date, true, 1);
			assert.equal(result, 'Dec 04, 2024 12:30:00');
		});

		it('should format date as string (shorten 2)', function() {
			var date = new Date(Date.UTC(2024, 11, 4, 12, 30, 0));
			OSApp.currentSession.controller.options.tz = 0;
			var result = OSApp.Dates.dateToString(date, true, 2);
			assert.equal(result, 'Dec 04, 12:30:00');
		});

		it('should format date as string (German)', function() {
			OSApp.currentSession.lang = 'de';
			var date = new Date(Date.UTC(2024, 11, 4, 12, 30, 0));
			OSApp.currentSession.controller.options.tz = 0;
			var result = OSApp.Dates.dateToString(date);
			assert.equal(result, '04.12.2024 12:30:00');
		});

		it('should handle invalid date', function() {
			var date = new Date(0);
			var result = OSApp.Dates.dateToString(date);
			assert.equal(result, '--');
		});
	});

	describe('minutesToTime', function() {
		it('should convert minutes to time string (AM)', function() {
			var result = OSApp.Dates.minutesToTime(600);
			assert.equal(result, '10:00 AM');
		});

		it('should convert minutes to time string (PM)', function() {
			var result = OSApp.Dates.minutesToTime(840);
			assert.equal(result, '2:00 PM');
		});

		it('should convert minutes to time string (metric)', function() {
			OSApp.currentDevice.isMetric = true;
			var result = OSApp.Dates.minutesToTime(720);
			assert.equal(result, '12:00');
		});
	});

	describe('getDayName', function() {
		it('should return the day name (long)', function() {
			var date = new Date(Date.UTC(2024, 11, 4));
			var result = OSApp.Dates.getDayName(date);
			assert.equal(result, 'Tuesday');
		});

		it('should return the day name (short)', function() {
			var date = new Date(Date.UTC(2024, 11, 4));
			var result = OSApp.Dates.getDayName(date, 'short');
			assert.equal(result, 'Tue');
		});
	});

	describe('getDurationText', function() {
		it('should return sunset to sunrise text', function() {
			var result = OSApp.Dates.getDurationText(65535);
			assert.equal(result, 'Sunset to Sunrise');
		});

		it('should return sunrise to sunset text', function() {
			var result = OSApp.Dates.getDurationText(65534);
			assert.equal(result, 'Sunrise to Sunset');
		});

		it('should return formatted duration string', function() {
			var result = OSApp.Dates.getDurationText(3661);
			assert.equal(result, '1h 1m 1s');
		});
	});

	describe('sec2hms', function() {
		it('should convert seconds to HH:MM:SS format', function() {
			var result = OSApp.Dates.sec2hms(3661);
			assert.equal(result, '01:01:01');
		});

		it('should omit hours if zero', function() {
			var result = OSApp.Dates.sec2hms(61);
			assert.equal(result, '01:01');
		});
	});

	describe('sec2dhms', function() {
		it('should convert seconds to days, hours, minutes, seconds object', function() {
			var result = OSApp.Dates.sec2dhms(90061);
			assert.equal(result.days, 1);
			assert.equal(result.hours, 1);
			assert.equal(result.minutes, 1);
			assert.equal(result.seconds, 1);
		});

		it('should handle negative values', function() {
			var result = OSApp.Dates.sec2dhms(-90061);
			assert.equal(result.days, -1);
			assert.equal(result.hours, -1);
			assert.equal(result.minutes, -1);
			assert.equal(result.seconds, -1);
		});
	});

	describe('dhms2str', function() {
		it('should convert dhms object to formatted string', function() {
			var dhms = { days: 1, hours: 1, minutes: 1, seconds: 1 };
			var result = OSApp.Dates.dhms2str(dhms);
			assert.equal(result, '1d 1h 1m 1s');
		});

		it('should handle empty dhms object', function() {
			var dhms = {};
			var result = OSApp.Dates.dhms2str(dhms);
			assert.equal(result, '0s');
		});
	});

	describe('dhms2sec', function() {
		it('should convert dhms object to seconds', function() {
			var dhms = { days: 1, hours: 1, minutes: 1, seconds: 1 };
			var result = OSApp.Dates.dhms2sec(dhms);
			assert.equal(result, 90061);
		});
	});
});

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

var assert = chai.assert;

describe("Initial Definition Check", function () {
	it("storage.set(object,callback) should accept an object of key/value pairs to be set into localStorage and respond with callback", function (done) {
		assert.doesNotThrow(function () {
			OSApp.Storage.set({
				"testkey": "helloworld",
				"sites": JSON.stringify({
					"Test": {
						"os_ip": "demo.opensprinkler.com",
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

describe("OpenSprinkler Firmware Version Functions", function () {

	describe("Test against Arduino Firmware Version", function () {
		before(function () {
			OSApp.currentSession.controller.options = {
				fwv: 210
			};
		});
		it("isOPSi() should identify if the device is an OSPi", function () {
			assert.equal(false, OSApp.Firmware.isOSPi());
		});
		it("versionCompare(device,compare) should check the given firmware (device) against the compare firmware where the input is an array", function () {
			assert.strictEqual(false, OSApp.Firmware.versionCompare([1], [1, 5]));
			assert.strictEqual(0, OSApp.Firmware.versionCompare([1, 5], [1, 5]));
			assert.strictEqual(1, OSApp.Firmware.versionCompare([2, 1], [1, 5]));
		});
		it("checkOSVersion(compare) should compare the input firmware version against the Arduino firmware version.", function () {
			assert.strictEqual(false, OSApp.Firmware.checkOSVersion(211));
			assert.strictEqual(true, OSApp.Firmware.checkOSVersion(210));
			assert.strictEqual(1, OSApp.Firmware.checkOSVersion(208));
		});
		it("checkOSPiVersion(compare) should compare the input firmware version against the OSPi firmware version.", function () {
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("2.0"));
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("1.9"));
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("2.1"));
		});
	});

	describe("Test against OSPi Firmware Version", function () {
		before(function () {
			OSApp.currentSession.controller.options = {
				fwv: "1.9.0-OSPi"
			};
		});
		it("isOPSi() should identify if the device is an OSPi", function () {
			assert.equal(true, OSApp.Firmware.isOSPi());
		});
		it("versionCompare(device,compare) should check the given firmware (device) against the compare firmware where the input is an array", function () {
			assert.strictEqual(false, OSApp.Firmware.versionCompare([1], [1, 5]));
			assert.strictEqual(0, OSApp.Firmware.versionCompare([1, 5], [1, 5]));
			assert.strictEqual(1, OSApp.Firmware.versionCompare([2, 1], [1, 5]));
		});
		it("checkOSVersion(compare) should compare the input firmware version against the Arduino firmware version.", function () {
			assert.strictEqual(false, OSApp.Firmware.checkOSVersion(211));
			assert.strictEqual(false, OSApp.Firmware.checkOSVersion(210));
			assert.strictEqual(false, OSApp.Firmware.checkOSVersion(208));
		});
		it("checkOSPiVersion(compare) should compare the input firmware version against the OSPi firmware version.", function () {
			assert.strictEqual(1, OSApp.Firmware.checkOSPiVersion("1.8"));
			assert.strictEqual(true, OSApp.Firmware.checkOSPiVersion("1.9.0"));
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("2.0"));
			assert.strictEqual(false, OSApp.Firmware.checkOSPiVersion("2.1"));
		});
	});

	describe("Retrieve the formatted firmware version", function () {
		before(function () {
			OSApp.currentSession.controller.options = {
				fwv: 204
			};
		});
		it("getOSVersion(fwv) should return the firmware in a string representation", function () {
			assert.equal("1.8.3-OSPi", OSApp.Firmware.getOSVersion("1.8.3-OSPi"));
			assert.equal("2.1.193-OSPi", OSApp.Firmware.getOSVersion("2.1.193-OSPi"));
			assert.equal("2.0.8", OSApp.Firmware.getOSVersion(208));
			assert.equal("2.0.4", OSApp.Firmware.getOSVersion());
		});
	});
});

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
		assert.equal(0, OSApp.Weather.getCurrentAdjustmentMethodId());
	});

	it("OSApp.Weather.getAdjustmentMethod(uwt) should return the adjustment method for the corresponding ID", function () {
		assert.equal("Manual", OSApp.Weather.getAdjustmentMethod(0).name);
		assert.equal("Manual", OSApp.Weather.getAdjustmentMethod(128).name);
		assert.equal("Zimmerman", OSApp.Weather.getAdjustmentMethod(1).name);
		assert.equal("Zimmerman", OSApp.Weather.getAdjustmentMethod(129).name);
	});
});

describe("Page Navigation Checks", function () {
	before(function () {
		OSApp.currentSession.ip = "demo.opensprinkler.com";
		OSApp.currentSession.pass = "opendoor";
		OSApp.currentSession.prefix = "https://";
		OSApp.currentSession.fw183 = false;

		OSApp.Sites.updateSiteList(["Test"], "Test");
	});

	it("Start jQuery Mobile Page Initialization", function (done) {
		$.mobile.document.one("pageshow", "#sprinklers", function () {
			done();
		});

		OSApp.Sites.newLoad();
	});

	it( "Change page to program preview", function( done ) {
		$.mobile.document.one( "pageshow", "#preview", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#preview" );
		} );
	} );

	it( "Change to logs page", function( done ) {
		$.mobile.document.one( "pageshow", "#logs", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#logs" );
		} );
	} );

	it( "Change to runonce page", function( done ) {
		$.mobile.document.one( "pageshow", "#runonce", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#runonce" );
		} );
	} );

	it( "Change to edit programs page", function( done ) {
		$.mobile.document.one( "pageshow", "#programs", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#programs" );
		} );
	} );

	it( "Change to add new program page", function( done ) {
		$.mobile.document.one( "pageshow", "#addprogram", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#addprogram" );
		} );
	} );

	it( "Change to options page", function( done ) {
		$.mobile.document.one( "pageshow", "#os-options", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#os-options" );
		} );
	} );

	it( "Change to site manager page", function( done ) {
		$.mobile.document.one( "pageshow", "#site-control", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#site-control" );
		} );
	} );

	it( "Change to about page", function( done ) {
		$.mobile.document.one( "pageshow", "#about", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#about" );
		} );
	} );
});

describe("Popup Checks", function () {

	it( "Show main menu popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#mainMenu", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.showHomeMenu();
		} );
	} );

	it( "Show change rain delay popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#durationBox", function() {
			$.mobile.document.one( "popupafterclose", "#durationBox", function() {
				done();
			} );
			$( "#durationBox" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			$( "#mainMenu" ).find( "a[href='#raindelay']" ).trigger( "click" );
		} );
	} );

	it("Show add new site popup", function (done) {
		$.mobile.document.one("popupafteropen", "#addnew", function () {
			$.mobile.document.one("popupafterclose", "#addnew", function () {
				done();
			});
			$("#addnew").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Sites.showAddNew();
		});
	});

	it("Show site select popup", function (done) {
		$.mobile.document.one("popupafteropen", "#site-select", function () {
			$.mobile.document.one("popupafterclose", "#site-select", function () {
				done();
			});
			$("#site-select").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Sites.showSiteSelect();
		});
	});

	it("Show are you sure popup", function (done) {
		$.mobile.document.one("popupafteropen", "#sure", function () {
			$("#sure .sure-do").trigger("click");
		});
		assert.doesNotThrow(function () {
			OSApp.UIDom.areYouSure(null, null, done);
		});
	});

	it("Show IP Address input popup", function (done) {
		$.mobile.document.one("popupafteropen", "#ipInput", function () {
			$.mobile.document.one("popupafterclose", "#ipInput", function () {
				done();
			});
			$("#ipInput").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.UIDom.showIPRequest();
		});
	});

	it("Show single duration input popup", function (done) {
		$.mobile.document.one("popupafteropen", "#singleDuration", function () {
			$.mobile.document.one("popupafterclose", "#singleDuration", function () {
				done();
			});
			$("#singleDuration").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.UIDom.showSingleDurationInput();
		});
	});

	it("Show language selection popup", function (done) {
		$.mobile.document.one("popupafteropen", "#localization", function () {
			$.mobile.document.one("popupafterclose", "#localization", function () {
				done();
			});
			$("#localization").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Language.languageSelect();
		});
	});
});

describe("Logout / Clean up", function () {
	it("Remove all variables", function (done) {
		OSApp.Storage.remove(["sites", "current_site", "lang", "runonce"], function () {
			done();
		});
	});

	it("Go to start page", function (done) {
		$.mobile.document.one("pageshow", "#start", function () {
			done();
		});
		OSApp.currentSession.ip = "";
		OSApp.UIDom.changePage("#start");
	});
});

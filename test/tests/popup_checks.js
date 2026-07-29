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

	it("Station image picker button does not submit the attribute form", function (done) {
		var openStationAttributes = function() {
			var settings = $("#sprinklers .station-settings").first();

			assert.lengthOf(settings, 1);

			$.mobile.document.one("popupafteropen", "#stn_attrib", function () {
				var popup = $("#stn_attrib");

				assert.equal(popup.find(".changeBackground").attr("type"), "button");

				$.mobile.document.one("popupafterclose", "#stn_attrib", function () {
					done();
				});
				popup.popup("close").remove();
			});

			assert.doesNotThrow(function () {
				settings.trigger("click");
			});
		};

		if ($("#sprinklers .station-settings").length === 0) {
			OSApp.currentSession.ip = "demo.opensprinkler.com";
			OSApp.currentSession.pass = "test-password";
			OSApp.currentSession.prefix = "https://";
			OSApp.currentSession.fw183 = false;
			OSApp.currentSession.controller = {
				options: { fwv: 221, fwm: 0, wl: 100 },
				programs: { pd: [] },
				settings: {
					devt: 1732789106,
					dname: "Test",
					email: {},
					gpio: [],
					nbrd: 1,
					ps: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
				},
				stations: {
					ignore_rain: [0],
					ignore_sn1: [0],
					ignore_sn2: [0],
					maxlen: 32,
					snames: ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"],
					stn_dis: [0],
					stn_grp: [0, 0, 0, 0, 0, 0, 0, 0],
					stn_spe: [0]
				},
				status: [0, 0, 0, 0, 0, 0, 0, 0]
			};
			OSApp.Sites.updateSiteList(["Test"], "Test");
			OSApp.Storage.set({
				current_site: "Test",
				sites: JSON.stringify({ Test: { images: {}, notes: {}, os_ip: "demo.opensprinkler.com", os_pw: "test-password" } })
			});
			OSApp.Dashboard.displayPage();
		}

		openStationAttributes();
	});
});

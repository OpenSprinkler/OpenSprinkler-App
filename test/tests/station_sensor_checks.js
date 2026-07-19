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

describe("Station Sensor Checks", function () {
	var controller;

	beforeEach(function () {
		controller = OSApp.currentSession.controller;
		OSApp.currentSession.controller = {
			stations: {
				ignore_sn1: [ 0 ],
				ignore_sn2: [ 0 ],
				ignore_sn3: [ 133, 2 ],
				ignore_sn4: [ 10, 0 ]
			}
		};
	});

	afterEach(function () {
		OSApp.currentSession.controller = controller;
	});

	it("detects all four per-station sensor ignore masks from controller data", function () {
		assert.isTrue(OSApp.Supported.ignoreSensor(OSApp.Constants.options.IGNORE_SENSOR_1));
		assert.isTrue(OSApp.Supported.ignoreSensor(OSApp.Constants.options.IGNORE_SENSOR_2));
		assert.isTrue(OSApp.Supported.ignoreSensor(OSApp.Constants.options.IGNORE_SENSOR_3));
		assert.isTrue(OSApp.Supported.ignoreSensor(OSApp.Constants.options.IGNORE_SENSOR_4));
		assert.isFalse(OSApp.Supported.ignoreSensor(0));
		assert.isFalse(OSApp.Supported.ignoreSensor(5));

		delete OSApp.currentSession.controller.stations.ignore_sn4;
		assert.isFalse(OSApp.Supported.ignoreSensor(OSApp.Constants.options.IGNORE_SENSOR_4));
	});

	it("reads sensor 3 and 4 ignore bits across station boards", function () {
		assert.equal(OSApp.StationAttributes.getIgnoreSensor(0, OSApp.Constants.options.IGNORE_SENSOR_3), 1);
		assert.equal(OSApp.StationAttributes.getIgnoreSensor(1, OSApp.Constants.options.IGNORE_SENSOR_3), 0);
		assert.equal(OSApp.StationAttributes.getIgnoreSensor(2, OSApp.Constants.options.IGNORE_SENSOR_3), 1);
		assert.equal(OSApp.StationAttributes.getIgnoreSensor(7, OSApp.Constants.options.IGNORE_SENSOR_3), 1);
		assert.equal(OSApp.StationAttributes.getIgnoreSensor(9, OSApp.Constants.options.IGNORE_SENSOR_3), 1);

		assert.equal(OSApp.StationAttributes.getIgnoreSensor(1, OSApp.Constants.options.IGNORE_SENSOR_4), 1);
		assert.equal(OSApp.StationAttributes.getIgnoreSensor(3, OSApp.Constants.options.IGNORE_SENSOR_4), 1);
		assert.equal(OSApp.StationAttributes.getIgnoreSensor(4, OSApp.Constants.options.IGNORE_SENSOR_4), 0);
	});
});

describe("Dashboard Station Sensor Checks", function () {
	it("renders and submits sensor 3 and 4 station ignore masks", function () {
		var sandbox = sinon.createSandbox(),
			stations = OSApp.currentSession.controller.stations,
			siteSelector = $("#site-selector"),
			createdSiteSelector = siteSelector.length === 0,
			hadSensor3 = Object.prototype.hasOwnProperty.call(stations, "ignore_sn3"),
			hadSensor4 = Object.prototype.hasOwnProperty.call(stations, "ignore_sn4"),
			originalSensor3 = stations.ignore_sn3,
			originalSensor4 = stations.ignore_sn4;

		try {
			stations.ignore_sn3 = [ 133 ];
			stations.ignore_sn4 = [ 10 ];
			if (createdSiteSelector) {
				siteSelector = $("<select id='site-selector'><option selected>Test</option></select>").appendTo("body");
			} else {
				siteSelector.val("Test");
			}

			sandbox.stub($.mobile, "loading");
			sandbox.stub(OSApp.currentSession, "isControllerConnected").returns(true);
			sandbox.stub(OSApp.Storage, "get").callsFake(function (query, callback) {
				callback({
					sites: JSON.stringify({
						Test: { images: {}, notes: {}, lastRunTime: {} }
					})
				});
			});
			sandbox.stub(OSApp.Storage, "set").callsFake(function (data, callback) {
				if (callback) { callback(); }
			});
			sandbox.stub(OSApp.Network, "cloudSaveSites");
			sandbox.stub(OSApp.Errors, "showError");
			sandbox.stub(OSApp.Sites, "updateController");
			var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS")
				.returns($.Deferred().resolve({ result: 1 }).promise());

			OSApp.Dashboard.displayPage();
			var stationButton = $("#attrib-2");
			assert.lengthOf(stationButton, 1);
			assert.equal(stationButton.data("sn3"), 1);
			assert.equal(stationButton.data("sn4"), 0);

			stationButton.trigger("click");
			var popup = $("#stn_attrib");
			assert.lengthOf(popup.find("#sn3"), 1);
			assert.lengthOf(popup.find("#sn4"), 1);
			assert.isTrue(popup.find("#sn3").is(":checked"));
			assert.isFalse(popup.find("#sn4").is(":checked"));

			popup.find("#sn3").prop("checked", false);
			popup.find("#sn4").prop("checked", true);
			popup.find("form").trigger("submit");

			assert.isTrue(sendToOS.calledOnce);
			var query = sendToOS.firstCall.args[ 0 ].split("?")[ 1 ],
				params = new URLSearchParams(query);
			assert.equal(params.get("o0"), "129");
			assert.equal(params.get("r0"), "14");
		} finally {
			sandbox.restore();
			if (hadSensor3) {
				stations.ignore_sn3 = originalSensor3;
			} else {
				delete stations.ignore_sn3;
			}
			if (hadSensor4) {
				stations.ignore_sn4 = originalSensor4;
			} else {
				delete stations.ignore_sn4;
			}
			$(".station-settings").removeData("sn3 sn4");
			$("#stn_attrib").remove();
			if (createdSiteSelector) { siteSelector.remove(); }
		}
	});

	it("renders controller-provided station details as text at dashboard boundaries", function () {
		var sandbox = sinon.createSandbox(),
			controller = OSApp.currentSession.controller,
			stations = controller.stations,
			settings = controller.settings,
			programs = controller.programs,
			siteSelector = $("#site-selector"),
			createdSiteSelector = siteSelector.length === 0,
			originalSite = siteSelector.val(),
			originalName = stations.snames[ 0 ],
			originalStatus = controller.status[ 0 ],
			originalProgramStatus = settings.ps[ 0 ],
			originalProgram = programs.pd[ 0 ],
			originalProgramCount = programs.pd.length,
			originalSpecial = controller.special,
			originalSpecialMask = stations.stn_spe[ 0 ],
			originalGPIO = settings.gpio,
			stationName = "<img id='dashboard-station-injection'>Station",
			programName = "<img id='dashboard-program-injection'>Program",
			note = "</textarea><img id='dashboard-note-injection'>Note",
			server = "server'><img id='dashboard-server-injection'>",
			onCommand = "on'><img id='dashboard-on-injection'>",
			offCommand = "off'><img id='dashboard-off-injection'>",
			updatedName = "<img id='dashboard-updated-name-injection'>Updated";

		try {
			stations.snames[ 0 ] = stationName;
			controller.status[ 0 ] = 0;
			settings.ps[ 0 ] = [ 1, 60, 0, 0 ];
			programs.pd[ 0 ] = [ 0, 0, 0, [], [], programName ];
			stations.stn_spe[ 0 ] = originalSpecialMask | 1;
			controller.special = Object.assign({}, originalSpecial);
			controller.special[ 0 ] = { st: 4, sd: [ server, "80", onCommand, offCommand ].join(",") };
			settings.gpio = [ 5, "6'><img id='dashboard-gpio-injection'>" ];

			if (createdSiteSelector) {
				siteSelector = $("<select id='site-selector'><option selected>Test</option></select>").appendTo("body");
			} else {
				siteSelector.val("Test");
			}

			sandbox.stub($.mobile, "loading");
			sandbox.stub(OSApp.currentSession, "isControllerConnected").returns(true);
			sandbox.stub(OSApp.Storage, "get").callsFake(function (query, callback) {
				callback({
					sites: JSON.stringify({
						Test: { images: {}, notes: { 0: note }, lastRunTime: {} }
					})
				});
			});
			sandbox.stub(OSApp.Storage, "set").callsFake(function (data, callback) {
				if (callback) { callback(); }
			});
			sandbox.stub(OSApp.Network, "cloudSaveSites");
			sandbox.stub(OSApp.Errors, "showError");
			sandbox.stub(OSApp.Sites, "updateController");
			sandbox.stub(OSApp.Sites, "updateControllerStationSpecial").callsFake(function (callback) {
				callback();
			});
			sandbox.stub(OSApp.Firmware, "sendToOS")
				.returns($.Deferred().resolve({ result: 1 }).promise());
			var areYouSure = sandbox.stub(OSApp.UIDom, "areYouSure");

			OSApp.Dashboard.displayPage();

			assert.lengthOf($("#dashboard-station-injection, #dashboard-program-injection"), 0);
			assert.equal($("#station_0").text(), stationName);
			assert.include($("#station_0").siblings(".rem").text(), programName);
			$("html").trigger("datarefresh");
			assert.lengthOf($("#dashboard-station-injection, #dashboard-program-injection"), 0);
			assert.include($("#station_0").siblings(".rem").text(), programName);

			$("#attrib-0").trigger("click");
			var popup = $("#stn_attrib");
			assert.equal(popup.find("#stn-name").val(), stationName);
			assert.equal(popup.find("#stn-notes").val(), note);
			assert.equal(popup.find("#http-server").val(), server);
			assert.equal(popup.find("#http-on").val(), onCommand);
			assert.equal(popup.find("#http-off").val(), offCommand);
			assert.lengthOf($("#dashboard-note-injection, #dashboard-server-injection, #dashboard-on-injection, #dashboard-off-injection"), 0);

			popup.find("#hs").val("3").trigger("change");
			assert.lengthOf($("#dashboard-gpio-injection"), 0);
			assert.deepEqual(popup.find("#gpio-pin option").map(function () {
				return $(this).val();
			}).get(), [ "5", "6" ]);

			popup.find("#stn-name").val(updatedName);
			popup.find("form").trigger("submit");
			assert.equal($("#station_0").text(), updatedName);
			assert.lengthOf($("#dashboard-updated-name-injection"), 0);

			stations.snames[ 0 ] = updatedName;
			settings.ps[ 0 ] = [ 0, 0, 0, 0 ];
			controller.status[ 0 ] = 0;
			$("#durationBox").remove();
			var stationCard = $("#station_0").closest(".card");
			stationCard.find(".rem").remove();
			stationCard.trigger("click");
			assert.equal($("#durationBox h1").text(), updatedName);
			assert.include($("#durationBox .rain-desc").text(), updatedName);
			assert.lengthOf($("#durationBox #dashboard-updated-name-injection"), 0);
			$("#durationBox").popup("destroy").remove();

			controller.status[ 0 ] = 1;
			areYouSure.resetHistory();
			stationCard.trigger("click");
			assert.isTrue(areYouSure.calledOnce);
			assert.equal(areYouSure.firstCall.args[ 1 ], OSApp.Utils.htmlEscape(updatedName));
			assert.lengthOf($("<div></div>").html(areYouSure.firstCall.args[ 1 ]).find("#dashboard-updated-name-injection"), 0);
		} finally {
			sandbox.restore();
			stations.snames[ 0 ] = originalName;
			controller.status[ 0 ] = originalStatus;
			settings.ps[ 0 ] = originalProgramStatus;
			programs.pd[ 0 ] = originalProgram;
			programs.pd.length = originalProgramCount;
			controller.special = originalSpecial;
			stations.stn_spe[ 0 ] = originalSpecialMask;
			settings.gpio = originalGPIO;
			$("#stn_attrib, #sprinklers").remove();
			if (createdSiteSelector) {
				siteSelector.remove();
			} else {
				siteSelector.val(originalSite);
			}
		}
	});
});

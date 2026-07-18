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

describe("Program Sensor Adjustment Checks", function () {
	var charts;
	var controller;
	var fixture;
	var originalChart;
	var sandbox;

	function makeController() {
		return {
			options: {
				fwv: 221,
				fwm: 5,
				mas: 0,
				mas2: 0,
				mas3: 0,
				mas4: 0,
				sdt: 0,
				wl: 100
			},
			settings: { ps: [ [ 0, 0, 0 ] ], wto: {} },
			stations: { snames: [ "Station 1" ], stn_dis: [ 0 ] },
			programs: {
				pnsize: 32,
				pd: [ [
					3,
					1,
					0,
					[ 60, 0, 0, -1 ],
					[ 120 ],
					"Sensor Program",
					[ 0, 33, 289 ],
					{
						flag: 1,
						uuid: 42,
						splits: [ { x: 0, y: 1 }, { x: 10, y: 0.5 } ],
						maxSplits: 8
					}
				] ]
			},
			sensors: {
				sn: [ { uuid: 42, name: "Moisture", unit: 1, value: 5, status: 1 } ]
			},
			sensor_desc: { units: [ { value: 1, short: "V" } ] }
		};
	}

	beforeEach(function () {
		controller = OSApp.currentSession.controller;
		OSApp.currentSession.controller = makeController();
		fixture = $("<div class='program-sensor-adjustment-fixture'></div>").appendTo("body");
		charts = [];
		originalChart = window.Chart;
		window.Chart = function () {
			this.data = {};
			this.update = sinon.spy();
			this.resize = sinon.spy();
			this.destroy = sinon.spy();
			charts.push(this);
		};

		sandbox = sinon.createSandbox();
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(true);
		sandbox.stub(OSApp.Supported, "dateRange").returns(false);
		sandbox.stub(OSApp.Stations, "isMaster").returns(false);
		sandbox.stub(OSApp.Stations, "isDisabled").returns(false);
		sandbox.stub(OSApp.Stations, "getName").returns("Station 1");
		sandbox.stub(OSApp.Groups, "calculateTotalRunningTime").returns(120);
		sandbox.stub(OSApp.UIDom, "fixInputClick");
	});

	afterEach(function () {
		OSApp.Programs.destroySensorAdjustmentCharts(fixture);
		OSApp.Programs.destroySensorAdjustmentCharts($("#programs, #runonce, #preview"));
		fixture.remove();
		$("#programs, #run-program-dialog, #runonce, #preview").remove();
		sandbox.restore();
		window.Chart = originalChart;
		OSApp.currentSession.controller = controller;
	});

	it("copies the source program sensor adjustment into the new-program form", function () {
		OSApp.currentSession.controller.programs.pd[0][7].flag = 5;
		var page = OSApp.Programs.makeProgram21(0, true);
		fixture.append(page);

		assert.isTrue(fixture.find("#use-sn-new").is(":checked"));
		assert.equal(fixture.find("#sen-adj-sid-new").val(), "42");
		assert.deepEqual(
			fixture.find("#sensor-splits-body-new tr").map(function () {
				return [ [
					parseFloat($(this).find(".split-x").val()),
					parseFloat($(this).find(".split-y").val())
				] ];
			}).get(),
			[ [ 0, 100 ], [ 10, 50 ] ]
		);
		assert.equal(OSApp.Programs.getSenAdjURL("new"), "&snadj=5,42,0,1,10,0.5");
	});

	it("copies the source program date range into the new-program form", function () {
		OSApp.Supported.dateRange.returns(true);
		var getStart = sandbox.stub(OSApp.Dates, "getDateRangeStart").returns(257);
		var getEnd = sandbox.stub(OSApp.Dates, "getDateRangeEnd").returns(514);
		var isEnabled = sandbox.stub(OSApp.Dates, "isDateRangeEnabled").returns(true);
		sandbox.stub(OSApp.Dates, "decodeDate").callsFake(function (value) {
			return value === 257 ? "01/01" : "02/02";
		});

		var page = OSApp.Programs.makeProgram21(0, true);
		fixture.append(page);

		assert.isTrue(getStart.calledWithExactly(0));
		assert.isTrue(getEnd.calledWithExactly(0));
		assert.isTrue(isEnabled.calledWithExactly(0));
		assert.isTrue(fixture.find("#use-dr-new").is(":checked"));
		assert.equal(fixture.find("#from-dr-new").val(), "01/01");
		assert.equal(fixture.find("#to-dr-new").val(), "02/02");
	});

	it("renders accessible point-removal buttons", function () {
		var page = OSApp.Programs.makeProgram21(0, true);
		fixture.append(page);
		var removeButton = fixture.find(".split-remove").first();

		assert.equal(removeButton.prop("tagName"), "BUTTON");
		assert.equal(removeButton.attr("type"), "button");
		assert.equal(removeButton.attr("aria-label"), "Delete Point 1");
		assert.equal(removeButton.attr("title"), "Delete Point 1");

		removeButton.trigger("click");
		assert.lengthOf(fixture.find("#sensor-splits-body-new tr"), 1);
	});

	it("escapes controller-provided program and station names at render boundaries", function () {
		var programName = "\"><img id='program-name-injection'>";
		var stationName = "</label><img id='station-name-injection'>";
		OSApp.currentSession.controller.programs.pd[0][5] = programName;
		OSApp.Stations.getName.returns(stationName);
		var page = OSApp.Programs.makeProgram21(0, false);
		fixture.append(page);

		assert.lengthOf(fixture.find("#program-name-injection, #station-name-injection"), 0);
		assert.equal(fixture.find("#name-0").val(), programName);
		assert.equal(fixture.find("label[for='station_0-0']").text(), stationName + ":");
		fixture.find(".program-name").each(function () {
			assert.equal($(this).text(), programName);
		});
	});

	it("escapes controller-provided program names in confirmation dialogs", function () {
		var maliciousName = "<img id='program-confirmation-injection'>Program";
		OSApp.currentSession.controller.programs.pd[ 0 ][ 5 ] = maliciousName;
		OSApp.Firmware.checkOSVersion.callsFake(function (version) {
			return version !== 2214;
		});
		var areYouSure = sandbox.stub(OSApp.UIDom, "areYouSure"),
			clock = sandbox.useFakeTimers();

		OSApp.Programs.deleteProgram(0);
		var deleteQuestion = areYouSure.firstCall.args[ 0 ],
			deleteContent = $("<div></div>").html(deleteQuestion);
		assert.lengthOf(deleteContent.find("#program-confirmation-injection"), 0);
		assert.include(deleteContent.text(), maliciousName);

		sandbox.stub(OSApp.StationQueue, "isActive").returns(0);
		sandbox.stub(OSApp.Stations, "getPID").returns(1);
		areYouSure.resetHistory();
		OSApp.Stations.submitRunonce([ 60 ], 0, 0);
		clock.tick(100);

		assert.isTrue(areYouSure.calledOnce);
		assert.equal(areYouSure.firstCall.args[ 1 ], OSApp.Utils.htmlEscape(maliciousName));
		assert.lengthOf($("<div></div>").html(areYouSure.firstCall.args[ 1 ]).find("#program-confirmation-injection"), 0);
	});

	it("serializes nondecreasing points while preserving duplicate x values as steps", function () {
		fixture.append(
			"<input type='checkbox' id='use-sn-new' checked>" +
			"<select id='sen-adj-sid-new'><option value='42' selected>Sensor</option></select>" +
			"<table><tbody id='sensor-splits-body-new'>" +
			"<tr><td><input class='split-x' value='10'></td><td><input class='split-y' value='50'></td></tr>" +
			"<tr><td><input class='split-x' value='0'></td><td><input class='split-y' value='100'></td></tr>" +
			"<tr><td><input class='split-x' value='10'></td><td><input class='split-y' value='75'></td></tr>" +
			"</tbody></table>"
		);

		assert.equal(OSApp.Programs.getSenAdjURL("new"), "&snadj=1,42,0,1,10,0.5,10,0.75");
	});

	it("rejects incomplete or negative adjustment points before submit", function () {
		fixture.append(
			"<input type='checkbox' id='use-sn-new' checked>" +
			"<select id='sen-adj-sid-new'><option value='42' selected>Sensor</option></select>" +
			"<table><tbody id='sensor-splits-body-new'>" +
			"<tr><td><input class='split-x' value='10'></td><td><input class='split-y'></td></tr>" +
			"</tbody></table>"
		);

		assert.throws(function () {
			OSApp.Programs.getSenAdjURL("new");
		}, "Complete or remove every sensor adjustment point");

		fixture.find(".split-y").val(-1);
		assert.throws(function () {
			OSApp.Programs.getSenAdjURL("new");
		}, "Watering percentages cannot be negative");
	});

	it("requires a selected sensor and at least one point when adjustment is enabled", function () {
		fixture.append(
			"<input type='checkbox' id='use-sn-new' checked>" +
			"<select id='sen-adj-sid-new'><option value='0' selected>None</option><option value='42'>Sensor</option></select>" +
			"<table><tbody id='sensor-splits-body-new'></tbody></table>"
		);

		assert.throws(function () {
			OSApp.Programs.getSenAdjURL("new");
		}, "Select a sensor before enabling sensor adjustment");

		fixture.find("#sen-adj-sid-new").val("42");
		assert.throws(function () {
			OSApp.Programs.getSenAdjURL("new");
		}, "Add at least one sensor adjustment point");
	});

	it("rejects incomplete configured points even when adjustment is disabled", function () {
		fixture.append(
			"<input type='checkbox' id='use-sn-new'>" +
			"<select id='sen-adj-sid-new'><option value='42' selected>Sensor</option></select>" +
			"<table><tbody id='sensor-splits-body-new'>" +
			"<tr><td><input class='split-x' value='10'></td><td><input class='split-y'></td></tr>" +
			"</tbody></table>"
		);

		assert.throws(function () {
			OSApp.Programs.getSenAdjURL("new");
		}, "Complete or remove every sensor adjustment point");
	});

	it("disables sensor adjustment without erasing its sensor, points, or other flags", function () {
		OSApp.currentSession.controller.programs.pd[0][7].flag = 5;
		var page = OSApp.Programs.makeProgram21(0, false);
		fixture.append(page);
		fixture.find("#use-sn-0").prop("checked", false);

		assert.equal(OSApp.Programs.getSenAdjURL(0), "&snadj=4,42,0,1,10,0.5");
	});

	it("serializes an unconfigured disabled adjustment as a reset", function () {
		fixture.append(
			"<input type='checkbox' id='use-sn-new'>" +
			"<select id='sen-adj-sid-new'><option value='0' selected>None</option></select>" +
			"<table><tbody id='sensor-splits-body-new'></tbody></table>"
		);

		assert.equal(OSApp.Programs.getSenAdjURL("new"), "&snadj=0,0");
	});

	it("destroys the Chart instance before its editor DOM is discarded", function () {
		var page = OSApp.Programs.makeProgram21(0, true);
		fixture.append(page);

		assert.lengthOf(charts, 1);
		OSApp.Programs.destroySensorAdjustmentCharts(fixture);
		assert.isTrue(charts[0].destroy.calledOnce);
		assert.isUndefined(fixture.find("#sensor-chart-new").data("sensorAdjustmentChart"));
	});

	it("cancels a deferred chart resize when the editor is destroyed", function () {
		var clock = sandbox.useFakeTimers();
		var page = OSApp.Programs.makeProgram21(0, true);
		fixture.append(page);
		fixture.find("#use-sn-new").prop("checked", true).trigger("change");

		OSApp.Programs.destroySensorAdjustmentCharts(fixture);
		clock.tick(1);

		assert.isFalse(charts[0].resize.called);
		assert.isTrue(charts[0].destroy.calledOnce);
	});

	it("destroys an expanded program chart before collapse empties its editor", function () {
		sandbox.stub(OSApp.UIDom, "changeHeader").returns($());
		OSApp.Programs.displayPage();
		var program = $("#program-0");

		program.trigger("collapsibleexpand");
		assert.lengthOf(charts, 1);

		program.trigger("collapsiblecollapse");
		assert.isTrue(charts[0].destroy.calledOnce);
		assert.isTrue(program.find(".ui-collapsible-content").is(":empty"));
	});

	it("refreshes the expanded sensor value and chart marker on controller data refresh", function () {
		var page = OSApp.Programs.makeProgram21(0, true);
		fixture.append(page);
		var updateCount = charts[0].update.callCount;

		OSApp.currentSession.controller.sensors.sn[0].value = 7;
		$("html").trigger("datarefresh");

		assert.equal(fixture.find("#sen-adj-current-text-new").text(), "7 V");
		assert.equal(charts[0].update.callCount, updateCount + 1);

		OSApp.Programs.destroySensorAdjustmentCharts(fixture);
		OSApp.currentSession.controller.sensors.sn[0].value = 9;
		$("html").trigger("datarefresh");
		assert.equal(fixture.find("#sen-adj-current-text-new").text(), "7 V");
	});

	it("disables Run until the current adjustment request settles", function () {
		delete OSApp.currentSession.controller.sensors;
		var request = $.Deferred();
		var program = $("<fieldset id='program-0'><div class='ui-collapsible-content'></div></fieldset>").appendTo(fixture);
		var openDialog = sandbox.stub(OSApp.Programs, "openRunProgramDialog");

		OSApp.Programs.expandProgram(program, function () {
			return request.promise();
		});

		var runButton = program.find("#run-0");
		assert.isTrue(runButton.prop("disabled"));
		runButton.trigger("click");
		assert.isFalse(openDialog.called);

		request.resolve({ jpa: [ { wa: 1, sa: 1, ta: 1 } ] });
		assert.isFalse(runButton.prop("disabled"));
		runButton.trigger("click");
		assert.isTrue(openDialog.calledOnce);
	});

	it("re-enables Run without adjustment options when factors cannot be loaded", function () {
		delete OSApp.currentSession.controller.sensors;
		var request = $.Deferred();
		var program = $("<fieldset id='program-0'><div class='ui-collapsible-content'></div></fieldset>").appendTo(fixture);
		var openDialog = sandbox.stub(OSApp.Programs, "openRunProgramDialog");
		request.reject({ status: 500 });

		OSApp.Programs.expandProgram(program, function () {
			return request.promise();
		});

		var runButton = program.find("#run-0");
		assert.isFalse(runButton.prop("disabled"));
		assert.isFalse(runButton.hasClass("ui-state-disabled"));
		assert.equal(runButton.attr("title"), "Program adjustments are unavailable.");
		runButton.trigger("click");
		assert.isTrue(openDialog.calledOnce);
	});

	it("re-enables Run when adjustment factors are malformed", function () {
		delete OSApp.currentSession.controller.sensors;
		var request = $.Deferred();
		var program = $("<fieldset id='program-0'><div class='ui-collapsible-content'></div></fieldset>").appendTo(fixture);
		var openDialog = sandbox.stub(OSApp.Programs, "openRunProgramDialog");

		OSApp.Programs.expandProgram(program, function () {
			return request.promise();
		});
		request.resolve({ jpa: [] });

		var runButton = program.find("#run-0");
		assert.isFalse(runButton.prop("disabled"));
		assert.equal(runButton.attr("title"), "Program adjustments are unavailable.");
		runButton.trigger("click");
		assert.isTrue(openDialog.calledOnce);
	});

	it("replaces a canceled run dialog handler instead of queuing stale runs", function () {
		delete OSApp.currentSession.controller.sensors;
		var popup = $(
			"<div id='run-program-dialog'>" +
			"<button id='rp-run'></button>" +
			"<input type='checkbox' id='rp-apply-wl'>" +
			"<input type='checkbox' id='rp-apply-sa'>" +
			"<input type='checkbox' id='rp-create-single'>" +
			"</div>"
		).appendTo(fixture);
		var program = $("<fieldset id='program-0'><div class='ui-collapsible-content'></div></fieldset>").appendTo(fixture);
		var openDialog = sandbox.stub(OSApp.Programs, "openRunProgramDialog");
		var submitRunonce = sandbox.stub(OSApp.Stations, "submitRunonce");
		sandbox.stub(OSApp.StationQueue, "isActive").returns(-1);
		sandbox.stub($.fn, "popup").returnsThis();

		OSApp.Programs.expandProgram(program);
		program.find("#run-0").trigger("click");
		program.find("#run-0").trigger("click");
		popup.find("#rp-run").trigger("click");

		assert.isTrue(openDialog.calledTwice);
		assert.isTrue(submitRunonce.calledOnce);
	});

	it("matches firmware by truncating after weather and sensor scaling", function () {
		delete OSApp.currentSession.controller.sensors;
		OSApp.currentSession.controller.programs.pd[0][4] = [ 3 ];
		var popup = $(
			"<div id='run-program-dialog'>" +
			"<button id='rp-run'></button>" +
			"<input type='checkbox' id='rp-apply-wl' checked>" +
			"<input type='checkbox' id='rp-apply-sa' checked>" +
			"<input type='checkbox' id='rp-create-single'>" +
			"</div>"
		).data({ weatherPercent: 60, saFactor: 0.6 }).appendTo(fixture);
		var program = $("<fieldset id='program-0'><div class='ui-collapsible-content'></div></fieldset>").appendTo(fixture);
		sandbox.stub(OSApp.Programs, "openRunProgramDialog");
		var submitRunonce = sandbox.stub(OSApp.Stations, "submitRunonce");
		sandbox.stub(OSApp.StationQueue, "isActive").returns(-1);
		sandbox.stub($.fn, "popup").returnsThis();

		OSApp.Programs.expandProgram(program);
		program.find("#run-0").trigger("click");
		popup.find("#rp-run").trigger("click");

		assert.deepEqual(submitRunonce.firstCall.args[0], [ 0, 0 ]);
	});

	it("uses integer weather-percent arithmetic for manual runs", function () {
		delete OSApp.currentSession.controller.sensors;
		OSApp.currentSession.controller.programs.pd[0][4] = [ 25 ];
		var popup = $(
			"<div id='run-program-dialog'>" +
			"<button id='rp-run'></button>" +
			"<input type='checkbox' id='rp-apply-wl' checked>" +
			"<input type='checkbox' id='rp-apply-sa'>" +
			"<input type='checkbox' id='rp-create-single'>" +
			"</div>"
		).data({ weatherPercent: 116 }).appendTo(fixture);
		var program = $("<fieldset id='program-0'><div class='ui-collapsible-content'></div></fieldset>").appendTo(fixture);
		sandbox.stub(OSApp.Programs, "openRunProgramDialog");
		var submitRunonce = sandbox.stub(OSApp.Stations, "submitRunonce");
		sandbox.stub(OSApp.StationQueue, "isActive").returns(-1);
		sandbox.stub($.fn, "popup").returnsThis();

		OSApp.Programs.expandProgram(program);
		program.find("#run-0").trigger("click");
		popup.find("#rp-run").trigger("click");

		assert.deepEqual(submitRunonce.firstCall.args[0], [ 29, 0 ]);
	});

	it("honors an active weather restriction in the no-jpa run dialog fallback", function () {
		delete OSApp.currentSession.controller.sensors;
		OSApp.currentSession.controller.settings.wtrestr = 1;
		sandbox.stub($.fn, "popup").returnsThis();
		sandbox.stub(OSApp.Storage, "get").callsFake(function (_key, callback) {
			callback({});
		});
		sandbox.stub(OSApp.StationQueue, "isActive").returns(-1);

		OSApp.Programs.openRunProgramDialog(0, [ 120 ], true, false);

		assert.equal($("#run-program-dialog").data("weatherPercent"), 0);
		assert.equal($("#rp-apply-wl-percent").text(), "(0%)");
	});

	it("resets the repeat run mode every time the dialog opens", function () {
		var popup = $(
			"<div id='run-program-dialog'>" +
			"<span id='rp-apply-wl-percent'></span>" +
			"<span id='rp-apply-sa-percent'></span>" +
			"<div id='rp-sa-wrap'></div>" +
			"<div id='rp-repeat-wrap'><input type='checkbox' id='rp-create-single'></div>" +
			"<div id='rp-qo-wrap'></div>" +
			"<input type='checkbox' id='rp-apply-wl'>" +
			"<input type='checkbox' id='rp-apply-sa'>" +
			"<button id='rp-cancel'></button>" +
			"</div>"
		).appendTo(fixture);
		popup.find("#rp-create-single").prop("checked", false);
		sandbox.stub($.fn, "popup").returnsThis();
		sandbox.stub(OSApp.Storage, "get").callsFake(function (key, callback) {
			callback({});
		});
		sandbox.stub(OSApp.StationQueue, "isActive").returns(-1);

		OSApp.Programs.openRunProgramDialog(0, [ 60 ], true, true);

		assert.isTrue(popup.find("#rp-create-single").is(":checked"));
		popup.find("#rp-create-single").prop("checked", false);
		OSApp.Programs.openRunProgramDialog(0, [ 60 ], true, true);
		assert.isTrue(popup.find("#rp-create-single").is(":checked"));
	});

	it("caps adjusted program durations and resolves solar sentinels before scaling", function () {
		delete OSApp.currentSession.controller.sensors;
		OSApp.currentSession.controller.programs.pd[0][4] = [ 40000, 65534, 65535 ];
		var popup = $(
			"<div id='run-program-dialog'>" +
			"<button id='rp-run'></button>" +
			"<input type='checkbox' id='rp-apply-wl' checked>" +
			"<input type='checkbox' id='rp-apply-sa'>" +
			"<input type='checkbox' id='rp-create-single'>" +
			"</div>"
		).data({ weatherPercent: 250 }).appendTo(fixture);
		var program = $("<fieldset id='program-0'><div class='ui-collapsible-content'></div></fieldset>").appendTo(fixture);
		sandbox.stub(OSApp.Programs, "openRunProgramDialog");
		var submitRunonce = sandbox.stub(OSApp.Stations, "submitRunonce");
		sandbox.stub(OSApp.Stations, "getStationDuration").callsFake(function (duration) {
			return duration === 65534 ? 10000 : 20000;
		});
		sandbox.stub(OSApp.StationQueue, "isActive").returns(-1);
		sandbox.stub($.fn, "popup").returnsThis();

		OSApp.Programs.expandProgram(program);
		program.find("#run-0").trigger("click");
		popup.find("#rp-run").trigger("click");

		assert.deepEqual(submitRunonce.firstCall.args[0], [ 65533, 25000, 50000, 0 ]);
	});

	it("persists the visible Run-Once reset choices", function () {
		delete OSApp.currentSession.controller.sensors;
		var storageSet = sandbox.stub(OSApp.Storage, "set");
		sandbox.stub(OSApp.Storage, "get").callsFake(function (keys, callback) {
			if (Array.isArray(keys)) {
				callback({ runOnceAdj: "custom", runOnceAdjPct: "175" });
			} else {
				callback({});
			}
		});
		sandbox.stub(OSApp.StationQueue, "isActive").returns(-1);
		sandbox.stub(OSApp.UIDom, "changeHeader").returns($());

		OSApp.Programs.displayPageRunOnce();
		var page = $("#runonce");
		assert.isTrue(page.find("#wl-custom").is(":checked"));
		assert.equal(page.find("#wl-custom-val").val(), "175");

		page.find(".rreset").trigger("click");

		assert.isTrue(page.find("#wl-none").is(":checked"));
		assert.equal(page.find("#wl-custom-val").val(), "100");
		assert.isTrue(storageSet.calledWithMatch({ runOnceAdj: "none", runOnceAdjPct: "100" }));
	});

	it("clears stale adjustment factors and ignores a late response for another controller", function () {
		var request = $.Deferred();
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());
		var changeHeader = sandbox.stub(OSApp.UIDom, "changeHeader").returns($());
		OSApp.currentSession.controller.jpaData = [ { sa: 9 } ];
		OSApp.currentSession.controller.jpaMaxRuntime = 123;

		OSApp.Programs.displayPage();
		$("#programs").trigger("pageshow");

		assert.isTrue(sendToOS.calledWith("/jpa?pw=", "json"));
		assert.deepEqual(OSApp.currentSession.controller.jpaData, []);
		assert.notProperty(OSApp.currentSession.controller, "jpaMaxRuntime");

		var replacement = makeController();
		OSApp.currentSession.controller = replacement;
		request.resolve({ jpa: [ { wa: 1, sa: 0.5, ta: 0.5 } ] });

		assert.notProperty(replacement, "jpaData");
		assert.isTrue(changeHeader.called);
	});

	it("refetches factors after a program change and ignores the superseded response", function () {
		var firstRequest = $.Deferred();
		var secondRequest = $.Deferred();
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS");
		sendToOS.onFirstCall().returns(firstRequest.promise());
		sendToOS.onSecondCall().returns(secondRequest.promise());
		sandbox.stub(OSApp.UIDom, "changeHeader").returns($());

		OSApp.Programs.displayPage();
		$("#programs").trigger("pageshow");
		$("#programs").trigger("programrefresh");

		assert.equal(sendToOS.callCount, 2);
		firstRequest.resolve({ jpa: [ { wa: 1, sa: 9, ta: 9 } ] });
		assert.deepEqual(OSApp.currentSession.controller.jpaData, []);

		secondRequest.resolve({ jpa: [ { wa: 1, sa: 0.5, ta: 0.5 } ], maxrt: 604800 });
		assert.deepEqual(OSApp.currentSession.controller.jpaData, [ { wa: 1, sa: 0.5, ta: 0.5 } ]);
		assert.equal(OSApp.currentSession.controller.jpaMaxRuntime, 604800);
	});

	it("rejects malformed maxrt adjustment metadata", function () {
		assert.isFalse(OSApp.Programs.isProgramAdjustmentDataValid(
			{ jpa: [ { wa: 1, sa: 1, ta: 1 } ], maxrt: 0 },
			OSApp.currentSession.controller
		));
	});

	it("renders preview as unavailable when adjustment factors fail to load", function () {
		var request = $.Deferred();
		OSApp.currentSession.controller.settings.devt = 1700000000;
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());
		sandbox.stub(OSApp.UIDom, "changeHeader").returns($());
		var showError = sandbox.stub(OSApp.Errors, "showError");

		OSApp.Programs.displayPagePreviewPrograms();
		$("#preview").trigger("pageshow");
		request.reject({ status: 500 });

		assert.equal(
			$("#preview .preview-adjustment-unavailable").text(),
			"Program preview is unavailable because sensor adjustments could not be loaded."
		);
		assert.isTrue(showError.calledWith("Unable to load program adjustments. Try again."));
	});

	it("renders preview as unavailable for a malformed adjustment payload", function () {
		var request = $.Deferred();
		OSApp.currentSession.controller.settings.devt = 1700000000;
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());
		sandbox.stub(OSApp.UIDom, "changeHeader").returns($());
		sandbox.stub(OSApp.Errors, "showError");

		OSApp.Programs.displayPagePreviewPrograms();
		$("#preview").trigger("pageshow");
		request.resolve({ jpa: [] });

		assert.equal(
			$("#preview .preview-adjustment-unavailable").text(),
			"Program preview is unavailable because sensor adjustments could not be loaded."
		);
	});

	it("hides the loader and skips success handling when a program save fails", function () {
		var page = OSApp.Programs.makeProgram21(0, true);
		fixture.append(page);
		var loading = sandbox.stub($.mobile, "loading");
		var request = $.Deferred().reject({ status: 500 });
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());
		var updatePrograms = sandbox.stub(OSApp.Sites, "updateControllerPrograms");
		var goBack = sandbox.stub(OSApp.UIDom, "goBack");

		OSApp.Programs.submitProgram21("new", true);

		assert.isTrue(sendToOS.calledOnce);
		assert.match(sendToOS.firstCall.args[0], /^\/cp\?pw=&pid=-1/);
		assert.isTrue(loading.calledWith("show"));
		assert.isTrue(loading.calledWith("hide"));
		assert.isFalse(updatePrograms.called);
		assert.isFalse(goBack.called);
	});

	it("hides the loader when moving a program fails", function () {
		var loading = sandbox.stub($.mobile, "loading");
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().reject({ status: 500 }).promise());
		var updatePrograms = sandbox.stub(OSApp.Sites, "updateControllerPrograms");
		sandbox.stub(OSApp.UIDom, "changeHeader").returns($());

		OSApp.Programs.displayPage();
		$("#programs .move-up").first().trigger("click");

		assert.isTrue(sendToOS.calledWith("/up?pw=&pid=0"));
		assert.isTrue(loading.calledWith("show"));
		assert.isTrue(loading.calledWith("hide"));
		assert.isFalse(updatePrograms.called);
	});

	it("keeps move success handling chained to the program refresh", function () {
		var loading = sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		var updatePrograms = sandbox.stub(OSApp.Sites, "updateControllerPrograms")
			.returns($.Deferred().reject({ status: 500 }).promise());
		sandbox.stub(OSApp.UIDom, "changeHeader").returns($());

		OSApp.Programs.displayPage();
		$("#programs .move-up").first().trigger("click");

		assert.isTrue(updatePrograms.calledOnce);
		assert.isTrue(loading.calledWith("show"));
		assert.isTrue(loading.calledWith("hide"));
	});

	it("hides the loader and skips refresh when deleting a program fails", function () {
		var loading = sandbox.stub($.mobile, "loading");
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().reject({ status: 500 }).promise());
		var updatePrograms = sandbox.stub(OSApp.Sites, "updateControllerPrograms");
		sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (_question, _detail, confirm) {
			confirm();
		});

		OSApp.Programs.deleteProgram(0);

		assert.isTrue(sendToOS.calledWith("/dp?pw=&pid=0"));
		assert.isTrue(loading.calledWith("show"));
		assert.isTrue(loading.calledWith("hide"));
		assert.isFalse(updatePrograms.called);
	});

	it("does not report deletion success when the program refresh fails", function () {
		var loading = sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		var updatePrograms = sandbox.stub(OSApp.Sites, "updateControllerPrograms")
			.returns($.Deferred().reject({ status: 500 }).promise());
		var showError = sandbox.stub(OSApp.Errors, "showError");
		sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (_question, _detail, confirm) {
			confirm();
		});

		OSApp.Programs.deleteProgram(0);

		assert.isTrue(updatePrograms.calledOnce);
		assert.isTrue(loading.calledWith("show"));
		assert.isTrue(loading.calledWith("hide"));
		assert.isFalse(showError.called);
	});
});

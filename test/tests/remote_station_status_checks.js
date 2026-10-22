/* eslint-disable */

describe("Remote Station Status Checks", function () {
	var sandbox, controller, stations, siteSelector, createdSiteSelector, saved;

	beforeEach(function () {
		sandbox = sinon.createSandbox();
		controller = OSApp.currentSession.controller;
		stations = controller.stations;
		saved = {
			remoteStations: controller.remoteStations,
			special: controller.special,
			status: controller.status,
			ps: controller.settings.ps,
			stnSpe: stations.stn_spe,
			stnDis: stations.stn_dis
		};

		controller.remoteStations = {};
		controller.special = {};
		controller.status = new Array(stations.snames.length).fill(0);
		controller.settings.ps = Array.from({ length: stations.snames.length }, function () {
			return [ 0, 0, 0, 0 ];
		});
		stations.stn_spe = new Array(Math.ceil(stations.snames.length / 8)).fill(0);
		stations.stn_dis = new Array(Math.ceil(stations.snames.length / 8)).fill(0);
		stations.stn_spe[0] |= 1;
		controller.special[0] = {
			st: OSApp.Constants.stations.SPECIAL_TYPE_REMOTE_IP,
			sd: "c0a80152005000"
		};

		siteSelector = $("#site-selector");
		createdSiteSelector = siteSelector.length === 0;
		if (createdSiteSelector) {
			siteSelector = $("<select id='site-selector'><option selected>Test</option></select>").appendTo("body");
		} else {
			siteSelector.val("Test");
		}

		sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.currentSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Storage, "get").callsFake(function (_query, callback) {
			callback({ sites: JSON.stringify({ Test: { images: {}, notes: {}, lastRunTime: {} } }) });
		});
		sandbox.stub(OSApp.Sites, "ensureControllerStationSpecial").callsFake(function (callback) {
			if (callback) { callback(); }
			return $.Deferred().resolve().promise();
		});
	});

	afterEach(function () {
		sandbox.restore();
		controller.remoteStations = saved.remoteStations;
		controller.special = saved.special;
		controller.status = saved.status;
		controller.settings.ps = saved.ps;
		stations.stn_spe = saved.stnSpe;
		stations.stn_dis = saved.stnDis;
		$("#sprinklers").remove();
		if (createdSiteSelector) { siteSelector.remove(); }
	});

	it("shows pending and confirmed remote state on the station card", function () {
		controller.remoteStations[0] = [ OSApp.Constants.stations.REMOTE_STATUS_PENDING, 1, 1, 0 ];
		OSApp.Dashboard.displayPage();

		var card = $("#station_0").closest(".card"),
			status = card.find(".remote-station-status");
		assert.equal(status.attr("data-tooltip"), "Remote station: Confirming valve on…");
		assert.equal(status.attr("aria-label"), status.attr("data-tooltip"));
		assert.isTrue(status.hasClass("pending"));
		assert.equal(status.attr("tabindex"), "0");
		assert.equal(status.find(".remote-station-status-icon").attr("aria-hidden"), "true");
		assert.equal(status.text(), "");
		assert.strictEqual(status.parent()[0], card[0]);
		assert.isTrue(card.find(".special-station").hasClass("hidden"));
		assert.equal(card.find(".special-station").text(), "");

		$("#sprinklers").addClass("ui-page-active").trigger("pageshow");
		controller.remoteStations[0] = [ OSApp.Constants.stations.REMOTE_STATUS_CONFIRMED, 1, 0, 0 ];
		$("html").trigger("datarefresh");
		status = card.find(".remote-station-status");
		assert.equal(status.attr("data-tooltip"), "Remote station: Valve confirmed on");
		assert.equal(status.attr("aria-label"), "Remote station: Valve confirmed on");
		assert.isTrue(status.hasClass("confirmed"));
		assert.isFalse(status.hasClass("pending"));
	});

	it("uses a spinner while retrying and an error indicator after failure", function () {
		controller.remoteStations[0] = [ OSApp.Constants.stations.REMOTE_STATUS_RETRYING, 0, 2, 1 ];
		OSApp.Dashboard.displayPage();

		var card = $("#station_0").closest(".card"),
			status = card.find(".remote-station-status");
		assert.equal(status.attr("data-tooltip"), "Remote station: Remote state not confirmed; retrying");
		assert.isTrue(status.hasClass("retrying"));

		$("#sprinklers").addClass("ui-page-active").trigger("pageshow");
		controller.remoteStations[0] = [ OSApp.Constants.stations.REMOTE_STATUS_FAILED, 0, 3, 1 ];
		$("html").trigger("datarefresh");
		status = card.find(".remote-station-status");
		assert.equal(status.attr("data-tooltip"), "Remote station: Remote unreachable; retrying in background");
		assert.isTrue(status.hasClass("failed"));
		assert.isFalse(status.hasClass("retrying"));
		assert.equal(status.attr("role"), "status");
	});

	it("replaces the Remote OTC badge when confirmation status is available", function () {
		controller.special[0].st = OSApp.Constants.stations.SPECIAL_TYPE_REMOTE_OTC;
		controller.remoteStations[0] = [ OSApp.Constants.stations.REMOTE_STATUS_CONFIRMED, 0, 0, 0 ];
		OSApp.Dashboard.displayPage();

		var card = $("#station_0").closest(".card");
		assert.isTrue(card.find(".special-station").hasClass("hidden"));
		assert.isTrue(card.find(".remote-station-status").hasClass("confirmed"));
		assert.equal(card.find(".remote-station-status").attr("data-tooltip"), "Remote station: Valve confirmed off");
	});

	it("remains compatible with firmware that does not report remote status", function () {
		OSApp.Dashboard.displayPage();
		var card = $("#station_0").closest(".card");
		assert.lengthOf(card.find(".remote-station-status"), 0);
		assert.isFalse(card.find(".special-station").hasClass("hidden"));
		assert.equal(card.find(".special-station").text(), OSApp.Stations.getSpecialBadge(0));
	});
});

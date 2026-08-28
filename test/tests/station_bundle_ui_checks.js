/* eslint-disable */

describe("Dashboard Bundle Station Checks", function () {
	var sandbox, controller, stations, siteSelector, createdSiteSelector, saved;

	beforeEach(function () {
		sandbox = sinon.createSandbox();
		controller = OSApp.currentSession.controller;
		stations = controller.stations;
		saved = {
			bundleApplied: controller.bundleApplied,
			special: controller.special,
			status: controller.status,
			ps: controller.settings.ps,
			stnBnd: stations.stn_bnd,
			stnSpe: stations.stn_spe,
			stnDis: stations.stn_dis,
			bmt: stations.bmt,
			mas: controller.options.mas,
			mas2: controller.options.mas2,
			mas3: controller.options.mas3,
			mas4: controller.options.mas4
		};

		controller.bundleApplied = [ 0 ];
		controller.special = {};
		controller.status = new Array(stations.snames.length).fill(0);
		controller.settings.ps = Array.from({ length: stations.snames.length }, function () {
			return [ 0, 0, 0, 0 ];
		});
		stations.stn_bnd = new Array(Math.ceil(stations.snames.length / 8)).fill(0);
		stations.stn_spe = new Array(Math.ceil(stations.snames.length / 8)).fill(0);
		stations.stn_dis = new Array(Math.ceil(stations.snames.length / 8)).fill(0);
		stations.bmt = 1;
		controller.options.mas = 0;
		controller.options.mas2 = 0;
		controller.options.mas3 = 0;
		controller.options.mas4 = 0;

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
		sandbox.stub(OSApp.Storage, "set").callsFake(function (_data, callback) {
			if (callback) { callback(); }
		});
		sandbox.stub(OSApp.Network, "cloudSaveSites");
		sandbox.stub(OSApp.Errors, "showError");
	});

	afterEach(function () {
		sandbox.restore();
		controller.bundleApplied = saved.bundleApplied;
		controller.special = saved.special;
		controller.status = saved.status;
		controller.settings.ps = saved.ps;
		stations.stn_bnd = saved.stnBnd;
		stations.stn_spe = saved.stnSpe;
		stations.stn_dis = saved.stnDis;
		stations.bmt = saved.bmt;
		controller.options.mas = saved.mas;
		controller.options.mas2 = saved.mas2;
		controller.options.mas3 = saved.mas3;
		controller.options.mas4 = saved.mas4;
		$("#bundle-active-info, #stn_attrib, #sprinklers").remove();
		if (createdSiteSelector) { siteSelector.remove(); }
	});

	function setBundle(leaderSid, members) {
		stations.stn_bnd[(leaderSid / 8) >> 0] |= 1 << (leaderSid % 8);
		stations.stn_spe[(leaderSid / 8) >> 0] |= 1 << (leaderSid % 8);
		controller.special[leaderSid] = {
			st: OSApp.Constants.stations.SPECIAL_TYPE_BUNDLE,
			sd: OSApp.Bundles.encodeMembers(members)
		};
	}

	it("renders Bundle Station badges and derived-only activity without a stop action", function () {
		setBundle(0, [ 1 ]);
		controller.status[0] = 1;
		controller.status[1] = 1;
		controller.settings.ps[0] = [ 1, 60, 0, 0 ];
		controller.bundleApplied[0] = 2;
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Sites, "updateController");

		OSApp.Dashboard.displayPage();

		assert.equal($("#station_0").siblings(".station-type-badge").text(), "BS");
		assert.equal($("#station_1").siblings(".rem").text(), "Active via Bundle Station");
		$("#station_1").closest(".card").trigger("click");
		assert.lengthOf($("#bundle-active-info"), 1);
		assert.isFalse(sendToOS.called);
	});

	it("submits a full Bundle Station member bitmap", function () {
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
			return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : { result: 1 }).promise();
		});
		sandbox.stub(OSApp.Sites, "updateController");

		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		var popup = $("#stn_attrib");
		popup.find("#hs").val(String(OSApp.Constants.stations.SPECIAL_TYPE_BUNDLE)).trigger("change");
		popup.find(".bundle-member[value='1']").prop("checked", true).trigger("change");
		popup.find("form").trigger("submit");

		var stationSave = sendToOS.getCalls().map(function (call) { return call.args[0]; })
			.find(function (url) { return url.indexOf("/cs?") === 0; });
		var params = new URLSearchParams(stationSave.split("?")[1]);
		assert.equal(params.get("sid"), "0");
		assert.equal(params.get("st"), "7");
		assert.equal(params.get("sd"), OSApp.Bundles.encodeMembers([ 1 ]));
	});

	it("clears bundle data when converting a leader to Standard", function () {
		setBundle(0, [ 1 ]);
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
			return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : { result: 1 }).promise();
		});
		sandbox.stub(OSApp.Sites, "updateController");

		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		var popup = $("#stn_attrib");
		popup.find("#hs").val("0").trigger("change");
		popup.find("form").trigger("submit");

		var stationSave = sendToOS.getCalls().map(function (call) { return call.args[0]; })
			.find(function (url) { return url.indexOf("/cs?") === 0; });
		var params = new URLSearchParams(stationSave.split("?")[1]);
		assert.equal(params.get("st"), "0");
		assert.equal(params.get("sd"), "0");
	});

	it("disables special station types for a referenced member", function () {
		setBundle(1, [ 0 ]);
		sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
			return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : { result: 1 }).promise();
		});
		sandbox.stub(OSApp.Sites, "updateController");

		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		var options = $("#stn_attrib #hs option");

		assert.isFalse(options.filter("[value='0']").prop("disabled"));
		options.filter(function () {
			return this.value !== "0";
		}).each(function () {
			assert.isTrue(this.disabled, "station type " + this.value + " should be disabled");
		});
	});
});

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
			specialUnavailable: controller.specialUnavailable,
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
		controller.specialUnavailable = saved.specialUnavailable;
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

	it("marks bundle leaders and members with related badges", function () {
		setBundle(0, [ 1 ]);
		stations.stn_spe[0] |= 1 << 2;
		controller.special[2] = {
			st: OSApp.Constants.stations.SPECIAL_TYPE_RF,
			sd: "0000000000000000"
		};
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Sites, "updateController");

		OSApp.Dashboard.displayPage();

		var leaderBadge = $("#station_0").siblings(".station-type-badge");
		var memberBadge = $("#station_1").siblings(".station-type-badge");

		assert.equal(leaderBadge.text(), "BS");
		assert.isTrue(leaderBadge.hasClass("bundle-badge"));
		assert.isFalse(leaderBadge.hasClass("bundle-member-badge"));
		assert.equal(leaderBadge.attr("role"), "button");
		assert.equal(leaderBadge.attr("tabindex"), "0");

		assert.equal(memberBadge.text(), "bm");
		assert.isTrue(memberBadge.hasClass("bundle-badge"));
		assert.isTrue(memberBadge.hasClass("bundle-member-badge"));
		assert.isFalse(memberBadge.hasClass("hidden"));
		assert.include(memberBadge.attr("title"), OSApp.Stations.getName(0));
		assert.equal(memberBadge.attr("role"), "button");
		assert.equal(memberBadge.attr("tabindex"), "0");

		var rfBadge = $("#station_2").siblings(".station-type-badge");
		assert.equal(rfBadge.text(), "RF");
		assert.isFalse(rfBadge.hasClass("bundle-badge"));
		assert.equal(rfBadge.attr("role"), "button");
		assert.equal(rfBadge.attr("tabindex"), "0");

		// A station in no bundle keeps an empty, hidden badge.
		assert.isTrue($("#station_3").siblings(".station-type-badge").hasClass("hidden"));
	});

	it("refreshes special station data when an existing dashboard remains active", function () {
		var page = $("<div id='sprinklers' class='ui-page-active'></div>").appendTo("body"),
			refreshed = false,
			request = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				assert.equal(command, "/je?pw=");
				return $.Deferred().resolve({ "0": { st: 7, sd: "02" } }).promise();
			});

		stations.stn_spe[0] = 1;
		stations.stn_bnd[0] = 1;
		delete controller.special;
		delete controller.specialUnavailable;

		$("html").one("datarefresh.bundleSiteSwitch", function () {
			refreshed = true;
		});

		OSApp.UIDom.goHome(true);

		assert.isTrue(request.calledOnce);
		assert.equal(controller.special[0].st, 7);
		assert.isTrue(refreshed);
		page.remove();
	});

	it("does not open an old station dialog after switching controllers during /je", function () {
		var pending = $.Deferred();
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(pending.promise());
		sandbox.stub(OSApp.Sites, "updateController");

		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		assert.lengthOf($("#stn_attrib"), 0);

		try {
			OSApp.currentSession.controller = {};
			$.mobile.loading.resetHistory();
			pending.reject({ status: 0, statusText: "abort" });

			assert.lengthOf($("#stn_attrib"), 0);
			assert.isFalse(OSApp.Errors.showError.called);
			assert.isFalse($.mobile.loading.calledWith("hide"));
		} finally {
			OSApp.currentSession.controller = controller;
		}
	});

	it("names the owning bundle when the member badge is tapped, without prompting a run", function () {
		setBundle(0, [ 1 ]);
		setBundle(2, [ 1 ]);
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Sites, "updateController");
		var showDurationBox = sandbox.stub(OSApp.UIDom, "showDurationBox");

		OSApp.Dashboard.displayPage();
		$("#station_1").siblings(".bundle-member-badge").trigger("click");

		assert.lengthOf($("#bundle-active-info"), 1);
		assert.equal($("#bundle-active-info h3").text(), "Bundle Member");
		assert.lengthOf($("#bundle-active-info p.bundle-info-member"), 1);
		assert.equal($("#bundle-active-info p.bundle-info-member").text(), "This station is a bundle member of:");
		assert.lengthOf($("#bundle-active-info ul.bundle-info-list li"), 2);
		assert.equal($("#bundle-active-info ul.bundle-info-list li").eq(0).text(), OSApp.Stations.getName(0));
		assert.equal($("#bundle-active-info ul.bundle-info-list li").eq(1).text(), OSApp.Stations.getName(2));
		assert.isFalse(showDurationBox.called);
	});

	it("opens bundle member details using keyboard activation", function () {
		setBundle(0, [ 1 ]);
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Sites, "updateController");

		OSApp.Dashboard.displayPage();
		var memberBadge = $("#station_1").siblings(".bundle-member-badge");

		memberBadge.trigger($.Event("keydown", { keyCode: 40 }));
		assert.lengthOf($("#bundle-active-info"), 0);

		memberBadge.trigger($.Event("keydown", { keyCode: 13 }));
		assert.lengthOf($("#bundle-active-info"), 1);
		$("#bundle-active-info").remove();

		memberBadge.trigger($.Event("keydown", { keyCode: 32 }));
		assert.lengthOf($("#bundle-active-info"), 1);
	});

	it("opens Advanced settings from a special station badge", function () {
		stations.stn_spe[0] |= 1 << 2;
		controller.special[2] = {
			st: OSApp.Constants.stations.SPECIAL_TYPE_RF,
			sd: "0000000000000000"
		};
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Sites, "updateController");
		var showDurationBox = sandbox.stub(OSApp.UIDom, "showDurationBox");

		OSApp.Dashboard.displayPage();
		$("#station_2").siblings(".station-type-badge").trigger("click");

		assert.lengthOf($("#stn_attrib"), 1);
		assert.isFalse($("#stn_attrib li[data-tab='tab-basic']").hasClass("current"));
		assert.isTrue($("#stn_attrib li[data-tab='tab-advanced']").hasClass("current"));
		assert.isFalse($("#stn_attrib #tab-basic").hasClass("current"));
		assert.isTrue($("#stn_attrib #tab-advanced").hasClass("current"));
		assert.isFalse(showDurationBox.called);
	});

	it("shows the group letter in a settings circle and opens Basic settings", function () {
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Sites, "updateController");
		var showDurationBox = sandbox.stub(OSApp.UIDom, "showDurationBox");

		OSApp.Dashboard.displayPage();
		var settingsButton = $("#attrib-1");
		var groupLetter = settingsButton.find(".station-gid");

		assert.isFalse(settingsButton.hasClass("ui-icon-gear"));
		assert.isTrue(settingsButton.hasClass("station-group-settings"));
		assert.equal(settingsButton.attr("role"), "button");
		assert.equal(settingsButton.attr("tabindex"), "0");
		assert.equal(settingsButton.attr("aria-haspopup"), "dialog");
		assert.equal(groupLetter.text(), OSApp.Groups.mapGIDValueToName(OSApp.Stations.getGIDValue(1)));
		assert.include(settingsButton.attr("aria-label"), groupLetter.text());

		groupLetter.trigger("click");

		assert.lengthOf($("#stn_attrib"), 1);
		assert.isTrue($("#stn_attrib li[data-tab='tab-basic']").hasClass("current"));
		assert.isTrue($("#stn_attrib #tab-basic").hasClass("current"));
		assert.isFalse($("#stn_attrib #tab-advanced").hasClass("current"));
		assert.equal($("#stn_attrib #gid").val(), String(OSApp.Stations.getGIDValue(1)));
		assert.isFalse(showDurationBox.called);
	});

	it("drops the member badge once the station leaves the bundle", function () {
		setBundle(0, [ 1 ]);
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Sites, "updateController");

		OSApp.Dashboard.displayPage();
		assert.equal($("#station_1").siblings(".station-type-badge").text(), "bm");

		controller.special[0].sd = OSApp.Bundles.encodeMembers([ 2 ]);

		// updateContent only runs while the dashboard is the active page.
		var page = $("#station_1").closest("[data-role='page']").addClass("ui-page-active");
		page.trigger("pageshow");
		$("html").trigger("datarefresh");
		page.removeClass("ui-page-active");

		var formerMember = $("#station_1").siblings(".station-type-badge");
		assert.equal(formerMember.text(), "");
		assert.isFalse(formerMember.hasClass("bundle-badge"));
		assert.isFalse(formerMember.hasClass("bundle-member-badge"));
		assert.isTrue(formerMember.hasClass("hidden"));
		assert.isUndefined(formerMember.attr("role"));
		assert.isUndefined(formerMember.attr("tabindex"));
		assert.equal($("#station_2").siblings(".station-type-badge").text(), "bm");
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

	it("does not save a bundle to a different site after its metadata request finishes", function () {
		var originalSession = OSApp.currentSession,
			pending = $.Deferred(),
			specialRequests = 0,
			sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
				if (url.indexOf("/je") === 0) {
					specialRequests++;
					return specialRequests === 1 ? $.Deferred().resolve(controller.special).promise() : pending.promise();
				}
				return $.Deferred().resolve({ result: 1 }).promise();
			});
		sandbox.stub(OSApp.Sites, "updateController");

		try {
			OSApp.Dashboard.displayPage();
			$("#attrib-0").trigger("click");
			var popup = $("#stn_attrib");
			popup.find("#hs").val(String(OSApp.Constants.stations.SPECIAL_TYPE_BUNDLE)).trigger("change");
			popup.find(".bundle-member[value='1']").prop("checked", true).trigger("change");
			popup.find("form").trigger("submit");

			assert.equal(specialRequests, 2);
			originalSession.controller = {};
			$.mobile.loading.resetHistory();
			pending.resolve({ "0": { st: 7, sd: "02" } });

			assert.isFalse(sendToOS.getCalls().some(function (call) {
				return call.args[0].indexOf("/cs?") === 0;
			}));
			assert.isFalse(OSApp.Errors.showError.called);
			assert.isFalse($.mobile.loading.calledWith("hide"));
		} finally {
			originalSession.controller = controller;
		}
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

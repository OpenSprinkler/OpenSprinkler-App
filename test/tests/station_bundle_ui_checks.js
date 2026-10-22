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
			masop: stations.masop,
			stnSeq: stations.stn_seq,
			actRelay: stations.act_relay,
			cs: stations.cs,
			cserr: controller.settings.cserr,
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
		stations.masop = [0];
		stations.stn_seq = [0];
		stations.act_relay = [0];
		stations.cs = [[0, 0, 0]];
		controller.settings.cserr = 0;
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
		stations.masop = saved.masop;
		stations.stn_seq = saved.stnSeq;
		stations.act_relay = saved.actRelay;
		stations.cs = saved.cs;
		controller.settings.cserr = saved.cserr;
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

	it("matches cycle status typography and spacing to the running-program line", function () {
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Sites, "updateController");
		sandbox.stub(OSApp.CycleSoak, "runtimeText").callsFake(function (sid) {
			return sid === 0 ? "Cycle running" : "";
		});
		controller.status[0] = 1;
		controller.settings.ps[0] = [1, 60, 0, 0];
		OSApp.Dashboard.displayPage();
		var card = $("#station_0").closest(".card");
		assert.lengthOf(card.find(".rem"), 1);
		assert.lengthOf(card.find(".cycle-status"), 1);
		var running = getComputedStyle(card.find(".rem")[0]);
		var cycle = getComputedStyle(card.find(".cycle-status")[0]);
		["fontSize", "marginTop", "marginBottom", "width", "whiteSpace"].forEach(function (property) {
			assert.equal(cycle[property], running[property], property);
		});
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

	it("opens Output settings from a special station badge", function () {
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
		assert.isTrue($("#stn_attrib li[data-tab='tab-output']").hasClass("current"));
		assert.isFalse($("#stn_attrib #tab-basic").hasClass("current"));
		assert.isTrue($("#stn_attrib #tab-output").hasClass("current"));
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
		assert.isFalse($("#stn_attrib #tab-output").hasClass("current"));
		assert.equal($("#stn_attrib #gid").val(), String(OSApp.Stations.getGIDValue(1)));
		assert.isFalse(showDurationBox.called);
	});

	it("translates the running-station group warning", function () {
		sandbox.stub(OSApp.Firmware, "sendToOS")
			.returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Sites, "updateController");
		var translate = OSApp.Language._;
		sandbox.stub(OSApp.Language, "_").callsFake(function (text) {
			return text === "Changing group designation is prohibited while station is running" ?
				"Localized group warning" : translate(text);
		});
		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		assert.equal($("#stn_attrib #prohibit-change").text(), "Localized group warning");
	});

	it("keeps edits across Basic, Options and Output and submits them together", function () {
		sandbox.stub(OSApp.CycleSoak, "supported").returns(true);
		sandbox.stub(OSApp.Sites, "updateController");
		controller.options.mas = 8;
		sandbox.stub(OSApp.Supported, "ignoreRain").returns(true);
		var send = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
			return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : {result: 1}).promise();
		});
		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		var popup = $("#stn_attrib");
		assert.lengthOf(popup.find(".tabs li"), 3);
		assert.deepEqual(popup.find(".tabs li").map(function () {
			return $(this).data("tab");
		}).get(), ["tab-basic", "tab-options", "tab-output"]);
		assert.deepEqual(popup.find("#tab-basic #stn-name, #tab-basic #gid, #tab-basic #cycle-enabled, #tab-basic .changeBackground, #tab-basic #stn-notes").map(function () {
			return this.id || "image";
		}).get(), ["stn-name", "cycle-enabled", "gid", "stn-notes", "image"]);
		assert.isFalse(popup.find("#tab-basic .ui-bar").toArray().some(function (heading) {
			return $(heading).text() === OSApp.Language._("Cycle and Soak");
		}));
		assert.lengthOf(popup.find("#tab-options #ir"), 1);
		assert.isBelow(popup.find("input").index(popup.find("#ir")), popup.find("input").index(popup.find("#sd")));
		assert.isBelow(popup.find("input").index(popup.find("#um")), popup.find("input").index(popup.find("#ir")));
		assert.lengthOf(popup.find("#tab-options #sd"), 1);
		assert.lengthOf(popup.find("#tab-basic #gid"), 1);
		assert.lengthOf(popup.find("#tab-basic #cycle-enabled"), 1);
		assert.lengthOf(popup.find("#tab-options #um"), 1);
		assert.lengthOf(popup.find("#tab-options .ui-bar"), 0);
		assert.lengthOf(popup.find("#tab-output #hs"), 1);
		popup.find("#stn-name").val("Cycle zone");
		assert.isTrue(popup.find(".cycle-timing-fields").hasClass("hidden"));
		popup.find("#cycle-enabled").prop("checked", true).trigger("change");
		assert.isFalse(popup.find(".cycle-timing-fields").hasClass("hidden"));
		popup.find("#cycle-minutes").val("5");
		popup.find("#soak-minutes").val("12");
		popup.find("#cycle-enabled").prop("checked", false).trigger("change");
		assert.isTrue(popup.find(".cycle-timing-fields").hasClass("hidden"));
		assert.isTrue(popup.find("#cycle-minutes").prop("disabled"));
		assert.isFalse(popup.find("#cycle-minutes").prop("required"));
		popup.find("#cycle-enabled").prop("checked", true).trigger("change");
		assert.equal(popup.find("#soak-minutes").val(), "12");
		popup.find("#gid").val("1").trigger("change");
		popup.find("[data-tab='tab-options']").trigger("click");
		popup.find("#um").prop("checked", true);
		popup.find("[data-tab='tab-basic']").trigger("click");
		assert.equal(popup.find("#cycle-minutes").val(), "5");
		popup.find("form").trigger("submit");
		var command = send.getCalls().map(function (call) {return call.args[0];})
			.find(function (url) {return url.indexOf("/cs?") === 0;});
		var params = new URLSearchParams(command.split("?")[1]);
		assert.equal(params.get("s0"), "Cycle zone");
		assert.equal(params.get("g0"), "1");
		assert.equal(params.get("csc"), "300");
		assert.equal(params.get("css"), "720");
		assert.equal(Number(params.get("m0")) & 1, 1);
	});

	it("shows saved cycle timings on Basic and preserves them when disabling", function () {
		sandbox.stub(OSApp.CycleSoak, "supported").returns(true);
		sandbox.stub(OSApp.Sites, "updateController");
		controller.stations.cs[0] = [1, 300, 720];
		var send = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
			return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : {result: 1}).promise();
		});
		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		var popup = $("#stn_attrib");
		assert.isFalse(popup.find(".cycle-timing-fields").hasClass("hidden"));
		assert.equal(popup.find("#cycle-minutes").val(), "5");
		assert.equal(popup.find("#soak-minutes").val(), "12");
		popup.find("#cycle-enabled").prop("checked", false).trigger("change");
		assert.isTrue(popup.find(".cycle-timing-fields").hasClass("hidden"));
		assert.isTrue(popup.find("form")[0].checkValidity());
		popup.find("form").trigger("submit");
		var command = send.getCalls().map(function (call) {return call.args[0];})
			.find(function (url) {return url.indexOf("/cs?") === 0;});
		var params = new URLSearchParams(command.split("?")[1]);
		assert.equal(params.get("cse"), "0");
		assert.equal(params.get("csc"), "300");
		assert.equal(params.get("css"), "720");
	});

	[
		{cycle: "500", soak: "12", expected: [300, 720]},
		{cycle: "5", soak: "500", expected: [300, 720]},
		{cycle: "", soak: "12", expected: [300, 720]},
		{cycle: "6", soak: "14", expected: [360, 840]}
	].forEach(function (values) {
		it("disables cycle and soak with hidden timings " + JSON.stringify(values), function () {
			sandbox.stub(OSApp.CycleSoak, "supported").returns(true);
			sandbox.stub(OSApp.Sites, "updateController");
			controller.stations.cs[0] = [1, 300, 720];
			var send = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
				return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : {result: 1}).promise();
			});
			OSApp.Dashboard.displayPage();
			$("#attrib-0").trigger("click");
			var popup = $("#stn_attrib");
			popup.find("#cycle-minutes").val(values.cycle);
			popup.find("#soak-minutes").val(values.soak);
			popup.find("#cycle-enabled").prop("checked", false).trigger("change");
			assert.isTrue(popup.find("form")[0].checkValidity());
			popup.find("form").trigger("submit");
			var command = send.getCalls().map(function (call) {return call.args[0];})
				.find(function (url) {return url.indexOf("/cs?") === 0;});
			var params = new URLSearchParams(command.split("?")[1]);
			assert.equal(params.get("cse"), "0");
			assert.equal(Number(params.get("csc")), values.expected[0]);
			assert.equal(Number(params.get("css")), values.expected[1]);
			assert.isFalse(OSApp.Errors.showError.calledWith(OSApp.Language._("Cycle and soak times must be between 1 and 240 minutes.")));
		});
	});

	it("opens Basic for empty enabled cycle values, including native validation", function () {
		sandbox.stub(OSApp.CycleSoak, "supported").returns(true);
		sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
			return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : {result: 1}).promise();
		});
		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		var popup = $("#stn_attrib");
		popup.find("#cycle-enabled").prop("checked", true).trigger("change");
		assert.isTrue(popup.find("#cycle-minutes").prop("required"));
		popup.find("[data-tab='tab-options']").trigger("click");
		assert.isFalse(popup.find("form")[0].checkValidity());
		assert.isTrue(popup.find("#tab-basic").hasClass("current"));
		popup.find("[data-tab='tab-output']").trigger("click");
		popup.find("form").trigger("submit");
		assert.isTrue(popup.find("#tab-basic").hasClass("current"));
	});

	it("saves cycle settings independently of special-station support", function () {
		sandbox.stub(OSApp.CycleSoak, "supported").returns(true);
		sandbox.stub(OSApp.Supported, "special").returns(false);
		sandbox.stub(OSApp.Supported, "bundle").returns(false);
		sandbox.stub(OSApp.Sites, "updateController");
		var send = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().resolve({result: 1}).promise());
		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		$("#cycle-enabled").prop("checked", true).trigger("change");
		$("#cycle-minutes").val("5");
		$("#soak-minutes").val("10");
		$("#stn_attrib form").trigger("submit");
		var command = send.getCalls().map(function (call) { return call.args[0]; }).find(function (url) { return url.indexOf("/cs?") === 0; });
		var params = new URLSearchParams(command.split("?")[1]);
		assert.equal(params.get("sid"), "0");
		assert.equal(params.get("cse"), "1");
		assert.equal(params.get("csc"), "300");
		assert.equal(params.get("css"), "600");
	});

	["missing", "invalid", "cserr", "unchanged"].forEach(function (mode) {
		it("does not write cycle settings when policy is " + mode, function () {
			sandbox.stub(OSApp.CycleSoak, "supported").returns(true);
			if (mode === "missing") { delete stations.cs; }
			if (mode === "invalid") { stations.cs = [[1, -1, 60]]; }
			if (mode === "cserr") { controller.settings.cserr = 1; }
			sandbox.stub(OSApp.Sites, "updateController");
			var send = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
				return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : {result: 1}).promise();
			});
			OSApp.Dashboard.displayPage();
			$("#attrib-0").trigger("click");
			assert.equal($("#cycle-enabled").prop("disabled"), mode === "missing" || mode === "invalid");
			$("#stn-name").val("Renamed");
			$("#stn_attrib form").trigger("submit");
			var command = send.getCalls().map(function (call) { return call.args[0]; }).find(function (url) { return url.indexOf("/cs?") === 0; });
			assert.isString(command);
			assert.notMatch(command, /[&?](cse|csc|css)=/);
		});
	});

	it("allows master Station Type editing while preserving hidden watering and master attributes", function () {
		controller.options.mas = 1;
		sandbox.stub(OSApp.Sites, "updateController");
		sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
			return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : {result: 1}).promise();
		});
		OSApp.Dashboard.displayPage();
		var button = $("#attrib-0");
		button.data("um", 1).data("sn1", 1).data("us", 1).data("sd", 1);
		button.trigger("click");
		var popup = $("#stn_attrib");
		assert.lengthOf(popup.find(".tabs li"), 2);
		assert.lengthOf(popup.find("#tab-output #hs"), 1);
		assert.isTrue(popup.find("#hs option[data-hs='7']").prop("disabled"));
		assert.lengthOf(popup.find("#gid, #cycle-enabled, #um, #um2, #um3, #um4, #sd"), 0);
		popup.find("form").trigger("submit");
		assert.equal(button.data("um"), 1);
		assert.equal(button.data("sn1"), 1);
		assert.equal(button.data("us"), 1);
		assert.equal(button.data("sd"), 1);
	});

	it("keeps legacy relay and master settings accessible without special station support", function () {
		sandbox.stub(OSApp.Supported, "special").returns(false);
		sandbox.stub(OSApp.Supported, "bundle").returns(false);
		sandbox.stub(OSApp.Supported, "groups").returns(false);
		sandbox.stub(OSApp.Supported, "sequential").returns(true);
		sandbox.stub(OSApp.Supported, "actRelay").returns(true);
		sandbox.stub(OSApp.CycleSoak, "supported").returns(false);
		controller.options.mas = 8;
		OSApp.Dashboard.displayPage();
		$("#attrib-0").trigger("click");
		var popup = $("#stn_attrib");
		assert.lengthOf(popup.find("#tab-options #um"), 1);
		assert.lengthOf(popup.find("#tab-options #ar"), 1);
		assert.lengthOf(popup.find("#tab-basic #us"), 1);
		assert.lengthOf(popup.find("#tab-output"), 0);
		assert.lengthOf(popup.find("#hs, #cycle-enabled, #tab-alert"), 0);
	});

	it("marks only cycle and soak stations with the arrow indicator", function () {
		sandbox.stub(OSApp.Supported, "groups").returns(true);
		sandbox.stub(OSApp.CycleSoak, "supported").returns(true);
		controller.stations.cs = controller.stations.snames.map(function (_, sid) {
			return sid === 0 ? [ 1, 300, 600 ] : [ 0, 0, 0 ];
		});
		controller.settings.cserr = 0;
		OSApp.Dashboard.displayPage();
		assert.isTrue($("#attrib-0").hasClass("station-cycle"));
		assert.include($("#attrib-0").attr("title"), "Cycle and Soak");
		assert.include($("#attrib-0").attr("title"), "Maximum cycle (minutes): 5");
		assert.include($("#attrib-0").attr("title"), "Minimum soak (minutes): 10");
		assert.notInclude($("#attrib-0").attr("title"), "Basic Settings");
		assert.equal($("#attrib-0").attr("title"), $("#attrib-0").attr("aria-label"));
		assert.isFalse($("#attrib-1").hasClass("station-cycle"));
		assert.notInclude($("#attrib-1").attr("title"), "Cycle and Soak");
		assert.lengthOf($("#attrib-0 .station-gid"), 1);
		controller.stations.cs[0] = [1, 120, 420];
		OSApp.Cards.setGroupLabel($("#attrib-0").closest(".card"), "B");
		assert.include($("#attrib-0").attr("title"), "Sequential Group: B");
		assert.include($("#attrib-0").attr("title"), "Maximum cycle (minutes): 2");
		assert.include($("#attrib-0").attr("title"), "Minimum soak (minutes): 7");

		controller.settings.cserr = 1;
		OSApp.Dashboard.displayPage();
		assert.isTrue($("#attrib-0").hasClass("station-cycle"));
		assert.include($("#attrib-0").attr("title"), "Maximum cycle (minutes): 2");
		assert.isFalse($("#attrib-1").hasClass("station-cycle"));
	});

	it("allows editing valid station policies despite a controller-wide cycle error", function () {
		sandbox.stub(OSApp.CycleSoak, "supported").returns(true);
		sandbox.stub(OSApp.Sites, "updateController");
		controller.settings.cserr = 1;
		controller.stations.cs[0] = [1, 300, 600];
		var send = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
			return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : {result: 1}).promise();
		});
		OSApp.Dashboard.displayPage();
		var page = $("#station_0").closest("[data-role='page']").addClass("ui-page-active");
		page.trigger("pageshow");
		$("html").trigger("datarefresh");
		page.removeClass("ui-page-active");
		assert.equal($(".cycle-diagnostic p").first().text(), OSApp.Language._("Cycle and Soak reported an error. Some stations may water without cycling. If this persists after restarting the controller, reset the cycle and soak settings."));
		assert.isFalse(send.getCalls().some(function (call) { return call.args[0].indexOf("/cs?") === 0; }));
		$("#attrib-0").trigger("click");
		assert.isFalse($("#cycle-enabled").prop("disabled"));
		assert.isTrue($("#cycle-enabled").prop("checked"));
		$("#cycle-minutes").val("6");
		$("#stn_attrib form").trigger("submit");
		var command = send.getCalls().map(function (call) {return call.args[0];})
			.find(function (url) {return url.indexOf("/cs?") === 0;});
		var params = new URLSearchParams(command.split("?")[1]);
		assert.equal(params.get("cse"), "1");
		assert.equal(params.get("csc"), "360");
		assert.equal(params.get("css"), "600");
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

	it("renders soaking immediately and saves station cycle policy in seconds", function () {
		var oldCS = stations.cs, oldVersion = stations.csver, oldRuntime = controller.settings.cs;
		try {
			stations.csver = 1; stations.cs = [[1, 60, 60]];
			controller.settings.cs = [[0, 1, 2, 80, 40, 1102, 1102, 1]];
			var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
				return $.Deferred().resolve(url.indexOf("/je") === 0 ? controller.special : {result:1}).promise();
			});
			sandbox.stub(OSApp.Sites, "updateController");
			OSApp.Dashboard.displayPage();
			assert.include($("#station_0").siblings(".cycle-status").text(), "Soaking");
			$("#attrib-0").trigger("click");
			var popup = $("#stn_attrib");
			popup.find("#cycle-minutes").val("5"); popup.find("#soak-minutes").val("10");
			popup.find("form").trigger("submit");
			var command = sendToOS.getCalls().map(function(c){return c.args[0];}).find(function(url){return url.indexOf("/cs?")===0;});
			var params = new URLSearchParams(command.split("?")[1]);
			assert.equal(params.get("sid"), "0"); assert.equal(params.get("cse"), "1");
			assert.equal(params.get("csc"), "300"); assert.equal(params.get("css"), "600");
		} finally {
			stations.cs = oldCS; stations.csver = oldVersion; controller.settings.cs = oldRuntime;
		}
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

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

describe("Firmware Update Checks", function () {
	var addNotification;
	var checkOSVersion;
	var getHWVersion;
	var getJSON;
	var openPopup;
	var release;
	var storageGet;
	var session;
	var originalControllerOptions;
	var originalControllerSettings;
	var originalIp;
	var originalPrefix;
	var originalToken;

	beforeEach(function () {
		session = OSApp.currentSession;
		originalControllerOptions = session.controller.options;
		originalControllerSettings = session.controller.settings;
		originalIp = session.ip;
		originalPrefix = session.prefix;
		originalToken = session.token;
		session.controller.options = { fwv: 221, fwm: 6, hwv: 30, hp0: 80, hp1: 0 };
		session.prefix = "http://";

		checkOSVersion = sinon.stub(OSApp.Firmware, "checkOSVersion").callsFake(function (version) {
			return version <= 2216;
		});
		getHWVersion = sinon.stub(OSApp.Firmware, "getHWVersion").returns("3.0");
		release = {
			tag_name: "222",
			name: "2.2.2",
			html_url: "https://github.com/OpenSprinkler/OpenSprinkler-Firmware/releases/tag/222"
		};
		getJSON = sinon.stub($, "getJSON").returns($.Deferred().resolve([ release ]).promise());
		storageGet = sinon.stub(OSApp.Storage, "get").callsFake(function (_key, callback) {
			callback({});
		});
		addNotification = sinon.stub(OSApp.Notifications, "addNotification");
		openPopup = sinon.stub(OSApp.UIDom, "openPopup");
	});

	afterEach(function () {
		openPopup.restore();
		addNotification.restore();
		storageGet.restore();
		getJSON.restore();
		getHWVersion.restore();
		checkOSVersion.restore();
		session.controller.options = originalControllerOptions;
		session.controller.settings = originalControllerSettings;
		session.ip = originalIp;
		session.prefix = originalPrefix;
		session.token = originalToken;
	});

	function renderUpdatePopup(hwv, ip, token, prefix) {
		session.controller.options.hwv = hwv;
		session.ip = ip;
		session.token = token;
		session.prefix = prefix || "http://";
		OSApp.Firmware.checkFirmwareUpdate();
		var notification = addNotification.lastCall.args[0];
		notification.on.call($("<div></div>")[0]);
		return openPopup.lastCall.args[0];
	}

	it("should enable browser updates for direct OS3 and OS4 sessions", function () {
		var popup = renderUpdatePopup(30, "sprinkler.local", undefined);
		assert.lengthOf(popup.find(".update"), 1);
		assert.isFalse(popup.find(".update").hasClass("ui-state-disabled"));

		popup = renderUpdatePopup(40, "sprinkler.local:8081", undefined, "https://");
		assert.lengthOf(popup.find(".update"), 1);
		popup.find(".update").trigger("click");
		assert.equal(popup.find(".firmware-update-route").attr("href"), "https://sprinkler.local:8081/update");
	});

	it("uses a configured direct URL even when an OTC token is present", function () {
		var popup = renderUpdatePopup(40, "sprinkler.local", "cloud-token");
		popup.find(".update").trigger("click");

		assert.equal(popup.find(".firmware-update-route").attr("href"), "http://sprinkler.local/update");
		assert.notInclude(popup.find(".firmware-update-route").attr("href"), "cloud-token");
	});

	it("shows a disabled update action for token-only OS4 sessions", function () {
		var popup = renderUpdatePopup(40, "", "cloud-token");

		assert.lengthOf(popup.find(".update"), 1);
		assert.isTrue(popup.find(".update").hasClass("ui-state-disabled"));
		assert.include(popup.find(".firmware-update-unavailable").text(), "local network connection");
		popup.find(".update").trigger("click");
		assert.lengthOf(popup.find(".firmware-update-route"), 0);
	});

	it("does not synthesize an updater URL from controller-reported addresses", function () {
		session.controller.settings = { devip: "192.168.1.20" };
		var state = OSApp.Firmware.getBrowserFirmwareUpdateState({
			controller: session.controller,
			prefix: "",
			ip: "",
			token: "cloud-token"
		});

		assert.isTrue(state.supported);
		assert.isNull(state.url);
		assert.equal(state.reason, "local-network");
	});

	it("preserves OSPi updates and hides unsupported browser upload actions", function () {
		var popup = renderUpdatePopup(64, "", "cloud-token");
		assert.lengthOf(popup.find(".update"), 1);

		popup = renderUpdatePopup(255, "demo.opensprinkler.com", undefined, "https://");
		assert.lengthOf(popup.find(".update"), 0);
	});

	it("disables firmware updates while an upgraded controller uses port 8080", function () {
		session.controller.options.hp0 = 144;
		session.controller.options.hp1 = 31;
		var popup = renderUpdatePopup(40, "sprinkler.local", undefined);

		assert.isTrue(popup.find(".update").hasClass("ui-state-disabled"));
		assert.include(popup.find(".firmware-update-unavailable").text(), "Port 8080");
	});

	it("should render the GitHub release name as text", function () {
		release.name = "2.2.2</h3><img class='release-xss' src=x>";

		var popup = renderUpdatePopup(30, "sprinkler.local", undefined);

		assert.include(popup.find(".firmware-release-title").text(), release.name);
		assert.lengthOf(popup.find(".release-xss"), 0);
	});

	it("should only show changelog links hosted securely on GitHub", function () {
		var popup = renderUpdatePopup(30, "sprinkler.local", undefined);
		assert.strictEqual(popup.find(".changelog").attr("href"), release.html_url);

		release.html_url = "https://github.com.evil.example/OpenSprinkler/release-notes";
		popup = renderUpdatePopup(30, "sprinkler.local", undefined);

		assert.lengthOf(popup.find(".changelog"), 0);
	});
});

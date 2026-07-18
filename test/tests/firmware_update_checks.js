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
	var originalIp;
	var originalToken;

	beforeEach(function () {
		session = OSApp.currentSession;
		originalControllerOptions = session.controller.options;
		originalIp = session.ip;
		originalToken = session.token;
		session.controller.options = { fwv: 221, fwm: 0, hwv: 30 };

		checkOSVersion = sinon.stub(OSApp.Firmware, "checkOSVersion").returns(true);
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
		session.ip = originalIp;
		session.token = originalToken;
	});

	function renderUpdatePopup(hwv, ip, token) {
		session.controller.options.hwv = hwv;
		session.ip = ip;
		session.token = token;
		OSApp.Firmware.checkFirmwareUpdate();
		var notification = addNotification.lastCall.args[0];
		notification.on.call($("<div></div>")[0]);
		return openPopup.lastCall.args[0];
	}

	it("should only offer a usable update route for the active connection", function () {
		var popup = renderUpdatePopup(30, "sprinkler.local", undefined);
		assert.lengthOf(popup.find(".update"), 1);

		popup = renderUpdatePopup(30, "", "cloud-token");
		assert.lengthOf(popup.find(".update"), 0);

		popup = renderUpdatePopup(64, "", "cloud-token");
		assert.lengthOf(popup.find(".update"), 1);
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

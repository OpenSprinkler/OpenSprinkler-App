/* eslint-disable */

/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <http://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 */

describe("Mutation Failure Checks", function () {
	var sandbox;
	var request;
	var latestSites;

	function resetStationAttributes() {
		return OSApp.Options.resetStationAttributes("m0=255&");
	}

	beforeEach(function () {
		sandbox = sinon.createSandbox();
		request = $.Deferred();
		latestSites = {
			Yard: {
				notes: { 0: "Keep until firmware succeeds" },
				images: { 0: "station.jpg" },
				lastRunTime: { 0: 1234 },
				untouched: "preserve me"
			},
			Other: { untouched: "other site" }
		};

		sandbox.stub(OSApp.Storage, "get").callsFake(function (key, callback) {
			if (key === "current_site") {
				callback({ current_site: "Yard" });
			} else if (key === "sites") {
				callback({ sites: JSON.stringify(latestSites) });
			}
		});
		sandbox.stub(OSApp.Storage, "set");
		sandbox.stub(OSApp.Network, "cloudSaveSites");
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());
		sandbox.stub(OSApp.Sites, "updateController");
		sandbox.stub(OSApp.Errors, "showError");
		sandbox.stub($.mobile, "loading");
	});

	afterEach(function () {
		sandbox.restore();
	});

	it("should preserve local station metadata when the firmware reset fails", function () {
		resetStationAttributes();

		assert.isTrue(OSApp.Storage.set.notCalled);
		assert.isTrue(OSApp.Storage.get.calledOnceWith("current_site"));
		assert.deepEqual(latestSites.Yard.notes, { 0: "Keep until firmware succeeds" });

		request.reject({ status: 500 });

		assert.isTrue(OSApp.Storage.set.notCalled);
		assert.isTrue(OSApp.Sites.updateController.notCalled);
		assert.isTrue(OSApp.Errors.showError.notCalled);
		assert.deepEqual(latestSites.Yard.images, { 0: "station.jpg" });
		assert.deepEqual(latestSites.Yard.lastRunTime, { 0: 1234 });
	});

	it("should clear only the target site's station metadata after firmware success", function () {
		resetStationAttributes();

		assert.isTrue(OSApp.Storage.set.notCalled);
		request.resolve({ result: 1 });

		assert.isTrue(OSApp.Storage.get.calledWith("sites"));
		assert.isTrue(OSApp.Storage.set.calledOnce);
		var storedSites = JSON.parse(OSApp.Storage.set.firstCall.args[0].sites);
		assert.deepEqual(storedSites.Yard.notes, {});
		assert.deepEqual(storedSites.Yard.images, {});
		assert.deepEqual(storedSites.Yard.lastRunTime, {});
		assert.equal(storedSites.Yard.untouched, "preserve me");
		assert.deepEqual(storedSites.Other, { untouched: "other site" });
		assert.isTrue(OSApp.Errors.showError.calledOnceWith("Stations have been updated"));
		assert.isTrue(OSApp.Sites.updateController.calledOnce);
	});
});

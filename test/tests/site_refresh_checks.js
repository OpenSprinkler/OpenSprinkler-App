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

describe("Site Refresh Checks", function () {
	var sandbox;
	var originalSession;
	var originalController;

	function resolved(value) {
		return $.Deferred().resolve(value).promise();
	}

	function stubInitialControllerRequests() {
		[
			"updateControllerPrograms",
			"updateControllerStations",
			"updateControllerOptions",
			"updateControllerStatus",
			"updateControllerSettings"
		].forEach(function (method) {
			sandbox.stub(OSApp.Sites, method).returns(resolved({}));
		});
	}

	beforeEach(function () {
		sandbox = sinon.createSandbox();
		originalSession = OSApp.currentSession;
		originalController = originalSession.controller;
		sandbox.stub(OSApp.Status, "checkStatus");
		sandbox.stub($.fn, "trigger").callsFake(function () { return this; });
	});

	afterEach(function () {
		OSApp.currentSession = originalSession;
		originalSession.controller = originalController;
		sandbox.restore();
	});

	it("should reject a late sensor refresh without changing the replacement controller", function () {
		var request = $.Deferred();
		var callback = sandbox.spy();
		var replacementSensors = { sn: [ { uuid: 99 } ] };
		var replacementController = { sensors: replacementSensors };
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());

		var refresh = OSApp.Sites.updateControllerSensors(callback);
		originalSession.controller = replacementController;

		return new Promise(function (resolve, reject) {
			refresh.done(function () {
				reject(new Error("Stale sensor refresh was reported as success"));
			}).fail(function (error) {
				try {
					assert.equal(error.statusText, "stale");
					assert.strictEqual(replacementController.sensors, replacementSensors);
					assert.isFalse(callback.called);
					resolve();
				} catch (assertionError) {
					reject(assertionError);
				}
			});

			request.resolve({ sn: [ { uuid: 7 } ] });
		});
	});

	it("should reject a late sensor-description refresh without changing the replacement controller", function () {
		var request = $.Deferred();
		var callback = sandbox.spy();
		var replacementDescription = { marker: "new-site-description" };
		var replacementController = { sensor_desc: replacementDescription };
		var normalizeJsd = sandbox.stub(OSApp.Sensors, "normalizeJsd");
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());

		var refresh = OSApp.Sites.updateControllerSensorDescription(callback);
		originalSession.controller = replacementController;

		return new Promise(function (resolve, reject) {
			refresh.done(function () {
				reject(new Error("Stale sensor-description refresh was reported as success"));
			}).fail(function (error) {
				try {
					assert.equal(error.statusText, "stale");
					assert.strictEqual(replacementController.sensor_desc, replacementDescription);
					assert.isFalse(normalizeJsd.called);
					assert.isFalse(callback.called);
					resolve();
				} catch (assertionError) {
					reject(assertionError);
				}
			});

			request.resolve({ sensors: [] });
		});
	});

	it("should load sensor data and descriptions during initial loading only on supported firmware", function () {
		sandbox.stub(originalSession, "isControllerConnected").returns(false);
		var checkOSVersion = sandbox.stub(OSApp.Firmware, "checkOSVersion").callsFake(function (version) {
			return version === 2215;
		});
		stubInitialControllerRequests();
		var updateSensors = sandbox.stub(OSApp.Sites, "updateControllerSensors").returns(resolved({ sn: [] }));
		var updateDescription = sandbox.stub(OSApp.Sites, "updateControllerSensorDescription").returns(resolved({ sensors: [] }));

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateController(function () {
				try {
					assert.isTrue(checkOSVersion.calledWith(2215));
					assert.isTrue(updateSensors.calledOnce);
					assert.isTrue(updateDescription.calledOnce);
					resolve();
				} catch (error) {
					reject(error);
				}
			}, reject);
		});
	});

	it("should skip sensor data and descriptions during initial loading on older firmware", function () {
		sandbox.stub(originalSession, "isControllerConnected").returns(false);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(false);
		stubInitialControllerRequests();
		var updateSensors = sandbox.stub(OSApp.Sites, "updateControllerSensors").returns(resolved({ sn: [] }));
		var updateDescription = sandbox.stub(OSApp.Sites, "updateControllerSensorDescription").returns(resolved({ sensors: [] }));

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateController(function () {
				try {
					assert.isFalse(updateSensors.called);
					assert.isFalse(updateDescription.called);
					resolve();
				} catch (error) {
					reject(error);
				}
			}, reject);
		});
	});

	it("should merge connected controller data without replacing cached sensor fields", function () {
		var request = $.Deferred();
		var sensorDescription = { units: [ { value: 1, short: "V" } ] };
		var adjustmentData = [ { wa: 1, sa: 0.75 } ];
		var controller = {
			sensor_desc: sensorDescription,
			jpaData: adjustmentData,
			status: { sn: [ 0 ] }
		};
		originalSession.controller = controller;
		sandbox.stub(originalSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").callsFake(function (version) { return version === 216; });
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateController(function () {
				try {
					assert.strictEqual(originalSession.controller, controller);
					assert.strictEqual(controller.sensor_desc, sensorDescription);
					assert.strictEqual(controller.jpaData, adjustmentData);
					assert.deepEqual(controller.status, [ 1 ]);
					assert.equal(controller.settings.devt, 1700000000);
					resolve();
				} catch (error) {
					reject(error);
				}
			}, reject);

			request.resolve({
				settings: { devt: 1700000000 },
				status: { sn: [ 1 ] }
			});
		});
	});

	it("should ignore a connected controller response after the controller changes", function () {
		var request = $.Deferred();
		var callback = sandbox.spy();
		var fail = sandbox.spy();
		var controller = { status: { sn: [ 0 ] } };
		var replacementController = {
			marker: "replacement-controller",
			status: [ 9 ]
		};
		originalSession.controller = controller;
		sandbox.stub(originalSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").callsFake(function (version) { return version === 216; });
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());

		OSApp.Sites.updateController(callback, fail);
		originalSession.controller = replacementController;
		request.resolve({
			settings: { devt: 1700000000 },
			status: { sn: [ 1 ] }
		});

		return new Promise(function (resolve, reject) {
			setTimeout(function () {
				try {
					assert.deepEqual(replacementController, {
						marker: "replacement-controller",
						status: [ 9 ]
					});
					assert.deepEqual(controller, { status: { sn: [ 0 ] } });
					assert.isFalse(callback.called);
					assert.isFalse(fail.called);
					assert.isFalse(OSApp.Status.checkStatus.called);
					resolve();
				} catch (error) {
					reject(error);
				}
			}, 0);
		});
	});

	it("should ignore all fallback endpoint responses after the controller changes", function () {
		var requests = {};
		var callback = sandbox.spy();
		var fail = sandbox.spy();
		var controller = {};
		var replacementController = { marker: "replacement-controller" };
		originalSession.controller = controller;
		sandbox.stub(originalSession, "isControllerConnected").returns(false);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(false);
		sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (path) {
			requests[path] = $.Deferred();
			return requests[path].promise();
		});

		OSApp.Sites.updateController(callback, fail);
		originalSession.controller = replacementController;
		requests["/jp?pw="].resolve({ pd: [ "old-program" ] });
		requests["/jn?pw="].resolve({ snames: [ "old-station" ] });
		requests["/jo?pw="].resolve({ wl: 10 });
		requests["/js?pw="].resolve({ sn: [ 1 ] });
		requests["/jc?pw="].resolve({ loc: "1,2", lrun: [ 0, 0, 0, 0 ] });

		return new Promise(function (resolve, reject) {
			setTimeout(function () {
				try {
					assert.deepEqual(controller, {});
					assert.deepEqual(replacementController, { marker: "replacement-controller" });
					assert.isFalse(callback.called);
					assert.isFalse(fail.called);
					assert.isFalse(OSApp.Status.checkStatus.called);
					resolve();
				} catch (error) {
					reject(error);
				}
			}, 0);
		});
	});
});

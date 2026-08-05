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

	function rejected(error) {
		return $.Deferred().reject(error).promise();
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

	it("should skip official sensor endpoints during initial loading on ASB firmware", function () {
		originalSession.controller = { options: { feature: "ASB", fwv: 240 } };
		sandbox.stub(originalSession, "isControllerConnected").returns(false);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(true);
		stubInitialControllerRequests();
		var updateSensors = sandbox.spy(OSApp.Sites, "updateControllerSensors");
		var updateDescription = sandbox.spy(OSApp.Sites, "updateControllerSensorDescription");

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateController(function () {
				try {
					assert.isFalse(updateSensors.called);
					assert.isFalse(updateDescription.called);
					assert.isFalse(OSApp.Supported.sensors());
					resolve();
				} catch (error) {
					reject(error);
				}
			}, reject);
		});
	});

	it("should resolve ASB sensor helpers consistently without sending requests", function () {
		var controller = {
			options: { feature: "ASB", fwv: 240 },
			sensors: { sn: [ { uuid: 7 } ] },
			sensor_desc: { marker: "stale-description" }
		};
		originalSession.controller = controller;
		var sendToOS = sandbox.spy(OSApp.Firmware, "sendToOS");

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateControllerSensors().then(function (sensors) {
				assert.isNull(sensors);
				return OSApp.Sites.updateControllerSensorDescription();
			}).then(function (description) {
				try {
					assert.isNull(description);
					assert.isUndefined(controller.sensors);
					assert.isNull(controller.sensor_desc);
					assert.isFalse(sendToOS.called);
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

	it("should fetch and normalize the sensor description after a connected /ja bootstrap", function () {
		var rawDescription = { units: [ [ 1, "Volt", "V" ] ], sensors: [] };
		var normalizedDescription = { units: [ { value: 1, short: "V" } ], sensors: [] };
		var controller = {};
		originalSession.controller = controller;
		sandbox.stub(originalSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").callsFake(function (version) { return version === 216; });
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (path) {
			if (path === "/ja?pw=") {
				return resolved({
					sensors: { sn: [ { uuid: 7, unit: 1 } ] },
					status: { sn: [ 0 ] }
				});
			}
			if (path === "/jsd?pw=") {
				return resolved(rawDescription);
			}
			return $.Deferred().reject(new Error("Unexpected request: " + path)).promise();
		});
		var normalizeJsd = sandbox.stub(OSApp.Sensors, "normalizeJsd").returns(normalizedDescription);

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateController(function () {
				try {
					assert.strictEqual(controller.sensor_desc, normalizedDescription);
					assert.isTrue(sendToOS.calledWith("/ja?pw=", "json"));
					assert.isTrue(sendToOS.calledWith("/jsd?pw=", "json"));
					assert.isTrue(normalizeJsd.calledOnceWithExactly(rawDescription));
					resolve();
				} catch (error) {
					reject(error);
				}
			}, reject);
		});
	});

	it("should finish connected loading without repeatedly requesting an unavailable sensor description", function () {
		var controller = {};
		var fail = sandbox.spy();
		originalSession.controller = controller;
		sandbox.stub(originalSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").callsFake(function (version) { return version === 216; });
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (path) {
			if (path === "/ja?pw=") {
				return resolved({
					sensors: { sn: [ { uuid: 7, unit: 1 } ] },
					status: { sn: [ 0 ] }
				});
			}
			if (path === "/jsd?pw=") {
				return rejected({ status: 404 });
			}
			return rejected(new Error("Unexpected request: " + path));
		});

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateController(function () {
				OSApp.Sites.updateController(function () {
					try {
						assert.deepEqual(controller.sensors, { sn: [ { uuid: 7, unit: 1 } ] });
						assert.isNull(controller.sensor_desc);
						assert.equal(sendToOS.withArgs("/jsd?pw=", "json").callCount, 1);
						assert.isFalse(fail.called);
						resolve();
					} catch (error) {
						reject(error);
					}
				}, function (error) {
					fail(error);
					reject(new Error("Optional sensor description was retried during controller loading"));
				});
			}, function (error) {
				fail(error);
				reject(new Error("Optional sensor description failed controller loading"));
			});
		});
	});

	[
		{ name: "authentication", error: { status: 401 } },
		{ name: "server", error: { status: 500 } },
		{ name: "timeout", error: { status: 0, statusText: "timeout" } }
	].forEach(function (testCase) {
		it("should propagate " + testCase.name + " failures from the sensor description request", function () {
			var controller = {};
			originalSession.controller = controller;
			sandbox.stub(originalSession, "isControllerConnected").returns(true);
			sandbox.stub(OSApp.Firmware, "checkOSVersion").callsFake(function (version) { return version === 216; });
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (path) {
				if (path === "/ja?pw=") {
					return resolved({
						sensors: { sn: [ { uuid: 7, unit: 1 } ] },
						status: { sn: [ 0 ] }
					});
				}
				if (path === "/jsd?pw=") {
					return rejected(testCase.error);
				}
				return rejected(new Error("Unexpected request: " + path));
			});

			return new Promise(function (resolve, reject) {
				OSApp.Sites.updateController(function () {
					reject(new Error("Sensor-description failure was reported as success"));
				}, function (error) {
					try {
						assert.strictEqual(error, testCase.error);
						assert.deepEqual(controller.sensors, { sn: [ { uuid: 7, unit: 1 } ] });
						assert.isUndefined(controller.sensor_desc);
						resolve();
					} catch (assertionError) {
						reject(assertionError);
					}
				});
			});
		});
	});

	it("should finish legacy loading when optional sensor endpoints are unavailable", function () {
		var controller = {
			sensors: { sn: [ { uuid: 7 } ] },
			sensor_desc: { marker: "stale-description" }
		};
		var fail = sandbox.spy();
		originalSession.controller = controller;
		sandbox.stub(originalSession, "isControllerConnected").returns(false);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(true);
		stubInitialControllerRequests();
		sandbox.stub(OSApp.Sites, "updateControllerSensors").returns(rejected({ status: 404 }));
		sandbox.stub(OSApp.Sites, "updateControllerSensorDescription").returns(rejected({ status: 404 }));

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateController(function () {
				try {
					assert.isUndefined(controller.sensors);
					assert.isNull(controller.sensor_desc);
					assert.isFalse(fail.called);
					resolve();
				} catch (error) {
					reject(error);
				}
			}, function (error) {
				fail(error);
				reject(new Error("Optional legacy sensor endpoints failed controller loading"));
			});
		});
	});

	it("should propagate server failures from legacy sensor endpoints without clearing cached data", function () {
		var sensors = { sn: [ { uuid: 7 } ] };
		var sensorDescription = { marker: "cached-description" };
		var controller = { sensors: sensors, sensor_desc: sensorDescription };
		var error = { status: 500 };
		originalSession.controller = controller;
		sandbox.stub(originalSession, "isControllerConnected").returns(false);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(true);
		stubInitialControllerRequests();
		sandbox.stub(OSApp.Sites, "updateControllerSensors").returns(rejected(error));
		sandbox.stub(OSApp.Sites, "updateControllerSensorDescription").returns(rejected(error));

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateController(function () {
				reject(new Error("Sensor endpoint failure was reported as success"));
			}, function (failure) {
				try {
					assert.strictEqual(failure, error);
					assert.strictEqual(controller.sensors, sensors);
					assert.strictEqual(controller.sensor_desc, sensorDescription);
					resolve();
				} catch (assertionError) {
					reject(assertionError);
				}
			});
		});
	});

	it("should ignore official sensor data from a connected ASB /ja response", function () {
		var controller = {
			options: { feature: "ASB", fwv: 240 },
			sensor_desc: { marker: "stale-description" }
		};
		originalSession.controller = controller;
		sandbox.stub(originalSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(true);
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (path) {
			if (path === "/ja?pw=") {
				return resolved({
					options: { feature: "ASB", fwv: 240 },
					sensors: { sn: [ { uuid: 7 } ] },
					status: { sn: [ 0 ] }
				});
			}
			return $.Deferred().reject(new Error("Unexpected request: " + path)).promise();
		});

		return new Promise(function (resolve, reject) {
			OSApp.Sites.updateController(function () {
				try {
					assert.isUndefined(controller.sensors);
					assert.isUndefined(controller.sensor_desc);
					assert.isFalse(OSApp.Supported.sensors());
					assert.isTrue(sendToOS.calledOnceWithExactly("/ja?pw=", "json"));
					resolve();
				} catch (error) {
					reject(error);
				}
			}, reject);
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

	it("should reject a late special-station refresh without changing the replacement controller", function () {
		var request = $.Deferred();
		var callback = sandbox.spy();
		var controller = {};
		var replacementController = { marker: "replacement-controller" };
		originalSession.controller = controller;
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(request.promise());

		var refresh = OSApp.Sites.updateControllerStationSpecial(callback);
		originalSession.controller = replacementController;

		return new Promise(function (resolve, reject) {
			refresh.done(function () {
				reject(new Error("Stale special-station refresh was reported as success"));
			}).fail(function (error) {
				try {
					assert.equal(error.statusText, "stale");
					assert.deepEqual(controller, {});
					assert.deepEqual(replacementController, { marker: "replacement-controller" });
					assert.isFalse(callback.called);
					resolve();
				} catch (assertionError) {
					reject(assertionError);
				}
			});

			request.resolve({ 0: { st: 1, sd: "0000" } });
		});
	});

	it("should not report stale status refreshes as network failures", function () {
		sandbox.stub(originalSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(false);
		var stale = { status: 0, statusText: "stale" };
		sandbox.stub(OSApp.Sites, "updateControllerStatus").returns($.Deferred().reject(stale).promise());
		sandbox.stub(OSApp.Sites, "updateControllerSettings").returns(resolved({}));
		sandbox.stub(OSApp.Sites, "updateControllerOptions").returns(resolved({}));
		var networkFail = sandbox.stub(OSApp.Network, "networkFail");

		OSApp.Status.refreshStatus();

		assert.isFalse(networkFail.called);
	});

	it("should not report stale background data refreshes as network failures", function () {
		sandbox.stub(originalSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(false);
		var stale = { status: 0, statusText: "stale" };
		sandbox.stub(OSApp.Sites, "updateControllerPrograms").returns($.Deferred().reject(stale).promise());
		sandbox.stub(OSApp.Sites, "updateControllerStations").returns(resolved({}));
		var networkFail = sandbox.stub(OSApp.Network, "networkFail");

		OSApp.Sites.refreshData();

		assert.isFalse(networkFail.called);
	});
});

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

describe("Sensor Mutation Checks", function () {
	describe("Firmware response classification", function () {
		var ajaxq;
		var checkOSVersion;
		var showError;

		beforeEach(function () {
			checkOSVersion = sinon.stub(OSApp.Firmware, "checkOSVersion").returns(false);
			showError = sinon.stub(OSApp.Errors, "showError");
			ajaxq = sinon.stub($, "ajaxq").callsFake(function () {
				return $.Deferred().resolve({ result: 0x11 }).promise();
			});
		});

		afterEach(function () {
			ajaxq.restore();
			checkOSVersion.restore();
			showError.restore();
		});

		[ "/sp?pw=&npw=new", "/pq?pw=&dur=60", "/dl?pw=&day=all", "/sa?pw=&nr=1", "/sc?pw=&nr=1",
			"/sb?pw=&nr=1", "/sn?pw=" ].forEach(function (endpoint) {
			it("should classify " + endpoint.split("?")[0] + " as a mutation", function () {
				assert.isTrue(OSApp.Firmware.isChangeRequest(endpoint));
			});
		});

		[ "/csn?pw=&uuid=-1", "/dsn?pw=&uuid=7", "/dsl?pw=&uuid=7" ].forEach(function (endpoint) {
			it("should reject firmware errors from " + endpoint.split("?")[0], function () {
				return new Promise(function (resolve, reject) {
					OSApp.Firmware.sendToOS(endpoint)
						.done(function () {
							reject(new Error("Firmware error was reported as success"));
						})
						.fail(function (data) {
							try {
								assert.equal(data.result, 0x11);
								assert.equal(ajaxq.firstCall.args[0], "change");
								assert.isTrue(showError.calledOnce);
								resolve();
							} catch (error) {
								reject(error);
							}
						});
				});
			});
		});

		it("should propagate transport failures from every sensor mutation", function () {
			var error = { status: 500 };
			ajaxq.callsFake(function () {
				return $.Deferred().reject(error).promise();
			});
			var endpoints = [ "/csn?pw=&uuid=-1", "/dsn?pw=&uuid=7", "/dsl?pw=&uuid=7" ];

			return Promise.all(endpoints.map(function (endpoint) {
				return new Promise(function (resolve, reject) {
					OSApp.Firmware.sendToOS(endpoint)
						.done(function () { reject(new Error("Transport failure was reported as success")); })
						.fail(function (actual) {
							try {
								assert.strictEqual(actual, error);
								resolve();
							} catch (assertionError) {
								reject(assertionError);
							}
						});
				});
			})).then(function () {
				assert.deepEqual(ajaxq.getCalls().map(function (call) { return call.args[0]; }),
					[ "change", "change", "change" ]);
			});
		});

		it("should propagate transport failures from legacy mutations", function () {
			var error = { status: 500 };
			ajaxq.callsFake(function () { return $.Deferred().reject(error).promise(); });

			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/co?pw=&tz=28")
					.done(function () { reject(new Error("Mutation transport failure was reported as success")); })
					.fail(function (actual) {
						try {
							assert.strictEqual(actual, error);
							assert.equal(ajaxq.firstCall.args[0], "change");
							resolve();
						} catch (assertionError) {
							reject(assertionError);
						}
					});
			});
		});

		it("should show feedback for otherwise silent mutation transport failures", function () {
			var error = { status: 500 };
			ajaxq.callsFake(function () { return $.Deferred().reject(error).promise(); });

			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/sp?pw=&npw=new&cpw=old", "json")
					.done(function () { reject(new Error("Password transport failure was reported as success")); })
					.fail(function (actual) {
						try {
							assert.strictEqual(actual, error);
							assert.equal(ajaxq.firstCall.args[0], "change");
							assert.isTrue(showError.calledOnceWith("Network Error"));
							resolve();
						} catch (assertionError) {
							reject(assertionError);
						}
					});
			});
		});

		it("should show feedback when a mutation endpoint is missing", function () {
			ajaxq.callsFake(function () { return $.Deferred().resolve({ result: 32 }).promise(); });

			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/sp?pw=&npw=new&cpw=old", "json")
					.done(function () { reject(new Error("Missing mutation endpoint was reported as success")); })
					.fail(function (actual) {
						try {
							assert.equal(actual.status, 404);
							assert.isTrue(showError.calledOnceWith("Please check input and try again."));
							resolve();
						} catch (assertionError) {
							reject(assertionError);
						}
					});
			});
		});

		it("should propagate read-request failures and preserve queue selection", function () {
			var error = { status: 500 };
			ajaxq.callsFake(function () { return $.Deferred().reject(error).promise(); });

			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/jsn?pw=", "json")
					.done(function () { reject(new Error("Read failure was reported as success")); })
					.fail(function (actual) {
						try {
							assert.strictEqual(actual, error);
							assert.equal(ajaxq.firstCall.args[0], "default");
							resolve();
						} catch (assertionError) {
							reject(assertionError);
						}
					});
			});
		});

		it("should reject firmware result errors from JSON reads without a mutation toast", function () {
			var firmwareError = { result: 0x11 };
			ajaxq.callsFake(function () { return $.Deferred().resolve(firmwareError).promise(); });

			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/jsn?pw=", "json")
					.done(function () { reject(new Error("Read firmware error was reported as success")); })
					.fail(function (actual) {
						try {
							assert.strictEqual(actual, firmwareError);
							assert.equal(ajaxq.firstCall.args[0], "default");
							assert.isTrue(showError.notCalled);
							resolve();
						} catch (assertionError) {
							reject(assertionError);
						}
					});
			});
		});

		it("should preserve the station-busy guidance for manual-run result 48", function () {
			ajaxq.callsFake(function () {
				return $.Deferred().resolve({ result: 0x30 }).promise();
			});

			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/cm?pw=&sid=0&en=1")
					.done(function () { reject(new Error("Station-busy response was reported as success")); })
					.fail(function () {
						try {
							assert.isTrue(showError.calledOnceWith(
								"The selected station is already running or is scheduled to run."
							));
							resolve();
						} catch (error) {
							reject(error);
						}
					});
			});
		});

		it("should use the generic not-permitted guidance for sensor result 48", function () {
			ajaxq.callsFake(function () {
				return $.Deferred().resolve({ result: 0x30 }).promise();
			});

			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/csn?pw=&uuid=7")
					.done(function () { reject(new Error("Not-permitted response was reported as success")); })
					.fail(function () {
						try {
							assert.isTrue(showError.calledOnceWith("Operation not permitted. (Error 48)"));
							resolve();
						} catch (error) {
							reject(error);
						}
					});
			});
		});
	});

	describe("Rejected sensor requests", function () {
		var loading;
		var sendToOS;
		var showError;
		var updateControllerSensors;

		beforeEach(function () {
			loading = sinon.stub($.mobile, "loading");
			sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").callsFake(function () {
				return $.Deferred().reject({ result: 0x11 }).promise();
			});
			showError = sinon.stub(OSApp.Errors, "showError");
			updateControllerSensors = sinon.stub(OSApp.Sites, "updateControllerSensors");
		});

		afterEach(function () {
			loading.restore();
			sendToOS.restore();
			showError.restore();
			updateControllerSensors.restore();
		});

		it("should stop loading without refreshing after a rejected save", function () {
			OSApp.Sensors.changeSensor("/csn?pw=&uuid=-1", true);

			assert.isTrue(loading.calledWith("show"));
			assert.isTrue(loading.calledWith("hide"));
			assert.isFalse(updateControllerSensors.called);
		});

		it("should stop loading without refreshing after a rejected delete", function () {
			OSApp.Sensors.deleteSensor(7);

			assert.isTrue(loading.calledWith("show"));
			assert.isTrue(loading.calledWith("hide"));
			assert.isFalse(updateControllerSensors.called);
		});

		[ {
			name: "save",
			run: function () { OSApp.Sensors.changeSensor("/csn?pw=&uuid=7", false); }
		}, {
			name: "delete",
			run: function () { OSApp.Sensors.deleteSensor(7); }
		} ].forEach(function (mutation) {
			it("should stop loading without reporting success when refresh fails after " + mutation.name, function () {
				sendToOS.returns($.Deferred().resolve({ result: 1 }).promise());
				updateControllerSensors.returns($.Deferred().reject({ status: 500 }).promise());

				mutation.run();

				assert.isTrue(loading.calledWith("hide"));
				assert.isFalse(showError.called);
			});
		});
	});

	describe("Successful sensor requests", function () {
		it("should not report a sensor update until the refreshed sensor state is installed", function () {
			var controller = OSApp.currentSession.controller;
			var originalSensors = controller.sensors;
			var mutationRequest = $.Deferred();
			var refreshRequest = $.Deferred();
			var refreshedSensors = { sn: [ { uuid: 7, name: "Updated Sensor" } ] };
			var loading = sinon.stub($.mobile, "loading");
			var showError = sinon.stub(OSApp.Errors, "showError");
			var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
				if (url.indexOf("/csn?") === 0) {
					return mutationRequest.promise();
				}
				if (url === "/jsn?pw=") {
					return refreshRequest.promise();
				}
				return $.Deferred().reject({ status: 404 }).promise();
			});
			var page = $("<div id='sensors'></div>").appendTo("body");
			var programRefresh = sinon.spy();
			page.on("programrefresh", programRefresh);

			var updatePromise = OSApp.Sensors.changeSensor("/csn?pw=&uuid=7", false);
			mutationRequest.resolve({ result: 1 });

			return new Promise(function (resolve, reject) {
				updatePromise.done(function () {
					try {
						assert.strictEqual(controller.sensors, refreshedSensors);
						assert.isTrue(loading.calledWith("hide"));
						assert.isTrue(programRefresh.calledOnce);
						assert.isTrue(showError.calledOnceWith("Sensor updated successfully"));
						resolve();
					} catch (error) {
						reject(error);
					}
				}).fail(reject);

				setTimeout(function () {
					try {
						assert.equal(sendToOS.callCount, 2);
						assert.equal(sendToOS.secondCall.args[0], "/jsn?pw=");
						assert.strictEqual(controller.sensors, originalSensors);
						assert.isFalse(loading.calledWith("hide"));
						assert.isFalse(programRefresh.called);
						assert.isFalse(showError.called);
						refreshRequest.resolve(refreshedSensors);
					} catch (error) {
						reject(error);
					}
				}, 0);
			}).finally(function () {
				page.remove();
				sendToOS.restore();
				showError.restore();
				loading.restore();
				controller.sensors = originalSensors;
			});
		});
	});

	describe("Stale sensor mutation guards", function () {
		var originalSession;
		var originalController;
		var loading;
		var showError;
		var goBack;
		var page;
		var programRefresh;

		beforeEach(function () {
			originalSession = OSApp.currentSession;
			originalController = originalSession.controller;
			loading = sinon.stub($.mobile, "loading");
			showError = sinon.stub(OSApp.Errors, "showError");
			goBack = sinon.stub(OSApp.UIDom, "goBack");
			page = $("<div id='sensors'></div>").appendTo("body");
			programRefresh = sinon.spy();
			page.on("programrefresh", programRefresh);
		});

		afterEach(function () {
			OSApp.currentSession = originalSession;
			originalSession.controller = originalController;
			page.remove();
			goBack.restore();
			showError.restore();
			loading.restore();
		});

		it("should ignore an add response that arrives after the controller changes", function () {
			var mutationRequest = $.Deferred();
			var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").returns(mutationRequest.promise());
			var updateControllerSensors = sinon.stub(OSApp.Sites, "updateControllerSensors");
			var mutation = OSApp.Sensors.changeSensor("/csn?pw=&uuid=-1", true);

			originalSession.controller = { sensors: { sn: [ { uuid: 99 } ] } };
			mutationRequest.resolve({ result: 1 });

			return new Promise(function (resolve, reject) {
				mutation.done(function () {
					reject(new Error("Stale sensor add was reported as success"));
				}).fail(function (error) {
					try {
						assert.equal(error.statusText, "stale");
						assert.isFalse(updateControllerSensors.called);
						assert.isFalse(goBack.called);
						assert.isFalse(programRefresh.called);
						assert.isFalse(showError.called);
						assert.isTrue(loading.calledOnceWith("show"));
						assert.isFalse(loading.calledWith("hide"));
						resolve();
					} catch (assertionError) {
						reject(assertionError);
					}
				});
			}).finally(function () {
				updateControllerSensors.restore();
				sendToOS.restore();
			});
		});

		it("should ignore a delete response that arrives after the session changes", function () {
			var mutationRequest = $.Deferred();
			var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").returns(mutationRequest.promise());
			var updateControllerSensors = sinon.stub(OSApp.Sites, "updateControllerSensors");
			var mutation = OSApp.Sensors.deleteSensor(7);

			OSApp.currentSession = { controller: { sensors: { sn: [ { uuid: 99 } ] } } };
			mutationRequest.resolve({ result: 1 });

			return new Promise(function (resolve, reject) {
				mutation.done(function () {
					reject(new Error("Stale sensor delete was reported as success"));
				}).fail(function (error) {
					try {
						assert.equal(error.statusText, "stale");
						assert.isFalse(updateControllerSensors.called);
						assert.isFalse(goBack.called);
						assert.isFalse(programRefresh.called);
						assert.isFalse(showError.called);
						assert.isTrue(loading.calledOnceWith("show"));
						assert.isFalse(loading.calledWith("hide"));
						resolve();
					} catch (assertionError) {
						reject(assertionError);
					}
				});
			}).finally(function () {
				updateControllerSensors.restore();
				sendToOS.restore();
			});
		});

		it("should not install a late sensor refresh into a replacement controller", function () {
			var mutationRequest = $.Deferred();
			var refreshRequest = $.Deferred();
			var replacementSensors = { sn: [ { uuid: 99, name: "Replacement Sensor" } ] };
			var replacementController = { sensors: replacementSensors };
			var staleSensors = { sn: [ { uuid: 7, name: "Stale Sensor" } ] };
			var sendToOS = sinon.stub(OSApp.Firmware, "sendToOS").callsFake(function (url) {
				return url.indexOf("/csn?") === 0 ? mutationRequest.promise() : refreshRequest.promise();
			});
			var mutation = OSApp.Sensors.changeSensor("/csn?pw=&uuid=7", false);

			mutationRequest.resolve({ result: 1 });

			return new Promise(function (resolve, reject) {
				setTimeout(function () {
					try {
						assert.equal(sendToOS.callCount, 2);
						assert.equal(sendToOS.secondCall.args[0], "/jsn?pw=");
						originalSession.controller = replacementController;
						refreshRequest.resolve(staleSensors);
					} catch (error) {
						reject(error);
					}
				}, 0);

				mutation.done(function () {
					reject(new Error("Stale sensor refresh was reported as success"));
				}).fail(function (error) {
					try {
						assert.equal(error.statusText, "stale");
						assert.strictEqual(replacementController.sensors, replacementSensors);
						assert.isFalse(goBack.called);
						assert.isFalse(programRefresh.called);
						assert.isFalse(showError.called);
						assert.isTrue(loading.calledOnceWith("show"));
						assert.isFalse(loading.calledWith("hide"));
						resolve();
					} catch (assertionError) {
						reject(assertionError);
					}
				});
			}).finally(function () {
				sendToOS.restore();
			});
		});
	});

	it("should abort and reject stalled sensor log downloads", function () {
		var clock = sinon.useFakeTimers();
		var fetchRequest = sinon.stub(window, "fetch").returns(new Promise(function () {}));
		var originalTimeout = $.ajaxSettings.timeout;
		var failure;

		try {
			$.ajaxSettings.timeout = 25;
			OSApp.Firmware.sendToOS("/jsl?pw=&fmt=binary&count=max", "arraybuffer")
				.fail(function (error) { failure = error; });

			clock.tick(25);

			assert.deepEqual(failure, { status: 0, statusText: "timeout" });
			assert.isTrue(fetchRequest.firstCall.args[1].signal.aborted);
		} finally {
			$.ajaxSettings.timeout = originalTimeout;
			fetchRequest.restore();
			clock.restore();
		}
	});

	it("should allow a full CSV export ten minutes before timing out", function () {
		var clock = sinon.useFakeTimers();
		var fetchRequest = sinon.stub(window, "fetch").returns(new Promise(function () {}));
		var failure;

		try {
			OSApp.Firmware.sendToOS("/jsl?pw=&fmt=csv&count=max", "blob")
				.fail(function (error) { failure = error; });

			clock.tick(10 * 60 * 1000 - 1);
			assert.isUndefined(failure);
			clock.tick(1);
			assert.deepEqual(failure, { status: 0, statusText: "timeout" });
			assert.isTrue(fetchRequest.firstCall.args[1].signal.aborted);
		} finally {
			fetchRequest.restore();
			clock.restore();
		}
	});

	describe("Sensor log binary responses", function () {
		function response(contentType, body) {
			return {
				ok: true,
				headers: { get: function () { return contentType; } },
				json: function () { return Promise.resolve(body); },
				arrayBuffer: function () { return Promise.resolve(body); }
			};
		}

		function expectSuccess(fetchResponse, check) {
			var fetchRequest = sinon.stub(window, "fetch").returns(Promise.resolve(fetchResponse));
			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/jsl?pw=&fmt=binary&count=max", "arraybuffer")
					.done(function (data) {
						try {
							check(data);
							resolve();
						} catch (error) {
							reject(error);
						}
					})
					.fail(reject);
			}).finally(function () { fetchRequest.restore(); });
		}

		function expectFailure(fetchResponse, check) {
			var fetchRequest = sinon.stub(window, "fetch").returns(Promise.resolve(fetchResponse));
			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/jsl?pw=&fmt=binary&count=max", "arraybuffer")
					.done(function () { reject(new Error("Invalid sensor log response was reported as success")); })
					.fail(function (error) {
						try {
							check(error);
							resolve();
						} catch (assertionError) {
							reject(assertionError);
						}
					});
			}).finally(function () { fetchRequest.restore(); });
		}

		it("should treat firmware result 80 as an empty log", function () {
			return expectSuccess(response("application/json", { result: 80 }), function (data) {
				assert.instanceOf(data, ArrayBuffer);
				assert.equal(data.byteLength, 0);
				assert.isTrue(data.noLogHeader);
			});
		});

		it("should return a server CSV response as a Blob", function () {
			var csvBlob = new Blob([ "uuid,timestamp,value\n7,1700000000,42\n" ], {
				type: "text/csv;charset=utf-8"
			});
			var readBlob = sinon.stub().returns(Promise.resolve(csvBlob));
			var fetchRequest = sinon.stub(window, "fetch").returns(Promise.resolve({
				ok: true,
				headers: { get: function () { return "text/csv;charset=utf-8"; } },
				blob: readBlob
			}));

			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/jsl?pw=&fmt=csv&count=max", "blob")
					.done(function (data) {
						try {
							assert.strictEqual(data, csvBlob);
							assert.isTrue(readBlob.calledOnce);
							resolve();
						} catch (error) {
							reject(error);
						}
					})
					.fail(reject);
			}).finally(function () { fetchRequest.restore(); });
		});

		it("should reject JSON authentication errors", function () {
			return expectFailure(response("application/json", { result: 2 }), function (error) {
				assert.deepEqual(error, { status: 401 });
			});
		});

		it("should reject truncated binary records", function () {
			return expectFailure(response("application/octet-stream", new ArrayBuffer(11)), function (error) {
				assert.deepEqual(error, { status: 0, statusText: "parsererror" });
			});
		});

		it("should reject HTML returned in place of a binary log", function () {
			return expectFailure(response("text/html", new ArrayBuffer(10)), function (error) {
				assert.deepEqual(error, { status: 0, statusText: "parsererror" });
			});
		});

		it("should reject HTML returned in place of a CSV export", function () {
			var readBlob = sinon.stub().returns(Promise.resolve(new Blob([ "login" ], { type: "text/html" })));
			var fetchRequest = sinon.stub(window, "fetch").returns(Promise.resolve({
				ok: true,
				headers: { get: function () { return "text/html"; } },
				blob: readBlob
			}));

			return new Promise(function (resolve, reject) {
				OSApp.Firmware.sendToOS("/jsl?pw=&fmt=csv&count=max", "blob")
					.done(function () { reject(new Error("HTML was reported as a CSV export")); })
					.fail(function (error) {
						try {
							assert.deepEqual(error, { status: 0, statusText: "parsererror" });
							assert.isFalse(readBlob.called);
							resolve();
						} catch (assertionError) {
							reject(assertionError);
						}
					});
			}).finally(function () { fetchRequest.restore(); });
		});
	});

});

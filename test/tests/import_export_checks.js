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

describe("Import/Export Checks", function () {
	function resolved(value) {
		return $.Deferred().resolve(value).promise();
	}

	function rejected(value) {
		return $.Deferred().reject(value).promise();
	}

	function asNative(promise) {
		return new Promise(function (resolve, reject) {
			promise.then(resolve, reject);
		});
	}

	function cleanupAfter(promise, sandbox, controller) {
		return promise.then(function (value) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			return value;
		}, function (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		});
	}

	function suppressPostImportRefresh(sandbox) {
		var nativeSetTimeout = window.setTimeout;
		sandbox.stub(window, "setTimeout").callsFake(function (callback, delay) {
			if (delay === 1500) return 0;
			return nativeSetTimeout.apply(window, arguments);
		});
	}

	function installImportHarness(sandbox, sensors) {
		var previousController = OSApp.currentSession.controller;
		OSApp.currentSession.controller = {
			options: { fwv: 300 },
			settings: {},
			sensors: { sn: sensors || [] }
		};
		sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, warning, callback) {
			return callback();
		});
		sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.Firmware, "isOSPi").returns(false);
		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(true);
		suppressPostImportRefresh(sandbox);
		return previousController;
	}

	function baseBackup() {
		return {
			options: { fwv: 300 },
			settings: { loc: "Test", nbrd: 1 },
			stations: { snames: [ "S1" ], masop: [ 0 ] },
			programs: { pd: [] }
		};
	}

	function program(name, adjustment) {
		return [
			129,
			127,
			0,
			[ 60, -1, -1, -1 ],
			[ 30 ],
			name,
			[ 1, 321, 385 ],
			adjustment
		];
	}

	function onboardSensor(uuid, name, input) {
		return {
			uuid: uuid,
			name: name,
			unit: 0,
			flag: 1,
			interval: 5,
			min: 0,
			max: 1,
			type: 4,
			extra: { input: input }
		};
	}

	function weatherSensor(uuid, name, action) {
		return {
			uuid: uuid,
			name: name,
			unit: 0,
			flag: 1,
			interval: 5,
			min: 0,
			max: 1,
			type: 2,
			extra: { action: action }
		};
	}

	function aggregateChildren(firstUUID, secondUUID) {
		var children = [
			{ uuid: firstUUID, scale: 1, offset: 0 },
			{ uuid: secondUUID, scale: 2, offset: 3 }
		];
		while (children.length < 8) children.push({ uuid: 0, scale: 1, offset: 0 });
		return children;
	}

	function aggregateSensor(uuid, name, firstUUID, secondUUID) {
		return {
			uuid: uuid,
			name: name,
			unit: 0,
			flag: 3,
			interval: 10,
			min: -10,
			max: 10,
			type: 0,
			extra: { action: 2, children: aggregateChildren(firstUUID, secondUUID) }
		};
	}

	function sensorDescription() {
		return {
			sensors: [
				{ name: "Aggregate", args: [ { arg: "action" } ] },
				{ name: "ADS1115", hardware_detected: false, args: [ { arg: "subtype", options: [ { id: 0 }, { id: 1 } ] } ] },
				{ name: "Weather", disabled: true, args: [] },
				{ name: "System", args: [ { arg: "metric", options: [ { id: 0 } ] } ] },
				{ name: "Onboard", args: [ { arg: "input", options: [ { id: 0 }, { id: 1 }, { id: 2 }, { id: 3 } ] } ] }
			],
			units: [ { value: 0, group: 0 } ],
			enums: { AggregateAction: [ "Min", "Max", "Average", "Sum", "Median", "Range" ], WeatherAction: [ "ET" ] },
			args: [],
			flags: []
		};
	}

	function paramsFor(command) {
		return new URL("http://controller" + command).searchParams;
	}

	function applySensorCommand(state, command, nextUUID) {
		var params = paramsFor(command),
			uuid = Number(params.get("uuid")),
			existing = uuid === -1 ? null : state.find(function (sensor) { return sensor.uuid === uuid; }),
			type = Number(params.get("type")),
			sensor = {
				uuid: uuid === -1 ? nextUUID : uuid,
				name: params.get("name"),
				unit: Number(params.get("unit")),
				flag: Number(params.get("flag")),
				status: 1,
				interval: Number(params.get("interval")),
				min: Number(params.get("min")),
				max: Number(params.get("max")),
				value: 0,
				type: type,
				extra: {}
			};

		if (type === 0) {
			sensor.extra.action = Number(params.get("action"));
			if (params.has("children")) {
				sensor.extra.children = params.get("children").split(";").filter(Boolean).map(function (item) {
					var parts = item.split(",");
					return { uuid: Number(parts[0]), scale: Number(parts[1]), offset: Number(parts[2]) };
				});
			} else if (existing && existing.type === 0) {
				sensor.extra.children = existing.extra.children;
			} else {
				sensor.extra.children = aggregateChildren(0, 0);
				sensor.extra.children[1] = { uuid: 0, scale: 1, offset: 0 };
			}
			while (sensor.extra.children.length < 8) sensor.extra.children.push({ uuid: 0, scale: 1, offset: 0 });
		} else if (type === 4) {
			sensor.extra.input = Number(params.get("input"));
		} else if (type === 2) {
			sensor.extra.action = Number(params.get("action"));
		}

		if (existing) {
			state[state.indexOf(existing)] = sensor;
		} else {
			state.push(sensor);
		}
		return sensor.uuid;
	}

	it("should transform master and sensor 3/4 option indices to firmware JSON names", function () {
		var checkOSVersion = sinon.stub(OSApp.Firmware, "checkOSVersion").returns(true);
		try {
			var query = OSApp.Utils.transformKeysinString(
				"/co?pw=&o73=9&o74=-10&o75=20&o76=10&o77=-30&o78=40" +
				"&o79=1&o80=0&o81=5&o82=6&o83=3&o84=1&o85=7&o86=8"
			);
			assert.equal(
				query,
				"/co?pw=&mas3=9&mton3=-10&mtof3=20&mas4=10&mton4=-30&mtof4=40" +
				"&sn3t=1&sn3o=0&sn3on=5&sn3of=6&sn4t=3&sn4o=1&sn4on=7&sn4of=8"
			);
		} finally {
			checkOSVersion.restore();
		}
	});

	it("should restore options and programs in order without changing sensors in an older backup", function () {
		var sandbox = sinon.createSandbox(),
			controller = installImportHarness(sandbox, [ onboardSensor(42, "Existing", 0) ]),
			commands = [];

		try {
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				commands.push(command);
				return resolved({ result: 1 });
			});
			var backup = baseBackup();
			backup.options = {
				fwv: 300,
				devid: "opt & = # ü",
				mas3: 9, mton3: -10, mtof3: 20,
				mas4: 10, mton4: -30, mtof4: 40,
				sn3t: 1, sn3o: 0, sn3on: 5, sn3of: 6,
				sn4t: 3, sn4o: 1, sn4on: 7, sn4of: 8
			};
			backup.settings = {
				loc: "A&B = # Montréal",
				nbrd: 1,
				ifkey: "key&x=y#z",
				dname: "Yard & Patio = #1",
				mqtt: { host: "mqtt.example/a&b=c#d" }
			};
			backup.stations = {
				snames: [ "S1" ], masop: [ 0 ], masop3: [ 1 ], masop4: [ 2 ], ignore_sn3: [ 4 ], ignore_sn4: [ 8 ]
			};
			backup.programs.pd = [
				program("Morning & East=West", { flag: 1, uuid: 42, splits: [ { x: 0, y: 50 } ] }),
				program("Disabled adjustment", { flag: 0, uuid: 42, splits: [ { x: 10, y: 0.75 } ] }),
				program("Empty adjustment", {}),
				program("Disabled without points", { flag: 4, uuid: 42, splits: [] })
			];

			return cleanupAfter(asNative(OSApp.ImportExport.importConfig(backup)).then(function () {
				var co = commands.find(function (command) { return command.indexOf("/co?") === 0; }),
					coParams = paramsFor(co),
					dpIndex = commands.indexOf("/dp?pw=&pid=-1"),
					cpIndex = commands.findIndex(function (command) { return command.indexOf("/cp?") === 0; }),
					programCommands = commands.filter(function (command) { return command.indexOf("/cp?") === 0; });
				assert.equal(coParams.get("devid"), "opt_&_=_#_ü");
				assert.equal(coParams.get("ifkey"), backup.settings.ifkey);
				assert.equal(coParams.get("dname"), backup.settings.dname);
				assert.equal(coParams.get("loc"), backup.settings.loc);
				assert.equal(coParams.get("mqtt"), OSApp.Utils.escapeJSON(backup.settings.mqtt));
				assert.include(commands, "/cs?pw=&m0=0&u0=1&v0=2&o0=4&r0=8");
				assert.isBelow(dpIndex, cpIndex);
				assert.include(commands[cpIndex], "&name=Morning%20%26%20East%3DWest");
				assert.include(commands[cpIndex], "&endr=1&from=321&to=385&snadj=1,42,0,50");
				assert.include(programCommands[1], "&name=Disabled%20adjustment");
				assert.include(programCommands[1], "&snadj=0,42,10,0.75");
				assert.include(programCommands[2], "&name=Empty%20adjustment");
				assert.include(programCommands[2], "&snadj=0,0");
				assert.include(programCommands[3], "&name=Disabled%20without%20points");
				assert.include(programCommands[3], "&snadj=4,42");
				assert.notInclude(commands.join("\n"), "/csn?");
				assert.notInclude(commands.join("\n"), "/dsn?");
				assert.notInclude(commands.join("\n"), "/jsn?");
			}), sandbox, controller);
		} catch (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		}
	});

	it("should create and remap sensors before aggregates and ordered programs", function () {
		var sandbox = sinon.createSandbox(),
			state = [ onboardSensor(77, "Target only", 1) ],
			controller = installImportHarness(sandbox, state),
			commands = [],
			nextUUID = 101;

		try {
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				commands.push(command);
				if (command.indexOf("/jsd?") === 0) return resolved(sensorDescription());
				if (command.indexOf("/jsn?") === 0) return resolved({ sn: JSON.parse(JSON.stringify(state)), count: state.length });
				if (command.indexOf("/csn?") === 0) {
					var created = Number(paramsFor(command).get("uuid")) === -1;
					applySensorCommand(state, command, nextUUID);
					if (created) nextUUID++;
					return resolved({ result: 1 });
				}
				return resolved({ result: 1 });
			});

			var sourceLeaf = onboardSensor(10, "Source leaf", 0),
				sourceAggregate = aggregateSensor(20, "Source aggregate", 10, 20),
				backup = baseBackup();
			backup.sensors = { sn: [ sourceLeaf, sourceAggregate ], count: 2 };
			backup.programs.pd = [
				program("First", { flag: 1, uuid: 10, splits: [ { x: 0, y: 25 } ] }),
				program("Second", { flag: 1, uuid: 20, splits: [ { x: 1, y: 1 } ] })
			];

			return cleanupAfter(asNative(OSApp.ImportExport.importConfig(backup)).then(function () {
				var createCommands = commands.filter(function (command) {
					return command.indexOf("/csn?") === 0 && paramsFor(command).get("uuid") === "-1";
				}),
					aggregateUpdate = commands.find(function (command) {
					return command.indexOf("/csn?") === 0 && paramsFor(command).get("uuid") === "102" && paramsFor(command).has("children");
				}),
					dpIndex = commands.indexOf("/dp?pw=&pid=-1"),
					programCommands = commands.filter(function (command) { return command.indexOf("/cp?") === 0; });

				assert.lengthOf(createCommands, 2);
				assert.isFalse(paramsFor(createCommands[1]).has("children"));
				assert.equal(paramsFor(aggregateUpdate).get("children").split(";")[0], "101,1,0");
				assert.equal(paramsFor(aggregateUpdate).get("children").split(";")[1], "102,2,3");
				assert.isTrue(state.some(function (sensor) { return sensor.uuid === 77; }), "target-only sensor is preserved");
				assert.isBelow(commands.indexOf(aggregateUpdate), dpIndex);
				assert.lengthOf(programCommands, 2);
				assert.include(programCommands[0], "&name=First");
				assert.include(programCommands[0], "&snadj=1,101,0,25");
				assert.include(programCommands[1], "&name=Second");
				assert.include(programCommands[1], "&snadj=1,102,1,1");
				assert.isBelow(commands.indexOf(programCommands[0]), commands.indexOf(programCommands[1]));
			}), sandbox, controller);
		} catch (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		}
	});

	it("should allow a disabled sensor type only when the same UUID and type already exist", function () {
		var sandbox = sinon.createSandbox(),
			existing = weatherSensor(42, "Existing weather", 0),
			state = [ existing ],
			controller = installImportHarness(sandbox, state),
			commands = [],
			description = sensorDescription();

		try {
			var source = weatherSensor(42, "Restored weather", 0);
			assert.isTrue(OSApp.ImportExport.sensorDefinitionSupported(source, description, state));
			assert.isFalse(OSApp.ImportExport.sensorDefinitionSupported(source, description, []));
			assert.isFalse(OSApp.ImportExport.sensorDefinitionSupported(source, description, [ onboardSensor(42, "Wrong type", 0) ]));

			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				commands.push(command);
				if (command.indexOf("/jsd?") === 0) return resolved(description);
				if (command.indexOf("/jsn?") === 0) return resolved({ sn: JSON.parse(JSON.stringify(state)), count: state.length });
				if (command.indexOf("/csn?") === 0) {
					applySensorCommand(state, command, 100);
					return resolved({ result: 1 });
				}
				return resolved({ result: 1 });
			});
			var backup = baseBackup();
			backup.sensors = { sn: [ source ], count: 1 };

			return cleanupAfter(asNative(OSApp.ImportExport.importConfig(backup)).then(function () {
				var update = commands.find(function (command) { return command.indexOf("/csn?") === 0; });
				assert.equal(paramsFor(update).get("uuid"), "42");
				assert.equal(paramsFor(update).get("type"), "2");
				assert.equal(state[0].name, "Restored weather");
			}), sandbox, controller);
		} catch (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		}
	});

	it("should validate complete current and legacy program shapes before import", function () {
		var encodedStarts = program("Encoded starts", null);
		encodedStarts[3] = [ -1, 16444, 12318, 32767 ];
		assert.isTrue(OSApp.ImportExport.validateProgramDefinition(encodedStarts, 300, 1, 1));
		assert.isTrue(OSApp.ImportExport.validateProgramDefinition([ 1, 127, 0, 60, 60, 0, 30, 1 ], 209, 8, 1));
		assert.isFalse(OSApp.ImportExport.validateProgramDefinition([
			177, 127, 0, [ 60, -1, -1, -1 ], [ 30 ], "Zero interval", [ 0, 33, 415 ]
		], 300, 1, 1));
		assert.isFalse(OSApp.ImportExport.validateProgramDefinition([
			129, 127, 0, [ 60, -1, -1, -1 ], [ 30 ], "Bad date", [ 1, 94, 415 ]
		], 300, 1, 1));

		var sandbox = sinon.createSandbox(),
			controller = OSApp.currentSession.controller;
		try {
			OSApp.currentSession.controller = {
				options: {},
				settings: {},
				stations: { snames: [ "S1" ] },
				programs: { nboards: 1 },
				sensors: { sn: [] }
			};
			sandbox.stub(OSApp.Errors, "showError");
			sandbox.stub(OSApp.UIDom, "areYouSure");
			sandbox.stub(OSApp.Firmware, "sendToOS");

			var missingName = program("Missing name", null).slice(0, 5),
				shortStarts = program("Short starts", null),
				shortDurations = program("Short durations", null),
				shortDateRange = program("Short date", null);
			shortStarts[3] = [ 60, -1, -1 ];
			shortDurations[4] = [];
			shortDateRange[6] = [ 1, 321 ];

			[ missingName, shortStarts, shortDurations, shortDateRange ].forEach(function (invalidProgram) {
				var backup = baseBackup();
				backup.programs.pd = [ invalidProgram ];
				OSApp.ImportExport.importConfig(backup);
			});

			assert.equal(OSApp.Errors.showError.callCount, 4);
			assert.isTrue(OSApp.UIDom.areYouSure.notCalled);
			assert.isTrue(OSApp.Firmware.sendToOS.notCalled);
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = controller;
		}
	});

	it("should reject firmware-invalid programs and excess program counts before confirmation", function () {
		var sandbox = sinon.createSandbox(),
			controller = OSApp.currentSession.controller;
		try {
			OSApp.currentSession.controller = {
				options: { fwv: 300 },
				settings: {},
				stations: { snames: [ "S1" ] },
				programs: { nboards: 1, mnp: 1 },
				sensors: { sn: [] }
			};
			sandbox.stub(OSApp.Errors, "showError");
			sandbox.stub(OSApp.UIDom, "areYouSure");
			sandbox.stub(OSApp.Firmware, "sendToOS");

			var invalidDate = baseBackup(),
				zeroInterval = baseBackup(),
				excessPrograms = baseBackup(),
				intervalProgram = program("Zero interval", null);
			invalidDate.programs.pd = [ program("Bad date", null) ];
			invalidDate.programs.pd[0][6] = [ 1, 321, 654 ];
			intervalProgram[0] = ( intervalProgram[0] & ~0x30 ) | 0x30;
			intervalProgram[2] = 0;
			zeroInterval.programs.pd = [ intervalProgram ];
			excessPrograms.programs.pd = [ program("First", null), program("Second", null) ];

			OSApp.ImportExport.importConfig(invalidDate);
			OSApp.ImportExport.importConfig(zeroInterval);
			OSApp.ImportExport.importConfig(excessPrograms);

			assert.equal(OSApp.Errors.showError.callCount, 3);
			assert.isTrue(OSApp.UIDom.areYouSure.notCalled);
			assert.isTrue(OSApp.Firmware.sendToOS.notCalled);
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = controller;
		}
	});

	it("should validate backup programs against the source station count", function () {
		var sandbox = sinon.createSandbox(),
			controller = OSApp.currentSession.controller;
		try {
			OSApp.currentSession.controller = {
				options: { fwv: 300 },
				settings: {},
				stations: { snames: Array(16).fill("Target station") },
				programs: { nboards: 2, mnp: 4 },
				sensors: { sn: [] }
			};
			sandbox.stub(OSApp.Errors, "showError");
			sandbox.stub(OSApp.UIDom, "areYouSure");
			sandbox.stub(OSApp.Firmware, "sendToOS");

			var backup = baseBackup();
			backup.stations.snames = Array(8).fill("Source station");
			backup.stations.masop = [ 0 ];
			backup.programs.pd = [ program("Eight stations", null) ];
			backup.programs.pd[0][4] = Array(8).fill(30);

			OSApp.ImportExport.importConfig(backup);

			assert.isTrue(OSApp.Errors.showError.notCalled);
			assert.isTrue(OSApp.UIDom.areYouSure.calledOnce);
			assert.isTrue(OSApp.Firmware.sendToOS.notCalled);
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = controller;
		}
	});

	it("should reject missing or malformed backup collections before confirmation", function () {
		var sandbox = sinon.createSandbox(),
			controller = OSApp.currentSession.controller;
		try {
			OSApp.currentSession.controller = {
				options: { fwv: 300 },
				settings: {},
				stations: { snames: [ "S1" ] },
				programs: { nboards: 1, mnp: 4 },
				sensors: { sn: [] }
			};
			sandbox.stub(OSApp.Errors, "showError");
			sandbox.stub(OSApp.UIDom, "areYouSure");
			sandbox.stub(OSApp.Firmware, "sendToOS");

			var missingPrograms = baseBackup(),
				malformedPrograms = baseBackup(),
				nullSensors = baseBackup(),
				malformedSensors = baseBackup(),
				mismatchedSensorCount = baseBackup();
			delete missingPrograms.programs;
			malformedPrograms.programs.pd = {};
			nullSensors.sensors = null;
			malformedSensors.sensors = { sn: {} };
			mismatchedSensorCount.sensors = { sn: [], count: 1 };

			OSApp.ImportExport.importConfig(missingPrograms);
			OSApp.ImportExport.importConfig(malformedPrograms);
			OSApp.ImportExport.importConfig(nullSensors);
			OSApp.ImportExport.importConfig(malformedSensors);
			OSApp.ImportExport.importConfig(mismatchedSensorCount);

			assert.equal(OSApp.Errors.showError.callCount, 5);
			assert.isTrue(OSApp.UIDom.areYouSure.notCalled);
			assert.isTrue(OSApp.Firmware.sendToOS.notCalled);
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = controller;
		}
	});

	it("should restore older 2.1 programs without date metadata using a valid full range", function () {
		var sandbox = sinon.createSandbox(),
			controller = installImportHarness(sandbox, []),
			commands = [];

		try {
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				commands.push(command);
				return resolved({ result: 1 });
			});
			var backup = baseBackup(),
				oldProgram = program("Legacy 2.1", null).slice(0, 6);
			backup.options.fwv = 210;
			oldProgram[0] = 1;
			backup.programs.pd = [ oldProgram ];

			return cleanupAfter(asNative(OSApp.ImportExport.importConfig(backup)).then(function () {
				var command = commands.find(function (item) { return item.indexOf("/cp?") === 0; });
				assert.include(command, "&endr=0&from=33&to=415");
				assert.notInclude(command, "&from=0&to=0");
			}), sandbox, controller);
		} catch (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		}
	});

	it("should stop ordered program creation after the first failure", function () {
		var sandbox = sinon.createSandbox(),
			controller = installImportHarness(sandbox, []),
			commands = [],
			errors = [];

		try {
			sandbox.stub(OSApp.Errors, "showError").callsFake(function (message) { errors.push(message); });
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				commands.push(command);
				if (command.indexOf("/cp?") === 0) return rejected({ status: 500 });
				return resolved({ result: 1 });
			});
			var backup = baseBackup();
			backup.programs.pd = [ program("First", null), program("Second", null) ];

			var assertStopped = function () {
				var programCommands = commands.filter(function (command) { return command.indexOf("/cp?") === 0; });
				assert.lengthOf(programCommands, 1);
				assert.include(programCommands[0], "&name=First");
				assert.isTrue(errors.some(function (message) { return message.indexOf("restore stopped before completion") !== -1; }));
			};
			return cleanupAfter(asNative(OSApp.ImportExport.importConfig(backup)).then(assertStopped, assertStopped), sandbox, controller);
		} catch (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		}
	});

	it("should stop base command dispatch after the first failure", function () {
		var sandbox = sinon.createSandbox(),
			controller = installImportHarness(sandbox, []),
			commands = [],
			errors = [];

		try {
			sandbox.stub(OSApp.Errors, "showError").callsFake(function (message) { errors.push(message); });
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				commands.push(command);
				return rejected({ status: 500 });
			});

			var assertStopped = function () {
				assert.lengthOf(commands, 1);
				assert.match(commands[0], /^\/co\?/);
				assert.notInclude(commands, "/dp?pw=&pid=-1");
				assert.isTrue(errors.some(function (message) { return message.indexOf("restore stopped before completion") !== -1; }));
			};
			return cleanupAfter(asNative(OSApp.ImportExport.importConfig(baseBackup())).then(assertStopped, assertStopped), sandbox, controller);
		} catch (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		}
	});

	it("should stop queued import commands when the active controller changes", function () {
		var sandbox = sinon.createSandbox(),
			controller = installImportHarness(sandbox, []),
			firstRequest = $.Deferred(),
			commands = [],
			errors = [];

		try {
			sandbox.stub(OSApp.Errors, "showError").callsFake(function (message) { errors.push(message); });
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				commands.push(command);
				return commands.length === 1 ? firstRequest.promise() : resolved({ result: 1 });
			});

			var restore = asNative(OSApp.ImportExport.importConfig(baseBackup()));
			assert.lengthOf(commands, 1);
			assert.match(commands[0], /^\/co\?/);

			OSApp.currentSession.controller = { marker: "replacement-controller" };
			firstRequest.resolve({ result: 1 });

			var assertStopped = function () {
				assert.lengthOf(commands, 1);
				assert.notInclude(commands, "/dp?pw=&pid=-1");
				assert.isTrue(errors.some(function (message) {
					return message.indexOf("active controller changed") !== -1;
				}));
			};
			return cleanupAfter(restore.then(assertStopped, assertStopped), sandbox, controller);
		} catch (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		}
	});

	it("should not delete a child of a preserved target-only aggregate for capacity", function () {
		var sandbox = sinon.createSandbox(),
			state = [ aggregateSensor(1, "Preserved aggregate", 64, 0) ],
			commands = [];
		for (var uuid = 2; uuid <= 64; uuid++) state.push(onboardSensor(uuid, "Target " + uuid, 0));
		var controller = installImportHarness(sandbox, state);

		try {
			sandbox.stub(OSApp.Errors, "showError");
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				commands.push(command);
				if (command.indexOf("/jsd?") === 0) return resolved(sensorDescription());
				if (command.indexOf("/csn?") === 0) return rejected({ status: 500 });
				return resolved({ result: 1 });
			});
			var backup = baseBackup();
			backup.sensors = { sn: [ onboardSensor(1000, "New source", 0) ] };
			var assertDeletion = function () {
				var deleteCommand = commands.find(function (command) { return command.indexOf("/dsn?") === 0; });
				assert.equal(paramsFor(deleteCommand).get("uuid"), "63");
				assert.notEqual(paramsFor(deleteCommand).get("uuid"), "64");
				assert.include(OSApp.UIDom.areYouSure.firstCall.args[1], "sensor limit");
			};
			return cleanupAfter(asNative(OSApp.ImportExport.importConfig(backup)).then(assertDeletion, assertDeletion), sandbox, controller);
		} catch (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		}
	});

	it("should delete a target-only aggregate before its child when both are needed for capacity", function () {
		var sandbox = sinon.createSandbox(),
			state = [],
			commands = [];
		for (var uuid = 1; uuid <= 62; uuid++) state.push(onboardSensor(uuid, "Shared " + uuid, 0));
		state.push(aggregateSensor(63, "Target-only aggregate", 64, 0));
		state.push(onboardSensor(64, "Target-only child", 0));
		var controller = installImportHarness(sandbox, state);

		try {
			sandbox.stub(OSApp.Errors, "showError");
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (command) {
				commands.push(command);
				if (command.indexOf("/jsd?") === 0) return resolved(sensorDescription());
				if (command.indexOf("/csn?") === 0) return rejected({ status: 500 });
				return resolved({ result: 1 });
			});
			var backup = baseBackup(),
				backupSensors = [];
			for (var uuid = 1; uuid <= 62; uuid++) backupSensors.push(onboardSensor(uuid, "Shared " + uuid, 0));
			backupSensors.push(onboardSensor(1000, "New source 1", 0));
			backupSensors.push(onboardSensor(1001, "New source 2", 0));
			backup.sensors = { sn: backupSensors, count: backupSensors.length };

			var assertDeletions = function () {
				var deleteCommands = commands.filter(function (command) { return command.indexOf("/dsn?") === 0; });
				assert.deepEqual(deleteCommands.map(function (command) {
					return paramsFor(command).get("uuid");
				}), [ "63", "64" ]);
				assert.include(OSApp.UIDom.areYouSure.firstCall.args[1], "sensor limit");
			};
			return cleanupAfter(asNative(OSApp.ImportExport.importConfig(backup)).then(assertDeletions, assertDeletions), sandbox, controller);
		} catch (error) {
			OSApp.currentSession.controller = controller;
			sandbox.restore();
			throw error;
		}
	});

	it("should reject incompatible programs and invalid sensor ranges before mutation", function () {
		var sandbox = sinon.createSandbox(),
			controller = OSApp.currentSession.controller;
		try {
			OSApp.currentSession.controller = { options: {}, sensors: { sn: [] } };
			sandbox.stub(OSApp.Firmware, "isOSPi").returns(true);
			sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(false);
			sandbox.stub(OSApp.UIDom, "areYouSure");
			sandbox.stub(OSApp.Firmware, "sendToOS");
			sandbox.stub(OSApp.Errors, "showError");

			var incompatible = baseBackup();
			incompatible.options.fwv = 300;
			incompatible.programs.pd = [ program("New", null) ];
			OSApp.ImportExport.importConfig(incompatible);
			assert.isTrue(OSApp.UIDom.areYouSure.notCalled);

			OSApp.Firmware.isOSPi.returns(false);
			OSApp.Firmware.checkOSVersion.returns(true);
			var invalid = baseBackup();
			var badSensor = onboardSensor(1, "Bad range", 0);
			badSensor.min = 10;
			badSensor.max = 1;
			invalid.sensors = { sn: [ badSensor ] };
			OSApp.ImportExport.importConfig(invalid);
			assert.isTrue(OSApp.UIDom.areYouSure.notCalled);

			var invalidAdjustment = baseBackup();
			invalidAdjustment.programs.pd = [ program("Bad adjustment", {
				flag: 1, uuid: 1, splits: [ { x: 5, y: 1 }, { x: 4, y: 1 } ]
			}) ];
			OSApp.ImportExport.importConfig(invalidAdjustment);
			assert.isTrue(OSApp.UIDom.areYouSure.notCalled);

			var malformedNonEmptyAdjustment = baseBackup();
			malformedNonEmptyAdjustment.programs.pd = [ program("Incomplete adjustment", { uuid: 1 }) ];
			OSApp.ImportExport.importConfig(malformedNonEmptyAdjustment);
			assert.isTrue(OSApp.UIDom.areYouSure.notCalled);

			var enabledWithoutPoints = baseBackup();
			enabledWithoutPoints.programs.pd = [ program("Enabled without points", { flag: 1, uuid: 1, splits: [] }) ];
			OSApp.ImportExport.importConfig(enabledWithoutPoints);
			assert.isTrue(OSApp.UIDom.areYouSure.notCalled);
			assert.isTrue(OSApp.Firmware.sendToOS.notCalled);
			assert.equal(OSApp.Errors.showError.callCount, 5);
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = controller;
		}
	});

	it("should guard network warning comparisons when backup options are null", function () {
		var sandbox = sinon.createSandbox(),
			controller = OSApp.currentSession.controller;
		try {
			OSApp.currentSession.controller = { options: {}, sensors: { sn: [] } };
			sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(true);
			sandbox.stub(OSApp.UIDom, "areYouSure");
			var backup = baseBackup();
			backup.options = null;
			assert.doesNotThrow(function () {
				OSApp.ImportExport.importConfig(backup);
			});
			assert.isTrue(OSApp.UIDom.areYouSure.calledOnce);
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = controller;
		}
	});
});

/* global describe, it, before, beforeEach, afterEach, assert, sinon, OSApp, $ */

describe("Onboard analog sensors", function() {
	var fixture, original, sandbox, controller, parent;
	before(function() {
		return fetch("/base/test/fixtures/jsd_2216.json").then(response => response.json()).then(raw => {
			fixture = raw;
		});
	});
	function description(inputs) {
		var raw = JSON.parse(JSON.stringify(fixture));
		raw.sensors[5] = inputs === null ? { dis: 1 } : {
			n: "Onboard Analog", as: [{ n: "Input", a: "input", t: "enum", d: "0", o: (inputs || [0, 1, 2, 3]).map(id => ({
				id: id, l: "SN" + (id + 1), dfl: {unit: 4, min: "0", max: "3.3"}
			})) }].concat(raw.sensors[1].as.filter(arg => arg.a !== "pin"))
		};
		return OSApp.Sensors.normalizeJsd(raw);
	}
	function reading(uuid, input, type, flag) {
		return {uuid: uuid, name: "Reading " + uuid, type: type === undefined ? 5 : type, flag: flag === undefined ? 1 : flag,
			unit: 4, min: 0, max: 3.3, interval: 15, extra: {input: input, subtype: 0, scale: 1, offset: 0}};
	}
	function backup(records, modes) {
		return {options: Object.assign({fwv: 221, fwm: 7}, modes), settings: {nbrd: 1},
			stations: {snames: ["S1"], masop: [0]}, programs: {pd: []}, sensors: {sn: records, count: records.length}};
	}
	function prepare(source, inputs) {
		return OSApp.ImportExport.prepareOnboardSensorImport(source, controller.options, controller.sensors.sn, description(inputs));
	}
	function editor() {
		parent = $("<div></div>").appendTo("body");
		return OSApp.Sensors.createSensorPage(parent, 21, controller.sensor_desc);
	}
	function selectType(type) {
		parent.find("select[id*='-type-']").val(String(type)).trigger("input");
	}
	function field(name) { return parent.find("input[id*='base-rest-" + name + "-'], select[id*='base-rest-" + name + "-']"); }
	beforeEach(function() {
		sandbox = sinon.createSandbox();
		original = OSApp.currentSession.controller;
		controller = OSApp.currentSession.controller = {options: {fwv: 221, fwm: 7, hwv: 40, sn1t: 4, sn2t: 0, sn3t: 4, sn4t: 1},
			settings: {}, stations: {snames: ["S1"]}, programs: {pd: []}, sensors: {sn: []}, sensor_desc: description()};
		sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.Errors, "showError");
	});
	afterEach(function() {
		if (parent) { parent.remove(); parent = null; }
		$("#sensorSettings").each(function() {
			if ($(this).data("mobile-popup")) $(this).popup("destroy");
			$(this).remove();
		});
		$("#os-options").remove();
		sandbox.restore();
		OSApp.currentSession.controller = original;
	});
	it("uses metadata port choices rather than hardware or firmware numbers", function() {
		assert.deepEqual(OSApp.Sensors.onboardAnalogInputs(description([1, 3])), [1, 3]);
		assert.deepEqual(OSApp.Sensors.onboardAnalogInputs(description(null)), []);
		assert.deepEqual(OSApp.Sensors.onboardAnalogInputs(null), []);
		assert.equal(OSApp.Sensors.getBuiltInSensorTypeName(4, true), "Analog");
	});
	it("checks both ownership directions including disabled records and ignores unchanged modes", function() {
		var records = [reading(1, 0, 5, 0), reading(2, 1, 4, 0)];
		assert.include(OSApp.Sensors.portModeConflict({sn1t: 0}, controller.options, records), "Reading 1");
		assert.include(OSApp.Sensors.portModeConflict({sn2t: 4}, controller.options, records), "Reading 2");
		assert.equal(OSApp.Sensors.portModeConflict({sn1t: 4, sn2t: 0}, controller.options, records), "");
		assert.equal(OSApp.Sensors.portModeConflict({sn1t: 1}, controller.options, []), "");
		assert.equal(controller.options.sn1t, 4, "removing the final reading does not change port mode");
	});
	it("builds analog conversion controls with 0-3.3 V defaults and filters incompatible ports", function() {
		var form = editor();
		selectType(5);
		var input = parent.find("select[id*='sen-5-input-']");
		assert.isFalse(input.find("option[value='0']").prop("disabled"));
		assert.isTrue(input.find("option[value='1']").prop("disabled"));
		assert.isTrue(input.find("option[value='3']").prop("disabled"));
		var params = new URL("http://test" + form.getURL()).searchParams;
		assert.equal(params.get("type"), "5");
		assert.equal(params.get("input"), "0");
		assert.equal(params.get("max"), "3.3");
		assert.equal(params.get("unit"), "4");
		assert.equal(params.get("scale"), "1");
		assert.isFalse(params.has("pin"));
	});
	it("blocks invalid existing inputs without silently switching to another port", function() {
		var form = editor();
		form.update(reading(21, 1));
		assert.isUndefined(form.getURL());
		assert.include(parent.find(".sensor-port-warning").text(), "Set this port to Analog");
		assert.include(parent.find(".sensor-port-warning a").text(), "Built-in Sensors");
		selectType(4);
		assert.isTrue(parent.find("select[id*='sen-4-input-'] option[value='0']").prop("disabled"));
		assert.isFalse(parent.find("select[id*='sen-4-input-'] option[value='1']").prop("disabled"));
	});
	it("keeps subtype defaults, converts temperature bounds, and preserves imported bounds", function() {
		var form = editor();
		selectType(5);
		parent.find("select[id*='sen-5-subtype-']").val("10").trigger("change");
		assert.equal(field("unit").val(), "17");
		assert.equal(field("min").val(), "-40");
		assert.equal(field("max").val(), "185");
		field("unit").val("18").trigger("change");
		assert.equal(field("min").val(), "-40");
		assert.equal(field("max").val(), "365");
		parent.find("select[id*='sen-5-input-']").val("2").trigger("change");
		assert.equal(field("unit").val(), "17", "moving a temperature reading keeps its conversion");
		parent.find("select[id*='sen-5-subtype-']").val("0").trigger("change");
		assert.equal(field("max").val(), "3.3");
		var saved = reading(21, 0);
		saved.unit = 18; saved.min = 32; saved.max = 212; saved.extra.subtype = 10;
		form.update(saved);
		assert.equal(field("min").val(), "32");
		assert.equal(field("max").val(), "212");
		assert.equal(new URL("http://test" + form.getURL()).searchParams.get("unit"), "18");
		selectType(1);
		parent.find("select[id*='sen-1-subtype-']").val("11").trigger("change");
		assert.equal(field("unit").val(), "40", "ADS1115 still uses its own defaults");
	});
	it("validates, serializes and verifies analog piecewise definitions", function() {
		var sensor = reading(21, 2);
		sensor.extra.subtype = 1;
		sensor.extra.points = [{x: 0, y: 0}, {x: 3.3, y: 100}];
		assert.isTrue(OSApp.ImportExport.validateSensorDefinition(sensor));
		assert.isTrue(OSApp.ImportExport.sensorDefinitionSupported(sensor, description(), []));
		var params = new URL("http://test" + OSApp.ImportExport.buildSensorImportCommand(sensor, -1, true, id => id)).searchParams;
		assert.equal(params.get("points"), "0,0,3.3,100");
		assert.equal(params.get("input"), "2");
		assert.isTrue(OSApp.ImportExport.sensorDefinitionMatches(sensor, sensor, id => id));
		sensor.extra.input = 4;
		assert.isFalse(OSApp.ImportExport.validateSensorDefinition(sensor));
	});
	it("exports analog modes and complete readings without capability metadata", function() {
		controller.sensors.sn = [reading(21, 0, 5, 0)];
		var exported = JSON.parse(OSApp.ImportExport.serializeConfig());
		assert.equal(exported.options.sn1t, 4);
		assert.deepEqual(exported.sensors, controller.sensors);
		assert.notProperty(exported, "sensor_desc");
	});
	it("supports shared inputs and fresh v4 restores without changing the backup", function() {
		controller.options.sn1t = 0;
		var source = backup([reading(21, 0), reading(22, 0, 5, 0)], {sn1t: 4});
		var plan = prepare(source);
		assert.isUndefined(plan.error);
		assert.deepEqual(plan.data, source);
		assert.notStrictEqual(plan.data, source);
		assert.lengthOf(plan.skipped, 0);
	});
	[34, 64].forEach(function(hardware) {
		it("filters disabled analog readings and resets modes for target hardware " + hardware, function() {
			Object.assign(controller.options, {hwv: hardware, sn1t: 0, sn3t: 0});
			var source = backup([reading(21, 0, 5, 0)], {sn1t: 4});
			var plan = prepare(source, null);
			assert.isUndefined(plan.error);
			assert.equal(plan.data.options.sn1t, 0);
			assert.lengthOf(plan.data.sensors.sn, 0);
			assert.equal(plan.data.sensors.count, 0);
			assert.equal(source.options.sn1t, 4);
			assert.lengthOf(source.sensors.sn, 1);
		});
	});
	it("rejects aggregate dependencies even if the skipped UUID collides with a target reading", function() {
		controller.options.sn1t = 0;
		controller.sensors.sn = [reading(21, 0, 4)];
		var aggregate = reading(22, 0, 0);
		aggregate.extra = {action: 0, children: [{uuid: 21, scale: 1, offset: 0}]};
		var plan = prepare(backup([reading(21, 0), aggregate], {sn1t: 4}), null);
		assert.include(plan.error, "Aggregate Sensor");
	});
	it("identifies each affected aggregate and only its missing children", function() {
		var first = reading(30, 0, 0), second = reading(31, 0, 0);
		first.extra = {action: 0, children: [{uuid: 21, scale: 1, offset: 0}]};
		second.extra = {action: 0, children: [{uuid: 22, scale: 1, offset: 0}]};
		var plan = prepare(backup([reading(21, 2), reading(22, 3), reading(23, 0), first, second], {}), null);
		assert.include(plan.error, "Reading 30: Reading 21 (SN3)");
		assert.include(plan.error, "Reading 31: Reading 22 (SN4)");
		assert.notInclude(plan.error, "Reading 23");
	});
	it("refuses mode transitions blocked by controller-only or later-updated readings", function() {
		controller.sensors.sn = [reading(21, 0, 5, 0)];
		assert.include(prepare(backup([], {sn1t: 1})).error, "Reading 21");
		assert.include(prepare(backup([reading(21, 2)], {sn1t: 1})).error, "Reading 21");
		controller.options.sn1t = 0;
		controller.sensors.sn = [reading(21, 0, 4, 0)];
		assert.include(prepare(backup([reading(21, 0)], {sn1t: 4})).error, "Reading 21");
	});
	it("rejects final record/mode conflicts even without a mode transition", function() {
		controller.options.sn1t = 0;
		assert.include(prepare(backup([reading(21, 0)], {sn1t: 0})).error, "Reading 21");
	});

	function loadOptionsPage() {
		return Promise.all(["/jo", "/jc", "/jn"].map(url => Promise.resolve($.getJSON(url)))).then(function(data) {
			controller.options = Object.assign(data[0], controller.options);
			controller.settings = data[1];
			controller.stations = data[2];
			OSApp.Options.showOptions("sensors");
		});
	}
	[1, 4].forEach(function(mode) {
		it("opens built-in settings after metadata failure and preserves stored mode " + mode, function() {
			controller.options.sn1t = mode;
			controller.sensor_desc = null;
			var request = sandbox.stub(OSApp.Sites, "updateControllerSensorDescription")
				.returns($.Deferred().reject({status: 503}).promise());
			return loadOptionsPage().then(function() {
				$("#sensor1").trigger("click");
				assert.isTrue(request.calledOnce);
				var popup = $("#sensorSettings"), analog = popup.find("option[value='4']");
				assert.lengthOf(popup, 1);
				assert.isTrue($.mobile.loading.calledWith("hide"));
				if (mode === 4) {
					assert.isTrue(analog.prop("disabled"));
					assert.isTrue(analog.prop("selected"));
				} else {
					assert.lengthOf(analog, 0);
					popup.find("#sn-type").val("3").trigger("change");
				}
				popup.find(".submit").trigger("click");
				assert.equal(OSApp.Utils.unescapeJSON($("#sensor1").val()).type, mode === 4 ? 4 : 3);
				assert.isFalse(OSApp.Errors.showError.called);
			});
		});
	});
	it("offers Analog only on advertised built-in ports and hides digital-only controls", function() {
		controller.sensor_desc = description([0]);
		return loadOptionsPage().then(function() {
			$("#sensor1").trigger("click");
			var popup = $("#sensorSettings");
			assert.equal(popup.find("#sn-type").val(), "4");
			[".sn-no", ".sn-on-off", ".sn-fpr", ".sn-prg-hint"].forEach(selector => {
				assert.equal(popup.find(selector).first().css("display"), "none", selector);
			});
			popup.popup("destroy").remove();
			$("#sensor2").trigger("click");
			assert.lengthOf($("#sensorSettings option[value='4']"), 0);
		});
	});
	it("names disabled conflicting readings and keeps the pending mode unchanged", function() {
		controller.sensors.sn = [reading(99, 0, 5, 0)];
		return loadOptionsPage().then(function() {
			$("#sensor1").trigger("click");
			var initial = $("#sensor1").val();
			$("#sn-type").val("1").trigger("change");
			assert.equal($(".sn-port-conflict").text(), "Conflicting sensor configuration: SN1: Reading 99. Remove it in Edit Sensors first.");
			var submit = $("#sensorSettings .submit");
			assert.isTrue(submit.prop("disabled"));
			assert.isTrue(submit.hasClass("ui-state-disabled"));
			submit.trigger("click");
			assert.equal($("#sensor1").val(), initial);
			$("#sn-type").val("4").trigger("change");
			assert.isFalse(submit.prop("disabled"));
			assert.isFalse(submit.hasClass("ui-state-disabled"));
			assert.equal($(".sn-port-conflict").css("display"), "none");
		});
	});
	it("refreshes ownership before /co and refuses a newly added conflicting reading", function() {
		return loadOptionsPage().then(function() {
			var request = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());
			sandbox.stub(OSApp.Sites, "updateControllerSensors").callsFake(function() {
				controller.sensors.sn = [reading(99, 0, 5, 0)];
				return $.Deferred().resolve(controller.sensors).promise();
			});
			var conf = OSApp.Utils.unescapeJSON($("#sensor1").val());
			conf.type = 0;
			$("#sensor1").val(OSApp.Utils.escapeJSON(conf));
			$("#os-options .submit").trigger("click");
			assert.isTrue(OSApp.Sites.updateControllerSensors.calledOnce);
			assert.isFalse(request.called);
			assert.include(OSApp.Errors.showError.lastCall.args[0], "Reading 99");
			assert.isTrue($.mobile.loading.calledWith("hide"));
		});
	});
	it("allows an unchanged Analog mode and sends numeric mode 4 when changed", function() {
		return loadOptionsPage().then(function() {
			var request = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());
			var refresh = sandbox.stub(OSApp.Sites, "updateControllerSensors").returns($.Deferred().resolve(controller.sensors).promise());
			$("#os-options .submit").trigger("click");
			assert.isFalse(refresh.called);
			assert.isTrue(request.calledOnce);
			request.resetHistory();
			$("#os-options .submit").prop("disabled", false);
			var conf = OSApp.Utils.unescapeJSON($("#sensor2").val());
			conf.type = 4;
			$("#sensor2").val(OSApp.Utils.escapeJSON(conf));
			$("#os-options .submit").trigger("click");
			assert.isTrue(refresh.calledOnce);
			assert.equal(new URL("http://test" + request.firstCall.args[0]).searchParams.get("sn2t"), "4");
		});
	});
	it("keeps Submit available and clears loading when ownership cannot be read", function() {
		return loadOptionsPage().then(function() {
			var request = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());
			sandbox.stub(OSApp.Sites, "updateControllerSensors").returns($.Deferred().reject({result: 80}).promise());
			var conf = OSApp.Utils.unescapeJSON($("#sensor1").val());
			conf.type = 0;
			$("#sensor1").val(OSApp.Utils.escapeJSON(conf));
			$("#os-options .submit").trigger("click");
			assert.isFalse(request.called);
			assert.isTrue($.mobile.loading.calledWith("hide"));
			assert.isTrue($("#os-options .submit").hasClass("hasChanges"));
			assert.include(OSApp.Errors.showError.lastCall.args[0], "No settings were changed");
		});
	});

	function restoreHarness(desc, state) {
		var commands = [];
		sandbox.stub(OSApp.UIDom, "areYouSure").callsFake((_question, _warning, callback) => callback());
		var timeout = window.setTimeout;
		sandbox.stub(window, "setTimeout").callsFake(function(callback, delay) {
			return delay === 1500 ? 0 : timeout.apply(window, arguments);
		});
		sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function(url) {
			commands.push(url);
			var result = {result: 1};
			if (url.startsWith("/jsd?")) result = desc;
			if (url.startsWith("/jo?")) result = controller.options;
			if (url.startsWith("/jsn?")) result = {sn: state, count: state.length};
			if (url.startsWith("/csn?")) {
				var params = new URL("http://test" + url).searchParams;
				var sensor = reading(101 + state.length, Number(params.get("input")));
				["name", "type", "unit", "flag", "min", "max", "interval"].forEach(key => {
					sensor[key] = key === "name" ? params.get(key) : Number(params.get(key));
				});
				state.push(sensor);
			}
			return $.Deferred().resolve(result).promise();
		});
		return commands;
	}
	[32, 64].forEach(function(hardware) {
		it("restores all four Analog modes to a two-port target " + hardware, function() {
			Object.assign(controller.options, {hwv: hardware, sn1t: 1, sn2t: 0});
			delete controller.options.sn3t;
			delete controller.options.sn4t;
			controller.sensor_desc = description(null);
			var source = backup([reading(21, 2), reading(22, 3, 5, 0)], {sn1t: 4, sn2t: 4, sn3t: 4, sn4t: 4});
			var plan = prepare(source, null);
			assert.isUndefined(plan.error);
			assert.deepEqual(plan.resetPorts, ["SN1", "SN2"]);
			assert.lengthOf(plan.data.sensors.sn, 0);
			var commands = restoreHarness(description(null), []);
			return Promise.resolve(OSApp.ImportExport.importConfig(source)).then(function() {
				var co = commands.find(url => url.startsWith("/co?"));
				assert.isString(co);
				var params = new URL("http://test" + co).searchParams;
				["sn1t", "sn2t", "sn3t", "sn4t"].forEach(key => {
					assert.equal(params.get(key), "0", key);
					assert.equal(source.options[key], 4, "backup is unchanged");
				});
				assert.include(OSApp.UIDom.areYouSure.firstCall.args[1], "Reading 21 (SN3)");
				assert.include(OSApp.UIDom.areYouSure.firstCall.args[1], "Reading 22 (SN4)");
				assert.isFalse(commands.some(url => /^\/(csn|dsn)\?/.test(url)));
				assert.isFalse(OSApp.Errors.showError.called);
			});
		});
	});
	it("reads capabilities and ownership before writing options, then restores analog readings", function() {
		controller.options.sn1t = 0;
		var commands = restoreHarness(description(), []);
		return Promise.resolve(OSApp.ImportExport.importConfig(backup([reading(21, 0)], {sn1t: 4}))).then(function() {
			assert.deepEqual(commands.slice(0, 3), ["/jsd?pw=", "/jsn?pw=", "/jo?pw="]);
			var co = commands.findIndex(url => url.startsWith("/co?"));
			var csn = commands.findIndex(url => url.startsWith("/csn?"));
			assert.isAtLeast(co, 3);
			assert.isAbove(csn, co);
			assert.equal(new URL("http://test" + commands[csn]).searchParams.get("type"), "5");
			assert.isFalse(OSApp.Errors.showError.called);
		});
	});
	it("warns before confirmation and disables skipped program references despite UUID collisions", function() {
		controller.options.sn1t = 0;
		var existing = reading(21, 1, 4);
		var commands = restoreHarness(description(null), [existing]);
		var source = backup([reading(21, 0, 5, 0)], {sn1t: 4});
		source.programs.pd = [[129, 127, 0, [60, -1, -1, -1], [30], "Test", [0, 33, 415], {flag: 1, uuid: 21, splits: [{x: 0, y: 1}]}]];
		return Promise.resolve(OSApp.ImportExport.importConfig(source)).then(function() {
			assert.include(OSApp.UIDom.areYouSure.firstCall.args[1], "Reading 21 (SN1)");
			assert.include(OSApp.UIDom.areYouSure.firstCall.args[1], "will be disabled");
			assert.include(commands.find(url => url.startsWith("/cp?")), "snadj=0,0");
			assert.isFalse(commands.some(url => /^\/(csn|dsn)\?/.test(url)));
			assert.equal(source.options.sn1t, 4);
		});
	});
	[null, {result: 80}].forEach(function(desc) {
		it("stops before confirmation or writes if capability discovery is invalid: " + JSON.stringify(desc), function() {
			var commands = restoreHarness(desc, []);
			return Promise.resolve(OSApp.ImportExport.importConfig(backup([reading(21, 0)], {sn1t: 4}))).then(function() {
				assert.isFalse(commands.some(url => !/^\/(jsd|jsn|jo)\?/.test(url)));
				assert.isFalse(OSApp.UIDom.areYouSure.called);
				assert.isTrue(OSApp.Errors.showError.called);
			});
		});
	});
	it("refuses a live ownership conflict before any restore mutation", function() {
		var commands = restoreHarness(description(), [reading(99, 0, 5, 0)]);
		return Promise.resolve(OSApp.ImportExport.importConfig(backup([], {sn1t: 1}))).then(function() {
			assert.isFalse(commands.some(url => !/^\/(jsd|jsn|jo)\?/.test(url)));
			assert.isFalse(OSApp.UIDom.areYouSure.called);
			assert.include(OSApp.Errors.showError.lastCall.args[0], "Reading 99");
		});
	});
	it("does not interpret a failed /jsd request as unsupported analog hardware", function() {
		var request = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().reject({status: 503}).promise());
		sandbox.stub(OSApp.UIDom, "areYouSure");
		return Promise.resolve(OSApp.ImportExport.importConfig(backup([reading(21, 0)], {sn1t: 4}))).catch(function(error) {
			assert.equal(error.status, 503);
		}).then(function() {
			assert.isTrue(request.calledOnce);
			assert.equal(request.firstCall.args[0], "/jsd?pw=");
			assert.isFalse(OSApp.UIDom.areYouSure.called);
			assert.include(OSApp.Errors.showError.lastCall.args[0], "No configuration changes were made");
		});
	});
	it("does not write to a new site when the controller changes during preflight", function() {
		var pending = $.Deferred();
		var request = sandbox.stub(OSApp.Firmware, "sendToOS").returns(pending.promise());
		sandbox.stub(OSApp.UIDom, "areYouSure");
		var operation = OSApp.ImportExport.importConfig(backup([reading(21, 0)], {sn1t: 4}));
		return new Promise(resolve => window.setTimeout(resolve, 10)).then(function() {
			OSApp.currentSession.controller = {};
			pending.resolve(description());
			return Promise.resolve(operation).catch(function(error) { assert.equal(error.statusText, "stale"); });
		}).then(function() {
			assert.isTrue(request.calledOnce);
			assert.isFalse(OSApp.UIDom.areYouSure.called);
		});
	});
});

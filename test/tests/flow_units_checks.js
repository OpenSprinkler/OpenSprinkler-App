/* global describe, it, beforeEach, afterEach, assert, sinon, OSApp, $, vis */

describe("Flow display units", function() {
	var sandbox, originalController, metric, footer, controller;
	beforeEach(function() {
		sandbox = sinon.createSandbox();
		originalController = OSApp.currentSession.controller;
		metric = OSApp.currentDevice.isMetric;
		footer = $("#footer-running").detach();
		$("<div id='footer-running'></div>").appendTo("body");
		sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.Errors, "showError");
		sandbox.stub(OSApp.UIDom, "changeHeader").returns($("<a></a><a></a><a></a>"));
		return Promise.all(["/jo", "/jc", "/jn"].map(url => Promise.resolve($.getJSON(url)))).then(function(data) {
			controller = OSApp.currentSession.controller = {options: data[0], settings: data[1], stations: data[2], programs: {pd: []}};
			Object.assign(controller.options, {fwv: 221, fwm: 7, hwv: 40, sn1t: 2, fpr0: 100, fpr1: 0});
			Object.assign(controller.settings, {flcrt: 4, flwrt: 60});
			controller.sensors = {sn: []};
			controller.sensor_desc = {sensors: [], units: []};
		});
	});
	afterEach(function() {
		$("#logs").trigger("pagehide").remove();
		$("#sensorSettings").each(function() {
			if ($(this).data("mobile-popup")) $(this).popup("destroy");
			$(this).remove();
		});
		$("#os-options").remove();
		$("#footer-running").before(footer).remove();
		sandbox.restore();
		OSApp.currentSession.controller = originalController;
		OSApp.currentDevice.isMetric = metric;
	});

	[true, false].forEach(function(useMetric) {
		var volume = useMetric ? "20.00 L" : "5.28 gal";
		var rate = useMetric ? "4.00 L/min" : "1.06 gal/min";
		var saved = useMetric ? "10.00 L saved" : "2.64 gal saved";
		it("formats values and zero readings in " + (useMetric ? "liters" : "US gallons"), function() {
			OSApp.currentDevice.isMetric = useMetric;
			assert.equal(OSApp.Utils.formatFlowVolume(20), volume);
			assert.equal(OSApp.Utils.formatFlowRate(4), rate);
			assert.equal(OSApp.Utils.formatFlowVolume(0), useMetric ? "0.00 L" : "0.00 gal");
			assert.equal(OSApp.Utils.formatFlowRate(0), useMetric ? "0.00 L/min" : "0.00 gal/min");
			assert.equal(OSApp.Utils.flowCountToVolume(20), 20, "internal volume remains liters");
			assert.equal(OSApp.Utils.flowRateToVolume(4), 4, "internal flow remains liters/minute");
		});
		it("uses the preferred units in the live footer: " + useMetric, function() {
			OSApp.currentDevice.isMetric = useMetric;
			sandbox.stub(OSApp.currentSession, "isControllerConnected").returns(true);
			OSApp.Status.changeStatus(0, "green", "Running");
			assert.include($("#footer-running").text(), "Flow: " + rate);
		});
		it("converts table, timeline and summary displays without changing exported logs: " + useMetric, function() {
			OSApp.currentDevice.isMetric = useMetric;
			var timestamp = controller.settings.devt;
			var records = [[1, 0, 60, timestamp, 4]], timeline;
			var exported = sandbox.stub(OSApp.Utils, "exportObj");
			sandbox.stub($.fn, "DataTable").returns({});
			sandbox.stub(vis, "Timeline").callsFake(function(_element, items) {
				timeline = items;
				this.setGroups = function() {};
				this.redraw = function() {};
			});
			sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function(url) {
				var data = url.includes("type=wl") ? [[0, "wl", 50, timestamp]] :
					url.includes("type=fl") ? [[20, "fl", 60, timestamp]] : records;
				return $.Deferred().resolve(data).promise();
			});
			OSApp.Logs.displayPage();
			$("#logs").enhanceWithin();
			$("#log_table").prop("checked", true);
			$("#log_timeline").prop("checked", false);
			$("#logs").trigger("pageshow");
			return new Promise(function(resolve, reject) {
				var attempts = 0;
				function check() {
					if (!exported.called && attempts++ < 100) { setTimeout(check, 10); return; }
					try {
						assert.isTrue(exported.called);
						assert.deepEqual(exported.lastCall.args[1], [[1, 0, 60, timestamp, 4]]);
						assert.include($("#logs_list table").text(), rate);
						assert.include($("#logs_list .ui-body-a").text(), "Total Water Used: " + volume);
						assert.include($("#logs_summary").text(), volume);
						assert.include($("#logs_summary").text(), saved);
						$("#log_table").prop("checked", false);
						$("#log_timeline").prop("checked", true).trigger("change");
						assert.isTrue(timeline.some(item => item.group === "Flow Sensor" && item.content === volume));
						assert.include($("#logs_summary").text(), volume);
						resolve();
					} catch (error) { reject(error); }
				}
				check();
			});
		});
		[0, 1, 100, 379, 65535].forEach(function(packed) {
			it("preserves stored pulse calibration " + packed + " when saving unchanged, metric=" + useMetric, function() {
				OSApp.currentDevice.isMetric = useMetric;
				controller.options.fpr0 = packed & 255;
				controller.options.fpr1 = packed >> 8;
				var send = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());
				OSApp.Options.showOptions("sensors");
				$("#sensor1").trigger("click");
				assert.equal($("#sn-fpr-unit").val(), useMetric ? "liter" : "gallon");
				assert.closeTo(Number($("#sn-fpr").val()), packed / 100 / (useMetric ? 1 : 3.78541), 0.00005);
				$("#sensorSettings .submit").trigger("click");
				assert.isFalse(OSApp.Errors.showError.called);
				var conf = OSApp.Utils.unescapeJSON($("#sensor1").val());
				assert.equal(Math.round(conf.fpr * (conf.fprUnit === "gallon" ? 3.78541 : 1) * 100), packed);
				$("#os-options .submit").trigger("click");
				assert.isTrue(send.calledOnce);
				var params = new URL("http://controller" + send.firstCall.args[0]).searchParams;
				assert.isFalse(params.has("fpr0"), "unchanged low byte is not sent");
				assert.isFalse(params.has("fpr1"), "unchanged high byte is not sent");
				assert.equal(controller.options.fpr0 + controller.options.fpr1 * 256, packed);
			});
		});
	});
	it("round-trips every storable calibration through four-decimal US gallons", function() {
		for (var packed = 0; packed <= 65535; packed++) {
			var gallons = Number((packed / 100 / OSApp.Utils.LITERS_PER_GALLON).toFixed(4));
			assert.equal(Math.round(gallons * OSApp.Utils.LITERS_PER_GALLON * 100), packed);
		}
	});
	it("uses a changed metric preference when the sensor popup is opened again", function() {
		OSApp.currentDevice.isMetric = true;
		OSApp.Options.showOptions("sensors");
		OSApp.currentDevice.isMetric = false;
		$("#sensor1").trigger("click");
		assert.equal($("#sn-fpr-unit").val(), "gallon");
		assert.equal(Number($("#sn-fpr").val()), 0.2642);
	});
	it("still accepts manually selected gallon calibration while metric display is enabled", function() {
		OSApp.currentDevice.isMetric = true;
		var send = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());
		OSApp.Options.showOptions("sensors");
		$("#sensor1").trigger("click");
		$("#sn-fpr-unit").val("gallon");
		$("#sn-fpr").val("1");
		$("#sensorSettings .submit").trigger("click");
		$("#os-options .submit").trigger("click");
		assert.isTrue(send.calledOnce);
		var params = new URL("http://controller" + send.firstCall.args[0]).searchParams;
		assert.equal(Number(params.get("fpr0")) + Number(params.get("fpr1")) * 256, 379);
	});
});

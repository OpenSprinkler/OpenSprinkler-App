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

describe("Options Popup Bounds Checks", function () {
	var firmwareVersion, showError;

	beforeEach(function () {
		firmwareVersion = OSApp.currentSession.controller.options.fwv;
		showError = sinon.stub(OSApp.Errors, "showError");
	});

	afterEach(function () {
		showError.restore();
		OSApp.currentSession.controller.options.fwv = firmwareVersion;
		$("#sensorSettings, #masterSettings").each(function () {
			var popup = $(this);
			if (popup.hasClass("ui-popup")) { popup.popup("destroy"); }
			popup.remove();
		});
		$("#os-options").remove();
	});

	it("keeps out-of-range sensor delays out of the pending configuration", function () {
		OSApp.Options.showOptions();
		var button = $("#sensor1"),
			original = button.val();
		assert.lengthOf(button, 1);

		button.trigger("click");
		var popup = $("#sensorSettings");
		assert.include(popup[ 0 ].style.width, "100vw");
		assert.include(popup[ 0 ].style.width, "24px");
		assert.equal(popup[ 0 ].style.minWidth, "");
		popup.find("#sn-type").val("1").trigger("change");
		popup.find("#sn-on").val("241");
		popup.find("#sn-off").val("-1");
		popup.find(".submit").trigger("click");

		assert.isTrue(showError.calledOnceWith("Please check input and try again."));
		assert.equal(button.val(), original);
		assert.lengthOf($("#sensorSettings"), 1);
	});

	it("allows disabling a sensor with stale invalid delay values", function () {
		OSApp.Options.showOptions();
		var button = $("#sensor1");
		button.trigger("click");
		var popup = $("#sensorSettings");
		popup.find("#sn-on").val("999");
		popup.find("#sn-off").val("-1");
		popup.find("#sn-type").val("0").trigger("change");
		popup.find(".submit").trigger("click");

		assert.isFalse(showError.called);
		var config = OSApp.Utils.unescapeJSON(button.val());
		assert.equal(config.type, 0);
		assert.equal(config.no, 0);
		assert.equal(config.on, 0);
		assert.equal(config.off, 0);
	});

	it("separates weather adjustment from built-in sensor options", function () {
		OSApp.Options.showOptions("sensors");
		var groups = $("#os-options-list fieldset"),
			weather = groups.filter(function () {
				return $(this).children("legend").text() === "Weather Adjustment";
			}),
			sensors = groups.filter(function () {
				return $(this).children("legend").text() === "Built-in Sensors";
			});

		assert.lengthOf(weather, 1);
		assert.lengthOf(sensors, 1);
		assert.lengthOf(weather.find("#sensor1"), 0);
		assert.lengthOf(sensors.find("#sensor1"), 1);
		assert.equal(sensors.attr("data-collapsed"), "false");
	});

	it("rejects flow pulse rates that cannot fit the firmware option bytes", function () {
		OSApp.Options.showOptions();
		var button = $("#sensor1"),
			original = button.val();
		button.trigger("click");
		var popup = $("#sensorSettings");
		popup.find("#sn-type").val("2").trigger("change");
		popup.find("#sn-fpr-unit").val("liter");
		popup.find("#sn-fpr").val("655.36");
		popup.find(".submit").trigger("click");

		assert.isTrue(showError.calledOnceWith("Please check input and try again."));
		assert.equal(button.val(), original);
	});

	it("preserves normally-open mode when switching to a flow sensor", function () {
		OSApp.Options.showOptions();
		var button = $("#sensor1"),
			config = OSApp.Utils.unescapeJSON(button.val());
		config.type = 1;
		config.no = 1;
		button.val(OSApp.Utils.escapeJSON(config)).trigger("click");

		var popup = $("#sensorSettings");
		assert.isTrue(popup.find("#sn-no").prop("checked"));
		popup.find("#sn-type").val("2").trigger("change");
		popup.find("#sn-fpr").val("1");
		popup.find(".submit").trigger("click");

		config = OSApp.Utils.unescapeJSON(button.val());
		assert.equal(config.type, 2);
		assert.equal(config.no, 1);
	});

	it("defaults normally-open mode when configuring an unset sensor", function () {
		OSApp.Options.showOptions();
		var button = $("#sensor1"),
			config = OSApp.Utils.unescapeJSON(button.val());
		config.type = 0;
		config.no = 0;
		button.val(OSApp.Utils.escapeJSON(config)).trigger("click");

		var popup = $("#sensorSettings");
		assert.isTrue(popup.find("#sn-no").prop("checked"));
		popup.find("#sn-type").val("2").trigger("change");
		popup.find("#sn-fpr").val("1");
		popup.find(".submit").trigger("click");

		config = OSApp.Utils.unescapeJSON(button.val());
		assert.equal(config.no, 1);
	});

	it("snaps modern master adjustments before enforcing the -600..600 bounds", function () {
		OSApp.currentSession.controller.options.fwv = 220;
		OSApp.Options.showOptions();
		var button = $("#master1"),
			original = button.val();
		button.trigger("click");
		var popup = $("#masterSettings");
		assert.include(popup[ 0 ].style.width, "100vw");
		assert.include(popup[ 0 ].style.width, "24px");
		assert.equal(popup[ 0 ].style.minWidth, "");
		popup.find("#mas-zone").val("1").trigger("change");
		popup.find("#mas-on").val("603");
		popup.find("#mas-off").val("0");
		popup.find(".submit").trigger("click");

		assert.equal(popup.find("#mas-on").val(), "605");
		assert.isTrue(showError.calledOnceWith("Please check input and try again."));
		assert.equal(button.val(), original);

		popup.find("#mas-on").val("602");
		popup.find(".submit").trigger("click");
		var config = OSApp.Utils.unescapeJSON(button.val());
		assert.equal(config.mton, 600);
		assert.equal(config.mtof, 0);
	});

	it("enforces the legacy master on/off ranges after snapping", function () {
		OSApp.currentSession.controller.options.fwv = 219;
		OSApp.Options.showOptions();
		var button = $("#master1"),
			original = button.val();
		button.trigger("click");
		var popup = $("#masterSettings");
		popup.find("#mas-zone").val("1").trigger("change");
		popup.find("#mas-on").val("-3");
		popup.find("#mas-off").val("-62");
		popup.find(".submit").trigger("click");

		assert.equal(popup.find("#mas-on").val(), "-5");
		assert.equal(popup.find("#mas-off").val(), "-60");
		assert.isTrue(showError.calledOnceWith("Please check input and try again."));
		assert.equal(button.val(), original);

		popup.find("#mas-on").val("2");
		popup.find("#mas-off").val("-58");
		popup.find(".submit").trigger("click");
		var config = OSApp.Utils.unescapeJSON(button.val());
		assert.equal(config.mton, 0);
		assert.equal(config.mtof, -60);
	});

	it("allows disabling a master with stale invalid adjustment values", function () {
		OSApp.Options.showOptions();
		var button = $("#master1");
		button.trigger("click");
		var popup = $("#masterSettings");
		popup.find("#mas-zone").val("0").trigger("change");
		popup.find("#mas-on").val("9999");
		popup.find("#mas-off").val("-9999");
		popup.find(".submit").trigger("click");

		assert.isFalse(showError.called);
		assert.deepEqual(OSApp.Utils.unescapeJSON(button.val()), { mas: 0, mton: 0, mtof: 0 });
	});

	it("renders controller-provided station names as option text", function () {
		var names = OSApp.currentSession.controller.stations.snames,
			originalName = names[ 0 ],
			untrustedName = "<img id='master-name-xss' src='x' onerror='window.masterNameXss=true'>";

		try {
			names[ 0 ] = untrustedName;
			OSApp.Options.showOptions();
			$("#master1").trigger("click");

			var option = $("#masterSettings #mas-zone option[value='1']");
			assert.include(option.text(), untrustedName);
			assert.lengthOf($("#masterSettings #master-name-xss"), 0);
		} finally {
			names[ 0 ] = originalName;
		}
	});

	it("selects each configured master zone when opening its dialog", function () {
		var options = OSApp.currentSession.controller.options,
			original = {
				mas: options.mas,
				mas2: options.mas2,
				mas3: options.mas3,
				mas4: options.mas4
			};

		try {
			options.mas = 1;
			options.mas2 = 2;
			options.mas3 = 3;
			options.mas4 = 4;
			OSApp.Options.showOptions();

			[ 1, 2, 3, 4 ].forEach(function (zone, index) {
				$("#master" + (index + 1)).trigger("click");
				assert.equal($("#masterSettings #mas-zone").val(), String(zone));
				$("#masterSettings").popup("close").remove();
			});
		} finally {
			options.mas = original.mas;
			options.mas2 = original.mas2;
			options.mas3 = original.mas3;
			options.mas4 = original.mas4;
		}
	});
});

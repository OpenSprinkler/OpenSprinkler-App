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

describe("Weather Server Default Provider Checks", function () {
	var originalFirmwareMinor, originalFirmwareVersion, originalLocation, originalUseWeather, originalWsp, originalWto;

	beforeEach(function () {
		originalFirmwareMinor = OSApp.currentSession.controller.options.fwm;
		originalFirmwareVersion = OSApp.currentSession.controller.options.fwv;
		originalLocation = OSApp.currentSession.controller.settings.loc;
		originalUseWeather = OSApp.currentSession.controller.options.uwt;
		originalWsp = OSApp.currentSession.controller.settings.wsp;
		originalWto = OSApp.currentSession.controller.settings.wto;
		OSApp.currentSession.controller.options.fwm = 5;
		OSApp.currentSession.controller.options.fwv = 221;
		OSApp.currentSession.controller.settings.loc = "42.36,-71.06";
		OSApp.currentSession.controller.options.uwt = 1;
	});

	afterEach(function () {
		OSApp.currentSession.controller.options.fwm = originalFirmwareMinor;
		OSApp.currentSession.controller.options.fwv = originalFirmwareVersion;
		OSApp.currentSession.controller.settings.loc = originalLocation;
		OSApp.currentSession.controller.options.uwt = originalUseWeather;
		OSApp.currentSession.controller.settings.wsp = originalWsp;
		OSApp.currentSession.controller.settings.wto = originalWto;
		$("#os-options").remove();
	});

	it("recognizes normalized official weather-server URLs", function () {
		[
			"weather.opensprinkler.com",
			"http://weather.opensprinkler.com",
			"https://weather.opensprinkler.com",
			"HTTPS://WEATHER.OPENSPRINKLER.COM/",
			"https://weather.opensprinkler.com:443/",
			"http://weather.opensprinkler.com:80/"
		].forEach(function (url) {
			assert.isFalse(OSApp.Weather.isCustomWeatherServer(url), url);
		});
	});

	it("recognizes custom and empty weather-server values", function () {
		assert.isTrue(OSApp.Weather.isCustomWeatherServer("http://192.168.1.20:3000"));
		assert.isTrue(OSApp.Weather.isCustomWeatherServer("http://my-nas.local:8085"));
		assert.isTrue(OSApp.Weather.isCustomWeatherServer("https://weather.example.net"));
		assert.isFalse(OSApp.Weather.isCustomWeatherServer(""));
	});

	it("does not offer Default Provider for the official server", function () {
		OSApp.currentSession.controller.settings.wsp = "https://weather.opensprinkler.com/";
		OSApp.currentSession.controller.settings.wto = {};
		OSApp.Options.showOptions();

		assert.lengthOf($("#weatherSelect option[value='__server_default__']"), 0);
		assert.equal($("#weatherSelect").val(), "Apple");
	});

	it("offers Default Provider last and selects it for a custom server without a provider", function () {
		OSApp.currentSession.controller.settings.wsp = "http://my-nas.local:8085";
		OSApp.currentSession.controller.settings.wto = {};
		OSApp.Options.showOptions();

		var options = $("#weatherSelect option");
		assert.equal(options.last().val(), OSApp.Constants.weather.SERVER_DEFAULT_PROVIDER);
		assert.equal(options.last().text(), "Default Provider");
		assert.equal($("#weatherSelect").val(), OSApp.Constants.weather.SERVER_DEFAULT_PROVIDER);
	});

	it("maps the legacy local provider to Default Provider", function () {
		assert.equal(
			OSApp.Weather.getWeatherProviderSelection({ provider: "local" }, "https://weather.example.net"),
			OSApp.Constants.weather.SERVER_DEFAULT_PROVIDER
		);
	});

	it("keeps an explicit cloud provider selected on a custom server", function () {
		OSApp.currentSession.controller.settings.wsp = "https://weather.example.net";
		OSApp.currentSession.controller.settings.wto = { provider: "DWD" };
		OSApp.Options.showOptions();

		assert.equal($("#weatherSelect").val(), "DWD");
	});

	it("removes provider overrides while preserving adjustment options", function () {
		var prepared = OSApp.Weather.prepareWeatherOptions({
			provider: "Apple",
			key: "old-key",
			pws: "station",
			h: 100,
			t: 90,
			r: 80,
			baseETo: 0.2,
			mda: 100
		}, OSApp.Constants.weather.SERVER_DEFAULT_PROVIDER, "reinserted-key");

		assert.notProperty(prepared, "provider");
		assert.notProperty(prepared, "key");
		assert.notProperty(prepared, "pws");
		assert.include(prepared, { h: 100, t: 90, r: 80, baseETo: 0.2, mda: 100 });
	});

	it("keeps Default Provider serialization non-empty without adjustment options", function () {
		var prepared = OSApp.Weather.prepareWeatherOptions({
			provider: "OpenMeteo",
			key: "old-key",
			pws: "old-pws"
		}, OSApp.Constants.weather.SERVER_DEFAULT_PROVIDER, "reinserted-key");

		assert.deepEqual(prepared, { key: "" });
		assert.isNotEmpty(OSApp.Utils.escapeJSON(prepared));
	});

	it("updates regular-provider keys without persisting an untouched selector default", function () {
		var prepared = OSApp.Weather.prepareWeatherOptions({ h: 100 }, "Apple", "new-key");

		assert.deepEqual(prepared, { key: "new-key", h: 100 });
	});

	it("keeps API-key controls hidden and clear for keyless providers", function () {
		OSApp.currentSession.controller.settings.wsp = "https://weather.example.net";
		OSApp.currentSession.controller.settings.wto = { provider: "AW", key: "old-key", pws: "old-pws" };
		OSApp.Options.showOptions();

		var selector = $("#weatherSelect"),
			key = $("#wtkey"),
			keyField = key.parents(".ui-field-contain");
		selector.val(OSApp.Constants.weather.SERVER_DEFAULT_PROVIDER).trigger("change");

		assert.isTrue(keyField.hasClass("hidden"));
		assert.isFalse(key.parent().hasClass("red"));
		assert.deepEqual(OSApp.Utils.unescapeJSON($("#wto").val()), {});

		selector.val("DWD").trigger("change");
		assert.isTrue(keyField.hasClass("hidden"));
		assert.isFalse(key.parent().hasClass("red"));
		assert.equal(OSApp.Utils.unescapeJSON($("#wto").val()).provider, "DWD");
	});

	it("shows API-key controls only for providers that require a key", function () {
		OSApp.currentSession.controller.settings.wsp = "https://weather.example.net";
		OSApp.currentSession.controller.settings.wto = { provider: "DWD" };
		OSApp.Options.showOptions();

		var selector = $("#weatherSelect"),
			key = $("#wtkey"),
			keyField = key.parents(".ui-field-contain");
		assert.isTrue(keyField.hasClass("hidden"));

		selector.val("AW").trigger("change");
		assert.isFalse(keyField.hasClass("hidden"));
		assert.isTrue(key.parent().hasClass("red"));
	});

	it("submits Default Provider without provider fields or the UI sentinel", function () {
		OSApp.currentSession.controller.settings.wsp = "https://weather.example.net";
		OSApp.currentSession.controller.settings.wto = {
			provider: "WU",
			key: "old-key",
			pws: "old-pws",
			h: 100
		};
		var request = sinon.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());

		try {
			OSApp.Options.showOptions();
			$("#weatherSelect").val(OSApp.Constants.weather.SERVER_DEFAULT_PROVIDER).trigger("change");
			$("#os-options .submit").trigger("click");

			assert.isTrue(request.calledOnce);
			var url = request.firstCall.args[0],
				params = new URL("http://controller" + url).searchParams,
				weather = OSApp.Utils.unescapeJSON(params.get("wto"));
			assert.isFalse(params.has("weatherSelect"));
			assert.notInclude(url, OSApp.Constants.weather.SERVER_DEFAULT_PROVIDER);
			assert.deepEqual(weather, { h: 100 });
		} finally {
			request.restore();
		}
	});

	it("clears a Manual provider override with a non-empty wto request", function () {
		OSApp.currentSession.controller.options.uwt = 0;
		OSApp.currentSession.controller.settings.wsp = "https://weather.example.net";
		OSApp.currentSession.controller.settings.wto = { provider: "OpenMeteo" };
		var request = sinon.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());

		try {
			OSApp.Options.showOptions();
			$("#weatherSelect").val(OSApp.Constants.weather.SERVER_DEFAULT_PROVIDER).trigger("change");
			$("#os-options .submit").trigger("click");

			assert.isTrue(request.calledOnce);
			var params = new URL("http://controller" + request.firstCall.args[0]).searchParams;
			assert.equal(params.get("wto"), '"key":""');
		} finally {
			request.restore();
		}
	});

	it("does not persist the displayed Apple default on an official server", function () {
		OSApp.currentSession.controller.settings.wsp = "weather.opensprinkler.com";
		OSApp.currentSession.controller.settings.wto = {};
		var request = sinon.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());

		try {
			OSApp.Options.showOptions();
			$("#os-options .submit").trigger("click");

			assert.isTrue(request.calledOnce);
			var params = new URL("http://controller" + request.firstCall.args[0]).searchParams,
				weather = OSApp.Utils.unescapeJSON(params.get("wto"));
			assert.notProperty(weather, "provider");
		} finally {
			request.restore();
		}
	});

	it("does not verify API keys for Default Provider", function () {
		OSApp.currentSession.controller.settings.wsp = "https://weather.example.net";
		OSApp.currentSession.controller.settings.wto = {};
		var verify = sinon.stub(OSApp.Weather, "testAPIKey");

		try {
			OSApp.Options.showOptions();
			$("#verify-api").trigger("click");
			assert.isFalse(verify.called);
		} finally {
			verify.restore();
		}
	});
});

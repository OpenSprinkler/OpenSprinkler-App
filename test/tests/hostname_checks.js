/* eslint-disable */
describe("Controller hostname options", function () {
	var sandbox, controller, previousController;
	beforeEach(function () {
		sandbox = sinon.createSandbox();
		previousController = OSApp.currentSession.controller;
		sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.Errors, "showError");
		return Promise.all(["/jo", "/jc", "/jn"].map(function (url) {return Promise.resolve($.getJSON(url));})).then(function (data) {
			controller = OSApp.currentSession.controller = {options: data[0], settings: data[1], stations: data[2], programs: {pd: []}};
			controller.settings.hname = "";
			controller.options.dhcp = 1;
		});
	});
	afterEach(function () {
		sandbox.restore();
		OSApp.currentSession.controller = previousController;
		$("#os-options").remove();
	});
	it("matches firmware validation without trimming whitespace", function () {
		["", "a", "Garden-Controller", "1a", "a1", "a--b", "a".repeat(32)].forEach(function (value) {
			assert.isTrue(OSApp.Options.isValidHostname(value), value);
		});
		["123", "-host", "host-", "a".repeat(33), "my_host", "host.local", " host", "host ", "host\n", "\u00e9", null, 42].forEach(function (value) {
			assert.isFalse(OSApp.Options.isValidHostname(value), String(value));
		});
	});
	it("shows automatic naming just above DHCP when supported", function () {
		OSApp.Options.showOptions();
		assert.equal($("#hname").val(), "");
		assert.equal($("#hname").attr("placeholder"), "Default");
		assert.include($("#hname").closest("fieldset").text(), "Advanced");
		assert.isTrue(!!($("#hname")[0].compareDocumentPosition($("#o3")[0]) & Node.DOCUMENT_POSITION_FOLLOWING));
	});
	it("hides the field when firmware does not expose hname", function () {
		delete controller.settings.hname;
		OSApp.Options.showOptions();
		assert.lengthOf($("#hname"), 0);
	});
	["Garden-Controller", "", "unchanged"].forEach(function (value) {
		it("serializes the hostname correctly for " + JSON.stringify(value), function () {
			controller.settings.hname = value === "unchanged" ? "unchanged" : "previous";
			var request = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());
			OSApp.Options.showOptions();
			$("#hname").val(value).trigger("change");
			$("#os-options .submit").trigger("click");
			assert.isTrue(request.calledOnce);
			var params = new URL("http://controller" + request.firstCall.args[0]).searchParams;
			assert.equal(params.has("hname"), value !== "unchanged");
			if (value !== "unchanged") assert.equal(params.get("hname"), value.toLowerCase());
			assert.isFalse(params.has("rbt"));
		});
	});
	it("rejects an invalid name before sending any options", function () {
		var request = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());
		OSApp.Options.showOptions();
		$("#os-options").enhanceWithin();
		$("#hname").val(" invalid");
		$("#os-options .submit").trigger("click");
		assert.isFalse(request.called);
		assert.isTrue(OSApp.Errors.showError.calledWith(OSApp.Options.hostnameError()));
		assert.isFalse($.mobile.loading.calledWith("show"));
	});
	[17, 80, 48].forEach(function (result) {
		it("cleans up loading state after hostname save error " + result, function () {
			sandbox.stub(OSApp.Sites, "updateControllerOptions").returns($.Deferred().resolve().promise());
			sandbox.stub(OSApp.Sites, "updatePasswordSecurityNotification");
			sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().reject({result: result, item: "hname"}).promise());
			OSApp.Options.showOptions();
			$("#hname").val("garden");
			$("#os-options .submit").trigger("click");
			assert.isTrue($.mobile.loading.calledWith("hide"));
			assert.isTrue($("#os-options .submit").hasClass("hasChanges"));
			var expectedMessage = result === 17 ? OSApp.Options.hostnameError() :
				OSApp.Language._("Unable to save settings. Controller settings were refreshed; review and try again.");
			assert.isTrue(OSApp.Errors.showError.calledWith(expectedMessage));
		});
	});
});

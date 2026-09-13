/* eslint-disable */

describe("Firmware 2.2.1(6) UI Checks", function () {
	var controller;
	var sandbox;
	var savedOptions;
	var savedSettings;
	var savedStations;

	beforeEach(function () {
		controller = OSApp.currentSession.controller;
		savedOptions = $.extend(true, {}, controller.options);
		savedSettings = controller.settings;
		savedStations = controller.stations;
		controller.settings = {
			loc: "0,0",
			nbrd: 1,
			wto: {},
			ps: Array.from({ length: 8 }, function () { return [ 0, 0 ]; })
		};
		controller.stations = {
			snames: [ "S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08" ],
			masop: [ 0 ],
			stn_dis: [ 0 ],
			stn_seq: [ 255 ]
		};
		sandbox = sinon.createSandbox();
	});

	afterEach(function () {
		$("#os-options").remove();
		controller.options = savedOptions;
		controller.settings = savedSettings;
		controller.stations = savedStations;
		sandbox.restore();
	});

	function setFirmware(hwv, fwv, fwm) {
		controller.options.hwv = hwv;
		controller.options.fwv = fwv == null ? 221 : fwv;
		controller.options.fwm = fwm == null ? 6 : fwm;
	}

	function showOptionsWithCapturedHeader() {
		var headerOptions;
		var header = $("<button></button><button></button><button></button>");
		sandbox.stub(OSApp.UIDom, "changeHeader").callsFake(function (options) {
			headerOptions = options;
			return header;
		});
		OSApp.Options.showOptions();
		return { options: headerOptions, buttons: header };
	}

	it("recognizes browser update and wireless-reset hardware without including Linux or Demo", function () {
		assert.isTrue(OSApp.Firmware.supportsBrowserFirmwareUpdate(30));
		assert.isTrue(OSApp.Firmware.supportsBrowserFirmwareUpdate(40));
		assert.isFalse(OSApp.Firmware.supportsBrowserFirmwareUpdate(64));
		assert.isFalse(OSApp.Firmware.supportsBrowserFirmwareUpdate(255));
		assert.isTrue(OSApp.Firmware.supportsWirelessReset(39));
		assert.isTrue(OSApp.Firmware.supportsWirelessReset(40));
		assert.isFalse(OSApp.Firmware.supportsWirelessReset(192));
	});

	it("formats OpenSprinkler v4 AC hardware for the About page", function () {
		setFirmware(40);
		controller.options.hwt = 172;

		assert.equal(OSApp.Firmware.getHWVersion(), "4.0");
		assert.equal(OSApp.Firmware.getHWType(), " - AC");
	});

	it("reserves port 8080 only on OS3 and OS4 running firmware 2.2.1(6) or newer", function () {
		setFirmware(30);
		assert.isTrue(OSApp.Firmware.isFirmwareUpdatePortReserved(8080));
		assert.isFalse(OSApp.Firmware.isFirmwareUpdatePortReserved(8079));
		assert.isFalse(OSApp.Firmware.isFirmwareUpdatePortReserved(8081));

		setFirmware(40, 221, 5);
		assert.isFalse(OSApp.Firmware.isFirmwareUpdatePortReserved(8080));
		setFirmware(64);
		assert.isFalse(OSApp.Firmware.isFirmwareUpdatePortReserved(8080));
	});

	it("rejects a new port 8080 value locally without sending /co", function () {
		setFirmware(40);
		controller.options.hp0 = 80;
		controller.options.hp1 = 0;
		var header = showOptionsWithCapturedHeader();
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS");
		var showError = sandbox.stub(OSApp.Errors, "showError");

		$("#os-options #o12").val("8080");
		header.options.rightBtn.on();

		assert.isFalse(sendToOS.called);
		assert.isTrue(showError.calledWithMatch("Port 8080 is reserved"));
		assert.isFalse(header.buttons.eq(2).prop("disabled"));
	});

	it("allows neighboring ports and preserves an existing port 8080 value", function () {
		setFirmware(30);
		controller.options.hp0 = 80;
		controller.options.hp1 = 0;
		var firstHeader = showOptionsWithCapturedHeader();
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().promise());
		$("#os-options #o12").val("8081");
		firstHeader.options.rightBtn.on();
		assert.isTrue(sendToOS.calledWithMatch(/\/co\?pw=&.*hp0=145.*hp1=31/));

		$("#os-options").remove();
		OSApp.UIDom.changeHeader.restore();
		sendToOS.resetHistory();
		controller.options.hp0 = 144;
		controller.options.hp1 = 31;
		var secondHeader = showOptionsWithCapturedHeader();
		secondHeader.options.rightBtn.on();
		assert.isTrue(sendToOS.calledOnce);
	});

	it("restores the options form and reloads /jo after a server-side rejection", function () {
		setFirmware(40);
		controller.options.hp0 = 80;
		controller.options.hp1 = 0;
		var header = showOptionsWithCapturedHeader();
		var loading = sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.Supported, "bundle").returns(false);
		sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().reject({ result: 17 }).promise());
		var updateOptions = sandbox.stub(OSApp.Sites, "updateControllerOptions").callsFake(function () {
			controller.options.hp0 = 81;
			controller.options.hp1 = 0;
			return $.Deferred().resolve(controller.options).promise();
		});
		var showError = sandbox.stub(OSApp.Errors, "showError");

		$("#os-options #o12").val("8081");
		header.options.rightBtn.on();

		assert.isTrue(loading.calledWith("hide"));
		assert.isFalse(header.buttons.eq(2).prop("disabled"));
		assert.isTrue(updateOptions.calledOnce);
		assert.equal($("#os-options #o12").val(), "81");
		assert.isTrue(showError.calledWithMatch("Controller rejected"));
	});

	it("does not recover a rejected /co after switching controllers", function () {
		setFirmware(40);
		controller.options.hp0 = 80;
		controller.options.hp1 = 0;
		var header = showOptionsWithCapturedHeader(),
			pending = $.Deferred(),
			sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").returns(pending.promise()),
			updateController = sandbox.stub(OSApp.Sites, "updateController").callsFake(function (callback) { callback(); }),
			ensureSpecial = sandbox.stub(OSApp.Sites, "ensureControllerStationSpecial")
				.returns($.Deferred().resolve({}).promise());
		sandbox.stub(OSApp.Supported, "bundle").returns(true);
		sandbox.stub(OSApp.Options, "removeInvalidBundleMasterOptions")
			.returns({ options: { o12: 81 }, removed: [ "mas" ] });
		var loading = sandbox.stub($.mobile, "loading");

		$("#os-options #o12").val("8081");
		header.options.rightBtn.on();
		assert.isTrue(sendToOS.calledOnce);

		try {
			OSApp.currentSession.controller = $.extend({}, controller);
			loading.resetHistory();
			pending.reject({ result: 17 });

			assert.isTrue(sendToOS.calledOnce);
			assert.isFalse(updateController.called);
			assert.isFalse(ensureSpecial.called);
			assert.isFalse(loading.calledWith("hide"));
		} finally {
			OSApp.currentSession.controller = controller;
		}
	});

	it("does not retry /co when the controller switches during bundle recovery", function () {
		setFirmware(40);
		controller.options.hp0 = 80;
		controller.options.hp1 = 0;
		var header = showOptionsWithCapturedHeader(),
			pendingSpecial = $.Deferred(),
			sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS")
				.onFirstCall().returns($.Deferred().reject({ result: 17 }).promise()),
			updateController = sandbox.stub(OSApp.Sites, "updateController").callsFake(function (callback) { callback(); }),
			ensureSpecial = sandbox.stub(OSApp.Sites, "ensureControllerStationSpecial").returns(pendingSpecial.promise());
		sendToOS.onSecondCall().returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.Supported, "bundle").returns(true);
		var removeInvalid = sandbox.stub(OSApp.Options, "removeInvalidBundleMasterOptions")
			.returns({ options: { o12: 81 }, removed: [ "mas" ] });
		sandbox.stub($.mobile, "loading");

		$("#os-options #o12").val("8081");
		header.options.rightBtn.on();
		assert.isTrue(updateController.calledOnce);
		assert.isTrue(ensureSpecial.calledOnce);

		try {
			OSApp.currentSession.controller = $.extend({}, controller);
			pendingSpecial.resolve({});

			assert.isTrue(sendToOS.calledOnce);
			assert.isFalse(removeInvalid.called);
		} finally {
			OSApp.currentSession.controller = controller;
		}
	});

	it("shows Reset Wireless on OS4 and uses the established command", function () {
		setFirmware(40);
		showOptionsWithCapturedHeader();
		var sendToOS = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().resolve({ result: 1 }).promise());
		sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (_title, _message, callback) { callback(); });
		sandbox.stub(OSApp.UIDom, "goBack");

		assert.lengthOf($("#os-options .reset-wireless"), 1);
		$("#os-options .reset-wireless").trigger("click");
		assert.isTrue(sendToOS.calledOnceWith("/cv?pw=&ap=1"));
	});

	it("hides Reset Wireless on Demo", function () {
		setFirmware(255);
		showOptionsWithCapturedHeader();
		assert.lengthOf($("#os-options .reset-wireless"), 0);
	});
});

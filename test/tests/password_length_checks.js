/* global describe, it, beforeEach, afterEach, assert, sinon, OSApp, $, md5 */

describe("Device password length", function() {
	var sandbox, controller, password, sites, send;
	var longPassword = "a".repeat(32) + "-keep-this-suffix";

	beforeEach(function() {
		sandbox = sinon.createSandbox();
		controller = OSApp.currentSession.controller;
		password = OSApp.currentSession.pass;
		OSApp.currentSession.controller = {options: {fwv: 221, fwm: 7, hwv: 40}};
		sites = {Test: {os_pw: md5("old-password")}};
		sandbox.stub($.fn, "popup").callsFake(function(action) {
			if (action === undefined) this.appendTo("body");
			return this;
		});
		sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.Errors, "showError");
		sandbox.stub(OSApp.Storage, "get").callsFake(function(_keys, callback) {
			callback({sites: JSON.stringify(sites), current_site: "Test"});
		});
		sandbox.stub(OSApp.Storage, "set").callsFake(function(data, callback) {
			sites = JSON.parse(data.sites);
			if (callback) callback();
		});
		sandbox.stub(OSApp.Network, "cloudSaveSites");
		sandbox.stub(OSApp.Sites, "updatePasswordSecurityNotification");
		send = sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().resolve({result: 1}).promise());
	});
	afterEach(function() {
		$("#changePassword").remove();
		sandbox.restore();
		OSApp.currentSession.controller = controller;
		OSApp.currentSession.pass = password;
	});
	function submit(value, confirmation) {
		$("#npw").val(value);
		$("#cpw").val(confirmation === undefined ? value : confirmation);
		$("#changePassword form").trigger("submit");
	}
	function assertSent(value) {
		assert.isTrue(send.calledOnce);
		var params = new URL("http://controller" + send.firstCall.args[0]).searchParams;
		assert.equal(params.get("npw"), value);
		assert.equal(params.get("cpw"), value);
		assert.equal(sites.Test.os_pw, value);
		assert.equal(OSApp.currentSession.pass, value);
	}
	[30, 40, 64].forEach(function(hardware) {
		it("hashes the entire long password on unified hardware " + hardware, function() {
			OSApp.currentSession.controller.options.hwv = hardware;
			OSApp.Network.changePassword();
			assert.isUndefined($("#npw").attr("maxlength"));
			assert.isUndefined($("#cpw").attr("maxlength"));
			submit(longPassword);
			assertSent(md5(longPassword));
			assert.isFalse(OSApp.Errors.showError.calledWith("Password cannot be longer than 32 characters"));
		});
	});
	it("accepts long passwords at the 2.1.3 hashing boundary", function() {
		OSApp.currentSession.controller.options.fwv = 213;
		OSApp.Network.changePassword();
		submit(longPassword);
		assertSent(md5(longPassword));
	});
	it("rejects oversized legacy plaintext passwords without truncating or submitting", function() {
		OSApp.currentSession.controller.options.fwv = 212;
		OSApp.Network.changePassword();
		assert.isUndefined($("#npw").attr("maxlength"));
		submit(longPassword);
		assert.equal($("#npw").val(), longPassword);
		assert.isTrue(OSApp.Errors.showError.calledWith("Password cannot be longer than 32 characters"));
		assert.isFalse(send.called);
		assert.isFalse(OSApp.Storage.set.called);
		assert.isFalse($.mobile.loading.calledWith("show"));
	});
	it("still accepts a 32-character legacy plaintext password", function() {
		OSApp.currentSession.controller.options.fwv = 212;
		OSApp.Network.changePassword();
		var value = "b".repeat(32);
		submit(value);
		assertSent(value);
	});
	it("preserves unrestricted plaintext passwords for the legacy Python OSPi server", function() {
		OSApp.currentSession.controller.options.fwv = "1.9.0-OSPi";
		OSApp.Network.changePassword();
		submit(longPassword);
		assertSent(longPassword);
	});
	it("checks confirmation beyond character 32", function() {
		OSApp.Network.changePassword();
		submit(longPassword, longPassword + "different");
		assert.isTrue(OSApp.Errors.showError.calledWith("The passwords don't match. Please try again."));
		assert.isFalse(send.called);
	});
	it("still rejects an empty new password", function() {
		OSApp.Network.changePassword();
		submit("");
		assert.isTrue(OSApp.Errors.showError.calledWith("Password cannot be empty"));
		assert.isFalse(send.called);
	});
	it("uses the full password when recovering an incorrect cached password", function() {
		OSApp.currentSession.controller = {};
		var check = sandbox.stub(OSApp.Network, "checkPW").callsFake(function(_candidate, callback) { callback(true); });
		var callback = sandbox.spy();
		OSApp.Network.changePassword({fixIncorrect: true, name: "Test", callback: callback});
		assert.isUndefined($("#npw").attr("maxlength"));
		$("#save_pw").prop("checked", true);
		submit(longPassword);
		assert.isTrue(check.calledOnce);
		assert.equal(check.firstCall.args[0], md5(longPassword));
		assert.equal(sites.Test.os_pw, md5(longPassword));
		assert.equal(OSApp.currentSession.pass, md5(longPassword));
		assert.isTrue(callback.calledOnce);
		assert.isFalse(send.called);
	});
});

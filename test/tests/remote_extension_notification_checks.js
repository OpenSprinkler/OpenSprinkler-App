/* global describe, it, beforeEach, afterEach, assert, sinon, OSApp, $ */

describe("Remote Extension notification", function() {
	var sandbox, controller, notifications, dismissed;
	beforeEach(function() {
		sandbox = sinon.createSandbox();
		controller = OSApp.currentSession.controller;
		notifications = OSApp.uiState.notifications;
		dismissed = OSApp.uiState.remoteExtensionNoticeDismissedFor;
		OSApp.currentSession.controller = {options: {re: 1}, settings: {}, stations: {}};
		OSApp.uiState.notifications = [];
		delete OSApp.uiState.remoteExtensionNoticeDismissedFor;
		sandbox.stub(OSApp.currentSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Status, "changeStatus");
		sandbox.stub($.mobile, "loading");
		sandbox.stub(OSApp.Sites, "updateController");
	});
	afterEach(function() {
		$("#notificationPanel li[data-notification-id='remote-extension-mode']").remove();
		sandbox.restore();
		OSApp.currentSession.controller = controller;
		OSApp.uiState.notifications = notifications;
		if (dismissed === undefined) delete OSApp.uiState.remoteExtensionNoticeDismissedFor;
		else OSApp.uiState.remoteExtensionNoticeDismissedFor = dismissed;
		OSApp.Notifications.updateNotificationBadge();
	});
	it("adds a deduplicated warning during status refresh without replacing the footer banner", function() {
		OSApp.Status.checkStatus();
		OSApp.Status.checkStatus();
		assert.lengthOf(OSApp.uiState.notifications, 1);
		var notice = OSApp.uiState.notifications[0];
		assert.equal(notice.id, "remote-extension-mode");
		assert.include(notice.desc, "program-switch starts");
		assert.include(notice.desc, "Cycle and Soak");
		assert.include(OSApp.Status.changeStatus.lastCall.args[2], "Configured as Extender");
	});
	it("removes the warning when the mode is disabled or unavailable", function() {
		OSApp.Sites.updateRemoteExtensionNotification();
		OSApp.currentSession.controller.options.re = 0;
		OSApp.Sites.updateRemoteExtensionNotification();
		assert.lengthOf(OSApp.uiState.notifications, 0);
		delete OSApp.currentSession.controller.options.re;
		OSApp.Sites.updateRemoteExtensionNotification();
		assert.lengthOf(OSApp.uiState.notifications, 0);
	});
	it("honors dismissal during polling but warns again after mode reactivation", function() {
		OSApp.Sites.updateRemoteExtensionNotification();
		var item = OSApp.Notifications.createNotificationItem(OSApp.uiState.notifications[0]);
		OSApp.Notifications.removeNotification(item);
		OSApp.Sites.updateRemoteExtensionNotification();
		assert.lengthOf(OSApp.uiState.notifications, 0);
		OSApp.currentSession.controller.options.re = 0;
		OSApp.Sites.updateRemoteExtensionNotification();
		OSApp.currentSession.controller.options.re = 1;
		OSApp.Sites.updateRemoteExtensionNotification();
		assert.lengthOf(OSApp.uiState.notifications, 1);
	});
	it("does not carry a dismissal to another controller", function() {
		OSApp.Sites.updateRemoteExtensionNotification();
		OSApp.Notifications.clearNotifications(true);
		OSApp.currentSession.controller = {options: {re: 1}};
		OSApp.Sites.updateRemoteExtensionNotification();
		assert.lengthOf(OSApp.uiState.notifications, 1);
	});
	it("opens confirmation from the action and disables only after confirmation", function() {
		var confirm = sandbox.stub(OSApp.UIDom, "areYouSure");
		var pending = $.Deferred();
		var send = sandbox.stub(OSApp.Firmware, "sendToOS").returns(pending.promise());
		OSApp.Sites.updateRemoteExtensionNotification();
		var item = OSApp.Notifications.createNotificationItem(OSApp.uiState.notifications[0]);
		assert.equal(item.find(".notification-action").text(), "Disable Remote Extension");
		item.find(".primary").trigger("click");
		assert.isTrue(confirm.calledOnce);
		assert.isFalse(send.called);
		confirm.firstCall.args[2]();
		assert.isTrue(send.calledOnceWith("/cv?pw=&re=0"));
		pending.resolve({result: 1});
		assert.isTrue(OSApp.Sites.updateController.calledOnce);
		assert.isTrue($.mobile.loading.calledWith("hide"));
	});
	it("cleans up loading after disabling fails", function() {
		sandbox.stub(OSApp.UIDom, "areYouSure").callsFake((_title, _warning, callback) => callback());
		sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().reject({result: 48}).promise());
		OSApp.Status.disableRemoteExtension();
		assert.isFalse(OSApp.Sites.updateController.called);
		assert.isTrue($.mobile.loading.calledWith("hide"));
		assert.equal(OSApp.currentSession.controller.options.re, 1);
	});
	it("does not act on a new controller after the confirmation was opened", function() {
		var confirm = sandbox.stub(OSApp.UIDom, "areYouSure");
		var send = sandbox.stub(OSApp.Firmware, "sendToOS");
		OSApp.Status.disableRemoteExtension();
		OSApp.currentSession.controller = {options: {re: 1}};
		confirm.firstCall.args[2]();
		assert.isFalse(send.called);
	});
});

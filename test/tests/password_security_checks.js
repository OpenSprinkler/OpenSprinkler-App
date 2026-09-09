/* eslint-disable */

describe("Device Password Security Checks", function () {
	var controller;
	var password;
	var notifications;

	beforeEach(function () {
		controller = OSApp.currentSession.controller;
		password = OSApp.currentSession.pass;
		notifications = OSApp.uiState.notifications;
		OSApp.currentSession.controller = { options: { hwv: 40, ipas: 0 } };
		OSApp.uiState.notifications = [];
	});

	afterEach(function () {
		OSApp.currentSession.controller = controller;
		OSApp.currentSession.pass = password;
		OSApp.uiState.notifications = notifications;
		$( "#notificationPanel li[data-notification-id='device-password-security']" ).remove();
		OSApp.Notifications.updateNotificationBadge();
	});

	[ "opendoor", "a6d82bced638de3def1e9bbb4983225c", "", "d41d8cd98f00b204e9800998ecf8427e" ].forEach(function (value) {
		it("warns for a successful default or empty password session: " + (value || "plain empty"), function () {
			OSApp.currentSession.pass = value;
			OSApp.Sites.updatePasswordSecurityNotification();

			assert.lengthOf(OSApp.uiState.notifications, 1);
			assert.equal(OSApp.uiState.notifications[0].id, "device-password-security");
			assert.include(OSApp.uiState.notifications[0].desc, "default or empty");
		});
	});

	it("warns when Ignore Password is enabled and opens Change Password", function () {
		var changePassword = sinon.stub(OSApp.Network, "changePassword");
		try {
			OSApp.currentSession.pass = "secure-password";
			OSApp.currentSession.controller.options.ipas = 1;
			OSApp.Sites.updatePasswordSecurityNotification();

			var notification = OSApp.uiState.notifications[0];
			assert.include(notification.desc, "turn off Ignore Password");
			var item = OSApp.Notifications.createNotificationItem(notification);
			assert.equal(item.find(".notification-action").text(), "Change Password");
			item.find(".notification-action").trigger("click");
			assert.isTrue(changePassword.calledOnce);
		} finally {
			changePassword.restore();
		}
	});

	it("does not duplicate the warning and removes it after correction", function () {
		OSApp.currentSession.pass = "opendoor";
		OSApp.Sites.updatePasswordSecurityNotification();
		OSApp.Sites.updatePasswordSecurityNotification();
		assert.lengthOf(OSApp.uiState.notifications, 1);

		OSApp.currentSession.pass = "secure-password";
		OSApp.Sites.updatePasswordSecurityNotification();
		assert.lengthOf(OSApp.uiState.notifications, 0);

		OSApp.currentSession.controller.options.ipas = 1;
		OSApp.Sites.updatePasswordSecurityNotification();
		OSApp.currentSession.controller.options.ipas = 0;
		OSApp.Sites.updatePasswordSecurityNotification();
		assert.lengthOf(OSApp.uiState.notifications, 0);
	});

	it("does not warn for Demo or a protected custom-password controller", function () {
		OSApp.currentSession.pass = "secure-password";
		OSApp.Sites.updatePasswordSecurityNotification();
		assert.lengthOf(OSApp.uiState.notifications, 0);

		OSApp.currentSession.pass = "opendoor";
		OSApp.currentSession.controller.options.hwv = 255;
		OSApp.Sites.updatePasswordSecurityNotification();
		assert.lengthOf(OSApp.uiState.notifications, 0);
	});

	it("removes the selected notification by identity when the panel order is reversed", function () {
		var first = { id: "first", title: "First", on: function () {} };
		var second = { id: "second", title: "Second", on: function () {} };
		OSApp.Notifications.addNotification(first);
		OSApp.Notifications.addNotification(second);
		var item = OSApp.Notifications.createNotificationItem(second).appendTo("body");

		OSApp.Notifications.removeNotification(item);

		assert.deepEqual(OSApp.uiState.notifications, [ first ]);
		item.remove();
	});
});

/* eslint-disable */

/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <http://www.opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 */

describe("Notification Checks", function () {
	it("refreshes a stale notification count after replacing the header", function (done) {
		var notifications = OSApp.uiState.notifications,
			header = $("#header"),
			originalHeader = header.contents().detach();

		OSApp.uiState.notifications = [ {}, {} ];
		header.html("<span></span>");

		OSApp.UIDom.changeHeader({
			animate: false,
			rightBtn: {
				icon: "bell",
				class: "notifications",
				text: "<span class='notificationCount'>1</span>"
			}
		});

		setTimeout(function () {
			var error;
			try {
				assert.equal(header.find(".notificationCount").text(), "2");
			} catch (caught) {
				error = caught;
			} finally {
				OSApp.uiState.notifications = notifications;
				header.empty().append(originalHeader);
			}
			done(error);
		}, 0);
	});

	it("does not dismiss notifications when clearing for a controller reload", function () {
		var notifications = OSApp.uiState.notifications,
			off = sinon.stub().returns(true);

		OSApp.uiState.notifications = [ { off: off } ];
		OSApp.Notifications.clearNotifications();

		assert.isFalse(off.called);
		assert.lengthOf(OSApp.uiState.notifications, 0);
		OSApp.uiState.notifications = notifications;
		OSApp.Notifications.updateNotificationBadge();
	});

	it("runs dismissal handlers when the user clears all notifications", function () {
		var notifications = OSApp.uiState.notifications,
			off = sinon.stub().returns(true);

		OSApp.uiState.notifications = [ { off: off }, {} ];
		OSApp.Notifications.clearNotifications(true);

		assert.isTrue(off.calledOnce);
		assert.lengthOf(OSApp.uiState.notifications, 0);
		OSApp.uiState.notifications = notifications;
		OSApp.Notifications.updateNotificationBadge();
	});
});

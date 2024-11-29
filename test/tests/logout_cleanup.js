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

describe("Logout / Clean up", function () {
	it("Remove all variables", function (done) {
		OSApp.Storage.remove(["sites", "current_site", "lang", "runonce"], function () {
			done();
		});
	});

	it("Go to start page", function (done) {
		$.mobile.document.one("pageshow", "#start", function () {
			done();
		});
		OSApp.currentSession.ip = "";
		OSApp.UIDom.changePage("#start");
	});
});

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

describe("Status Rendering Security Checks", function () {
	var controller;
	var footer;
	var originalFooter;
	var programName;
	var sandbox;
	var stationName;

	beforeEach(function () {
		controller = OSApp.currentSession.controller;
		programName = "</div><img id='status-program-injection' src='x'>";
		stationName = "</span><img id='status-station-injection' src='x'>";
		OSApp.currentSession.controller = {
			options: { re: 0, urs: 0, sn1t: 0 },
			settings: {
				en: 1,
				lrun: [ 0, 1, 0, 1700000000 ],
				mm: 0,
				ocs: 0,
				pq: 0,
				ps: [ [ 1, 1, 30 ] ],
				rd: 0,
				rs: 0
			},
			stations: { snames: [ stationName ] },
			status: [ 1 ]
		};

		originalFooter = $("#footer-running");
		footer = $("<div id='footer-running'></div>");
		originalFooter.replaceWith(footer);
		sandbox = sinon.createSandbox();
		sandbox.stub(OSApp.currentSession, "isControllerConnected").returns(true);
		sandbox.stub(OSApp.Programs, "pidToName").returns(programName);
		sandbox.stub(OSApp.Stations, "getName").returns(stationName);
		sandbox.stub(OSApp.Stations, "getPID").returns(1);
		sandbox.stub(OSApp.Stations, "getRemainingRuntime").returns(30);
		sandbox.stub(OSApp.Stations, "getStatus").returns(true);
		sandbox.stub(OSApp.Stations, "isMaster").returns(false);
	});

	afterEach(function () {
		sandbox.restore();
		footer.replaceWith(originalFooter);
		OSApp.currentSession.controller = controller;
	});

	it("renders running program and station names as text", function () {
		OSApp.Status.checkStatus();

		assert.lengthOf(footer.find("#status-program-injection, #status-station-injection"), 0);
		assert.include(footer.text(), programName);
		assert.include(footer.text(), stationName);
		assert.include(footer.text(), "is running on station");
	});

	it("renders last-run program and station names as text", function () {
		OSApp.currentSession.controller.status = [ 0 ];
		OSApp.currentSession.controller.settings.ps = [ 0 ];
		OSApp.currentSession.controller.settings.lrun = [ 0, 1, 60, 1700000000 ];

		OSApp.Status.checkStatus();

		assert.lengthOf(footer.find("#status-program-injection, #status-station-injection"), 0);
		assert.include(footer.text(), programName);
		assert.include(footer.text(), stationName);
		assert.include(footer.text(), "last ran station");
	});
});

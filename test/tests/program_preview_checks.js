/* eslint-disable */

describe("Program Preview Checks", function () {
	var controller;
	var instances;
	var sandbox;

	function makeController(names) {
		var stationNames = names.concat([ "Unused 3", "Unused 4", "Unused 5", "Unused 6", "Unused 7", "Unused 8" ]);
		return {
			options: {
				fwv: 221,
				fwm: 5,
				mas: 0,
				mas2: 0,
				mas3: 0,
				mas4: 0,
				sdt: 0,
				tz: 48,
				urs: 0,
				uwt: 0,
				wl: 100
			},
			settings: {
				devt: Date.UTC(2026, 6, 13, 12) / 1000,
				nbrd: 1,
				rd: 0,
				rdst: 0,
				rs: 0,
				wls: [],
				wto: {},
				wtrestr: 0
			},
			stations: {
				ignore_rain: [ 0 ],
				masop: [ 0 ],
				snames: stationNames,
				stn_dis: [ 0xfc ],
				stn_grp: [ 0, 0, 0, 0, 0, 0, 0, 0 ],
				stn_seq: [ 0x03 ]
			},
			programs: {
				pd: [ [
					1,
					0x7f,
					0,
					[ 60, 0, 0, -1 ],
					[ 60, 60, 0, 0, 0, 0, 0, 0 ],
					"Ordered>n",
					[ 0, 0, 0 ]
				] ]
			}
		};
	}

	function FakeTimeline(element, items, options) {
		this.element = element;
		this.items = items;
		this.options = options;
		this.destroy = sandbox.spy();
		this.getWindow = function () {
			return { start: new Date(), end: new Date() };
		};
		this.moveTo = sandbox.spy();
		this.on = sandbox.spy();
		this.redraw = sandbox.spy();
		this.setCurrentTime = sandbox.spy();
		this.setGroups = function (groups) {
			this.groups = groups;
		};
		this.zoomIn = sandbox.spy();
		this.zoomOut = sandbox.spy();
		instances.push(this);
	}

	function showPreview() {
		OSApp.Programs.displayPagePreviewPrograms();
		$("#preview").trigger("pageshow");
		return instances[instances.length - 1];
	}

	beforeEach(function () {
		controller = OSApp.currentSession.controller;
		instances = [];
		sandbox = sinon.createSandbox();
		OSApp.currentSession.controller = makeController([ "alpha", "Zulu" ]);

		sandbox.stub(OSApp.Firmware, "checkOSVersion").returns(true);
		sandbox.stub(OSApp.Programs, "getStartTime").callsFake(function (value) {
			return value;
		});
		sandbox.stub(OSApp.Stations, "getStationDuration").callsFake(function (value) {
			return value;
		});
		sandbox.stub(OSApp.Stations, "getName").callsFake(function (sid) {
			return OSApp.currentSession.controller.stations.snames[sid];
		});
		sandbox.stub(OSApp.Stations, "isMaster").returns(false);
		sandbox.stub(OSApp.Supported, "sensors").returns(false);
		sandbox.stub(OSApp.UIDom, "changeHeader").returns($());
		sandbox.stub(window.vis, "Timeline").callsFake(FakeTimeline);
	});

	afterEach(function () {
		var page = $("#preview");
		if (page.length) {
			page.trigger("pagehide").remove();
		}
		sandbox.restore();
		OSApp.currentSession.controller = controller;
	});

	it("orders annotated station runs using firmware ordinal name ordering", function () {
		var timeline = showPreview();
		var alpha = timeline.items.find(function (item) { return item.group === "station-0"; });
		var zulu = timeline.items.find(function (item) { return item.group === "station-1"; });

		assert.isBelow(zulu.start.getTime(), alpha.start.getTime());
	});

	it("renders cycle segments through the real program preview path", function () {
		var c = OSApp.currentSession.controller;
		c.stations.csver = 1; c.stations.qmax = 120;
		c.stations.cs = [[1, 60, 60], [0, 0, 0]];
		c.programs.pd[0][4] = [121, 0, 0, 0, 0, 0, 0, 0];
		var timeline = showPreview();
		var runs = timeline.items.filter(function (item) { return item.group === "station-0"; });
		assert.lengthOf(runs, 3);
		assert.deepEqual(runs.map(function (r) { return (r.end - r.start) / 1000; }), [41, 40, 40]);
		assert.equal((runs[1].start - runs[0].end) / 1000, 60);
		assert.include(runs[0].previewDetails, "1:00:01");
		assert.include(runs[0].previewDetails, OSApp.Dates.dhms2str(OSApp.Dates.sec2dhms(41)));
		assert.include(runs[0].title, "<br>");
	});

	it("orders Unicode station names by UTF-8 bytes like firmware strcmp", function () {
		OSApp.currentSession.controller.stations.snames[0] = "\uE000";
		OSApp.currentSession.controller.stations.snames[1] = "\u{10000}";
		var timeline = showPreview();
		var bmp = timeline.items.find(function (item) { return item.group === "station-0"; });
		var astral = timeline.items.find(function (item) { return item.group === "station-1"; });

		assert.isBelow(bmp.start.getTime(), astral.start.getTime());
	});

	it("provides master timing details for both hover and long-press", function () {
		var c = OSApp.currentSession.controller;
		c.options.mas = 8; c.options.mton = -5; c.options.mtof = 10;
		c.stations.masop = [1];
		var timeline = showPreview();
		var master = timeline.items.find(function (item) { return item.className === "master"; });
		assert.isDefined(master);
		assert.isNumber(master.id);
		assert.include(master.title, "Start Time:");
		assert.include(master.previewDetails, OSApp.Dates.dhms2str(OSApp.Dates.sec2dhms(75)));
		timeline.getEventProperties = function () { return {item: master.id}; };
		var clock = sandbox.useFakeTimers();
		var event = new Event("touchstart", {bubbles: true});
		Object.defineProperty(event, "touches", {value: [{clientX: 100, clientY: 100, pageX: 100, pageY: 100}]});
		timeline.element.dispatchEvent(event);
		clock.tick(500);
		assert.equal($(".preview-touch-details").text(), master.previewDetails);
	});

	it("retains actual runtime when a run crosses midnight", function () {
		var c = OSApp.currentSession.controller;
		c.programs.pd[0][3] = [1439, 0, 0, -1];
		c.programs.pd[0][4] = [120, 0, 0, 0, 0, 0, 0, 0];
		var timeline = showPreview();
		var run = timeline.items.find(function (item) { return item.group === "station-0"; });
		assert.equal((run.end - run.start) / 1000, 120);
		assert.include(run.previewDetails, "Run Time: " + OSApp.Dates.dhms2str(OSApp.Dates.sec2dhms(120)));
		assert.include(run.title, "Start Time:");
	});

	it("formats tooltip seconds with the shared 12/24-hour formatter", function () {
		var previous = OSApp.uiState.is24Hour;
		try {
			OSApp.uiState.is24Hour = true;
			assert.equal(OSApp.Dates.minutesToTime(780, 5), "13:00:05");
			OSApp.uiState.is24Hour = false;
			sandbox.stub(OSApp.Language, "_").callsFake(function (text) {return text === "PM" ? "afternoon" : text;});
			assert.equal(OSApp.Dates.minutesToTime(780, 5), "1:00:05 afternoon");
			assert.equal(OSApp.Dates.minutesToTime(780), "1:00 afternoon");
		} finally { OSApp.uiState.is24Hour = previous; }
	});

	it("matches firmware single truncation after weather and sensor preview scaling", function () {
		OSApp.currentSession.controller.programs.pd[0][4] = [ 3, 0, 0, 0, 0, 0, 0, 0 ];
		OSApp.currentSession.controller.jpaData = [ { wa: 0.6, sa: 0.6, ta: 0.36 } ];
		var timeline = showPreview();
		var run = timeline.items.find(function (item) { return item.group === "station-0"; });

		assert.equal((run.end.getTime() - run.start.getTime()) / 1000, 1);
	});

	it("uses a neutral factor when cached /jpa predates an unavailable sensor", function () {
		OSApp.Supported.sensors.returns(true);
		OSApp.currentSession.controller.programs.pd[0][7] = { flag: 1, uuid: 42 };
		OSApp.currentSession.controller.sensors = {
			sn: [ { uuid: 42, flag: 1, status: OSApp.Sensors.STATUS.VALID | OSApp.Sensors.STATUS.STALE } ]
		};
		var request = $.Deferred().resolve({ jpa: [ { wa: 1, sa: 0.5, ta: 0.5 } ] }).promise();
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(request);

		var timeline = showPreview();
		var run = timeline.items.find(function (item) { return item.group === "station-0"; });

		assert.equal((run.end.getTime() - run.start.getTime()) / 1000, 60);
		assert.isFalse($("#preview-sensor-adjustment-warning").hasClass("hidden"));
		assert.include($("#preview-sensor-adjustment-warning").text(), "using 100%");
	});

	it("uses integer weather-percent arithmetic at floating-point boundaries", function () {
		OSApp.currentSession.controller.programs.pd[0][4] = [ 25, 0, 0, 0, 0, 0, 0, 0 ];
		OSApp.currentSession.controller.jpaData = [ { wa: 1.16, sa: 1, ta: 1.16 } ];
		var timeline = showPreview();
		var run = timeline.items.find(function (item) { return item.group === "station-0"; });

		assert.equal((run.end.getTime() - run.start.getTime()) / 1000, 29);
	});

	it("caps adjusted station runtimes using maxrt from the firmware", function () {
		OSApp.currentSession.controller.programs.pd[0][4] = [ 64800, 0, 0, 0, 0, 0, 0, 0 ];
		OSApp.currentSession.controller.jpaData = [ { wa: 2.5, sa: 4, ta: 10 } ];
		OSApp.currentSession.controller.jpaMaxRuntime = 604800;
		var timeline = showPreview();
		var run = timeline.items.find(function (item) { return item.group === "station-0"; });

		assert.equal((run.end.getTime() - run.start.getTime()) / 1000, 604800);
	});

	it("matches firmware's low-weather short-run suppression", function () {
		OSApp.currentSession.controller.programs.pd[0][4] = [ 50, 0, 0, 0, 0, 0, 0, 0 ];
		OSApp.currentSession.controller.jpaData = [ { wa: 0.1, sa: 1, ta: 0.1 } ];

		OSApp.Programs.displayPagePreviewPrograms();
		$("#preview").trigger("pageshow");

		assert.lengthOf(instances, 0);
		assert.include($("#timeline").text(), "No stations set to run on this day.");
	});

	it("uses stable station group IDs when display names are duplicated", function () {
		OSApp.currentSession.controller.stations.snames[1] = "alpha";
		var timeline = showPreview();

		assert.deepEqual(
			timeline.groups.map(function (group) { return group.id; }).sort(),
			[ "station-0", "station-1" ]
		);
		assert.deepEqual(
			timeline.groups.map(function (group) { return group.content; }),
			[ "alpha", "alpha" ]
		);
		assert.sameMembers(
			timeline.items.map(function (item) { return item.group; }),
			[ "station-0", "station-1" ]
		);
	});

	it("replaces timeline instances and removes namespaced handlers on page hide", function () {
		var first = showPreview();
		var placeholder = $("#timeline");
		$("#preview_date").val("2026-07-14").trigger("change");
		var second = instances[1];
		var events = $._data(placeholder[0], "events");

		assert.isTrue(first.destroy.calledOnce);
		assert.lengthOf(events.swipeleft.filter(function (event) {
			return event.namespace === "programPreview";
		}), 1);
		assert.lengthOf(events.swiperight.filter(function (event) {
			return event.namespace === "programPreview";
		}), 1);

		$("#preview").trigger("pagehide");

		assert.isTrue(second.destroy.calledOnce);
		assert.isUndefined($._data(placeholder[0], "events"));
		var resizeEvents = ($._data($.mobile.window[0], "events") || {}).resize || [];
		assert.lengthOf(resizeEvents.filter(function (event) {
			return event.namespace === "programPreview";
		}), 0);
	});
});

/* eslint-disable */

describe("Bundle Station Data Checks", function () {
	var controller, saved, sandbox;

	beforeEach(function () {
		sandbox = sinon.createSandbox();
		controller = OSApp.currentSession.controller;
		saved = {
			bundleApplied: controller.bundleApplied,
			en: controller.settings.en,
			mas: controller.options.mas,
			mexp: controller.options.mexp,
			ps: controller.settings.ps,
			pq: controller.settings.pq,
			re: controller.options.re,
			status: controller.status,
			bmt: controller.stations.bmt,
			stnBnd: controller.stations.stn_bnd,
			stnDis: controller.stations.stn_dis,
			stnSpe: controller.stations.stn_spe,
			special: controller.special,
			specialUnavailable: controller.specialUnavailable
		};
		controller.options.mas = 0;
		controller.options.re = 0;
		controller.settings.en = 1;
		controller.settings.pq = 0;
		controller.settings.ps = Array.from({ length: 16 }, function () { return [ 0, 0, 0, 0 ]; });
		controller.status = new Array(16).fill(0);
		controller.bundleApplied = [ 0, 0 ];
		controller.stations.bmt = 1;
		controller.stations.stn_bnd = [ 0, 0 ];
		controller.stations.stn_dis = [ 0, 0 ];
		controller.stations.stn_spe = [ 0, 0 ];
		controller.special = {};
		delete controller.specialUnavailable;
	});

	afterEach(function () {
		sandbox.restore();
		controller.bundleApplied = saved.bundleApplied;
		controller.settings.en = saved.en;
		controller.options.mas = saved.mas;
		controller.options.mexp = saved.mexp;
		controller.settings.ps = saved.ps;
		controller.settings.pq = saved.pq;
		controller.options.re = saved.re;
		controller.status = saved.status;
		controller.stations.bmt = saved.bmt;
		controller.stations.stn_bnd = saved.stnBnd;
		controller.stations.stn_dis = saved.stnDis;
		controller.stations.stn_spe = saved.stnSpe;
		controller.special = saved.special;
		if (typeof saved.specialUnavailable === "undefined") {
			delete controller.specialUnavailable;
		} else {
			controller.specialUnavailable = saved.specialUnavailable;
		}
	});

	function setSpecial(sid, type, data) {
		controller.stations.stn_spe[(sid / 8) >> 0] |= 1 << (sid % 8);
		controller.special[sid] = { st: type, sd: data || "" };
		if (type === OSApp.Constants.stations.SPECIAL_TYPE_BUNDLE) {
			controller.stations.stn_bnd[(sid / 8) >> 0] |= 1 << (sid % 8);
		}
	}

	it("detects support from stn_bnd rather than firmware version", function () {
		assert.isTrue(OSApp.Supported.bundle());
		delete controller.stations.stn_bnd;
		assert.isFalse(OSApp.Supported.bundle());
	});

	it("encodes and decodes LSB-first board bytes", function () {
		assert.equal(OSApp.Bundles.encodeMembers([ 1, 2, 3 ], 1), "0E");
		assert.equal(OSApp.Bundles.encodeMembers([ 0, 8, 15 ], 2), "0181");
		assert.deepEqual(OSApp.Bundles.decodeMembers("0181", 2), [ 0, 8, 15 ]);
	});

	it("pads and truncates bitmaps to the target board count", function () {
		assert.equal(OSApp.Bundles.normalizeBitmap("0E", 3), "0E0000");
		assert.equal(OSApp.Bundles.normalizeBitmap("0EFFFF", 1), "0E");
	});

	it("uses Standard-only membership when bmt is absent", function () {
		delete controller.stations.bmt;
		assert.isTrue(OSApp.Bundles.memberTypeAllowed(0));
		assert.isFalse(OSApp.Bundles.memberTypeAllowed(1));
	});

	it("honors a future bmt value without changing UI logic", function () {
		controller.stations.bmt = (1 << 0) | (1 << 1);
		assert.isTrue(OSApp.Bundles.memberTypeAllowed(0));
		assert.isTrue(OSApp.Bundles.memberTypeAllowed(1));
		assert.isFalse(OSApp.Bundles.memberTypeAllowed(7));
	});

	it("rejects self, masters, and disallowed special types", function () {
		assert.isFalse(OSApp.Bundles.memberEligibility(0, 0).selectable);
		controller.options.mas = 2;
		assert.isFalse(OSApp.Bundles.memberEligibility(1, 0).selectable);
		controller.options.mas = 0;
		setSpecial(2, OSApp.Constants.stations.SPECIAL_TYPE_RF);
		assert.isFalse(OSApp.Bundles.memberEligibility(2, 0).selectable);
	});

	it("preserves a disabled Standard member while marking it skipped", function () {
		controller.stations.stn_dis[0] = 2;
		var result = OSApp.Bundles.memberEligibility(1, 0);
		assert.isTrue(result.selectable);
		assert.equal(result.note, "disabled");
		assert.deepEqual(OSApp.Bundles.getEligibleMembers([ 1 ], 0), []);
	});

	it("finds all leaders that reference a member", function () {
		setSpecial(0, 7, OSApp.Bundles.encodeMembers([ 3 ], 2));
		setSpecial(1, 7, OSApp.Bundles.encodeMembers([ 3 ], 2));
		assert.deepEqual(OSApp.Bundles.getReferencingLeaders(3), [ 0, 1 ]);
	});

	it("removes rejected bundle master fields while preserving other options", function () {
		setSpecial(0, 7, OSApp.Bundles.encodeMembers([ 3 ], 2));
		var result = OSApp.Options.removeInvalidBundleMasterOptions({
			mas: 4,
			mton: 5,
			mtof: 6,
			wl: 80
		});
		assert.deepEqual(result.removed, [ "mas" ]);
		assert.deepEqual(result.options, { wl: 80 });
	});

	it("distinguishes a derived claim from a direct queue entry", function () {
		controller.status[3] = 1;
		controller.bundleApplied[0] = 1 << 3;
		assert.isTrue(OSApp.Bundles.isDerivedOnly(3));
		controller.settings.ps[3][0] = OSApp.Constants.options.MANUAL_STATION_PID;
		assert.isFalse(OSApp.Bundles.isDerivedOnly(3));
	});

	it("uses a direct bundle owner for multi-station footer status", function () {
		setSpecial(5, 7, OSApp.Bundles.encodeMembers([ 1 ], 2));
		controller.status[1] = 1;
		controller.status[5] = 1;
		controller.bundleApplied[0] = 1 << 1;
		controller.settings.ps[5] = [ 1, 60, 0, 0 ];
		var pidToName = sandbox.stub(OSApp.Programs, "pidToName").returns("Bundle Program"),
			changeStatus = sandbox.stub(OSApp.Status, "changeStatus");

		OSApp.Status.checkStatus();

		assert.isTrue(pidToName.calledWith(1));
		assert.include(changeStatus.firstCall.args[2], "Bundle Program");
	});

	it("maps special station types to compact badges", function () {
		[ [ 1, "RF" ], [ 2, "RS" ], [ 3, "IO" ], [ 4, "HT" ], [ 5, "HT" ], [ 6, "RS" ], [ 7, "BS" ] ]
			.forEach(function (entry) {
				controller.stations.stn_spe = [ 0, 0 ];
				controller.stations.stn_bnd = [ 0, 0 ];
				controller.special = {};
				setSpecial(0, entry[0]);
				assert.equal(OSApp.Stations.getSpecialBadge(0), entry[1]);
			});
	});

	it("hides an unknown special type until metadata loading fails", function () {
		controller.stations.stn_spe[0] = 1;
		delete controller.special;
		assert.equal(OSApp.Stations.getSpecialBadge(0), "");
		controller.specialUnavailable = true;
		assert.equal(OSApp.Stations.getSpecialBadge(0), "SP");
	});

	it("fetches /je once and then uses the cache", function () {
		controller.stations.stn_spe[0] = 1;
		delete controller.special;
		var request = sandbox.stub(OSApp.Firmware, "sendToOS").returns(
			$.Deferred().resolve({ "0": { st: 1, sd: "00" } }).promise()
		);
		OSApp.Sites.ensureControllerStationSpecial();
		OSApp.Sites.ensureControllerStationSpecial();
		assert.isTrue(request.calledOnce);
		assert.equal(OSApp.Stations.getSpecialBadge(0), "RF");
	});

	it("honors a forced /je refresh when the cached special mask is empty", function () {
		var request = sandbox.stub(OSApp.Firmware, "sendToOS").returns(
			$.Deferred().resolve({}).promise()
		);
		return OSApp.Sites.ensureControllerStationSpecial(undefined, true).then(function () {
			assert.isTrue(request.calledOnce);
		});
	});

	it("preserves bap from a standalone /js refresh", function () {
		sandbox.stub(OSApp.Firmware, "sendToOS").returns(
			$.Deferred().resolve({ sn: [ 1, 1 ], bap: [ 2 ] }).promise()
		);
		return OSApp.Sites.updateControllerStatus().then(function () {
			assert.deepEqual(controller.status, [ 1, 1 ]);
			assert.deepEqual(controller.bundleApplied, [ 2 ]);
		});
	});

	describe("configuration import", function () {
		function backup() {
			return {
				options: { mas: 0, mas2: 0, mas3: 0, mas4: 0 },
				stations: { stn_spe: [ 1 ], stn_bnd: [ 1 ] },
				special: { "0": { st: 7, sd: "06" } }
			};
		}

		it("normalizes Bundle Station data to the target board count", function () {
			var result = OSApp.ImportExport.prepareBundleStationImport(backup(), controller);
			assert.equal(result.error, "");
			assert.equal(result.special[0].sd, "0600");
		});

		it("preserves members on boards enabled by the backup", function () {
			var source = backup();
			source.options.ext = 1;
			source.stations.stn_bnd = [ 1, 0 ];
			source.special[0].sd = "0601";
			controller.stations.stn_bnd = [ 0 ];
			controller.options.mexp = 2;

			var result = OSApp.ImportExport.prepareBundleStationImport(source, controller);
			assert.equal(result.error, "");
			assert.equal(result.special[0].sd, "0601");
		});

		it("uses the restored board count when the backup enables fewer boards", function () {
			var source = backup();
			source.options.ext = 0;

			var result = OSApp.ImportExport.prepareBundleStationImport(source, controller);
			assert.equal(result.error, "");
			assert.equal(result.special[0].sd, "06");
		});

		it("keeps the current board count when the backup does not restore ext", function () {
			var source = backup();
			source.settings = { nbrd: 1 };

			var result = OSApp.ImportExport.prepareBundleStationImport(source, controller);
			assert.equal(result.error, "");
			assert.equal(result.special[0].sd, "0600");
		});

		it("rejects bundle restores beyond the target board capacity", function () {
			var source = backup();
			source.options.ext = 1;
			source.special[0].sd = "0601";
			controller.stations.stn_bnd = [ 0 ];
			controller.options.mexp = 0;

			var result = OSApp.ImportExport.prepareBundleStationImport(source, controller);
			assert.isNotEmpty(result.error);
		});

		it("does not apply bundle capacity checks to a backup without bundles", function () {
			var source = backup();
			source.options.ext = 1;
			source.special = {};
			source.stations.stn_bnd = [ 0, 0 ];
			controller.stations.stn_bnd = [ 0 ];
			controller.options.mexp = 0;

			var result = OSApp.ImportExport.prepareBundleStationImport(source, controller);
			assert.equal(result.error, "");
		});

		it("removes bundle commands and bits on unsupported firmware", function () {
			var source = backup(), target = { stations: {} };
			var result = OSApp.ImportExport.prepareBundleStationImport(source, target);
			assert.notProperty(result.special, "0");
			assert.deepEqual(result.stnSpe, [ 0 ]);
		});

		it("rejects a member type not allowed by target bmt", function () {
			var source = backup();
			source.stations.stn_spe[0] |= 2;
			source.special[1] = { st: 1, sd: "" };
			assert.isNotEmpty(OSApp.ImportExport.prepareBundleStationImport(source, controller).error);
		});

		it("rejects a bundle leader without matching special-station data", function () {
			var source = backup();
			delete source.special[0];
			assert.isNotEmpty(OSApp.ImportExport.prepareBundleStationImport(source, controller).error);
		});

		it("accepts a future member type advertised by target bmt", function () {
			var source = backup();
			source.stations.stn_spe[0] |= 2;
			source.special[1] = { st: 1, sd: "" };
			controller.stations.bmt = 3;
			assert.equal(OSApp.ImportExport.prepareBundleStationImport(source, controller).error, "");
		});
	});
});

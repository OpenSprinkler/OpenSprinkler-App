/* eslint-disable */

describe("Firmware UI Loader Checks", function () {
	var source;
	var clock;
	var harness;

	before(async function () {
		source = await (await window.fetch("/base/www/js/home.js")).text();
	});

	beforeEach(function () {
		clock = sinon.useFakeTimers();
	});

	afterEach(function () {
		if (harness) {
			$(harness.document).off();
			harness = null;
		}
		clock.restore();
	});

	function start(options) {
		options = options || {};
		var doc = document.implementation.createHTMLDocument("Controller");
		doc.head.innerHTML = '<meta name="viewport"><script src="https://ui.example.test/custom/js/home.js?refresh=1#top"></script>';
		Object.defineProperty(doc, "URL", { value: "http://controller.example.test/" });
		var scripts = [];
		var append = doc.head.appendChild.bind(doc.head);
		doc.head.appendChild = function (node) {
			if (node.tagName === "SCRIPT") {
				scripts.push(node);
			}
			return append(node);
		};
		var jq = function (selector) {
			return typeof selector === "string" && selector[0] !== "<" ? $(selector, doc) : $(selector);
		};
		jq.support = { cors: true };
		var html = $.Deferred();
		jq.ajax = sinon.stub().returns(html.promise());
		var storage = {
			setItemSync: sinon.stub(),
			removeItemSync: sinon.stub(),
			getItemSync: sinon.stub().returns(options.savedSite ? '{"Local":{}}' : null)
		};
		if (options.storageError) {
			storage.setItemSync.throws(options.storageError);
		}
		var manifest = options.manifest || Promise.resolve({
			ok: true,
			json: () => Promise.resolve(["storage.js", "ui-dom.js"])
		});
		var fetchManifest = sinon.stub().returns(manifest);
		var reload = sinon.spy();
		new Function("window", "document", "fetch", "$", "OSApp", "ver", "ipas", "location", source.replace(
			'var assetPath = "";', 'var assetPath = "assets/build-b/";'
		))({ screen: { height: 900 }, devicePixelRatio: 1 }, doc, fetchManifest, jq, { Storage: storage },
			221, 0, { protocol: "http:", reload: reload });
		harness = {
			document: doc,
			scripts: scripts,
			fetch: fetchManifest,
			ajax: jq.ajax,
			html: html,
			reload: reload,
			event: function (path, type) {
				var script = scripts.find(node => node.src.endsWith(path));
				assert.exists(script, path + " was requested");
				script.dispatchEvent(new Event(type || "load"));
			},
			loadDependencies: async function (optionalEvent) {
				this.event("vendor-js/jquery.js");
				this.event("vendor-js/libs.js");
				[
					"vendor-js/apexcharts.min.js", "vendor-js/dataTables-2.1.8.min.js",
					"vendor-js/chart.js", "vendor-js/vis-timeline-graph2d.min.js", "js/chart-touch.js",
					"vendor-js/chartjs-plugin-zoom.min.js", "vendor-js/chartjs-adapter-date-fns.bundle.min.js"
				].forEach(path => this.event(path, optionalEvent));
				// Drain the fetch, JSON parsing, and error-handling microtasks.
				for (var i = 0; i < 8; i++) {
					await Promise.resolve();
				}
			},
			loadApplication: function () {
				this.event("js/modules/storage.js");
				this.event("js/modules/ui-dom.js");
				this.event("js/main.js");
			}
		};
		return harness;
	}

	function assertLoadError() {
		assert.include(harness.document.body.textContent, "Unable to load OpenSprinkler");
		assert.equal(harness.document.title, "OpenSprinkler: Unable to load");
		harness.document.querySelector("button").click();
		assert.isTrue(harness.reload.calledOnce);
	}

	it("pins scripts, styles, the manifest and page markup to the loader's build", async function () {
		start({ savedSite: true });
		await harness.loadDependencies();
		harness.loadApplication();
		assert.equal(harness.fetch.firstCall.args[0], "https://ui.example.test/custom/assets/build-b/modules.json");
		assert.equal(harness.ajax.firstCall.args[0].url, "https://ui.example.test/custom/assets/build-b/index.html");
		harness.html.resolve("<body><main>Loaded application</main></body>");
		await clock.tickAsync(5);
		harness.event("vendor-js/jqm.js");
		$(harness.document).trigger("mobileinit");
		assert.equal(harness.document.body.textContent, "Loaded application");
		harness.scripts.forEach(script => {
			assert.include(script.src, "/custom/assets/build-b/");
		});
		harness.document.querySelectorAll("link").forEach(link => {
			assert.include(link.href, "/custom/assets/build-b/");
		});
	});

	["vendor-js/jquery.js", "vendor-js/libs.js", "js/modules/storage.js", "js/main.js", "vendor-js/jqm.js"].forEach(path => {
		it("shows a reload action when " + path + " fails", async function () {
			start({ savedSite: true });
			if (path === "vendor-js/libs.js") {
				harness.event("vendor-js/jquery.js");
			} else if (path.indexOf("js/modules/") === 0 || path === "js/main.js" || path === "vendor-js/jqm.js") {
				await harness.loadDependencies();
				if (path !== "js/modules/storage.js") {
					harness.event("js/modules/storage.js");
					harness.event("js/modules/ui-dom.js");
				}
				if (path === "vendor-js/jqm.js") {
					harness.event("js/main.js");
					harness.html.resolve("<body>Application</body>");
					await clock.tickAsync(5);
				}
			}
			harness.event(path, "error");
			assertLoadError();
		});
	});

	[
		["network failure", () => Promise.reject(new Error("Offline"))],
		["HTTP error", () => Promise.resolve({ ok: false })],
		["invalid JSON", () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error("Invalid JSON")) })],
		["empty list", () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })],
		["incorrect shape", () => Promise.resolve({ ok: true, json: () => Promise.resolve({ modules: [] }) })],
		["invalid path", () => Promise.resolve({ ok: true, json: () => Promise.resolve(["../main.js"]) })]
	].forEach(([name, manifest]) => {
		it("shows a reload action for a manifest " + name, async function () {
			start({ manifest: manifest() });
			await harness.loadDependencies();
			assertLoadError();
			assert.isFalse(harness.scripts.some(script => script.src.endsWith("js/main.js")));
		});
	});

	[20000, 59000].forEach(delay => {
		it("completes startup when a required module takes " + delay / 1000 + " seconds", async function () {
			start({ savedSite: true });
			await harness.loadDependencies();
			harness.event("js/modules/ui-dom.js");
			clock.tick(delay);
			assert.notInclude(harness.document.body.textContent, "Unable to load");
			harness.event("js/modules/storage.js");
			harness.event("js/main.js");
			harness.html.resolve("<body><main>Loaded application</main></body>");
			await clock.tickAsync(5);
			harness.event("vendor-js/jqm.js");
			$(harness.document).trigger("mobileinit");
			clock.tick(60000);
			assert.equal(harness.document.body.textContent, "Loaded application");
		});
	});

	["vendor-js/jquery.js", "js/modules/storage.js"].forEach(path => {
		it("times out stalled " + path + " after 60 seconds and ignores its late load event", async function () {
			start();
			if (path === "js/modules/storage.js") {
				await harness.loadDependencies();
				harness.event("js/modules/ui-dom.js");
			}
			clock.tick(59999);
			assert.notInclude(harness.document.body.textContent, "Unable to load");
			clock.tick(1);
			assertLoadError();
			var requestedScripts = harness.scripts.length;
			harness.event(path);
			assert.lengthOf(harness.scripts, requestedScripts);
		});
	});

	it("times out a stalled manifest and ignores a late response", async function () {
		var resolveManifest;
		start({ manifest: new Promise(resolve => { resolveManifest = resolve; }) });
		await harness.loadDependencies();
		clock.tick(59999);
		assert.notInclude(harness.document.body.textContent, "Unable to load");
		clock.tick(1);
		assertLoadError();
		resolveManifest({ ok: true, json: () => Promise.resolve(["storage.js"]) });
		await clock.tickAsync(1);
		assert.isFalse(harness.scripts.some(script => script.src.includes("js/modules/")));
	});

	it("continues to the password prompt when optional chart libraries fail", async function () {
		start();
		await harness.loadDependencies("error");
		harness.loadApplication();
		assert.include(harness.document.body.textContent, "Enter Device Password");
		clock.tick(60000);
		assert.notInclude(harness.document.body.textContent, "Unable to load");
	});

	it("shows an error when a stylesheet fails", function () {
		start();
		harness.document.querySelector("link[rel='stylesheet']").dispatchEvent(new Event("error"));
		assertLoadError();
	});

	["failure", "invalid markup"].forEach(outcome => {
		it("shows an error after an HTML " + outcome, async function () {
			start({ savedSite: true });
			await harness.loadDependencies();
			harness.loadApplication();
			assert.equal(harness.ajax.firstCall.args[0].timeout, 60000);
			if (outcome === "failure") {
				harness.html.reject();
			} else {
				harness.html.resolve("Not the application shell");
			}
			await clock.tickAsync(5);
			assertLoadError();
			assert.isFalse(harness.scripts.some(script => script.src.endsWith("vendor-js/jqm.js")));
		});
	});

	[22, 18].forEach(code => {
		it("shows an error for storage exception " + code, async function () {
			start({ storageError: { code: code } });
			await harness.loadDependencies();
			harness.loadApplication();
			assertLoadError();
			if (code === 22) {
				assert.include(harness.document.body.textContent, "Local storage is not enabled");
			}
		});
	});
});

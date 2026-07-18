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

describe("Service Worker Fetch Checks", function () {
	var source;

	before(function () {
		return window.fetch("/base/www/sw.js")
			.then(function (response) { return response.text(); })
			.then(function (text) { source = text; });
	});

	function makeHarness(cachedResponse) {
		var handlers = {};
		var response = {
			ok: true,
			type: "basic",
			clone: sinon.stub().returnsThis()
		};
		var cache = {
			addAll: sinon.stub().resolves(),
			match: sinon.stub().resolves(cachedResponse),
			put: sinon.stub().resolves()
		};
		var caches = {
			delete: sinon.stub().resolves(),
			keys: sinon.stub().resolves([]),
			match: sinon.stub().resolves(cachedResponse),
			open: sinon.stub().resolves(cache)
		};
		var networkFetch = sinon.stub().resolves(response);
		var workerSelf = {
			location: { origin: "https://app.opensprinkler.test" },
			addEventListener: function (type, handler) {
				handlers[type] = handler;
			}
		};
		var quietConsole = { log: sinon.spy() };

		new Function("self", "caches", "fetch", "URL", "console", source)(
			workerSelf,
			caches,
			networkFetch,
			window.URL,
			quietConsole
		);

		return {
			cache: cache,
			caches: caches,
			dispatchActivate: function () {
				var waitPromise;
				handlers.activate({
					waitUntil: function (promise) { waitPromise = promise; }
				});
				return Promise.resolve(waitPromise);
			},
			dispatchFetch: function (request) {
				var responsePromise;
				handlers.fetch({
					request: request,
					respondWith: function (promise) { responsePromise = promise; }
				});
				return Promise.resolve(responsePromise);
			},
			dispatchInstall: function () {
				var waitPromise;
				handlers.install({
					waitUntil: function (promise) { waitPromise = promise; }
				});
				return Promise.resolve(waitPromise);
			},
			networkFetch: networkFetch,
			response: response
		};
	}

	it("always sends same-origin controller API requests to the network without consulting caches", function () {
		var harness = makeHarness();
		var request = {
			method: "GET",
			mode: "cors",
			url: "https://app.opensprinkler.test/ja?pw=do-not-cache"
		};

		return harness.dispatchFetch(request).then(function (response) {
			assert.strictEqual(response, harness.response);
			assert.isTrue(harness.networkFetch.calledOnceWithExactly(request));
			assert.isFalse(harness.caches.match.called);
			assert.isFalse(harness.caches.open.called);
			assert.isFalse(harness.cache.put.called);
		});
	});

	it("serves root navigation from the cached index shell", function () {
		var cachedIndex = { cached: true };
		var harness = makeHarness(cachedIndex);

		return harness.dispatchFetch({
			method: "GET",
			mode: "navigate",
			url: "https://app.opensprinkler.test/"
		}).then(function (response) {
			assert.strictEqual(response, cachedIndex);
			assert.isTrue(harness.cache.match.calledOnceWithExactly("/index.html"));
			assert.isFalse(harness.networkFetch.called);
			assert.isFalse(harness.cache.put.called);
		});
	});

	it("caches a successful explicit app-shell asset by pathname", function () {
		var harness = makeHarness();
		var request = {
			method: "GET",
			mode: "cors",
			url: "https://app.opensprinkler.test/js/main.js?v=1"
		};

		return harness.dispatchFetch(request).then(function (response) {
			assert.strictEqual(response, harness.response);
			assert.isTrue(harness.cache.match.calledOnceWithExactly("/js/main.js"));
			assert.isTrue(harness.networkFetch.calledOnceWithExactly(request));
			assert.isTrue(harness.caches.open.calledOnce);
			assert.isTrue(harness.cache.put.calledOnceWithExactly("/js/main.js", harness.response));
			assert.isTrue(harness.response.clone.calledOnce);
		});
	});

	it("pre-caches image assets used by touched station UI", function () {
		var harness = makeHarness();

		return harness.dispatchInstall().then(function () {
			var files = harness.cache.addAll.firstCall.args[0];
			assert.include(files, "/img/check-black.png");
			assert.include(files, "/img/master.png");
		});
	});

	it("only removes obsolete OpenSprinkler caches during activation", function () {
		var harness = makeHarness();
		harness.caches.keys.resolves([
			"OpenSprinkler-v0.0.0",
			"OpenSprinkler-v-old",
			"another-app-cache"
		]);

		return harness.dispatchActivate().then(function () {
			assert.isTrue(harness.caches.delete.calledOnceWithExactly("OpenSprinkler-v-old"));
			assert.isFalse(harness.caches.delete.calledWith("another-app-cache"));
		});
	});

	it("waits for a runtime cache write before resolving the fetch", function () {
		var harness = makeHarness();
		var putRequest = $.Deferred();
		var settled = false;
		harness.cache.put.returns(putRequest.promise());

		var responsePromise = harness.dispatchFetch({
			method: "GET",
			mode: "cors",
			url: "https://app.opensprinkler.test/js/main.js"
		}).then(function () { settled = true; });

		return Promise.resolve().then(function () {
			assert.isFalse(settled);
			putRequest.resolve();
			return responsePromise;
		}).then(function () {
			assert.isTrue(settled);
		});
	});

	it("never caches cross-origin or non-GET requests", function () {
		var harness = makeHarness();
		var crossOrigin = {
			method: "GET",
			mode: "cors",
			url: "https://controller.example/ja?pw=secret"
		};
		var mutation = {
			method: "POST",
			mode: "cors",
			url: "https://app.opensprinkler.test/co"
		};

		return harness.dispatchFetch(crossOrigin)
			.then(function () { return harness.dispatchFetch(mutation); })
			.then(function () {
				assert.deepEqual(harness.networkFetch.getCalls().map(function (call) {
					return call.args[0];
				}), [crossOrigin, mutation]);
				assert.isFalse(harness.caches.match.called);
				assert.isFalse(harness.caches.open.called);
				assert.isFalse(harness.cache.put.called);
			});
	});
});

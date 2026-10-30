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

// Shows the site map view on the home page, freshly loaded, and resolves with its root element
function openHomeMap() {
	var ready = $(".ui-page-active").attr("id") === "sprinklers" ? Promise.resolve() : new Promise(function (resolve) {
		$.mobile.document.one("pageshow", "#sprinklers", resolve);
		OSApp.UIDom.changePage("#sprinklers");
	});

	return ready.then(function () {
		OSApp.SiteMap.setHomeView("cards");
		OSApp.SiteMap.setHomeView("map");
		return new Promise(function (resolve) {
			setTimeout(resolve, 50);
		});
	}).then(function () {
		var root = $("#sprinklers .site-map-view"),
			img = root.find(".site-map-image-el")[0];
		if (img.getAttribute("src") && !img.complete) {
			return new Promise(function (resolve) {
				img.addEventListener("load", resolve, { once: true });
			});
		}
	}).then(function () {
		return new Promise(function (resolve) {
			requestAnimationFrame(function () {
				requestAnimationFrame(resolve);
			});
		});
	}).then(function () {
		return $("#sprinklers .site-map-view");
	});
}

describe("Site Map Checks", function () {
	var zoomDuration = OSApp.SiteMap.Constants.zoomDuration;

	// Zooms jump straight to their result in these tests unless a test turns the animation back on
	before(function () {
		OSApp.SiteMap.Constants.zoomDuration = 0;
	});

	after(function () {
		OSApp.SiteMap.Constants.zoomDuration = zoomDuration;
	});

	// 1x1 transparent GIF
	var testImage = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
	var siteName;

	before(function (done) {
		OSApp.currentSession.ip = "demo.opensprinkler.com";
		OSApp.currentSession.pass = "opendoor";
		OSApp.currentSession.prefix = "https://";
		OSApp.currentSession.fw183 = false;

		OSApp.Sites.updateSiteList(["Test"], "Test");

		$.mobile.document.one("pageshow", "#sprinklers", function () {
			OSApp.Storage.get("current_site", function (data) {
				siteName = data.current_site || "default";
				done();
			});
		});

		OSApp.Sites.newLoad();
	});

	afterEach(function () {
		OSApp.Storage.remove(OSApp.SiteMap.getStorageKey(siteName));

		// Back to the station cards, unzoomed, so the next test loads the map afresh
		$("#sprinklers .site-map-zoom-reset").trigger("click");

		// A message from this test, such as "Settings have been saved", could cover the next test's taps
		clearTimeout(OSApp.uiState.errorTimeout);
		$.mobile.loading("hide");
		OSApp.SiteMap.setHomeView("cards");
	});

	// Resolves on the next animation frame, after any queued pin render
	function nextFrame() {
		return new Promise(function (resolve) {
			requestAnimationFrame(function () {
				requestAnimationFrame(resolve);
			});
		});
	}

	// Shows the map on the home page, zoomed out to the whole image, and runs check on it; check may return a promise
	function showSiteMap(done, check) {
		openHomeMap().then(showWholeImage).then(check).then(function () {
			done();
		}, done);
	}

	// The map opens with the image covering it, cropped; zoom out until all of it is visible
	function showWholeImage(root) {
		for (var i = 0; i < 8; i++) {
			root.find(".site-map-zoom-out").trigger("click");
		}
		return nextFrame().then(function () {
			return root;
		});
	}

	// Where the image is drawn on screen, which is what map positions (0-1) are relative to
	function imageRect(page) {
		return page.find(".site-map-image-el")[0].getBoundingClientRect();
	}

	// Native events, as jQuery 2 doesn't copy pointer properties onto its own event objects
	function pointer(element, type, x, y) {
		$(element)[0].dispatchEvent(new PointerEvent(type, {
			bubbles: true, cancelable: true, clientX: x || 0, clientY: y || 0,
			pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true
		}));
	}

	function tap(element) {
		pointer(element, "pointerdown");
		pointer(element, "pointerup");
	}

	it("should save and load map data per site", function (done) {
		var map = { image: testImage, pins: { 0: { x: 0.25, y: 0.75 } }, drawings: { 0: [ { type: "drip", pts: [[0.1, 0.1], [0.2, 0.2]] } ] } };
		OSApp.SiteMap.save(siteName, map);
		OSApp.SiteMap.load(siteName, function (loaded) {
			assert.deepEqual(loaded, JSON.parse(JSON.stringify(map)));
			OSApp.SiteMap.load(siteName + "-other", function (empty) {
				assert.deepEqual(empty, { pins: {}, drawings: {} });
				done();
			});
		});
	});

	it("should recover from corrupt map data", function (done) {
		var data = {};
		data[OSApp.SiteMap.getStorageKey(siteName)] = "{not json";
		OSApp.Storage.set(data);
		OSApp.SiteMap.load(siteName, function (loaded) {
			assert.deepEqual(loaded, { pins: {}, drawings: {} });
			done();
		});
	});

	it("should show the empty state when no image is set", function (done) {
		showSiteMap(done, function (page) {
			// Only the prompt to add an image is shown
			assert.isTrue(page.find(".site-map-container").hasClass("site-map-empty"));
			assert.isTrue(page.find(".site-map-empty-prompt").is(":visible"));
			assert.isTrue(page.find(".site-map-add-image").is(":visible"));
			assert.isFalse(page.find(".site-map-controls").is(":visible"));
			assert.isFalse(page.find(".site-map-hint").is(":visible"));
			assert.lengthOf(page.find(".site-map-pin"), 0);
		});
	});

	it("should fit the map on screen, covered by the image, with the edit button on top", function () {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		return openHomeMap().then(function (page) {
			var container = page.find(".site-map-container"),
				rect = container[0].getBoundingClientRect(),
				image = imageRect(page),
				edit = page.find(".site-map-edit")[0].getBoundingClientRect();

			assert.isFalse(container.hasClass("site-map-empty"));
			assert.isAtMost(rect.bottom, window.innerHeight);

			// The square test image covers the map in both directions
			assert.closeTo(image.width, image.height, 1);
			assert.isAtMost(image.left, rect.left + 0.5);
			assert.isAtLeast(image.right, rect.right - 0.5);
			assert.isAtMost(image.top, rect.top + 0.5);
			assert.isAtLeast(image.bottom, rect.bottom - 0.5);

			assert.isAtLeast(edit.top, rect.top);
			assert.isAtMost(edit.bottom, rect.bottom);
		});
	});

	it("should size the image to cover the map area, and keep views within it", function () {
		// A wide image on a tall map is as tall as the map, and a tall image on a wide map as wide
		assert.deepEqual(OSApp.SiteMap.getCoverSize(0.5, 300, 600), { width: 1200, height: 600 });
		assert.deepEqual(OSApp.SiteMap.getCoverSize(2, 600, 300), { width: 600, height: 1200 });
		assert.deepEqual(OSApp.SiteMap.getCoverSize(0, 600, 300), { width: 600, height: 300 });

		// Zoomed out below the covering size, the image is centered in the viewport
		var viewport = { width: 300, height: 600, minScale: 0.25 };
		assert.deepEqual(OSApp.SiteMap.clampView({ scale: 0.25, x: 80, y: -40 }, 1200, 600, 8, 0, viewport), { scale: 0.25, x: 0, y: 225 });
		assert.equal(OSApp.SiteMap.clampView({ scale: 0.1, x: 0, y: 0 }, 1200, 600, 8, 0, viewport).scale, 0.25);

		// At the covering size it pans sideways across the whole image, but not up or down
		assert.deepEqual(OSApp.SiteMap.clampView({ scale: 1, x: -2000, y: 50 }, 1200, 600, 8, 0, viewport), { scale: 1, x: -900, y: 0 });

		// Zooming out keeps the point under the pointer, then settles centered
		assert.equal(OSApp.SiteMap.zoomAt({ scale: 1, x: -450, y: 0 }, 0.1, 150, 300, 1200, 600, 8, viewport).scale, 0.25);
	});

	it("should fill the map area with the image, cropping it until zoomed out", function () {
		OSApp.SiteMap.save(siteName, { image: wideImage(), pins: { 0: { x: 0.5, y: 0.5 } } });

		return openHomeMap().then(function (root) {
			var container = root.find(".site-map-container"),
				rect = container[0].getBoundingClientRect(),
				image = function () {
					return root.find(".site-map-image-el")[0].getBoundingClientRect();
				},
				pin = root.find(".site-map-pin")[0].getBoundingClientRect();

			// The map uses the whole free area of the screen, not just the image's shape
			pageFitsWindow();
			assert.isAbove(rect.height, rect.width / 5 + 50);

			// The wide image is as tall as the map and centered, with its sides off screen
			assert.closeTo(image().height, rect.height, 1);
			assert.closeTo(image().top, rect.top, 1);
			assert.isAbove(image().width, rect.width + 50);
			assert.closeTo(image().left + image().width / 2, rect.left + rect.width / 2, 1);
			assert.closeTo(pin.left + pin.width / 2, rect.left + rect.width / 2, 1);
			assert.isTrue(container.hasClass("site-map-zoomed"), "it can be dragged sideways");

			// Zooming all the way out shows the whole image, centered
			for (var i = 0; i < 6; i++) {
				root.find(".site-map-zoom-out").trigger("click");
			}
			return nextFrame().then(function () {
				assert.closeTo(image().width, rect.width, 1);
				assert.closeTo(image().top + image().height / 2, rect.top + rect.height / 2, 1);

				// Reset Zoom goes back to filling the map area
				root.find(".site-map-zoom-reset").trigger("click");
				return nextFrame();
			}).then(function () {
				assert.closeTo(image().height, rect.height, 1);
			});
		});
	});

	it("should place a valve where the cropped image was tapped", function () {
		OSApp.SiteMap.save(siteName, { image: wideImage(), pins: {} });

		return openHomeMap().then(function (root) {
			var rect = root.find(".site-map-container")[0].getBoundingClientRect(),
				x = rect.left + rect.width / 2,
				y = rect.top + rect.height / 4;

			root.find(".site-map-edit").trigger("click");
			pointer(root.find(".site-map-container"), "pointerdown", x, y);
			pointer(root.find(".site-map-container"), "pointerup", x, y);
			return waitFor(function () {
				return $(".site-map-picker a[data-sid]").length;
			}).then(function () {
				$(".site-map-picker a[data-sid]").first().trigger("click");
				root.find(".site-map-edit").trigger("click");
				return new Promise(function (resolve) {
					OSApp.SiteMap.load(siteName, resolve);
				});
			}).then(function (map) {
				var sid = Object.keys(map.pins)[0];
				assert.closeTo(map.pins[sid].x, 0.5, 0.01);
				assert.closeTo(map.pins[sid].y, 0.25, 0.01);
			});
		});
	});

	it("should leave disabled stations out of the list for placing a valve unless Show Disabled is on", function () {
		var disabled = sinon.stub(OSApp.Stations, "isDisabled").callsFake(function (sid) {
				return sid === 1;
			}),
			previous = OSApp.Storage.getItemSync("showDisabled"),
			listed = function (root) {
				var rect = root.find(".site-map-container")[0].getBoundingClientRect();

				root.find(".site-map-edit").trigger("click");
				pointer(root.find(".site-map-container"), "pointerdown", rect.left + rect.width / 2, rect.top + rect.height / 2);
				pointer(root.find(".site-map-container"), "pointerup", rect.left + rect.width / 2, rect.top + rect.height / 2);
				return waitFor(function () {
					return $(".site-map-picker a[data-sid]").length;
				}).then(function () {
					var sids = $(".site-map-picker a[data-sid]").map(function () {
						return Number($(this).attr("data-sid"));
					}).get();

					$(".site-map-picker").popup("close");
					root.find(".site-map-cancel").trigger("click");
					return waitFor(function () {
						return !$(".ui-popup-active").length;
					}).then(function () {
						return sids;
					});
				});
			};

		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });
		OSApp.Storage.set({ showDisabled: false });

		return openHomeMap().then(function (root) {
			return listed(root).then(function (sids) {
				assert.notInclude(sids, 1);
				assert.include(sids, 0);
				OSApp.Storage.set({ showDisabled: true });
				return listed(root);
			});
		}).then(function (sids) {
			assert.include(sids, 1);
		}).finally(function () {
			disabled.restore();
			OSApp.Storage.set({ showDisabled: previous === "true" });
		});
	});

	it("should hide disabled valves and their drawings unless Show Disabled is on, following the menu", function () {
		var disabled = sinon.stub(OSApp.Stations, "isDisabled").callsFake(function (sid) {
				return sid === 1;
			}),
			previous = OSApp.Storage.getItemSync("showDisabled"),
			toggle = function () {
				OSApp.UIDom.showHomeMenu();
				return waitFor(function () {
					return $(".ui-popup-active a[href='#show-hidden']").length;
				}).then(function () {
					$(".ui-popup-active a[href='#show-hidden']").trigger("click");
					return waitFor(function () {
						return !$(".ui-popup-active").length;
					});
				});
			};

		OSApp.Storage.set({ showDisabled: false });
		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.2, y: 0.5 }, 1: { x: 0.8, y: 0.5 } },
			drawings: { 1: [{ type: "drip", pts: [[0.7, 0.5], [0.9, 0.5]] }] }
		});

		return openHomeMap().then(function (root) {
			assert.deepEqual(root.find(".site-map-pin").map(function () {
				return $(this).attr("data-sids");
			}).get(), ["0"]);
			assert.lengthOf(root.find(".site-map-run"), 0);

			// Show Disabled in the footer menu brings them back right away, and hiding them again removes them
			return toggle().then(function () {
				assert.lengthOf(root.find(".site-map-pin"), 2);
				assert.lengthOf(root.find(".site-map-run"), 1);
				return toggle();
			}).then(function () {
				assert.lengthOf(root.find(".site-map-pin"), 1);
				assert.lengthOf(root.find(".site-map-run"), 0);
			});
		}).finally(function () {
			disabled.restore();
			OSApp.Storage.set({ showDisabled: previous === "true" });
		});
	});

	it("should render stored pins at their saved positions", function (done) {
		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.25, y: 0.75 }, 9999: { x: 0.5, y: 0.5 } }
		});

		showSiteMap(done, function (page) {
			var pins = page.find(".site-map-pin");

			// Pins for stations that do not exist are skipped
			assert.lengthOf(pins, 1);
			assert.equal(pins.attr("data-sids"), "0");
			var map = imageRect(page),
				container = page.find(".site-map-container")[0].getBoundingClientRect(),
				pin = pins[0].getBoundingClientRect();
			assert.closeTo(parseFloat(pins[0].style.left), map.left - container.left + 0.25 * map.width, 0.5);
			assert.closeTo(parseFloat(pins[0].style.top), map.top - container.top + 0.75 * map.height, 0.5);

			// The valve icon is centered on that spot on the map, not inside another element
			assert.closeTo(pin.left + pin.width / 2, map.left + 0.25 * map.width, 1);
			assert.closeTo(pin.top + pin.height / 2, map.top + 0.75 * map.height, 1);
			assert.lengthOf(pins.find(".site-map-valve"), 1);
			assert.equal(pins.attr("title"), OSApp.Stations.getName(0));
			assert.equal(pins.text(), "");
			assert.isTrue(pins.is("[class*='site-map-pin-" + OSApp.SiteMap.getPinState(0) + "']"));
		});
	});

	it("should group pins that are close together on screen", function () {
		var clusters = OSApp.SiteMap.clusterPins({
			0: { x: 0.50, y: 0.50 },
			1: { x: 0.52, y: 0.50 },
			2: { x: 0.90, y: 0.10 }
		}, 1000, 1000, 32);

		assert.lengthOf(clusters, 2);
		assert.deepEqual(clusters[0].sids, [0, 1]);
		assert.closeTo(clusters[0].x, 0.51, 1e-9);
		assert.closeTo(clusters[0].y, 0.50, 1e-9);
		assert.deepEqual(clusters[1].sids, [2]);
	});

	it("should separate pins once the map is large enough", function () {
		var pins = { 0: { x: 0.50, y: 0.50 }, 1: { x: 0.52, y: 0.50 } };

		assert.lengthOf(OSApp.SiteMap.clusterPins(pins, 1000, 1000, 32), 1);
		assert.lengthOf(OSApp.SiteMap.clusterPins(pins, 2000, 2000, 32), 2);

		// Without a rendered size nothing is grouped
		assert.lengthOf(OSApp.SiteMap.clusterPins(pins, 0, 0, 32), 2);
	});

	it("should color a group by its most active station", function () {
		var stub = sinon.stub(OSApp.SiteMap, "getPinState").callsFake(function (sid) {
			return ["idle", "running", "disabled"][sid];
		});
		try {
			assert.equal(OSApp.SiteMap.getClusterState([0, 1, 2]), "running");
			assert.equal(OSApp.SiteMap.getClusterState([0, 2]), "idle");
		} finally {
			stub.restore();
		}
	});

	it("should keep the view inside the map when zooming", function () {
		var view = OSApp.SiteMap.zoomAt({ scale: 1, x: 0, y: 0 }, 2, 100, 50, 400, 200, 8);

		// The point under (100, 50) stays put
		assert.deepEqual(view, { scale: 2, x: -100, y: -50 });

		assert.equal(OSApp.SiteMap.zoomAt(view, 100, 0, 0, 400, 200, 8).scale, 8);
		assert.deepEqual(OSApp.SiteMap.zoomAt(view, 0.1, 0, 0, 400, 200, 8), { scale: 1, x: 0, y: 0 });
		assert.deepEqual(OSApp.SiteMap.clampView({ scale: 2, x: 50, y: -500 }, 400, 200, 8), { scale: 2, x: 0, y: -200 });
	});

	it("should find the zoom that separates every pin in a group", function () {
		var pins = { 0: { x: 0.5, y: 0.5 }, 1: { x: 0.51, y: 0.5 }, 2: { x: 0.5, y: 0.505 } },
			scale = OSApp.SiteMap.getSeparatingScale(pins, 1000, 1000, 32, 8);

		// Closest pair is 5px apart at normal size
		assert.isAbove(scale, 32 / 5);
		assert.isAtMost(scale, 8);
		assert.lengthOf(OSApp.SiteMap.clusterPins(pins, 1000 * scale, 1000 * scale, 32), 3);

		assert.equal(OSApp.SiteMap.getSeparatingScale({ 0: { x: 0.1, y: 0.1 }, 1: { x: 0.9, y: 0.9 } }, 1000, 1000, 32, 8), 1);
		assert.isNull(OSApp.SiteMap.getSeparatingScale({ 0: { x: 0.5, y: 0.5 }, 1: { x: 0.5, y: 0.5 } }, 1000, 1000, 32, 8));
		assert.isNull(OSApp.SiteMap.getSeparatingScale({ 0: { x: 0.5, y: 0.5 }, 1: { x: 0.501, y: 0.5 } }, 1000, 1000, 32, 8));
	});

	it("should list stations in a group that can't be separated", function (done) {
		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.5, y: 0.5 }, 1: { x: 0.5, y: 0.5 }, 2: { x: 0.05, y: 0.05 } }
		});

		showSiteMap(function (err) {
			$(".site-map-picker").popup("close");
			done(err);
		}, function (page) {
			var group = page.find(".site-map-pin-group");

			assert.lengthOf(page.find(".site-map-pin"), 2);
			assert.lengthOf(group, 1);
			assert.equal(group.attr("data-sids"), "0,1");
			assert.equal(group.find(".site-map-pin-count").text(), "2");

			tap(group);
			assert.lengthOf($(".site-map-picker a[data-sid]"), 2);
			assert.isFalse(page.find(".site-map-container").hasClass("site-map-zoomed"));
		});
	});

	it("should ignore the click a touch tap fires onto the station list it opened", function (done) {
		var control = sinon.stub(OSApp.UIDom, "showDurationBox");

		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.5, y: 0.5 }, 1: { x: 0.5, y: 0.5 } }
		});

		showSiteMap(function (err) {
			control.restore();
			$(".site-map-picker").popup("close");
			done(err);
		}, function (page) {
			var touch = function (type) {
				page.find(".site-map-pin-group")[0].dispatchEvent(new PointerEvent(type, {
					bubbles: true, cancelable: true, pointerId: 2, pointerType: "touch", isPrimary: true
				}));
			};

			touch("pointerdown");
			touch("pointerup");

			// The browser follows a touch with a click at the same spot, which now lands on the list
			$(".site-map-picker a[data-sid]").first()[0].click();
			assert.isFalse(control.called);
			assert.lengthOf($(".site-map-picker a[data-sid]"), 2);

			// A real tap on the list afterwards still works
			return new Promise(function (resolve) {
				setTimeout(resolve, 700);
			}).then(function () {
				$(".site-map-picker a[data-sid]").first()[0].click();
				return new Promise(function (resolve) {
					setTimeout(resolve, 600);
				});
			}).then(function () {
				assert.isTrue(control.calledOnce);
			});
		});
	});

	it("should separate nearby pins after zooming into their group", function (done) {
		var width;

		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		// Measure the rendered map first, then place two pins 20px apart at normal size
		showSiteMap(function (err) {
			if (err) {
				done(err);
				return;
			}
			OSApp.SiteMap.save(siteName, {
				image: testImage,
				pins: { 0: { x: 0.5, y: 0.5 }, 1: { x: 0.5 + 6 / width, y: 0.5 }, 2: { x: 0.5, y: 0.5 + 8 / width } }
			});
			showSiteMap(done, function (page) {
				assert.lengthOf(page.find(".site-map-pin"), 1);

				// One click zooms far enough to separate all three
				tap(page.find(".site-map-pin-group"));

				return nextFrame().then(function () {
					assert.lengthOf(page.find(".site-map-pin"), 3);
					assert.lengthOf(page.find(".site-map-pin-group"), 0);
					assert.lengthOf($(".site-map-picker"), 0);
				});
			});
		}, function (page) {
			width = page.find(".site-map-container").width();
			assert.isAbove(width, 0);
		});
	});

	it("should allow zooming in far enough to separate the closest pins", function () {
		var limit = OSApp.SiteMap.Constants.maxZoomLimit,
			far = { 0: { x: 0.1, y: 0.1 }, 1: { x: 0.9, y: 0.9 } },
			close = { 0: { x: 0.5, y: 0.5 }, 1: { x: 0.502, y: 0.5 }, 2: { x: 0.1, y: 0.1 } },
			scale;

		// Pins that are already apart keep the normal limit
		assert.equal(OSApp.SiteMap.getMaxZoom(far, 400, 400, 32), OSApp.SiteMap.Constants.maxZoom);
		assert.equal(OSApp.SiteMap.getMaxZoom({}, 400, 400, 32), OSApp.SiteMap.Constants.maxZoom);

		// On a phone-sized map these are under 1px apart, so 8x isn't enough
		scale = OSApp.SiteMap.getMaxZoom(close, 400, 400, 32);
		assert.isAbove(scale, OSApp.SiteMap.Constants.maxZoom);
		assert.isAtMost(scale, limit);
		assert.lengthOf(OSApp.SiteMap.clusterPins(close, 400 * scale, 400 * scale, 32), 3);

		// Pins at exactly the same spot can never separate, so they don't raise the limit for the others
		close[3] = { x: 0.1, y: 0.1 };
		assert.equal(OSApp.SiteMap.getMaxZoom(close, 400, 400, 32), scale);

		// Never beyond the hard limit
		assert.equal(OSApp.SiteMap.getMaxZoom({ 0: { x: 0.5, y: 0.5 }, 1: { x: 0.5001, y: 0.5 } }, 400, 400, 32), limit);
	});

	it("should separate pins too close for the normal zoom limit after tapping their group", function (done) {
		var width;

		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		showSiteMap(function (err) {
			if (err) {
				done(err);
				return;
			}

			// 2px apart: still grouped at 8x (16px), so separating them needs more zoom than the normal limit
			OSApp.SiteMap.save(siteName, {
				image: testImage,
				pins: { 0: { x: 0.5, y: 0.5 }, 1: { x: 0.5 + 2 / width, y: 0.5 } }
			});
			showSiteMap(function (err) {
				$(".site-map-picker").popup("close");
				done(err);
			}, function (page) {
				tap(page.find(".site-map-pin-group"));

				return nextFrame().then(function () {
					assert.lengthOf($(".site-map-picker a[data-sid]"), 0);
					assert.lengthOf(page.find(".site-map-pin-group"), 0);
					assert.lengthOf(page.find(".site-map-pin"), 2);
					assert.isAbove(scaleOf(page), OSApp.SiteMap.Constants.maxZoom);
				});
			});
		}, function (page) {
			width = page.find(".site-map-container").width();
			assert.isAbove(width, 0);
		});
	});

	it("should let the zoom buttons go past the normal limit when pins need it", function () {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.5, y: 0.5 }, 1: { x: 0.5001, y: 0.5 } } });

		return openHomeMap().then(function (page) {
			for (var i = 0; i < 10; i++) {
				page.find(".site-map-zoom-in").trigger("click");
			}
			return nextFrame().then(function () {
				assert.equal(scaleOf(page), OSApp.SiteMap.Constants.maxZoomLimit);
			});
		});
	});

	it("should pan and zoom with the mouse and keyboard", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.5, y: 0.5 } } });

		showSiteMap(done, function (page) {
			var container = page.find(".site-map-container"),
				rect = container[0].getBoundingClientRect(),
				image = page.find(".site-map-image-el")[0],
				x = rect.left + rect.width / 2,
				y = rect.top + rect.height / 2,
				key = function (name) {
					$(document).trigger($.Event("keydown", { key: name, target: document.body, originalEvent: { key: name } }));
				};

			// Wheel up zooms in around the cursor, from the whole image to twice its size
			var whole = scaleOf(page);
			assert.isFalse(container.hasClass("site-map-zoomed"));
			container[0].dispatchEvent(new WheelEvent("wheel", { deltaY: -300, clientX: x, clientY: y, bubbles: true, cancelable: true }));
			assert.isTrue(container.hasClass("site-map-zoomed"));
			assert.closeTo(scaleOf(page), whole * 2, 0.001);

			// Dragging the background pans the map
			var before = image.style.transform;
			pointer(container, "pointerdown", x, y);
			pointer(container, "pointermove", x - 40, y - 30);
			pointer(container, "pointerup", x - 40, y - 30);
			assert.notEqual(image.style.transform, before);
			assert.isFalse(container.hasClass("site-map-panning"));

			// 0 goes back to the image covering the map, and - zooms out from there to the whole image
			key("0");
			assert.equal(scaleOf(page), 1);
			for (var i = 0; i < 4; i++) {
				key("-");
			}
			assert.closeTo(scaleOf(page), whole, 0.001);
			assert.isFalse(container.hasClass("site-map-zoomed"));
			key("+");
			assert.isTrue(container.hasClass("site-map-zoomed"));
		});
	});

	it("should toggle edit mode", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		showSiteMap(done, function (page) {
			assert.isFalse(page.hasClass("site-map-editing"));
			page.find(".site-map-edit").trigger("click");
			assert.isTrue(page.hasClass("site-map-editing"));
			page.find(".site-map-edit").trigger("click");
			assert.isFalse(page.hasClass("site-map-editing"));
		});
	});

	// Resolves once check() returns true, polling each frame for up to two seconds
	function waitFor(check) {
		var started = Date.now();
		return new Promise(function (resolve, reject) {
			(function poll() {
				if (check()) {
					resolve();
				} else if (Date.now() - started > 2000) {
					reject(new Error("Timed out waiting for the site map"));
				} else {
					requestAnimationFrame(poll);
				}
			})();
		});
	}

	// Clicks an item in the open action list and waits for its action to run once the list closes
	function chooseAction(label) {
		return waitFor(function () {
			return $(".ui-popup-active .site-map-picker a").length > 0;
		}).then(function () {
			$(".ui-popup-active .site-map-picker a").filter(function () {
				return $(this).text() === label;
			}).trigger("click");
			return waitFor(function () {
				return !$(".ui-popup-active").length;
			});
		});
	}

	function tapMap(page, x, y) {
		var container = page.find(".site-map-container"),
			rect = imageRect(page),
			px = rect.left + x * rect.width,
			py = rect.top + y * rect.height,

			// Dispatch on whatever is drawn there, as a real tap would
			target = document.elementFromPoint(px, py) || container[0];
		pointer(target, "pointerdown", px, py);
		pointer(target, "pointerup", px, py);
	}

	function storedMap() {
		return new Promise(function (resolve) {
			OSApp.SiteMap.load(siteName, resolve);
		});
	}

	// Edits are kept until Done is tapped; this taps it and resolves with what was saved
	function doneEditing(page) {
		page.find(".site-map-edit").trigger("click");
		return storedMap();
	}

	it("should encode drawings as one line per run and drop runs for missing stations", function () {
		var drawings = {
				2: [{ type: "drip", pts: [[0.1, 0.2], [0.3, 0.4]] }],
				0: [{ type: "heads", pts: [[0.5, 0.5]] }, { type: "heads", pts: [[0.25, 0.75], [1, 0]] }]
			},
			text = OSApp.SiteMap.encodeDrawings(drawings);

		assert.equal(text, "h,0,5000,5000\nh,0,2500,7500,10000,0\nd,2,1000,2000,3000,4000\n");
		assert.deepEqual(OSApp.SiteMap.decodeDrawings(text), drawings);
		assert.deepEqual(Object.keys(OSApp.SiteMap.decodeDrawings(text, 2)), ["0"]);
		assert.equal(OSApp.SiteMap.encodeDrawings({}), "");

		// Malformed lines and runs with too few points are ignored
		assert.deepEqual(OSApp.SiteMap.decodeDrawings("x,0,1,1\nd,0,1,1\nh,0,1\nh,1,10000,0\n"), { 1: [{ type: "heads", pts: [[1, 0]] }] });
	});

	it("should draw a head at every point of a head run and dash drip lines", function (done) {
		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.1, y: 0.1 } },
			drawings: {
				0: [{ type: "heads", pts: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]] }],
				1: [{ type: "drip", pts: [[0.2, 0.8], [0.8, 0.8]] }]
			}
		});

		showSiteMap(done, function (page) {
			var size = { width: page.find(".site-map-container").width(), height: page.find(".site-map-container").height() },
				heads = page.find(".site-map-run-heads .site-map-head"),
				drip = page.find(".site-map-run-drip");

			assert.lengthOf(heads, 3);
			assert.closeTo(Number(heads[1].getAttribute("cx")), 0.5 * size.width, 0.5);
			assert.closeTo(Number(heads[1].getAttribute("cy")), 0.1 * size.height, 0.5);
			assert.lengthOf(drip, 1);
			assert.lengthOf(drip.find(".site-map-head"), 0);
			assert.notEqual(getComputedStyle(drip.find(".site-map-run-line")[0]).strokeDasharray, "none");

			// Handles only appear while editing
			assert.lengthOf(page.find(".site-map-handle"), 0);
			page.find(".site-map-edit").trigger("click");
			assert.lengthOf(page.find(".site-map-handle"), 5);
			page.find(".site-map-edit").trigger("click");
		});
	});

	it("should connect each run to its valve with a supply pipe", function (done) {
		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.1, y: 0.2 }, 1: { x: 0.9, y: 0.9 } },
			drawings: {
				0: [{ type: "heads", pts: [[0.4, 0.2], [0.6, 0.2]] }, { type: "drip", pts: [[0.1, 0.2], [0.1, 0.8]] }],
				2: [{ type: "heads", pts: [[0.5, 0.5]] }]
			}
		});

		showSiteMap(done, function (page) {
			var map = imageRect(page),
				container = page.find(".site-map-container")[0].getBoundingClientRect(),
				x = function (fraction) {
					return map.left - container.left + fraction * map.width;
				},
				y = function (fraction) {
					return map.top - container.top + fraction * map.height;
				},
				feeds = page.find(".site-map-run-feed");

			// The drip line starts at its valve and station 2 has no valve, so only the head run gets a pipe
			assert.lengthOf(feeds, 1);
			assert.equal(feeds.closest(".site-map-run").attr("class").indexOf("site-map-run-heads") !== -1, true);
			assert.closeTo(pathPoint(feeds[0], 0).x, x(0.1), 0.5);
			assert.closeTo(pathPoint(feeds[0], 0).y, y(0.2), 0.5);
			assert.closeTo(pathPoint(feeds[0], 1).x, x(0.4), 0.5);
			assert.closeTo(pathPoint(feeds[0], 1).y, y(0.2), 0.5);
		});
	});

	// Point at a fraction (0-1) of the way along an SVG path
	function pathPoint(path, fraction) {
		return path.getPointAtLength(path.getTotalLength() * fraction);
	}

	// Direction of travel along a path at a fraction of its length, in radians
	function pathDirection(path, fraction) {
		var length = path.getTotalLength(),
			a = path.getPointAtLength(Math.max(0, length * fraction - 1)),
			b = path.getPointAtLength(Math.min(length, length * fraction + 1));
		return Math.atan2(b.y - a.y, b.x - a.x);
	}

	it("should build a smooth curve through every point", function () {
		var points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 150 }],
			segments = OSApp.SiteMap.getCurve(points),
			cross = function (a, b) {
				return a.x * b.y - a.y * b.x;
			},
			minus = function (a, b) {
				return { x: a.x - b.x, y: a.y - b.y };
			};

		// One curve per pair of points, starting and ending on the points
		assert.lengthOf(segments, 3);
		segments.forEach(function (segment, i) {
			assert.deepEqual(segment.from, points[i]);
			assert.deepEqual(segment.to, points[i + 1]);
		});

		// Smooth: where two curves meet, both leave the point in the same direction
		[0, 1].forEach(function (i) {
			var into = minus(segments[i].to, segments[i].c2),
				out = minus(segments[i + 1].c1, segments[i + 1].from);
			assert.closeTo(cross(into, out), 0, 1e-6);
			assert.isAbove(into.x * out.x + into.y * out.y, 0);
		});

		// Controls stay within a segment's length of its ends, so a long segment next to a short one doesn't loop
		OSApp.SiteMap.getCurve([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 10 }, { x: 0, y: 10 }]).forEach(function (segment) {
			var length = Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);
			assert.isAtMost(Math.hypot(segment.c1.x - segment.from.x, segment.c1.y - segment.from.y), length / 2);
			assert.isAtMost(Math.hypot(segment.c2.x - segment.to.x, segment.c2.y - segment.to.y), length / 2);
		});

		// Two points make a straight line
		var line = OSApp.SiteMap.getCurve([{ x: 0, y: 0 }, { x: 90, y: 30 }])[0];
		assert.closeTo(cross(minus(line.c1, line.from), minus(line.to, line.from)), 0, 1e-6);
		assert.closeTo(cross(minus(line.c2, line.from), minus(line.to, line.from)), 0, 1e-6);

		assert.lengthOf(OSApp.SiteMap.getCurve([{ x: 5, y: 5 }]), 0);
		assert.lengthOf(OSApp.SiteMap.getCurve([]), 0);
	});

	it("should draw runs as smooth curves through their heads, continuing the supply pipe", function (done) {
		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.1, y: 0.1 } },
			drawings: { 0: [{ type: "heads", pts: [[0.3, 0.1], [0.5, 0.3], [0.5, 0.6]] }] }
		});

		showSiteMap(done, function (page) {
			var line = page.find(".site-map-run-line")[0],
				feed = page.find(".site-map-run-feed")[0],
				heads = page.find(".site-map-head"),
				length = line.getTotalLength(),
				near = function (head) {
					var x = Number(head.getAttribute("cx")), y = Number(head.getAttribute("cy")), best = Infinity;
					for (var d = 0; d <= length; d += 0.5) {
						var pt = line.getPointAtLength(d);
						best = Math.min(best, Math.hypot(pt.x - x, pt.y - y));
					}
					return best;
				},
				turn = function (a, b) {
					return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
				};

			assert.equal(line.tagName, "path");
			assert.equal(feed.tagName, "path");

			// The line passes through every head
			heads.each(function () {
				assert.isBelow(near(this), 0.75);
			});

			// No sharp corner at the middle head, or where the pipe from the valve meets the run
			var best = Infinity, at = 0;
			for (var d = 0; d <= length; d += 0.5) {
				var pt = line.getPointAtLength(d),
					dist = Math.hypot(pt.x - Number(heads[1].getAttribute("cx")), pt.y - Number(heads[1].getAttribute("cy")));
				if (dist < best) {
					best = dist;
					at = d / length;
				}
			}
			assert.isBelow(turn(pathDirection(line, at - 0.03), pathDirection(line, at + 0.03)), 0.6);
			assert.isBelow(turn(pathDirection(feed, 0.99), pathDirection(line, 0.01)), 0.15);
		});
	});

	it("should keep drawings on the image while zoomed", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: { 0: [{ type: "heads", pts: [[0.25, 0.75]] }] } });

		showSiteMap(done, function (page) {
			var container = page.find(".site-map-container"),
				rect = container[0].getBoundingClientRect(),
				whole = scaleOf(page);

			container[0].dispatchEvent(new WheelEvent("wheel", { deltaY: -300, clientX: rect.left + 10, clientY: rect.top + 10, bubbles: true, cancelable: true }));
			return nextFrame().then(function () {
				var match = page.find(".site-map-image-el")[0].style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/),
					head = page.find(".site-map-head")[0],
					x = Number(match[1]), y = Number(match[2]), scale = Number(match[3]);

				var box = head.getBoundingClientRect(),
					mapBox = container[0].getBoundingClientRect(),
					check = function () {
						box = head.getBoundingClientRect();
						assert.closeTo(box.left + box.width / 2 - mapBox.left, x + 0.25 * imageEl.offsetWidth * scale, 1);
						assert.closeTo(box.top + box.height / 2 - mapBox.top, y + 0.75 * imageEl.offsetHeight * scale, 1);
					},
					imageEl = page.find(".site-map-image-el")[0];

				assert.isAbove(scale, whole);

				// Right away, while the drawings are moved as one piece, and after they are redrawn
				check();
				return new Promise(function (resolve) {
					setTimeout(resolve, OSApp.SiteMap.Constants.settleDelay + 100);
				}).then(nextFrame).then(function () {
					head = page.find(".site-map-head")[0];
					check();
					page.find(".site-map-zoom-reset").trigger("click");
				});
			});
		});
	});

	it("should color drawings by station state and dim the others while a station runs", function (done) {
		var stub = sinon.stub(OSApp.SiteMap, "getPinState").callsFake(function (sid) {
			return sid === 0 ? "running" : "idle";
		});

		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: {},
			drawings: { 0: [{ type: "heads", pts: [[0.2, 0.2]] }], 1: [{ type: "drip", pts: [[0.1, 0.9], [0.9, 0.9]] }] }
		});

		showSiteMap(function (err) {
			stub.restore();
			done(err);
		}, function (page) {
			var running = page.find(".site-map-run[data-sid='0']"),
				idle = page.find(".site-map-run[data-sid='1']");

			assert.isTrue(running.is(".site-map-run-running") && !running.is(".site-map-run-dim"));
			assert.isTrue(idle.is(".site-map-run-idle.site-map-run-dim"));
			assert.equal(getComputedStyle(running.find(".site-map-head")[0]).fill, "rgb(47, 168, 47)");
		});
	});

	it("should draw a head run point by point, starting at the valve", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.2, y: 0.5 } } });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tap(page.find(".site-map-pin"));
			return chooseAction("Add heads").then(function () {
				assert.isTrue(page.hasClass("site-map-drawing-mode"));
				assert.isTrue(page.find(".site-map-drawbar").is(":visible"));

				// Tapped close to the valve, so the pipe starts exactly at it
				tapMap(page, 0.205, 0.51);
				tapMap(page, 0.5, 0.5);
				tapMap(page, 0.5, 0.8);
				page.find(".site-map-draw-undo").trigger("click");
				tapMap(page, 0.6, 0.8);
				assert.lengthOf(page.find(".site-map-run-heads .site-map-head"), 3);

				page.find(".site-map-draw-done").trigger("click");
				assert.isFalse(page.hasClass("site-map-drawing-mode"));
				return doneEditing(page);
			}).then(function (map) {
				var pts = map.drawings[0][0].pts;
				assert.equal(map.drawings[0][0].type, "heads");
				assert.lengthOf(pts, 3);
				assert.deepEqual(pts[0], [0.2, 0.5]);
				assert.closeTo(pts[2][0], 0.6, 0.01);
			});
		});
	});

	it("should discard a drip line that was given no points", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 3: { x: 0.5, y: 0.5 } } });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tap(page.find(".site-map-pin"));
			return chooseAction("Add drip line").then(function () {
				page.find(".site-map-draw-done").trigger("click");
				assert.lengthOf(page.find(".site-map-run"), 0);
				return storedMap();
			}).then(function (map) {
				assert.deepEqual(map.drawings, {});
				page.find(".site-map-edit").trigger("click");
			});
		});
	});

	it("should move a point by dragging its handle and add points to an existing run", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: { 1: [{ type: "drip", pts: [[0.1, 0.1], [0.5, 0.1]] }] } });

		showSiteMap(done, function (page) {
			var container = page.find(".site-map-container"),
				rect = container[0].getBoundingClientRect();

			page.find(".site-map-edit").trigger("click");
			pointer(page.find(".site-map-handle")[1], "pointerdown", rect.left + 0.5 * rect.width, rect.top + 0.1 * rect.height);
			pointer(container, "pointermove", rect.left + 0.5 * rect.width, rect.top + 0.4 * rect.height);
			pointer(container, "pointerup", rect.left + 0.5 * rect.width, rect.top + 0.4 * rect.height);

			return doneEditing(page).then(function (map) {
				assert.closeTo(map.drawings[1][0].pts[1][1], 0.4, 0.01);

				// Tapping the middle of the moved line opens its actions
				page.find(".site-map-edit").trigger("click");
				tapMap(page, 0.3, 0.25);
				return chooseAction("Add");
			}).then(function () {
				tapMap(page, 0.7, 0.7);
				page.find(".site-map-draw-done").trigger("click");
				return doneEditing(page);
			}).then(function (map) {
				assert.lengthOf(map.drawings[1][0].pts, 3);
			});
		});
	});

	it("should store branches as runs that start on another run", function () {
		var drawings = {
				0: [
					{ type: "drip", pts: [[0.1, 0.5], [0.9, 0.5]] },
					{ type: "heads", branch: true, pts: [[0.5, 0.5], [0.5, 0.8], [0.6, 0.9]] },
					{ type: "drip", branch: true, pts: [[0.3, 0.5], [0.3, 0.2]] }
				]
			},
			text = OSApp.SiteMap.encodeDrawings(drawings);

		assert.equal(text, "d,0,1000,5000,9000,5000\nH,0,5000,5000,5000,8000,6000,9000\nD,0,3000,5000,3000,2000\n");
		assert.deepEqual(OSApp.SiteMap.decodeDrawings(text), drawings);

		// A branch of heads needs a head besides the point it starts from
		assert.deepEqual(OSApp.SiteMap.decodeDrawings("H,0,5000,5000\nh,1,5000,5000\n"), { 1: [{ type: "heads", pts: [[0.5, 0.5]] }] });
		assert.equal(OSApp.SiteMap.getMinPoints({ type: "heads", branch: true }), 2);
		assert.equal(OSApp.SiteMap.getMinPoints({ type: "heads" }), 1);
		assert.equal(OSApp.SiteMap.getMinPoints({ type: "drip", branch: true }), 2);
	});

	it("should find the point on a curve nearest to another point", function () {
		var straight = OSApp.SiteMap.getCurve([{ x: 0, y: 0 }, { x: 100, y: 0 }]),
			bent = OSApp.SiteMap.getCurve([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]),
			nearest = OSApp.SiteMap.nearestOnCurve(straight, { x: 40, y: 25 }),
			corner = OSApp.SiteMap.nearestOnCurve(bent, { x: 100, y: 0 });

		assert.closeTo(nearest.x, 40, 0.5);
		assert.closeTo(nearest.y, 0, 0.5);
		assert.closeTo(corner.x, 100, 0.5);
		assert.closeTo(corner.y, 0, 0.5);

		// Off the end, it stops at the end
		nearest = OSApp.SiteMap.nearestOnCurve(straight, { x: 150, y: 10 });
		assert.closeTo(nearest.x, 100, 0.5);
		assert.closeTo(nearest.y, 0, 0.5);
	});

	it("should draw a branch from its junction, without a pipe from the valve or a head at the junction", function (done) {
		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.05, y: 0.5 } },
			drawings: { 0: [
				{ type: "heads", pts: [[0.2, 0.5], [0.8, 0.5]] },
				{ type: "heads", branch: true, pts: [[0.5, 0.5], [0.5, 0.8], [0.6, 0.9]] }
			] }
		});

		showSiteMap(done, function (page) {
			var runs = page.find(".site-map-run"),
				branch = runs.eq(1),
				map = imageRect(page),
				container = page.find(".site-map-container")[0].getBoundingClientRect(),
				junction = branch.find(".site-map-junction");

			assert.lengthOf(runs.eq(0).find(".site-map-run-feed"), 1);
			assert.lengthOf(branch.find(".site-map-run-feed"), 0);
			assert.lengthOf(branch.find(".site-map-head"), 2);
			assert.lengthOf(junction, 1);
			assert.closeTo(Number(junction.attr("cx")), map.left - container.left + 0.5 * map.width, 0.5);
			assert.closeTo(Number(junction.attr("cy")), map.top - container.top + 0.5 * map.height, 0.5);
		});
	});

	it("should branch a new run off the spot where a line was tapped", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: { 1: [{ type: "drip", pts: [[0.1, 0.5], [0.9, 0.5]] }] } });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tapMap(page, 0.4, 0.5);
			return chooseAction(OSApp.Language._("Add heads")).then(function () {
				// Undo can't take away the junction
				page.find(".site-map-draw-undo").trigger("click");
				tapMap(page, 0.4, 0.8);
				page.find(".site-map-draw-done").trigger("click");
				return doneEditing(page);
			}).then(function (map) {
				var branch = map.drawings[1][1];

				assert.lengthOf(map.drawings[1], 2);
				assert.equal(branch.type, "heads");
				assert.isTrue(branch.branch);
				assert.lengthOf(branch.pts, 2);
				assert.closeTo(branch.pts[0][0], 0.4, 0.01);
				assert.closeTo(branch.pts[0][1], 0.5, 0.005);
				assert.closeTo(branch.pts[1][1], 0.8, 0.01);
			});
		});
	});

	it("should discard a branch that gets no points of its own", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: { 1: [{ type: "drip", pts: [[0.1, 0.5], [0.9, 0.5]] }] } });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tapMap(page, 0.6, 0.5);
			return chooseAction(OSApp.Language._("Add drip line")).then(function () {
				page.find(".site-map-draw-done").trigger("click");
				return doneEditing(page);
			}).then(function (map) {
				assert.lengthOf(map.drawings[1], 1);
			});
		});
	});

	it("should run a one-segment drip line from its valve when only its end is tapped", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.2, y: 0.2 }, 1: { x: 0.8, y: 0.2 } }, drawings: {} });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tap(page.find(".site-map-pin[data-sids='0']"));
			return chooseAction(OSApp.Language._("Add drip line")).then(function () {
				tapMap(page, 0.5, 0.7);
				page.find(".site-map-draw-done").trigger("click");
				return doneEditing(page);
			}).then(function (map) {
				assert.lengthOf(map.drawings[0], 1);
				assert.deepEqual(map.drawings[0][0].pts[0], [0.2, 0.2]);
				assert.closeTo(map.drawings[0][0].pts[1][0], 0.5, 0.01);
				assert.closeTo(map.drawings[0][0].pts[1][1], 0.7, 0.01);
			});
		});
	});

	it("should start a new drip line at its valve, dashed from there while it is drawn", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.2, y: 0.2 } }, drawings: {} });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tap(page.find(".site-map-pin"));
			return chooseAction(OSApp.Language._("Add drip line")).then(function () {
				tapMap(page, 0.5, 0.5);
				tapMap(page, 0.8, 0.5);

				// Before saving: no solid pipe, and the dashed line begins at the valve
				var map = imageRect(page),
					container = page.find(".site-map-container")[0].getBoundingClientRect(),
					line = page.find(".site-map-run-drip .site-map-run-line")[0];
				assert.lengthOf(page.find(".site-map-run-feed"), 0);
				assert.closeTo(pathPoint(line, 0).x, map.left - container.left + 0.2 * map.width, 0.5);
				assert.closeTo(pathPoint(line, 0).y, map.top - container.top + 0.2 * map.height, 0.5);

				page.find(".site-map-draw-done").trigger("click");
				assert.lengthOf(page.find(".site-map-run-feed"), 0);
				return doneEditing(page);
			}).then(function (map) {
				assert.lengthOf(map.drawings[0][0].pts, 3);
				assert.deepEqual(map.drawings[0][0].pts[0], [0.2, 0.2]);
			});
		});
	});

	// Taps a run's point handle in edit mode and chooses Delete
	function deletePoint(page, runIndex, pointIndex) {
		var handle = page.find(".site-map-run[data-run='" + runIndex + "'] .site-map-handle[data-point='" + pointIndex + "']")[0],
			box = handle.getBoundingClientRect(),
			x = box.left + box.width / 2,
			y = box.top + box.height / 2;

		pointer(handle, "pointerdown", x, y);
		pointer(handle, "pointerup", x, y);
		return chooseAction(OSApp.Language._("Delete"));
	}

	it("should delete just the tapped point or head in the middle of a line", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: { 1: [
			{ type: "drip", pts: [[0.1, 0.5], [0.5, 0.5], [0.9, 0.5]] },
			{ type: "heads", pts: [[0.1, 0.2], [0.4, 0.2], [0.7, 0.2]] }
		] } });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			return deletePoint(page, 0, 1).then(function () {
				return deletePoint(page, 1, 1);
			}).then(function () {
				return doneEditing(page);
			}).then(function (map) {
				assert.deepEqual(map.drawings[1], [
					{ type: "drip", pts: [[0.1, 0.5], [0.9, 0.5]] },
					{ type: "heads", pts: [[0.1, 0.2], [0.7, 0.2]] }
				]);
			});
		});
	});

	it("should delete a line when deleting a point would leave it too short", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: { 1: [
			{ type: "drip", pts: [[0.1, 0.5], [0.9, 0.5]] },
			{ type: "heads", pts: [[0.3, 0.2], [0.6, 0.2]] }
		] } });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			return deletePoint(page, 0, 0).then(function () {
				return deletePoint(page, 0, 1);
			}).then(function () {
				return doneEditing(page);
			}).then(function (map) {
				// The drip line can't lose a point, but a head can go from the run of two
				assert.deepEqual(map.drawings[1], [{ type: "heads", pts: [[0.3, 0.2]] }]);
			});
		});
	});

	it("should run the station when its drawing is tapped", function (done) {
		var control;

		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: { 0: [{ type: "drip", pts: [[0.1, 0.5], [0.9, 0.5]] }] } });

		showSiteMap(function (err) {
			control.restore();
			$("#durationBox").popup("close");
			done(err);
		}, function (page) {
			control = sinon.stub(OSApp.UIDom, "showDurationBox");
			tapMap(page, 0.5, 0.5);
			assert.isTrue(control.calledOnce);
			assert.equal(control.firstCall.args[0].title, OSApp.Stations.getName(0));
		});
	});

	it("should remove a valve's drawings with it", function (done) {
		var confirm;

		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.5, y: 0.5 } },
			drawings: { 0: [{ type: "heads", pts: [[0.5, 0.5]] }, { type: "drip", pts: [[0.1, 0.1], [0.2, 0.2]] }] }
		});

		showSiteMap(function (err) {
			confirm.restore();
			done(err);
		}, function (page) {
			confirm = sinon.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, detail, yes) {
				assert.include(question, OSApp.Stations.getName(0));
				yes();
			});
			page.find(".site-map-edit").trigger("click");
			tap(page.find(".site-map-pin"));
			return chooseAction("Delete").then(function () {
				assert.lengthOf(page.find(".site-map-run"), 0);
				return doneEditing(page);
			}).then(function (map) {
				assert.deepEqual(map.pins, {});
				assert.deepEqual(map.drawings, {});
			});
		});
	});

	it("should switch the home page between the station cards and the map", function () {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		return openHomeMap().then(function (root) {
			var page = $("#sprinklers");

			var button = page.find(".home-view-button");

			assert.isTrue(root.is(":visible"));
			assert.isFalse(page.find("#os-stations-list").is(":visible"));

			// The button shows the icon of the view it switches to
			assert.isTrue(button.hasClass("ui-icon-bullets"));
			assert.equal(getComputedStyle(button[0]).position, "fixed");

			button.trigger("click");
			assert.isFalse(root.is(":visible"));
			assert.isTrue(page.find("#os-stations-list").is(":visible"));
			assert.isTrue(button.hasClass("ui-icon-location"));
			assert.equal(OSApp.SiteMap.getHomeView(), "cards");

			button.trigger("click");
			assert.isTrue(root.is(":visible"));
			assert.equal(OSApp.SiteMap.getHomeView(), "map");
		});
	});

	it("should show a loading message, not the add image prompt, until the controller's map arrives", function () {
		var pending = $.Deferred(),
			stub = sinon.stub(OSApp.SiteMap, "loadMap").callsFake(function (name, callback) {
				pending.then(function () {
					callback({ image: testImage, pins: {}, drawings: {} }, "local");
				});
			}),
			page = $("#sprinklers");

		// A fresh home page has never loaded its map
		$("#sprinklers").remove();
		OSApp.SiteMap.setHomeView("map");
		return new Promise(function (resolve) {
			$.mobile.document.one("pageshow", "#sprinklers", resolve);
			OSApp.UIDom.changePage("#sprinklers");
		}).then(function () {
			var root = $("#sprinklers .site-map-view");

			assert.isTrue(root.find(".site-map-loading-text").is(":visible"));
			assert.isFalse(root.find(".site-map-empty-prompt").is(":visible"));
			pending.resolve();
			assert.isFalse(root.find(".site-map-loading-text").is(":visible"));
			assert.isFalse(root.find(".site-map-empty-prompt").is(":visible"));
		}).finally(function () {
			stub.restore();
			page = null;
		});
	});

	it("should animate zooming into a group of valves", function () {
		var width;

		OSApp.SiteMap.Constants.zoomDuration = 200;
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		return openHomeMap().then(function (page) {
			width = page.find(".site-map-container").width();
			OSApp.SiteMap.save(siteName, {
				image: testImage,
				pins: { 0: { x: 0.5, y: 0.5 }, 1: { x: 0.5 + 6 / width, y: 0.5 } }
			});
			return openHomeMap();
		}).then(function (page) {
			var image = page.find(".site-map-image-el")[0],
				scaleOf = function () {
					var match = image.style.transform.match(/scale\(([\d.]+)\)/);
					return match ? Number(match[1]) : 1;
				},
				samples = [];

			tap(page.find(".site-map-pin-group"));

			// Partway through, the zoom is between the start and the end
			return new Promise(function (resolve) {
				setTimeout(function () {
					samples.push(scaleOf());
					setTimeout(function () {
						samples.push(scaleOf());
						resolve();
					}, 300);
				}, 80);
			}).then(function () {
				assert.isAbove(samples[0], 1);
				assert.isBelow(samples[0], samples[1]);
				assert.lengthOf(page.find(".site-map-pin"), 2);
			});
		}).finally(function () {
			OSApp.SiteMap.Constants.zoomDuration = 0;
		});
	});

	// Waits for layout work queued by a resize (ResizeObserver and animation frames) to settle
	function settle() {
		return new Promise(function (resolve) {
			setTimeout(resolve, 100);
		}).then(nextFrame);
	}

	function pageFitsWindow() {
		var page = $("#sprinklers")[0];
		assert.isAtMost(document.documentElement.scrollHeight, window.innerHeight + 1, "the page scrolls");
		assert.isAtLeast(page.offsetHeight, window.innerHeight - 1, "the page doesn't reach the bottom of the window");
	}

	it("should fill the window without scrolling in map view", function () {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });
		return openHomeMap().then(settle).then(pageFitsWindow);
	});

	it("should stretch the page to the window again when switching from the cards to the map", function () {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		return openHomeMap().then(function () {
			// Make the card view taller than the window, so jQuery Mobile drops its minimum height
			$("#os-stations-list").append("<div class='layout-test-filler' style='height:2000px'></div>");
			OSApp.SiteMap.setHomeView("cards");
			$.mobile.resetActivePageHeight();
			OSApp.SiteMap.setHomeView("map");
			return settle();
		}).then(pageFitsWindow).finally(function () {
			$(".layout-test-filler").remove();
		});
	});

	// A wide image, so the map is limited by the window's width and ends above the bottom of the window,
	// like a square photo on a phone
	function wideImage() {
		var canvas = document.createElement("canvas");
		canvas.width = 400;
		canvas.height = 80;
		canvas.getContext("2d").fillRect(0, 0, 400, 80);
		return canvas.toDataURL("image/jpeg");
	}

	it("should stretch the page again when the map is refitted smaller", function () {
		OSApp.SiteMap.save(siteName, { image: wideImage(), pins: {} });

		return openHomeMap().then(function (root) {
			// Like opening straight into map view: the page height is set while the map is still taller
			// than the window, then the map is fitted to the screen
			root.find(".site-map-container").css("height", "2000px");
			$.mobile.resetActivePageHeight();
			assert.equal($("#sprinklers")[0].style.minHeight, "");

			$("#sprinklers .info-card").first().hide().show();
			$(window).trigger("resize.sitemap");
			return settle();
		}).then(function () {
			pageFitsWindow();
		});
	});

	it("should refit the map when the content above it changes size", function () {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		return openHomeMap().then(function (root) {
			var card = $("#sprinklers .info-card").first(),
				before = root.find(".site-map-container").height(),
				cardHeight = card.outerHeight(true);

			// Like the weather loading into the card above the map after the map was first sized,
			// but in reverse: the room above shrinks, so the map can grow into it
			card.hide();
			return settle().then(function () {
				assert.isAbove(root.find(".site-map-container").height(), before + cardHeight / 2);
				pageFitsWindow();

				card.show();
				return settle();
			}).then(function () {
				assert.closeTo(root.find(".site-map-container").height(), before, 1);
				pageFitsWindow();
			});
		}).finally(function () {
			$("#sprinklers .info-card").first().show();
		});
	});

	it("should restore an existing run when adding points is cancelled", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: { 1: [{ type: "drip", pts: [[0.1, 0.6], [0.4, 0.6]] }] } });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tapMap(page, 0.25, 0.6);
			return chooseAction("Add").then(function () {
				tapMap(page, 0.6, 0.8);
				tapMap(page, 0.7, 0.8);
				page.find(".site-map-draw-cancel").trigger("click");
				assert.isFalse(page.hasClass("site-map-drawing-mode"));
				assert.lengthOf(page.find(".site-map-run-drip .site-map-handle"), 2);
				return storedMap();
			}).then(function (map) {
				assert.deepEqual(map.drawings, { 1: [{ type: "drip", pts: [[0.1, 0.6], [0.4, 0.6]] }] });
				page.find(".site-map-edit").trigger("click");
			});
		});
	});

	it("should discard a new run when drawing is cancelled", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 2: { x: 0.3, y: 0.6 } } });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tap(page.find(".site-map-pin"));
			return chooseAction("Add heads").then(function () {
				tapMap(page, 0.4, 0.6);
				tapMap(page, 0.5, 0.6);
				assert.lengthOf(page.find(".site-map-head"), 2);
				page.find(".site-map-draw-cancel").trigger("click");
				assert.lengthOf(page.find(".site-map-run"), 0);
				return storedMap();
			}).then(function (map) {
				assert.deepEqual(map.drawings, {});
				page.find(".site-map-edit").trigger("click");
			});
		});
	});

	it("should remove the last point of a run", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: { 1: [{ type: "drip", pts: [[0.1, 0.6], [0.4, 0.6], [0.4, 0.8]] }] } });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tapMap(page, 0.25, 0.6);
			return chooseAction("Undo point").then(function () {
				return doneEditing(page);
			}).then(function (map) {
				assert.deepEqual(map.drawings[1][0].pts, [[0.1, 0.6], [0.4, 0.6]]);

				// A drip line can't go below two points, so the action is no longer offered
				page.find(".site-map-edit").trigger("click");
				tapMap(page, 0.25, 0.6);
				return waitFor(function () {
					return $(".ui-popup-active .site-map-picker a").length > 0;
				});
			}).then(function () {
				var labels = $(".ui-popup-active .site-map-picker a").map(function () {
					return $(this).text();
				}).get();
				assert.notInclude(labels, "Undo point");
				return chooseAction("Add");
			}).then(function () {
				page.find(".site-map-draw-cancel").trigger("click");
				page.find(".site-map-edit").trigger("click");
			});
		});
	});

	function scaleOf(page) {
		var match = page.find(".site-map-image-el")[0].style.transform.match(/scale\(([\d.]+)\)/);
		return match ? Number(match[1]) : 1;
	}

	it("should stop a zoom animation when the map is dragged", function () {
		OSApp.SiteMap.Constants.zoomDuration = 300;
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		return openHomeMap().then(function (page) {
			var container = page.find(".site-map-container"),
				rect = container[0].getBoundingClientRect(),
				x = rect.left + rect.width / 2,
				y = rect.top + rect.height / 2;

			page.find(".site-map-zoom-in").trigger("click");
			return new Promise(function (resolve) {
				setTimeout(resolve, 60);
			}).then(function () {
				var midway = scaleOf(page);

				pointer(container, "pointerdown", x, y);
				pointer(container, "pointermove", x - 30, y - 20);
				pointer(container, "pointerup", x - 30, y - 20);
				return new Promise(function (resolve) {
					setTimeout(resolve, 400);
				}).then(function () {
					assert.isBelow(scaleOf(page), 2);
					assert.closeTo(scaleOf(page), midway, 0.15);
				});
			});
		}).finally(function () {
			OSApp.SiteMap.Constants.zoomDuration = 0;
		});
	});

	it("should zoom without animating when reduced motion is requested", function () {
		var matchMedia = sinon.stub(window, "matchMedia").callsFake(function (query) {
			return { matches: /prefers-reduced-motion/.test(query), media: query, addListener: function () {}, removeListener: function () {} };
		});

		OSApp.SiteMap.Constants.zoomDuration = 300;
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		return openHomeMap().then(function (page) {
			page.find(".site-map-zoom-in").trigger("click");
			assert.equal(scaleOf(page), 2);
		}).finally(function () {
			matchMedia.restore();
			OSApp.SiteMap.Constants.zoomDuration = 0;
		});
	});

	it("should let the map be dragged clear of the buttons on the right, even at normal zoom", function () {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });

		return openHomeMap().then(function (page) {
			// Put the valve right under the Edit button
			var map = imageRect(page),
				button = page.find(".site-map-edit")[0].getBoundingClientRect();

			OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: {
				x: ( button.left + button.width / 2 - map.left ) / map.width,
				y: ( button.top + button.height / 2 - map.top ) / map.height
			} } });
			return openHomeMap();
		}).then(function (page) {
			var container = page.find(".site-map-container"),
				controls = page.find(".site-map-controls"),
				rect = container[0].getBoundingClientRect(),
				image = page.find(".site-map-image-el")[0],
				pinCenter = function () {
					var r = page.find(".site-map-pin")[0].getBoundingClientRect();
					return [r.left + r.width / 2, r.top + r.height / 2];
				},
				hit = function () {
					return document.elementFromPoint.apply(document, pinCenter());
				},
				drag = function (dx) {
					var x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
					pointer(container, "pointerdown", x, y);
					pointer(container, "pointermove", x + dx / 2, y);
					pointer(container, "pointermove", x + dx, y);
					pointer(container, "pointerup", x + dx, y);
				},
				limit = controls.outerWidth() + 8;

			// The valve starts under the button column, where a tap would hit a button
			assert.isTrue($(hit()).closest(".site-map-controls").length > 0);

			drag(-60);
			return nextFrame().then(function () {
				assert.isTrue($(hit()).closest(".site-map-pin").length > 0);

				// Only as far as the button column is wide
				drag(-500);
				assert.include(image.style.transform, "translate(-" + limit + "px");
				drag(1000);
				assert.include(image.style.transform, "translate(0px");
			});
		});
	});

	it("should not open the side menu or notifications when swiping on the map", function () {
		var swipes = [],

			// Stands in for the app's page-level handler that opens the menu or notifications on a swipe
			pageSwipe = function (event) {
				swipes.push(event.type);
			};

		$.mobile.document.on("swiperight.sitemaptest swipeleft.sitemaptest", ".ui-page", pageSwipe);
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {} });
		return openHomeMap().then(function (page) {
			page.find(".site-map-container").trigger("swiperight").trigger("swipeleft");
			assert.deepEqual(swipes, []);

			// Swiping elsewhere on the home page still reaches it
			$("#sprinklers .info-card").trigger("swiperight");
			assert.deepEqual(swipes, ["swiperight"]);
		}).finally(function () {
			$.mobile.document.off(".sitemaptest");
		});
	});

	it("should allow dragging past the right edge only by the given amount", function () {
		assert.deepEqual(OSApp.SiteMap.clampView({ scale: 1, x: -100, y: 0 }, 400, 200, 8, 40), { scale: 1, x: -40, y: 0 });
		assert.deepEqual(OSApp.SiteMap.clampView({ scale: 1, x: 10, y: -5 }, 400, 200, 8, 40), { scale: 1, x: 0, y: 0 });
		assert.deepEqual(OSApp.SiteMap.clampView({ scale: 2, x: -500, y: 0 }, 400, 200, 8, 40), { scale: 2, x: -440, y: 0 });
	});

	it("should leave the zoom buttons off on touch screens", function () {
		var hidden = [].some.call(document.styleSheets, function (sheet) {
			var rules;
			try {
				rules = sheet.cssRules;
			} catch (error) {
				return false;
			}
			return [].some.call(rules || [], function (rule) {
				return rule.media && /pointer:\s*coarse/.test(rule.conditionText || rule.media.mediaText) &&
					[].some.call(rule.cssRules, function (inner) {
						return inner.selectorText === ".site-map-zoom" && inner.style.display === "none";
					});
			});
		});
		assert.isTrue(hidden);
	});

	it("should keep edits until Done and then save them", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.2, y: 0.5 } }, drawings: {} });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			assert.isTrue(page.find(".site-map-cancel").is(":visible"));
			tap(page.find(".site-map-pin"));
			return chooseAction("Add drip line").then(function () {
				tapMap(page, 0.3, 0.5);
				tapMap(page, 0.6, 0.5);
				page.find(".site-map-draw-done").trigger("click");
				return storedMap();
			}).then(function (map) {
				// Nothing is saved while still editing
				assert.deepEqual(map.drawings, {});
				return doneEditing(page);
			}).then(function (map) {
				assert.lengthOf(map.drawings[0], 1);
				assert.isFalse(page.find(".site-map-cancel").is(":visible"));
			});
		});
	});

	it("should put everything back when an edit is cancelled", function (done) {
		var original = {
			image: testImage,
			pins: { 0: { x: 0.2, y: 0.5 }, 1: { x: 0.7, y: 0.5 } },
			drawings: { 1: [{ type: "drip", pts: [[0.7, 0.5], [0.7, 0.8]] }] }
		};
		OSApp.SiteMap.save(siteName, original);

		showSiteMap(done, function (page) {
			var container = page.find(".site-map-container"),
				rect = container[0].getBoundingClientRect(),
				confirm = sinon.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, detail, yes) {
					yes();
				});

			page.find(".site-map-edit").trigger("click");

			// Move a point, remove a valve with its drawings, and add a head run
			pointer(page.find(".site-map-handle")[1], "pointerdown", rect.left + 0.7 * rect.width, rect.top + 0.8 * rect.height);
			pointer(container, "pointermove", rect.left + 0.9 * rect.width, rect.top + 0.9 * rect.height);
			pointer(container, "pointerup", rect.left + 0.9 * rect.width, rect.top + 0.9 * rect.height);
			tap(page.find(".site-map-pin[data-sids='1']"));
			return chooseAction("Delete").then(function () {
				confirm.restore();
				tap(page.find(".site-map-pin[data-sids='0']"));
				return chooseAction("Add heads");
			}).then(function () {
				tapMap(page, 0.3, 0.5);
				page.find(".site-map-draw-done").trigger("click");
				assert.lengthOf(page.find(".site-map-pin"), 1);

				page.find(".site-map-cancel").trigger("click");
				assert.isFalse(page.hasClass("site-map-editing"));

				// Back on screen as it was, and nothing was saved
				assert.lengthOf(page.find(".site-map-pin"), 2);
				assert.lengthOf(page.find(".site-map-run"), 1);
				assert.lengthOf(page.find(".site-map-run-heads"), 0);
				return storedMap();
			}).then(function (map) {
				assert.deepEqual(map.pins, original.pins);
				assert.deepEqual(map.drawings, original.drawings);
			}).finally(function () {
				confirm.restore();
			});
		});
	});

	it("should confirm a saved edit, but not a cancelled or empty one", function () {
		var message = sinon.stub(OSApp.Errors, "showError"),
			saved = function () {
				return message.getCalls().filter(function (call) {
					return call.args[0] === "Settings have been saved";
				}).length;
			};

		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.2, y: 0.5 } }, drawings: {} });
		return openHomeMap().then(function (page) {
			// Nothing changed
			page.find(".site-map-edit").trigger("click").trigger("click");
			assert.equal(saved(), 0);

			page.find(".site-map-edit").trigger("click");
			tap(page.find(".site-map-pin"));
			return chooseAction("Add heads").then(function () {
				tapMap(page, 0.4, 0.5);
				page.find(".site-map-draw-done").trigger("click");
				page.find(".site-map-cancel").trigger("click");
				assert.equal(saved(), 0);

				page.find(".site-map-edit").trigger("click");
				tap(page.find(".site-map-pin"));
				return chooseAction("Add heads");
			}).then(function () {
				tapMap(page, 0.4, 0.5);
				page.find(".site-map-draw-done").trigger("click");
				page.find(".site-map-edit").trigger("click");
				assert.equal(saved(), 1);
			});
		}).finally(function () {
			message.restore();
		});
	});

	it("should discard an edit when leaving the map without saving", function () {
		var original = { image: testImage, pins: { 0: { x: 0.2, y: 0.5 } }, drawings: {} };

		OSApp.SiteMap.save(siteName, original);
		return openHomeMap().then(function (page) {
			page.find(".site-map-edit").trigger("click");
			tap(page.find(".site-map-pin"));
			return chooseAction("Add drip line").then(function () {
				tapMap(page, 0.3, 0.5);
				tapMap(page, 0.6, 0.5);
				page.find(".site-map-draw-done").trigger("click");

				// Switching to the cards leaves the map
				OSApp.SiteMap.setHomeView("cards");
				assert.isFalse(page.hasClass("site-map-editing"));
				return storedMap();
			}).then(function (map) {
				assert.deepEqual(map.drawings, {});
				OSApp.SiteMap.setHomeView("map");
				assert.lengthOf(page.find(".site-map-run"), 0);
			});
		});
	});

	it("should mark save, cancel and clear clearly while editing", function () {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: {} });

		return openHomeMap().then(function (page) {
			var edit = page.find(".site-map-edit");

			assert.isTrue(edit.hasClass("ui-icon-edit") && !edit.hasClass("green"));
			edit.trigger("click");
			assert.isTrue(edit.hasClass("ui-icon-check") && edit.hasClass("green"));
			assert.equal(edit.attr("title"), "Done");
			assert.isTrue(page.find(".site-map-cancel").is(".ui-icon-delete.red"));
			assert.isTrue(page.find(".site-map-clear").hasClass("ui-icon-back"));
			assert.isFalse(page.find(".site-map-clear").hasClass("red"));
			page.find(".site-map-cancel").trigger("click");
			assert.isFalse(edit.hasClass("green"));
		});
	});

	it("should discard a drawing in progress when an edit is cancelled", function (done) {
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.2, y: 0.5 } }, drawings: {} });

		showSiteMap(done, function (page) {
			page.find(".site-map-edit").trigger("click");
			tap(page.find(".site-map-pin"));
			return chooseAction("Add heads").then(function () {
				tapMap(page, 0.3, 0.5);
				tapMap(page, 0.4, 0.5);
				page.find(".site-map-cancel").trigger("click");
				assert.isFalse(page.hasClass("site-map-drawing-mode"));
				assert.lengthOf(page.find(".site-map-run"), 0);
				return storedMap();
			}).then(function (map) {
				assert.deepEqual(map.drawings, {});
			});
		});
	});

	it("should keep a new image until Done and restore the old one on cancel", function (done) {
		var picture = sinon.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback("/9j/new");
			});

		OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: {} });
		showSiteMap(function (error) {
			picture.restore();
			done(error);
		}, function (page) {
			var img = page.find(".site-map-image-el");

			page.find(".site-map-edit").trigger("click");
			page.find(".site-map-image").trigger("click");
			assert.equal(img.attr("src"), "data:image/jpeg;base64,/9j/new");
			page.find(".site-map-cancel").trigger("click");
			assert.equal(img.attr("src"), testImage);
			return storedMap().then(function (map) {
				assert.equal(map.image, testImage);

				page.find(".site-map-edit").trigger("click");
				page.find(".site-map-image").trigger("click");
				return doneEditing(page);
			}).then(function (map) {
				assert.equal(map.image, "data:image/jpeg;base64,/9j/new");
			});
		});
	});

	// Station changes: valves are stored by station number, which is the controller's output terminal, so they
	// follow the station through renames and board changes the same way programs and the rest of the setup do

	// Changes the station list like adding or removing expansion boards does; added stations get the
	// status entries a controller reports for them
	function withStationNames(names, run) {
		var controller = OSApp.currentSession.controller,
			stations = controller.stations,
			original = { snames: stations.snames, ps: controller.settings.ps, status: controller.status };

		stations.snames = names;
		controller.settings.ps = names.map(function (name, sid) {
			return original.ps[sid] || [0, 0, 0];
		});
		controller.status = names.map(function (name, sid) {
			return original.status[sid] || 0;
		});
		return Promise.resolve().then(run).finally(function () {
			stations.snames = original.snames;
			controller.settings.ps = original.ps;
			controller.status = original.status;
			$("html").trigger("datarefresh");
		});
	}

	it("should keep a valve on its station and keep it working after the station is renamed", function () {
		var names = OSApp.currentSession.controller.stations.snames.slice(),
			duration = sinon.stub(OSApp.UIDom, "showDurationBox");

		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.3, y: 0.5 } }, drawings: { 0: [{ type: "drip", pts: [[0.3, 0.5], [0.6, 0.5]] }] } });
		return openHomeMap().then(function (page) {
			names[0] = "Renamed Front Lawn";
			return withStationNames(names, function () {
				$("html").trigger("datarefresh");
				var pin = page.find(".site-map-pin");

				assert.lengthOf(pin, 1);
				assert.equal(pin.attr("data-sids"), "0");
				assert.include(pin.attr("title"), "Renamed Front Lawn");
				assert.lengthOf(page.find(".site-map-run"), 1);

				// No warning or confirmation: tapping runs the renamed station
				tap(pin);
				assert.isTrue(duration.calledOnce);
				assert.include(duration.firstCall.args[0].title, "Renamed Front Lawn");
			});
		}).finally(function () {
			duration.restore();
		});
	});

	it("should hide valves for stations removed with an expansion board, and bring them back when it returns", function () {
		var all = OSApp.currentSession.controller.stations.snames.slice(),
			last = all.length - 1;

		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.2, y: 0.5 } },
			drawings: {}
		});
		var pins = { 0: { x: 0.2, y: 0.5 } }, drawings = {};
		pins[last] = { x: 0.7, y: 0.5 };
		drawings[last] = [{ type: "drip", pts: [[0.7, 0.5], [0.8, 0.6]] }];
		OSApp.SiteMap.save(siteName, { image: testImage, pins: pins, drawings: drawings });

		return openHomeMap().then(showWholeImage).then(function (page) {
			assert.lengthOf(page.find(".site-map-pin"), 2);

			// Fewer stations: the valve on the missing station is hidden, not deleted
			return withStationNames(all.slice(0, last), function () {
				$("html").trigger("datarefresh");
				assert.lengthOf(page.find(".site-map-pin"), 1);
				assert.lengthOf(page.find(".site-map-run"), 0);

				// Saving an edit while it's hidden keeps it
				page.find(".site-map-edit").trigger("click");
				tapMap(page, 0.4, 0.3);
				return chooseAction(OSApp.Stations.getName(1)).then(function () {
					return doneEditing(page);
				}).then(function (map) {
					assert.property(map.pins, String(last));
					assert.property(map.drawings, String(last));
				});
			}).then(function () {
				// The board is back
				assert.lengthOf(page.find(".site-map-pin"), 3);
				assert.lengthOf(page.find(".site-map-run"), 1);
			});
		});
	});

	it("should offer new stations from an added expansion board without changing existing valves", function () {
		var names = OSApp.currentSession.controller.stations.snames.concat(["New Board Zone 1", "New Board Zone 2"]);

		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.2, y: 0.5 } }, drawings: {} });
		return openHomeMap().then(function (page) {
			return withStationNames(names, function () {
				$("html").trigger("datarefresh");
				assert.equal(page.find(".site-map-pin").attr("data-sids"), "0");

				page.find(".site-map-edit").trigger("click");
				tapMap(page, 0.5, 0.5);
				return waitFor(function () {
					return $(".ui-popup-active .site-map-picker a").length > 0;
				}).then(function () {
					var listed = $(".ui-popup-active .site-map-picker a").map(function () {
						return $(this).text();
					}).get();
					assert.include(listed.join("|"), "New Board Zone 2");
					return chooseAction(listed.filter(function (label) {
						return label.indexOf("New Board Zone 2") === 0;
					})[0]);
				}).then(function () {
					return doneEditing(page);
				}).then(function (map) {
					assert.property(map.pins, String(names.length - 1));
					assert.deepEqual(map.pins[0], { x: 0.2, y: 0.5 });
				});
			});
		});
	});

	// Remaining time and special stations

	it("should show the time left on a running valve and count it down", function () {
		var state = sinon.stub(OSApp.SiteMap, "getPinState").callsFake(function (sid) {
				return sid === 0 ? "running" : "idle";
			});

		OSApp.uiState.timers["station-0"] = { val: 125, station: 0, update: function () {}, done: function () {} };
		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.2, y: 0.5 }, 1: { x: 0.7, y: 0.5 } }, drawings: {} });
		return openHomeMap().then(function (page) {
			var time = page.find(".site-map-pin[data-sids='0'] .site-map-pin-time");

			assert.equal(time.text(), "02:05");
			assert.include(page.find(".site-map-pin[data-sids='0']").attr("title"), "02:05");
			assert.lengthOf(page.find(".site-map-pin[data-sids='1'] .site-map-pin-time"), 0);

			OSApp.uiState.timers["station-0"].val = 64;
			return new Promise(function (resolve) {
				setTimeout(resolve, 1100);
			}).then(function () {
				assert.equal(time.text(), "01:04");
			});
		}).finally(function () {
			delete OSApp.uiState.timers["station-0"];
			state.restore();
		});
	});

	it("should mark master valves and special stations, on the map and in the list of stations", function () {
		var master = sinon.stub(OSApp.Stations, "isMaster").callsFake(function (sid) {
				return sid === 1 ? 1 : 0;
			}),
			badge = sinon.stub(OSApp.Stations, "getSpecialBadge").callsFake(function (sid) {
				return sid === 2 ? "BD" : "";
			});

		OSApp.SiteMap.save(siteName, { image: testImage, pins: { 0: { x: 0.2, y: 0.3 }, 1: { x: 0.5, y: 0.3 }, 2: { x: 0.8, y: 0.3 } }, drawings: {} });
		return openHomeMap().then(function (page) {
			assert.lengthOf(page.find(".site-map-pin[data-sids='0'] .site-map-pin-badge"), 0);
			assert.equal(page.find(".site-map-pin[data-sids='1'] .site-map-pin-badge").text(), "M");
			assert.isTrue(page.find(".site-map-pin[data-sids='1']").hasClass("site-map-pin-kind-master"));
			assert.equal(page.find(".site-map-pin[data-sids='2'] .site-map-pin-badge").text(), "BD");

			// The list for adding a valve shows the same markers
			OSApp.SiteMap.save(siteName, { image: testImage, pins: {}, drawings: {} });
			return openHomeMap();
		}).then(function (page) {
			page.find(".site-map-edit").trigger("click");
			tapMap(page, 0.5, 0.5);
			return waitFor(function () {
				return $(".ui-popup-active .site-map-picker a").length > 0;
			}).then(function () {
				var picker = $(".ui-popup-active .site-map-picker");
				assert.equal(picker.find("a[data-sid='1'] .site-map-picker-badge").text(), "M");
				assert.equal(picker.find("a[data-sid='2'] .site-map-picker-badge").text(), "BD");
				assert.lengthOf(picker.find("a[data-sid='0'] .site-map-picker-badge"), 0);
				picker.popup("close");
				page.find(".site-map-cancel").trigger("click");
			});
		}).finally(function () {
			master.restore();
			badge.restore();
		});
	});

	// Drawing performance

	it("should move what is drawn while panning, and redraw once the view settles", function () {
		OSApp.SiteMap.save(siteName, {
			image: testImage,
			pins: { 0: { x: 0.3, y: 0.5 } },
			drawings: { 0: [{ type: "drip", pts: [[0.3, 0.5], [0.6, 0.5]] }] }
		});

		return openHomeMap().then(function (page) {
			var container = page.find(".site-map-container"),
				rect = container[0].getBoundingClientRect(),
				pin = page.find(".site-map-pin")[0],
				left = parseFloat(pin.style.left),
				x = rect.left + rect.width / 2,
				y = rect.top + rect.height / 2;

			// Zoom in so the map can pan, then drag it
			page.find(".site-map-zoom-in").trigger("click");
			return new Promise(function (resolve) {
				setTimeout(resolve, OSApp.SiteMap.Constants.settleDelay + 100);
			}).then(nextFrame).then(function () {
				pin = page.find(".site-map-pin")[0];
				left = parseFloat(pin.style.left);
				pointer(container, "pointerdown", x, y);
				pointer(container, "pointermove", x - 30, y);
				pointer(container, "pointermove", x - 60, y);
				return nextFrame();
			}).then(function () {
				// The same elements were moved, not rebuilt, and the drawings shifted as a group
				assert.strictEqual(page.find(".site-map-pin")[0], pin);
				assert.closeTo(parseFloat(pin.style.left), left - 60, 1);
				assert.include(page.find(".site-map-drawings-root").attr("transform") || "", "translate(-60");

				pointer(container, "pointerup", x - 60, y);
				return new Promise(function (resolve) {
					setTimeout(resolve, OSApp.SiteMap.Constants.settleDelay + 100);
				}).then(nextFrame);
			}).then(function () {
				assert.notStrictEqual(page.find(".site-map-pin")[0], pin);
				assert.isNull(page.find(".site-map-drawings-root")[0].getAttribute("transform"));
			});
		});
	});

	it("should not list the site map in the menu", function () {
		assert.lengthOf($("#sprinklers-settings a[href='#site-map']"), 0);
	});

	it("should report pin state from station status", function () {
		var stub = sinon.stub(OSApp.Stations, "isDisabled").returns(true);
		try {
			assert.equal(OSApp.SiteMap.getPinState(0), "disabled");
		} finally {
			stub.restore();
		}
	});

	it("should show the site map with the keyboard shortcut", function () {
		OSApp.SiteMap.setHomeView("cards");
		OSApp.UIDom.handleKeydown($.Event("keydown", { keyCode: 65, altKey: true, target: document.body }));
		assert.equal(OSApp.SiteMap.getHomeView(), "map");
		assert.isTrue($("#sprinklers .site-map-view").is(":visible"));
	});
});

describe("Site Map Controller Storage", function () {
	var siteName, sandbox, remote, requests, previousOptions;

	function jpeg(color) {
		var canvas = document.createElement("canvas");
		canvas.width = 40;
		canvas.height = 30;
		var context = canvas.getContext("2d");
		context.fillStyle = color || "#3a7";
		context.fillRect(0, 0, 40, 30);
		return canvas.toDataURL("image/jpeg", 0.9);
	}

	function resolved(value) {
		return $.Deferred().resolve(value).promise();
	}

	function asNative(promise) {
		return new Promise(function (resolve, reject) {
			promise.then(resolve, reject);
		});
	}

	function query(dest) {
		return new URLSearchParams(dest.split("?")[1] || "");
	}

	// In-memory stand-in for the firmware endpoints
	function installController(initial) {
		remote = $.extend({ rev: 0, pins: {}, image: null, upload: "", drawings: "", drawingUpload: "" }, initial);
		remote.relay = $.extend({ req: 300, win: 900 }, remote.relay);
		resetRelay();
		requests = [];
		OSApp.currentSession.controller.options.smap = remote.rev;
		var handle = function (dest, type, options) {
			var path = dest.split("?")[0],
				params = query(dest);
			requests.push({ path: path, params: params, body: options && options.body });
			if (remote.fail && remote.fail[path]) {
				remote.fail[path]--;
				return $.Deferred().reject({ status: 0, statusText: "error" }).promise();
			}

			// A wrong password, which sendToOS rejects as 401
			if (remote.deny && remote.deny[path]) {
				return $.Deferred().reject({ status: 401 }).promise();
			}

			// A firmware result code, which sendToOS rejects with
			if (remote.reject && remote.reject[path]) {
				return $.Deferred().reject({ result: remote.reject[path] }).promise();
			}

			// The same, for the next request to path only
			if (remote.refuseNext && remote.refuseNext[path]) {
				var result = remote.refuseNext[path];
				delete remote.refuseNext[path];
				return $.Deferred().reject({ result: result }).promise();
			}
			var data = options && options.body !== undefined ? options.body : params.get("d");

			if (path === "/jm") {
				var jm = {
					rev: remote.rev,
					img: remote.image ? atob(remote.image.split(",")[1]).length : 0,
					drw: remote.drawings.length,
					pins: Object.keys(remote.pins).map(function (sid) {
						return [Number(sid), remote.pins[sid][0], remote.pins[sid][1]];
					})
				};

				// Newer firmware reports the image's fingerprint; OpenSprinkler v3/v4 leave the image to the apps
				// ("loc") and only store its fingerprint and size
				if (remote.fp !== undefined) {
					jm.fp = remote.fp;
				}
				if (remote.deviceImage) {
					jm.loc = 1;
					jm.fp = remote.fp || "";
					jm.img = remote.imageSize || 0;
				}
				return resolved(jm);
			}
			if (remote.deviceImage ? path === "/um" || path === "/jmi" : /^\/(cmi|mx.)$/.test(path)) {
				return $.Deferred().reject({ status: 404 }).promise();
			}
			if (path === "/cmi") {
				remote.fp = params.get("fp");
				remote.imageSize = Number(params.get("sz"));
				remote.rev++;
				resetRelay();
				return resolved({ result: 1 });
			}
			if (/^\/mx.$/.test(path)) {
				return relayRequest(path, params, data);
			}
			if (path === "/jmi") {
				var bytes = Uint8Array.from(atob(remote.image.split(",")[1]), function (c) {
					return c.charCodeAt(0);
				});
				return resolved(new Blob([bytes], { type: "image/jpeg" }));
			}
			if (path === "/cmp") {
				var text = ( options && options.body ) || params.get("p") || "";
				remote.pins = {};
				text.split(";").filter(Boolean).forEach(function (pin) {
					var parts = pin.split(",").map(Number);
					remote.pins[parts[0]] = [parts[1], parts[2]];
				});
				remote.rev++;
				return resolved({ result: 1 });
			}
			if (path === "/um") {
				if (Number(params.get("off")) === 0) remote.upload = "";
				remote.upload += data;
				if (atob(remote.upload).length === Number(params.get("tot"))) {
					remote.image = "data:image/jpeg;base64," + remote.upload;
					remote.rev++;
				}
				return resolved({ result: 1 });
			}
			if (path === "/umd") {
				if (Number(params.get("tot")) === 0) {
					remote.drawings = "";
					remote.rev++;
					return resolved({ result: 1 });
				}
				if (Number(params.get("off")) === 0) remote.drawingUpload = "";
				remote.drawingUpload += data;
				if (remote.drawingUpload.length === Number(params.get("tot"))) {
					remote.drawings = remote.drawingUpload;
					remote.rev++;
				}
				return resolved({ result: 1 });
			}
			if (path === "/jmd") {
				return resolved(remote.drawings);
			}
			if (path === "/dm") {
				remote.pins = {};
				remote.image = null;
				if (remote.deviceImage) {
					remote.fp = "";
					remote.imageSize = 0;
				}
				resetRelay();
				remote.drawings = "";
				remote.rev++;
				return resolved({ result: 1 });
			}
			return $.Deferred().reject({ status: 404 }).promise();
		};

		// remote.after( path ) runs once each request is handled; remote.holdNext holds back the reply to the next
		// request for that path until remote.release() is called, as a slow controller would
		sandbox.stub(OSApp.Firmware, "sendToOS").callsFake(function (dest, type, options) {
			var current = remote,
				path = dest.split("?")[0],
				held, result;

			if (current.holdNext === path) {
				current.holdNext = null;
				held = $.Deferred();
				current.release = function () {
					handle(dest, type, options).then(held.resolve, held.reject);
				};
				return held.promise();
			}
			result = handle(dest, type, options);
			if (current.after) {
				current.after(path);
			}

			// remote.loseReply[path] counts requests carried out whose reply is lost (the relay's are counted there)
			if (!/^\/mx.$/.test(path) && current.loseReply && current.loseReply[path]) {
				current.loseReply[path]--;
				return $.Deferred().reject({ status: 0, statusText: "timeout" }).promise();
			}
			return result;
		});
	}

	// The firmware's image relay, simplified: one window at a time, req and win from remote.relay. Another app
	// sending (relay.autoSend: the bytes it has) or receiving (relay.autoReceive: the bytes it got so far) can be
	// played by the stub itself, so a test only drives this app's side.
	function resetRelay() {
		var relay = remote.relay;
		relay.state = 0;
		relay.sender = null;
		relay.receivers = [];
		relay.offset = 0;
		relay.window = [];
	}

	// remote.loseReply[path] counts requests that the controller carries out but whose reply is lost
	function relayRequest(path, params, data) {
		var reply = relayHandle(path, params, data);
		if (remote.loseReply && remote.loseReply[path]) {
			remote.loseReply[path]--;
			return $.Deferred().reject({ status: 0, statusText: "timeout" }).promise();
		}
		return reply;
	}

	function relayHandle(path, params, data) {
		var relay = remote.relay,
			client = params.get("cid"),
			total = remote.imageSize,
			reject = function (code) {
				return $.Deferred().reject({ result: code }).promise();
			},
			settle = function () {
				if (!relay.receivers.length) {
					relay.sender = null;
					relay.offset = 0;
					relay.window = [];
					relay.state = 0;
				} else if (!relay.sender) {
					// A finished batch stays for the receiver after its sender leaves
					if (relay.state !== 3) {
						relay.state = 1;
					}
				} else if (relay.state < 2) {
					relay.state = 2;
				}
			},
			status = function (extra) {
				return $.extend({ result: 1, st: relay.state, off: relay.offset, len: relay.window.length, tot: total }, extra);
			},
			append = function (bytes) {
				Array.prototype.push.apply(relay.window, Array.from(bytes));
				if (relay.window.length === relay.win || relay.offset + relay.window.length === total) {
					relay.state = 3;
				}
			},
			confirm = function () {
				relay.offset += relay.window.length;
				relay.window = [];
				if (relay.offset >= total) {
					relay.receivers.shift();
					relay.offset = 0;
					relay.state = relay.sender ? 2 : 1;
				} else {
					relay.state = 2;
				}
				settle();
			};

		if ((path === "/mxr" || path === "/mxs") && params.get("fp") !== remote.fp) {
			return reject(0x03);
		}
		if (path === "/mxr") {
			if (relay.receivers.indexOf(client) < 0) {
				if (relay.receivers.length >= 4) {
					return reject(0x11);
				}
				relay.receivers.push(client);
				settle();
			}

			// Another app with the image sends the next window when it's this receiver's turn
			if (relay.autoSend && relay.receivers[0] === client && relay.state < 3) {
				relay.sender = relay.sender || "auto";
				append(relay.autoSend.slice(relay.offset, Math.min(relay.offset + relay.win, total)));
			}
			return resolved(status({ pos: relay.receivers.indexOf(client) }));
		}
		if (path === "/mxs") {
			if (relay.sender && relay.sender !== client) {
				return reject(0x30);
			}
			if (!relay.receivers.length) {
				return reject(0x10);
			}
			relay.sender = client;
			settle();

			// Another app waiting for the image takes each window as soon as it's ready
			if (relay.autoReceive && relay.state === 3) {
				Array.prototype.push.apply(relay.autoReceive, relay.window);
				confirm();
				if (!relay.receivers.length) {
					return reject(0x10);
				}
			}
			return resolved(status({ win: relay.win, req: relay.req }));
		}
		if (path === "/mxu") {
			var bytes = Uint8Array.from(atob(data), function (c) {
				return c.charCodeAt(0);
			});
			if (client !== relay.sender) {
				return reject(0x30);
			}
			if (relay.state !== 2 || Number(params.get("off")) !== relay.offset + relay.window.length ||
				bytes.length > relay.req || relay.window.length + bytes.length > relay.win) {
				return reject(0x11);
			}
			append(bytes);
			return resolved({ result: 1 });
		}
		if (path === "/mxd") {
			if (relay.receivers[0] !== client) {
				return reject(0x30);
			}
			if (relay.state !== 3) {
				return reject(0x11);
			}
			var batch = { data: new Uint8Array(relay.window).buffer, headers: { get: function () {
					return "application/octet-stream";
				} } },
				later = $.Deferred();

			// Downloads take a while, as over a real network, when the test asks for it
			if (!relay.delay) {
				return resolved(batch);
			}
			setTimeout(function () {
				later.resolve(batch);
			}, relay.delay);
			return later.promise();
		}
		if (path === "/mxa") {
			if (relay.receivers[0] !== client || relay.state !== 3 ||
				Number(params.get("off")) !== relay.offset + relay.window.length) {
				return reject(0x11);
			}
			confirm();
			return resolved({ result: 1 });
		}
		if (path === "/mxc") {
			if (relay.sender === client) {
				relay.sender = null;
				if (relay.state !== 3) {
					relay.window = [];
				}
			}
			var index = relay.receivers.indexOf(client);
			if (index >= 0) {
				relay.receivers.splice(index, 1);
				if (index === 0) {
					relay.offset = 0;
					relay.window = [];
				}
			}
			settle();
			return resolved({ result: 1 });
		}
	}

	function requestsTo(path) {
		return requests.filter(function (request) {
			return request.path === path;
		});
	}

	function loadMap() {
		return new Promise(function (resolve) {
			OSApp.SiteMap.loadMap(siteName, function (map, source) {
				resolve({ map: map, source: source });
			});
		});
	}

	before(function (done) {
		OSApp.Storage.get("current_site", function (data) {
			siteName = data.current_site || "default";
			done();
		});
	});

	beforeEach(function () {
		sandbox = sinon.createSandbox();
		sandbox.stub(OSApp.Errors, "showError");
		previousOptions = OSApp.currentSession.controller.options;
		OSApp.currentSession.controller.options = $.extend({}, previousOptions);
		OSApp.Storage.remove(OSApp.SiteMap.getStorageKey(siteName));
	});

	afterEach(function () {
		sandbox.restore();
		OSApp.currentSession.controller.options = previousOptions;
		OSApp.Storage.remove(OSApp.SiteMap.getStorageKey(siteName));
	});

	it("should encode pins as station, x and y from 0 to 10000", function () {
		var encoded = OSApp.SiteMap.encodePins({ 3: { x: 0.25, y: 1.2 }, 0: { x: 0, y: 0.33333 } });

		assert.equal(encoded, "0,0,3333;3,2500,10000");
		assert.deepEqual(OSApp.SiteMap.decodePins([[0, 0, 3333], [3, 2500, 10000]]),
			{ 0: { x: 0, y: 0.3333 }, 3: { x: 0.25, y: 1 } });
		assert.equal(OSApp.SiteMap.encodePins({}), "");
	});

	it("should split an image into base64 chunks that decode on their own", function () {
		var image = jpeg(),
			base64 = image.split(",")[1],
			upload = OSApp.SiteMap.getImageChunks(image, 400),
			decoded = "";

		assert.equal(upload.total, atob(base64).length);
		upload.chunks.forEach(function (chunk) {
			assert.equal(chunk.offset, decoded.length);
			assert.isAtMost(chunk.body.length, 400);
			decoded += atob(chunk.body);
		});
		assert.equal(decoded, atob(base64));
		assert.equal(OSApp.SiteMap.Constants.uploadChunkChars % 4, 0);
	});

	it("should detect support from the smap option", function () {
		delete OSApp.currentSession.controller.options.smap;
		assert.isFalse(OSApp.SiteMap.isControllerSupported());
		OSApp.currentSession.controller.options.smap = 0;
		assert.isTrue(OSApp.SiteMap.isControllerSupported());
	});

	it("should leave out fingerprints and the relay with a controller from before them", function () {
		var image = jpeg();
		installController({ rev: 2, pins: { 0: [5000, 5000] }, image: image });
		OSApp.SiteMap.save(siteName, { image: image, pins: {}, rev: 2 });
		$("html").trigger("datarefresh");

		return loadMap().then(function (result) {
			assert.equal(result.source, "controller");
			assert.equal(result.map.image, image);
			assert.isUndefined(result.map.deviceImage);
			assert.isUndefined(result.map.missingImage);
			return wait(50);
		}).then(function () {
			assert.lengthOf(requests.filter(function (request) {
				return /^\/(mx|cmi)/.test(request.path);
			}), 0);
			assert.isNotOk(OSApp.SiteMap.Relay.sending);
		});
	});

	it("should use device storage when the controller can't store the map", function () {
		var stub = sandbox.stub(OSApp.Firmware, "sendToOS");
		delete OSApp.currentSession.controller.options.smap;
		OSApp.SiteMap.save(siteName, { pins: { 1: { x: 0.5, y: 0.5 } } });

		return loadMap().then(function (result) {
			assert.equal(result.source, "local");
			assert.deepEqual(result.map.pins, { 1: { x: 0.5, y: 0.5 } });
			assert.isFalse(stub.called);
		});
	});

	it("should fall back to device storage when the controller lacks the endpoints", function () {
		sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().reject({ status: 404 }).promise());
		OSApp.currentSession.controller.options.smap = 0;
		OSApp.SiteMap.save(siteName, { pins: { 2: { x: 0.1, y: 0.2 } } });

		return loadMap().then(function (result) {
			assert.equal(result.source, "local");
			assert.deepEqual(result.map.pins, { 2: { x: 0.1, y: 0.2 } });
		});
	});

	it("should move a map saved on this device to the controller once", function () {
		var image = jpeg();
		installController();
		OSApp.SiteMap.save(siteName, { image: image, pins: { 0: { x: 0.5, y: 0.25 } } });

		return loadMap().then(function (first) {
			assert.equal(first.source, "controller");
			assert.equal(remote.image, image);
			assert.deepEqual(remote.pins, { 0: [5000, 2500] });
			assert.isAbove(requestsTo("/um").length, 0);
			assert.equal(first.map.rev, remote.rev);
			assert.isTrue(OSApp.Errors.showError.calledWith("Settings have been saved"));

			requests = [];
			return loadMap();
		}).then(function (second) {
			assert.lengthOf(requestsTo("/um"), 0);
			assert.lengthOf(requestsTo("/cmp"), 0);
			assert.equal(second.map.image, image);
		});
	});

	it("should not overwrite a map already on the controller", function () {
		var image = jpeg("#c33");
		installController({ rev: 4, pins: { 1: [100, 200] }, image: image });
		OSApp.SiteMap.save(siteName, { pins: { 0: { x: 0.5, y: 0.5 } } });

		return loadMap().then(function (result) {
			assert.lengthOf(requestsTo("/cmp"), 0);
			assert.deepEqual(result.map.pins, { 1: { x: 0.01, y: 0.02 } });
			assert.equal(result.map.image, image);
		});
	});

	it("should only download the image when the controller's map has changed", function () {
		installController({ rev: 2, pins: {}, image: jpeg() });

		return loadMap().then(function () {
			assert.lengthOf(requestsTo("/jmi"), 1);
			requests = [];
			return loadMap();
		}).then(function () {
			assert.lengthOf(requestsTo("/jmi"), 0);
			remote.rev++;
			return loadMap();
		}).then(function () {
			assert.lengthOf(requestsTo("/jmi"), 1);
		});
	});

	it("should clear all pins with an empty p parameter", function () {
		installController({ rev: 1, pins: { 1: [1, 1] } });

		return asNative(OSApp.SiteMap.uploadPins({})).then(function () {
			var request = requestsTo("/cmp")[0];
			assert.equal(request.params.get("p"), "");
			assert.equal(request.body, "");
			assert.deepEqual(remote.pins, {});
		});
	});

	it("should restore a backup to the controller without pins for missing stations", function () {
		var image = jpeg();
		installController({ rev: 3 });

		return new Promise(function (resolve) {
			OSApp.SiteMap.restoreBackupData({ image: image, pins: { 0: { x: 0.5, y: 0.5 }, 999: { x: 0.1, y: 0.1 } } }, resolve);
		}).then(function () {
			assert.equal(remote.image, image);
			assert.deepEqual(remote.pins, { 0: [5000, 5000] });
		});
	});

	it("should restore a backup to this device when the controller can't store the map", function () {
		delete OSApp.currentSession.controller.options.smap;

		return new Promise(function (resolve) {
			OSApp.SiteMap.restoreBackupData({ pins: { 0: { x: 0.5, y: 0.5 } }, image: "javascript:alert(1)" }, resolve);
		}).then(function () {
			return new Promise(function (resolve) {
				OSApp.SiteMap.load(siteName, resolve);
			});
		}).then(function (map) {
			assert.deepEqual(map.pins, { 0: { x: 0.5, y: 0.5 } });
			assert.isUndefined(map.image);
		});
	});

	it("should leave the map alone when a backup has none", function () {
		var stub = sandbox.stub(OSApp.Firmware, "sendToOS");
		OSApp.SiteMap.save(siteName, { pins: { 0: { x: 0.5, y: 0.5 } } });

		return new Promise(function (resolve) {
			OSApp.SiteMap.restoreBackupData(undefined, resolve);
		}).then(function () {
			assert.isFalse(stub.called);
			return new Promise(function (resolve) {
				OSApp.SiteMap.load(siteName, resolve);
			});
		}).then(function (map) {
			assert.deepEqual(map.pins, { 0: { x: 0.5, y: 0.5 } });
		});
	});

	it("should include this device's copy in a backup when the controller can't be reached", function () {
		sandbox.stub(OSApp.Firmware, "sendToOS").returns($.Deferred().reject({ status: 0 }).promise());
		OSApp.currentSession.controller.options.smap = 2;
		OSApp.SiteMap.save(siteName, { pins: { 0: { x: 0.5, y: 0.5 } }, rev: 2 });

		return new Promise(function (resolve) {
			OSApp.SiteMap.getBackupData(resolve);
		}).then(function (siteMap) {
			assert.deepEqual(siteMap, { pins: { 0: { x: 0.5, y: 0.5 } }, drawings: {}, image: undefined });
		});
	});

	it("should download drawings again when they were cached by an app that didn't know branches", function () {
		installController({ rev: 7, pins: {}, drawings: "d,0,1000,5000,9000,5000\nD,0,5000,5000,5000,9000\n" });

		// What an older app saved for the same revision: it skipped the branch line it didn't understand
		OSApp.SiteMap.save(siteName, { pins: {}, drawings: { 0: [{ type: "drip", pts: [[0.1, 0.5], [0.9, 0.5]] }] }, rev: 7 });

		return loadMap().then(function (loaded) {
			assert.lengthOf(requestsTo("/jmd"), 1);
			assert.lengthOf(loaded.map.drawings[0], 2);
			assert.isTrue(loaded.map.drawings[0][1].branch);

			// Cached by this app, the same revision is reused again
			requests = [];
			return loadMap();
		}).then(function (loaded) {
			assert.lengthOf(requestsTo("/jmd"), 0);
			assert.lengthOf(loaded.map.drawings[0], 2);
		});
	});

	it("should upload drawings in chunks and reuse them while the map is unchanged", function () {
		var drawings = { 0: [] };
		for (var index = 0; index < 400; index++) {
			drawings[0].push({ type: "drip", pts: [[index / 400, 0.5], [index / 400, 0.6]] });
		}
		installController();

		return asNative(OSApp.SiteMap.uploadDrawings(drawings)).then(function () {
			assert.isAbove(requestsTo("/umd").length, 1);
			requestsTo("/umd").forEach(function (request) {
				assert.isAtMost(request.body.length, OSApp.SiteMap.Constants.uploadChunkChars);
			});
			assert.equal(remote.drawings, OSApp.SiteMap.encodeDrawings(drawings));
			return loadMap();
		}).then(function (first) {
			assert.lengthOf(first.map.drawings[0], 400);
			requests = [];
			return loadMap();
		}).then(function (second) {
			assert.lengthOf(requestsTo("/jmd"), 0);
			assert.lengthOf(second.map.drawings[0], 400);
		});
	});

	// OpenThings Cloud doesn't pass on POST requests that have a body, so through it the data goes in the URL
	it("should send map uploads in the URL when connected through OpenThings Cloud", function () {
		var image = jpeg(),
			pins = { 0: { x: 0.25, y: 0.5 }, 2: { x: 0.75, y: 0.5 } },
			drawings = { 0: [] },
			token = OSApp.currentSession.token,
			uploads = function () {
				return requests.filter(function (request) {
					return ["/cmp", "/um", "/umd"].indexOf(request.path) !== -1;
				});
			};

		for (var index = 0; index < 300; index++) {
			drawings[0].push({ type: "drip", pts: [[index / 300, 0.5], [index / 300, 0.6]] });
		}
		OSApp.currentSession.token = "OT0123456789abcdef0123456789abcd";
		installController();

		return asNative(OSApp.SiteMap.uploadPins(pins)).then(function () {
			return asNative(OSApp.SiteMap.uploadDrawings(drawings));
		}).then(function () {
			return asNative(OSApp.SiteMap.uploadImage(image));
		}).then(function () {
			return asNative(OSApp.SiteMap.uploadPins({}));
		}).then(function () {
			assert.isAbove(requestsTo("/umd").length, 1);
			uploads().forEach(function (request) {
				assert.isUndefined(request.body, request.path + " has no body");
				assert.isTrue(request.params.has(request.path === "/cmp" ? "p" : "d"), request.path + " carries its data in the URL");
			});
			assert.equal(remote.drawings, OSApp.SiteMap.encodeDrawings(drawings));
			assert.equal(remote.image, "data:image/jpeg;base64," + image.split(",")[1]);
			assert.deepEqual(remote.pins, {});
			assert.equal(requestsTo("/cmp")[0].params.get("p"), OSApp.SiteMap.encodePins(pins));
		}).finally(function () {
			OSApp.currentSession.token = token;
		});
	});

	it("should keep sending map uploads as request bodies on a direct connection", function () {
		var token = OSApp.currentSession.token;

		OSApp.currentSession.token = "";
		installController();
		return asNative(OSApp.SiteMap.uploadPins({ 0: { x: 0.5, y: 0.5 } })).then(function () {
			return asNative(OSApp.SiteMap.uploadDrawings({ 0: [{ type: "heads", pts: [[0.5, 0.5]] }] }));
		}).then(function () {
			assert.equal(requestsTo("/cmp")[0].body, "0,5000,5000");
			assert.equal(requestsTo("/umd")[0].body, "h,0,5000,5000\n");
			assert.isFalse(requestsTo("/umd")[0].params.has("d"));
		}).finally(function () {
			OSApp.currentSession.token = token;
		});
	});

	it("should clear drawings on the controller with tot=0", function () {
		installController({ rev: 2, drawings: "d,0,1,1,2,2\n" });

		return asNative(OSApp.SiteMap.uploadDrawings({})).then(function () {
			assert.equal(requestsTo("/umd")[0].params.get("tot"), "0");
			assert.equal(remote.drawings, "");
		});
	});

	it("should move drawings saved on this device to the controller", function () {
		installController();
		OSApp.SiteMap.save(siteName, { pins: { 0: { x: 0.5, y: 0.5 } }, drawings: { 0: [{ type: "heads", pts: [[0.5, 0.5], [0.6, 0.5]] }] } });

		return loadMap().then(function () {
			assert.equal(remote.drawings, "h,0,5000,5000,6000,5000\n");
		});
	});

	it("should upload drawing edits to the controller", function (done) {
		this.timeout(6000);
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });

		openHomeMap().then(function () {
			setTimeout(function () {
				var page = $("#sprinklers .site-map-view"),
					container = page.find(".site-map-container"),
					rect = container[0].getBoundingClientRect(),
					tapAt = function (x, y) {
						var e = { bubbles: true, cancelable: true, clientX: rect.left + x * rect.width, clientY: rect.top + y * rect.height, pointerId: 1, pointerType: "mouse", button: 0 };
						container[0].dispatchEvent(new PointerEvent("pointerdown", e));
						container[0].dispatchEvent(new PointerEvent("pointerup", e));
					};

				try {
					page.find(".site-map-edit").trigger("click");
					page.find(".site-map-pin")[0].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "mouse", button: 0 }));
					page.find(".site-map-pin")[0].dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "mouse", button: 0 }));
				} catch (error) {
					done(error);
					return;
				}
				setTimeout(function () {
					$(".ui-popup-active .site-map-picker a").filter(function () {
						return $(this).text() === "Add drip line";
					}).trigger("click");
					setTimeout(function () {
						try {
							tapAt(0.5, 0.5);
							tapAt(0.8, 0.5);
							page.find(".site-map-draw-done").trigger("click");
							page.find(".site-map-edit").trigger("click");
						} catch (error) {
							done(error);
							return;
						}
						setTimeout(function () {
							try {
								assert.equal(remote.drawings, "d,0,5000,5000,8000,5000\n");
								OSApp.SiteMap.setHomeView("cards");
								done();
							} catch (error) {
								done(error);
							}
						}, OSApp.SiteMap.Constants.pinSaveDelay + 300);
					}, 600);
				}, 600);
			}, 300);
		});
	});

	// Deletes the valve for sid in edit mode and saves, on the map shown on the home page
	function deleteValve(sid) {
		var page = $("#sprinklers .site-map-view"),
			wait = function (check) {
				return new Promise(function (resolve, reject) {
					var started = Date.now();
					(function poll() {
						if (check()) {
							resolve();
						} else if (Date.now() - started > 3000) {
							reject(new Error("timed out"));
						} else {
							setTimeout(poll, 20);
						}
					})();
				});
			},
			pin = function () {
				return page.find(".site-map-pin[data-sids='" + sid + "']")[0];
			};

		sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, detail, yes) {
			yes();
		});
		return wait(pin).then(function () {
			page.find(".site-map-edit").trigger("click");
			["pointerdown", "pointerup"].forEach(function (type) {
				pin().dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: "mouse", button: 0 }));
			});
			return wait(function () {
				return $(".ui-popup-active .site-map-picker a").length;
			});
		}).then(function () {
			$(".ui-popup-active .site-map-picker a").filter(function () {
				return $(this).text() === OSApp.Language._("Delete");
			}).trigger("click");
			return wait(function () {
				return !$(".ui-popup-active").length;
			});
		}).then(function () {
			page.find(".site-map-edit").trigger("click");
			return new Promise(function (resolve) {
				setTimeout(resolve, OSApp.SiteMap.Constants.pinSaveDelay + 300);
			});
		});
	}

	it("should delete a valve's heads from the controller with it, so they don't come back on reload", function () {
		this.timeout(8000);
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg(), drawings: "h,0,5000,5000,6000,5000\n" });

		return openHomeMap().then(function () {
			return deleteValve(0);
		}).then(function () {
			assert.deepEqual(remote.pins, {});
			assert.equal(remote.drawings, "");
			return loadMap();
		}).then(function (loaded) {
			assert.deepEqual(loaded.map.pins, {});
			assert.deepEqual(loaded.map.drawings, {});
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should queue drawing uploads with the other changes", function () {
		assert.isTrue(OSApp.Firmware.isChangeRequest("/umd?pw=x&off=0&tot=0"));
		assert.isTrue(OSApp.Firmware.isChangeRequest("/um?pw=x&off=0&tot=10"));
	});

	it("should retry a failed upload, and not reload the old map from the controller meanwhile", function () {
		this.timeout(10000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay;

		OSApp.SiteMap.Constants.retryDelay = 2000;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg(), drawings: "h,0,5000,5000,6000,5000\n" });
		remote.fail = { "/umd": 1 };

		return openHomeMap().then(function () {
			return deleteValve(0);
		}).then(function () {
			// The pins were saved but the drawings weren't, and the user is told
			assert.deepEqual(remote.pins, {});
			assert.equal(remote.drawings, "h,0,5000,5000,6000,5000\n");
			assert.isTrue(OSApp.Errors.showError.calledWith(OSApp.Language._("Network Error")));
			assert.isFalse(OSApp.Errors.showError.calledWith(OSApp.Language._("Settings have been saved")));

			// A status refresh sees the controller's newer revision, but the map keeps the unsaved deletion
			OSApp.currentSession.controller.options.smap = remote.rev;
			$("html").trigger("datarefresh");
			return new Promise(function (resolve) {
				setTimeout(resolve, 100);
			});
		}).then(function () {
			assert.lengthOf($("#sprinklers .site-map-run"), 0);
			return new Promise(function (resolve) {
				setTimeout(resolve, 2000);
			});
		}).then(function () {
			// The retry went through, and says so
			assert.equal(remote.drawings, "");
			assert.isTrue(OSApp.Errors.showError.calledWith(OSApp.Language._("Settings have been saved")));
			return loadMap();
		}).then(function (loaded) {
			assert.deepEqual(loaded.map.drawings, {});
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should keep the other valves' drawings when deleting one valve", function () {
		this.timeout(8000);
		installController({
			rev: 1,
			pins: { 0: [5000, 5000], 1: [2000, 2000] },
			image: jpeg(),
			drawings: "h,0,5000,5000,6000,5000\nd,1,1000,1000,2000,2000\n"
		});

		return openHomeMap().then(function () {
			return deleteValve(0);
		}).then(function () {
			assert.deepEqual(Object.keys(remote.pins), ["1"]);
			assert.equal(remote.drawings, "d,1,1000,1000,2000,2000\n");
			return loadMap();
		}).then(function (loaded) {
			assert.deepEqual(Object.keys(loaded.map.drawings), ["1"]);
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should upload nothing until Done, and nothing at all if the edit is cancelled", function () {
		this.timeout(6000);
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });

		return openHomeMap().then(function (page) {
			var container = page.find(".site-map-container"),
				rect = container[0].getBoundingClientRect(),
				pointer = function (element, type, x, y) {
					element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0 }));
				},
				drag = function (toX) {
					var handle = page.find(".site-map-pin")[0], r = handle.getBoundingClientRect();
					pointer(handle, "pointerdown", r.left + r.width / 2, r.top + r.height / 2);
					pointer(handle, "pointermove", rect.left + toX * rect.width, rect.top + rect.height / 2);
					pointer(handle, "pointerup", rect.left + toX * rect.width, rect.top + rect.height / 2);
				},
				wait = function (ms) {
					return new Promise(function (resolve) {
						setTimeout(resolve, ms);
					});
				};

			requests = [];
			page.find(".site-map-edit").trigger("click");
			drag(0.2);
			return wait(OSApp.SiteMap.Constants.pinSaveDelay + 200).then(function () {
				assert.lengthOf(requestsTo("/cmp"), 0);
				page.find(".site-map-cancel").trigger("click");
				return wait(OSApp.SiteMap.Constants.pinSaveDelay + 200);
			}).then(function () {
				assert.lengthOf(requestsTo("/cmp"), 0);
				assert.deepEqual(remote.pins, { 0: [5000, 5000] });

				page.find(".site-map-edit").trigger("click");
				drag(0.2);
				page.find(".site-map-edit").trigger("click");
				return wait(300);
			}).then(function () {
				assert.lengthOf(requestsTo("/cmp"), 1);
				assert.isBelow(remote.pins[0][0], 3000);

				// Confirmed once the controller has it
				assert.isTrue(OSApp.Errors.showError.calledWith("Settings have been saved"));
			});
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	// Saving checks whether another device saved the map since editing started

	function editAndSave(page, sendBeforeSave) {
		var rect = page.find(".site-map-container")[0].getBoundingClientRect(),
			event = function (element, type, x, y) {
				element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0 }));
			},
			handle, r;

		// Entering edit mode redraws the valves, so find the valve after that
		page.find(".site-map-edit").trigger("click");
		handle = page.find(".site-map-pin")[0];
		r = handle.getBoundingClientRect();
		event(handle, "pointerdown", r.left + r.width / 2, r.top + r.height / 2);
		event(handle, "pointermove", rect.left + 0.2 * rect.width, rect.top + rect.height / 2);
		event(handle, "pointerup", rect.left + 0.2 * rect.width, rect.top + rect.height / 2);
		if (sendBeforeSave) {
			sendBeforeSave();
		}
		page.find(".site-map-edit").trigger("click");
		return new Promise(function (resolve) {
			setTimeout(resolve, 300);
		});
	}

	it("should check for changes from other devices before sending an image picked meanwhile", function () {
		this.timeout(6000);
		var picked,
			confirm = sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (text, subtext, yes, no) {
				// Keep the other device's changes
				no();
			});

		sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
			picked = callback;
		});
		installController({ rev: 0 });
		OSApp.SiteMap.save(siteName, { pins: {}, drawings: {}, rev: 0 });
		return openHomeMap().then(function (page) {
			page.find(".site-map-add-image").trigger("click");

			// Another device saves while the picker is open
			remote.rev++;
			remote.drawings = "x";
			picked(jpeg("#d93").split(",")[1]);
			return wait(300);
		}).then(function () {
			assert.isTrue(confirm.called);
			assert.lengthOf(requestsTo("/um"), 0);
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should not mistake adding the first image for a change on another device", function () {
		var confirm = sandbox.stub(OSApp.UIDom, "areYouSure"),
			picture = sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(jpeg().split(",")[1]);
			});

		// A controller with no map yet: adding an image uploads it, then goes straight into editing
		installController({ rev: 0 });
		OSApp.SiteMap.save(siteName, { pins: {}, drawings: {}, rev: 0 });
		return openHomeMap().then(function (page) {
			page.find(".site-map-add-image").trigger("click");
			return new Promise(function (resolve) {
				setTimeout(resolve, 300);
			}).then(function () {
				assert.isTrue(page.hasClass("site-map-editing"));
				assert.isNotNull(remote.image);

				// Place a valve and save
				var rect = page.find(".site-map-container")[0].getBoundingClientRect(),
					target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
					event = function (type) {
						target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2,
							clientY: rect.top + rect.height / 2, pointerId: 1, pointerType: "mouse", button: 0 }));
					};
				event("pointerdown");
				event("pointerup");
				return new Promise(function (resolve) {
					setTimeout(resolve, 600);
				});
			}).then(function () {
				$(".ui-popup-active .site-map-picker a[data-sid='0']").trigger("click");
				return new Promise(function (resolve) {
					setTimeout(resolve, 600);
				});
			}).then(function () {
				page.find(".site-map-edit").trigger("click");
				return new Promise(function (resolve) {
					setTimeout(resolve, 300);
				});
			}).then(function () {
				assert.isFalse(confirm.called);
				assert.property(remote.pins, "0");
			});
		}).finally(function () {
			picture.restore();
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should save without asking when nobody else changed the map", function () {
		var confirm = sandbox.stub(OSApp.UIDom, "areYouSure");

		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			return editAndSave(page);
		}).then(function () {
			assert.isFalse(confirm.called);
			assert.isBelow(remote.pins[0][0], 3000);
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should ask before overwriting changes saved from another device, and overwrite if confirmed", function () {
		var confirm = sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, detail, yes) {
			yes();
		});

		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			return editAndSave(page, function () {
				// Another device moves the valve while this one is editing
				remote.pins = { 0: [9000, 9000] };
				remote.rev++;
			});
		}).then(function () {
			assert.isTrue(confirm.calledOnce);
			assert.include(confirm.firstCall.args[0], "another device");
			assert.isBelow(remote.pins[0][0], 3000);
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should load the other device's changes instead when overwriting is declined", function () {
		var confirm = sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, detail, yes, no) {
			no();
		});

		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			return editAndSave(page, function () {
				remote.pins = { 0: [9000, 9000] };
				remote.rev++;
			}).then(function () {
				var map = page.find(".site-map-container")[0].getBoundingClientRect(),
					pin = page.find(".site-map-pin")[0].getBoundingClientRect();

				assert.isTrue(confirm.calledOnce);
				assert.lengthOf(requestsTo("/cmp"), 0);
				assert.deepEqual(remote.pins, { 0: [9000, 9000] });

				// Showing the other device's version
				assert.closeTo(pin.left + pin.width / 2 - map.left, 0.9 * map.width, 2);
			});
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should restore drawings from a backup", function () {
		installController({ rev: 3 });

		return new Promise(function (resolve) {
			OSApp.SiteMap.restoreBackupData({
				pins: {},
				drawings: { 0: [{ type: "drip", pts: [[0.1, 0.1], [0.2, 0.2]] }], 999: [{ type: "heads", pts: [[0.5, 0.5]] }] }
			}, resolve);
		}).then(function () {
			assert.equal(remote.drawings, "d,0,1000,1000,2000,2000\n");
		});
	});

	it("should show changes saved on another device", function (done) {
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });

		openHomeMap().then(function () {
			setTimeout(function () {
				try {
					var page = $("#sprinklers .site-map-view");
					assert.equal(page.find(".site-map-pin").attr("data-sids"), "0");

					// Another device moves the pins
					remote.pins = { 1: [1000, 1000] };
					remote.rev++;
					OSApp.currentSession.controller.options.smap = remote.rev;
					$("html").trigger("datarefresh");

					setTimeout(function () {
						try {
							assert.equal(page.find(".site-map-pin").attr("data-sids"), "1");
							OSApp.SiteMap.setHomeView("cards");
							done();
						} catch (error) {
							done(error);
						}
					}, 100);
				} catch (error) {
					done(error);
				}
			}, 200);
		});
	});

	function wait(ms) {
		return new Promise(function (resolve) {
			setTimeout(resolve, ms);
		});
	}

	function waitFor(check) {
		return new Promise(function (resolve, reject) {
			var started = Date.now();
			(function poll() {
				if (check()) {
					resolve();
				} else if (Date.now() - started > 3000) {
					reject(new Error("timed out"));
				} else {
					setTimeout(poll, 20);
				}
			})();
		});
	}

	function cachedMap(name) {
		return new Promise(function (resolve) {
			OSApp.SiteMap.load(name, resolve);
		});
	}

	// Connects to another controller, as picking another site does: a new controller object and a new site name
	function switchController(state, name) {
		var previous = OSApp.currentSession.controller;

		OSApp.currentSession.controller = $.extend(true, {}, previous);
		remote = $.extend({ rev: 0, pins: {}, image: null, upload: "", drawings: "", drawingUpload: "" }, state);
		OSApp.currentSession.controller.options.smap = remote.rev;
		OSApp.Storage.set({ current_site: name });
		return function () {
			OSApp.currentSession.controller = previous;
			OSApp.Storage.set({ current_site: siteName });
			OSApp.Storage.remove(OSApp.SiteMap.getStorageKey(name));
		};
	}

	it("should load the new site's map when switching sites while the map is shown", function () {
		this.timeout(6000);
		var restore;

		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			restore = switchController({ rev: 9, pins: { 1: [1000, 1000] } }, "Other Controller");
			$("html").trigger("datarefresh");
			return waitFor(function () {
				return page.find(".site-map-pin").attr("data-sids") === "1";
			});
		}).then(function () {
			return cachedMap(siteName);
		}).then(function (first) {
			// The first site's copy still holds its own map
			assert.deepEqual(first.pins, { 0: { x: 0.5, y: 0.5 } });
			return cachedMap("Other Controller");
		}).then(function (other) {
			assert.deepEqual(other.pins, { 1: { x: 0.1, y: 0.1 } });
		}).finally(function () {
			if (restore) restore();
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should not send a failed save to a controller connected afterwards", function () {
		this.timeout(8000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay,
			restore;

		OSApp.SiteMap.Constants.retryDelay = 1500;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		remote.fail = { "/cmp": 1 };
		return openHomeMap().then(function (page) {
			return editAndSave(page);
		}).then(function () {
			assert.deepEqual(remote.pins, { 0: [5000, 5000] });
			restore = switchController({ rev: 5, pins: { 1: [1000, 1000] } }, "Other Controller");
			$("html").trigger("datarefresh");
			return wait(2000);
		}).then(function () {
			assert.deepEqual(remote.pins, { 1: [1000, 1000] });
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			if (restore) restore();
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should stop retrying a failed save while the map is closed, and send it when it's shown again", function () {
		this.timeout(8000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay;

		OSApp.SiteMap.Constants.retryDelay = 1500;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		remote.fail = { "/cmp": 2 };
		return openHomeMap().then(function (page) {
			return editAndSave(page);
		}).then(function () {
			// Closing tries once more, then stops
			OSApp.SiteMap.setHomeView("cards");
			return wait(2000);
		}).then(function () {
			assert.lengthOf(requestsTo("/cmp"), 2);
			assert.deepEqual(remote.pins, { 0: [5000, 5000] });
			return openHomeMap();
		}).then(function () {
			return waitFor(function () {
				return remote.pins[0] && remote.pins[0][0] < 3000;
			});
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should not retry a save the controller rejects, and show the controller's map again", function () {
		this.timeout(8000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay;

		OSApp.SiteMap.Constants.retryDelay = 300;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		remote.reject = { "/cmp": 17 };
		return openHomeMap().then(function (page) {
			return editAndSave(page).then(function () {
				return wait(1000);
			}).then(function () {
				var map = page.find(".site-map-container")[0].getBoundingClientRect(),
					pin = page.find(".site-map-pin")[0].getBoundingClientRect();

				assert.lengthOf(requestsTo("/cmp"), 1);
				assert.isFalse(OSApp.Errors.showError.calledWith(OSApp.Language._("Network Error")));
				assert.closeTo(pin.left + pin.width / 2 - map.left, 0.5 * map.width, 2);
			});
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should say when the controller has no room for the map", function () {
		this.timeout(6000);
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg(), drawings: "h,0,5000,5000,6000,5000\n" });
		remote.reject = { "/umd": 17 };
		return openHomeMap().then(function () {
			return deleteValve(0);
		}).then(function () {
			assert.isTrue(OSApp.Errors.showError.calledWith(OSApp.Language._("There isn't enough room on the controller for the site map.")));
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should clear the image and drawings a restored backup doesn't have", function () {
		installController({ rev: 3, pins: { 1: [1, 1] }, image: jpeg(), drawings: "d,1,1,1,2,2\n" });

		return new Promise(function (resolve) {
			OSApp.SiteMap.restoreBackupData({ pins: { 0: { x: 0.5, y: 0.5 } } }, resolve);
		}).then(function () {
			assert.isNull(remote.image);
			assert.equal(remote.drawings, "");
			assert.deepEqual(remote.pins, { 0: [5000, 5000] });
		});
	});

	it("should report a map that couldn't be restored", function () {
		installController({ rev: 3 });
		remote.fail = { "/cmp": 3 };

		return new Promise(function (resolve) {
			OSApp.SiteMap.restoreBackupData({ pins: { 0: { x: 0.5, y: 0.5 } } }, resolve);
		}).then(function (restored) {
			assert.isFalse(restored);
		});
	});

	it("should stop replacing the whole map when another site is picked partway", function () {
		var restore;

		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		remote.after = function (path) {
			if (path === "/dm") {
				restore = switchController({ rev: 7, pins: { 1: [1000, 1000] } }, "Other Controller");
			}
		};

		return new Promise(function (resolve) {
			OSApp.SiteMap.restoreBackupData({ image: jpeg("#f00"), pins: { 0: { x: 0.2, y: 0.2 } } }, resolve);
		}).then(function (restored) {
			// The rest of the map isn't sent to the controller picked since
			assert.isFalse(restored);
			assert.deepEqual(remote.pins, { 1: [1000, 1000] });
			assert.isNull(remote.image);
			assert.equal(remote.rev, 7);
		}).finally(function () {
			if (restore) restore();
		});
	});

	it("should keep an edit started while the reopened map was still loading", function () {
		this.timeout(6000);

		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function () {
			OSApp.SiteMap.setHomeView("cards");
			remote.holdNext = "/jm";
			return openHomeMap();
		}).then(function (page) {
			// The controller's copy arrives after the valve was moved, before Done
			return editAndSave(page, function () {
				remote.release();
			});
		}).then(function () {
			assert.isBelow(remote.pins[0][0], 3000);
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should keep a map moved from this device marked pending when moving it fails partway", function () {
		installController({ rev: 0 });
		remote.fail = { "/cmp": 1 };
		OSApp.SiteMap.save(siteName, { pins: { 0: { x: 0.3, y: 0.4 } }, drawings: {} });

		return loadMap().then(function () {
			return cachedMap(siteName);
		}).then(function (cached) {
			assert.isTrue(cached.pending);
			return loadMap();
		}).then(function (result) {
			// The controller's map changed with the delete, but this device's copy is still the one to send
			assert.deepEqual(result.map.pins, { 0: { x: 0.3, y: 0.4 } });
		});
	});

	it("should not send a failed save again while the map is being edited, and send it once the edit is cancelled", function () {
		this.timeout(8000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay;

		OSApp.SiteMap.Constants.retryDelay = 800;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		remote.fail = { "/cmp": 1 };
		return openHomeMap().then(function (page) {
			return editAndSave(page).then(function () {
				var rect = page.find(".site-map-container")[0].getBoundingClientRect(),
					event = function (element, type, x, y) {
						element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0 }));
					},
					handle, r;

				// Editing again before the retry, moving the valve somewhere else
				page.find(".site-map-edit").trigger("click");
				handle = page.find(".site-map-pin")[0];
				r = handle.getBoundingClientRect();
				event(handle, "pointerdown", r.left + r.width / 2, r.top + r.height / 2);
				event(handle, "pointermove", rect.left + 0.8 * rect.width, rect.top + rect.height / 2);
				event(handle, "pointerup", rect.left + 0.8 * rect.width, rect.top + rect.height / 2);
				return wait(1200).then(function () {
					assert.deepEqual(remote.pins, { 0: [5000, 5000] });
					page.find(".site-map-cancel").trigger("click");
					return waitFor(function () {
						return remote.pins[0][0] < 3000;
					});
				});
			});
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should stop loading a map when another site is picked partway", function () {
		var restore, switchedAt;

		installController({ rev: 2, pins: { 0: [5000, 5000] }, image: jpeg(), drawings: "0" });
		remote.after = function (path) {
			if (path === "/jmi") {
				restore = switchController({ rev: 4, drawings: "1" }, "Other Controller");
				switchedAt = requests.length;
			}
		};

		return asNative(OSApp.SiteMap.syncFromController(siteName, {})).then(function () {
			assert.fail("should stop");
		}, function (error) {
			assert.equal(error.statusText, "stale");

			// The new controller's drawings aren't saved with this site's map
			assert.lengthOf(requests.slice(switchedAt).filter(function (request) {
				return request.path === "/jmd";
			}), 0);
		}).finally(function () {
			if (restore) restore();
		});
	});

	it("should not export a site map with another controller's configuration", function () {
		var previous = OSApp.currentSession.controller,
			show = sandbox.stub(OSApp.ImportExport, "showExportMethods");

		sandbox.stub(OSApp.SiteMap, "getBackupData").callsFake(function (callback) {
			OSApp.currentSession.controller = $.extend(true, {}, previous);
			callback({ pins: {}, drawings: {} });
		});
		try {
			OSApp.ImportExport.getExportMethod();
			assert.isFalse(show.called);
		} finally {
			OSApp.currentSession.controller = previous;
		}
	});

	it("should report a backup's map that couldn't be kept on this device", function () {
		var set = OSApp.Storage.set,
			restored;

		delete OSApp.currentSession.controller.options.smap;
		sandbox.stub(OSApp.Storage, "set").callsFake(function (data) {
			if (data[OSApp.SiteMap.getStorageKey(siteName)] !== undefined) {
				throw new Error("QuotaExceededError");
			}
			return set.call(OSApp.Storage, data);
		});
		return new Promise(function (resolve) {
			OSApp.SiteMap.restoreBackupData({ pins: { 0: { x: 0.5, y: 0.5 } } }, resolve);
		}).then(function (result) {
			restored = result;
			assert.isFalse(restored);
		});
	});

	it("should keep map uploads through OpenThings Cloud as GET requests on firmware that POSTs changes", function () {
		var token = OSApp.currentSession.token,
			sent = [];

		OSApp.currentSession.controller.options.fwv = 300;
		OSApp.currentSession.token = "0123456789abcdef0123456789abcdef";
		sandbox.stub($, "ajaxq").callsFake(function (queue, request) {
			sent.push(request);
			return $.Deferred().resolve({ result: 1 }).promise();
		});
		return asNative(OSApp.SiteMap.uploadPins({ 0: { x: 0.5, y: 0.5 } }).then(function () {
			return OSApp.SiteMap.storeImage(jpeg(), true);
		}).then(function () {
			return OSApp.SiteMap.deleteRemote();
		})).then(function () {
			assert.lengthOf(sent, 3);
			sent.forEach(function (request) {
				assert.equal(request.type, "GET");
				assert.include(request.url, "pw=");
			});
			assert.include(sent[0].url, "p=");
			assert.include(sent[1].url, "fp=");
		}).finally(function () {
			OSApp.currentSession.token = token;
		});
	});

	it("should not start saving an edit while the map is being edited again", function () {
		this.timeout(8000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay;

		OSApp.SiteMap.Constants.retryDelay = 500;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			// The check for changes from other devices is slow, so editing starts again before it answers
			remote.holdNext = "/jm";
			return editAndSave(page).then(function () {
				var rect = page.find(".site-map-container")[0].getBoundingClientRect(),
					event = function (element, type, x, y) {
						element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0 }));
					},
					handle, r;

				page.find(".site-map-edit").trigger("click");
				handle = page.find(".site-map-pin")[0];
				r = handle.getBoundingClientRect();
				event(handle, "pointerdown", r.left + r.width / 2, r.top + r.height / 2);
				event(handle, "pointermove", rect.left + 0.8 * rect.width, rect.top + rect.height / 2);
				event(handle, "pointerup", rect.left + 0.8 * rect.width, rect.top + rect.height / 2);
				remote.release();
				return wait(300).then(function () {
					assert.deepEqual(remote.pins, { 0: [5000, 5000] });

					// Cancelling the second edit sends the first
					page.find(".site-map-cancel").trigger("click");
					return waitFor(function () {
						return remote.pins[0][0] < 3000;
					});
				});
			});
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should not put an image added for one site on the map of a site picked meanwhile", function () {
		this.timeout(6000);
		var image = jpeg("#39d"),
			restore, switchedAt;

		sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
			callback(image.split(",")[1]);
		});
		installController({ rev: 0 });
		OSApp.SiteMap.save(siteName, { pins: {}, drawings: {}, rev: 0 });
		return openHomeMap().then(function (page) {
			remote.after = function (path) {
				if (path === "/um") {
					restore = switchController({ rev: 6 }, "Other Controller");
					switchedAt = requests.length;
				}
			};
			page.find(".site-map-add-image").trigger("click");
			return wait(300);
		}).then(function () {
			// The app's own status refreshes (/ja) carry on regardless
			assert.lengthOf(requests.slice(switchedAt).filter(function (request) {
				return request.path !== "/ja";
			}), 0);
			return cachedMap("Other Controller");
		}).then(function (other) {
			assert.isUndefined(other.image);
		}).finally(function () {
			if (restore) restore();
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should not say a save went through when the controller refused the password", function () {
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		remote.deny = { "/cmp": true };
		return openHomeMap().then(function (page) {
			return editAndSave(page);
		}).then(function () {
			assert.isFalse(OSApp.Errors.showError.calledWith(OSApp.Language._("Settings have been saved")));
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should rename a site's map even when there is no room for a second copy", function () {
		var set = OSApp.Storage.set,
			from = OSApp.SiteMap.getStorageKey(siteName),
			to = OSApp.SiteMap.getStorageKey("Renamed Site");

		OSApp.SiteMap.save(siteName, { pins: { 0: { x: 0.5, y: 0.5 } }, drawings: {} });
		sandbox.stub(OSApp.Storage, "set").callsFake(function (data) {
			if (data[to] !== undefined && OSApp.Storage.getItemSync(from) !== null) {
				throw new Error("QuotaExceededError");
			}
			return set.call(OSApp.Storage, data);
		});
		try {
			OSApp.SiteMap.renameSite(siteName, "Renamed Site");
			assert.equal(OSApp.Storage.getItemSync(from), null);
			assert.deepEqual(JSON.parse(OSApp.Storage.getItemSync(to)).pins, { 0: { x: 0.5, y: 0.5 } });
		} finally {
			OSApp.Storage.remove(to);
		}
	});

	// Starts editing and drags the first valve to x (0 to 1 across the map), leaving the edit open
	function editAndMove(page, x) {
		var rect = page.find(".site-map-container")[0].getBoundingClientRect(),
			event = function (element, type, px, py) {
				element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: px, clientY: py, pointerId: 1, pointerType: "mouse", button: 0 }));
			},
			handle, r;

		page.find(".site-map-edit").trigger("click");
		handle = page.find(".site-map-pin")[0];
		r = handle.getBoundingClientRect();
		event(handle, "pointerdown", r.left + r.width / 2, r.top + r.height / 2);
		event(handle, "pointermove", rect.left + x * rect.width, rect.top + rect.height / 2);
		event(handle, "pointerup", rect.left + x * rect.width, rect.top + rect.height / 2);
	}

	it("should send what was saved with Done, not an edit started while it was being sent", function () {
		this.timeout(8000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay;

		OSApp.SiteMap.Constants.retryDelay = 500;
		sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
			callback(jpeg("#d93").split(",")[1]);
		});
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			// The first edit has a new image, which is slow to upload, and a moved valve
			editAndMove(page, 0.2);
			page.find(".site-map-image").trigger("click");
			remote.holdNext = "/um";
			page.find(".site-map-edit").trigger("click");
			return wait(100).then(function () {
				editAndMove(page, 0.8);
				remote.release();
				return wait(300);
			}).then(function () {
				assert.isBelow(remote.pins[0][0], 3000);
				page.find(".site-map-cancel").trigger("click");
			});
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should check again for changes from other devices when the check fails, instead of saving anyway", function () {
		this.timeout(8000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay,
			confirm = sandbox.stub(OSApp.UIDom, "areYouSure"),
			changed = false;

		OSApp.SiteMap.Constants.retryDelay = 500;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			// The check doesn't get through, and meanwhile another device saves
			remote.fail = { "/jm": 1 };
			remote.after = function (path) {
				if (path === "/jm" && !changed) {
					changed = true;
					remote.rev++;
				}
			};
			return editAndSave(page);
		}).then(function () {
			assert.lengthOf(requestsTo("/cmp"), 0);
			return waitFor(function () {
				return confirm.called;
			});
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should check again for changes from other devices before sending a save that didn't go through", function () {
		this.timeout(8000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay,
			confirm = sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (text, subtext, yes, no) {
				// Keep the other device's changes
				no();
			});

		OSApp.SiteMap.Constants.retryDelay = 500;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			// The save doesn't get through, and before it is sent again another device saves
			remote.fail = { "/cmp": 1 };
			return editAndSave(page);
		}).then(function () {
			remote.rev++;
			OSApp.currentSession.controller.options.smap = remote.rev;
			return waitFor(function () {
				return confirm.called;
			});
		}).then(function () {
			assert.lengthOf(requestsTo("/cmp"), 1);
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should keep a backup that couldn't be restored to the controller, to send again", function () {
		installController({ rev: 3, pins: { 1: [1000, 1000] } });
		remote.fail = { "/cmp": 1 };

		return new Promise(function (resolve) {
			OSApp.SiteMap.restoreBackupData({ pins: { 0: { x: 0.5, y: 0.5 } } }, resolve);
		}).then(function (restored) {
			assert.isFalse(restored);
			return cachedMap(siteName);
		}).then(function (cached) {
			assert.isTrue(cached.pending);
			assert.deepEqual(cached.pins, { 0: { x: 0.5, y: 0.5 } });
		});
	});

	it("should not clear the map of a site picked while clearing", function () {
		this.timeout(6000);
		var other = { pins: { 1: { x: 0.1, y: 0.1 } }, drawings: {}, image: jpeg("#123"), rev: 6 },
			restore, switchedAt;

		sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, detail, yes) {
			yes();
		});
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			remote.after = function (path) {
				if (path === "/dm") {
					restore = switchController({ rev: 6 }, "Other Controller");
					OSApp.SiteMap.save("Other Controller", other);
					switchedAt = requests.length;
				}
			};
			page.find(".site-map-clear").trigger("click");
			return wait(300);
		}).then(function () {
			assert.lengthOf(requests.slice(switchedAt), 0);
			return cachedMap("Other Controller");
		}).then(function (cached) {
			assert.equal(cached.image, other.image);
		}).finally(function () {
			if (restore) restore();
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	describe("after another site is picked mid-request", function () {
		var restore, switchedAt;

		// Picks another site once the controller answers a request for path
		function switchAfter(path, state) {
			remote.after = function (handled) {
				if (handled === path && !restore) {
					restore = switchController(state || { rev: 6, pins: { 1: [1000, 1000] }, image: jpeg("#123") }, "Other Controller");
					switchedAt = requests.length;
				}
			};
		}

		// The app's own status refreshes (/ja) carry on regardless
		function requestsSinceSwitch() {
			return requests.slice(switchedAt).filter(function (request) {
				return request.path !== "/ja";
			});
		}

		afterEach(function () {
			if (restore) restore();
			restore = null;
			switchedAt = undefined;
			OSApp.SiteMap.setHomeView("cards");
		});

		it("should not download the image from the controller picked since", function () {
			installController({ rev: 2, pins: { 0: [5000, 5000] }, image: jpeg() });
			switchAfter("/jm");

			return asNative(OSApp.SiteMap.syncFromController(siteName, {})).then(function () {
				assert.fail("should stop");
			}, function (error) {
				assert.equal(error.statusText, "stale");
				assert.lengthOf(requestsSinceSwitch(), 0);
			});
		});

		it("should not ask about changes on another device for the site picked since", function () {
			this.timeout(6000);
			var confirm = sandbox.stub(OSApp.UIDom, "areYouSure");

			installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
			return openHomeMap().then(function (page) {
				remote.holdNext = "/jm";
				return editAndSave(page).then(function () {
					var held = remote;
					restore = switchController({ rev: 6, pins: { 1: [1000, 1000] } }, "Other Controller");

					// The held request is only recorded when it is answered
					switchedAt = requests.length + 1;
					held.release();
					return wait(300);
				});
			}).then(function () {
				assert.isFalse(confirm.called);
				assert.lengthOf(requestsSinceSwitch(), 0);
			});
		});

		it("should not keep a save that failed after the switch for the site picked since", function () {
		this.timeout(6000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay;

		OSApp.SiteMap.Constants.retryDelay = 200;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			remote.holdNext = "/cmp";
			return editAndSave(page).then(function () {
				var held = remote;

				// The other site's map is still loading when the save fails
				restore = switchController({ rev: 6, pins: { 1: [1000, 1000] } }, "Other Controller");
				remote.holdNext = "/jm";
				$("html").trigger("datarefresh");
				remote.fail = { "/cmp": 1 };
				held.release();
				return wait(600);
			});
		}).then(function () {
			assert.deepEqual(remote.pins, { 1: [1000, 1000] });
			assert.lengthOf(requestsTo("/cmp"), 1);
			return cachedMap("Other Controller");
		}).then(function (other) {
			assert.isNotTrue(other && other.pending);
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			if (remote.release) remote.release();
		});
	});

	it("should ignore a picture picked for the site picked since", function () {
			this.timeout(6000);
			var picked;

			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				picked = callback;
			});
			installController({ rev: 0 });
			OSApp.SiteMap.save(siteName, { pins: {}, drawings: {}, rev: 0 });
			return openHomeMap().then(function (page) {
				page.find(".site-map-add-image").trigger("click");
				restore = switchController({ rev: 6 }, "Other Controller");
				switchedAt = requests.length;
				picked(jpeg("#d93").split(",")[1]);
				return wait(300);
			}).then(function () {
				assert.lengthOf(requestsSinceSwitch(), 0);
				return cachedMap("Other Controller");
			}).then(function (other) {
				assert.isUndefined(other.image);
			});
		});

		it("should not send the image relay's next piece to the controller picked since", function () {
			var image = jpeg(),
				previous = OSApp.currentSession.controller,
				retryDelay = OSApp.SiteMap.Constants.relayRetryDelay;

			OSApp.SiteMap.Constants.relayRetryDelay = 5;
			installController({ deviceImage: true, rev: 2, pins: {}, fp: OSApp.SiteMap.getFingerprint(image),
				imageSize: atob(image.split(",")[1]).length, relay: { req: 100, win: 900 } });
			remote.relay.receivers = ["0000beef"];
			remote.relay.state = 1;
			remote.after = function (path) {
				if (path === "/mxu" && switchedAt === undefined) {
					OSApp.currentSession.controller = $.extend(true, {}, previous);
					switchedAt = requests.length;
				}
			};
			return asNative(OSApp.SiteMap.Relay.send(image, remote.fp, { controller: previous, cancelled: false })).then(function () {
				assert.lengthOf(requestsSinceSwitch(), 0);
			}).finally(function () {
				OSApp.SiteMap.Constants.relayRetryDelay = retryDelay;
				OSApp.currentSession.controller = previous;
				switchedAt = undefined;
			});
		});
	});

	it("should keep this device's copy as saved, not as being edited, while a save finishes", function () {
		this.timeout(6000);

		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			remote.holdNext = "/cmp";
			return editAndSave(page).then(function () {
				editAndMove(page, 0.8);
				remote.release();
				return wait(300);
			}).then(function () {
				return cachedMap(siteName);
			}).then(function (cached) {
				assert.isBelow(cached.pins[0].x, 0.3);
				page.find(".site-map-cancel").trigger("click");
			});
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	describe("while an earlier save is still being sent", function () {
		var retryDelay;

		beforeEach(function () {
			retryDelay = OSApp.SiteMap.Constants.retryDelay;
			OSApp.SiteMap.Constants.retryDelay = 500;
			installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		});

		afterEach(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});

		it("should send a later save after it, so the earlier one can't overwrite it", function () {
			this.timeout(8000);
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(jpeg("#d93").split(",")[1]);
			});
			return openHomeMap().then(function (page) {
				// The first save has a new image, which is slow to upload, before its valve
				editAndMove(page, 0.2);
				page.find(".site-map-image").trigger("click");
				remote.holdNext = "/um";
				page.find(".site-map-edit").trigger("click");
				return wait(100).then(function () {
					editAndMove(page, 0.8);
					page.find(".site-map-edit").trigger("click");
					return wait(100);
				}).then(function () {
					remote.release();
					return wait(500);
				});
			}).then(function () {
				assert.isAbove(remote.pins[0][0], 7000);
			});
		});

		it("should keep a new edit's changes when the earlier save is refused", function () {
			this.timeout(8000);
			return openHomeMap().then(function (page) {
				remote.holdNext = "/cmp";
				return editAndSave(page).then(function () {
					editAndMove(page, 0.8);
					remote.reject = { "/cmp": 0x11 };
					remote.release();
					delete remote.reject;
					page.find(".site-map-edit").trigger("click");
					return wait(500);
				});
			}).then(function () {
				assert.isAbove(remote.pins[0][0], 7000);
			});
		});

		it("should send a queued save as it was when Done was tapped, not an edit started while it waits", function () {
			this.timeout(8000);
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(jpeg("#d93").split(",")[1]);
			});
			return openHomeMap().then(function (page) {
				remote.holdNext = "/cmp";
				return editAndSave(page).then(function () {
					// A second save waits for the first; a third edit, with a new image, starts meanwhile
					editAndMove(page, 0.8);
					page.find(".site-map-edit").trigger("click");
					return wait(100);
				}).then(function () {
					page.find(".site-map-edit").trigger("click");
					page.find(".site-map-image").trigger("click");
					remote.release();
					return wait(300);
				}).then(function () {
					assert.isAbove(remote.pins[0][0], 7000);
					assert.lengthOf(requestsTo("/um"), 0);
					page.find(".site-map-cancel").trigger("click");
				});
			});
		});

		it("should clear the map after it, so its later steps can't put the map back", function () {
			this.timeout(8000);
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(jpeg("#d93").split(",")[1]);
			});
			return openHomeMap().then(function (page) {
				// The save has a new image, which is slow to upload, before its valve
				editAndMove(page, 0.2);
				page.find(".site-map-image").trigger("click");
				remote.holdNext = "/um";
				page.find(".site-map-edit").trigger("click");
				return wait(100).then(function () {
					sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (text, subtext, yes) {
						yes();
					});
					page.find(".site-map-edit").trigger("click");
					page.find(".site-map-clear").trigger("click");
					remote.release();
					return wait(500);
				});
			}).then(function () {
				assert.deepEqual(remote.pins, {});
				assert.isNull(remote.image);
			});
		});

		it("should show the controller's map after a later edit is saved, when the earlier save was refused", function () {
			this.timeout(8000);
			var original = jpeg();

			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(jpeg("#d93").split(",")[1]);
			});
			return openHomeMap().then(function (page) {
				page.find(".site-map-edit").trigger("click");
				page.find(".site-map-image").trigger("click");
				remote.holdNext = "/um";
				page.find(".site-map-edit").trigger("click");
				return wait(100).then(function () {
					// The image is refused while a later edit moves a valve, which is saved
					editAndMove(page, 0.8);
					remote.reject = { "/um": 0x11 };
					remote.release();
					delete remote.reject;
					page.find(".site-map-edit").trigger("click");
					return waitFor(function () {
						return page.find(".site-map-image-el").attr("src") === original;
					});
				}).then(function () {
					assert.isAbove(remote.pins[0][0], 7000);
					return cachedMap(siteName);
				}).then(function (cached) {
					assert.equal(cached.image, original);
				});
			});
		});

		it("should not send an edit saved after a clear was confirmed once the map is cleared", function () {
			this.timeout(8000);
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(jpeg("#d93").split(",")[1]);
			});
			return openHomeMap().then(function (page) {
				// The save has a new image, which is slow to upload, before its valve
				editAndMove(page, 0.2);
				page.find(".site-map-image").trigger("click");
				remote.holdNext = "/um";
				page.find(".site-map-edit").trigger("click");
				return wait(100).then(function () {
					sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (text, subtext, yes) {
						yes();
					});

					// Clear waits for it; meanwhile a valve is moved and saved
					editAndMove(page, 0.8);
					page.find(".site-map-clear").trigger("click");
					page.find(".site-map-edit").trigger("click");
					return wait(100);
				}).then(function () {
					remote.release();
					return wait(500);
				});
			}).then(function () {
				assert.deepEqual(remote.pins, {});
				assert.isNull(remote.image);
			});
		});

		it("should show the controller's map after a save queued meanwhile, when the earlier save was refused", function () {
			this.timeout(8000);
			return openHomeMap().then(function (page) {
				remote.holdNext = "/cmp";
				return editAndSave(page).then(function () {
					// A later save is waiting when the earlier one is refused
					editAndMove(page, 0.8);
					page.find(".site-map-edit").trigger("click");
					return wait(100);
				}).then(function () {
					remote.refuseNext = { "/cmp": 0x11 };
					remote.release();
					return wait(500);
				});
			}).then(function () {
				assert.isAbove(remote.pins[0][0], 7000);
				return cachedMap(siteName);
			}).then(function (cached) {
				assert.isAbove(cached.pins[0].x, 0.7);
				assert.equal(cached.rev, remote.rev);
			});
		});

		it("should send an earlier save that failed during an edit once the edit is cancelled", function () {
			this.timeout(8000);
			return openHomeMap().then(function (page) {
				remote.holdNext = "/cmp";
				return editAndSave(page).then(function () {
					editAndMove(page, 0.8);
					remote.fail = { "/cmp": 1 };
					remote.release();
					page.find(".site-map-cancel").trigger("click");
					return waitFor(function () {
						return remote.pins[0][0] < 3000;
					});
				});
			});
		});
	});

	it("should send a save that didn't go through before the app closed", function () {
		this.timeout(6000);
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });

		// What a failed save left on this device: the edit, marked as not yet on the controller
		OSApp.SiteMap.save(siteName, { pins: { 0: { x: 0.2, y: 0.5 } }, drawings: {}, image: remote.image, rev: 1, pending: true });
		return openHomeMap().then(function () {
			return waitFor(function () {
				return remote.pins[0] && remote.pins[0][0] === 2000;
			});
		}).then(function () {
			return wait(300);
		}).then(function () {
			return cachedMap(siteName);
		}).then(function (cached) {
			assert.isUndefined(cached.pending);
			assert.equal(cached.rev, remote.rev);
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should check for changes from other devices before sending a save left from before the app closed", function () {
		this.timeout(6000);
		var confirm = sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (text, subtext, yes, no) {
			// Keep the other device's changes
			no();
		});

		// Another device saved after this device's save failed and the app closed
		installController({ rev: 2, pins: { 0: [9000, 5000] }, image: jpeg() });
		OSApp.SiteMap.save(siteName, { pins: { 0: { x: 0.2, y: 0.5 } }, drawings: {}, image: remote.image, rev: 1, pending: true });
		return openHomeMap().then(function () {
			return waitFor(function () {
				return confirm.called;
			});
		}).then(function () {
			return wait(300);
		}).then(function () {
			assert.lengthOf(requestsTo("/dm"), 0);
			assert.lengthOf(requestsTo("/cmp"), 0);
			assert.deepEqual(remote.pins, { 0: [9000, 5000] });
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should mark a save that hasn't reached the controller on this device", function () {
		this.timeout(6000);
		var retryDelay = OSApp.SiteMap.Constants.retryDelay;

		OSApp.SiteMap.Constants.retryDelay = 60000;
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		remote.fail = { "/cmp": 1 };
		return openHomeMap().then(function (page) {
			return editAndSave(page);
		}).then(function () {
			return cachedMap(siteName);
		}).then(function (cached) {
			assert.isTrue(cached.pending);
		}).finally(function () {
			OSApp.SiteMap.Constants.retryDelay = retryDelay;
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should save the whole map when overwriting changes from another device", function () {
		var image = jpeg();

		sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, detail, yes) {
			yes();
		});
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: image });
		return openHomeMap().then(function (page) {
			return editAndSave(page, function () {
				// Another device replaces the image while this one is editing
				remote.image = jpeg("#c33");
				remote.rev++;
			});
		}).then(function () {
			return wait(300);
		}).then(function () {
			assert.equal(remote.image, image);
			assert.isBelow(remote.pins[0][0], 3000);
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should go back to editing when the question about another device's changes is dismissed", function () {
		this.timeout(6000);
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			return editAndSave(page, function () {
				remote.pins = { 0: [9000, 9000] };
				remote.rev++;
			}).then(function () {
				return waitFor(function () {
					return $("#sure").parent().hasClass("ui-popup-active");
				});
			}).then(function () {
				$("#sure").popup("close");
				return waitFor(function () {
					return page.hasClass("site-map-editing");
				});
			}).then(function () {
				// The edit is kept, and nothing was saved
				var map = page.find(".site-map-container")[0].getBoundingClientRect(),
					pin = page.find(".site-map-pin")[0].getBoundingClientRect();

				assert.lengthOf(requestsTo("/cmp"), 0);
				assert.closeTo(pin.left + pin.width / 2 - map.left, 0.2 * map.width, 2);
			});
		}).finally(function () {
			if ($("#sure").length) {
				$("#sure").popup("close");
			}
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should leave out pins for missing stations and shrink a large image when moving a map to the controller", function () {
		var canvas = document.createElement("canvas");

		canvas.width = 2000;
		canvas.height = 1000;
		canvas.getContext("2d").fillRect(0, 0, 10, 10);
		installController();
		OSApp.SiteMap.save(siteName, { image: canvas.toDataURL("image/jpeg", 0.8), pins: { 0: { x: 0.5, y: 0.5 }, 999: { x: 0.1, y: 0.1 } } });

		return loadMap().then(function () {
			assert.deepEqual(remote.pins, { 0: [5000, 5000] });
			return new Promise(function (resolve) {
				var uploaded = new Image();
				uploaded.onload = function () {
					resolve(uploaded);
				};
				uploaded.src = remote.image;
			});
		}).then(function (uploaded) {
			assert.equal(uploaded.width, OSApp.SiteMap.Constants.controllerImageSize);
			assert.equal(uploaded.height, OSApp.SiteMap.Constants.controllerImageSize / 2);
		});
	});

	it("should not move a map to the controller while making a backup", function () {
		installController();
		OSApp.SiteMap.save(siteName, { pins: { 0: { x: 0.5, y: 0.5 } } });

		return new Promise(function (resolve) {
			OSApp.SiteMap.getBackupData(resolve);
		}).then(function (backup) {
			assert.deepEqual(backup.pins, { 0: { x: 0.5, y: 0.5 } });
			assert.lengthOf(requestsTo("/cmp"), 0);
		});
	});

	it("should keep a site's map when the site is renamed, and remove it when the site is deleted", function () {
		OSApp.SiteMap.save("Old Name", { pins: { 0: { x: 0.5, y: 0.5 } } });

		OSApp.SiteMap.renameSite("Old Name", "New Name");
		return cachedMap("Old Name").then(function (old) {
			assert.isFalse(OSApp.SiteMap.hasData(old));
			return cachedMap("New Name");
		}).then(function (renamed) {
			assert.deepEqual(renamed.pins, { 0: { x: 0.5, y: 0.5 } });
			OSApp.SiteMap.removeSite("New Name");
			return cachedMap("New Name");
		}).then(function (removed) {
			assert.isFalse(OSApp.SiteMap.hasData(removed));
		}).finally(function () {
			OSApp.Storage.remove([OSApp.SiteMap.getStorageKey("Old Name"), OSApp.SiteMap.getStorageKey("New Name")]);
		});
	});

	it("should save the shown map under the new name after its site is renamed", function () {
		this.timeout(6000);
		delete OSApp.currentSession.controller.options.smap;
		OSApp.SiteMap.save(siteName, { image: jpeg(), pins: { 0: { x: 0.5, y: 0.5 } } });
		return openHomeMap().then(function (page) {
			OSApp.Storage.set({ current_site: "Renamed Site" });
			OSApp.SiteMap.renameSite(siteName, "Renamed Site");
			return editAndSave(page);
		}).then(function () {
			return cachedMap("Renamed Site");
		}).then(function (renamed) {
			assert.isBelow(renamed.pins[0].x, 0.3);
		}).finally(function () {
			OSApp.Storage.set({ current_site: siteName });
			OSApp.Storage.remove(OSApp.SiteMap.getStorageKey("Renamed Site"));
			OSApp.SiteMap.setHomeView("cards");
		});
	});

	it("should ignore a right-click on a valve", function () {
		this.timeout(6000);
		installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });
		return openHomeMap().then(function (page) {
			var pin = page.find(".site-map-pin")[0];

			requests = [];
			["pointerdown", "pointerup"].forEach(function (type) {
				pin.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 2 }));
			});
			return wait(300);
		}).then(function () {
			assert.lengthOf($(".ui-popup-active"), 0);

			// The app's regular status refresh may land in the meantime
			assert.lengthOf(requests.filter(function (request) {
				return request.path !== "/ja";
			}), 0);
		}).finally(function () {
			OSApp.SiteMap.setHomeView("cards");
		});
	});
	describe("image fingerprints and the image kept on each device", function () {
		var previousConstants;

		// The browser's own SHA-256, available here because the tests run on localhost
		function referenceFingerprint(dataURL) {
			return crypto.subtle.digest("SHA-256", OSApp.SiteMap.dataURLToBytes(dataURL)).then(function (digest) {
				return Array.from(new Uint8Array(digest).slice(0, 16)).map(function (byte) {
					return ("0" + byte.toString(16)).slice(-2);
				}).join("");
			});
		}

		function imageSize(dataURL) {
			return atob(dataURL.split(",")[1]).length;
		}

		function waitFor(check, limit) {
			return new Promise(function (resolve, reject) {
				var started = Date.now();
				(function poll() {
					if (check()) {
						resolve();
					} else if (Date.now() - started > (limit || 3000)) {
						reject(new Error("timed out"));
					} else {
						setTimeout(poll, 20);
					}
				})();
			});
		}

		function loadCache() {
			return new Promise(function (resolve) {
				OSApp.SiteMap.load(siteName, resolve);
			});
		}

		// A controller that leaves the image to the apps, with image as its image
		function installDeviceController(image, extra) {
			installController($.extend({ deviceImage: true, rev: 2, pins: { 0: [5000, 5000] },
				fp: image ? OSApp.SiteMap.getFingerprint(image) : "", imageSize: image ? imageSize(image) : 0 }, extra));
		}

		// A larger, detailed image, so it takes several relay windows and a partial copy still has rows to draw
		function detailedJpeg() {
			var canvas = document.createElement("canvas"),
				context = canvas.getContext("2d"),
				x, y;
			canvas.width = 160;
			canvas.height = 120;
			for (y = 0; y < 120; y += 4) {
				for (x = 0; x < 160; x += 4) {
					context.fillStyle = "rgb(" + ((x * 7 + y * 3) % 256) + "," + ((x * y) % 256) + "," + ((y * 11) % 256) + ")";
					context.fillRect(x, y, 4, 4);
				}
			}
			return canvas.toDataURL("image/jpeg", 0.95);
		}

		beforeEach(function () {
			previousConstants = $.extend({}, OSApp.SiteMap.Constants);
			OSApp.SiteMap.Constants.relayPollDelay = 5;
		});

		afterEach(function () {
			$.extend(OSApp.SiteMap.Constants, previousConstants);
			OSApp.SiteMap.Relay.sending = null;
			OSApp.SiteMap.Relay.declined = null;
			OSApp.SiteMap.Relay.mismatch = null;
			$(".site-map-relay-status").remove();
			delete OSApp.currentSession.controller.options.smx;
		});

		it("should fingerprint an image with the first 16 bytes of its SHA-256", function () {
			var text = function (value) {
					return "data:image/jpeg;base64," + btoa(value);
				},
				image = detailedJpeg(),
				large = new Uint8Array(1024 * 1024),
				started;

			assert.equal(OSApp.SiteMap.getFingerprint(text("")), "e3b0c44298fc1c149afbf4c8996fb924");
			assert.equal(OSApp.SiteMap.getFingerprint(text("abc")), "ba7816bf8f01cfea414140de5dae2223");
			assert.equal(OSApp.SiteMap.getFingerprint(text("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")),
				"248d6a61d20638b8e5c026930c3e6039");

			large.forEach(function (value, index) {
				large[index] = (index * 31) % 251;
			});
			started = Date.now();
			OSApp.SiteMap.sha256(large);
			assert.isBelow(Date.now() - started, 500);

			return referenceFingerprint(image).then(function (expected) {
				assert.equal(OSApp.SiteMap.getFingerprint(image), expected);
				return crypto.subtle.digest("SHA-256", large);
			}).then(function (digest) {
				assert.deepEqual(Array.from(OSApp.SiteMap.sha256(large)), Array.from(new Uint8Array(digest)));
			});
		});

		it("should keep the copy here when only the pins changed on a controller that reports fingerprints", function () {
			var image = jpeg("#2a6");
			installController({ rev: 2, pins: {}, image: image, fp: OSApp.SiteMap.getFingerprint(image) });

			return loadMap().then(function () {
				assert.lengthOf(requestsTo("/jmi"), 1);
				requests = [];
				remote.rev++;
				return loadMap();
			}).then(function (loaded) {
				assert.lengthOf(requestsTo("/jmi"), 0);
				assert.equal(loaded.map.image, image);

				// A different image is downloaded
				remote.image = jpeg("#a26");
				remote.fp = OSApp.SiteMap.getFingerprint(remote.image);
				remote.rev++;
				return loadMap();
			}).then(function (loaded) {
				assert.lengthOf(requestsTo("/jmi"), 1);
				assert.equal(loaded.map.image, remote.image);
			});
		});

		it("should move a map saved on this device to the controller without uploading the image", function () {
			var image = jpeg();
			installDeviceController(null, { rev: 0, pins: {} });
			OSApp.SiteMap.save(siteName, { image: image, pins: { 0: { x: 0.5, y: 0.25 } } });

			return loadMap().then(function (first) {
				assert.lengthOf(requestsTo("/um"), 0);
				assert.equal(remote.fp, OSApp.SiteMap.getFingerprint(image));
				assert.equal(remote.imageSize, imageSize(image));
				assert.deepEqual(remote.pins, { 0: [5000, 2500] });
				assert.equal(first.map.image, image);
				assert.isTrue(first.map.deviceImage);

				requests = [];
				return loadMap();
			}).then(function (second) {
				assert.lengthOf(requestsTo("/cmi"), 0);
				assert.equal(second.map.image, image);
				assert.isUndefined(second.map.missingImage);
			});
		});

		it("should use the copy here when it is the controller's image, and ask for it when it isn't", function () {
			var image = jpeg("#c33");
			installDeviceController(image, { rev: 6 });
			OSApp.SiteMap.save(siteName, { image: image, pins: {}, rev: 2 });

			return loadMap().then(function (result) {
				assert.equal(result.map.image, image);
				assert.isUndefined(result.map.missingImage);

				remote.fp = "0123456789abcdef0123456789abcdef";
				remote.imageSize = 4321;
				remote.rev++;
				return loadMap();
			}).then(function (result) {
				assert.isUndefined(result.map.image);
				assert.deepEqual(result.map.missingImage, { fp: "0123456789abcdef0123456789abcdef", size: 4321 });
				assert.deepEqual(result.map.pins, { 0: { x: 0.5, y: 0.5 } });
			});
		});

		it("should restore a backup's image to this device and its fingerprint to the controller", function () {
			var image = jpeg();
			installDeviceController(null, { rev: 3, pins: {} });

			return new Promise(function (resolve) {
				OSApp.SiteMap.restoreBackupData({ image: image, pins: { 0: { x: 0.5, y: 0.5 } } }, resolve);
			}).then(function () {
				assert.lengthOf(requestsTo("/um"), 0);
				assert.equal(remote.fp, OSApp.SiteMap.getFingerprint(image));
				assert.deepEqual(remote.pins, { 0: [5000, 5000] });
				return loadCache();
			}).then(function (map) {
				assert.equal(map.image, image);
			});
		});

		it("should show the image file loaded here when it is the one the map was made with", function () {
			var image = jpeg("#2a6"),
				confirm = sandbox.stub(OSApp.UIDom, "areYouSure");
			installDeviceController(image);

			// The picker hands over the file as chosen along with the resized copy, which wouldn't match
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(jpeg("#000").split(",")[1], image);
			});

			return openHomeMap().then(function (page) {
				var container = page.find(".site-map-container");
				assert.isTrue(container.hasClass("site-map-missing-image"));
				assert.isTrue(page.find(".site-map-missing-prompt").is(":visible"));
				assert.isFalse(page.find(".site-map-empty-prompt").is(":visible"));
				assert.isFalse(page.find(".site-map-pin").is(":visible"));

				page.find(".site-map-load-image").trigger("click");
				return waitFor(function () {
					return !container.hasClass("site-map-missing-image");
				}).then(function () {
					assert.equal(page.find(".site-map-image-el").attr("src"), image);
					assert.isFalse(confirm.called);
					assert.lengthOf(requestsTo("/cmi"), 0);
					assert.isTrue(page.find(".site-map-pin").is(":visible"));
					return loadCache();
				}).then(function (map) {
					assert.equal(map.image, image);
				});
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should replace the map image everywhere when a different image is loaded and confirmed", function () {
			var image = jpeg("#2a6"),
				other = jpeg("#a26");
			installDeviceController(image);
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(other.split(",")[1], other);
			});
			var confirm = sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, detail, yes) {
				yes();
			});

			return openHomeMap().then(function (page) {
				page.find(".site-map-load-image").trigger("click");
				return waitFor(function () {
					return remote.fp === OSApp.SiteMap.getFingerprint(other) &&
						page.find(".site-map-image-el").attr("src") === other;
				}).then(function () {
					assert.isTrue(confirm.calledOnce);
					assert.equal(remote.imageSize, imageSize(other));
				});
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should check for changes from other devices before sending a different image loaded meanwhile", function () {
			var image = jpeg("#2a6"),
				other = jpeg("#a26"),
				questions = [];
			installDeviceController(image);
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				// Another device saves while the picker is open
				remote.rev++;
				callback(other.split(",")[1], other);
			});
			sandbox.stub(OSApp.UIDom, "areYouSure").callsFake(function (question, detail, yes, no) {
				// Use the different image, then keep the other device's changes
				questions.push(question);
				if (questions.length === 1) {
					yes();
				} else {
					no();
				}
			});

			return openHomeMap().then(function (page) {
				page.find(".site-map-load-image").trigger("click");
				return new Promise(function (resolve) {
					setTimeout(resolve, 300);
				});
			}).then(function () {
				assert.lengthOf(questions, 2);
				assert.lengthOf(requestsTo("/cmi"), 0);
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should leave presses on the missing-image prompt to its buttons instead of panning the map", function () {
			var image = jpeg("#2a6"),
				capture = sandbox.spy(Element.prototype, "setPointerCapture");
			installDeviceController(image);

			return openHomeMap().then(function (page) {
				["pointerdown", "pointerup"].forEach(function (type) {
					page.find(".site-map-get-image")[0].dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true,
						pointerId: 1, pointerType: "mouse", button: 0 }));
				});
				assert.isFalse(capture.called);
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should keep asking for the image when a different one is declined", function () {
			var image = jpeg("#2a6"),
				confirm = sandbox.stub(OSApp.UIDom, "areYouSure");
			installDeviceController(image);
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(jpeg("#a26").split(",")[1], jpeg("#a26"));
			});

			return openHomeMap().then(function (page) {
				page.find(".site-map-load-image").trigger("click");
				return waitFor(function () {
					return confirm.called;
				}).then(function () {
					assert.lengthOf(requestsTo("/cmi"), 0);
					assert.isTrue(page.find(".site-map-container").hasClass("site-map-missing-image"));
				});
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should send only the fingerprint when an image is added, at the size kept on the device", function () {
			var image = jpeg("#39d"),
				picture = sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
					callback(image.split(",")[1], jpeg("#000"));
				});
			installDeviceController(null, { rev: 0, pins: {} });
			OSApp.SiteMap.save(siteName, { pins: {}, drawings: {}, rev: 0 });

			return openHomeMap().then(function (page) {
				page.find(".site-map-add-image").trigger("click");
				return waitFor(function () {
					return page.hasClass("site-map-editing");
				}).then(function () {
					assert.equal(picture.firstCall.args[1], OSApp.SiteMap.Constants.maxImageSize);
					assert.lengthOf(requestsTo("/um"), 0);
					assert.equal(remote.fp, OSApp.SiteMap.getFingerprint(image));
					page.find(".site-map-cancel").trigger("click");
					return loadCache();
				}).then(function (map) {
					assert.equal(map.image, image);
				});
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		// Makes saving a map on this device fail once it holds image, as when the device's storage is full
		function failToStore(image) {
			var set = OSApp.Storage.set;

			sandbox.stub(OSApp.Storage, "set").callsFake(function (data) {
				if (JSON.stringify(data).indexOf(image.split(",")[1].slice(0, 200)) >= 0) {
					throw new Error("QuotaExceededError");
				}
				return set.call(OSApp.Storage, data);
			});
		}

		it("should not send the fingerprint of an added image this device couldn't keep", function () {
			var image = jpeg("#39d");
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(image.split(",")[1]);
			});
			installDeviceController(null, { rev: 0, pins: {} });
			OSApp.SiteMap.save(siteName, { pins: {}, drawings: {}, rev: 0 });
			failToStore(image);

			return openHomeMap().then(function (page) {
				page.find(".site-map-add-image").trigger("click");
				return new Promise(function (resolve) {
					setTimeout(resolve, 300);
				}).then(function () {
					assert.lengthOf(requestsTo("/cmi"), 0);
					assert.equal(remote.fp, "");
					assert.notEqual(page.find(".site-map-image-el").attr("src"), image);
				});
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should keep the old image when this device can't keep the one picked while editing", function () {
			var image = jpeg("#2a6"),
				other = jpeg("#a26");
			installDeviceController(image);
			OSApp.SiteMap.save(siteName, { image: image, pins: { 0: { x: 0.5, y: 0.5 } }, drawings: {}, rev: 2, deviceImage: true });
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(other.split(",")[1]);
			});
			failToStore(other);

			return openHomeMap().then(function (page) {
				page.find(".site-map-edit").trigger("click");
				page.find(".site-map-image").trigger("click");
				page.find(".site-map-edit").trigger("click");
				return new Promise(function (resolve) {
					setTimeout(resolve, 300);
				}).then(function () {
					assert.equal(remote.fp, OSApp.SiteMap.getFingerprint(image));
					assert.equal(page.find(".site-map-image-el").attr("src"), image);
					assert.isTrue(OSApp.Errors.showError.calledWith(OSApp.Language._("Unable to save site map. The image may be too large.")));
					return loadCache();
				}).then(function (map) {
					assert.equal(map.image, image);
				});
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should not restore a backup's image that this device couldn't keep", function () {
			var image = jpeg();
			installDeviceController(null, { rev: 3, pins: {} });
			failToStore(image);

			return new Promise(function (resolve) {
				OSApp.SiteMap.restoreBackupData({ image: image, pins: { 0: { x: 0.5, y: 0.5 } } }, resolve);
			}).then(function (restored) {
				assert.isFalse(restored);
				assert.equal(remote.fp, "");
				assert.equal(remote.rev, 3);
			});
		});

		it("should keep an added image here when the controller took it but the reply was lost", function () {
			var image = jpeg("#39d");
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(image.split(",")[1]);
			});
			installDeviceController(null, { rev: 0, pins: {} });
			OSApp.SiteMap.save(siteName, { pins: {}, drawings: {}, rev: 0 });
			remote.loseReply = { "/cmi": 1 };

			return openHomeMap().then(function (page) {
				page.find(".site-map-add-image").trigger("click");
				return new Promise(function (resolve) {
					setTimeout(resolve, 300);
				});
			}).then(function () {
				assert.equal(remote.fp, OSApp.SiteMap.getFingerprint(image));
				return loadCache();
			}).then(function (map) {
				assert.equal(map.image, image);
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should keep this device's copy marked pending until a whole map has been sent", function () {
			var image = jpeg(),
				restore;
			installDeviceController(image);
			remote.after = function (path) {
				if (path === "/dm") {
					restore = switchController({ rev: 6 }, "Other Controller");
				}
			};

			return asNative(OSApp.SiteMap.uploadMap(siteName, { image: image, pins: { 0: { x: 0.5, y: 0.5 } }, drawings: {} })).then(function () {
				assert.fail("should stop");
			}, function (error) {
				assert.equal(error.statusText, "stale");
				return loadCache();
			}).then(function (map) {
				assert.isTrue(map.pending);
				assert.equal(map.image, image);
			}).finally(function () {
				if (restore) restore();
			});
		});

		it("should keep asking for the image when this device can't keep the one received", function () {
			var image = jpeg("#2a6");
			installDeviceController(image);
			sandbox.stub(OSApp.UIDom, "getPicture").callsFake(function (callback) {
				callback(jpeg("#000").split(",")[1], image);
			});
			failToStore(image);

			return openHomeMap().then(function (page) {
				var container = page.find(".site-map-container");

				page.find(".site-map-load-image").trigger("click");
				return new Promise(function (resolve) {
					setTimeout(resolve, 200);
				}).then(function () {
					assert.isTrue(container.hasClass("site-map-missing-image"));
					assert.isTrue(OSApp.Errors.showError.calledWith(OSApp.Language._("Unable to save site map. The image may be too large.")));
				});
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should share the image as a file another device can load", function () {
			var image = jpeg("#2a6"),
				download = sandbox.stub(OSApp.UIDom, "downloadBlob");
			installDeviceController(image);
			OSApp.SiteMap.save(siteName, { image: image, pins: {}, rev: 1 });

			return openHomeMap().then(function (page) {
				var share = page.find(".site-map-share");
				assert.isTrue(share.is(":visible"));
				share.trigger("click");
				assert.isTrue(download.calledOnce);
				assert.match(download.firstCall.args[1], /\.jpg$/);
				assert.equal(download.firstCall.args[0].type, "image/jpeg");
				return download.firstCall.args[0].arrayBuffer();
			}).then(function (buffer) {
				assert.deepEqual(Array.from(new Uint8Array(buffer)), Array.from(OSApp.SiteMap.dataURLToBytes(image)));
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		it("should not offer sharing when the controller stores the image", function () {
			installController({ rev: 1, pins: { 0: [5000, 5000] }, image: jpeg() });

			return openHomeMap().then(function (page) {
				assert.isFalse(page.find(".site-map-share").is(":visible"));
			}).finally(function () {
				OSApp.SiteMap.setHomeView("cards");
			});
		});

		describe("relay between apps", function () {

			it("should receive the image from another app a window at a time", function () {
				var image = detailedJpeg(),
					progress = [];
				installDeviceController(image, { relay: { autoSend: OSApp.SiteMap.dataURLToBytes(image) } });

				return asNative(OSApp.SiteMap.Relay.receive(remote.fp, function (status, bytes) {
					progress.push(bytes ? bytes.length : -1);
				}).promise).then(function (dataURL) {
					var sizes = progress.filter(function (size) {
						return size > 0;
					});
					assert.equal(dataURL, image);
					assert.isAbove(sizes.length, 2);
					assert.equal(sizes[sizes.length - 1], imageSize(image));
					assert.lengthOf(requestsTo("/mxd"), sizes.length);
					assert.deepEqual(remote.relay.receivers, []);
				});
			});

			it("should give up when no app with the image answers, leaving the queue", function () {
				var image = jpeg();
				OSApp.SiteMap.Constants.relayWaitLimit = 60;
				installDeviceController(image);

				return asNative(OSApp.SiteMap.Relay.receive(remote.fp, function () {}).promise).then(function () {
					assert.fail("should not receive");
				}, function (error) {
					assert.equal(error.reason, "timeout");
					assert.lengthOf(requestsTo("/mxc"), 1);
					assert.deepEqual(remote.relay.receivers, []);
				});
			});

			it("should stop when the image is replaced, or when cancelled", function () {
				var image = jpeg(),
					receiving;
				installDeviceController(image);

				receiving = OSApp.SiteMap.Relay.receive(remote.fp, function () {
					remote.fp = "0123456789abcdef0123456789abcdef";
				});
				return asNative(receiving.promise).then(function () {
					assert.fail("should not receive");
				}, function (error) {
					assert.equal(error.reason, "changed");
					remote.fp = OSApp.SiteMap.getFingerprint(image);
					receiving = OSApp.SiteMap.Relay.receive(remote.fp, function () {});
					receiving.cancel();
					return asNative(receiving.promise);
				}).then(function () {
					assert.fail("should not receive");
				}, function (error) {
					assert.equal(error.reason, "cancelled");
					assert.deepEqual(remote.relay.receivers, []);
				});
			});

			it("should try again, then give up, when the image received isn't the one asked for", function () {
				var image = jpeg();
				installDeviceController(image, { relay: { autoSend: OSApp.SiteMap.dataURLToBytes(jpeg("#123")) } });
				remote.imageSize = remote.relay.autoSend.length;

				return asNative(OSApp.SiteMap.Relay.receive(remote.fp, function () {}).promise).then(function () {
					assert.fail("should not receive");
				}, function (error) {
					assert.equal(error.reason, "mismatch");
					assert.isAtLeast(requestsTo("/mxd").length, 2);
				});
			});

			it("should carry on receiving after failed requests and lost replies", function () {
				var image = detailedJpeg();
				OSApp.SiteMap.Constants.relayRetryDelay = 5;
				installDeviceController(image, { relay: { autoSend: OSApp.SiteMap.dataURLToBytes(image) } });
				remote.fail = { "/mxd": 1, "/mxr": 1 };
				remote.loseReply = { "/mxa": 2 };

				return asNative(OSApp.SiteMap.Relay.receive(remote.fp, function () {}).promise).then(function (dataURL) {
					assert.equal(dataURL, image);
					assert.deepEqual(remote.loseReply, { "/mxa": 0 });
					assert.equal(remote.fail["/mxd"], 0);
				});
			});

			it("should give up receiving after too many failed requests in a row", function () {
				var image = jpeg();
				OSApp.SiteMap.Constants.relayRetries = 2;
				OSApp.SiteMap.Constants.relayRetryDelay = 5;
				installDeviceController(image);
				remote.fail = { "/mxr": 10 };

				return asNative(OSApp.SiteMap.Relay.receive(remote.fp, function () {}).promise).then(function () {
					assert.fail("should not receive");
				}, function (error) {
					assert.equal(error.status, 0);
					assert.lengthOf(requestsTo("/mxr"), 3);
				});
			});

			it("should give up receiving when downloads keep failing, though asking where things stand works", function () {
				var image = detailedJpeg();
				OSApp.SiteMap.Constants.relayRetries = 2;
				OSApp.SiteMap.Constants.relayRetryDelay = 5;
				installDeviceController(image, { relay: { autoSend: OSApp.SiteMap.dataURLToBytes(image) } });
				remote.fail = { "/mxd": 50 };

				return asNative(OSApp.SiteMap.Relay.receive(remote.fp, function () {}).promise).then(function () {
					assert.fail("should not receive");
				}, function (error) {
					assert.equal(error.status, 0);
					assert.lengthOf(requestsTo("/mxd"), 3);
				});
			});

			it("should not tell the controller picked since that receiving stopped", function () {
				var image = jpeg(),
					previous = OSApp.currentSession.controller,
					switchedAt;
				installDeviceController(image);

				return asNative(OSApp.SiteMap.Relay.receive(remote.fp, function () {
					if (switchedAt === undefined) {
						OSApp.currentSession.controller = $.extend(true, {}, previous);
						switchedAt = requests.length;
					}
				}).promise).then(function () {
					assert.fail("should not receive");
				}, function (error) {
					assert.equal(error.reason, "cancelled");

					// The app's own status refreshes (/ja) carry on regardless
					assert.lengthOf(requests.slice(switchedAt).filter(function (request) {
						return request.path !== "/ja";
					}), 0);
				}).finally(function () {
					OSApp.currentSession.controller = previous;
				});
			});

			it("should not confirm a batch to the controller picked while it was downloading", function () {
				var image = detailedJpeg(),
					previous = OSApp.currentSession.controller,
					switchedAt;
				installDeviceController(image, { relay: { autoSend: OSApp.SiteMap.dataURLToBytes(image), delay: 100 } });

				setTimeout(function () {
					OSApp.currentSession.controller = $.extend(true, {}, previous);
					switchedAt = requests.length;
				}, 50);
				return asNative(OSApp.SiteMap.Relay.receive(remote.fp, function () {}).promise).then(function () {
					assert.fail("should not receive");
				}, function (error) {
					assert.equal(error.reason, "cancelled");

					// The app's own status refreshes (/ja) carry on regardless
					assert.lengthOf(requests.slice(switchedAt).filter(function (request) {
						return request.path !== "/ja";
					}), 0);
				}).finally(function () {
					OSApp.currentSession.controller = previous;
				});
			});

			it("should carry on sending after failed requests and lost replies", function () {
				var image = detailedJpeg(),
					received = [];
				OSApp.SiteMap.Constants.relayRetryDelay = 5;
				installDeviceController(image, { relay: { autoReceive: received } });
				remote.relay.receivers = ["0000beef"];
				remote.relay.state = 1;
				remote.fail = { "/mxs": 1 };
				remote.loseReply = { "/mxu": 3 };
				OSApp.SiteMap.save(siteName, { image: image, pins: {}, rev: 2, deviceImage: true });
				OSApp.currentSession.controller.options.smx = 1;
				$("html").trigger("datarefresh");

				return waitFor(function () {
					return received.length === imageSize(image) && !OSApp.SiteMap.Relay.sending;
				}).then(function () {
					assert.deepEqual(received, Array.from(OSApp.SiteMap.dataURLToBytes(image)));
					assert.deepEqual(remote.loseReply, { "/mxu": 0 });
				});
			});

			it("should finish when the reply to the last confirmation is lost, instead of asking again", function () {
				var image = detailedJpeg();
				OSApp.SiteMap.Constants.relayRetryDelay = 5;
				OSApp.SiteMap.Constants.relayWaitLimit = 300;
				installDeviceController(image, { relay: { autoSend: OSApp.SiteMap.dataURLToBytes(image) } });

				return asNative(OSApp.SiteMap.Relay.receive(remote.fp, function (status, bytes) {
					if (bytes && bytes.length === imageSize(image)) {
						remote.loseReply = { "/mxa": 1 };
					}
				}).promise).then(function (dataURL) {
					assert.equal(dataURL, image);
					assert.deepEqual(remote.loseReply, { "/mxa": 0 });
					assert.deepEqual(remote.relay.receivers, []);
				});
			});

			it("should not send again after sending is cancelled, until another app asks", function () {
				var image = detailedJpeg();
				installDeviceController(image, { relay: { win: 1200 } });
				remote.relay.receivers = ["0000beef"];
				remote.relay.state = 1;
				OSApp.SiteMap.save(siteName, { image: image, pins: {}, rev: 2, deviceImage: true });
				OSApp.currentSession.controller.options.smx = 1;
				$("html").trigger("datarefresh");

				return waitFor(function () {
					return $(".site-map-relay-status a").length;
				}).then(function () {
					$(".site-map-relay-status a").trigger("click");
					return waitFor(function () {
						return !OSApp.SiteMap.Relay.sending;
					});
				}).then(function () {
					requests = [];
					$("html").trigger("datarefresh");
					return OSApp.SiteMap.Relay.wait(50);
				}).then(function () {
					assert.lengthOf(requestsTo("/mxs"), 0);
					assert.isNull(OSApp.SiteMap.Relay.sending);

					// Once nobody is waiting, the next app to ask gets the image again
					OSApp.currentSession.controller.options.smx = 0;
					$("html").trigger("datarefresh");
					OSApp.currentSession.controller.options.smx = 1;
					$("html").trigger("datarefresh");
					return waitFor(function () {
						return requestsTo("/mxs").length;
					});
				}).then(function () {
					OSApp.SiteMap.Relay.sending.cancelled = true;
					return waitFor(function () {
						return !OSApp.SiteMap.Relay.sending;
					});
				});
			});

			it("should not ask the controller again for an image that didn't match, until something changes", function () {
				var image = jpeg("#2a6");
				installDeviceController(image);
				remote.relay.receivers = ["0000beef"];
				remote.relay.state = 1;
				OSApp.SiteMap.save(siteName, { image: jpeg("#a26"), pins: {}, rev: 2 });
				OSApp.currentSession.controller.options.smx = 1;
				$("html").trigger("datarefresh");

				return waitFor(function () {
					return requestsTo("/jm").length && !OSApp.SiteMap.Relay.sending;
				}).then(function () {
					requests = [];
					$("html").trigger("datarefresh");
					return OSApp.SiteMap.Relay.wait(50);
				}).then(function () {
					assert.lengthOf(requestsTo("/jm"), 0);

					// The controller's map changed, so it is checked again
					OSApp.currentSession.controller.options.smap++;
					$("html").trigger("datarefresh");
					return waitFor(function () {
						return requestsTo("/jm").length && !OSApp.SiteMap.Relay.sending;
					});
				});
			});

			it("should send this app's image when another app is waiting for it", function () {
				var image = detailedJpeg(),
					received = [];
				installDeviceController(image, { relay: { autoReceive: received } });
				remote.relay.receivers = ["0000beef"];
				remote.relay.state = 1;
				OSApp.SiteMap.save(siteName, { image: image, pins: {}, rev: 2, deviceImage: true });
				var shown = sandbox.spy(OSApp.SiteMap.Relay, "showSending");
				OSApp.currentSession.controller.options.smx = 1;
				$("html").trigger("datarefresh");

				return waitFor(function () {
					return received.length === imageSize(image) && !OSApp.SiteMap.Relay.sending;
				}).then(function () {
					assert.isTrue(shown.calledWith(sinon.match.number));
					assert.isTrue(shown.calledWith(null));
					assert.deepEqual(received, Array.from(OSApp.SiteMap.dataURLToBytes(image)));
					requestsTo("/mxu").forEach(function (request) {
						assert.isAtMost(atob(request.body).length, remote.relay.req);
					});
					assert.lengthOf($(".site-map-relay-status"), 0);
				});
			});

			it("should not send a different image, or while another app is sending", function () {
				var image = jpeg("#2a6");
				installDeviceController(image);
				remote.relay.receivers = ["0000beef"];
				remote.relay.state = 1;
				OSApp.SiteMap.save(siteName, { image: jpeg("#a26"), pins: {}, rev: 2 });
				OSApp.currentSession.controller.options.smx = 1;
				$("html").trigger("datarefresh");

				return waitFor(function () {
					return requestsTo("/jm").length && !OSApp.SiteMap.Relay.sending;
				}).then(function () {
					assert.lengthOf(requestsTo("/mxs"), 0);

					remote.relay.sender = "0000cafe";
					OSApp.SiteMap.save(siteName, { image: image, pins: {}, rev: 2 });
					requests = [];
					$("html").trigger("datarefresh");
					return waitFor(function () {
						return requestsTo("/mxs").length && !OSApp.SiteMap.Relay.sending;
					});
				}).then(function () {
					assert.lengthOf(requestsTo("/mxu"), 0);
				});
			});

			it("should not show part of an image received for a site no longer picked", function () {
				var image = detailedJpeg(),
					other = jpeg("#123"),
					received = $.Deferred(),
					probes = [],
					restore, onStatus;

				installDeviceController(image);
				sandbox.stub(OSApp.SiteMap.Relay, "receive").callsFake(function (fp, status) {
					onStatus = status;
					return { promise: received.promise(), cancel: function () {
						received.reject({ reason: "cancelled" });
					} };
				});

				return openHomeMap().then(function (page) {
					var img = page.find(".site-map-image-el"),
						RealImage = window.Image;

					page.find(".site-map-get-image").trigger("click");

					// The part received starts decoding, and finishes after another site is picked
					window.Image = function () {
						var probe = { naturalWidth: 160 };
						probes.push(probe);
						return probe;
					};
					try {
						onStatus({ pos: 0, st: OSApp.SiteMap.Relay.FILLING, off: 100, tot: 1000 },
							OSApp.SiteMap.dataURLToBytes(image).subarray(0, 1000));
					} finally {
						window.Image = RealImage;
					}
					restore = switchController({ rev: 6, pins: { 1: [1000, 1000] }, image: other }, "Other Controller");
					$("html").trigger("datarefresh");
					return waitFor(function () {
						return img.attr("src") === other;
					}).then(function () {
						probes[0].onload();
						received.reject({ reason: "cancelled" });
						return new Promise(function (resolve) {
							setTimeout(resolve, 100);
						});
					}).then(function () {
						assert.equal(img.attr("src"), other);
					});
				}).finally(function () {
					if (restore) restore();
					OSApp.SiteMap.setHomeView("cards");
				});
			});

			it("should fill the map in as the image arrives, then keep it", function () {
				var image = detailedJpeg(),
					fillIns = 0,
					endings = [];
				installDeviceController(image, { relay: { win: 1200, delay: 60 } });

				return openHomeMap().then(function (page) {
					var container = page.find(".site-map-container"),
						img = page.find(".site-map-image-el");

					page.find(".site-map-get-image").trigger("click");
					assert.isTrue(container.hasClass("site-map-receiving"));
					assert.match(page.find(".site-map-missing-text").text(), /Waiting for a device/);
					assert.isTrue(page.find(".site-map-relay-cancel").is(":visible"));

					// Another app starts sending
					remote.relay.autoSend = OSApp.SiteMap.dataURLToBytes(image);
					img.on("load.test", function () {
						var src = img.attr("src");

						if (/^blob:/.test(src)) {
							fillIns++;

							// Chrome draws nothing on screen for a JPEG cut short, but draws the rows that arrived
							// when the data ends with an end-of-image marker
							endings.push(fetch(src).then(function (response) {
								return response.arrayBuffer();
							}).then(function (buffer) {
								var data = new Uint8Array(buffer);
								return data[data.length - 2] === 0xFF && data[data.length - 1] === 0xD9;
							}, function () {
								return null;
							}));
						}
					});
					return waitFor(function () {
						return container.hasClass("site-map-previewing");
					}).then(function () {
						assert.match(page.find(".site-map-missing-text").text(), /Receiving image \d+%/);
						assert.isTrue(page.find(".site-map-pin").is(":visible"));
						return waitFor(function () {
							return img.attr("src") === image;
						});
					}).then(function () {
						img.off("load.test");
						assert.isAbove(fillIns, 0);
						return Promise.all(endings);
					}).then(function (ended) {
						assert.include(ended, true);
						assert.notInclude(ended, false);
						assert.isFalse(container.hasClass("site-map-missing-image"));
						assert.isFalse(container.hasClass("site-map-receiving"));
						return loadCache();
					}).then(function (map) {
						assert.equal(map.image, image);
					});
				});
			}).timeout(8000);

			it("should draw the top of an image that has only partly arrived", function () {
				var bytes = OSApp.SiteMap.dataURLToBytes(detailedJpeg()),
					url = URL.createObjectURL(new Blob([bytes.subarray(0, Math.round(bytes.length * 0.4))], { type: "image/jpeg" })),
					probe = new Image();

				return new Promise(function (resolve, reject) {
					probe.onload = resolve;
					probe.onerror = function () {
						reject(new Error("a partial JPEG didn't load"));
					};
					probe.src = url;
				}).then(function () {
					assert.equal(probe.naturalWidth, 160);
				}).finally(function () {
					URL.revokeObjectURL(url);
				});
			});
		});
	});
});

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

describe("Home Layout Checks", function () {

	// Renders a minimal home page with the app's stylesheets in a frame of the given width, so the
	// phone layout rules apply even though the test window is wider
	function renderHome(width) {
		return new Promise(function (resolve, reject) {
			var frame = document.createElement("iframe");
			frame.style.cssText = "position:absolute;left:-10000px;top:0;height:800px;border:0;width:" + width + "px";
			frame.srcdoc = "<!doctype html><html class='ui-mobile'><head>" +
				"<link rel='stylesheet' href='/base/www/css/jqm.css'>" +
				"<link rel='stylesheet' href='/base/www/css/main.css'>" +
				"</head><body class='ui-mobile-viewport'>" +
				"<div id='sprinklers' class='ui-page ui-page-theme-a ui-page-active'><div class='ui-content' role='main'>" +
					"<div id='os-stations-list' class='card-group center'>" +
						"<div class='ui-corner-all card'><div class='ui-body ui-body-a center'>Station 1</div></div>" +
					"</div>" +
					"<div id='os-sensors-home' class='card-group'>" +
						"<div class='ui-corner-all card'><div class='ui-body ui-body-a center'>Sensor 1</div></div>" +
					"</div>" +
				"</div></div>" +
				"</body></html>";
			frame.onload = function () {
				var doc = frame.contentDocument,
					content = doc.querySelector("#sprinklers .ui-content"),
					style = frame.contentWindow.getComputedStyle(content),
					card = doc.querySelector("#os-stations-list .card");

				resolve({
					frame: frame,
					contentWidth: content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
					contentPaddingBottom: parseFloat(style.paddingBottom),
					listPaddingBottom: parseFloat(frame.contentWindow.getComputedStyle(doc.querySelector("#os-stations-list")).paddingBottom),
					cardWidth: card.getBoundingClientRect().width
				});
			};
			frame.onerror = reject;
			document.body.appendChild(frame);
		});
	}

	it("should use the full width for cards on phones and leave room to scroll clear of the menu button", function () {
		return renderHome(390).then(function (layout) {
			try {
				assert.closeTo(layout.cardWidth, layout.contentWidth, 1);

				// The room goes after the last section, not under the station list
				assert.isAbove(layout.contentPaddingBottom, 100);
				assert.equal(layout.listPaddingBottom, 0);
			} finally {
				layout.frame.remove();
			}
		});
	});

	it("should not cap card width anywhere in the phone range", function () {
		return renderHome(640).then(function (layout) {
			try {
				assert.closeTo(layout.cardWidth, layout.contentWidth, 1);
			} finally {
				layout.frame.remove();
			}
		});
	});

	it("should keep the narrower cards and normal padding above the phone breakpoint", function () {
		return renderHome(700).then(function (layout) {
			try {
				assert.isBelow(layout.cardWidth, layout.contentWidth - 20);
				assert.isBelow(layout.contentPaddingBottom, 30);
			} finally {
				layout.frame.remove();
			}
		});
	});

	it("should size the page again after it is shown, once the header and footer padding is in place", function (done) {
		var reset = sinon.stub($.mobile, "resetActivePageHeight"),
			page = $("<div data-role='page' id='layout-test-page' class='ui-page ui-page-active'></div>").appendTo("body"),
			finish = function (error) {
				reset.restore();
				page.trigger("pagehide").remove();
				done(error);
			};

		page.trigger("pageshow");

		// Not just during the event, when the padding may still be missing, but once more right after it
		var duringEvent = reset.callCount;
		setTimeout(function () {
			try {
				assert.equal(reset.callCount, duringEvent + 1);
				finish();
			} catch (error) {
				finish(error);
			}
		}, 20);
	});

	it("should not resize a page that is no longer showing", function (done) {
		var reset = sinon.stub($.mobile, "resetActivePageHeight"),
			page = $("<div data-role='page' id='layout-test-page' class='ui-page ui-page-active'></div>").appendTo("body");

		page.trigger("pageshow");
		var duringEvent = reset.callCount;
		page.removeClass($.mobile.activePageClass);
		setTimeout(function () {
			var later = reset.callCount;
			reset.restore();
			page.trigger("pagehide").remove();
			try {
				assert.equal(later, duringEvent);
				done();
			} catch (error) {
				done(error);
			}
		}, 20);
	});
});

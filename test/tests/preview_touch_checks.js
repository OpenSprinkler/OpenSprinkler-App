/* eslint-disable */
describe("Preview touch details", function () {
	var clock, element, details;
	function touch(type, x, count) {
		var event = new Event(type, {bubbles: true, cancelable: true});
		Object.defineProperty(event, "touches", {value: Array.from({length: count === undefined ? 1 : count}, function () {
			return {clientX: x || 100, clientY: 100, pageX: x || 100, pageY: 100};
		})});
		element.dispatchEvent(event);
	}
	beforeEach(function () {
		clock = sinon.useFakeTimers();
		element = document.createElement("div"); document.body.appendChild(element);
		details = OSApp.Programs.bindPreviewTouchDetails({setSelection: function () {}, getEventProperties: function () {return {item: 0};}}, element,
			[{id: 0, previewDetails: "Start Time: 06:30:00\nRun Time: 5m"}]);
	});
	afterEach(function () { details.destroy(); element.remove(); clock.restore(); });
	it("shows details after 500ms and suppresses release navigation", function () {
		touch("touchstart"); clock.tick(499);
		assert.equal($(".preview-touch-details").css("display"), "none");
		clock.tick(1);
		assert.include($(".preview-touch-details").text(), "06:30:00");
		assert.notEqual($(".preview-touch-details").css("display"), "none");
		touch("touchend", 100, 0);
		assert.isTrue(details.suppressesSelection());
		touch("touchstart"); touch("touchend", 100, 0);
		assert.isFalse(details.suppressesSelection());
	});
	it("preserves ordinary tap navigation", function () {
		touch("touchstart"); clock.tick(100); touch("touchend", 100, 0); clock.tick(500);
		assert.isFalse(details.suppressesSelection());
		assert.equal($(".preview-touch-details").css("display"), "none");
	});
	it("distinguishes timeline press selection from tap before touchend", function () {
		touch("touchstart"); clock.tick(100);
		assert.isTrue(details.suppressesSelection({type: "press"}));
		assert.isFalse(details.suppressesSelection({type: "tap"}));
	});
	it("cancels when dragging or adding another finger", function () {
		touch("touchstart"); touch("touchmove", 120); clock.tick(500);
		assert.equal($(".preview-touch-details").css("display"), "none");
		touch("touchstart"); touch("touchstart", 100, 2); clock.tick(500);
		assert.equal($(".preview-touch-details").css("display"), "none");
	});
	it("dismisses on outside touch and cleans up pending timers", function () {
		touch("touchstart"); clock.tick(500);
		var event = new Event("touchstart", {bubbles: true});
		Object.defineProperty(event, "touches", {value: [{clientX: 0, clientY: 0}]});
		document.body.dispatchEvent(event);
		assert.equal($(".preview-touch-details").css("display"), "none");
		touch("touchstart"); details.destroy(); clock.tick(500);
		assert.lengthOf($(".preview-touch-details"), 0);
	});
});

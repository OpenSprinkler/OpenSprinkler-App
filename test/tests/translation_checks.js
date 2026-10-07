/* global describe, beforeEach, afterEach, it, sinon, OSApp, $, assert */
describe("Compiled translation dictionaries", function() {
	var sandbox, previousLanguage, previousCode;
	beforeEach(function() {
		sandbox = sinon.createSandbox();
		previousLanguage = OSApp.uiState.language;
		previousCode = OSApp.currentSession.lang;
		sandbox.stub(OSApp.Storage, "set");
		sandbox.stub(OSApp.UIDom, "getAppURLPath").returns("/base/www/");
		sandbox.stub(OSApp.Language, "setLang");
	});
	afterEach(function() {
		sandbox.restore();
		OSApp.uiState.language = previousLanguage;
		OSApp.currentSession.lang = previousCode;
	});
	["de", "zh", "he", "ta"].forEach(function(language) {
		it("loads the merged " + language + " dictionary with no second request", async function() {
			var store = await fetch("/base/www/locale/" + language + ".js").then(function(response) { return response.json(); });
			var request = sandbox.stub($, "getJSON").callsFake(function(url, callback) {
				callback(store);
				return $.Deferred().resolve(store).promise();
			});
			OSApp.Language.updateLang(language);
			assert.isTrue(request.calledOnceWithExactly("/base/www/locale/" + language + ".js", sinon.match.func));
			assert.equal(OSApp.Language._("Network"), store.messages.Network);
			assert.notEqual(OSApp.Language._("Network"), "Network");
			assert.equal(OSApp.Language._("Station"), store.messages.Station);
			assert.equal(OSApp.Language._("Missing translation fixture"), "Missing translation fixture");
		});
	});
	it("falls back to English when a language request fails", function() {
		OSApp.uiState.language = {Network: "Previous language"};
		sandbox.stub($, "getJSON").returns($.Deferred().reject().promise());
		OSApp.Language.updateLang("de");
		assert.equal(OSApp.Language._("Network"), "Network");
		assert.isTrue(OSApp.Language.setLang.calledOnce);
	});
	it("uses English without requesting any dictionary", function() {
		var request = sandbox.stub($, "getJSON");
		OSApp.Language.updateLang("en");
		assert.isFalse(request.called);
		assert.equal(OSApp.Language._("Network"), "Network");
	});
});

"use strict";

const {test, beforeEach, afterEach} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const t = require("../translations.cjs");
let root;
const save = (file, content) => {
	const target = path.join(root, file);
	fs.mkdirSync(path.dirname(target), {recursive: true});
	fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content));
};
const load = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), "os-translations-"));
	save("www/js/example.js", 'OSApp.Language._("Station"); OSApp.Language._("Master");');
	save("www/index.html", '<div data-translate="Empty"></div>');
	save("www/locale/de.js", {messages: {Station: "Station", Empty: ""}});
	save("translations/glossary.json", {version: 1, doNotTranslate: ["MQTT"]});
	t.bootstrap(root);
	t.main(["extract"], root);
});
afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

test("bootstrap protects the exact existing human values and refuses a second run", () => {
	assert.deepEqual(load("translations/human/de.json"), load("www/locale/de.js"));
	assert.throws(() => t.bootstrap(root), /already exist/);
});

test("JSON rejects duplicate keys at every level", () => {
	assert.throws(() => t.parseJSON('{"messages":{"A":"a","A":"b"}}'), /duplicate key/);
	assert.throws(() => t.parseJSON('{"messages":{},"messages":{}}'), /duplicate key/);
});

test("extracts literal and static-template JS, decoded HTML, and translator notes", () => {
	save("www/js/example.js", '// TRANSLATORS: Irrigation output.\nOSApp.Language._("Station");\nOSApp.Language._(`Master`);\nOSApp.Language._(variable);');
	save("www/index.html", "<div data-translate='Rain &amp; Soil'></div>");
	const result = t.extract(root);
	assert.deepEqual(Object.keys(result.messages), ["Master", "Rain & Soil", "Station"]);
	assert.match(result.messages.Station.notes[0], /Irrigation output/);
	assert.equal(result.issues[0].kind, "dynamic-key");
	assert.equal(result.issues[0].line, 4);
});

test("source line shifts do not invalidate context hashes", () => {
	assert.equal(t.contextHash({references: ["app.js:1"], notes: []}), t.contextHash({references: ["app.js:99"], notes: []}));
	assert.notEqual(t.contextHash({references: ["app.js:1"], notes: []}), t.contextHash({references: ["app.js:1"], notes: ["Changed meaning"]}));
});

test("extracts concatenated constant messages as a single key", () => {
	save("www/js/example.js", 'OSApp.Language._("First sentence. " + "Second sentence.");');
	assert.ok(t.extract(root).messages["First sentence. Second sentence."]);
});

test("extracts marked indirect literals and table values without evaluating them", () => {
	save("www/js/example.js", `
		const fallback = /* i18n-extract */ "Loading sensor data";
		const labels = /* i18n-extract */ ["Cycle queued", "Soaking"];
		const methods = /* i18n-extract */ [{name: "Manual", id: 0}, {name: "Monthly", id: 4}];
		const reasons = /* i18n-extract */ {0: "None", 1: "Factory Reset"};
		OSApp.Language._(labels[state]);
	`);
	const catalog = t.extract(root);
	for (const key of ["Loading sensor data", "Cycle queued", "Soaking", "Manual", "Monthly", "None", "Factory Reset"]) {
		assert.ok(catalog.messages[key], key);
	}
	assert.equal(catalog.messages.name, undefined);
	assert.equal(catalog.messages.id, undefined);
	assert.equal(catalog.messages["0"], undefined);
	assert.equal(catalog.issues.filter(issue => issue.kind === "dynamic-key").length, 1);
});

test("misplaced extraction markers fail instead of silently losing strings", () => {
	save("www/js/example.js", 'const label = /* i18n-extract */ getLabel();');
	assert.throws(() => t.extract(root), /must precede/);
});

test("concatenation audit ignores HTML wrappers but keeps sentences with variables", () => {
	save("www/js/example.js", `
		const html = "<label>" + OSApp.Language._("Network") + "</label>" +
			"<input title='" + OSApp.Language._("Hostname") + "'>";
		const sentence = OSApp.Language._("Run for") + " " + minutes + " " + OSApp.Language._("minutes");
		const master = OSApp.Language._("Use Master") + " " + number;
	`);
	const keys = t.extract(root).issues.filter(issue => issue.kind === "concatenation-candidate").map(issue => issue.key);
	assert.deepEqual(keys, ["Run for", "minutes", "Use Master"]);
});

test("repository catalog retains live indirect progress, warning, and metadata strings", () => {
	const catalog = t.extract(path.resolve(__dirname, "../.."));
	for (const key of ["Loading sensor data", "Retrieving sensor logs", "Deleting sensor log", "Loading log data",
		"About %d minute remaining", "About %d minutes remaining", "Cycle queued", "Cycle running", "Soaking",
		"Cycle paused", "Master finishing", "Factory Reset", "Power On", "Sun", "Sat", "Monthly", "Afrikaans",
		"disabled program hidden. Tap 'Show Disabled' in the footer menu to view",
		"disabled programs hidden. Tap 'Show Disabled' in the footer menu to view",
		"This action can take a while depending on the number of log records.",
		"This may take several minutes. Deleting a sensor's log does not free log capacity; use this only when you need to reset this sensor's recorded history."]) {
		assert.ok(catalog.messages[key], key);
	}
});

test("formatting validation preserves tokens and rejects injected markup", () => {
	assert.deepEqual(t.validateTranslation("Hello %s {name}", "Hallo {name} %s"), []);
	assert.throws(() => t.validateTranslation("Hello %s", "Hallo"), /tokens/);
	assert.throws(() => t.validateTranslation("Hello", '<img src=x onerror="alert(1)">'), /tokens/);
	for (const markup of ["<img src=x onerror=alert()", "</div", "<!--", "<!doctype html", "<?xml"]) {
		assert.throws(() => t.validateTranslation("Hello", markup), /Markup/);
	}
	assert.throws(() => t.validateTranslation("MQTT", "Other", {doNotTranslate: ["MQTT"]}), /Protected term/);
	assert.throws(() => t.validateTranslation("Station", " "), /Empty/);
	assert.throws(() => t.validateTranslation("Run for 240 minutes", "Run for 24 minutes"), /Numeric/);
	assert.throws(() => t.validateTranslation("Station {0}", "Station"), /tokens/);
	assert.throws(() => t.validateTranslation("<b>Station</b>", "</b>Station<b>"), /Markup order/);
});

test("shared words and different punctuation are warnings or valid, not blockers", () => {
	assert.deepEqual(t.validateTranslation("Station", "Station"), ["same-as-English"]);
	assert.deepEqual(t.validateTranslation("Station:", "Station"), []);
	assert.deepEqual(t.validateTranslation("Move left", "Muovi <-"), []);
	assert.deepEqual(t.validateTranslation("Less than 5", "<5"), []);
});

test("terminology checks use source words, language-specific mappings and explicit exceptions", () => {
	const glossary = {
		languages: {zh: {Station: "浇水站"}},
		terminologyChecks: {zh: [{sourceTerms: ["station", "stations"], avoid: ["站点"], preferredTerm: "Station", exceptions: ["Station exception"]}]}
	};
	assert.deepEqual(t.terminologyWarnings("STATIONS", "站点", "zh", glossary), [{found: ["站点"], preferred: "浇水站"}]);
	for (const source of ["Manage Sites", "Stationary", "Station exception"]) {
		assert.deepEqual(t.terminologyWarnings(source, "站点", "zh", glossary), []);
	}
	assert.deepEqual(t.terminologyWarnings("Station", "浇水站", "zh", glossary), []);
	assert.deepEqual(t.terminologyWarnings("Station", "站点", "de", glossary), []);
});

test("terminology warnings inspect effective overrides, human and machine text without blocking builds", () => {
	const glossary = load("translations/glossary.json");
	glossary.languages = {de: {Station: "Station", Master: "Master"}};
	glossary.terminologyChecks = {de: [
		{sourceTerms: ["station", "master"], avoid: ["Wrong"], preferredTerm: "Station", exceptions: []}
	]};
	save("translations/glossary.json", glossary);
	save("translations/human/de.json", {messages: {Station: "Wrong human", Empty: ""}});
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Wrong machine"}});
	t.compile(root);
	assert.equal(t.coverage(root)[0].terminologyWarnings.length, 2);
	save("translations/overrides/de.json", {messages: {Station: "Correct station", Master: "Wrong override"}});
	t.compile(root);
	const warnings = t.coverage(root)[0].terminologyWarnings;
	assert.equal(warnings.length, 1);
	assert.equal(warnings[0].key, "Master");
	assert.equal(warnings[0].text, "Wrong override");
	assert.equal(t.compile(root, true), 1);
});

test("human beats machine, empty human uses machine, missing uses runtime English fallback", () => {
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Station: "Must not overwrite", Master: "Hauptventil", Empty: "Leer"}});
	t.compile(root);
	assert.deepEqual(load("www/locale/de.js").messages, {Empty: "Leer", Master: "Hauptventil", Station: "Station"});
	assert.equal(load("translations/machine/de.json").messages.Station, undefined);
	assert.equal(t.compile(root, true), 1);
});

test("compile is deterministic and detects stale runtime files", () => {
	t.compile(root);
	const first = fs.readFileSync(path.join(root, "www/locale/de.js"), "utf8");
	t.compile(root);
	assert.equal(fs.readFileSync(path.join(root, "www/locale/de.js"), "utf8"), first);
	save("www/locale/de.js", {messages: {Station: "tampered"}});
	assert.throws(() => t.compile(root, true), /Stale/);
});

test("optional local overrides beat human and machine without changing either source", () => {
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Machine master"}});
	const human = load("translations/human/de.json"), machine = load("translations/machine/de.json");
	save("translations/overrides/de.json", {messages: {Station: "Local station", Master: "Local master"}});
	t.compile(root);
	assert.equal(load("www/locale/de.js").messages.Station, "Local station");
	assert.equal(load("www/locale/de.js").messages.Master, "Local master");
	assert.deepEqual(load("translations/human/de.json"), human);
	assert.deepEqual(load("translations/machine/de.json"), machine);
	assert.equal(t.coverage(root)[0].overrides, 2);
	assert.deepEqual(t.coverage(root)[0].review, []);
	assert.equal(t.prepareRequest(root, "de", path.join(root, "request.json")), 1);
	assert.equal(t.importMachine(root, {language: "de", generator: "test/v2", messages: {Master: "Replacement"}}), 0);
	fs.unlinkSync(path.join(root, "translations/overrides/de.json"));
	t.compile(root);
	assert.equal(load("www/locale/de.js").messages.Station, "Station");
	assert.equal(load("www/locale/de.js").messages.Master, "Machine master");
});

test("PO import reports conflicts but retains local overrides and accepts other human improvements", () => {
	save("translations/overrides/de.json", {messages: {Station: "Approved station"}});
	save("translations/incoming/messages_de.po", 'msgid "Station"\nmsgstr "Incoming station"\n\nmsgid "Empty"\nmsgstr "New human translation"\n');
	const warnings = [], originalWarn = console.warn;
	console.warn = message => warnings.push(message);
	try { t.importPO(root); } finally { console.warn = originalWarn; }
	assert.equal(load("translations/human/de.json").messages.Station, "Incoming station");
	assert.equal(load("www/locale/de.js").messages.Station, "Approved station");
	assert.equal(load("www/locale/de.js").messages.Empty, "New human translation");
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /de:.*Station.*Approved station.*Incoming station/);
	assert.equal(load("translations/overrides/de.json").messages.Station, "Approved station");
});

test("languages without overrides still accept revised human translations", () => {
	save("translations/incoming/messages_de.po", 'msgid "Station"\nmsgstr "Revised human station"\n');
	t.importPO(root);
	assert.equal(load("www/locale/de.js").messages.Station, "Revised human station");
	assert.equal(t.coverage(root)[0].overrides, 0);
});

test("PO import preserves literal less-than characters in Italian translations", () => {
	save("translations/human/it.json", {messages: {"Move left": ""}});
	save("translations/incoming/messages_it.po", 'msgid "Move left"\nmsgstr "Muovi <-"\n');
	assert.equal(t.importPO(root), 1);
	assert.equal(load("translations/human/it.json").messages["Move left"], "Muovi <-");
	assert.equal(load("www/locale/it.js").messages["Move left"], "Muovi <-");
	assert.equal(t.compile(root, true), 2);
});

test("override validation rejects empty, malformed, unsafe, and unknown-locale sources before writes", () => {
	t.compile(root);
	const before = fs.readFileSync(path.join(root, "www/locale/de.js"), "utf8");
	for (const value of ["", "<script>bad</script>", 123]) {
		save("translations/overrides/de.json", {messages: {Station: value}});
		assert.throws(() => t.compile(root));
		assert.equal(fs.readFileSync(path.join(root, "www/locale/de.js"), "utf8"), before);
	}
	save("translations/overrides/de.json", {messages: {"Hello %s": "Hallo"}});
	assert.throws(() => t.compile(root), /tokens/);
	save("translations/overrides/de.json", '{"messages":{"Station":"one","Station":"two"}}');
	assert.throws(() => t.compile(root), /duplicate key/);
	save("translations/overrides/de.json", {messages: {Station: "Approved"}});
	save("translations/overrides/unknown.json", {messages: {Station: "Unknown"}});
	assert.throws(() => t.compile(root), /matching human source/);
});

test("invalid override prevents PO import from modifying human sources", () => {
	const before = load("translations/human/de.json");
	save("translations/overrides/de.json", {messages: {Station: ""}});
	save("translations/incoming/messages_de.po", 'msgid "Station"\nmsgstr "Changed"\n');
	assert.throws(() => t.importPO(root), /Empty/);
	assert.deepEqual(load("translations/human/de.json"), before);
});

test("machine import is all-or-nothing for a failed batch", () => {
	assert.throws(() => t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Hauptventil", Empty: ""}}), /Empty/);
	assert.equal(fs.existsSync(path.join(root, "translations/machine/de.json")), false);
});

test("machine reruns preserve provenance and refuse replacing an existing translation", () => {
	const batch = {language: "de", generator: "test/v1", messages: {Master: "Hauptventil"}};
	assert.equal(t.importMachine(root, batch), 1);
	const file = path.join(root, "translations/machine/de.json"), before = fs.readFileSync(file, "utf8");
	assert.equal(t.importMachine(root, batch), 0);
	assert.equal(fs.readFileSync(file, "utf8"), before);
	assert.throws(() => t.importMachine(root, {...batch, messages: {Master: "Changed"}}), /explicit review/);
	assert.throws(() => t.importMachine(root, {...batch, messages: {Unknown: "Unknown"}}), /Unknown source/);
});

test("tampered machine text fails compilation", () => {
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Hauptventil"}});
	const machine = load("translations/machine/de.json");
	machine.messages.Master.text = "changed without hash";
	save("translations/machine/de.json", machine);
	assert.throws(() => t.compile(root), /provenance/);
});

test("context changes flag review without replacing an existing valid translation", () => {
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Hauptventil"}});
	const machine = load("translations/machine/de.json");
	machine.messages.Master.review = "reviewed";
	save("translations/machine/de.json", machine);
	assert.deepEqual(t.coverage(root)[0].review, []);
	const catalog = load("translations/catalog.json");
	catalog.messages.Master.notes = ["Meaning changed"];
	save("translations/catalog.json", catalog);
	assert.deepEqual(t.coverage(root)[0].review, ["Master"]);
	t.compile(root);
	assert.equal(load("www/locale/de.js").messages.Master, "Hauptventil");
});

test("needs-revision entries fall back to English and appear in missing coverage", () => {
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Hauptventil"}});
	const machine = load("translations/machine/de.json");
	machine.messages.Master.review = "needs-revision";
	save("translations/machine/de.json", machine);
	t.compile(root);
	assert.equal(load("www/locale/de.js").messages.Master, undefined);
	assert.ok(t.coverage(root)[0].missing.includes("Master"));
});

test("PO import updates human translations without erasing machine-only or missing human entries", () => {
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Hauptventil"}});
	save("translations/incoming/messages_de.po", 'msgid "Empty"\nmsgstr "Leer"\n\nmsgid "Station"\nmsgstr ""\n');
	assert.equal(t.importPO(root), 1);
	assert.deepEqual(load("www/locale/de.js").messages, {Empty: "Leer", Master: "Hauptventil", Station: "Station"});
	assert.equal(load("translations/human/de.json").messages.Master, undefined);
});

test("PO export includes effective current translations and retains provenance on reimport", () => {
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Hauptventil"}});
	save("translations/overrides/de.json", {messages: {Station: "Bewässerungskreis"}});
	const human = load("translations/human/de.json"), machine = load("translations/machine/de.json");
	assert.equal(t.exportPO(root, "translations/outgoing"), 1);
	const exported = fs.readFileSync(path.join(root, "translations/outgoing/messages_de.po"), "utf8");
	assert.deepEqual({...t.poMessages(exported)}, {Master: "Hauptventil", Station: "Bewässerungskreis"});
	assert.equal(Object.keys(t.poMessages(exported)).includes("Empty"), false);
	// Uploading and downloading a machine entry unchanged must not relabel it as human.
	save("translations/incoming/messages_de.po", exported);
	t.importPO(root);
	assert.equal(load("translations/human/de.json").messages.Master, undefined);
	assert.deepEqual(load("translations/machine/de.json"), machine);
	assert.equal(load("translations/human/de.json").messages.Station, "Bewässerungskreis");
	assert.equal(human.messages.Station, "Station");
});

test("Transifex corrections replace machine drafts while unchanged rejected drafts stay excluded", () => {
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Hauptventil", Empty: "Leer"}});
	const machine = load("translations/machine/de.json");
	machine.messages.Empty.review = "needs-revision";
	save("translations/machine/de.json", machine);
	save("translations/incoming/messages_de.po", 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n"Content-Transfer-Encoding: 8bit\\n"\n\nmsgid "Master"\nmsgstr "Hauptbewässerungskreis"\n\nmsgid "Empty"\nmsgstr "Leer"\n');
	t.importPO(root);
	assert.equal(load("translations/human/de.json").messages.Master, "Hauptbewässerungskreis");
	assert.equal(load("translations/human/de.json").messages.Empty, "");
	assert.equal(load("www/locale/de.js").messages.Empty, "");
	assert.deepEqual(load("translations/machine/de.json"), machine);
});

test("PO export excludes obsolete keys and rejected machine drafts", () => {
	save("translations/human/de.json", {messages: {Station: "Station", Obsolete: "Alt", Empty: ""}});
	t.importMachine(root, {language: "de", generator: "test/v1", messages: {Master: "Hauptventil"}});
	const machine = load("translations/machine/de.json");
	machine.messages.Master.review = "needs-revision";
	save("translations/machine/de.json", machine);
	t.exportPO(root, "translations/outgoing");
	const exported = t.poMessages(fs.readFileSync(path.join(root, "translations/outgoing/messages_de.po")));
	assert.deepEqual({...exported}, {Station: "Station"});
	assert.throws(() => t.exportPO(root), /output directory/);
});

test("PO import refuses unknown language mappings and plural entries", () => {
	save("translations/incoming/messages_de-DE.po", 'msgid "Empty"\nmsgstr "Leer"\n');
	assert.throws(() => t.importPO(root), /map it explicitly/);
	assert.throws(() => t.poMessages('msgid "Station"\nmsgid_plural "Stations"\nmsgstr[0] "Station"\nmsgstr[1] "Stationen"\n'), /Plural/);
});

test("fuzzy PO entries do not become approved human translations", () => {
	assert.equal(Object.keys(t.poMessages('#, fuzzy\nmsgid "Station"\nmsgstr "Something"\n')).length, 0);
});

test("duplicate PO entries are rejected rather than silently overwritten", () => {
	assert.throws(() => t.poMessages('msgid "A"\nmsgstr "a"\n\nmsgid "A"\nmsgstr "b"\n'), /Duplicate/);
});

test("prepared requests contain only missing public strings and reject stale responses", () => {
	const file = path.join(root, "request.json");
	assert.equal(t.prepareRequest(root, "de", file), 2);
	const request = load("request.json");
	assert.deepEqual(Object.keys(request.messages), ["Empty", "Master"]);
	assert.equal(request.contexts.Master.references[0], "www/js/example.js:1");
	request.generator = "test/v1";
	request.messages = {Master: "Hauptventil"};
	request.catalogHash = "stale";
	assert.throws(() => t.importMachine(root, request), /stale/);
});

test("check detects source changes without regenerating or networking", () => {
	t.compile(root);
	t.main(["check"], root);
	save("www/js/example.js", '\n\nOSApp.Language._("Station"); OSApp.Language._("Master");');
	t.main(["check"], root);
	save("www/js/example.js", 'OSApp.Language._("New message");');
	assert.throws(() => t.main(["check"], root), /catalog is stale/);
});

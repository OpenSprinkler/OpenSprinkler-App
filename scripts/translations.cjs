"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const espree = require("espree");
const gettext = require("gettext-parser");
const sax = require("sax");

const ROOT = path.resolve(__dirname, "..");
const own = (object, key) => Object.hasOwn(object, key);
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ordered = object => Object.fromEntries(Object.keys(object).sort().map(key => [key, object[key]]));
const json = value => JSON.stringify(value, null, "\t") + "\n";
const nonempty = value => typeof value === "string" && value.trim().length > 0;

function walk(node, visit, parent) {
	if (!node || typeof node !== "object") { return; }
	if (node.type) { visit(node, parent); }
	for (const [key, value] of Object.entries(node)) {
		if (key === "loc" || key === "range") { continue; }
		if (Array.isArray(value)) { value.forEach(child => walk(child, visit, node)); }
		else if (value && typeof value === "object") { walk(value, visit, node); }
	}
}

function parseJSON(text, label = "JSON") {
	const value = JSON.parse(text);
	// JSON.parse silently accepts duplicate keys; catch them before data is lost.
	const tree = espree.parse("(" + text + ")", {ecmaVersion: "latest"});
	walk(tree, node => {
		if (node.type !== "ObjectExpression") { return; }
		const keys = new Set();
		for (const property of node.properties) {
			const key = String(property.key.value);
			if (keys.has(key)) { throw new Error(`${label}: duplicate key ${key}`); }
			keys.add(key);
		}
	});
	return value;
}

function readJSON(file) { return parseJSON(fs.readFileSync(file, "utf8"), file); }

function write(file, content) {
	fs.mkdirSync(path.dirname(file), {recursive: true});
	const temporary = file + ".tmp";
	fs.writeFileSync(temporary, content);
	fs.renameSync(temporary, file);
}

function files(directory, extension) {
	return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory() ? files(file, extension) : file.endsWith(extension) ? [file] : [];
	}).sort();
}

function dictionary(data, label) {
	if (!data || typeof data.messages !== "object" || Array.isArray(data.messages) || !data.messages) {
		throw new Error(`${label}: expected a messages object`);
	}
	for (const [key, value] of Object.entries(data.messages)) {
		if (!key || typeof value !== "string") { throw new Error(`${label}: invalid translation for ${key}`); }
	}
	return data.messages;
}

function memberName(node) {
	if (node?.type === "Identifier") { return node.name; }
	if (node?.type === "MemberExpression" && !node.computed) {
		return memberName(node.object) + "." + node.property.name;
	}
	return "";
}

function literal(node) {
	if (node?.type === "Literal" && typeof node.value === "string") { return node.value; }
	if (node?.type === "TemplateLiteral" && !node.expressions.length) { return node.quasis[0].value.cooked; }
	if (node?.type === "BinaryExpression" && node.operator === "+") {
		const left = literal(node.left), right = literal(node.right);
		if (left !== undefined && right !== undefined) { return left + right; }
	}
	return undefined;
}

function markedStrings(node) {
	const value = literal(node);
	if (value !== undefined) { return [value]; }
	if (node?.type === "ArrayExpression") { return node.elements.flatMap(markedStrings); }
	if (node?.type === "ObjectExpression") { return node.properties.flatMap(property => markedStrings(property.value)); }
	return [];
}

function sentenceConcatenation(node, parents) {
	let root = node;
	while (parents.get(root)?.type === "BinaryExpression" && parents.get(root).operator === "+") { root = parents.get(root); }
	if (root === node) { return false; }
	const flatten = part => part.type === "BinaryExpression" && part.operator === "+" ?
		flatten(part.left).concat(flatten(part.right)) : [part];
	const parts = flatten(root), index = parts.indexOf(node);
	// Inspect adjacent visible text, stopping at HTML boundaries rather than flagging
	// every translated label surrounded by markup in a page-building expression.
	return [-1, 1].some(direction => {
		for (let i = index + direction; i >= 0 && i < parts.length; i += direction) {
			const value = literal(parts[i]);
			if (value === undefined) { return true; }
			if (/[<>]/.test(value)) { return false; }
			if (/\p{L}/u.test(value)) { return true; }
		}
		return false;
	});
}

function extract(root = ROOT) {
	const messages = Object.create(null), issues = [];
	const add = (key, source, line, note = "") => {
		if (!key) { return; }
		if (!own(messages, key)) { messages[key] = {references: [], notes: []}; }
		messages[key].references.push(`${source}:${line}`);
		if (note && !messages[key].notes.includes(note)) { messages[key].notes.push(note); }
	};
	for (const file of files(path.join(root, "www/js"), ".js")) {
		const source = path.relative(root, file).split(path.sep).join("/"), text = fs.readFileSync(file, "utf8");
		const tree = espree.parse(text, {ecmaVersion: "latest", loc: true, range: true, comment: true});
		const parents = new WeakMap(), nodes = [];
		walk(tree, (node, parent) => { parents.set(node, parent); nodes.push(node); });
		for (const comment of tree.comments.filter(item => item.value.trim() === "i18n-extract")) {
			const target = nodes.find(node => node.range[0] >= comment.range[1] && text.slice(comment.range[1], node.range[0]).trim() === "");
			const keys = markedStrings(target);
			if (!keys.length) { throw new Error(`${source}:${comment.loc.start.line}: i18n-extract must precede a static string, array, or object`); }
			keys.forEach(key => add(key, source, target.loc.start.line));
		}
		walk(tree, (node, parent) => {
			if (node.type !== "CallExpression" || memberName(node.callee) !== "OSApp.Language._") { return; }
			const value = literal(node.arguments[0]);
			if (value === undefined) {
				issues.push({kind: "dynamic-key", source, line: node.loc.start.line, expression: text.slice(...node.range)});
				return;
			}
			const note = tree.comments.filter(comment => comment.loc.end.line >= node.loc.start.line - 2 &&
				comment.loc.end.line <= node.loc.start.line && /TRANSLATORS:/.test(comment.value))
				.map(comment => comment.value.trim()).join("\n");
			add(value, source, node.loc.start.line, note);
			if (parent?.type === "BinaryExpression" && sentenceConcatenation(node, parents)) {
				issues.push({kind: "concatenation-candidate", source, line: node.loc.start.line, key: value});
			}
		});
	}
	const html = sax.parser(false, {lowercase: true});
	html.onopentag = node => {
		if (own(node.attributes, "data-translate")) { add(node.attributes["data-translate"], "www/index.html", html.line + 1); }
	};
	html.write(fs.readFileSync(path.join(root, "www/index.html"), "utf8")).close();
	for (const entry of Object.values(messages)) {
		entry.references = [...new Set(entry.references)].sort();
		entry.notes.sort();
	}
	return {version: 1, messages: ordered(messages), issues};
}

function catalogPO(catalog) {
	const entries = Object.create(null);
	for (const [key, entry] of Object.entries(catalog.messages)) {
		entries[key] = {msgid: key, msgstr: [""], comments: {reference: entry.references.join("\n"), extracted: entry.notes.join("\n")}};
	}
	return gettext.po.compile({charset: "UTF-8", headers: {
		"Content-Type": "text/plain; charset=UTF-8", "Content-Transfer-Encoding": "8bit", Language: "en"
	}, translations: {"": entries}}).toString();
}

function contextHash(entry) {
	// Moving code by a few lines should not invalidate a reviewed translation.
	return hash({sources: [...new Set(entry.references.map(reference => reference.replace(/:\d+$/, "")))], notes: entry.notes});
}

function catalogSignature(catalog) {
	return hash({messages: Object.fromEntries(Object.entries(catalog.messages).map(([key, entry]) => [key, contextHash(entry)])),
		issues: catalog.issues.map(issue => {
			const copy = {...issue};
			delete copy.line;
			return copy;
		})});
}

function tokens(text) {
	return (text.match(/%(?:\d+\$)?[-+#0 ]*\d*(?:\.\d+)?[sdif]|\{\{[^{}]+\}\}|\{(?:[a-zA-Z_][\w.]*|\d+)\}|<\/?[a-zA-Z][^>]*>|&(?:#\d+|#x[\da-fA-F]+|\w+);|https?:\/\/[^\s<>"']+/g) || []).sort();
}

function validateTranslation(source, translation, glossary = {}) {
	if (!nonempty(translation)) { throw new Error(`Empty translation: ${source}`); }
	if (JSON.stringify(tokens(source)) !== JSON.stringify(tokens(translation))) {
		throw new Error(`Formatting tokens changed: ${source}`);
	}
	if (JSON.stringify(source.match(/<\/?[a-zA-Z][^>]*>/g) || []) !== JSON.stringify(translation.match(/<\/?[a-zA-Z][^>]*>/g) || [])) {
		throw new Error(`Markup order changed: ${source}`);
	}
	if (JSON.stringify((source.match(/\d+/g) || []).sort()) !== JSON.stringify((translation.match(/\d+/g) || []).sort())) {
		throw new Error(`Numeric values changed: ${source}`);
	}
	// Allow literal '<' characters, but still reject added tag, comment, or declaration openings.
	if ((source.match(/<(?=[a-zA-Z/!?])/g) || []).length !== (translation.match(/<(?=[a-zA-Z/!?])/g) || []).length) {
		throw new Error(`Markup changed: ${source}`);
	}
	for (const term of glossary.doNotTranslate || []) {
		const pattern = new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
		if ((source.match(pattern) || []).length !== (translation.match(pattern) || []).length) {
			throw new Error(`Protected term changed (${term}): ${source}`);
		}
	}
	return [translation === source ? "same-as-English" : "", translation.length > Math.max(40, source.length * 3) ? "long-translation" : ""].filter(Boolean);
}

function machineEntry(source, text, context, glossary, generator) {
	validateTranslation(source, text, glossary);
	return {text, sourceHash: hash(source), contextHash: contextHash(context), glossaryHash: hash(glossary),
		translationHash: hash(text), generator, review: "unreviewed"};
}

function validateMachine(source, entry, glossary) {
	if (!entry || typeof entry !== "object" || entry.sourceHash !== hash(source) || entry.translationHash !== hash(entry.text) ||
		!nonempty(entry.generator) || !["unreviewed", "reviewed", "needs-revision"].includes(entry.review) ||
		!(/^[a-f0-9]{64}$/).test(entry.contextHash) || !(/^[a-f0-9]{64}$/).test(entry.glossaryHash)) {
		throw new Error(`Invalid machine provenance: ${source}`);
	}
	validateTranslation(source, entry.text, glossary);
}

function terminologyWarnings(source, translation, language, glossary) {
	const warnings = [];
	for (const rule of glossary.terminologyChecks?.[language] || []) {
		if ((rule.exceptions || []).includes(source)) { continue; }
		const terms = rule.sourceTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
		if (!new RegExp("\\b(?:" + terms.join("|") + ")\\b", "i").test(source)) { continue; }
		const found = rule.avoid.filter(term => translation.includes(term));
		if (found.length) {
			warnings.push({found, preferred: glossary.languages?.[language]?.[rule.preferredTerm] || rule.preferredTerm});
		}
	}
	return warnings;
}

function merge(human, machine, catalog, glossary, overrides = {}) {
	const result = Object.assign(Object.create(null), human);
	for (const [key, entry] of Object.entries(machine)) {
		validateMachine(key, entry, glossary);
		if (own(catalog.messages, key) && !nonempty(human[key]) && entry.review !== "needs-revision") { result[key] = entry.text; }
	}
	for (const [key, text] of Object.entries(overrides)) {
		validateTranslation(key, text, glossary);
		result[key] = text;
	}
	return {messages: ordered(result)};
}

function layers(root = ROOT) {
	const directory = path.join(root, "translations");
	const catalog = readJSON(path.join(directory, "catalog.json"));
	const glossary = readJSON(path.join(directory, "glossary.json"));
	const languages = files(path.join(directory, "human"), ".json").map(file => {
		const language = path.basename(file, ".json");
		const machineFile = path.join(directory, "machine", language + ".json");
		const overrideFile = path.join(directory, "overrides", language + ".json");
		const overrides = fs.existsSync(overrideFile) ? dictionary(readJSON(overrideFile), overrideFile) : {};
		const machine = fs.existsSync(machineFile) ? readJSON(machineFile) : {messages: {}};
		if (!machine.messages || typeof machine.messages !== "object" || Array.isArray(machine.messages)) {
			throw new Error(`${machineFile}: expected messages object`);
		}
		return {language, human: dictionary(readJSON(file), file), machine: machine.messages, overrides};
	});
	const machineDirectory = path.join(directory, "machine");
	if (fs.existsSync(machineDirectory) && files(machineDirectory, ".json").some(file =>
		!languages.some(entry => entry.language === path.basename(file, ".json")))) {
		throw new Error("Machine dictionary has no matching human source locale");
	}
	const overrideDirectory = path.join(directory, "overrides");
	if (fs.existsSync(overrideDirectory) && files(overrideDirectory, ".json").some(file =>
		!languages.some(entry => entry.language === path.basename(file, ".json")))) {
		throw new Error("Override dictionary has no matching human source locale");
	}
	return {catalog, glossary, languages};
}

function compile(root = ROOT, check = false) {
	const {catalog, glossary, languages} = layers(root);
	const outputs = languages.map(({language, human, machine, overrides}) => ({
		file: path.join(root, "www/locale", language + ".js"), text: json(merge(human, machine, catalog, glossary, overrides))
	}));
	const runtimeNames = files(path.join(root, "www/locale"), ".js").map(file => path.basename(file, ".js"));
	if (runtimeNames.some(language => !languages.some(layer => layer.language === language))) {
		throw new Error("Runtime language lacks a human source layer; bootstrap it before compiling");
	}
	// Validate every language before writing any output.
	for (const {file, text} of outputs) {
		if (check) {
			if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) { throw new Error(`Stale compiled dictionary: ${file}`); }
		} else { write(file, text); }
	}
	return outputs.length;
}

function coverage(root = ROOT) {
	const {catalog, glossary, languages} = layers(root);
	return languages.map(({language, human, machine, overrides}) => {
		const compiled = merge(human, machine, catalog, glossary, overrides).messages;
		const report = {language, total: Object.keys(catalog.messages).length, overrides: 0, human: 0, machine: 0, missing: [], review: [], warnings: [],
			terminologyWarnings: [],
			obsoleteOverrides: Object.keys(overrides).filter(key => !own(catalog.messages, key)),
			obsoleteHuman: Object.keys(human).filter(key => !own(catalog.messages, key)),
			obsoleteMachine: Object.keys(machine).filter(key => !own(catalog.messages, key))};
		for (const [key, context] of Object.entries(catalog.messages)) {
			if (nonempty(compiled[key])) {
				const warnings = terminologyWarnings(key, compiled[key], language, glossary);
				if (warnings.length) { report.terminologyWarnings.push({key, text: compiled[key], warnings}); }
			}
			if (nonempty(overrides[key])) { report.overrides++; }
			else if (nonempty(human[key])) { report.human++; }
			else if (own(machine, key) && machine[key].review !== "needs-revision") {
				report.machine++;
				const entry = machine[key];
				const warnings = validateTranslation(key, entry.text, glossary);
				if (warnings.length) { report.warnings.push({key, warnings}); }
				if (entry.review !== "reviewed" || entry.contextHash !== contextHash(context) || entry.glossaryHash !== hash(glossary)) { report.review.push(key); }
			} else { report.missing.push(key); }
		}
		return report;
	});
}

function importMachine(root, batch) {
	const {catalog, glossary, languages} = layers(root);
	const target = languages.find(entry => entry.language === batch.language);
	if (!target || !nonempty(batch.generator)) { throw new Error("Batch needs a known language and generator/version"); }
	if (batch.catalogHash && batch.catalogHash !== hash(catalog.messages) || batch.glossaryHash && batch.glossaryHash !== hash(glossary)) {
		throw new Error("Translation request is stale; prepare a new request and review the response");
	}
	const incoming = dictionary(batch, "machine batch"), merged = Object.assign(Object.create(null), target.machine);
	let added = 0;
	for (const [key, text] of Object.entries(incoming)) {
		if (!own(catalog.messages, key)) { throw new Error(`Unknown source key: ${key}`); }
		if (nonempty(target.overrides[key]) || nonempty(target.human[key])) { continue; }
		if (own(merged, key)) {
			validateMachine(key, merged[key], glossary);
			if (merged[key].text === text) { continue; }
			throw new Error(`Existing machine translation requires explicit review before replacement: ${key}`);
		}
		merged[key] = machineEntry(key, text, catalog.messages[key], glossary, batch.generator);
		added++;
	}
	write(path.join(root, "translations/machine", batch.language + ".json"), json({messages: ordered(merged)}));
	return added;
}

function poMessages(text) {
	const parsed = gettext.po.parse(text);
	const entryCount = Object.values(parsed.translations).reduce((total, entries) => total + Object.keys(entries).length, 0);
	if ((text.toString().match(/^\s*msgid\s+/gm) || []).length !== entryCount) {
		throw new Error("Duplicate or malformed PO entries");
	}
	if (Object.keys(parsed.translations).some(context => context !== "")) { throw new Error("Contextual PO entries are not supported by runtime lookup"); }
	const messages = Object.create(null);
	for (const [key, entry] of Object.entries(parsed.translations[""] || {})) {
		if (!key || entry.obsolete || /\bfuzzy\b/.test(entry.comments?.flag || "")) { continue; }
		if (entry.msgid_plural) { throw new Error(`Plural PO entry needs explicit runtime support: ${key}`); }
		if (nonempty(entry.msgstr[0])) { messages[key] = entry.msgstr[0]; }
	}
	return messages;
}

function importPO(root = ROOT) {
	const {catalog, glossary, languages} = layers(root), pending = [], seen = new Set(), conflicts = [];
	for (const entry of languages) { merge(entry.human, entry.machine, catalog, glossary, entry.overrides); }
	for (const file of files(path.join(root, "translations/incoming"), ".po")) {
		const language = path.basename(file).match(/^messages_(.+)\.po$/)?.[1];
		const target = languages.find(entry => entry.language === language);
		if (!target || seen.has(language)) { throw new Error(`Unknown or duplicate locale in ${file}; map it explicitly before importing`); }
		seen.add(language);
		const incoming = poMessages(fs.readFileSync(file)), human = Object.assign(Object.create(null), target.human);
		for (const [key, text] of Object.entries(incoming)) {
			// Existing legacy text is protected, not retroactively rejected by stricter validators.
			if (human[key] !== text) { validateTranslation(key, text, glossary); }
			if (nonempty(target.overrides[key]) && target.overrides[key] !== text) {
				conflicts.push(`${language}: ${JSON.stringify(key)}: local ${JSON.stringify(target.overrides[key])}; incoming ${JSON.stringify(text)}`);
			}
			human[key] = text;
		}
		pending.push({file: path.join(root, "translations/human", language + ".json"), text: json({messages: ordered(human)})});
	}
	if (!pending.length) { throw new Error("No incoming PO files; run the explicit Transifex sync first"); }
	for (const entry of pending) { write(entry.file, entry.text); }
	compile(root);
	for (const conflict of conflicts) { console.warn("Local translation override retained: " + conflict); }
	return pending.length;
}

function prepareRequest(root, language, output) {
	const {catalog, glossary, languages} = layers(root);
	const target = languages.find(entry => entry.language === language);
	if (!target || !output) { throw new Error("Provide a known language and output JSON path"); }
	const report = coverage(root).find(entry => entry.language === language);
	// Flagged existing translations need explicit review, not automatic replacement.
	const missing = report.missing.filter(key => !own(target.machine, key));
	const request = {language, generator: "", catalogHash: hash(catalog.messages), glossaryHash: hash(glossary), glossary,
		existingTerminology: Object.fromEntries(Object.keys(glossary.terms || {})
			.filter(key => nonempty(target.overrides[key]) || nonempty(target.human[key]))
			.map(key => [key, target.overrides[key] || target.human[key]])),
		instructions: "Translate only the messages below. Fill string values, set generator/version, and retain hashes. Keep placeholders, markup, identifiers and numeric values. Do not change keys. No user/controller data is included.",
		messages: Object.fromEntries(missing.map(key => [key, ""])),
		contexts: Object.fromEntries(missing.map(key => [key, catalog.messages[key]]))};
	write(output, json(request));
	return missing.length;
}

function bootstrap(root = ROOT) {
	const directory = path.join(root, "translations/human");
	if (fs.existsSync(directory)) { throw new Error("Human sources already exist; refusing to bootstrap merged runtime dictionaries"); }
	const pending = files(path.join(root, "www/locale"), ".js").map(file => ({
		file: path.join(directory, path.basename(file, ".js") + ".json"),
		text: json({messages: ordered(dictionary(readJSON(file), file))})
	}));
	for (const entry of pending) { write(entry.file, entry.text); }
	return pending.length;
}

function main(args = process.argv.slice(2), root = ROOT) {
	const [command, argument] = args;
	switch (command) {
		case "bootstrap": console.log(`Bootstrapped ${bootstrap(root)} human dictionaries`); break;
		case "extract": {
			const catalog = extract(root);
			write(path.join(root, "translations/catalog.json"), json(catalog));
			write(path.join(root, "www/locale/messages_en.po"), catalogPO(catalog));
			console.log(`Extracted ${Object.keys(catalog.messages).length} messages; ${catalog.issues.filter(issue => issue.kind === "dynamic-key").length} dynamic keys require audit`);
			break;
		}
		case "compile": console.log(`Compiled ${compile(root)} dictionaries`); break;
		case "check": {
			const actual = extract(root), expected = readJSON(path.join(root, "translations/catalog.json"));
			if (catalogSignature(actual) !== catalogSignature(expected) || fs.readFileSync(path.join(root, "www/locale/messages_en.po"), "utf8") !== catalogPO(expected)) {
				throw new Error("Source catalog is stale; run npm run translations:extract");
			}
			console.log(`Verified ${compile(root, true)} compiled dictionaries`);
			break;
		}
		case "coverage": {
			const reports = coverage(root);
			if (argument === "--json") { console.log(json(reports)); }
			else {
				reports.forEach(row => {
					console.log(`${row.language}: ${row.overrides} overrides + ${row.human} human + ${row.machine} machine / ${row.total}; ${row.missing.length} missing, ${row.review.length} machine entries need review, ${row.terminologyWarnings.length} terminology warnings`);
					for (const warning of row.terminologyWarnings) {
						console.warn(`${row.language}: terminology review: ${JSON.stringify(warning)}`);
					}
				});
			}
			break;
		}
		case "prepare": console.log(`Prepared ${prepareRequest(root, argument, args[2])} missing messages`); break;
		case "import-machine": {
			if (!argument) { throw new Error("Provide a machine batch JSON file"); }
			console.log(`Added ${importMachine(root, readJSON(argument))} validated machine translations; run compile next`);
			break;
		}
		case "import-po": console.log(`Imported ${importPO(root)} human dictionaries`); break;
		default: throw new Error("Expected extract, coverage [--json], compile, check, prepare <lang> <file>, import-machine <file>, import-po, or bootstrap");
	}
}

module.exports = {extract, catalogPO, hash, contextHash, parseJSON, dictionary, tokens, validateTranslation, terminologyWarnings,
	machineEntry, merge, compile, coverage, importMachine, importPO, poMessages, bootstrap, prepareRequest, main};
if (require.main === module) {
	try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

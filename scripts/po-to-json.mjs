#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import gettextParser from "gettext-parser";

const { po } = gettextParser;

export function poToMessageFormat(source) {
	const parsed = po.parse(source);
	// Translation IDs are data, including JavaScript metaproperty names such as "__proto__".
	const messages = Object.create(null);

	for (const [context, translations] of Object.entries(parsed.translations)) {
		for (const [messageId, translation] of Object.entries(translations)) {
			if (!messageId) {
				continue;
			}

			const flags = translation.comments?.flag || "";
			if (/(?:^|,)\s*fuzzy(?:\s*,|$)/.test(flags)) {
				continue;
			}

			const key = context ? `${context}\u0004${messageId}` : messageId;
			messages[key] = translation.msgstr[0] || "";
		}
	}

	return messages;
}

async function main() {
	const [input, output] = process.argv.slice(2);
	if (!input || !output) {
		console.error("Usage: node scripts/po-to-json.mjs <input.po> <output.json>");
		process.exitCode = 1;
		return;
	}

	const source = await readFile(input);
	const messages = poToMessageFormat(source);
	await writeFile(output, JSON.stringify(messages, null, "   "));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
	await main();
}

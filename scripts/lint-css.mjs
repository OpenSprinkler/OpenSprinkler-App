#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { CSSLint } = require("csslint");
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function lintCss(
	cssPath = resolve(repositoryRoot, "www/css/main.css"),
	configPath = resolve(repositoryRoot, ".csslintrc"),
) {
	const [source, configuredRules] = await Promise.all([
		readFile(cssPath, "utf8"),
		readFile(configPath, "utf8").then(JSON.parse),
	]);
	const ruleset = CSSLint.getRules().reduce((rules, rule) => {
		rules[rule.id] = 1;
		return rules;
	}, {});

	for (const [rule, setting] of Object.entries(configuredRules)) {
		if (setting === false || setting === 0) {
			delete ruleset[rule];
		} else {
			ruleset[rule] = setting;
		}
	}

	const result = CSSLint.verify(source, ruleset);
	for (const message of result.messages) {
		const location = message.line ? `${message.line}:${message.col}` : "general";
		const rule = message.rule?.id || "parse-error";
		console.log(`${message.type.toUpperCase()} ${location} ${message.message} (${rule})`);
	}

	const errors = result.messages.filter((message) => message.type === "error");
	if (errors.length > 0) {
		throw new Error(`CSSLint found ${errors.length} error(s)`);
	}
	console.log(`CSSLint completed with ${result.messages.length} warning(s) and no errors`);
	return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	lintCss().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}

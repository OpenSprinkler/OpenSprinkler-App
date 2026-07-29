#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { poToMessageFormat } from "./po-to-json.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, arguments_, options = {}) {
	const result = spawnSync(command, arguments_, {
		cwd: repositoryRoot,
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
		...options,
	});
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(
			`${command} failed with status ${result.status}: ${(result.stderr || result.stdout || "").trim()}`,
		);
	}
	return result.stdout || "";
}

async function walkJavaScript(directory) {
	const files = [];
	for (const entry of (await readdir(directory, { withFileTypes: true }))
		.sort((left, right) => left.name.localeCompare(right.name))) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...await walkJavaScript(path));
		} else if (entry.isFile() && entry.name.endsWith(".js")) {
			files.push(path);
		}
	}
	return files;
}

function withoutPoComments(source) {
	return source.split(/\r?\n/).filter((line) => !line.startsWith("#")).join("\n");
}

function commitAndPush(message) {
	const diff = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: repositoryRoot });
	if (diff.error) throw diff.error;
	if (diff.status === 1) {
		run("git", ["commit", "-m", message], { stdio: "inherit" });
	} else if (diff.status !== 0) {
		throw new Error(`git diff --cached failed with status ${diff.status}`);
	}
	run("git", ["push"], { stdio: "inherit" });
}

export async function pushEnglish() {
	const temporaryRoot = await mkdtemp(join(tmpdir(), "opensprinkler-localization-"));
	try {
		const javaScriptFiles = await walkJavaScript(join(repositoryRoot, "www", "js"));
		const javaScriptPo = withoutPoComments(run("xgettext", [
			"--keyword=OSApp.Language._",
			"--output=-",
			"--omit-header",
			"--force-po",
			"--from-code=UTF-8",
			"--language=Python",
			...javaScriptFiles,
		]));
		const html = await readFile(join(repositoryRoot, "www", "index.html"), "utf8");
		const extractableHtml = html.replace(/data-translate="([^"]*)"/g, '_("$1")');
		const htmlPath = join(temporaryRoot, "index.html");
		await writeFile(htmlPath, extractableHtml);
		const htmlPo = withoutPoComments(run("xgettext", [
			"--keyword=_",
			"--output=-",
			"--language=Python",
			"--omit-header",
			"--force-po",
			htmlPath,
		]));
		const javaScriptPoPath = join(temporaryRoot, "javascript.po");
		const htmlPoPath = join(temporaryRoot, "html.po");
		await Promise.all([
			writeFile(javaScriptPoPath, javaScriptPo),
			writeFile(htmlPoPath, htmlPo),
		]);
		const combined = run("msgcat", [javaScriptPoPath, htmlPoPath]);
		const output = join(repositoryRoot, "www", "locale", "messages_en.po");
		await writeFile(output, combined);
		run("tx", ["push"], { stdio: "inherit" });
		run("git", ["add", output]);
		commitAndPush("Localization: Update English strings");
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
}

export async function updateLanguages() {
	run("tx", ["pull", "--all"], { stdio: "inherit" });
	const translationFiles = (await readdir(repositoryRoot))
		.filter((name) => /^messages_[^/]+\.po$/i.test(name))
		.sort();

	for (const name of translationFiles) {
		const language = languageFromTranslationFilename(name);
		if (!language) {
			throw new Error(`Cannot derive language code from ${name}`);
		}
		const input = join(repositoryRoot, name);
		const messages = poToMessageFormat(await readFile(input));
		const output = join(repositoryRoot, "www", "locale", `${language}.js`);
		await writeFile(output, `${JSON.stringify({ messages }, null, 3)}\n`);
		await rm(input);
	}

	run("git", ["add", "www/locale"]);
	commitAndPush("Localization: Update languages from Transifex");
}

/** Preserve the legacy bundle convention: regional Transifex variants share the base language. */
export function languageFromTranslationFilename(name) {
	return /^messages_([^_.-]+)/i.exec(name)?.[1];
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
	const command = process.argv[2];
	if (command === "push-english") {
		await pushEnglish();
	} else if (command === "update") {
		await updateLanguages();
	} else {
		console.error("Usage: node scripts/localization.mjs <push-english|update>");
		process.exitCode = 1;
	}
}

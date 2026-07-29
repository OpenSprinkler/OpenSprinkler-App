#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { accessSync, constants } from "node:fs";
import { mkdtemp, readFile, readdir, realpath, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { delimiter, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executableNames = [
	"google-chrome-stable",
	"google-chrome",
	"chromium",
	"chromium-browser",
];

const platformPaths = {
	darwin: [
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium",
	],
	linux: [
		"/usr/bin/google-chrome-stable",
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
		"/snap/bin/chromium",
	],
	win32: [
		join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
		join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
	],
};

const mimeTypes = {
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
};

const browserDependencyAssets = new Set([
	"/node_modules/chai/chai.js",
	"/node_modules/mocha/mocha.css",
	"/node_modules/mocha/mocha.js",
	"/node_modules/nise/nise.js",
	"/node_modules/sinon/pkg/sinon.js",
]);

const publicPathPrefixes = ["/test/", "/www/"];

function isExecutable(candidate) {
	if (!candidate) {
		return false;
	}

	try {
		accessSync(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

function findOnPath(name, env) {
	const executable = process.platform === "win32" && !name.endsWith(".exe") ? `${name}.exe` : name;
	for (const entry of (env.PATH || "").split(delimiter).filter(Boolean)) {
		const candidate = join(entry, executable);
		if (isExecutable(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

export function findBrowser(env = process.env) {
	for (const configured of [env.CHROME_BIN, env.CHROMIUM_BIN]) {
		if (configured) {
			const resolved = isExecutable(configured) ? configured : findOnPath(configured, env);
			if (!resolved) {
				throw new Error(`Configured browser is not executable: ${configured}`);
			}
			return resolved;
		}
	}

	for (const name of executableNames) {
		const candidate = findOnPath(name, env);
		if (candidate) {
			return candidate;
		}
	}

	for (const candidate of platformPaths[process.platform] || []) {
		if (isExecutable(candidate)) {
			return candidate;
		}
	}

	throw new Error(
		"No Chrome or Chromium executable found. Install chromium/google-chrome or set CHROME_BIN explicitly.",
	);
}

async function sortedJavaScriptFiles(directory) {
	const files = [];
	for (const entry of (await readdir(join(repositoryRoot, directory), { withFileTypes: true }))
		.sort((left, right) => left.name.localeCompare(right.name))) {
		if (entry.name.startsWith(".")) {
			continue;
		}
		const relativePath = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...await sortedJavaScriptFiles(relativePath));
		} else if (entry.isFile() && entry.name.endsWith(".js")) {
			files.push(`/${relativePath.split(sep).join("/")}`);
		}
	}
	return files;
}

function scriptTag(source) {
	return `<script src="${source}"></script>`;
}

async function createRunnerHtml(token) {
	const moduleScripts = await sortedJavaScriptFiles("www/js/modules");
	const testScripts = await sortedJavaScriptFiles("test/tests");
	const scripts = [
		"/node_modules/mocha/mocha.js",
		"/node_modules/chai/chai.js",
		"/www/vendor-js/jquery.js",
		"/www/js/jqm-config.js",
		"/www/vendor-js/jquery-migrate.min.js",
		"/www/vendor-js/libs.js",
		"/www/vendor-js/apexcharts.min.js",
		"/www/vendor-js/jqm.js",
		"/www/vendor-js/dataTables-2.1.8.min.js",
		"/www/vendor-js/vis-timeline-graph2d.min.js",
		...moduleScripts,
		"/www/js/main.js",
		"/node_modules/sinon/pkg/sinon.js",
		"/node_modules/nise/nise.js",
		"/test/prepare_tests.js",
		...testScripts,
	];

	return `<!doctype html>
<html data-test-status="running">
<head>
<meta charset="utf-8">
<base href="/">
<title>OpenSprinkler browser tests</title>
<link rel="stylesheet" href="/www/css/jqm.css">
<link rel="stylesheet" href="/www/css/main.css">
<link rel="stylesheet" href="/node_modules/mocha/mocha.css">
<link rel="stylesheet" href="/www/css/vis-timeline-graph2d.min.css">
<script>
window.__karma__ = { nativeBrowserHarness: true };
window.__OPENSPRINKLER_TEST_TOKEN__ = ${JSON.stringify(token)};
window.__OPENSPRINKLER_BOOT_ERRORS__ = [];
window.__OPENSPRINKLER_CAPTURE_ERROR__ = function (event) {
	var target = event.target;
	window.__OPENSPRINKLER_BOOT_ERRORS__.push({
		title: "browser harness script/resource load",
		message: String(event.message || target && (target.src || target.href) || "Unknown browser load error"),
		stack: String(event.error && event.error.stack || "").slice(0, 20000)
	});
};
window.__OPENSPRINKLER_CAPTURE_REJECTION__ = function (event) {
	var reason = event.reason;
	window.__OPENSPRINKLER_BOOT_ERRORS__.push({
		title: "browser harness initialization",
		message: String(reason && reason.message || reason || "Unhandled initialization rejection"),
		stack: String(reason && reason.stack || "").slice(0, 20000)
	});
};
window.addEventListener("error", window.__OPENSPRINKLER_CAPTURE_ERROR__);
window.addEventListener("unhandledrejection", window.__OPENSPRINKLER_CAPTURE_REJECTION__);
</script>
${scripts.slice(0, 2).map(scriptTag).join("\n")}
<script>mocha.setup({ ui: "bdd", timeout: 5000 });</script>
${scripts.slice(2).map(scriptTag).join("\n")}
</head>
<body><div id="mocha"></div>
<script>
(function () {
	"use strict";
	window.removeEventListener("error", window.__OPENSPRINKLER_CAPTURE_ERROR__);
	window.removeEventListener("unhandledrejection", window.__OPENSPRINKLER_CAPTURE_REJECTION__);
	var failures = window.__OPENSPRINKLER_BOOT_ERRORS__.slice(), posted = false;
	function post(result) {
		if (posted) return;
		posted = true;
		document.documentElement.dataset.testStatus = result.failures ? "failed" : "passed";
		fetch("/__browser_tests__/result?token=" + encodeURIComponent(window.__OPENSPRINKLER_TEST_TOKEN__), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(result)
		}).catch(function () {});
	}
	if (!window.mocha || typeof window.mocha.run !== "function") {
		failures.push({ title: "browser harness", message: "Mocha failed to load.", stack: "" });
		post({ tests: failures.length, passes: 0, failures: failures.length, pending: 0, duration: 0, details: failures });
		return;
	}
	var runner = mocha.run();
	runner.on("fail", function (test, error) {
		failures.push({
			title: typeof test.fullTitle === "function" ? test.fullTitle() : test.title,
			message: String(error && error.message || error || "Unknown browser test failure"),
			stack: String(error && error.stack || "").slice(0, 20000)
		});
	});
	runner.on("end", function () {
		post({
			tests: runner.stats.tests + window.__OPENSPRINKLER_BOOT_ERRORS__.length,
			passes: runner.stats.passes,
			failures: runner.stats.failures + window.__OPENSPRINKLER_BOOT_ERRORS__.length,
			pending: runner.stats.pending,
			duration: runner.stats.duration,
			details: failures
		});
	});
}());
</script>
</body>
</html>`;
}

function isWithin(parent, child) {
	const childRelativePath = relative(parent, child);
	return childRelativePath === "" ||
		(!isAbsolute(childRelativePath) && childRelativePath !== ".." &&
			!childRelativePath.startsWith(`..${sep}`));
}

function containsDotfileSegment(path) {
	return path.split(/[\\/]/).some((segment) => segment.startsWith("."));
}

function mapRequestPath(pathname) {
	let mapped = pathname;
	if (mapped.startsWith("/base/")) {
		mapped = mapped.slice(5);
	} else if (mapped === "/img/placeholder.png") {
		mapped = "/www/img/placeholder.png";
	}
	return mapped;
}

/** Resolve only files intentionally exposed to the browser harness. */
export async function resolveStaticFile(pathname, root = repositoryRoot) {
	const mapped = mapRequestPath(pathname);
	const publicPrefix = publicPathPrefixes.find((prefix) => mapped.startsWith(prefix));
	const isExactDependency = browserDependencyAssets.has(mapped);
	if ((!publicPrefix && !isExactDependency) || containsDotfileSegment(mapped)) {
		return undefined;
	}

	const absoluteRoot = resolve(root);
	const path = resolve(absoluteRoot, `.${mapped}`);
	if (!isWithin(absoluteRoot, path)) {
		return undefined;
	}

	const [canonicalRoot, canonicalPath, fileStats] = await Promise.all([
		realpath(absoluteRoot).catch(() => undefined),
		realpath(path).catch(() => undefined),
		stat(path).catch(() => undefined),
	]);
	if (!canonicalRoot || !canonicalPath || !fileStats?.isFile() || !isWithin(canonicalRoot, canonicalPath)) {
		return undefined;
	}

	if (isExactDependency) {
		// npm installs these as ordinary files. Do not let an exact allowed URL become a symlink to
		// another (possibly private) file elsewhere in the checkout.
		const expectedCanonicalPath = resolve(canonicalRoot, relative(absoluteRoot, path));
		return canonicalPath === expectedCanonicalPath ? canonicalPath : undefined;
	}

	const publicRoot = resolve(absoluteRoot, `.${publicPrefix.slice(0, -1)}`);
	const canonicalPublicRoot = await realpath(publicRoot).catch(() => undefined);
	const expectedCanonicalPublicRoot = resolve(canonicalRoot, relative(absoluteRoot, publicRoot));
	if (!canonicalPublicRoot || canonicalPublicRoot !== expectedCanonicalPublicRoot ||
		!isWithin(canonicalPublicRoot, canonicalPath)) {
		return undefined;
	}

	const canonicalPublicPath = relative(canonicalPublicRoot, canonicalPath);
	return containsDotfileSegment(canonicalPublicPath) ? undefined : canonicalPath;
}

async function startServer(token, runnerHtml, receiveResult) {
	const server = createServer((request, response) => {
		void (async () => {
			const url = new URL(request.url || "/", "http://127.0.0.1");
			if (request.method === "POST" && url.pathname === "/__browser_tests__/result") {
				if (url.searchParams.get("token") !== token) {
					response.writeHead(403).end("Forbidden");
					return;
				}
				let body = "";
				for await (const chunk of request) {
					body += chunk;
					if (body.length > 1_000_000) {
						response.writeHead(413).end("Result too large");
						return;
					}
				}
				const result = JSON.parse(body);
				receiveResult(result);
				response.writeHead(204).end();
				return;
			}

			if ((request.method === "GET" || request.method === "HEAD") &&
				url.pathname === "/__browser_tests__/runner") {
				response.writeHead(200, {
					"cache-control": "no-store",
					"content-type": "text/html; charset=utf-8",
					"x-content-type-options": "nosniff",
				});
				response.end(request.method === "HEAD" ? undefined : runnerHtml);
				return;
			}

			if (request.method !== "GET" && request.method !== "HEAD") {
				response.writeHead(405, { allow: "GET, HEAD" }).end("Method not allowed");
				return;
			}

			let pathname;
			try {
				pathname = decodeURIComponent(url.pathname);
			} catch {
				response.writeHead(400).end("Bad path");
				return;
			}
				const canonicalPath = await resolveStaticFile(pathname);
				if (!canonicalPath) {
				response.writeHead(404).end("Not found");
				return;
			}
			const content = await readFile(canonicalPath);
			response.writeHead(200, {
				"cache-control": "no-store",
				"content-type": mimeTypes[extname(canonicalPath).toLowerCase()] || "application/octet-stream",
				"x-content-type-options": "nosniff",
			});
			response.end(request.method === "HEAD" ? undefined : content);
		})().catch((error) => {
			if (!response.headersSent) {
				response.writeHead(500);
			}
			response.end("Internal test server error");
			console.error(error instanceof Error ? error.message : String(error));
		});
	});

	await new Promise((resolveListen, rejectListen) => {
		server.once("error", rejectListen);
		server.listen(0, "127.0.0.1", resolveListen);
	});
	return server;
}

function closeServer(server) {
	return new Promise((resolveClose) => server.close(resolveClose));
}

function waitForExit(process) {
	if (process.exitCode !== null || process.signalCode !== null) {
		return Promise.resolve(process.exitCode);
	}
	return new Promise((resolveExit) => process.once("exit", resolveExit));
}

function waitForExitWithin(process, timeoutMs) {
	if (process.exitCode !== null || process.signalCode !== null) {
		return Promise.resolve(true);
	}

	return new Promise((resolveWait) => {
		const timeout = setTimeout(() => {
			process.removeListener("exit", handleExit);
			resolveWait(false);
		}, timeoutMs);
		function handleExit() {
			clearTimeout(timeout);
			resolveWait(true);
		}
		process.once("exit", handleExit);
	});
}

export async function removeBrowserProfile(profile, removeDirectory = rm) {
	await removeDirectory(profile, {
		force: true,
		maxRetries: 5,
		recursive: true,
		retryDelay: 100,
	});
}

export async function runBrowserTests({ browser = findBrowser(), timeoutMs = 60_000 } = {}) {
	const token = randomBytes(24).toString("hex");
	const runnerHtml = await createRunnerHtml(token);
	let acceptResult;
	const resultPromise = new Promise((resolveResult) => {
		acceptResult = resolveResult;
	});
	const server = await startServer(token, runnerHtml, acceptResult);
	const address = server.address();
	if (!address || typeof address === "string") {
		await closeServer(server);
		throw new Error("Browser test server did not expose a TCP address");
	}

	const profile = await mkdtemp(join(tmpdir(), "opensprinkler-browser-"));
	const browserErrors = [];
	const child = spawn(browser, [
		"--headless=new",
		"--no-sandbox",
		"--disable-dev-shm-usage",
		"--disable-background-networking",
		"--disable-component-update",
		"--disable-default-apps",
		"--disable-sync",
		"--metrics-recording-only",
		"--no-first-run",
		`--user-data-dir=${profile}`,
		`http://127.0.0.1:${address.port}/__browser_tests__/runner`,
	], { stdio: ["ignore", "ignore", "pipe"] });
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		if (browserErrors.join("").length < 64_000) {
			browserErrors.push(chunk);
		}
	});
	const spawnError = new Promise((unused, rejectSpawn) => {
		child.once("error", rejectSpawn);
	});

	let timeout;
	try {
		const result = await Promise.race([
			resultPromise,
			spawnError,
			waitForExit(child).then((code) => {
				throw new Error(`Browser exited before reporting test results (status ${code ?? "signal"})`);
			}),
			new Promise((unused, rejectTimeout) => {
				timeout = setTimeout(() => rejectTimeout(new Error(`Browser tests timed out after ${timeoutMs}ms`)), timeoutMs);
			}),
		]);
		return result;
	} catch (error) {
		const diagnostics = browserErrors.join("").trim();
		if (diagnostics) {
			throw new Error(`${error.message}\nChromium diagnostics:\n${diagnostics.slice(-20_000)}`);
		}
		throw error;
	} finally {
		clearTimeout(timeout);
		if (child.exitCode === null && child.signalCode === null) {
			child.kill("SIGTERM");
			if (!await waitForExitWithin(child, 2_000)) {
				child.kill("SIGKILL");
				await waitForExitWithin(child, 2_000);
			}
		}
		await closeServer(server);
		await removeBrowserProfile(profile);
	}
}

async function main() {
	console.log(`Running browser tests with ${findBrowser()}`);
	const result = await runBrowserTests();
	for (const failure of result.details || []) {
		console.error(`\nFAILED: ${failure.title}\n${failure.stack || failure.message}`);
	}
	if (result.tests < 1 || result.failures || result.pending || result.passes !== result.tests) {
		throw new Error(
			`Browser test result: ${result.passes}/${result.tests} passed, ` +
			`${result.failures} failed, ${result.pending} pending`,
		);
	}
	console.log(`TOTAL: ${result.passes} SUCCESS (${result.duration}ms)`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}

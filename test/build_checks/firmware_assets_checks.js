/* eslint-disable */

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const grunt = require("grunt");

const root = path.resolve(__dirname, "../..");
let fixture;

function write(file, content) {
	const target = path.join(fixture, file);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, content);
}

function read(file) {
	return fs.readFileSync(path.join(fixture, file), "utf8");
}

function build() {
	execFileSync(process.execPath, [path.join(root, "node_modules/grunt-cli/bin/grunt"), "prepareFW"], {
		cwd: fixture,
		stdio: "pipe"
	});
	const loader = read("build/firmware/js/home.js");
	const match = loader.match(/var assetPath = "(assets\/[a-f0-9]{20}\/)";/);
	assert.ok(match, "The stable loader must select a content-hashed directory");
	return match[1];
}

before(() => {
	fixture = fs.mkdtempSync(path.join(os.tmpdir(), "opensprinkler-firmware-"));
	fs.symlinkSync(path.join(root, "node_modules"), path.join(fixture, "node_modules"), "dir");
	write("Gruntfile.js", fs.readFileSync(path.join(root, "Gruntfile.js")));
	write("package.json", '{"name":"firmware-build-test","version":"0.0.0"}');
	write("www/js/home.js", fs.readFileSync(path.join(root, "www/js/home.js")));
	write("www/js/main.js", "var appVersion = '0.0.0';");
	write("www/js/modules/storage.js", "var storage = {};");
	write("www/css/main.css", "body { color: white; }");
	write("www/img/logo.png", Buffer.from([0, 1, 2, 255]));
	write("www/vendor-js/jquery.js", "var jquery = {};");
	write("www/index.html", "<body>Application</body>");
	write("www/map.html", "<body>Map</body>");
	write("www/locale/es.js", '{"messages":{}}');
	write("res/ios-web/icons/icon.png", Buffer.from([255, 2, 1, 0]));
});

after(() => {
	fs.rmSync(fixture, { recursive: true, force: true });
});

test("builds a complete snapshot, legacy paths, and a matching ZIP without editing sources", () => {
	const source = read("www/js/home.js");
	const assetPath = build();
	for (const file of ["js/main.js", "js/modules/storage.js", "css/main.css", "vendor-js/jquery.js",
		"index.html", "map.html", "locale/es.js", "img/logo.png", "res/ios-web/icons/icon.png", "modules.json"]) {
		assert.deepEqual(fs.readFileSync(path.join(fixture, "build/firmware", assetPath, file)),
			fs.readFileSync(path.join(fixture, "build/firmware", file)), file);
	}
	assert.equal(read("www/js/home.js"), source);
	assert.deepEqual(JSON.parse(read("build/firmware/" + assetPath + "modules.json")), ["storage.js"]);
	const archive = execFileSync("unzip", ["-Z1", "build/firmware/UI.zip"], { cwd: fixture, encoding: "utf8" });
	assert.ok(archive.split("\n").includes(assetPath + "js/main.js"));
	assert.ok(archive.split("\n").includes("js/home.js"));
	assert.equal(execFileSync("unzip", ["-p", "build/firmware/UI.zip", "js/home.js"], {
		cwd: fixture, encoding: "utf8"
	}), read("build/firmware/js/home.js"));
});

test("repeated builds are deterministic and exclude workflow backup files", () => {
	const assetPath = build();
	write("www/js/main.js.bak", "Old build");
	assert.equal(build(), assetPath);
	assert.equal(fs.existsSync(path.join(fixture, "build/firmware/js/main.js.bak")), false);
});

test("changes the asset URL for each dependency even when the app version stays the same", () => {
	let previous = build();
	for (const file of ["www/js/modules/storage.js", "www/vendor-js/jquery.js", "www/css/main.css", "www/index.html", "www/locale/es.js"]) {
		fs.appendFileSync(path.join(fixture, file), "\n/* Changed */");
		const current = build();
		assert.notEqual(current, previous, file);
		assert.equal(read("www/js/main.js"), "var appVersion = '0.0.0';");
		previous = current;
	}
});

test("regenerates the module list and removes obsolete output on rebuild", () => {
	const previous = build();
	fs.unlinkSync(path.join(fixture, "www/js/modules/storage.js"));
	write("www/js/modules/replacement.js", "var replacement = {};");
	const current = build();
	assert.notEqual(current, previous);
	assert.deepEqual(JSON.parse(read("build/firmware/" + current + "modules.json")), ["replacement.js"]);
	assert.equal(fs.existsSync(path.join(fixture, "build/firmware/js/modules/storage.js")), false);
	assert.equal(fs.existsSync(path.join(fixture, "build/firmware", previous)), false);
});

test("all Firebase environments revalidate mutable URLs and cache hashed assets", () => {
	const config = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
	for (const site of config.hosting) {
		function headers(url) {
			const result = {};
			for (const rule of site.headers) {
				if (grunt.file.isMatch(rule.source, url)) {
					rule.headers.forEach(header => { result[header.key] = header.value; });
				}
			}
			return result;
		}
		for (const url of ["/js/home.js", "/modules.json", "/index.html", "/js/main.js", "/vendor-js/jquery.js", "/sw.js"]) {
			assert.equal(headers(url)["Cache-Control"], "no-cache, max-age=0, must-revalidate", site.site + url);
			assert.equal(headers(url)["Access-Control-Allow-Origin"], "*");
		}
		for (const file of ["js/main.js", "modules.json", "css/main.css", "img/logo.png", "index.html"]) {
			assert.equal(headers("/assets/0123456789abcdef0123/" + file)["Cache-Control"],
				"public, max-age=31536000, immutable", site.site + file);
		}
	}
});

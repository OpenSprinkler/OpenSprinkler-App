#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants, createWriteStream } from "node:fs";
import {
	chmod,
	lstat,
	mkdir,
	open,
	readFile,
	readdir,
	rename,
	realpath,
	rm,
	stat,
	utimes,
	writeFile,
} from "node:fs/promises";
import { hostname } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixedArchiveDate = new Date("1980-01-01T00:00:00.000Z");
const firmwareLockName = ".firmware-build.lock";
const firmwareHeartbeatMs = 5_000;
const unprobeableLockStaleMs = 5 * 60_000;
const firmwareLockWaitMs = unprobeableLockStaleMs + 60_000;
const buildTails = new Map();
const fallbackProcessIdentity = `started:${Math.floor(Date.now() - process.uptime() * 1000)}`;
let linuxBootIdentity;

function compareCodeUnits(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function artifactToken(name, prefix) {
	if (!name.startsWith(prefix)) {
		return null;
	}
	const token = name.slice(prefix.length);
	return uuidPattern.test(token) ? token : null;
}

async function getProcessIdentity(pid) {
	if (process.platform === "linux") {
		try {
			linuxBootIdentity ??= readFile("/proc/sys/kernel/random/boot_id", "utf8")
				.then((value) => value.trim());
			const [bootIdentity, processStat] = await Promise.all([
				linuxBootIdentity,
				readFile(`/proc/${pid}/stat`, "utf8"),
			]);
			const closingParenthesis = processStat.lastIndexOf(")");
			const fieldsAfterName = processStat.slice(closingParenthesis + 2).trim().split(/\s+/);
			const startTicks = fieldsAfterName[19];
			return closingParenthesis > 0 && /^\d+$/.test(startTicks) ?
				`linux:${bootIdentity}:${startTicks}` : null;
		} catch (error) {
			if (hasErrorCode(error, "ENOENT", "ESRCH")) {
				return null;
			}
			return pid === process.pid ? fallbackProcessIdentity : null;
		}
	}
	return pid === process.pid ? fallbackProcessIdentity : null;
}

function formatPath(root, path) {
	const formatted = relative(root, path);
	return formatted || ".";
}

async function walkFiles(directory, root = repositoryRoot) {
	const directoryStat = await lstat(directory);
	if (directoryStat.isSymbolicLink()) {
		throw new Error(`Refusing to package symbolic link: ${formatPath(root, directory)}`);
	}
	if (!directoryStat.isDirectory()) {
		throw new Error(`Expected firmware asset directory: ${formatPath(root, directory)}`);
	}

	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries.sort((left, right) => compareCodeUnits(left.name, right.name))) {
		// Match the former glob behavior and never turn editor/credential dotfiles into firmware assets.
		if (entry.name.startsWith(".")) {
			continue;
		}
		const path = join(directory, entry.name);
		if (entry.isSymbolicLink()) {
			throw new Error(`Refusing to package symbolic link: ${formatPath(root, path)}`);
		}
		if (entry.isDirectory()) {
			files.push(...await walkFiles(path, root));
		} else if (entry.isFile()) {
			files.push(path);
		}
	}

	return files;
}

function archivePath(path) {
	return path.split(sep).join("/");
}

function isWithin(parent, child) {
	const childPath = relative(parent, child);
	return childPath === "" || (!isAbsolute(childPath) && childPath !== ".." &&
		!childPath.startsWith(`..${sep}`));
}

async function validateAssetRoot(root, canonicalRoot, name) {
	const path = join(root, name);
	const pathStat = await lstat(path);
	if (pathStat.isSymbolicLink()) {
		throw new Error(`Refusing to package symbolic link: ${formatPath(root, path)}`);
	}
	if (!pathStat.isDirectory()) {
		throw new Error(`Expected firmware asset directory: ${formatPath(root, path)}`);
	}
	const canonicalPath = await realpath(path);
	if (canonicalPath === canonicalRoot || !isWithin(canonicalRoot, canonicalPath)) {
		throw new Error(`Firmware asset directory escapes repository root: ${formatPath(root, path)}`);
	}
	return path;
}

export async function collectFirmwareEntries(root = repositoryRoot) {
	const canonicalRoot = await realpath(root);
	const wwwRoot = await validateAssetRoot(root, canonicalRoot, "www");
	const resRoot = await validateAssetRoot(root, canonicalRoot, "res");
	const entries = [];

	for (const directory of ["css", "js", "vendor-js", "img"]) {
		for (const source of await walkFiles(join(wwwRoot, directory), root)) {
			entries.push({ source, target: archivePath(relative(wwwRoot, source)) });
		}
	}

	for (const source of await walkFiles(join(wwwRoot, "locale"), root)) {
		if (source.endsWith(".js") && dirname(source) === join(wwwRoot, "locale")) {
			entries.push({ source, target: `locale/${basename(source)}` });
		}
	}

	const rootEntries = await readdir(wwwRoot, { withFileTypes: true });
	for (const entry of rootEntries.sort((left, right) => compareCodeUnits(left.name, right.name))) {
		const { name } = entry;
		if (name.startsWith(".")) {
			continue;
		}
		const selected = name.endsWith(".html") || name === "manifest.json" || name === "sw.js";
		if (!selected) {
			continue;
		}
		const source = join(wwwRoot, name);
		if (entry.isSymbolicLink()) {
			throw new Error(`Refusing to package symbolic link: ${formatPath(root, source)}`);
		}
		if (entry.isFile()) {
			entries.push({ source, target: name });
		}
	}

	const iosRoot = join(resRoot, "ios-web");
	for (const source of await walkFiles(iosRoot, root)) {
		entries.push({ source, target: archivePath(relative(root, source)) });
	}

	return entries.sort((left, right) => compareCodeUnits(left.target, right.target));
}

function sameFileIdentity(left, right) {
	return left.dev === right.dev && left.ino === right.ino;
}

function sameFileVersion(left, right) {
	return sameFileIdentity(left, right) && left.size === right.size &&
		left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function snapshotFirmwareEntry(entry, root, canonicalRoot) {
	let pathStat;
	try {
		pathStat = await lstat(entry.source, { bigint: true });
	} catch (error) {
		throw new Error(`Unable to inspect firmware asset: ${formatPath(root, entry.source)}`, { cause: error });
	}
	if (pathStat.isSymbolicLink() || !pathStat.isFile()) {
		throw new Error(`Refusing to package non-regular asset: ${formatPath(root, entry.source)}`);
	}

	const noFollow = fsConstants.O_NOFOLLOW ?? 0;
	const nonBlocking = fsConstants.O_NONBLOCK ?? 0;
	let handle;
	try {
		handle = await open(entry.source, fsConstants.O_RDONLY | noFollow | nonBlocking);
	} catch (error) {
		throw new Error(`Unable to open firmware asset safely: ${formatPath(root, entry.source)}`, { cause: error });
	}

	try {
		const openedStat = await handle.stat({ bigint: true });
		const [currentStat, canonicalPath] = await Promise.all([
			lstat(entry.source, { bigint: true }),
			realpath(entry.source),
		]);
		if (!openedStat.isFile() || currentStat.isSymbolicLink() || !currentStat.isFile() ||
			!sameFileIdentity(openedStat, currentStat) || !isWithin(canonicalRoot, canonicalPath)) {
			throw new Error(`Firmware asset changed or escaped its source tree: ${formatPath(root, entry.source)}`);
		}

		const contents = await handle.readFile();
		const finalStat = await handle.stat({ bigint: true });
		if (!sameFileVersion(openedStat, finalStat)) {
			throw new Error(`Firmware asset changed while being read: ${formatPath(root, entry.source)}`);
		}
		return { source: entry.source, target: entry.target, contents, version: finalStat };
	} finally {
		await handle.close();
	}
}

export async function snapshotFirmwareEntries(entries, root = repositoryRoot) {
	const canonicalRoot = await realpath(root);
	const snapshots = [];
	for (const entry of entries) {
		snapshots.push(await snapshotFirmwareEntry(entry, root, canonicalRoot));
	}
	return snapshots;
}

export async function validateFirmwareSnapshots(entries, snapshots, root = repositoryRoot) {
	const latestEntries = await collectFirmwareEntries(root);
	if (latestEntries.length !== entries.length || snapshots.length !== entries.length) {
		throw new Error("Firmware source membership changed while being snapshotted");
	}
	const canonicalRoot = await realpath(root);
	for (let index = 0; index < entries.length; index++) {
		const entry = entries[index];
		const latestEntry = latestEntries[index];
		const snapshot = snapshots[index];
		if (latestEntry.source !== entry.source || latestEntry.target !== entry.target ||
			snapshot.source !== entry.source || snapshot.target !== entry.target) {
			throw new Error("Firmware source membership changed while being snapshotted");
		}
		let currentStat;
		let canonicalPath;
		try {
			[currentStat, canonicalPath] = await Promise.all([
				lstat(entry.source, { bigint: true }),
				realpath(entry.source),
			]);
		} catch (error) {
			throw new Error(`Firmware asset changed after being read: ${formatPath(root, entry.source)}`, {
				cause: error,
			});
		}
		if (currentStat.isSymbolicLink() || !currentStat.isFile() ||
			!sameFileVersion(snapshot.version, currentStat) || !isWithin(canonicalRoot, canonicalPath)) {
			throw new Error(`Firmware asset changed after being read: ${formatPath(root, entry.source)}`);
		}
	}
}

async function createArchive(outputPath, snapshots, modulesJson) {

	await new Promise((resolveArchive, rejectArchive) => {
		const output = createWriteStream(outputPath, { mode: 0o644 });
		const archive = new ZipArchive({ zlib: { level: 9 } });

		output.once("close", resolveArchive);
		output.once("error", rejectArchive);
		archive.once("error", rejectArchive);
		archive.pipe(output);

		for (const { target, contents } of snapshots) {
			archive.append(contents, {
				name: target,
				date: fixedArchiveDate,
				mode: 0o644,
			});
		}
		archive.append(modulesJson, {
			name: "modules.json",
			date: fixedArchiveDate,
			mode: 0o644,
		});
		archive.finalize().catch(rejectArchive);
	});
}

function hasErrorCode(error, ...codes) {
	return error instanceof Error && "code" in error && codes.includes(error.code);
}

async function pathState(path) {
	try {
		return await lstat(path);
	} catch (error) {
		if (hasErrorCode(error, "ENOENT")) {
			return null;
		}
		throw error;
	}
}

async function prepareBuildRoot(root) {
	const canonicalRoot = await realpath(root);
	const requestedBuildRoot = join(root, "build");
	try {
		await mkdir(requestedBuildRoot, { mode: 0o755 });
	} catch (error) {
		if (!hasErrorCode(error, "EEXIST")) {
			throw error;
		}
	}

	const buildStat = await lstat(requestedBuildRoot);
	if (buildStat.isSymbolicLink() || !buildStat.isDirectory()) {
		throw new Error("Refusing a symbolic-link or non-directory firmware build root");
	}
	const buildRoot = await realpath(requestedBuildRoot);
	const expectedBuildRoot = join(canonicalRoot, "build");
	if (buildRoot !== expectedBuildRoot) {
		throw new Error("Firmware build root escapes the repository root");
	}
	return { buildRoot, canonicalRoot };
}

async function assertBuildRoot(buildRoot, canonicalRoot) {
	const buildStat = await lstat(buildRoot);
	if (buildStat.isSymbolicLink() || !buildStat.isDirectory() ||
		await realpath(buildRoot) !== join(canonicalRoot, "build")) {
		throw new Error("Firmware build root changed or escaped the repository root");
	}
}

function parseLockOwner(raw) {
	try {
		const owner = JSON.parse(raw);
		if (owner?.version !== 1 || typeof owner.token !== "string" || owner.token.length < 1 ||
			!Number.isSafeInteger(owner.pid) || owner.pid < 1 || owner.pid > 0x7fffffff ||
			typeof owner.hostname !== "string" || owner.hostname.length < 1 ||
			typeof owner.processIdentity !== "string" || owner.processIdentity.length < 1 ||
			!Number.isFinite(owner.createdAt)) {
			return null;
		}
		return owner;
	} catch {
		return null;
	}
}

async function inspectFirmwareLock(lockDirectory) {
	const ownerPath = join(lockDirectory, "owner.json");
	try {
		const raw = await readFile(ownerPath, "utf8");
		const ownerStat = await stat(ownerPath);
		let modifiedAt = ownerStat.mtimeMs;
		try {
			const heartbeatStat = await stat(join(lockDirectory, "heartbeat"));
			modifiedAt = Math.max(modifiedAt, heartbeatStat.mtimeMs);
		} catch (error) {
			if (!hasErrorCode(error, "ENOENT")) {
				throw error;
			}
		}
		return { raw, owner: parseLockOwner(raw), modifiedAt };
	} catch (error) {
		if (!hasErrorCode(error, "ENOENT")) {
			throw error;
		}
		try {
			const lockStat = await stat(lockDirectory);
			return { raw: null, owner: null, modifiedAt: lockStat.mtimeMs };
		} catch (lockError) {
			if (hasErrorCode(lockError, "ENOENT")) {
				return null;
			}
			throw lockError;
		}
	}
}

function localProcessIsAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM means the process exists but belongs to another user. Only ESRCH proves death.
		return !hasErrorCode(error, "ESRCH");
	}
}

async function firmwareLockIsStale(lockState) {
	const leaseExpired = Date.now() - lockState.modifiedAt >= unprobeableLockStaleMs;
	if (!lockState.owner) {
		return leaseExpired;
	}
	if (lockState.owner.hostname !== hostname()) {
		// Foreign and otherwise unqueryable owners rely on the same bounded heartbeat
		// lease. Healthy builders renew it every five seconds.
		return leaseExpired;
	}

	const alive = localProcessIsAlive(lockState.owner.pid);
	if (!alive) {
		return true;
	}
	const identity = await getProcessIdentity(lockState.owner.pid);
	if (identity === null) {
		return leaseExpired;
	}
	if (identity !== lockState.owner.processIdentity) {
		return true;
	}
	// Module instances and worker threads have independent JavaScript state while
	// sharing a PID. A matching identity remains owned while its heartbeat lease is
	// current, but a terminated worker cannot strand the parent process forever.
	return leaseExpired;
}

function lockStatesMatch(left, right) {
	return left?.raw === right?.raw && left?.modifiedAt === right?.modifiedAt;
}

function lockStateFingerprint(lockState) {
	return createHash("sha256")
		.update(`${lockState.raw ?? ""}\0${lockState.modifiedAt}`)
		.digest("hex");
}

async function createFirmwareOwner(token) {
	return {
		version: 1,
		token,
		pid: process.pid,
		hostname: hostname(),
		processIdentity: await getProcessIdentity(process.pid) ?? fallbackProcessIdentity,
		createdAt: Date.now(),
	};
}

async function prepareOwnedDirectory(directory, owner) {
	await mkdir(directory, { mode: 0o700 });
	try {
		await writeFile(join(directory, "owner.json"), `${JSON.stringify(owner)}\n`, {
			flag: "wx",
			mode: 0o600,
		});
		await writeFile(join(directory, "heartbeat"), "", { flag: "wx", mode: 0o600 });
	} catch (error) {
		await rm(directory, { recursive: true, force: true });
		throw error;
	}
}

async function reapStaleFirmwareLock(lockDirectory, observedState) {
	const reaperToken = randomUUID();
	const reaperOwner = await createFirmwareOwner(reaperToken);
	const reaperCandidate = join(dirname(lockDirectory), `.firmware-reaper-${reaperToken}`);
	const reaperDirectory = join(lockDirectory, ".reaping");
	let reaperInstalled = false;
	let shouldReap = true;
	let reaped = false;
	let operationError = null;
	await prepareOwnedDirectory(reaperCandidate, reaperOwner);
	try {
		while (shouldReap && !reaperInstalled) {
			try {
				await rename(reaperCandidate, reaperDirectory);
				reaperInstalled = true;
			} catch (error) {
				if (hasErrorCode(error, "ENOENT")) {
					shouldReap = false;
					break;
				}
				if (!hasErrorCode(error, "EEXIST", "ENOTEMPTY")) throw error;
			}
			if (reaperInstalled) break;

			const [parentState, markerState] = await Promise.all([
				inspectFirmwareLock(lockDirectory),
				inspectFirmwareLock(reaperDirectory),
			]);
			if (!lockStatesMatch(parentState, observedState) ||
				!parentState || !await firmwareLockIsStale(parentState) ||
				!markerState || !await firmwareLockIsStale(markerState)) {
				shouldReap = false;
				break;
			}

			// A killed reaper must not wedge the lock forever. Move its marker to a
			// state-derived name before claiming the canonical marker; concurrent
			// takeovers use the same destination, so only one can displace it.
			const staleMarker = join(lockDirectory,
				`.reaping-stale-${lockStateFingerprint(markerState)}`);
			const currentMarkerState = await inspectFirmwareLock(reaperDirectory);
			if (!lockStatesMatch(currentMarkerState, markerState)) continue;
			try {
				await rename(reaperDirectory, staleMarker);
			} catch (error) {
				if (hasErrorCode(error, "EEXIST", "ENOTEMPTY", "ENOENT")) continue;
				throw error;
			}
		}

		if (shouldReap) {
			const currentState = await inspectFirmwareLock(lockDirectory);
			if (!lockStatesMatch(currentState, observedState) ||
				!currentState || !await firmwareLockIsStale(currentState)) {
				shouldReap = false;
			}
		}
		if (shouldReap) {
			const retiredDirectory = join(dirname(lockDirectory), `.firmware-reaped-${reaperToken}`);
			await rename(lockDirectory, retiredDirectory);
			reaperInstalled = false;
			await rm(retiredDirectory, { recursive: true, force: true });
			reaped = true;
		}
	} catch (error) {
		operationError = error;
	}

	let cleanupError = null;
	try {
		if (reaperInstalled) {
			try {
				await rename(reaperDirectory, reaperCandidate);
			} catch (error) {
				if (!hasErrorCode(error, "ENOENT")) throw error;
			}
		}
		await rm(reaperCandidate, { recursive: true, force: true });
	} catch (error) {
		cleanupError = error;
	}
	if (operationError && cleanupError) {
		throw new AggregateError([operationError, cleanupError], "Firmware lock reaping and cleanup both failed");
	}
	if (operationError) throw operationError;
	if (cleanupError) throw cleanupError;
	return reaped;
}

async function acquireFirmwareLock(buildRoot) {
	const token = randomUUID();
	const lockDirectory = join(buildRoot, firmwareLockName);
	const candidateDirectory = join(buildRoot, `.firmware-build-lock-${token}`);
	const candidateHeartbeatPath = join(candidateDirectory, "heartbeat");
	const owner = await createFirmwareOwner(token);
	const deadline = Date.now() + firmwareLockWaitMs;
	let acquired = false;
	await prepareOwnedDirectory(candidateDirectory, owner);
	try {
		while (!acquired) {
			try {
				// The candidate is already complete. Protocol participants never empty the
				// canonical lock in place: release/reaping retire it with one rename, so a
				// candidate cannot replace another valid owner during handoff.
				await rename(candidateDirectory, lockDirectory);
				acquired = true;
				break;
			} catch (error) {
				if (!hasErrorCode(error, "EEXIST", "ENOTEMPTY")) throw error;
			}

			const lockState = await inspectFirmwareLock(lockDirectory);
			if (lockState && await firmwareLockIsStale(lockState) &&
				await reapStaleFirmwareLock(lockDirectory, lockState)) {
				continue;
			}
			if (Date.now() >= deadline) {
				throw new Error(`Timed out waiting ${firmwareLockWaitMs}ms for firmware build lock`);
			}
			const now = new Date();
			await utimes(candidateHeartbeatPath, now, now);
			await delay(20 + Math.floor(Math.random() * 31));
		}
	} finally {
		if (!acquired) {
			await rm(candidateDirectory, { recursive: true, force: true });
		}
	}
	const installedHeartbeatPath = join(lockDirectory, "heartbeat");
	let heartbeatFailure = null;
	let heartbeatTail = Promise.resolve();
	const refreshHeartbeat = () => {
		heartbeatTail = heartbeatTail.then(async () => {
			try {
				const now = new Date();
				await utimes(installedHeartbeatPath, now, now);
			} catch (error) {
				heartbeatFailure ??= error;
			}
		});
	};
	const heartbeatTimer = setInterval(refreshHeartbeat, firmwareHeartbeatMs);
	heartbeatTimer.unref();

	return {
		lockDirectory,
		token,
		owner,
		get heartbeatFailure() {
			return heartbeatFailure;
		},
		async release() {
			clearInterval(heartbeatTimer);
			await heartbeatTail;
			const [lockState, reapingState] = await Promise.all([
				inspectFirmwareLock(lockDirectory),
				pathState(join(lockDirectory, ".reaping")),
			]);
			if (!lockState || lockState.owner?.token !== token || reapingState !== null) {
				throw new Error("Firmware build lock ownership was lost");
			}
			const retiredDirectory = join(buildRoot, `.firmware-retired-${token}`);
			await rename(lockDirectory, retiredDirectory);
			await rm(retiredDirectory, { recursive: true, force: true });
			if (heartbeatFailure) {
				throw new Error("Firmware build lock heartbeat failed", { cause: heartbeatFailure });
			}
		},
	};
}

async function assertFirmwareLockOwned(lock) {
	if (lock.heartbeatFailure) {
		throw new Error("Firmware build lock heartbeat failed", { cause: lock.heartbeatFailure });
	}
	const now = new Date();
	try {
		await utimes(join(lock.lockDirectory, "heartbeat"), now, now);
	} catch (error) {
		throw new Error("Firmware build lock heartbeat could not be renewed", { cause: error });
	}
	const [lockState, reapingState] = await Promise.all([
		inspectFirmwareLock(lock.lockDirectory),
		pathState(join(lock.lockDirectory, ".reaping")),
	]);
	if (!lockState || lockState.owner?.token !== lock.token || reapingState !== null) {
		throw new Error("Firmware build lock ownership was lost before publication");
	}
}

async function cleanupStaleLockArtifacts(buildRoot, lock) {
	const entries = await readdir(buildRoot, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
		const privatePrefixes = [
			".firmware-build-lock-",
			".firmware-reaper-",
			".firmware-retired-",
		];
		let handled = false;
		for (const prefix of privatePrefixes) {
			const token = artifactToken(entry.name, prefix);
			if (!token) continue;
			handled = true;
			const artifact = join(buildRoot, entry.name);
			let state;
			try {
				state = await readOwnedArtifact(artifact, token);
			} catch {
				// An uninitialized or forged private name is not trusted for deletion,
				// but it cannot participate in publication and must not block builds.
				break;
			}
			if (await firmwareLockIsStale(state)) {
				await assertFirmwareLockOwned(lock);
				await rm(artifact, { recursive: true, force: true });
			}
			break;
		}
		if (handled) continue;

		const reaperToken = artifactToken(entry.name, ".firmware-reaped-");
		if (!reaperToken) continue;
		const artifact = join(buildRoot, entry.name);
		let reaperState;
		try {
			reaperState = await readOwnedArtifact(join(artifact, ".reaping"), reaperToken);
		} catch {
			continue;
		}
		if (await firmwareLockIsStale(reaperState)) {
			await assertFirmwareLockOwned(lock);
			await rm(artifact, { recursive: true, force: true });
		}
	}
}

function validateArtifactOwner(value, token) {
	const raw = JSON.stringify(value);
	const owner = parseLockOwner(raw);
	if (!owner || owner.token !== token) {
		throw new Error("Invalid firmware artifact owner identity");
	}
	return { owner, raw };
}

async function readOwnedArtifact(directory, token, metadataName = "owner.json") {
	const metadataPath = join(directory, metadataName);
	const metadataState = await lstat(metadataPath);
	if (metadataState.isSymbolicLink() || !metadataState.isFile()) {
		throw new Error("Invalid firmware artifact owner file");
	}
	const parsed = JSON.parse(await readFile(metadataPath, "utf8"));
	const identity = validateArtifactOwner(parsed.owner ?? parsed, token);
	return { ...identity, modifiedAt: metadataState.mtimeMs, metadata: parsed };
}

async function generatedTreeIsValid(directory, containmentRoot) {
	try {
		const directoryState = await lstat(directory);
		if (directoryState.isSymbolicLink() || !directoryState.isDirectory() ||
			!isWithin(containmentRoot, await realpath(directory))) {
			return false;
		}
		let hasArchive = false;
		let hasModules = false;
		const visit = async (current) => {
			for (const entry of await readdir(current, { withFileTypes: true })) {
				const path = join(current, entry.name);
				if (entry.isSymbolicLink()) return false;
				if (entry.isDirectory()) {
					if (!await visit(path)) return false;
				} else if (!entry.isFile()) {
					return false;
				}
			}
			return true;
		};
		if (!await visit(directory)) return false;
		const [archiveState, modulesState] = await Promise.all([
			lstat(join(directory, "UI.zip")),
			lstat(join(directory, "modules.json")),
		]);
		hasArchive = archiveState.isFile() && !archiveState.isSymbolicLink();
		hasModules = modulesState.isFile() && !modulesState.isSymbolicLink();
		return hasArchive && hasModules;
	} catch {
		return false;
	}
}

async function regularContainedFile(path, containmentRoot) {
	try {
		const state = await lstat(path);
		return state.isFile() && !state.isSymbolicLink() &&
			isWithin(containmentRoot, await realpath(path));
	} catch {
		return false;
	}
}

async function firmwarePairIsValid(firmwareRoot, modulesRoot, containmentRoot) {
	if (!await generatedTreeIsValid(firmwareRoot, containmentRoot) ||
		!await regularContainedFile(modulesRoot, containmentRoot)) {
		return false;
	}
	const [internalModules, externalModules] = await Promise.all([
		readFile(join(firmwareRoot, "modules.json")),
		readFile(modulesRoot),
	]);
	return internalModules.equals(externalModules);
}

function validatePublicationMetadata(value, token) {
	const keys = value && typeof value === "object" ?
		Object.keys(value).sort(compareCodeUnits).join(",") : "";
	let previousPair;
	if (value?.version === 2 && typeof value.previousPair === "boolean" &&
		keys === "owner,previousPair,version") {
		previousPair = value.previousPair;
	} else if (value?.version === 1 && typeof value.hadFirmware === "boolean" &&
		typeof value.hadModules === "boolean" &&
		keys === "hadFirmware,hadModules,owner,version") {
		// Version 1 recorded paths independently. A mismatched pair was never a
		// recoverable published result, so it is treated like no previous pair.
		previousPair = value.hadFirmware && value.hadModules;
	} else {
		throw new Error("Invalid interrupted firmware publication metadata");
	}
	return { previousPair, ...validateArtifactOwner(value.owner, token) };
}

async function recoverPublicationTransaction(transactionRoot, buildRoot, token, lock) {
	const transactionStat = await lstat(transactionRoot);
	if (transactionStat.isSymbolicLink() || !transactionStat.isDirectory() ||
		!isWithin(buildRoot, await realpath(transactionRoot))) {
		throw new Error("Refusing an invalid firmware publication transaction");
	}
	const metadataPath = join(transactionRoot, "metadata.json");
	const metadataState = await lstat(metadataPath);
	if (metadataState.isSymbolicLink() || !metadataState.isFile()) {
		throw new Error("Invalid interrupted firmware publication metadata");
	}
	const metadata = validatePublicationMetadata(
		JSON.parse(await readFile(metadataPath, "utf8")), token,
	);
	if (token !== lock.token && !await firmwareLockIsStale({
		owner: metadata.owner,
		raw: metadata.raw,
		modifiedAt: metadataState.mtimeMs,
	})) {
		throw new Error("Firmware publication owner is not provably stale");
	}

	const firmwareRoot = join(buildRoot, "firmware");
	const modulesRoot = join(buildRoot, "modules.json");
	if (await firmwarePairIsValid(firmwareRoot, modulesRoot, buildRoot)) {
		await assertFirmwareLockOwned(lock);
		await rm(transactionRoot, { recursive: true, force: true });
		return;
	}

	const firmwareBackup = join(transactionRoot, "firmware.previous");
	const modulesBackup = join(transactionRoot, "modules.previous.json");
	const [firmwareBackupState, modulesBackupState] = await Promise.all([
		pathState(firmwareBackup),
		pathState(modulesBackup),
	]);
	if (metadata.previousPair) {
		// A crash can split the old pair across the transaction and live locations:
		// firmware is moved first, followed by modules.json. Prefer a backup when it
		// exists, otherwise the corresponding live path is still the old component.
		const firmwareRecoverySource = firmwareBackupState === null ? firmwareRoot : firmwareBackup;
		const modulesRecoverySource = modulesBackupState === null ? modulesRoot : modulesBackup;
		if (!await firmwarePairIsValid(firmwareRecoverySource, modulesRecoverySource, buildRoot)) {
			throw new Error("Interrupted firmware publication has no valid recovery pair");
		}

		if (firmwareBackupState !== null) {
			await assertFirmwareLockOwned(lock);
			await rm(firmwareRoot, { recursive: true, force: true });
			await assertFirmwareLockOwned(lock);
			await rename(firmwareBackup, firmwareRoot);
		}
		if (modulesBackupState !== null) {
			await assertFirmwareLockOwned(lock);
			await rm(modulesRoot, { recursive: true, force: true });
			await assertFirmwareLockOwned(lock);
			await rename(modulesBackup, modulesRoot);
		}
	}

	if (!metadata.previousPair) {
		await assertFirmwareLockOwned(lock);
		await rm(firmwareRoot, { recursive: true, force: true });
		await assertFirmwareLockOwned(lock);
		await rm(modulesRoot, { recursive: true, force: true });
	}
	await assertFirmwareLockOwned(lock);
	await rm(transactionRoot, { recursive: true, force: true });
}

async function recoverBuildArtifacts(buildRoot, lock) {
	const entries = (await readdir(buildRoot, { withFileTypes: true }))
		.sort((left, right) => compareCodeUnits(left.name, right.name));
	for (const entry of entries) {
		const transactionToken = artifactToken(entry.name, ".firmware-publish-");
		if (transactionToken) {
			await assertFirmwareLockOwned(lock);
			await recoverPublicationTransaction(
				join(buildRoot, entry.name), buildRoot, transactionToken, lock,
			);
			continue;
		}
		const workToken = artifactToken(entry.name, ".firmware-work-");
		if (!workToken || entry.isSymbolicLink() || !entry.isDirectory()) continue;
		const workRoot = join(buildRoot, entry.name);
		let state;
		try {
			state = await readOwnedArtifact(workRoot, workToken);
		} catch {
			continue;
		}
		if (await firmwareLockIsStale(state)) {
			await assertFirmwareLockOwned(lock);
			await rm(workRoot, { recursive: true, force: true });
		}
	}
}

async function lockIsStillOwned(lock) {
	try {
		await assertFirmwareLockOwned(lock);
		return true;
	} catch {
		return false;
	}
}

async function publishFirmware(buildRoot, stageRoot, modulesStage, lock) {
	await assertFirmwareLockOwned(lock);
	const firmwareRoot = join(buildRoot, "firmware");
	const modulesRoot = join(buildRoot, "modules.json");
	const transactionRoot = join(buildRoot, `.firmware-publish-${lock.token}`);
	const transactionCandidate = join(lock.lockDirectory, "publication");
	const firmwareBackup = join(transactionRoot, "firmware.previous");
	const modulesBackup = join(transactionRoot, "modules.previous.json");
	const [firmwareState, modulesState] = await Promise.all([
		pathState(firmwareRoot),
		pathState(modulesRoot),
	]);
	const previousPair = await firmwarePairIsValid(firmwareRoot, modulesRoot, buildRoot);

	await mkdir(transactionCandidate, { mode: 0o700 });
	try {
		await assertFirmwareLockOwned(lock);
		await writeFile(join(transactionCandidate, "metadata.json"), `${JSON.stringify({
			version: 2,
			previousPair,
			owner: lock.owner,
		})}\n`, { flag: "wx", mode: 0o600 });
		await assertFirmwareLockOwned(lock);
		// Prepare the complete journal under the owned lock and publish it with one
		// rename. A crash therefore leaves either no transaction or a parseable one.
		await rename(transactionCandidate, transactionRoot);
	} catch (error) {
		await rm(transactionCandidate, { recursive: true, force: true });
		throw error;
	}

	try {
		await assertFirmwareLockOwned(lock);
		if (firmwareState !== null) {
			await rename(firmwareRoot, firmwareBackup);
		}
		await assertFirmwareLockOwned(lock);
		if (modulesState !== null) {
			await rename(modulesRoot, modulesBackup);
		}
		await assertFirmwareLockOwned(lock);
		await rename(stageRoot, firmwareRoot);
		await assertFirmwareLockOwned(lock);
		await rename(modulesStage, modulesRoot);
		await assertFirmwareLockOwned(lock);
		await writeFile(join(transactionRoot, "committed"), "", { flag: "wx", mode: 0o600 });
		await assertFirmwareLockOwned(lock);
		await rm(transactionRoot, { recursive: true, force: true });
	} catch (error) {
		if (await lockIsStillOwned(lock)) {
			try {
				await recoverPublicationTransaction(transactionRoot, buildRoot, lock.token, lock);
			} catch (recoveryError) {
				throw new AggregateError([error, recoveryError], "Firmware publication and rollback both failed");
			}
		}
		throw error;
	}
}

async function makePublicAssetTree(directory) {
	await chmod(directory, 0o755);
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			await makePublicAssetTree(path);
		} else if (entry.isFile()) {
			await chmod(path, 0o644);
		}
	}
}

async function buildFirmwareOnce(root) {
	const { buildRoot, canonicalRoot } = await prepareBuildRoot(root);
	const lock = await acquireFirmwareLock(buildRoot);
	try {
		await assertBuildRoot(buildRoot, canonicalRoot);
		await assertFirmwareLockOwned(lock);
		await recoverBuildArtifacts(buildRoot, lock);
		await cleanupStaleLockArtifacts(buildRoot, lock);
		// Private work belongs to the atomically installed lock. If the process dies,
		// stale-lock recovery removes it without trusting a second owner journal.
		const workRoot = join(lock.lockDirectory, "work");
		const temporaryRoot = join(workRoot, "firmware");
		const modulesStage = join(workRoot, "modules.json");
		await mkdir(workRoot, { mode: 0o700 });
		await mkdir(temporaryRoot, { mode: 0o700 });
		try {
			const entries = await collectFirmwareEntries(root);
			const modulePrefix = "js/modules/";
			const moduleNames = entries
				.map((entry) => entry.target)
				.filter((target) => target.startsWith(modulePrefix) && target.endsWith(".js") &&
					!target.slice(modulePrefix.length).includes("/"))
				.map((target) => target.slice(modulePrefix.length))
				.sort(compareCodeUnits);
			const modulesJson = `${JSON.stringify(moduleNames, null, 2)}\n`;
			const snapshots = await snapshotFirmwareEntries(entries, root);
			await validateFirmwareSnapshots(entries, snapshots, root);

			await createArchive(join(temporaryRoot, "UI.zip"), snapshots, modulesJson);
			for (const snapshot of snapshots) {
				const destination = resolve(temporaryRoot, snapshot.target);
				if (!isWithin(temporaryRoot, destination)) {
					throw new Error(`Invalid firmware archive target: ${snapshot.target}`);
				}
				await mkdir(dirname(destination), { recursive: true });
				await writeFile(destination, snapshot.contents, { flag: "wx", mode: 0o644 });
			}
			await writeFile(join(temporaryRoot, "modules.json"), modulesJson, { mode: 0o644 });
			await writeFile(modulesStage, modulesJson, { flag: "wx", mode: 0o644 });
			await makePublicAssetTree(temporaryRoot);
			await chmod(modulesStage, 0o644);
			await assertBuildRoot(buildRoot, canonicalRoot);
			await assertFirmwareLockOwned(lock);
			await publishFirmware(buildRoot, temporaryRoot, modulesStage, lock);
			console.log(`Built ${snapshots.length + 1} firmware assets in ${relative(root, join(buildRoot, "firmware"))}`);
		} catch (error) {
			await rm(workRoot, { recursive: true, force: true });
			throw error;
		}
		await rm(workRoot, { recursive: true, force: true });
	} finally {
		await lock.release();
	}
}

/** Serialize callers targeting one output tree so clean/rename publication cannot race itself. */
export function buildFirmware(root = repositoryRoot) {
	const targetRoot = resolve(root);
	const previous = buildTails.get(targetRoot) ?? Promise.resolve();
	const request = previous.then(
		() => buildFirmwareOnce(targetRoot),
		() => buildFirmwareOnce(targetRoot),
	);
	const settled = request.then(() => undefined, () => undefined);
	buildTails.set(targetRoot, settled);
	return request.finally(() => {
		if (buildTails.get(targetRoot) === settled) {
			buildTails.delete(targetRoot);
		}
	});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	buildFirmware().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}

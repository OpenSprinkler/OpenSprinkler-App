# Phase 1 — OpenSprinkler Web/App Modernization PRD

> **Status:** Draft for review · **Scope:** the external UI app (this repo) only — **no firmware changes** · **Companion:** `OpenSprinkler-Firmware/docs/ecosystem.md`, `OpenSprinkler-Weather`. Phase 1 = the highest user-visible, lowest-device-risk layer of the web-modernization plan (Phase 0 = firmware embedded pages, already done; Phase 2 = firmware API hardening, only if new data is needed).

## 0. Why this repo, why now

The OpenSprinkler firmware is **already a headless backend**. `server_home` (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1362`) emits a ~3-line bootstrap that injects two globals and loads `<script src="<SOPT_JAVASCRIPTURL>/home.js">` (default `https://ui.opensprinkler.com/js`, `defines.h:158`). **This repo IS that app.** Re-pointing the firmware at a new build is a single runtime config (`/cu` → `SOPT_JAVASCRIPTURL`), reversible per device. So modernization happens entirely here with **zero firmware-code risk**.

**Current stack (verified):** Cordova 12 mobile shell + web (`config.xml`, `package.json`), jQuery / jQuery-Mobile-era vanilla JS (`www/js/main.js`, `www/js/modules/`), **Grunt** build (`Gruntfile.js`), **Firebase** hosting (`firebase.json`, `.firebaserc` → `ui.opensprinkler.com`), license **AGPL-3.0**.

## 1. Goal & non-goals

**Goal:** a modern, maintainable, accessible, fast web UI that consumes the existing firmware JSON API unchanged, deployable to `ui.opensprinkler.com`, with a safe per-device rollout.

**Non-goals (hard boundaries):**
- ❌ No firmware code changes. Any need for a **new API field** is **Phase 2** (real per-board firmware work on the 2 KB response buffer) — it does not belong in Phase 1.
- ❌ No change to the device's JSON API shape, auth model, or the `home.js` bootstrap contract (§4) without an explicit cross-repo decision.
- ❌ No realtime/WebSocket dependency (the on-device server is single-client poll-only; irrigation is minute-scale).

## 2. Strategic decision — incremental modernization, not greenfield

**Recommendation: incrementally modernize this codebase; do NOT greenfield.**

Rationale (grounded in what `home.js` already solves): the existing app handles the *hard* integration problems that a rewrite would have to re-solve from scratch:
- **Self-locating bootstrap** — `getAssetLocation()` (`www/js/home.js:23`) derives the CDN base from its own `<script src$='home.js'>` URL.
- **Cross-origin device access** — CORS handling incl. legacy shims (`www/js/home.js:277,339`).
- **Auth** — `md5(pw)` hashing (`www/js/hasher.js`, `home.js:342-344`) + `pw=` param (`home.js:305`).
- **Firmware globals** — consumes injected `ver` (fw version) and `ipas` (ignore-password) (`home.js:1` globals).
- **Local vs OpenThings-Cloud (OTC) access paths**, i18n (`www/locale/`, Transifex), Cordova native packaging.

A greenfield rewrite re-incurs all of that risk. Instead: **freeze the integration layer behind a typed adapter, modernize everything above it.**

## 3. Contract Capture Plan (do this FIRST — it gates everything)

The firmware JSON API is **not a freezable schema**: responses are hand-assembled via `bfill.emit_p(PSTR(...))` into a shared ~2 KB buffer with **mid-loop flushes** (`opensprinkler_server.cpp:467-468, :512, :1183, :1317, :2013`), and shapes vary with device state (station count). So we pin it empirically.

**Steps:**
1. **Capture real payloads** from (a) a live device on each target firmware version and (b) the DEMO build, for every endpoint the UI consumes:
   `/jc` (controller status), `/jo` (options), `/jn` (station names/attrib), `/jp` (programs), `/jl` (logs), `/cv` (change values/manual), `/cs` (change stations), `/co` (change options), `/cm` (manual station), `/ja` (all — aggregate), `/db` (debug) — full list in `opensprinkler_server.cpp:2231-2258`.
2. **Generate TypeScript types** from observed payloads; commit fixtures under `test/fixtures/api/<fwv>/<endpoint>.json`.
3. **Build a typed API client** (`www/src/api/`) — the single module allowed to touch the device. All UI reads/writes go through it.
4. **Snapshot/contract tests** (extend the existing `test/` karma suite or add Vitest) that assert the client parses each fixture. CI fails on drift.
5. **Rule:** re-skinning against **existing** fields is free. A screen wanting a field that isn't in the fixtures → **escalate to Phase 2 (firmware)**, do not assume it.

**Deliverable:** `www/src/api/` typed client + `test/fixtures/api/` + contract tests + a short `docs/API-CONTRACT.md` enumerating fields actually consumed.

## 4. Seam Spec — the `home.js` bootstrap contract (must be preserved)

The firmware integration is a contract. A modern build MUST still publish a `home.js` at `<SOPT_JAVASCRIPTURL>/home.js` that:

| Element | Contract | Source |
|---|---|---|
| Entry filename | `home.js` (the firmware hardcodes the `<script src>`) | `opensprinkler_server.cpp:1375` |
| Injected globals | `var ver=<OS_FW_VERSION>, ipas=<ignore_password>;` set **before** `home.js` loads | `opensprinkler_server.cpp:1372-1375` |
| Asset base | self-locate from own script URL; fall back to a default | `www/js/home.js:23-32` |
| Device base URL | derive from `window.location` (local) or the OTC forward path (remote) | `home.js` |
| Auth | `md5(pw)`; send hashed `pw=` on protected calls | `www/js/hasher.js`, `home.js:342` |
| Access paths | (a) **local LAN** (HTTP, near-same-origin), (b) **remote via OTC** `cloud.openthings.io/forward/v1/<token>` (HTTPS tunnel) | firmware OTC, `OpenThings-Framework-Firmware-Library/ARCHITECTURE.md` |
| Transport | XHR/`fetch` polling of `/jc` every 2–5 s; **no WebSockets** | — |

**Modernization approach for the seam:** wrap the above in a small, well-typed **adapter module** (`www/src/seam/`) that exposes `bootstrap({ver, ipas})`, `resolveDeviceBase()`, `auth(pw)`, `request()`. The new app depends only on this adapter; the adapter encapsulates CORS/OTC/auth quirks. This lets the UI be rewritten freely while the proven integration logic is ported, not reinvented.

> **#1 technical risk — mixed content:** an HTTPS-hosted app cannot call a plain-HTTP LAN device (browser blocks mixed content). The current app's local path works because of how it's served/accessed; remote works via the OTC HTTPS tunnel. **De-risk this before any UI work** — the seam spike (§8 step 2) must prove both paths.

## 5. fwv Compatibility Matrix

The firmware advertises its version as `fwv` in `/jo`, available **pre-auth** (`opensprinkler_server.cpp:412-413, 2442`), so the app can version-gate before login. Build a capability table; degrade gracefully on older firmware.

| Capability | Min `fwv` | Endpoint/field | UI behavior below min |
|---|---|---|---|
| Baseline status/control | 2.1.x | `/jc`, `/cv`, `/cm` | always available |
| Top-level `restricted` / `wtrestr` labeling | 2.2.1 (OS-Firmware #3) | `/jc` `wtrestr` | hide restriction badge |
| `/v1` weather adapter (opt-in) | 2.2.x + `uwtv1` | `/jo` `uwtv1` | hide the toggle |
| OTC remote-station type | (per fw) | `STN_TYPE_REMOTE_OTC` | hide option |
| _(fill in per real captures)_ | | | |

**Rules:** detect `fwv` at bootstrap; store as a capability object; **feature-gate via the capability object, never via raw `fwv` comparisons scattered in components**. Maintain this matrix in `docs/FWV-MATRIX.md`, regenerated/validated against the captured fixtures (§3) so "min fwv" claims are evidence-based.

## 6. Target architecture

- **Stack:** keep the bundle small (loads over LAN on phones). **Svelte/SvelteKit** or **Preact + Vite**, **TypeScript**, a lightweight CSS approach (CSS vars + utility classes; reuse the design tokens already in the firmware embedded pages — copy hex literals, **do not** create a shared npm token package per the architecture decision). Replace Grunt with **Vite**.
- **Layering:** `seam/` (integration adapter, §4) → `api/` (typed client, §3) → `state/` (polling cache, e.g. TanStack-style) → `ui/` (components/routes). Only `seam/`+`api/` know the device exists.
- **Cordova:** keep the native wrapper (it ships the iOS/Android apps from the same `www`); ensure the new build still produces a Cordova-compatible `www/`. Evaluate Capacitor as a later migration, not Phase 1.
- **i18n & a11y:** preserve Transifex locale pipeline (`www/locale/`); bake WCAG AA in from the start (the firmware embedded pages now set the a11y bar — match it).

## 7. Rollout & migration (zero firmware risk at every step)

1. Build the modernized app at a **parallel URL** (e.g. `ui-next.opensprinkler.com` via a second Firebase target).
2. **Test across the fwv matrix** (§5) on real devices + DEMO, both access paths (LAN + OTC).
3. **Opt-in beta:** flip `SOPT_JAVASCRIPTURL` to the new URL on a few devices (runtime `/cu`); old app stays the default fallback.
4. Expand cohort; monitor. When stable, make it the default URL.
5. **Rollback = re-point the URL.** No firmware flash, no app-store release required for the web path. (Cordova native apps follow their own store cadence.)

## 8. Phased work breakdown + first three steps

**First 3 steps (highest leverage, in order):**
1. **Contract capture (§3):** fixtures + typed `api/` client + contract tests. Gates everything.
2. **Seam spike (§4), not UI:** a minimal `home.js`/adapter that boots, reads `ver`/`ipas`, resolves the device base, authenticates, and renders **one** read-only screen from `/jc` — over **both** LAN and OTC. Proves the mixed-content/CORS/OTC risk is handled. If this works, the project is de-risked.
3. **Then** build screens (status → manual control → programs → logs → settings) against the typed client.

**Acceptance criteria:**
- [ ] Typed API client + fixtures + green contract tests for all consumed endpoints.
- [ ] Seam spike renders `/jc` over LAN **and** OTC against ≥2 firmware versions.
- [ ] fwv matrix documented + enforced via a capability object.
- [ ] New app reaches feature parity for: status, manual control, programs, run-once, logs, rain delay, settings.
- [ ] WCAG AA pass; bundle size budgeted; i18n intact.
- [ ] Parallel-URL deploy + documented per-device flip/rollback.

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Mixed content / CORS / OTC** (HTTPS app → HTTP LAN device) | **High** | Seam spike first (§8.2); port existing CORS/OTC logic, don't reinvent |
| API is not a freezable schema (2 KB buffer, state-dependent, mid-flush) | Medium | Empirical fixtures + contract tests; new-field needs → Phase 2 |
| Scope creep into firmware (new fields/endpoints) | Medium | Hard boundary §1; escalate to Phase 2 issues |
| Dated stack migration cost (jQuery-Mobile → modern) | Medium | Incremental; adapter-isolate the seam; module-by-module |
| Cordova native parity (iOS/Android from same `www`) | Medium | Keep Cordova-compatible build output; defer Capacitor |
| AGPL-3.0 obligations | Low | Stay AGPL; vet any new dependencies' licenses |

## 10. Out of scope (→ Phase 2, firmware repo)
New `/jc`/`/jo` fields, new endpoints, API versioning headers, or any change requiring `emit_p` edits to the 2 KB response buffer. These are real per-board firmware work (test AVR/ESP8266 at 2048, ESP32/Linux at 16384) and must be additive + `fwv`-gated.

---
*Draft generated for review. Verified against this repo (`www/js/home.js`, `hasher.js`, `Gruntfile.js`, `config.xml`, `package.json`) and `OpenSprinkler-Firmware` (`opensprinkler_server.cpp:1362-1378`, `defines.h:158`). Companion to the firmware ecosystem docs.*

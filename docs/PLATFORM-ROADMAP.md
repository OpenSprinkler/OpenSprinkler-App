# OpenSprinkler fork platform roadmap

> **Status:** Plan for review · **Audience:** Karson's personal fork · **Scope:** `OpenSprinkler-App`, `OpenSprinkler-Weather`, `OpenSprinkler-Firmware`, and `OpenThings-Framework-Firmware-Library` · **UX companion:** [`UX-SPEC.md`](UX-SPEC.md) · **Supporting design inputs:** [`PRODUCT.md`](../PRODUCT.md), [`DESIGN.md`](../DESIGN.md), and [`DESIGN-HANDOFF.md`](DESIGN-HANDOFF.md)
>
> This document owns sequencing, feasibility, contracts, rollout, and risk. `UX-SPEC.md` owns target screen, flow, state, responsive, and interaction detail. Verified source and the firmware API override supporting documents on current behavior.

## 0. Executive decision

Continue the existing framework-free TypeScript app. Do not start another rewrite and do not add a UI framework. The modern seam, typed API, encoders, views, and tests are useful foundations, but they are not cutover-ready: transport paths, polling, CI, input validation, and safe writes must be fixed before schedule or settings controls reach a live controller (`OpenSprinkler-App/www/src/README.md:24-47`; `OpenSprinkler-App/www/src/views/host.ts:63-120`; `OpenSprinkler-App/docs/HARDWARE-VERIFICATION.md:62-88`).

The target experience can be delivered with the existing firmware API. `/jp` and `/cp` already cover the full program model, while `/jc`, `/jo`, and `/js` already expose the weather, freshness, queue, and runtime data needed by the UI (`OpenSprinkler-Firmware/opensprinkler_server.cpp:905-1041`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1044-1204`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1351`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1760-1785`). No new firmware field or endpoint is on the critical path.

The risk order is therefore:

1. App-only transport, safety, contract, and UX work.
2. Weather-service robustness and compact explanation metadata.
3. Firmware/OTF work only after measured evidence shows a remaining gap.

## 1. Goal and non-goals

### Goal

Deliver a polished fork-only controller UI that is safe and pleasant on iPhone Safari and desktop browsers, makes program creation understandable without exposing packed firmware concepts, explains weather scaling/skips honestly, and preserves deliberate contracts across all four repositories.

### Non-goals

- No new UI framework, design-system package, font, icon dependency, or greenfield app.
- No firmware `/v1` weather adoption in this roadmap. Its request options and documentation currently disagree, and the legacy wire already supplies the required UI data (`OpenSprinkler-Weather/routes/v1/index.ts:47-73`; `OpenSprinkler-Weather/docs/v1-api.md:11-15`).
- No new firmware scheduling schema, authoritative next-run endpoint, capability endpoint, or promoted weather-reason field unless app-only work is proven insufficient.
- No WaterBudget default. Weather calls method `4` WaterBudget, while firmware reserves `4` for Monthly and rewrites it to Manual; WaterBudget also has an unbounded stale-scale hold (`OpenSprinkler-Weather/routes/weather.ts:107-113`; `OpenSprinkler-Firmware/defines.h:198-205`; `OpenSprinkler-Firmware/weather.cpp:164-171`; `OpenSprinkler-Weather/routes/adjustmentMethods/WaterBudgetAdjustmentMethod.ts:138-178`).
- No companion-server expansion. The optional SQLite companion remains feature-detected and must not gate direct-controller cutover (`OpenSprinkler-App/www/src/README.md:38-39`).
- No whole-configuration import in the modern baseline. Keep read-only export; revisit import only with schema validation, secret handling, preview, and a hardware-proven restore drill.
- No promotion of fork-only compatibility policy over the shared `ui.opensprinkler.com` deployment.
- No firmware flash as part of UI rollback.

## 2. Evidence-backed current state

### 2.1 App and deployment

- A read-only fetch of `https://ui.opensprinkler.com/` on 2026-07-16 returned HTTP 200 with the legacy entry fingerprint: off-origin Lato, jQuery/JQM, individual `js/modules/*` files, and `js/main.js`, matching the repository's legacy entrypoint (`OpenSprinkler-App/www/index.html:27-73`). The public root therefore currently serves the legacy jQuery surface, not the Vite app. The exact deployed commit remains **unverified** because the response exposes no commit identity.
- The source-defined production Firebase path serves the repository-owned legacy `build/firmware` output; the production target is selected only by a manual workflow input (`OpenSprinkler-App/firebase.json:2-5`; `OpenSprinkler-App/scripts/build-firmware.mjs`; `OpenSprinkler-App/.github/workflows/firebase-hosting.yml:84-100`).
- The Vite app emits `dist/home.js` plus `dist/assets/*`, while its workflow is manual, preview-only, and expiring (`OpenSprinkler-App/app/vite.config.ts:3-19`; `OpenSprinkler-App/.github/workflows/firebase-hosting-next.yml:1-10`; `OpenSprinkler-App/.github/workflows/firebase-hosting-next.yml:39-55`). Deploy instructions now point beta `jsp` at the site root, matching the emitted `home.js` path (`OpenSprinkler-App/docs/DEPLOY.md:50-65`).
- The production entry now imports the shipped `system.css`; its normative tokens are separate, and the demo only adds harness chrome (`OpenSprinkler-App/app/main.ts:10`; `OpenSprinkler-App/www/src/ui/tokens.css:1-54`; `OpenSprinkler-App/www/src/ui/system.css:1-11`; `OpenSprinkler-App/demo/style.css:1-7`). This resolves design-system plumbing, not the interaction and safety gaps below.
- Two supporting-design statements are technically superseded. The modern bundle is not served from controller flash with no off-origin script: firmware serves a small shell that loads the configured `<jsp>/home.js`. The handoff's “three missed polls” stale rule is also replaced by a twelve-second elapsed-time rule that remains deterministic during backoff (`OpenSprinkler-App/PRODUCT.md:17`; `OpenSprinkler-App/DESIGN.md:325`; `OpenSprinkler-App/docs/DESIGN-HANDOFF.md:25`; `OpenSprinkler-App/docs/DESIGN-HANDOFF.md:108`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1369-1385`). Keep the useful byte, dependency, asset, sunlight, and interaction constraints; do not treat those two sentences as deployment or state contracts.
- App CI now runs full dependency/security checks, lint/typecheck, both Vitest suites, app/demo/firmware/server builds, the companion container smoke test, and the isolated Chromium harness; actionlint validates release workflows before those gates (`OpenSprinkler-App/.github/workflows/test.yml`; `OpenSprinkler-App/package.json`).
- The current modern host fetches `/jc`, `/jo`, `/jn`, `/jp`, and `/jl` once, then refreshes only after retry or mutation; it has no 2–5 second status poll (`OpenSprinkler-App/app/main.ts:47-51`; `OpenSprinkler-App/www/src/views/host.ts:75-120`). The legacy app polls runtime state every four seconds and broader data every twenty seconds (`OpenSprinkler-App/www/js/modules/ui-dom.js:244-257`).
- The modern program surface creates only: program cards offer Run, Enable/Disable, Delete, and New, while form submission always sends `pid=-1` (`OpenSprinkler-App/www/src/views/programs-view.ts:31-50`; `OpenSprinkler-App/www/src/views/host.ts:105-113`). A client method for run-once exists without a user flow (`OpenSprinkler-App/www/src/api/client.ts:204-207`).
- Current settings writes reserialize whole forms. The live-controller runbook forbids those Save buttons because defaults or incomplete reads can overwrite water level, sensors, API keys, disabled stations, and adjacent settings (`OpenSprinkler-App/www/src/views/host.ts:99-116`; `OpenSprinkler-App/docs/HARDWARE-VERIFICATION.md:62-88`). Network octets are coerced rather than rejected, schedule time/date parsing accepts invalid values, and several risky actions lack suitable confirmation (`OpenSprinkler-App/www/src/api/encode.ts:220-224`; `OpenSprinkler-App/www/src/views/settings/program-edit.ts:30-41`; `OpenSprinkler-App/www/src/views/dispatch.ts:28-38`; `OpenSprinkler-App/www/src/views/dispatch.ts:61-72`).
- The seam spike remains mocked. Live iPhone/desktop LAN rendering, OTC forwarding, rollback, and final close-out are still operator-gated (`OpenSprinkler-App/test/seam-spike.spec.ts:1-6`; `OpenSprinkler-App/docs/HARDWARE-VERIFICATION.md:92-106`; `OpenSprinkler-App/docs/HARDWARE-VERIFICATION.md:219-252`).
- Standalone auth treats a missing injected `ver` as `0` and therefore selects the cleartext path, despite an existing unused pre-auth `/jo` probe (`OpenSprinkler-App/app/main.ts:22-24`; `OpenSprinkler-App/www/src/seam/device.ts:135-145`; `OpenSprinkler-App/www/src/api/client.ts:175-181`). OTC-injected navigation also drops `/forward/v1/<token>/` by reducing the device base to `location.origin` (`OpenSprinkler-App/app/main.ts:23`; `OpenSprinkler-App/test/seam-spike.spec.ts:93-97`).

### 2.2 Firmware contracts and capacity

- Current fork identity is `fwv=221`, `fwm=4`, `fwf=kars85.3` (`OpenSprinkler-Firmware/defines.h:34-53`). A changed `OS_FW_VERSION` invokes `factory_reset()`, which rewrites options, stations, controller state, and programs (`OpenSprinkler-Firmware/OpenSprinkler.cpp:2288-2343`; `OpenSprinkler-Firmware/OpenSprinkler.cpp:2387-2395`). `OS_FW_MINOR` is only copied into the loaded option array and is absent from the reset comparison (`OpenSprinkler-Firmware/OpenSprinkler.cpp:2541-2547`).
- `fwf` is computed, read-only, non-NVM data emitted on successful `/jo`/`/ja`; the App uses it as a display suffix, not a capability (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1122-1125`; `OpenSprinkler-App/www/js/modules/firmware.js:272-276`; `OpenSprinkler-App/www/src/spike/status-view.ts:53-56`).
- The App's four-digit comparison already computes `fwv * 10 + fwm`, making `2215` a reset-free gate but effectively limiting `fwm` to one digit (`OpenSprinkler-App/www/js/modules/firmware.js:163-180`).
- `_url_keys[]` and `urls[]` are independent positional tables with 23 entries and no compile-time alignment assertion (`OpenSprinkler-Firmware/opensprinkler_server.cpp:2203-2266`).
- Both OTF and AVR paths preserve the `/jo` and `/ja` auth-failure response as HTTP 200 with only `fwv`; successful `/jo` includes `wl`, which is why the legacy add-site flow can use `wl` presence as its auth-success sentinel (`OpenSprinkler-Firmware/opensprinkler_server.cpp:388-422`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:2442-2459`; `OpenSprinkler-App/www/js/modules/sites.js:671-699`; `OpenSprinkler-App/www/js/modules/sites.js:814-821`).
- Nominal `ETHER_BUFFER_SIZE` is 2048 on AVR/ESP8266 and 16384 on OSPi/native/demo; large JSON paths flush between entries, so repeated fields are materially riskier than fixed scalars (`OpenSprinkler-Firmware/defines.h:374`; `OpenSprinkler-Firmware/defines.h:400`; `OpenSprinkler-Firmware/defines.h:489`; `OpenSprinkler-Firmware/defines.h:512`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1321-1326`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:2018-2022`). There is no maintained ESP32 target in `platformio.ini` (`OpenSprinkler-Firmware/platformio.ini:15-71`).
- `/jc` already emits weather request/success timestamps, error/restriction state, opaque details, and runtime queues (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1351`). `wtdata` is latched: failed or oversized `rawData` can leave the prior successful detail object in place, so `wterr` and `lswc` must govern UI freshness (`OpenSprinkler-Firmware/weather.cpp:65-149`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1281-1290`).

### 2.3 Weather and OTF

- The legacy Weather converter already emits `restricted`, skip/fallback flags, and method-specific detail, then removes verbose strings as the payload approaches 300 bytes (`OpenSprinkler-Weather/routes/weather.ts:168-235`). The CI guard checks the 319-byte firmware limit and `restricted`, but does not exercise the final flat encoder, request method IDs, or combined skip/fallback/budget pressure (`OpenSprinkler-Weather/test/firmware-contract.spec.ts:30-43`; `OpenSprinkler-Weather/test/firmware-contract.spec.ts:71-114`).
- Weather encodes spaces as `+` and ampersands as `AMPERSAND`, but firmware stores the result verbatim; human reasons therefore need App-side decoding or a compact machine code (`OpenSprinkler-Weather/routes/weather.ts:613-629`; `OpenSprinkler-Firmware/weather.cpp:137-139`).
- Production local/Ecowitt mode returns before provider-fallback logic, so existing fallback settings do not protect it (`OpenSprinkler-Weather/routes/weather.ts:75-96`).
- The Weather Docker image does not copy `public/`, although the server looks there for `/dashboard`; its baseline data file is also excluded from the image (`OpenSprinkler-Weather/Dockerfile:22-25`; `OpenSprinkler-Weather/server.ts:74-85`; `OpenSprinkler-Weather/.dockerignore:17`).
- Firmware consumes OTF through both a mutable upstream PlatformIO constraint and an upstream submodule, while the sibling fork is version 0.2.1; demo/Linux uses the submodule (`OpenSprinkler-Firmware/platformio.ini:21-24`; `OpenSprinkler-Firmware/.gitmodules:1-3`; `OpenSprinkler-Firmware/build.sh:39-56`; `OpenThings-Framework-Firmware-Library/library.json:1-8`). The exact PlatformIO-resolved revision is **unverified**.
- OTF's secure cloud branch does not connect, and firmware passes `useSsl=false`; the browser-to-cloud leg may be HTTPS while the device-token WebSocket leg remains plaintext (`OpenThings-Framework-Firmware-Library/OpenThingsFramework.cpp:60-70`; `OpenSprinkler-Firmware/OpenSprinkler.cpp:543`; `OpenSprinkler-Firmware/OpenSprinkler.cpp:751`).

### 2.4 Documentation drift to correct first

| Drift | Source truth | Roadmap consequence |
|---|---|---|
| `fork-versioning.md` says `OS_FW_MINOR` forces a wipe. | Reset compares only `OS_FW_VERSION` (`OpenSprinkler-Firmware/docs/fork-versioning.md:36`; `OpenSprinkler-Firmware/docs/fork-versioning.md:48-52`; `OpenSprinkler-Firmware/OpenSprinkler.cpp:2387-2395`). | Correct the doc; use `fwm` for fork capability. |
| Weather producer doc says `restricted` is missing. | Code and CI already emit/pin it (`OpenSprinkler-Weather/docs/firmware-integration-requirements.md:20`; `OpenSprinkler-Weather/routes/weather.ts:430-433`; `OpenSprinkler-Weather/test/firmware-contract.spec.ts:111-114`). | Reconcile both Axis-A docs before new semantics. |
| Firmware weather doc describes two notification bugs as live. | Per-program queue state and weather gating are already fixed (`OpenSprinkler-Firmware/docs/weather-contract.md:43-47`; `OpenSprinkler-Firmware/main.cpp:924`; `OpenSprinkler-Firmware/main.cpp:960-967`). | Remove obsolete remediation from the plan. |
| Ecosystem docs call App↔Weather direct coupling nearly absent. | Legacy App calls `/baselineETo` directly and validates Weather Underground data (`OpenSprinkler-Firmware/docs/ecosystem.md:45-46`; `OpenSprinkler-App/www/js/modules/weather.js:469-486`; `OpenSprinkler-App/www/js/modules/weather.js:559-593`; `OpenSprinkler-App/www/js/modules/weather.js:959-990`). | Remove those calls with legacy retirement; do not add a modern direct Weather API dependency. |
| Docs imply `/su` changes the UI source. | `/su` renders recovery/settings; authenticated `/cu` persists `jsp` (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1207-1231`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1488-1529`). | Cutover and rollback use `/cu`; `/su` is recovery only. |
| App modernization was described as incremental. | The implementation is an isolated parallel TypeScript app (`OpenSprinkler-App/docs/PHASE-1-MODERNIZATION-PRD.md:20-31`; `OpenSprinkler-App/www/src/README.md:41-47`). | Accept the implementation reality; do not restart it. |
| `otf-integration.md` claims every non-AVR target includes ESP32. | The active PlatformIO matrix has ESP8266 and native/DEMO paths but no maintained ESP32 environment (`OpenSprinkler-Firmware/docs/otf-integration.md:6`; `OpenSprinkler-Firmware/platformio.ini:15-71`). | Remove ESP32 from the supported-target claim; do not budget unverified ESP32 capacity. |
| `ecosystem.md` attributes cached `wtdata`/`wterr`/`wtrestr` to both `/jo` and `/jc`. | Those fields are emitted by the controller-status body under `/jc`; the successful options body does not emit them (`OpenSprinkler-Firmware/docs/ecosystem.md:45-46`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1044-1150`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1351`). | Correct Axis E to consume cached Weather results through `/jc`; keep `/jo` for options such as `uwt` and `wl`. |
| The hardware runbook captures/restores `jsp` through `/jo` and promises exact restoration of a blank value. | `jsp` is emitted by `/jc`, and `/cu?jsp=` is ignored because the parsed value has zero length (`OpenSprinkler-App/docs/HARDWARE-VERIFICATION.md:144-150`; `OpenSprinkler-App/docs/HARDWARE-VERIFICATION.md:395-403`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1281-1284`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1505-1512`). | Block every live flip until the runbook uses the §5 normalized, nonblank effective-rollback procedure. |
| App `firmware-contract.md` mandates a `fwv` bump for new fields and presents the legacy cleartext fallback as the general auth flow. | A `fwv` change can factory-reset configuration; the modern fork policy preflight-rejects old firmware and uses `fwm` plus field presence after hash auth (`OpenSprinkler-App/docs/firmware-contract.md:27-34`; `OpenSprinkler-App/docs/firmware-contract.md:82-98`; `OpenSprinkler-Firmware/OpenSprinkler.cpp:2387-2395`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:388-422`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1122-1150`). | Mark the described cleartext flow legacy-only and replace the modern capability rule before Phase 1. |

## 3. Strategic product and platform decisions

### 3.1 Supported floor

Use a pre-auth floor followed by a post-auth fork/capability gate:

- If unauthenticated `/jo.fwv` is nonnumeric or numeric below `221`, show Unsupported immediately. That controller cannot meet the fork floor, and the modern App must not send a cleartext password merely to classify it.
- If pre-auth `fwv` is numeric `221` or newer, use hash authentication. For this plausible-floor shape, a `fwv`-only response means Authentication required/failed, never Unsupported.
- Only after successful `/jo` exposes normal options such as `wl` may the App require the supported storage epoch `fwv=221`, combined version `fwv*10+fwm >= 2214`, and `kars85.` fork identity. Official builds and unapproved future storage epochs become Unsupported only after this authenticated response.

The pre-auth failure shape and post-auth options shape make that ordering possible (`OpenSprinkler-Firmware/opensprinkler_server.cpp:388-422`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1122-1150`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:2449-2459`). Every Unsupported screen links to the frozen legacy UI or the device-upgrade path.

This collapses a large legacy burden without a surgical cleanup. Legacy compatibility gates flow through shared version helpers and branch into features such as logs and import/export (`OpenSprinkler-App/www/js/modules/firmware.js:157-193`; `OpenSprinkler-App/www/js/modules/logs.js:612-645`; `OpenSprinkler-App/www/js/modules/import-export.js:181-214`). Freeze that tree; delete it as a unit after cutover.

In the modern App, the floor allows deletion of the cleartext-auth branch, pre-208 string normalization, and pre-220 group/date-range fallbacks after the preflight and authenticated support gates are proven (`OpenSprinkler-App/www/src/seam/device.ts:135-145`; `OpenSprinkler-App/www/src/api/encode.ts:163-168`; `OpenSprinkler-App/www/src/views/settings/weather.ts:43-59`; `OpenSprinkler-App/www/src/views/settings/stations-edit.ts:25-30`; `OpenSprinkler-App/www/src/views/settings/program-edit.ts:74-79`). The cost is explicit: inventory/upgrade every target device, maintain an Unsupported screen, and retain the frozen legacy deployment through rollback. Do not simplify legacy gates one by one.

OSPi retirement is a support-policy change first, not an immediate C++ purge. Stop building, publishing, testing, and claiming OSPi support; remove App OSPi compatibility at modern cutover. Leave dormant `OSPI` branches initially because native demo/contract paths share non-Arduino infrastructure. Quantified payoff: remove one full QEMU/multi-architecture Docker build job and its GHCR release job, and remove the supported 24-expander/200-station Linux branch from the product matrix while retaining the Arduino 8-expander/72-station ceiling (`OpenSprinkler-Firmware/.github/workflows/build-ci.yml:100-177`; `OpenSprinkler-Firmware/.github/workflows/build-ci.yml:190-244`; `OpenSprinkler-Firmware/defines.h:156-164`). This saves release/test surface without pretending AVR's 2 KB/TLS limits disappeared.

### 3.2 Capability signaling

Use this policy:

| Signal | Meaning | Rule |
|---|---|---|
| `fwv` | Upstream/storage epoch | Never bump for fork features; a bump wipes device configuration. |
| `fwf` | Fork identity/build display | Require the `kars85.` prefix to prevent an official-build false positive, but never parse its counter as capability. |
| `fwm` | Reset-free capability level | Keep baseline `4`. The first actual firmware-visible addition becomes `5`; gate as fork identity + combined version `>=2215` + field presence. |

Do not bump `fwm` merely to bless the App modernization. Bundle related runtime additions under one level rather than consume a digit per field. Revisit a capability field only if the single-digit `fwm` namespace is actually exhausted.

No firmware field or endpoint is proposed in the baseline roadmap. If a Phase 4 measurement proves one necessary, it must be additive, use the `2215` rule above, retain an absence fallback, preserve `/jo`/`/ja` failure shape, and pass maximum-payload tests on the 2 KB class plus local and OTC streaming.

### 3.3 Weather method

Use existing ETo method `3` as “Automatic” for this roadmap because both Weather and firmware already map `3` to ETo (`OpenSprinkler-Weather/routes/weather.ts:107-113`; `OpenSprinkler-Firmware/defines.h:198-205`; `OpenSprinkler-Firmware/weather.cpp:164-171`). Hide baseline, crop, and forecast tuning from the default UI. Weather work may derive a missing baseline from the existing location dataset while preserving an explicit advanced override (`OpenSprinkler-Weather/routes/baselineETo.ts:5-96`). Keep Zimmerman under Advanced/Legacy.

Do not expose WaterBudget until a separate decision funds all of: an additive Weather method ID, stale-age fail-open policy, Docker state/baseline packaging, Weather-first request-ID contract tests, firmware `fwm=5` support, and App gating. Never repurpose method `4`.

### 3.4 Cordova, Transifex, licensing, and hosting

- Keep AGPL-3.0 (`OpenSprinkler-App/package.json:19`).
- Freeze Cordova on the legacy app during beta, then retire it after iPhone Safari cutover unless Karson explicitly requires App Store delivery. Current native workflows still package legacy `www`, not the Vite app (`OpenSprinkler-App/.github/workflows/app-store-connect.yml:103-126`; `OpenSprinkler-App/.github/workflows/google-play.yml:89-105`).
- Retire the Transifex pipeline with legacy unless a non-English language is explicitly required. Its current extraction/bundle paths are legacy-only, while modern strings are English literals (`OpenSprinkler-App/scripts/localization.mjs`; `OpenSprinkler-App/transifex.yml:1-7`; `OpenSprinkler-App/www/src/api/diagnostics.ts:1-5`).
- Deploy the fork UI on a fork-owned parallel host. Leave shared `ui.opensprinkler.com` untouched; it remains the rollback base.

## 4. First three steps

1. **Make the evidence safe and accurate.** The tracked runbook and fixtures have been sanitized and a tracked-content secret scan now guards them. Rotate the formerly exposed credentials outside this repository, reconcile the drift table above, declare the `2214 + kars85` floor, and record the exact OTF revision to be tested.
2. **Fix and prove the read-only seam.** Preserve the OTC forward prefix, use the existing pre-auth `/jo` probe when firmware globals are absent, make the deployment base and `home.js` path agree, put typecheck/Vitest/Vite build in CI, and prove read-only LAN-injected plus OTC access on iPhone Safari and a desktop browser (`OpenSprinkler-App/www/src/api/client.ts:123-141`; `OpenSprinkler-App/www/src/api/client.ts:175-181`; `OpenSprinkler-App/www/src/seam/device.ts:65-99`).
3. **Make writes loss-resistant before building the schedule UX.** Validate at trust boundaries, send only dirty option keys, fresh-read/compare whole program tuples, confirm risky actions, read back every mutation, and keep unproven controls disabled. Only then implement the schedule flow in `UX-SPEC.md`.

## 5. Phased roadmap

### Phase 0 — Contract and safety baseline

**Goal:** make the documented system match source and create guards that fail before cross-repo drift reaches a device.

**Order:** App evidence/docs → Weather contracts/guard → Firmware contracts → OTF/Firmware revision record. This phase changes no runtime protocol.

**Work:**

- Sanitize the hardware runbook, rotate exposed credentials, and add a CI secret scan over tracked content.
- Correct the documented capability policy, `/cu` cutover path, Weather restriction status, fixed notification behavior, actual fields under `/jc`, active targets, and App↔Weather exceptions—including the false ESP32 support claim and the `/jo` versus `/jc` cached-Weather attribution identified in §2.4.
- Add an Axis-A request-side method-ID check and test the final flat encoding, RainDelay, reserved `scales`, and the combined explanation-pressure case—not only `convertToLegacyFormat`.
- Add an Axis-D contract job that starts the retained firmware DEMO/native surface and runs the App parsers against `/jo`, `/jc`, `/jn`, `/je`, `/jp`, `/js`, `/ja`, mutations, and failed `/jo`/`/ja`. Keep a sanitized live `2214` corpus separate from curated fixtures. `/jn` supplies the special bit; `/je` supplies the type and definition needed for safe type-aware copy (`OpenSprinkler-Firmware/opensprinkler_server.cpp:450-516`).
- Pin the intended OTF fork revision in the plan and verify both ESP8266 and retained DEMO against the same revision before changing dependency files.
- Reproduce the handoff's recorded Vite output in clean CI, record JS plus the 3,319-byte gzipped CSS baseline, and reject an unexplained >10% regression (`OpenSprinkler-App/docs/DESIGN-HANDOFF.md:52-62`).

**Acceptance criteria:**

- [x] No live password, token, or precise private controller inventory remains in the current tracked tree, and the tracked-content secret scan passes. Previously exposed credentials still require external rotation; the browser-visible Maps key must be origin/API-restricted and rotated if it was unrestricted.
- [ ] `fork-versioning.md`, both Weather contract docs, `ecosystem.md`, App `firmware-contract.md`, and the firmware API reference agree with source.
- [ ] `HARDWARE-VERIFICATION.md` captures `jsp` from `/jc`, handles a blank value with the normalized nonblank rollback rule, and no longer promises exact blank restoration; no live flip proceeds before this is reviewed.
- [ ] App `firmware-contract.md` labels cleartext fallback legacy-only and documents the modern preflight + hash-auth + `fwm`/field-presence policy without requiring a `fwv` bump.
- [ ] Weather CI protects request method IDs and final legacy wire encoding, including the 319-byte combined case.
- [ ] App↔Firmware DEMO contract CI covers success and auth-failure shapes.
- [ ] The supported floor and unsupported-controller behavior are documented as `2214 + kars85`.
- [ ] Clean CI reproduces the App/demo builds, modern test run, and records JS plus a 3,319-byte gzipped CSS baseline.

### Phase 1 — Cutover-safe App foundation

**Goal:** produce a read-only/proven-controls beta that can reach the controller correctly and cannot silently damage adjacent state.

**App-only work:**

- Preserve the full device base, including `/forward/v1/<token>/`; use current location only for the injected LAN root.
- Probe unauthenticated `/jo` when injected `ver` is absent. Preflight-reject nonnumeric or below-`221` `fwv` without sending credentials; hash-authenticate numeric `221+`; treat a plausible-floor `fwv`-only shape as auth bootstrap/failure. Only a successful full options response may trigger the storage-epoch/`fwm`/`fwf` support gate.
- Publish stable `<base>/home.js`; for the current Vite layout, beta `jsp` is the site root, not `<site>/js` (`OpenSprinkler-App/app/vite.config.ts:10-17`).
- Poll `/jc` every four seconds while visible, use `/js` for cheap station refresh, and refresh configuration on entry/write or a slower twenty-second cadence. Pause when hidden, back off on failures, and derive Stale from elapsed time since the last success rather than failure count. Repaint only changed regions so polling does not destroy focus; do not add WebSockets.
- Bootstrap and configuration refresh must fetch `/jn` plus `/je`; cache special-station type/definition data and never put `/je` in the four-second runtime poll (`OpenSprinkler-Firmware/docs/docs/2.2.1/221_4_api.md:206-256`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:450-516`).
- Discover the optional companion once at bootstrap or Activity entry, not inside the four-second controller poll; the current refresh path probes `location.origin` on every load (`OpenSprinkler-App/www/src/views/host.ts:84-85`; `OpenSprinkler-App/docs/DESIGN-HANDOFF.md:100-110`).
- Implement the connection and stale-state rules in `UX-SPEC.md` before enabling writes.
- Validate network, dates, times, durations, and rain-delay input; reject rather than coerce.
- For option writes, send only changed keys and read them back. For program writes, re-read `/jp`, compare the source tuple, submit, then verify the new tuple. No optimistic success.
- Keep beta read-only except Stop/cancel and controls separately proven safe on hardware.
- Declare Vite directly in `devDependencies` instead of relying on Vitest's transitive install, then run clean-install typecheck, Vitest, Vite build, and existing legacy checks in CI while legacy remains (`OpenSprinkler-App/package.json:30-34`; `OpenSprinkler-App/package.json:39-74`; `OpenSprinkler-App/docs/DESIGN-HANDOFF.md:64-67`).

**Fallback if OTC or Safari fails:** the device-served HTTP shell loading HTTPS assets remains the LAN path because the firmware root loads `<jsp>/home.js`; keep hosted standalone HTTPS→HTTP LAN access unsupported and keep the legacy UI selected (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1369-1385`; `OpenSprinkler-App/www/src/seam/device.ts:88-99`). Do not route around browser security.

**Acceptance criteria:**

- [ ] Injected LAN and standalone OTC bases resolve without losing path segments; hosted HTTPS→HTTP standalone LAN is explicitly unsupported. An HTTP-origin LAN harness may remain development-only.
- [ ] Standalone OTC preflight rejects string or below-`221` `fwv` as Unsupported without cleartext auth; `{fwv:221}` proceeds to hashed Login/Auth failed, never Unsupported.
- [ ] An authenticated `221/4/kars85.*` response is supported; an authenticated plausible-floor response with an insufficient `fwm`, unapproved storage epoch, or absent/non-`kars85.` identity is Unsupported. The same preflight/auth/post-auth order is pinned for `/ja`.
- [ ] `home.js` is reachable at the exact stored base on the parallel host.
- [ ] iPhone Safari and desktop pass read-only LAN-injected and OTC smoke tests with no mixed-content or CORS errors.
- [ ] Twelve seconds since the last successful controller response produces a visible stale state despite backoff; mutations disable until a successful refresh.
- [ ] Invalid network/schedule/rain-delay input produces field errors and sends no request.
- [ ] Every enabled mutation has confirmation where required, a fresh-read guard, and post-write verification.
- [ ] Poll refresh preserves the focused control and an in-progress local draft when data is unchanged.
- [ ] A `/jn` special bit is joined with its `/je.st` type before type-aware labels or confirmations render; raw `/je.sd` never appears in homeowner copy.
- [ ] Modern typecheck, tests, and production build run in CI.
- [ ] A clean install resolves a directly declared Vite version and reproduces the recorded production CSS baseline.

### Phase 2 — App-first schedule and weather UX

**Goal:** deliver the user-visible experience in [`UX-SPEC.md`](UX-SPEC.md) entirely on existing APIs.

**App-only work:**

- Implement the target IA, screen flows, responsive behavior, state presentation, content, and accessibility in `UX-SPEC.md` §§4–15. That specification is the sole owner of those details; keep the existing framework-free render/host architecture and shipped visual tokens (`OpenSprinkler-App/www/src/views/host.ts:63-120`; `OpenSprinkler-App/www/src/ui/tokens.css:1-54`; `OpenSprinkler-App/www/src/ui/system.css:1-23`).
- Add schedule orchestration over the existing `/jp` and mutation endpoints with fresh-source conflict checks and bit-for-bit preservation of untouched raw duration words. Keep this as an App data-integrity layer, not a new firmware schema (`OpenSprinkler-Firmware/opensprinkler_server.cpp:663-1041`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1153-1204`).
- Join `/jn`'s special bit to `/je.st` before rendering or confirming special-output actions; never expose raw `/je.sd` in homeowner copy (`OpenSprinkler-Firmware/opensprinkler_server.cpp:450-516`).
- Map Weather as independent mode, effective controller action, and service health values according to `UX-SPEC.md` §8; keep latched `wtdata` out of the current-reason slot after failure (`OpenSprinkler-Firmware/weather.cpp:65-149`; `OpenSprinkler-Firmware/main.cpp:905-920`; `OpenSprinkler-Firmware/main.cpp:1243-1255`).
- Add a read-only, schema-versioned configuration Export assembled from allowlisted authenticated snapshots; omit password hashes, OTC tokens, API/provider keys, full request URLs, and other secret-bearing fields. Support browser download on desktop and share/save on iPhone. Do not port Import. The legacy exporter serializes the entire session controller object, so its output is not a safe modern schema by default (`OpenSprinkler-App/www/js/modules/import-export.js:20-57`; `OpenSprinkler-App/www/js/modules/import-export.js:59-180`).

**Fallback if no Weather change ever lands:** generic but accurate explanations remain available from existing flags, scale, source, and timestamps (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1351`; `OpenSprinkler-Weather/routes/weather.ts:168-235`). Scheduling remains fully functional because it uses existing `/jp` and `/cp` (`OpenSprinkler-Firmware/opensprinkler_server.cpp:905-1041`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1153-1204`).

**Acceptance criteria:**

- [ ] Every applicable task, safety/accessibility, and responsive/performance check in `UX-SPEC.md` §17 passes on iPhone Safari and desktop; failed checks block cutover.
- [ ] Existing-program saves detect stale tuples rather than overwrite them.
- [ ] Editing only a program name round-trips raw durations `1`, `59`, `60`, `61`, `90`, `65533`, `65534`, and `65535` unchanged; solar durations remain explicit.
- [ ] Special-output fixtures prove `/jn`+`/je` type joining and that raw definitions never reach homeowner copy.
- [ ] A schema-versioned Export succeeds on desktop and iPhone, includes the schedule/station/controller data named in its schema, and passes fixture checks proving hashes, tokens, provider/API keys, and request URLs are absent; no Import control appears.
- [ ] Weather fixtures independently cover mode, controller effect, service health, and latched-detail suppression.
- [ ] No new runtime UI dependency, font, image request, or firmware field is introduced.

### Phase 3 — Weather robustness and explainability

**Goal:** improve automatic behavior after the App already has a safe fallback, without changing the firmware parser.

**Order:** App generic explanation is already shipped → Weather producer change and CI → App progressive enhancement. Firmware runtime remains unchanged.

**Weather work:**

- Fix the built image so required baseline data and the documented dashboard asset are either included or explicitly removed from the product contract; add a built-image smoke test.
- For ETo method `3`, derive a missing baseline from the existing location dataset, preserve explicit overrides, and fail clearly if the dataset/location is unavailable (`OpenSprinkler-Weather/routes/baselineETo.ts:5-96`).
- Add an explicit, opt-in cloud-provider fallback for local/Ecowitt mode. Keep local-only behavior the default and expose when fallback served the decision; the current local branch returns before fallback (`OpenSprinkler-Weather/routes/weather.ts:75-96`).
- Add compact stable `reasonCode`/`skipCode` values inside `rawData`; preserve existing human strings for other consumers. The App localizes codes and falls back to flags/generic copy (`OpenSprinkler-Weather/routes/weather.ts:168-235`).
- Extend the combined 319-byte guard so flags and machine codes survive even when human strings are removed.
- Keep `/v1` out of the App and firmware path.

**Axis-A contract step:** land Weather first; in the same change update `OpenSprinkler-Weather/docs/firmware-integration-requirements.md`, `OpenSprinkler-Firmware/docs/weather-contract.md`, the Weather CI guard, and the hub map. Update App `firmware-contract.md` plus its fixtures when it begins consuming reason codes.

**Fallback:** if automatic baseline or provider fallback proves unreliable, retain explicit ETo baseline input and local-only behavior. The App continues to explain scale/error/freshness with existing `/jc` and `/jo` fields (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1044-1150`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1351`).

**Acceptance criteria:**

- [ ] The published Weather image contains every runtime asset its routes require and passes a container smoke test.
- [ ] Missing ETo baseline resolves from location or fails without changing the last known device configuration.
- [ ] Local-provider fallback is opt-in, reports the serving provider, and can be disabled without restart-state corruption.
- [ ] Combined skip + provider fallback + method detail stays within the firmware limit while preserving flags/codes.
- [ ] Nonzero `wterr` never presents a latched `wtdata` reason as current.
- [ ] Both Axis-A docs, the App consumer doc, hub map, and CI guards land with the behavior.

### Phase 4 — Firmware and OTF last

**Goal:** make only measured, additive platform changes after App and Weather fallbacks have proven their value.

**Required platform work:**

- Replace split/mutable OTF consumption with one reviewed exact kars85 revision for PlatformIO and retained DEMO/native builds.
- Add OTF tests before any handler, buffer, or WSS change; compile ESP8266 and DEMO against the exact same revision.
- Add a compile-time route key-byte/handler-count assertion and a black-box route test when the table is next touched.
- Stop OSPi CI publishing/support while retaining native DEMO infrastructure and initially leaving dormant conditional source.
- In the same change as an OTF pin, handler, or WSS decision, update OTF `ARCHITECTURE.md`, Firmware `docs/otf-integration.md` and `docs/external-contracts.md`, the ecosystem hub, and App `docs/firmware-contract.md` wherever Axis F behavior is affected.

**Conditional runtime work:**

- No new field/endpoint is planned. A measured gap must document why the existing documented API—especially `/jp`, `/jc`, `/jo`, `/jn`, `/je`, and `/js`—is insufficient (`OpenSprinkler-Firmware/docs/docs/2.2.1/221_4_api.md:206-256`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1044-1351`).
- The first approved App-visible runtime addition uses `fwm=5`, the three-part capability rule, additive shapes, absence fallback, and 2 KB/local/OTC maximum-payload tests.
- WSS is a separate security decision: confirm cloud support and trust/certificate strategy first. If supported, implement/test it in OTF before moving the Firmware pin. If not supported, either keep OTC explicitly risk-accepted or make the fork LAN-only; do not imply browser HTTPS secures the device-cloud token leg.

**Acceptance criteria:**

- [ ] PlatformIO and DEMO/native use one exact reviewed OTF fork revision.
- [ ] ESP8266 and DEMO builds pass against that revision; OSPi publish jobs are retired without deleting DEMO coverage.
- [ ] Route alignment is mechanically guarded.
- [ ] No `fwv` bump occurs for fork capability.
- [ ] Any new App-visible field/endpoint is additive, gated at `2215`, presence-checked, buffer-stressed, and documented on both sides of Axis D.
- [ ] OTC security posture is an explicit decision, not an inherited assumption.

### Phase 5 — Per-device cutover and legacy retirement

**Goal:** move only Karson's devices to the fork host with a rehearsed per-device `SOPT_JAVASCRIPTURL` (`jsp`) flip/rollback, then remove legacy maintenance from the fork.

**Cutover procedure:**

1. Deploy an immutable modern release to a fork-owned parallel base where `<base>/home.js` is stable.
2. On the device, capture authenticated `/jc.jsp` and verify direct `/su` recovery access before changing anything (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1207-1231`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1281-1284`).
3. If captured `jsp` is blank, do **not** rely on `/cu?jsp=`: the parser returns zero length and the handler ignores it. Normalize to the explicit compiled default `https://ui.opensprinkler.com/js`, verify the legacy shell, and record that effective rollback value before proceeding. If exact blank preservation is required, stop until a hardware-proven method exists (`OpenSprinkler-Firmware/opensprinkler_server.cpp:131-145`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:148-205`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1505-1512`; `OpenSprinkler-Firmware/defines.h:170-174`).
4. Write the parallel site root with authenticated `/cu?jsp=<base>`; do not append `/js` unless the artifact is deliberately emitted there (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1488-1529`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1369-1385`).
5. Re-read `/jc.jsp`, load via LAN and OTC, verify polling/auth/unsupported-floor behavior, and perform only the approved smoke tests.
6. Roll back by writing the recorded nonblank effective rollback base through `/cu`, then verify `/jc.jsp` and the legacy shell. No firmware flash.
7. Run one device for at least fourteen days and two real scheduled cycles without rollback; then move remaining fork devices individually.

**What “done” means:**

- The UX-spec task tests pass on iPhone Safari and desktop.
- All mutation safety, contract, Weather, and platform phase gates are green.
- Every target device has a recorded nonblank effective rollback `jsp`, successful rollback drill, and fourteen-day/two-cycle observation.
- A versioned legacy deployment remains available as rollback, but the fork no longer builds or edits legacy.
- Delete `www/js/modules/`, the legacy browser/build paths, OSPi App branches, frozen Cordova workflows/dependencies, and Transifex/locales in one retirement change after the observation window.
- Leave shared `ui.opensprinkler.com` and its official compatibility surface untouched.

**Acceptance criteria:**

- [ ] Parallel host is fork-owned and immutable releases retain `home.js`.
- [ ] Each target device has a nonblank verified effective rollback base and passes flip, readback, LAN/OTC smoke, and rollback; a blank prior value is normalized before the flip.
- [ ] No device requires factory reset or firmware flash for UI rollback.
- [ ] Fourteen-day/two-cycle observation completes without a rollback-triggering defect.
- [ ] Legacy source/build/native/i18n paths are retired from the fork only after the frozen rollback release exists.

## 6. Per-axis interoperability impact

| Axis | Planned impact | Both contract anchors | Same-phase coordination/guard |
|---|---|---|---|
| **A — Weather ↔ Firmware** | Keep the flat wire; add compact nested reason codes and optional local fallback semantics. No firmware parser change. | Weather `docs/firmware-integration-requirements.md`; Firmware `docs/weather-contract.md`. | Weather lands first; update both docs, `ecosystem.md`, final-wire/method-ID/size CI together. |
| **B — Firmware ↔ OTF** | Pin one exact fork revision; WSS only if explicitly selected. | OTF `ARCHITECTURE.md`; Firmware `docs/otf-integration.md`. | OTF tests/change first, then update both contract docs plus `ecosystem.md`, move the Firmware pin, and build ESP8266 and DEMO at that revision in the same phase. |
| **C — Weather ↔ OTF** | No change; preserve intentional separation. | Firmware `docs/ecosystem.md` records both sides as uncoupled. | No new CI or coordination work; review dependency manifests only if either side proposes a direct dependency. |
| **D — App ↔ Firmware** | New App behavior over existing endpoints; optional future additions use `fwm=5`. | Firmware `docs/docs/2.2.1/221_4_api.md`; App `docs/firmware-contract.md`. | Firmware remains canonical; update both docs and DEMO/App contract CI in the same phase. Preserve `/jo`/`/ja` failure shape. |
| **E — App ↔ Weather** | Do not add a modern direct call. Remove legacy `/baselineETo` and WU validation when legacy retires; consume Weather explanation only through `/jc.wtdata`. | App consumer behavior in `docs/firmware-contract.md`; Weather nested-data behavior in `docs/firmware-integration-requirements.md`, with the hub rule in Firmware `docs/ecosystem.md`. | In the behavior/removal phase, update both contract docs plus `ecosystem.md`; land the Weather encoding guard and App `/jc` fixture with those docs. |
| **F — App ↔ OTC/OTF cloud** | Preserve `/forward/v1/<token>/` path and test every App contract through OTC; possible WSS hardening. | Firmware `docs/external-contracts.md`; OTF `ARCHITECTURE.md`, with App constraints in `docs/firmware-contract.md`. | Coordinate with the cloud service; update all three contract docs plus `ecosystem.md` in the same phase, then order implementation OTF → Firmware pin → App OTC smoke. |

## 7. Honest cost and deliberate cuts

| Ask | Expensive path | Chosen cheaper path | Reopen when |
|---|---|---|---|
| Modern UI | Add Svelte/Preact and rewrite working TS again. | Keep framework-free TS and repair the seam/safety layer. | The current render model measurably blocks a required interaction. |
| Easy scheduling | Add a friendly firmware schema or next-run endpoint. | Translate existing `/jp`/`/cp` in the App; mark projections Estimated. | Authoritative future-run accuracy is explicitly required. |
| Weather explanation | Parse/promote reasons into new firmware fields. | Use existing `/jc` fields; add compact Weather `rawData` codes. | Buffer-safe existing data cannot answer a validated user question. |
| Automatic weather | Adopt `/v1` or WaterBudget now. | Keep ETo method `3`, auto-derive baseline, hide advanced tuning. | Method-ID, stale policy, packaging, and a real consumer justify the cost. |
| Old compatibility | Delete scattered gates one by one. | Enforce a `2214 + kars85` floor, freeze legacy, then delete it wholesale. | Never; whole-tree retirement is the payoff. |
| Native apps | Port modern output into Cordova/Capacitor. | Use iPhone Safari and desktop; freeze then retire Cordova. | App Store delivery or a native-only capability is required. |
| Localization | Port Transifex before a language is requested. | English-only fork UI; retire legacy pipeline. | Karson names a required second language. |
| Companion/history | Expand the optional server. | Keep controller-direct UI and feature-detect existing companion. | Persistent analytics becomes a stated product goal. |
| Configuration import | Port a whole-device mutation before its schema and rollback are safe. | Ship read-only export; keep import on the frozen legacy UI. | Preview, secret policy, version conversion, and a hardware restore drill exist. |

## 8. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Bundled settings/program writes overwrite unrelated live state. | **Critical** | Dirty-key writes, fresh-read program compare, validation, confirmation, post-write readback; keep unproven controls disabled. |
| Accidental `fwv` bump factory-resets device configuration. | **Critical** | Treat `fwv` as storage epoch; review guard; use `fwm` only for approved capability. |
| Live credentials/controller details remain in tracked docs. | **Critical** | Sanitize and rotate in the first step; add secret scanning. |
| OTC path/auth/bootstrap defect prevents login or sends requests to the wrong URL. | **High** | Pre-auth probe, prefix-preserving base, integration tests, read-only device proof before writes. |
| HTTPS app cannot reach HTTP LAN device. | **High** | Prove device-injected HTTP shell and OTC paths on Safari/desktop; never bypass browser policy; retain legacy. |
| Blank prior `jsp` cannot be restored with `/cu?jsp=`. | **High** | Normalize to and verify the explicit compiled default before cutover; record a nonblank effective rollback base. |
| Stale `wtdata` is presented as the latest weather decision or an error hides the controller's still-effective scale. | **High** | Separate mode/effect/health; use `wl`/`wls` for effect and `wterr`/`lswc` for health; label last-successful detail. |
| Program edits round seconds or destroy solar-duration sentinels. | **High** | Preserve untouched raw duration words; test second precision and `65534`/`65535` on unrelated edits. |
| Positional route drift or auth-failure drift silently breaks App clients. | **High** | Compile-time route assertion plus black-box Axis-D contract CI, including failed `/jo`/`/ja`. |
| New response data exceeds 2 KB-class serialization/streaming assumptions. | **High** | No new runtime fields by default; maximum-payload ESP8266/local/OTC tests for any exception. |
| OTF mutable/split revisions produce different firmware by build path. | **High** | One exact fork revision for PlatformIO and DEMO; compile both in CI. |
| OTC device-cloud token leg remains plaintext. | **High** | Explicit WSS/LAN-only/risk-accept decision; do not equate browser HTTPS with end-to-end security. |
| Weather local mode lacks fallback or silently uses absent Docker assets. | **Medium** | Built-image smoke, location-baseline test, explicit opt-in fallback with visible provider. |
| Cordova/Transifex retirement removes an unstated requirement. | **Medium** | Freeze through beta; resolve language/App Store questions before Phase 5 deletion. |
| Client next-run estimate differs from firmware scheduling edge cases. | **Medium** | Label Estimated, summarize encoded rules, test known cases, do not use it as a safety interlock. |

## 9. Open questions / decisions needed from Karson

1. Is iPhone Safari + desktop definitively sufficient, allowing Cordova/App Store delivery to retire after cutover?
2. Is English-only acceptable for the personal fork, allowing Transifex/locales to retire with legacy?
3. Must remote OTC access remain enabled? If yes, is the cloud service under your control and able to support WSS, or are you explicitly accepting the plaintext device-cloud leg?
4. Should local/Ecowitt weather remain strictly local, or may the service use an explicit cloud-provider fallback when local data fails?
5. Can every target device be upgraded to the `2214 + kars85` floor before its `/cu` flip?
6. Which physically disconnected zone, if any, is approved for the final actuation smoke test? Without one, control parity remains verified by non-actuating tests only.
7. What fork-owned production hostname and deployment credentials should replace the unverified draft `opensprinkler-nextui` target?
8. Is an authoritative firmware-calculated next-run time required, or is a clearly labeled client estimate sufficient?
9. Do you want WaterBudget funded as a later `method=5`/`fwm=5` project, or should ETo remain the only simple automatic method?

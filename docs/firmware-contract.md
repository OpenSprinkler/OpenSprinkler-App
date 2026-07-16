# Firmware Contract

App repo role: **CONSUMER**
Firmware repo role: **PRODUCER**

This document is the app-side counterpart to the firmware-owned API reference in `OpenSprinkler-Firmware/docs/docs/2.2.1/221_4_api.md`. The endpoint set and JSON field names are canonical there — the `_url_keys[]` / `urls[]` tables in `opensprinkler_server.cpp:2209-2266` are the source of truth. This document records the consumer constraints the producer must preserve for existing app builds, and the app-side assumptions that break if the producer changes them.

This axis is **axis D** in `OpenSprinkler-Firmware/docs/ecosystem.md`.

> **Note the inverted direction versus the weather axis.** On Weather↔Firmware the *producer* (weather) is canonical and the firmware adapts. Here the *producer* (firmware) is canonical and the app adapts. The app carries the compatibility burden: it is expected to run against every firmware from 1.8.3 to current.

## Scope

The app is not a general client of a versioned API. It reads firmware JSON responses by direct key access and gates ~100 UI features on the firmware version integer. There is **no CI guard on this axis** (unlike Weather↔Firmware's `test/firmware-contract.spec.ts`) and no negotiated capability handshake — `fwv` *is* the handshake.

Deployment makes both directions live simultaneously: the app is served to controllers by pointing the firmware's Javascript URL at `https://ui.opensprinkler.com/js` via `/su` (`README.md:59-68`, firmware ≥2.0.3). A published app update reaches old controllers with no firmware flash, and old app builds keep hitting new controllers. **Neither side may assume the other was updated.**

## Hard Constraints On The Producer

1. **`_url_keys[]` and `urls[]` are positional and must stay index-aligned.**
   The firmware dispatches by finding the 2-char key's index in `_url_keys[]` (`opensprinkler_server.cpp:2209-2236`) and calling `urls[i]` (`:2239-2266`). There is no compile-time link between the tables. Inserting or removing an entry in one without the other silently shifts every handler after that point — the app receives a well-formed 200 response from the *wrong* handler.

2. **`/jo` and `/ja` must keep emitting `fwv` when the password check fails.**
   `opensprinkler_server.cpp:2449-2455` special-cases these two endpoints: on `check_password()==false` the firmware returns **HTTP 200** with `{"fwv":<n>}` (`iopt_json_names+0` is `fwv`, `OpenSprinkler.cpp:118-119`) instead of an auth error. This is not an information leak to be cleaned up — it is the app's **auth bootstrap**, and removing it breaks adding any site. See "Auth bootstrap" below for the exact dependency.
   `/su` bypasses password checks entirely (`:2445-2448`); that is what makes UI injection work.

3. **`fwv` must be bumped for any new field or behavior the app is expected to use.**
   The app has no other way to detect a capability. Shipping a field without a version bump leaves it permanently invisible to the app's gating path. See "Version gating" below.

4. **`fwv` and `fwm` must remain integers with the documented arithmetic.**
   The app computes 4-digit checks as `fwv * 10 + fwm` (`www/js/modules/firmware.js:164-170`) and formats display as `(fwv/100>>0) + "." + ((fwv/10>>0)%10) + "." + (fwv%10)` (`firmware.js:261`). Both are iopts in `/jo` (`OpenSprinkler.cpp:118` for `fwv`, `:159` for `fwm`). A string `fwv` is interpreted as OSPi (see below), not as a version.

5. **Fork builds must not repurpose `fwv`/`fwm` for fork identity.**
   The kars85 fork emits its build tag as the separate read-only `fwf` string in `/jo` (`opensprinkler_server.cpp:1122-1125`, `defines.h:47-50`); the app renders it as a display-only suffix and never gates on it (`firmware.js:272-277`). `fwv`/`fwm` continue to track upstream exactly. Any fork that bumps `fwv` to mark itself will mis-trigger every gate below.

## Version Gating

`OSApp.Firmware.checkOSVersion( n )` (`www/js/modules/firmware.js:158-182`) is the single detection primitive. Behavior worth knowing:

- **Empty controller object returns `false`** (`firmware.js:159-161`) — gates fail closed before the first `/jo` lands.
- **3-digit checks compare `fwv` alone; 4-digit checks (`>= 1000`) fold in the minor version** as `fwv * 10 + fwm`, returning `false` if `fwm` is `NaN` (`firmware.js:164-170`). So `checkOSVersion( 2214 )` means firmware 2.2.1(4) — current `defines.h` is `OS_FW_VERSION 221` / `OS_FW_MINOR 4`.
- **OSPi always returns `false`** (`firmware.js:172-173`). `isOSPi()` triggers on a *string* `fwv` matching `/ospi/i` (`firmware.js:184-193`). Consequence: **every numeric gate is off for OSPi**, so OSPi feature support is expressed by data-presence checks instead (see below).
- Comparison is digit-array based, not numeric (`versionCompare`, `firmware.js:195+`).

Live gate tiers, for reference when deciding whether a change needs a bump:

| Gate | Guards (examples) |
|---|---|
| 206 | log viewing (`ui-dom.js:300`) |
| 208 | string options / location (`options.js:286`, `import-export.js:204`) |
| 210 | program data format `pd` bitfield, NTP/DHCP options, log deletion (`programs.js:1838`, `options.js:907-913`, `logs.js:612`) |
| 211 | flow logging, import format boundary (`logs.js:545`, `import-export.js:214`) |
| 213 | **md5 password hashing** (`network.js:796`), sunrise/sunset programs (`programs.js:2354`) |
| 214 | `ip4` change detect, station attributes, option ranges (`network.js:318`, `stations.js:322`, `options.js:1567`) |
| 215 | `wto` weather options, `bst` (`import-export.js:221`, `options.js:854`) |
| 216 | firmware update capability, `/ja` all-in-one fetch (`firmware.js:353`, `sites.js:1027`) |
| 217 | HTTP station type, `ifkey`, program sensor type 240 (`dashboard.js:474-478`, `options.js:43`, `import-export.js:226`) |
| 219 | soil sensor, weather API key verification, extra log metrics (`options.js:41`, `supported.js:84`, `logs.js:605`) |
| 2162 | Zimmerman baseline ETo (`weather.js:81`) |
| 2191 | `dname`, `mqtt`, `email`, `otc` config import (`import-export.js:231-245`) |
| 2199 | interval-day minimum of 1 (`programs.js:2591`) |
| 220 | date-range programs, latch on/off, sequential retirement, ±600 option ranges (`supported.js:57-76`, `options.js:891-899`, `options.js:1525`) |
| 2211 | pause change, single-run/monthly, repeated runonce, `runorder` (`supported.js:80-94`, `programs.js:664`) |
| 2213 | weather restrictions, `imin`/`imax` (`supported.js:99`, `options.js:875-883`) |
| 2214 | queue order, `tpdv`, weather option (`programs.js:2832`, `options.js:863`, `weather.js:707`) |
| 221 | large `sopt` support (`options.js:1748`) |
| 300 | **`POST` for change commands — no such firmware exists; see below** |

### The dormant POST path

`OSApp.Firmware.sendToOS` selects `POST` over `GET` for change commands only when `checkOSVersion( 300 )` (`firmware.js:53-58`) — i.e. firmware 3.0.0. **No such firmware exists**, so every change command ships as a `GET` with the password in the query string today. The comment there says "requires firmware 2.1.8 or newer," which the `300` gate contradicts. Treat this as reserved, not live: **if firmware ever reaches 3.0.0, this path silently activates** and `POST` bodies must be accepted for `cv|cs|cr|cp|uwa|dp|co|cl|cu|up|cm`. Do not reach 3.0.0 without checking this line.

### Capability detection that does not use `fwv`

`www/js/modules/supported.js` is the app's preferred detection layer and is the pattern to extend. It splits into two kinds:

- **Data-presence checks** — work on OSPi, where numeric gates are dead: `master` (`mas`/`mas2` iopts), `ignoreRain` / `ignoreSensor` / `actRelay` / `disabled` / `special` (typed keys under `controller.stations`), `pausing` (`settings.pq !== undefined`), `groups` (option count `>= 4`).
- **Version-backed checks** — `dateRange` (220), `changePause` (2211), `verifyWeatherAPIKey` (219 + `uwt` + `wto`), `restrictions` (2213 + `wto`).

**Prefer adding a data-presence check here** over a bare `fwv` gate in a UI module: it survives OSPi and does not need a version bump to work.

## Auth Bootstrap

The add-site probe is where the app and firmware negotiate password format, and it is subtle enough to state exactly (`www/js/modules/sites.js:814-815`, `:671-696`).

The probe **always** sends `/jo?pw=md5(<password>)` — the app does not yet know the firmware version, so it cannot know whether to hash. Two outcomes:

| Firmware | What happens | App reads | Result |
|---|---|---|---|
| `fwv >= 213` (expects md5) | Hash matches, `/jo` returns the full option set | `data.fwv >= 213` **and** `data.wl` is a number | stores **md5(pw)** (`sites.js:692-696`) |
| `fwv < 213` (expects cleartext) | Hash is the *wrong* password → the `:2449-2455` escape hatch returns **HTTP 200** `{"fwv":N}` | `data.fwv` present, **`data.wl` undefined** | stores **cleartext pw** |

So `wl` (water level, an iopt in `/jo` — `OpenSprinkler.cpp:142`) doubles as the **auth-success sentinel**: its presence means the full option set came back, which means the md5 was accepted. The `fwv < 213` branch depends on the failure response being a *success-shaped* 200 that carries `fwv` and omits everything else.

**Consequences for the producer:**
- Returning `401`/`403` instead of the 200+`fwv` shape on `/jo` auth failure breaks add-site for all pre-2.1.3 firmware.
- Adding `wl` to the auth-failure response breaks the cleartext branch (the app would store md5 for a controller expecting cleartext).
- Removing `wl` from a successful `/jo` breaks the md5 branch the same way, in reverse.

Firmware 1.8.3 is detected out-of-band by response shape — `data.match( /var (en|sd)\s*=/ )` or `fwv === 203` (`sites.js:675-677`) — and gets a `cache: true` workaround for a timestamp bug in its GET handling (`firmware.js:82-88`).

Beyond the probe, every request injects the password by string replacement on `pw=` (`firmware.js:44`), and optional HTTP Basic auth is layered on top for reverse-proxied controllers (`firmware.js:70-78`, `sites.js:823-835`).

## Response Contract

`sendToOS` normalizes replies (`firmware.js:90-130`) and couples to the `result` code numbering:

| `result` | App behavior |
|---|---|
| `1` | success, data returned |
| `2` | rejected as **HTTP 401** internally to prevent retry; shows "Check device password and try again." on change commands |
| `32` | rejected as **HTTP 404** |
| `48` | "The selected station is already running or is scheduled to run." |

Responses are parsed as JSON with a string fallback (`firmware.js:93-100`), and a missing/non-numeric `result` is passed through untouched — that path exists for OSPi and pre-2.1.0 firmware.

## Endpoints Consumed

Read endpoints (JSON field names are part of the contract — the app reads keys directly):

| Endpoint | Purpose | App call site |
|---|---|---|
| `/jo` | options (carries `fwv`, `fwm`, `wl`, `hwv`, `wsp`, `fwf`) | `sites.js:1169`, `stations.js:206` |
| `/jc` | controller status (`wtdata`, `wterr`, `wtrestr`, `otc`/`otcs`) | `sites.js:1243`, `network.js:845` |
| `/js` | station status | `sites.js:1194` |
| `/jn` | stations | `sites.js:1126` |
| `/jp` | programs | `sites.js:1093` |
| `/ja` | all-in-one (gated 216) | `sites.js:1028` |
| `/je` | special stations | `sites.js:1347` |
| `/jl` | logs | `logs.js:546-555` |
| `/su` | script URL view (**no auth**) | firmware-served UI injection |

Change endpoints (`cv|cs|cr|cp|uwa|dp|co|cl|cu|up|cm` are the set `sendToOS` routes to the "change" AJAX queue and error-reports on — `firmware.js:52`):

`/cv` values · `/co` options · `/cs` stations · `/cm` manual · `/cp` program · `/dp` delete program · `/up` move program up · `/cr` run-once · `/mp` manual program · `/dl` delete log · `/sp` set password · `/cu` change script URL · `/pq` pause queue

Sensor endpoints (`/se`, `/sl`, `/sh`, `/sf`, `/sa`, `/sc`, `/sb`, `/sn`, `/so`) are called from `www/js/modules/analog.js`.

## What The App Does Not Couple To

- **The weather service.** The app never contacts `OpenSprinkler-Weather`. It reads the firmware's weather *settings* (`wsp`, `wto`) and *cached results* (`wtdata`, `wterr`, `wtrestr`) from `/jo` and `/jc`; the firmware alone fetches from `wsp`. **One exception:** `www/js/modules/weather.js:477` hardcodes `https://api.weather.com/v2/pws/` to validate WeatherUnderground PWS keys client-side — a real, direct third-party dependency.
- **The OTF library.** The app compiles nothing from `OpenThings-Framework-Firmware-Library`. It couples to the same **OpenThings Cloud service**, routing through `https://cloud.openthings.io/forward/v1/<token>` in place of the controller IP (`firmware.js:56`, `sites.js:396`), with tokens matching `^OT[a-fA-F0-9]{30}$` (`dashboard.js:169`). Every endpoint above works through that prefix unchanged, which is why the URL shape is a contract in its own right (`OpenSprinkler-Firmware/docs/external-contracts.md`).

## Maintenance Contract

**The firmware is canonical on this axis.** Before changing anything above:

1. **Never renumber or reorder `_url_keys[]`.** Endpoint keys and JSON field names are append-only in practice — old app builds and old controllers coexist in the field in both directions.
2. **Bump `fwv` (or `fwm`) when adding app-visible behavior**, and add the gate on the app side in `www/js/modules/supported.js` — preferring a data-presence check over a version check where the shape allows it, so OSPi is covered.
3. **Before removing or renaming a field or endpoint, grep the app's call sites.** There is no CI guard to catch it; the failure mode is a silent `undefined` in a UI module, not a test failure.
4. **Treat `/jo`+`/ja` fwv-on-auth-failure and `/su`-without-auth as load-bearing**, not as security defects to be tidied.
5. Update this doc and the firmware-side API reference together, and keep `OpenSprinkler-Firmware/docs/ecosystem.md` axis D in sync.

---
*Consumer-side counterpart to `OpenSprinkler-Firmware/docs/docs/2.2.1/221_4_api.md`. Hub map: `OpenSprinkler-Firmware/docs/ecosystem.md` (axis D). See also `external-contracts.md` for the OTC URL shapes this app shares with the firmware.*

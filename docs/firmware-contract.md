# Firmware Contract

App repo role: **CONSUMER**
Firmware repo role: **PRODUCER**

This document is the app-side counterpart to the firmware-owned API reference in `OpenSprinkler-Firmware/docs/docs/2.2.1/221_4_api.md`. The endpoint set and JSON field names are canonical there — the `_url_keys[]` / `urls[]` tables in `opensprinkler_server.cpp:2209-2266` are the source of truth. This document records the consumer constraints the producer must preserve for existing app builds, and the app-side assumptions that break if the producer changes them.

This axis is **axis D** in `OpenSprinkler-Firmware/docs/ecosystem.md`.

> **Note the inverted direction versus the weather axis.** On Weather↔Firmware the *producer* (weather) is canonical and the firmware adapts. Here the *producer* (firmware) is canonical and the app adapts. The frozen legacy app carries compatibility back to 1.8.3; the modern fork dashboard deliberately supports only authenticated `2214 + kars85` builds.

## Scope

The legacy app is not a general client of a versioned API. It reads firmware JSON responses by direct key access and gates ~100 UI features on the firmware version integer. The modern dashboard instead validates each response at its typed boundary and applies a fork support policy using `fwv`, `fwm`, `fwf`, and field presence. App CI guards the curated response contracts; the retained Firmware DEMO/native black-box guard remains a cross-repository rollout gate.

Deployment makes both directions live simultaneously: the persistent JavaScript base is changed with authenticated `/cu?jsp=...`; `/su` is the legacy unauthenticated firmware-served view, not the cutover mutation. A published app update reaches old controllers with no firmware flash, and old app builds keep hitting new controllers. **Neither side may assume the other was updated.**

## Hard Constraints On The Producer

1. **`_url_keys[]` and `urls[]` are positional and must stay index-aligned.**
   The firmware dispatches by finding the 2-char key's index in `_url_keys[]` (`opensprinkler_server.cpp:2209-2236`) and calling `urls[i]` (`:2239-2266`). There is no compile-time link between the tables. Inserting or removing an entry in one without the other silently shifts every handler after that point — the app receives a well-formed 200 response from the *wrong* handler.

2. **Authentication failures must never resemble full `/jo` or `/ja` success responses.**
   Some firmware returns **HTTP 200** with only `{"fwv":<n>}` on password failure. The app tolerates that legacy shape but does not use it to authorize a cleartext retry; full-options validation still fails because required fields such as `wl` are absent. A conventional `401`/`403` failure is also safe. `/su` bypasses password checks for the separate firmware-served UI injection flow.

3. **Do not bump `fwv` merely to identify this fork or expose an additive fork capability.**
   `fwv` participates in the persisted-settings compatibility boundary. The modern client can gate additive behavior with the upstream-compatible `fwm`, the `kars85.*` `fwf` identity, and validated field presence. A genuinely new shared protocol revision still needs an agreed version/capability gate on both sides; it must not be smuggled in as fork branding.

4. **`fwv` and `fwm` must remain integers with the documented arithmetic.**
   The app computes 4-digit checks as `fwv * 10 + fwm` (`www/js/modules/firmware.js:164-170`) and formats display as `(fwv/100>>0) + "." + ((fwv/10>>0)%10) + "." + (fwv%10)` (`firmware.js:261`). Both are iopts in `/jo` (`OpenSprinkler.cpp:118` for `fwv`, `:159` for `fwm`). A string `fwv` is interpreted as OSPi (see below), not as a version.

5. **Fork builds must not repurpose `fwv`/`fwm` for fork identity.**
   The kars85 fork emits its build tag as the separate read-only `fwf` string in `/jo` (`opensprinkler_server.cpp:1122-1125`, `defines.h:47-50`). The legacy app renders it as a display-only suffix (`firmware.js:272-277`); the modern dashboard requires the `kars85.` prefix as part of its post-auth support decision. `fwv`/`fwm` continue to track upstream exactly. Any fork that bumps `fwv` to mark itself can reset persisted settings and mis-trigger legacy gates.

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
| 300 | **Reserved `POST` transport for change commands; see below** |

### The dormant POST path

`OSApp.Firmware.sendToOS` selects `POST` over `GET` for classified change commands only when `checkOSVersion( 300 )` — i.e. firmware 3.0.0. Treat this as a reserved protocol boundary: when a numeric firmware reaches 3.0.0, it must accept form-encoded `POST` bodies for every endpoint in the classifier, including sensor mutations. Older numeric firmware and OSPi continue to use `GET`.

### Modern fork dashboard support floor

The modern browser flow is intentionally narrower than the legacy table above:

1. Probe unauthenticated `/jo` when firmware globals are unavailable. A string, non-integer, or
   numeric value below `221` is **Unsupported** and receives no credential.
2. For numeric `221+`, authenticate with the MD5 password representation. A version-only
   `{"fwv":221}` response is an auth bootstrap/failure shape, never authorization for cleartext.
3. Only a full authenticated response is evaluated for support. It must report `fwv === 221`,
   `fwm >= 4`, `fwf` beginning with `kars85.`, and every field required by the typed parser.
4. Apply the same preflight → hash-auth → post-auth order to `/ja`; its version-only failure shape
   does not bypass the full-response checks.

This policy declares the tested floor without changing `fwv`. Future additive fork behavior should
remain presence-checked and, when a revision boundary is needed, use an agreed upstream-compatible
minor/capability gate rather than a fork-only storage-epoch bump.

### Capability detection that does not use `fwv`

`www/js/modules/supported.js` is the app's preferred detection layer and is the pattern to extend. It splits into two kinds:

- **Data-presence checks** — work on OSPi, where numeric gates are dead: `master` (`mas`/`mas2` iopts), `ignoreRain` / `ignoreSensor` / `actRelay` / `disabled` / `special` (typed keys under `controller.stations`), `pausing` (`settings.pq !== undefined`), `groups` (option count `>= 4`).
- **Version-backed checks** — `dateRange` (220), `changePause` (2211), `verifyWeatherAPIKey` (219 + `uwt` + `wto`), `restrictions` (2213 + `wto`).

**Prefer adding a data-presence check here** over a bare `fwv` gate in a UI module: it survives OSPi and does not need a version bump to work.

## Auth Bootstrap

The legacy add-site probe is where the frozen app negotiates password format (`www/js/modules/sites.js:814-815`, `:671-696`). Its cleartext fallback exists only for legacy compatibility. The modern dashboard never uses that fallback: it performs the support-floor preflight above before prompting, then sends only the MD5 representation.

Unless the operator explicitly enables legacy authentication, the probe **always** sends `/jo?pw=md5(<password>)`. The app does not treat an unauthenticated firmware-version hint as authority to transmit a replayable cleartext password.

| Firmware | What happens | App reads | Result |
|---|---|---|---|
| `fwv >= 213` (expects md5) | Hash matches and `/jo` returns the full option set | valid `fwv` **and** finite numeric `wl` | stores **md5(pw)** |
| Legacy numeric firmware or OSPi, no approval | Hash is attempted; a partial version-only response is rejected | full-options validation fails | asks the operator to verify the password/settings; never retries cleartext automatically |
| Legacy numeric firmware or OSPi, explicit approval | A frozen legacy client or explicitly pinned companion protocol sends the supplied password | full-options response must match the selected protocol | stores cleartext only in that legacy-only configuration |

`wl` (water level, an iopt in `/jo`) remains part of the full-options auth-success sentinel. A success-shaped `200` carrying only `fwv` is not sufficient to persist or switch authentication modes.

**Consequences for the producer:**
- Removing `wl` from a successful `/jo` causes the response to fail full-options validation.
- An auth-failure response must not include a success-shaped full option set.
- Cleartext compatibility is legacy-only and requires explicit, independently verified configuration; the modern browser path never infers or retries it from `fwv`, password length, or a failed hash probe.

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

Responses are parsed as JSON with a string fallback. Numeric firmware 2.1.0 and newer must return an integer `result` for classified mutations; malformed mutation replies are rejected. OSPi and pre-2.1.0 compatibility responses retain the older pass-through behavior.

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
| `/su` | legacy script-URL view (**no auth**) | firmware-served UI injection |

Change endpoints classified by `sendToOS` for serialized mutation handling are `cl|cm|co|cp|cr|cs|csn|cu|cv|dl|dp|dsn|pq|sa|sb|sc|sn|sp|up|uwa`:

`/cv` values · `/co` options · `/cs` stations · `/cm` manual · `/cp` program · `/dp` delete program · `/up` move program up · `/cr` run-once · `/dl` delete log · `/sp` set password · `/cu` change script URL · `/pq` pause queue · `/sa`, `/sb`, `/sc`, `/sn` sensor mutations · `/csn` create/update sensor · `/dsn` delete sensor

Sensor endpoints (`/se`, `/sl`, `/sh`, `/sf`, `/sa`, `/sc`, `/sb`, `/sn`, `/so`) are called from `www/js/modules/analog.js`.

## What The App Does Not Couple To

- **The weather service (adjustments).** For watering adjustments the app reads the firmware's weather *settings* (`wsp`, `wto`) and *cached results* (`wtdata`, `wterr`, `wtrestr`) from `/jo` and `/jc`; the firmware alone drives the `/weatherAdjustment` pipeline. **Display forecasts are a deliberate, read-only exception:** both the legacy app (`www/js/modules/weather.js` `updateWeather()`) and the modern app (`www/src/api/weather.ts` `fetchForecast()`, wired in `app/main.ts`) fetch `GET /weatherData` directly from the host in `wsp`, using the same `wto` provider/key/pws the firmware uses. This is display-only; it never influences controller state. A second legacy-only exception: `www/js/modules/weather.js:477` hardcodes `https://api.weather.com/v2/pws/` to validate WeatherUnderground PWS keys client-side.
- **The OTF library.** The app compiles nothing from `OpenThings-Framework-Firmware-Library`. It couples to the same **OpenThings Cloud service**, routing through `https://cloud.openthings.io/forward/v1/<token>` in place of the controller IP (`firmware.js:56`, `sites.js:396`), with tokens matching `^OT[a-fA-F0-9]{30}$` (`dashboard.js:169`). Every endpoint above works through that prefix unchanged, which is why the URL shape is a contract in its own right (`OpenSprinkler-Firmware/docs/external-contracts.md`).

## Maintenance Contract

**The firmware is canonical on this axis.** Before changing anything above:

1. **Never renumber or reorder `_url_keys[]`.** Endpoint keys and JSON field names are append-only in practice — old app builds and old controllers coexist in the field in both directions.
2. **Do not use a fork-only `fwv` bump for app-visible behavior.** Keep additions backward-compatible, validate field presence, and use an agreed upstream-compatible `fwm`/capability boundary only when presence alone is insufficient. Preserve the legacy gate in `www/js/modules/supported.js` while legacy remains.
3. **Before removing or renaming a field or endpoint, grep the app's call sites.** There is no CI guard to catch it; the failure mode is a silent `undefined` in a UI module, not a test failure.
4. **Keep `/jo` and `/ja` success shapes aligned with full-response validation.** Version-only auth-failure responses may remain for compatibility, but the modern app uses them only for unsupported/auth state selection and never to authorize cleartext. Treat `/su`-without-auth as a separate legacy compatibility contract; persistent UI selection is `/cu`.
5. Update this doc and the firmware-side API reference together, and keep `OpenSprinkler-Firmware/docs/ecosystem.md` axis D in sync.

---
*Consumer-side counterpart to `OpenSprinkler-Firmware/docs/docs/2.2.1/221_4_api.md`. Hub map: `OpenSprinkler-Firmware/docs/ecosystem.md` (axis D). See also `external-contracts.md` for the OTC URL shapes this app shares with the firmware.*

# Phase-1 dashboard — on-device verification runbook

> **THIS IS A LIVE PRODUCTION CONTROLLER.** The target is the operator's own OpenSprinkler running
> their own fork build (`fwf=kars85.3`), with **2 real enabled programs**, a real GPS location, and a
> **self-hosted weather server**. It is **not** a throwaway test rig. Read the SAFETY PREAMBLE before
> doing anything. Every mutating step is structured **Capture → Do → Expect → Restore**, and the
> writes are issued as **atomic single-key device commands — never via the bundled UI Save forms**
> (see "Why the UI forms are forbidden").

The typed scaffold is fully unit-proven (`npm run test:contract`: contract, decoders, **encoders
round-tripped**, command construction, settings mappers). A handful of items can only be confirmed
against real hardware. This runbook closes the hardware-gated items in the #5 tracker (PRD §3 live
capture, §4/§8.2 LAN+OTC seam proof, §7 rollout) **without endangering the operator's live system.**

---

## SAFETY PREAMBLE — read this first

### The golden rule

> **Capture the original state first. Only ever operate on NEW throwaway artifacts. Restore everything,
> then diff against the §0 baseline at close-out.**
>
> This device's resting state is **not** the firmware default in several places. Never assume a default —
> read it, capture it, restore the captured value verbatim, re-read to confirm.

### KNOWN LIVE STATE of THIS device (ground truth, probed read-only this session)

| What | Value | Rule |
|---|---|---|
| Base URL | `http://10.10.100.246/` (plain HTTP, LAN) | Reachable from the dev box. |
| Password | `opendoor` | fwv 221 ≥ 213 ⇒ firmware md5-hashes it. Auth **required** (no `ipas` bypass). |
| Firmware | `fwv=221 fwm=4 hwv=32` ⇒ HW 3.2, FW 2.2.1(4); `fwvCombined=2214` | fwv < 300 ⇒ **all change commands are GET**. |
| Build | `fwf="kars85.3"` | Operator's **own fork** — treat as production, do not assume stock firmware behavior. |
| **Controller enable** | **`en=0` — DISABLED right now** | Read `/jc.en`, capture, **restore to `0`**. NEVER leave it enabled if it started disabled. |
| Water level | `wl=45%` (ETo-auto) | Scales every run time. The General form's hard default is `100`. ETo moves this value on its own — do **not** pin it to a literal at close-out. |
| Rain delay | `rd=0` | The sanctioned reversible write-proof toggles this; restore to `0`. |
| Weather method | `uwt=3` (ETo) | Drives `wl`. Do not perturb. |
| Sensor 1 | `sn1t=1` (Rain); `secondSensor=true` | The General form's hard default is `0` (None) — a stray save disables the rain sensor. |
| Location | `loc=41.70737,-93.62914` | Real GPS, drives ETo. |
| **Custom weather server** | `wsp=http://10.10.100.3:3000` | Self-hosted, plain-HTTP, **LAN-only** (not reachable through the OTC HTTPS tunnel). Lives in `/jc.wsp`. Do **not** clobber. |
| Stations | **24 total**, all potentially live | See below. |
| Station 8 (1-based) | `"Disabled - Unknown Conductor"` | **Hazardous unknown wiring. NEVER energize.** Its disabled bit is load-bearing. |
| Stations 12–24 | default names `S12`..`S24` | Likely unconfigured but **TREAT AS POTENTIALLY LIVE**. |
| **2 real enabled programs** | `"Front Use Water Wisely"`, `"Backyard Use Water Wisely"` (weekly) | **DO NOT TOUCH.** Never run, toggle, edit, or delete. Throwaway artifacts only. |
| OTC remote | `otfCloud=true` | OTC provisioned. §3 needs the device's OTC token (a **secret**). |

### Hard prohibitions (do any of these and you have failed the runbook)

- ❌ Leave `en=1` if it started at `en=0`. Always restore `/jc.en` to its captured value.
- ❌ Run / toggle / edit / delete the two real programs.
- ❌ Energize station 8, or any unverified zone (incl. `S12`–`S24`). Do **not** trust "firmware refuses
  disabled stations" — this is a **custom fork**; the only safe actuation target is a zone you have
  **physically disconnected**.
- ❌ Issue `runOnce` / `runProgramNow` / `/cr` against anything real — `/cr` **opens valves even when `en=0`**.
- ❌ Submit **any** bundled UI Save form (Weather / General / Stations / Network) on this device — see below.
- ❌ Click the **Reboot** button in the Status header (`/cv?rbt=1`) — it drops connectivity mid-verify.
- ❌ Submit Network options (DHCP / static IP / port / NTP) without a confirmed **physical-recovery path** —
  a wrong value strands the device at the very URL you need to reach it.
- ❌ Assume firmware defaults. `en/wl/uwt/sn1t/loc/wsp` are all non-default here.

### Why the UI forms are forbidden (use atomic writes instead)

The dashboard's Save buttons call **bundle serializers** that re-emit their *entire* payload every time,
regardless of what you "changed". Verified against source:

- **Weather form** (`settings/weather.ts buildWeatherOptions`) always emits `uwt` **and** the full
  `wto` JSON (provider, **API key**, Zimmerman/ETo baselines, monthly scales) in one `/co`. A blank/garbled
  key field **silently wipes the stored API key**.
- **General form** (`settings/general.ts buildGeneralOptions`) always emits `wl` (**hard default `100`**),
  `sn1t` (**hard default `0`**), and a `tz` **re-derived by rounding** a float GMT-offset — so a save can
  land on a different `tz` and clobber `wl=45` / disable the rain sensor.
- **Stations form** (`settings/stations-edit.ts buildStationConfig`) always rebuilds **disabled** and
  **ignore-rain** bits for **all 24 stations** from the rendered checkboxes. If the read seam didn't fully
  populate `stn_dis`, a save **enables station 8** and `S12`–`S24`.

So: **every settings/program test in this runbook is an atomic single-key GET command** (`/co?key=…`,
`/cs?s<sid>=…`, `/cp?pid=…`, `/dp?pid=…`) that touches only the named field. The UI forms are validated
for *rendering* against mock data in §2, **not** submitted against this device.

### The live UI has armed controls (relevant to §2)

`renderDashboard({actions:true})` renders **real, wired** controls against the live device. A single
mis-click mutates state. Armed controls present: Status header → **Stop all** (`/cv?rsn=1`),
**Enable/Disable** (`/cv?en=`), **Rain delay**, **Reboot** (`/cv?rbt=1`); Programs rows →
**toggle** (NO confirmation), **Run now**, **Delete** (weak confirm) — all wired to the **real** pids;
every Settings **Save** button. Prefer the mock render (§2a). If you must open the live UI (§2b),
capture the §0 baseline first and **click nothing**.

---

## Status: what already PASSED vs what is operator-gated

| Section | Status |
|---|---|
| §1 read-only proof — `npm run verify:live` | ✅ **PASSED this session.** fwv221/fwm4/hwv32, `fwf=kars85.3`, 24 stations, 2 programs, caps derived. Reads + capabilities green. |
| §1 read-only capture — `npm run capture` | ⬜ Gated (read-only; safe — produces baseline fixtures; **scrub secrets**, see §1). |
| §2a UI render vs mocks (`npm run demo`) | ⬜ Gated (no device risk). |
| §2b live LAN render | ⬜ Gated (armed controls — capture baseline, click nothing). |
| §3 OTC remote / mixed-content (PRD §4 #1) | ⬜ Gated (needs OTC token + HTTPS build + browser). |
| §4 auth | ⬜ Gated (wrong-pw / pre-auth-stub contrast is manual). |
| §5 reversible write proof (rain delay) | ⬜ Gated (reversible, no stations; mandatory post-read). |
| §6 control smoke test (PHYSICAL) | ⬜ Gated — **actuates valves.** Default-SKIP; requires a disconnected zone. |
| §7 settings write-back (atomic) | ⬜ Gated — mutates live config; capture/restore each field. |
| §8 rollback drill | ⬜ Gated (capture `jsp` first). |
| §9 final close-out diff | ⬜ Gated. |

---

## Conventions

- **Reads are always safe**: `/jc`, `/jo`, `/jn`, `/jp`, `/jl`, `/js`, `/sp`. They never change state.
- **Auth** on this device: `pw = md5("opendoor")`. Compute once and reuse:

  ```powershell
  # PowerShell (Windows operator)
  $md5 = [BitConverter]::ToString([Security.Cryptography.MD5]::Create().ComputeHash(
    [Text.Encoding]::UTF8.GetBytes('opendoor'))).Replace('-','').ToLower()
  $md5   # use as <md5> in ?pw=<md5>
  ```
  ```bash
  printf '%s' 'opendoor' | md5sum   # first field = <md5>
  ```
  > A `?pw=<md5>` in a browser/curl URL leaks the auth hash into shell/browser history. Prefer the
  > harness/scripts (they hash for you) for anything beyond a quick manual read.

- Every change command here is **GET** (fwv 221 < 300): e.g. `GET /cv?rd=1&pw=<md5>`. (Seam switches to
  POST only at `fwv >= 300`.)
- **Result codes** (`client.ts COMMAND_RESULT_TEXT`): `1`=Success, `2`=Unauthorized, `3`=Mismatch,
  `16`=Data missing, `17`=Out of range, `18`=Data format, `19`=RF code, `32`=Page not found,
  `48`=Not permitted. Anything but `result===1` throws `CommandError`.

---

## 0. Prerequisites + full baseline capture (READ-ONLY — do this first)

You MUST have a complete, diffable baseline on disk before any write (§5–§8). The §9 close-out diffs
against it.

- [ ] **Reachability** (unauth `/jo` returns a `{fwv}`-only stub — select only `fwv` here):
  ```powershell
  Invoke-RestMethod 'http://10.10.100.246/jo' | Select-Object fwv     # -> 221
  ```
- [ ] **Capture the baseline values** you will later restore. Read each authenticated endpoint and save
  the fields below (the §9 diff checks **all** of them):
  - `/jc` → `en`, `rd`, `rdst`, `dname`, `loc`, `wsp`, `wterr`, `wtrestr`, `sbits`, `ps`
  - `/jo` → `wl`, `uwt`, `sn1t`, `sn1o`, `sn2t`, `mas`, `mas2`, `tz`, `sdt`, `lg`, `hp0`, `hp1`, `jsp`, `ntp*`, `ip*`
  - `/jn` → `snames`, `stn_dis`, `ignore_rain`, `stn_grp`
  - `/jp` → `nprogs`, and the full `pd[]` tuples for the 2 real programs (so a mistake is recoverable)
  > **`jsp` is the served-UI pointer used in §8 — capture it now.** If you cannot read it, **skip §8**.
- [ ] **Device password** (or `ipas`): `opendoor` (md5 as above).
- [ ] **For §3 remote:** the device's OTC token (Settings → OpenThings Cloud; token shape `^OT[0-9a-f]{30}$`).
  Treat it as a **secret** — never commit it.

---

## 1. Read-only automated proof (PRD §3)

### 1a. Live read pipeline — `npm run verify:live`  ✅ already passed this session

```powershell
$env:OS_LIVE_BASE='http://10.10.100.246/'; $env:OS_LIVE_PW='opendoor'; npm run verify:live
```
Runs the REAL seam → typed client → decoders against the device (Node fetch is **not** subject to the
browser mixed-content policy, so it can read the HTTP LAN device directly). Proves §1–§4 reads +
capability derivation. Confirmed: `fwv=221 fwm=4 hwv=32 fwf="kars85.3"`, 24 stations, 2 programs,
`caps={fwvCombined:2214, weatherRestricted, secondSensor, otfCloud, flowSensor:false}`.

- [ ] **Add capability assertions** so derivation is *proven*, not assumed: confirm the printed `caps`
  shows `secondSensor=true` (from `/jo.sn2t`), `secondMaster` (from `/jo.mas2`), `flowSensor=false`
  (`sn1t!=2`). (`weatherRestricted` derives from the **presence of `/jc.wtrestr`**, not from `uwt`.)
- [ ] Note: the harness prints `weather=Online` only when `/jc.wterr===0` at read time. A transient
  `Offline`/`Error` from the custom weather server is **not** a read-pipeline failure.

### 1b. Live fixture capture — `npm run capture`  (read-only, re-pins the contract)

`scripts/capture-fixtures.mjs` reads `OS_BASE`/`OS_PW`/`OS_PWHASH` (**not** `OS_LIVE_*`). The `--base`/
`--pw` flags below supply everything, so env vars are unnecessary:

```powershell
npm run capture -- --base http://10.10.100.246/ --pw 'opendoor'
npm run test:contract     # re-pin the contract against the LIVE capture (not the derived defaults)
```

- [ ] ⚠️ **Secret scrub:** `npm run capture` writes `/jc` and `/jo` **verbatim** to
  `test/fixtures/api/*.fixture.json`, **including the OTC token (`jc.otc`) and the weather API key
  (`wto.key`)**. Before capture, add `test/fixtures/api/` to `.gitignore`, **or** scrub `jc.otc` and
  `wto.key` from the fixtures before they touch git.
- [ ] If `test:contract` fails on the live capture, the fork firmware differs from the documented
  contract — record the diff (do not silently re-pin).

---

## 2. UI render proof (PRD §4/§8.2)

### 2a. Render correctness vs mocks (no device risk) — do this first

```powershell
npm run demo     # serves the full pipeline against committed fixtures
```
- [ ] Confirm **every tab renders**: Status · Stations · Programs · Weather · Log · Diagnostics ·
  Settings. This validates the views/decoders without touching the device.

### 2b. Live LAN render (armed — capture §0 baseline first, click nothing)

```powershell
npm run build:app ; npx http-server ./dist     # serve over HTTP (LAN path needs an HTTP origin)
```
- [ ] Open `http://localhost:8080/?base=http://10.10.100.246/`.
- [ ] Confirm every tab renders with **live** data identical to the device.
- [ ] Sanity-check the #287 time fix: Status (rain-delay end, sunrise/sunset) and Diagnostics
  (Last request / Last update) show **device-local** time vs the device clock.
- [ ] **Do NOT click any control.** Armed controls present: Status → Stop all / Enable / Rain delay /
  **Reboot**; Programs rows → toggle (no confirm) / Run now / Delete; all Settings Save buttons.

---

## 3. OTC remote proof — the #1 risk: mixed content (PRD §4)

> A browser blocks active mixed content: an **HTTPS**-hosted page cannot `fetch()` the plain-**HTTP**
> LAN device. The seam does **no** scheme upgrade. Remote access must go through the OTC **HTTPS**
> tunnel (`https://cloud.openthings.io/forward/v1/<token>/`), where page and device endpoint are both
> HTTPS. This is the single highest-risk integration claim — prove it on a real browser.

- [ ] ⚠️ **Clear the write flag first** (it persists across a PowerShell session from §5, and a write
  over OTC is hard to verify/restore):
  ```powershell
  Remove-Item Env:OS_LIVE_WRITE -ErrorAction SilentlyContinue
  ```
- [ ] Open the **HTTPS**-hosted build (preview channel) and load with
  `?base=https://cloud.openthings.io/forward/v1/<token>/`.
- [ ] Confirm it renders identically to LAN, with **no mixed-content console errors**.
- [ ] Note the custom weather server `wsp=http://10.10.100.3:3000` is **LAN-only HTTP** and will not be
  reachable through the HTTPS tunnel — its weather-status surface may differ over OTC. That is expected.
- [ ] **PRD §4/§8.2 acceptance requires ≥2 firmware versions.** This runbook targets one device
  (fwv221). Either repeat §1–§3 against the **DEMO build** and/or a second `fwv`, or record the
  ≥2-version + DEMO dimension as **explicitly deferred** with rationale in the sign-off.

---

## 4. Auth

- [ ] Password device: the login prompt authenticates; a **wrong** password is rejected and re-prompts.
- [ ] Pre-auth contrast: unauthenticated `/jo` returns the `{fwv}`-only stub (no full options).
- [ ] `?pwhash=<md5>` bypasses the prompt (the typed seam sends `pw=md5(pw)` for fwv≥213; falls back to
  cleartext only if the hashed check fails).

---

## 5. Reversible write proof (no stations run)

The sanctioned first write: set a rain delay, read it back, cancel. It **does not actuate any valve**.

```powershell
$env:OS_LIVE_BASE='http://10.10.100.246/'; $env:OS_LIVE_PW='opendoor'; $env:OS_LIVE_WRITE='1'
npm run verify:live      # adds the rain-delay set -> verify -> cancel block
```
- **Capture:** the harness reads `rd` before; on this device `rd=0`.
- **Do:** `setRainDelayHours(1)` → `GET /cv?rd=1&pw=<md5>`.
- **Expect:** `/jc.rd==1`, `/jc.rdst≈now+3600`. Then `cancelRainDelay()` → `/cv?rd=0`.
- **Restore (MANDATORY independent read — do not trust the harness exit):**
  ```powershell
  Invoke-RestMethod "http://10.10.100.246/jc?pw=$md5" | Select-Object rd,rdst   # expect rd=0, rdst=0
  ```
  If the cancel call itself threw (network drop / Ctrl-C between set and cancel), `rd` may be left `1` —
  re-issue `GET /cv?rd=0&pw=<md5>` manually. If `rd` was non-zero at capture, restore with
  `GET /cv?rd=<captured_hours>&pw=<md5>`.
- [ ] ⚠️ **Unset the write flag** so later read-only runs (esp. §3 over OTC) can't accidentally write:
  ```powershell
  Remove-Item Env:OS_LIVE_WRITE -ErrorAction SilentlyContinue
  ```

---

## 6. Control smoke test — PHYSICAL (default SKIP; hard-gated)

> ⚠️ These commands **open real valves and run water.** `/cr` and `/cm?en=1` actuate **even when the
> controller is disabled (`en=0`)**. Do not run casually.

**Zone selection (load-bearing):** the only acceptable actuation target is a station the operator has
**physically disconnected/verified**. Do **not** rely on "firmware refuses disabled stations" — this is
a custom fork and the client does not check the disabled bit. **Station 8 and `S12`–`S24` are off-limits.**

Stage a safety net before any start: have `Stop all` (`GET /cv?rsn=1&pw=<md5>`) ready in a second shell.

### 6a. Manual run / stop (only a physically disconnected zone)
- **Capture:** `/jc.sbits` clear, `/jc.ps[sid]` remaining 0.
- **Do:** `startStation(sid, 60)` → `GET /cm?sid=<sid>&en=1&t=60&pw=<md5>`.
- **Expect:** `/jc.sbits` bit `sid` set; `/jc.ps[sid]` remaining > 0; `/js.sn[sid]==1`.
- **Restore:** `stopStation(sid)` → `GET /cm?sid=<sid>&en=0&pw=<md5>`; confirm `sbits` clears.

### 6b. Stop-all
- **Do:** start the disconnected zone (6a), then `stopAllStations()` → `GET /cv?rsn=1&pw=<md5>`.
- **Expect:** `/jc.sbits` all clear, `ps[]` empty, `nq==0`, `/js.sn[]` all 0.

### 6c. Controller enable — **OPTIONAL, DEFAULT SKIP**
> Enabling re-arms scheduling for the 2 real weekly programs — a real watering window. Only run if you
> have a documented multi-hour clear window **and** load is disconnected.
- **Capture:** `/jc.en` (==0 here). Read `/jp` and compute each enabled program's **next start vs
  `/jc.devt`** — require a multi-hour clear window. Confirm `/jc.sbits` clear.
- **Do:** `setControllerEnabled(true)` → `GET /cv?en=1&pw=<md5>`.
- **Expect:** `/jc.en==1` **and `/jc.sbits` stays clear** (watch it; if any bit sets, immediately
  `GET /cv?rsn=1` then disable).
- **Restore:** `setControllerEnabled(false)` → `GET /cv?en=0&pw=<md5>`; **confirm `/jc.en==0`** (its
  captured value). Never leave it enabled.

### 6d. Throwaway program — create → toggle → delete (atomic, never the UI form)
> The UI Programs list toggle/run/delete are wired to the **real** pids (toggle has **no confirm**).
> Operate **only** by direct command against a freshly-confirmed throwaway pid — never by clicking rows.
- **Create disabled, all-zero durations** via `submitProgram(-1, …)` with `enabled:false` and a
  zero-filled durations array → `GET /cp?pid=-1&v=[<flags bit0=0>,…,[0,0,…0]]&name=ZZ_throwaway&pw=<md5>`.
  > The UI form would default **Enabled CHECKED** and **start 06:00 Mon–Fri** — which is why we build it
  > directly, disabled, with zero durations.
- **Verify before any toggle:** re-read `/jp`; the throwaway is the **highest** pid (`nprogs-1`); assert
  its `flags bit0==0` and **all durations are 0**; assert pids `0..n-2` still match the captured real
  programs' names/schedules. Any mismatch → **abort**.
- **Toggle (optional):** `setProgramEnabled(newpid, tuple, true)` then `false`. Re-read `/jp`
  **immediately before each** call and re-confirm the target is still the throwaway (delete/edit
  elsewhere renumbers pids). `setProgramEnabled` rewrites the **whole** tuple from the passed value —
  never run it against a pid not freshly confirmed as the throwaway. (Safe here only because durations
  are 0.)
- **Delete:** re-read `/jp`, re-confirm highest pid is still the throwaway, then `deleteProgram(newpid)`
  → `GET /dp?pid=<newpid>&pw=<md5>`. **Expect** `nprogs` decrements and the 2 real programs remain.
- **(fwv≥220) optional:** confirm the throwaway's date-range tuple (`endr/from/to`) round-trips in
  `/jp.pd[newpid]`.

### 6e. Non-actuating control mutations (note / out-of-scope)
- `reboot()` → `/cv?rbt=1`: **do not run** during verify (drops connectivity). If validated, gate it
  separately: capture `lupt`/`lrbtc`, expect unreachable→return, then re-assert `en==0` and no real
  program auto-started.
- `clearOvercurrent()` → `/cv?rocs=1`: harmless status reset (no actuation). Optional: read `/jc.ocs`,
  issue, expect `ocs→0`. Otherwise out of scope.
- `runOnce()` / `runProgramNow()` → `/cr?t=<json>`: **physically irrigates and runs even when `en=0`.**
  Run-once parity is evidenced by the **unit round-trip** (`test:contract`), **not** on the live device.

---

## 7. Settings write-back — ATOMIC writes only (never the UI Save forms)

Each test issues a single-key `/co` or `/cs` GET (touches only that field), then restores the captured
value. **Do not submit the Weather/General/Stations/Network forms** (see "Why the UI forms are forbidden").

### 7a. Device name (atomic `/co?dname=`)
- **Capture** `/jc.dname` (`"opensprinkler"`). **Do** `GET /co?dname=ZZ_test&pw=<md5>`.
  **Expect** `/jc.dname=="ZZ_test"`. **Restore** `GET /co?dname=opensprinkler&pw=<md5>`; re-read.

### 7b. Water level — **do not test**
ETo (`uwt=3`) auto-drives `wl`; a test write + the form's `100` default both risk re-scaling the 2 live
programs, and the value legitimately moves on its own (so no stable assertion exists). Skip it; verify
`uwt`/`weatherRestricted` are intact instead (§9).

### 7c. Weather method/location (atomic `/co?uwt=` / `/co?loc=` — never the form)
- **Capture** `/jo.uwt` (`3`), `/jc.loc`. **Do** a reversible round-trip with a single key, e.g.
  `GET /co?loc=41.70737,-93.62914&pw=<md5>` (write the **same** value to prove the path without change),
  or toggle `uwt` to another method and back. **These keys do NOT touch `wto`.**
- **Restore** the captured `uwt`/`loc`. **Confirm `/jc.wsp` and `/jc.wto` are byte-identical** to §0.

### 7d. Station rename (atomic `/cs?s<sid>=` — one disconnected station)
- **Pre-assert:** `/jn.stn_dis` shows **station 8 disabled**. **Capture** `/jn.snames[sid]` for a chosen
  disconnected `sid`. **Do** `GET /cs?s<sid>=ZZ_test&pw=<md5>` (sends **only** that name key).
- **Expect** `/jn.snames[sid]=="ZZ_test"` and `/jn.stn_dis` **byte-identical** to capture. **Restore**
  the original name. **(fwv≥220) optional:** confirm `/jn.stn_grp[sid]` round-trips.

### 7e. Network port (atomic `/co?hp0=&hp1=` — only with physical recovery)
> `hp0`/`hp1` are **separate bytes**: `port = (hp1<<8)|hp0` (port 80 = `hp0=80,hp1=0`). Have physical
> access before changing.
- **Capture** `/jo.hp0`,`/jo.hp1`. **Do** set a new port; confirm reachable on it. **Restore** with the
  **two captured bytes**: `GET /co?hp0=<orig hp0>&hp1=<orig hp1>&pw=<md5>`.

### 7f. Unexposed-but-reachable write keys (NEVER issue ad hoc)
`submitOptions` can also write `mqtt`/`email`/**`otc`**/`mas`/**`wsp`** and `submitStations` can write
master/sensor-ignore/special board bytes — **none behind any form**. Issuing `otc` clobbers the OTC
token; `wsp` clobbers the custom weather server. Do not send these against this device.

---

## 8. Rollback drill (capture `jsp` first — else SKIP)

> `/cu?jsp=` changes which UI the controller serves to anyone hitting `http://10.10.100.246/`. It is a
> **persistent** change. If you didn't capture `jsp` in §0, **skip this section.**
- **Capture** `/jo.jsp` (§0). **Do** point at the legacy UI:
  `GET /cu?jsp=https://ui.opensprinkler.com/js&pw=<md5>`; confirm the legacy UI loads.
- **Restore** the **exact captured** `jsp`: `GET /cu?jsp=<captured>&pw=<md5>`; re-read `/jo.jsp`.

---

## 9. Final close-out — full diff against the §0 baseline

Re-read every endpoint and assert **each captured field** matches §0 (not a hand-picked subset). A field
clobbered by a stray write that isn't on this list goes undetected — so diff the whole baseline:

- `/jc`: `en==0`, `rd==0`, `rdst==0`, `dname`, `loc`, **`wsp`**, `wtrestr`, `sbits` clear, `ps` empty.
- `/jo`: `uwt==3`, `sn1t==1`, `sn1o`, `sn2t`, `mas`, `mas2`, `tz`, `sdt`, `lg`, `hp0`, `hp1`, **`jsp`**,
  `ntp*`, `ip*`. **`wl`:** do **not** assert a literal — assert `uwt==3` + `weatherRestricted` intact
  (the auto-driver is unperturbed; the value itself moves with ETo).
- `/jn`: `snames`, `stn_dis` (station 8 still disabled), `ignore_rain`, `stn_grp`.
- `/jp`: `nprogs` back to the original count; the 2 real programs' tuples byte-identical; no `ZZ_*` left.
- `/jc.wto`: API key intact. Confirm no `OS_LIVE_WRITE` lingering in any shell.

---

## Sign-off → #5 tracker

| #5 item | Closed when |
|---|---|
| §3 contract capture (live) | §1 done, contract re-pinned, **secrets scrubbed** |
| §4/§8.2 seam spike LAN+OTC | §2 + §3 pass (no mixed-content errors); ≥2-fw/DEMO done **or** deferred-with-rationale |
| §6 UI rebuild (write/control + settings) | §5 + §6 + §7 pass via **atomic writes**; §9 diff clean |
| §7 hosting + jsp flip/rollback | go-live (DEPLOY.md) + §8 rollback drill, `jsp` restored |

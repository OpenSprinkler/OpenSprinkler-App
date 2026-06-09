# Phase-1 dashboard — on-device verification checklist

The typed scaffold is fully unit-proven (contract, decoders, **encoders round-tripped**, command
construction, settings mappers — `npm run test:contract`), but a few things can only be confirmed
against a **real controller**. This checklist closes the hardware-gated items in the #5 tracker
(PRD §3 live capture, §4/§8.2 LAN+OTC seam proof, §7 rollout) before any production rollout.

> ⚠️ Run against a **test controller** (or a zone with no real sprinkler load) first. The control
> smoke test will physically actuate stations.

## Quick automated check — `npm run verify:live`

Runs the REAL seam → typed client → decoders against the device (no browser, no overwrite of the
committed fixtures) and prints the device's actual config. Covers §1–§4 reads + capabilities, and —
with `OS_LIVE_WRITE=1` — a single **reversible** rain-delay write (set → verify → cancel; no stations
run) that proves the authenticated command path:

```bash
OS_LIVE_BASE=http://<device-ip>/ OS_LIVE_PW='<password>' npm run verify:live
OS_LIVE_BASE=http://<device-ip>/ OS_LIVE_PW='<password>' OS_LIVE_WRITE=1 npm run verify:live  # + write proof
```

Validated on a live fwv 221 / 24-station controller (reads, capabilities, and the reversible write
all pass; the fork tag `fwf` is present). It does **not** physically run stations or change config —
those are the manual steps below.

## 0. Prerequisites
- [ ] A controller on your LAN; note its IP and `fwv` (Diagnostics → Firmware, or `GET /jo`).
- [ ] Device password (or `ipas=1` / ignore-password enabled).
- [ ] For remote: an OpenThings-Cloud (OTC) token for the device.

## 1. Capture live fixtures (PRD §3)
- [ ] `npm run capture -- --base http://<ip>/ --pw '<password>'`
- [ ] `npm run test:contract` — contract tests pass against the **live** capture (not the derived
      defaults). If anything fails, the firmware build differs from the documented contract — note it.
- [ ] Commit the per-`fwv` capture (or keep it out of git if device-specific — your call).

## 2. LAN render proof (PRD §4/§8.2)
- [ ] `npm run build:app && npx http-server ./dist` (or deploy to the preview channel).
- [ ] Open with `?base=http://<ip>/`. Confirm **every tab renders**: Status, Stations, Programs,
      Weather, Log, Diagnostics, Settings.
- [ ] Status time fields (rain-delay end, sunrise/sunset) and Diagnostics "Last request / Last
      update" show the **device-local** time (the #287 fix) — sanity-check against the device clock.

## 3. OTC remote proof — the #1 risk: mixed content (PRD §4)
- [ ] Open the **HTTPS**-hosted build and load with `?base=https://cloud.openthings.io/forward/v1/<token>/`.
- [ ] Confirm it renders identically to LAN. (An HTTPS page **cannot** reach a plain-HTTP LAN device —
      remote access must go through the OTC HTTPS tunnel. Verify no mixed-content console errors.)

## 4. Auth
- [ ] `ipas=1` device: loads with no prompt.
- [ ] Password device: the login prompt authenticates; a wrong password is rejected and re-prompts.
- [ ] `?pwhash=<md5>` bypasses the prompt.

## 5. Control smoke test (safe order)
- [ ] **Rain delay**: set 1h (Status → Rain delay…), confirm `/jc.rd`/`rdst`; then Cancel.
- [ ] **Manual run**: Stations → Start a test station for 1 min; confirm it energizes and the row
      shows "On" with time remaining; then **Stop**.
- [ ] **Stop all**: start a station, then "Stop all" — confirm all stop.
- [ ] **Controller enable**: Disable, confirm scheduling halts; re-Enable.
- [ ] **Program**: create a throwaway program (Settings → Programs), then from Programs tab
      **Run now** / **Disable** / **Enable** / **Delete** it. Confirm each via `/jp` + Log.

## 6. Settings write-back
- [ ] Change **device name** and **water level** (Settings → General) → Save; reload; confirm in
      `/jo` (`dname`, `wl`).
- [ ] Change **weather method**/location (Settings → Weather) → confirm `/jo.uwt`, `/jc.loc`, `wto`.
- [ ] Rename a station + toggle ignore-rain (Settings → Stations) → confirm `/jn`.
- [ ] (Optional, careful) Network: change HTTP port on a test device → confirm reachable on the new
      port; have physical access in case of misconfig.

## 7. Rollback drill
- [ ] Point a device back to the legacy UI and confirm it loads:
      `http://<ip>/cu?jsp=https://ui.opensprinkler.com/js&pw=<md5>`

## Sign-off → #5 tracker
| #5 item | Closed when |
|---|---|
| §3 contract capture (live) | §1 done, contract re-pinned |
| §4/§8.2 seam spike LAN+OTC | §2 + §3 pass (no mixed-content errors) |
| §6 UI rebuild (write/control + settings) | §5 + §6 pass on hardware |
| §7 hosting + jsp flip/rollback | go-live (DEPLOY.md) + §7 rollback drill |

# `www/src/` — modernization scaffold (Phase 1, Step 1)

The TypeScript foundation for modernizing this app against the **unchanged** OpenSprinkler
firmware JSON API. See `docs/PHASE-1-MODERNIZATION-PRD.md`.

```
www/src/
  api/
    types.ts    # firmware-API TS types (from the emit-code source of truth)
    client.ts   # typed, tolerant parsers + OsApiClient (the only module that knows the wire format)
  seam/
    device.ts   # device seam adapter: base-URL resolution, md5 auth, CORS, LAN-vs-OTC paths
```

**Contract:** the legacy firmware API is not a declared schema (assembled via `emit_p` into a
~2 KB buffer, state-dependent). Parsers validate the invariants the UI depends on and narrow the
known ambiguities; they do **not** reject unknown keys. **No new fields may be required here** —
consuming a field the firmware doesn't already emit is Phase 2 (firmware) work.

**Tests:** `npm run test:contract` (Vitest) runs `test/api-contract.spec.ts` against the derived
fixtures in `test/fixtures/api/`. Replace those fixtures with **live device captures** (one set per
`fwv`) to turn these into a real producer-drift guard — that is the next contract-capture task.

**Status:** **read + write dashboard** + **seam spike (unit-proven)**. Read-only screens, plus
control/action paths and full Settings — all unit-proven, pending on-device validation.

- `seam/device.ts` ports the real `www/js/home.js` device-comms (native-`fetch` CORS, `pw=` md5
  auth via `/sp`, version gating, LAN/OTC-uniform base) + change-command transport (POST on
  `fwv>=300`, else GET).
- `api/decode.ts` / `api/encode.ts` decode **and** encode programs/stations/options faithfully from
  the firmware encodings (round-trip tested).
- `api/client.ts` adds typed mutations (`/cm /cr /cv /cp /cs /co /dp`) with result-code → `CommandError`.
- `views/` render Status · Stations · Programs · Weather · Log · Diagnostics · Settings; `dispatch.ts`
  + `host.ts` wire control actions and settings saves. `demo/` runs the whole pipeline against mocked
  fixtures (`npm run demo`); `app/` is the real-device build.
- The Vitest contract suite (`npm run test:contract`) covers the contract, seam (GET/POST),
  decoders, **encoders**, views, logs, commands, settings mappers, the action dispatcher,
  time/diagnostics, a11y and XSS.
- `server/` (optional companion) serves the SPA + persists telemetry/run history to SQLite and adds a
  feature-detected History tab. `www/src/api/companion.ts` is the typed client. See docs/DEPLOY.md.

**Remaining — operator / hardware steps** (see `docs/HARDWARE-VERIFICATION.md`, `docs/DEPLOY.md`):
1. Live **LAN+OTC proof on real hardware** (mixed-content risk, PRD §4 #1) + replace derived fixtures
   with live captures (`npm run capture`).
2. On-device validation of the write/control + settings paths (the smoke test in HARDWARE-VERIFICATION).

This source is wired into the production `app/` build and its `app/public/home.js` firmware bootstrap.
The legacy UI under `www/js` and Cordova packaging remain separately supported; repository-owned
scripts build the firmware asset tree and run its legacy browser regressions.

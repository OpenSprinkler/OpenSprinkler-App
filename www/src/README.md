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

**Status:** complete **read-only dashboard** + **seam spike (unit-proven)**.

- `seam/device.ts` ports the real `www/js/home.js` device-comms (native-`fetch` CORS, `pw=` md5
  auth via `/sp`, version gating, LAN/OTC-uniform base).
- `api/decode.ts` decodes programs/stations/logs faithfully from the firmware encodings.
- `views/` + `spike/status-view.ts` render the four read-only screens; `views/dashboard.ts` is the
  tabbed shell. `demo/` runs the whole pipeline against mocked fixtures (`npm run demo`).
- **46 tests** (`npm run test:contract`) cover the contract, seam, decoders, views and logs.

**Remaining — higher-consideration (out of the isolated scaffold):**
1. Live **LAN+OTC proof on real hardware** (mixed-content risk, PRD §4 #1) + replace derived
   fixtures with live captures.
2. Wire into the real `home.js` bootstrap (touches the firmware-loaded entry point).
3. Deploy pipeline (Vite build → parallel Firebase URL) and the `SOPT_JAVASCRIPTURL` rollout.
4. Write/control paths (manual run, rain delay, program edits) — needs auth + on-device testing.

This scaffold is isolated: it does not touch the existing Grunt/Cordova build or `www/js`.

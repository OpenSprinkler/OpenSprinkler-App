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

**Status:** scaffold + **seam spike (unit-proven)**. `BrowserDeviceSeam` now ports the real
`www/js/home.js` device-comms (native-`fetch` CORS, `pw=` md5 auth via `/sp`, version gating,
LAN/OTC-uniform base). `www/src/spike/` boots the pipeline end-to-end (globals → seam → client →
render of a `/jc`+`/jo` status screen); `test/seam-spike.spec.ts` proves it against a mocked
transport (auth, fail-closed, `ipas`, OTC parity). **Remaining:** the live **LAN+OTC proof on real
hardware** (the mixed-content risk, PRD §4 #1), then build out screens and replace fixtures with
live captures.

This scaffold is isolated: it does not touch the existing Grunt/Cordova build or `www/js`.

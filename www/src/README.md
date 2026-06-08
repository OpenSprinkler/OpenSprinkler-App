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

**Status:** scaffold only. The next step (PRD §8.2) is the **seam spike** — replace
`BrowserDeviceSeam`'s stubbed `requestJson` with the real logic ported from `www/js/home.js`
(CORS, OTC vs LAN base, auth) and render one read-only screen from `/jc` over both access paths.

This scaffold is isolated: it does not touch the existing Grunt/Cordova build or `www/js`.

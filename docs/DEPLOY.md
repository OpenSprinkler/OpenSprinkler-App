# Phase-1 dashboard — deploy & rollout (DRAFT)

The modernized read-only dashboard deploys to a **parallel** Firebase Hosting site, completely
separate from the live legacy app, so rollout is opt-in and reversible. **Nothing here deploys
automatically** — every live step is an operator-run command. See `docs/PHASE-1-MODERNIZATION-PRD.md` §7.

## Pieces

| Piece | What it is |
|---|---|
| `npm run build:app` | Vite production build of the Phase-1 dashboard → `./dist` (gitignored). |
| `firebase.json` → `opensprinkler-nextui` | A **new, parallel** hosting site serving `dist` (CORS + SPA rewrite). The three legacy sites (`opensprinkler-ui`/`betaui`/`devui`) are untouched. |
| `.github/workflows/firebase-hosting-next.yml` | **Manual-only** workflow that builds and deploys to an **expiring preview channel** (never live), and only if the `FIREBASE_SERVICE_ACCOUNT_NEXT` secret is set. |

## One-time setup (operator)

1. **Create the Hosting site** in the Firebase project (it does not exist yet):
   ```bash
   firebase hosting:sites:create opensprinkler-nextui
   firebase target:apply hosting opensprinkler-nextui opensprinkler-nextui
   ```
2. (Optional, for CI preview deploys) add a repo secret `FIREBASE_SERVICE_ACCOUNT_NEXT`
   (a Firebase service-account JSON with Hosting deploy permission).

## Build locally (no deploy)

```bash
npm install
npm run build:app      # emits ./dist
npx http-server ./dist # eyeball the production bundle locally
```

## Preview deploy (temporary URL, safe)

```bash
npm run build:app
firebase hosting:channel:deploy phase1-preview --only opensprinkler-nextui --expires 7d
```
…or trigger the **Deploy Phase-1 dashboard (preview, manual)** GitHub Action (workflow_dispatch).
Preview channels are isolated, expiring URLs — they never affect any live site.

## Go live on the parallel site (deliberate)

```bash
npm run build:app
firebase deploy --only hosting:opensprinkler-nextui
```
This publishes to the parallel site only. The legacy app at `ui.opensprinkler.com` is unaffected.

## Wire devices to it (the actual rollout) — per device, reversible

The firmware loads the UI from `SOPT_JAVASCRIPTURL` (default `https://ui.opensprinkler.com/js`,
`OpenSprinkler-Firmware/defines.h:158`). Point a test device at the new site:

```
http://<device-ip>/cu?jsp=https://<nextui-domain>/js&pw=<md5(password)>
```

- The build now publishes the bootstrap **`home.js`** entry at the deploy root (`dist/home.js`,
  from `app/public/home.js`). It self-locates its base and loads the dashboard bundle
  (`assets/app.js` + `assets/app.css`) — so when `SOPT_JAVASCRIPTURL` points here (such that
  `home.js` is reachable at `<jsp>/home.js`), the firmware bootstrap loads the modernized UI.
  Verified by `test/home-bootstrap.spec.ts` (jsdom).
- The **md5 login UI** is built (`www/src/auth/`): non-`ipas` devices get a password prompt that
  authenticates via the version-gated `/sp` check (md5 for `fwv>=213`). md5 is verified against
  RFC 1321 vectors. `?pwhash=<md5>` still works for automated/standalone access.
- The dashboard now has **write/control + full settings** (manual run, run-once, rain delay,
  enable/stop-all, program run/enable/delete, and General/Weather/Network/Stations/Programs editors).
  The command/encoder layer is unit-proven (request construction + encode↔decode round-trips); it is
  **not yet validated on real hardware**.
- ⚠️ **Before pointing production devices here**, run the on-device checklist in
  [`docs/HARDWARE-VERIFICATION.md`](HARDWARE-VERIFICATION.md) (LAN + OTC render, auth, and a safe
  control smoke test), and capture live fixtures with `npm run capture` (see below).

**Rollback:** point the device back at the default:
```
http://<device-ip>/cu?jsp=https://ui.opensprinkler.com/js&pw=<md5(password)>
```
No firmware flash, no app-store release — just a config flip.

## Capture live fixtures (turns the contract tests into a real drift guard)

The committed `test/fixtures/api/*.json` are **derived from the firmware emit code**, not a live
device. Replace them with a real capture (one set per `fwv`) so the contract tests pin the actual
wire format:

```bash
npm run capture -- --base http://<device-ip>/ --pw '<device password>'   # or --pwhash <md5>
# writes test/fixtures/api/{jc,jo,jn,jp,jl,js}.fixture.json
npm run test:contract                                                      # re-pin against the live data
```

The script probes `/jo` for `fwv` and hashes the password with md5 for `fwv>=213` (matching the
firmware). It only **reads** (`/jc /jo /jn /jp /jl /js`) — it never sends a change command.

## Status / caveats

- The dashboard is now **read + write**: control actions and full settings editors are wired through
  the typed command layer (`www/src/api/client.ts` + `encode.ts`), unit-proven but **pending
  on-device validation** — see [`docs/HARDWARE-VERIFICATION.md`](HARDWARE-VERIFICATION.md).
- The firmware-loaded **`home.js` bootstrap entry is produced** (`dist/home.js` → loads
  `assets/app.js`); the standalone `index.html` SPA also works for direct access (`?base=`).
- Auth: `ipas` devices skip login; others get the md5 password prompt (`www/src/auth/`).
  `?pwhash=<md5>` bypasses the prompt for automated access.
- Change commands POST on `fwv>=300` (body) and GET otherwise, injecting the `pw=` hash — matching
  the legacy `sendToOS` transport.

## Self-host with the companion (local database)

`docker compose up --build` runs the **companion** (`server/`): it serves the dashboard at
`http://<host>:8080`, polls your controller into a local SQLite database (`/data` volume), and adds
a **History** tab. Config via `.env` (see `.env.example`). The companion is optional — the dashboard
works controller-direct without it. See the v1 spec: `docs/superpowers/specs/2026-06-09-companion-local-db-v1.nlspec.md`.

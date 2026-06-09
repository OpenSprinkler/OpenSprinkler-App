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

- ⚠️ **Prerequisite (not yet done):** the build must publish a `home.js` entry at `<nextui>/js/home.js`
  for the firmware bootstrap to load it. That is the deferred **home.js-wiring** step (PRD §4) — until
  it lands, this site is for direct/standalone access (`?base=<device-url>`), not the firmware bootstrap.

**Rollback:** point the device back at the default:
```
http://<device-ip>/cu?jsp=https://ui.opensprinkler.com/js&pw=<md5(password)>
```
No firmware flash, no app-store release — just a config flip.

## Status / caveats

- The app is **read-only** today; it has no write/control paths yet.
- The `home.js` bootstrap entry is **not** produced yet (Vite emits a standalone `index.html`/SPA).
  Wiring the firmware-loaded `home.js` is the next integration step before a real device rollout.
- Auth UI is a draft — `ipas` devices work; others use `?pwhash=<md5>` for now.

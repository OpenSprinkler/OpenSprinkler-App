# Phase-1 dashboard — deploy & rollout (DRAFT)

The modernized dashboard deploys to a **parallel** Firebase Hosting site, completely
separate from the live legacy app, so rollout is opt-in and reversible. **Nothing here deploys
automatically** — every live step is an operator-run command. See `docs/PHASE-1-MODERNIZATION-PRD.md` §7.

## Pieces

| Piece | What it is |
|---|---|
| `npm run build:app` | Vite production build of the Phase-1 dashboard → `./dist` (gitignored). |
| `firebase.json` → `opensprinkler-nextui` | A **new, parallel** hosting site serving `dist` (CORS + SPA rewrite). The three legacy sites (`opensprinkler-ui`/`betaui`/`devui`) are untouched. |
| `.github/workflows/firebase-hosting-next.yml` | **Manual-only** workflow that builds `master` and deploys to an **expiring preview channel** (never live). It fails if the protected `firebase-next-preview` environment does not supply `FIREBASE_SERVICE_ACCOUNT_NEXT`. |

## One-time setup (operator)

1. **Create the Hosting site** in the Firebase project (it does not exist yet):
   ```bash
   firebase hosting:sites:create opensprinkler-nextui
   firebase target:apply hosting opensprinkler-nextui opensprinkler-nextui
   ```
2. For CI preview deploys, create the protected GitHub environment described under
   **GitHub release protections** below and add `FIREBASE_SERVICE_ACCOUNT_NEXT` there (a Firebase
   service-account JSON with Hosting deploy permission). Do not keep a repository-scoped copy.

## Build locally (no deploy)

```bash
npm install
npm run deps:rebuild  # runs only the reviewed better-sqlite3/esbuild/fsevents hooks
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
http://<device-ip>/cu?jsp=https://<nextui-domain>&pw=<md5(password)>
```

- The build now publishes the bootstrap **`home.js`** entry at the deploy root (`dist/home.js`,
  from `app/public/home.js`). It self-locates its base and loads the dashboard bundle
  (`assets/app.js` + `assets/app.css`) — so when `SOPT_JAVASCRIPTURL` points here (such that
  `home.js` is reachable at `<jsp>/home.js`), the firmware bootstrap loads the modernized UI.
  Do not append `/js` for this Vite artifact; that legacy layout would request a nonexistent
  `<nextui-domain>/js/home.js`.
  Verified by `test/home-bootstrap.spec.ts` (jsdom).
- The **md5 login UI** is built (`www/src/auth/`): non-`ipas` devices get a password prompt that
  authenticates via the version-gated `/sp` check (md5 for `fwv>=213`). md5 is verified against
  RFC 1321 vectors. URL-supplied `pwhash` is deliberately discarded; standalone use always prompts
  so credentials cannot persist in browser history, logs, or referrers.
- The dashboard renders the modern controls and settings editors, but the production host
  intentionally omits `mutationProof` and therefore starts **fail-closed/read-only**. Emergency
  stop/station-stop/rain-cancel and the secret-safe configuration export remain available. Other
  deterministic transactions can be granted by family only after hardware verification; network,
  reboot, station-start, program run/run-once, and attributes without typed readback remain locked.
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
device. Capture each target firmware version into a separate, automatically redacted directory so
the actual wire shape can be inspected without overwriting the curated value-coupled corpus:

```bash
read -rsp 'Controller password: ' OS_PW && export OS_PW && echo
npm run capture -- --base http://<device-ip>/
unset OS_PW
# writes test/fixtures/api/captured/<fwv>/{jc,jo,jn,jp,jl,js}.fixture.json
npm run test:contract
```

The script probes `/jo` without credentials, hashes `OS_PW` with md5 by default, supplies the required
date range for `/jl`, and removes credentials, controller identity, private endpoints, station/program
names, network octets, and activity timestamps before writing. It only **reads**
(`/jc /jo /jn /jp /jl /js`) — it never sends a change command. The capture must complete all six
endpoints and publishes them as one locked generation or exits non-zero without changing the prior
capture. Credentials are accepted only through `OS_PW`/`OS_PWHASH`, never process arguments.
`--out` may target an external directory or a versioned directory
below `test/fixtures/api/captured/`; it is rejected for the curated fixture corpus.

For firmware older than 2.1.3, verify the version independently and set its exact numeric value in
`OS_FWV` (for example, `OS_FWV=212`) before capturing. The tool aborts before sending `OS_PW` when an
old version is reported without that trusted pin, or when the pin and `/jo` disagree. `OS_PWHASH`
must be exactly 32 hexadecimal MD5 characters; it is never treated as a legacy plaintext password.

## Status / caveats

- The dashboard is **read-only by default**. Its typed command layer and verified transactions are
  test-proven, but the production entrypoint does not enable them because the required on-device
  proof is still outstanding. See [`docs/HARDWARE-VERIFICATION.md`](HARDWARE-VERIFICATION.md).
- The firmware-loaded **`home.js` bootstrap entry is produced** (`dist/home.js` → loads
  `assets/app.js`); the standalone `index.html` SPA also works for direct access (`?base=`).
- Auth: `ipas` devices skip login; others get the md5 password prompt (`www/src/auth/`).
  URL-supplied `pwhash` is scrubbed and does not bypass the prompt.
- Change commands POST on `fwv>=300` (body) and GET otherwise, injecting the `pw=` hash — matching
  the legacy `sendToOS` transport.

## Self-host with the companion (local database)

The **companion** (`server/`) serves the dashboard at `http://<host>:8080`, polls your controller into
a local SQLite database (`/data`), and adds a **History** tab. It is optional — the dashboard works
controller-direct without it. Config via `.env` (see `.env.example`). Spec:
`docs/superpowers/specs/2026-06-09-companion-local-db-v1.nlspec.md`.

**Run it — two ways:**
- **Build from source** (zero setup; the repo must be on the Docker host):
  `install -m 600 .env.example .env && edit .env && docker compose up --build -d`
- **Pull a published image** (no repo needed on the host): choose a released multi-arch image and
  its manifest digest from the protected publish job or Docker Hub. Add the immutable reference to
  the Compose project `.env`, for example:
  `COMPANION_IMAGE=kars85/opensprinkler-companion:companion-v0.1.2@sha256:<64-hex-manifest-digest>`.
  In `docker-compose.yml`, comment out `build:` and uncomment the `image: ${COMPANION_IMAGE:?...}`
  line. The version tag is readable; the digest fixes the exact bytes. Do not deploy `latest`, whose
  target can move and cannot identify a deterministic rollback.

### Published-image upgrade and rollback

Before an upgrade, back up the `/data` volume or bind mount and record the complete current
`COMPANION_IMAGE` value, including its digest. Then replace it with the new released tag and digest:

```bash
docker compose pull companion
docker compose up -d --no-deps companion
docker compose ps companion
docker compose logs --tail 100 companion
```

Verify the authenticated `/api/health` response and dashboard before discarding the database backup.
To roll back, restore the previously recorded `COMPANION_IMAGE` value and repeat the same `pull` and
`up` commands. The `osdata` volume remains attached; never use `docker compose down -v` during an
application rollback. Check the release notes before rolling an application back across a storage
schema migration.

For a direct source run, create a writable local data directory, export the `.env` values, override
the container-only database path, and run `DATABASE_PATH=./data/data.db npm run companion`.
`LISTEN_HOST` defaults to `127.0.0.1`; only the explicit loopback/wildcard literals `127.0.0.1`,
`0.0.0.0`, `::1`, and `::` are accepted. Controller fetches and response reads use
`CONTROLLER_TIMEOUT_MS` (default 10 seconds), and shutdown aborts an active poll before closing
SQLite. When using Compose with a per-service `env_file`, pass host-side interpolation values such
as `BIND_ADDRESS` and `HOST_PORT` in the shell/project `.env` or with `docker compose --env-file`.

**Network/auth boundary:** Compose publishes the container through `BIND_ADDRESS=127.0.0.1` by default
while the service listens on the container's internal wildcard address. For LAN access, set
`BIND_ADDRESS=0.0.0.0`, a random 16-512 character visible-ASCII `API_TOKEN`, and explicit comma-separated
`API_ALLOWED_ORIGINS`, and put the service behind an HTTPS reverse proxy. The dashboard refuses
bearer credentials unless both its own document and the companion endpoint use HTTPS (loopback and
packaged local-app origins are the only exceptions). Never add a token fragment to a dashboard loaded
from a controller's plaintext LAN origin: injected HTTP content could read it before scrubbing. Open a secure dashboard with
`#companion=https://companion.example/&companionToken=<token>`; the blocking bootstrap removes the
fragment before application/network requests and keeps the token only in session storage.

History endpoints return at most 5,000 rows per page plus an opaque `nextCursor`. The dashboard follows
that cursor over a fixed snapshot, so newly collected or backfilled rows cannot shift an in-progress
walk and cause duplicates or omissions.

The legacy map uses a browser-visible Google Maps JavaScript client key. Restrict its application use
to the exact HTTPS map origins and its API use to Maps JavaScript, Places, and the JavaScript Geocoding
service, set quotas, and rotate the long-public value if it has ever been unrestricted. Reverse
geocoding runs through `google.maps.Geocoder`; do not reuse this client key in a direct Maps web-service
URL. Packaged Cordova apps load the isolated map frame from the controlled HTTPS UI origin because
local/custom-scheme webviews commonly omit the referrer required by website restrictions. A browser
client key is public by design; restrictions, monitoring, and rotation—not source-code obfuscation—are
the security controls.

**linuxserver-style integration:** the image honors `PUID` / `PGID` (owner of the `/data` SQLite dir,
so bind mounts like `${DOCKERCONFDIR}/opensprinkler-companion:/data` just work) and `TZ` (host log
timestamps only — the dashboard always shows the controller's own local time). It starts as root, fixes
ownership, then drops to `PUID:PGID` (see `server/docker-entrypoint.sh`).

**Publish the image (maintainer):** the workflow `.github/workflows/companion-image.yml` builds each
amd64/arm64 artifact once, pushes it by digest, smoke-tests that exact registry digest, and only then
promotes the two tested digests into a multi-arch manifest on Docker Hub. Put `DOCKERHUB_USERNAME`
(e.g. `kars85`) and `DOCKERHUB_TOKEN` (a Docker Hub access token) in the protected
`companion-image-publish` environment, not in repository secrets. Then dispatch the workflow from
`master` for a mutable channel such as `edge`, or push a protected `companion-v*` Git tag whose commit
is already on `master`. Manual inputs cannot use the release-tag namespace or the automatically
managed `latest` alias, a new publication run cannot reuse an existing release tag, and off-master
tags fail before the publish job. If an immutable
release is created but a later `latest` update fails, rerun that same workflow run: the retry verifies
the release's originating workflow-run label, source SHA, and manifest digest, re-smoke-tests both
platforms, and resumes mutable-channel promotion without rebuilding or attempting to overwrite the
release tag. Immediately before any `latest` update, the job re-reads the protected remote `master`
tip and skips the alias if the validated source is no longer current.

## GitHub release protections (required repository setup)

The workflow checks are defense in depth; branch-selected workflow files can be edited, so the
credential boundary must also exist in GitHub settings:

1. Protect `master` with a ruleset that requires pull-request review and required CI checks, blocks
   force-push/deletion, and limits bypass to release administrators. Keep the repository's default
   Actions `GITHUB_TOKEN` permission read-only. Release store build numbers are derived from the
   first-parent revision of this protected history, so never rewrite it.
2. Create a `firebase-hosting` environment, allow deployments only from `master`, and require a
   maintainer review. Move `FIREBASE_SERVICE_ACCOUNT_OPENSPRINKLER_UI`, `CF_ZONE_ID`, and
   `CLOUDFLARE_API_KEY` into that environment; delete repository-scoped copies.
3. Create a `firebase-next-preview` environment with the same `master`-only/reviewer protection.
   Move `FIREBASE_SERVICE_ACCOUNT_NEXT` into it and delete any repository-scoped copy.
4. Create a `google-play-publish` environment. Under **Deployment branches and tags**, choose
   **Selected branches and tags** and allow only `master`. Require at least one release-maintainer
   reviewer and enable **Prevent self-review** where the repository plan supports it. Add
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, and
   `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` as environment secrets. Delete repository-scoped copies and,
   if any value comes from an organization secret, remove this repository from that secret's access.
5. Create an `app-store-publish` environment with the same `master`-only deployment policy,
   release-maintainer reviewer, and self-review prevention. Add `BUILD_CERTIFICATE_BASE64`,
   `P12_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`, `MACOS_BUILD_PROVISION_PROFILE_BASE64`,
   `IOS_EXPORT_PRODUCTION`, `MACOS_EXPORT_PRODUCTION`, `IOS_TEAM_ID`,
   `IOS_APPSTORE_API_PRIVATE_KEY`, `IOS_APPSTORE_API_KEY_ID`, and `IOS_APPSTORE_ISSUER_ID` as
   environment secrets. Delete repository-scoped copies and remove repository access to equivalent
   organization secrets.
6. Create a `companion-image-publish` environment, require a release-maintainer review, and allow
   only `master` plus `companion-v*` tags. Move `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` into it and
   delete repository-scoped copies.
7. In the Docker Hub `opensprinkler-companion` repository, open **Settings → General → Tag mutability
   settings**, choose **Specific tags are immutable**, and add the exact RE2 rule
   `^companion-v.*$` as the only rule. Keep moving channels such as `latest` and `edge` mutable. The
   publish workflow reads `immutable_tags_settings` from Docker Hub immediately before manifest
   promotion and fails closed unless only this exact rule is enabled; this account-level setting
   cannot be established by the repository workflow itself.
8. Add a GitHub tag ruleset for `companion-v*` that restricts tag creation, update, and deletion to release
   maintainers. A release tag must point to a commit already reachable from protected `master`.

Pull requests still run the complete Firebase build/test path, but no PR job receives a deployment
environment or deploy credentials. Manual Firebase and image publishing is accepted only from
`master`. Mobile release workflows also require a `master` push: Android validation produces an
unsigned bundle before `google-play-publish` releases signing credentials, while Apple validation
runs before any job enters `app-store-publish`. The Apple environment protects both signed package
creation and the iOS/macOS TestFlight uploads. Actionlint validates every workflow in the normal
unit-test workflow.

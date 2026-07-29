# Security maintenance

## Dependency policy

`npm run ci` fails on every dependency advisory, including development tools, starting at low
severity, and scans the repository for high-confidence credentials. Keep both checks enabled on
pull requests and before deployment.

Dependency lifecycle scripts are disabled in `.npmrc`. After a clean install, `npm run deps:rebuild`
executes only the reviewed hooks for `better-sqlite3`, `esbuild`, and optional macOS `fsevents`;
do not replace it with a broad script-enabled install in CI or container builds.

As of 2026-07-25, full `npm audit` and `npm audit --omit=dev` both report zero vulnerabilities. The
former Grunt/Karma paths were replaced by repository-owned build and Chromium harnesses. The three
remaining overrides are narrowly scoped: Mocha's browser-only distribution is exercised by the full
legacy browser regression suite; Cordova iOS's `ios-sim` retains its compatible `simctl` 2 API while that
package's vulnerable `shelljs` implementation is replaced by the compatible 0.10 line; and Cordova's
`xcode` helper receives `uuid` 11, whose CommonJS `v4()` path is covered by a contract test. The
simulator override is exercised against a fake `xcrun`, including its result shape and command APIs.
Do not add broad audit overrides or reintroduce an advisory as accepted development debt.

The legacy UI still requires jQuery Mobile 1.4.5, for which no patched upstream release exists. Its
navigation-time Ajax, hash listener, and cross-domain page loading paths are disabled before jQuery
Mobile initializes, and CI regression-tests those controls. The shipped jQuery and jQuery Migrate
files are compared byte-for-byte with their audited npm distributions.

## Credential response

The tracked tree and captured controller fixtures are scrubbed and CI checks new content. Removing a
secret from the current tree does not revoke it or remove it from Git history. Maintainers must rotate
any controller password or private API credential that was previously committed and decide separately
whether to rewrite Git history. History rewriting is disruptive and should be coordinated with every
clone and fork.

The Google Maps JavaScript key is a public client identifier, not a removable source secret. Keep it
dedicated to the map, restricted to the exact HTTPS map origins and required Maps JavaScript/Places/
JavaScript Geocoding services, quota-limited, monitored, and rotated if it was ever unrestricted. Never
reuse it in a direct Maps web-service URL; reverse geocoding uses the Maps JavaScript client service.

Companion API tokens belong in the URL fragment only for initial handoff. The bootstrap removes that
fragment before loading application code or making requests, and the client sends the token only in
the `Authorization` header. The client rejects bearer-authenticated plaintext companion URLs except
for loopback, and also rejects tokens when the dashboard document itself came from a plaintext
non-loopback origin. Terminate HTTPS at a trusted reverse proxy; never place a token fragment on a
controller page loaded over LAN HTTP because injected document code can read it before scrubbing.

The companion treats the unauthenticated `/jo` firmware version as insufficient authority to choose
legacy cleartext authentication. A password is sent to pre-2.1.3 firmware only when the operator has
verified and explicitly pinned the exact `CONTROLLER_FWV`; leave that variable unset for modern
controllers.

The live-fixture capture tool applies the same boundary: it probes `/jo` without credentials, hashes
`OS_PW` by default, and permits legacy cleartext only when the independently verified exact version is
pinned in `OS_FWV`. `OS_PWHASH` accepts only a 32-character hexadecimal MD5 value.

The companion sets a `0077` process umask and enforces `0600` on its SQLite database, WAL, and shared
memory files. Its first schema-v1 open securely deletes legacy raw controller response blobs; new
telemetry stores only explicitly allowlisted, non-secret compatibility metadata. Back up the data
volume before upgrading if the historical raw blobs were being used out of band.

## Release credential boundary

Deployment credentials are environment secrets, not repository secrets. Configure the protected
`firebase-hosting`, `firebase-next-preview`, `google-play-publish`, `app-store-publish`, and
`companion-image-publish` environments and the `companion-v*` tag ruleset exactly as listed in
`docs/DEPLOY.md`. Every environment must use an explicit branch/tag allowlist and a required
maintainer reviewer; both mobile environments allow only `master`, and self-review prevention should
be enabled where available.

Move all Android signing and publishing values (`ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`) into
`google-play-publish`. Move all Apple certificate, profile, export, team, and App Store API values
(`BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`,
`MACOS_BUILD_PROVISION_PROFILE_BASE64`, `IOS_EXPORT_PRODUCTION`, `MACOS_EXPORT_PRODUCTION`,
`IOS_TEAM_ID`, `IOS_APPSTORE_API_PRIVATE_KEY`, `IOS_APPSTORE_API_KEY_ID`,
`IOS_APPSTORE_ISSUER_ID`) into `app-store-publish`. Delete repository-scoped duplicates and remove
this repository from equivalent organization-secret access lists; otherwise a modified workflow can
bypass the environment boundary.

Pull requests and unprivileged jobs build or validate without release credentials. Secret-bearing
mobile signing and uploads run only after a protected `master` push enters the corresponding
environment. Keep default Actions token permissions read-only and protect `master`; workflow ref
checks are defense in depth, not a replacement for those GitHub settings.

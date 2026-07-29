# Phase-1 seam-spike demo harness

Eyeball the modernized **controller-status screen** in a browser — **no device required**.
It runs the real spike pipeline (seam → typed client → render) against a **mocked
`/jc` + `/jo` fixture**, and lets you toggle the LAN vs OTC access path to confirm they
render identically.

```bash
npm install      # if you haven't (pulls vite/vitest devDeps)
npm run deps:rebuild
npm run demo     # vite dev server — opens the page; renders the status screen
# or: npm run demo:build  (production bundle to demo/dist/, for a static preview)
```

Mocked data lives in `test/fixtures/api/`. Replace those with live device captures to
preview real controllers. This harness is isolated from the repository-owned firmware asset build
and Cordova mobile packaging tasks.

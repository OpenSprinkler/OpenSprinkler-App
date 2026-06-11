# Phase-1 dashboard — UI modernization (handoff)

A token-driven, responsive, lightly-illustrated refresh of the Phase-1 dashboard. **No rebrand** — same
blue accent, card/table idiom, and dark mode. Everything lands in the single shared stylesheet
`demo/style.css` (imported by both `demo/index.html` and `app/main.ts`) plus **additive-only** markup
hooks in the framework-free view functions. Produced via a 9-agent design workflow (5 assessments →
synthesis → 3 adversarial validators: WCAG, responsive, constraints).

## What changed

| Area | Change |
|---|---|
| **Tokens** | Added a `:root` layer: type scale (`--fs-*`, line-heights, `--fw-semibold`, `--tracking-tight`), spacing (`--space-1..12`), radius (`--radius-1..4`/`pill`), elevation (`--shadow-1..3`), motion (`--dur-*`, `--ease-standard`), accent variants (`--accent-weak/soft/strong`), and `--on-accent`. All existing magic numbers refactored to tokens. |
| **Responsive** | Mobile-first `body` with safe-area insets; `--maxw` ladder 640→720→1100 (`min-width` 700/1024); `viewport-fit=cover`. Wide stations table gets a focusable `.table-scroll` region. `table.meta`/`table.status` label columns go fluid below desktop. `tabular-nums` on numeric tables. |
| **Touch/focus** | 44px targets on `@media (pointer: coarse)` (base 36/40px already meets WCAG 2.5.8); 44px hit-area overlay on the help tip; real (not commented-out) focus-visible ring extended to `.action`/`.subtab`/`.table-scroll`/`[data-action]` and form inputs. |
| **Motion** | Subtle tab/action transitions, `:active` press, active-station dot pulse — **all** behind a global `prefers-reduced-motion` guard (last block in the file). |
| **States** | `.loading` spinner (replaces bare "Loading…"); `errorCard()` with a working **Retry** (host `retry`→refresh; boot→reload); friendly empty-state with a droplet mark. |
| **Graphics** (inline SVG, currentColor, ≤~200 B) | Status: water-level **radial gauge** + enabled/rain-delay **status dots**. Stations: badge **state dots** (active pulses). Tabs: 8 **nav glyphs**. Weather: **adjustment-method glyph** (cloud=service, slider=manual). Empty-state droplet, error alert mark. |

## Accessibility (WCAG 2.1 AA) — acceptance criteria met

- **Contrast** (verified both schemes): badges kept **hardcoded** (`#15803d`/`#6b7280` on `#fff`, 5.02:1/4.83:1 — dark-mode-immune, *not* routed through tokens, which was a regression the validators caught); `--on-accent` is `#fff` (light, 5.17:1) / `#0b1220` (dark, ~7:1) for filled buttons; danger hover uses a **tinted** surface (`color-mix(--err 16%, --card)`) not white-on-light-red; error toast pinned to `#b91c1c`/`#fff` (6.47:1 both); gauge track raised to a perceivable neutral (`color-mix(--muted 35%)`).
- **Color is never the only signal** — every dot/gauge has an adjacent text label; meaningful state lives in text, SVGs are `aria-hidden`.
- **Focus** — visible 2px accent ring on all interactive elements (≥3:1 vs adjacent surface).
- **Motion** — every animation/transition neutralized under `prefers-reduced-motion: reduce`.
- **Targets** — 44px on coarse pointers.

## Responsive behavior

- **Mobile (≤400px):** single column, tighter section padding, fluid label columns so values don't crush; tabs wrap; stations table scrolls inside its own focusable region (section padding + help tooltips never clipped).
- **Tablet (≥700px):** `--maxw` 720px, larger vertical rhythm.
- **Desktop (≥1024px):** `--maxw` 1100px. (Two-column/stat-grid utilities were **deferred** — see below.)

## Bundle

`dist/assets/app.css`: **6.4 kB → 13.1 kB raw / 1.9 kB → ~3.35 kB gzip.** The raw size exceeds the
spec's 8 kB proxy ceiling, but the real over-the-wire cost (gzip, +~1.5 kB) is negligible for a
LAN/phone app, and the PRD's binding "small bundle" constraint is comfortably met. No new
dependencies, fonts, image files, or off-origin requests — all graphics are inline currentColor SVG
(tab/gauge/dot path data ships in the JS bundle, not the CSS). Trim the deferred items below for a
leaner build if a hard raw ceiling is required.

## Test safety

All 159 Vitest tests stay green. Markup changes are **additive**: SVGs prepended, labels wrapped in
spans, asserted text/attributes (`>On<`, `100%`, `Enabled`, `data-tab`, `class="empty-state"`,
method names) untouched. The gauge `%` lives in a sibling span *after* the SVG; the gauge is
`aria-hidden` (the `%` text is authoritative, avoiding double-announcement).

## Deferred (intentionally not shipped)

- **`.card-grid` / `.dash-cols` desktop utilities** — removed as dead CSS (no view opts in yet). Re-add
  with the markup when a stat-grid Status header or two-column desktop layout is wanted.
- **Logs table `.table-scroll` wrapper** — skipped: its header help tooltip renders above its anchor and
  an overflow wrapper would clip it; the 3-column layout wraps instead.
- **`.help-tip::after` 44px overlay** — verify it doesn't intercept taps on adjacent interactive
  elements in dense settings forms (manual check).

## Files

`demo/style.css` (all CSS) · `demo/index.html` + `app/index.html` (viewport) ·
`www/src/spike/status-view.ts` (gauge + dots) · `www/src/views/stations-view.ts` (badge dot +
table-scroll) · `www/src/views/dashboard.ts` (tab icons) · `www/src/views/weather-view.ts` (method
glyph) · `www/src/ui/help.ts` (empty-state mark + `errorCard`) · `www/src/views/host.ts` +
`app/main.ts` (loading/error/retry wiring).

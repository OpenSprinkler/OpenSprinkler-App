---
name: OpenSprinkler (fork)
description: A framework-free LAN irrigation panel — legible in direct sun, honest about state.
colors:
  clear-sky-blue: "#2563eb"
  clear-sky-blue-dark: "#60a5fa"
  ink: "#0f172a"
  ink-dark: "#e6eaff"
  slate-muted: "#586380"
  slate-muted-dark: "#a3acc7"
  panel-white: "#ffffff"
  panel-white-dark: "#0f172a"
  cool-paper: "#f6f7fb"
  cool-paper-dark: "#0b1220"
  hairline: "#cdd5e0"
  hairline-dark: "#334155"
  on-accent: "#ffffff"
  on-accent-dark: "#0b1220"
  fault-red: "#b91c1c"
  fault-red-dark: "#f87171"
  running-green: "#15803d"
  running-green-dark: "#4ade80"
  badge-off-gray: "#6b7280"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  data:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tabular-nums"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  radius-focus: "3px"
  radius-1: "4px"
  radius-2: "6px"
  radius-3: "8px"
  radius-4: "10px"
  radius-pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
  space-12: "48px"
components:
  action:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.radius-2}"
    padding: "8px 12px"
    height: "36px"
  action-primary:
    backgroundColor: "{colors.clear-sky-blue}"
    textColor: "{colors.on-accent}"
    typography: "{typography.data}"
    rounded: "{rounded.radius-2}"
    padding: "8px 12px"
    height: "36px"
  action-primary-hover:
    backgroundColor: "#1f56d3"
    textColor: "{colors.on-accent}"
  action-danger:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.fault-red}"
    rounded: "{rounded.radius-2}"
    padding: "8px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius-4}"
    padding: "20px 24px"
  program-card:
    backgroundColor: "#f0f4fe"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius-4}"
    padding: "12px 16px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.radius-1}"
    padding: "9px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.slate-muted}"
    typography: "{typography.body}"
    padding: "9px 16px"
    height: "40px"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
  badge-on:
    backgroundColor: "{colors.running-green}"
    textColor: "#ffffff"
    typography: "{typography.caption}"
    rounded: "{rounded.radius-pill}"
    padding: "2px 8px"
  badge-off:
    backgroundColor: "#6b7280"
    textColor: "#ffffff"
    typography: "{typography.caption}"
    rounded: "{rounded.radius-pill}"
    padding: "2px 8px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cool-paper}"
    typography: "{typography.data}"
    rounded: "{rounded.radius-3}"
    padding: "12px 16px"
---

# Design System: OpenSprinkler (fork)

## 1. Overview

**Creative North Star: "The Utility Panel"**

This is a well-made household instrument, not an app experience. It lives on a phone held at arm's length in direct sunlight next to an open valve box, and it lives in a desktop tab during a seasonal schedule rework. Both times its job is identical: report what is true, and never look like it is performing. The system is a native-font, framework-free, single-stylesheet panel where a border does the work a shadow would do elsewhere and a word does the work an icon would do elsewhere.

Every visual decision descends from one constraint and one duty. The constraint: the bundle is served off the controller's own LAN flash, so there is no web font, no raster asset, no off-origin request, and no icon package — graphics are inline `currentColor` SVG or they do not exist. The duty: the panel must never look more certain than it is. Stale data, estimated runs, and skipped weather all get visible, textual treatment, because a confident-looking screen that is lying is the worst outcome this product can produce.

It explicitly rejects the four things named in PRODUCT.md. It is not the **legacy jQuery Mobile app** — no gradient chrome, no blue toolbar, no chevron list rows. It is not a **firmware/engineer dashboard** — no hex, no packed flags, no diagnostic table as the front door. It is not a **Rachio/Rain Bird consumer app** — no mascot, no illustration, no marketing surface inside the product. It is not **generic SaaS** — no repeated icon+heading+text card grid, no hero metric tile, no gradient accent anywhere.

**Key Characteristics:**
- Native system font stack; zero downloaded fonts, zero icon fonts.
- One accent, used rarely: active tab, focus ring, primary button, gauge fill.
- Bordered flat surfaces; shadows only for things that genuinely overlay.
- Tabular numerals on every duration, percentage, and timestamp.
- Light and dark ship together; neither is an inversion of the other.
- 44px targets on coarse pointers; visible focus on everything that resets its own chrome.
- Motion is functional and globally revocable under `prefers-reduced-motion`.

## 2. Colors

A cool, low-chroma panel palette: near-neutral surfaces, one blue that means "here", one red that means "danger", one green that means "running", and nothing else.

### Primary
- **Clear-Sky Blue** (`#2563eb` light / `#60a5fa` dark): the single accent. It marks the active tab's underline, the focus ring, the primary button fill, the gauge fill, the help glyph, and the informational tint. It is deliberately not "irrigation blue as decoration" — it appears where the user's attention or the user's next action lives, and nowhere else. Its tonal variants are derived, not hand-picked, so dark mode inherits automatically: `--accent-weak` (12% over transparent) tints info banners, `--accent-soft` (8% over card) is the program card ground, `--accent-strong` (accent + 8% black) is the primary-button hover.

### Neutral
- **Cool Paper** (`#f6f7fb` light / `#0b1220` dark): the body ground the panel sits on.
- **Panel White** (`#ffffff` light / `#0f172a` dark): every card, section, form, and default button face.
- **Ink** (`#0f172a` light / `#e6eaff` dark): all body and heading text. It doubles as the fill for inverted surfaces — the help bubble and the toast are Ink-on-Paper reversed.
- **Slate Muted** (`#586380` light / `#a3acc7` dark): secondary text only — table row headers, field labels, inactive tabs, captions. Never body copy, never a value the user needs to read at a glance.
- **Hairline** (`#cdd5e0` light / `#334155` dark): every border and divider. This is the system's structural element; it does the job elevation does elsewhere.

### Tertiary (status marks)
- **Fault Red** (`#b91c1c` light / `#f87171` dark): actual failure and actual danger. Error card, error text, destructive button outline. Not "warning", not "attention".
- **Running Green** (`#15803d` light / `#4ade80` dark): the live-state dot only. Badge fills are hardcoded `#15803d` / `#6b7280` with white text so they read identically in both schemes — a badge is a meaning-bearing mark and must not drift with the theme.
- **Badge-Off Gray** (`#6b7280`): the `.badge.off` fill, hardcoded alongside Running Green for the same theme-immunity reason. White on it measures 4.83:1 — passing AA at 12px/600 with no margin to spare, so it is a floor, not a starting point. Do not darken the text or lighten the fill.

### Named Rules

**The One Voice Rule.** Clear-Sky Blue is the only accent and appears on well under 10% of any screen. If two things on a screen are blue, one of them is wrong. There is no secondary accent, and adding one is prohibited.

**The Sunlight Floor Rule.** Body text is Ink, never Slate Muted. This panel is read outdoors; PRODUCT.md sets outdoor sunlight readability above the AA minimum. Muted-gray body copy on a tinted near-white is a bug in this project, not a style. Slate Muted is for labels the eye skips, never for the answer the user came for.

**The Meaning-Bearing Mark Rule.** Any color that carries meaning — running, skipped, stale, fault — is accompanied by text or shape and holds ≥3:1 against its surface. Color alone is never the signal, in either scheme.

**The Derived Variant Rule.** Accent variants are produced with `color-mix` off `--accent`, never hardcoded. Dark mode redefines one token and the whole tonal family follows. Hand-picking a dark-mode accent tint is prohibited.

## 3. Typography

**Display / Body / Label Font:** the native system stack (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Helvetica`, `Arial`, sans-serif).

**Character:** one family, six roles, separated by weight and size rather than by typeface. The panel reads like the operating system it runs inside, because that is the cheapest possible bundle and the most legible possible default at 320px in sunlight. There is no display face and no pairing to get wrong.

### Hierarchy
- **Display** (600, 22px, 1.2, -0.01em): the view's `h1`. One per screen.
- **Headline** (600, 18px, 1.35, -0.01em): section `h2` and the login card title.
- **Title** (600, 16px, 1.35): the program card's `h3` — the name of one saved rule.
- **Body** (400, 16px, 1.5): all prose and all values. Capped at `--measure` (60ch) for info notes, empty states, and help bubbles.
- **Label** (600, 14px, 1.5, Slate Muted): field labels, table row headers, `fieldset` legends (13px).
- **Data** (400, 14px, 1.5, `tabular-nums`): durations, percentages, timestamps, zone counts.
- **Caption** (600, 12px, 1.35): badges and help bubbles.

### Named Rules

**The Tabular Numeral Rule.** Every number that can change while the user watches — remaining time, water level, log times, zone durations — is `font-variant-numeric: tabular-nums`. Digits must not reflow the row on a poll tick.

**The Firmware Vocabulary Ban.** `fwv`, `fwm`, `fwf`, `uwt`, `wl`, `wto`, `pid`, `sid`, `OTF`, and `rawData` never appear in rendered type outside `Settings → System`. This is a typographic rule because it is enforced at the moment copy is written, not at review.

**The No Kicker Rule.** No tiny uppercase tracked eyebrow above sections, and no `01 / 02 / 03` section numbering. The stepper's own step count is the sole exception — it is a real sequence carrying real information.

## 4. Elevation

Flat by default. Depth is carried by a 1px Hairline border and by tonal ground (`--card` over `--bg`, `--accent-soft` for the program card), not by lift. A card in this system sits on the page; it does not hover above it. `--shadow-1` is applied to sections and the login form as barely-there seating, not as hierarchy — it is the visual equivalent of the card being a physical object rather than a printed region.

Shadow rank does not encode importance. It encodes literal overlay: if an element covers other content, it gets a real shadow; if it does not, it gets a border.

### Shadow Vocabulary
- **Seated** (`box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 2px 8px rgba(15,23,42,.06)`): sections, cards, the login form. The default and, for in-flow content, the only one.
- **Floating** (`box-shadow: 0 4px 16px rgba(15,23,42,.10)`): the help bubble. Something that opened over the page.
- **Overlay** (`box-shadow: 0 8px 24px rgba(15,23,42,.18)`): the toast, and any future `<dialog>`. Something above everything.

### Named Rules

**The Overlay-Only Rule.** `--shadow-2` and `--shadow-3` are reserved for elements that literally cover other content. Applying them to a card, a row, or a button to signal importance is forbidden.

**The Border-First Rule.** When a surface needs separating from its neighbor, add a Hairline border. Do not reach for a shadow, and do not reach for a second background tint.

**The 2014 Test.** If a surface looks lifted from the page at rest, the shadow is too dark and the blur is too small. Seated means you have to look for it.

## 5. Components

Restrained and legible; the consequence carries the weight. A button in this system persuades with its label ("Run Front Lawn now? Valves may open for about 18 minutes."), never with its fill. Default is neutral. Accent is the one primary path. Fault Red is real danger only.

### Buttons
- **Shape:** softly squared (`--radius-2`, 6px). Minimum height 36px on fine pointers, 44px under `(pointer: coarse)`.
- **Default (`.action`):** Panel White face, Hairline border, Ink label, 13px. This is most buttons. Hover shifts the border to Clear-Sky Blue; `:active` nudges 1px down. Disabled drops to 55% opacity with `not-allowed`.
- **Primary (`.action.primary`):** Clear-Sky Blue fill, `--on-accent` label (verified 5.17:1 light, ~7:1 dark). One per view — the single path the user most likely wants. Hover goes to `--accent-strong`.
- **Danger (`.action.danger`):** Fault Red border and label on a Panel White face; hover fills with a 16% Fault Red mix. Never a solid red fill at rest — a destructive action should look serious, not urgent.
- **Focus:** `outline: 2px solid var(--accent)` at 2px offset on every control that resets its own border or background. Non-negotiable (WCAG 2.4.7). The ring carries its own `3px` radius (`radius-focus`) rather than a scale step — it traces an *outline* offset outside the element, not the element's own corner, so it is deliberately not `--radius-1`.
- **Bar (`.action-bar`):** flex, `--space-2` gap, wraps. Never a horizontally scrolling row of actions.

### Cards / Containers
- **Section (`#app section`):** Panel White, Hairline border, `--radius-4` (10px), `--space-5 --space-6` padding, Seated shadow, `--space-4` bottom margin. Padding tightens to `--space-4 --space-3` below 400px.
- **Program card (`article.program`):** the signature surface. Hairline border, `--radius-4`, `--accent-soft` ground (8% accent over card) — the tint that says "this is a saved rule", not a chrome flourish. Header is a wrapping flex row: name `h3` left, badges right.
- **Nesting is forbidden.** A program card inside a section is the maximum depth. A card inside a card never ships.

### Inputs / Fields
- **Style:** transparent face, Hairline border, `--radius-1` (4px), `color: inherit`, 9px padding, 15–16px text. Transparent means the field inherits the card ground and stays correct in both schemes for free.
- **Focus:** `outline: 2px solid var(--accent)` at 1px offset **and** the border shifts to accent. Belt and braces, because the fields sit on tinted grounds.
- **Field label:** Label role (600/14px, Slate Muted), stacked above with `--space-1`. Checkboxes flip to a row with the label inline.
- **Fieldset:** Hairline border, `--radius-3`, legend in 13px Slate Muted semibold — how a settings group announces itself without a heading.
- **Body text stays 16px** in inputs, so iOS never zooms on focus.

### Navigation
- **Tabs (`nav.tabs` / `.tab`):** a Hairline-bottomed flex row. Inactive is Slate Muted with a transparent 2px bottom border; hover goes Ink; active is Ink + semibold + a 2px Clear-Sky Blue underline. Three signals — color, weight, and shape — because color alone would fail the meaning-bearing rule.
- **Subtabs (`.subtab`):** the same grammar at 14px/36px inside Settings.
- **Icons are supplementary** (`.i-tab`, 16px, inline `currentColor` SVG). Labels always remain visible; an icon never replaces a word.
- **Mobile:** below 700px the tab row becomes a safe-area-aware bottom bar with labels intact (per UX-SPEC §4.2). One semantic `<nav>`, one link set; CSS moves it.

### Badges
- **Style:** pill (`--radius-pill`), 12px semibold, `--space-2` horizontal padding, optional 8px dot.
- **`.on`** is a hardcoded `#15803d` fill with white text (5.02:1 in both schemes). **`.off`** is `#6b7280`/white. **`.spec`** is an accent-outlined ghost. Badge fills are theme-immune by design — a running zone must not change meaning when the OS flips to dark.
- **Live state:** `.badge.on .i-dot.live` pulses (`dot-pulse`, 1.8s). The pulse is decoration; the badge text and the adjacent remaining time carry the state.

### Status graphics
- **Gauge (`.i-gauge`, 30px):** inline SVG arc, `--gauge-track` unfilled, Clear-Sky Blue fill, `stroke-dashoffset` transitioned over `--dur-slow`. Always paired with its numeric value; the arc is never the only reading.
- **Dot (`.i-dot`, 11px):** Running Green when live, Slate Muted when off. Always adjacent to a word.
- **All graphics are inline `currentColor` SVG.** Raster assets, icon fonts, and off-origin images are prohibited by the LAN bundle constraint.

### Feedback
- **Toast (`.toast`):** fixed, bottom-centered above `env(safe-area-inset-bottom)`, Ink ground with Paper text, Overlay shadow, `--radius-3`, capped at `min(90vw, --maxw)`, fades over `--dur-base`. Error variant is a fixed `#b91c1c`/white (6.47:1, both schemes). A toast is confirmation of a verified result — never the sole location of an error.
- **Error card (`.error-card`):** 10% Fault Red over card, a 45%-Fault-Red-mixed border, `--radius-4`. Title row is Fault Red semibold; detail is Slate Muted 14px `pre-wrap`. It states scope ("Weather service unavailable" ≠ "Controller offline") and never leaks a hash, token, key, or full query URL.
- **Loading (`.loading` / `.spinner`):** an 18px accent-topped ring on `--gauge-track` beside Slate Muted text. Used for first bootstrap only; a refresh keeps the last good snapshot on screen and shows an "Updating" label instead.
- **Empty state (`.empty-state`):** an accent `.i-empty` glyph at 55% opacity beside `--measure`-capped text. A sentence and a task CTA. No illustration.

### Help tip (signature component)
`.help-tip` is the panel's answer to progressive disclosure: a small accent glyph whose bubble opens on **hover, focus, and tap** (WCAG 1.4.13). A `::after` pseudo-element gives it an invisible 44px hit area centered on the glyph, so a 13px mark stays touchable without occupying 44px of layout. The bubble is inverted (Ink ground, Paper text), 12px, capped at 240px, Floating shadow, `z-index: 10`.

**This is the pattern for every "why?" in the product.** Weather reasons, estimated-run caveats, and firmware caveats attach here rather than expanding the default screen.

## 6. Do's and Don'ts

### Do:
- **Do** put body text in Ink (`#0f172a` / `#e6eaff`). Slate Muted is for labels only. The panel is read in direct sunlight — clear PRODUCT.md's outdoor readability bar, not just AA's 4.5:1.
- **Do** compose from the existing tokens. Add a token only when it appears in at least two shipped components (UX-SPEC §14); otherwise compose.
- **Do** derive accent variants with `color-mix(in oklab, var(--accent) …)` so dark mode inherits from one redefinition.
- **Do** hardcode meaning-bearing badge fills (`#15803d`, `#6b7280`, `#b91c1c`) with white text. Theme-immunity beats token purity for marks that carry state.
- **Do** use `font-variant-numeric: tabular-nums` on every duration, percentage, and timestamp.
- **Do** use native `<input type="time">`, `<input type="date">`, checkboxes, selects, and `<dialog>`. No picker library, no modal library.
- **Do** keep every graphic inline `currentColor` SVG.
- **Do** give visible focus (`outline: 2px solid var(--accent)`) to anything that resets its own border or background.
- **Do** hit 44px under `(pointer: coarse)` — with an invisible `::after` hit area when the visible mark must stay small.
- **Do** keep the reduced-motion guard the **last block** in the stylesheet, and keep it universal.
- **Do** cap prose at `--measure` (60ch) on info notes, empty states, and help bubbles.
- **Do** wrap only the table in `.table-scroll`, never the section — section padding and help bubbles must never be clipped.
- **Do** state consequence in the label: "Run Front Lawn now? Valves may open for about 18 minutes."

### Don't:
- **Don't** ship anything that resembles the **legacy jQuery Mobile app**: no gradient chrome, no blue toolbar, no chevron list rows, no 2013 mobile-web texture.
- **Don't** ship a **firmware/engineer dashboard**: no hex, no packed flags, no raw object dump, no dense diagnostic table as a default screen. Diagnostics lives at `Settings → System → Diagnostics` and never returns to top-level nav.
- **Don't** ship a **Rachio / Rain Bird consumer app**: no mascot, no playful blob, no illustration, no marketing copy or upsell inside the product.
- **Don't** ship **generic SaaS card grids**: no repeated icon+heading+text cards, no hero metric tile, no gradient accent.
- **Don't** use gradient text (`background-clip: text`), glassmorphism, or any decorative blur. This panel has none and gets none.
- **Don't** use `border-left`/`border-right` greater than 1px as a colored stripe on a card, row, or callout. Full Hairline borders or `--accent-soft` ground.
- **Don't** nest a card inside a card.
- **Don't** introduce a second accent, a new palette, a logo, a downloaded font, or a raster asset. UX-SPEC §14: no rebrand.
- **Don't** add a warning color. Text and icon labels carry warning; `--err` is for actual failure and danger only.
- **Don't** use `--shadow-2`/`--shadow-3` on anything that isn't literally overlaying other content.
- **Don't** make color the only signal for running, skipped, stale, or error.
- **Don't** make hover the only path to an action, and don't ship swipe-to-delete, long-press-only, or drag-only reorder.
- **Don't** let the pulse (or any animation) be the sole carrier of state — adjacent text always says it.
- **Don't** drop input font-size below 16px; iOS will zoom the viewport on focus.
- **Don't** replace a good snapshot with a full-screen spinner during a refresh.
- **Don't** put a firmware token (`fwv`, `wl`, `uwt`, `pid`, `sid`, `OTF`, `rawData`) in rendered copy outside `Settings → System`.
- **Don't** add an off-origin font, image, or script request. The bundle is served from controller flash on a LAN with no internet.

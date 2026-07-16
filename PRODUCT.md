# Product

## Register

product

## Users

Homeowners with an OpenSprinkler controller on their LAN, plus a smaller set of installers and tinkerers. They are not irrigation experts and not firmware readers. Typical context: standing in the yard on an iPhone next to a valve box in direct sunlight, or sitting at a desktop browser doing a seasonal schedule rework. Sessions are short and task-shaped — "why is it not watering", "skip today, it rained", "move the back lawn to 6am", "did zone 3 actually run last night".

The job: decide what waters and when, understand why weather changed or skipped it, and know whether the controller is reachable and safe to change right now — without learning firmware vocabulary.

Primary surface: the modernized TypeScript app (`app/` Vite entry rendering `www/src/views`). The legacy jQuery Mobile UI under `www/js` is not a design target.

## Product Purpose

A fork of the OpenSprinkler app that makes scheduling legible to a non-expert while staying honest about what the controller actually did. It ships as a LAN-served bundle injected into the firmware UI, so it is framework-free, byte-conscious, and offline-tolerant by construction.

Success: a homeowner creates and verifies a correct multi-zone weekly schedule on a phone without touching Diagnostics; a weather skip is explained in one sentence they believe; no mutation ever claims success it did not verify.

Reference specs: [`docs/UX-SPEC.md`](docs/UX-SPEC.md) owns IA, screens, states, and content rules. [`docs/PLATFORM-ROADMAP.md`](docs/PLATFORM-ROADMAP.md) owns phase order and feasibility. [`docs/firmware-contract.md`](docs/firmware-contract.md) owns the wire contract.

## Brand Personality

Friendly, forgiving, homeowner-first.

Voice speaks outcomes in plain English — "Every Monday, Wednesday, and Friday at 6:00 AM", "Watering skipped because a weather rule is active" — never "Weekly / fixed slot 1" or `wtrestr`. Warm but not chatty; it explains without performing. It assumes zero irrigation knowledge and zero tolerance for being lied to: when the app is guessing it says **Estimated**, when data is old it says stale, when something failed it names the scope ("Weather service unavailable" ≠ "Controller offline").

Forgiving means the interface protects the user from the controller and from themselves: new schedules save disabled, destructive actions name their target and consequence, drafts survive a dropped network, invalid input never coerces or gets sent.

Emotional goal: quiet confidence that the yard will do what the screen says.

## Anti-references

- **The legacy jQuery Mobile app.** Gradient chrome, blue toolbars, chevron list rows, 2013 mobile-web texture. The thing this fork exists to replace.
- **Firmware/engineer dashboards.** Raw flags, hex, packed option keys, dense diagnostic tables as the default screen. Diagnostics is a support tool nested under Settings → System, never the front door.
- **Rachio / Rain Bird consumer apps.** Mascot-y illustration, playful blobs, marketing copy inside the product, upsell surfaces.
- **Generic SaaS card grids.** Repeated icon+heading+text cards, hero metric tiles, gradient accents, dashboard-for-dashboard's-sake.

## Design Principles

1. **Plain language is the interface.** If a firmware concept leaks into default copy, the design failed. Outcome first, mechanism on request.
2. **Never claim what you did not verify.** Read back before announcing success; label projections Estimated; label old data stale. Freshness is part of correctness, not a nicety.
3. **Safe by default, destructive by consent.** New programs start disabled, stale or unreachable state disables writes, and every risky action names its target and its consequence with a safe default focus.
4. **Progressive disclosure over configurability.** Weekly days and Automatic weather are the front door; intervals, Zimmerman coefficients, provider keys, and network octets live under Advanced.
5. **Same task model everywhere, same weight everywhere.** Phone and desktop change layout, never terms, step order, validation, or results. Every path works by touch and by keyboard; no hover-only, swipe-only, or color-only meaning.
6. **The bundle is a constraint, not an excuse.** Framework-free rendering, native controls, inline `currentColor` SVG, no off-origin requests — and the result still has to feel crafted.

## Accessibility & Inclusion

- **WCAG 2.1 AA is the enforced floor**, not the aspiration: visible focus, text alternatives, live regions, logical focus order, keyboard-only completion of every flow.
- **Outdoor sunlight readability raises the contrast bar above AA minimum.** The phone is used in direct sun at the valve box. Body text targets meaningfully more than 4.5:1; muted-gray-on-tint is a bug here, not a style. Status marks and meaning-bearing graphics hold ≥3:1.
- **Color is never the only signal.** Running, skipped, stale, and error states carry text and shape as well.
- **44px minimum targets under `(pointer: coarse)`**; 36–40px compact controls only for fine pointers.
- **Reduced motion is honored globally.** The active-watering pulse is decoration; adjacent text always carries the state.
- **Dark mode is a first-class theme**, not an inversion — both schemes ship together.

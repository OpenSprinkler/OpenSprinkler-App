# OpenSprinkler fork UI/UX specification

> **Targets:** iPhone Safari and desktop browser · **Baseline:** WCAG 2.1 AA plus the project's outdoor-sunlight floor · **Design:** extend the existing token system; no rebrand · **Delivery and feasibility:** [`PLATFORM-ROADMAP.md`](PLATFORM-ROADMAP.md)
>
> This document owns target information architecture, screens, flows, states, responsive behavior, interaction, content, and accessibility. The roadmap owns phase order, contracts, firmware/weather feasibility, rollout, and risk gates. [`PRODUCT.md`](../PRODUCT.md), [`DESIGN.md`](../DESIGN.md), and [`DESIGN-HANDOFF.md`](DESIGN-HANDOFF.md) are supporting design inputs, not behavior or delivery authorities. Precedence is: verified source and the firmware API for current behavior; the roadmap for feasibility and sequence; this specification for target UX; supporting inputs only where consistent. In particular, their controller-flash/no-off-origin-script description and the handoff's three-missed-poll stale rule are not adopted: the firmware shell loads `<jsp>/home.js`, and controller staleness here is elapsed-time based (`OpenSprinkler-App/PRODUCT.md:17`; `OpenSprinkler-App/DESIGN.md:325`; `OpenSprinkler-App/docs/DESIGN-HANDOFF.md:25`; `OpenSprinkler-App/docs/DESIGN-HANDOFF.md:108`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1369-1385`).

## 1. UX goal

The UI must let a non-expert answer three questions quickly:

1. **What will water, and when?**
2. **Why did weather change or skip it?**
3. **Is the controller reachable and safe to change right now?**

Scheduling is the primary task. Firmware concepts such as packed flags, program IDs, four-slot start arrays, encoded durations, and option keys never appear in default UI copy. Weather must be automatic by default, explain its latest decision, and clearly separate current data from stale last-successful detail.

## 2. Design context and evidence

- The product register is homeowner-first and explicitly covers iPhone use in direct sunlight plus desktop schedule work; its success condition is a verified schedule and an honest weather explanation (`OpenSprinkler-App/PRODUCT.md:7-19`).
- The shipped visual system now separates normative tokens from product rules. It defines color, type, spacing, radius, shadow, motion, safe-area, touch, responsive steps, dark mode, and reduced motion; production imports it directly (`OpenSprinkler-App/www/src/ui/tokens.css:1-54`; `OpenSprinkler-App/www/src/ui/system.css:1-23`; `OpenSprinkler-App/www/src/ui/system.css:229-237`; `OpenSprinkler-App/app/main.ts:10`).
- Coarse-pointer targets are already 44 px, visible focus rings cover main controls, and current graphics use inline `currentColor` (`OpenSprinkler-App/www/src/ui/system.css:72-89`; `OpenSprinkler-App/www/src/ui/system.css:182-186`; `OpenSprinkler-App/www/src/ui/system.css:202-216`). Preserve those foundations.
- The current shell exposes seven tabs, which wrap on narrow screens; Diagnostics is top-level even though it is an occasional support task (`OpenSprinkler-App/www/src/views/dashboard.ts:18-23`; `OpenSprinkler-App/www/src/ui/system.css:61-70`).
- The current program editor exposes firmware-shaped choices and text-formatted dates/times, defaults a new program to enabled weekdays at 06:00, and has no existing-program edit flow (`OpenSprinkler-App/www/src/views/settings/program-edit.ts:44-81`; `OpenSprinkler-App/www/src/views/programs-view.ts:31-50`).
- The current Weather view reports method, water level, observations, and source but does not explain cause, freshness, restriction, error precedence, or latched detail (`OpenSprinkler-App/www/src/views/weather-view.ts:84-100`; `OpenSprinkler-Firmware/weather.cpp:65-149`).
- The current App uses request/response snapshots, and the device already supplies cheap station status plus broader controller state (`OpenSprinkler-App/www/src/views/host.ts:75-120`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1351`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1760-1785`). The target remains poll-only; no WebSocket is required.
- The design handoff records successful App/demo builds, 159 Vitest checks, and 3,319 gzipped CSS bytes, but no live browser automation; 320 px layout/focus remains an explicit validation debt (`OpenSprinkler-App/docs/DESIGN-HANDOFF.md:52-71`; `OpenSprinkler-App/docs/DESIGN-HANDOFF.md:168-175`).
- LAN bundle pressure remains binding. Use existing framework-free rendering, production CSS, native controls, inline SVG, and no off-origin font/image requests (`OpenSprinkler-App/PRODUCT.md:40-47`; `OpenSprinkler-App/www/src/ui/system.css:8-9`).

## 3. Experience principles

1. **Plain-language first.** Show “Every Monday, Wednesday, and Friday at 6:00 AM,” not “Weekly / fixed slot 1.”
2. **Safe by default.** A new program starts disabled; no mutation is optimistic; stale/unreachable state disables writes.
3. **Progressive disclosure.** Common weekly schedules and Automatic weather are first. Interval, monthly, sunrise offsets, Zimmerman coefficients, provider keys, and diagnostics live under Advanced.
4. **Explain before exposing knobs.** Weather leads with outcome and reason, then source/inputs, then advanced configuration.
5. **Freshness is part of correctness.** A prior weather reason or controller snapshot is labeled stale, never silently reused as current.
6. **No hidden destructive gestures.** Delete, enable, run-now, and network changes use visible controls and explicit confirmation.
7. **Same task model on phone and desktop.** Layout changes; terms, step order, validation, and results do not.
8. **Readable at the valve box.** Body copy and primary values use Ink, never muted text; status remains legible in direct sunlight as well as meeting WCAG 2.1 AA (`OpenSprinkler-App/DESIGN.md:180-192`; `OpenSprinkler-App/PRODUCT.md:49-55`).

## 4. Information architecture

### 4.1 Target navigation

| Target section | Contains | Current source |
|---|---|---|
| **Home** | Controller/connection summary, active watering, next estimated run, weather decision, Stop all, rain delay | Status plus selected Diagnostics fields (`OpenSprinkler-App/www/src/views/dashboard.ts:63-74`) |
| **Schedule** | Program list, create/edit/copy, run now, run once, enable/disable | Programs plus program editor (`OpenSprinkler-App/www/src/views/dashboard.ts:64-69`; `OpenSprinkler-App/www/src/views/settings/index.ts:25-35`) |
| **Zones** | Zone status, manual safe run/stop, zone names and attributes | Stations (`OpenSprinkler-App/www/src/views/dashboard.ts:63-65`; `OpenSprinkler-App/www/src/views/stations-view.ts:34-55`) |
| **Weather** | Current decision, why, freshness, source/fallback, Automatic/Manual/Advanced setup | Weather plus Weather settings (`OpenSprinkler-App/www/src/views/dashboard.ts:63-69`; `OpenSprinkler-App/www/src/views/settings/index.ts:25-35`) |
| **Activity** | Controller log and feature-detected companion history | Log plus optional History (`OpenSprinkler-App/www/src/views/dashboard.ts:52-70`) |
| **Settings** | General, Zones, Network, System, About; Diagnostics nests under System | Settings plus Diagnostics (`OpenSprinkler-App/www/src/views/dashboard.ts:63-70`; `OpenSprinkler-App/www/src/views/settings/index.ts:13-35`) |

“Programs” becomes “Schedule” in navigation; program remains the noun for one saved rule. “Stations” becomes “Zones” in user-facing copy. API/type names may remain unchanged internally.

### 4.2 Responsive navigation

- **Below 700 px:** a safe-area-aware bottom bar shows Home, Schedule, Zones, Weather, and More. More opens Activity and Settings. Labels remain visible; icons are supplementary. The active item is text, shape, and color—not color alone.
- **700 px and wider:** the same links render as a static top navigation row with Activity and Settings visible. One semantic `<nav>` and one link set should serve both layouts; CSS changes placement.
- Diagnostics never returns to top-level navigation. It is `Settings → System → Diagnostics`.
- Navigation stays usable without hover. Keyboard focus order follows the visual order; focus returns to the destination heading after navigation.

## 5. Global shell

### 5.1 Header

The header contains:

- Device name.
- Connection state: Connected, Updating, Stale, Offline, Controller unreachable, or Remote via OTC.
- Last successful controller update in relative time; exact device-local time is available on focus/tap.
- A persistent **Stop all** control only when any zone/queue is active. It uses the existing danger treatment and remains available before lower-priority content (`OpenSprinkler-App/www/src/ui/system.css:157-158`).

Do not show firmware version, IP, OTC token state, or weather provider in the primary header. Those belong in Settings/System.

### 5.2 Content frame

- Continue existing `--maxw` values: 640 px base, 720 px at 700 px, and 1100 px at 1024 px (`OpenSprinkler-App/www/src/ui/tokens.css:39-53`).
- Use one column below 700 px. At desktop width, allow a two-column Home layout and a Schedule list/editor split; do not create generic unused grid utilities.
- Preserve safe-area padding, dark mode, `--measure`, tabular numerals, and current card/table language (`OpenSprinkler-App/www/src/ui/system.css:13-38`; `OpenSprinkler-App/www/src/ui/system.css:100-143`).
- The shell retains the last successful snapshot during a transient refresh. It does not replace useful content with a full-screen spinner.

## 6. Home

### 6.1 Hierarchy

1. **Active watering** — current zones, remaining time, queue, Stop all.
2. **Next estimated watering** — program name, day/time, zones, base duration, weather-adjusted estimate.
3. **Weather decision** — current scale/skip, one-sentence reason, freshness, link to Weather.
4. **Controller state** — Enabled/Disabled, rain delay, sensor/restriction state.
5. **Quick actions** — Rain delay, Run once, Enable/Disable controller.

When nothing is active, the first card says “Nothing is watering now” and yields visual priority to the next scheduled program.

### 6.2 Safety

- Controller Enable uses a confirmation naming the next estimated program and warns that schedules resume immediately.
- Rain delay uses a validated duration and offers Cancel rain delay when active. Invalid input never maps to cancellation.
- Reboot is removed from Home and placed under `Settings → System → Advanced` with confirmation.
- Any next-run computation is labeled **Estimated** because the App does not own firmware scheduling truth.

## 7. Schedule

### 7.1 Schedule list

Each program summary shows, in this order:

- Name and Enabled/Disabled status.
- Natural-language cadence and start time, including odd/even-day and seasonal restrictions when present.
- Selected zones and base duration; collapse long zone lists after the first three.
- “Adjusted by weather” when its weather bit is on, plus the current scale only when fresh.
- Next estimated run or a short reason it has none: Disabled, no zones, no start time, outside seasonal dates, or controller disabled.

Primary row action is **Edit**. Secondary actions are Run now, Copy, Enable/Disable, and Delete. On iPhone they appear in a labeled action sheet opened by a visible More button; on desktop they remain visible or in the same menu. No swipe action.

Empty state: “No schedules yet” with a primary **Create schedule** button and secondary **Run once**.

### 7.2 Create/edit flow

Use four steps. On iPhone each step is a full-width page with sticky Back/Continue controls above the safe area. On desktop, keep the same steps in a single editor with a summary pane; do not fork the data model.

#### Step 1 — When

- Program name.
- Common choice first: **Days of the week** with seven real checkboxes.
- Start with one native `<input type="time">`; **Add another start time** exposes up to `/jp.mnst`, currently four (`OpenSprinkler-Firmware/program.h:28-30`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1153-1156`).
- Advanced frequency reveals Every N days, Monthly, One date, sunrise/sunset offsets, repeating starts, and optional seasonal date range.
- Use native date/time inputs; display locale formatting but encode only after validation.

Validation:

- Name is required after trimming and must encode to no more than `/jp.pnsize` UTF-8 bytes, currently 32; count bytes rather than JavaScript characters and verify the returned name (`OpenSprinkler-Firmware/program.h:28-30`; `OpenSprinkler-Firmware/program.h:100-106`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:951-960`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1153-1156`).
- At least one valid day/date rule and one valid start are required.
- No wrapping invalid clocks, impossible calendar dates, zero intervals, or duplicate starts.
- Sunrise/sunset offsets and repeating windows show their resolved local-time estimate for the next occurrence.

#### Step 2 — Zones and duration

- Show one row per enabled, non-master zone: checkbox, zone name, duration. Disabled zones and masters are grouped under Unavailable.
- Special zones remain selectable. Give them a **Special output** badge and explain that they may trigger RF, a remote controller, GPIO, HTTP, or HTTPS rather than a local valve (`OpenSprinkler-Firmware/OpenSprinkler.cpp:1882-1919`; `OpenSprinkler-Firmware/defines.h:75-82`).
- Selecting a zone focuses its duration. The default control is friendly hours/minutes, with seconds shown whenever the value is not minute-aligned. Offer explicit **Sunrise to sunset** and **Sunset to sunrise** choices for raw `65534` and `65535`.
- Retain every existing duration as its raw `uint16` word. An untouched value round-trips bit-for-bit; editing an unrelated field never rounds seconds or replaces a solar sentinel. The firmware rewrites every duration on `/cp`, and the existing decoder already recognizes second precision and both sentinels (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1023-1039`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1171-1180`; `OpenSprinkler-Firmware/utils.cpp:512-524`; `OpenSprinkler-App/www/src/api/decode.ts:48-77`).
- A user-explicit deselection encodes zero; a new zone has no hidden default duration.
- Provide **Apply duration to selected zones** as a small bulk action on desktop and phone.

Validation:

- At least one selectable zone has a nonzero valid duration.
- Accept exact seconds through `65533` plus the two named solar choices; never expose the sentinel numbers.
- Show base total run time and overlap/overnight warnings; warnings do not silently rewrite values.

#### Step 3 — Weather and limits

- **Adjust duration for weather** is the only default weather control. Its helper text shows the current fresh effect, for example “Currently 45%; a 10 minute zone would run about 4½ minutes.”
- If the latest Weather update failed or is stale, show the controller's currently returned effect and link to Weather details. Do not promise an immediate 100% fail-safe; automatic methods may retain their prior scale until firmware later returns 100% (`OpenSprinkler-Firmware/weather.cpp:65-85`; `OpenSprinkler-Firmware/main.cpp:1243-1255`).
- Day restrictions and seasonal date range appear only when relevant and supported.
- Advanced exposes only firmware-specific options already present in the decoded model; it never exposes raw flags (`OpenSprinkler-App/www/src/api/decode.ts:112-193`).

#### Step 4 — Review

Show a readable sentence including every active restriction, selected zones/durations, base total, current weather-adjusted estimate, and the next three **Estimated** occurrences. Show blocking issues first, warnings second.

New programs default to **Save disabled**. A separate “Turn on after saving” choice changes the final button to **Save and enable** and triggers a confirmation naming the first estimated run. Existing programs preserve their current enabled state unless the user changes it.

### 7.3 Save and conflict behavior

- Before editing, retain the source `/jp` tuple and decoded view.
- Immediately before save/toggle/delete/run, re-read `/jp`. If the target tuple or program order changed, stop and show: “This schedule changed on the controller. Review the latest version before saving.”
- Never identify a program by stale list position alone.
- Submit only after validation. Show Saving without hiding the review.
- Re-read `/jp` after success and compare the expected decoded result. Announce “Schedule saved” only after verification.
- Verification compares untouched raw duration words as well as the decoded display model.
- On network failure, retain the draft locally in memory and offer Retry; do not claim success.

### 7.4 Existing-program actions

- **Run now:** confirmation names the program, zones, base duration, current weather effect, and warns that valves or configured special outputs may activate even when normal scheduling is disabled.
- **Enable:** confirmation names the first estimated run. Disable does not require confirmation unless a run is active; then offer Stop now and disable, or disable future runs only.
- **Delete:** confirmation includes the program name and states that it cannot be undone from the controller. Default focus is Cancel.
- **Copy:** opens Step 1 with “Copy” appended, disabled by default.

### 7.5 Run once

Run once is a two-step lightweight flow: choose zones/durations, then Review and Run. It has no schedule/frequency controls. The final confirmation explicitly names the valves and configured external actions/outputs that may activate. The UI remains on an active-run view with Stop all available.

## 8. Weather

### 8.1 Decision model

The top card reports three independent dimensions; one error banner must not hide the other two:

1. **Configured mode** — Manual, ETo/Automatic, Zimmerman/Legacy, and so on, from `uwt`. Manual remains Manual even when `wterr != 0`.
2. **Effective controller action** — a weather-disabled program remains 100%; an active restriction makes a weather-enabled program 0%; otherwise show the current `wl` (or applicable historical `wls` scale). This is what firmware uses at runtime (`OpenSprinkler-Firmware/main.cpp:905-920`).
3. **Service health** — Current, Last update failed, Stale, Not yet updated, or Update pending from `wterr`, `lwc`, `lswc`, and controller time `devt`. A failure suppresses current causal detail but does not erase the effective percentage already held by the controller (`OpenSprinkler-Firmware/weather.cpp:40`; `OpenSprinkler-Firmware/weather.cpp:65-85`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1252`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1281-1304`).

Derive service health in this order, independently of controller polling:

1. `lwc == 0 && lswc == 0` → **Not yet updated**, regardless of the startup `wterr=-1` sentinel.
2. `lwc == 0 && lswc > 0` → **Update pending** after a settings/reset trigger; retain the prior success as historical detail.
3. `wterr != 0` → **Last update failed**, in Manual as well as automatic modes. If `lswc` is more than 24 hours old, label its separately presented detail **Stale last successful decision**.
4. `lswc == 0` or `devt - lswc > 86,400` seconds → **Stale**. This includes an aged Manual state whose success timestamp was cleared without resetting its manual scale.
5. Otherwise → **Current**.

The 24-hour boundary matches the firmware's successful-weather timeout. Use controller timestamps for the comparison and show **Controller clock needs review** instead of a negative age if `devt < lswc` (`OpenSprinkler-Firmware/main.cpp:97-98`; `OpenSprinkler-Firmware/main.cpp:1242-1255`; `OpenSprinkler-Firmware/OpenSprinkler.h:292-293`). `lwc` is the last attempt and `lswc` the last success; neither is the App's four-second poll timestamp. A Weather-setting change resets `lwc` and the error sentinel while leaving a prior `lswc`, which is why Update pending precedes error handling (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1252`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1712-1718`; `OpenSprinkler-Firmware/weather.cpp:64-72`).

`wtdata.skip`, human reason strings, and future stable codes explain a successful decision; they do not override `wtrestr`, `wl`, or `wls`. Never use a latched `wtdata` reason as the latest decision after an error (`OpenSprinkler-Firmware/weather.cpp:137-149`).

Examples:

- “Manual adjustment: 65%. The latest Weather update failed; weather-enabled schedules currently still use 65%.”
- “Weather update failed. Current controller effect: 45%. Details below are from the last successful update.”
- “Watering restricted: 0%. Last successful Weather update was 2 hours ago.”

### 8.2 Explanation content

For a current successful decision, the explanation follows this order:

- Stable machine reason/skip code, localized by the App.
- Decoded `skipReason`/`reason` when current and present.
- Generic flag-based copy such as “Skipped because a weather restriction is active” or “Using a backup weather provider.”
- Generic scale/source copy when detail was trimmed.

After `wterr != 0`, replace the current reason with scoped failure copy and place any prior reason under **Last successful decision** with its `lswc` timestamp.

Known legacy presentation strings decode `+` to space and `AMPERSAND` to `&` only in fields explicitly owned by the Weather contract. Never apply that replacement to arbitrary HTML or credentials.

### 8.3 Card anatomy

- Mode: Automatic, Manual, or named Advanced method.
- Effect: Restricted 0%, Adjusted to 45%, 100%, or Weather adjustment off for this schedule.
- Health: Current, Last update failed, Stale, Not yet updated, or Update pending under the derivation above.
- One-sentence current reason, or a scoped failure plus separately labeled last-successful reason.
- Freshness: Last checked and Last successful update.
- Source: local station/provider; “Backup source” when fallback served.
- Effect example: “A 10 minute weather-enabled zone runs about 4½ minutes.”
- **Why?** disclosure: method, relevant inputs, provider/fallback, restriction, and model detail.
- **Raw diagnostics** only under `Settings → System`; never dump the raw object on the default Weather screen.

If a program has weather disabled, its schedule summary says “Weather adjustment off for this schedule,” even while the global Weather card reports a scale.

### 8.4 Weather setup

Default choices:

- **Automatic (recommended):** ETo method `3`, location-derived baseline when the Weather service supports it, explicit stored baseline fallback otherwise.
- **Manual:** user-set watering percentage.
- **Advanced:** provider, personal weather station, API key, explicit ETo baseline/elevation, Zimmerman/legacy methods, and opt-in cloud fallback.

Automatic setup asks for location and, if needed, provider credentials. It does not ask for Zimmerman temperature/humidity/rain baselines. API keys use password-style inputs with Reveal and Clear actions; blank unchanged values do not overwrite stored keys.

Cloud fallback for a local station is off by default. Enabling it explains what data leaves the LAN and which provider will be used.

## 9. Zones, Activity, and Settings

### 9.1 Zones

- Mobile uses stacked zone rows; desktop may use the existing focusable table-scroll pattern (`OpenSprinkler-App/www/src/ui/system.css:103-113`).
- Active state always includes text and remaining time, not only a pulsing dot.
- Start requires a duration and confirmation; Stop is immediate. Disabled zones and masters explain why Start is unavailable. Special outputs remain runnable with a badge and consequence-specific copy such as “This may activate a configured external device or action.”
- Zone configuration sends only changed names/attributes and verifies readback.

### 9.2 Activity

- Merge device Log and optional companion History under one section with segmented controls.
- Use device-local time consistently. If timezone conversion cannot be verified, label the source time rather than silently show UTC/local mismatch (`OpenSprinkler-App/www/src/views/logs-view.ts:8-11`; `OpenSprinkler-App/www/src/views/logs-view.ts:28-32`).
- Empty: “No watering activity in this period.” Error retains the selected date range and offers Retry.

### 9.3 Settings

- Sections: General, Zones, Network, System, About. Weather owns all Weather setup under `Weather → Setup`; Settings may offer a deep link there but never a duplicate form or state owner.
- Network is Advanced and warns about loss of connectivity. Invalid octets/ports never coerce. Before applying a network change, show old → new values and require an acknowledged recovery path.
- System contains firmware/build identity, OTC state, Diagnostics, Reboot, UI source, and read-only Export. Whole-configuration Import is deferred to the frozen legacy UI until preview, version conversion, secret policy, and a hardware restore drill exist.
- `fwf` appears as build identity only. Unsupported/older controller messaging uses the capability policy from the roadmap, not parsed `fwf` build numbers.

## 10. State model

| State | Trigger | Presentation | Mutation policy | Recovery/accessibility |
|---|---|---|---|---|
| **Initial loading** | No successful bootstrap snapshot | Compact skeleton/status text; keep nav shell | Disabled | `role="status"`; no focus theft |
| **Refreshing** | Poll in flight with a valid snapshot | Keep content; subtle Updating label | Keep enabled only while snapshot is fresh | Announce only meaningful state changes |
| **Empty** | Valid response with no entities | Friendly explanation and task CTA | Relevant creation action enabled | Existing empty-state pattern |
| **Validation error** | Local invalid input | Inline message plus error summary linked to fields | No request sent | Focus summary, then first invalid field |
| **Section/API error** | Controller is reachable but a required endpoint fails, is malformed, or leaves a partial bootstrap | Retain the last verified snapshot; show a scoped message such as “Schedules unavailable” with sanitized Details | Disable mutations that depend on the failed/stale section; unrelated fresh controls keep their normal policy | Retry that section; focus/announce the error summary; never expose credentials or full request URLs |
| **Save in progress** | Mutation sent | Preserve form/review; button says Saving | Other mutations disabled | Polite live region |
| **Conflict** | Fresh-read tuple/state differs | Explain controller changed; Review latest / Keep draft | No overwrite | Focus conflict heading |
| **Offline** | Browser reports offline | Persistent banner; retain last snapshot/time | Disabled except local draft editing | Retry automatically on `online` |
| **Stale** | At least 12 seconds since the last successful controller response | “Last updated …”; stale badge/banner | Disabled | Manual Retry; content remains visible |
| **Controller unreachable** | No success for 30 seconds or terminal network error | Controller-specific error, base/path hint under Details | Disabled | Retry; link to recovery `/su` guidance |
| **Auth required/failed** | Numeric `221+` preflight followed by a `fwv`-only `/jo` or `/ja`, including wrong password | Login form; distinguish wrong password from network | Disabled | Focus password error; preserve device base |
| **Weather degraded** | Controller reachable and `wterr != 0`, or the §8.1 derivation returns Stale | Scoped service health plus current mode/effect; prior reason labeled last-successful and labeled stale only after the age threshold. Manual remains Manual. | Non-weather controls remain available | Retry is controller-driven; show `lwc`/`lswc` |
| **Unsupported controller** | Pre-auth `fwv` is nonnumeric/below `221`, or authenticated full options fail the `2214 + kars85.`/storage-epoch policy | Version/fork explanation and legacy/update route | Disabled | Never send cleartext auth; no repeated probes beyond manual Retry |
| **Success** | Post-write readback matches | Specific confirmation (“Schedule saved”) | Re-enabled | Polite live region; focus remains logical |

State ordering is mandatory: preserve the base → obtain `fwv` → preflight-reject nonnumeric/below-`221` versions without credentials → hash-authenticate plausible `221+` versions → apply the storage-epoch/`fwm`/`fwf` policy to the full response. A plausible-floor `fwv`-only response never becomes Unsupported, and the modern App never sends cleartext auth (`OpenSprinkler-Firmware/opensprinkler_server.cpp:388-422`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1122-1150`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:2449-2459`).

Error details must not expose password hashes, OTC tokens, API keys, or full query URLs.

## 11. Polling and freshness

- While visible: `/jc` every four seconds and `/js` when a cheaper station refresh is sufficient. Configuration/program/log data refreshes on section entry, after mutation, or every twenty seconds when relevant.
- On `document.hidden`, pause high-frequency polling. Refresh immediately when visible again.
- Backoff controller failures from 4 → 8 → 16 → 30 seconds. A successful response resets the interval.
- Mark Stale at 12 seconds elapsed since the last successful controller response, independent of backoff. Mark Controller unreachable at 30 seconds without success.
- Do not poll while a mutation verification read is in flight; serialize the write/readback sequence.
- Do not replace the whole view when a poll returns unchanged data; preserve focus, open disclosures, and in-memory drafts.
- Weather freshness is separate from controller freshness. Use `wterr`, `lwc`, and `lswc` for health while `wl`/`wls` continue to report controller effect; a fresh `/jc` can still report degraded Weather.
- No WebSockets, background push, or realtime animation.

## 12. Touch, pointer, keyboard, and motion

- Keep 44 px minimum targets under `(pointer: coarse)` and existing 36–40 px compact pointer controls (`OpenSprinkler-App/www/src/ui/system.css:145-149`; `OpenSprinkler-App/www/src/ui/system.css:182-186`).
- Hover may clarify but never reveal the only path to an action. Help bubbles open on tap and focus as well as hover.
- No swipe-to-delete, long-press-only action, drag-only reorder, or hover-only menu.
- Desktop supports pointer-efficient inline actions; mobile uses labeled menus/sheets. Both preserve the same confirmation rules.
- Use native `<input type="date">`, `<input type="time">`, checkboxes, selects, and `<dialog>` where supported, with a semantic fallback. Do not add a date-picker or modal library.
- Keep text/date/time/number inputs at least 16 px on iPhone so focus does not zoom the viewport (`OpenSprinkler-App/DESIGN.md:257-262`).
- Keyboard: logical document order, visible focus, Escape closes non-destructive overlays, dialogs trap focus and restore it, error summaries link to fields.
- Preserve the global reduced-motion guard. Active watering may use the existing subtle pulse only when motion is allowed and adjacent text carries the state (`OpenSprinkler-App/www/src/ui/system.css:126-127`; `OpenSprinkler-App/www/src/ui/system.css:229-237`).

## 13. Component specifications

| Component | Purpose and anatomy | Required states | Accessibility |
|---|---|---|---|
| **Connection banner** | State label, last success, Retry/Details | Updating, stale, offline, unreachable, remote | Status changes in a polite live region; errors not color-only |
| **Program summary card** | Name, enabled state, cadence, zones/duration, weather, estimated next run, actions | Enabled, disabled, invalid/no-run, stale weather | Heading per program; action labels include program name |
| **Schedule stepper** | Step title, fields, progress, Back/Continue | Default, invalid, saving, conflict | Ordered headings; progress text; no focus jump on validation |
| **Zone duration row** | Select, name/status/type, raw-preserving duration | Available, selected, disabled/master, special output, solar, error | Checkbox owns selection; label and error association; special state in text |
| **Weather decision card** | Mode, effect, health, reason, source, Why disclosure | Manual, normal, scaled, restricted, fallback, stale/degraded | Every dimension is text; disclosure is a button/`details` |
| **State panel** | Icon, title, concise detail, primary recovery | Loading, empty, error, unsupported | Decorative SVG hidden; title/detail authoritative |
| **Confirmation dialog** | Consequence, named target, Cancel, specific action | Run, enable, delete, network, reboot | Initial focus Cancel for destructive actions; restore focus |
| **Help tip** | Small glyph plus concise Why/caveat bubble | Closed, open by tap/focus/hover | Real button semantics, `aria-expanded`, 44 px coarse hit area; never `role="img"` |
| **Toast/live feedback** | Verified success or actionable error | Success, error | Success polite; error assertive; never sole error location |

## 14. Visual tokens and extension rules

For visual implementation only, the normative token contract is `www/src/ui/tokens.css`; shipped component rules consume it from `www/src/ui/system.css`. The demo imports that system and adds only harness chrome (`OpenSprinkler-App/www/src/ui/tokens.css:1-54`; `OpenSprinkler-App/www/src/ui/system.css:1-11`; `OpenSprinkler-App/demo/style.css:1-15`). Tokens cannot override the firmware API, roadmap gates, or behavior specified here.

Reuse:

- Colors: `--bg`, `--fg`, `--muted`, `--card`, `--border`, `--accent`, `--err`, `--on-accent`, `--ok`, and accent tonal variants.
- Type: `--fs-12` through `--fs-22`, existing line heights, `--fw-semibold`, and `--measure`.
- Spacing: `--space-1` through `--space-12`.
- Shape/elevation: `--radius-1` through `--radius-4`, `--radius-pill`, and `--shadow-1` through `--shadow-3`.
- Motion: `--dur-fast/base/slow` and `--ease-standard` under the existing reduced-motion override.

Rules:

- Do not introduce a new palette, logo, font, gradient language, or card style.
- Use at most one filled accent primary action per view; cards do not nest, and `--shadow-2`/`--shadow-3` remain overlay-only (`OpenSprinkler-App/DESIGN.md:221-255`).
- Use existing accent-soft treatment for informational/stale surfaces and `--err` only for actual failure/danger. Text and icon labels carry meaning; no new warning color is required.
- Body copy, remaining time, decision outcomes, and other task answers use `--fg`; reserve `--muted` for labels/captions under the Sunlight Floor Rule (`OpenSprinkler-App/DESIGN.md:180-192`).
- Continue inline `currentColor` SVG. No raster illustration or off-origin asset.
- Add a token only when it appears in at least two shipped components. Otherwise compose existing tokens.
- Reproduce the recorded 3,319-byte gzipped `dist/assets/app.css` baseline in clean CI; a >10% unexplained regression fails CI (`OpenSprinkler-App/docs/DESIGN-HANDOFF.md:52-62`).

## 15. Content rules

- Use **Schedule**, **Program**, **Zone**, **Weather adjustment**, **Rain delay**, **Controller**, and **Last updated** consistently.
- Avoid `fwv`, `fwm`, `fwf`, `uwt`, `wl`, `wto`, `pid`, `sid`, `OTF`, and `rawData` outside System/Diagnostics.
- Outcome first: “Watering skipped” before “Restriction bit active.”
- State the consequence of actions: “Run Front Lawn now? Valves may open for about 18 minutes.”
- Say **Estimated** wherever the App projects future firmware behavior.
- Errors identify scope: “Weather service unavailable” is not “Controller offline.”
- Generic explanations must remain correct when Weather trims text: “A weather rule skipped watering” is preferable to guessing rain.

## 16. Data-to-UX contract

| UX need | Existing source | Rule |
|---|---|---|
| Controller/connection/runtime | `/jc`, `/js` (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1351`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1760-1785`) | Poll; distinguish transport freshness from Weather freshness. |
| Weather mode/effect | `/jo.uwt`, `/jo.wl`, `/jc.wls`, program weather bit (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1044-1126`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:1281-1304`; `OpenSprinkler-Firmware/main.cpp:905-920`) | Show only after successful auth; separate configured mode from effective percentage. |
| Weather reason/health | `/jc.wterr`, `wtrestr`, `wtdata`, `lwc`, `lswc` (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1234-1351`; `OpenSprinkler-Firmware/weather.cpp:65-149`) | Error/time govern health; latched detail is last-successful, not current. |
| Zones | `/jn` names/attributes, `/je` special type/data, plus `/js`/`/jc` runtime bits (`OpenSprinkler-Firmware/docs/docs/2.2.1/221_4_api.md:206-256`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:450-516`) | Decode names/attributes and special types once; do not expose raw `sd`; poll runtime separately. |
| Schedules | `/jp` (`OpenSprinkler-Firmware/opensprinkler_server.cpp:1153-1204`) | Keep raw source tuple and duration words for conflict/loss detection; render decoded summary. |
| Schedule writes | `/cp`, `/dp`, `/up`, `/cr`, `/mp` (`OpenSprinkler-Firmware/opensprinkler_server.cpp:663-1041`; `OpenSprinkler-Firmware/opensprinkler_server.cpp:2053-2085`) | Fresh-read, validate, confirm, submit, read back. |
| Activity | `/jl` with range; optional companion (`OpenSprinkler-Firmware/docs/docs/2.2.1/221_4_api.md:493-530`; `OpenSprinkler-App/www/src/README.md:38-39`) | Preserve selected range; use device-local time. |
| Capability | Pre-auth `fwv`, then authenticated `fwv*10+fwm`, fork identity, and field presence (`OpenSprinkler-Firmware/opensprinkler_server.cpp:388-422`; `OpenSprinkler-App/www/src/api/client.ts:123-141`) | Preflight-reject nonnumeric/below-`221` without credentials; hash-authenticate `221+`; apply the full roadmap gate only after auth. |

The firmware API reference remains canonical. See the Axis-D contract work in the roadmap; this table is a UX consumption map, not a duplicate wire specification.

## 17. Validation checklist

### Task success

- [ ] On an iPhone, create a disabled Mon/Wed/Fri schedule for two zones, review it, save it, and verify the controller readback without horizontal scrolling.
- [ ] On desktop, edit an existing schedule, encounter a simulated stale-tuple conflict, reload it, and save without losing unrelated fields.
- [ ] Change only a program name and round-trip durations `1`, `59`, `60`, `61`, `90`, `65533`, `65534`, and `65535` exactly.
- [ ] Schedule and manually run an approved special output with type-aware copy; verify masters and disabled zones remain unavailable.
- [ ] Run once for one test-safe zone with an explicit duration and confirmation; Stop all remains reachable.
- [ ] Explain Not yet updated, Update pending, Manual, normal 100%, scaled, restricted 0%, provider-fallback, failed-but-effective-scale, and stale-last-successful Weather states without opening Diagnostics.
- [ ] Recover from offline, wrong password, lost OTC prefix, and controller-unreachable scenarios without losing an unsaved schedule draft; a numeric `221+` `fwv`-only response never shows Unsupported.

### Safety and accessibility

- [ ] No invalid input sends a request; network values never coerce.
- [ ] No mutation announces success before readback matches.
- [ ] Stale/unreachable state disables mutations.
- [ ] Polling preserves focus, disclosures, and unsaved drafts when returned data is unchanged.
- [ ] Every destructive/risky action names its target and consequence; default dialog focus is safe.
- [ ] Keyboard-only completion works for navigation, schedule create/edit, Weather disclosure, validation recovery, and confirmation.
- [ ] Visible focus, contrast, text alternatives, live regions, 44 px coarse targets, reduced motion, and dark mode meet WCAG 2.1 AA.

### Responsive and performance

- [ ] 320 px through desktop widths have no page-level horizontal overflow; only designated data tables may scroll.
- [ ] Bottom navigation respects iPhone safe areas and does not cover sticky wizard controls or toasts.
- [ ] Pointer and touch expose the same actions without hover/swipe dependence.
- [ ] No new UI framework, runtime dependency, font, raster asset, or off-origin visual request is added.
- [ ] Production gzip output stays within the measured roadmap budget or has an explicit reviewed exception.

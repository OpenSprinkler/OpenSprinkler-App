# Hebrew Completion Review

Status: independently reviewed by Claude, as supplied by the user, with the
requested corrections applied by Codex. 539 machine entries are marked reviewed;
30 mentioning Bundle, Cycle and Soak, Aggregate/Child Sensor, or Sequential Group
remain unreviewed pending native terminology confirmation. This is LLM review,
not native-speaker approval or full Hebrew localization acceptance.

## Scope

- Filled all 550 missing catalog strings through the validated prepare/import
  workflow. Generator: `Codex assisted translation / Hebrew completion-v1 /
  2026-10-21`.
- Coverage is 973/973: six overrides, 398 human translations and 569 machine translations.
- All 414 nonblank human source entries, including obsolete keys, are unchanged.
  The six reviewed overrides below replace their compiled values; all other
  human translations are preserved exactly.
- No application behavior, shared glossary, or other language was changed.
- This completes the selected languages for this release: Chinese, German,
  Spanish, Czech, Slovak, and Hebrew have full catalog coverage. Review status
  varies; the other languages remain deferred pending user feedback.
- Complete catalog coverage does not translate firmware-provided `/jsd` labels
  or all third-party runtime strings.

## Provisional Terminology

| English | Hebrew | Meaning |
| --- | --- | --- |
| Station / Zone | תחנה | Irrigation output; existing human terminology. |
| Master Station | תחנה ראשית | Shared valve or pump output; existing terminology. |
| Bundle Station | תחנת מקבץ | Preserves the earlier trial and glossary term. |
| Cycle and Soak | מחזורי השקיה והשהיה לספיגה | Existing trial: watering cycles alternating with infiltration pauses. |
| Soaking | השהיה לספיגה | The pause between watering segments, not active watering. |
| Sequential Group | קבוצה להפעלה ברצף | Outputs scheduled in sequence, distinct from a Bundle. |
| Aggregate Sensor | חיישן משולב | Virtual sensor combining component sensor values. |
| Child Sensor | חיישן רכיב | A component used by an Aggregate, not a sensor depending on it. |
| Settings | הגדרות | Configuration, distinct from adjustments. |
| Adjustment | התאמה | Weather/sensor/program watering adjustment. |
| Flow Rate | ספיקה | Volume per unit time. |
| Flow Pulse Rate | נפח לפולס זרימה | Volume per pulse, not pulse frequency. |
| Current / Voltage | זרם / מתח | Electrical quantities; see legacy Current issue below. |

Bundle, Cycle and Soak, Aggregate/Child Sensor, and Sequential Group should receive
native technical review. The existing Cycle and Soak label is long but remains
consistent with the earlier trial. Do not shorten it independently in one label.

## Context Checks

- Station grammatical agreement is feminine: `פעילה דרך תחנת מקבץ`.
- `%s saved` describes saved water, not saved settings.
- Restore errors preserve the distinction between no writes and partial changes;
  they do not promise rollback.
- Log deletion explicitly does not reclaim storage capacity. The deletion title
  is a prefix followed by the sensor name and the code's question mark.
- Stopping after the current page refers to a batch of log data, not navigation.
- Quoted Edit Options and Ignore Password labels match existing human wording.
- `Zone` uses `תחנה`, including the master-station dropdown.
- Dates retain `mm/dd` and `mm/dd/yyyy` because the inputs expect month first.
- Counts, placeholders, markup, technical identifiers, SMTP hostnames, and email
  examples are preserved. Identical translations such as MQTT or HTTPS are
  deliberate, not untranslated ordinary prose.
- The source password-mismatch message contains the internal identifier
  `OSApp.currentSession.controller`; the Hebrew says "this controller" without
  exposing that implementation detail.

## Applied Review Corrections

`and 128.` now reads `ל-128.`, completing the Hebrew construction "between X
and Y". The invalid-master warning uses `לא הוחלה` (was not applied).

Six corrections are pinned in `overrides/he.json`, without changing Transifex:

| Source | Existing human text | Applied override |
| --- | --- | --- |
| Enabled | הסתיים | מופעלת |
| Disabled | ניטרול | מושבתים |
| Current | נוכחי | זרם |
| Program Switch | החלפת תוכנית | מתג תוכנית |
| on | פועל | בתאריך |
| Activate Relay | בקר פעיל | הפעלת ממסר |

Native reviewers may identify other legacy issues. The existing human layer was
not comprehensively re-reviewed by this completion pass.
The existing Logs title `לוגים` and new Sprinkler Logs menu label `יומני השקיה`
remain different, pending native review; no page-title override is included.

## Layout and Grammar Limitations

- The app retains its existing left-to-right layout. Hebrew glyphs render and
  longer labels wrap, but controls are not mirrored and mixed Hebrew/Latin text
  still follows the existing browser bidi behavior. A native device review should
  check dates, units, punctuation, hostnames, and technical identifiers.
- The relative-time code builds number + unit + suffix. `ago` uses `קודם`
  ("earlier") rather than putting `לפני` ("before") incorrectly at the end.
  Hebrew dual forms and fully idiomatic singular number placement still require
  language-aware formatting; that application-level change is deferred.
- Countdown text uses a labeled numeric value in minutes to avoid singular/plural
  grammar differences. No plural-engine or bidi-control-character workaround was
  added to translation strings.

## Validation

- All 31 compiled dictionaries pass the translation check.
- All 31 translation tests and 498 app tests pass; ESLint passes.
- Verified human sources are unchanged, compiled differences are limited to the
  six overrides, and all 19 earlier machine texts and generation provenance are
  preserved. Their review flags now follow the review status above.
- Fixture-only browser smoke checks passed at 320, 390, and 1280 pixels for
  station Basic/Output/Watering tabs, expanded Bundle configuration, and Network
  settings. No horizontal page overflow or browser errors were reported.
- Inspected screenshots of the Watering dialog and Network settings. Cycle and
  Soak wraps to two lines without overlap; Latin hostname and numeric fields
  remain legible. No live controller requests or writes were permitted.
- These are limited Chrome checks, not native-device or native-speaker acceptance.

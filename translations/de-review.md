# German Completion Review

Status: independently reviewed by Claude, as reported by the user on 2026-10-21,
with wording corrections applied by Codex. This is LLM review, not native-speaker
certification. The nine entries naming Cycle and Soak remain unreviewed pending
native-speaker confirmation of the proposed shorter feature name.

## Scope

- Added 253 missing translations to `machine/de.json` using the validated request
  and import workflow, with generator `Codex assisted translation / German
  completion-v1 / 2026-10-21`.
- Retained the original generator provenance for all 272 machine entries,
  including the 19 earlier trial entries. Corrected text hashes and refreshed
  context/glossary hashes after review. 263 entries are marked reviewed; nine
  feature-name entries remain unreviewed.
- The 973-message catalog now has eight overrides, 693 human translations and 272
  machine translations, with no missing German strings.
- All 722 non-empty entries in `human/de.json`, including obsolete keys retained
  for compatibility, are unchanged in the human source. Eight corrections take
  precedence through `overrides/de.json`; all other human text remains unchanged
  in the compiled dictionary.
- No other language dictionary or application behavior was changed. Spanish is
  the next language after this German review.

## Terminology

The German glossary follows existing human translations where available:

| Concept | German wording | Review note |
| --- | --- | --- |
| Station / Zone | Bewässerungskreis | Existing human terminology; an irrigation output, not a site. |
| Master | Hauptbewässerungskreis | Existing human terminology; controls a shared valve or pump. |
| Sequential Group | Sequentielle Gruppe | Existing human terminology. |
| Run-Once | Adhoc-Programm | Existing human terminology. |
| Rain Delay | Regenverzögerung | Existing human terminology. |
| Rain Sensor | Regensensor | Binary rain detection, not rainfall measurement. |
| Flow | Durchfluss | Existing human terminology. |
| Bundle Station | Bündel-Bewässerungskreis | Earlier trial wording; leader operating multiple outputs together. |
| Bundle Member | Bündelmitglied | Earlier trial wording. |
| Cycle and Soak | Zyklus und Sickerpause | Shorter name proposed by Claude; used consistently, pending native confirmation. |
| Soaking | Sickerpause | Water infiltrates the soil; the valve is not watering during this phase. |
| Aggregate Sensor | aggregierter Sensor | Claude's correction avoids the machinery meaning of "Aggregat". |
| Sensor Adjustment | Sensoranpassung | Adjustment of watering duration based on a sensor. |
| Remote Extension | Fern-Erweiterungsmodus | Provisional; a controller operating as an extension of another controller. |

## Review Follow-up

Claude reported reviewing all 272 machine entries against the English source,
Chinese translations, and relevant code context. No meaning errors or damaged
placeholders were found. Applied all five requested changes:

1. Standardized the feature name to "Zyklus und Sickerpause" in labels, errors,
   and reset messages. Nine affected entries remain unreviewed until a native
   speaker confirms the name. No manufacturer-manual comparison has been made.
2. Changed restart reasons to noun phrases: "Zurücksetzen auf Werkseinstellungen",
   "WLAN-Konfiguration", "WLAN-Änderung", "Uhrzeitaktualisierung", and
   "Fehler bei der Wetterabfrage".
3. Replaced "Aggregatsensor" with grammatically inflected "aggregierter Sensor"
   in all three affected messages and the glossary.
4. Used "Gesamtes Protokoll löschen für" before the appended sensor name. The
   shared English key and code are unchanged to preserve other translations.
   A future placeholder-based source sentence remains a separate improvement.
5. Added local overrides for "OpenSprinkler.com Login abgelaufen" and
   "Programmschalter" without editing the Transifex human layer.

Optional style changes to decimal punctuation, "Bewässerung %", and "Punkt"
remain deferred. Existing Master terminology is deliberately retained.

The later Spanish cross-language review identified six additional German keys
requiring overrides, also supplied by the user:

- Date entry hints: "Startdatum (MM/TT/JJJJ)", "Von (MM/TT)", and "Bis (MM/TT)"
  match the actual month-first field parser. Only the hints change, not parsing.
- Overcurrent is "Überstromfehler erkannt", not overvoltage.
- The odd/even warning now says the program may not run at all ("überhaupt nicht
  ausgeführt wird"), and the stray apostrophe is removed.
- Read Interval retains the seconds unit: "Leseintervall (s)".

## Review Priorities

1. Read all `text` values in `machine/de.json` against their English keys. Use
   `catalog.json` source references when a label is ambiguous.
2. Check destructive actions and partial failures: deleting logs, reset attributes,
   interrupted restores, skipped analog sensors, and dependency failures. Messages
   must not imply a successful rollback or that deleting logs frees capacity.
3. Check sensor port ownership and aggregate wording, including the distinction
   between a configured sensor and its measured value.
4. Check cycle states: queued, running, paused, soaking, master finishing. The last
   is translated as "Hauptbewässerungskreis läuft nach" for the remaining master
   output activity.
5. Check run-now choices: append, replace/cancel, pause/insert, and preempt.
6. Check password and hostname instructions. Quoted labels match the actual human
   translations: "Passwort ignorieren" and "Optionen bearbeiten". "None" remains
   "Keiner", matching the existing selector label.
7. Inspect long labels in the station tabs and bundle editor on a narrow phone.

Context-specific choices:

- `%s saved` means water saved, so it is `%s eingespart`, not configuration saved.
- `Activated` is a sensor-triggered footer state, translated as `Ausgelöst`.
- `Actual` labels measured PD voltage, translated as `Istwert`.
- `On Adj.` / `Off Adj.` use `Einschaltversatz` / `Ausschaltversatz`, rather than
  implying that negative timing offsets are impossible.
- `Stopping after the current page` refers to a page of records, not navigation;
  the translation explicitly uses `Datenseite`.
- `Delete the entire log of` is followed by the sensor name and a question mark.
- Numeric literals in the voltage example retain decimal points to satisfy the
  existing numeric-preservation validator; their values have not changed.

Identical-to-English entries (Afrikaans, Analog, OK, Option, Tamil, Zimmerman) are
intentional German names, technical terms, or labels, not untranslated gaps.

## Verification

- All new entries passed the importer's placeholder, numeric, markup, protected
  identifier, and provenance checks.
- Translation compilation/check and 31 translation tests pass.
- All 498 app tests and ESLint pass.
- Existing human source files have no diff; every non-empty German human entry
  matches the compiled output exactly except the eight documented overrides.
- Fixture-only Chrome smoke checks at 320px, 390px, and 1280px passed for the
  station Basic/Output/Watering tabs, expanded bundle member picker, and Network
  section: no horizontal page overflow or browser exceptions. Screenshots are in
  `/tmp/german-ui-smoke/`. Long labels wrap, and the station tab strip uses two
  rows in the existing 230px dialog. This is a limited layout check, not native
  device or full language acceptance.
- Catalog coverage is not a claim that firmware-provided `/jsd` labels or every
  third-party UI string is translated. Those runtime limitations are unchanged.

No Transifex upload, paid translation service, or live controller mutation was
performed. Human contributions will supersede machine entries automatically;
the eight local overrides remain pinned until explicitly revised or removed.

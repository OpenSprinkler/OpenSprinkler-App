# Czech and Slovak Completion Review

Status: independently reviewed by Claude, as supplied by the user, with the
requested corrections applied by Codex. This is LLM review, not native-speaker
approval. Czech has 248 reviewed entries and 24 awaiting native terminology
confirmation; Slovak has 246 reviewed entries and 27 awaiting confirmation.
The pending entries mention Bundle, Cycle and Soak, or Slovak queue terminology.

## Scope

| Language | Human catalog entries | New machine drafts | Coverage |
| --- | ---: | ---: | ---: |
| Czech | 701 | 272 | 973/973 |
| Slovak | 700 | 273 | 973/973 |

The human source files are untouched. All 722 nonblank Czech and 721 nonblank
Slovak human entries, including obsolete keys retained by the compiler, are
preserved exactly in the compiled dictionaries. Slovak's whitespace-only `on`
entry is treated as missing by the existing pipeline and now reads `dňa` in the
last-run date sentence.

Only missing strings were added through the validated machine-import workflow.
No application logic, overrides, or shared glossary changed. The follow-up also
corrects Spanish `Zone` to `Estación` in the machine layer.
Hebrew is next (550 missing strings); other languages remain deferred.

## Proposed Terminology

| English | Czech | Slovak |
| --- | --- | --- |
| Station | Stanice | Vetva |
| Master Station | Hlavní stanice | Hlavná vetva |
| Bundle Station | Sdružená stanice | Združená vetva |
| Bundle Member | Člen sdružené stanice | Člen združenej vetvy |
| Cycle and Soak | Cykly a vsakování | Cykly a vsakovanie |
| Maximum cycle | Maximální délka cyklu | Maximálna dĺžka cyklu |
| Minimum soak | Minimální pauza na vsakování | Minimálna prestávka na vsakovanie |
| Aggregate Sensor | Agregovaný senzor | Agregovaný senzor |
| Child Sensor | Dílčí senzor | Čiastkový senzor |
| Sensor Adjustment | Úprava podle senzoru | Úprava podľa senzora |
| Built-in Sensors | Vestavěné senzory | Zabudované senzory |

Station terminology follows the existing translations, particularly Slovak
`Vetva` rather than introducing `Stanica`. Bundle and Cycle and Soak names need
native terminology confirmation. These proposals are documented here rather
than changing the global glossary hash for already-reviewed languages.

## Review Focus

The follow-up review corrections are applied: `Zone` now uses Czech `Stanice`
and Slovak `Vetva`; Slovak `Sprinkler Logs` matches the existing page title
`História zavlažovania`; both port-conflict messages quote the Edit Sensors label.

- Bundle means a leader operating multiple outputs together, not a sequential
  group. Master refers to the shared valve or pump output.
- Soaking is a pause for infiltration, not active watering.
- Settings use nastavení/nastavenia; adjustments use úpravy.
- Partial-restore errors must not imply rollback. Log deletion does not reclaim
  capacity. Stopping after a page means a data batch, not navigating away.
- Verify analog sensor definitions versus instantaneous readings in the restore
  and port-conflict messages.
- Countdown messages avoid Czech/Slovak plural inflection problems by using
  `min` for the multi-minute case.
- Existing human wording was not independently re-reviewed or corrected.

## Deferred Plural Handling

The app selects English singular/plural strings, which cannot represent the
Czech and Slovak distinction between 1, 2-4, and 5 or more. Hidden-program counts
and existing time-ago translations can therefore have incorrect endings.
Language-aware plural selection needs a separate application change, also useful
for Polish and Russian. No plural-engine change is included here.

A native speaker should confirm the Bundle and Cycle and Soak names and Slovak
`front` versus `rad` for queue. The active Czech Transifex translator would be a
useful reviewer. Independent LLM review does not replace that check.

## Validation

- All 31 compiled dictionaries pass the translation consistency check.
- All 31 translation tests and 498 app tests pass; ESLint passes.
- Fixture-only browser smoke checks at widths 320, 390, and 1280 cover station
  Basic/Output/Watering tabs, expanded Bundle configuration, and Network settings.
  No page horizontal overflow or browser errors were reported. No controller
  requests or writes were permitted by the harness.
- The longer Watering tab wraps onto a second row in the narrow station popup;
  its labels and cycle fields remain readable. No layout change is included.
- Physical-device testing and native-speaker review remain outstanding.

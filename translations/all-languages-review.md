# All-language catalog completion

Completed on 2026-10-22 (America/New_York). Transifex verification completed at 2026-10-23T01:31:12.532Z.

All 31 runtime dictionaries cover all 971 current catalog keys. The 30 Transifex target languages also cover 971/971 keys. Persian has one Transifex language, fa, and two matching runtime aliases, fa and pes.

## Translation and review

Eight parallel Codex agents translated 16,048 missing locale/string pairs after the latest Transifex pull. This includes 867 mirrored pes entries. Persian wording was generated once and reused across both aliases.

Generator: `Codex assisted translation / full catalog completion-v1 / 2026-10-22`. All new records remain `unreviewed`. Each generating agent checked every new pair against the source, irrigation glossary, existing terminology, and relevant code. A separate agent reviewed critical warning meanings and the synchronization tooling. This is assisted review, not native-speaker acceptance.

The initial pull supplied nine additional contributions. Every previously nonempty human value and every previous machine record remain intact. Reviewed local corrections use the override layer.

The parent reviewed and applied 99 narrow corrections for untranslated labels and context errors. These include electrical current in mA, date prefixes, irrigation master outputs, disabled-program labels, and DNS requirements.

Flow Pulse Rate means volume per pulse. The field uses L/pulse or Gal/pulse in `www/js/modules/options.js`. Translations now distinguish this setting from pulse frequency.

## Coverage

New entries count the additions after the initial live pull. Override, human, and machine counts describe the final effective catalog. Obsolete legacy keys remain outside these counts.

| Locale | New entries | Overrides | Human | Machine | Missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| af | 421 | 3 | 547 | 421 | 0 |
| am | 651 | 3 | 317 | 651 | 0 |
| bg | 560 | 6 | 405 | 560 | 0 |
| cs | 0 | 3 | 729 | 239 | 0 |
| de | 0 | 16 | 732 | 223 | 0 |
| el | 731 | 3 | 237 | 731 | 0 |
| es | 0 | 12 | 406 | 553 | 0 |
| et | 711 | 1 | 259 | 711 | 0 |
| fa | 868 | 0 | 103 | 868 | 0 |
| fr | 429 | 3 | 539 | 429 | 0 |
| he | 0 | 6 | 429 | 536 | 0 |
| hr | 516 | 7 | 448 | 516 | 0 |
| hu | 428 | 4 | 539 | 428 | 0 |
| is | 883 | 0 | 88 | 883 | 0 |
| it | 429 | 7 | 535 | 429 | 0 |
| lv | 551 | 5 | 415 | 551 | 0 |
| mn | 892 | 0 | 79 | 892 | 0 |
| nl | 532 | 7 | 432 | 532 | 0 |
| no | 678 | 3 | 290 | 678 | 0 |
| pes | 867 | 0 | 104 | 867 | 0 |
| pl | 507 | 4 | 460 | 507 | 0 |
| pt | 516 | 4 | 451 | 516 | 0 |
| ro | 786 | 2 | 183 | 786 | 0 |
| ru | 493 | 3 | 475 | 493 | 0 |
| sk | 0 | 4 | 743 | 224 | 0 |
| sl | 577 | 2 | 392 | 577 | 0 |
| sv | 532 | 6 | 433 | 532 | 0 |
| ta | 817 | 0 | 137 | 834 | 0 |
| th | 899 | 0 | 72 | 899 | 0 |
| tr | 774 | 8 | 189 | 774 | 0 |
| zh | 0 | 389 | 582 | 0 | 0 |

## Context checks

- Station means an irrigation valve/output. Master means the shared valve or pump output.
- A Bundle Station operates its selected members together. It is distinct from a sequential group.
- Cycle and Soak alternates watering cycles with pauses for infiltration. Both duration labels identify the relevant time.
- Water Level scales watering duration as a percentage. It does not describe tank depth.
- `%s saved` means conserved water. `Current` means electrical current in the status footer.
- `on` precedes a date. A stop after the current page means the current batch of log records.
- Sensor-log deletion does not reclaim log capacity. Restore failures can leave earlier writes in place.
- Placeholders, markup, numeric values, protected identifiers, date-field order, and meaningful boundary spaces are retained in new entries.
- Protocol names, examples, and valid native cognates can legitimately match English. All 335 such new-entry warnings were inspected.

## Transifex synchronization

Resource: `o:albahra:p:opensprinkler:r:app`. The remote and local source catalogs contain the same 971 keys. A second pull before upload found no intervening community changes.

All 30 asynchronous translation uploads succeeded. Transifex created 17,274 translations and updated 166. This also uploaded earlier local completions that were still missing remotely. No Transifex translation was marked reviewed.

A fresh download after upload matched every current key and value: 29,130 pairs across 30 languages, with zero differences. Both Persian runtime dictionaries also match for all 971 current keys.

The new `export-po <directory>` command exports effective translations with UTF-8 headers. It omits missing entries, rejected machine drafts, and obsolete keys. A subsequent unchanged Transifex pull retains machine provenance. Different incoming wording can still update the human source layer.

## Validation

- Translation consistency check: all 31 compiled dictionaries.
- Translation tooling tests: 35 passed.
- Browser tests: 573 passed, including loading every supported dictionary and the fa alias.
- Build checks: five passed. ESLint and Git whitespace checks passed.
- New-entry audit: 16,048 valid records, zero missing keys, valid hashes, and correct boundary spaces.
- Export audit: all 31 PO files preserve exact Unicode text and all 971 current keys.
- Existing human values, prior machine records, and prior approved overrides are preserved.

## Review limits

Native terminology and device layout acceptance remain open. New Bundle and Cycle and Soak names are consistent technical drafts.

The app's English singular/plural selection and concatenated fragments can limit grammar. For example, Icelandic `for` serves both duration and scheduled-date contexts. Separate source messages could improve that wording.

Catalog completion does not cover every firmware-provided `/jsd` label or third-party message. Legacy human wording received targeted corrections, not a complete independent linguistic review.

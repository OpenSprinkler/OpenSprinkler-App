# Translation Maintenance

Translations are generated before release. The app still loads one local dictionary per language, using English for missing entries. No translation service is contacted by the app or by normal builds.

## Files and Precedence

- `human/<lang>.json`: existing translations and subsequent Transifex contributions. The initial import preserves all existing values, including obsolete keys and empty entries. Treat legacy contributions as protected, not as newly verified translations.
- `overrides/<lang>.json`: optional, explicitly approved local translations using the same `messages` dictionary format. These take precedence over all other layers and are never modified by a Transifex pull. No file is needed for languages without local review.
- `machine/<lang>.json`: assisted translations with hashes, generator identification, and review status. One selected translation per source key, not competing reviewed/unreviewed versions.
- `catalog.json`: current static source messages, source references, translator notes, and dynamic/concatenated-call audit candidates.
- `glossary.json`: irrigation context and protected terminology.
- `../www/locale/<lang>.js`: committed, deterministically compiled runtime dictionaries. Do not edit them directly.

Precedence is **approved local override > non-empty human > validated machine > English**. Empty human values fall through; empty overrides are rejected (delete an override to unpin it). Machine entries marked `needs-revision` are excluded. Old human keys are retained so dynamic callers do not lose existing translations. Catalog coverage refers to statically extracted keys; it does not claim the dynamic-call audit is resolved.

Provenance and source dictionaries stay outside `www/` and do not ship. Machine entries whose context/glossary changed are reported for review, not silently regenerated. A reviewed translation is protected from replacement just like any existing machine translation. Human corrections always take precedence.

## Daily Commands

```sh
npm run translations:extract
npm run translations:coverage
npm run translations:coverage -- --json
npm run translations:compile
npm run translations:check
npm run test:translations
npm test
npm run lint
```

`grunt extract`, `grunt coverage`, and `grunt compile` are equivalent local commands. No gettext CLI installation is required; parsing uses development dependencies. Extraction identifies literal JavaScript calls, static string concatenations, and `data-translate` attributes in `www/index.html`. It does not evaluate application code. Place `// TRANSLATORS: ...` within two lines above a call to include context.

For strings translated later through a variable, put `/* i18n-extract */` immediately before the literal or its static array/object table. This is an extraction-only comment, not an early translation call, so switching languages remains safe. Object property values are extracted, not property names or numeric identifiers. Misplaced markers fail extraction.

```js
const labels = /* i18n-extract */ ["Cycle queued", "Soaking"];
setLogProgress(0, /* i18n-extract */ "Deleting sensor log");
```

Review `catalog.json`'s `dynamic-key` entries and `concatenation-candidate` entries. Indirect lookups remain in the report even when their source tables are marked. The concatenation filter stops at HTML boundaries and focuses on adjacent visible text/variables; the remaining candidates are not automatically defects. A sentence split around a number may need a complete translatable message. Do not rewrite unrelated UI behavior simply to silence the audit.

## Assisted Translation

Prepare a request containing only missing public application strings, glossary, and source references:

```sh
node scripts/translations.cjs prepare de /tmp/translation-request-de.json
```

Translate a manageable subset of its `messages`, removing unprocessed keys rather than leaving their values empty. Preserve the English keys and request hashes, fill the values, and set `generator` to identify the tool/model/version or assisted run. Existing human terminology is included for consistency. Do not add device data, private station names, or credentials.

```sh
node scripts/translations.cjs import-machine /tmp/translation-response-de.json
npm run translations:compile
npm run translations:check
```

Import validates the entire batch before writing it. Unknown keys, empty text, damaged placeholders/markup, changed numeric values or protected identifiers, stale request hashes, and replacement of an existing machine translation are rejected. Reimporting identical results is safe. Human-translated entries are skipped. A failed batch leaves the machine file unchanged.

German, Hebrew, and Tamil each have 19 initial trial messages awaiting native review. Chinese has since completed the catalog, with 372 locally approved entries pinned in `overrides/zh.json` and the remaining 583 supplied by existing human translations. This is catalog coverage, not a claim that all runtime text is localized; `/jsd` labels remain deferred. See `zh-review.md`.

## Reviewing and Correcting

Use a PR to review source, translation, and context together. Mark acceptable machine entries `reviewed`; mark unsuitable entries `needs-revision` to restore English fallback. To explicitly correct a machine entry, edit its text and recompute `translationHash` using the exported `hash(text)` helper, then run the checks. Update its context/glossary hashes only after checking the new context. Avoid automatic replacement of previously reviewed wording.

Corrections submitted through Transifex belong in `human/<lang>.json`. Explicitly approved local corrections belong in `overrides/<lang>.json`, never the compiled file. Do not pin a whole legacy dictionary simply because it was human-translated: only pin wording actually reviewed locally. Existing machine records may remain beneath an override to preserve their generation provenance. Do not prune obsolete human keys until the dynamic-call audit establishes they are unused.

An override is a reviewed decision, not a permanent ban on improvement. When a native translator proposes better wording, review it and either update the override or remove that key to accept the current human translation. Languages without overrides continue accepting human improvements normally. New override languages must already have a human source dictionary. Overrides receive the same placeholder, markup, numeric-value and protected-term checks as new machine translations.

Validation warnings include identical-to-English text and unusual length. These can be legitimate. Punctuation may follow the target language. Inspect safety warnings, destructive confirmations, long mobile labels, right-to-left text, plurals and units manually. Passing token checks does not prove a translation's meaning.

`translations:coverage` also reports warning-only terminology conflicts from
`glossary.json`'s `terminologyChecks` rules. These inspect the effective merged
translation, including human text and overrides, rather than hidden lower layers.
Rules match explicit English source words/phrases (case-insensitive, whole words)
and list target-language terms to avoid. `preferredTerm` refers to the approved
language glossary. `exceptions` lists exact English keys where a usage is justified.
The initial Chinese rules check station/site confusion, Master, Rain Delay, and
Flow. Languages without rules are unaffected. Warnings never rewrite text or fail
a build; inspect context before correcting or adding an exception. JSON coverage
includes details in `terminologyWarnings`.

## Transifex

`grunt pushEng` (also `grunt shell:pushEng`) extracts and uploads the English catalog. `grunt updateLang` (also `grunt shell:updateLang`) explicitly contacts Transifex, downloads PO files into ignored `incoming/`, imports non-empty, non-fuzzy entries into human sources, then compiles. Neither command commits or pushes Git changes anymore.

The importer preserves existing human text when a pull omits a key or leaves it empty, and never copies compiled machine text into the human layer. Incoming nonempty translations update the human layer even for overridden keys, but the compiled UI retains the override. Conflicts print both local and incoming wording for review; identical translations do not warn. Review human changes in Git before accepting them. Unknown locale codes, duplicate PO entries, and unsupported contextual/plural entries fail explicitly instead of flattening or truncating them. The legacy `fa` and `pes` files are both preserved; any locale alias changes require a separate deliberate decision.

## CI and Next Phases

CI checks extraction freshness, deterministic compilation, merge/validation tests, and app tests. Coverage is reported but does not fail builds merely for missing translations. Malformed sources and stale compiled artifacts do fail. Build and translation generation are separate: existing releases remain buildable when translation services are unavailable.

Line-number-only shifts do not require re-extraction. New/removed messages, changed source-file context, translator notes, or audit candidates do. The catalog retains reference line numbers from the last extraction.

The bulk backlog now measures 18,814 missing language/string pairs across 31 files, not 18,814 distinct English messages. Provider-backed generation should be the main path for filling that backlog, following the small assisted trial; do not plan on manually translating every language first. Select a provider and budget next, with bounded batches, spending limits, safe resume and review PRs. No API credentials or paid translation calls have been configured. Runtime translation and downloadable language packs remain deferred.

Do not spend duplicate translation effort on `fa` and `pes` until their alias policy is decided. `pes` appears in the language menu, but `fa` is also reachable through automatic detection of browser locales such as `fa-IR`; neither can simply be deleted. Preserve their existing human translations when consolidating, and review conflicts explicitly.

## Initial Verification

- Extracted 954 messages, including marked indirect strings. Fourteen dynamic lookup sites remain listed for visibility, and the concatenation report is reduced from 696 to 164 candidates.
- Preserved all 22,171 original entries across 31 human source files; no non-empty human translation was replaced in compiled output.
- 24 tooling tests cover extraction markers, real indirect messages, HTML-noise filtering, merge rules, validation, and safe imports. Browser tests cover single-file language loading and English fallback.
- Firmware ZIP packaging includes the 31 compiled dictionaries, not source layers or metadata. Native builds were not rerun.
- Network options were inspected at 390px and desktop widths for German, Chinese, Hebrew, and Tamil. No page-width overflow was measured. These are limited smoke checks, not full localization acceptance.
- Tamil exposes a font limitation in this environment: some labels use missing glyphs from the web Lato font despite correct Tamil DOM text. A Tamil system font is installed and the input placeholder renders correctly, so this is not simply evidence of an absent font. Verify on native devices before treating it as a general app defect. Hebrew also still uses the existing layout; this work does not add full RTL mirroring.
- Hebrew Bundle terminology was corrected to the provisional technical term `מקבץ`, replacing the society/association wording. The glossary pins this preference, but both trial entries remain unreviewed pending native-speaker approval.
- Transifex synchronization was tested with local PO fixtures only; no live pull or upload was performed.

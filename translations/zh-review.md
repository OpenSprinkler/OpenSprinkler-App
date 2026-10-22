# Chinese Translation QA

Terminology update (2026-10-21): the user approved "循环渗透" as the Chinese
feature name for Cycle and Soak. All eight feature-name occurrences in the
approved overrides and the glossary use this wording. Phase descriptions such
as "分段浇水中" and "渗透中" are unchanged. Earlier machine drafts remain as
historical provenance beneath the approved overrides; they do not appear in the
compiled UI. German/Spanish glossary hashes were refreshed for this Chinese-only
change without changing their text or review flags.

Status: 2026-10-07. All 955 catalogued messages have Chinese text. This does
not establish full UI coverage: some runtime text bypasses localization.
Existing human translations were not comprehensively re-reviewed.

The 372 locally approved entries are protected in `overrides/zh.json`. The
human source has been restored to its original imported values; overrides keep
all approved corrections in the compiled UI. Migration preserved the compiled
Chinese dictionary exactly. Incoming Transifex improvements remain available
in the human layer, with conflicting overrides reported for review.

## Verification

- Full browser suite: 422/422 pass, including the localized station warning
  and rain-restriction day labels while stepping and saving.
- ESLint passes. CSSLint exits successfully with existing warnings; no CSS changed.
- Translation validation and 31 tooling tests pass.
- Headless Chrome screenshots checked at 390px and 1280px widths, with mocked
  controller data: Network options, station Basic/Output/Watering, sensor editor.
- Sampled text fits without horizontal overflow; Chinese glyphs render correctly.
- No live controller writes or native Android/iOS verification performed.
- Temporary visual server closed after testing. Screenshots are in `/tmp/translation-zh-*.png`.

## Review Metadata

24 previously approved entries had an outdated glossary hash after the correction
from Rain Sensor to 雨传感器. Their source contexts are unchanged and their text does
not use the corrected rain term. Updated those hashes without changing wording or
promoting unreviewed translations.

The following 15 early trial entries have now been approved by the user:

| Source | Current translation |
| --- | --- |
| Hostname (restart required) | 主机名（需重启） |
| Ignore Sensor 3 | 忽略3号传感器 |
| Ignore Sensor 4 | 忽略4号传感器 |
| Invalid cycle and soak configuration | 循环渗透设置无效 |
| Masters | 主阀门 |
| Network | 网络 |
| OK | 确定 |
| Requests declined because the queue was full | 队列已满，请求被拒绝 |
| Reset Zoom | 重置缩放 |
| This station is active through a running Bundle Station. | 此浇水站正由组合浇水站联动运行。 |
| This station is no longer part of a Bundle Station. | 此浇水站已不属于任何组合浇水站。 |
| Unable to load Bundle Station configuration. | 无法加载组合浇水站设置。 |
| Unable to load station configuration. | 无法加载浇水站设置。 |
| Weather Restriction Active | 天气限制已生效 |
| also active via Bundle Station | 同时由组合浇水站联动运行 |

## Legacy Wording for Approval

Approved and applied:

- Remote Station (IP)/(OTC): correct 浇水战 to 浇水站.
- Rain-delay messages still use 雨延迟; align with approved 雨天延迟.
- Flow Alert and Flow Sensor Update still use 水流; align with 流量.
- Flow Pulse Rate is 每脉冲水量. Verified the editor uses L/pulse or Gal/pulse,
  not a pulse-frequency unit.
- Show Inactive is 显示非活动传感器 rather than 显示非活动项.
- Default remains 默认, explicitly approved by the user.
- Corrected 站点 to 浇水站 in the special-station character-limit note.
- Warning-only terminology checks report no conflicts in the current Chinese
  catalog. This is a targeted check, not comprehensive linguistic validation.

## Runtime Coverage Gaps

- Sensor editor metadata from `/jsd` is rendered directly, including argument
  names, flags, sensor type names, units, and enum labels. Even translated keys
  such as Name or Weather Sensor are not used at these rendering sites.
  Examples include `sensor.name` headings and `arg.name` labels in sensors.js.
- Localizing `/jsd` display labels is explicitly deferred by the user.
- Follow-up should localize known metadata display labels, seed extraction from
  an explicit supported metadata catalog, retain English fallback for unknown
  firmware labels, and never translate user-entered sensor names or wire IDs.
- The dashboard warning "Changing group designation is prohibited while station
  is running" now uses the translation helper and reads 浇水站运行时不能更改顺序组.
- Rain restriction day labels now use the existing `days` translation, including
  increment/decrement controls; numeric settings serialization is unchanged.
- Third-party accessibility strings such as jQuery Mobile's "click to collapse
  contents" remain English. These are outside the current extracted catalog.

## Approved Follow-up (2026-10-21)

- Approved 18 additional messages for onboard Analog configuration and restore,
  Remote Extension notifications, station reset failures, and water savings.
- Use 添加模拟传感器之前 rather than 添加模拟传感器读数前 in the Analog
  port setup instruction, and 关闭远程扩展模式 for Disable Remote Extension.
- These entries are pinned in the approved override layer. All 973 current
  catalog messages now have Chinese translations; runtime gaps above remain deferred.

## Remaining Manual Checks

- Actual iOS/Android devices, narrow/landscape viewports, keyboard open.
- Sensor logs and program adjustment forms with real data.
- Destructive confirmations and import error dialogs: inspect without submitting
  a destructive operation unless using a disposable test controller.
- Rain restriction sentence fragments in the actual editor.
- Review older dictionary entries for terminology and semantic correctness.

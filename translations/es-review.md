# Spanish Completion Review

Status: independently reviewed by Claude, as supplied by the user, with wording
corrections applied by Codex. This is LLM review, not native-speaker certification.
562 machine entries are marked reviewed; 24 mentioning Cycle and Soak or Bundle
Station remain unreviewed pending native terminology confirmation.

## Scope

- Filled all 586 missing catalog strings using the validated prepare/import
  workflow. Generator: `Codex assisted translation / Spanish completion-v1 /
  2026-10-21`.
- Coverage is now 973/973: 10 overrides, 377 human translations and 586 machine
  entries. The unused legacy key "Programs and Settings" has no override.
- All 395 non-empty human source entries, including retained obsolete keys, are
  unchanged. The 10 documented overrides take precedence in the compiled UI;
  all other human translations are preserved exactly.
- No application logic changed. The initial German work was committed separately
  as `e1da619c`; six additional German overrides from the cross-language review
  are described in `de-review.md`.
- This is complete catalog coverage, not native-speaker certification or a claim
  that firmware-provided `/jsd` labels and third-party text are translated.

## Terminology

Claude reviewed these choices against English, German, Chinese, and code context.
The two feature names noted above remain provisional. Terminology is recorded
here without changing the shared glossary or invalidating other languages' review
hashes. Legacy human wording is retained except for the documented overrides.

| English | Proposed Spanish | Meaning |
| --- | --- | --- |
| Station | Estación | Existing human term for an irrigation output. |
| Master Station | Estación maestra | Existing human term; shared valve or pump output. |
| Sequential Group | Grupo secuencial | Stations normally run one after another. |
| Bundle Station | Estación combinada | Leader operating several outputs together; distinct from a sequential group. |
| Bundle Member | Miembro de estación combinada | An output included in a Bundle Station. |
| Cycle and Soak | Ciclo e infiltración | Alternating watering cycles and pauses for infiltration. |
| Maximum cycle | Duración máxima del ciclo | Maximum uninterrupted watering time. |
| Minimum soak | Pausa mínima de infiltración | Minimum pause between watering cycles. |
| Soaking | Pausa de infiltración | Watering is paused while water enters the soil. |
| Aggregate Sensor | Sensor agregado | Virtual combination of other sensor values; used in sentences, not firmware metadata. |
| Child Sensor | Sensor componente | A sensor whose value contributes to an aggregate. |
| Sensor Adjustment | Ajuste por sensor | Watering-duration adjustment based on a sensor. |
| Weather Adjustment | Ajuste meteorológico | Watering-duration adjustment based on weather. |
| Watering Level | Porcentaje de riego | Percentage scaling duration, not water depth. |
| Built-in Sensors | Sensores integrados | Controller sensor ports, distinct from expanded/virtual sensors. |
| Normally Open | Normalmente abierto | Electrical contact state. |
| Flow Rate | Caudal | Volume per minute. Existing general "Flow" remains "Flujo". |
| Flow Pulse Rate | Volumen por pulso | Calibration in L/pulse or Gal/pulse, not pulses per second. |
| Remote Extension | Modo de extensión remota | Controller serving as an extension of another controller. |
| Settings | Configuración | Stored configuration, not a watering adjustment. |
| Adjustment | Ajuste | Weather, sensor, program, or timing adjustment. |

Tone: concise infinitive labels, polite instructions with "usted" forms, neutral
Spanish vocabulary. Existing human strings mix registers; they are not silently
rewritten beyond the documented corrections.

## Review Corrections

- Changed 18 configuration-related machine messages from "ajustes" to
  "configuración", including App/Email/MQTT/OTC/wireless settings, cycle-and-soak
  settings, station settings, save/error messages, and instructions to review or
  save the configuration. Weather, sensor, program, and on/off timing adjustments
  retain "ajuste".
- Quoted «Ignorar Contraseña» and «Editar Opciones» in the two instructions that
  refer to these UI labels.
- Changed Stop to "Detener", consistent with "Deteniendo" and "Se detendrá".
- Added the nine legacy corrections below and the matching configuration
  override: "Settings have been saved" -> "La configuración se ha guardado".
  Removed the unused "Programs and Settings" override after the final review.
- The reviewer found no meaning errors or broken placeholders in the 586 drafts.
  Review flags record this LLM review plus the applied corrections, not native
  approval. No manufacturer terminology claim has been verified. "Ciclo e
  infiltración" and "Estación combinada" await native confirmation; the possible
  alternative "Ciclo y remojo" has not been adopted without confirmation.

## High-Value Review

Review `machine/es.json` against the English keys, using `catalog.json` source
references for ambiguous contexts. Prioritize these examples:

| English | Spanish draft |
| --- | --- |
| %s saved | %s ahorrados |
| Delete All | Eliminar todo |
| Download All | Descargar todo |
| Delete the entire log of | ¿Eliminar todo el registro de |
| Run After Others (Append) | Ejecutar después de los demás (añadir al final) |
| Run Now and Cancel Others (Replace) | Ejecutar ahora y cancelar los demás (reemplazar) |
| Run Now and Pause Others (Insert to front) | Ejecutar ahora y pausar los demás (insertar al principio) |
| Device password is not secure | La contraseña del dispositivo no es segura |
| Disable Remote Extension | Desactivar el modo de extensión remota |
| Stopping after the current page | Se detendrá tras el lote de datos actual |

Context checks:

- `%s saved` means water saved, not configuration saved.
- The log deletion title appends the sensor name and final `?`; the translation
  supplies the opening `¿`. A full source placeholder sentence is still deferred.
- The long delete warning explicitly says deletion does not free log capacity.
- Restore errors distinguish no writes, partially completed operations, and
  stopping before changing programs. They must not imply a rollback.
- Port ownership messages distinguish a sensor configuration from a measurement.
- Restart reasons use noun phrases, e.g. "Configuración de WiFi" and
  "Actualización del reloj", rather than commands.
- The host-name guidance preserves the 32-character limit, ASCII restriction,
  hyphen rules, numeric-only exclusion, and empty-to-default behavior.
- On/off adjustment labels do not imply negative offsets are forbidden.
- Decimal points in the voltage example remain unchanged to comply with numeric
  validation. Date labels preserve the actual month/day field order.
- The awkward English `OSApp.currentSession.controller` in the remote-password
  error is rendered as "este controlador", not exposed as a code identifier.
- Identical strings such as ETo, Error, Factor, HTTPS, ID, MQTT, Manual, OTC,
  Sensor, Tamil, Token, Zimmerman, broker, and example email addresses are
  intentional Spanish words or technical identifiers.

## Corrections to Existing Human Entries

Claude confirmed all nine corrections below; they are now applied through local
overrides. The original Transifex human source remains unchanged.

| English | Existing human text | Suggested correction | Reason |
| --- | --- | --- | --- |
| Current | Actual | Corriente | The footer shows electrical current in mA. |
| Flow Sensor | Sendor de Flujo | Sensor de flujo | Typo. |
| Water Level | Nivel de Agua | Porcentaje de riego | Duration percentage, not tank water level. |
| Fixed | Arreglado | Fijo | Fixed program start times, not "repaired". |
| Check All | Comprobar Todas | Seleccionar todas | Selects station checkboxes, not a diagnostic check. |
| Downgrade UI | Descargar interfaz | Volver a una versión anterior de la interfaz | Downgrade is not download. |
| Are you sure you want to downgrade the UI? | ¿Estás seguro que quieres actualizar la interfaz? | ¿Desea volver a una versión anterior de la interfaz? | Existing wording fails to specify downgrade. |
| Ignore Rain | ¿Ignorar Lluvia? | Ignorar lluvia | Checkbox label, not a question. |
| Use Master | Usar Master | Usar estación maestra | Matches the established Master Station term. |

This is not a complete review of the legacy human dictionary. Approval of new
drafts must not be represented as approval of every old translation.

## Verification

- All 586 entries passed placeholder, number, HTML, protected-term, and provenance
  validation. Compilation and dictionary checks pass.
- 31 translation tests, 498 app tests, and ESLint pass.
- Exact comparison confirms all 395 non-empty human source entries are unchanged,
  and compiled text differs only for the 10 explicit overrides.
- Fixture-only Chrome checks at 320px, 390px, and 1280px cover station tabs,
  expanded Bundle Station member selection, and Network settings. No page-width
  overflow or browser exceptions. Long labels wrap within the existing dialog.
- Screenshots: `/tmp/es-ui-smoke/`. These are limited layout checks, not native
  device or exhaustive language acceptance tests.
- No live controller writes, Transifex upload, or paid translation API calls.

The compiled Spanish dictionary is available in the local UI for user review.
Human contributions will supersede machine entries automatically. Local overrides
remain pinned until explicitly revised or removed.

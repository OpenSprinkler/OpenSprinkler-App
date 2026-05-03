/**
 * @typedef {Object} GetterSetter
 * @property {() => string | undefined} get - Sets the value.
 * @property {(value: string) => void} set - Gets the value.
 * @property {() => boolean} validate - Validates the value.
*/

/**
 * @typedef {Object} ParamUpdater
 * @property {() => void} reset - Resets the value.
 * @property {(params: URLSearchParams) => string | undefined} add - Sets the value.
 * @property {(value: string) => void} update - Gets the value.
 * @property {() => boolean} validate - Validates the value.
*/

/**
 * @typedef {Object} SegmentUpdater
 * @property {() => void} reset - Resets the value.
 * @property {(params: URLSearchParams) => boolean} add - Sets the value.
 * @property {(key: string, value: string) => void} update - Gets the value.
 * @property {(value: boolean) => void} visibility - Hides/shows the section.
 * @property {() => boolean} is_visible - Returns if section is visible.
*/

/**
 * @typedef {Object} Argument
 * @property {string} name
 * @property {string} arg
 * @property {string} type
 * @property {string} default
 * @property {Argument[]} extra
 */

/**
 * @typedef {Object} SesnorSegment
 * @property {string} name
 * @property {Argument[]} args
 */

/**
 * @typedef {Object} RawUnits
 * @property {string} name
 * @property {string} short
 * @property {number} group
 * @property {number} index
 * @property {number} value
 */

/**
 * @typedef {Object} Data
 * @property {SesnorSegment[]} sensor
 * @property {RawUnits[]} units
 * @property {{[key: string]: string[]}} enums
 * @property {SesnorSegment[]} base
 * @property {string[][]} flags
 */

/**
 * @typedef {Object} Units
 * @property {string} name
 * @property {number} value
 */

/**
 * @typedef {Object} SensorPage
 * @property {() => string | undefined} getURL
 * @property {(data: object) => void} update
 * @property {() => void} reset
 */

/**
 *
 * @param {JQuery} parent
 * @param {string} uuid
 * @param {Data} data
 * @returns {SensorPage}
 */

/* global $ */

/*!
 * GUI for OpenSprinkler App
 * (c) 2023 arfrie22
 * Released under the MIT License
 */

// Configure module
var OSApp = OSApp || {};

OSApp.Sensors = {};

/**
 * Translate the compact /jsd wire format to the long-key, object-units shape
 * the rest of the app expects. Firmware uses short keys (n/a/t/d/h/o/l/g/s/
 * e/as/dfl/hd/lk/ug) and unit tuples [id, name, short, group] to keep the
 * payload small. Each unit's `id` is duplicated into both `value` and `index`
 * because existing code sorts by `index` and looks up by `value`.
 */
OSApp.Sensors.normalizeJsd = function (raw) {
    function normArg(a) {
        const out = { name: a.n, arg: a.a, type: a.t };
        if ("d" in a) out.default = a.d;
        if ("h" in a) out.hint = a.h;
        if ("indicator" in a) out.indicator = a.indicator;
        if (Array.isArray(a.e)) out.extra = a.e.map(normArg);
        if (Array.isArray(a.o)) out.options = a.o.map(normOption);
        return out;
    }

    function normOption(o) {
        const out = { id: o.id, label: o.l };
        if (o.dfl) out.defaults = o.dfl;
        if (o.hd) out.hides = o.hd;
        if (o.lk) out.locked = o.lk;
        if (typeof o.ug === "number") out.unit_group = o.ug;
        return out;
    }

    function normUnit(u) {
        return { value: u[0], name: u[1], short: u[2], group: u[3], index: u[0] };
    }

    return {
        sensors: (raw.sensors || []).map((s) => ({ name: s.n, args: (s.as || []).map(normArg) })),
        units: (raw.units || []).map(normUnit),
        enums: raw.enums || {},
        args: (raw.as || []).map(normArg),
        flags: (raw.flags || []).map((f) => ({ name: f.n, default: f.d }))
    };
};

OSApp.Sensors.makeSensorSelect = function ($select) {
    $select.append($("<option></option>")
            .attr("value", "0")
            .text("None"));

    OSApp.currentSession.controller.sensors.sn.forEach((v) => {
        const $option = $('<option></option>')
            .attr("value", v.uuid)
            .text(`${v.name} (UUID: ${v.uuid})`);

        $select.append($option);
    });
};

OSApp.Sensors.createSensorPage = function (parent, uuid, data) {
    const groupNames = (data.enums && data.enums.SensorUnitGroup) || [];
    // Build the units-by-group structure. Use a sparse-then-fill pattern so
    // we don't blow up if a unit's group ID is outside the enum table.
    const units = data.units.slice().sort((a, b) => a.index - b.index).reduce((/** @type {Units[][]} */ acc, v) => {
        if (!acc[v.group]) acc[v.group] = [];
        acc[v.group].push({
            name: v.short ? `${v.name} (${v.short})` : v.name,
            value: v.value
        });
        return acc;
    }, []);
    // Ensure every group slot is at least an empty array so .forEach indices line up.
    for (let i = 0; i < Math.max(groupNames.length, units.length); i++) {
        if (!units[i]) units[i] = [];
    }

    // Type-correlated args: every arg name appearing as a key in any subtype
    // option's `dfl` (defaults) block, anywhere in /jsd. On a type or subtype
    // change, common args in this set are reset to their base default and then
    // overridden by the selected option's dfl. Common args outside this set
    // remain sticky (user-entered values are preserved).
    const typeCorrelated = new Set();
    function collectTypeCorrelated(arg) {
        if (Array.isArray(arg.options)) {
            arg.options.forEach((opt) => {
                if (opt && opt.defaults) {
                    Object.keys(opt.defaults).forEach((k) => typeCorrelated.add(k));
                }
            });
        }
        if (Array.isArray(arg.extra)) arg.extra.forEach(collectTypeCorrelated);
    }
    (data.args || []).forEach(collectTypeCorrelated);
    (data.sensors || []).forEach((s) => (s.args || []).forEach(collectTypeCorrelated));

    /**
     *
     * @param {string | number | string[] | undefined } val
     * @returns {string| undefined}
     */
    function coerceVal(val) {
        if (typeof val == "undefined" || typeof val == "string") {
            return val;
        }

        if (typeof val == "number" || Array.isArray(val)) {
            return JSON.stringify(val);
        }
    }

    /**
     *
     * @param {string} id
     * @param {JQuery} parent
     * @returns {GetterSetter}
     */
    function createUnitSelect(id, parent) {
        const $select = $('<select></select>').attr("id", id);
        parent.append($select);

        /** @type {Map<number, JQuery>} */
        const optgroups = new Map();
        /** @type {Map<number, number>} */
        const valueToGroup = new Map();

        units.forEach((g, i) => {
            if (!g || g.length === 0) return;
            let $group = $("<optgroup></optgroup>")
                .attr("label", groupNames[i] || "");

            g.forEach((v) => {
                let $unit = $("<option></option>")
                    .attr("value", v.value)
                    .text(v.name);

                $group.append($unit);
                valueToGroup.set(v.value, i);
            });

            $select.append($group);
            optgroups.set(i, $group);
        });

        $select.selectmenu();

        return {
            get: () => coerceVal($select.val()),
            set: (val) => {
                $select.val(val);
                $select.selectmenu('refresh');
            },
            validate: () => /** @type {HTMLSelectElement} */ ($select[0]).checkValidity(),
            setGroup: (groupId) => {
                if (groupId == null) {
                    optgroups.forEach(($g) => {
                        $g.show();
                        $g.find("option").show().prop("disabled", false);
                    });
                } else {
                    optgroups.forEach(($g, gid) => {
                        if (gid === groupId) {
                            $g.show();
                            $g.find("option").show().prop("disabled", false);
                        } else {
                            $g.hide();
                            $g.find("option").hide().prop("disabled", true);
                        }
                    });
                    const cur = parseInt(String($select.val()));
                    if (valueToGroup.get(cur) !== groupId) {
                        const allowed = units[groupId];
                        if (allowed && allowed.length > 0) {
                            $select.val(String(allowed[0].value));
                        }
                    }
                }
                $select.selectmenu("refresh");
            },
            getGroup: () => valueToGroup.get(parseInt(String($select.val()))),
        };
    }

    /**
     * @type {SegmentUpdater[]}
     */
    let sensorOptions = [];

    /**
     *
     * @param {string} id
     * @param {JQuery} parent
     * @returns {GetterSetter}
     */
    function createTypeSelect(id, parent) {
        const $select = $('<select></select>').attr("id", id);
        parent.append($select);

        data["sensors"].forEach((v, i) => {
            let $option = $("<option></option>")
                .attr("value", i)
                .text(v.name);

            $select.append($option);

        });

        $select.selectmenu();

        function updateSelect(applyDefaults) {
            const v = parseInt(String($select.val())) || 0;
            sensorOptions.forEach((_, i) => {
                sensorOptions[i].visibility(v == i, applyDefaults);
            });
        }

        updateSelect(false);

        // User-initiated type change: per spec, reset typeCorrelated common
        // args to base default and apply the new segment's controller's
        // current option dfl on top.
        $select.on("input", () => {
            updateSelect(true);
        });

        return {
            get: () => coerceVal($select.val()),
            set: (val) => {
                $select.val(val);
                $select.selectmenu('refresh');
                updateSelect(false);
            },
            validate: () => /** @type {HTMLSelectElement} */ ($select[0]).checkValidity(),
        };
    }

    /**
     *
     * @param {string} enumName
     * @param {string} id
     * @param {JQuery} parent
     * @returns {GetterSetter}
     */
    function createEnumSelect(enumName, id, parent) {
        const $select = $('<select></select>').attr("id", id);
        parent.append($select);

        data["enums"][enumName].forEach((v, i) => {
            const $option = $('<option></option>')
                .attr("value", i)
                .text(v);
            $select.append($option);
        });

        $select.selectmenu();

        return {
            get: () => coerceVal($select.val()),
            set: (val) => {
                $select.val(val);
                $select.selectmenu('refresh');
            },
            validate: () => /** @type {HTMLSelectElement} */ ($select[0]).checkValidity(),
        };
    }

    /**
     *
     * @param {string} uuid
     * @param {string} id
     * @param {JQuery} parent
     * @returns {GetterSetter}
     */
    function createSensorSelect(uuid, id, parent) {
        const $select = $('<select></select>').attr("id", id);
        parent.append($select);

        OSApp.Sensors.makeSensorSelect($select);

        $select.selectmenu();

        return {
            get: () => coerceVal($select.val()),
            set: (val) => {
                $select.val(val);
                $select.selectmenu('refresh');
            },
            validate: () => /** @type {HTMLSelectElement} */ ($select[0]).checkValidity(),
        };
    }

    /**
     *
     * @param {string} data
     * @param {string} id
     * @param {JQuery} parent
     * @returns {GetterSetter}
     */
    function createDoubleInput(data, id, parent) {
        const $input = $('<input type="number" step="any" required>').attr("id", id);
        parent.append($input);

        if (data) {
            const range = data.match(/\[\s*([+-]?\d+(?:\.\d+)?|any)\s*,\s*([+-]?\d+(?:\.\d+)?|any)\s*\]/);
            if (range && range.length == 3) {
                $input.attr("min", range[1]);
                $input.attr("max", range[2]);
            }
        }

        $input.textinput();

        return {
            get: () => coerceVal($input.val()),
            set: (val) => $input.val(val),
            validate: () => /** @type {HTMLInputElement} */ ($input[0]).checkValidity(),
        };
    }

    /**
     *
     * @param {string} data
     * @param {string} id
     * @param {JQuery} parent
     * @returns {GetterSetter}
     */
    function createStringInput(data, id, parent) {
        const $input = $('<input type="text">').attr("id", id);
        parent.append($input);

        if (data) {
            const range = data.match(/\[\s*([-+]?\d+|any)\s*,\s*([-+]?\d+|any)\s*\]/);
            if (range && range.length == 3) {
                $input.attr("minlength", range[1]);
                $input.attr("maxlength", range[2]);
            }
        }

        $input.textinput();

        return {
            get: () => coerceVal($input.val()),
            set: (val) => $input.val(val),
            validate: () => /** @type {HTMLInputElement} */ ($input[0]).checkValidity(),
        };
    }

    /**
     *
     * @param {string} data
     * @param {string} id
     * @param {JQuery} parent
     * @returns {GetterSetter}
     */
    function createIntInput(data, id, parent) {
        const $input = $('<input type="number" step="1">').attr("id", id);
        parent.append($input);

        if (data) {
            const range = data.match(/\[\s*([-+]?\d+|any)\s*,\s*([-+]?\d+|any)\s*\]/);
            if (range && range.length == 3) {
                $input.attr("min", range[1]);
                $input.attr("max", range[2]);
            }
        }

        $input.textinput();

        return {
            get: () => coerceVal($input.val()),
            set: (val) => $input.val(val),
            validate: () => /** @type {HTMLInputElement} */ ($input[0]).checkValidity(),
        };
    }

    /**
     *
     * @param {string} id
     * @param {JQuery} parent
     * @returns {GetterSetter}
     */
    function createFlagInput(id, parent) {
        const $input = $('<input type="checkbox">').attr("id", id);
        parent.append($input);

        $input.checkboxradio();

        return {
            get: () => String($input.prop('checked')),
            set: (val) => {
                $input.prop('checked', val == "true");
                $input.checkboxradio('refresh');
            },
            validate: () => true,
        };
    }

    /**
     *
     * @param {Argument} argument
     * @param {string} namespace
     * @param {string} key
     * @param {JQuery} parent
     * @returns {ParamUpdater}
     */
    function appendHint($label, hint) {
        if (!hint) return;
        const $help = $('<button type="button" class="help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext"></button>')
            .attr("data-helptext", hint)
            .on("click", OSApp.UIDom.showHelpText);
        $label.append(" ", $help);
    }

    // Common args (defined in /jsd at the top level of args[]) that are always
    // visible regardless of an inline-options enum's `shows` list.
    const COMMON_ARGS = new Set(["name", "interval", "unit", "min", "max", "type"]);

    /**
     * Builds an enum dropdown driven by argument.options[] (each option carries
     * id/label and optionally hides/defaults/locked/unit_group). On user change,
     * applies defaults to siblings (with base-default fallback for any
     * controller-managed arg not in this option's defaults), toggles per-segment
     * arg visibility per `hides`, toggles read-only state per `locked`
     * (cross-segment), and sets the unit group filter on the base "unit" arg.
     *
     * ctx.local — siblings within the same segment (for visibility/hides).
     * ctx.global — all sensor args across segments (for defaults/locked/unit_group).
     */
    function createInlineEnumOptions(argument, id, parent, $label, vis, ctx) {
        parent.append($label);
        const $select = $('<select></select>').attr("id", id);
        parent.append($select);

        argument.options.forEach((opt) => {
            $select.append($('<option></option>').attr("value", opt.id).text(opt.label));
        });
        $select.selectmenu();

        const localArgs = (ctx && ctx.local) || new Map();
        const globalArgs = (ctx && ctx.global) || localArgs;

        const findOpt = (val) => argument.options.find((o) => String(o.id) === String(val));

        let prevLocked = new Set();

        function applySideEffects(opt, applyDefaults) {
            if (!opt) return;

            // On type/subtype change: common args in typeCorrelated reset to
            // their base default; opt.dfl overrides apply on top; non-common
            // args in opt.dfl are also applied. Common args not in
            // typeCorrelated are sticky.
            if (applyDefaults) {
                const optDefaults = opt.defaults || {};
                const toProcess = new Set();
                for (const a of COMMON_ARGS) if (typeCorrelated.has(a)) toProcess.add(a);
                for (const a of Object.keys(optDefaults)) toProcess.add(a);
                for (const argName of toProcess) {
                    const sib = globalArgs.get(argName);
                    if (!sib) continue;
                    if (Object.prototype.hasOwnProperty.call(optDefaults, argName)) {
                        if (typeof sib.update === "function") {
                            sib.update(String(optDefaults[argName]));
                        }
                    } else if (typeof sib.reset === "function") {
                        sib.reset();
                    }
                }
            }

            // Visibility — within this segment only; common args always shown.
            // Args in `hides` are hidden; everything else is shown by default.
            const hides = new Set(opt.hides || []);
            for (const [argName, sib] of localArgs) {
                if (argName === argument.arg) continue;
                if (COMMON_ARGS.has(argName)) continue;
                if (typeof sib.setVisible === "function") {
                    sib.setVisible(!hides.has(argName));
                }
            }

            // Locked — applies to listed args (which may live in the base segment,
            // e.g. "unit"). Unlock anything we previously locked but isn't in the
            // new set.
            const newLocked = new Set(opt.locked || []);
            const affected = new Set([...prevLocked, ...newLocked]);
            for (const argName of affected) {
                const sib = globalArgs.get(argName);
                if (sib && typeof sib.setLocked === "function") {
                    sib.setLocked(newLocked.has(argName));
                }
            }
            prevLocked = newLocked;

            // Unit group filter — operates on the base "unit" arg. Mutually
            // exclusive with locked: ["unit"] per the spec.
            const unitSib = globalArgs.get("unit");
            if (unitSib && typeof unitSib.setGroup === "function") {
                unitSib.setGroup(typeof opt.unit_group === "number" ? opt.unit_group : null);
            }
        }

        $select.val(argument.default);
        $select.selectmenu("refresh");

        $select.on("change", function() {
            const opt = findOpt($select.val());
            applySideEffects(opt, true);
        });

        return {
            reset: () => {
                $select.val(argument.default);
                $select.selectmenu("refresh");
                // Hidden segments must not propagate cross-segment side effects
                // (defaults clobber base unit/max; setGroup auto-switches unit
                // when current value isn't in the new group).
                if (ctx && typeof ctx.isSegmentVisible === "function" && !ctx.isSegmentVisible()) return;
                applySideEffects(findOpt(argument.default), true);
            },
            add: (params) => {
                if (!vis.isVisible()) return;
                const val = String($select.val() ?? "");
                if (val !== "") params.append(argument.arg, val);
                return val;
            },
            update: (val) => {
                $select.val(val);
                $select.selectmenu("refresh");
                applySideEffects(findOpt(val), false);
            },
            validate: () => true,
            setVisible: vis.setVisible,
            setLocked: vis.setLocked,
            isVisible: vis.isVisible,
            // Re-apply current selection's effects (called when this segment
            // becomes visible, after all globalArgs are populated). When the
            // segment is being activated by a user-initiated type change,
            // applyDefaults=true triggers the typeCorrelated reset + dfl
            // override per the firmware spec.
            _wireOptions: (applyDefaults) => applySideEffects(findOpt($select.val()), !!applyDefaults),
            // Undo locked + unit-group state when this segment hides, so the
            // next segment's controller starts from a clean slate.
            _deactivateOptions: () => {
                for (const argName of prevLocked) {
                    const sib = globalArgs.get(argName);
                    if (sib && typeof sib.setLocked === "function") sib.setLocked(false);
                }
                prevLocked = new Set();
                const u = globalArgs.get("unit");
                if (u && typeof u.setGroup === "function") u.setGroup(null);
            },
        };
    }

    /**
     * Editor for the `points::[min,max]` arg type. Wire format: x0,y0,x1,y1,...
     * (no flag/uuid prefix — that's snadj's concern). Loaded values arrive as
     * a JSON-stringified [{x, y}, ...] array.
     *
     * Mirrors the snadj points editor in programs.js — pre-classed `<a>` for
     * delete (so JQM doesn't double-enhance into a wrapped button), a single
     * `enhanceWithin()` per re-render, and a top-aligned label so it doesn't
     * shift as rows are added.
     */
    function createPointsEditor(argument, rangeStr, _id, parent, $label, vis) {
        parent.append($label);
        parent.addClass("sensor-points-field");

        const range = rangeStr ? rangeStr.match(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/) : null;
        const minPts = range ? parseInt(range[1]) : 2;
        const maxPts = range ? parseInt(range[2]) : 8;

        const $wrap = $('<div class="sensor-points-wrap"></div>').appendTo(parent);
        const $table = $('<table class="sensor-splits-table"></table>').appendTo($wrap);
        $table.append(
            "<thead><tr>" +
            "<th scope='col'>" + OSApp.Language._("Point") + "</th>" +
            "<th scope='col'>" + OSApp.Language._("Voltage") + "</th>" +
            "<th scope='col'>" + OSApp.Language._("Sensor Value") + "</th>" +
            "<th scope='col'></th>" +
            "</tr></thead>"
        );
        const $tbody = $('<tbody></tbody>').appendTo($table);
        $table.append(
            "<tfoot><tr>" +
            "<td colspan='4' style='text-align:right;padding-right:0'>" +
            "<button type='button' class='sensor-add-point ui-btn ui-mini ui-corner-all ui-icon-plus ui-btn-icon-left ui-btn-inline'>" +
            OSApp.Language._("Add a Point") +
            "</button>" +
            "</td></tr></tfoot>"
        );

        /** @type {Array<{x:number, y:number}>} */
        let points = [];

        function render() {
            $tbody.empty();
            points.forEach((p, idx) => {
                const $xInput = $('<input type="number" class="pt-x split-x" step="any">');
                const $yInput = $('<input type="number" class="pt-y split-y" step="any">');
                const $del = $('<a class="ui-btn ui-btn-icon-notext ui-icon-delete ui-btn-corner-all split-remove" tabindex="-1" href="#"></a>');

                if (Number.isFinite(p.x)) $xInput.val(p.x);
                if (Number.isFinite(p.y)) $yInput.val(p.y);

                $xInput.on("change", function() {
                    points[idx].x = parseFloat($(this).val());
                });
                $yInput.on("change", function() {
                    points[idx].y = parseFloat($(this).val());
                });
                $del.on("click", function(e) {
                    e.preventDefault();
                    points.splice(idx, 1);
                    render();
                });

                $tbody.append(
                    $('<tr></tr>').append(
                        $('<th scope="row"></th>').text(idx + 1),
                        $('<td></td>').append($xInput),
                        $('<td></td>').append($yInput),
                        $('<td></td>').append($del)
                    )
                );
            });
            $tbody.enhanceWithin();
        }

        function fillToMin() {
            while (points.length < minPts) points.push({ x: NaN, y: NaN });
            render();
        }
        fillToMin();

        $table.find(".sensor-add-point").on("click", function() {
            if (points.length >= maxPts) return;
            points.push({ x: NaN, y: NaN });
            render();
        });

        return {
            reset: () => { points = []; fillToMin(); },
            add: (params) => {
                if (!vis.isVisible()) return;
                const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
                valid.sort((a, b) => a.x - b.x);
                const flat = [];
                valid.forEach((p) => { flat.push(p.x, p.y); });
                const str = flat.join(",");
                params.append(argument.arg, str);
                return str;
            },
            update: (val) => {
                let parsed;
                try { parsed = JSON.parse(val); } catch { return; }
                if (!Array.isArray(parsed)) return;
                points = parsed.map((p) => ({ x: parseFloat(p.x), y: parseFloat(p.y) }));
                while (points.length < minPts) points.push({ x: NaN, y: NaN });
                render();
            },
            validate: () => {
                if (!vis.isVisible()) return true;
                if (points.length < minPts || points.length > maxPts) return false;
                const xs = [];
                for (const p of points) {
                    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
                    xs.push(p.x);
                }
                for (let i = 1; i < xs.length; i++) {
                    if (xs[i] < xs[i - 1]) return false;
                }
                return true;
            },
            setVisible: vis.setVisible,
            setLocked: vis.setLocked,
            isVisible: vis.isVisible,
        };
    }

    function makeVisibilityHelpers(parent) {
        let visible = true;
        function setVisible(v) {
            visible = !!v;
            // Clear inline display style on show (rather than jQuery's .show()
            // which writes style.display="block" and clobbers the flex layout
            // defined in main.css for .ui-field-contain at >=480px).
            if (visible) parent.css("display", "");
            else parent.css("display", "none");
        }
        function setLocked(v) {
            const $controls = parent.find("input, select, textarea, button").not(".help-icon");
            $controls.prop("disabled", !!v);
            parent.find("select").each(function() {
                try { $(this).selectmenu("refresh"); } catch { /* not enhanced yet */ }
            });
            parent.find("input[type='checkbox'],input[type='radio']").each(function() {
                try { $(this).checkboxradio("refresh"); } catch { /* not enhanced yet */ }
            });
            parent.find("input[type='text'],input[type='number']").each(function() {
                try { $(this).textinput("refresh"); } catch { /* not enhanced yet */ }
            });
        }
        return {
            isVisible: () => visible,
            setVisible,
            setLocked,
        };
    }

    function wrapSimple(argument, value, vis) {
        return {
            reset: () => value.set(argument.default),
            add: (params) => {
                if (!vis.isVisible()) return;
                const val = value.get();
                if (typeof val != "undefined") {
                    params.append(argument.arg, val);
                }
                return val;
            },
            update: (val) => value.set(val),
            validate: () => vis.isVisible() ? value.validate() : true,
            setVisible: vis.setVisible,
            setLocked: vis.setLocked,
            isVisible: vis.isVisible,
            _value: value,
        };
    }

    function createInput(argument, namespace, key, parent, siblings) {
        const parts = argument.type.split("::");

        const ns = `${namespace}-${argument.arg}`;
        const id = `${ns}-${key}`;

        const $label = $("<label></label>")
            .attr("for", id)
            .text(argument.name);
        appendHint($label, argument.hint);

        const vis = makeVisibilityHelpers(parent);

        switch (parts[0]) {
            case "enum": {
                if (Array.isArray(argument.options)) {
                    return createInlineEnumOptions(argument, id, parent, $label, vis, siblings);
                }
                parent.append($label);
                const value = createEnumSelect(parts[1], id, parent);
                value.set(argument.default);
                return wrapSimple(argument, value, vis);
            }
            case "sensor": {
                parent.append($label);
                const value = createSensorSelect(uuid, id, parent);
                value.set(argument.default);
                return wrapSimple(argument, value, vis);
            }
            case "type": {
                parent.append($label);
                const value = createTypeSelect(id, parent);
                value.set(argument.default);
                return wrapSimple(argument, value, vis);
            }
            case "unit": {
                parent.append($label);
                const value = createUnitSelect(id, parent);
                value.set(argument.default);
                const wrapped = wrapSimple(argument, value, vis);
                wrapped.setGroup = value.setGroup;
                wrapped.getGroup = value.getGroup;
                return wrapped;
            }
            case "string": {
                parent.append($label);
                const value = createStringInput(parts[1], id, parent);
                if (argument._placeholder) {
                    parent.find(`#${id}`).attr("placeholder", argument._placeholder);
                }
                value.set(argument.default);
                return wrapSimple(argument, value, vis);
            }
            case "int": {
                parent.append($label);
                const value = createIntInput(parts[1], id, parent);
                value.set(argument.default);
                return wrapSimple(argument, value, vis);
            }
            case "float":
            case "double": {
                parent.append($label);
                const value = createDoubleInput(parts[1], id, parent);
                value.set(argument.default);
                return wrapSimple(argument, value, vis);
            }
            case "flag": {
                parent.append($label);
                const value = createFlagInput(id, parent);
                value.set(argument.default);
                return wrapSimple(argument, value, vis);
            }
            case "points": {
                return createPointsEditor(argument, parts[1], id, parent, $label, vis);
            }
            case "array": {
                /**
                 * @type {Map<string, ParamUpdater>[]}  // an array of numbers
                 */
                const arrayValues = [];
                const buttonUpdaters = [];
                const count = Number.parseInt(parts[1]);
                parent.append($label);
                const $buttonWrapper = $('<div class="sensor-array-buttons"></div>');
                parent.append($buttonWrapper);
                if (!isNaN(count)) {
                    for (let index = 0; index < count; index++) {
                        const $button = $('<input type="button">')
                            .val(index + 1)
                            .attr('id', `popup-btn-${ns}-${index}-${key}`);

                        const $popup = $('<div data-theme="a" class="sensor-child-popup"></div>')
                            .attr('id', `popup-container-${ns}-${index}-${key}`);
                        $popup.append(
                            $('<div class="ui-bar ui-bar-b sensor-child-popup-title"></div>').append(
                                $('<h3></h3>').text(OSApp.Language._("Configure Child Sensor") + " " + (index + 1))
                            )
                        );
                        const $popupContent = $('<div class="ui-content"></div>');
                        $popup.append($popupContent);

                        $buttonWrapper.append($button);
                        parent.parent().append($popup);

                        /**
                         * @type {Map<string, ParamUpdater>}  // an array of numbers
                         */
                        const values = new Map();

                        // If a /jsd arg has "indicator":true, its value vs. default drives button color.
                        // Capture the default after initial set so any internal mapping (e.g. 0→255) is
                        // already reflected, without hardcoding any field name here.
                        let indicatorInfo = null;

                        (argument.extra || []).forEach((v, i) => {
                            const paramUpdater = createInput({...v, arg: `${i}`}, `${ns}-${index}`, key, $popupContent);
                            values.set(v.arg, paramUpdater);
                            if (v.indicator) {
                                indicatorInfo = {
                                    updater: paramUpdater,
                                    defaultValue: paramUpdater.add(new URLSearchParams()),
                                };
                            }
                        });

                        arrayValues.push(values);

                        const $doneBtn = $('<input type="button" data-theme="b">').val(OSApp.Language._("Submit"));
                        $popupContent.append($doneBtn);
                        $doneBtn.button();

                        const updateAppearance = () => {
                            if (!indicatorInfo) return;
                            const $btn = $button.closest(".ui-btn");
                            const current = indicatorInfo.updater.add(new URLSearchParams());
                            $btn.toggleClass("green", current !== indicatorInfo.defaultValue);
                        };
                        buttonUpdaters.push(updateAppearance);

                        $popup.popup();

                        $popup.on("popupbeforeposition", (e) => e.stopPropagation());

                        let submitted = false;
                        let snapshot = null;

                        $doneBtn.on("click", () => {
                            submitted = true;
                            $popup.popup("close");
                        });

                        $popup.on("popupafterclose", () => {
                            if (!submitted && snapshot) {
                                for (const [key, p] of values.entries()) {
                                    const snapshotVal = snapshot.get(key);
                                    if (typeof snapshotVal !== "undefined") {
                                        p.update(snapshotVal);
                                    }
                                }
                            }

                            let ret = true;
                            let empty = true;
                            for (const p of values.values()) {
                                const val = p.add(new URLSearchParams);
                                if (!p.validate()) {
                                    ret = false;
                                }

                                if (!(val == "" || val == "true" || val == "false")) {
                                    empty = false;
                                }
                            }

                            const $btn = $button.closest(".ui-btn");
                            $btn.toggleClass("red", !(ret || empty));
                            updateAppearance();
                        });

                        $button.button();
                        $button.on("click", function() {
                            submitted = false;
                            snapshot = new Map();
                            for (const [key, p] of values.entries()) {
                                snapshot.set(key, p.add(new URLSearchParams()));
                            }
                            $popup.popup('open');
                        });
                    }
                }

                return {
                    reset: () => {
                        arrayValues.forEach((values) => {
                            for (const v of values.values()) {
                                v.reset();
                            }
                        });
                        buttonUpdaters.forEach(fn => fn());
                    },
                    add: (params) => {
                        let res = "";

                        for (const values of arrayValues) {
                            let val = "";

                            let valid = true;

                            for (const getter of values) {
                                if (val.length > 0) val += ",";

                                if (!getter[1].validate()) {
                                    valid = false;
                                    break;
                                }


                                const v = getter[1].add(new URLSearchParams);
                                if (typeof v != "undefined") {
                                    val += v;
                                }
                            }

                            if (!valid) {
                                continue;
                            }

                            val += ";";

                            res += val;
                        }


                        params.append(argument.arg, res);

                        return res;
                    },
                    update: (val) => {
                        const data = JSON.parse(val);
                        data.forEach((/** @type {{ [x: string]: string; }} */ v, /** @type {string | number} */ i) => {
                            const values = arrayValues[i];

                            for (const key in v) {
                                values.get(key)?.update(v[key]);
                            }
                        });
                        buttonUpdaters.forEach(fn => fn());
                    },
                    validate: () => {
                        return arrayValues.every((v) => {
                            let ret = true;
                            let empty = true;
                            for (const p of v.values()) {
                                const val = p.add(new URLSearchParams);
                                if (!p.validate()) {
                                    ret = false;
                                }

                                if (!(val == "" || val == "true" || val == "false")) {
                                    empty = false;
                                }
                            }

                            return ret || empty;
                        });
                    },
                    setVisible: vis.setVisible,
                    setLocked: vis.setLocked,
                    isVisible: vis.isVisible,
                };
            }
        }

        throw new Error(`Unknown type: ${parts[0]}`);
    }

    // createFlagSelect(argument) {
    //     const matches = arguments.matchall
    // }

    /**
     *
     * @param {SesnorSegment} sensor
     * @param {string} i
     * @param {string} key
     * @param {JQuery} parent
     * @returns {SegmentUpdater}
     */
    /** @type {Map<string, ParamUpdater>} — populated as segments are built, shared across segments */
    const globalArgs = new Map();

    function createSensorSegment(sensor, i, key, parent, inline) {
        let $content;
        let $ui = null;

        if (inline) {
            $content = parent;
        } else {
            $ui = $('<div class="ui-corner-all"></div>');
            const $bar = $('<div class="ui-bar ui-bar-a"></div>');
            $bar.append($("<h3></h3>").text(`${sensor.name} Options`));
            $content = $('<div class="ui-body ui-body-a"></div>');
            $ui.append($bar, $content);
            parent.append($ui);
        }

        /** @type {Array<() => void>} */
        const wireHooks = [];
        /** @type {Array<() => void>} */
        const deactivateHooks = [];

        let visible = true;

        /** @type {Map<string, ParamUpdater>} */
        const values = new Map();
        const ctx = { local: values, global: globalArgs, isSegmentVisible: () => visible };
        sensor.args.forEach((v) => {
            const $fieldWrap = $('<div class="ui-field-contain"></div>').appendTo($content);
            const updater = createInput(v, `sensor-${i}`, key, $fieldWrap, ctx);
            values.set(v.arg, updater);
            globalArgs.set(v.arg, updater);
            if (typeof updater._wireOptions === "function") {
                wireHooks.push(updater._wireOptions);
            }
            if (typeof updater._deactivateOptions === "function") {
                deactivateHooks.push(updater._deactivateOptions);
            }
        });

        return {
            reset: () => {
                for (const v of values.values()) {
                    v.reset();
                }
            },
            add: (params) => {
                for (const v of values.values()) {
                    if (!v.validate()) {
                        return false;
                    }

                    v.add(params);
                }

                return true;
            },
            update: (key, value) => values.get(key)?.update(value),
            visibility: (value, applyDefaults) => {
                visible = value;
                if ($ui) {
                    if (value) {
                        $ui.show();
                    } else {
                        $ui.hide();
                    }
                }
                if (value) {
                    // Re-apply inline-options enum effects. applyDefaults is
                    // forwarded so user-initiated type changes trigger the
                    // typeCorrelated reset + dfl override; programmatic
                    // activation (construction, reset, update) does not.
                    wireHooks.forEach((fn) => fn(applyDefaults));
                } else {
                    // Undo any cross-segment effects this segment's controllers had set.
                    deactivateHooks.forEach((fn) => fn());
                }
            },
            is_visible: () => visible,
            wireOptions: (applyDefaults) => wireHooks.forEach((fn) => fn(applyDefaults)),
        };
    }

    function createFlagRow(segment, key, rowParent) {
        const $wrap = $('<div class="ui-field-contain sensor-flags-row"></div>');
        rowParent.append($wrap);
        $wrap.append($('<label class="sensor-flags-label"></label>'));

        const $checkboxes = $('<div class="sensor-flags-checkboxes"></div>');
        $wrap.append($checkboxes);

        const flagValues = new Map();
        segment.args.forEach((arg) => {
            const id = `sensor-flags-${arg.arg}-${key || "new"}`;
            const $input = $('<input type="checkbox">').attr("id", id).attr("name", id);
            const $lbl = $('<label></label>').attr("for", id).text(arg.name);
            appendHint($lbl, arg.hint);
            $checkboxes.append($input, $lbl);
            $input.checkboxradio();
            $input.prop("checked", !!arg.default);

            flagValues.set(arg.arg, {
                reset: () => { $input.prop("checked", !!arg.default); $input.checkboxradio("refresh"); },
                add: (params) => { const val = String($input.prop("checked")); params.append(arg.arg, val); return val; },
                update: (val) => { $input.prop("checked", val === "true" || val === true); $input.checkboxradio("refresh"); },
                validate: () => true,
            });
        });

        return {
            reset: () => { for (const v of flagValues.values()) v.reset(); },
            add: (params) => { for (const v of flagValues.values()) v.add(params); return true; },
            update: (k, value) => flagValues.get(k)?.update(value),
            validate: () => true,
        };
    }

    // Inject placeholder text for the name field on the Add Sensor page
    data.args.forEach(arg => {
        if (arg.arg === "name" && !uuid) arg._placeholder = "New Sensor";
    });

    /**
     * @type {SesnorSegment}
     */
    let flagSegment = {
        name: "Flags",
        args: []
    };

    data.flags.forEach((v, i) => {
        flagSegment.args.push({
            name: v.name,
            arg: `${i}`,
            type: "flag",
            default: v.default,
            extra: [],
        });
    });

    // Render name first, then flags, then remaining args — all inline (no section boxes)
    const nameArgIdx = data.args.findIndex(a => a.arg === "name");
    let baseOptions;
    let flagOption;

    if (nameArgIdx !== -1) {
        const nameOption = createSensorSegment(
            { name: "", args: [ data.args[nameArgIdx] ] },
            "base-name", uuid, parent, true
        );
        flagOption = createFlagRow(flagSegment, uuid, parent);
        const remainingArgs = data.args.filter(a => a.arg !== "name");
        const restOption = remainingArgs.length > 0
            ? createSensorSegment({ name: "", args: remainingArgs }, "base-rest", uuid, parent, true)
            : null;
        baseOptions = restOption ? [ nameOption, restOption ] : [ nameOption ];
    } else {
        flagOption = createFlagRow(flagSegment, uuid, parent);
        baseOptions = [ createSensorSegment({ name: "", args: data.args }, "base-rest", uuid, parent, true) ];
    }

    sensorOptions = data.sensors.map((v, i) => {
        let ret = createSensorSegment(v, `sen-${i}`, uuid, parent);

        ret.visibility(i == 0);
        return ret;
    });

    // The first segment was built before its siblings existed in globalArgs,
    // so re-apply its inline-options enum side effects now that everything is
    // wired up.
    if (sensorOptions.length > 0) {
        sensorOptions[0].wireOptions();
    }

    /**
     *
     * @param {URLSearchParams} params
     */
    function setFlags(params) {
        const tempParams = new URLSearchParams();
        flagOption.add(tempParams);
        let flag = 0;
        for (const [k, v] of tempParams.entries()) {
            const bit = Number.parseInt(k);

            if (Number.isInteger(bit) && v == "true") {
                flag |= 1 << bit;
            }
        }

        params.set("flag", `${flag}`);
    }

    /**
     *
     * @param {number} flags
     */
    function getFlags(flags) {
        flagSegment.args.forEach((arg) => {
            const bit = Number.parseInt(arg.arg);
            if (Number.isInteger(bit)) {
                flagOption.update(arg.arg, (((flags >> bit) & 1) === 1) ? "true" : "false");
            }
        });
    }

    return {
        getURL: function () {
            const params = new URLSearchParams();
            if (!baseOptions.every((v) => v.add(params))) return undefined;
            if (!sensorOptions.filter((v) => v.is_visible()).every((v) => v.add(params))) return undefined;
            setFlags(params);
            params.append("pw", "");
            params.append("uuid", uuid || "-1");
            return `/csn?${params.toString()}`;
        },
        update: function (data) {
            for (const [key, value] of Object.entries(data)) {
                switch (key) {
                    case "flag":
                        getFlags(value);
                        break;
                    case "extra": {
                        for (const [extraKey, extraValue] of Object.entries(value)) {
                            let str;
                            if (typeof extraValue == "string") {
                                str = extraValue;
                            } else {
                                str = JSON.stringify(extraValue);
                            }

                            sensorOptions.forEach((v) => v.update(extraKey, str));
                        }
                        break;
                    }
                    default:
                        baseOptions.forEach((v) => v.update(key, value));
                        break;
                }
            }
        },
        reset: function () {
            baseOptions.forEach((v) => v.reset());
            sensorOptions.forEach((v) => v.reset());
            flagOption.reset();
        }
    };
};

OSApp.Sensors.changeSensor = function (url, isNew) {
    $.mobile.loading( "show" );
    OSApp.Firmware.sendToOS(url).done(() => {
        OSApp.Sites.updateControllerSensors(() => {
            $.mobile.loading( "hide" );
            if (isNew) {
                $.mobile.document.one( "pageshow", function() {
                    OSApp.Errors.showError( OSApp.Language._( "Sensor added successfully" ) );
                } );
                OSApp.UIDom.goBack();
            } else {
                $( "#sensors" ).trigger( "programrefresh" );
                OSApp.Errors.showError( OSApp.Language._( "Sensor updated successfully" ) );
            }
        });
    });

};

OSApp.Sensors.deleteSensor = function (uuid) {
    $.mobile.loading( "show" );
    OSApp.Firmware.sendToOS(`/dsn?pw=&uuid=${uuid}`).done(() => {
        OSApp.Sites.updateControllerSensors(() => {
            $.mobile.loading( "hide" );
            $( "#sensors" ).trigger( "programrefresh" );
            OSApp.Errors.showError( OSApp.Language._( "Sensor deleted successfully" ) );
        });
    });
};

OSApp.Sensors.displayPage = function (_callback) {
    const page = $(`<div data-role="page" id="sensors"></div>`);
	const content = $(`<div class="ui-content" role="main" id="sensors_list"></div>`);
    page.append(content);

    const SENSOR_STATUS = { VALID: 1, ERROR: 2, STALE: 4, CLAMPED_HIGH: 8, CLAMPED_LOW: 16 };

    function sensorValueDisplay( value, unitShort, status ) {
        if ( !( status & SENSOR_STATUS.VALID ) ) {
            return { text: "—", cls: "" };
        }
        let text = value + ( unitShort ? " " + unitShort : "" );
        let cls = "sensor-value-valid";
        if ( ( status & SENSOR_STATUS.ERROR ) || ( status & SENSOR_STATUS.STALE ) ) {
            text += " ⚠";
            cls = "sensor-value-warning";
        } else if ( status & SENSOR_STATUS.CLAMPED_HIGH ) {
            text += " ⊤";
            cls = "sensor-value-clamped";
        } else if ( status & SENSOR_STATUS.CLAMPED_LOW ) {
            text += " ⊥";
            cls = "sensor-value-clamped";
        }
        return { text: text, cls: cls };
    }

    /**
     *
     * @param {JQuery} parent
     * @param {Data} data
     * @param {object} sensorData
     * @returns {SensorPage}
     */
    function createSensorCollapse(parent, data, sensorData) {
        const $div = $("<div></div>");
        const $header = $("<h3></h3>");
        $header.text(`${sensorData["name"]} (UUID: ${sensorData["uuid"]})`);
        const $inner = $("<div></div>");

        parent.append($div);
        $div.append($header, $inner);
        $div.collapsible();

        const isEnabled = (sensorData["flag"] & 1) !== 0;
        if (!isEnabled) $div.find(".ui-collapsible-heading-toggle").addClass("red");

        if (typeof sensorData["value"] !== "undefined" && sensorData["value"] !== null) {
            const unitObj = data.units.find(u => u.value === sensorData["unit"]);
            const unitShort = unitObj ? (unitObj.short || unitObj.name) : "";
            const status = sensorData["status"] != null ? sensorData["status"] : 1;
            const { text: valueText, cls: valueCls } = sensorValueDisplay( sensorData["value"], unitShort, status );
            const $fieldWrap = $('<div class="ui-field-contain"></div>');
            $fieldWrap.append($('<label></label>').text(OSApp.Language._("Current Value")));
            $fieldWrap.append(
                $('<p class="sensor-current-value-text"></p>')
                    .text(valueText)
                    .addClass(valueCls)
                    .attr("data-sensor-uuid", sensorData["uuid"])
                    .attr("data-unit", unitShort)
            );
            $inner.append($fieldWrap);
        }

        const page = OSApp.Sensors.createSensorPage($inner, sensorData["uuid"], data);
        page.update(sensorData);

        const $update = $('<input type="button" data-theme="b">').val("Update Sensor");
        $inner.append($update);
        $update.button({icon: "edit"});
        $update.on("click", () => {
            const url = page.getURL();
            if (url) {
                OSApp.Sensors.changeSensor(url, false);
            } else {
                OSApp.Errors.showError(OSApp.Language._("Please fill in all required fields"));
            }
        });

        const $delete = $('<input type="button">').val(OSApp.Language._("Delete Sensor"));
        $inner.append($delete);
        $delete.button({icon: "delete"});
        $delete.closest(".ui-btn").addClass("red bold");
        $delete.on("click", () => {
            OSApp.Sensors.deleteSensor(sensorData["uuid"]);
        });

        return page;
    }

    function updateContent () {
        const jsdRequest = OSApp.currentSession.controller.sensor_desc
            ? $.Deferred().resolve(OSApp.currentSession.controller.sensor_desc).promise()
            : OSApp.Firmware.sendToOS("/jsd?pw=", "json").then((data) => OSApp.Sensors.normalizeJsd(data));

        $.mobile.loading("show");
        jsdRequest
            .done((jsdData) => {
                OSApp.currentSession.controller.sensor_desc = jsdData;
                content.empty();
                const count = OSApp.currentSession.controller.sensors.sn.length;
                content.append("<p class='center'>" + OSApp.Language._("Click below to expand/edit. Be sure to save changes.") + "</p>");
                content.append("<p class='center'>" + OSApp.Language._("Number of Sensors") + ": " + count + "</p>");
                const $set = $('<div data-role="collapsible-set"></div>');
                content.append($set);
                OSApp.currentSession.controller.sensors.sn.forEach((v) => {
                    createSensorCollapse($set, jsdData, v);
                });
                $set.collapsibleset();

                const $notice = $('<p class="sensor-page-notice"></p>');
                $notice.append(document.createTextNode(OSApp.Language._(
                    "Note: this page is for external (e.g. analog) and virtual sensors."
                ) + " "));
                // Translators: keep {0} as the placeholder for the link to the
                // "Weather and Sensors" section.
                const template = OSApp.Language._("To edit built-in sensors (e.g. rain, flow), open the {0} section under Edit Options.");
                const [before, after = ""] = template.split("{0}");
                const $link = $('<a href="#"></a>').text(OSApp.Language._("Weather and Sensors"));
                $link.on("click", function(e) {
                    e.preventDefault();
                    OSApp.UIDom.changePage("#os-options", { expandItem: "weather" });
                });
                $notice.append(document.createTextNode(before), $link, document.createTextNode(after));
                content.append($notice);
            })
            .fail(() => {
                OSApp.Errors.showError(OSApp.Language._("Failed to load sensor descriptions"));
            })
            .always(() => { $.mobile.loading("hide"); });
    }

    function refreshValues() {
        const sn = OSApp.currentSession.controller.sensors && OSApp.currentSession.controller.sensors.sn;
        if ( !sn ) { return; }
        page.find( "[data-sensor-uuid]" ).each( function() {
            const $el = $( this );
            const uuid = $el.attr( "data-sensor-uuid" );
            const sensor = sn.find( function( s ) { return String( s.uuid ) === uuid; } );
            if ( !sensor || typeof sensor.value === "undefined" || sensor.value === null ) { return; }
            const unitShort = $el.attr( "data-unit" ) || "";
            const status = sensor.status != null ? sensor.status : 1;
            const { text, cls } = sensorValueDisplay( sensor.value, unitShort, status );
            $el.text( text )
               .removeClass( "sensor-value-valid sensor-value-warning sensor-value-clamped" )
               .addClass( cls );
        } );
    }

    $( "html" ).on( "datarefresh", refreshValues );

    page
		.on( "programrefresh", updateContent )
		.on( "pagehide", function() {
			$( "html" ).off( "datarefresh", refreshValues );
			page.detach();
		} )
		.on( "pagebeforeshow", function() {} );

    function begin() {
		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Edit Sensors" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.checkChangesBeforeBack
			},
			rightBtn: {
				icon: "plus",
				text: OSApp.Language._( "Add" ),
				on: function() {
					OSApp.UIDom.checkChanges( function() {
						OSApp.UIDom.changePage( "#add-sensor" );
					} );
				}
			}

		} );

		updateContent();

		$( "#sensors" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
};

OSApp.Sensors.addSensor = function (_callback) {
    const page = $(`<div data-role="page" id="add-sensor"></div>`);
	const content = $(`<div class="ui-content" role="main"></div>`);
    page.append(content);

    let submit = () => {};

    /**
     *
     * @param {JQuery} parent
     * @param {Data} data
     * @returns {SensorPage}
     */
    function createAddSensor(parent, data) {
        const $card = $('<div class="sensor-add-card"></div>').appendTo(parent);
        const page = OSApp.Sensors.createSensorPage($card, "", data);
        page.reset();

        submit = () => {
            const url = page.getURL();
            if (url) {
                OSApp.Sensors.changeSensor(url, true);
            } else {
                OSApp.Errors.showError(OSApp.Language._("Please fill in all required fields"));
            }
        };

        return page;
    }

    function updateContent () {
        const jsdRequest = OSApp.currentSession.controller.sensor_desc
            ? $.Deferred().resolve(OSApp.currentSession.controller.sensor_desc).promise()
            : OSApp.Firmware.sendToOS("/jsd?pw=", "json").then((data) => OSApp.Sensors.normalizeJsd(data));

        $.mobile.loading("show");
        jsdRequest
            .done((jsdData) => {
                OSApp.currentSession.controller.sensor_desc = jsdData;
                content.empty();
                createAddSensor(content, jsdData);
            })
            .fail(() => {
                OSApp.Errors.showError(OSApp.Language._("Failed to load sensor descriptions"));
            })
            .always(() => { $.mobile.loading("hide"); });
    }

    page
		.on( "programrefresh", updateContent )
		.on( "pagehide", function() {
			page.detach();
		} )
		.on( "pagebeforeshow", function() {} );

    function begin() {
		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Add a Sensor" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.checkChangesBeforeBack
			},
			rightBtn: {
				icon: "check",
				text: OSApp.Language._( "Submit" ),
				on: () => {
                    submit();
                }
			}

		} );

		updateContent();

		$( "#add-sensor" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
};

OSApp.Sensors.displayLogs = function (_callback) {
    const page = $(`<div data-role="page" id="sensor-logs"></div>`);
	const content = $(`<div class="ui-content" role="main"></div>`);
    const $cards = $("<div></div>");

    let showCurrentOnly = true;
    let requestSeq = 0;
    let activeCharts = [];
    let cachedData = null;
    let allCardsRendered = false;

    const $filterDiv = $(`
        <div class="sensor-log-filter-bar">
            <div class="sensor-log-filter-toggle">
                <label for="show-inactive-sensors">${OSApp.Language._("Show Inactive")}</label>
                <input type="checkbox" name="show-inactive-sensors" id="show-inactive-sensors">
            </div>
            <div class="sensor-log-filter-actions">
                <input type="button" class="sensor-log-download-btn" value="${OSApp.Language._("Download All")}">
                <input type="button" class="sensor-log-delete-all-btn" value="${OSApp.Language._("Delete All")}">
            </div>
        </div>
    `);
    content.append($filterDiv);
    content.append($cards);
    page.append(content);

    const _dateFmt = new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' });
    const _timeFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });

    function _dayKey(ts) {
        const d = new Date(ts);
        return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
    }

    function createChart(canvas, sn, unitLabel) {
    const sensorGraph = new Chart(canvas, {
                type: 'line',
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            ticks: {
                                callback: function(value, index, ticks) {
                                    const date = new Date(value);
                                    const isAtMidnight = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
                                    const dateStr = _dateFmt.format(date);

                                    if (isAtMidnight) {
                                        return dateStr;
                                    }

                                    const timeStr = _timeFmt.format(date);
                                    const isNewDay = index === 0 || _dayKey(ticks[index - 1].value) !== _dayKey(value);

                                    return isNewDay ? [dateStr, timeStr] : timeStr;
                                }
                            },
                            title: {
                                display: false
                            }
                        },
                        y: {
                            title: {
                                display: !!unitLabel,
                                text: unitLabel
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: sn.name,
                            font: {
                                size: 18
                            }
                        },
                        zoom: {
                            zoom: {
                                drag: {
                                    enabled: true,
                                },
                            mode: 'x',
                            }
                        }
                    }
                },
            });

        sensorGraph.update();

        return sensorGraph;
    }

    let download = () => {};

    /**
     *
     * @param {JQuery} parent
     * @param {ArrayBuffer} buf
     * @param {object} sensors
     */
    function parseData(parent, buf, sensors) {
        const dv = new DataView(buf);
        let obj = {};

        for (let i = 0; i < buf.byteLength; i += 10) {
            const key = dv.getUint16(i + 8, true);
            const timestamp = dv.getUint32(i, true);
            const value = dv.getFloat32(i + 4, true);

            if (typeof obj[key] === "undefined") {
                const sensor = sensors.find((s) => s.uuid == key);
                obj[key] = { sensor: sensor, data: [] };
            }

            obj[key].data.push({ x: new Date(timestamp * 1000), y: value });
        }

        const keys = Object.keys(obj).sort((a, b) => {
            const aActive = !!obj[a].sensor;
            const bActive = !!obj[b].sensor;
            if (aActive !== bActive) {
                return aActive ? -1 : 1;
            }
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        download = () => {
            let csvContent = "sensor_uuid,sensor_name,timestamp,value,unit\n";

            for (const key of keys) {
                const sensor = obj[key].sensor;
                const sensorName = sensor ? sensor.name : "unknown";
                let unit = "unknown";
                if (sensor && OSApp.currentSession.controller.sensor_desc) {
                    const unitObj = OSApp.currentSession.controller.sensor_desc.units.find(u => u.value === sensor.unit);
                    unit = unitObj ? (unitObj.short || unitObj.name) : "unknown";
                }

                obj[key].data.forEach((v) => {
                    csvContent += `${key},"${sensorName}",${v.x.getTime()},${v.y},${unit}\n`;
                });
            }

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            if (link.download !== undefined) {
                const today = new Date().toISOString().slice(0, 10);
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `sensorlog-${today}.csv`);
                link.style.visibility = "hidden";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };

        for (const key of keys) {
            if (showCurrentOnly && !obj[key].sensor) {
                continue;
            }

            const $card = $("<div>").addClass("sensor-log-card");
            if (!obj[key].sensor) {
                $card.addClass("sensor-log-card-inactive");
            }
            parent.append($card);

            const $chartContainer = $("<div>").addClass("sensor-log-chart-container");
            const $canvas = $("<canvas></canvas>");
            $chartContainer.append($canvas);
            $card.append($chartContainer);
            $canvas.on( "swiperight swipeleft", function( e ) {
                e.stopImmediatePropagation();
            } );
            const activeSensor = obj[key].sensor;
            const sn = activeSensor
                ? { ...activeSensor, name: `${activeSensor.name} (UUID: ${activeSensor.uuid})` }
                : { name: `Unknown (UUID: ${key})`, unit: 0 };
            const unitLabel = (activeSensor && OSApp.currentSession.controller.sensor_desc)
                ? (OSApp.currentSession.controller.sensor_desc.units.find(u => u.value === activeSensor.unit) || {}).short || ""
                : "";
            const chart = createChart($canvas[0], sn, unitLabel);
            activeCharts.push(chart);

            let chartSince = new Date();
                chartSince.setDate(chartSince.getDate() - 1);

                const update = function () {
                    chart.data = {
                        datasets: [
                            {
                                data: chartSince ? obj[key].data.filter(v => v.x >= chartSince) : obj[key].data,
                            }
                        ]
                    };

                    chart.resetZoom();
                    chart.update();
                };

                var $controls = $("<div>", {
                    "data-role": "controlgroup",
                    "data-type": "horizontal"
                });

                const $resetZoom = $('<input type="button" value="Reset">');
                $resetZoom.on("click", () => {
                    chart.resetZoom();
                });

                const $download = $('<input type="button" value="Download">');
                $download.on("click", () => {
                    const sensorName = activeSensor ? activeSensor.name : "unknown";
                    let unit = "unknown";
                    if (activeSensor && OSApp.currentSession.controller.sensor_desc) {
                        const unitObj = OSApp.currentSession.controller.sensor_desc.units.find(u => u.value === activeSensor.unit);
                        unit = unitObj ? (unitObj.short || unitObj.name) : "unknown";
                    }

                    let csvContent = "sensor_uuid,sensor_name,timestamp,value,unit\n";
                    obj[key].data.forEach((v) => {
                        csvContent += `${key},"${sensorName}",${v.x.getTime()},${v.y},${unit}\n`;
                    });

                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const link = document.createElement("a");
                    if (link.download !== undefined) {
                        const today = new Date().toISOString().slice(0, 10);
                        const safeName = activeSensor
                            ? activeSensor.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
                            : "unknown";
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute("download", `${safeName}-uuid-${key}-${today}.csv`);
                        link.style.visibility = "hidden";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                });

                const $deleteLogs = $('<input type="button" value="Delete">');
                $deleteLogs.on("click", () => {
                    OSApp.UIDom.areYouSure(
                        OSApp.Language._("Are you sure you want to delete the log for") + " " + sn.name + "?",
                        "",
                        () => {
                            $.mobile.loading("show");
                            OSApp.Firmware.sendToOS(`/dsl?pw=&uuid=${key}`)
                                .done(() => {
                                    updateContent();
                                })
                                .fail(() => {
                                    OSApp.Errors.showError(OSApp.Language._("Delete may have timed out — reloading data."));
                                    updateContent();
                                });
                        }
                    );
                });

                const $threeHour = $('<input type="button" value="3H">');
                $threeHour.on("click", () => {
                    chartSince = new Date();
                    chartSince.setHours(chartSince.getHours() - 3);
                    update();
                });
                const $day = $('<input type="button" value="1D">');
                $day.on("click", () => {
                    chartSince = new Date();
                    chartSince.setDate(chartSince.getDate() - 1);
                    update();
                });
                const $week = $('<input type="button" value="1W">');
                $week.on("click", () => {
                    chartSince = new Date();
                    chartSince.setDate(chartSince.getDate() - 7);
                    update();
                });
                const $month = $('<input type="button" value="1M">');
                $month.on("click", () => {
                    chartSince = new Date();
                    chartSince.setMonth(chartSince.getMonth() - 1);
                    update();
                });

                const $all = $('<input type="button">').val(OSApp.Language._("All"));
                $all.on("click", () => {
                    chartSince = null;
                    update();
                });

                $controls.append($threeHour, $day, $week, $month, $all, $resetZoom, $download, $deleteLogs);

                const $controlsWrap = $("<div>").addClass("sensor-chart-controls");
                $controlsWrap.append($controls);
                $card.append($controlsWrap);

                $controls.controlgroup();
                $deleteLogs.button();
                $deleteLogs.closest( ".ui-btn" ).addClass( "sensor-log-delete-btn" );
                $download.button();
                $resetZoom.button();

                update();
        }
    }

    function applyFilter() {
        if (!showCurrentOnly && !allCardsRendered && cachedData) {
            allCardsRendered = true;
            activeCharts.forEach(c => c.destroy());
            activeCharts = [];
            $cards.empty();
            parseData($cards, cachedData, OSApp.currentSession.controller.sensors.sn);
        }
        $cards.find(".sensor-log-card-inactive").toggle(!showCurrentOnly);
    }

    function renderCards() {
        if (!cachedData) return;
        activeCharts.forEach(c => c.destroy());
        activeCharts = [];
        $cards.empty();
        parseData($cards, cachedData, OSApp.currentSession.controller.sensors.sn);
        allCardsRendered = !showCurrentOnly;
        applyFilter();
    }

    function updateContent() {
        const seq = ++requestSeq;
        $.mobile.loading("show");

        const jslRequest = OSApp.Firmware.sendToOS("/jsl?pw=&fmt=binary&count=max", "arraybuffer");
        const jsdRequest = OSApp.currentSession.controller.sensor_desc
            ? $.Deferred().resolve(OSApp.currentSession.controller.sensor_desc).promise()
            : OSApp.Firmware.sendToOS("/jsd?pw=", "json").then((data) => OSApp.Sensors.normalizeJsd(data));

        $.when(jslRequest, jsdRequest)
            .done((buf, jsdData) => {
                if (seq !== requestSeq) return;
                $.mobile.loading("hide");
                OSApp.currentSession.controller.sensor_desc = jsdData;
                cachedData = buf;
                renderCards();
            })
            .fail(() => {
                if (seq !== requestSeq) return;
                $.mobile.loading("hide");
                OSApp.Errors.showError(OSApp.Language._("Failed to load sensor logs"));
            });
    }

    page
		.on( "programrefresh", updateContent )
		.on( "pagehide", function() {
			page.detach();
		} )
		.on( "pagebeforeshow", function() {} );

    function begin() {
		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Sensor Logs" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.checkChangesBeforeBack
			},
			rightBtn: {
				icon: "refresh",
				text: OSApp.Language._( "Refresh" ),
				on: updateContent
			}

		} );

        $filterDiv.find("input[type='checkbox']").on("change", function() {
            showCurrentOnly = !this.checked;
            applyFilter();
        });

        $filterDiv.find(".sensor-log-download-btn").on("click", () => download()).button()
            .parent().addClass("sensor-log-download-btn");

        $filterDiv.find(".sensor-log-delete-all-btn").on("click", () => {
            OSApp.UIDom.areYouSure(
                OSApp.Language._("Are you sure you want to delete all sensor logs?"),
                "",
                () => {
                    $.mobile.loading("show");
                    OSApp.Firmware.sendToOS("/dsl?pw=&uuid=-1")
                        .done(() => { updateContent(); })
                        .fail(() => {
                            OSApp.Errors.showError(OSApp.Language._("Delete may have timed out — reloading data."));
                            updateContent();
                        });
                }
            );
        }).button().parent().addClass("sensor-log-delete-all-btn");

		updateContent();

		$( "#sensor-logs" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
};

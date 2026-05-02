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
    const units = data.units.sort((a, b) => a.index - b.index).reduce((/** @type {Units[][]} */ acc, v) => {
        acc[v.group].push({
            name: v.short ? `${v.name} (${v.short})` : v.name,
            value: v.value
        });
        return acc;
    }, Array(data.enums["SensorUnitGroup"].length).fill(null).map(() => []));

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

        units.forEach((g, i) => {
            let $group = $("<optgroup></optgroup>")
                .attr("label", data["enums"]["SensorUnitGroup"][i]);

            g.forEach((v) => {
                let $unit = $("<option></option>")
                    .attr("value", v.value)
                    .text(v.name);

                $group.append($unit);
            });

            $select.append($group);
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

        function updateSelect() {
            const v = parseInt(String($select.val())) || 0;
            sensorOptions.forEach((_, i) => {
                sensorOptions[i].visibility(v == i);
            });
        }

        updateSelect();

        $select.on("input", () => {
            updateSelect();
        });

        return {
            get: () => coerceVal($select.val()),
            set: (val) => {
                $select.val(val);
                $select.selectmenu('refresh');
                updateSelect();
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
    function appendHelpIcon($label, hint) {
        if (!hint) return;
        const $help = $('<button type="button" class="help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext"></button>')
            .attr("data-helptext", hint)
            .on("click", OSApp.UIDom.showHelpText);
        $label.append(" ", $help);
    }

    function createInput(argument, namespace, key, parent) {
        const parts = argument.type.split("::");

        const ns = `${namespace}-${argument.arg}`;
        const id = `${ns}-${key}`;

        const $label = $("<label></label>")
            .attr("for", id)
            .text(argument.name);
        appendHelpIcon($label, argument.hint);

        switch (parts[0]) {
            case "enum": {
                parent.append($label);
                const value = createEnumSelect(parts[1], id, parent);
                value.set(argument.default);

                return {
                    reset: () => value.set(argument.default),
                    add: (params) => {
                        const val = value.get();
                        if (typeof val != "undefined") {
                            params.append(argument.arg, val);
                        }

                        return val;
                    },
                    update: (val) => value.set(val),
                    validate: () => value.validate(),
                };
            }
            case "sensor": {
                parent.append($label);
                const value = createSensorSelect(uuid, id, parent);
                value.set(argument.default);

                return {
                    reset: () => value.set(argument.default),
                    add: (params) => {
                        const val = value.get();
                        if (typeof val != "undefined") {
                            params.append(argument.arg, val);
                        }

                        return val;
                    },
                    update: (val) => value.set(val),
                    validate: () => value.validate(),
                };
            }
            case "type": {
                parent.append($label);
                const value = createTypeSelect(id, parent);
                value.set(argument.default);

                return {
                    reset: () => value.set(argument.default),
                    add: (params) => {
                        const val = value.get();
                        if (typeof val != "undefined") {
                            params.append(argument.arg, val);
                        }

                        return val;
                    },
                    update: (val) => value.set(val),
                    validate: () => value.validate(),
                };
            }
            case "unit": {
                parent.append($label);
                const value = createUnitSelect(id, parent);
                value.set(argument.default);

                return {
                    reset: () => value.set(argument.default),
                    add: (params) => {
                        const val = value.get();
                        if (typeof val != "undefined") {
                            params.append(argument.arg, val);
                        }

                        return val;
                    },
                    update: (val) => value.set(val),
                    validate: () => value.validate(),
                };
            }
            case "string": {
                parent.append($label);
                const value = createStringInput(parts[1], id, parent);
                if (argument._placeholder) {
                    parent.find(`#${id}`).attr("placeholder", argument._placeholder);
                }
                value.set(argument.default);

                return {
                    reset: () => value.set(argument.default),
                    add: (params) => {
                        const val = value.get();
                        if (typeof val != "undefined") {
                            params.append(argument.arg, val);
                        }

                        return val;
                    },
                    update: (val) => value.set(val),
                    validate: () => value.validate(),
                };
            }
            case "int": {
                parent.append($label);
                const value = createIntInput(parts[1], id, parent);
                value.set(argument.default);

                return {
                    reset: () => value.set(argument.default),
                    add: (params) => {
                        const val = value.get();
                        if (typeof val != "undefined") {
                            params.append(argument.arg, val);
                        }

                        return val;
                    },
                    update: (val) => value.set(val),
                    validate: () => value.validate(),
                };
            }
            case "float":
            case "double": {
                parent.append($label);
                const value = createDoubleInput(parts[1], id, parent);
                value.set(argument.default);

                return {
                    reset: () => value.set(argument.default),
                    add: (params) => {
                        const val = value.get();
                        if (typeof val != "undefined") {
                            params.append(argument.arg, val);
                        }

                        return val;
                    },
                    update: (val) => value.set(val),
                    validate: () => value.validate(),
                };
            }
            case "flag": {
                parent.append($label);
                const value = createFlagInput(id, parent);
                value.set(argument.default);

                return {
                    reset: () => value.set(argument.default),
                    add: (params) => {
                        const val = value.get();
                        if (typeof val != "undefined") {
                            params.append(argument.arg, val);
                        }

                        return val;
                    },
                    update: (val) => value.set(val),
                    validate: () => value.validate(),
                };
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

        /** @type {Map<string, ParamUpdater>} */
        const values = sensor.args.reduce((acc, v) => {
            const $fieldWrap = $('<div class="ui-field-contain"></div>').appendTo($content);
            acc.set(v.arg, createInput(v, `sensor-${i}`, key, $fieldWrap));

            return acc;
        }, new Map());

        let visible = true;

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
            visibility: (value) => {
                visible = value;
                if ($ui) {
                    if (value) {
                        $ui.show();
                    } else {
                        $ui.hide();
                    }
                }
            },
            is_visible: () => visible,
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
            appendHelpIcon($lbl, arg.hint);
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
        $div.find(".ui-collapsible-heading-toggle").addClass(isEnabled ? "blue" : "red");

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
            : OSApp.Firmware.sendToOS("/jsd?pw=", "json").then((data) => data);

        $.mobile.loading("show");
        jsdRequest
            .done((jsdData) => {
                OSApp.currentSession.controller.sensor_desc = jsdData;
                content.empty();
                const count = OSApp.currentSession.controller.sensors.sn.length;
                content.append("<p class='center'>" + OSApp.Language._("Click below to expand/edit. Be sure to save changes.") + "</p>");
                content.append("<p class='center'>" + OSApp.Language._("Number of Sensors") + ": " + count + "</p>");
                OSApp.currentSession.controller.sensors.sn.forEach((v) => {
                    createSensorCollapse(content, jsdData, v);
                });
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
            }
        };

        return page;
    }

    function updateContent () {
        const jsdRequest = OSApp.currentSession.controller.sensor_desc
            ? $.Deferred().resolve(OSApp.currentSession.controller.sensor_desc).promise()
            : OSApp.Firmware.sendToOS("/jsd?pw=", "json").then((data) => data);

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
            : OSApp.Firmware.sendToOS("/jsd?pw=", "json").then((data) => data);

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

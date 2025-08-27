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
 * @param {string} sid
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

OSApp.Sensors.makeSensorSelect = function ($select, sid) {
    $select.append($("<option></option>")
            .attr("value", "255")
            .text("No Sensor"));

    if (sid) {
        $select.append($("<option></option>")
                .attr("value", "-1")
                .text("This Sensor"));
    }

    OSApp.currentSession.controller.sensors.sn.forEach((v) => {
        if (!sid || v.sid != sid) {
            const $option = $('<option></option>')
                .attr("value", v.sid)
                .text(`${v.name} (ID: ${v.sid})`);

            $select.append($option);
        }
    });
}

OSApp.Sensors.createSensorPage = function (parent, sid, data) {
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

        data["sensor"].forEach((v, i) => {
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
     * @param {string} sid
     * @param {string} id
     * @param {JQuery} parent
     * @returns {GetterSetter}
     */
    function createSensorSelect(sid, id, parent) {
        const $select = $('<select></select>').attr("id", id);
        parent.append($select);

        OSApp.Sensors.makeSensorSelect($select, sid);

        $select.selectmenu();

        return {
            get: () => coerceVal($select.val()),
            set: (val) => {
                if (sid && val == sid) {
                    val = "-1";
                }

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
                $input.prop('checked', val == "true")
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
    function createInput(argument, namespace, key, parent) {
        const parts = argument.type.split("::");

        const ns = `${namespace}-${argument.arg}`;
        const id = `${ns}-${key}`;

        const $label = $("<label></label>")
            .attr("for", id)
            .text(argument.name);

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
                const value = createSensorSelect(sid, id, parent);
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
                const count = Number.parseInt(parts[1]);
                parent.append($('<span></span>').text(argument.name));
                if (!isNaN(count)) {
                    for (let index = 0; index < count; index++) {
                        const $button = $('<input type="button">')
                            .val(index)
                            .attr('id', `popup-btn-${ns}-${index}-${key}`);

                        const $popup = $('<div data-overlay-theme="a" class="ui-page-theme-a"></div>')
                            .attr('id', `popup-container-${ns}-${index}-${key}`)
                            .addClass('ui-content');

                        parent.append($button, $popup);

                        /**
                         * @type {Map<string, ParamUpdater>}  // an array of numbers
                         */
                        const values = new Map();

                        argument.extra.forEach((v, i) => values.set(v.arg, createInput({...v, arg: `${i}`}, `${ns}-${index}`, key, $popup)));

                        arrayValues.push(values);

                        $popup.popup();

                        $popup.on("popupafterclose", () => {
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

                            if (ret || empty) {
                                $button.removeClass("red");
                            } else {
                                $button.addClass("red");
                            }
                        });

                        $button.button();
                        $button.on("click", function() {
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
    function createSensorSegment(sensor, i, key, parent) {
        const $ui = $('<div class="ui-corner-all"></div>');
        const $bar = $('<div class="ui-bar ui-bar-a"></div>');
        $bar.append($("<h3></h3>").text(`${sensor.name} Options`))
        const $content = $('<div class="ui-body ui-body-a"></div>');

        $ui.append($bar, $content);


        parent.append($ui);

        /** @type {Map<string, ParamUpdater>} */
        const values = sensor.args.reduce((acc, v) => {
            acc.set(v.arg, createInput(v, `sensor-${i}`, key, $content));

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
                if (value) {
                    $ui.show()
                } else {
                    $ui.hide()
                }
            },
            is_visible: () => visible,
        };
    }

    const baseOptions = data.base.map((v, i) => createSensorSegment(v, `base-${i}`, sid, parent));
    sensorOptions = data.sensor.map((v, i) => {
        let ret = createSensorSegment(v, `sen-${i}`, sid, parent);

        ret.visibility(i == 0);
        return ret;
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
            name: v[0],
            arg: `${i}`,
            type: "flag",
            default: v[1],
            extra: [],
        });
    });

    const flagOption = createSensorSegment(flagSegment, "0", sid, parent);

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

        params.set("flags", `${flag}`);
    }

    /**
     *
     * @param {number} flags
     */
    function getFlags(flags) {
        const tempParams = new URLSearchParams();
        flagOption.add(tempParams);
        for (const [k, v] of tempParams.entries()) {
            const bit = Number.parseInt(k);

            if (Number.isInteger(bit) && v == "true") {
                flagOption.update(k, (((flags >> bit) & 1) == 1) ? "true" : "false")
            }
        }
    }

    return {
        getURL: function () {
            const params = new URLSearchParams();
            if (!baseOptions.every((v) => v.add(params))) return undefined;
            if (!sensorOptions.filter((v) => v.is_visible()).every((v) => v.add(params))) return undefined;
            setFlags(params);
            params.append("pw", "");
            params.append("sid", sid || "-1");
            return `/csn?${params.toString()}`;
        },
        update: function (data) {
            for (const [key, value] of Object.entries(data)) {
                switch (key) {
                    case "flags":
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
}

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

}

OSApp.Sensors.deleteSensor = function (sid) {
    $.mobile.loading( "show" );
    OSApp.Firmware.sendToOS(`/dsn?pw=&sid=${sid}`).done(() => {
        OSApp.Sites.updateControllerSensors(() => {
            $.mobile.loading( "hide" );
            $( "#sensors" ).trigger( "programrefresh" );
            OSApp.Errors.showError( OSApp.Language._( "Sensor deleted successfully" ) );
        });
    });
}

OSApp.Sensors.displayPage = function (callback) {
    const page = $(`<div data-role="page" id="sensors"></div>`);
	const content = $(`<div class="ui-content" role="main" id="sensors_list"></div>`);
    page.append(content);

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
        $header.text(`${sensorData["name"]} (ID: ${sensorData["sid"]})`)
        const $inner = $("<div></div>");

        parent.append($div);
        $div.append($header, $inner);
        $div.collapsible();

        const page = OSApp.Sensors.createSensorPage($inner, sensorData["sid"], data);
        page.update(sensorData);

        const $update = $('<input type="button">').val("Update Sensor");
        $inner.append($update);
        $update.button({icon: "edit"});
        $update.on("click", () => {
            const url = page.getURL();
            if (url) {
                OSApp.Sensors.changeSensor(url, false);
            }
        });

        const $delete = $('<input type="button" class="red">').val("Delete Sensor");
        $inner.append($delete);
        $delete.button({icon: "delete"});
        $delete.on("click", () => {
            OSApp.Sensors.deleteSensor(sensorData["sid"])
        });

        return page;
    }

    function updateContent () {
        page.empty();
        OSApp.currentSession.controller.sensors.sn.forEach((v) => {
            createSensorCollapse(page, OSApp.currentSession.controller.sensor_desc, v)
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
			title: OSApp.Language._( "Sensors" ),
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
}

OSApp.Sensors.addSensor = function (callback) {
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
        const page = OSApp.Sensors.createSensorPage(parent, "", data);
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
        page.empty();

        createAddSensor(page, OSApp.currentSession.controller.sensor_desc)
    }

    page
		.on( "programrefresh", updateContent )
		.on( "pagehide", function() {
			page.detach();
		} )
		.on( "pagebeforeshow", function() {} );

    function begin() {
		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Add Sensor" ),
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
                    submit()
                }
			}

		} );

		updateContent();

		$( "#add-sensor" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
}

OSApp.Sensors.displayLogs = function (callback) {
    const page = $(`<div data-role="page" id="sensor-logs"></div>`);
	const content = $(`<div class="ui-content" role="main"></div>`);
    page.append(content);

    function createChart(canvas, sn) {
    const sensorGraph = new Chart(canvas, {
                type: 'line',
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                displayFormats: {
                                    quarter: 'MMM YYYY'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Sensor Value'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: `${OSApp.currentSession.controller.sensor_desc.units[sn.unit].short}`
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: sn.name
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
     * @param {string} csv
     * @param {object} sensors
     */
    function parseData(parent, csv, sensors) {
        const lines = csv.split("\n");
        let obj = lines.reduce((acc, v) => {
            if (v == "") return acc;

            const parts = v.split(",");
            const key = parseInt(parts[0], 16);

            if (typeof acc[key] == "undefined") acc[key] = {sensor: sensors.find((v) => v.sid == key), data: []};

            let uint = parseInt(parts[2], 16);
            let buffer = new ArrayBuffer(4);
            let view = new DataView(buffer);
            view.setUint32(0, uint);

            acc[key].data.push({ x: new Date(parseInt(parts[1], 16) * 1000), y: view.getFloat32(0)});
            return acc;
        }, {});

        download = () => {
            let csvContent = "sensor_id,timestamp,value,unit\n";

            for (const key in obj) {
                let unit = "unknown";
                if (obj[key].sensor) {
                    unit = OSApp.currentSession.controller.sensor_desc.units[obj[key].sensor.unit].short;
                }

                obj[key].data.forEach((v) => {
                    csvContent += `${key},${v.x.getTime()},${v.y},${unit}\n`;
                });
            }

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

            const link = document.createElement("a");
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", "data.csv");
                link.style.visibility = "hidden";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }

        for (const key in obj) {
            if (obj[key].sensor) {
                const $canvas = $("<canvas></canvas>");
                parent.append($canvas);
                const chart = createChart($canvas[0], obj[key].sensor);

                let chartSince = new Date();
                chartSince.setDate(chartSince.getDate() - 1);

                const update = function () {
                    chart.data = {
                        datasets: [
                            {
                                data: obj[key].data.filter(v => v.x >= chartSince),
                            }
                        ]
                    };

                    chart.resetZoom();
                    chart.update();
                }

                var $controls = $("<div>", {
                    "data-role": "controlgroup",
                    "data-type": "horizontal"
                });

                const $resetZoom = $('<input type="button" value="Reset Zoom">');
                $controls.append($resetZoom);
                $resetZoom.on("click", () => {
                    chart.resetZoom();
                });

                const $download = $('<input type="button" value="Download Logs">');
                $controls.append($download);
                $download.on("click", () => {
                    let csvContent = "sensor_id,timestamp,value,unit\n";

                    let unit = "unknown";
                    if (obj[key].sensor) {
                        unit = OSApp.currentSession.controller.sensor_desc.units[obj[key].sensor.unit].short;
                    }

                    obj[key].data.forEach((v) => {
                        csvContent += `${key},${v.x.getTime()},${v.y},${unit}\n`;
                    });

                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

                    const link = document.createElement("a");
                    if (link.download !== undefined) {
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute("download", "data.csv");
                        link.style.visibility = "hidden";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                });

                const $deleteLogs = $('<input type="button" value="Delete Logs">');
                $controls.append($deleteLogs);
                $deleteLogs.on("click", () => {
                    console.log(`/csl?pw=&sid=${key}`);
                });

                const $day = $('<input type="button" value="1 Day">');
                $controls.append($day);
                $day.on("click", () => {
                    chartSince = new Date();
                    chartSince.setDate(chartSince.getDate() - 1);
                    update();
                });
                const $week = $('<input type="button" value="1 Week">');
                $controls.append($week);
                $week.on("click", () => {
                    chartSince = new Date();
                    chartSince.setDate(chartSince.getDate() - 7);
                    update();
                });
                const $month = $('<input type="button" value="1 Month">');
                $controls.append($month);
                $month.on("click", () => {
                    chartSince = new Date();
                    chartSince.setMonth(chartSince.getMonth() - 1);
                    update();
                });
                const $year = $('<input type="button" value="1 Year">');
                $controls.append($year);
                $year.on("click", () => {
                    chartSince = new Date();
                    chartSince.setFullYear(chartSince.getFullYear() - 1);
                    update();
                });


                parent.append($controls);

                $controls.controlgroup();
                $deleteLogs.button();
                $download.button();
                $resetZoom.button();

                update();
            }
        }
    }

    function updateContent() {
        OSApp.Firmware.sendToOS("/lsn?pw=&count=32768").done((csv) => {
            page.empty();
            parseData(page, csv, OSApp.currentSession.controller.sensors.sn);
        })
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
				icon: "check",
				text: OSApp.Language._( "Download CSV" ),
				on: () => {
                    download()
                }
			}

		} );

		updateContent();

		$( "#sensor-logs" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
}
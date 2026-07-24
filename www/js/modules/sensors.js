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

// Status bitfield reported by /jsn for each sensor.
OSApp.Sensors.STATUS = { VALID: 1, ERROR: 2, STALE: 4, CLAMPED_HIGH: 8, CLAMPED_LOW: 16 };

// Format a sensor reading for display. Returns text + a CSS class name driven
// by the sensor status bitfield. Used by both the Edit Sensors page and the
// homepage show-on-home cards.
OSApp.Sensors.formatValue = function (value, unitShort, status) {
    const S = OSApp.Sensors.STATUS;
    if (!(status & S.VALID)) {
        return { text: "—", cls: "" };
    }
    let text = value + (unitShort ? " " + unitShort : "");
    let cls = "sensor-value-valid";
    if ((status & S.ERROR) || (status & S.STALE)) {
        text += " ⚠";
        cls = "sensor-value-warning";
    } else if (status & S.CLAMPED_HIGH) {
        text += " ⊤";
        cls = "sensor-value-clamped";
    } else if (status & S.CLAMPED_LOW) {
        text += " ⊥";
        cls = "sensor-value-clamped";
    }
    return { text: text, cls: cls };
};

// Look up a unit's short label (e.g. "V") from the cached /jsd description.
OSApp.Sensors.unitShort = function (unitValue) {
    const desc = OSApp.currentSession.controller.sensor_desc;
    if (!desc || !Array.isArray(desc.units)) return "";
    const u = desc.units.find((x) => x.value === unitValue);
    return u ? (u.short || u.name || "") : "";
};

// Build one RFC4180 CSV row. Text fields are also neutralized against
// spreadsheet formulas, while timestamps match firmware's Unix-second wire format.
OSApp.Sensors.formatLogCsvRow = function (uuid, sensorName, timestamp, value, unit) {
    function csvText(textValue) {
        let text = String(textValue);
        if (/^[\t\r]/.test(text) || /^\s*[=+\-@]/.test(text)) {
            text = "'" + text;
        }
        return `"${text.replace(/"/g, '""')}"`;
    }

    const timestampMilliseconds = timestamp instanceof Date ? timestamp.getTime() : Number(timestamp);
    const timestampSeconds = Math.floor(timestampMilliseconds / 1000);
    return `${uuid},${csvText(sensorName)},${timestampSeconds},${value},${csvText(unit)}`;
};

OSApp.Sensors.LOG_CHART_RANGES = { "3h": 0, "1d": 1, "1w": 2, "1m": 3, all: 4 };
OSApp.Sensors.LOG_PAGE_SIZE = 5000;
OSApp.Sensors.LOG_LINUX_PAGE_SIZE = 100000;
OSApp.Sensors.LOG_PAGE_RETRY_LIMIT = 2;
OSApp.Sensors.LOG_DELETE_PAGE_SIZE = 16384;

OSApp.Sensors.getLogPageSize = function () {
    const hardware = OSApp.Firmware.getHWVersion();
    return OSApp.Firmware.isOSPi() || hardware === "OSPi" || hardware === "Linux" || hardware === "Demo"
        ? OSApp.Sensors.LOG_LINUX_PAGE_SIZE
        : OSApp.Sensors.LOG_PAGE_SIZE;
};

OSApp.Sensors.fetchAllLogPages = function (options) {
    options = options || {};
    const deferred = $.Deferred();
    const buffers = [];
    let byteLength = 0;
    let cursor = 0;
    let totalSlots = null;
    let windowStart = null;
    let windowEnd = null;
    let retryCount = 0;
    const pageSize = OSApp.Sensors.getLogPageSize();
    const signal = options.signal;
    const hasWindow = options.after !== undefined || options.before !== undefined;
    const after = Number(options.after);
    const before = Number(options.before);

    function reject(statusText) {
        deferred.reject({ status: 0, statusText: statusText });
    }

    function isCurrent() {
        return (!signal || !signal.aborted) &&
            (typeof options.isCurrent !== "function" || options.isCurrent());
    }

    function isTransientFailure(error) {
        if (error && typeof error.result === "number") return false;
        return !error || (error.status == null && error.statusText == null) ||
            error.status === 0 || error.status >= 500 ||
            error.statusText === "timeout" || error.statusText === "error";
    }

    function readIntegerHeader(headers, name) {
        const value = headers && typeof headers.get === "function" ? headers.get(name) : null;
        if (value == null || !/^\d+$/.test(value)) return null;
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) ? parsed : null;
    }

    function combineBuffers() {
        const combined = new Uint8Array(byteLength);
        let offset = 0;
        buffers.forEach((buffer) => {
            combined.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
        });
        return combined.buffer;
    }

    function requestPage() {
        if (!isCurrent()) {
            reject(signal && signal.aborted ? "abort" : "stale");
            return;
        }

        const windowParams = hasWindow ? `&after=${after}&before=${before}` : "";
        const url = `/jsl?pw=&page=1${windowParams}&cursor=${cursor}&count=${pageSize}&fmt=binary`;
        OSApp.Firmware.sendToOS(url, "arraybuffer-response", { signal: signal })
            .done((response) => {
                if (!isCurrent()) {
                    reject(signal && signal.aborted ? "abort" : "stale");
                    return;
                }
                retryCount = 0;

                const buffer = response && response.data;
                if (!(buffer instanceof ArrayBuffer)) {
                    reject("parsererror");
                    return;
                }
                if (buffer.noLogHeader) {
                    deferred.resolve(buffer);
                    return;
                }

                const nextCursor = readIntegerHeader(response.headers, "X-OS-Next-Cursor");
                const pageTotal = readIntegerHeader(response.headers, "X-OS-Total-Slots");
                const doneValue = readIntegerHeader(response.headers, "X-OS-Page-Done");
                const pageWindowStart = hasWindow
                    ? readIntegerHeader(response.headers, "X-OS-Window-Start") : null;
                const pageWindowEnd = hasWindow
                    ? readIntegerHeader(response.headers, "X-OS-Window-End") : null;
                if (nextCursor == null || pageTotal == null || (doneValue !== 0 && doneValue !== 1) ||
                    (hasWindow && (pageWindowStart == null || pageWindowEnd == null ||
                        pageWindowEnd < pageWindowStart)) ||
                    nextCursor < cursor || (!doneValue && nextCursor === cursor)) {
                    reject("parsererror");
                    return;
                }

                if (totalSlots == null) totalSlots = pageTotal;
                if (hasWindow && windowStart == null) {
                    windowStart = pageWindowStart;
                    windowEnd = pageWindowEnd;
                }
                try {
                    if (typeof options.onPage === "function") options.onPage(buffer);
                } catch (error) {
                    deferred.reject(error);
                    return;
                }
                if (options.collect !== false) {
                    buffers.push(buffer);
                    byteLength += buffer.byteLength;
                }

                const processed = hasWindow ? Math.max(0, nextCursor - windowStart) : nextCursor;
                const progressTotal = hasWindow ? windowEnd - windowStart : totalSlots;
                const progress = progressTotal === 0
                    ? (hasWindow ? 1 : (doneValue ? 1 : 0))
                    : Math.min(1, Math.max(0, processed / progressTotal));
                try {
                    if (typeof options.onProgress === "function") {
                        options.onProgress(progress, processed, progressTotal);
                    }
                } catch (error) {
                    deferred.reject(error);
                    return;
                }

                if (doneValue === 1) {
                    deferred.resolve(options.collect === false ? new ArrayBuffer(0) : combineBuffers());
                    return;
                }

                cursor = nextCursor;
                setTimeout(requestPage, 0);
            })
            .fail((error) => {
                if (!isCurrent()) {
                    reject(signal && signal.aborted ? "abort" : "stale");
                    return;
                }
                if (retryCount < OSApp.Sensors.LOG_PAGE_RETRY_LIMIT && isTransientFailure(error)) {
                    retryCount++;
                    setTimeout(requestPage, 0);
                    return;
                }
                deferred.reject(error);
            });
    }

    if (hasWindow && (!Number.isSafeInteger(after) || !Number.isSafeInteger(before) || after > before)) {
        reject("parsererror");
        return deferred.promise();
    }
    requestPage();
    return deferred.promise();
};

OSApp.Sensors.deleteLogPages = function (uuid, options) {
    options = options || {};
    const deferred = $.Deferred();
    const signal = options.signal;
    let cursor = 0;
    let totalSlots;
    let deletedTotal = 0;

    function reject(statusText) {
        deferred.reject({ status: 0, statusText: statusText });
    }

    function isCurrent() {
        return (!signal || !signal.aborted) &&
            (typeof options.isCurrent !== "function" || options.isCurrent());
    }

    function isUnsignedInteger(value) {
        return Number.isSafeInteger(value) && value >= 0;
    }

    function abort() {
        reject("abort");
    }

    function shouldStop() {
        return typeof options.shouldStop === "function" && options.shouldStop();
    }

    function resolveStopped() {
        deferred.resolve({ deleted: deletedTotal, stopped: true });
    }

    function requestPage() {
        if (!isCurrent()) {
            reject(signal && signal.aborted ? "abort" : "stale");
            return;
        }
        if (shouldStop()) {
            resolveStopped();
            return;
        }

        const remaining = totalSlots === undefined
            ? OSApp.Sensors.LOG_DELETE_PAGE_SIZE
            : totalSlots - cursor;
        if (remaining <= 0) {
            deferred.resolve({ deleted: deletedTotal, stopped: false });
            return;
        }

        const count = Math.min(OSApp.Sensors.LOG_DELETE_PAGE_SIZE, remaining);
        const url = `/dsl?pw=&uuid=${uuid}&page=1&cursor=${cursor}&count=${count}`;
        OSApp.Firmware.sendToOS(url, "json", { signal: signal })
            .done((response) => {
                if (!isCurrent()) {
                    reject(signal && signal.aborted ? "abort" : "stale");
                    return;
                }

                if (!response || response.result !== 1 || !isUnsignedInteger(response.next) ||
                    !isUnsignedInteger(response.total) || !isUnsignedInteger(response.deleted) ||
                    (response.done !== 0 && response.done !== 1)) {
                    reject("parsererror");
                    return;
                }

                if (totalSlots === undefined) totalSlots = response.total;
                deletedTotal += response.deleted;
                const processed = Math.min(response.next, totalSlots);
                try {
                    if (typeof options.onProgress === "function") {
                        options.onProgress({
                            processed: processed,
                            total: totalSlots,
                            deleted: deletedTotal,
                            percent: totalSlots === 0 ? 100 : Math.min(100, response.next * 100 / totalSlots)
                        });
                    }
                } catch (error) {
                    deferred.reject(error);
                    return;
                }

                if (response.done === 1 || response.next >= totalSlots) {
                    deferred.resolve({ deleted: deletedTotal, stopped: false });
                    return;
                }
                if (shouldStop()) {
                    resolveStopped();
                    return;
                }
                if (response.next <= cursor) {
                    reject("stalled");
                    return;
                }

                cursor = response.next;
                setTimeout(requestPage, 0);
            })
            .fail((error) => deferred.reject(error));
    }

    if (!Number.isSafeInteger(Number(uuid)) || Number(uuid) < 0) {
        reject("parsererror");
        return deferred.promise();
    }
    if (signal) signal.addEventListener("abort", abort, { once: true });
    deferred.always(() => {
        if (signal) signal.removeEventListener("abort", abort);
    });
    requestPage();
    return deferred.promise();
};

OSApp.Sensors.getChartRangeStart = function (range, nowSeconds) {
    if (range === "all") return null;

    const controllerNow = Number(nowSeconds);
    const now = Number.isFinite(controllerNow) && controllerNow > 0 ? controllerNow : Date.now() / 1000;
    switch (range) {
    case "3h":
        return Math.floor(now - 3 * 60 * 60);
    case "1w":
        return Math.floor(now - 7 * 24 * 60 * 60);
    case "1m":
        {
            const monthStart = new Date(now * 1000);
            monthStart.setMonth(monthStart.getMonth() - 1);
            return Math.floor(monthStart.getTime() / 1000);
        }
    default:
        return Math.floor(now - 24 * 60 * 60);
    }
};

OSApp.Sensors.getChartLogURL = function (range, nowSeconds) {
    const after = OSApp.Sensors.getChartRangeStart(range || "1d", nowSeconds);
    return "/jsl?pw=&fmt=binary&" + (after == null ? "" : `after=${after}&`) + "count=max";
};

OSApp.Sensors.filterLogPointsByRange = function (points, range, nowSeconds) {
    const rangeStart = OSApp.Sensors.getChartRangeStart(range, nowSeconds);
    if (rangeStart == null) return points;
    const rangeStartMilliseconds = rangeStart * 1000;
    return points.filter((point) => point.x >= rangeStartMilliseconds);
};

OSApp.Sensors.homeCardSignature = function () {
    const sensors = OSApp.currentSession.controller.sensors && OSApp.currentSession.controller.sensors.sn;
    if (!Array.isArray(sensors)) return "[]";
    return JSON.stringify(sensors.filter((s) => s.flag & 4).map((s) => [
        String(s.uuid),
        String(s.name),
        String(s.unit),
        s.flag & 4,
        OSApp.Sensors.unitShort(s.unit)
    ]));
};

// Bit 2 of sensor.flag = "show on home". Renders a single combined card
// containing all such sensors as rows. Rows carry data-sensor-uuid + data-unit
// so OSApp.Sensors.refreshHomeValues can update them on /ja datarefresh
// without rebuilding the DOM. Tapping anywhere on the card opens the Edit
// Sensors page.
OSApp.Sensors.renderHomeCards = function ($parent) {
    $parent.empty();
    $parent.attr("data-sensor-signature", OSApp.Sensors.homeCardSignature());
    const sensors = OSApp.currentSession.controller.sensors && OSApp.currentSession.controller.sensors.sn;
    if (!Array.isArray(sensors)) return;
    const visible = sensors.filter((s) => s.flag & 4);
    if (visible.length === 0) return;

    $parent.append($('<h3 class="sensor-home-header"></h3>').text(OSApp.Language._("Sensors")));

    const $card = $('<a class="card sensors-home-combined" href="#sensors"></a>');
    const $body = $('<div class="ui-body ui-body-a"></div>').appendTo($card);
    const $list = $('<div class="sensor-home-list"></div>').appendTo($body);

    visible.forEach((s) => {
        const unitShort = OSApp.Sensors.unitShort(s.unit);
        const status = s.status != null ? s.status : 1;
        const hasValue = typeof s.value !== "undefined" && s.value !== null;
        const { text, cls } = hasValue
            ? OSApp.Sensors.formatValue(s.value, unitShort, status)
            : { text: "—", cls: "" };
        const $row = $('<div class="sensor-home-row"></div>');
        $row.append($('<span class="sensor-home-name"></span>').text(s.name + ": "));
        $row.append(
            $('<span class="sensor-home-value"></span>')
                .text(text)
                .addClass(cls)
                .attr("data-sensor-uuid", s.uuid)
                .attr("data-unit", unitShort)
        );
        $list.append($row);
    });

    $card.on("click", function (e) {
        // The dashboard delegates ".card" clicks to show a station Duration
        // dialog; stop the bubble so it doesn't fire for our sensor card.
        e.preventDefault();
        e.stopPropagation();
        OSApp.UIDom.changePage("#sensors");
    });
    $parent.append($card);
};

// Update home-card values in place from the latest /ja sensor data.
OSApp.Sensors.refreshHomeValues = function ($parent) {
    const sensors = OSApp.currentSession.controller.sensors && OSApp.currentSession.controller.sensors.sn;
    if (!Array.isArray(sensors)) return;
    $parent.find("[data-sensor-uuid]").each(function () {
        const $el = $(this);
        const uuid = $el.attr("data-sensor-uuid");
        const sensor = sensors.find((s) => String(s.uuid) === uuid);
        if (!sensor) return;
        if (typeof sensor.value === "undefined" || sensor.value === null) {
            $el.text("—")
                .removeClass("sensor-value-valid sensor-value-warning sensor-value-clamped");
            return;
        }
        const unitShort = $el.attr("data-unit") || "";
        const status = sensor.status != null ? sensor.status : 1;
        const { text, cls } = OSApp.Sensors.formatValue(sensor.value, unitShort, status);
        $el.text(text)
            .removeClass("sensor-value-valid sensor-value-warning sensor-value-clamped")
            .addClass(cls);
    });
};

// Rebuild only when card structure changed; routine /ja refreshes update values
// in place so event handlers and enhanced DOM are preserved.
OSApp.Sensors.updateHomeCards = function ($parent) {
    const signature = OSApp.Sensors.homeCardSignature();
    if ($parent.attr("data-sensor-signature") !== signature) {
        OSApp.Sensors.renderHomeCards($parent);
        return;
    }
    OSApp.Sensors.refreshHomeValues($parent);
};

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
        sensors: (raw.sensors || []).map((s) => {
            const out = { name: s.n, args: (s.as || []).map(normArg) };
            // Optional firmware-detection flag: when hwd is present and 0,
            // the underlying hardware (e.g. ADS1115) wasn't found at boot.
            if ("hwd" in s) out.hardware_detected = !!s.hwd;
            // Optional firmware-disable flag: when dis is 1, the sensor type
            // cannot be selected (e.g. unsupported on this build).
            if ("dis" in s) out.disabled = !!s.dis;
            return out;
        }),
        units: (raw.units || []).map(normUnit),
        enums: raw.enums || {},
        args: (raw.as || []).map(normArg),
        flags: (raw.flags || []).map((f) => ({ name: f.n, default: f.d }))
    };
};

OSApp.Sensors.makeSensorSelect = function ($select) {
    $select.append($("<option></option>")
            .attr("value", "0")
            .text(OSApp.Language._("None")));

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

            // Firmware can mark a type as disabled (dis: 1) — keep it visible
            // for awareness but block selection.
            if (v.disabled) $option.prop("disabled", true);

            $select.append($option);

        });

        $select.selectmenu();

        // Hardware-detection warning shown when the currently-selected sensor
        // type's firmware reports `hwd: 0` (hardware not detected at boot).
        // Inserted as a sibling AFTER the field-contain so it doesn't share
        // the inline-block row with the dropdown.
        const $hwWarning = $('<p class="sensor-hw-missing"></p>')
            .text(OSApp.Language._("The required hardware for this type was not detected."))
            .hide();
        parent.after($hwWarning);

        function updateSelect(applyDefaults) {
            const v = parseInt(String($select.val())) || 0;
            // Tear down every segment before wiring the selected one.  A
            // segment's deactivation clears shared locks and unit filters, so
            // activating a lower-index segment first would let a subsequently
            // deactivated higher-index segment erase the new selection's
            // state.
            sensorOptions.forEach((segment) => segment.visibility(false, false));
            if (sensorOptions[v]) sensorOptions[v].visibility(true, applyDefaults);
            const sensor = data["sensors"][v];
            $hwWarning.toggle(!!sensor && sensor.hardware_detected === false);
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
                if (range[1] !== "any") $input.attr("min", range[1]);
                if (range[2] !== "any") $input.attr("max", range[2]);
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
                if (range[1] !== "any") {
                    $input.attr("minlength", range[1]);
                    if (parseInt(range[1]) > 0) $input.prop("required", true);
                }
                if (range[2] !== "any") $input.attr("maxlength", range[2]);
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
        const $input = $('<input type="number" step="1" required>').attr("id", id);
        parent.append($input);

        if (data) {
            const range = data.match(/\[\s*([-+]?\d+|any)\s*,\s*([-+]?\d+|any)\s*\]/);
            if (range && range.length == 3) {
                if (range[1] !== "any") $input.attr("min", range[1]);
                if (range[2] !== "any") $input.attr("max", range[2]);
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
     * Mirrors the snadj points editor in programs.js — pre-classed icon
     * controls, a single `enhanceWithin()` per re-render, and a top-aligned
     * label so it doesn't shift as rows are added.
     */
    function createPointsEditor(argument, rangeStr, _id, parent, $label, vis) {
        parent.append($label);
        parent.addClass("sensor-points-field");

        const range = rangeStr ? rangeStr.match(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/) : null;
		const minPts = Math.max(2, range ? parseInt(range[1]) : 2);
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
                const deleteLabel = OSApp.Language._("Delete") + " " + OSApp.Language._("Point") + " " + (idx + 1);
                const $del = $('<button type="button" class="ui-btn ui-btn-icon-notext ui-icon-delete ui-btn-corner-all split-remove"></button>')
                    .attr("aria-label", deleteLabel)
                    .attr("title", deleteLabel);

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
                        if (!vis.isVisible()) return;
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
                        if (!vis.isVisible()) return true;
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
            $bar.append($("<h3></h3>").text(sensor.name + " " + OSApp.Language._("Options")));
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
        if (arg.arg === "name" && !uuid) arg._placeholder = OSApp.Language._("New Sensor");
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
            const name = params.get("name");
            if (name !== null && name.trim().length === 0) return undefined;
            const minimum = params.get("min");
            const maximum = params.get("max");
            if (minimum !== null && maximum !== null) {
                const minValue = Number(minimum);
                const maxValue = Number(maximum);
                if (Number.isFinite(minValue) && Number.isFinite(maxValue) && minValue > maxValue) {
                    return undefined;
                }
            }
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

OSApp.Sensors.runSensorMutation = function (url, success) {
    const context = {
        session: OSApp.currentSession,
        controller: OSApp.currentSession.controller
    };

    function isCurrentContext() {
        return OSApp.currentSession === context.session &&
            OSApp.currentSession.controller === context.controller;
    }

    function rejectStaleMutation() {
        return $.Deferred().reject({ status: 0, statusText: "stale" }).promise();
    }

    $.mobile.loading( "show" );
    return OSApp.Firmware.sendToOS(url)
        .then(() => isCurrentContext()
            ? OSApp.Sites.updateControllerSensors(undefined, context)
            : rejectStaleMutation())
        .then(() => isCurrentContext() ? undefined : rejectStaleMutation())
        .done(() => {
            $.mobile.loading( "hide" );
            success();
        })
        .fail(() => {
            // A site switch owns its own loader. A late mutation must not hide it.
            if (isCurrentContext()) {
                $.mobile.loading( "hide" );
            }
        });
};

OSApp.Sensors.changeSensor = function (url, isNew) {
    return OSApp.Sensors.runSensorMutation(url, () => {
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
};

OSApp.Sensors.deleteSensor = function (uuid) {
    return OSApp.Sensors.runSensorMutation(`/dsn?pw=&uuid=${uuid}`, () => {
        $( "#sensors" ).trigger( "programrefresh" );
        OSApp.Errors.showError( OSApp.Language._( "Sensor deleted successfully" ) );
    });
};

OSApp.Sensors.displayPage = function (expandUuid) {
    const page = $(`<div data-role="page" id="sensors"></div>`);
	const content = $(`<div class="ui-content" role="main" id="sensors_list"></div>`);
    page.append(content);
	const session = OSApp.currentSession;
	const controller = session.controller;
	let requestSeq = 0;
	let disposed = false;

    const sensorValueDisplay = OSApp.Sensors.formatValue;

	function isCurrentContext(seq) {
		return !disposed && (seq == null || seq === requestSeq) &&
			OSApp.currentSession === session && OSApp.currentSession.controller === controller;
	}

    /**
     *
     * @param {JQuery} parent
     * @param {Data} data
     * @param {object} sensorData
     * @returns {JQuery}
     */
    function createSensorCollapse(parent, data, sensorData) {
        const $div = $("<div></div>").attr("data-uuid", sensorData["uuid"]);
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

        function buildEditor() {
            if ($div.data("sensor-editor-built") || !isCurrentContext()) return;
            $div.data("sensor-editor-built", true);

            const editor = OSApp.Sensors.createSensorPage($inner, sensorData["uuid"], data);
            editor.update(sensorData);

            const $update = $('<input type="button" data-theme="b">').val(OSApp.Language._("Update Sensor"));
            $inner.append($update);
            $update.button({icon: "edit"});
            $update.on("click", () => {
                const url = editor.getURL();
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
                OSApp.UIDom.areYouSure(
                    OSApp.Language._("Are you sure you want to delete this sensor?"),
                    OSApp.Utils.htmlEscape(sensorData["name"] + " (UUID: " + sensorData["uuid"] + ")"),
                    () => {
                        OSApp.Sensors.deleteSensor(sensorData["uuid"]);
                    }
                );
            });
        }

        $div.one("collapsibleexpand", buildEditor);
        return $div;
    }

    function updateContent () {
		if (!isCurrentContext()) return;
		const seq = ++requestSeq;
		const jsdRequest = controller.sensor_desc
			? $.Deferred().resolve(controller.sensor_desc).promise()
			: OSApp.Firmware.sendToOS("/jsd?pw=", "json").then((data) => OSApp.Sensors.normalizeJsd(data));

        $.mobile.loading("show");
        jsdRequest
            .done((jsdData) => {
				if (!isCurrentContext(seq)) return;
				controller.sensor_desc = jsdData;
                content.empty();
				const count = controller.sensors.sn.length;
                content.append("<p class='center'>" + OSApp.Language._("Click below to expand/edit. Be sure to save changes.") + "</p>");
                content.append("<p class='center'>" + OSApp.Language._("Number of Sensors") + ": " + count + "</p>");
                const $set = $('<div data-role="collapsible-set"></div>');
                content.append($set);
				controller.sensors.sn.forEach((v) => {
                    createSensorCollapse($set, jsdData, v);
                });
                $set.collapsibleset();

                // If we navigated here from a homepage card, auto-expand the
                // matching sensor's collapsible so the user lands directly on
                // its settings.
                if (expandUuid) {
					$set.children().filter(function() {
						return String($(this).attr("data-uuid")) === String(expandUuid);
					}).collapsible("expand");
                }

                const $notice = $('<p class="sensor-page-notice"></p>');
                $notice.append(document.createTextNode(OSApp.Language._(
                    "Note: this page is for external (e.g. analog) and virtual sensors."
                ) + " "));
                // Translators: keep {0} as the placeholder for the link to the
                // "Built-in Sensors" section.
                const template = OSApp.Language._("To edit built-in sensors (e.g. rain, flow), open the {0} section under Edit Options.");
                const [before, after = ""] = template.split("{0}");
                const $link = $('<a href="#"></a>').text(OSApp.Language._("Built-in Sensors"));
                $link.on("click", function(e) {
                    e.preventDefault();
                    OSApp.UIDom.changePage("#os-options", { expandItem: "sensors" });
                });
                $notice.append(document.createTextNode(before), $link, document.createTextNode(after));
                content.append($notice);
            })
            .fail(() => {
				if (isCurrentContext(seq)) {
					OSApp.Errors.showError(OSApp.Language._("Failed to load sensor descriptions"));
				}
            })
			.always(() => {
				if (isCurrentContext(seq)) $.mobile.loading("hide");
			});
    }

    function refreshValues() {
		if (!isCurrentContext()) return;
		const sn = controller.sensors && controller.sensors.sn;
        if ( !sn ) { return; }
		page.find( "[data-sensor-uuid]" ).each( function() {
			const $el = $( this );
			const uuid = $el.attr( "data-sensor-uuid" );
			const sensor = sn.find( function( s ) { return String( s.uuid ) === uuid; } );
			if ( !sensor ) { return; }
			if ( typeof sensor.value === "undefined" || sensor.value === null ) {
				$el.text( "—" )
					.removeClass( "sensor-value-valid sensor-value-warning sensor-value-clamped" );
				return;
			}
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
			disposed = true;
			requestSeq++;
			$( "html" ).off( "datarefresh", refreshValues );
			$.mobile.loading("hide");
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

		$( "#sensors" ).trigger("pagehide").remove();
		$.mobile.pageContainer.append( page );
		updateContent();
	}

	return begin();
};

OSApp.Sensors.addSensor = function (_callback) {
    const page = $(`<div data-role="page" id="add-sensor"></div>`);
	const content = $(`<div class="ui-content" role="main"></div>`);
    page.append(content);
	const session = OSApp.currentSession;
	const controller = session.controller;
	let requestSeq = 0;
	let disposed = false;

    let submit = () => {};

	function isCurrentContext(seq) {
		return !disposed && (seq == null || seq === requestSeq) &&
			OSApp.currentSession === session && OSApp.currentSession.controller === controller;
	}

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
		if (!isCurrentContext()) return;
		const seq = ++requestSeq;
		const jsdRequest = controller.sensor_desc
			? $.Deferred().resolve(controller.sensor_desc).promise()
			: OSApp.Firmware.sendToOS("/jsd?pw=", "json").then((data) => OSApp.Sensors.normalizeJsd(data));

        $.mobile.loading("show");
        jsdRequest
            .done((jsdData) => {
				if (!isCurrentContext(seq)) return;
				controller.sensor_desc = jsdData;
                content.empty();
                createAddSensor(content, jsdData);
            })
            .fail(() => {
				if (isCurrentContext(seq)) {
					OSApp.Errors.showError(OSApp.Language._("Failed to load sensor descriptions"));
				}
            })
			.always(() => {
				if (isCurrentContext(seq)) $.mobile.loading("hide");
			});
    }

	page
		.on( "programrefresh", updateContent )
		.on( "pagehide", function() {
			disposed = true;
			requestSeq++;
			$.mobile.loading("hide");
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

		$( "#add-sensor" ).trigger("pagehide").remove();
		$.mobile.pageContainer.append( page );
		updateContent();
	}

	return begin();
};

OSApp.Sensors.displayLogs = function (_callback) {
    const page = $(`<div data-role="page" id="sensor-logs"></div>`);
	const content = $(`<div class="ui-content" role="main"></div>`);
    const $cards = $("<div></div>");
	const session = OSApp.currentSession;
	const controller = session.controller;

    let showCurrentOnly = true;
    let requestSeq = 0;
    let activeCharts = [];
    let cachedData = null;
    let allCardsRendered = false;
    let disposed = false;
	let selectedRange = "1d";
	let loadedRange = null;
	let pendingRange = null;
	let activeLogController = null;
	let activeDeleteController = null;
	let deletionActive = false;
	let deletionStopRequested = false;
	let deletionStartedAt = 0;
	let deletionPagesCompleted = 0;
	let exclusiveLogOperation = null;

	function isCurrentContext(seq) {
		return !disposed && (seq == null || seq === requestSeq) &&
			OSApp.currentSession === session && OSApp.currentSession.controller === controller;
	}

    const $filterDiv = $(`
        <div class="sensor-log-filter-bar">
            <div class="sensor-log-filter-toggle">
                <label for="show-inactive-sensors">${OSApp.Language._("Show Inactive")}</label>
                <input type="checkbox" name="show-inactive-sensors" id="show-inactive-sensors">
            </div>
            <div class="sensor-log-global-controls">
                <div class="sensor-log-control-group sensor-log-range-controls" data-role="controlgroup" data-type="horizontal">
                    <input type="button" class="sensor-log-range-btn" data-range="3h" value="3H" aria-pressed="false">
                    <input type="button" class="sensor-log-range-btn" data-range="1d" value="1D" aria-pressed="true">
                    <input type="button" class="sensor-log-range-btn" data-range="1w" value="1W" aria-pressed="false">
                    <input type="button" class="sensor-log-range-btn" data-range="all" value="${OSApp.Language._("All")}" aria-pressed="false">
                </div>
                <div class="sensor-log-control-group sensor-log-action-controls" data-role="controlgroup" data-type="horizontal">
                    <input type="button" class="sensor-log-download-btn" value="${OSApp.Language._("Download All")}" disabled>
                    <input type="button" class="sensor-log-delete-all-btn" value="${OSApp.Language._("Delete All")}">
                </div>
            </div>
        </div>
    `);
    const $progress = $(`
        <div class="sensor-log-progress" hidden>
            <div class="sensor-log-progress-header">
                <div class="sensor-log-progress-label" aria-live="polite"></div>
                <button type="button" class="sensor-log-stop-btn ui-btn ui-mini ui-corner-all" hidden>
                    ${OSApp.Language._("Stop")}
                </button>
            </div>
            <div class="sensor-log-progress-track ui-corner-all ui-shadow-inset" role="progressbar"
                aria-label="${OSApp.Language._("Sensor log progress")}"
                aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div class="sensor-log-progress-fill ui-corner-all"></div>
            </div>
            <div class="sensor-log-progress-estimate" hidden></div>
        </div>
    `);
	const $stopDelete = $progress.find(".sensor-log-stop-btn");
	const $progressEstimate = $progress.find(".sensor-log-progress-estimate");
	const $rangeButtons = $filterDiv.find(".sensor-log-range-btn");
	content.append($filterDiv);
	content.append($progress);
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
                    parsing: false,
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
                        decimation: {
                            enabled: true,
                            algorithm: 'min-max',
                            threshold: 2000
                        },
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
								pinch: {
									enabled: true
								},
								mode: 'x',
                            }
                        }
                    }
                },
            });

        return sensorGraph;
    }

    function showDownloadError() {
        OSApp.Errors.showError(OSApp.Language._("Failed to download sensor logs"));
    }

    function shareBlob(blob, filename) {
        const sharing = window.plugins && window.plugins.socialsharing;
        const cacheDirectory = window.cordova.file && window.cordova.file.cacheDirectory;
        if (!sharing || typeof sharing.shareWithOptions !== "function" ||
            !cacheDirectory || typeof window.resolveLocalFileSystemURL !== "function") {
            showDownloadError();
            return;
        }

        function writeAndShare(fileEntry) {
            fileEntry.createWriter((writer) => {
                let cleared = false;
                writer.onerror = showDownloadError;
                writer.onwriteend = () => {
                    // getFile({create:true}) does not truncate an existing file,
                    // so truncate first, then write on the second onwriteend.
                    if (!cleared) {
                        cleared = true;
                        writer.write(blob);
                        return;
                    }

                    const fileUrl = fileEntry.nativeURL || fileEntry.toURL();
                    // Dismissing the share sheet returns through the success
                    // callback (completed:false), so only genuine share failures
                    // reach showDownloadError below.
                    sharing.shareWithOptions({
                        subject: filename,
                        files: [ fileUrl ],
                        chooserTitle: OSApp.Language._("Download Log")
                    }, () => {}, showDownloadError);
                };
                writer.truncate(0);
            }, showDownloadError);
        }

        // Best-effort removal of previously exported CSVs so they don't pile up
        // in the cache. Failures here are ignored; they must not block the export.
        function purge(exportsDir, done) {
            const reader = exportsDir.createReader();
            reader.readEntries((entries) => {
                let remaining = entries.length;
                if (!remaining) { done(); return; }
                entries.forEach((entry) => {
                    const next = () => { if (--remaining === 0) done(); };
                    entry.remove(next, next);
                });
            }, done);
        }

        window.resolveLocalFileSystemURL(cacheDirectory, (cacheDir) => {
            cacheDir.getDirectory("sensor-exports", { create: true }, (exportsDir) => {
                purge(exportsDir, () => {
                    exportsDir.getFile(filename, { create: true }, writeAndShare, showDownloadError);
                });
            }, showDownloadError);
        }, showDownloadError);
    }

    function downloadBlob(blob, filename) {
        if (window.cordova) {
            shareBlob(blob, filename);
            return;
        }

        const link = document.createElement("a");
        if (link.download === undefined) return;

        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        try {
            link.click();
        } finally {
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 0);
        }
    }

    function downloadCsv(csvContent, filename) {
        downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), filename);
    }

    function setDownloadAllEnabled(enabled) {
        const $button = $filterDiv.find("input.sensor-log-download-btn");
        $button.prop("disabled", !enabled);
        try { $button.button("refresh"); } catch { /* not enhanced yet */ }
    }

    function setLogProgress(progress, label, options) {
        options = options || {};
        const progressLabel = OSApp.Language._(label || "Retrieving sensor logs");
        const $track = $progress.find(".sensor-log-progress-track");
        $progress.prop("hidden", false);
        $progress.toggleClass("sensor-log-progress-indeterminate", !!options.indeterminate);
        if (options.indeterminate) {
            // No measurable progress (single request) — show an animated
            // indeterminate track instead of a percentage.
            $progress.find(".sensor-log-progress-label").text(progressLabel + "...");
            $progress.find(".sensor-log-progress-fill").css("width", "");
            $track.removeAttr("aria-valuenow").attr("aria-busy", "true");
        } else {
            const percentage = Math.round(Math.max(0, Math.min(progress, 1)) * 100);
            const progressText = Number.isFinite(options.processed)
                ? progressLabel + ": " + options.processed.toLocaleString() + " (" + percentage + "%)"
                : progressLabel + "... " + percentage + "%";
            $progress.find(".sensor-log-progress-label").text(progressText);
            $progress.find(".sensor-log-progress-fill").css("width", percentage + "%");
            $track.removeAttr("aria-busy").attr("aria-valuenow", percentage);
        }
        $stopDelete.prop("hidden", !options.showStop);
        $progressEstimate.text(options.detail || "").prop("hidden", !options.detail);
    }

    function setLoadingBanner(label) {
        setLogProgress(0, label || "Loading sensor data", { indeterminate: true });
    }

    function hideLogProgress() {
        $progress.prop("hidden", true).removeClass("sensor-log-progress-indeterminate");
        $progress.find(".sensor-log-progress-track").removeAttr("aria-busy");
        $stopDelete.prop("hidden", true).prop("disabled", false).text(OSApp.Language._("Stop"));
        $progressEstimate.prop("hidden", true).empty();
    }

    function formatDeletionEstimate(progress) {
        if (deletionStopRequested) return OSApp.Language._("Stopping after the current page").concat("...");
        deletionPagesCompleted++;
        if (deletionPagesCompleted < 2 || !progress.processed || progress.processed >= progress.total) return "";

        const elapsed = Date.now() - deletionStartedAt;
        const remaining = elapsed * (progress.total - progress.processed) / progress.processed;
        if (!Number.isFinite(remaining) || remaining <= 0) return "";
        if (remaining < 60 * 1000) return OSApp.Language._("Less than a minute remaining");

        const minutes = Math.ceil(remaining / (60 * 1000));
        const message = minutes === 1 ? "About %d minute remaining" : "About %d minutes remaining";
        return OSApp.Language._(message).replace("%d", minutes);
    }

    function setDeletionProgress(progress) {
        setLogProgress(progress.percent / 100, "Deleting sensor log", {
            showStop: true,
            detail: formatDeletionEstimate(progress)
        });
    }

    function setLoadingProgress(progress, processed) {
        setLogProgress(progress, "Loading log data", { processed: processed });
    }

    function warningDetail(message) {
        return "<span class='sensor-log-warning-label'>" + OSApp.Language._("Warning") + "</span>: " +
            OSApp.Language._(message);
    }

    function setDeleteActionsEnabled(enabled) {
        const $buttons = $filterDiv.find("input.sensor-log-delete-all-btn")
            .add($cards.find(".sensor-log-delete-btn input"));
        $buttons.prop("disabled", !enabled);
        try { $buttons.button("refresh"); } catch { /* not enhanced yet */ }
    }

	function updateActionAvailability() {
		const passiveActionsEnabled = exclusiveLogOperation === null && pendingRange === null;
		const downloadAvailable = passiveActionsEnabled && cachedData && !cachedData.noLogHeader;
		setDownloadAllEnabled(!!downloadAvailable);
		setDeleteActionsEnabled(passiveActionsEnabled);

		$rangeButtons.prop("disabled", exclusiveLogOperation !== null);
		try { $rangeButtons.button("refresh"); } catch { /* not enhanced yet */ }
	}

	function beginExclusiveLogOperation(operation) {
		if (exclusiveLogOperation !== null || pendingRange !== null) return false;
		exclusiveLogOperation = operation;
		updateActionAvailability();
		return true;
	}

	function endExclusiveLogOperation(operation) {
		if (exclusiveLogOperation === operation) {
			exclusiveLogOperation = null;
		}
	}

    function sensorLogCsvRows(buffer, sensorByUuid, unitByValue) {
        const rows = [];
        const view = new DataView(buffer);
        for (let offset = 0; offset < buffer.byteLength; offset += 10) {
            const timestamp = view.getUint32(offset, true);
            const value = view.getFloat32(offset + 4, true);
            const uuid = view.getUint16(offset + 8, true);
            const sensor = sensorByUuid[uuid];
            const sensorName = sensor ? sensor.name : OSApp.Language._("Unknown");
            let unit = OSApp.Language._("Unknown");
            if (sensor) {
                const unitObj = unitByValue[sensor.unit];
                unit = unitObj ? (unitObj.short || unitObj.name) : unit;
            }
            rows.push(OSApp.Sensors.formatLogCsvRow(uuid, sensorName, timestamp * 1000, value, unit));
        }
        return rows;
    }

    function downloadAllLogs() {
		if (!isCurrentContext()) {
			return $.Deferred().reject({ status: 0, statusText: "stale" }).promise();
        }
		if (!beginExclusiveLogOperation("download")) {
			return $.Deferred().reject({ status: 0, statusText: "busy" }).promise();
		}
        setLoadingProgress(0, 0);
        const csvParts = [ "sensor_uuid,sensor_name,timestamp,value,unit\r\n" ];
        const sensorByUuid = {};
        const unitByValue = {};
        controller.sensors.sn.forEach((sensor) => { sensorByUuid[sensor.uuid] = sensor; });
        if (controller.sensor_desc) {
            controller.sensor_desc.units.forEach((unit) => { unitByValue[unit.value] = unit; });
        }
        return OSApp.Sensors.fetchAllLogPages({
            collect: false,
            isCurrent: isCurrentContext,
            onProgress: setLoadingProgress,
            onPage: (buffer) => {
                const rows = sensorLogCsvRows(buffer, sensorByUuid, unitByValue);
                if (rows.length) csvParts.push(rows.join("\r\n") + "\r\n");
            }
        })
            .done(() => {
				if (!isCurrentContext()) return;
                const today = new Date().toISOString().slice(0, 10);
                downloadBlob(
                    new Blob(csvParts, { type: "text/csv;charset=utf-8;" }),
                    `sensorlog-${today}.csv`
                );
            })
            .fail(() => {
				if (!isCurrentContext()) return;
                OSApp.Errors.showError(OSApp.Language._("Failed to download sensor logs"));
            })
            .always(() => {
				if (!isCurrentContext()) return;
				endExclusiveLogOperation("download");
				hideLogProgress();
				updateActionAvailability();
            });
    }

    function destroyActiveCharts() {
        activeCharts.forEach((chart) => {
            delete chart.sensorLogUpdateRange;
            chart.destroy();
        });
        activeCharts = [];
    }

	function cancelPendingLogRequest() {
		if (pendingRange == null) return;
		requestSeq++;
		pendingRange = null;
		if (activeLogController) activeLogController.abort();
		activeLogController = null;
		$.mobile.loading("hide");
		hideLogProgress();
		updateActionAvailability();
	}

	function updateRangeSelection() {
		$rangeButtons.each(function() {
			const selected = $(this).attr("data-range") === selectedRange;
			$(this).attr("aria-pressed", selected ? "true" : "false");
			$(this).closest(".ui-btn").toggleClass("sensor-log-range-selected", selected);
		});
	}

	function updateChartRanges(range) {
		activeCharts.forEach((chart) => {
			if (typeof chart.sensorLogUpdateRange === "function") {
				chart.sensorLogUpdateRange(range);
			}
		});
	}

    function selectRange(range) {
		if (exclusiveLogOperation !== null) return;
        const previousRange = selectedRange;
		selectedRange = range;
		updateRangeSelection();
        if (loadedRange != null &&
            OSApp.Sensors.LOG_CHART_RANGES[range] <= OSApp.Sensors.LOG_CHART_RANGES[loadedRange]) {
			cancelPendingLogRequest();
			updateChartRanges(range);
            return;
        }
        updateContent(range, () => {
			selectedRange = previousRange;
			updateRangeSelection();
			updateChartRanges(previousRange);
        });
    }

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
            const x = timestamp * 1000;

            if (typeof obj[key] === "undefined") {
                const sensor = sensors.find((s) => s.uuid == key);
                obj[key] = { sensor: sensor, data: [], sorted: true };
            }

            const sensorData = obj[key].data;
            if (sensorData.length > 0 && x < sensorData[sensorData.length - 1].x) {
                obj[key].sorted = false;
            }
            sensorData.push({ x: x, y: value });
        }

        const keys = Object.keys(obj).sort((a, b) => {
            const aActive = !!obj[a].sensor;
            const bActive = !!obj[b].sensor;
            if (aActive !== bActive) {
                return aActive ? -1 : 1;
            }
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
        keys.forEach((key) => {
            if (!obj[key].sorted) {
                obj[key].data.sort((a, b) => a.x - b.x);
            }
        });

        if (keys.length === 0) {
			const rangeHasWiderData = !buf.noLogHeader && selectedRange !== "all";
			const emptyMessage = rangeHasWiderData
				? OSApp.Language._("No sensor data in the selected time range. Older data may exist; choose a longer range above.")
				: OSApp.Language._("No sensor logs found.");
			parent.append($("<p class='sensor-log-empty center'></p>").text(emptyMessage));
            return;
        }

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
                : { name: `${OSApp.Language._("Unknown")} (UUID: ${key})`, unit: 0 };
			const unitLabel = (activeSensor && controller.sensor_desc)
				? (controller.sensor_desc.units.find(u => u.value === activeSensor.unit) || {}).short || ""
                : "";
            const chart = createChart($canvas[0], sn, unitLabel);
            activeCharts.push(chart);

				const update = function (range) {
					chart.data = {
						datasets: [ {
							data: OSApp.Sensors.filterLogPointsByRange(
								obj[key].data,
								range,
								controller.settings && controller.settings.devt
							)
						} ]
					};
					chart.resetZoom();
					chart.update();
				};
				chart.sensorLogUpdateRange = update;

                var $controls = $("<div>", {
                    "data-role": "controlgroup",
                    "data-type": "horizontal"
                });

                const $resetZoom = $('<input type="button">').val(OSApp.Language._("Reset Zoom"));
                $resetZoom.on("click", () => {
                    chart.resetZoom();
                });

				const $download = $('<input type="button">').val(OSApp.Language._("Download"));
                $download.on("click", () => {
                    const sensorName = activeSensor ? activeSensor.name : OSApp.Language._("Unknown");
                    let unit = OSApp.Language._("Unknown");
					if (activeSensor && controller.sensor_desc) {
						const unitObj = controller.sensor_desc.units.find(u => u.value === activeSensor.unit);
                        unit = unitObj ? (unitObj.short || unitObj.name) : OSApp.Language._("Unknown");
					}

                    const csvRows = [ "sensor_uuid,sensor_name,timestamp,value,unit" ];
					const downloadPoints = OSApp.Sensors.filterLogPointsByRange(
						obj[key].data,
						selectedRange,
						controller.settings && controller.settings.devt
					);
                    downloadPoints.forEach((v) => {
                        csvRows.push(OSApp.Sensors.formatLogCsvRow(key, sensorName, v.x, v.y, unit));
                    });

                    const today = new Date().toISOString().slice(0, 10);
                    const safeName = activeSensor
                        ? activeSensor.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "sensor"
                        : "unknown";
                    downloadCsv(
                        csvRows.join("\r\n") + "\r\n",
                        `${safeName}-uuid-${key}-${today}.csv`
                    );
                });

                const $deleteLogs = $('<input type="button">').val(OSApp.Language._("Delete"));
                $deleteLogs.on("click", () => {
                    const deleteName = activeSensor ? activeSensor.name : sn.name;
                    OSApp.UIDom.areYouSure(
                        OSApp.Language._("Delete the entire log of") + " " + OSApp.Utils.htmlEscape(deleteName) + "?",
                        warningDetail(
                            "This may take several minutes. Deleting a sensor's log does not free log capacity; use this only when you need to reset this sensor's recorded history."
                        ),
                        () => { deleteLogs(key); }
                    );
                });

				$controls.append($resetZoom, $download, $deleteLogs);

                const $controlsWrap = $("<div>").addClass("sensor-chart-controls");
                $controlsWrap.append($controls);
                $card.append($controlsWrap);

                $controls.controlgroup();
                $deleteLogs.button();
                $deleteLogs.closest( ".ui-btn" ).addClass( "sensor-log-delete-btn" );
                $download.button();
                $resetZoom.button();

				update(selectedRange);
        }
    }

    function applyFilter() {
		if (!isCurrentContext()) return;
        if (!showCurrentOnly && !allCardsRendered && cachedData) {
            allCardsRendered = true;
            destroyActiveCharts();
            $cards.empty();
			parseData($cards, cachedData, controller.sensors.sn);
        }
        $cards.find(".sensor-log-card-inactive").toggle(!showCurrentOnly);
		updateActionAvailability();
    }

    function renderCards() {
		if (!cachedData || !isCurrentContext()) return;
        destroyActiveCharts();
        $cards.empty();
		parseData($cards, cachedData, controller.sensors.sn);
        allCardsRendered = !showCurrentOnly;
        applyFilter();
    }

    function updateContent(range, rollback) {
		if (!isCurrentContext()) return;
        const requestedRange = typeof range === "string" &&
            Object.prototype.hasOwnProperty.call(OSApp.Sensors.LOG_CHART_RANGES, range) ?
			range : selectedRange;
		selectedRange = requestedRange;
		updateRangeSelection();
		const seq = ++requestSeq;
		pendingRange = requestedRange;
		updateActionAvailability();
		if (activeLogController) activeLogController.abort();
		const requestController = typeof AbortController === "function" ? new AbortController() : null;
		activeLogController = requestController;
		const requestSignal = requestController ? requestController.signal : undefined;
		const isPaginated = requestedRange === "1w" || requestedRange === "all";
		if (isPaginated) {
			setLoadingProgress(0, 0);
		} else {
			// Single request: no measurable progress, so show an indeterminate
			// banner in the same sticky position rather than a hidden spinner.
			setLoadingBanner("Loading sensor data");
		}

		const controllerNow = Number(controller.settings && controller.settings.devt);
		const nowSeconds = Number.isFinite(controllerNow) && controllerNow > 0
			? Math.floor(controllerNow)
			: Math.floor(Date.now() / 1000);
		const before = requestedRange === "1w" ? nowSeconds : undefined;
		const jslRequest = isPaginated
			? OSApp.Sensors.fetchAllLogPages({
				after: requestedRange === "1w" ? OSApp.Sensors.getChartRangeStart("1w", before) : undefined,
				before: before,
				signal: requestSignal,
				isCurrent: () => isCurrentContext(seq),
				onProgress: setLoadingProgress
			})
			: OSApp.Firmware.sendToOS(
				OSApp.Sensors.getChartLogURL(requestedRange, controller.settings && controller.settings.devt),
				"arraybuffer",
				{ signal: requestSignal }
			);
		const jsdRequest = controller.sensor_desc
			? $.Deferred().resolve(controller.sensor_desc).promise()
			: OSApp.Firmware.sendToOS("/jsd?pw=", "json", { signal: requestSignal })
				.then((data) => OSApp.Sensors.normalizeJsd(data));

        $.when(jslRequest, jsdRequest)
			.done((buf, jsdData) => {
				if (!isCurrentContext(seq)) return;
				if (activeLogController === requestController) activeLogController = null;
				pendingRange = null;
				hideLogProgress();
				controller.sensor_desc = jsdData;
                cachedData = buf;
                loadedRange = requestedRange;
                renderCards();
            })
			.fail(() => {
				if (!isCurrentContext(seq)) return;
				if (activeLogController === requestController) activeLogController = null;
				pendingRange = null;
				hideLogProgress();
				updateActionAvailability();
                if (typeof rollback === "function") rollback();
                OSApp.Errors.showError(OSApp.Language._("Failed to load sensor logs"));
            });
    }

    function deleteLogs(uuid) {
        if (deletionActive || !beginExclusiveLogOperation("delete")) return;
        if (Number(uuid) === -1) {
            $.mobile.loading("show");
            OSApp.Firmware.sendToOS("/dsl?pw=&uuid=-1").always(() => {
				endExclusiveLogOperation("delete");
				if (!isCurrentContext()) return;
                $.mobile.loading("hide");
				updateContent("1d");
            });
            return;
        }

        deletionActive = true;
        deletionStopRequested = false;
        deletionStartedAt = Date.now();
        deletionPagesCompleted = 0;
        activeDeleteController = typeof AbortController === "function" ? new AbortController() : null;
        setLogProgress(0, "Deleting sensor log", { showStop: true });
        let refreshAfterDeletion = false;
        OSApp.Sensors.deleteLogPages(Number(uuid), {
            signal: activeDeleteController ? activeDeleteController.signal : undefined,
            isCurrent: isCurrentContext,
            shouldStop: () => deletionStopRequested,
            onProgress: (progress) => {
				refreshAfterDeletion = true;
				setDeletionProgress(progress);
			}
        })
            .done(() => {
                refreshAfterDeletion = true;
            })
            .fail((error) => {
                if (!isCurrentContext() || (error && (error.statusText === "abort" || error.statusText === "stale"))) {
                    return;
                }
                if (error && (error.statusText === "parsererror" || error.statusText === "stalled")) {
                    OSApp.Errors.showError(OSApp.Language._("Failed to delete sensor logs"));
                }
            })
            .always(() => {
                activeDeleteController = null;
                deletionActive = false;
				endExclusiveLogOperation("delete");
                if (!isCurrentContext()) return;
                hideLogProgress();
                if (refreshAfterDeletion) {
                    // Reconcile the partially or fully deleted cache with a bounded
                    // request; wider history remains available on explicit selection.
                    updateContent("1d");
				} else {
					updateActionAvailability();
                }
            });
    }

    page
		.on( "programrefresh", updateContent )
		.on( "pagehide", function() {
			disposed = true;
			requestSeq++;
			if (activeLogController) activeLogController.abort();
			if (activeDeleteController) activeDeleteController.abort();
			destroyActiveCharts();
			$.mobile.loading("hide");
			hideLogProgress();
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

		$stopDelete.on("click", function() {
			if (!deletionActive || deletionStopRequested) return;
			deletionStopRequested = true;
			$stopDelete.prop("disabled", true).text(OSApp.Language._("Stopping"));
			$progressEstimate.text(OSApp.Language._("Stopping after the current page") + "...").prop("hidden", false);
		});

		$rangeButtons.on("click", function() {
			selectRange($(this).attr("data-range"));
		});

        $filterDiv.find("input.sensor-log-download-btn").on("click", () => {
            OSApp.UIDom.areYouSure(
                OSApp.Language._("Are you sure you want to download all log data?"),
                warningDetail("This action can take a while depending on the number of log records."),
                downloadAllLogs
            );
        });

        const $deleteAll = $filterDiv.find("input.sensor-log-delete-all-btn").on("click", () => {
            OSApp.UIDom.areYouSure(
                OSApp.Language._("Are you sure you want to delete all sensor logs?"),
                "",
                () => { deleteLogs(-1); }
            );
        });

		$filterDiv.find(".sensor-log-control-group").controlgroup();
		$deleteAll.closest(".ui-btn").addClass("sensor-log-delete-all-btn");
		updateRangeSelection();

		$( "#sensor-logs" ).trigger("pagehide").remove();
		$.mobile.pageContainer.append( page );
		updateContent();
	}

	return begin();
};

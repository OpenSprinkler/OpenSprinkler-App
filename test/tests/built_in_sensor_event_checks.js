/* eslint-disable */

describe("Built-in Sensor Event Checks", function () {
	it("discovers built-in sensors from option keys and assigns distinct labels", function () {
		var sensors = OSApp.Sensors.getBuiltInSensors({
			sn4t: 240,
			sn2t: 3,
			sn1t: 1,
			sn3t: 0,
			unrelated: 1
		});

		assert.deepEqual(sensors.map(function (sensor) { return sensor.code; }), [ "s1", "s2", "s3", "s4" ]);
		assert.deepEqual(sensors.map(function (sensor) { return sensor.label; }), [
			"Rain Sensor (SN1)",
			"Soil Sensor (SN2)",
			"Sensor (SN3)",
			"Program Switch (SN4)"
		]);
	});

	it("creates sprinkler-log metadata for every reported built-in sensor", function () {
		var events = OSApp.Logs.getSensorLogEvents({ sn1t: 1, sn2t: 3, sn3t: 1, sn4t: 3 });

		assert.equal(events.s1.label, "Rain Sensor (SN1)");
		assert.equal(events.s2.label, "Soil Sensor (SN2)");
		assert.equal(events.s3.label, "Rain Sensor (SN3)");
		assert.equal(events.s4.label, "Soil Sensor (SN4)");
	});

	it("maps SN3 and SN4 notification events to their firmware bits", function () {
		var events = OSApp.Options.getNotificationEvents({ sn3t: 0, sn4t: 0 });
		var byID = {};
		events.forEach(function (event) { byID[event.id] = event; });

		assert.equal(byID.sensor1.bit, 1);
		assert.equal(byID.sensor2.bit, 6);
		assert.equal(byID.sensor3.bit, 11);
		assert.equal(byID.sensor4.bit, 12);
	});

	it("hides unavailable sensor notification events and preserves unknown bits", function () {
		var events = OSApp.Options.getNotificationEvents({});
		var futureBit = 1 << 15;
		var updated = OSApp.Options.updateNotificationEventValue(futureBit, events, function (event) {
			return event.id === "sensor1";
		});

		assert.isUndefined(events.find(function (event) { return event.id === "sensor3"; }));
		assert.isUndefined(events.find(function (event) { return event.id === "sensor4"; }));
		assert.equal(updated & futureBit, futureBit);
		assert.equal(updated & (1 << 1), 1 << 1);
	});
});

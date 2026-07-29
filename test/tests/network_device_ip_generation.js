/* eslint-disable */

describe( "Device IP discovery generation", function() {
	it( "allows only the newest overlapping discovery callback to update the subnet", function() {
		var oldInterface = window.networkinterface,
			oldIP = OSApp.currentDevice.deviceIp,
			oldGeneration = OSApp.currentSession.generation,
			callbacks = [],
			firstFinish = sinon.spy(),
			secondFinish = sinon.spy();

		try {
			window.networkinterface = {
				getWiFiIPAddress:function( callback ) { callbacks.push( callback ); }
			};
			OSApp.currentSession.generation = 40;
			OSApp.currentDevice.deviceIp = "192.168.1.5";

			OSApp.Network.updateDeviceIP( firstFinish );
			OSApp.Network.updateDeviceIP( secondFinish );
			assert.lengthOf( callbacks, 2 );

			callbacks[ 1 ]( { ip:"10.20.30.40" } );
			callbacks[ 0 ]( { ip:"192.168.99.10" } );

			assert.equal( OSApp.currentDevice.deviceIp, "10.20.30.40" );
			assert.isTrue( secondFinish.calledOnceWithExactly( "10.20.30.40" ) );
			assert.isFalse( firstFinish.called );
		} finally {
			if ( typeof oldInterface === "undefined" ) delete window.networkinterface;
			else window.networkinterface = oldInterface;
			OSApp.currentDevice.deviceIp = oldIP;
			OSApp.currentSession.generation = oldGeneration;
		}
	} );

	it( "ignores a discovery result captured before the controller session changed", function() {
		var oldInterface = window.networkinterface,
			oldIP = OSApp.currentDevice.deviceIp,
			oldGeneration = OSApp.currentSession.generation,
			pluginCallback,
			finish = sinon.spy();

		try {
			window.networkinterface = {
				getWiFiIPAddress:function( callback ) { pluginCallback = callback; }
			};
			OSApp.currentSession.generation = 50;
			OSApp.currentDevice.deviceIp = "172.16.1.8";

			OSApp.Network.updateDeviceIP( finish );
			OSApp.currentSession.generation = 51;
			pluginCallback( { ip:"192.168.50.4" } );

			assert.equal( OSApp.currentDevice.deviceIp, "172.16.1.8" );
			assert.isFalse( finish.called );
		} finally {
			if ( typeof oldInterface === "undefined" ) delete window.networkinterface;
			else window.networkinterface = oldInterface;
			OSApp.currentDevice.deviceIp = oldIP;
			OSApp.currentSession.generation = oldGeneration;
		}
	} );
} );

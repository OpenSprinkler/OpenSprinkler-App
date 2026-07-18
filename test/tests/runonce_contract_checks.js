/* eslint-disable */

describe( "Run-Once Request Contract Checks", function() {
	var controller;
	var sandbox;

	beforeEach( function() {
		controller = OSApp.currentSession.controller;
		OSApp.currentSession.controller = {
			options: { wl: 100 },
			settings: {},
			stations: { snames: [ "One", "Two", "Three" ] },
			programs: { pd: [] }
		};
		sandbox = sinon.createSandbox();
		sandbox.stub( OSApp.Supported, "repeatedRunonce" ).returns( true );
		sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
		sandbox.stub( OSApp.StationQueue, "isActive" ).returns( -1 );
		sandbox.stub( OSApp.Storage, "set" );
		sandbox.stub( OSApp.Status, "refreshStatus" );
		sandbox.stub( OSApp.UIDom, "goBack" );
		sandbox.stub( $.mobile, "loading" );
		sandbox.stub( OSApp.Firmware, "sendToOS" ).returns( $.Deferred().resolve( { result: 1 } ).promise() );
	} );

	afterEach( function() {
		$( "#runonce" ).remove();
		sandbox.restore();
		OSApp.currentSession.controller = controller;
	} );

	function addRunoncePage( durations, mode, percentage ) {
		var page = $( "<div id='runonce'></div>" ).appendTo( "body" );
		durations.forEach( function( duration, index ) {
			$( "<button></button>" ).attr( "id", "zone-" + index ).val( duration ).appendTo( page );
		} );
		$( "<input type='radio' name='wl-runonce'>" ).val( mode ).prop( "checked", true ).appendTo( page );
		$( "<input id='wl-custom-slider'>" ).val( percentage ).appendTo( page );
		$( "<button id='interval-runonce' value='0'></button>" ).appendTo( page );
		$( "<button id='repeat-runonce' value='0'></button>" ).appendTo( page );
		return page;
	}

	it( "caps adjusted durations and resolves solar sentinels before scaling", function() {
		sandbox.stub( OSApp.Stations, "getStationDuration" ).callsFake( function( duration ) {
			return duration === 65534 ? 10000 : 20000;
		} );
		addRunoncePage( [ 40000, 65534, 65535 ], "custom", 250 );

		OSApp.Stations.submitRunonce( $.Event( "click" ) );

		assert.isTrue( OSApp.Firmware.sendToOS.calledWith( "/cr?pw=&t=[65533,25000,50000,0]" ) );
		assert.isTrue( OSApp.Storage.set.calledWithMatch( { runonce: "[40000,65534,65535,0]" } ) );
	} );

	it( "bounds malformed current adjustment percentages before serializing", function() {
		OSApp.currentSession.controller.options.wl = 999;
		addRunoncePage( [ 40000 ], "current", 100 );

		OSApp.Stations.submitRunonce( $.Event( "click" ) );
		assert.isTrue( OSApp.Firmware.sendToOS.calledWith( "/cr?pw=&t=[65533,0]" ) );

		OSApp.Firmware.sendToOS.resetHistory();
		$( "#runonce" ).remove();
		OSApp.currentSession.controller.options.wl = "not-a-number";
		addRunoncePage( [ 60 ], "current", 100 );
		OSApp.Stations.submitRunonce( $.Event( "click" ) );
		assert.isTrue( OSApp.Firmware.sendToOS.calledWith( "/cr?pw=&t=[60,0]" ) );
	} );

	it( "encodes annotations and canonicalizes repeat and queue arguments", function() {
		OSApp.Stations.submitRunonce( [ 60 ], 30.9, 2.9, ">#", 999 );

		assert.isTrue( OSApp.Firmware.sendToOS.calledWith(
			"/cr?pw=&t=[60]&int=30&cnt=2&anno=%3E%23&qo=2"
		) );
	} );

	it( "omits incomplete repeat parameters instead of creating a wrapped repeat count", function() {
		OSApp.Stations.submitRunonce( [ 60 ], 0, 0, ">%", 1 );

		assert.isTrue( OSApp.Firmware.sendToOS.calledWith(
			"/cr?pw=&t=[60]&anno=%3E%25&qo=1"
		) );
	} );

	it( "hides the loader without navigating when scheduling fails", function() {
		OSApp.Firmware.sendToOS.returns( $.Deferred().reject( { status: 500 } ).promise() );
		$.mobile.loading.resetHistory();

		OSApp.Stations.submitRunonce( [ 60 ], 0, 0 );

		assert.isTrue( $.mobile.loading.calledWith( "show" ) );
		assert.isTrue( $.mobile.loading.calledWith( "hide" ) );
		assert.isFalse( OSApp.Status.refreshStatus.called );
		assert.isFalse( OSApp.UIDom.goBack.called );
	} );

	it( "hides the loader and does not schedule when stopping active stations fails", function() {
		var clock = sandbox.useFakeTimers();
		sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( _question, _detail, confirm ) {
			confirm();
		} );
		sandbox.stub( OSApp.Stations, "getPID" ).returns( 1 );
		sandbox.stub( OSApp.Programs, "pidToName" ).returns( "Program" );
		OSApp.Firmware.checkOSVersion.callsFake( function( version ) {
			return version !== 2214;
		} );
		OSApp.StationQueue.isActive.returns( 0 );
		OSApp.Firmware.sendToOS.callsFake( function( url ) {
			if ( url === "/cv?pw=&rsn=1" ) {
				return $.Deferred().reject( { status: 500 } ).promise();
			}
			return $.Deferred().resolve( { result: 1 } ).promise();
		} );
		$.mobile.loading.resetHistory();

		OSApp.Stations.submitRunonce( [ 60 ], 0, 0 );
		clock.tick( 100 );

		assert.isTrue( OSApp.Firmware.sendToOS.calledOnceWith( "/cv?pw=&rsn=1" ) );
		assert.isTrue( $.mobile.loading.calledWith( "show" ) );
		assert.isTrue( $.mobile.loading.calledWith( "hide" ) );
		assert.isFalse( OSApp.Status.refreshStatus.called );
		assert.isFalse( OSApp.UIDom.goBack.called );
	} );

	it( "does not schedule a run on a replacement controller after the stop delay", function() {
		var clock = sandbox.useFakeTimers();
		sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( _question, _detail, confirm ) {
			confirm();
		} );
		sandbox.stub( OSApp.Stations, "getPID" ).returns( 1 );
		sandbox.stub( OSApp.Programs, "pidToName" ).returns( "Program" );
		OSApp.Firmware.checkOSVersion.callsFake( function( version ) {
			return version !== 2214;
		} );
		OSApp.StationQueue.isActive.returns( 0 );
		$.mobile.loading.resetHistory();

		OSApp.Stations.submitRunonce( [ 60 ], 0, 0 );
		clock.tick( 100 );
		assert.isTrue( OSApp.Firmware.sendToOS.calledOnceWith( "/cv?pw=&rsn=1" ) );

		OSApp.currentSession.controller = { marker: "replacement" };
		clock.tick( 1000 );

		assert.isTrue( OSApp.Firmware.sendToOS.calledOnce );
		assert.isTrue( $.mobile.loading.calledWith( "hide" ) );
		assert.isFalse( OSApp.Status.refreshStatus.called );
		assert.isFalse( OSApp.UIDom.goBack.called );
	} );

	it( "hides the loader when stopping all stations fails", function() {
		sandbox.stub( OSApp.currentSession, "isControllerConnected" ).returns( true );
		sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( _question, _detail, confirm ) {
			confirm();
		} );
		OSApp.Firmware.sendToOS.returns( $.Deferred().reject( { status: 500 } ).promise() );
		$.mobile.loading.resetHistory();

		OSApp.Stations.stopAllStations();

		assert.isTrue( OSApp.Firmware.sendToOS.calledOnceWith( "/cv?pw=&rsn=1" ) );
		assert.isTrue( $.mobile.loading.calledWith( "show" ) );
		assert.isTrue( $.mobile.loading.calledWith( "hide" ) );
		assert.isFalse( OSApp.Status.refreshStatus.called );
	} );
} );

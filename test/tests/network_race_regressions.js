/* eslint-disable */

describe( "Network and queue race regressions", function() {
	it( "settles active and queued ajaxq promises when a queue is aborted", function() {
		var sandbox = sinon.createSandbox(),
			queue = "abort-regression-" + Date.now(),
			activeDeferred = $.Deferred(),
			activeRequest = activeDeferred.promise(),
			activeFailure = sandbox.spy(),
			queuedFailure = sandbox.spy();

		activeRequest.abort = function() {
			activeDeferred.reject( { status:0, statusText:"abort" }, "abort", "abort" );
		};
		sandbox.stub( $, "ajax" ).returns( activeRequest );
		var active = $.ajaxq( queue, { url:"/active" } ).fail( activeFailure ),
			queued = $.ajaxq( queue, { url:"/queued" } ).fail( queuedFailure );

		assert.isTrue( $.ajaxq.isRunning( queue ) );
		$.ajaxq.abort( queue );

		assert.isTrue( activeFailure.calledOnce );
		assert.isTrue( queuedFailure.calledOnce );
		assert.equal( active.state(), "rejected" );
		assert.equal( queued.state(), "rejected" );
		assert.isFalse( $.ajaxq.isRunning( queue ) );
		assert.isTrue( $.ajax.calledOnce, "the queued request must never start" );
		sandbox.restore();
	} );

	it( "limits local discovery to the configured worker count", function() {
		var sandbox = sinon.createSandbox(),
			oldDeviceIP = OSApp.currentDevice.deviceIp,
			oldScan = OSApp.Network.activeScan,
			requests = [];

		try {
			if ( oldScan && typeof oldScan.cancel === "function" ) oldScan.cancel();
			OSApp.currentDevice.deviceIp = "192.168.50.20";
			sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
				callback( { sites:"{}" } );
			} );
			sandbox.stub( $.mobile, "loading" );
			sandbox.stub( $, "ajax" ).callsFake( function() {
				var deferred = $.Deferred(), request = deferred.promise();
				request.abort = function() {
					deferred.reject( { status:0, statusText:"abort" } );
				};
				requests.push( { deferred:deferred, request:request } );
				return request;
			} );

			var scan = OSApp.Network.startScan( 80, 0 );
			assert.equal( requests.length, OSApp.Network.SCAN_CONCURRENCY );
			assert.equal( scan.inFlight, OSApp.Network.SCAN_CONCURRENCY );

			requests[ 0 ].deferred.reject( { status:0, statusText:"timeout" } );
			assert.equal( requests.length, OSApp.Network.SCAN_CONCURRENCY + 1 );
			assert.equal( scan.inFlight, OSApp.Network.SCAN_CONCURRENCY );

			scan.cancel();
			assert.isNull( OSApp.Network.activeScan );
			assert.isTrue( $.mobile.loading.calledWith( "hide" ) );
		} finally {
			if ( OSApp.Network.activeScan && typeof OSApp.Network.activeScan.cancel === "function" ) {
				OSApp.Network.activeScan.cancel();
			}
			sandbox.restore();
			OSApp.currentDevice.deviceIp = oldDeviceIP;
			OSApp.Network.activeScan = oldScan || null;
		}
	} );

	it( "clears station metadata only on the captured site record", function() {
		var sandbox = sinon.createSandbox(),
			saved,
			sites = {
				Old:{
						os_ip:"old.example", notes:{ 0:"old note" }, images:{ 0:"b2xk" },
					lastRunTime:{ 0:123 }
				},
				New:{
						os_ip:"new.example", notes:{ 0:"new note" }, images:{ 0:"bmV3" },
					lastRunTime:{ 0:456 }
				}
			};

		try {
			sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, done ) {
				done( { sites:JSON.stringify( sites ), current_site:"New" } );
			} );
			sandbox.stub( OSApp.Storage, "set" ).callsFake( function( values, done ) {
				saved = JSON.parse( values.sites );
				if ( done ) done();
			} );
			var cloudSave = sandbox.stub( OSApp.Network, "cloudSaveSites" );

			var operation = OSApp.Options.clearStationMetadata( "Old" );
			assert.equal( operation.state(), "resolved" );
			assert.deepEqual( saved.Old.notes, {} );
			assert.deepEqual( saved.Old.images, {} );
			assert.deepEqual( saved.Old.lastRunTime, {} );
			assert.deepEqual( saved.New.notes, { 0:"new note" } );
			assert.deepEqual( saved.New.images, { 0:"bmV3" } );
			assert.deepEqual( saved.New.lastRunTime, { 0:456 } );
			assert.isTrue( cloudSave.calledOnce );
		} finally {
			sandbox.restore();
		}
	} );

	it( "routes firmware-3 sensor writes through the serialized POST mutation queue", function() {
		var sandbox = sinon.createSandbox(),
			old = {
				controller:OSApp.currentSession.controller,
				generation:OSApp.currentSession.generation,
				pass:OSApp.currentSession.pass,
				prefix:OSApp.currentSession.prefix,
				ip:OSApp.currentSession.ip,
				token:OSApp.currentSession.token
			};

		try {
			OSApp.currentSession.controller = { options:{ fwv:300 } };
			OSApp.currentSession.generation = 90;
			OSApp.currentSession.pass = "session-hash";
			OSApp.currentSession.prefix = "https://";
			OSApp.currentSession.ip = "controller.test";
			OSApp.currentSession.token = undefined;
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
			sandbox.stub( $, "ajaxq" ).returns( $.Deferred().resolve( { result:1 } ).promise() );

			OSApp.Firmware.sendToOS( "/csn?pw=&uuid=42", "json" );
			OSApp.Firmware.sendToOS( "/dsn?pw=&uuid=42", "json" );

			assert.equal( $.ajaxq.callCount, 2 );
			[ 0, 1 ].forEach( function( index ) {
				var call = $.ajaxq.getCall( index ), options = call.args[ 1 ];
				assert.equal( call.args[ 0 ], "change" );
				assert.equal( options.type, "POST" );
				assert.equal( options.timeout, OSApp.Constants.http.REQUEST_TIMEOUT_MS );
				assert.notInclude( options.url, "?" );
				assert.equal( options.data.pw, "session-hash" );
				assert.equal( options.data.uuid, "42" );
			} );
		} finally {
			sandbox.restore();
			Object.assign( OSApp.currentSession, old );
		}
	} );

	it( "serializes legacy station writes without misclassifying the sn0 status read", function() {
		var sandbox = sinon.createSandbox(),
			old = {
				controller:OSApp.currentSession.controller,
				generation:OSApp.currentSession.generation,
				pass:OSApp.currentSession.pass,
				prefix:OSApp.currentSession.prefix,
				ip:OSApp.currentSession.ip,
				token:OSApp.currentSession.token
			};

		try {
			OSApp.currentSession.controller = { options:{ fwv:"OSPi" } };
			OSApp.currentSession.generation = 91;
			OSApp.currentSession.pass = "";
			OSApp.currentSession.prefix = "http://";
			OSApp.currentSession.ip = "controller.test";
			OSApp.currentSession.token = undefined;
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( false );
			sandbox.stub( $, "ajaxq" ).returns( $.Deferred().resolve( "ok" ).promise() );

			OSApp.Firmware.sendToOS( "/sn1=1&t=60" );
			OSApp.Firmware.sendToOS( "/sn0" );

			assert.equal( $.ajaxq.getCall( 0 ).args[ 0 ], "change" );
			assert.equal( $.ajaxq.getCall( 1 ).args[ 0 ], "default" );
		} finally {
			sandbox.restore();
			Object.assign( OSApp.currentSession, old );
		}
	} );

	it( "rejects a modern mutation reply without an integer result", function( done ) {
		var sandbox = sinon.createSandbox(),
			old = {
				controller:OSApp.currentSession.controller,
				generation:OSApp.currentSession.generation,
				pass:OSApp.currentSession.pass,
				prefix:OSApp.currentSession.prefix,
				ip:OSApp.currentSession.ip,
				token:OSApp.currentSession.token
			};

		OSApp.currentSession.controller = { options:{ fwv:221 } };
		OSApp.currentSession.generation = 91;
		OSApp.currentSession.pass = "session-hash";
		OSApp.currentSession.prefix = "https://";
		OSApp.currentSession.ip = "controller.test";
		OSApp.currentSession.token = undefined;
		sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( false );
		sandbox.stub( $, "ajaxq" ).returns( $.Deferred().resolve( { result:1.5 } ).promise() );

		OSApp.Firmware.sendToOS( "/cv?pw=&en=1", "json" ).then( function() {
			cleanup();
			done( new Error( "Malformed modern mutation response unexpectedly resolved" ) );
		}, function( error ) {
			assert.equal( error.statusText, "invalid-response" );
			cleanup();
			done();
		} );

		function cleanup() {
			sandbox.restore();
			Object.assign( OSApp.currentSession, old );
		}
	} );

	it( "rejects a non-JSON modern mutation reply", function( done ) {
		var sandbox = sinon.createSandbox(),
			old = {
				controller:OSApp.currentSession.controller,
				generation:OSApp.currentSession.generation,
				pass:OSApp.currentSession.pass,
				prefix:OSApp.currentSession.prefix,
				ip:OSApp.currentSession.ip,
				token:OSApp.currentSession.token
			};

		OSApp.currentSession.controller = { options:{ fwv:221 } };
		OSApp.currentSession.generation = 91;
		OSApp.currentSession.pass = "session-hash";
		OSApp.currentSession.prefix = "https://";
		OSApp.currentSession.ip = "controller.test";
		OSApp.currentSession.token = undefined;
		sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( false );
		sandbox.stub( $, "ajaxq" ).returns( $.Deferred().resolve( "<html>proxy failure</html>" ).promise() );

		OSApp.Firmware.sendToOS( "/cv?pw=&en=1", "json" ).then( function() {
			cleanup();
			done( new Error( "Non-JSON modern mutation response unexpectedly resolved" ) );
		}, function( error ) {
			assert.equal( error.statusText, "invalid-response" );
			cleanup();
			done();
		} );

		function cleanup() {
			sandbox.restore();
			Object.assign( OSApp.currentSession, old );
		}
	} );

	it( "ignores an old account's BAD_TOKEN and token-rotation responses", function() {
		var sandbox = sinon.createSandbox(),
			oldEpoch = OSApp.Network.cloudAuthEpoch,
			cloudToken = "account-a",
			requestOptions,
			callback = sandbox.spy();

		try {
			OSApp.Network.cloudAuthEpoch = 200;
			sandbox.stub( OSApp.Storage, "get" ).callsFake( function( keys, done ) {
				if ( Array.isArray( keys ) ) done( { cloudToken:cloudToken, cloudDataToken:"data-key" } );
				else done( { cloudToken:cloudToken } );
			} );
			var storageSet = sandbox.stub( OSApp.Storage, "set" );
			var expired = sandbox.stub( OSApp.Network, "handleExpiredLogin" );
			sandbox.stub( $, "ajax" ).callsFake( function( options ) {
				requestOptions = options;
				return $.Deferred().promise();
			} );

			OSApp.Network.cloudGetSites( callback );
			cloudToken = "account-b";
			OSApp.Network.bumpCloudAuthEpoch();
			requestOptions.success( { success:false, message:"BAD_TOKEN" } );
			assert.isFalse( expired.called );
			assert.isFalse( storageSet.called );
			assert.isTrue( callback.calledWith( false, "STALE_TOKEN" ) );

			callback.resetHistory();
			requestOptions = null;
			OSApp.Network.cloudGetSites( callback );
			cloudToken = "account-c";
			OSApp.Network.bumpCloudAuthEpoch();
			requestOptions.success( { success:true, sites:"ciphertext", token:"rotated-account-b" } );
			assert.isFalse( storageSet.called );
			assert.isTrue( callback.calledWith( false, "STALE_TOKEN" ) );
		} finally {
			sandbox.restore();
			OSApp.Network.cloudAuthEpoch = oldEpoch;
		}
	} );

	it( "commits a legitimate cloud token rotation before returning sites", function() {
		var sandbox = sinon.createSandbox(),
			oldEpoch = OSApp.Network.cloudAuthEpoch,
			cloudToken = "account-a",
			requestOptions,
			result;

		try {
			OSApp.Network.cloudAuthEpoch = 300;
			sandbox.stub( OSApp.Storage, "get" ).callsFake( function( keys, done ) {
				if ( Array.isArray( keys ) ) done( { cloudToken:cloudToken, cloudDataToken:"data-key" } );
				else done( { cloudToken:cloudToken } );
			} );
			var storageSet = sandbox.stub( OSApp.Storage, "set" ).callsFake( function( values, done ) {
				if ( values.cloudToken ) cloudToken = values.cloudToken;
				if ( done ) done();
			} );
			sandbox.stub( sjcl, "decrypt" ).returns( "{}" );
			sandbox.stub( $, "ajax" ).callsFake( function( options ) {
				requestOptions = options;
				return $.Deferred().promise();
			} );

			OSApp.Network.cloudGetSites( function( sites, message, authContext ) {
				result = { sites:sites, message:message, authContext:authContext };
			} );
			requestOptions.success( { success:true, sites:"ciphertext", token:"account-a-rotated" } );

			assert.deepEqual( result.sites, {} );
			assert.equal( result.authContext.token, "account-a-rotated" );
			assert.equal( result.authContext.epoch, 301 );
			assert.isTrue( storageSet.calledWith( { cloudToken:"account-a-rotated" } ) );
			assert.equal( cloudToken, "account-a-rotated" );
		} finally {
			sandbox.restore();
			OSApp.Network.cloudAuthEpoch = oldEpoch;
		}
	} );

	it( "keeps the matching local controller selected when adopting the cloud site list", function() {
		var sandbox = sinon.createSandbox(),
			old = {
				local:OSApp.currentSession.local,
				ip:OSApp.currentSession.ip,
				generation:OSApp.currentSession.generation
			},
			oldSequence = OSApp.Network.cloudSyncStartSequence,
			previousActive = $( ".ui-page-active" ).removeClass( "ui-page-active" ),
			activePage = $( "<div id='cloud-sync-test' class='ui-page-active'></div>" ).appendTo( "body" ),
			stored;

		try {
			OSApp.currentSession.local = true;
			OSApp.currentSession.ip = "192.0.2.44";
			OSApp.currentSession.generation = 400;
			var cloudSites = {
				"Cloud Home":{ os_ip:"192.0.2.44", os_pw:"hash" },
				Remote:{ os_ip:"remote.example", os_pw:"hash" }
			};
			sandbox.stub( OSApp.Network, "cloudGetSites" ).callsFake( function( done ) {
				done( cloudSites, undefined, { token:"token", epoch:OSApp.Network.cloudAuthEpoch } );
			} );
			sandbox.stub( OSApp.Storage, "get" ).callsFake( function( keys, done ) {
				done( {
					sites:JSON.stringify( { Local:{ os_ip:"192.0.2.44", os_pw:"hash" } } ),
					current_site:"Local"
				} );
			} );
			sandbox.stub( OSApp.Storage, "set" ).callsFake( function( values, done ) {
				stored = values;
				if ( done ) done();
			} );
			sandbox.stub( OSApp.Network, "cloudSaveSites" );
			sandbox.stub( OSApp.Sites, "invalidateCurrentSession" );
			var updateList = sandbox.stub( OSApp.Sites, "updateSiteList" );
			sandbox.stub( OSApp.Sites, "checkConfigured" );
			sandbox.stub( OSApp.UIDom, "updateLoginButtons" );

			OSApp.Network.cloudSyncStart();

			assert.equal( stored.current_site, "Cloud Home" );
			assert.deepEqual( JSON.parse( stored.sites ), cloudSites );
			assert.isTrue( updateList.calledWith( [ "Cloud Home", "Remote" ], "Cloud Home" ) );
		} finally {
			sandbox.restore();
			activePage.remove();
			previousActive.addClass( "ui-page-active" );
			OSApp.currentSession.local = old.local;
			OSApp.currentSession.ip = old.ip;
			OSApp.currentSession.generation = old.generation;
			OSApp.Network.cloudSyncStartSequence = oldSequence;
		}
	} );
} );

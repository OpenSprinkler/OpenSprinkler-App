/* eslint-disable */

describe( "Controller snapshot lifecycle", function() {
	function saveSession() {
		return {
			controller: OSApp.currentSession.controller,
			generation: OSApp.currentSession.generation,
			ip: OSApp.currentSession.ip,
			prefix: OSApp.currentSession.prefix,
			token: OSApp.currentSession.token,
			pass: OSApp.currentSession.pass,
			loaderOwner: OSApp.uiState.operationLoaderOwner,
			programMutation: OSApp.Programs.activeMutation,
			programLoaderOwner: OSApp.Programs.mutationLoaderOwner,
			dashboardSubmission: OSApp.Dashboard.activeStationSubmission,
			stationAction: OSApp.Stations.activeAction
		};
	}

	function restoreSession( saved ) {
		OSApp.currentSession.controller = saved.controller;
		OSApp.currentSession.generation = saved.generation;
		OSApp.currentSession.ip = saved.ip;
		OSApp.currentSession.prefix = saved.prefix;
		OSApp.currentSession.token = saved.token;
		OSApp.currentSession.pass = saved.pass;
		OSApp.uiState.operationLoaderOwner = saved.loaderOwner;
		OSApp.Programs.activeMutation = saved.programMutation;
		OSApp.Programs.mutationLoaderOwner = saved.programLoaderOwner;
		OSApp.Dashboard.activeStationSubmission = saved.dashboardSubmission;
		OSApp.Stations.activeAction = saved.stationAction;
	}

	it( "settles program controls and dashboard loaders after a same-site snapshot replacement", function() {
		var sandbox = sinon.createSandbox(),
			saved = saveSession(),
			fixture = $( "<div id='addprogram'><button id='submit-new'>Save</button></div>" ).appendTo( "body" );

		try {
			OSApp.currentSession.generation = 700;
			OSApp.currentSession.token = "";
			OSApp.currentSession.prefix = "http://";
			OSApp.currentSession.ip = "controller.test";
			OSApp.currentSession.controller = { snapshot:1 };
			OSApp.Programs.activeMutation = null;
			OSApp.Programs.mutationLoaderOwner = null;
			OSApp.Dashboard.activeStationSubmission = null;
			OSApp.Stations.activeAction = null;
			OSApp.uiState.operationLoaderOwner = null;
			var loading = sandbox.stub( $.mobile, "loading" ),
				programIdentity = OSApp.Programs.captureSessionIdentity(),
				dashboardIdentity = OSApp.Dashboard.captureSessionIdentity(),
				stationIdentity = OSApp.Stations.captureSessionIdentity(),
				mutation = OSApp.Programs.beginMutation();

			assert.isNotNull( mutation );
			assert.isTrue( OSApp.Programs.showMutationLoader( mutation ) );
			assert.isTrue( fixture.find( "button" ).prop( "disabled" ) );
			assert.isNull( OSApp.Programs.beginMutation(), "same-site mutations remain locked" );

			OSApp.currentSession.controller = { snapshot:2 };
			assert.isTrue( OSApp.Programs.isSessionIdentityCurrent( programIdentity ) );
			assert.isTrue( OSApp.Dashboard.isSessionIdentityCurrent( dashboardIdentity ) );
			assert.isTrue( OSApp.Stations.isSessionIdentityCurrent( stationIdentity ) );
			OSApp.Programs.finishMutation( mutation );

			assert.isFalse( fixture.find( "button" ).prop( "disabled" ) );
			assert.isNull( OSApp.Programs.activeMutation );
			assert.isTrue( loading.calledWith( "hide" ) );

			var submission = OSApp.Dashboard.beginStationSubmission();
			assert.isNotNull( submission );
			assert.isNull( OSApp.Dashboard.beginStationSubmission(), "station submits are single-flight" );
			OSApp.currentSession.controller = { snapshot:3 };
			OSApp.Dashboard.finishStationSubmission( submission );

			assert.isNull( OSApp.Dashboard.activeStationSubmission );
			assert.equal( loading.withArgs( "hide" ).callCount, 2 );
			assert.isNull( OSApp.uiState.operationLoaderOwner );
		} finally {
			fixture.remove();
			sandbox.restore();
			restoreSession( saved );
		}
	} );

	it( "releases stale locks without hiding a newer operation loader", function() {
		var sandbox = sinon.createSandbox(),
			saved = saveSession(),
			fixture = $( "<div id='addprogram'><button id='delete-0'>Delete</button></div>" ).appendTo( "body" );

		try {
			OSApp.currentSession.generation = 710;
			OSApp.currentSession.token = "OT000000000000000000000000000000";
			OSApp.currentSession.prefix = "";
			OSApp.currentSession.ip = "";
			OSApp.currentSession.controller = {};
			OSApp.Programs.activeMutation = null;
			OSApp.Programs.mutationLoaderOwner = null;
			OSApp.uiState.operationLoaderOwner = null;
			var loading = sandbox.stub( $.mobile, "loading" ),
				mutation = OSApp.Programs.beginMutation(),
				newerOwner = {};

			OSApp.Programs.showMutationLoader( mutation );
			OSApp.currentSession.generation = 711;
			OSApp.uiState.operationLoaderOwner = newerOwner;
			OSApp.Programs.finishMutation( mutation );

			assert.isNull( OSApp.Programs.activeMutation );
			assert.isNull( OSApp.Programs.mutationLoaderOwner );
			assert.isFalse( fixture.find( "button" ).prop( "disabled" ) );
			assert.strictEqual( OSApp.uiState.operationLoaderOwner, newerOwner );
			assert.isFalse( loading.calledWith( "hide" ) );
		} finally {
			fixture.remove();
			sandbox.restore();
			restoreSession( saved );
		}
	} );

	it( "completes a delayed station stop after a same-site snapshot replacement", function() {
		var sandbox = sinon.createSandbox(),
			clock = sandbox.useFakeTimers(),
			saved = saveSession(),
			callback = sandbox.spy();

		try {
			OSApp.currentSession.generation = 720;
			OSApp.currentSession.token = "";
			OSApp.currentSession.prefix = "http://";
			OSApp.currentSession.ip = "controller.test";
			OSApp.currentSession.controller = { snapshot:1 };
			OSApp.Stations.activeAction = null;
			OSApp.uiState.operationLoaderOwner = null;
			sandbox.stub( OSApp.Firmware, "sendToOS" ).returns( $.Deferred().resolve().promise() );
			var loading = sandbox.stub( $.mobile, "loading" );

			OSApp.Stations.stopStations( callback );
			assert.isNotNull( OSApp.Stations.activeAction );
			OSApp.currentSession.controller = { snapshot:2 };
			clock.tick( 1000 );

			assert.isTrue( callback.calledOnce );
			assert.isTrue( loading.calledWith( "hide" ) );
			assert.isNull( OSApp.Stations.activeAction );
			assert.isNull( OSApp.uiState.operationLoaderOwner );
		} finally {
			sandbox.restore();
			restoreSession( saved );
		}
	} );

	it( "rejects endpoint changes even when the controller object is unchanged", function() {
		var saved = saveSession();
		try {
			OSApp.currentSession.generation = 730;
			OSApp.currentSession.token = "";
			OSApp.currentSession.prefix = "http://";
			OSApp.currentSession.ip = "first.test";
			OSApp.currentSession.controller = {};
			var programIdentity = OSApp.Programs.captureSessionIdentity(),
				dashboardIdentity = OSApp.Dashboard.captureSessionIdentity(),
				stationIdentity = OSApp.Stations.captureSessionIdentity();

			OSApp.currentSession.ip = "second.test";
			assert.isFalse( OSApp.Programs.isSessionIdentityCurrent( programIdentity ) );
			assert.isFalse( OSApp.Dashboard.isSessionIdentityCurrent( dashboardIdentity ) );
			assert.isFalse( OSApp.Stations.isSessionIdentityCurrent( stationIdentity ) );
		} finally {
			restoreSession( saved );
		}
	} );

	it( "accepts a validated extender conversion and exposes cancellation", function( done ) {
		var sandbox = sinon.createSandbox(),
			saved = saveSession(),
			request = $.Deferred();
		request.abort = sandbox.spy();
		var ajax = sandbox.stub( $, "ajax" ).returns( request ),
			conversion;

		try {
			OSApp.currentSession.pass = "secret&value";
			conversion = OSApp.Stations.convertRemoteToExtender( "c000020a005000" );
			assert.isFunction( conversion.abort );
			assert.equal( ajax.firstCall.args[ 0 ].timeout, 10000 );
			assert.include( ajax.firstCall.args[ 0 ].url, "pw=secret%26value" );
			conversion.abort();
			assert.isTrue( request.abort.calledOnce );

			conversion.done( function() {
				sandbox.restore();
				restoreSession( saved );
				done();
			} ).fail( function( error ) {
				sandbox.restore();
				restoreSession( saved );
				done( error || new Error( "Extender conversion unexpectedly failed" ) );
			} );
			request.resolve( { result:1 } );
		} catch ( error ) {
			sandbox.restore();
			restoreSession( saved );
			done( error );
		}
	} );

	it( "rejects an unsuccessful extender conversion response", function( done ) {
		var sandbox = sinon.createSandbox(),
			request = $.Deferred();
		request.abort = sandbox.spy();
		sandbox.stub( $, "ajax" ).returns( request );

		var conversion = OSApp.Stations.convertRemoteToExtender( "c000020a005000" );
		conversion.done( function() {
			sandbox.restore();
			done( new Error( "Invalid extender response unexpectedly resolved" ) );
		} ).fail( function( error ) {
			try {
				assert.equal( error.statusText, "invalid-response" );
				done();
			} catch ( assertionError ) {
				done( assertionError );
			} finally {
				sandbox.restore();
			}
		} );
		request.resolve( { result:0 } );
	} );

	it( "filters controller-supplied GPIO pins before rendering", function() {
		assert.isNull( OSApp.Dashboard.normalizeGPIOPins( "<option onmouseover=alert(1)>" ) );
		assert.deepEqual( OSApp.Dashboard.normalizeGPIOPins( [ 5, "6", -1, 100, 5, 26, NaN ] ), [ 5, 26 ] );
		assert.lengthOf( OSApp.Dashboard.normalizeGPIOPins( new Array( 70 ).fill( 7 ) ), 1 );
	} );
} );

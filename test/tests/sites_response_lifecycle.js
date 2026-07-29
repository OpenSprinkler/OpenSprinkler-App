/* eslint-disable */

describe( "Controller response and site lifecycle boundaries", function() {
	function validAggregate() {
		return {
			options: { fwv:221, wl:100 },
			settings: { loc:"", en:1, nbrd:1, lrun:[ 0, 0, 0, 0 ], ps:[ [ 0, 0, 0, 0 ] ] },
			stations: { snames:[ "S1" ], masop:[ 0 ] },
			programs: { nprogs:0, nboards:1, pd:[] },
			status: { sn:[ 0 ] }
		};
	}

	function validController() {
		var controller = validAggregate();
		controller.status = controller.status.sn;
		return controller;
	}

	it( "requires complete aligned aggregate controller data", function() {
		var aggregate = validAggregate();
		assert.isTrue( OSApp.Sites.isAggregateResponse( aggregate ) );

		delete aggregate.settings.ps;
		assert.isFalse( OSApp.Sites.isAggregateResponse( aggregate ) );
		aggregate = validAggregate();
		delete aggregate.settings.lrun;
		assert.isFalse( OSApp.Sites.isAggregateResponse( aggregate ) );
		aggregate = validAggregate();
		aggregate.settings.ps = [];
		assert.isFalse( OSApp.Sites.isAggregateResponse( aggregate ) );
		aggregate = validAggregate();
		aggregate.status.sn = [];
		assert.isFalse( OSApp.Sites.isAggregateResponse( aggregate ) );
		aggregate = validAggregate();
		aggregate.stations.snames = [ null ];
		assert.isFalse( OSApp.Sites.isAggregateResponse( aggregate ) );
	} );

	it( "rejects unsafe GPIO metadata and firmware-incompatible program shapes", function() {
		var settings = validAggregate().settings,
			modernFlat = { nprogs:1, nboards:1, pd:[ [ 1, 127, 0, 60, 60, 0, 30, 1 ] ] };

		settings.gpio = [ 2, 10, 255 ];
		assert.isTrue( OSApp.Sites.isSettingsResponse( settings ) );
		settings.gpio = [ "<img src=x>" ];
		assert.isFalse( OSApp.Sites.isSettingsResponse( settings ) );
		settings.gpio = [ 256 ];
		assert.isFalse( OSApp.Sites.isSettingsResponse( settings ) );
		assert.isFalse( OSApp.Sites.isProgramsResponse( modernFlat, 221, 8 ) );
		assert.isTrue( OSApp.Sites.isProgramsResponse( modernFlat, 209, 8 ) );
	} );

	it( "keeps the installed legacy snapshot untouched when a staged endpoint fails", function( done ) {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			originalGeneration = OSApp.currentSession.generation,
			controller = validController();

		OSApp.currentSession.controller = controller;
		OSApp.currentSession.generation = 21;
		sandbox.stub( OSApp.Sites, "updateControllerOptions" ).callsFake( function( callback, destination ) {
			destination.options.wl = 25;
			return $.Deferred().resolve().promise();
		} );
		sandbox.stub( OSApp.Sites, "updateControllerStations" ).callsFake( function( callback, destination ) {
			destination.stations.snames = [ "partial" ];
			return $.Deferred().reject( { statusText:"endpoint-failed" } ).promise();
		} );

		OSApp.Sites.updateControllerSnapshot( [ "updateControllerOptions", "updateControllerStations" ] ).then( function() {
			cleanup();
			done( new Error( "Partial staged refresh unexpectedly resolved" ) );
		}, function() {
			assert.strictEqual( OSApp.currentSession.controller, controller );
			assert.equal( controller.options.wl, 100 );
			assert.equal( controller.stations.snames[ 0 ], "S1" );
			cleanup();
			done();
		} );

		function cleanup() {
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.generation = originalGeneration;
		}
	} );

	it( "atomically installs a valid station expansion assembled from legacy endpoints", function( done ) {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			originalGeneration = OSApp.currentSession.generation,
			controller = validController(),
			names = Array.from( { length:9 }, function( unused, index ) { return "S" + ( index + 1 ); } ),
			statuses = Array.from( { length:9 }, function() { return [ 0, 0, 0, 0 ]; } );

		OSApp.currentSession.controller = controller;
		OSApp.currentSession.generation = 22;
		sandbox.stub( OSApp.Sites, "updateControllerOptions" ).callsFake( function( callback, destination ) {
			destination.options = { fwv:221, wl:100 };
			return $.Deferred().resolve().promise();
		} );
		sandbox.stub( OSApp.Sites, "updateControllerStations" ).callsFake( function( callback, destination ) {
			destination.stations = { snames:names, masop:[ 0, 0 ] };
			return $.Deferred().resolve().promise();
		} );
		sandbox.stub( OSApp.Sites, "updateControllerPrograms" ).callsFake( function( callback, destination ) {
			destination.programs = {
				nprogs:1, nboards:2,
				pd:[ [ 1, 127, 0, [ 60, 0, 0, 0 ], Array.from( { length:9 }, function() { return 0; } ), "Expanded" ] ]
			};
			return $.Deferred().resolve().promise();
		} );
		sandbox.stub( OSApp.Sites, "updateControllerSettings" ).callsFake( function( callback, destination ) {
			destination.settings = { loc:"", en:1, nbrd:2, lrun:[ 0, 0, 0, 0 ], ps:statuses };
			return $.Deferred().resolve().promise();
		} );
		sandbox.stub( OSApp.Sites, "updateControllerStatus" ).callsFake( function( callback, destination ) {
			destination.status = Array.from( { length:9 }, function() { return 0; } );
			return $.Deferred().resolve().promise();
		} );

		OSApp.Sites.updateControllerSnapshot( [
			"updateControllerOptions", "updateControllerStations", "updateControllerPrograms",
			"updateControllerSettings", "updateControllerStatus"
		] ).then( function( installed ) {
			assert.strictEqual( OSApp.currentSession.controller, installed );
			assert.notStrictEqual( installed, controller );
			assert.lengthOf( installed.stations.snames, 9 );
			assert.equal( installed.settings.nbrd, 2 );
			cleanup();
			done();
		}, function( error ) {
			cleanup();
			done( error || new Error( "Valid expansion was rejected" ) );
		} );

		function cleanup() {
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.generation = originalGeneration;
		}
	} );

	it( "serializes overlapping legacy status and full refresh snapshots", function( done ) {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			originalGeneration = OSApp.currentSession.generation,
			controller = validController(),
			firstOptions = $.Deferred(),
			firstStarted = $.Deferred(),
			methods = [
				"updateControllerOptions", "updateControllerStations", "updateControllerPrograms",
				"updateControllerSettings", "updateControllerStatus"
			],
			stubs = {},
			statusRequest,
			fullRequest,
			finished = false;

		OSApp.currentSession.controller = controller;
		OSApp.currentSession.generation = 23;
		sandbox.stub( OSApp.currentSession, "isControllerConnected" ).returns( true );
		sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( false );
		sandbox.stub( OSApp.Status, "checkStatus" );
		sandbox.stub( OSApp.Network, "networkFail" );
		methods.forEach( function( method ) {
			stubs[ method ] = sandbox.stub( OSApp.Sites, method ).callsFake( function() {
				if ( method === "updateControllerOptions" && stubs[ method ].callCount === 1 ) {
					firstStarted.resolve();
					return firstOptions.promise();
				}
				return $.Deferred().resolve().promise();
			} );
		} );

		statusRequest = OSApp.Status.refreshStatus();
		fullRequest = OSApp.Sites.refreshData();
		firstStarted.then( function() {
			assert.equal( stubs.updateControllerOptions.callCount, 1,
				"the full refresh must wait for the status snapshot" );
			assert.isFalse( stubs.updateControllerStations.called,
				"the queued full refresh must not start early" );
			firstOptions.resolve();
		} );

		$.when( statusRequest, fullRequest ).then( function() {
			assert.equal( stubs.updateControllerOptions.callCount, 2 );
			assert.equal( stubs.updateControllerStations.callCount, 1 );
			assert.equal( stubs.updateControllerPrograms.callCount, 1 );
			assert.equal( stubs.updateControllerSettings.callCount, 2 );
			assert.equal( stubs.updateControllerStatus.callCount, 2 );
			assert.isFalse( OSApp.Network.networkFail.called,
				"same-session serialization must not surface a network failure" );
			assert.notStrictEqual( OSApp.currentSession.controller, controller,
				"the queued full snapshot must still be installed" );
			finish();
		}, function( error ) {
			finish( error || new Error( "Overlapping refreshes unexpectedly failed" ) );
		} );

		function finish( error ) {
			if ( finished ) return;
			finished = true;
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.generation = originalGeneration;
			done( error );
		}
	} );

	it( "rejects a truncated aggregate without replacing cached controller state", function( done ) {
		var originalController = OSApp.currentSession.controller,
			originalGeneration = OSApp.currentSession.generation,
			cached = { cached:true },
			payload = validAggregate(),
			connected = sinon.stub( OSApp.currentSession, "isControllerConnected" ).returns( true ),
			version = sinon.stub( OSApp.Firmware, "checkOSVersion" ).returns( true ),
			send;

		delete payload.settings.lrun;
		OSApp.currentSession.controller = cached;
		OSApp.currentSession.generation = 30;
		send = sinon.stub( OSApp.Firmware, "sendToOS" ).returns( $.Deferred().resolve( payload ).promise() );
		OSApp.Sites.updateController().then( function() {
			cleanup();
			done( new Error( "Truncated aggregate unexpectedly resolved" ) );
		}, function() {
			assert.strictEqual( OSApp.currentSession.controller, cached );
			cleanup();
			done();
		} );

		function cleanup() {
			send.restore();
			version.restore();
			connected.restore();
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.generation = originalGeneration;
		}
	} );

	[ "updateControllerPrograms", "updateControllerStations", "updateControllerStatus" ].forEach( function( method ) {
		it( "rejects null legacy payloads in " + method, function( done ) {
			var originalController = OSApp.currentSession.controller,
				originalFw183 = OSApp.currentSession.fw183,
				originalGeneration = OSApp.currentSession.generation,
				controller = { programs:{ cached:true }, stations:{ cached:true }, status:[ 1 ] },
				send;

			OSApp.currentSession.controller = controller;
			OSApp.currentSession.fw183 = true;
			OSApp.currentSession.generation = 41;
			send = sinon.stub( OSApp.Firmware, "sendToOS" ).returns( $.Deferred().resolve( null ).promise() );
			OSApp.Sites[ method ]().then( function() {
				cleanup();
				done( new Error( method + " unexpectedly resolved" ) );
			}, function() {
				assert.strictEqual( OSApp.currentSession.controller, controller );
				cleanup();
				done();
			} );

			function cleanup() {
				send.restore();
				OSApp.currentSession.controller = originalController;
				OSApp.currentSession.fw183 = originalFw183;
				OSApp.currentSession.generation = originalGeneration;
			}
		} );
	} );

	it( "sanitizes special-station responses and ignores stale completion", function( done ) {
		var originalController = OSApp.currentSession.controller,
			originalGeneration = OSApp.currentSession.generation,
			firstController = { special:{ cached:true } },
			secondController = { special:{ current:true } },
			pending = $.Deferred(),
			send = sinon.stub( OSApp.Firmware, "sendToOS" );

		OSApp.currentSession.controller = firstController;
		OSApp.currentSession.generation = 50;
		send.onFirstCall().returns( $.Deferred().resolve( {
			0:null,
			1:{ st:2, sd:"c0a80101005000" },
			2:{ st:99, sd:"bad" }
		} ).promise() );
		send.onSecondCall().returns( pending.promise() );

		OSApp.Sites.updateControllerStationSpecial().then( function() {
			assert.deepEqual( firstController.special, { 1:{ st:2, sd:"c0a80101005000" } } );
			var staleRequest = OSApp.Sites.updateControllerStationSpecial();
			OSApp.currentSession.generation = 51;
			OSApp.currentSession.controller = secondController;
			pending.resolve( { 0:{ st:1, sd:"late" } } );
			staleRequest.then( function() {
				cleanup();
				done( new Error( "Stale special-station response unexpectedly resolved" ) );
			}, function() {
				assert.deepEqual( secondController.special, { current:true } );
				cleanup();
				done();
			} );
		}, function( error ) {
			cleanup();
			done( error || new Error( "Valid special-station response rejected" ) );
		} );

		function cleanup() {
			send.restore();
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.generation = originalGeneration;
		}
	} );

	it( "uses site Basic Auth for password probes and suppresses stale callbacks", function() {
		var originalGeneration = OSApp.currentSession.generation,
			pending = $.Deferred(),
			callback = sinon.spy(),
			authorization,
			ajax = sinon.stub( $, "ajax" ).callsFake( function( options ) {
				options.beforeSend( {
					setRequestHeader:function( name, value ) {
						if ( name === "Authorization" ) authorization = value;
					}
				} );
				return pending.promise();
			} );

		OSApp.currentSession.generation = 60;
		OSApp.Network.checkPW( "hash", callback, {
			os_ip:"controller.test", ssl:"1", auth_user:"user", auth_pw:"secret"
		} );
		assert.equal( authorization, OSApp.Utils.getBasicAuthHeader( "user", "secret" ) );
		assert.equal( ajax.firstCall.args[ 0 ].url, "https://controller.test/sp?pw=hash&npw=hash&cpw=hash" );

		OSApp.currentSession.generation = 61;
		pending.resolve( { result:1 } );
		assert.isFalse( callback.called );
		ajax.restore();
		OSApp.currentSession.generation = originalGeneration;
	} );

	it( "ignores malformed password-hash migration replies", function() {
		var original = {
			controller:OSApp.currentSession.controller,
			generation:OSApp.currentSession.generation,
			pass:OSApp.currentSession.pass
		},
			controller = {},
			storageGet = sinon.stub( OSApp.Storage, "get" ).callsFake( function( keys, callback ) {
				callback( { sites:JSON.stringify( { Home:{ os_pw:"clear" } } ), current_site:"Home" } );
			} ),
			storageSet = sinon.spy( OSApp.Storage, "set" ),
			send = sinon.stub( OSApp.Firmware, "sendToOS" ).returns( $.Deferred().resolve( null ).promise() );

		OSApp.currentSession.controller = controller;
		OSApp.currentSession.generation = 70;
		OSApp.currentSession.pass = "clear";
		OSApp.Sites.fixPasswordHash( "Home" );
		assert.isFalse( storageSet.called );
		assert.equal( OSApp.currentSession.pass, "clear" );

		send.restore();
		storageSet.restore();
		storageGet.restore();
		OSApp.currentSession.controller = original.controller;
		OSApp.currentSession.generation = original.generation;
		OSApp.currentSession.pass = original.pass;
	} );
} );

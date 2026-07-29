/* eslint-disable */

describe( "Import/export security boundaries", function() {
	function currentBackup() {
		return {
			options: { fwv: 221, hp0: 1, hp1: 2, dhcp: 0, devid: 7, wl: 100 },
			settings: { loc: "Test", nbrd: 1 },
			stations: { snames: [ "S1" ], masop: [ 0 ] },
			programs: { nprogs: 0, nboards: 1, mnp: 40, mnst: 4, pnsize: 32, pd: [] }
		};
	}

	function clone( value ) {
		return JSON.parse( JSON.stringify( value ) );
	}

	it( "normalizes bounded modern and legacy backups without retaining caller references", function() {
		var modern = currentBackup(),
			legacy = {
				options: { fwv: 209, seq: 1 },
				settings: { loc: "Legacy", nbrd: 1 },
				stations: {
					snames: [ "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8" ],
					masop: [ 0 ], stn_seq: [ 255 ]
				},
				programs: { nprogs: 1, nboards: 1, pd: [ [ 1, 127, 0, 60, 60, 0, 30, 1 ] ] }
			},
			normalizedModern = OSApp.ImportExport.normalizeConfig( modern ),
			normalizedLegacy = OSApp.ImportExport.normalizeConfig( legacy );

		assert.isObject( normalizedModern );
		assert.isObject( normalizedLegacy );
		assert.notStrictEqual( normalizedModern, modern );
		assert.notStrictEqual( normalizedModern.stations.snames, modern.stations.snames );
		assert.deepEqual( normalizedLegacy.programs.pd[ 0 ], legacy.programs.pd[ 0 ] );
		legacy.options.fwv = "1.8.3-ospi";
		assert.isObject( OSApp.ImportExport.normalizeConfig( legacy ), "legacy OSPi exports use a string firmware marker" );
		legacy.options.fwv = "1.9.0-OSPi";
		assert.isObject( OSApp.ImportExport.normalizeConfig( legacy ), "supported OSPi exports retain version strings" );

		modern.stations.snames[ 0 ] = "Changed after validation";
		assert.equal( normalizedModern.stations.snames[ 0 ], "S1" );
	} );

	it( "rejects malformed, oversized, non-finite, and poison-key backups before confirmation", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			invalid = [],
			settingsNull = currentBackup(),
			stationObject = currentBackup(),
			injectedMask = currentBackup(),
			arraySetting = currentBackup(),
			badSpecial = currentBackup(),
			tooManyStations = currentBackup(),
			tooManyPrograms = currentBackup(),
			badProgram = currentBackup(),
			nonFinite = currentBackup(),
			badUnicode = currentBackup(),
			poison = currentBackup();

		settingsNull.settings = null;
		stationObject.stations.snames[ 0 ] = { replace: "not callable" };
		injectedMask.stations.masop[ 0 ] = "0&evil=1";
		arraySetting.settings.wto = [];
		badSpecial.special = { 0: null };
		tooManyStations.stations.snames = new Array( OSApp.ImportExport.limits.maxStations + 1 ).fill( "S" );
		tooManyPrograms.programs.pd = Array.from( { length: OSApp.ImportExport.limits.maxPrograms + 1 }, function() { return []; } );
		tooManyPrograms.programs.nprogs = tooManyPrograms.programs.pd.length;
		badProgram.programs.pd = [ [ 1, 127, 0, [ 60 ], [ 30 ], "Bad" ] ];
		badProgram.programs.nprogs = 1;
		nonFinite.options.wl = Infinity;
		badUnicode.stations.snames[ 0 ] = "bad\ud800name";
		poison.options = JSON.parse( '{"fwv":221,"__proto__":{"polluted":true}}' );
		invalid = [ settingsNull, stationObject, injectedMask, arraySetting, badSpecial, tooManyStations,
			tooManyPrograms, badProgram, nonFinite, badUnicode, poison ];

		OSApp.currentSession.controller = { options: {}, settings: {}, stations: {}, programs: {} };
		try {
			var error = sandbox.stub( OSApp.Errors, "showError" ),
				confirm = sandbox.stub( OSApp.UIDom, "areYouSure" ),
				send = sandbox.stub( OSApp.Firmware, "sendToOS" );

			invalid.forEach( function( backup ) {
				assert.isFalse( OSApp.ImportExport.importConfig( backup ) );
			} );

			assert.equal( error.callCount, invalid.length );
			assert.isTrue( error.alwaysCalledWith( OSApp.Language._( "Invalid configuration" ) ) );
			assert.isTrue( confirm.notCalled );
			assert.isTrue( send.notCalled );
			assert.isUndefined( {}.polluted );
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
		}
	} );

	it( "encodes every imported string and keeps station parameters from creating query keys", function( done ) {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			payload = "value &evil=1 # ü",
			backup = currentBackup(),
			commands = [],
			refresh = $.Deferred(),
			finished = false,
			cleanup = function( error ) {
				if ( finished ) return;
				finished = true;
				refresh.reject( { status: 0, statusText: "abort" } );
				setTimeout( function() {
					sandbox.restore();
					OSApp.currentSession.controller = originalController;
					done( error );
				}, 0 );
			};

		backup.settings.loc = payload;
		backup.settings.dname = payload;
		backup.settings.wto = { key: payload };
		backup.stations.snames[ 0 ] = payload;
		backup.stations.masop[ 0 ] = 255;
		backup.special = { 0: { st: 4, sd: payload } };
		OSApp.currentSession.controller = {
			options: clone( backup.options ), settings: {}, stations: { snames: [ "S1" ] }, programs: { nboards: 1 }
		};

		try {
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
			sandbox.stub( OSApp.Firmware, "isOSPi" ).returns( false );
			sandbox.stub( OSApp.Firmware, "sendToOS" ).callsFake( function( command ) {
				commands.push( command );
				return $.Deferred().resolve().promise();
			} );
			sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( question, warning, callback ) {
				return callback();
			} );
			sandbox.stub( $.mobile, "loading" );
			sandbox.stub( OSApp.Sites, "updateController" ).callsFake( function() {
				try {
					var co = commands.find( function( command ) { return command.indexOf( "/co?" ) === 0; } ),
						stationNames = commands.find( function( command ) { return command.indexOf( "/cs?pw=&s0=" ) === 0; } ),
						stationBits = commands.find( function( command ) { return command.indexOf( "/cs?pw=&m0=" ) === 0; } ),
						special = commands.find( function( command ) { return command.indexOf( "/cs?pw=&sid=" ) === 0; } ),
						coParams = new URL( "http://controller" + co ).searchParams,
						nameParams = new URL( "http://controller" + stationNames ).searchParams,
						bitParams = new URL( "http://controller" + stationBits ).searchParams,
						specialParams = new URL( "http://controller" + special ).searchParams;

					assert.equal( coParams.get( "loc" ), payload );
					assert.equal( coParams.get( "dname" ), payload );
					assert.equal( coParams.get( "wto" ), OSApp.Utils.escapeJSON( backup.settings.wto ) );
					assert.isFalse( coParams.has( "evil" ) );
					assert.equal( nameParams.get( "s0" ), payload.replace( /\s/g, "_" ) );
					assert.isFalse( nameParams.has( "evil" ) );
					assert.equal( bitParams.get( "m0" ), "255" );
					assert.equal( specialParams.get( "sd" ), payload );
					assert.isFalse( specialParams.has( "evil" ) );
				} catch ( error ) {
					cleanup( error );
				}
				return refresh.promise();
			} );

			OSApp.ImportExport.importConfig( backup );
			setTimeout( function() { cleanup(); }, 100 );
		} catch ( error ) {
			cleanup( error );
		}
	} );

	it( "does not apply a confirmed restore after the active controller changes", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			originalGeneration = OSApp.currentSession.generation,
			confirm;

		OSApp.currentSession.controller = { options: {}, settings: {}, stations: {}, programs: {} };
		OSApp.currentSession.generation = 10;
		try {
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
			sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( question, warning, callback ) {
				confirm = callback;
			} );
			var error = sandbox.stub( OSApp.Errors, "showError" ),
				send = sandbox.stub( OSApp.Firmware, "sendToOS" );

			OSApp.ImportExport.importConfig( currentBackup() );
			OSApp.currentSession.generation++;
			assert.isFalse( confirm() );

			assert.isTrue( error.calledOnce );
			assert.isTrue( send.notCalled );
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.generation = originalGeneration;
		}
	} );

	it( "rejects program counts above the target limit before erasing existing programs", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			backup = currentBackup();
		backup.programs.nprogs = 1;
		backup.programs.pd = [ [ 1, 127, 0, [ 60, -1, -1, -1 ], [ 30 ], "Too many" ] ];
		OSApp.currentSession.controller = {
			options: clone( backup.options ), settings: {}, stations: { snames: [ "S1" ] }, programs: { mnp: 0 }
		};
		try {
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
			sandbox.stub( OSApp.Firmware, "isOSPi" ).returns( false );
			var error = sandbox.stub( OSApp.Errors, "showError" ),
				confirm = sandbox.stub( OSApp.UIDom, "areYouSure" ),
				send = sandbox.stub( OSApp.Firmware, "sendToOS" );
			assert.isFalse( OSApp.ImportExport.importConfig( backup ) );
			assert.match( error.lastCall.args[ 0 ], /more programs/i );
			assert.isTrue( confirm.notCalled );
			assert.isTrue( send.notCalled );
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
		}
	} );

	it( "accepts the full weather-method range and requires complete board masks and bounded special stations", function() {
		[ 0, 4, 128, 132 ].forEach( function( value ) {
			var backup = currentBackup();
			backup.options.uwt = value;
			assert.isObject( OSApp.ImportExport.normalizeConfig( backup ), "accepts uwt=" + value );
		} );
		[ 5, 127, 133 ].forEach( function( value ) {
			var backup = currentBackup();
			backup.options.uwt = value;
			assert.isNull( OSApp.ImportExport.normalizeConfig( backup ), "rejects uwt=" + value );
		} );
		[ 0, 1, 2, 3, 240 ].forEach( function( value ) {
			var backup = currentBackup();
			backup.options.urs = value;
			assert.isObject( OSApp.ImportExport.normalizeConfig( backup ), "accepts urs=" + value );
		} );
		var badSensorMode = currentBackup();
		badSensorMode.options.urs = 4;
		assert.isNull( OSApp.ImportExport.normalizeConfig( badSensorMode ) );
		var byteMasks = currentBackup();
		byteMasks.options.ife = 255;
		byteMasks.options.ife2 = 128;
		assert.isObject( OSApp.ImportExport.normalizeConfig( byteMasks ) );
		byteMasks.options.ife = 256;
		assert.isNull( OSApp.ImportExport.normalizeConfig( byteMasks ) );

		var twoBoards = currentBackup();
		twoBoards.stations.snames = new Array( 9 ).fill( "Station" );
		twoBoards.settings.nbrd = 2;
		twoBoards.programs.nboards = 2;
		assert.isNull( OSApp.ImportExport.normalizeConfig( twoBoards ), "master mask cannot omit the second board" );
		twoBoards.stations.masop.push( 0 );
		assert.isObject( OSApp.ImportExport.normalizeConfig( twoBoards ) );
		twoBoards.stations.ignore_rain = [ 0 ];
		assert.isNull( OSApp.ImportExport.normalizeConfig( twoBoards ), "each supplied mask must cover every board" );
		twoBoards.stations.ignore_rain.push( 0 );
		assert.isObject( OSApp.ImportExport.normalizeConfig( twoBoards ) );
		twoBoards.stations.masop.push( 0 );
		assert.isNull( OSApp.ImportExport.normalizeConfig( twoBoards ), "masks cannot include boards absent from snames" );

		var special = currentBackup();
		special.special = { 0: { st: 6, sd: "safe" } };
		assert.isObject( OSApp.ImportExport.normalizeConfig( special ) );
		special.special[ 0 ].st = 7;
		assert.isNull( OSApp.ImportExport.normalizeConfig( special ) );
		special.special[ 0 ] = { st: 0, sd: "bad\ud800" };
		assert.isNull( OSApp.ImportExport.normalizeConfig( special ) );

		var disabledDate = currentBackup();
		disabledDate.programs.nprogs = 1;
		disabledDate.programs.pd = [ [ 1, 127, 0, [ 60, -1, -1, -1 ], [ 30 ], "Date", [ 0, 0, 0 ] ] ];
		assert.deepEqual( OSApp.ImportExport.normalizeConfig( disabledDate ).programs.pd[ 0 ][ 6 ], [ 0, 33, 415 ] );
	} );

	it( "restores program metadata serially, sends options last, and performs one final refresh", function( done ) {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			backup = currentBackup(),
			commands = [],
			completed = false,
			finish = function( error ) {
				if ( completed ) return;
				completed = true;
				sandbox.restore();
				OSApp.currentSession.controller = originalController;
				done( error );
			};

		backup.programs.nprogs = 1;
		backup.options.ext = 1;
		backup.settings.nbrd = 2;
		backup.stations.snames = new Array( 16 ).fill( "Station" );
		backup.stations.masop = [ 0, 0 ];
		backup.programs.nboards = 2;
		backup.programs.pd = [ [
			1, 127, 0, [ 60, -1, -1, -1 ], new Array( 16 ).fill( 30 ), "Program One", [ 1, 33, 415 ],
			{ flag: 3, uuid: 42, splits: [ { x: 10, y: 0.5 } ] }
		] ];
		OSApp.currentSession.controller = {
			options: Object.assign( clone( backup.options ), { ext: 0 } ), settings: {}, stations: { snames: new Array( 8 ).fill( "Old" ) },
			programs: { nboards: 1 }, sensors: { sn: [ { uuid: 42 } ] }
		};

		try {
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
			sandbox.stub( OSApp.Firmware, "isOSPi" ).returns( false );
			sandbox.stub( OSApp.Firmware, "sendToOS" ).callsFake( function( command ) {
				commands.push( command );
				return $.Deferred().resolve( { result: 1 } ).promise();
			} );
			sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( question, warning, callback ) {
				return callback();
			} );
			var loading = sandbox.stub( $.mobile, "loading" ),
				abort = sandbox.stub( $.ajaxq, "abort" ),
				refresh = sandbox.stub( OSApp.Sites, "updateController" ).returns( $.Deferred().resolve().promise() );
			sandbox.stub( OSApp.Weather, "updateWeather" );
			sandbox.stub( OSApp.UIDom, "goHome" ).callsFake( function() {
				try {
					var programCommand = commands.find( function( command ) { return command.indexOf( "/cp?" ) === 0; } ),
						params = new URL( "http://controller" + programCommand ).searchParams,
						earlyOptions = commands.findIndex( function( command ) {
							return command.indexOf( "/co?" ) === 0 && new URL( "http://controller" + command ).searchParams.has( "ext" );
						} ),
						stationSettings = commands.findIndex( function( command ) { return command.indexOf( "/cs?pw=&m0=" ) === 0; } );
					assert.match( commands[ commands.length - 1 ], /^\/co\?/ );
					assert.isAtLeast( earlyOptions, 0 );
					assert.isBelow( earlyOptions, stationSettings, "board expansion precedes station masks" );
					assert.deepEqual( JSON.parse( params.get( "v" ) ), backup.programs.pd[ 0 ].slice( 0, 5 ) );
					assert.equal( params.get( "endr" ), "1" );
					assert.equal( params.get( "from" ), "33" );
					assert.equal( params.get( "to" ), "415" );
					assert.equal( params.get( "snadj" ), "3,42,10,0.5" );
					assert.isTrue( refresh.calledOnce );
					assert.equal( loading.withArgs( "show" ).callCount, 1 );
					assert.equal( loading.withArgs( "hide" ).callCount, 1 );
					assert.equal( abort.withArgs( "default" ).callCount, 1 );
					assert.equal( abort.withArgs( "change" ).callCount, 1 );
					assert.isNull( OSApp.ImportExport.activeOperation );
					finish();
				} catch ( error ) {
					finish( error );
				}
			} );

			OSApp.ImportExport.importConfig( backup );
			setTimeout( function() { finish( new Error( "restore did not complete" ) ); }, 500 );
		} catch ( error ) {
			finish( error );
		}
	} );

	it( "preflights, creates, verifies, and remaps backup sensors before programs", function( done ) {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			backup = currentBackup(),
			sourceSensor = {
				uuid: 10, name: "Source sensor", unit: 0, flag: 0, interval: 10,
				min: 0, max: 100, type: 4, extra: { input: 0 }
			},
			state = [],
			commands = [],
			completed = false,
			finish = function( error ) {
				if ( completed ) return;
				completed = true;
				if ( OSApp.ImportExport.activeOperation ) {
					OSApp.ImportExport.settleOperation( OSApp.ImportExport.activeOperation );
				}
				sandbox.restore();
				OSApp.currentSession.controller = originalController;
				done( error );
			};

		backup.sensors = { sn: [ sourceSensor ], count: 1 };
		backup.programs.nprogs = 1;
		backup.programs.pd = [ [
			1, 127, 0, [ 60, -1, -1, -1 ], [ 30 ], "Adjusted",
			[ 0, 0, 0 ], { flag: 1, uuid: 10, splits: [ { x: 0, y: 25 } ] }
		] ];
		OSApp.currentSession.controller = {
			options: clone( backup.options ), settings: {}, stations: { snames: [ "S1" ] },
			programs: { nboards: 1, mnp: 10 }, sensors: { sn: state }
		};

		try {
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
			sandbox.stub( OSApp.Firmware, "isOSPi" ).returns( false );
			sandbox.stub( OSApp.Firmware, "sendToOS" ).callsFake( function( command ) {
				commands.push( command );
				if ( command.indexOf( "/jsd?" ) === 0 ) {
					return $.Deferred().resolve( {
						sensors: [ {}, {}, {}, {}, { name: "Onboard", args: [ {
							arg: "input", options: [ { id: 0 }, { id: 1 }, { id: 2 }, { id: 3 } ]
						} ] } ],
						units: [ { value: 0, group: 0 } ], enums: {}
					} ).promise();
				}
				if ( command.indexOf( "/csn?" ) === 0 ) {
					var createParams = new URL( "http://controller" + command ).searchParams;
					assert.equal( createParams.get( "uuid" ), "-1" );
					state.push( Object.assign( clone( sourceSensor ), { uuid: 101 } ) );
					return $.Deferred().resolve( { result: 1 } ).promise();
				}
				if ( command.indexOf( "/jsn?" ) === 0 ) {
					return $.Deferred().resolve( { sn: clone( state ), count: state.length } ).promise();
				}
				return $.Deferred().resolve( { result: 1 } ).promise();
			} );
			sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( question, warning, callback ) {
				return callback();
			} );
			sandbox.stub( $.mobile, "loading" );
			sandbox.stub( $.ajaxq, "abort" );
			sandbox.stub( OSApp.Errors, "showError" );
			var refresh = sandbox.stub( OSApp.Sites, "updateController" ).returns( $.Deferred().resolve().promise() );
			sandbox.stub( OSApp.Weather, "updateWeather" );
			sandbox.stub( OSApp.UIDom, "goHome" ).callsFake( function() {
				try {
					var programCommand = commands.find( function( command ) { return command.indexOf( "/cp?" ) === 0; } ),
						programParams = new URL( "http://controller" + programCommand ).searchParams,
						lastSensorRead = commands.map( function( command, index ) {
							return command.indexOf( "/jsn?" ) === 0 ? index : -1;
						} ).filter( function( index ) { return index >= 0; } ).pop(),
						programIndex = commands.indexOf( programCommand );
					assert.match( commands[ 0 ], /^\/jsd\?/ );
					assert.isBelow( lastSensorRead, programIndex );
					assert.equal( programParams.get( "snadj" ), "1,101,0,25" );
					assert.equal( programParams.get( "endr" ), "0" );
					assert.equal( programParams.get( "from" ), "33" );
					assert.equal( programParams.get( "to" ), "415" );
					assert.isTrue( refresh.calledOnce );
					finish();
				} catch ( error ) {
					finish( error );
				}
			} );

			OSApp.ImportExport.importConfig( backup );
			setTimeout( function() { finish( new Error( "sensor restore did not complete" ) ); }, 750 );
		} catch ( error ) {
			finish( error );
		}
	} );

	it( "keeps one restore command active at a time and releases a stale operation", function( done ) {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			originalGeneration = OSApp.currentSession.generation,
			backup = currentBackup(),
			firstRequest = $.Deferred(),
			started = $.Deferred(),
			completed = false,
			finish = function( error ) {
				if ( completed ) return;
				completed = true;
				firstRequest.reject( { status: 0, statusText: "abort" } );
				setTimeout( function() {
					sandbox.restore();
					OSApp.currentSession.controller = originalController;
					OSApp.currentSession.generation = originalGeneration;
					done( error );
				}, 0 );
			};

		OSApp.currentSession.generation = 20;
		OSApp.currentSession.controller = {
			options: clone( backup.options ), settings: {}, stations: { snames: [ "S1" ] }, programs: { nboards: 1 }
		};

		try {
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
			sandbox.stub( OSApp.Firmware, "isOSPi" ).returns( false );
			var send = sandbox.stub( OSApp.Firmware, "sendToOS" ).callsFake( function() {
				started.resolve();
				return firstRequest.promise();
			} ),
				confirm = sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( question, warning, callback ) {
					return callback();
				} ),
				loading = sandbox.stub( $.mobile, "loading" ),
				abort = sandbox.stub( $.ajaxq, "abort" );
			var errorToast = sandbox.stub( OSApp.Errors, "showError" );

			OSApp.ImportExport.importConfig( backup );
			started.done( function() {
				try {
					assert.isTrue( send.calledOnce, "only the first command is active" );
					assert.isFalse( OSApp.ImportExport.importConfig( backup ) );
					assert.isTrue( confirm.calledOnce, "a second restore is rejected before confirmation" );
					assert.match( errorToast.lastCall.args[ 0 ], /already in progress/i );
					OSApp.currentSession.generation++;
					assert.isFalse( OSApp.ImportExport.isImportInProgress() );
					assert.isNull( OSApp.ImportExport.activeOperation );
					assert.equal( loading.withArgs( "show" ).callCount, 1 );
					assert.equal( loading.withArgs( "hide" ).callCount, 1 );
					assert.equal( abort.withArgs( "change" ).callCount, 2, "start and stale cancellation both clear changes" );
					var release = OSApp.Firmware.acquireMutationLease( function( lease ) { assert.isObject( lease ); } );
					assert.isFunction( release, "stale-session settlement releases mutation ownership" );
					release();
					finish();
				} catch ( error ) {
					finish( error );
				}
			} );
			setTimeout( function() { finish( new Error( "first restore command did not start" ) ); }, 500 );
		} catch ( error ) {
			finish( error );
		}
	} );

	it( "rejects unrelated mutations until the restore releases its private lease", function( done ) {
		var sandbox = sinon.createSandbox(),
			backup = currentBackup(),
			oldSession = {
				controller: OSApp.currentSession.controller,
				generation: OSApp.currentSession.generation,
				pass: OSApp.currentSession.pass,
				prefix: OSApp.currentSession.prefix,
				ip: OSApp.currentSession.ip,
				token: OSApp.currentSession.token,
				fw183: OSApp.currentSession.fw183,
				auth: OSApp.currentSession.auth
			},
			requests = [],
			completed = false,
			finish = function( error ) {
				if ( completed ) return;
				completed = true;
				if ( $.ajaxq.isRunning( "change" ) ) $.ajaxq.abort( "change" );
				if ( OSApp.ImportExport.activeOperation ) {
					OSApp.ImportExport.settleOperation( OSApp.ImportExport.activeOperation );
				}
				setTimeout( function() {
					sandbox.restore();
					Object.assign( OSApp.currentSession, oldSession );
					done( error );
				}, 0 );
			};

		OSApp.currentSession.controller = {
			options: clone( backup.options ), settings: {}, stations: { snames: [ "S1" ] }, programs: { nboards: 1 }
		};
		OSApp.currentSession.generation = 30;
		OSApp.currentSession.pass = "session-hash";
		OSApp.currentSession.prefix = "https://";
		OSApp.currentSession.ip = "controller.test";
		OSApp.currentSession.token = undefined;
		OSApp.currentSession.fw183 = false;
		OSApp.currentSession.auth = false;

		try {
			sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( question, warning, callback ) {
				return callback();
			} );
			sandbox.stub( $.mobile, "loading" );
			sandbox.stub( OSApp.Errors, "showError" );
			sandbox.stub( $, "ajax" ).callsFake( function( options ) {
				var deferred = $.Deferred(), request = deferred.promise();
				request.abort = function() {
					deferred.reject( { status: 0, statusText: "abort" } );
				};
				requests.push( { deferred: deferred, options: options } );
				return request;
			} );

			OSApp.ImportExport.importConfig( backup );
			setTimeout( function() {
				try {
					assert.lengthOf( requests, 1, "the first restore mutation starts" );
					var rejected;
					OSApp.Firmware.sendToOS( "/cv?pw=&en=0" ).fail( function( error ) { rejected = error; } );
					assert.equal( rejected.statusText, "mutation-locked" );
					assert.lengthOf( requests, 1, "the unrelated mutation never enters AjaxQ" );

					requests[ 0 ].deferred.resolve( { result: 1 } );
					setTimeout( function() {
						try {
							assert.lengthOf( requests, 2, "the next restore command starts after the first" );
							assert.notInclude( requests[ 1 ].options.url, "en=0", "the external command cannot interleave" );
							$.ajaxq.abort( "change" );
							assert.isTrue( OSApp.ImportExport.settleOperation( OSApp.ImportExport.activeOperation ) );

							OSApp.Firmware.sendToOS( "/cv?pw=&en=0" );
							assert.lengthOf( requests, 3, "normal mutation dispatch resumes after release" );
							assert.include( requests[ 2 ].options.url, "en=0" );
							finish();
						} catch ( error ) {
							finish( error );
						}
					}, 25 );
				} catch ( error ) {
					finish( error );
				}
			}, 25 );
		} catch ( error ) {
			finish( error );
		}
	} );

	it( "suppresses scheduled and status refreshes while a restore owns the controller", function() {
		var sandbox = sinon.createSandbox(),
			operation,
			stop;
		try {
			var clock = sandbox.useFakeTimers(),
				loading = sandbox.stub( $.mobile, "loading" );
			sandbox.stub( $.ajaxq, "abort" );
			var controllerRefresh = sandbox.stub( OSApp.Sites, "updateController" ),
				scheduledRefresh = sandbox.stub().returns( $.Deferred().resolve().promise() );
			operation = OSApp.ImportExport.beginOperation( OSApp.ImportExport.captureTarget() );
			assert.isObject( operation );
			OSApp.Status.refreshStatus();
			assert.isTrue( controllerRefresh.notCalled );

			stop = OSApp.UIDom.startSerialRefresh( scheduledRefresh, 25 );
			clock.tick( 25 );
			assert.isTrue( scheduledRefresh.notCalled );
			assert.isTrue( OSApp.ImportExport.settleOperation( operation ) );
			clock.tick( 25 );
			assert.isTrue( scheduledRefresh.calledOnce );
			assert.equal( loading.withArgs( "show" ).callCount, 1 );
			assert.equal( loading.withArgs( "hide" ).callCount, 1 );
		} finally {
			if ( stop ) stop();
			if ( operation && !operation.settled ) OSApp.ImportExport.settleOperation( operation );
			sandbox.restore();
		}
	} );

	it( "bounds text parsing and handles corrupt local backup data without throwing", function() {
		assert.isFalse( OSApp.ImportExport.parseConfigText( "{broken", false ).ok );
		var importLimit = OSApp.ImportExport.limits.maxImportCharacters;
		try {
			OSApp.ImportExport.limits.maxImportCharacters = 8;
			assert.isFalse( OSApp.ImportExport.parseConfigText( "123456789", false ).ok );
		} finally {
			OSApp.ImportExport.limits.maxImportCharacters = importLimit;
		}
		assert.deepEqual( OSApp.ImportExport.parseConfigText( "{“value“:1}", true ), {
			ok: true, data: { value: 1 }
		} );
		assert.deepEqual( OSApp.ImportExport.parseConfigText( '{"value":"Keep “curly” quotes"}', true ), {
			ok: true, data: { value: "Keep “curly” quotes" }
		} );

		var sandbox = sinon.createSandbox(),
			fileCapable = OSApp.currentDevice.isFileCapable,
			popup;
		try {
			OSApp.currentDevice.isFileCapable = false;
			sandbox.stub( OSApp.UIDom, "openPopup" ).callsFake( function( value ) { popup = value; } );
			sandbox.stub( $.fn, "popup" ).returnsThis();
			var error = sandbox.stub( OSApp.Errors, "showError" ),
				importConfig = sandbox.stub( OSApp.ImportExport, "importConfig" );

			OSApp.ImportExport.getImportMethod( "{broken" );
			assert.doesNotThrow( function() { popup.find( ".localMethod" ).triggerHandler( "click" ); } );
			assert.isTrue( error.calledOnce );
			assert.isTrue( importConfig.notCalled );
		} finally {
			sandbox.restore();
			OSApp.currentDevice.isFileCapable = fileCapable;
		}
	} );
} );

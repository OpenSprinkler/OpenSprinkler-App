/* eslint-disable */

describe( "Logs and analog lifecycle regressions", function() {
	it( "bounds log dates to the firmware epoch and keys cross-midnight runs by their end day", function() {
		assert.isNotNull( OSApp.Logs.parseDateRange( "01/01/1970", "02/07/2106" ) );
		assert.isNull( OSApp.Logs.parseDateRange( "12/31/1969", "01/01/1970" ) );
		assert.isNull( OSApp.Logs.parseDateRange( "01/01/1970", "02/08/2106" ) );

		var end = Date.UTC( 2024, 5, 10, 0, 5 ) / 1000;
		assert.equal( OSApp.Logs.logFileDay( end ), Date.UTC( 2024, 5, 10 ) / 86400000 );
		assert.notEqual( OSApp.Logs.logFileDay( end ), Date.UTC( 2024, 5, 9 ) / 86400000 );
		assert.equal( OSApp.Dates.dateOnly( new Date( 0 ) ), "01/01/1970" );
	} );

	it( "destroys log timelines and clears stale exports for every replacement path", function( done ) {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldFileCapable = OSApp.currentDevice.isFileCapable,
			oldIsiOS = OSApp.currentDevice.isiOS,
			validRows = [ [ 1, 0, 60, 1717930000 ] ],
			responses = [
				$.Deferred().resolve( validRows ).promise(),
				$.Deferred().resolve( [] ).promise(),
				$.Deferred().resolve( validRows ).promise(),
				$.Deferred().reject( { statusText:"error" } ).promise(),
				$.Deferred().resolve( validRows ).promise()
			],
			timelines = [],
			refresh,
			page,
			finished = false;

		function finish( error ) {
			if ( finished ) return;
			finished = true;
			$.mobile.window.off( ".logsTimeline" );
			if ( page ) page.remove();
			sandbox.restore();
			OSApp.currentDevice.isFileCapable = oldFileCapable;
			OSApp.currentDevice.isiOS = oldIsiOS;
			OSApp.currentSession.controller = oldController;
			done( error );
		}

		function afterCallbacks( callback ) {
			setTimeout( function() {
				try {
					callback();
				} catch ( error ) {
					finish( error );
				}
			}, 20 );
		}

		try {
			OSApp.currentSession.controller = {
				options:{},
				settings:{ devt:1717930000 },
				stations:{ snames:[ "S1" ] },
				programs:{ pd:[] }
			};
			OSApp.currentDevice.isFileCapable = true;
			OSApp.currentDevice.isiOS = false;
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( false );
			sandbox.stub( OSApp.Firmware, "isOSPi" ).returns( false );
			sandbox.stub( OSApp.Firmware, "sendToOS" ).callsFake( function() {
				return responses.shift();
			} );
			sandbox.stub( OSApp.UIDom, "changeHeader" ).callsFake( function( options ) {
				refresh = options.rightBtn.on;
			} );
			sandbox.stub( OSApp.UIDom, "getDatatablesConfig" ).returns( {} );
			sandbox.stub( OSApp.UIDom, "fixInputClick" );
			sandbox.stub( $.fn, "collapsible" ).returnsThis();
			sandbox.stub( $.fn, "DataTable" ).returnsThis();
			sandbox.stub( vis, "Timeline" ).callsFake( function() {
				var timeline = { setGroups:sinon.spy(), redraw:sinon.spy(), destroy:sinon.spy() };
				timelines.push( timeline );
				return timeline;
			} );

			OSApp.Logs.displayPage();
			page = $( "#logs" );
			page.find( "#log_table" ).prop( "checked", false );
			page.find( "#log_timeline" ).prop( "checked", true );
			page.triggerHandler( "pageshow" );

			afterCallbacks( function() {
				assert.lengthOf( timelines, 1 );
				assert.match( page.find( ".export_logs" ).attr( "href" ), /^data:text\/json/ );

				page.find( "#log_timeline" ).prop( "checked", false );
				page.find( "#log_table" ).prop( "checked", true ).trigger( "change" );
				assert.isTrue( timelines[ 0 ].destroy.calledOnce );
				$.mobile.window.triggerHandler( "resize" );
				assert.isFalse( timelines[ 0 ].redraw.called );

				page.find( "#log_table" ).prop( "checked", false );
				page.find( "#log_timeline" ).prop( "checked", true ).trigger( "change" );
				assert.lengthOf( timelines, 2 );
				refresh();

				afterCallbacks( function() {
					assert.isTrue( timelines[ 1 ].destroy.calledOnce );
					assert.isUndefined( page.find( ".export_logs" ).attr( "href" ) );
					refresh();

					afterCallbacks( function() {
						assert.lengthOf( timelines, 3 );
						assert.match( page.find( ".export_logs" ).attr( "href" ), /^data:text\/json/ );
						refresh();

						afterCallbacks( function() {
							assert.isTrue( timelines[ 2 ].destroy.calledOnce );
							assert.isUndefined( page.find( ".export_logs" ).attr( "href" ) );
							page.find( "#log_timeline" ).prop( "checked", false );
							page.find( "#log_table" ).prop( "checked", true ).trigger( "change" );
							page.find( "#log_table" ).prop( "checked", false );
							page.find( "#log_timeline" ).prop( "checked", true ).trigger( "change" );
							assert.lengthOf( timelines, 3 );
							refresh();

							afterCallbacks( function() {
								assert.lengthOf( timelines, 4 );
								page.triggerHandler( "pagehide" );
								assert.isTrue( timelines[ 3 ].destroy.calledOnce );
								$.mobile.window.triggerHandler( "resize" );
								assert.isFalse( timelines[ 3 ].redraw.called );
								finish();
							} );
						} );
					} );
				} );
			} );
		} catch ( error ) {
			finish( error );
		}
	} );

	it( "keeps one current mail export handler", function() {
		var sandbox = sinon.createSandbox(),
			oldFileCapable = OSApp.currentDevice.isFileCapable,
			button = $( "<a>" ).appendTo( document.body );

		try {
			OSApp.currentDevice.isFileCapable = false;
			sandbox.stub( window, "open" );
			OSApp.Utils.exportObj( button, { version:1 }, "Export" );
			OSApp.Utils.exportObj( button, { version:2 }, "Export" );
			button.triggerHandler( "click" );

			assert.isTrue( window.open.calledOnce );
			assert.include( decodeURIComponent( window.open.firstCall.args[ 0 ] ), '"version":2' );
			assert.notInclude( decodeURIComponent( window.open.firstCall.args[ 0 ] ), '"version":1' );
		} finally {
			button.remove();
			sandbox.restore();
			OSApp.currentDevice.isFileCapable = oldFileCapable;
		}
	} );

	it( "ignores delayed analog editor discovery after page or session invalidation", function( done ) {
		var sandbox = sinon.createSandbox(),
			oldGeneration = OSApp.currentSession.generation,
			oldLifecycle = OSApp.Analog.editorLifecycleGeneration,
			oldSensors = OSApp.Analog.analogSensors,
			oldAdjustments = OSApp.Analog.progAdjusts,
			staleSensor = $.Deferred(),
			currentSensor = $.Deferred(),
			adjustment = $.Deferred(),
			sensorRequests = [ staleSensor, currentSensor ],
			page,
			finished = false;

		function finish( error ) {
			if ( finished ) return;
			finished = true;
			if ( page && $.contains( document.documentElement, page.get( 0 ) ) ) {
				page.triggerHandler( "pagehide" );
			}
			sandbox.restore();
			OSApp.currentSession.generation = oldGeneration;
			OSApp.Analog.editorLifecycleGeneration = oldLifecycle;
			OSApp.Analog.analogSensors = oldSensors;
			OSApp.Analog.progAdjusts = oldAdjustments;
			done( error );
		}

		try {
			OSApp.currentSession.generation = 40;
			OSApp.Analog.analogSensors = [];
			OSApp.Analog.progAdjusts = [];
			sandbox.stub( OSApp.Analog, "buildSensorConfig" ).returns(
				"<div><button id='add-sensor'></button><button id='add-progadjust'></button></div>"
			);
			sandbox.stub( OSApp.Firmware, "sendToOS" ).callsFake( function( path ) {
				if ( path === "/sf?pw=" ) return sensorRequests.shift().promise();
				if ( path === "/sh?pw=" ) return adjustment.promise();
				return $.Deferred().reject().promise();
			} );
			sandbox.stub( OSApp.UIDom, "changeHeader" );
			sandbox.stub( OSApp.UIDom, "openPopup" );

			OSApp.Analog.showAnalogSensorConfig();
			page = $( "#analogsensorconfig" );
			page.find( "#add-sensor" ).trigger( "click" );
			page.triggerHandler( "pagehide" );

			// Reopening the same cached page must not revive the first request.
			OSApp.Analog.showAnalogSensorConfig();
			page = $( "#analogsensorconfig" );
			staleSensor.resolve( { sensorTypes:[ { type:1, name:"SMT100" } ] } );

			setTimeout( function() {
				try {
					assert.isFalse( OSApp.UIDom.openPopup.called );
					page.find( "#add-progadjust" ).trigger( "click" );
					OSApp.currentSession.generation++;
					adjustment.resolve( { progTypes:[ { type:1, name:"Linear" } ] } );
				} catch ( error ) {
					finish( error );
					return;
				}

				setTimeout( function() {
					try {
						assert.isFalse( OSApp.UIDom.openPopup.called );

						// A request from the current page/session still opens normally.
						page.triggerHandler( "pagehide" );
						OSApp.Analog.showAnalogSensorConfig();
						page = $( "#analogsensorconfig" );
						page.find( "#add-sensor" ).trigger( "click" );
						currentSensor.resolve( { sensorTypes:[ { type:1, name:"SMT100" } ] } );
					} catch ( error ) {
						finish( error );
						return;
					}

					setTimeout( function() {
						try {
							assert.isTrue( OSApp.UIDom.openPopup.calledOnce );
							finish();
						} catch ( error ) {
							finish( error );
						}
					}, 20 );
				}, 20 );
			}, 20 );
		} catch ( error ) {
			finish( error );
		}
	} );

	it( "settles direct log clears before handing loader ownership to a refresh", function( done ) {
		var sandbox = sinon.createSandbox(),
			oldGeneration = OSApp.currentSession.generation,
			directRequest = $.Deferred(),
			refreshRequest = $.Deferred(),
			requests = [ directRequest, refreshRequest ],
			loading;

		function finish( error ) {
			sandbox.restore();
			OSApp.currentSession.generation = oldGeneration;
			done( error );
		}

		try {
			OSApp.currentSession.generation = 50;
			sandbox.stub( OSApp.UIDom, "areYouSure" ).callsFake( function( title, body, callback ) {
				callback();
			} );
			sandbox.stub( OSApp.Firmware, "isOSPi" ).returns( false );
			sandbox.stub( OSApp.Firmware, "sendToOS" ).callsFake( function() {
				return requests.shift().promise();
			} );
			sandbox.stub( OSApp.Errors, "showError" );
			loading = sandbox.stub( $.mobile, "loading" );

			// Options passes the click Event directly, not a completion callback.
			OSApp.Logs.clearLogs( $.Event( "click" ) );
			directRequest.resolve( {} );

			setTimeout( function() {
				try {
					assert.deepEqual( loading.args.map( function( args ) { return args[ 0 ]; } ), [ "show", "hide" ] );

					OSApp.Logs.clearLogs( function() {
						// Simulate requestData taking ownership of the global loader.
						$.mobile.loading( "show" );
					} );
					refreshRequest.resolve( {} );
				} catch ( error ) {
					finish( error );
					return;
				}

				setTimeout( function() {
					try {
						assert.deepEqual( loading.args.map( function( args ) { return args[ 0 ]; } ),
							[ "show", "hide", "show", "hide", "show" ] );
						finish();
					} catch ( error ) {
						finish( error );
					}
				}, 20 );
			}, 20 );
		} catch ( error ) {
			finish( error );
		}
	} );

	it( "reconciles concurrent analog mutations by stable record number", function() {
		var sensors = [ { nr:1 }, { nr:2 }, { nr:3 } ],
			adjustments = [ { nr:1, factor1:1 }, { nr:2, factor1:2 }, { nr:3, factor1:3 } ];

		assert.isTrue( OSApp.Analog.removeRecord( sensors, 1 ) );
		assert.isTrue( OSApp.Analog.removeRecord( sensors, 2 ) );
		assert.deepEqual( sensors, [ { nr:3 } ] );

		assert.isTrue( OSApp.Analog.removeRecord( adjustments, 1 ) );
		assert.isTrue( OSApp.Analog.replaceRecord( adjustments, 2, { nr:2, factor1:20 } ) );
		assert.deepEqual( adjustments, [ { nr:2, factor1:20 }, { nr:3, factor1:3 } ] );
		assert.isFalse( OSApp.Analog.replaceRecord( adjustments, 99, { nr:99 } ) );
		assert.equal( OSApp.Analog.normalizeDeletedCount( { deleted:0 } ), 0 );
		assert.isNull( OSApp.Analog.normalizeDeletedCount( null ) );
		assert.isNull( OSApp.Analog.normalizeDeletedCount( { deleted:"2" } ) );
	} );

	it( "downloads bounded sensor CSV with Basic Auth and removes its temporary anchor", function( done ) {
		var sandbox = sinon.createSandbox(),
			oldSession = {
				auth:OSApp.currentSession.auth, authUser:OSApp.currentSession.authUser,
				authPass:OSApp.currentSession.authPass, generation:OSApp.currentSession.generation,
				ip:OSApp.currentSession.ip, pass:OSApp.currentSession.pass,
				prefix:OSApp.currentSession.prefix, token:OSApp.currentSession.token
			},
			anchorCount = document.querySelectorAll( "a" ).length,
			requestOptions,
			header = { setRequestHeader:sinon.spy() },
			finished = false;

		function finish( error ) {
			if ( finished ) return;
			finished = true;
			sandbox.restore();
			Object.keys( oldSession ).forEach( function( key ) {
				OSApp.currentSession[ key ] = oldSession[ key ];
			} );
			done( error );
		}

		try {
			OSApp.currentSession.auth = true;
			OSApp.currentSession.authUser = "user";
			OSApp.currentSession.authPass = "pass";
			OSApp.currentSession.generation = 60;
			OSApp.currentSession.ip = "controller.test";
			OSApp.currentSession.pass = "p&x";
			OSApp.currentSession.prefix = "https://";
			OSApp.currentSession.token = "";
			sandbox.stub( $, "ajax" ).callsFake( function( options ) {
				requestOptions = options;
				return $.Deferred().resolve( "timestamp,value\n1,2\n" ).promise();
			} );
			sandbox.stub( window.URL, "createObjectURL" ).returns( "blob:sensor-log" );
			sandbox.stub( window.URL, "revokeObjectURL" );
			sandbox.stub( window.HTMLAnchorElement.prototype, "click" );
			sandbox.stub( OSApp.Errors, "showError" );

			OSApp.Analog.downloadSensorLog().done( function( result ) {
				setTimeout( function() {
					try {
						assert.isTrue( result );
						assert.equal( requestOptions.url, "https://controller.test/so?pw=p%26x&csv=1" );
						assert.isTrue( header.setRequestHeader.calledWith( "Authorization", "Basic dXNlcjpwYXNz" ) );
						assert.isTrue( window.HTMLAnchorElement.prototype.click.calledOnce );
						assert.equal( document.querySelectorAll( "a" ).length, anchorCount );
						assert.isTrue( window.URL.revokeObjectURL.calledWith( "blob:sensor-log" ) );
						assert.isFalse( OSApp.Errors.showError.called );
						finish();
					} catch ( error ) {
						finish( error );
					}
				}, 20 );
			} );
			requestOptions.beforeSend( header );
		} catch ( error ) {
			finish( error );
		}
	} );

	it( "aborts an oversized sensor CSV transfer", function( done ) {
		var sandbox = sinon.createSandbox(),
			oldGeneration = OSApp.currentSession.generation,
			oldIp = OSApp.currentSession.ip,
			oldPass = OSApp.currentSession.pass,
			oldPrefix = OSApp.currentSession.prefix,
			oldToken = OSApp.currentSession.token,
			request = $.Deferred(),
			requestOptions,
			progress,
			transport = {
				abort:sinon.spy(),
				addEventListener:sinon.spy( function( name, callback ) {
					if ( name === "progress" ) progress = callback;
				} )
			},
			finished = false;

		function finish( error ) {
			if ( finished ) return;
			finished = true;
			sandbox.restore();
			OSApp.currentSession.generation = oldGeneration;
			OSApp.currentSession.ip = oldIp;
			OSApp.currentSession.pass = oldPass;
			OSApp.currentSession.prefix = oldPrefix;
			OSApp.currentSession.token = oldToken;
			done( error );
		}

		try {
			OSApp.currentSession.generation = 70;
			OSApp.currentSession.ip = "controller.test";
			OSApp.currentSession.pass = "pw";
			OSApp.currentSession.prefix = "https://";
			OSApp.currentSession.token = "";
			sandbox.stub( $, "ajax" ).callsFake( function( options ) {
				requestOptions = options;
				return request.promise();
			} );
			sandbox.stub( $.ajaxSettings, "xhr" ).returns( transport );
			sandbox.stub( OSApp.Errors, "showError" );

			OSApp.Analog.downloadSensorLog().done( function( result ) {
				try {
					assert.isFalse( result );
					assert.isTrue( transport.abort.calledOnce );
					assert.isTrue( OSApp.Errors.showError.calledOnce );
					assert.include( OSApp.Errors.showError.firstCall.args[ 0 ], "too large" );
					finish();
				} catch ( error ) {
					finish( error );
				}
			} );
			assert.strictEqual( requestOptions.xhr(), transport );
			progress( { loaded:OSApp.Analog.Constants.SENSOR_LOG_MAX_BYTES + 1 } );
			request.reject( { statusText:"abort" } );
		} catch ( error ) {
			finish( error );
		}
	} );
} );

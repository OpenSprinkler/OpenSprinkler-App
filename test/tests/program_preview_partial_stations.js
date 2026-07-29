/* eslint-disable */

describe( "Program Preview partial station compatibility", function() {
	it( "rebases every per-group stop time rather than indexing the scalar fallback", function() {
		var source = OSApp.Programs.displayPagePreviewPrograms.toString();
		assert.include( source, "lastSeqStopTimes[ d ] = simminutes * 60" );
		assert.notInclude( source, "lastSeqStopTime[ d ]" );
	} );

	it( "accepts omitted legacy attributes but rejects malformed present group arrays", function() {
		var stations = {
			snames:[ "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8" ],
			masop:[ 0 ]
		};

		assert.isTrue( OSApp.Sites.isStationsResponse( stations ) );
		stations.stn_grp = [ 0 ];
		assert.isFalse( OSApp.Sites.isStationsResponse( stations ) );
		stations.stn_grp = new Array( 8 ).fill( 4 );
		assert.isFalse( OSApp.Sites.isStationsResponse( stations ) );
		stations.stn_grp.fill( OSApp.Constants.options.PARALLEL_GID_VALUE );
		assert.isTrue( OSApp.Sites.isStationsResponse( stations ) );
	} );

	it( "creates exact bounded preview defaults without trusting invalid mask or group values", function() {
		var normalized = OSApp.Programs.normalizePreviewStationAttributes( {
			masop:[ 1, 2, 4 ],
			stn_seq:[ 256, 1 ],
			stn_grp:[ 0, 1, 2, 3, 4, 255, -1, 1, 2 ]
		}, 9 );

		assert.deepEqual( normalized.masop, [ 1, 2 ] );
		assert.deepEqual( normalized.masop2, [ 0, 0 ] );
		assert.deepEqual( normalized.stn_seq, [ 0, 1 ] );
		assert.lengthOf( normalized.stn_grp, 9 );
		assert.deepEqual( normalized.stn_grp, [ 0, 1, 2, 3, -1, 255, -1, 1, 2 ] );
		assert.deepEqual( OSApp.Programs.normalizePreviewStationAttributes( {}, 2041 ).masop, [] );
	} );

	it( "falls back to validated program-status groups when the station group array is absent", function() {
		var normalized = OSApp.Programs.normalizePreviewStationAttributes( { masop:[ 0 ] }, 3, [
			[ 0, 0, 0, 0 ], [ 0, 0, 0, 255 ], [ 0, 0, 0, 4 ]
		] );

		assert.deepEqual( normalized.stn_grp, [ 0, 255, -1 ] );
	} );

	it( "renders a firmware-2.2 preview when every optional station array is absent", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldAndroid = OSApp.currentDevice.isAndroid,
			page,
			timeline;

		try {
			OSApp.currentSession.controller = {
				options: {
					mas:0, mas2:8, mton:0, mtof:0, mton2:0, mtof2:0,
					seq:0, sdt:0, tz:48, urs:0, uwt:0, wl:100
				},
				settings: {
					devt:0, nbrd:1, rd:0, rdst:0, rs:0, wtrestr:0,
					wto:{}, wls:[], ps:new Array( 8 ).fill( [ 0, 0, 0, 255 ] )
				},
				stations: {
					snames:[ "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8" ],
					masop:[ 0 ]
				},
				programs: {
					pd:[ [ 1, 127, 0, [ 0, 0, 0, 0 ], [ 60, 0, 0, 0, 0, 0, 0, 0 ], "P1" ] ]
				},
				status:new Array( 8 ).fill( 0 )
			};
			OSApp.currentDevice.isAndroid = false;
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).callsFake( function( version ) {
				return version <= 220;
			} );
			sandbox.stub( OSApp.UIDom, "changeHeader" );
			sandbox.stub( vis, "Timeline" ).callsFake( function( element, items ) {
				timeline = {
					element:element, items:items, setCurrentTime:sinon.spy(), setGroups:sinon.spy(),
					on:sinon.spy(), redraw:sinon.spy(), destroy:sinon.spy()
				};
				return timeline;
			} );

			OSApp.Programs.displayPagePreviewPrograms();
			page = $( "#preview" );
			assert.doesNotThrow( function() { page.triggerHandler( "pageshow" ); } );
			assert.isObject( timeline );
			assert.isAtLeast( timeline.items.length, 1 );
			assert.equal( timeline.items[ 0 ].group, "S1" );
		} finally {
			if ( page ) {
				page.triggerHandler( "pagehide" );
				page.remove();
			}
			$.mobile.window.off( ".programPreview" );
			sandbox.restore();
			OSApp.currentDevice.isAndroid = oldAndroid;
			OSApp.currentSession.controller = oldController;
		}
	} );

	it( "preserves sequential group spacing from program-status GIDs in a partial payload", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldAndroid = OSApp.currentDevice.isAndroid,
			page,
			items;

		try {
			OSApp.currentSession.controller = {
				options:{ mas:0, seq:0, sdt:5, tz:48, urs:0, uwt:0, wl:100 },
				settings:{
					devt:0, nbrd:1, rd:0, rdst:0, rs:0, wtrestr:0, wto:{}, wls:[],
					ps:[ [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 255 ], [ 0, 0, 0, 255 ],
						[ 0, 0, 0, 255 ], [ 0, 0, 0, 255 ], [ 0, 0, 0, 255 ], [ 0, 0, 0, 255 ] ]
				},
				stations:{
					snames:[ "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8" ],
					masop:[ 0 ]
				},
				programs:{
					pd:[ [ 1, 127, 0, [ 0, 0, 0, 0 ], [ 60, 60, 0, 0, 0, 0, 0, 0 ], "P1" ] ]
				},
				status:new Array( 8 ).fill( 0 )
			};
			OSApp.currentDevice.isAndroid = false;
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).callsFake( function( version ) {
				return version <= 220;
			} );
			sandbox.stub( OSApp.UIDom, "changeHeader" );
			sandbox.stub( vis, "Timeline" ).callsFake( function( element, previewItems ) {
				items = previewItems;
				return {
					setCurrentTime:sinon.spy(), setGroups:sinon.spy(), on:sinon.spy(),
					redraw:sinon.spy(), destroy:sinon.spy()
				};
			} );

			OSApp.Programs.displayPagePreviewPrograms();
			page = $( "#preview" );
			page.triggerHandler( "pageshow" );
			var runs = items.filter( function( item ) { return item.pid === 0; } )
				.sort( function( left, right ) { return left.start - right.start; } );
			assert.lengthOf( runs, 2 );
			assert.equal( ( runs[ 1 ].start - runs[ 0 ].start ) / 1000, 65 );
		} finally {
			if ( page ) {
				page.triggerHandler( "pagehide" );
				page.remove();
			}
			$.mobile.window.off( ".programPreview" );
			sandbox.restore();
			OSApp.currentDevice.isAndroid = oldAndroid;
			OSApp.currentSession.controller = oldController;
		}
	} );
} );

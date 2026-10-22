/* global describe, it, assert, OSApp */
describe( "Cycle and soak preview policy", function() {
	function simulate( requests, options ) {
		var trace = [], config = Object.assign( {
			capacity: 120, delay: 0, remote: false,
			policy: function() { return [ 1, 60, 60 ]; },
			masters: function() { return []; }, minimum: function() { return 0; }
		}, options ), engine = OSApp.CycleSoak.createPreview( config, function( q ) { trace.push( q ); } );
		assert.isTrue( engine.admit( requests, 1000 ) );
		engine.advance( 10000 );
		return trace.sort( function( a, b ) { return a.st - b.st || a.sid - b.sid; } );
	}
	it( "matches the native scheduler balanced 121-second trace", function() {
		assert.deepEqual( simulate( [ { sid: 0, pid: 1, gid: 0, dur: 121 } ] ).map( function( q ) { return [ q.st, q.dur ]; } ),
			[ [ 1001, 41 ], [ 1102, 40 ], [ 1202, 40 ] ] );
	} );
	it( "uses each station policy despite a controller-wide cycle diagnostic", function() {
		var controller = OSApp.currentSession.controller;
		try {
			OSApp.currentSession.controller = {
				settings: { cserr: 1 },
				stations: { csver: 1, cs: [ [ 1, 60, 60 ], [ 0, 0, 0 ], [ 1, -1, 60 ] ] }
			};
			assert.deepEqual( OSApp.CycleSoak.readablePolicy( 0 ), [ 1, 60, 60 ] );
			assert.deepEqual( OSApp.CycleSoak.readablePolicy( 1 ), [ 0, 0, 0 ] );
			assert.isNull( OSApp.CycleSoak.readablePolicy( 2 ) );
			assert.isNull( OSApp.CycleSoak.readablePolicy( 3 ) );
			var trace = simulate( [ { sid: 0, pid: 1, gid: 0, dur: 121 }, { sid: 1, pid: 1, gid: 1, dur: 121 } ], {
				policy: OSApp.CycleSoak.policy
			} );
			assert.lengthOf( trace.filter( function( segment ) { return segment.sid === 0; } ), 3 );
			assert.deepEqual( trace.filter( function( segment ) { return segment.sid === 1; } ).map( function( segment ) { return segment.dur; } ), [ 121 ] );
		} finally {
			OSApp.currentSession.controller = controller;
		}
	} );
	it( "reserves same-station cooldown across separate requests", function() {
		assert.deepEqual( simulate( [ { sid: 0, pid: 1, gid: 0, dur: 120 }, { sid: 0, pid: 2, gid: 0, dur: 60 } ] )
			.map( function( q ) { return [ q.pid, q.st, q.dur ]; } ), [ [ 1, 1001, 60 ], [ 2, 1121, 60 ], [ 1, 1241, 60 ] ] );
	} );
	it( "retains a delayed master window before rearming", function() {
		assert.deepEqual( simulate( [ { sid: 0, pid: 1, gid: 0, dur: 120 } ], {
			masters: function() { return [ { on: 90, off: 120 } ]; }
		} ).map( function( q ) { return q.st; } ), [ 1001, 1182 ] );
	} );
	it( "keeps negative delay but not at the expense of the same-station soak", function() {
		var trace = simulate( [ { sid: 0, pid: 1, gid: 0, dur: 120 }, { sid: 1, pid: 1, gid: 0, dur: 120 } ], { delay: -10 } );
		assert.deepEqual( trace.map( function( q ) { return q.st; } ), [ 1001, 1051, 1121, 1171 ] );
	} );
	it( "does not retain an impossible master window", function() {
		assert.deepEqual( simulate( [ { sid: 0, pid: 1, gid: 0, dur: 120 } ], {
			masters: function() { return [ { on: 1000, off: 120 } ]; }
		} ).map( function( q ) { return q.st; } ), [ 1001, 1121 ] );
	} );
	it( "bypasses policies in Remote Extension mode", function() {
		var trace = simulate( [ { sid: 0, pid: 1, gid: 0, dur: 121 } ], { remote: true } );
		assert.equal( trace.length, 1 ); assert.equal( trace[ 0 ].dur, 121 );
	} );
	it( "rejects whole invocations without partial admissions", function() {
		var trace = [], engine = OSApp.CycleSoak.createPreview( {
			capacity: 1, delay: 0, policy: function() { return [ 0, 0, 0 ]; },
			masters: function() { return []; }, minimum: function() { return 0; }
		}, function( q ) { trace.push( q ); } );
		assert.isFalse( engine.admit( [ { sid: 0 }, { sid: 1 } ], 1000 ) );
		assert.equal( engine.rejections(), 1 ); assert.lengthOf( trace, 0 );
	} );
	it( "validates complete backup policies before import", function() {
		[ [ 1, 60, 60 ], [ 0, 0, 0 ], [ 1, 14400, 14400 ] ].forEach( function( p ) { assert.isTrue( OSApp.CycleSoak.validPolicy( p ) ); } );
		[ [ 2, 60, 60 ], [ 1, 59, 60 ], [ 1, 60, 0 ], [ 0, -1, 0 ], [ 1, "60", 60 ] ].forEach( function( p ) { assert.isFalse( OSApp.CycleSoak.validPolicy( p ) ); } );
	} );
} );

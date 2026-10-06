/* global OSApp */
OSApp.CycleSoak = {};

OSApp.CycleSoak.supported = function() {
	return OSApp.currentSession.controller.stations?.csver === 1;
};

OSApp.CycleSoak.validPolicy = function( policy ) {
	return Array.isArray( policy ) && policy.length === 3 &&
		( policy[ 0 ] === 0 || policy[ 0 ] === 1 ) && policy.slice( 1 ).every( function( seconds ) {
			return Number.isInteger( seconds ) && ( ( !policy[ 0 ] && seconds === 0 ) || ( seconds >= 60 && seconds <= 14400 ) );
		} );
};

OSApp.CycleSoak.policy = function( sid ) {
	var policy = OSApp.currentSession.controller.stations.cs?.[ sid ];
	return OSApp.CycleSoak.validPolicy( policy ) ? policy : [ 0, 0, 0 ];
};

OSApp.CycleSoak.readablePolicy = function( sid ) {
	var controller = OSApp.currentSession.controller,
		policy = controller.stations.cs?.[ sid ];
	return !controller.settings.cserr && OSApp.CycleSoak.validPolicy( policy ) ? policy.slice() : null;
};

OSApp.CycleSoak.enabled = function( sid ) {
	return OSApp.CycleSoak.supported() && !!OSApp.CycleSoak.readablePolicy( sid )?.[ 0 ];
};

OSApp.CycleSoak.fields = function( sid ) {
	var policy = OSApp.CycleSoak.policy( sid );
	return "<div class='ui-bar-a ui-bar'>" + OSApp.Language._( "Cycle and Soak" ) + "</div>" +
		"<label for='cycle-enabled'><input class='needsclick' data-iconpos='right' id='cycle-enabled' type='checkbox'" + ( policy[ 0 ] ? " checked" : "" ) + ">" +
		OSApp.Language._( "Enable Cycle and Soak" ) + "</label>" +
		"<label for='cycle-minutes'>" + OSApp.Language._( "Maximum cycle (minutes)" ) + "</label>" +
		"<input id='cycle-minutes' type='number' min='1' max='240' step='1' value='" + ( policy[ 1 ] / 60 || "" ) + "'>" +
		"<label for='soak-minutes'>" + OSApp.Language._( "Minimum soak (minutes)" ) + "</label>" +
		"<input id='soak-minutes' type='number' min='1' max='240' step='1' value='" + ( policy[ 2 ] / 60 || "" ) + "'>";
};

OSApp.CycleSoak.runtimeText = function( sid ) {
	var rows = ( OSApp.currentSession.controller.settings.cs || [] ).filter( function( row ) { return row[ 0 ] === sid; } );
	if ( !rows.length ) { return ""; }
	var state = rows.some( function( row ) { return row[ 2 ] === 1; } ) ? 1 : rows[ 0 ][ 2 ],
		labels = [ "Cycle queued", "Cycle running", "Soaking", "Cycle paused", "Master finishing" ],
		remaining = rows.reduce( function( total, row ) { return total + row[ 3 ]; }, 0 );
	return OSApp.Language._( labels[ state ] ) + ( remaining ? " · " + OSApp.Dates.sec2hms( remaining ) + " " +
		OSApp.Language._( "total watering remaining" ) : "" );
};

OSApp.CycleSoak.masters = function( sid ) {
	var controller = OSApp.currentSession.controller,
		members = [ sid ].concat( OSApp.Bundles.getEligibleMembers( OSApp.Bundles.getMembers( sid ), sid ) ),
		result = [];
	[ "", "2", "3", "4" ].forEach( function( suffix ) {
		var bits = controller.stations[ "masop" + suffix ] || [];
		if ( controller.options[ "mas" + suffix ] > 0 && members.some( function( member ) {
			return bits[ member >> 3 ] & ( 1 << ( member & 7 ) );
		} ) ) {
			result.push( { on: controller.options[ "mton" + suffix ] || 0, off: controller.options[ "mtof" + suffix ] || 0 } );
		}
	} );
	return result;
};

// One live slot per logical request. Initial admissions append; natural re-arms
// fill whole-segment gaps unless negative delay or duplicate stations preclude it.
OSApp.CycleSoak.createPreview = function( config, emit ) {
	var jobs = [], lastOff = {}, rejected = 0;
	function reserve( now, exclude ) {
		var groups = {}, cooldown = Object.assign( {}, lastOff );
		jobs.forEach( function( job ) {
			if ( job === exclude || job.tail ) { return; }
			var end = job.st + job.dur;
			if ( job.soak ) { cooldown[ job.sid ] = Math.max( cooldown[ job.sid ] || 0, end + job.soak ); }
			if ( job.gid !== 255 && end > now ) { groups[ job.gid ] = Math.max( groups[ job.gid ] || 0, end ); }
		} );
		return { groups: groups, cooldown: cooldown };
	}
	function masterAdjust( job, now ) {
		var lead = Math.max( 0, ...job.masters.map( function( master ) { return -master.on; } ) );
		if ( job.st - now <= lead ) { job.st += lead; }
		job.retire = job.st + job.dur + Math.max( 0, ...job.masters.map( function( master ) { return master.off; } ) );
		job.previousTail = job.st + job.dur + Math.max( 0, ...job.masters.filter( function( master ) {
			return job.dur + master.off >= master.on;
		} ).map( function( master ) { return master.off; } ) );
	}
	function plot( job ) { emit( { sid: job.sid, pid: job.pid, st: job.st, dur: job.dur } ); }
	function firstGap( job, now, start ) {
		var lead = Math.max( 0, ...job.masters.map( function( master ) { return -master.on; } ) );
		for (;;) {
			var adjusted = start + ( start - now <= lead ? lead : 0 ),
				conflict = jobs.find( function( other ) {
					return other !== job && !other.tail && other.gid === job.gid &&
						adjusted < other.st + other.dur + config.delay && adjusted + job.dur + config.delay > other.st;
				} );
			if ( !conflict ) { return start; }
			start = conflict.st + conflict.dur + config.delay;
		}
	}
	function advance( until ) {
		for (;;) {
			var next = jobs.filter( function( job ) { return !job.tail && job.st + job.dur <= until; } )
				.sort( function( a, b ) { return a.st + a.dur - b.st - b.dur || a.sid - b.sid; } )[ 0 ];
			if ( !next ) { break; }
			var off = next.st + next.dur;
			if ( next.soak ) { lastOff[ next.sid ] = Math.max( lastOff[ next.sid ] || 0, off + next.soak ); }
			if ( next.left ) {
				var bounds = reserve( off, next ), previousTail = next.previousTail,
					gap = next.gid !== 255 && config.delay >= 0 && !jobs.some( function( other ) {
						return other !== next && !other.tail && other.sid === next.sid;
					} );
				next.dur = Math.ceil( next.remaining / next.left-- );
				next.remaining -= next.dur;
				next.st = Math.max( off + 1, off + next.soak, bounds.cooldown[ next.sid ] || 0, previousTail + 1,
					next.gid === 255 || gap ? 0 : ( bounds.groups[ next.gid ] || 0 ) + config.delay );
				if ( gap ) { next.st = firstGap( next, off, next.st ); }
				masterAdjust( next, off );
				plot( next );
			} else {
				next.tail = true;
				if ( next.soak ) { next.retire = next.previousTail; }
			}
			jobs = jobs.filter( function( job ) { return !job.tail || job.retire >= off; } );
		}
		jobs = jobs.filter( function( job ) { return !job.tail || job.retire >= until; } );
	}
	return {
		advance: advance,
		rejections: function() { return rejected; },
		admit: function( requests, now ) {
			if ( jobs.length + requests.length > config.capacity ) { rejected++; return false; }
			var bounds = reserve( now ), groups = Array.from( new Set( requests.map( function( r ) { return r.gid; } ) ) )
				.filter( function( gid ) { return gid !== 255; } ).sort( function( a, b ) { return a - b; } ),
				starts = {}, parallel = groups.length;
			groups.forEach( function( gid, index ) {
				starts[ gid ] = bounds.groups[ gid ] > now ? bounds.groups[ gid ] + config.delay : now + 1 + Math.floor( index / 4 );
			} );
			requests.forEach( function( request ) {
				var policy = config.policy( request.sid ), governed = !config.remote && policy[ 0 ],
					n = governed ? Math.ceil( request.dur / policy[ 1 ] ) : 1,
					job = Object.assign( {}, request, { dur: Math.ceil( request.dur / n ), left: n - 1,
						soak: governed ? policy[ 2 ] : 0, masters: config.masters( request.sid ) } );
				job.remaining = request.dur - job.dur;
				job.dur = Math.max( job.dur, config.minimum( request.sid ) );
				if ( config.remote ) { job.gid = 255; }
				job.st = job.gid === 255 ? now + 1 + Math.floor( parallel++ / 4 ) : starts[ job.gid ];
				if ( governed ) { job.st = Math.max( job.st, now + 1, bounds.cooldown[ job.sid ] || 0 ); }
				if ( job.gid === 255 && job.dur === 1 && ( parallel - 1 ) % 4 ) { job.dur = 2; }
				masterAdjust( job, now );
				if ( job.gid !== 255 ) { starts[ job.gid ] = job.st + job.dur + config.delay; }
				if ( job.soak ) { bounds.cooldown[ job.sid ] = Math.max( bounds.cooldown[ job.sid ] || 0, job.st + job.dur + job.soak ); }
				jobs.push( job ); plot( job );
			} );
			return true;
		}
	};
};

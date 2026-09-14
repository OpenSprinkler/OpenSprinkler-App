// Chart zoom needs Hammer for touch gestures, but Hammer's mouse input
// conflicts with Chart.js's native drag-to-zoom handling.
( function( global ) {
	if ( !global.vis || !global.vis.Hammer ) {
		return;
	}

	var nativeHammer = global.vis.Hammer;
	global.Hammer = Object.create( nativeHammer );
	global.Hammer.Manager = function( element, options ) {
		return new nativeHammer.Manager( element, Object.assign( {}, options, {
			inputClass: nativeHammer.TouchInput,
			touchAction: "pan-y"
		} ) );
	};
}( window ) );

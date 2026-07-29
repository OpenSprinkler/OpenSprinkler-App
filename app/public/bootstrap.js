/* Consume standalone bootstrap URLs before the module graph is requested. `pwhash` is deliberately
 * discarded; credentials are entered through the login form. Keep this classic script blocking. */
( function() {
	var url = new URL( location.href ),
		hash = new URLSearchParams( url.hash.replace( /^#\??/, "" ) ),
		config = {};
		config.deviceBase = hash.get( "base" ) || url.searchParams.get( "base" ) || undefined;
		config.companionBase = hash.get( "companion" ) || url.searchParams.get( "companion" ) || undefined;
		// Bearer tokens are accepted from the fragment only, which is never sent in HTTP requests.
		config.companionToken = hash.get( "companionToken" ) || undefined;
		[ "base", "companion", "companionToken", "pwhash" ].forEach( function( key ) {
		url.searchParams.delete( key );
		hash.delete( key );
	} );
	url.hash = hash.toString() ? "#" + hash.toString() : "";
	history.replaceState( history.state, "", url.href );
	window.__OS_BOOTSTRAP__ = config;
}() );

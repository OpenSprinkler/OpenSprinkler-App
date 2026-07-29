/* OpenSprinkler Phase-1 bootstrap entry — home.js (DRAFT prototype).
 *
 * This is the classic (non-module) script the firmware loads. server_home
 * (OpenSprinkler-Firmware/opensprinkler_server.cpp:1362) emits:
 *
 *     <script>var ver=<fwv>,ipas=<ignore_password>;</script>
 *     <script src="<SOPT_JAVASCRIPTURL>/home.js"></script>
 *
 * So when this runs, `window.ver` / `window.ipas` are already set and the page is being
 * served from (LAN) or proxied to (OTC) the device — i.e. `location.origin` is the device.
 *
 * Responsibilities (mirrors the proven legacy www/js/home.js getAssetLocation pattern):
 *   1. self-locate the asset base from this script's own URL,
 *   2. ensure a #app mount node (the firmware page body has only the two scripts),
 *   3. load the Vite-built dashboard module + its CSS from that base.
 * The dashboard module (app/main.ts → assets/app.js) then talks to the device at
 * location.origin and renders the dashboard.
 */
( function () {
	// A module request removed after timing out can still finish evaluating in some browsers.
	// The module entry consumes this flag before performing any application side effects.
	window.__OS_BOOTSTRAP_ABORTED__ = false;

	function assetBase() {
		var s = document.currentScript ||
			document.querySelector( "script[src$='home.js'], script[src*='home.js?'], script[src*='home.js#']" );
		var src = ( s && s.src ) || "";
		// strip the trailing "home.js" (and any query) → base directory (keeps trailing slash)
		return src.replace( /home\.js(?:[?#].*)?$/, "" );
	}

	var base = assetBase();
	var app = document.getElementById( "app" );

	if ( !app ) {
		app = document.createElement( "div" );
		app.id = "app";
		app.textContent = "Loading…";
		document.body.appendChild( app );
	}

	var failed = false;
	var timeout;
	var pendingAsset;
	function clearPendingAsset( remove ) {
		window.clearTimeout( timeout );
		if ( !pendingAsset ) return;
		pendingAsset.onload = null;
		pendingAsset.onerror = null;
		if ( remove && pendingAsset.parentNode ) {
			pendingAsset.removeAttribute( "src" );
			pendingAsset.removeAttribute( "href" );
			pendingAsset.parentNode.removeChild( pendingAsset );
		}
		pendingAsset = null;
	}
	function watchAsset( asset ) {
		clearPendingAsset( false );
		pendingAsset = asset;
		timeout = window.setTimeout( function () {
			showError( "asset request timed out" );
		}, 15000 );
	}
	function showError( detail ) {
		if ( failed ) return;
		failed = true;
		window.__OS_BOOTSTRAP_ABORTED__ = true;
		// Removing an in-flight module is important: otherwise it can execute after the loader has
		// already rendered a terminal timeout, leaving the page in two contradictory states.
		clearPendingAsset( true );
		app.textContent = "Unable to load the OpenSprinkler dashboard (" + detail + "). Check the dashboard URL and network, then reload.";
		app.setAttribute( "role", "alert" );
		document.title = "Unable to load OpenSprinkler";
	}
	function loadModule() {
		if ( failed ) return;
		var js = document.createElement( "script" );
		js.type = "module";
		js.src = base + "assets/app.js";
		js.onload = function () { clearPendingAsset( false ); };
		js.onerror = function () { showError( "application script failed" ); };
		watchAsset( js );
		document.body.appendChild( js );
	}

	var css = document.createElement( "link" );
	css.rel = "stylesheet";
	css.href = base + "assets/app.css";
	// Do not boot the application until its stylesheet is known-good; this makes failure terminal.
	css.onload = function () {
		clearPendingAsset( false );
		loadModule();
	};
	css.onerror = function () { showError( "stylesheet failed" ); };
	watchAsset( css );
	document.head.appendChild( css );
}() );

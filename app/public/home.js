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
 * location.origin and renders the read-only views.
 */
( function () {
	function assetBase() {
		var s = document.currentScript ||
			document.querySelector( "script[src$='home.js'], script[src*='home.js?']" );
		var src = ( s && s.src ) || "";
		// strip the trailing "home.js" (and any query) → base directory (keeps trailing slash)
		return src.replace( /home\.js(\?.*)?$/, "" );
	}

	var base = assetBase();

	if ( !document.getElementById( "app" ) ) {
		var app = document.createElement( "div" );
		app.id = "app";
		app.textContent = "Loading…";
		document.body.appendChild( app );
	}

	var css = document.createElement( "link" );
	css.rel = "stylesheet";
	css.href = base + "assets/app.css";
	document.head.appendChild( css );

	var js = document.createElement( "script" );
	js.type = "module";
	js.src = base + "assets/app.js";
	document.body.appendChild( js );
}() );

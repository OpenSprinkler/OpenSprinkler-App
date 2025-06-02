/*global $, ver, ipas, XDomainRequest, ActiveXObject, md5, OSApp */

/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <http://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// Disables site selection menu
window.currLocal = true;

( function( document ) {
	var assetLocation = getAssetLocation(),
		isReady = false;

	function getAssetLocation() {
		var mainScript = document.querySelector( "script[src$='home.js']" ).src,
			def = "http://ui.opensprinkler.com/";

		if ( !mainScript ) {
			return def;
		}

		mainScript = /^\s*(((([^:/#?]+:)?(?:(\/\/)((?:(([^:@/#?]+)(?::([^:@/#?]+))?)@)?(([^:/#?\][]+|\[[^/\]@#?]+\])(?::([0-9]+))?))?)?)?((\/?(?:[^/?#]+\/+)*)([^?#]*)))?(\?[^#]+)?)(#.*)?/.exec( mainScript || "" ) || [];
		return mainScript[ 1 ].slice( 0, -10 ) || def;
	}

	function insertStyle( css ) {
		var head = document.head || document.getElementsByTagName( "head" )[ 0 ],
			style = document.createElement( "style" );

		style.type = "text/css";
		if ( style.styleSheet ) {
		  style.styleSheet.cssText = css;
		} else {
		  style.appendChild( document.createTextNode( css ) );
		}

		head.appendChild( style );
	}

	function insertStyleSheet( href, rel, media ) {
		var head = document.head || document.getElementsByTagName( "head" )[ 0 ],
			link = document.createElement( "link" );

		rel = rel || "stylesheet";

		link.rel = rel;
		link.href = href;
		if ( media && media !== "" ) {
			link.media = media;
		}

		head.appendChild( link );
	}

	function insertMeta( name, content ) {
		var head = document.head || document.getElementsByTagName( "head" )[ 0 ],
			meta = document.createElement( "meta" );

		content = content || "";

		if ( name === "content-type" ) {
			meta.httpEquiv = name;
		} else {
			meta.name = name;
		}
		meta.content = content;

		head.appendChild( meta );
	}

	// Insert script into the DOM
	function insertScript( src, callback ) {
		// Create callback if one is not provided
		callback = callback || function() {};

		var a = document.createElement( "script" );
		a.src = src;
		a.addEventListener( "load", callback, false );
		document.getElementsByTagName( "head" )[ 0 ].appendChild( a );
	}

	// Change the viewport
	document.querySelector( "meta[name='viewport']" ).content =
		"width=device-width,initial-scale=1.0,minimum-scale=1.0,user-scalable=no";

	// Allow app to run in full screen when launched from the home screen
	insertMeta( "apple-mobile-web-app-capable", "yes" );

	// Fix status bar on iOS
	insertMeta( "apple-mobile-web-app-status-bar-style", "black" );

	// Give the app a name to be used when added to home screen
	insertMeta( "apple-mobile-web-app-title", "OpenSprinkler" );

	// Ensure browser knows the content-type of UTF-8
	insertMeta( "content-type", "text/html; charset=utf-8" );

	// Insert loading icon
	insertStyle( ".logo{margin-top:-10px!important;margin-bottom:10px!important}" +
		"body{background-color:#1d1d1d}.spinner{text-align:center;display:block;padding:.9375em;" +
		"margin-left:-7.1875em;width:12.5em;filter:Alpha(Opacity=88);opacity:.88;" +
		"margin-top:-2.6875em;height:auto;z-index:9999999;position:fixed;top:50%;left:50%;" +
		"border:0;background-color:#2a2a2a;border-color:#1d1d1d;color:#fff;" +
		"text-shadow:0 1px 0 #111;-webkit-border-radius:.3125em;border-radius:.3125em;}" +
		".spinner h1{font-size: 1em;margin:0;text-align:center;}.spinner form{margin-bottom:0}" +
		".spinner form{padding-top:.2em;}.spinner input[type='password']{border-radius:5px;" +
		"padding:.3em;line-height:1.2em;display:block;width:100%;-webkit-box-sizing:border-box;" +
		"-moz-box-sizing:border-box;box-sizing:border-box;outline:0;}.spinner input[type=submit]" +
		"{border-radius:5px;border: 0;font-family:Tahoma;background:#f4f4f4;margin-top:5px;" +
		"width:100%;}.feedback{color:red}" );

	// Change title to reflect current state
	document.title = "Loading...";

	// Insert main application stylesheet
	insertStyleSheet( assetLocation + "css/jqm.css" );
	insertStyleSheet( assetLocation + "css/main.css" );
	insertStyleSheet( assetLocation + "css/analog.css" );

	// Insert favicon for web page
	insertStyleSheet( assetLocation + "img/favicon.ico", "shortcut icon" );

	// Insert jQuery
	insertScript( assetLocation + "vendor-js/jquery.js", function() {

		// Insert libraries
		insertScript( assetLocation + "vendor-js/libs.js", function() {

			// Insert charting library for analog support
			insertScript( assetLocation + "vendor-js/apexcharts.min.js" );

			// Insert datatables grid library
			insertScript( assetLocation + "vendor-js/dataTables-2.1.8.min.js" );

			fetch( assetLocation + "modules.json" )
				.then( response => response.json() )
				.then( modules => {
					let loadedScripts = 0;
					const totalScripts = modules.length;

					function scriptLoaded() {
						loadedScripts++;
						if ( loadedScripts === totalScripts ) {
							// Once all scripts loaded, insert main.js
							insertScript( assetLocation + "js/main.js", function () {
                                                                try {
                                                                        OSApp.Storage.setItemSync( "testQuota", "true" );
                                                                        OSApp.Storage.removeItemSync( "testQuota" );
                                                                        init();
								} catch ( err ) {
									if ( err.code === 22 ) {
										document.body.innerHTML = "<div class='spinner'><div class='logo'></div>" +
											"<span class='feedback'>Local storage is not enabled. You may be in private browsing mode.</span></div>";
									}
								}
							});
						}
					}

					// Dynamically insert all scripts from modules.json
					modules.forEach( script => {
						insertScript( assetLocation + "js/modules/" + script, scriptLoaded );
					});
				});
		} );
	} );

	// Insert home page icon for iOS
	insertStyleSheet( assetLocation + "res/ios-web/icons/icon.png", "apple-touch-icon" );

	//Insert the startup images for iOS
	( function() {
		var p, l, r = window.devicePixelRatio, h = window.screen.height;
		if ( navigator.platform === "iPad" ) {
				p = r === 2 ? "res/ios-web/screens/startup-tablet-portrait-retina.png" :
					"res/ios-web/screens/startup-tablet-portrait.png";
				l = r === 2 ? "res/ios-web/screens/startup-tablet-landscape-retina.png" :
					"res/ios-web/screens/startup-tablet-landscape.png";
				insertStyleSheet( assetLocation + l, "apple-touch-startup-image",
					"screen and (orientation: landscape)" );
				insertStyleSheet( assetLocation + p, "apple-touch-startup-image",
					"screen and (orientation: portrait)" );
		} else {
				p = r === 2 ?
					( h === 568 ? "res/ios-web/screens/startup-iphone5-retina.png" :
						"res/ios-web/screens/startup-retina.png" ) :
					"res/ios-web/screens/startup.png";
				insertStyleSheet( assetLocation + p, "apple-touch-startup-image" );
		}
	} )();

	if ( !document.createElementNS ||
		!document.createElementNS( "http://www.w3.org/2000/svg", "svg" ).createSVGRect ) {
		$( "html" ).addClas( "ui-nosvg" );
	}

	function init() {
		var body = $( "body" ),
			finishInit = function() {

				// Start checking for script load completion and callback when done
				var interval = setInterval( function() {
					if ( isReady ) {
						clearInterval( interval );

						// Load jQuery Mobile
						$.ajax( {
							url: assetLocation + "vendor-js/jqm.js",
							dataType: "script",
							cache: true
						} );
					}
				}, 1 );
			},
			savePassword = function( pw, isHashed ) {
				var sites = {
					"Local": {
						"os_ip": document.URL.match( /https?:\/\/(.*)\/.*?/ )[ 1 ],
						"os_pw": pw,
						"isHashed": isHashed,
						"is183": ( ver < 204 ) ? true : false,
						"ssl": location.protocol === "https:" ? "1" : undefined
					}
				},
				currentSite = "Local";

				// Show loading message and title
				body.html( "<div class='spinner'><h1>Loading</h1></div>" );
				document.title = "Loading...";

				// Inject site information to storage so Application loads current device
                                OSApp.Storage.setItemSync( "sites", JSON.stringify( sites ) );
                                OSApp.Storage.setItemSync( "current_site", currentSite );
				finishInit();
			},
			wrongPassword = function() {
				var feedback = $( ".feedback" );

				feedback.text( "Invalid Password" );
				setTimeout( function() {
					feedback.empty();
				}, 2000 );

				$( "#os_pw" ).val( "" );
			},
			fail = function() {
				body.html( "<div class='spinner'>" +
						"<div class='logo'></div><span class='feedback'>Unable to load UI</span>" +
					"</div>" );
			},
                        sites = JSON.parse( OSApp.Storage.getItemSync( "sites" ) ),
			loader;

		// Fix to allow CORS ajax requests to work on IE8 and 9
		/*!
		 * jQuery-ajaxTransport-XDomainRequest - v1.0.3 - 2014-06-06
		 * https://github.com/MoonScript/jQuery-ajaxTransport-XDomainRequest
		 * Copyright (c) 2014 Jason Moon (@JSONMOON)
		 * Licensed MIT (/blob/master/LICENSE.txt)
		 */

		// eslint-disable-next-line
		( function() {if ( $.support.cors || !$.ajaxTransport || !window.XDomainRequest ) {return;}var b = /^https?:\/\//i;var c = /^get|post$/i;var a = new RegExp( "^" + location.protocol, "i" );$.ajaxTransport( "* text html xml json", function( e, g ) {if ( !e.crossDomain || !e.async || !c.test( e.type ) || !b.test( e.url ) || !a.test( e.url ) ) {return;}var d = null;return { send:function( k, i ) {var h = "";var j = ( g.dataType || "" ).toLowerCase();d = new XDomainRequest();if ( /^\d+$/.test( g.timeout ) ) {d.timeout = g.timeout;}d.ontimeout = function() {i( 500, "timeout" );};d.onload = function() {var q = "Content-Length: " + d.responseText.length + "\r\nContent-Type: " + d.contentType;var l = { code:200, message:"success" };var n = { text:d.responseText };try {if ( j === "html" || /text\/html/i.test( d.contentType ) ) {n.html = d.responseText;}else {if ( j === "json" || ( j !== "text" && /\/json/i.test( d.contentType ) ) ) {try {n.json = $.parseJSON( d.responseText );}catch ( p ) {l.code = 500;l.message = "parseerror";}}else {if ( j === "xml" || ( j !== "text" && /\/xml/i.test( d.contentType ) ) ) {var o = new ActiveXObject( "Microsoft.XMLDOM" );o.async = false;try {o.loadXML( d.responseText );}catch ( p ) {o = undefined;}if ( !o || !o.documentElement || o.getElementsByTagName( "parsererror" ).length ) {l.code = 500;l.message = "parseerror";throw"Invalid XML: " + d.responseText;}n.xml = o;}}}}catch ( m ) {throw m;}finally {i( l.code, l.message, n, q );}};d.onprogress = function() {};d.onerror = function() {i( 500, "error", { text:d.responseText } );};if ( g.data ) {h = ( $.type( g.data ) === "string" ) ? g.data : $.param( g.data );}d.open( e.type, e.url );d.send( h );}, abort:function() {if ( d ) {d.abort();}} };} );}() );

		if ( sites ) {

			// If device has been logged into before, use available settings
			loader = $( "<div class='spinner'><h1>Loading</h1></div>" );
			finishInit();
		} else if ( ipas === 1 ) {
			savePassword( "" );
		} else {

			// If this is a new login, prompt for password
			loader = $(
				"<div class='spinner'>" +
					"<div class='logo'></div>" +
					"<h1>Enter Device Password</h1>" +
					"<span class='feedback'></span>" +
					"<form>" +
						"<input type='password' id='os_pw' name='os_pw' value='' />" +
						"<input type='submit' value='Submit' />" +
					"</form>" +
				"</div>"
			);

			loader.on( "submit", function() {
				var pw = $( "#os_pw" ).val(),
					homeCheckPW = function( pass, callback ) {
						$.ajax( {
							url: document.URL.match( /(https?:\/\/.*)\/.*?/ )[ 1 ] + "/sp?pw=" + encodeURIComponent( pass ) + "&npw=" + encodeURIComponent( pass ) + "&cpw=" + encodeURIComponent( pass ),
							cache: false,
							crossDomain: true,
							type: "GET"
						} ).then(
							function( data ) {
								var result = data.result;

								if ( typeof result === "undefined" || result > 1 ) {
									callback( false );
								} else {
									callback( true );
								}
							},
							function() {
								callback( false );
							}
						);
					},
					checkClear = function() {
						homeCheckPW( pw, function( clearResult ) {
							if ( clearResult === true ) {
								savePassword( pw );
							} else {
								wrongPassword();
							}
						} );
					};

				if ( ver < 208 ) {
					savePassword( pw );
					return false;
				}

				$.support.cors = true;

				if ( ver >= 213 ) {
					homeCheckPW( md5( pw ), function( result ) {
						if ( result === true ) {
							savePassword( md5( pw ), true );
						} else {
							checkClear();
						}
					} );
				} else {
					checkClear();
				}

				return false;
			} );

			// Change title to reflect current state
			document.title = "OpenSprinkler: Login";
		}

		// Hide the body while we modify the DOM
		body.html( loader );

		$.ajax( {
			url: assetLocation + "index.html",
			crossDomain: true,
			cache: true,
			type: "GET"
		} ).then(
			function( data ) {

				// Grab the pages from index.html (body content)
				var pages = data.match( /<body>([.\s\S]*)<\/body>/ )[ 1 ];

				// Show the body when jQM attempts first page transition
				$( document ).one( "mobileinit", function() {

					// Change title to reflect loading finished
					document.title = "OpenSprinkler";

					// Inject pages into DOM
					body.html( pages );

					// Remove spinner code (no longer needed)
					$( "head" ).find( "style" ).remove();

					// Hide multi site features since using local device
					body.find( ".multiSite" ).hide();

					// Show local site features
					body.find( "#logout" ).parent().removeClass( "hidden" );

					if ( ver < 208 ) {
						body.find( "#downgradeui" ).parent().removeClass( "hidden" );
					}
				} );

				// Mark environment as loaded
				isReady = true;
			},
			fail
		);
	}
}( document ) );

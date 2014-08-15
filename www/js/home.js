/*global $ */
(function(){
	var assetLocation = "http://rawgit.com/salbahra/Sprinklers/master/www/";

	// Insert script into the DOM
	function insertStyle(style) {
	    var a=document.createElement("style");
	    a.innerHTML=style;
	    document.head.appendChild(a);
	}

	// Insert script into the DOM
	function insertStyleSheet(src) {
	    var a=document.createElement("link");
	    a.href=src;
	    a.rel="stylesheet";
	    document.head.appendChild(a);
	}

	// Insert script into the DOM
	function insertScript(src,callback) {
		// Create callback if one is not provided
		callback = callback || function(){};

	    var a=document.createElement("script");
	    a.src=src;
	    document.head.appendChild(a);

	    var interval = setInterval(function(){
			if (document.readyState === "complete") {
				clearInterval(interval);
				callback();
			}
		},2);
	}

	// Insert loading icon
	insertStyle(".spinner{display:block;padding:.9375em;margin-left:-7.1875em;width:12.5em;filter:Alpha(Opacity=88);opacity:.88;box-shadow:0 1px 1px -1px #fff;margin-top:-2.6875em;height:auto;z-index:9999999;position:fixed;top:50%;left:50%;border:0;background-color:#2a2a2a;border-color:#1d1d1d;color:#fff;text-shadow:0 1px 0 #111;-webkit-border-radius:.3125em;border-radius:.3125em;}.spinner h1{font-size: 1em;margin:0;text-align:center;}");

	// Change title to reflect loading state
	document.title = "Loading...";

	// Insert jQM stylesheet
	insertStyleSheet(assetLocation+"css/jquery.mobile.min.css");

	// Insert main application stylesheet
	insertStyleSheet(assetLocation+"http://rawgit.com/salbahra/Sprinklers/master/www/css/main.css");

	// Insert jQuery and run init function on completion
	insertScript(assetLocation+"http://rawgit.com/salbahra/Sprinklers/master/www/js/jquery.min.js",init);

	function init() {
		var body = $("body");

		// Hide the body while we modify the DOM
		body.html("<div class='spinner'><h1>Loading</h1></div>");

		// Change viewport
		$("meta[name='viewport']").attr("content","width=device-width,initial-scale=1.0,minimum-scale=1.0,user-scalable=no");

		$.get("http://rawgit.com/salbahra/Sprinklers/master/www/index.html",function(data){
			// Grab the pages from index.html (body content)
			var pages = data.match(/<body>([.\s\S]*)<\/body>/)[1];

			// Disables site selection menu
			window.curr_local = true;

			// Set current IP to the device IP
			window.curr_ip = document.URL.match(/https?:\/\/(.*)\/.*?/)[1];

			// Load 3rd party libraries such as FastClick (loaded first to avoid conflicts)
			$.getScript("http://rawgit.com/salbahra/Sprinklers/master/www/js/libs.js",function(){

				// Load main application Javascript (loaded before jQM so binds trigger when jQM loads)
				$.getScript("http://rawgit.com/salbahra/Sprinklers/master/www/js/main.js",function(){

					// Load jQuery Mobile
					$.getScript("http://rawgit.com/salbahra/Sprinklers/master/www/js/jquery.mobile.min.js",function(){

						// Show the body when jQM attempts first page transition
						$.mobile.document.one("pagebeforechange",function(){

							// Change title to reflect loading finished
							document.title = "Sprinkler System";

							// Inject pages into DOM
							body.html(pages);

							// Remove spinner code (no longer needed)
							$("head").find("style").remove();

							// Initialize environment (missed by main.js since body was added after)
							initApp();

							// Hide multi site features since using local device
							body.find(".multiSite").hide();
						});

					});

				});

			});

		});
	}
}());

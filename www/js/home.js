(function(){
	var assetLocation = "http://rawgit.com/salbahra/Sprinklers/master/www/";

	// Insert script into the DOM
	function insertStyle(src) {
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

	// Insert jQM stylesheet
	insertStyle(assetLocation+"css/jquery.mobile.min.css");

	// Insert main application stylesheet
	insertStyle(assetLocation+"http://rawgit.com/salbahra/Sprinklers/master/www/css/main.css");

	// Insert jQuery and run init function on completion
	insertScript(assetLocation+"http://rawgit.com/salbahra/Sprinklers/master/www/js/jquery.min.js",init);

	function init() {
		var body = $("body");

		// Hide the body while we modify the DOM
		body.hide();

		// Change viewport
		$("meta[name='viewport']").attr("content","width=device-width,initial-scale=1.0,minimum-scale=1.0,user-scalable=no");

		$.get("http://rawgit.com/salbahra/Sprinklers/master/www/index.html",function(data){
			// Grab the pages from index.html (body content)
			var pages = data.match(/<body>([.\s\S]*)<\/body>/)[1];

			// Inject pages into DOM
			body.html(pages);

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
							body.show();
						});
					});
				});
			});

			// Request device password

			// Trigger login

		});
	}
}())

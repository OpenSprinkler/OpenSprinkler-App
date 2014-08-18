/*global $, initApp, XDomainRequest, ActiveXObject */
(function(document){
	var assetLocation = "http://rawgit.com/salbahra/Sprinklers/master/www/",
		isReady = false;

	function insertStyle(css) {
		var head = document.head || document.getElementsByTagName("head")[0],
		    style = document.createElement("style");

		style.type = "text/css";
		if (style.styleSheet){
		  style.styleSheet.cssText = css;
		} else {
		  style.appendChild(document.createTextNode(css));
		}

		head.appendChild(style);
	}

	function insertStyleSheet(href) {
		var head = document.head || document.getElementsByTagName("head")[0],
		    link = document.createElement("link");

		link.rel = "stylesheet";
		link.href = href;

		head.appendChild(link);
	}

	// Insert script into the DOM
	function insertScript(src,callback) {
		// Create callback if one is not provided
		callback = callback || function(){};

	    var a=document.createElement("script");
	    a.src=src;
	    document.getElementsByTagName("head")[0].appendChild(a);

	    // Start checking for script load completion and callback when done
	    var interval = setInterval(function(){
			if (document.readyState === "complete") {
				clearInterval(interval);
				callback();
			}
		},1);
	}

	// Change the viewport
	document.querySelector("meta[name='viewport']").content = "width=device-width,initial-scale=1.0,minimum-scale=1.0,user-scalable=no";

	// Insert loading icon
	insertStyle(".spinner{display:block;padding:.9375em;margin-left:-7.1875em;width:12.5em;filter:Alpha(Opacity=88);opacity:.88;box-shadow:0 1px 1px -1px #fff;margin-top:-2.6875em;height:auto;z-index:9999999;position:fixed;top:50%;left:50%;border:0;background-color:#2a2a2a;border-color:#1d1d1d;color:#fff;text-shadow:0 1px 0 #111;-webkit-border-radius:.3125em;border-radius:.3125em;}.spinner h1{font-size: 1em;margin:0;text-align:center;}.spinner form{margin-bottom:0}.spinner form{padding-top:.2em;}.spinner input[type='password']{border-radius:5px;padding:.3em;line-height:1.2em;display:block;width:100%;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;outline:0;}.spinner input[type=submit]{border-radius:5px;border: 0;font-family:Tahoma;background:#f4f4f4;margin-top:5px;width:100%;}");

	// Change title to reflect current state
	document.title = "Loading...";

	// Insert jQM stylesheet
	insertStyleSheet(assetLocation+"css/jquery.mobile.min.css");

	// Insert main application stylesheet
	insertStyleSheet(assetLocation+"css/main.css");

	// Insert jQuery and run init function on completion
	insertScript(assetLocation+"js/jquery.min.js",init);

	function init() {
		var body = $("body"),
			finishInit = function() {
			    // Start checking for script load completion and callback when done
			    var interval = setInterval(function(){
					if (isReady) {
						clearInterval(interval);
						// Load jQuery Mobile
						$.getScript(assetLocation+"js/jquery.mobile.min.js");
					}
				},1);
			},
			sites = JSON.parse(localStorage.getItem("sites")),
			loader;

		// Fix to allow CORS ajax requests to work on IE8 and 9
		/*!
		 * jQuery-ajaxTransport-XDomainRequest - v1.0.3 - 2014-06-06
		 * https://github.com/MoonScript/jQuery-ajaxTransport-XDomainRequest
		 * Copyright (c) 2014 Jason Moon (@JSONMOON)
		 * Licensed MIT (/blob/master/LICENSE.txt)
		 */
		(function(){if($.support.cors||!$.ajaxTransport||!window.XDomainRequest){return;}var b=/^https?:\/\//i;var c=/^get|post$/i;var a=new RegExp("^"+location.protocol,"i");$.ajaxTransport("* text html xml json",function(e,g){if(!e.crossDomain||!e.async||!c.test(e.type)||!b.test(e.url)||!a.test(e.url)){return;}var d=null;return{send:function(k,i){var h="";var j=(g.dataType||"").toLowerCase();d=new XDomainRequest();if(/^\d+$/.test(g.timeout)){d.timeout=g.timeout;}d.ontimeout=function(){i(500,"timeout");};d.onload=function(){var q="Content-Length: "+d.responseText.length+"\r\nContent-Type: "+d.contentType;var l={code:200,message:"success"};var n={text:d.responseText};try{if(j==="html"||/text\/html/i.test(d.contentType)){n.html=d.responseText;}else{if(j==="json"||(j!=="text"&&/\/json/i.test(d.contentType))){try{n.json=$.parseJSON(d.responseText);}catch(p){l.code=500;l.message="parseerror";}}else{if(j==="xml"||(j!=="text"&&/\/xml/i.test(d.contentType))){var o=new ActiveXObject("Microsoft.XMLDOM");o.async=false;try{o.loadXML(d.responseText);}catch(p){o=undefined;}if(!o||!o.documentElement||o.getElementsByTagName("parsererror").length){l.code=500;l.message="parseerror";throw"Invalid XML: "+d.responseText;}n.xml=o;}}}}catch(m){throw m;}finally{i(l.code,l.message,n,q);}};d.onprogress=function(){};d.onerror=function(){i(500,"error",{text:d.responseText});};if(g.data){h=($.type(g.data)==="string")?g.data:$.param(g.data);}d.open(e.type,e.url);d.send(h);},abort:function(){if(d){d.abort();}}};});}());

		if (sites) {
			// If device has been logged into before, use available settings
			loader = $("<div class='spinner'><h1>Loading</h1></div>");
			finishInit();
		} else {
			// If this is a new login, prompt for password
			loader = $("<div class='spinner'><h1>Enter Device Password</h1><form><input type='password' id='os_pw' name='os_pw' value='' /><input type='submit' value='Submit' /></form></div>"),
			loader.on("submit",function(){
				var sites = {
					"Local": {
						"os_ip": document.URL.match(/https?:\/\/(.*)\/.*?/)[1],
						// Still need to prompt for password
						"os_pw": $("#os_pw").val()
					}
				},
				current_site = "Local";

				// Show loading message and title
				body.html("<div class='spinner'><h1>Loading</h1></div>");
				document.title = "Loading...";

				// Inject site information to storage so Application loads current device
				localStorage.setItem("sites",JSON.stringify(sites));
				localStorage.setItem("current_site",current_site);

				finishInit();

				return false;
			});

			// Change title to reflect current state
			document.title = "OpenSprinkler: Login";
		}

		// Hide the body while we modify the DOM
		body.html(loader);

		$.ajax({
			url: assetLocation+"index.html",
			cache: false,
			crossDomain: true,
			type: "GET"
		}).then(
			function(data){
				// Grab the pages from index.html (body content)
				var pages = data.match(/<body>([.\s\S]*)<\/body>/)[1];

				// Disables site selection menu
				window.curr_local = true;

				// Load 3rd party libraries such as FastClick (loaded first to avoid conflicts)
				$.getScript(assetLocation+"js/libs.js",function(){

					// Load main application Javascript (loaded before jQM so binds trigger when jQM loads)
					$.getScript(assetLocation+"js/main.js",function(){

						// Show the body when jQM attempts first page transition
						$(document).one("mobileinit",function(){

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

							// Show local site features
							body.find(".localSite").removeClass(".localSite");
						});

						// Mark environment as loaded
						isReady = true;
					});
				});
			},
			function(){
				body.html("<div class='spinner'><h1>Unable to load UI</h1></div>");
			}
		);
	}
}(document));

// Insert script into the DOM
function insertStyle(src) {
    var a=document.createElement("link");
    a.href=src;
    a.rel="stylesheet";
    document.head.appendChild(a);
}

// Insert script into the DOM
function insertScript(src,callback) {
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

insertStyle("http://rawgit.com/salbahra/Sprinklers/master/www/css/jquery.mobile.min.css");
insertStyle("http://rawgit.com/salbahra/Sprinklers/master/www/css/main.css");
insertScript("http://rawgit.com/salbahra/Sprinklers/master/www/js/jquery.min.js",init);

function init() {
	var body = $("body");

	body.hide();

	// Change viewport
	$("meta[name='viewport']").attr("content","width=device-width,initial-scale=1.0,minimum-scale=1.0,user-scalable=no");

	$.get("http://rawgit.com/salbahra/Sprinklers/master/www/index.html",function(data){
		var pages = data.match(/<body>([.\s\S]*)<\/body>/)[1];

		// Inject pages into DOM
		body.html(pages);

		// Disables site selection menu
		window.curr_local = true;

		// Set current IP to the device IP
		window.curr_ip = document.URL.match(/https?:\/\/(.*)\/.*?/)[1];

		$.getScript("http://rawgit.com/salbahra/Sprinklers/master/www/js/libs.js",function(){
			$.getScript("http://rawgit.com/salbahra/Sprinklers/master/www/js/main.js",function(){
				$.getScript("http://rawgit.com/salbahra/Sprinklers/master/www/js/jquery.mobile.min.js",function(){
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

// Insert script into the DOM
function insertScript(src) {
    var a=document.createElement("script");
    a.src=src;
    document.head.appendChild(a);
}

insertScript("https://raw.githubusercontent.com/salbahra/Sprinklers/master/www/js/jquery.min.js");
insertScript("https://raw.githubusercontent.com/salbahra/Sprinklers/master/www/js/main.js");
insertScript("https://raw.githubusercontent.com/salbahra/Sprinklers/master/www/js/jquery.mobile.min.js");
insertScript("https://raw.githubusercontent.com/salbahra/Sprinklers/master/www/js/libs.js");

// We now have jQuery since the above are synchronous. Let’s grab the body of the Sprinklers app and inject them into the pages body
$.get("index.html",function(data){
	var pages = $(data).find("body"),
		getPassword = function(){
			var popup = $("<div data-role='popup'>" +
					// This needs to be made still......
				"</div>");

			// Set result as password
			curr_pw = "";
		};

	$.mobile.loading("show");
	$("body").html(pages);

	// Set current IP to the device IP
	curr_ip = document.URL.match(/https?:\/\/(.*)\/.*?/)[1];

	// Disables site selection menu
	curr_local = true;

	// Update controller and load home page
	update_controller().done(function(){
		changePage("#sprinklers");
	});
});

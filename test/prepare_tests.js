describe('prepare_tests', function() {
	before(function() {
		return new Promise(function (resolve) {
			$.ajax({
				url: "/base/www/index.html",
				cache: true,
				type: "GET"
			}).done(function (index) {
				var body = index.match(/<body>([.\s\S]*)<\/body>/)[1];
				$("body").prepend(body);
				resolve();
			});
		} );
	})
});

/* eslint-disable */
var assert = chai.assert;
var server;

before(function () {
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
	});
});

before(function() {
	server = sinon.fakeServer.create();
	server.autoRespond = true;

	// Mock responses using a function to handle requests
	server.respondWith(function(request) {
		var url = request.url;
		var baseUrl = 'https://demo.opensprinkler.com';
		var urlObj = new URL(url, baseUrl);
		var pathname = urlObj.pathname;
		var params = new URLSearchParams(urlObj.search);

		if (pathname === '/jp') {
			request.respond(200, { "Content-Type": "application/json" },
				'{"nprogs":0,"nboards":1,"mnp":40,"mnst":4,"pnsize":32,"pd":[]}'
			);
		} else if (pathname === '/jn') {
			request.respond(200, { "Content-Type": "application/json" },
				'{"masop":[255],"masop2":[0],"ignore_rain":[0],"ignore_sn1":[0],"ignore_sn2":[0],"stn_dis":[0],"stn_spe":[0],"stn_grp":[0,0,0,0,0,0,0,0],"snames":["S01","S02","S03","S04","S05","S06","S07","S08"],"maxlen":32}'
			);
		} else if (pathname === '/jo') {
			request.respond(200, { "Content-Type": "application/json" },
				'{"fwv":221,"tz":28,"hp0":144,"hp1":31,"hwv":255,"ext":0,"sdt":0,"mas":0,"mton":0,"mtof":0,"wl":100,"den":1,"ipas":0,"devid":0,"uwt":0,"ntp1":0,"ntp2":0,"ntp3":0,"ntp4":0,"lg":1,"mas2":0,"mton2":0,"mtof2":0,"fwm":0,"fpr0":100,"fpr1":0,"re":0,"sar":0,"ife":0,"sn1t":0,"sn1o":1,"sn2t":0,"sn2o":1,"sn1on":0,"sn1of":0,"sn2on":0,"sn2of":0,"resv1":0,"resv2":0,"resv3":0,"resv4":0,"resv5":0,"resv6":0,"resv7":0,"resv8":0,"wimod":169,"reset":0,"dexp":-1,"mexp":24,"hwt":255,"ms":[0,0,0,0,0,0]}'
			);
		} else if (pathname === '/js') {
			request.respond(200, { "Content-Type": "application/json" },
				'{"sn":[0,0,0,0,0,0,0,0],"nstations":8}'
			);
		} else if (pathname === '/jc') {
			request.respond(200, { "Content-Type": "application/json" },
				'{"devt":1732789106,"nbrd":1,"en":1,"sn1":0,"sn2":0,"rd":0,"rdst":0,"sunrise":412,"sunset":975,"eip":2728304343,"lwc":1732784441,"lswc":1732784441,"lupt":0,"lrbtc":1,"lrun":[0,0,0,0],"pq":0,"pt":0,"nq":0,"otc":{},"otcs":0,"mac":"02:42:AC:12:00:02","loc":"42.36,-71.06","jsp":"https://ui.opensprinkler.com/js","wsp":"weather.opensprinkler.com","wto":{},"ifkey":"","mqtt":{},"wtdata":{"wp":"Manual"},"wterr":0,"dname":"My OpenSprinkler","email":{},"sbits":[0,0],"ps":[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],"gpio":[]}'
			);
		} else if (pathname === '/jl') {
			// Handle dynamic URLs with start and end query parameters
			var type = params.get('type');
			var response;
			if (type === 'wl') {
				response = `[[0,"wl",100,1732158027],[0,"wl",100,1732179641],[0,"wl",100,1732201255],[0,"wl",100,1732222812],[0,"wl",100,1732244426],[0,"wl",100,1732266040],[0,"wl",100,1732287654],[0,"wl",100,1732309212],[0,"wl",100,1732330826],[0,"wl",100,1732352440],[0,"wl",100,1732374054],[0,"wl",100,1732395613],[0,"wl",100,1732417227],[0,"wl",100,1732438841],[0,"wl",100,1732460455],[0,"wl",100,1732482013],[0,"wl",100,1732503627],[0,"wl",100,1732525241],[0,"wl",100,1732546855],[0,"wl",100,1732568414],[0,"wl",100,1732590028],[0,"wl",100,1732611642],[0,"wl",100,1732633256],[0,"wl",100,1732639575],[0,"wl",100,1732654813],[0,"wl",100,1732676427],[0,"wl",100,1732698041],[0,"wl",100,1732719655],[0,"wl",100,1732741213],[0,"wl",100,1732762827],[0,"wl",100,1732784441]]`;
			} else if (type === 'fl') {
				response = '[]';
			} else {
				response = `[[99,0,64,1732207586],[99,0,64,1732505562],[1,0,60,1732514461],[1,1,60,1732514521]]`;
			}
			request.respond(200, { "Content-Type": "application/json" }, response);
		} else {
			request.respond(404, { "Content-Type": "application/json" }, '{"error": "Not Found"}');
		}
	});
});

before(function () {
	OSApp.currentSession.ip = "demo.opensprinkler.com";
	OSApp.currentSession.pass = "opendoor";
	OSApp.currentSession.prefix = "https://";
	OSApp.currentSession.fw183 = false;

	OSApp.Sites.updateSiteList(["Test"], "Test");
});

describe("Page Initialization Checks", function () {
	it("Start jQuery Mobile Page Initialization", function (done) {
		$.mobile.document.one("pageshow", "#sprinklers", function () {
			done();
		});

		OSApp.Sites.newLoad();
	});
});

after(function() {
	if (server) {
		server.restore();
	}
});

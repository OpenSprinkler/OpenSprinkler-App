module.exports = function (config) {
	config.set({
		frameworks: ['mocha', 'chai'],
		basePath: '../',
		files: [
			{ pattern: 'www/css/jqm.css', included: true, watched: false },
			{ pattern: 'www/css/main.css', included: true, watched: false },
			{ pattern: 'node_modules/mocha/mocha.css', included: true, watched: false },
			{ pattern: 'www/vendor-js/jquery.js', included: true, watched: false },
			{ pattern: 'www/vendor-js/libs.js', included: true, watched: false },
			{ pattern: 'www/vendor-js/apexcharts.min.js', included: true, watched: false },
			{ pattern: 'www/vendor-js/jqm.js', included: true, watched: false },
			{ pattern: 'www/vendor-js/dataTables-2.1.8.min.js', included: true, watched: false },
			{ pattern: 'www/js/modules/*.js', included: true, watched: false },
			{ pattern: 'www/js/main.js', included: true, watched: false },
			'test/tests.js'
		],
		browsers: ['ChromeHeadless'],
		singleRun: true
	});
};

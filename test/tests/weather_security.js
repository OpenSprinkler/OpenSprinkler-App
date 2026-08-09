/* eslint-disable */

describe( "Legacy weather option security", function() {
	function validWeather( overrides ) {
		return Object.assign( {
			location: [ 42.36, -71.06 ],
			temp: 72,
			humidity: 50,
			wind: 4,
			raining: false,
			description: "Clear",
			icon: "01d",
			minTemp: 60,
			maxTemp: 75,
			precip: 0,
			weatherProvider: "OpenMeteo",
			forecast: [
				{ temp_min: 60, temp_max: 75, precip: 0, date: 1784970000, icon: "01d", description: "Clear" },
				{ temp_min: 62, temp_max: 78, precip: 0.1, date: 1785056400, icon: "02d", description: "Cloudy" }
			]
		}, overrides || {} );
	}

	it( "normalizes every controller-provided popup value before HTML rendering", function() {
		var payload = "' autofocus onfocus='weather-secret";

		assert.deepEqual( OSApp.Weather.normalizeZimmermanOptions( {
			h: payload, t: "50", r: -1, bh: 75, bt: 999, br: 0.25
		} ), { h: 100, t: 50, r: 100, bh: 75, bt: 70, br: 0.25 } );
		assert.deepEqual( OSApp.Weather.normalizeRainDelayOptions( { d: payload } ), { d: 24 } );
		assert.deepEqual( OSApp.Weather.normalizeEToOptions( {
			baseETo: payload, elevation: "1200"
		} ), { baseETo: 0, elevation: 1200 } );
		assert.deepInclude( OSApp.Weather.normalizeRestrictionOptions( {
			provider: "OWM", rainAmt: payload, rainDays: "3", minTemp: 500, cali: true
		} ), { provider: "OWM", rainAmt: 0, rainDays: 3, minTemp: -40, cali: 1 } );

		var monthly = OSApp.Weather.normalizeMonthlyOptions( {
			scales: [ payload, "125", 251, 0 ]
		} ).scales;
		assert.lengthOf( monthly, 12 );
		assert.deepEqual( monthly.slice( 0, 5 ), [ 100, 125, 100, 0, 100 ] );
		monthly.forEach( function( value ) { assert.isTrue( Number.isFinite( value ) ); } );
	} );

	it( "rejects empty and partial weather responses while accepting a null alert", function() {
		[ null, [], {}, { alert: null }, { location: [ 42, -71 ], temp: 70, precip: 0, forecast: [] } ].forEach( function( payload ) {
			assert.isNull( OSApp.Weather.normalizeWeatherData( payload ) );
		} );
		var zeroDate = validWeather();
		zeroDate.forecast[ 0 ].date = 0;
		assert.isNull( OSApp.Weather.normalizeWeatherData( zeroDate ) );
		var overflowDate = validWeather();
		overflowDate.forecast[ 0 ].date = 0x100000000;
		assert.isNull( OSApp.Weather.normalizeWeatherData( overflowDate ) );

		var normalized = OSApp.Weather.normalizeWeatherData( validWeather( { alert: null } ) );
		assert.isObject( normalized );
		assert.isNull( normalized.alert );
		assert.deepEqual( normalized.location, [ 42.36, -71.06 ] );
		assert.lengthOf( normalized.forecast, 2 );
	} );

	it( "normalizes optional daily, hourly, and service timestamp fields", function() {
		var hourly = [];
		for ( var index = 0; index < 49; index++ ) {
			hourly.push( { time: 1784970000 + index * 3600, temp: 70, precip: 0.02, pop: 60, icon: "02d" } );
		}
		var weather = validWeather( { observedAt: 1784969900, generatedAt: 1784969800, hourly: hourly } );
		weather.forecast[ 0 ] = Object.assign( {}, weather.forecast[ 0 ], {
			pop: 60, humidity: 45, wind: 12, uv: 7, eto: 0.18
		} );
		var normalized = OSApp.Weather.normalizeWeatherData( weather );
		assert.deepInclude( normalized.forecast[ 0 ], { pop: 60, humidity: 45, wind: 12, uv: 7, eto: 0.18 } );
		assert.equal( normalized.observedAt, 1784969900 );
		assert.equal( normalized.generatedAt, 1784969800 );
		assert.lengthOf( normalized.hourly, 48 );

		weather.hourly[ 1 ].pop = 101;
		normalized = OSApp.Weather.normalizeWeatherData( weather );
		assert.notProperty( normalized, "hourly" );
		weather.forecast[ 0 ].eto = 2;
		weather.observedAt = 0;
		assert.notProperty( OSApp.Weather.normalizeWeatherData( weather ).forecast[ 0 ], "eto" );
		assert.notProperty( OSApp.Weather.normalizeWeatherData( weather ), "observedAt" );
	} );

	it( "rejects malformed rain delays before issuing a controller command", function() {
		var sandbox = sinon.createSandbox();

		try {
			var send = sandbox.stub( OSApp.Firmware, "sendToOS" );

			[ -1, 1, 3599, 3600.5, 31536001, Infinity, NaN, "1foo", "" ].forEach( function( delay ) {
				assert.isFalse( OSApp.Weather.setRainDelay( delay ) );
			} );

			assert.isTrue( send.notCalled );
		} finally {
			sandbox.restore();
		}
	} );

	it( "settles malformed weather responses without caching them or leaving the weather loader", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			originalWeather = OSApp.currentSession.weather,
			originalCoordinates = OSApp.currentSession.coordinates,
			originalServer = OSApp.currentSession.weatherServerUrl,
			requests = [],
			results = [],
			weather = $( "#weather" ).first(),
			weatherFixture = weather.length ? null : $( "<div class='info-card'><div id='weather'></div></div>" ).appendTo( "body" ),
			originalMarkup,
			originalParentClass;

		weather = $( "#weather" ).first();
		originalMarkup = weather.html();
		originalParentClass = weather.parent().attr( "class" );

		try {
			OSApp.currentSession.controller = { settings: { loc: "42.36,-71.06", wto: {}, sunrise: 400, sunset: 1000 } };
			OSApp.currentSession.weather = undefined;
			OSApp.currentSession.coordinates = [ 0, 0 ];
			OSApp.currentSession.weatherServerUrl = "https://weather.example.test";
			OSApp.Weather.activeRequest = null;
			sandbox.stub( OSApp.Storage, "setItemSync" );
			sandbox.stub( OSApp.Storage, "getItemSync" ).returns( null );
			sandbox.stub( $, "ajax" ).callsFake( function( options ) {
				requests.push( options );
				return { abort: sandbox.spy() };
			} );
			$.mobile.document.on( "weatherUpdateComplete.weatherMalformed", function( event, success ) {
				results.push( success );
			} );

			[ null, [], {}, { alert: null }, validWeather( { forecast: null } ) ].forEach( function( payload, index ) {
				assert.doesNotThrow( function() {
					OSApp.Weather.updateWeather( true );
					requests[ index ].success( payload );
					requests[ index ].complete();
				} );
				assert.equal( weather.find( ".mini-load" ).length, 0 );
			} );

			assert.deepEqual( results, [ false, false, false, false, false ] );
			assert.isFalse( OSApp.Storage.setItemSync.called );
			assert.isUndefined( OSApp.currentSession.weather );
		} finally {
			$.mobile.document.off( ".weatherMalformed" );
			sandbox.restore();
			OSApp.Weather.activeRequest = null;
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.weather = originalWeather;
			OSApp.currentSession.coordinates = originalCoordinates;
			OSApp.currentSession.weatherServerUrl = originalServer;
			weather.html( originalMarkup );
			weather.parent().attr( "class", originalParentClass );
			if ( weatherFixture ) weatherFixture.remove();
		}
	} );

	it( "renders and completes valid weather with alert null even when cache storage fails", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			originalWeather = OSApp.currentSession.weather,
			originalCoordinates = OSApp.currentSession.coordinates,
			originalServer = OSApp.currentSession.weatherServerUrl,
			request,
			result,
			weather = $( "#weather" ).first(),
			weatherFixture = weather.length ? null : $( "<div class='info-card'><div id='weather'></div></div>" ).appendTo( "body" ),
			originalMarkup,
			originalParentClass;

		weather = $( "#weather" ).first();
		originalMarkup = weather.html();
		originalParentClass = weather.parent().attr( "class" );

		try {
			OSApp.currentSession.controller = { settings: { loc: "42.36,-71.06", wto: {}, sunrise: 400, sunset: 1000 } };
			OSApp.currentSession.weather = undefined;
			OSApp.currentSession.weatherServerUrl = "https://weather.example.test";
			OSApp.Weather.activeRequest = null;
			sandbox.stub( OSApp.Storage, "setItemSync" ).throws( new Error( "quota" ) );
			sandbox.stub( $, "ajax" ).callsFake( function( options ) {
				request = options;
				return { abort: sandbox.spy() };
			} );
			$.mobile.document.one( "weatherUpdateComplete.weatherValid", function( event, success ) {
				result = success;
			} );

			assert.doesNotThrow( function() {
				OSApp.Weather.updateWeather( true );
				request.success( validWeather( { alert: null } ) );
				request.complete();
			} );

			assert.isTrue( result );
			assert.isNull( OSApp.currentSession.weather.alert );
			assert.isTrue( OSApp.Storage.setItemSync.calledOnce );
			assert.equal( weather.find( ".mini-load" ).length, 0 );
			assert.include( weather.text(), "72" );
		} finally {
			$.mobile.document.off( ".weatherValid" );
			sandbox.restore();
			OSApp.Weather.activeRequest = null;
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.weather = originalWeather;
			OSApp.currentSession.coordinates = originalCoordinates;
			OSApp.currentSession.weatherServerUrl = originalServer;
			weather.html( originalMarkup );
			weather.parent().attr( "class", originalParentClass );
			if ( weatherFixture ) weatherFixture.remove();
		}
	} );

	it( "forces Forecast Refresh past a fresh cache and rerenders the active page", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			originalWeather = OSApp.currentSession.weather,
			originalCoordinates = OSApp.currentSession.coordinates,
			originalServer = OSApp.currentSession.weatherServerUrl,
			header,
			request,
			page;

		try {
			OSApp.currentSession.controller = { settings: { loc: "42.36,-71.06", wto: {}, sunrise: 400, sunset: 1000 } };
			OSApp.currentSession.weather = validWeather( {
				providedLocation: "42.36,-71.06",
				lastUpdated: Date.now()
			} );
			OSApp.currentSession.coordinates = [ 42.36, -71.06 ];
			OSApp.currentSession.weatherServerUrl = "https://weather.example.test";
			OSApp.Weather.activeRequest = null;
			sandbox.stub( OSApp.UIDom, "changeHeader" ).callsFake( function( options ) {
				header = options;
				return $( "<div></div>" );
			} );
			var loading = sandbox.stub( $.mobile, "loading" );
			var cacheRead = sandbox.stub( OSApp.Storage, "getItemSync" ).returns( JSON.stringify( OSApp.currentSession.weather ) );
			sandbox.stub( OSApp.Storage, "setItemSync" );
			var ajax = sandbox.stub( $, "ajax" ).callsFake( function( options ) {
				request = options;
				return { abort: sandbox.spy() };
			} );

			OSApp.Weather.showForecast();
			page = $( "#forecast" ).addClass( "ui-page-active" );
			assert.include( page.find( "ul" ).text(), "72" );
			header.rightBtn.on();

			assert.isTrue( ajax.calledOnce );
			assert.isFalse( cacheRead.called );
			assert.isTrue( loading.calledWith( "show" ) );
			request.success( validWeather( { temp: 91, description: "Updated forecast" } ) );
			request.complete();

			assert.isTrue( loading.calledWith( "hide" ) );
			assert.include( page.find( "ul" ).text(), "91" );
			assert.equal( page.find( ".wicon" ).first().attr( "title" ), "Updated forecast" );
		} finally {
			if ( page ) {
				page.remove();
			}
			$.mobile.document.off( ".forecastRefresh" );
			sandbox.restore();
			OSApp.Weather.activeRequest = null;
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.weather = originalWeather;
			OSApp.currentSession.coordinates = originalCoordinates;
			OSApp.currentSession.weatherServerUrl = originalServer;
		}
	} );
} );

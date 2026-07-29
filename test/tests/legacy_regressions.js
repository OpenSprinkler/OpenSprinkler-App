/* eslint-disable */

describe( "Legacy regression checks", function() {
	it( "fails closed on corrupt site storage and strips prototype keys", function() {
		assert.deepEqual( OSApp.Sites.parseSites( "{not-json" ), {} );
		assert.deepEqual( OSApp.Sites.parseSites( "[]" ), {} );

		var sites = OSApp.Sites.parseSites(
			'{"Safe":{"os_ip":"192.0.2.10"},"__proto__":{"polluted":true},"constructor":{"bad":true}}'
		);
		assert.deepEqual( Object.keys( sites ), [ "Safe" ] );
		assert.isUndefined( {}.polluted );
		assert.isFalse( OSApp.Sites.isSafeSiteName( "__proto__" ) );
		assert.isFalse( OSApp.Sites.isSafeSiteName( "constructor" ) );
		assert.isTrue( OSApp.Sites.isSafeSiteName( "Back Yard" ) );
	} );

	it( "parses query values containing equals signs", function() {
		assert.deepEqual( OSApp.Firmware.getUrlVars( "/co?pw=&mqtt=a%3Db%26c&flag" ), {
			pw: "",
			mqtt: "a=b&c",
			flag: ""
		} );
	} );

	it( "rejects malformed and impossible program dates", function() {
		assert.isTrue( OSApp.Dates.isValidDateFormat( "2/29" ) );
		assert.isFalse( OSApp.Dates.isValidDateFormat( "2/30" ) );
		assert.isFalse( OSApp.Dates.isValidDateFormat( "12/31 trailing" ) );
		assert.equal( OSApp.Dates.dateToEpoch( "2/29/2024" ), 19782 );
		assert.equal( OSApp.Dates.dateToEpoch( "2/29/2023" ), -1 );
		assert.equal( OSApp.Dates.parseDisplayDate( "06/09/2024" ).getTime(), Date.UTC( 2024, 5, 9 ) );
		assert.isNull( OSApp.Dates.parseDisplayDate( "6/9/2024" ) );
		assert.isNull( OSApp.Dates.parseDisplayDate( "2024-06-09" ) );
		assert.isNull( OSApp.Dates.parseDisplayDate( "02/30/2024" ) );
		assert.equal( OSApp.Dates.formatDateInput( "06092024" ), "06/09/2024" );
		assert.equal( OSApp.Dates.formatDateInput( "06-09-2024 extra" ), "06/09/2024" );
		var range = OSApp.Logs.parseDateRange( "06/09/2024", "06/10/2024" );
		assert.equal( range.start.getTime(), Date.UTC( 2024, 5, 9 ) );
		assert.equal( range.end.getTime(), Date.UTC( 2024, 5, 10 ) );
		assert.isNull( OSApp.Logs.parseDateRange( "2024-06-09", "06/10/2024" ) );
	} );

	it( "bounds legacy single-run program dates to the controller's 16-bit epoch day", function() {
		assert.equal( OSApp.Programs.parseSingleRunDate( "01/01/1970" ), 0 );
		assert.equal( OSApp.Programs.parseSingleRunDate( "06/06/2149" ), 65535 );
		assert.isNull( OSApp.Programs.parseSingleRunDate( "12/31/1969" ) );
		assert.isNull( OSApp.Programs.parseSingleRunDate( "06/07/2149" ) );
		assert.isNull( OSApp.Programs.parseSingleRunDate( "1/1/1970" ) );
	} );

	it( "ignores and disables a malformed seasonal range until it is enabled", function() {
		var root = $( "<fieldset>" +
			"<input type='checkbox' id='use-dr-test'>" +
			"<div id='date-range-options-test'><input id='from-dr-test' value='invalid'><input id='to-dr-test' value='also-invalid'></div>" +
			"</fieldset>" );

		OSApp.Programs.setDateRangeEnabled( root, "test", false );
		assert.equal( root.find( "#date-range-options-test" ).css( "display" ), "none" );
		assert.isTrue( root.find( "#from-dr-test" ).prop( "disabled" ) );
		assert.deepEqual( OSApp.Programs.getDateRangeSubmission( root, "test" ), {
			valid:true, enabled:false, query:"&endr=0"
		} );

		root.find( "#use-dr-test" ).prop( "checked", true );
		OSApp.Programs.setDateRangeEnabled( root, "test", true );
		assert.notEqual( root.find( "#date-range-options-test" ).css( "display" ), "none" );
		assert.isFalse( root.find( "#from-dr-test" ).prop( "disabled" ) );
		assert.isFalse( OSApp.Programs.getDateRangeSubmission( root, "test" ).valid );

		root.find( "#from-dr-test" ).val( "01/01" );
		root.find( "#to-dr-test" ).val( "12/31" );
		assert.deepEqual( OSApp.Programs.getDateRangeSubmission( root, "test" ), {
			valid:true,
			enabled:true,
			query:"&endr=1&from=" + OSApp.Dates.encodeDate( "01/01" ) + "&to=" + OSApp.Dates.encodeDate( "12/31" )
		} );
	} );

	it( "normalizes preview weather levels before duration arithmetic", function() {
		var levels = OSApp.Programs.normalizePreviewWaterLevels( NaN, [
			50, NaN, Infinity, -1, 251, 75.5, "80", 0, 250, 1, 2, 3, 4, 5, 6
		] );

		assert.equal( levels.waterLevel, 100 );
		assert.lengthOf( levels.multiDayLevels, 14 );
		assert.deepEqual( levels.multiDayLevels.slice( 0, 9 ), [ 50, 100, 100, 100, 100, 100, 100, 0, 250 ] );
		assert.deepEqual( OSApp.Programs.normalizePreviewWaterLevels( 125, [ null ] ), {
			waterLevel:125, multiDayLevels:[ 125 ]
		} );
		assert.equal( OSApp.Programs.scalePreviewDuration( 40000, 250 ), 34464 );
		assert.equal( OSApp.Programs.scalePreviewDuration( 32768, 200 ), 0 );
		assert.equal( OSApp.Programs.getMaximumPreviewQueuedDuration( 40000, true ), 65535 );
	} );

	it( "formats exact single-run dates and disables hidden seasonal inputs in the program editor", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			program;

		try {
			OSApp.currentSession.controller = {
				programs:{ pd:[], pnsize:32 },
				stations:{ snames:[ "S1" ] },
				options:{ mas:0, mas2:0 }
			};
			sandbox.stub( OSApp.Supported, "dateRange" ).returns( true );
			sandbox.stub( OSApp.Supported, "singleRunAndMonthly" ).returns( true );
			sandbox.stub( OSApp.Stations, "isMaster" ).returns( false );
			sandbox.stub( OSApp.Stations, "isDisabled" ).returns( false );
			sandbox.stub( OSApp.Stations, "getName" ).returns( "S1" );
			sandbox.stub( OSApp.Groups, "calculateTotalRunningTime" ).returns( 0 );
			sandbox.stub( OSApp.UIDom, "fixInputClick" );

			program = OSApp.Programs.makeProgram21( "new" );
			var singleDate = program.find( "#singleDate-new" ),
				dateRange = program.find( "#date-range-options-new" ),
				dateRangeInputs = dateRange.find( "input" );

			assert.equal( singleDate.attr( "placeholder" ), "MM/DD/YYYY" );
			singleDate.val( "01011970" ).triggerHandler( "input" );
			assert.equal( singleDate.val(), "01/01/1970" );
			assert.equal( dateRange.css( "display" ), "none" );
			assert.isTrue( dateRangeInputs.first().prop( "disabled" ) );

			program.find( "#use-dr-new" ).prop( "checked", true ).triggerHandler( "change" );
			assert.notEqual( dateRange.css( "display" ), "none" );
			assert.isFalse( dateRangeInputs.first().prop( "disabled" ) );
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = oldController;
		}
	} );

	it( "formats controller dates without browser timezone or mutation", function() {
		var old24Hour = OSApp.uiState.is24Hour,
			date = new Date( Date.UTC( 2024, 5, 9, 0, 5, 6 ) ),
			earlyDate = new Date( 0 ),
			before = date.getTime();

		try {
			earlyDate.setUTCFullYear( 42, 0, 2 );
			OSApp.uiState.is24Hour = false;
			assert.equal( OSApp.Dates.dateOnly( date ), "06/09/2024" );
			assert.equal( OSApp.Dates.dateOnly( earlyDate ), "01/02/0042" );
			assert.equal( OSApp.Dates.dateToString( date ), "06/09/2024 12:05:06 AM" );
			assert.equal( OSApp.Dates.dateTimeNoSeconds( date ), "06/09/2024 12:05 AM" );
			assert.equal( OSApp.Dates.timeToString( new Date( Date.UTC( 2024, 5, 9, 12, 5, 6 ) ) ), "12:05:06 PM" );
			assert.equal( OSApp.Dates.minutesToTime( 0 ), "12:00 AM" );
			assert.equal( OSApp.Dates.minutesToTime( 720 ), "12:00 PM" );
			assert.equal( OSApp.Dates.epochToDate( Date.UTC( 2024, 5, 9 ) / 86400000 ), "06/09/2024" );
			assert.equal( date.getTime(), before );

			OSApp.uiState.is24Hour = true;
			assert.equal( OSApp.Dates.dateToString( date ), "06/09/2024 00:05:06" );
			assert.equal( OSApp.Dates.minutesToTime( 5 ), "00:05" );
		} finally {
			OSApp.uiState.is24Hour = old24Hour;
		}
	} );

	it( "decodes quarter-hour controller timezones and shifts real Unix instants once", function() {
		var oldController = OSApp.currentSession.controller;

		try {
			OSApp.currentSession.controller = { options:{ tz:70 } };
			assert.equal( OSApp.Dates.getTimezoneOffsetOS(), 330 );
			OSApp.currentSession.controller.options.tz = 71;
			assert.equal( OSApp.Dates.getTimezoneOffsetOS(), 345 );
			OSApp.currentSession.controller.options.tz = 22;
			assert.equal( OSApp.Dates.getTimezoneOffsetOS(), -390 );

			OSApp.currentSession.controller.options.tz = 20;
			var displayDate = OSApp.Dates.controllerDateFromUnix( Date.UTC( 2024, 5, 1 ) / 1000 );
			assert.equal( OSApp.Dates.dateOnly( displayDate ), "05/31/2024" );
			assert.equal( OSApp.Dates.getDayName( displayDate, "short" ), "Fri" );
		} finally {
			OSApp.currentSession.controller = oldController;
		}
	} );

	it( "round-trips every supported controller timezone and converts manual time for each firmware clock base", function() {
		assert.equal( OSApp.Dates.parseTimezoneOffset( "-06:00" ), -360 );
		assert.equal( OSApp.Dates.parseTimezoneOffset( "+05:45" ), 345 );
		assert.equal( OSApp.Dates.formatTimezoneOffset( -705 ), "-11:45" );
		assert.equal( OSApp.Dates.formatTimezoneOffset( 900 ), "+15:00" );
		assert.isUndefined( OSApp.Dates.parseTimezoneOffset( "+15:15" ) );

		var wallEpoch = Date.UTC( 2024, 5, 9, 9, 30 ) / 1000,
			wallComponents = { yy:2024, mm:5, dd:9, hh:9, mi:30 };
		assert.deepEqual( OSApp.Options.getManualTimeOptions( wallEpoch, -360, false ), {
			yy:wallComponents.yy, mm:wallComponents.mm, dd:wallComponents.dd,
			hh:wallComponents.hh, mi:wallComponents.mi, tt:wallEpoch
		} );
		assert.deepEqual( OSApp.Options.getManualTimeOptions( wallEpoch, -360, true ), {
			yy:2024, mm:5, dd:9, hh:9, mi:30,
			tt:wallEpoch + 6 * 60 * 60
		} );
	} );

	it( "renders forecast dates and sun times in the controller timezone", function() {
		var oldController = OSApp.currentSession.controller,
			oldWeather = OSApp.currentSession.weather,
			old24Hour = OSApp.uiState.is24Hour,
			sunTimes = sinon.stub( OSApp.Weather, "getSunTimes" ).returns( [ 360, 1080 ] );

		try {
			OSApp.uiState.is24Hour = false;
			OSApp.currentSession.controller = { options:{ tz:20 }, settings:{ sunrise:360, sunset:1080 } };
			OSApp.currentSession.weather = {
				description:"Clear", icon:"01d", temp:70, precip:0,
				forecast:[ {}, {
					date:Date.UTC( 2024, 5, 1 ) / 1000, description:"Sunny", icon:"01d",
					temp_min:60, temp_max:80, precip:0
				} ]
			};

			var html = OSApp.Weather.makeForecast();
			assert.include( html, "05/31/2024" );
			assert.include( html, ">Fri<" );
			assert.include( html, "6:00 AM" );
			assert.include( html, "6:00 PM" );
			assert.notInclude( html, "18:00" );
		} finally {
			sunTimes.restore();
			OSApp.currentSession.controller = oldController;
			OSApp.currentSession.weather = oldWeather;
			OSApp.uiState.is24Hour = old24Hour;
		}
	} );

	it( "shows the date-time editor in the selected clock format without browser offset math", function() {
		var old24Hour = OSApp.uiState.is24Hour,
			popup,
			openPopup = sinon.stub( OSApp.UIDom, "openPopup" ).callsFake( function( value ) {
				popup = value;
			} );

		try {
			OSApp.uiState.is24Hour = false;
			OSApp.UIDom.showDateTimeInput( Date.UTC( 2024, 5, 9, 0, 5 ) / 1000 );
			assert.equal( popup.find( ".datetime-preview" ).text(), "06/09/2024 12:05 AM" );
			assert.include( popup.find( "#Minutes" ).text(), "05 AM" );
		} finally {
			openPopup.restore();
			OSApp.uiState.is24Hour = old24Hour;
			$( "#datetimeInput" ).remove();
		}
	} );

	it( "formats log midnight and analog chart labels consistently", function() {
		var old24Hour = OSApp.uiState.is24Hour,
			midnight = new Date( Date.UTC( 2024, 5, 9, 0, 5, 6 ) );

		try {
			OSApp.uiState.is24Hour = false;
			assert.equal( OSApp.Logs.formatTime( midnight, false ), "12:05:06 AM" );
			assert.equal( OSApp.Logs.formatTime( midnight, true ), "06/09/2024 12:05:06 AM" );
			assert.deepEqual( OSApp.Analog.getChartDateFormats(), {
				time:"hh:mm TT", date:"MM/dd/yyyy", dateTime:"MM/dd/yyyy hh:mm:ss TT"
			} );
		} finally {
			OSApp.uiState.is24Hour = old24Hour;
		}
	} );

	it( "keeps carry-in and cross-midnight program previews visible across their full span", function() {
		var items = [ { start:-5 * 60, end:10 * 60 }, { start:23 * 3600, end:30 * 3600 } ],
			range = OSApp.Programs.normalizePreviewTimeline( items, [ 2024, 6, 9 ] );

		assert.equal( items[ 0 ].start.getTime(), Date.UTC( 2024, 5, 8, 23, 55 ) );
		assert.equal( items[ 0 ].end.getTime(), Date.UTC( 2024, 5, 9, 0, 10 ) );
		assert.equal( items[ 1 ].start.getTime(), Date.UTC( 2024, 5, 9, 23 ) );
		assert.equal( items[ 1 ].end.getTime(), Date.UTC( 2024, 5, 10, 6 ) );
		assert.equal( range.min.getTime(), Date.UTC( 2024, 5, 8, 23, 55 ) );
		assert.equal( range.max.getTime(), Date.UTC( 2024, 5, 10, 6 ) );
		assert.equal( range.zoomMax, 30 * 3600000 + 5 * 60000 );
	} );

	it( "recognizes the complete RFC 1918 172.16/12 range", function() {
		assert.isFalse( OSApp.Network.isLocalIP( "172.15.255.255" ) );
		assert.isTrue( OSApp.Network.isLocalIP( "172.16.0.1" ) );
		assert.isTrue( OSApp.Network.isLocalIP( "172.31.255.255" ) );
		assert.isFalse( OSApp.Network.isLocalIP( "172.32.0.1" ) );
		assert.isFalse( OSApp.Network.isLocalIP( "192.168.bad.1" ) );
		assert.isFalse( OSApp.Network.isLocalIP( "192.168.1.999" ) );
		assert.isFalse( OSApp.Network.isLocalIP( "192.168.1" ) );
	} );

	it( "treats a null remote-station response as an unreachable controller", function( done ) {
		var request = $.Deferred().resolve( null ).promise(),
			ajax = sinon.stub( $, "ajax" ).returns( request );

		try {
			OSApp.Stations.verifyRemoteStation( "c000020a005000", function( result ) {
				try {
					assert.equal( result, -1 );
					done();
				} catch ( error ) {
					done( error );
				} finally {
					ajax.restore();
				}
			} );
		} catch ( error ) {
			ajax.restore();
			done( error );
		}
	} );

	it( "rejects malformed remote-station data before issuing a request", function() {
		assert.isNull( OSApp.Stations.parseRemoteStationData( null ) );
		assert.isNull( OSApp.Stations.parseRemoteStationData( "c000020a0050" ) );
		assert.isNull( OSApp.Stations.parseRemoteStationData( "zz00020a005000" ) );
		assert.isNull( OSApp.Stations.parseRemoteStationData( "c000020a000000" ) );
		assert.isNull( OSApp.Stations.parseRemoteStationData( "c000020a0050c8" ) );
		assert.isNull( OSApp.Stations.parseRemoteStationData( "OT000000000000000000000000000000,c8" ) );
		assert.deepEqual( OSApp.Stations.parseRemoteStationData( "c000020a005000" ), {
			ip:"192.0.2.10", port:80, station:0
		} );

		var ajax = sinon.stub( $, "ajax" ),
			result;
		try {
			OSApp.Stations.verifyRemoteStation( "not-remote-data", function( value ) { result = value; } );
			assert.equal( result, -1 );
			assert.isFalse( ajax.called );
			assert.isFalse( OSApp.Stations.convertRemoteToExtender( "not-remote-data" ) );
			assert.isFalse( ajax.called );
		} finally {
			ajax.restore();
		}
	} );

	it( "requires a trusted extender response and configures a finite verifier timeout", function( done ) {
		var replies = [
			{ fwv:221, wl:100, re:"bad" },
			{ fwv:221, wl:100, re:0 },
			{ fwv:221, wl:100, re:1 }
		], results = [], requests = [], ajax = sinon.stub( $, "ajax" ).callsFake( function( options ) {
			var deferred = $.Deferred();
			requests.push( { options:options, request:deferred.promise() } );
			deferred.resolve( replies.shift() );
			return requests[ requests.length - 1 ].request;
		} );

		try {
			for ( var i = 0; i < 3; i++ ) {
				var returned = OSApp.Stations.verifyRemoteStation( "c000020a005000", function( result ) {
					results.push( result );
				} );
				assert.strictEqual( returned, requests[ i ].request );
				assert.equal( requests[ i ].options.timeout, 10000 );
			}
			setTimeout( function() {
				try {
					assert.deepEqual( results, [ -1, -3, true ] );
					done();
				} catch ( error ) {
					done( error );
				} finally {
					ajax.restore();
				}
			}, 0 );
		} catch ( error ) {
			ajax.restore();
			done( error );
		}
	} );

	it( "normalizes map coordinates to finite numbers", function() {
		assert.deepEqual( OSApp.Options.normalizeMapCoordinates( "41.8819", "-87.6278" ), {
			lat: 41.8819,
			lon: -87.6278
		} );
		assert.deepEqual( OSApp.Options.normalizeMapCoordinates( "91", "0" ), { lat: 0, lon: 0 } );
		assert.deepEqual( OSApp.Options.normalizeMapCoordinates( "not-a-number", "0" ), { lat: 0, lon: 0 } );
	} );

	it( "drops malicious analog identifiers and renders sensor labels as text", function() {
		var payload = "'><img src=x onerror='analog-secret'><div id='",
			page = $( "<div><div id='os-sensor-show'></div></div>" ),
			sensors = OSApp.Analog.normalizeSensors( [
				{ nr:payload, show:1, name:"bad", data:1, unit:"V" },
				{ nr:1, show:1, name:payload, data:12.5, unit:payload }
			] ),
			adjustments = OSApp.Analog.normalizeProgramAdjustments( [ { nr:payload, current:1 } ] ),
			oldSensors = OSApp.Analog.analogSensors,
			oldAdjustments = OSApp.Analog.progAdjusts,
			available = sinon.stub( OSApp.Analog, "checkAnalogSensorAvail" ).returns( true );

		try {
			assert.lengthOf( sensors, 1 );
			assert.lengthOf( adjustments, 0 );
			OSApp.Analog.analogSensors = sensors;
			OSApp.Analog.progAdjusts = adjustments;
			OSApp.Analog.updateSensorShowArea( page );
			assert.equal( page.find( "img" ).length, 0 );
			assert.include( page.find( "#os-sensor-show" ).text(), payload );
		} finally {
			available.restore();
			OSApp.Analog.analogSensors = oldSensors;
			OSApp.Analog.progAdjusts = oldAdjustments;
		}
	} );

	it( "rejects incomplete and non-finite analog editor values", function() {
		var validSensor = {
			nr:"1", type:"1", group:"0", name:"Sensor", ip:"192.0.2.10", port:"80", id:"1", ri:"60",
			fac:"0", div:"1", unit:"V", enable:true, log:true, show:false
		}, validAdjustment = {
			nr:"1", type:"1", sensor:"1", prog:"1", factor1:"1", factor2:"2", min:"0", max:"100"
		};

		assert.isObject( OSApp.Analog.normalizeSensorEditorInput( validSensor ) );
		assert.isNull( OSApp.Analog.normalizeSensorEditorInput( Object.assign( {}, validSensor, { nr:"" } ) ) );
		assert.isNull( OSApp.Analog.normalizeSensorEditorInput( Object.assign( {}, validSensor, { ip:"192.0.bad.10" } ) ) );
		assert.isNull( OSApp.Analog.normalizeSensorEditorInput( Object.assign( {}, validSensor, { ip:"192.0.2.999" } ) ) );
		assert.isObject( OSApp.Analog.normalizeAdjustmentEditorInput( validAdjustment ) );
		assert.isNull( OSApp.Analog.normalizeAdjustmentEditorInput( Object.assign( {}, validAdjustment, { nr:"" } ) ) );
		assert.isNull( OSApp.Analog.normalizeAdjustmentEditorInput( Object.assign( {}, validAdjustment, { factor1:"Infinity" } ) ) );
		assert.isNull( OSApp.Analog.normalizeAdjustmentEditorInput( Object.assign( {}, validAdjustment, { min:"101" } ) ) );
	} );

	it( "renders scan firmware labels and update URLs without parsing controller text as markup", function() {
		var payload = "1.9-OSPi<img src=x onerror='scan-secret'>",
			scan = OSApp.Network.createScanResult( "192.0.2.10", payload ),
			validScan = OSApp.Network.createScanResult( "192.0.2.10", "1.9-OSPi" ),
			maliciousUpdate = OSApp.Firmware.createControllerUpdateLink( "http://", "controller.test/' onclick='update-secret" ),
			update = OSApp.Firmware.createControllerUpdateLink( "https://", "controller.test/base" );

		assert.lengthOf( scan, 0 );
		assert.lengthOf( validScan, 1 );
		assert.equal( validScan.find( "img" ).length, 0 );
		assert.include( validScan.text(), "1.9-OSPi" );
		assert.lengthOf( maliciousUpdate, 0 );
		assert.lengthOf( update, 1 );
		assert.isUndefined( update.attr( "onclick" ) );
		assert.equal( update.attr( "href" ), "https://controller.test/base/update" );
	} );

	it( "normalizes persisted site fields and preserves valid OSPi metadata", function() {
		var parsed = OSApp.Sites.parseSites( JSON.stringify( {
			Good: {
				os_ip:"https://controller.test/base/", fwv:"1.9-OSPi", os_pw:"pw",
				notes:{ "0":"ok", bad:"drop" }, lastRunTime:{ "0":123, "1":"bad" },
				images:{ "0":"aGVsbG8=" }, auth_user:"user", auth_pw:"pass"
			},
			BadQuery:{ os_ip:"controller.test/?redirect=bad" },
			BadProtocol:{ os_ip:"javascript://controller.test" },
			BadToken:{ os_token:"OTnot-hex" }
		} ) );

		assert.deepEqual( Object.keys( parsed ), [ "Good" ] );
		assert.equal( parsed.Good.os_ip, "controller.test/base" );
		assert.equal( parsed.Good.ssl, "1" );
		assert.equal( parsed.Good.fwv, "1.9-OSPi" );
		assert.deepEqual( parsed.Good.notes, { "0":"ok" } );
		assert.deepEqual( parsed.Good.lastRunTime, { "0":123 } );
		assert.deepEqual( parsed.Good.images, { "0":"aGVsbG8=" } );
		assert.isTrue( OSApp.Firmware.isFullOptionsResponse( { fwv:"1.9-OSPi", wl:100 } ) );
		assert.isFalse( OSApp.Firmware.isFullOptionsResponse( { fwv:"<img>OSPi", wl:100 } ) );
	} );

	it( "makes an explicit site URL scheme authoritative over the SSL checkbox", function() {
		assert.deepEqual( OSApp.Sites.resolveSiteAddress( "https://controller.test/base/", false ), {
			address:"controller.test/base", ssl:true
		} );
		assert.deepEqual( OSApp.Sites.resolveSiteAddress( "http://controller.test", true ), {
			address:"controller.test", ssl:false
		} );
		assert.deepEqual( OSApp.Sites.resolveSiteAddress( "controller.test", true ), {
			address:"controller.test", ssl:true
		} );
	} );

	it( "rejects controller markup in station, water-level, and flow log rows", function() {
		var payload = "<img src=x onerror='log-secret'>",
			timestamp = 1717930000;

		assert.deepEqual( OSApp.Logs.normalizeRows( [
			[ 1, 0, payload, timestamp ], [ 1, payload, 60, timestamp ], [ -1, 0, 60, timestamp ],
			[ 256, 0, 60, timestamp ], [ 1, 0, 60, timestamp ]
		], "station" ), [ [ 1, 0, 60, timestamp ] ] );
		assert.deepEqual( OSApp.Logs.normalizeRows( [
			[ 0, "wl", payload, timestamp ], [ 0, "wl", 75, timestamp ]
		], "water" ), [ [ 0, "wl", 75, timestamp ] ] );
		assert.deepEqual( OSApp.Logs.normalizeRows( [
			[ payload, "fl", 60, timestamp ], [ 1280, "fl", payload, timestamp ], [ 1280, "fl", 60, timestamp ]
		], "flow" ), [ [ 1280, "fl", 60, timestamp ] ] );
	} );

	it( "settles the log loader when navigation invalidates an in-flight request", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			pending = $.Deferred(),
			page, sendToOS;

		try {
			OSApp.currentSession.controller = {
				options:{}, settings:{ devt:1717930000 }, stations:{ snames:[ "S1" ] }
			};
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( false );
			sandbox.stub( OSApp.Firmware, "isOSPi" ).returns( false );
			sendToOS = sandbox.stub( OSApp.Firmware, "sendToOS" ).returns( pending.promise() );
			sandbox.stub( OSApp.UIDom, "changeHeader" );
			var loading = sandbox.stub( $.mobile, "loading" );

			OSApp.Logs.displayPage();
			page = $( "#logs" );
			assert.equal( page.find( "#log_start" ).attr( "type" ), "text" );
			assert.equal( page.find( "#log_start" ).attr( "placeholder" ), "MM/DD/YYYY" );
			page.find( "#log_start" ).val( "06/09/2024" );
			page.find( "#log_end" ).val( "06/10/2024" );
			page.triggerHandler( "pageshow" );
			assert.include( sendToOS.firstCall.args[ 0 ], "start=" + Date.UTC( 2024, 5, 9 ) / 1000 );
			assert.include( sendToOS.firstCall.args[ 0 ], "end=" + Date.UTC( 2024, 5, 10 ) / 1000 );
			assert.isTrue( loading.calledWith( "show" ) );
			page.triggerHandler( "pagehide" );
			assert.isTrue( loading.calledWith( "hide" ) );
			pending.resolve( [] );
		} finally {
			if ( page ) page.remove();
			sandbox.restore();
			OSApp.currentSession.controller = oldController;
		}
	} );

	it( "settles the program reorder loader when the follow-up refresh fails", function( done ) {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			page;

		try {
			OSApp.currentSession.controller = { programs:{ pd:[ [] ] } };
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
			var sendToOS = sandbox.stub( OSApp.Firmware, "sendToOS" ).returns( $.Deferred().resolve().promise() );
			sandbox.stub( OSApp.Sites, "updateControllerPrograms" ).returns(
				$.Deferred().reject( { statusText:"abort" } ).promise()
			);
			sandbox.stub( OSApp.Programs, "makeAllPrograms" ).returns(
				"<div><fieldset id='program-0'><button class='move-up'>Move</button></fieldset></div>"
			);
			sandbox.stub( OSApp.Programs, "updateProgramHeader" );
			sandbox.stub( OSApp.UIDom, "changeHeader" );
			var loading = sandbox.stub( $.mobile, "loading" );

			OSApp.Programs.displayPage();
			page = $( "#programs" );
			page.find( ".move-up" ).trigger( "click" );
			page.find( ".move-up" ).trigger( "click" );
			assert.isTrue( loading.calledWith( "show" ) );
			assert.isTrue( sendToOS.calledOnce );

			setTimeout( function() {
				try {
					assert.isTrue( OSApp.Sites.updateControllerPrograms.calledOnce );
					assert.isTrue( loading.calledWith( "hide" ) );
					done();
				} catch ( error ) {
					done( error );
				} finally {
					if ( page ) page.remove();
					sandbox.restore();
					OSApp.currentSession.controller = oldController;
				}
			}, 10 );
		} catch ( error ) {
			if ( page ) page.remove();
			sandbox.restore();
			OSApp.currentSession.controller = oldController;
			done( error );
		}
	} );

	it( "does not let a stale program mutation hide the next session loader", function( done ) {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldGeneration = OSApp.currentSession.generation,
			controller = { programs:{ pd:[ [] ] } },
			pending = $.Deferred(),
			page;

		try {
			OSApp.currentSession.controller = controller;
			OSApp.currentSession.generation = 30;
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).returns( true );
			sandbox.stub( OSApp.Firmware, "sendToOS" ).returns( pending.promise() );
			sandbox.stub( OSApp.Programs, "makeAllPrograms" ).returns(
				"<div><fieldset id='program-0'><button class='move-up'>Move</button></fieldset></div>"
			);
			sandbox.stub( OSApp.Programs, "updateProgramHeader" );
			sandbox.stub( OSApp.UIDom, "changeHeader" );
			var loading = sandbox.stub( $.mobile, "loading" );

			OSApp.Programs.displayPage();
			page = $( "#programs" );
			page.find( ".move-up" ).trigger( "click" );
			OSApp.currentSession.generation = 31;
			OSApp.currentSession.controller = {};
			pending.reject( { statusText:"abort" } );

			setTimeout( function() {
				try {
					assert.isFalse( loading.calledWith( "hide" ) );
					assert.isNull( OSApp.Programs.activeMutation );
					done();
				} catch ( error ) {
					done( error );
				} finally {
					if ( page ) page.remove();
					sandbox.restore();
					OSApp.currentSession.controller = oldController;
					OSApp.currentSession.generation = oldGeneration;
				}
			}, 10 );
		} catch ( error ) {
			if ( page ) page.remove();
			OSApp.Programs.activeMutation = null;
			sandbox.restore();
			OSApp.currentSession.controller = oldController;
			OSApp.currentSession.generation = oldGeneration;
			done( error );
		}
	} );

	it( "settles the station loader when an aborted request bypasses the shared failure handler", function( done ) {
		var sandbox = sinon.createSandbox(),
			loading = sandbox.stub( $.mobile, "loading" );
		sandbox.stub( OSApp.Firmware, "sendToOS" ).returns(
			$.Deferred().reject( { statusText:"abort" } ).promise()
		);

		OSApp.Stations.stopStations();
		setTimeout( function() {
			try {
				assert.isTrue( loading.calledWith( "show" ) );
				assert.isTrue( loading.calledWith( "hide" ) );
				done();
			} catch ( error ) {
				done( error );
			} finally {
				sandbox.restore();
			}
		}, 10 );
	} );

	it( "does not finish a delayed station stop after the controller session changes", function() {
		var sandbox = sinon.createSandbox(),
			clock = sandbox.useFakeTimers(),
			oldController = OSApp.currentSession.controller,
			oldGeneration = OSApp.currentSession.generation,
			controller = {},
			callback = sandbox.spy();

		try {
			OSApp.currentSession.controller = controller;
			OSApp.currentSession.generation = 40;
			sandbox.stub( OSApp.Firmware, "sendToOS" ).returns( $.Deferred().resolve().promise() );
			var loading = sandbox.stub( $.mobile, "loading" );

			OSApp.Stations.stopStations( callback );
			assert.isTrue( loading.calledWith( "show" ) );
			OSApp.currentSession.generation = 41;
			OSApp.currentSession.controller = {};
			clock.tick( 1000 );

			assert.isFalse( callback.called );
			assert.isFalse( loading.calledWith( "hide" ) );
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = oldController;
			OSApp.currentSession.generation = oldGeneration;
		}
	} );

	it( "locks program mutations before a second indexed action can be queued", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldGeneration = OSApp.currentSession.generation;

		try {
			OSApp.currentSession.controller = { programs:{ pd:[ [], [] ] } };
			OSApp.currentSession.generation = 50;
			sandbox.stub( OSApp.Programs, "pidToName" ).returns( "Program" );
			var confirm = sandbox.stub( OSApp.UIDom, "areYouSure" );

			assert.isTrue( OSApp.Programs.deleteProgram( 0 ) );
			assert.isFalse( OSApp.Programs.deleteProgram( 1 ) );
			assert.isTrue( confirm.calledOnce );
			confirm.firstCall.args[ 3 ]();
			assert.isNull( OSApp.Programs.activeMutation );
		} finally {
			OSApp.Programs.activeMutation = null;
			sandbox.restore();
			OSApp.currentSession.controller = oldController;
			OSApp.currentSession.generation = oldGeneration;
		}
	} );

	it( "falls back from a zero device clock and destroys replaced preview timelines", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldAndroid = OSApp.currentDevice.isAndroid,
			timelines = [],
			page;

		try {
			OSApp.currentSession.controller = {
				options: { mas:0, seq:0, sdt:0, tz:48, urs:0, uwt:0, wl:100 },
				settings: {
					devt:0, nbrd:1, rd:0, rdst:0, rs:0, wtrestr:0,
					wto:{}, wls:[], ps:new Array( 8 ).fill( [ 0, 0, 0, 0 ] )
				},
				stations: {
					snames:[ "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8" ],
					stn_dis:[ 0 ], stn_seq:[ 0 ], ignore_rain:[ 0 ], masop:[ 0 ]
				},
				programs: { pd:[ [ 1, 127, 0, [ 0, 0, 0, 0 ], [ 60, 0, 0, 0, 0, 0, 0, 0 ], "P1" ] ] },
				status:new Array( 8 ).fill( 0 )
			};
			OSApp.currentDevice.isAndroid = false;
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).callsFake( function( version ) {
				return version === 210;
			} );
			sandbox.stub( OSApp.UIDom, "changeHeader" );
			sandbox.stub( vis, "Timeline" ).callsFake( function() {
				var timeline = {
					setCurrentTime:sinon.spy(), setGroups:sinon.spy(), on:sinon.spy(),
					redraw:sinon.spy(), destroy:sinon.spy()
				};
				timelines.push( timeline );
				return timeline;
			} );

			OSApp.Programs.displayPagePreviewPrograms();
			page = $( "#preview" );
			assert.equal( page.find( "#preview_date" ).attr( "type" ), "text" );
			assert.equal( page.find( "#preview_date" ).attr( "placeholder" ), "MM/DD/YYYY" );
			assert.match( page.find( "#preview_date" ).val(), /^\d{2}\/\d{2}\/\d{4}$/ );
			page.triggerHandler( "pageshow" );
			assert.lengthOf( timelines, 1 );

			page.triggerHandler( "pageshow" );
			assert.lengthOf( timelines, 2 );
			assert.isTrue( timelines[ 0 ].destroy.calledOnce );
			$.mobile.window.triggerHandler( "resize" );
			assert.isFalse( timelines[ 0 ].redraw.called );
			assert.isTrue( timelines[ 1 ].redraw.calledOnce );

			page.triggerHandler( "pagehide" );
			assert.isTrue( timelines[ 1 ].destroy.calledOnce );
			$.mobile.window.triggerHandler( "resize" );
			assert.isTrue( timelines[ 1 ].redraw.calledOnce );
		} finally {
			if ( page ) page.remove();
			$.mobile.window.off( ".programPreview" );
			sandbox.restore();
			OSApp.currentDevice.isAndroid = oldAndroid;
			OSApp.currentSession.controller = oldController;
		}
	} );

	it( "includes prior-day stations and queued sequential runs that carry into the preview day", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldAndroid = OSApp.currentDevice.isAndroid,
			previewItems,
			page;

		try {
			OSApp.currentSession.controller = {
				options: {
					mas:0, mas2:0, seq:0, sdt:0, tz:48, urs:0, uwt:0, wl:100,
					mton:0, mtof:0, mton2:0, mtof2:0
				},
				settings: {
					devt:Date.UTC( 2024, 5, 10, 12 ) / 1000,
					nbrd:1, rd:0, rdst:0, rs:0, wtrestr:0, wto:{}, wls:[],
					ps:[ [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ]
				},
				stations: {
					snames:[ "S1", "S2" ], stn_dis:[ 0 ], stn_seq:[ 0 ], ignore_rain:[ 0 ],
					masop:[ 0 ], masop2:[ 0 ], stn_grp:[ 0, 0 ]
				},
				programs: {
					pd:[ [ 1, 64, 0, [ 23 * 60, 0, 0, 0 ], [ 3 * 3600, 2 * 3600 ], "Carry" ] ]
				},
				status:[ 0, 0 ]
			};
			OSApp.currentDevice.isAndroid = false;
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).callsFake( function( version ) {
				return version <= 216;
			} );
			sandbox.stub( OSApp.Weather, "getSunTimes" ).returns( [ 360, 1080 ] );
			sandbox.stub( OSApp.Stations, "getName" ).callsFake( function( sid ) {
				return OSApp.currentSession.controller.stations.snames[ sid ];
			} );
			sandbox.stub( OSApp.UIDom, "changeHeader" );
			sandbox.stub( vis, "Timeline" ).callsFake( function( element, items ) {
				previewItems = items.map( function( item ) { return Object.assign( {}, item ); } );
				return {
					setCurrentTime:sinon.spy(), setGroups:sinon.spy(), on:sinon.spy(),
					redraw:sinon.spy(), destroy:sinon.spy()
				};
			} );

			OSApp.Programs.displayPagePreviewPrograms();
			page = $( "#preview" );
			assert.equal( page.find( "#preview_date" ).val(), "06/10/2024" );
			page.triggerHandler( "pageshow" );

			var stationRuns = previewItems.filter( function( item ) {
				return item.pid === 0;
			} ).sort( function( left, right ) {
				return left.start - right.start;
			} );
			assert.lengthOf( stationRuns, 2 );
			assert.equal( stationRuns[ 0 ].group, "S1" );
			assert.equal( stationRuns[ 0 ].start.getTime(), Date.UTC( 2024, 5, 9, 23 ) );
			assert.equal( stationRuns[ 0 ].end.getTime(), Date.UTC( 2024, 5, 10, 2 ) );
			assert.equal( stationRuns[ 1 ].group, "S2" );
			assert.equal( stationRuns[ 1 ].start.getTime(), Date.UTC( 2024, 5, 10, 2 ) );
			assert.equal( stationRuns[ 1 ].end.getTime(), Date.UTC( 2024, 5, 10, 4 ) );
		} finally {
			if ( page ) {
				page.triggerHandler( "pagehide" );
				page.remove();
			}
			$.mobile.window.off( ".programPreview" );
			sandbox.restore();
			OSApp.currentDevice.isAndroid = oldAndroid;
			OSApp.currentSession.controller = oldController;
		}
	} );

	it( "uses 250-percent durations to warm a queue created more than two days before the preview day", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldAndroid = OSApp.currentDevice.isAndroid,
			program = [ 3, 16, 0, [ 23 * 60, 0, 0, 0 ], [ 20000, 20000, 20000, 20000 ], "Long carry" ],
			previewItems,
			page;

		try {
			assert.equal( OSApp.Programs.getPreviewWarmupDays( 4, [ program ], 0 ), 3 );
			assert.equal( OSApp.Programs.getPreviewWarmupDays(
				2040, [ [ 1, 1, 0, [ 0, 0, 0, 0 ], [ 65535 ], "Maximum" ] ], 99999
			), 154 );
			OSApp.currentSession.controller = {
				options: {
					mas:0, mas2:0, seq:0, sdt:0, tz:48, urs:0, uwt:0, wl:250,
					mton:0, mtof:0, mton2:0, mtof2:0
				},
				settings: {
					devt:Date.UTC( 2024, 5, 10, 12 ) / 1000,
					nbrd:1, rd:0, rdst:0, rs:0, wtrestr:0, wto:{}, wls:[],
					ps:new Array( 4 ).fill( [ 0, 0, 0, 0 ] )
				},
				stations: {
					snames:[ "S1", "S2", "S3", "S4" ], stn_dis:[ 0 ], stn_seq:[ 0 ], ignore_rain:[ 0 ],
					masop:[ 0 ], masop2:[ 0 ], stn_grp:[ 0, 0, 0, 0 ]
				},
				programs:{ pd:[ program ] },
				status:[ 0, 0, 0, 0 ]
			};
			OSApp.currentDevice.isAndroid = false;
			sandbox.stub( OSApp.Firmware, "checkOSVersion" ).callsFake( function( version ) {
				return version <= 216;
			} );
			sandbox.stub( OSApp.Weather, "getSunTimes" ).returns( [ 360, 1080 ] );
			sandbox.stub( OSApp.Stations, "getName" ).callsFake( function( sid ) {
				return OSApp.currentSession.controller.stations.snames[ sid ];
			} );
			sandbox.stub( OSApp.UIDom, "changeHeader" );
			sandbox.stub( vis, "Timeline" ).callsFake( function( element, items ) {
				previewItems = items.map( function( item ) { return Object.assign( {}, item ); } );
				return {
					setCurrentTime:sinon.spy(), setGroups:sinon.spy(), on:sinon.spy(),
					redraw:sinon.spy(), destroy:sinon.spy()
				};
			} );

			OSApp.Programs.displayPagePreviewPrograms();
			page = $( "#preview" );
			page.triggerHandler( "pageshow" );

			var stationRuns = previewItems.filter( function( item ) {
				return item.pid === 0;
			} ).sort( function( left, right ) {
				return left.start - right.start;
			} );
			assert.lengthOf( stationRuns, 1 );
			assert.equal( stationRuns[ 0 ].group, "S4" );
			assert.equal( stationRuns[ 0 ].start.getTime(), Date.UTC( 2024, 5, 9, 16, 40 ) );
			assert.equal( stationRuns[ 0 ].end.getTime(), Date.UTC( 2024, 5, 10, 6, 33, 20 ) );
		} finally {
			if ( page ) {
				page.triggerHandler( "pagehide" );
				page.remove();
			}
			$.mobile.window.off( ".programPreview" );
			sandbox.restore();
			OSApp.currentDevice.isAndroid = oldAndroid;
			OSApp.currentSession.controller = oldController;
		}
	} );

	it( "scopes dashboard refresh handlers and renders persisted station notes as text", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldWeather = OSApp.currentSession.weather,
			oldLocal = OSApp.currentSession.local,
			selector = $( "#site-selector" ),
			originalSelector = selector.html(),
			page,
			note = "</textarea><img class='note-injection' src=x onerror='note-secret'><textarea>";

		try {
			selector.html( "<option value='Local' selected>Local</option>" );
			OSApp.currentSession.controller = {
				options:{ fwv:207, wl:100, mas:0 },
				settings:{ devt:1717939200, dname:"Test", nbrd:1, ps:[ [ 0, 0, 0 ] ] },
				stations:{ snames:[ "S1" ], stn_spe:[ 1 ] }, status:[ 0 ], special:{ 0:null }
			};
			OSApp.currentSession.weather = {};
			OSApp.currentSession.local = true;
			sandbox.stub( OSApp.currentSession, "isControllerConnected" ).returns( true );
			var storageGet = sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
				callback( { sites:"{}" } );
			} );
			sandbox.stub( OSApp.Sites, "parseSites" ).returns( {
				Local:{ images:{}, notes:{ 0:note }, lastRunTime:{} }
			} );
			sandbox.stub( OSApp.Sites, "updateControllerStationSpecial" ).callsFake( function( callback ) {
				callback();
				return $.Deferred().resolve().promise();
			} );
			sandbox.stub( OSApp.Analog, "updateSensorShowArea" );

			OSApp.Dashboard.displayPage();
			page = $( "#sprinklers" );
			assert.equal( storageGet.callCount, 1 );
			page.addClass( "ui-page-active" );
			page.triggerHandler( "pageshow" );
			$( "html" ).triggerHandler( "datarefresh" );
			assert.equal( storageGet.callCount, 2 );

			page.removeClass( "ui-page-active" ).triggerHandler( "pagehide" );
			$( "html" ).triggerHandler( "datarefresh" );
			assert.equal( storageGet.callCount, 2 );

			page.addClass( "ui-page-active" ).triggerHandler( "pageshow" );
			$( "html" ).triggerHandler( "datarefresh" );
			assert.equal( storageGet.callCount, 3 );

			page.find( ".station-settings" ).trigger( "click" );
			assert.equal( $( "#stn_attrib" ).find( ".note-injection" ).length, 0 );
			assert.equal( $( "#stn_attrib #stn-notes" ).val(), note );
		} finally {
			$( "html" ).off( ".dashboard" );
			$( "#stn_attrib" ).remove();
			if ( page ) page.remove();
			selector.html( originalSelector );
			sandbox.restore();
			OSApp.currentSession.controller = oldController;
			OSApp.currentSession.weather = oldWeather;
			OSApp.currentSession.local = oldLocal;
		}
	} );

	it( "abandons remote-station verification when its popup session becomes stale", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldGeneration = OSApp.currentSession.generation,
			oldWeather = OSApp.currentSession.weather,
			oldLocal = OSApp.currentSession.local,
			selector = $( "#site-selector" ),
			originalSelector = selector.html(),
			request = { abort: sandbox.spy() },
			verifyCallback,
			page;

		try {
			selector.html( "<option value='Local' selected>Local</option>" );
			OSApp.currentSession.generation = 60;
			OSApp.currentSession.controller = {
				options:{ fwv:207, wl:100, mas:0 },
				settings:{ devt:1717939200, dname:"Test", nbrd:1, ps:[ [ 0, 0, 0 ] ] },
				stations:{ snames:[ "S1" ], stn_spe:[ 1 ] }, status:[ 0 ], special:{ 0:null }
			};
			OSApp.currentSession.weather = {};
			OSApp.currentSession.local = true;
			sandbox.stub( OSApp.currentSession, "isControllerConnected" ).returns( true );
			sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
				callback( { sites:"{}" } );
			} );
			sandbox.stub( OSApp.Sites, "parseSites" ).returns( {
				Local:{ images:{}, notes:{}, lastRunTime:{} }
			} );
			sandbox.stub( OSApp.Sites, "updateControllerStationSpecial" ).callsFake( function( callback ) {
				callback();
				return $.Deferred().resolve().promise();
			} );
			sandbox.stub( OSApp.Analog, "updateSensorShowArea" );
			sandbox.stub( OSApp.Stations, "verifyRemoteStation" ).callsFake( function( data, callback ) {
				verifyCallback = callback;
				return request;
			} );
			var sendToOS = sandbox.stub( OSApp.Firmware, "sendToOS" ),
				loading = sandbox.stub( $.mobile, "loading" );

			OSApp.Dashboard.displayPage();
			page = $( "#sprinklers" );
			page.find( ".station-settings" ).trigger( "click" );
			var popup = $( "#stn_attrib" );
			popup.find( "#hs" ).val( "2" ).trigger( "change" );
			popup.find( "#remote-address" ).val( "192.0.2.10" );
			popup.find( "#remote-port" ).val( "80" );
			popup.find( "#remote-station" ).val( "1" );
			popup.find( "form" ).trigger( "submit" );

			assert.isFunction( verifyCallback );
			assert.isTrue( loading.calledWith( "show" ) );
			OSApp.currentSession.generation = 61;
			OSApp.currentSession.controller = {};
			var hideCount = loading.withArgs( "hide" ).callCount;
			page.triggerHandler( "pagehide" );
			verifyCallback( true );

			assert.isTrue( request.abort.calledOnce );
			assert.equal( loading.withArgs( "hide" ).callCount, hideCount );
			assert.isFalse( sendToOS.called );
		} finally {
			$( "#stn_attrib" ).remove();
			if ( page ) page.remove();
			selector.html( originalSelector );
			sandbox.restore();
			OSApp.currentSession.controller = oldController;
			OSApp.currentSession.generation = oldGeneration;
			OSApp.currentSession.weather = oldWeather;
			OSApp.currentSession.local = oldLocal;
		}
	} );

	it( "hosts the Cordova map on HTTPS so the public client key can be referrer-restricted", function() {
		var cordova = window.cordova;
		try {
			window.cordova = {};
			assert.equal( OSApp.Options.mapFrameURL(), "https://ui.opensprinkler.com/map.html" );
		} finally {
			window.cordova = cordova;
		}
	} );

	it( "uses a wildcard target only for opaque map origins", function() {
		assert.equal( OSApp.Options.normalizeMapOrigin( "null" ), "*" );
		assert.equal( OSApp.Options.normalizeMapOrigin( "https://example.test" ), "https://example.test" );
	} );

	it( "removes the notification represented by the clicked item", function() {
		var original = OSApp.uiState.notifications,
			oldest = { title: "Old" },
			newest = { title: "New" },
			list = $( "<ul><li data-role='list-divider'></li></ul>" );

		OSApp.uiState.notifications = [ oldest, newest ];
		list.append( OSApp.Notifications.createNotificationItem( newest ) );
		list.append( OSApp.Notifications.createNotificationItem( oldest ) );
		OSApp.Notifications.removeNotification( list.children().eq( 1 ) );

		assert.deepEqual( OSApp.uiState.notifications, [ oldest ] );
		OSApp.uiState.notifications = original;
	} );

	it( "renders notification content as text", function() {
		var item = OSApp.Notifications.createNotificationItem( {
			title: "<img src=x onerror=alert(1)>",
			desc: "<b>description</b>"
		} );

		assert.equal( item.find( "img" ).length, 0 );
		assert.equal( item.find( "h2" ).text(), "<img src=x onerror=alert(1)>" );
		assert.equal( item.find( "p" ).text(), "<b>description</b>" );
	} );

	it( "renders firmware release metadata as text and allowlists only HTTPS GitHub changelogs", function() {
		var originalController = OSApp.currentSession.controller,
			releasePayload = "<img src=x onerror='release-secret'>",
			forkPayload = "<svg onload='fork-secret'>",
			validUrl = "https://github.com/OpenSprinkler/OpenSprinkler-Firmware/releases/tag/2.2.1",
			popup;

		OSApp.currentSession.controller = {
			options: { fwv: 221, fwm: 4, fwf: forkPayload }
		};
		try {
			popup = OSApp.Firmware.createFirmwareUpdatePopup( {
				name: releasePayload,
				html_url: validUrl
			}, true );

			assert.equal( popup.find( "img,svg" ).length, 0 );
			assert.include( popup.find( "h3" ).text(), releasePayload );
			assert.include( popup.find( "h5" ).text(), forkPayload );
			assert.equal( popup.find( ".changelog" ).attr( "href" ), validUrl );
			assert.equal( popup.find( ".changelog" ).attr( "rel" ), "noopener noreferrer" );

			[
				"javascript:alert(1)",
				"http://github.com/OpenSprinkler/OpenSprinkler-Firmware/releases",
				"https://github.com.evil.example/releases",
				"https://user:password@github.com/OpenSprinkler/OpenSprinkler-Firmware/releases"
			].forEach( function( candidate ) {
				var unsafe = OSApp.Firmware.createFirmwareUpdatePopup( { name: "release", html_url: candidate }, false );
				assert.equal( unsafe.find( ".changelog" ).length, 0, candidate );
			} );
		} finally {
			OSApp.currentSession.controller = originalController;
		}
	} );

	it( "keeps controller integration settings inside their form attributes", function() {
		var originalController = OSApp.currentSession.controller,
			attributePayload = "' autofocus onfocus='attribute-secret",
			doubleQuotePayload = "\" autofocus onfocus=\"name-secret",
			mqtt = {
				en: 1, host: attributePayload, port: 1883, user: attributePayload,
				pass: attributePayload, pubt: attributePayload, subt: attributePayload
			},
			email = {
				en: 1, host: attributePayload, port: 465, user: attributePayload,
				pass: attributePayload, recipient: attributePayload
			},
			otc = { en: 1, token: attributePayload, server: attributePayload, port: 443 },
			wto = {
				provider: "Apple", key: attributePayload, cali: attributePayload,
				rainAmt: attributePayload, rainDays: attributePayload, minTemp: attributePayload
			},
			changeHeader = sinon.stub( OSApp.UIDom, "changeHeader" ).returns( $( "<button></button><h3></h3><button></button>" ) ),
			groups = sinon.stub( OSApp.Supported, "groups" ).returns( false ),
			popups = [],
			openPopup = sinon.stub( OSApp.UIDom, "openPopup" ).callsFake( function( popup ) { popups.push( popup ); } ),
			page;

		OSApp.currentSession.controller = {
			options: { fwv: 221, fwm: 4, hwv: 30, ife: 0, ntp: 0, uwt: 0 },
			programs: {},
			settings: {
				loc: { malformed: attributePayload }, devt: attributePayload,
				ifkey: attributePayload, dname: doubleQuotePayload,
				mqtt: mqtt, email: email, otc: otc, wto: wto
			},
			stations: { snames: [] },
			status: []
		};
		try {
			$( "#os-options" ).remove();
			OSApp.Options.showOptions( "integrations" );
			page = $( "#os-options" );

			assert.equal( page.find( "[onfocus], [onerror]" ).length, 0 );
			assert.equal( page.find( "#mqtt" ).val(), OSApp.Utils.escapeJSON( mqtt ) );
			assert.equal( page.find( "#email" ).val(), OSApp.Utils.escapeJSON( email ) );
			assert.equal( page.find( "#otc" ).val(), OSApp.Utils.escapeJSON( otc ) );
			assert.equal( page.find( "#ifkey" ).val(), attributePayload );
			assert.equal( page.find( "#dname" ).val(), doubleQuotePayload );
			assert.equal( page.find( "#datetime" ).length, 0 );
			assert.equal( page.find( "#loc" ).val(), OSApp.Language._( "Not specified" ) );
			assert.equal( page.find( "#wtkey" ).val(), attributePayload );
			assert.equal( page.find( "#wto" ).val(), OSApp.Utils.escapeJSON( wto ) );

			page.find( "#mqtt" ).trigger( "click" );
			page.find( "#email" ).trigger( "click" );
			page.find( "#otc" ).trigger( "click" );
			page.find( "#weatherRestriction" ).trigger( "click" );
			assert.lengthOf( popups, 4 );
			popups.forEach( function( integrationPopup ) {
				assert.equal( integrationPopup.find( "[onfocus], [onerror]" ).length, 0 );
			} );
			assert.equal( popups[ 0 ].find( "#server" ).val(), attributePayload );
			assert.equal( popups[ 0 ].find( "#username" ).val(), attributePayload );
			assert.equal( popups[ 0 ].find( "#password" ).val(), attributePayload );
			assert.equal( popups[ 0 ].find( "#pubt" ).val(), attributePayload );
			assert.equal( popups[ 0 ].find( "#subt" ).val(), attributePayload );
			assert.equal( popups[ 1 ].find( "#server" ).val(), attributePayload );
			assert.equal( popups[ 1 ].find( "#username" ).val(), attributePayload );
			assert.equal( popups[ 1 ].find( "#password" ).val(), attributePayload );
			assert.equal( popups[ 1 ].find( "#recipient" ).val(), attributePayload );
			assert.equal( popups[ 2 ].find( "#token" ).val(), attributePayload );
			assert.equal( popups[ 2 ].find( "#server" ).val(), attributePayload );
			assert.match( popups[ 3 ].find( "#rainAmt" ).val(), /^0 (?:in|mm)$/ );
			assert.equal( popups[ 3 ].find( "#rainDays" ).val(), "0 days" );
			assert.match( popups[ 3 ].find( "#minTemp" ).val(), /^-40 °[FC]$/ );
		} finally {
			$( "#os-options" ).remove();
			openPopup.restore();
			groups.restore();
			changeHeader.restore();
			OSApp.currentSession.controller = originalController;
		}
	} );

	it( "keeps an unset manual clock editable and sends time only after an explicit edit", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			original24Hour = OSApp.uiState.is24Hour,
			pending = $.Deferred(),
			submitOptions,
			seedTimestamp,
			page;

		try {
			OSApp.uiState.is24Hour = false;
			OSApp.currentSession.controller = {
				options:{
					fwv:221, fwm:4, hwv:30, ife:0, ntp:0, uwt:0, tz:24,
					ntp1:192, ntp2:0, ntp3:2, ntp4:1
				},
				programs:{},
				settings:{ loc:"", devt:0 },
				stations:{ snames:[] },
				status:[]
			};
			sandbox.stub( OSApp.Supported, "groups" ).returns( false );
			sandbox.stub( OSApp.UIDom, "changeHeader" ).callsFake( function( options ) {
				submitOptions = options.rightBtn.on;
				return $( "<button></button><h3></h3><button></button>" );
			} );
			sandbox.stub( OSApp.Dates, "currentControllerDate" ).returns(
				new Date( Date.UTC( 2024, 5, 9, 8, 15 ) )
			);
			sandbox.stub( OSApp.UIDom, "showDateTimeInput" ).callsFake( function( timestamp, callback ) {
				seedTimestamp = timestamp;
				callback( new Date( Date.UTC( 2024, 5, 9, 9, 30 ) ) );
			} );
			var sendToOS = sandbox.stub( OSApp.Firmware, "sendToOS" ).returns( pending.promise() );

			OSApp.Options.showOptions( "system" );
			page = $( "#os-options" );
			var datetime = page.find( "#datetime" );
			assert.lengthOf( datetime, 1 );
			assert.isFalse( datetime.prop( "disabled" ) );
			assert.equal( datetime.text(), "--" );
			assert.lengthOf( page.find( "#o1 option" ), 109 );
			assert.equal( page.find( "#o1" ).val(), "-06:00" );

			submitOptions();
			assert.notMatch( sendToOS.firstCall.args[ 0 ], /[?&](?:ttt|tyy|tmm|tdd|thh|tmi)=/ );
			page.triggerHandler( "pagehide" );

			OSApp.Options.showOptions( "system" );
			page = $( "#os-options" );
			page.find( ".datetime-input" ).triggerHandler( "click" );
			assert.equal( seedTimestamp, Date.UTC( 2024, 5, 9, 8, 15 ) / 1000 );
			assert.equal( page.find( "#datetime" ).text(), "06/09/2024 9:30 AM" );
			submitOptions();

			var request = sendToOS.secondCall.args[ 0 ],
				wallEpoch = Date.UTC( 2024, 5, 9, 9, 30 ) / 1000;
			assert.include( request, "ttt=" + ( wallEpoch + 6 * 60 * 60 ) );
			assert.include( request, "tyy=2024" );
			assert.include( request, "tmm=5" );
			assert.include( request, "tdd=9" );
			assert.include( request, "thh=9" );
			assert.include( request, "tmi=30" );
			page.triggerHandler( "pagehide" );

			OSApp.currentSession.controller.options.fwv = 212;
			OSApp.currentSession.controller.options.fwm = 0;
			OSApp.Options.showOptions( "system" );
			page = $( "#os-options" );
			page.find( ".datetime-input" ).triggerHandler( "click" );
			submitOptions();

			request = sendToOS.thirdCall.args[ 0 ];
			assert.include( request, "ttt=" + wallEpoch );
			assert.include( request, "tyy=2024" );
			assert.include( request, "tmm=5" );
			assert.include( request, "tdd=9" );
			assert.include( request, "thh=9" );
			assert.include( request, "tmi=30" );
			page.triggerHandler( "pagehide" );

			OSApp.currentSession.controller.options.fwv = 221;
			OSApp.currentSession.controller.options.fwm = 4;
			OSApp.currentSession.controller.settings.loc = "37.5,-122.3";
			OSApp.Options.showOptions( "system" );
			page = $( "#os-options" );
			assert.isTrue( page.find( "#o1" ).prop( "disabled" ) );
			submitOptions();
			assert.notMatch( sendToOS.getCall( 3 ).args[ 0 ], /[?&](?:tz|o1)=/ );
		} finally {
			if ( page ) page.triggerHandler( "pagehide" );
			$( "#os-options" ).remove();
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
			OSApp.uiState.is24Hour = original24Hour;
		}
	} );

	it( "rejects hostile diagnostic weather values and coerces finite numeric strings", function() {
		var originalController = OSApp.currentSession.controller,
			payload = "<img src=x onerror='diagnostic-secret'>",
			popup,
			openPopup = sinon.stub( OSApp.UIDom, "openPopup" ).callsFake( function( value ) { popup = value; } );

		try {
			OSApp.currentSession.controller = {
				options: { uwt: 0, wl: payload },
				settings: { wls: [ 100, payload ], wtdata: null }
			};
			assert.doesNotThrow( function() { OSApp.SystemDiagnostics.showDiagnostics(); } );
			assert.notInclude( popup.text(), "Mean Radiation" );
			OSApp.currentSession.controller.options.uwt = 99;
			assert.doesNotThrow( function() { OSApp.SystemDiagnostics.showDiagnostics(); } );
			assert.include( popup.text(), OSApp.Language._( "Unknown" ) );

			OSApp.currentSession.controller.settings.wtdata = { radiation: payload };
			OSApp.SystemDiagnostics.showDiagnostics();
			var labels = popup.find( "td:first-child" ).map( function() { return $( this ).text(); } ).get();
			assert.equal( popup.find( "img" ).length, 0 );
			assert.notInclude( popup.text(), payload );
			assert.notInclude( labels, "Watering Level" );
			assert.notInclude( labels, "Multi-Day Levels" );
			assert.notInclude( labels, "Mean Radiation" );

			OSApp.currentSession.controller.options.wl = "75";
			OSApp.currentSession.controller.settings.wls = [ "100", "80" ];
			OSApp.currentSession.controller.settings.wtdata.radiation = "4.25";
			OSApp.SystemDiagnostics.showDiagnostics();
			assert.include( popup.text(), "75 %" );
			assert.include( popup.text(), "1-day rolling average" );
			assert.include( popup.text(), "2-day rolling average" );
			assert.include( popup.text(), "80% makes them 20% shorter" );
			assert.include( popup.text(), "longest average available" );
			assert.notInclude( popup.text(), "[100, 80]" );
			assert.include( popup.text(), "4.25 kWh/m2" );

			OSApp.currentSession.controller.settings.wls = [];
			OSApp.SystemDiagnostics.showDiagnostics();
			assert.include( popup.text(), "No multi-day averages are available" );

			OSApp.currentSession.controller.settings.wls = [ 100, 80.5 ];
			OSApp.SystemDiagnostics.showDiagnostics();
			labels = popup.find( "td:first-child" ).map( function() { return $( this ).text(); } ).get();
			assert.notInclude( labels, "Multi-Day Levels" );
		} finally {
			openPopup.restore();
			OSApp.currentSession.controller = originalController;
		}
	} );

	it( "omits malformed controller current and renders finite current as text", function() {
		var originalController = OSApp.currentSession.controller,
			connected = sinon.stub( OSApp.currentSession, "isControllerConnected" ).returns( true ),
			footer = $( "#footer-running" ),
			originalHtml = footer.html(),
			originalClass = footer.attr( "class" ),
			payload = "<img src=x onerror='current-secret'>";

		try {
			OSApp.currentSession.controller = { options: {}, settings: { curr: payload } };
			OSApp.Status.changeStatus( 0, "transparent", "<p>Idle</p>" );
			assert.equal( footer.find( "img" ).length, 0 );
			assert.notInclude( footer.text(), payload );

			OSApp.currentSession.controller.settings.curr = "12.5";
			OSApp.Status.changeStatus( 0, "transparent", "<p>Idle</p>" );
			assert.include( footer.text(), "Current: 12.5 mA" );
		} finally {
			footer.attr( "class", originalClass || "" ).html( originalHtml );
			connected.restore();
			OSApp.currentSession.controller = originalController;
		}
	} );

	it( "returns controller refresh promises for both firmware paths", function() {
		var connected = sinon.stub( OSApp.currentSession, "isControllerConnected" ).returns( true ),
			version = sinon.stub( OSApp.Firmware, "checkOSVersion" ),
			modernPromise = $.Deferred().promise(),
			modern = sinon.stub( OSApp.Sites, "updateController" ).returns( modernPromise ),
			pending = $.Deferred(),
			legacyMethods = [
				"updateControllerStatus", "updateControllerSettings", "updateControllerOptions"
			],
			legacyStubs = [],
			modernRestored = false;

		try {
			version.returns( true );
			assert.strictEqual( OSApp.Status.refreshStatus(), modernPromise );
			modern.restore();
			modernRestored = true;

			version.returns( false );
			legacyMethods.forEach( function( method ) {
				legacyStubs.push( sinon.stub( OSApp.Sites, method ).returns( pending.promise() ) );
			} );
			assert.isFunction( OSApp.Status.refreshStatus().then );
		} finally {
			legacyStubs.forEach( function( stub ) { stub.restore(); } );
			if ( !modernRestored ) {
				modern.restore();
			}
			version.restore();
			connected.restore();
		}
	} );

	it( "serializes periodic refreshes and stops scheduling on teardown", function() {
		var clock = sinon.useFakeTimers(),
			first = $.Deferred(),
			second = $.Deferred(),
			refresh = sinon.stub();

		refresh.onFirstCall().returns( first.promise() );
		refresh.onSecondCall().returns( second.promise() );
		try {
			var stop = OSApp.UIDom.startSerialRefresh( refresh, 4000 );
			clock.tick( 4000 );
			assert.equal( refresh.callCount, 1 );

			clock.tick( 40000 );
			assert.equal( refresh.callCount, 1, "an in-flight request must suppress later refreshes" );

			first.resolve();
			clock.tick( 3999 );
			assert.equal( refresh.callCount, 1 );
			clock.tick( 1 );
			assert.equal( refresh.callCount, 2 );

			stop();
			second.resolve();
			clock.tick( 40000 );
			assert.equal( refresh.callCount, 2, "teardown must prevent rescheduling" );
		} finally {
			clock.restore();
		}
	} );

	it( "omits malformed overcurrent station values", function() {
		var originalController = OSApp.currentSession.controller,
			connected = sinon.stub( OSApp.currentSession, "isControllerConnected" ).returns( true ),
			changeStatus = sinon.stub( OSApp.Status, "changeStatus" ),
			payload = "<img src=x onerror='overcurrent-secret'>";

		OSApp.currentSession.controller = {
			options: { re: 0 },
			settings: {
				en: 1, pq: 0, ps: [], ocs: payload, rd: 0, sn1: 0, sn2: 0, mm: 0,
				lrun: [ 0, 0, 0, 0 ]
			},
			stations: { snames: [] },
			status: []
		};
		try {
			OSApp.Status.checkStatus();
			assert.isFalse( changeStatus.calledWithMatch( 0, "red" ) );
			assert.notInclude( JSON.stringify( changeStatus.args ), payload );

			changeStatus.resetHistory();
			OSApp.currentSession.controller.settings.ocs = "3";
			OSApp.Status.checkStatus();
			assert.isTrue( changeStatus.calledWithMatch( 0, "red", sinon.match( "when opening Station 3" ) ) );
		} finally {
			changeStatus.restore();
			connected.restore();
			OSApp.currentSession.controller = originalController;
		}
	} );

	it( "renders only finite dashboard watering levels", function() {
		var container = $( "<div>" ),
			payload = "<img src=x onerror='water-level-secret'>";

		OSApp.Dashboard.renderWaterLevel( container, payload );
		assert.equal( container.find( "img" ).length, 0 );
		assert.equal( container.text(), "Water Level: --" );

		OSApp.Dashboard.renderWaterLevel( container, "75.5" );
		assert.equal( container.text(), "Water Level: 75.5%" );
	} );

	it( "allows only bounded base64 station images", function() {
		var placeholder = "/img/placeholder.png",
			valid = "/9j/AA==",
			payload = "x' onerror='station-image-secret";

		assert.equal( OSApp.Dashboard.getStationImageSource( valid, placeholder ), "data:image/jpeg;base64," + valid );
		assert.equal( OSApp.Dashboard.getStationImageSource( payload, placeholder ), placeholder );
		assert.equal( OSApp.Dashboard.getStationImageSource(
			"A".repeat( OSApp.Dashboard.MAX_STATION_IMAGE_BASE64_LENGTH + 1 ), placeholder
		), placeholder );
	} );

	it( "rejects group IDs outside the firmware allowlist before rendering", function() {
		var originalController = OSApp.currentSession.controller,
			groups = sinon.stub( OSApp.Supported, "groups" ).returns( true ),
			payload = "'><img src=x onerror='gid-secret'>",
			card;

		try {
			assert.equal( OSApp.Groups.normalizeGIDValue( "0" ), 0 );
			assert.equal( OSApp.Groups.normalizeGIDValue( 3 ), 3 );
			assert.equal( OSApp.Groups.normalizeGIDValue( 254 ), 254 );
			assert.equal( OSApp.Groups.normalizeGIDValue( 255 ), 255 );
			[ payload, -1, 4, 256, 1.5, "" ].forEach( function( gid ) {
				assert.isUndefined( OSApp.Groups.normalizeGIDValue( gid ), String( gid ) );
				assert.equal( OSApp.Groups.mapGIDValueToName( gid ), "", String( gid ) );
			} );

			OSApp.currentSession.controller = { settings: { ps: [ [ 0, 0, 0, payload ] ] } };
			assert.isUndefined( OSApp.Stations.getGIDValue( 0 ) );

			card = $( "<div><div><span></span><span class='station-settings'></span></div></div>" );
			card.find( ".station-settings" ).attr( "data-gid", payload );
			assert.isUndefined( OSApp.Cards.getGIDValue( card ) );
		} finally {
			groups.restore();
			OSApp.currentSession.controller = originalController;
		}
	} );

	it( "does not log corrupted payload or session secrets", function() {
		var payloadSecret = "controller-payload-secret-4c7f",
			sessionSecret = "controller-password-secret-9a2e",
			siteSecret = "controller-site-secret-31bd",
			storage = sinon.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
				callback( { current_site: siteSecret } );
			} ),
			log = sinon.spy( console, "log" ),
			modal;

		try {
			OSApp.Errors.showCorruptedJsonModal( { response: payloadSecret }, { pass: sessionSecret } );
			modal = document.querySelectorAll( ".corrupted-site-name" );
			modal = modal[ modal.length - 1 ];
			var logged = JSON.stringify( log.getCalls().map( function( call ) { return call.args; } ) );
			assert.notInclude( logged, payloadSecret );
			assert.notInclude( logged, sessionSecret );
			assert.notInclude( logged, siteSecret );
		} finally {
			if ( modal ) {
				modal.parentNode.parentNode.parentNode.remove();
			}
			log.restore();
			storage.restore();
		}
	} );

	it( "keeps hold timers independent for each button", function() {
		var clock = sinon.useFakeTimers(),
			originalTouch = OSApp.currentDevice.isTouchCapable,
			buttons = $( "<button id='one'></button><button id='two'></button>" ),
			calls = [];

		OSApp.currentDevice.isTouchCapable = true;
		OSApp.UIDom.holdButton( buttons, function() {
			calls.push( this.id );
		} );
		buttons.eq( 0 ).trigger( "taphold" );
		buttons.eq( 1 ).trigger( "taphold" );
		buttons.eq( 0 ).trigger( "vmouseup" );
		clock.tick( 250 );

		assert.deepEqual( calls, [ "two", "two" ] );
		buttons.eq( 1 ).trigger( "vmouseup" );
		OSApp.currentDevice.isTouchCapable = originalTouch;
		clock.restore();
	} );

	it( "stops a hold timer when its button is removed before release", function() {
		var clock = sinon.useFakeTimers(),
			originalTouch = OSApp.currentDevice.isTouchCapable,
			button = $( "<button></button>" ).appendTo( document.body ),
			callback = sinon.spy();

		try {
			OSApp.currentDevice.isTouchCapable = true;
			OSApp.UIDom.holdButton( button, callback );
			button.trigger( "taphold" );
			button.remove();
			clock.tick( 1000 );
			assert.isFalse( callback.called );
		} finally {
			OSApp.currentDevice.isTouchCapable = originalTouch;
			clock.restore();
		}
	} );

	it( "preserves controller transport rejection", function( done ) {
		var ajaxq = sinon.stub( $, "ajaxq" ).returns( $.Deferred().reject( {
			status: 500,
			statusText: "error"
		} ).promise() );

		OSApp.Firmware.sendToOS( "/jl?pw=", "json" ).done( function() {
			ajaxq.restore();
			done( new Error( "request unexpectedly resolved" ) );
		} ).fail( function( error ) {
			assert.equal( error.status, 500 );
			ajaxq.restore();
			done();
		} );
	} );

	it( "selects one hash-only attempt when modern authentication fails", function() {
		var attempts = [],
			result;

		OSApp.Firmware.verifyPassword( 221, "modern-secret", md5, function( password, callback ) {
			attempts.push( password );
			callback( false );
		}, function( auth ) {
			result = auth;
		} );

		assert.deepEqual( attempts, [ md5( "modern-secret" ) ] );
		assert.notInclude( attempts[ 0 ], "modern-secret" );
		assert.strictEqual( result, false );
	} );

	it( "accepts only the two integer password-success response codes", function() {
		assert.isTrue( OSApp.Firmware.isValidPasswordResult( { result:0 } ) );
		assert.isTrue( OSApp.Firmware.isValidPasswordResult( { result:1 } ) );
		[ null, false, "", [], {}, { result:"0" }, { result:-1 }, { result:0.5 },
			{ result:2 }, { result:32 } ].forEach( function( response ) {
			assert.isFalse( OSApp.Firmware.isValidPasswordResult( response ) );
		} );
	} );

	it( "requires operator approval before incorrect-password correction uses cleartext", function() {
		var attempts = [],
			discoveryAttempts = [],
			results = [],
			check = sinon.stub( OSApp.Network, "checkPW" ).callsFake( function( password, callback ) {
				attempts.push( password );
				callback( false );
			} ),
			checkOptions = sinon.stub( OSApp.Network, "checkOptionsPW" ).callsFake( function( password, callback ) {
				discoveryAttempts.push( password );
				callback( { fwv:212 } );
			} );

		try {
			OSApp.Network.verifySitePassword( { fwv: 221 }, "modern-secret", function( auth ) {
				results.push( auth );
			} );
			OSApp.Network.verifySitePassword( {}, "unknown-secret", function( auth ) {
				results.push( auth );
			} );
			OSApp.Network.verifySitePassword( { fwv: 212 }, "legacy-secret", function( auth ) {
				results.push( auth );
			} );
			OSApp.Network.verifySitePassword( { fwv: 212, legacyAuth: true }, "approved-secret", function( auth ) {
				results.push( auth );
			} );
			OSApp.Network.verifySitePassword( { legacyAuth: true }, "approved-unknown-secret", function( auth ) {
				results.push( auth );
			} );

			assert.deepEqual( attempts, [ md5( "modern-secret" ), "approved-secret", "approved-unknown-secret" ] );
			assert.deepEqual( discoveryAttempts, [ md5( "unknown-secret" ), md5( "legacy-secret" ) ] );
			assert.notInclude( discoveryAttempts, "legacy-secret" );
			assert.deepEqual( results, [ false, false, false, false, false ] );
		} finally {
			check.restore();
			checkOptions.restore();
		}
	} );

	it( "hashes a modern edited password even when the old saved value is empty", function() {
		var modern = OSApp.Sites.prepareSitePassword( { fwv: 221, isHashed: true, os_pw: "" }, "new-secret" ),
			unapprovedLegacy = OSApp.Sites.prepareSitePassword( { fwv: 212, isHashed: false, os_pw: "" }, "legacy-secret" ),
			legacy = OSApp.Sites.prepareSitePassword( { fwv: 212, legacyAuth: true, isHashed: false, os_pw: "" }, "legacy-secret" );

		assert.equal( modern.password, md5( "new-secret" ) );
		assert.isTrue( modern.isHashed );
		assert.equal( unapprovedLegacy.password, md5( "legacy-secret" ) );
		assert.isTrue( unapprovedLegacy.isHashed );
		assert.equal( legacy.password, "legacy-secret" );
		assert.isFalse( legacy.isHashed );
		assert.equal( OSApp.Sites.prepareSitePassword( { legacyAuth:true }, "unknown-legacy-secret" ).password,
			"unknown-legacy-secret" );
		assert.equal( OSApp.Sites.prepareStoredSitePassword( {
			legacyAuth:true, os_pw:"stored-unknown-legacy-secret"
		} ).password, "stored-unknown-legacy-secret" );
	} );

	it( "replaces a verified modern raw password in storage with its session hash", function() {
		var oldController = OSApp.currentSession.controller,
			oldPass = OSApp.currentSession.pass,
			saved, storedSites = {
				Home:{ os_ip:"controller.test", os_pw:"raw-secret", fwv:221, isHashed:false }
			},
			storageGet = sinon.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
				callback( { sites:JSON.stringify( storedSites ), current_site:Object.keys( storedSites )[ 0 ] } );
			} ),
			storageSet = sinon.stub( OSApp.Storage, "set" ).callsFake( function( value, callback ) {
				saved = JSON.parse( value.sites );
				if ( callback ) callback();
			} ),
			cloudSave = sinon.stub( OSApp.Network, "cloudSaveSites" );

		try {
			OSApp.currentSession.controller = { options:{ fwv:221 } };
			OSApp.currentSession.pass = md5( "raw-secret" );
			OSApp.Sites.persistSitePasswordMetadata( "Home" );
			assert.equal( saved.Home.os_pw, md5( "raw-secret" ) );
			assert.isTrue( saved.Home.isHashed );
			assert.notInclude( JSON.stringify( saved ), "raw-secret" );

			storedSites = {
				Pi:{ os_ip:"pi.test", os_pw:"pi-raw-secret", fwv:"1.9.0-OSPi", isHashed:false }
			};
			OSApp.currentSession.controller = { options:{ fwv:"1.9.0-OSPi" } };
			OSApp.currentSession.pass = md5( "pi-raw-secret" );
			OSApp.Sites.persistSitePasswordMetadata( "Pi" );
			assert.equal( saved.Pi.os_pw, md5( "pi-raw-secret" ) );
			assert.isTrue( saved.Pi.isHashed );
			assert.notProperty( saved.Pi, "legacyAuth" );

			storedSites = {
				ApprovedPi:{
					os_ip:"approved-pi.test", os_pw:"pi-clear-secret", fwv:"1.9.0-OSPi",
					isHashed:true, legacyAuth:true
				}
			};
			OSApp.currentSession.pass = "pi-clear-secret";
			OSApp.Sites.persistSitePasswordMetadata( "ApprovedPi" );
			assert.equal( saved.ApprovedPi.os_pw, "pi-clear-secret" );
			assert.isFalse( saved.ApprovedPi.isHashed );
			assert.isTrue( saved.ApprovedPi.legacyAuth );
		} finally {
			storageGet.restore();
			storageSet.restore();
			cloudSave.restore();
			OSApp.currentSession.controller = oldController;
			OSApp.currentSession.pass = oldPass;
		}
	} );

	it( "uses hash-only OSPi authentication until the operator approves legacy cleartext", function() {
		var attempts = [],
			check = sinon.stub( OSApp.Network, "checkPW" ).callsFake( function( password, callback ) {
				attempts.push( password );
				callback( true );
			} ),
			results = [];

		try {
			OSApp.Network.verifySitePassword( { fwv:"1.9.0-OSPi" }, "pi-secret", function( auth ) {
				results.push( auth );
			} );
			OSApp.Network.verifySitePassword( { fwv:"1.9.0-OSPi", legacyAuth:true }, "approved-pi-secret", function( auth ) {
				results.push( auth );
			} );
			assert.deepEqual( attempts, [ md5( "pi-secret" ), "approved-pi-secret" ] );
			assert.isTrue( results[ 0 ].isHashed );
			assert.equal( results[ 0 ].fwv, "1.9.0-OSPi" );
			assert.isFalse( results[ 1 ].isHashed );
			assert.equal( results[ 1 ].fwv, "1.9.0-OSPi" );
		} finally {
			check.restore();
		}
	} );

	it( "never sends an unapproved cleartext password from persisted legacy metadata", function() {
		var site = { os_ip:"192.0.2.10", os_pw:"stored-secret", fwv:212, isHashed:false },
			approved = { os_ip:"192.0.2.11", os_pw:"approved-secret", fwv:212, isHashed:false, legacyAuth:true },
			oldSession = {
				ip:OSApp.currentSession.ip, pass:OSApp.currentSession.pass,
				prefix:OSApp.currentSession.prefix, token:OSApp.currentSession.token,
				fw183:OSApp.currentSession.fw183, auth:OSApp.currentSession.auth
			},
			ajax = sinon.stub( $, "ajax" ).returns( $.Deferred().promise() ),
			storageGet = sinon.stub( OSApp.Storage, "get" ).callsFake( function( keys, callback ) {
				callback( { sites:JSON.stringify( { Legacy:site } ), current_site:"Legacy", cloudToken:null } );
			} ),
			updateList = sinon.stub( OSApp.Sites, "updateSiteList" ),
			newLoad = sinon.stub( OSApp.Sites, "newLoad" );

		try {
			assert.equal( OSApp.Sites.prepareStoredSitePassword( site ).password, md5( "stored-secret" ) );
			assert.equal( OSApp.Sites.prepareStoredSitePassword( approved ).password, "approved-secret" );
			assert.equal( OSApp.Sites.prepareStoredSitePassword( {
				os_pw:"metadata-is-not-a-hash", fwv:221, isHashed:true
			} ).password, md5( "metadata-is-not-a-hash" ) );
			assert.equal( OSApp.Sites.prepareStoredSitePassword( {
				os_pw:"0123456789abcdef0123456789abcdef", fwv:221, isHashed:false
			} ).password, md5( "0123456789abcdef0123456789abcdef" ) );

			OSApp.Sites.testSite( site, 0 );
			assert.equal( new URL( ajax.firstCall.args[ 0 ].url ).searchParams.get( "pw" ), md5( "stored-secret" ) );

			OSApp.Sites.checkConfigured( false );
			assert.equal( OSApp.currentSession.pass, md5( "stored-secret" ) );
			assert.isTrue( newLoad.calledOnce );
		} finally {
			ajax.restore();
			storageGet.restore();
			updateList.restore();
			newLoad.restore();
			OSApp.currentSession.ip = oldSession.ip;
			OSApp.currentSession.pass = oldSession.pass;
			OSApp.currentSession.prefix = oldSession.prefix;
			OSApp.currentSession.token = oldSession.token;
			OSApp.currentSession.fw183 = oldSession.fw183;
			OSApp.currentSession.auth = oldSession.auth;
		}
	} );

	it( "rejects malformed full-options responses before they replace cached options", function( done ) {
		var payload = {
			fwv: 221,
			wl: "'><img src=x onerror=alert(1)>",
			mton: "</button><script>alert(2)</script>",
			con: "\" autofocus onfocus=alert(3) x=\"",
			mtof: 15,
			tz: 28,
			imin: Infinity,
			feature: "ASB",
			firstRun: true,
			future_option: { retained:true }
		},
			oldFw183 = OSApp.currentSession.fw183,
			oldOptions = OSApp.currentSession.controller.options,
			send = sinon.stub( OSApp.Firmware, "sendToOS" ).returns( $.Deferred().resolve( payload ).promise() ),
			cleanup = function() {
				send.restore();
				OSApp.currentSession.fw183 = oldFw183;
				OSApp.currentSession.controller.options = oldOptions;
			};

		OSApp.currentSession.fw183 = false;
		OSApp.Sites.updateControllerOptions().then( function() {
			cleanup();
			done( new Error( "Malformed /jo payload unexpectedly resolved" ) );
		}, function() {
			assert.strictEqual( OSApp.currentSession.controller.options, oldOptions );
			cleanup();
			done();
		} );
	} );

	it( "does not trust an unauthenticated legacy /jo version to trigger a plaintext retry", function() {
		var fixture = $( "<div id='new-site-auth-test'>" +
				"<input id='os_url' value='controller.test'>" +
				"<input id='os_name' value='Spoofed'>" +
				"<input id='os_pw' value='clear-secret'>" +
				"<input type='checkbox' id='save_pw' checked>" +
				"<input type='checkbox' id='os_usessl'>" +
				"<input type='checkbox' id='os_useauth'>" +
				"<div id='addnew'><div id='addnew-content'></div></div>" +
			"</div>" ).appendTo( "body" ),
			requests = [],
			ajax = sinon.stub( $, "ajax" ).callsFake( function( options ) {
				requests.push( options.url );
				options.success( { fwv: 212 } );
				return $.Deferred().promise();
			} ),
			storageSet = sinon.spy( OSApp.Storage, "set" ),
			showError = sinon.stub( OSApp.Errors, "showError" );

		try {
			OSApp.Sites.submitNewSite();
			assert.lengthOf( requests, 1 );
			assert.equal( new URL( requests[ 0 ] ).searchParams.get( "pw" ), md5( "clear-secret" ) );
			assert.notInclude( requests[ 0 ], "clear-secret" );
			assert.isFalse( storageSet.called );
			assert.isTrue( showError.calledOnce );
		} finally {
			ajax.restore();
			storageSet.restore();
			showError.restore();
			fixture.remove();
		}
	} );

	it( "uses cleartext for a legacy controller only after explicit operator approval", function() {
		var fixture = $( "<div id='legacy-site-auth-test'>" +
				"<input id='os_url' value='legacy.test'>" +
				"<input id='os_name' value='Legacy'>" +
				"<input id='os_pw' value='legacy-secret'>" +
				"<input type='checkbox' id='save_pw' checked>" +
				"<input type='checkbox' id='os_usessl'>" +
				"<input type='checkbox' id='os_useauth'>" +
				"<input type='checkbox' id='os_legacy_auth' checked>" +
				"<div id='addnew'><div id='addnew-content'></div></div>" +
			"</div>" ).appendTo( "body" ),
			requests = [],
			replies = [ { fwv: 212, wl: 100 } ],
			saved,
			oldSession = {
				token: OSApp.currentSession.token,
				ip: OSApp.currentSession.ip,
				pass: OSApp.currentSession.pass,
				prefix: OSApp.currentSession.prefix,
				auth: OSApp.currentSession.auth,
				fw183: OSApp.currentSession.fw183
			},
			ajax = sinon.stub( $, "ajax" ).callsFake( function( options ) {
				requests.push( options.url );
				options.success( replies.shift() );
				return $.Deferred().promise();
			} ),
			storageGet = sinon.stub( OSApp.Storage, "get" ).callsFake( function( query, callback ) {
				callback( { sites:null } );
			} ),
			storageSet = sinon.stub( OSApp.Storage, "set" ).callsFake( function( query, callback ) {
				saved = JSON.parse( query.sites );
				if ( callback ) callback();
			} ),
			cloudSave = sinon.stub( OSApp.Network, "cloudSaveSites" ),
			updateList = sinon.stub( OSApp.Sites, "updateSiteList" ),
			newLoad = sinon.stub( OSApp.Sites, "newLoad" );

		try {
			OSApp.Sites.submitNewSite();
			assert.lengthOf( requests, 1 );
			assert.equal( new URL( requests[ 0 ] ).searchParams.get( "pw" ), "legacy-secret" );
			assert.equal( saved.Legacy.os_pw, "legacy-secret" );
			assert.equal( saved.Legacy.fwv, 212 );
			assert.isFalse( saved.Legacy.isHashed );
			assert.isTrue( saved.Legacy.legacyAuth );
		} finally {
			ajax.restore();
			storageGet.restore();
			storageSet.restore();
			cloudSave.restore();
			updateList.restore();
			newLoad.restore();
			OSApp.currentSession.token = oldSession.token;
			OSApp.currentSession.ip = oldSession.ip;
			OSApp.currentSession.pass = oldSession.pass;
			OSApp.currentSession.prefix = oldSession.prefix;
			OSApp.currentSession.auth = oldSession.auth;
			OSApp.currentSession.fw183 = oldSession.fw183;
			fixture.remove();
		}
	} );

	it( "encodes legacy passwords when probing public controller access", function() {
		var oldSession = {
			ip: OSApp.currentSession.ip,
			pass: OSApp.currentSession.pass,
			prefix: OSApp.currentSession.prefix,
			token: OSApp.currentSession.token,
			controller: OSApp.currentSession.controller
		},
			ajax = sinon.stub( $, "ajax" ).returns( $.Deferred().promise() ),
			intToIP = sinon.stub( OSApp.Network, "intToIP" ).returns( "198.51.100.20" ),
			isLocalIP = sinon.stub( OSApp.Network, "isLocalIP" ).callsFake( function( ip ) {
				return ip.indexOf( "192.0.2.10" ) === 0;
			} );

		try {
			OSApp.currentSession.ip = "192.0.2.10:80";
			OSApp.currentSession.pass = "legacy&pw=#value";
			OSApp.currentSession.prefix = "http://";
			OSApp.currentSession.token = undefined;
			OSApp.currentSession.controller = { options: { fwv: 212 } };

			OSApp.Network.checkPublicAccess( 1 );
			assert.isTrue( ajax.calledOnce );
			assert.equal(
				new URL( ajax.firstCall.args[ 0 ].url ).searchParams.get( "pw" ),
				"legacy&pw=#value"
			);
		} finally {
			ajax.restore();
			intToIP.restore();
			isLocalIP.restore();
			OSApp.currentSession.ip = oldSession.ip;
			OSApp.currentSession.pass = oldSession.pass;
			OSApp.currentSession.prefix = oldSession.prefix;
			OSApp.currentSession.token = oldSession.token;
			OSApp.currentSession.controller = oldSession.controller;
		}
	} );
} );

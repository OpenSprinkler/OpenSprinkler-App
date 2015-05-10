/* jshint undef: false */
var assert = chai.assert;

describe( "Initial Definition Check", function() {
	it( "storage.set(object,callback) should accept an object of key/value pairs to be set into localStorage and respond with callback", function( done ) {
		assert.doesNotThrow( function() {
			storage.set( {
				"testkey": "helloworld",
                "sites": JSON.stringify( {
                	"Test": {
                		"os_ip": "127.0.0.1:8080",
                		"os_pw":"opendoor"
                	}
                } ),
                "current_site": "Test"
			}, function( result ) {
				if ( result === true ) {
					done();
				}
			} );
		} );
	} );

	it( "storage.get(object,callback) should accept an array of keys to be retrieved from localStorage and respond with callback", function( done ) {
		assert.doesNotThrow( function() {
			storage.get( [ "testkey" ], function( result ) {
				if ( result.testkey === "helloworld" ) {
					done();
				}
			} );
		} );
	} );

	it( "storage.remove(object,callback) should accept an array of keys to be deleted from localStorage and respond with callback", function( done ) {
		assert.doesNotThrow( function() {
			storage.remove( [ "testkey" ], function( result ) {
				if ( result === true ) {
					done();
				}
			} );
		} );
	} );

	it( "storage.remove(string,callback) should accept a key to be deleted from localStorage and respond with callback", function( done ) {
		assert.doesNotThrow( function() {
			storage.remove( "fakekey", function( result ) {
				if ( result === true ) {
					done();
				}
			} );
		} );
	} );
} );

describe( "OpenSprinkler Firmware Version Functions", function() {

	describe( "Test against Arduino Firmware Version", function() {
		before( function() {
			controller.options = {
				fwv: 210
			};
		} );
		it( "isOPSi() should identify if the device is an OSPi", function() {
			assert.equal( false, isOSPi() );
		} );
		it( "versionCompare(device,compare) should check the given firmware (device) against the compare firmware where the input is an array", function() {
			assert.strictEqual( false, versionCompare( [ 1 ], [ 1, 5 ] ) );
			assert.strictEqual( 0, versionCompare( [ 1, 5 ], [ 1, 5 ] ) );
			assert.strictEqual( 1, versionCompare( [ 2, 1 ], [ 1, 5 ] ) );
		} );
		it( "checkOSVersion(compare) should compare the input firmware version against the Arduino firmware version.", function() {
			assert.strictEqual( false, checkOSVersion( 211 ) );
			assert.strictEqual( true, checkOSVersion( 210 ) );
			assert.strictEqual( 1, checkOSVersion( 208 ) );
		} );
		it( "checkOSPiVersion(compare) should compare the input firmware version against the OSPi firmware version.", function() {
			assert.strictEqual( false, checkOSPiVersion( "2.0" ) );
			assert.strictEqual( false, checkOSPiVersion( "1.9" ) );
			assert.strictEqual( false, checkOSPiVersion( "2.1" ) );
		} );
	} );

	describe( "Test against OSPi Firmware Version", function() {
		before( function() {
			controller.options = {
				fwv: "1.9.0-OSPi"
			};
		} );
		it( "isOPSi() should identify if the device is an OSPi", function() {
			assert.equal( true, isOSPi() );
		} );
		it( "versionCompare(device,compare) should check the given firmware (device) against the compare firmware where the input is an array", function() {
			assert.strictEqual( false, versionCompare( [ 1 ], [ 1, 5 ] ) );
			assert.strictEqual( 0, versionCompare( [ 1, 5 ], [ 1, 5 ] ) );
			assert.strictEqual( 1, versionCompare( [ 2, 1 ], [ 1, 5 ] ) );
		} );
		it( "checkOSVersion(compare) should compare the input firmware version against the Arduino firmware version.", function() {
			assert.strictEqual( false, checkOSVersion( 211 ) );
			assert.strictEqual( false, checkOSVersion( 210 ) );
			assert.strictEqual( false, checkOSVersion( 208 ) );
		} );
		it( "checkOSPiVersion(compare) should compare the input firmware version against the OSPi firmware version.", function() {
			assert.strictEqual( 1, checkOSPiVersion( "1.8" ) );
			assert.strictEqual( true, checkOSPiVersion( "1.9.0" ) );
			assert.strictEqual( false, checkOSPiVersion( "2.0" ) );
			assert.strictEqual( false, checkOSPiVersion( "2.1" ) );
		} );
	} );

	describe( "Retrieve the formatted firmware version", function() {
		before( function() {
			controller.options = {
				fwv: 204
			};
		} );
		it( "getOSVersion(fwv) should return the firmware in a string representation", function() {
			assert.equal( "1.8.3-OSPi", getOSVersion( "1.8.3-OSPi" ) );
			assert.equal( "2.1.193-OSPi", getOSVersion( "2.1.193-OSPi" ) );
			assert.equal( "2.0.8", getOSVersion( 208 ) );
			assert.equal( "2.0.4", getOSVersion() );
		} );
	} );
} );

describe( "General Function Checks", function() {
	it( "parseIntArray(array) should convert all members into integers", function() {
		assert.deepEqual( [ 9, 394, 29193, -1 ], parseIntArray( [ "9", "394", "29193", "-1" ] ) );
	} );

	it( "sec2hms(number) should return a string representation of the difference the input represents (seconds)", function() {
		assert.equal( "23:59:59", sec2hms( 86399 ) );
		assert.equal( "15:00", sec2hms( 900 ) );
	} );

	it( "sec2dhms(number) should return an object containing days, hours, minutes and seconds from the input (seconds)", function() {
		assert.deepEqual( {
			days: 936,
			hours: 17,
			minutes: 20,
			seconds: 9
		}, sec2dhms( 80932809 ) );
	} );

	it( "dhms2str(object) should convert an object with elements days, hours, minutes and seconds into a string representation", function() {
		assert.equal( "5d 4h 3m 1s", dhms2str( { days:5, hours:4, minutes:3, seconds:1 } ) );
		assert.equal( "0s", dhms2str( {} ) );
	} );

	it( "dhms2sec(object) should convert an object with elements days, hours, minutes and seconds into a second value", function() {
		assert.equal( 100981, dhms2sec( { days:1, hours:4, minutes:3, seconds:1 } ) );
	} );

	it( "getDayName(day,type) should return the day of the week and can be of type 'short'", function() {
		assert.equal( "Sunday", getDayName( new Date( 1410745528126 ) ) );
		assert.equal( "Thu", getDayName( new Date( 1410445528126 ), "short" ) );
	} );

	it( "pad(number) should succesfully prepend a 0 to a single digit", function() {
		assert.equal( "00", pad( 0 ) );
		assert.equal( "01", pad( 1 ) );
		assert.equal( "10", pad( 10 ) );
		assert.equal( "999", pad( 999 ) );
	} );
} );

describe( "Page Navigation Checks", function() {
	it( "Start jQuery Mobile Page Initialization", function( done ) {
		this.timeout( 30000 );
		assert.doesNotThrow( $.mobile.initializePage );
		$.mobile.document.one( "pageshow", "#sprinklers", function() {
			done();
		} );
	} );

	it( "Change page to program preview", function( done ) {
		$.mobile.document.one( "pageshow", "#preview", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#preview" );
		} );
	} );

	it( "Change to logs page", function( done ) {
		$.mobile.document.one( "pageshow", "#logs", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#logs" );
		} );
	} );

	it( "Change to runonce page", function( done ) {
		$.mobile.document.one( "pageshow", "#runonce", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#runonce" );
		} );
	} );

	it( "Change to edit programs page", function( done ) {
		$.mobile.document.one( "pageshow", "#programs", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#programs" );
		} );
	} );

	it( "Reload edit programs page", function( done ) {
		$.mobile.document.one( "pageshow", "#programs", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#programs" );
		} );
	} );

	it( "Change to add new program page", function( done ) {
		$.mobile.document.one( "pageshow", "#addprogram", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#addprogram" );
		} );
	} );

	it( "Change to options page", function( done ) {
		$.mobile.document.one( "pageshow", "#os-options", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#os-options" );
		} );
	} );

	it( "Change to site manager page", function( done ) {
		$.mobile.document.one( "pageshow", "#site-control", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#site-control" );
		} );
	} );

	it( "Reload site manager page", function( done ) {
		$.mobile.document.one( "pageshow", "#site-control", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#site-control" );
		} );
	} );

	it( "Change to about page", function( done ) {
		$.mobile.document.one( "pageshow", "#about", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			changePage( "#about" );
		} );
	} );
} );

describe( "Popup Checks", function() {
	it( "Show main menu popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#mainMenu", function() {
			$.mobile.document.one( "popupafterclose", "#mainMenu", function() {
				done();
			} );

			$( "#mainMenu" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			showHomeMenu();
		} );
	} );

	it( "Show add new site popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#addnew", function() {
			$.mobile.document.one( "popupafterclose", "#addnew", function() {
				done();
			} );
			$( "#addnew" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			changePage( "#addnew" );
		} );
	} );

	it( "Show site select popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#site-select", function() {
			$.mobile.document.one( "popupafterclose", "#site-select", function() {
				done();
			} );
			$( "#site-select" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			changePage( "#site-select" );
		} );
	} );

	it( "Show are you sure popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#sure", function() {
			$( "#sure .sure-do" ).click();
		} );
		assert.doesNotThrow( function() {
			areYouSure( null, null, done );
		} );
	} );

	it( "Show IP Address input popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#ipInput", function() {
			$.mobile.document.one( "popupafterclose", "#ipInput", function() {
				done();
			} );
			$( "#ipInput" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			showIPRequest();
		} );
	} );

	it( "Show single duration input popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#singleDuration", function() {
			$.mobile.document.one( "popupafterclose", "#singleDuration", function() {
				done();
			} );
			$( "#singleDuration" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			showSingleDurationInput();
		} );
	} );

	it( "Show language selection popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#localization", function() {
			$.mobile.document.one( "popupafterclose", "#localization", function() {
				done();
			} );
			$( "#localization" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			languageSelect();
		} );
	} );

/*
	it("Show location selection popup",function(done){
		$.mobile.document.one("popupafteropen","#location-list",function(){
			$("#location-list").find("ul").children().eq(0).find("a").click();
		});
		assert.doesNotThrow(function(){
			resolveLocation("boston",function(location){
				assert.notStrictEqual(false,location);
				done();
			});
		});
	});
*/

	it( "Show change rain delay popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#durationBox", function() {
			$.mobile.document.one( "popupafterclose", "#durationBox", function() {
				done();
			} );
			$( "#durationBox" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			changePage( "#raindelay" );
		} );
	} );
} );

describe( "Logout / Clean up", function() {
	it( "Remove all variables", function( done ) {
        storage.remove( [ "sites", "current_site", "lang", "runonce" ], function() {
        	done();
        } );
    } );

    it( "Go to start page", function( done ) {
		$.mobile.document.one( "pageshow", "#start", function() {
			done();
		} );
    	changePage( "#start", {
    		showStart: true
    	} );
    } );
} );

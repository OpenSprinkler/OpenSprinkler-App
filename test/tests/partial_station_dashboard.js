/* eslint-disable */

describe( "Partial station Dashboard compatibility", function() {
	it( "renders without second-master controls when the optional mask is absent", function() {
		var sandbox = sinon.createSandbox(),
			oldController = OSApp.currentSession.controller,
			oldWeather = OSApp.currentSession.weather,
			oldLocal = OSApp.currentSession.local,
			selector = $( "#site-selector" ),
			originalSelector = selector.html(),
			page;

		try {
			selector.html( "<option value='Local' selected>Local</option>" );
			OSApp.currentSession.controller = {
				options:{ fwv:220, wl:100, mas:0, mas2:8 },
				programs:{ pd:[] },
				settings:{
					devt:1717939200, dname:"Test", nbrd:1,
					ps:new Array( 8 ).fill( [ 0, 0, 0, 255 ] )
				},
				stations:{
					snames:[ "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8" ],
					masop:[ 0 ]
				},
				status:new Array( 8 ).fill( 0 )
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
			sandbox.stub( OSApp.Analog, "updateSensorShowArea" );

			assert.isFalse( OSApp.Supported.master( OSApp.Constants.options.MASTER_STATION_2 ) );
			assert.equal( OSApp.StationAttributes.getMasterOperation(
				0, OSApp.Constants.options.MASTER_STATION_2
			), 0 );
			assert.doesNotThrow( function() { OSApp.Dashboard.displayPage(); } );
			page = $( "#sprinklers" );
			assert.equal( page.find( ".station-settings[data-um2]" ).length, 0 );
		} finally {
			$( "html" ).off( ".dashboard" );
			if ( page ) page.remove();
			selector.html( originalSelector );
			sandbox.restore();
			OSApp.currentSession.controller = oldController;
			OSApp.currentSession.weather = oldWeather;
			OSApp.currentSession.local = oldLocal;
		}
	} );
} );

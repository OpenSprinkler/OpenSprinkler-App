/* eslint-disable */

describe( "Legacy options clock display regressions", function() {
	it( "keeps an unset device clock as -- when toggling 12/24-hour display", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			original24Hour = OSApp.uiState.is24Hour,
			page;

		try {
			$( "#os-options" ).remove();
			OSApp.uiState.is24Hour = false;
			OSApp.currentSession.controller = {
				options: {
					fwv: 221, fwm: 4, hwv: 30, ife: 0, ntp: 0, uwt: 0, tz: 24,
					ntp1: 192, ntp2: 0, ntp3: 2, ntp4: 1
				},
				programs: {},
				settings: { loc: "", devt: 0 },
				stations: { snames: [] },
				status: []
			};
			sandbox.stub( OSApp.Supported, "groups" ).returns( false );
			sandbox.stub( OSApp.UIDom, "changeHeader" ).returns(
				$( "<button></button><h3></h3><button></button>" )
			);
			sandbox.stub( OSApp.Storage, "set" );

			OSApp.Options.showOptions( "app" );
			page = $( "#os-options" );
			var datetime = page.find( "#datetime" ),
				toggle = page.find( "#is24Hour" );

			assert.equal( datetime.val(), "0" );
			assert.equal( datetime.text(), "--" );
			toggle.prop( "checked", true ).triggerHandler( "change" );
			assert.equal( datetime.val(), "0" );
			assert.equal( datetime.text(), "--" );
			toggle.prop( "checked", false ).triggerHandler( "change" );
			assert.equal( datetime.val(), "0" );
			assert.equal( datetime.text(), "--" );
		} finally {
			if ( page ) page.triggerHandler( "pagehide" );
			$( "#os-options" ).remove();
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
			OSApp.uiState.is24Hour = original24Hour;
		}
	} );
} );

/* global $, OSApp, assert, describe, it, sinon */

describe( "weather multi-day diagnostics state", function() {
	it( "reports the stored mda flag honestly and explains when levels affect interval programs", function() {
		var originalController = OSApp.currentSession.controller,
			popup,
			openPopup = sinon.stub( OSApp.UIDom, "openPopup" ).callsFake( function( value ) { popup = value; } );

		try {
			OSApp.currentSession.controller = {
				options: { uwt: 0, wl: 100 },
				settings: { wls: [ 100, 80 ], wto: { mda: 100 }, wtdata: {} }
			};
			OSApp.SystemDiagnostics.showDiagnostics();
			assert.include( popup.text(), "Multi-Day AdjustmentEnabled" );
			assert.include( popup.text(), "Multi-day adjustment is enabled" );
			assert.include( popup.text(), "toggle remains enabled" );
			assert.include( popup.text(), "uses the N-day average" );

			OSApp.currentSession.controller.options.uwt = 1;
			OSApp.currentSession.controller.settings.wto.mda = 0;
			OSApp.SystemDiagnostics.showDiagnostics();
			assert.include( popup.text(), "Multi-Day AdjustmentDisabled" );
			assert.include( popup.text(), "reference only" );
			assert.include( popup.text(), "current overall Watering Level" );
			assert.include( popup.text(), "Enable multi-day adjustment under Settings > Weather" );

			OSApp.currentSession.controller.options.uwt = 0;
			OSApp.SystemDiagnostics.showDiagnostics();
			assert.include( popup.text(), "Select Zimmerman or ETo" );
		} finally {
			openPopup.restore();
			OSApp.currentSession.controller = originalController;
			$( "#debugWU" ).remove();
		}
	} );
} );

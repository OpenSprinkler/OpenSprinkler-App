/* eslint-disable */

describe( "About page and external-link boundaries", function() {
	it( "renders app information without querying controller versions while disconnected", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			page;

		OSApp.currentSession.controller = {};
		sandbox.stub( OSApp.UIDom, "changeHeader" );
		sandbox.stub( OSApp.Firmware, "getOSVersion" ).throws( new Error( "controller version queried" ) );
		try {
			assert.doesNotThrow( function() {
				OSApp.About.displayPage();
			} );
			page = $( "#about" );
			assert.equal( page.length, 1 );
			assert.include( page.find( ".app-version" ).text(), OSApp.uiState.appVersion );
			assert.equal( page.find( ".controller-version:not(.hidden)" ).length, 0 );
			assert.isFalse( OSApp.Firmware.getOSVersion.called );
		} finally {
			$( "#about" ).remove();
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
		}
	} );

	it( "opens intercepted blank-target links without exposing the opener", function() {
		var sandbox = sinon.createSandbox(),
			originalIsOSXApp = OSApp.currentDevice.isOSXApp,
			openedWindow = { opener: window },
			open = sandbox.stub( window, "open" ).returns( openedWindow ),
			link = $( "<a class='iab iabNoScale' href='https://example.test/' target='_blank'>External</a>" ).appendTo( document.body ),
			features;

		OSApp.currentDevice.isOSXApp = false;
		try {
			assert.isFalse( OSApp.UIDom.openExternalLink( link[ 0 ] ) );
			assert.isTrue( open.calledOnce );
			assert.equal( open.firstCall.args[ 0 ], "https://example.test/" );
			assert.equal( open.firstCall.args[ 1 ], "_blank" );
			features = open.firstCall.args[ 2 ];
			assert.match( features, /(?:^|,)noopener=yes(?:,|$)/ );
			assert.match( features, /(?:^|,)noreferrer=yes(?:,|$)/ );
			assert.isTrue( features.split( "," ).every( function( feature ) {
				return feature.indexOf( "=" ) > 0;
			} ), "Cordova options must remain key=value pairs" );
			assert.isNull( openedWindow.opener );
		} finally {
			link.remove();
			sandbox.restore();
			OSApp.currentDevice.isOSXApp = originalIsOSXApp;
		}
	} );
} );

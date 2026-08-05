/* eslint-disable */

/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <http://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

describe( "Site Rendering Checks", function() {
	it( "adds a persistent ASB compatibility notification", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller;

		try {
			OSApp.currentSession.controller = { options: { feature: "ASB" } };
			var addNotification = sandbox.stub( OSApp.Notifications, "addNotification" );
			var changePage = sandbox.stub( OSApp.UIDom, "changePage" );

			OSApp.Sites.addASBCompatibilityNotification();
			assert.isTrue( addNotification.calledOnce );
			assert.equal( addNotification.firstCall.args[ 0 ].title, "ASB firmware detected" );
			assert.equal( addNotification.firstCall.args[ 0 ].desc, "This UI has limited support for it. Switch to OpenSprinklerASB app/UI." );

			assert.isFalse( addNotification.firstCall.args[ 0 ].on() );
			assert.isTrue( changePage.calledOnceWithExactly( "#about" ) );
		} finally {
			OSApp.currentSession.controller = originalController;
			sandbox.restore();
		}
	} );

	it( "shows the ASB compatibility notice once per site", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller,
			dismissed = false,
			popup;

		try {
			OSApp.currentSession.controller = { options: { feature: "ASB" } };
			sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
				var data = {};
				data[ key ] = dismissed ? "1" : null;
				callback( data );
			} );
			sandbox.stub( OSApp.Storage, "set" ).callsFake( function( data ) {
				dismissed = Object.values( data )[ 0 ] === "1";
			} );
			sandbox.stub( OSApp.UIDom, "openPopup" ).callsFake( function( renderedPopup ) {
				popup = renderedPopup;
			} );
			sandbox.stub( $.fn, "popup" ).returnsThis();

			OSApp.Sites.showASBCompatibilityNotice( "ASB Test Site" );
			assert.equal( popup.find( "h3" ).text(), "OpenSprinklerASB Firmware Detected" );
			assert.equal(
				popup.find( "p" ).text(),
				"Your device runs the OpenSprinklerASB firmware. This UI has limited support for it. Please switch to the OpenSprinklerASB mobile app/UI for full support."
			);
			assert.equal( popup.find( ".ui-btn" ).text(), "Continue" );

			popup.find( ".ui-btn" ).trigger( "click" );
			assert.isTrue( dismissed );

			OSApp.Sites.showASBCompatibilityNotice( "ASB Test Site" );
			assert.isTrue( OSApp.UIDom.openPopup.calledOnce );
		} finally {
			OSApp.currentSession.controller = originalController;
			sandbox.restore();
		}
	} );

	it( "shows limited ASB compatibility on the About page", function() {
		var sandbox = sinon.createSandbox(),
			originalController = OSApp.currentSession.controller;

		try {
			OSApp.currentSession.controller = {
				options: { feature: "ASB", fwv: 240, fwm: 0, hwv: "ASB" }
			};
			sandbox.stub( OSApp.UIDom, "changeHeader" );

			OSApp.About.displayPage();
			assert.isFalse( $( "#about .asbCompatibility" ).hasClass( "hidden" ) );
			assert.equal(
				$( "#about .asb-compatibility-warning" ).text(),
				"This UI has limited support for ASB firmware."
			);
		} finally {
			$( "#about" ).remove();
			OSApp.currentSession.controller = originalController;
			sandbox.restore();
		}
	} );

	it( "renders an auto-discovered address as an input value", function() {
		var sandbox = sinon.createSandbox(),
			autoIP = "192.168.1.2' onfocus='window.siteAddressInjected=true";

		try {
			sandbox.stub( $.fn, "popup" ).callsFake( function( options ) {
				if ( options && typeof options === "object" ) {
					this.appendTo( "body" );
				}
				return this;
			} );

			OSApp.Sites.showAddNew( autoIP );

			assert.equal( $( "#os_url" ).val(), autoIP );
			assert.isUndefined( $( "#os_url" ).attr( "onfocus" ) );
			assert.lengthOf( $( "#addnew #os_pw" ), 1 );
			assert.equal( $( "#addnew label[for='os_pw']" ).length, 1 );
		} finally {
			$( "#addnew" ).remove();
			sandbox.restore();
		}
	} );

	it( "renders site names as literal option text", function() {
		var maliciousName = "Home</option><script>window.siteNameInjected=true</script><option>",
			select = $( "#site-selector" );

		window.siteNameInjected = false;
		OSApp.Sites.updateSiteList( [ maliciousName ], maliciousName );

		assert.lengthOf( select.find( "option" ), 1 );
		assert.equal( select.find( "option" ).val(), maliciousName );
		assert.equal( select.find( "option" ).text(), maliciousName );
		assert.lengthOf( select.find( "script" ), 0 );
		assert.isFalse( window.siteNameInjected );

		OSApp.Sites.updateSiteList( [ "Test" ], "Test" );
		delete window.siteNameInjected;
	} );

	it( "renders a site name as text in the delete confirmation", function() {
		var sandbox = sinon.createSandbox(),
			maliciousName = "Home<img class='site-name-injection' src='invalid'>",
			popup;

		try {
			sandbox.stub( OSApp.currentSession, "isControllerConnected" ).returns( true );
			sandbox.stub( OSApp.Storage, "get" ).callsFake( function( keys, callback ) {
				callback( {
					sites: JSON.stringify( ( function() {
						var sites = {};
						sites[ maliciousName ] = { os_ip: "192.168.1.2", os_pw: "" };
						return sites;
					} )() ),
					current_site: maliciousName,
					cloudToken: null
				} );
			} );
			sandbox.stub( OSApp.Sites, "testSite" );
			sandbox.stub( OSApp.UIDom, "changeHeader" ).returns( $() );
			sandbox.stub( OSApp.UIDom, "openPopup" ).callsFake( function( renderedPopup ) {
				popup = renderedPopup;
			} );

			OSApp.Sites.displayPage();
			$( "#site-control .deletesite" ).trigger( "click" );

			assert.equal( popup.find( ".sure-1" ).text(), "Are you sure you want to delete " + maliciousName + "?" );
			assert.lengthOf( popup.find( ".site-name-injection" ), 0 );
		} finally {
			sandbox.restore();
			$( "#site-control, #addsite, #sure" ).remove();
		}
	} );

	it( "renders the connecting site name as text in the loading indicator", function() {
		var sandbox = sinon.createSandbox(),
			maliciousName = "Home<img id='site-loading-injection' src='x'>",
			select = $( "#site-selector" ),
			originalOptions = select.children().detach(),
			originalController = OSApp.currentSession.controller,
			originalLocal = OSApp.currentSession.local,
			originalTimers = OSApp.uiState.timers,
			loadingOptions;

		try {
			$( "<option>" ).val( maliciousName ).text( maliciousName ).appendTo( select );
			select.val( maliciousName );
			OSApp.currentSession.local = false;
			sandbox.stub( $.mobile, "loading" ).callsFake( function( action, options ) {
				if ( action === "show" ) {
					loadingOptions = options;
				}
			} );
			sandbox.stub( $.ajaxq, "abort" );
			sandbox.stub( OSApp.Notifications, "clearNotifications" );
			sandbox.stub( OSApp.Sites, "updateController" );

			OSApp.Sites.newLoad();

			var rendered = $( "<div>" ).html( loadingOptions.html );
			assert.equal( rendered.find( "h1" ).text(), "Connecting to " + maliciousName );
			assert.lengthOf( rendered.find( "#site-loading-injection" ), 0 );
		} finally {
			sandbox.restore();
			OSApp.currentSession.controller = originalController;
			OSApp.currentSession.local = originalLocal;
			OSApp.uiState.timers = originalTimers;
			select.empty().append( originalOptions );
		}
	} );
} );

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
	it( "renders an auto-discovered address as an input value", function( done ) {
		var autoIP = "192.168.1.2' onfocus='window.siteAddressInjected=true";

		$.mobile.document.one( "popupafteropen", "#addnew", function() {
			try {
				assert.equal( $( "#os_url" ).val(), autoIP );
				assert.isUndefined( $( "#os_url" ).attr( "onfocus" ) );
				assert.lengthOf( $( "#addnew #os_pw" ), 1 );
				assert.equal( $( "#addnew label[for='os_pw']" ).length, 1 );
			} finally {
				$.mobile.document.one( "popupafterclose", "#addnew", function() {
					done();
				} );
				$( "#addnew" ).popup( "close" ).remove();
			}
		} );

		OSApp.Sites.showAddNew( autoIP );
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
} );

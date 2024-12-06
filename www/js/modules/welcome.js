/* global $ */

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

// Configure module
var OSApp = OSApp || {};
OSApp.Welcome = OSApp.Welcome || {};

OSApp.Welcome.displayPage = function() {
	// Welcome page, start configuration screen
	var page = $( "<div data-role='page' id='start'>" +
			"<ul data-role='none' id='welcome_list' class='ui-listview ui-listview-inset ui-corner-all'>" +
			"<li><div class='logo' id='welcome_logo'></div></li>" +
			"<li class='ui-li-static ui-body-inherit ui-first-child ui-last-child ui-li-separate'>" +
			"<p class='rain-desc'>" +
			OSApp.Language._( "Welcome to the OpenSprinkler application. This app only works with the OpenSprinkler controller which must be installed and setup on your home network." ) +
			"</p>" +
			"<a class='iab iabNoScale ui-btn ui-mini center' target='_blank' href='https://opensprinkler.com/product/opensprinkler/'>" +
			OSApp.Language._( "Purchase OpenSprinkler" ) +
			"</a>" +
			"</li>" +
			"<li class='ui-first-child ui-last-child'>" +
			"<a href='#' class='ui-btn center cloud-login'>" + OSApp.Language._( "OpenSprinkler.com Login" ) + "</a>" +
			"</li>" +
			"<hr class='content-divider'>" +
			"<li id='auto-scan' class='ui-first-child'>" +
			"<a href='#' class='ui-btn ui-btn-icon-right ui-icon-carat-r'>" +
			OSApp.Language._( "Scan For Device" ) +
			"</a>" +
			"</li>" +
			"<li class='ui-first-child ui-last-child'>" +
			"<a class='ui-btn ui-btn-icon-right ui-icon-carat-r' data-rel='popup' href='#addnew'>" +
			OSApp.Language._( "Add Controller" ) +
			"</a>" +
			"</li>" +
			"</ul>" +
			"</div>" ),
		checkAutoScan = function() {
			OSApp.Network.updateDeviceIP( function( ip ) {
				if ( ip === undefined ) {
					resetStartMenu();
					return;
				}

				// Check if the IP is on a private network, if not don't enable automatic scanning
				if ( !OSApp.Network.isLocalIP( ip ) ) {
					resetStartMenu();
					return;
				}

				//Change main menu items to reflect ability to automatically scan
				next.removeClass( "ui-first-child" ).find( "a.ui-btn" ).text( OSApp.Language._( "Manually Add Device" ) );
				auto.show();
			} );
		},
		resetStartMenu = function() {
			next.addClass( "ui-first-child" ).find( "a.ui-btn" ).text( OSApp.Language._( "Add Controller" ) );
			auto.hide();
		},
		auto = page.find( "#auto-scan" ),
		next = auto.next();

	page.find( "#auto-scan" ).find( "a" ).on( "click", function() {
		OSApp.Network.startScan();
		return false;
	} );

	page.find( "a[href='#addnew']" ).on( "click", function() {
		OSApp.Sites.showAddNew();
	} );

	page.find( ".cloud-login" ).on( "click", function() {
		OSApp.Network.requestCloudAuth();
		return false;
	} );

	page.on( "pagehide", function() {
		page.detach();
	} );

	function begin() {
		if ( OSApp.currentSession.isControllerConnected() ) {
			return false;
		}

		$( "#start" ).remove();

		$.mobile.pageContainer.append( page );

		checkAutoScan();
	}

	return begin();
};

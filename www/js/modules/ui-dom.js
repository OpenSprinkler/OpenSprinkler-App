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
OSApp.UIDom = OSApp.UIDom || {};

OSApp.UIDom.launchApp = () => {
	if ( "serviceWorker" in navigator ) {
		window.addEventListener( "load", function() {
			navigator.serviceWorker.register( "/sw.js" );
		} );
	}

	if ( OSApp.currentDevice.isOSXApp ) {
		document.documentElement.classList.add( "macos" );
	}

	$( document )
	.one( "deviceready", function() {
		/** Replace window.open with InAppBrowser if available */
		if ( window.cordova && window.cordova.InAppBrowser ) {
			window.open = window.cordova.InAppBrowser.open;
		}

		try {

			//Change the status bar to match the headers
			StatusBar.overlaysWebView( false );
			StatusBar.styleLightContent();
			StatusBar.backgroundColorByHexString( OSApp.uiState.theme.statusBarPrimary );

			$.mobile.window.on( "statusTap", function() {
				$( "body, html" ).animate( {
					scrollTop: 0
				}, 700 );
			} );
		} catch ( err ) {}

		// Hide the splash screen
		setTimeout( function() {
			try {
				navigator.splashscreen.hide();
			} catch ( err ) {}
		}, 500 );

		// For Android devices catch the back button and redirect it
		$.mobile.document.on( "backbutton", function() {
			OSApp.UIDom.checkChangesBeforeBack();
			return false;
		} );

		OSApp.Network.updateDeviceIP();

		// Check if 3D touch is available and add menu when possible
		if ( OSApp.currentDevice.isiOS ) {
			ThreeDeeTouch.isAvailable( function( available ) {
				if ( available ) {

					// Enable quick preview on web links
					ThreeDeeTouch.enableLinkPreview();

					// Configure menu actions
					ThreeDeeTouch.configureQuickActions( [
						{
							type: "sites",
							title: OSApp.Language._( "Manage Sites" ),
							iconType: "Location"
						},
						{
							type: "addprogram",
							title: OSApp.Language._( "Add Program" ),
							iconType: "Add"
						},
						{
							type: "stopall",
							title: OSApp.Language._( "Stop All Stations" ),
							iconType: "Pause"
						}
					] );

					ThreeDeeTouch.onHomeIconPressed = function( payload ) {
						if ( payload.type === "sites" ) {
							OSApp.UIDom.changePage( "#site-control" );
						} else if ( payload.type === "addprogram" ) {
							OSApp.UIDom.changePage( "#addprogram" );
						} else if ( payload.type === "stopall" ) {
							stopAllStations();
						}
					};
				}
			} );
		}
	} )
	.one( "mobileinit", function() {
		$.support.cors = true;
		$.mobile.allowCrossDomainPages = true;
		OSApp.Storage.loadLocalSettings();
	} )
	.on( "pagebeforechange", function( e, data ) {
		var page = data.toPage,
			currPage = $( ".ui-page-active" ),
			hash;

		// Pagebeforechange event triggers twice (before and after)
		// and this check ensures we get the before state
		if ( typeof data.toPage !== "string" ) {
			return;
		}

		// Grabs the new page hash
		hash = $.mobile.path.parseUrl( page ).hash;

		if ( currPage.length > 0 && hash === "#" + currPage.attr( "id" ) ) {
			return;
		}

		// Animations are patchy if the page isn't scrolled to the top.
		// This scrolls the page before the animation fires off.
		if ( data.options.role !== "popup" && !$( ".ui-popup-active" ).length ) {
			$.mobile.silentScroll( 0 );
		}

		// Cycle through page possibilities and call their init functions
		if ( hash === "#programs" ) {
			getPrograms( data.options.programToExpand );
		} else if ( hash === "#addprogram" ) {
			addProgram( data.options.copyID );
		} else if ( hash === "#manual" ) {
			getManual();
		} else if ( hash === "#about" ) {
			showAbout();
		} else if ( hash === "#runonce" ) {
			getRunonce();
		} else if ( hash === "#os-options" ) {
			showOptions( data.options.expandItem );
		} else if ( OSApp.Analog.checkAnalogSensorAvail() && hash === "#analogsensorconfig" ) {
			OSApp.Analog.showAnalogSensorConfig();
		} else if ( OSApp.Analog.checkAnalogSensorAvail() && hash === "#analogsensorchart" ) {
			OSApp.Analog.showAnalogSensorCharts();
		} else if ( hash === "#preview" ) {
			getPreview();
		} else if ( hash === "#logs" ) {
			getLogs();
		} else if ( hash === "#forecast" ) {
			showForecast();
		} else if ( hash === "#loadingPage" ) {
			OSApp.Sites.checkConfigured( true );
		} else if ( hash === "#start" ) {
			showStart();
		} else if ( hash === "#site-control" ) {
			showSites();
		} else if ( hash === "#sprinklers" ) {
			if ( $( hash ).length === 0 ) {
				showHome( data.options.firstLoad );
			} else {
				$( hash ).one( "pageshow", function() { refreshStatus(); } );
			}
		}
	} )

	// Handle OS resume event triggered by PhoneGap
	.on( "resume", function() {

		// If we don't have a current device IP set, there is nothing else to update
		if ( OSApp.currentSession.ip === undefined ) {
			return;
		}

		// If cloud token is available then sync sites
		OSApp.Network.cloudSync();

		// Indicate the weather and device status are being updated
		showLoading( "#weather,#footer-running" );

		updateController( updateWeather, networkFail );
	} )
	.on( "pause", function() {

		// Handle application being paused/closed
	} )
	.on( "pagebeforeshow", function( e ) {
		var newpage = "#" + e.target.id;

		// Modify the header and footer visibility before page show event
		if ( newpage === "#start" || newpage === "#loadingPage" ) {

			// Hide the header, footer and menu button on the start page
			$( "#header,#footer,#footer-menu" ).hide();
		} else {

			// Show header, footer and menu button on all other pages
			$( "#header,#footer,#footer-menu" ).show();
		}

		OSApp.Storage.get( "showDisabled", function( data ) {
			if ( data.showDisabled && data.showDisabled === "true" ) {
				$( newpage ).addClass( "show-hidden" ).find( ".station-hidden" ).show();
			} else {
				$( newpage ).removeClass( "show-hidden" ).find( ".station-hidden" ).hide();
			}
		} );
	} )
	.on( "pageshow", function( e ) {
		var newpage = "#" + e.target.id,
			$newpage = $( newpage );

		if ( OSApp.uiState.goingBack ) {
			OSApp.uiState.goingBack = false;
		} else {
			OSApp.uiState.pageHistoryCount++;
		}

		// Fix issues between jQuery Mobile and FastClick
		OSApp.UIDom.fixInputClick( $newpage );

		if ( OSApp.currentSession.isControllerConnected() && newpage !== "#site-control" && newpage !== "#start" && newpage !== "#loadingPage" ) {

			// Update the controller status every 5 seconds and the program and station data every 30 seconds
			var refreshStatusInterval = setInterval( function() { refreshStatus(); }, 5000 ),
				refreshDataInterval;

			if ( !OSApp.Firmware.checkOSVersion( 216 ) ) {
				refreshDataInterval = setInterval( refreshData, 20000 );
			}

			$newpage.one( "pagehide", function() {
				clearInterval( refreshStatusInterval );
				clearInterval( refreshDataInterval );
			} );
		}
	} )
	.on( "popupafteropen", function() {

		// When a popup opens that has an overlay, update the status bar background color to match
		if ( $( ".ui-overlay-b:not(.ui-screen-hidden)" ).length ) {
			try {
				StatusBar.backgroundColorByHexString( OSApp.uiState.theme.statusBarOverlay );
			} catch ( err ) {}
		}
	} )
	.on( "popupafterclose", function() {

		$( ".ui-page-active" ).children().add( "#sprinklers-settings" ).removeClass( "blur-filter" );

		// When a popup is closed, change the header back to the default color
		try {
			StatusBar.backgroundColorByHexString( OSApp.uiState.theme.statusBarPrimary );
		} catch ( err ) {}
	} )
	.on( "popupbeforeposition", function() {
		$( ".ui-page-active" ).children().add( "#sprinklers-settings" ).addClass( "blur-filter" );
	} )
	.on( "popupbeforeposition", "#localization", OSApp.Language.checkCurrLang )
	.one( "pagebeforeshow", "#loadingPage", OSApp.UIDom.initApp );

};

OSApp.UIDom.initApp = () => {

	//Update the language on the page using the browser's locale
	OSApp.Language.updateLang();

	//Set AJAX timeout
	if ( !OSApp.currentSession.local ) {
		$.ajaxSetup( {
			timeout: 10000
		} );
	}

	// Prevent caching of AJAX requests on Android and Windows Phone devices
	if ( OSApp.currentDevice.isAndroid ) {

		// Hide the back button for Android (all devices have back button)
		insertStyle( ".ui-toolbar-back-btn{display:none!important}" );

		$( this ).ajaxStart( function() {
			try {
				navigator.app.clearCache();
			} catch ( err ) {}
		} );
	} else if ( OSApp.currentDevice.isFireFox ) {

		// Allow cross domain AJAX requests in FireFox OS
		$.ajaxSetup( {
			xhr: function() {
				return new window.XMLHttpRequest( {
					mozSystem: true
				} );
			}
		} );
	} else {
		$.ajaxSetup( {
			"cache": false
		} );
	}

	//After jQuery mobile is loaded set initial configuration
	$.mobile.defaultPageTransition = OSApp.currentDevice.isAndroid ? "fade" : "slide";
	$.mobile.hoverDelay = 0;
	$.mobile.activeBtnClass = "activeButton";

	// Handle In-App browser requests (marked with iab class)
	$.mobile.document.on( "click", ".iab", function() {
		var target = OSApp.currentDevice.isOSXApp ? "_system" : "_blank";

		var button = $( this );
		window.open( this.href, target, "location=" + ( OSApp.currentDevice.isAndroid ? "yes" : "no" ) +
			",enableViewportScale=" + ( button.hasClass( "iabNoScale" ) ? "no" : "yes" ) +
			",toolbar=yes,toolbarposition=top,toolbarcolor=" + OSApp.uiState.theme.statusBarPrimary +
			",closebuttoncaption=" +
				( button.hasClass( "iabNoScale" ) ? OSApp.Language._( "Back" ) : OSApp.Language._( "Done" ) )
		);

		setTimeout( function() {
			button.removeClass( "ui-btn-active" );
		}, 100 );
		return false;
	} );

	// Correctly handle popup events and prevent history navigation on custom selectmenu popup
	$.mobile.document.on( "click", ".ui-select .ui-btn", function() {
		var button = $( this ),
			id = button.attr( "id" ).replace( "-button", "-listbox" ),
			popup = $( "#" + id );

		popup.popup( "destroy" ).detach().addClass( "ui-page-theme-a" );
		$.mobile.pageContainer.append( popup );

		popup.popup( {
			history: false,
			"positionTo": button,
			overlayTheme: "b"
		} ).popup( "open" );

		button.off( "click" ).on( "click", function() {
			popup.popup( "open" );
		} );

		return false;
	} );

	// Bind event handler to open panel when swiping right
	$.mobile.document.on( "swiperight swipeleft", ".ui-page", function( e ) {
		var page = $( ".ui-page-active" );

		if ( e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && page.jqmData( "panel" ) !== "open" && !page.find( ".ui-popup-active" ).length ) {
			if ( e.type === "swiperight" ) {
				 OSApp.uiState.openPanel();
			} else {
				OSApp.Notifications.showNotifications();
			}
		}
	} );

	// Extend collapsible widget with event before change
	$.widget( "mobile.collapsible", $.mobile.collapsible, {
		_handleExpandCollapse: function( isCollapse ) {
			if ( this._trigger( "before" + ( isCollapse ? "collapse" : "expand" ) ) ) {
				this._superApply( arguments );
			}
		}
	} );

	//Update site based on selector
	$( "#site-selector" ).on( "change", function() {
		updateSite( $( this ).val() );
	} );

	// Bind footer menu button
	$( "#footer-menu" ).on( "click", function() {
		showHomeMenu( this );
	} );

	// Initialize the app header
	$( "#header,#footer" ).toolbar();

	//Attach FastClick handler
	FastClick.attach( document.body );

	// Start interval loop which will update timers/clocks
	updateTimers();

	// Handle keybinds
	$.mobile.document.on( "keydown", function( e ) {
		var tag = $( e.target ).prop( "tagName" );

		if ( tag === "INPUT" || tag === "TEXTAREA" ) {
			return;
		}

		var code = e.keyCode,
			altDown = e.altKey,
			menuOpen = $( "#mainMenu-popup" ).hasClass( "ui-popup-active" );

		if ( code === 77 ) { // M
			var menu = $( "#mainMenu" );
			if ( menu.length > 0 ) {
				$( "#mainMenu" ).popup( "close" );
			} else {
				showHomeMenu();
			}
		} else if ( ( menuOpen || altDown ) && code === 80 ) { // P
			e.preventDefault();
			OSApp.UIDom.changePage( "#programs" );
		} else if ( ( menuOpen || altDown ) && code === 79 ) { // O
			e.preventDefault();
			OSApp.UIDom.changePage( "#os-options" );
		} else if ( ( menuOpen || altDown ) && code === 86 ) { // V
			e.preventDefault();
			OSApp.UIDom.changePage( "#preview" );
		} else if ( ( menuOpen || altDown ) && code === 76 ) { // L
			e.preventDefault();
			OSApp.UIDom.changePage( "#logs" );
		} else if ( ( menuOpen || altDown ) && code === 82 ) { // R
			e.preventDefault();
			OSApp.UIDom.changePage( "#runonce" );
		} else if ( ( menuOpen || altDown ) && code === 85 ) { // U
			e.preventDefault();
			showPause();
		} else if ( ( menuOpen || altDown ) && code === 68 ) { // D
			e.preventDefault();
			showRainDelay();
		}
	} );

	// Initialize external panel
	OSApp.UIDom.bindPanel();

	// Update the IP address of the device running the app
	if ( !OSApp.currentSession.local  && typeof window.cordova === "undefined" ) {
		OSApp.Network.updateDeviceIP();
	}

	// If cloud token is available then sync sites
	OSApp.Network.cloudSync();

	//On initial load check if a valid site exists for auto connect
	setTimeout( function() {
		OSApp.Sites.checkConfigured( true );
	}, 200 );
}

// Return Datatables configuration options
OSApp.UIDom.getDatatablesConfig = ( options ) => {
	var defaultConfig = {
		info: false,
		paging: false,
		searching: false
	};

	return Object.assign( {}, defaultConfig, options );
};

// Panel functions
OSApp.UIDom.bindPanel = () => {
	var panel = $( "#sprinklers-settings" ),
		operation = function() {
			return ( OSApp.currentSession.controller && OSApp.currentSession.controller.settings && OSApp.currentSession.controller.settings.en && OSApp.currentSession.controller.settings.en === 1 ) ? OSApp.Language._( "Disable" ) : OSApp.Language._( "Enable" );
		};

	panel.enhanceWithin().panel().removeClass( "hidden" ).panel( "option", "classes.modal", "needsclick ui-panel-dismiss" );

	panel.find( "a[href='#site-control']" ).on( "click", function() {
		OSApp.UIDom.changePage( "#site-control" );
		return false;
	} );

	panel.find( "a[href='#about']" ).on( "click", function() {
		OSApp.UIDom.changePage( "#about" );
		return false;
	} );

	panel.find( ".cloud-login" ).on( "click", function() {
		OSApp.Network.requestCloudAuth();
		return false;
	} );
 	// TODO: mellodev lots of functions called here that need refactoring to module
	panel.find( "a[href='#debugWU']" ).on( "click", debugWU );

	panel.find( "a[href='#localization']" ).on( "click", OSApp.Language.languageSelect );

	panel.find( ".export_config" ).on( "click", function() {

		// Check if the controller has special stations which are enabled
		if ( typeof OSApp.currentSession.controller.stations.stn_spe === "object" && typeof OSApp.currentSession.controller.special !== "object" && !OSApp.currentSession.controller.stations.stn_spe.every( function( e ) { return e === 0; } ) ) {

			// Grab station special data before proceeding
			updateControllerStationSpecial( getExportMethod );
		} else {
			getExportMethod();
		}

		return false;
	} );

	panel.find( ".import_config" ).on( "click", function() {
		OSApp.Storage.get( "backup", function( newdata ) {
			getImportMethod( newdata.backup );
		} );

		return false;
	} );

	panel.find( ".toggleOperation" ).on( "click", function() {
		var self = $( this ),
			toValue = ( 1 - OSApp.currentSession.controller.settings.en );

		areYouSure( OSApp.Language._( "Are you sure you want to" ) + " " + operation().toLowerCase() + " " + OSApp.Language._( "operation?" ), "", function() {
			OSApp.Firmware.sendToOS( "/cv?pw=&en=" + toValue ).done( function() {
				$.when(
					updateControllerSettings(),
					updateControllerStatus()
				).done( function() {
					checkStatus();
					self.find( "span:first" ).html( operation() ).attr( "data-translate", operation() );
				} );
			} );
		} );

		return false;
	} ).find( "span:first" ).html( operation() ).attr( "data-translate", operation() );

	panel.find( ".reboot-os" ).on( "click", function() {
		areYouSure( OSApp.Language._( "Are you sure you want to reboot OpenSprinkler?" ), "", function() {
			$.mobile.loading( "show" );
			OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" ).done( function() {
				$.mobile.loading( "hide" );
				OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
			} );
		} );
		return false;
	} );

	panel.find( ".changePassword > a" ).on( "click", OSApp.Network.changePassword );

	panel.find( "#downgradeui" ).on( "click", function() {
		areYouSure( OSApp.Language._( "Are you sure you want to downgrade the UI?" ), "", function() {
			var url = "http://rayshobby.net/scripts/java/svc" + OSApp.Firmware.getOSVersion();

			OSApp.Firmware.sendToOS( "/cu?jsp=" + encodeURIComponent( url ) + "&pw=" ).done( function() {
				OSApp.Storage.remove( [ "sites", "current_site", "lang", "provider", "wapikey", "runonce" ] );
				location.reload();
			} );
		} );
		return false;
	} );

	panel.find( "#logout" ).on( "click", function() {
		logout();
		return false;
	} );

	 OSApp.uiState.openPanel = ( function() {
		var panel = $( "#sprinklers-settings" ),
			updateButtons = function() {
				var operation = ( OSApp.currentSession.controller && OSApp.currentSession.controller.settings && OSApp.currentSession.controller.settings.en && OSApp.currentSession.controller.settings.en === 1 ) ? OSApp.Language._( "Disable" ) : OSApp.Language._( "Enable" );
				panel.find( ".toggleOperation span:first" ).html( operation ).attr( "data-translate", operation );
			};

		$( "html" ).on( "datarefresh",  updateButtons );

		function begin() {
			var currPage = $( ".ui-page-active" ).attr( "id" );

			if ( currPage === "start" || currPage === "loadingPage" || !OSApp.currentSession.isControllerConnected() || $( ".ui-page-active" ).length !== 1 ) {
				return;
			}

			updateButtons();
			panel.panel( "open" );
		}

		return begin;
	} )();
};

OSApp.UIDom.changePage = ( toPage, opts = {}) => {
	if ( toPage.indexOf( "#" ) !== 0 ) {
		toPage = "#" + toPage;
	}

	// Close the panel before page transition to avoid bug in jQM 1.4+
	OSApp.UIDom.closePanel( () => {
		$.mobile.pageContainer.pagecontainer( "change", toPage, opts );
	} );
};

OSApp.UIDom.openPopup = ( popup, args ) => {
	args = $.extend( {}, {
		history: false,
		positionTo: "window",
		overlayTheme: "b"
	}, args );

	$.mobile.pageContainer.append( popup );

	popup.one( "popupafterclose", function() {

		// Retrieve popup data
		var updateRemainingStations = $( "#shift-sta" ).is( ":checked" );

		// Save data before view is destroyed
		if ( updateRemainingStations !== undefined ) {
			OSApp.uiState.popupData.shift = updateRemainingStations;
		}

		popup.popup( "destroy" ).remove();
	} ).popup( args ).enhanceWithin();

	popup.popup( "open" );
};

OSApp.UIDom.closePanel = ( callback = () => void 0 ) => {
	var panel = $( ".ui-panel-open" );
	if ( panel.length > 0 ) {
		panel.one( "panelclose", function() {
			callback();
		} );
		panel.panel( "close" );
		return;
	} else {
		callback();
	}
};

OSApp.UIDom.getAppURLPath = function() {
	return OSApp.currentSession.local ? $.mobile.path.parseUrl( $( "head" ).find( "script[src$='main.js']" ).attr( "src" ) ).hrefNoHash.slice( 0, -10 ) : "";
};

// Accessory functions
OSApp.UIDom.fixInputClick = function( page ) {

	// Handle Fast Click quirks
	if ( !FastClick.notNeeded( document.body ) ) {
		page.find( "input[type='checkbox']:not([data-role='flipswitch']),.ui-select > .ui-btn" ).addClass( "needsclick" );
		page.find( ".ui-collapsible-heading-toggle" ).on( "click", function() {
			var heading = $( this );

			setTimeout( function() {
				heading.removeClass( "ui-btn-active" );
			}, 100 );
		} );
	}
};

// Bind buttons to allow push and hold effects
OSApp.UIDom.holdButton = function( target, callback ) {
	var intervalId;

	target.on( OSApp.currentDevice.isTouchCapable ? "tap" : "click", callback ).on( "taphold", function( e ) {
		intervalId = setInterval( function() {
			callback( e );
		}, 100 );
	} ).on( "vmouseup vmouseout vmousecancel touchend", function() {
		clearInterval( intervalId );
	} ).on( "touchmove", function( e ) {
		e.preventDefault();
	} );
};

// Insert style string into the DOM
OSApp.UIDom.insertStyle = function( style ) {
	var a = document.createElement( "style" );
	a.innerHTML = style;
	document.head.appendChild( a );
};

// Transition to home page after successful load
OSApp.UIDom.goHome = function( firstLoad ) {
	if ( $( ".ui-page-active" ).attr( "id" ) !== "sprinklers" ) {
		$.mobile.document.one( "pageshow", function() {

			// Allow future transitions to properly animate
			delete $.mobile.navigate.history.getActive().transition;
		} );

		var opts = {
			"reverse": true
		};

		if ( firstLoad === true ) {
			opts = {
				"firstLoad": true,
				"showLoading": false,
				"transition": "none"
			};
		}

		OSApp.UIDom.changePage( "#sprinklers", opts );
	}
}

// Prevent back navigation during active page transition
OSApp.UIDom.goBack = function() {
	var page = $( ".ui-page-active" );

	if ( page.length !== 1 ) {
		return;
	}

	page = page.attr( "id" );

	var managerStart = ( page === "site-control" && !OSApp.currentSession.isControllerConnected() ),
		popup = $( ".ui-popup-active" );

	if ( popup.length ) {
		popup.find( "[data-role='popup']" ).popup( "close" );
		return;
	}

	if ( page === "sprinklers" || page === "start" || managerStart ) {
		try {
			navigator.app.exitApp();
		} catch ( err ) {}
	} else {
		if ( OSApp.uiState.pageHistoryCount > 0 ) {
			OSApp.uiState.pageHistoryCount--;
		}

		if ( OSApp.uiState.pageHistoryCount === 0 ) {
			navigator.app.exitApp();
		} else {
			OSApp.uiState.goingBack = true;
			$.mobile.back();
		}
	}
};

OSApp.UIDom.checkChangesBeforeBack = function() {
	OSApp.UIDom.checkChanges( OSApp.UIDom.goBack );
};

OSApp.UIDom.checkChanges = function( callback = () => void 0 ) {
	var page = $( ".ui-page-active" ),
		changed = page.find( ".hasChanges" );

	if ( changed.length !== 0 ) {
		areYouSure( OSApp.Language._( "Do you want to save your changes?" ), "", function() {
			changed.click();
			if ( !changed.hasClass( "preventBack" ) ) {
				callback();
			}
		}, callback );
		return false;
	} else {
		callback();
	}
};

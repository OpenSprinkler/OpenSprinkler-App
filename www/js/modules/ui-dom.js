/* global $, ThreeDeeTouch, FastClick, StatusBar */

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

// FIXME: this file needs refactoring attention!

// App entry point
OSApp.UIDom.launchApp = function() {
       // Load any stored local settings immediately since the `mobileinit`
       // event may fire before this script is executed
       if ( OSApp.Storage && typeof OSApp.Storage.loadLocalSettings === "function" ) {
               OSApp.Storage.loadLocalSettings();
       }

       Number.prototype.clamp = function( min, max ) {
               return Math.min( Math.max( this, min ), max );
       };

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
			//eslint-disable-next-line
		} catch ( err ) {}

		// Hide the splash screen
		setTimeout( function() {
			try {
				navigator.splashscreen.hide();
				//eslint-disable-next-line
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
							OSApp.Stations.stopAllStations();
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
			OSApp.Programs.displayPage( data.options.programToExpand );
		} else if ( hash === "#addprogram" ) {
			OSApp.Programs.addProgram( data.options.copyID );
		} else if ( hash === "#manual" ) {
			OSApp.Programs.displayPageManual();
		} else if ( hash === "#about" ) {
			OSApp.About.displayPage();
		} else if ( hash === "#runonce" ) {
			OSApp.Programs.displayPageRunOnce();
		} else if ( hash === "#os-options" ) {
			OSApp.Options.showOptions( data.options.expandItem );
		} else if ( OSApp.Analog.checkAnalogSensorAvail() && hash === "#analogsensorconfig" ) {
			OSApp.Analog.showAnalogSensorConfig();
		} else if ( OSApp.Analog.checkAnalogSensorAvail() && hash === "#analogsensorchart" ) {
			OSApp.Analog.showAnalogSensorCharts();
		} else if ( hash === "#preview" ) {
			OSApp.Programs.displayPagePreviewPrograms();
		} else if ( hash === "#logs" ) {
			OSApp.Logs.displayPage();
		} else if ( hash === "#forecast" ) {
			OSApp.Weather.showForecast();
		} else if ( hash === "#loadingPage" ) {
			OSApp.Sites.checkConfigured( true );
		} else if ( hash === "#start" ) {
			OSApp.Welcome.displayPage();
		} else if ( hash === "#site-control" ) {
			OSApp.Sites.displayPage();
		} else if ( hash === "#sprinklers" ) {
			if ( $( hash ).length === 0 ) {
				OSApp.Dashboard.displayPage( data.options.firstLoad );
			} else {
				$( hash ).one( "pageshow", function() { OSApp.Status.refreshStatus(); } );
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
		OSApp.UIDom.showLoading( "#weather,#footer-running" );

		OSApp.Sites.updateController( OSApp.Weather.updateWeather, OSApp.Network.networkFail );
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
			var refreshStatusInterval = setInterval( function() { OSApp.Status.refreshStatus(); }, 5000 ), // FIXME: refactor this 5000 interval out to Constants or config/settings
				refreshDataInterval;

			if ( !OSApp.Firmware.checkOSVersion( 216 ) ) {
				refreshDataInterval = setInterval( OSApp.Sites.refreshData, 20000 ); // FIXME: move the 20000 interval to Constants (or config/settings)
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
				//eslint-disable-next-line
			} catch ( err ) {}
		}
	} )
	.on( "popupafterclose", function() {

		$( ".ui-page-active" ).children().add( "#sprinklers-settings" ).removeClass( "blur-filter" );

		// When a popup is closed, change the header back to the default color
		try {
			StatusBar.backgroundColorByHexString( OSApp.uiState.theme.statusBarPrimary );
			//eslint-disable-next-line
		} catch ( err ) {}
	} )
	.on( "popupbeforeposition", function() {
		$( ".ui-page-active" ).children().add( "#sprinklers-settings" ).addClass( "blur-filter" );
	} )
	.on( "popupbeforeposition", "#localization", OSApp.Language.checkCurrLang )
	.one( "pagebeforeshow", "#loadingPage", OSApp.UIDom.initAppData );

};

// FIXME: refactor the footer waffle menu elsewhere
OSApp.UIDom.showHomeMenu = ( function() {
	var page, id, showHidden, popup;

	function makeMenu() {
		page = $( ".ui-page-active" );
		id = page.attr( "id" );
		showHidden = page.hasClass( "show-hidden" );
		popup = $( "<div data-role='popup' data-theme='a' id='mainMenu'>" +
			"<ul data-role='listview' data-inset='true' data-corners='false'>" +
				"<li data-role='list-divider'>" + OSApp.Language._( "Information" ) + "</li>" +
				"<li><a href='#preview' class='squeeze'>" + OSApp.Language._( "Preview Programs" ) + "</a></li>" +
				( OSApp.Firmware.checkOSVersion( 206 ) || OSApp.Firmware.checkOSPiVersion( "1.9" ) ? "<li><a href='#logs'>" + OSApp.Language._( "View Logs" ) + "</a></li>" : "" ) +
				"<li data-role='list-divider'>" + OSApp.Language._( "Programs and Settings" ) + "</li>" +
				"<li><a href='#raindelay'>" + OSApp.Language._( "Change Rain Delay" ) + "</a></li>" +
				( OSApp.Supported.pausing() ?
					( OSApp.StationQueue.isPaused() ? "<li><a href='#globalpause'>" + OSApp.Language._( "Change Pause" ) + "</a></li>"
						: ( OSApp.StationQueue.isActive() >= -1 ? "<li><a href='#globalpause'>" + OSApp.Language._( "Pause Station Runs" ) + "</a></li>" : "" ) )
					: "" ) +
				"<li><a href='#runonce'>" + OSApp.Language._( "Run-Once Program" ) + "</a></li>" +
				"<li><a href='#programs'>" + OSApp.Language._( "Edit Programs" ) + "</a></li>" +
				"<li><a href='#os-options'>" + OSApp.Language._( "Edit Options" ) + "</a></li>" +

				( OSApp.Analog.checkAnalogSensorAvail() ? (
					"<li><a href='#analogsensorconfig'>" + OSApp.Language._( "Analog Sensor Config" ) + "</a></li>" +
					"<li><a href='#analogsensorchart'>" + OSApp.Language._( "Show Sensor Log" ) + "</a></li>"
				) : "" ) +
			( id === "sprinklers" || id === "runonce" || id === "programs" || id === "manual" || id === "addprogram" ?
				"</ul>" +
				"<div class='ui-grid-a ui-mini tight'>" +
					"<div class='ui-block-a'><a class='ui-btn tight' href='#show-hidden'>" +
						( showHidden ? OSApp.Language._( "Hide" ) : OSApp.Language._( "Show" ) ) + " " + OSApp.Language._( "Disabled" ) +
					"</a></div>" +
					"<div class='ui-block-b'><a class='ui-btn red tight' href='#stop-all'>" + OSApp.Language._( "Stop All Stations" ) + "</a></div>" +
				"</div>"
				: "<li><a class='ui-btn red' href='#stop-all'>" + OSApp.Language._( "Stop All Stations" ) + "</a></li></ul>" ) +
		"</div>" );
	}

	function begin( btn ) {
		btn = btn instanceof $ ? btn : $( btn );

		$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

		makeMenu();

		popup.on( "click", "a", function() {
			var clicked = $( this ),
				href = clicked.attr( "href" );

			popup.popup( "close" );

			if ( href === "#stop-all" ) {
				OSApp.Stations.stopAllStations();
			} else if ( href === "#show-hidden" ) {
                                if ( showHidden ) {
                                        $( ".station-hidden" ).hide();
                                        $( ".disabled-programs-note" ).show();
                                        page.removeClass( "show-hidden" );
                                        OSApp.Storage.set( { showDisabled: false } );
                                        showHidden = false;
                                } else {
                                        $( ".station-hidden" ).show();
                                        $( ".disabled-programs-note" ).hide();
                                        page.addClass( "show-hidden" );
                                        OSApp.Storage.set( { showDisabled: true } );
                                        showHidden = true;
                                }
			} else if ( href === "#raindelay" ) {
				OSApp.Weather.showRainDelay();
			} else if ( href === "#globalpause" ) {
				OSApp.UIDom.showPause();
			} else {
				OSApp.UIDom.checkChanges( function() {
					OSApp.UIDom.changePage( href );
				} );
			}

			return false;
		} );

		$( "#mainMenu" ).remove();

		popup.one( "popupafterclose", function() {
			btn.show();
		} );

		OSApp.UIDom.openPopup( popup, { positionTo: btn } );

		btn.hide();
	}

	return begin;
} )();

OSApp.UIDom.initAppData = function() {

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
		OSApp.UIDom.insertStyle( ".ui-toolbar-back-btn{display:none!important}" );

		$( this ).ajaxStart( function() {
			try {
				navigator.app.clearCache();
				//eslint-disable-next-line
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
		OSApp.Sites.updateSite( $( this ).val() );
	} );

	// Bind footer menu button
	$( "#footer-menu" ).on( "click", function() {
		OSApp.UIDom.showHomeMenu( this );
	} );

	// Initialize the app header
	$( "#header,#footer" ).toolbar();

	//Attach FastClick handler
	FastClick.attach( document.body );

	// Start interval loop which will update timers/clocks
	OSApp.UIDom.updateTimers();

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
				OSApp.UIDom.showHomeMenu();
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
			OSApp.UIDom.showPause();
		} else if ( ( menuOpen || altDown ) && code === 68 ) { // D
			e.preventDefault();
			OSApp.Weather.showRainDelay();
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
};

OSApp.UIDom.focusInput = function() {
	$.fn.focusInput = function() {
		if ( this.get( 0 ).setSelectionRange ) {
			this.focus();
			this.get( 0 ).setSelectionRange( 0, this.val().length );
		} else if ( this.get( 0 ).createTextRange ) {
			var range = this.get( 0 ).createTextRange();
			range.collapse( true );
			range.moveEnd( "character", this.val().length );
			range.moveStart( "character", 0 );
			range.select();
		}

		return this;
	};
};

// Return Datatables configuration options
OSApp.UIDom.getDatatablesConfig = function( options ) {
	var defaultConfig = {
		info: false,
		paging: false,
		searching: false
	};

	return Object.assign( {}, defaultConfig, options );
};

// Panel functions
OSApp.UIDom.bindPanel = function() {
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

	panel.find( "a[href='#debugWU']" ).on( "click", OSApp.SystemDiagnostics.showDiagnostics );

	panel.find( "a[href='#localization']" ).on( "click", OSApp.Language.languageSelect );

	panel.find( ".export_config" ).on( "click", function() {

		// Check if the controller has special stations which are enabled
		if ( typeof OSApp.currentSession.controller.stations.stn_spe === "object" && typeof OSApp.currentSession.controller.special !== "object" && !OSApp.currentSession.controller.stations.stn_spe.every( function( e ) { return e === 0; } ) ) {

			// Grab station special data before proceeding
			OSApp.Sites.updateControllerStationSpecial( OSApp.ImportExport.getExportMethod );
		} else {
			OSApp.ImportExport.getExportMethod();
		}

		return false;
	} );

	panel.find( ".import_config" ).on( "click", function() {
		OSApp.Storage.get( "backup", function( newdata ) {
			OSApp.ImportExport.getImportMethod( newdata.backup );
		} );

		return false;
	} );

	panel.find( ".toggleOperation" ).on( "click", function() {
		var self = $( this ),
			toValue = ( 1 - OSApp.currentSession.controller.settings.en );

		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to" ) + " " + operation().toLowerCase() + " " + OSApp.Language._( "operation?" ), "", function() {
			OSApp.Firmware.sendToOS( "/cv?pw=&en=" + toValue ).done( function() {
				$.when(
					OSApp.Sites.updateControllerSettings(),
					OSApp.Sites.updateControllerStatus()
				).done( function() {
					OSApp.Status.checkStatus();
					self.find( "span:first" ).html( operation() ).attr( "data-translate", operation() );
				} );
			} );
		} );

		return false;
	} ).find( "span:first" ).html( operation() ).attr( "data-translate", operation() );

	panel.find( ".reboot-os" ).on( "click", function() {
		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to reboot OpenSprinkler?" ), "", function() {
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
		OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to downgrade the UI?" ), "", function() {
			var url = "http://rayshobby.net/scripts/java/svc" + OSApp.Firmware.getOSVersion();

			OSApp.Firmware.sendToOS( "/cu?jsp=" + encodeURIComponent( url ) + "&pw=" ).done( function() {
				OSApp.Storage.remove( [ "sites", "current_site", "lang", "provider", "wapikey", "runonce" ] );
				location.reload();
			} );
		} );
		return false;
	} );

	panel.find( "#logout" ).on( "click", function() {
		OSApp.Network.logout();
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

OSApp.UIDom.changePage = function( toPage, opts ) {
	opts = opts || {};
	if ( toPage.indexOf( "#" ) !== 0 ) {
		toPage = "#" + toPage;
	}

	// Close the panel before page transition to avoid bug in jQM 1.4+
	OSApp.UIDom.closePanel( function() {
		$.mobile.pageContainer.pagecontainer( "change", toPage, opts );
	} );
};

OSApp.UIDom.openPopup = function( popup, args ) {
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

OSApp.UIDom.closePanel = function( callback ) {
	callback = callback || function() {};
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
				"OSApp.UIDom.showLoading": false,
				"transition": "none"
			};
		}

		OSApp.UIDom.changePage( "#sprinklers", opts );
	}
};

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
			//eslint-disable-next-line
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

OSApp.UIDom.checkChanges = function( callback ) {
	callback = callback || function() {};
	var page = $( ".ui-page-active" ),
		changed = page.find( ".hasChanges" );

	if ( changed.length !== 0 ) {
		OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to save your changes?" ), "", function() {
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

// Change persistent header
OSApp.UIDom.changeHeader = function( opt ) {

	// Declare function defaults
	var defaults = {
			title: "",
			class: "",
			animate: true,
			leftBtn: {
				icon: "",
				class: "",
				text: "",
				on: function() {}
			},
			rightBtn: {
				icon: "",
				class: "",
				text: "",
				on: function() {}
			}
		},
		header = $( "#header" );

	// Merge defaults with supplied options
	opt = $.extend( true, {}, defaults, opt );

	// Change default page title to the logo
	if ( opt.title === "" && opt.class === "" ) {
		opt.class = "logo";
	}

	// Generate new header content
	var newHeader = $( "<button data-icon='" + opt.leftBtn.icon + "' " + ( opt.leftBtn.text === "" ? "data-iconpos='notext' " : "" ) +
				"class='ui-btn-left " + opt.leftBtn.class + "'>" + opt.leftBtn.text + "</button>" +
			"<h3 class='" + opt.class + "'>" + opt.title + "</h3>" +
			"<button data-icon='" + opt.rightBtn.icon + "' " + ( opt.rightBtn.text === "" ? "data-iconpos='notext' " : "" ) +
				"class='ui-btn-right " + opt.rightBtn.class + "'>" + opt.rightBtn.text + "</button>" ),
		speed = opt.animate ? "fast" : 0;

	// Fade out the header content, replace it, and update the header
	header.children().stop().fadeOut( speed, function() {
		header.html( newHeader ).toolbar( header.hasClass( "ui-header" ) ? "refresh" : null );
		header.find( ".ui-btn-left" ).on( "click", opt.leftBtn.on );
		header.find( ".ui-btn-right" ).on( "click", opt.rightBtn.on );
	} ).fadeIn( speed );

	return newHeader;
};

OSApp.UIDom.getPageTop = function() {
	var theWindow = $.mobile.window;

	return {
		x: ( theWindow[ 0 ].innerWidth || theWindow.width() ) / 2 + theWindow.scrollLeft(),
		y: theWindow.scrollTop() + 22.5
	};
};

// Show loading indicator within element(s)
OSApp.UIDom.showLoading = function( ele ) {
	ele = ( typeof ele === "string" ) ? $( ele ) : ele;
	ele.off( "click" ).html( "<p class='ui-icon ui-icon-loading mini-load'></p>" );

	var footer = ele.filter( "#footer-running" );
	if ( footer.length === 1 ) {
		footer.find( ".mini-load" ).addClass( "bottom" );
	}
};

OSApp.UIDom.getPicture = function( callback ) {
	callback = callback || function() {};
	var imageLoader = $( "<input style='display: none' type='file' accept='image/*' />" )
		.insertAfter( "body" )
		.on( "change", function( event ) {
			var reader = new FileReader();
			reader.onload = function( readerEvent ) {
				var image = new Image();
				image.onload = function() {
					var canvas = document.createElement( "canvas" ),
						maxSize = 200,
						width = image.width,
						height = image.height;
					if ( width > height ) {
						if ( width > maxSize ) {
							height *= maxSize / width;
							width = maxSize;
						}
					} else {
						if ( height > maxSize ) {
							width *= maxSize / height;
							height = maxSize;
						}
					}
					canvas.width = width;
					canvas.height = height;
					canvas.getContext( "2d" ).drawImage( image, 0, 0, width, height );
					var resizedImage = canvas.toDataURL( "image/jpeg", 0.5 ).replace( "data:image/jpeg;base64,", "" );
					imageLoader.remove();
					callback( resizedImage );
				};
				image.src = readerEvent.target.result;
			};
			reader.readAsDataURL( event.target.files[ 0 ] );
		} );

	imageLoader.get( 0 ).click();
};

OSApp.UIDom.showHelpText = function( e ) {
	e.stopImmediatePropagation();

	var button = $( this ),
		text = button.data( "helptext" ),
		popup;

	popup = $( "<div data-role='popup' data-theme='a'>" +
		"<p>" + text + "</p>" +
	"</div>" );

	OSApp.UIDom.openPopup( popup, { positionTo: button } );

	return false;
};

// TODO: possibly move these date/time components to date.js
OSApp.UIDom.showTimeInput = function( opt ) {
	var defaults = {
			minutes: 0,
			title: OSApp.Language._( "Time" ),
			incrementalUpdate: false,
			showBack: true,
			showSun: false,
			callback: function() {}
		};

	opt = $.extend( {}, defaults, opt );

	$( "#timeInput" ).popup( "destroy" ).remove();

	var offset = opt.minutes & 0x7ff,
		type = 0;

	if ( ( opt.minutes >> 12 ) & 1 ) {
		offset = -offset;
	}
	if ( ( opt.minutes >> 14 ) & 1 ) {
		type = 1;
	} else if ( ( opt.minutes >> 13 ) & 1 ) {
		type = 2;
	}

	var isPM = ( opt.minutes > 719 ? true : false ),
		getPeriod = function() {
			return isPM ? OSApp.Language._( "PM" ) : OSApp.Language._( "AM" );
		},
		popup = $( "<div data-role='popup' id='timeInput' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + opt.title + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				( opt.helptext ? "<p class='pad-top rain-desc center smaller'>" + opt.helptext + "</p>" : "" ) +
				"<span>" +
					"<fieldset class='ui-grid-" + ( OSApp.uiState.is24Hour ? "a" : "b" ) + " incr'>" +
						"<div class='ui-block-a'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
						( OSApp.uiState.is24Hour ? "" : "<div class='ui-block-c'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" ) +
					"</fieldset>" +
					"<div class='ui-grid-" + ( OSApp.uiState.is24Hour ? "a" : "b" ) + " inputs'>" +
						"<div class='ui-block-a'>" +
							"<input data-wrapper-class='pad_buttons' class='hour dontPad' type='number' pattern='[0-9]*' value='" +
								( OSApp.uiState.is24Hour ? OSApp.Utils.pad( ( opt.minutes / 60 >> 0 ) % 24 ) + "'>" : ( parseInt( opt.minutes / 60 ) % 12 === 0 ? 12 : parseInt( opt.minutes / 60 ) % 12 ) + "'>" ) +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<input data-wrapper-class='pad_buttons' class='minute' type='number' pattern='[0-9]*' value='" +
								OSApp.Utils.pad( opt.minutes % 60 ) + "'>" +
						"</div>" +
						( OSApp.uiState.is24Hour ? "" : "<div class='ui-block-c'>" +
							"<p class='center period'>" + getPeriod() + "</p>" +
						"</div>" ) +
					"</div>" +
					"<fieldset class='ui-grid-" + ( OSApp.uiState.is24Hour ? "a" : "b" ) + " decr'>" +
						"<div class='ui-block-a'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
						( OSApp.uiState.is24Hour ? "" : "<div class='ui-block-c'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" ) +
					"</fieldset>" +
				"</span>" +
				( opt.showSun ? "<div class='ui-grid-a useSun'>" +
					"<div class='ui-block-a'>" +
						"<button class='ui-mini ui-btn rise " + ( type === 1 ? "ui-btn-active" : "" ) + "'>" + OSApp.Language._( "Use Sunrise" ) + "</button>" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<button class='ui-mini ui-btn set " + ( type === 2 ? "ui-btn-active" : "" ) + "'>" + OSApp.Language._( "Use Sunset" ) + "</button>" +
					"</div>" +
				"</div>" +
				"<div class='offsetInput'" + ( type === 0 ? " style='display: none;'" : "" ) + ">" +
					"<h5 class='center tight'>" + OSApp.Language._( "Offset (minutes)" ) + "</h5>" +
					"<div class='input_with_buttons'>" +
						"<button class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
						"<input class='dontPad' type='number' pattern='[0-9]*' value='" + offset + "'>" +
						"<button class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
					"</div>" +
				"</div>" : "" ) +
				( opt.showBack ? "<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" : "" ) +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			if ( pos === 0 || pos === 1 ) {
				var curr = getValue(),
					to = curr + ( dir * ( pos === 0 ? 60 : 1 ) ),
					input = popup.find( ".inputs input" ).eq( pos ),
					isHour = input.hasClass( "hour" ),
					val = parseInt( input.val() );

				if ( dir === 1 ) {
					if ( isHour && ( ( OSApp.uiState.is24Hour && val >= 24 ) || ( !OSApp.uiState.is24Hour && val >= 12 ) ) ) {
						val = 0;
					}
					if ( !isHour && val >= 59 ) {
						val = -1;
						var hour = popup.find( ".hour" ),
							hourFixed = parseInt( hour.val() );

						if ( !OSApp.uiState.is24Hour ) {
							if ( hourFixed === 12 ) {
								hourFixed = 0;
							}

							hour.val( hourFixed + 1 );
						}
					}
				} else if ( isHour && val <= 1 ) {
					val = 13;
				} else if ( !isHour && val <= 0 ) {
					return;
				}

				if ( ( !isPM && to > 719 ) || ( isPM && to < 721 ) || ( isPM && to > 1439 ) || ( !isPM && dir === -1 && to < 0 ) ) {
					isPM = !isPM;
					popup.find( ".period" ).text( getPeriod() );
				}

				val = isHour ? val + dir : OSApp.Utils.pad( val + dir );
				input.val( val );
			} else if ( pos === 2 ) {
				isPM = !isPM;
				popup.find( ".period" ).text( getPeriod() );
			}

			if ( opt.incrementalUpdate ) {
				opt.callback( getValue() );
			}
		},
		getValue = function() {
			var useSun = popup.find( ".useSun" ).find( "button.ui-btn-active" );

			if ( useSun.length === 1 ) {
				var st = 0,
					offset = parseInt( popup.find( ".offsetInput input" ).val() );
				if ( useSun.hasClass( "rise" ) ) {
					if ( offset >= 0 ) {
						st = offset;
					} else {
						st = -offset;
						st |= ( 1 << 12 );
					}

					// Set the sunrise bit
					st |= ( 1 << 14 );
				} else {
					if ( offset >= 0 ) {
						st = offset;
					} else {
						st = -offset;

						// Set the sign bit
						st |= ( 1 << 12 );
					}

					// Set the sunset bit
					st |= ( 1 << 13 );
				}

				return st;
			} else {
				var hour = parseInt( popup.find( ".hour" ).val() );

				if ( !OSApp.uiState.is24Hour ) {
					if ( isPM && hour !== 12 ) {
						hour = hour + 12;
					}

					if ( !isPM && hour === 12 ) {
						hour = 0;
					}
				}

				return ( hour * 60 ) + parseInt( popup.find( ".minute" ).val() );
			}
		};

	popup.find( "button.submit" ).on( "click", function() {
		opt.callback( getValue() );
		popup.popup( "destroy" ).remove();
	} );

	popup.on( "focus", "input[type='number']", function( e ) {
		e.target.value = "";
	} ).on( "blur", "input[type='number']", function( e ) {
		var val = parseInt( e.target.value ) || 0;
		e.target.value = $( e.target ).hasClass( "dontPad" ) ? val : OSApp.Utils.pad( val );
	} );

	OSApp.UIDom.holdButton( popup.find( ".incr" ).children(), function( e ) {
		var button = $( e.currentTarget ),
			pos = button.index();

		if ( button.find( ".ui-disabled" ).length === 0 ) {
			changeValue( pos, 1 );
		}

		return false;
	} );

	OSApp.UIDom.holdButton( popup.find( ".decr" ).children(), function( e ) {
		var button = $( e.currentTarget ),
			pos = button.index();

		if ( button.find( ".ui-disabled" ).length === 0 ) {
			changeValue( pos, -1 );
		}

		return false;
	} );

	if ( opt.showSun ) {
		popup.find( ".useSun" ).on( "click", "button", function() {
			var button = $( this ),
				contraButton = popup.find( ".useSun" ).find( "button" ).not( button ),
				offset = popup.find( ".offsetInput" ),
				timeButtons = popup.find( "span" ).find( ".ui-btn,input,p" );

			contraButton.removeClass( "ui-btn-active" );
			if ( button.hasClass( "ui-btn-active" ) ) {
				button.removeClass( "ui-btn-active" );
				offset.slideUp();

				timeButtons.prop( "disabled", false ).removeClass( "ui-disabled" );
			} else {
				button.addClass( "ui-btn-active" );
				offset.slideDown();

				timeButtons.prop( "disabled", true ).addClass( "ui-disabled" );
			}

			if ( opt.incrementalUpdate ) {
				opt.callback( getValue() );
			}
		} );

		var offsetInput = popup.find( ".offsetInput" ).find( "input" ),
			changeOffset = function( dir ) {
				var val = parseInt( offsetInput.val() );

				if ( ( dir === -1 && val === -240 ) || ( dir === 1 && val === 240 ) ) {
					return;
				}

				offsetInput.val( val + dir );

				if ( opt.incrementalUpdate ) {
					opt.callback( getValue() );
				}
			};

		offsetInput.on( "focus", function() {
			this.value = "";
		} ).on( "blur", function() {
			if ( this.value === "" ) {
				this.value = "0";
			} else if ( this.value > 240 ) {
				this.value = "240";
			} else if ( this.value < -240 ) {
				this.value = "-240";
			}
		} );

		OSApp.UIDom.holdButton( popup.find( ".offsetInput" ).find( ".incr" ), function() {
			changeOffset( 1 );
			return false;
		} );
		OSApp.UIDom.holdButton( popup.find( ".offsetInput" ).find( ".decr" ), function() {
			changeOffset( -1 );
			return false;
		} );
	}

	popup
	.css( "max-width", "350px" )
	.one( "popupafteropen", function() {
		if ( type !== 0 ) {
			popup.find( "span" ).find( ".ui-btn,input,p" ).prop( "disabled", true ).addClass( "ui-disabled" );
		}
	} )
	.one( "popupafterclose", function() {
		if ( opt.incrementalUpdate ) {
			opt.callback( getValue() );
		}
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showDateTimeInput = function( timestamp, callback ) {
	$( "#datetimeInput" ).popup( "destroy" ).remove();

	if ( !( timestamp instanceof Date ) ) {
		timestamp = new Date( timestamp * 1000 );
		timestamp.setMinutes( timestamp.getMinutes() - timestamp.getTimezoneOffset() );
	}

	callback = callback || function() {};

	var keys = [ "Month", "Date", "FullYear", "Hours", "Minutes" ],
		monthNames = [ OSApp.Language._( "Jan" ), OSApp.Language._( "Feb" ), OSApp.Language._( "Mar" ), OSApp.Language._( "Apr" ), OSApp.Language._( "May" ), OSApp.Language._( "Jun" ), OSApp.Language._( "Jul" ),
			OSApp.Language._( "Aug" ), OSApp.Language._( "Sep" ), OSApp.Language._( "Oct" ), OSApp.Language._( "Nov" ), OSApp.Language._( "Dec" ) ],
		popup = $( "<div data-role='popup' id='datetimeInput' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Enter Date/Time" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			timestamp[ "setUTC" + pos ]( timestamp[ "getUTC" + pos ]() + dir );
			callback( new Date( timestamp.getTime() ) );
			updateContent();
		},
		updateContent = function() {
			var incrbts = "<fieldset class='ui-grid-d incr'>",
				inputs = "<div class='ui-grid-d inputs'>",
				decrbts = "<fieldset class='ui-grid-d decr'>",
				val, i;

			for ( i = 0; i < 5; i++ ) {
				val = timestamp[ "getUTC" + keys[ i ] ]();

				if ( keys[ i ] === "Month" ) {
					val = "<p class='center'>" + monthNames[ val ] + "</p>";
				} else if ( keys[ i ] === "Date" ) {
					val = "<p class='center'>" + val + ",</p>";
				} else if ( keys[ i ] === "Hours" ) {
					val = "<p style='width:90%;display:inline-block' class='center'>" + val + "</p><p style='display:inline-block'>:</p>";
				} else {
					val = "<p class='center'>" + val + "</p>";
				}

				incrbts += "<div class='ui-block-" + String.fromCharCode( 97 + i ) + "'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>";
				inputs += "<div id='" + keys[ i ] + "' class='ui-block-" + String.fromCharCode( 97 + i ) + "'>" + val + "</div>";
				decrbts += "<div class='ui-block-" + String.fromCharCode( 97 + i ) + "'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>";
			}

			incrbts += "</fieldset>";
			inputs += "</div>";
			decrbts += "</fieldset>";

			popup.find( ".ui-content" ).html( "<span>" + incrbts + inputs + decrbts + "</span>" ).enhanceWithin();

			popup.find( ".incr" ).children().on( "vclick", function() {
				var pos = $( this ).index();
				changeValue( popup.find( ".inputs" ).children().eq( pos ).attr( "id" ), 1 );
				return false;
			} );

			popup.find( ".decr" ).children().on( "vclick", function() {
				var pos = $( this ).index();
				changeValue( popup.find( ".inputs" ).children().eq( pos ).attr( "id" ), -1 );
				return false;
			} );
	};

	updateContent();

	popup
	.css( "width", "280px" )
	.one( "popupafterclose", function() {
		callback( timestamp );
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showSingleDurationInput = function( opt ) {
	$( "#singleDuration" ).popup( "destroy" ).remove();
	var defaults = {
		data: 0,
		title: OSApp.Language._( "Duration" ),
		minimum: 0,
		label: "",
		updateOnChange: true,
		showBack: true,
		callback: function() {}
	};

	opt = $.extend( {}, defaults, opt );

	var popup = $( "<div data-role='popup' id='singleDuration' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + opt.title + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				( opt.helptext ? "<p class='rain-desc center smaller'>" + opt.helptext + "</p>" : "" ) +
				"<label class='center'>" + opt.label + "</label>" +
				"<div class='input_with_buttons'>" +
					"<button class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
					"<input type='number' pattern='[0-9]*' value='" + opt.data + "'>" +
					"<button class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
				"</div>" +
				( opt.updateOnChange && !opt.showBack ? "" : "<input type='submit' data-theme='b' value='" + OSApp.Language._( "Submit" ) + "'>" ) +
			"</div>" +
		"</div>" ),
		input = popup.find( "input" ),
		reply = function( val ) {
			opt.callback( parseInt( val ).clamp( opt.minimum, opt.maximum ) );
		},
		changeValue = function( dir ) {
			var val = parseInt( input.val() );

			if ( ( dir === -1 && val === opt.minimum ) || ( dir === 1 && val === opt.maximum ) ) {
				return;
			}

			input.val( val + dir );
			if ( opt.updateOnChange ) {
				reply( val + dir );
			}
		};

	OSApp.UIDom.holdButton( popup.find( ".incr" ), function() {
		changeValue( 1 );
		return false;
	} );
	OSApp.UIDom.holdButton( popup.find( ".decr" ), function() {
		changeValue( -1 );
		return false;
	} );

	popup.find( "input[type='number']" ).on( "focus", function() {
		this.value = "";
	} ).on( "blur", function() {
		if ( this.value === "" ) {
			this.value = "0";
		}
	} );

	popup.find( "input[type='submit']" ).on( "click", function() {
		reply( input.val() );
		popup.popup( "destroy" ).remove();
	} );

	popup
	.one( "popupafterclose", function() {
		if ( opt.updateOnChange ) {
			reply( input.val() );
		}
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showDurationBox = function( opt ) {
	var defaults = {
			seconds: 0,
			title: OSApp.Language._( "Duration" ),
			granularity: 0,
			preventCompression: false,
			incrementalUpdate: false,
			showBack: true,
			showSun: false,
			minimum: 0,
			callback: function() {}
		},
		type = 0;

	opt = $.extend( {}, defaults, opt );

	$( "#durationBox" ).popup( "destroy" ).remove();

	opt.seconds = parseInt( opt.seconds );

	if ( opt.seconds === 65535 ) {
		type = 1;
		opt.seconds = 0;
	} else if ( opt.seconds === 65534 ) {
		type = 2;
		opt.seconds = 0;
	}

	if ( OSApp.Firmware.checkOSVersion( 217 ) ) {
		opt.preventCompression = true;
	}

	var keys = [ "days", "hours", "minutes", "seconds" ],
		text = [ OSApp.Language._( "Days" ), OSApp.Language._( "Hours" ), OSApp.Language._( "Minutes" ), OSApp.Language._( "Seconds" ) ],
		conv = [ 86400, 3600, 60, 1 ],
		max = [ 0, 23, 59, 59 ],
		total = 4 - opt.granularity,
		start = 0,
		arr = OSApp.Dates.sec2dhms( opt.seconds ),
		i;

	if ( !opt.preventCompression && ( OSApp.Firmware.checkOSVersion( 210 ) && opt.maximum > 64800 ) ) {
		opt.maximum = OSApp.Firmware.checkOSVersion( 214 ) ? 57600 : 64800;
	}

	if ( opt.maximum ) {
		for ( i = conv.length - 1; i >= 0; i-- ) {
			if ( opt.maximum < conv[ i ] ) {
				start = i + 1;
				total = ( conv.length - start ) - opt.granularity;
				break;
			}
		}
	}

	var incrbts = "<fieldset class='ui-grid-" + String.fromCharCode( 95 + ( total ) ) + " incr'>",
		inputs = "<div class='ui-grid-" + String.fromCharCode( 95 + ( total ) ) + " inputs'>",
		decrbts = "<fieldset class='ui-grid-" + String.fromCharCode( 95 + ( total ) ) + " decr'>",
		popup = $( "<div data-role='popup' id='durationBox' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + opt.title + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				( opt.helptext ? "<p class='rain-desc center smaller'>" + opt.helptext + "</p>" : "" ) +
				"<span>" +
				"</span>" +
				( opt.showSun ? "<div class='ui-grid-a useSun'>" +
					"<div class='ui-block-a'>" +
						"<button value='65534' class='ui-mini ui-btn rise " + ( type === 2 ? "ui-btn-active" : "" ) + "'>" + OSApp.Language._( "Sunrise to Sunset" ) + "</button>" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<button value='65535' class='ui-mini ui-btn set " + ( type === 1 ? "ui-btn-active" : "" ) + "'>" + OSApp.Language._( "Sunset to Sunrise" ) + "</button>" +
					"</div>" +
				"</div>" : "" ) +
				( opt.showBack ? "<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" : "" ) +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			var input = popup.find( ".inputs input" ).eq( pos ),
				apos = pos + start,
				val = parseInt( input.val() );

			if ( input.prop( "disabled" ) ) {
				return;
			}

			if ( ( dir === -1 && ( getValue() <= opt.minimum || val <= 0 ) ) || ( dir === 1 && ( getValue() + conv[ apos ] ) > opt.maximum ) ) {
				return;
			}

			// Increment next time field on current max
			if ( ( max[ apos ] !== 0 && pos !== 0 && Math.abs( val ) >= max[ apos ] ) ) {
				input.val( 0 );
				input = popup.find( ".inputs input" ).eq( pos - 1 );
				val = parseInt( input.val() );
			}

			input.val( val + dir );
			if ( opt.incrementalUpdate ) {
				opt.callback( getValue() );
			}

			if ( !opt.preventCompression && OSApp.Firmware.checkOSVersion( 210 ) ) {
				var state = ( dir === 1 ) ? true : false;

				if ( dir === 1 ) {
					if ( getValue() >= 60 ) {
						toggleInput( "seconds", state );
					}
					if ( getValue() >= 10800 ) {
						toggleInput( "minutes", state );
					}
				} else if ( dir === -1 ) {
					if ( getValue() <= -60 ) {
						toggleInput( "seconds", !state );
					} else if ( getValue() <= -10800 ) {
						toggleInput( "minutes", !state );
					} else if ( getValue() < 60 ) {
						toggleInput( "seconds", state );
					} else if ( getValue() < 10800 ) {
						toggleInput( "minutes", state );
					}
				}
			}
		},
		getValue = function() {
			var useSun = popup.find( ".useSun" ).find( "button.ui-btn-active" );

			if ( useSun.length === 1 ) {
				return parseInt( useSun.val() );
			} else {
				return OSApp.Dates.dhms2sec( {
					"days": parseInt( popup.find( ".days" ).val() ) || 0,
					"hours": parseInt( popup.find( ".hours" ).val() ) || 0,
					"minutes": parseInt( popup.find( ".minutes" ).val() ) || 0,
					"seconds": parseInt( popup.find( ".seconds" ).val() ) || 0
				} );
			}
		},
		toggleInput = function( field, state ) {
			popup.find( "." + field ).toggleClass( "ui-state-disabled", state ).prop( "disabled", state ).val( function() {
				if ( state ) {
					return 0;
				} else {
					return this.value;
				}
			} ).parent( ".ui-input-text" ).toggleClass( "ui-state-disabled", state );
		};

	for ( i = start; i < conv.length - opt.granularity; i++ ) {
		incrbts += "<div " + ( ( total > 1 ) ? "class='ui-block-" + String.fromCharCode( 97 + i - start ) + "'" : "" ) + ">" +
			"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>";
		inputs += "<div " + ( ( total > 1 ) ? "class='ui-block-" + String.fromCharCode( 97 + i - start ) + "'" : "" ) + "><label class='center'>" +
			OSApp.Language._( text[ i ] ) + "</label><input data-wrapper-class='pad_buttons' class='" + keys[ i ] + "' type='number' pattern='[0-9]*' value='" +
			arr[ keys[ i ] ] + "'></div>";
		decrbts += "<div " + ( ( total > 1 ) ? "class='ui-block-" + String.fromCharCode( 97 + i - start ) + "'" : "" ) +
			"><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>";
	}

	incrbts += "</fieldset>";
	inputs += "</div>";
	decrbts += "</fieldset>";

	popup.find( "span" ).prepend( incrbts + inputs + decrbts );

	popup.find( "button.submit" ).on( "click", function() {
		opt.callback( getValue() );
		popup.popup( "destroy" ).remove();
	} );

	if ( !opt.preventCompression && OSApp.Firmware.checkOSVersion( 210 ) ) {
		if ( opt.seconds <= -60 ) {
			toggleInput( "seconds", true );
		}

		if ( opt.seconds <= -10800 ) {
			toggleInput( "minutes", true );
		}

		if ( opt.seconds >= 60 ) {
			toggleInput( "seconds", true );
		}

		if ( opt.seconds >= 10800 ) {
			toggleInput( "minutes", true );
		}
	}

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {
		if ( this.value === "" ) {
			this.value = "0";
		}
	} );

	OSApp.UIDom.holdButton( popup.find( ".incr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, 1 );
		return false;
	} );

	OSApp.UIDom.holdButton( popup.find( ".decr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, -1 );
		return false;
	} );

	if ( opt.showSun ) {
		popup.find( ".useSun" ).on( "click", "button", function() {
			var button = $( this ),
				contraButton = popup.find( ".useSun" ).find( "button" ).not( button ),
				timeButtons = popup.find( "span" ).find( ".ui-btn,input" );

			contraButton.removeClass( "ui-btn-active" );
			if ( button.hasClass( "ui-btn-active" ) ) {
				button.removeClass( "ui-btn-active" );
				timeButtons.prop( "disabled", false ).removeClass( "ui-disabled" );
			} else {
				button.addClass( "ui-btn-active" );
				timeButtons.prop( "disabled", true ).addClass( "ui-disabled" );
			}

			if ( opt.incrementalUpdate ) {
				opt.callback( getValue() );
			}
		} );
	}

	popup
	.css( "max-width", "350px" )
	.one( "popupafteropen", function() {
		if ( type !== 0 ) {
			popup.find( "span" ).find( ".ui-btn,input" ).prop( "disabled", true ).addClass( "ui-disabled" );
		}
	} )
	.one( "popupafterclose", function() {
		if ( opt.incrementalUpdate ) {
			opt.callback( getValue() );
		}
	} );

	OSApp.UIDom.openPopup( popup );
};

// Accessory functions for jQuery Mobile
OSApp.UIDom.areYouSure = function( text1, text2, success, fail, options ) {
	$( "#sure" ).popup( "destroy" ).remove();
	success = success || function() {};
	fail = fail || function() {};

	var showShiftDialog = 0;
	if ( typeof options === "object" ) {
		showShiftDialog = ( options.type === OSApp.Constants.dialog.REMOVE_STATION ) &&
			OSApp.Groups.canShift( options.gid ) && OSApp.Stations.isSequential( options.station );
	}

	var popup = $(
		"<div data-role='popup' data-theme='a' id='sure'>" +
			"<h3 class='sure-1 center'>" + text1 + "</h3>" +
			"<p class='sure-2 center'>" + text2 + "</p>" +
			"<a class='sure-do ui-btn ui-btn-b ui-corner-all ui-shadow' href='#'>" + OSApp.Language._( "Yes" ) + "</a>" +
			"<a class='sure-dont ui-btn ui-corner-all ui-shadow' href='#'>" + OSApp.Language._( "No" ) + "</a>" +
			( showShiftDialog ? "<label><input id='shift-sta' type='checkbox'>Move up remaining stations in the same sequential group?</label>" : "" ) +
		"</div>"
	);

	//Bind buttons
	popup.find( ".sure-do" ).one( "click.sure", function() {
		popup.popup( "close" );
		success();
		return false;
	} );
	popup.find( ".sure-dont" ).one( "click.sure", function() {
		popup.popup( "close" );
		fail();
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showIPRequest = function( opt ) {
	var defaults = {
			title: OSApp.Language._( "Enter IP Address" ),
			ip: [ 0, 0, 0, 0 ],
			showBack: true,
			callback: function() {}
		};

	opt = $.extend( {}, defaults, opt );

	$( "#ipInput" ).popup( "destroy" ).remove();

	var popup = $( "<div data-role='popup' id='ipInput' data-theme='a'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + opt.title + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<span>" +
					"<fieldset class='ui-grid-c incr'>" +
						"<div class='ui-block-a'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-b'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-c'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-d'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>" +
					"</fieldset>" +
					"<div class='ui-grid-c inputs'>" +
						"<div class='ui-block-a'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='" + opt.ip[ 0 ] + "'></div>" +
						"<div class='ui-block-b'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='" + opt.ip[ 1 ] + "'></div>" +
						"<div class='ui-block-c'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='" + opt.ip[ 2 ] + "'></div>" +
						"<div class='ui-block-d'><input data-wrapper-class='pad_buttons' class='ip_addr' type='number' pattern='[0-9]*' max='255' value='" + opt.ip[ 3 ] + "'></div>" +
					"</div>" +
					"<fieldset class='ui-grid-c decr'>" +
						"<div class='ui-block-a'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-b'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-c'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
						"<div class='ui-block-d'><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>" +
					"</fieldset>" +
				"</span>" +
				( opt.showBack ? "<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" : "" ) +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			var input = popup.find( ".inputs input" ).eq( pos ),
				val = parseInt( input.val() );

			if ( ( dir === -1 && val === 0 ) || ( dir === 1 && val >= 255 ) ) {
				return;
			}

			input.val( val + dir );
			opt.callback( getIP() );
		},
		getIP = function() {
			return $.makeArray( popup.find( ".ip_addr" ).map( function() {return parseInt( $( this ).val() );} ) );
		};

	popup.find( "button.submit" ).on( "click", function() {
		opt.callback( getIP() );
		popup.popup( "destroy" ).remove();
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {
		if ( this.value === "" ) {
			this.value = "0";
		}
	} );

	OSApp.UIDom.holdButton( popup.find( ".incr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, 1 );
		return false;
	} );

	OSApp.UIDom.holdButton( popup.find( ".decr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, -1 );
		return false;
	} );

	popup
	.css( "max-width", "350px" )
	.one( "popupafterclose", function() {
		opt.callback( getIP() );
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.UIDom.showPause = function() {
	if ( OSApp.StationQueue.isPaused() ) {
		if( !OSApp.Supported.changePause() ){
			OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to resume program operation?" ), "", function() {
				OSApp.Firmware.sendToOS( "/pq?dur=0&pw=" ).done( function() {
					setTimeout( OSApp.Status.refreshStatus, 1000 );
				} );
			} );
			return;
		}

		var popup = $("<div data-role='popup' data-theme='a' id='changePause'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Change Pause" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<button class='new-pause-function' style='display:inline-block;' data-mini='true' id='extend-pause'>Extend</button>" +
				"<button class='new-pause-function' style='display:inline-block;' data-mini='true' id='new-pause'>Replace</button>" +
				"<button style='display:inline-block;' data-mini='true' id='un-pause'>Unpause</button>" +
			"</div>" +
		"</div>" );

		popup.find("#extend-pause").on("click", function() {
			popup.popup( "close" );
			OSApp.UIDom.showDurationBox( {
				title: "Extend Current Pause By",
				incrementalUpdate: false,
				maximum: 65535,
				callback: function( duration ) {
					var dur = duration;
					dur += OSApp.currentSession.controller.settings.pt;
					OSApp.Firmware.sendToOS( "/pq?repl=" + dur + "&pw=" ).done( function() {
						setTimeout( OSApp.Status.refreshStatus, 1000 ); // FIXME: refactor this 1000 value out to Constants or config/settings
					} );
				}
			} );
		} );

		popup.find("#new-pause").on("click", function() {
			popup.popup( "close" );
			OSApp.UIDom.showDurationBox( {
				title: "Replace Current Pause By",
				incrementalUpdate: false,
				maximum: 65535,
				callback: function( duration ) {
					OSApp.Firmware.sendToOS( "/pq?repl=" + duration + "&pw=" ).done( function() {
						setTimeout( OSApp.Status.refreshStatus, 1000 );
					} );
				}
			} );
		} );

		popup.find("#un-pause").on("click", function() {
			popup.popup( "close" );
			OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to resume program operation?" ), "", function() {
				OSApp.Firmware.sendToOS( "/pq?repl=0&pw=" ).done( function(){
					setTimeout( OSApp.Status.refreshStatus, 1000 );
				} );
			} );
		} );

		OSApp.UIDom.openPopup( $( popup ) );
	} else {
		OSApp.UIDom.showDurationBox( {
			title: "Pause Station Runs For",
			incrementalUpdate: false,
			maximum: 65535,
			callback: function( duration ) {
				OSApp.Firmware.sendToOS( "/pq?dur=" + duration + "&pw=" );
			}
		} );
	}
};

// Handle timer update on the home page and status bar
OSApp.UIDom.updateTimers = function() {
	var lastCheck = new Date().getTime();

	setInterval( function() {

		if ( !OSApp.currentSession.isControllerConnected() ) {
			return false;
		}

		// Handle time drift
		var now = new Date().getTime(),
			diff = now - lastCheck;

		if ( diff > 2000 ) {
			OSApp.Status.checkStatus();
			OSApp.Status.refreshStatus();
		}

		lastCheck = now;

		// If no timers are defined then exit
		if ( $.isEmptyObject( OSApp.uiState.timers ) ) {
			return;
		}

		for ( var timer in OSApp.uiState.timers ) {
			if ( Object.prototype.hasOwnProperty.call(OSApp.uiState.timers,  timer ) ) {
				if ( OSApp.uiState.timers[ timer ].val <= 0 ) {
					if ( timer === "statusbar" ) {
						OSApp.UIDom.showLoading( "#footer-running" );
						OSApp.Status.refreshStatus();
					}

					if ( typeof OSApp.uiState.timers[ timer ].done === "function" ) {
						OSApp.uiState.timers[ timer ].done();
					}

					delete OSApp.uiState.timers[ timer ];
				} else {
					if ( timer === "clock" ) {
						++OSApp.uiState.timers[ timer ].val;
						OSApp.uiState.timers[ timer ].update();
					} else if ( timer === "statusbar" || typeof OSApp.uiState.timers[ timer ].station === "number" ) {
						--OSApp.uiState.timers[ timer ].val;
						OSApp.uiState.timers[ timer ].update();
					}
				}
			}
		}
	}, 1000 ); // FIXME: refactor the 1000 value out to Constants or settings/config
};

// Handle main switches for manual mode
OSApp.UIDom.flipSwitched = function() {
	if ( OSApp.uiState.switching ) {
		return;
	}

	//Find out what the switch was changed to
	var flip = $( this ),
		id = flip.attr( "id" ),
		changedTo = flip.is( ":checked" ),
		method = ( id === "mmm" ) ? "mm" : id,
		defer;

	if ( changedTo ) {
		defer = OSApp.Firmware.sendToOS( "/cv?pw=&" + method + "=1" );
	} else {
		defer = OSApp.Firmware.sendToOS( "/cv?pw=&" + method + "=0" );
	}

	$.when( defer ).then( function() {
		OSApp.Status.refreshStatus();
		if ( id === "mmm" ) {
			$( "#mm_list .green" ).removeClass( "green" );
		}
		OSApp.Status.checkStatus();
	},
	function() {
		OSApp.uiState.switching = true;
		setTimeout( function() {
			OSApp.uiState.switching = false;
		}, 200 );
		flip.prop( "checked", !changedTo ).flipswitch( "refresh" );
	} );
};

OSApp.UIDom.clearPrograms = function( callback ) {
	callback = callback || function() {};
	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete ALL programs?" ), "", function() {
		var url = "/dp?pw=&pid=-1";
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( url ).done( function() {
			if ( typeof callback === "function" ) {
				callback();
			}
			OSApp.Errors.showError( OSApp.Language._( "Programs have been deleted" ) );
		} );
	} );
};

OSApp.UIDom.resetAllOptions = function( callback ) {
	callback = callback || function() {};
	OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete all settings and return to the default settings?" ), "", function() {
		var co;

		if ( OSApp.Firmware.isOSPi() ) {
			co = "otz=32&ontp=1&onbrd=0&osdt=0&omas=0&omton=0&omtoff=0&orst=1&owl=100&orlp=0&ouwt=0&olg=1&oloc=Boston,MA";
		} else {
			co = "o2=1&o3=1&o12=80&o13=0&o15=0&o17=0&o18=0&o19=0&o20=0&o22=1&o23=100&o26=0&o27=110&o28=100&o29=15&" +
				"o30=320&o31=0&o36=1&o37=0&o38=0&o39=0&o41=100&o42=0&o43=0&o44=8&o45=8&o46=8&o47=8&" +
				"o48=0&o49=0&o50=0&o51=1&o52=0&o53=1&o54=0&o55=0&o56=0&o57=0&";
			if ( OSApp.Firmware.checkOSVersion( 2199 ) ) {
				co += "o32=0&o33=0&o34=0&o35=0&"; // For newer firmwares, resets ntp to 0.0.0.0
			} else {
				co += "o32=216&o33=239&o34=35&o35=12&"; // Time.google.com
			}
			co += "loc=Boston,MA&wto=%22key%22%3A%22%22";

			co = OSApp.Utils.transformKeysinString( co );
		}

		OSApp.Firmware.sendToOS( "/co?pw=&" + co ).done( function() {
			if ( typeof callback === "function" ) {
				callback();
			}
			OSApp.Sites.updateController( OSApp.Weather.updateWeather );
		} );
	} );
};

OSApp.UIDom.updateLoginButtons = function() {
	var page = $( ".ui-page-active" );

	OSApp.Storage.get( "cloudToken", function( data ) {
		var login = $( ".login-button" ),
			logout = $( ".logout-button" );

		if ( data.cloudToken === null || data.cloudToken === undefined ) {
			login.removeClass( "hidden" );

			if ( !OSApp.currentSession.local ) {
				logout.addClass( "hidden" );
			}

			logout.find( "a" ).text( OSApp.Language._( "Logout" ) );

			if ( page.attr( "id" ) === "site-control" ) {
				page.find( ".logged-in-alert" ).remove();
			}
		} else {
			logout.removeClass( "hidden" ).find( "a" ).text( OSApp.Language._( "Logout" ) + " (" + OSApp.Network.getTokenUser( data.cloudToken ) + ")" );
			login.addClass( "hidden" );

			if ( page.attr( "id" ) === "site-control" && page.find( ".logged-in-alert" ).length === 0 ) {
				page.find( ".ui-content" ).prepend( OSApp.Network.addSyncStatus( data.cloudToken ) );
			}
		}
	} );
};

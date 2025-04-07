/* global $, md5 */

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
OSApp.Sites = OSApp.Sites || {};

OSApp.Sites.displayPage = function() {
	var page = $( "<div data-role='page' id='site-control'>" +
			"<div class='ui-content'>" +
			"</div>" +
			"</div>" ),
		makeStart = function() {
			var finish = function() {
				header.eq( 0 ).hide();
				$( "#header" ).show();
				$( "#footer, #footer-menu" ).hide();
			};

			if ( page.hasClass( "ui-page-active" ) ) {
				finish();
			} else {
				page.one( "pagebeforeshow", function( e ) {
					e.stopImmediatePropagation();
					finish();
				} );
			}

			page.on( "swiperight swipeleft", function( e ) {
				e.stopImmediatePropagation();
			} );

			document.title = "OpenSprinkler";
		},
		popup = $( "<div data-role='popup' id='addsite' data-theme='b'>" +
			"<ul data-role='listview'>" +
			"<li data-icon='false'>" +
			"<a href='#' id='site-add-scan'>" + OSApp.Language._( "Scan For Device" ) + "</a>" +
			"</li>" +
			"<li data-icon='false'>" +
			"<a href='#' id='site-add-manual'>" + OSApp.Language._( "Manually Add Device" ) + "</a>" +
			"</li>" +
			"</ul>" +
			"</div>" ),
		sites, header, total;

	popup.find( "#site-add-scan" ).on( "click", function() {
		popup.popup( "close" );
		OSApp.Network.startScan();
		return false;
	} );

	popup.find( "#site-add-manual" ).on( "click", function() {
		OSApp.Sites.showAddNew( false, true );
		return false;
	} );

	page.on( "pagehide", function() {
		popup.popup( "destroy" ).detach();
		page.detach();
	} );

	$( "html" ).on( "siterefresh", function() {
		if ( page.hasClass( "ui-page-active" ) ) {
			updateContent();
		}
	} );

	function updateContent() {
		OSApp.Storage.get( [ "sites", "current_site", "cloudToken" ], function( data ) {
			sites = OSApp.Sites.parseSites( data.sites );

			if ( $.isEmptyObject( sites ) ) {
				if ( typeof data.cloudToken !== "string" ) {
					OSApp.UIDom.changePage( "#start" );

					return;
				} else {
					makeStart();
					page.find( ".ui-content" ).html( "<p class='center'>" +
						OSApp.Language._( "Please add a site by tapping the 'Add' button in the top right corner." ) +
						"</p>" );
				}
			} else {
				var list = "<div data-role='collapsible-set'>",
					siteNames = [],
					i = 0;

				total = Object.keys( sites ).length;

				if ( !OSApp.currentSession.isControllerConnected() || !total || !( data.current_site in sites ) ) {
					makeStart();
				}

				sites = OSApp.Utils.sortObj( sites );

				$.each( sites, function( a, b ) {
					siteNames.push( a );

					a = OSApp.Utils.htmlEscape( a );

					list += "<fieldset " + ( ( total === 1 ) ? "data-collapsed='false'" : "" ) + " id='site-" + i + "' data-role='collapsible'>" +
						"<h3>" +
						"<a class='ui-btn ui-btn-corner-all connectnow yellow' data-site='" + i + "' href='#'>" +
						OSApp.Language._( "connect" ) +
						"</a>" +
						a + "</h3>" +
						"<form data-site='" + i + "' novalidate>" +
						"<div class='ui-field-contain'>" +
						"<label for='cnm-" + i + "'>" + OSApp.Language._( "Change Name" ) + "</label><input id='cnm-" + i + "' type='text' value='" + a + "'>" +
						"</div>" +
						( b.os_token ? "" : "<div class='ui-field-contain'>" +
							"<label for='cip-" + i + "'>" + OSApp.Language._( "Change IP" ) + "</label><input id='cip-" + i + "' type='url' value='" + b.os_ip +
							"' autocomplete='off' autocorrect='off' autocapitalize='off' pattern='' spellcheck='false'>" +
							"</div>" ) +
						( b.os_token ? "<div class='ui-field-contain'>" +
							"<label for='ctoken-" + i + "'>" + OSApp.Language._( "Change Token" ) + "</label><input id='ctoken-" + i + "' type='text' value='" + b.os_token +
							"' autocomplete='off' autocorrect='off' autocapitalize='off' pattern='' spellcheck='false'>" +
							"</div>" : "" ) +
						"<div class='ui-field-contain'>" +
						"<label for='cpw-" + i + "'>" + OSApp.Language._( "Change Password" ) + "</label><input id='cpw-" + i + "' type='password'>" +
						"</div>" +
						( b.os_token ? "" : "<fieldset data-mini='true' data-role='collapsible'>" +
							"<h3>" +
							"<span style='line-height:23px'>" + OSApp.Language._( "Advanced" ) + "</span>" +
							"<button data-helptext='" +
							OSApp.Language._( "These options are only for an OpenSprinkler behind a proxy capable of SSL and/or Basic Authentication." ) +
							"' class='collapsible-button-right help-icon btn-no-border ui-btn ui-icon-info ui-btn-icon-notext'></button>" +
							"</h3>" +
							"<label for='usessl-" + i + "'>" +
							"<input data-mini='true' type='checkbox' id='usessl-" + i + "' name='usessl-" + i + "'" +
							( typeof b.ssl !== "undefined" && b.ssl === "1" ? " checked='checked'" : "" ) + ">" +
							OSApp.Language._( "Use SSL" ) +
							"</label>" +
							"<label for='useauth-" + i + "'>" +
							"<input class='useauth' data-user='" + b.auth_user + "' data-pw='" + b.auth_pw +
							"' data-mini='true' type='checkbox' id='useauth-" + i + "' name='useauth-" + i + "'" +
							( typeof b.auth_user !== "undefined" && typeof b.auth_pw !== "undefined" ? " checked='checked'" : "" ) + ">" +
							OSApp.Language._( "Use Auth" ) +
							"</label>" +
							"</fieldset>" ) +
						"<input class='submit' type='submit' value='" + OSApp.Language._( "Save Changes to" ) + " " + a + "'>" +
						"<a data-role='button' class='deletesite' data-site='" + i + "' href='#' data-theme='b'>" + OSApp.Language._( "Delete" ) + " " + a + "</a>" +
						"</form>" +
						"</fieldset>";

					OSApp.Sites.testSite( b, i, function( id, result ) {
						page.find( "#site-" + id + " .connectnow" )
							.removeClass( "yellow" )
							.addClass( result ? "green" : "red" );
					} );

					i++;
				} );

				list = $( list + "</div>" );

				list.find( "form" ).one( "change input", function() {
					$( this ).find( ".submit" ).addClass( "hasChanges" );
				} );

				list.find( ".connectnow" ).on( "click", function() {
					OSApp.Sites.updateSite( siteNames[ $( this ).data( "site" ) ] );
					return false;
				} );

				list.find( ".help-icon" ).on( "click", OSApp.UIDom.showHelpText );

				list.find( ".useauth" ).on( "change", function() {
					var el = $( this );

					if ( el.is( ":checked" ) ) {
						var popup = $( "<div data-role='popup' data-theme='a'>" +
								"<form method='post' class='ui-content' novalidate>" +
								"<label for='auth_user'>" + OSApp.Language._( "Username:" ) + "</label>" +
								"<input autocomplete='off' autocorrect='off' autocapitalize='off' " +
								"spellcheck='false' type='text' name='auth_user' id='auth_user'>" +
								"<label for='auth_pw'>" + OSApp.Language._( "Password:" ) + "</label>" +
								"<input type='password' name='auth_pw' id='auth_pw'>" +
								"<input type='submit' class='submit' value='" + OSApp.Language._( "Submit" ) + "'>" +
								"</form>" +
								"</div>" ).enhanceWithin(),
							didSubmit = false;

						popup.find( ".submit" ).on( "click", function() {
							el.data( {
								user: popup.find( "#auth_user" ).val(),
								pw: popup.find( "#auth_pw" ).val()
							} );

							didSubmit = true;
							popup.popup( "close" );
							return false;
						} );

						popup.one( "popupafterclose", function() {
							if ( !didSubmit ) {
								el.attr( "checked", false ).checkboxradio( "refresh" );
							}
						} );

						OSApp.UIDom.openPopup( popup );
					} else {
						el.data( {
							user: "",
							pw: ""
						} );
					}
				} );

				list.find( "form" ).on( "submit", function() {
					var form = $( this ),
						id = form.data( "site" ),
						site = siteNames[ id ],
						ip = list.find( "#cip-" + id ).val(),
						pw = list.find( "#cpw-" + id ).val(),
						nm = list.find( "#cnm-" + id ).val(),
						useauth = list.find( "#useauth-" + id ).is( ":checked" ),
						usessl = list.find( "#usessl-" + id ).is( ":checked" ) ? "1" : undefined,
						authUser = list.find( "#useauth-" + id ).data( "user" ),
						authPass = list.find( "#useauth-" + id ).data( "pw" ),
						needsReconnect = ( ip !== "" && ip !== sites[ site ].os_ip ) ||
							usessl !== sites[ site ].ssl ||
							authUser !== sites[ site ].auth_user ||
							authPass !== sites[ site ].auth_pw,
						isCurrent = ( site === data.current_site ),
						rename = ( nm !== "" && nm !== site );

					form.find( ".submit" ).removeClass( "hasChanges" );

					if ( useauth ) {
						sites[ site ].auth_user = authUser;
						sites[ site ].auth_pw = authPass;
					} else {
						delete sites[ site ].auth_user;
						delete sites[ site ].auth_pw;
					}

					if ( usessl === "1" ) {
						sites[ site ].ssl = usessl;
					} else {
						delete sites[ site ].ssl;
					}

					if ( ip !== "" && ip !== sites[ site ].os_ip ) {
						sites[ site ].os_ip = ip;
					}
					if ( pw !== "" && pw !== sites[ site ].os_pw ) {
						if ( OSApp.Utils.isMD5( sites[ site ].os_pw ) ) {
							pw = md5( pw );
						}
						sites[ site ].os_pw = pw;
					}
					if ( rename ) {
						sites[ nm ] = sites[ site ];
						delete sites[ site ];
						site = nm;
						if ( isCurrent ) {
							OSApp.Storage.set( { "current_site": site } );
							data.current_site = site;
						}
						OSApp.Sites.updateSiteList( Object.keys( sites ), data.current_site );

						//OSApp.Firmware.sendToOS( "/cv?pw=&cn=" + data.current_site );
					}

					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );

					OSApp.Errors.showError( OSApp.Language._( "Site updated successfully" ) );

					if ( site === data.current_site ) {
						if ( pw !== "" ) {
							OSApp.currentSession.pass = pw;
						}
						if ( needsReconnect ) {
							OSApp.Sites.checkConfigured();
						}
					}

					if ( rename && !form.find( ".submit" ).hasClass( "preventUpdate" ) ) {
						updateContent();
					}

					return false;
				} );

				list.find( ".deletesite" ).on( "click", function() {
					var site = siteNames[ $( this ).data( "site" ) ];
					OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete " ) + site + "?", "", function() {
						if ( $( "#site-selector" ).val() === site ) {
							makeStart();
						}

						delete sites[ site ];
						OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, function() {
							OSApp.Network.cloudSaveSites();
							OSApp.Sites.updateSiteList( Object.keys( sites ), data.current_site );
							if ( $.isEmptyObject( sites ) ) {
								OSApp.Storage.get( "cloudToken", function() {
									if ( data.cloudToken === null || data.cloudToken === undefined ) {
										OSApp.currentSession.ip = "";
										OSApp.currentSession.pass = "";
										OSApp.UIDom.changePage( "#start" );
										return;
									}
								} );
							} else {
								updateContent();
								OSApp.Errors.showError( OSApp.Language._( "Site deleted successfully" ) );
							}
							return false;
						} );
					} );
					return false;
				} );

				page.find( ".ui-content" ).html( list.enhanceWithin() );
			}

			if ( typeof data.cloudToken === "string" ) {
				page.find( ".ui-content" ).prepend( OSApp.Network.addSyncStatus( data.cloudToken ) );

			}
		} );
	}

	function begin() {
		header = OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "Manage Sites" ),
			animate: OSApp.currentSession.isControllerConnected() ? true : false,
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: function() {
					page.find( ".hasChanges" ).addClass( "preventUpdate" );
					OSApp.UIDom.checkChangesBeforeBack();
				}
			},
			rightBtn: {
				icon: "plus",
				text: OSApp.Language._( "Add" ),
				on: function() {
					if ( typeof OSApp.currentDevice.deviceIp === "undefined" ) {
						OSApp.Sites.showAddNew();
					} else {
						popup.popup( "open" ).popup( "reposition", {
							positionTo: header.eq( 2 )
						} );
					}
				}
			}
		} );

		updateContent();

		$.mobile.pageContainer.append( popup );

		popup.popup( {
			history: false,
			positionTo: header.eq( 2 )
		} ).enhanceWithin();

		$( "#site-control" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
};

OSApp.Sites.testSite = function( site, id, callback ) {
	callback = callback || function() {};
	var urlDest = "/jo?pw=" + encodeURIComponent( site.os_pw ),
		url = site.os_token ? "https://cloud.openthings.io/forward/v1/" + site.os_token + urlDest : ( site.ssl === "1" ? "https://" : "http://" ) + site.os_ip + urlDest;

	$.ajax( {
		url: url,
		type: "GET",
		dataType: "json",
		beforeSend: function( xhr ) {
			if ( typeof site.auth_user !== "undefined" && typeof site.auth_pw !== "undefined" ) {
				xhr.setRequestHeader( "Authorization", "Basic " + btoa( site.auth_user + ":" + site.auth_pw ) );
			}
		}
	} ).then(
		function() {
			callback( id, true );
		},
		function() {
			callback( id, false );
		}
	);
};

// Update the panel list of sites
OSApp.Sites.updateSiteList = function( names, current ) {
	var list = "",
		select = $( "#site-selector" );

	$.each( names, function() {
		list += "<option " + ( this.toString() === current ? "selected " : "" ) + "value='" + OSApp.Utils.htmlEscape( this ) + "'>" + this + "</option>";
	} );

	$( "#info-list" ).find( "li[data-role='list-divider']" ).text( current );

	select.html( list );
	if ( select.parent().parent().hasClass( "ui-select" ) ) {
		select.selectmenu( "refresh" );
	}
};

OSApp.Sites.findLocalSiteName = function( sites, callback ) {
	callback = callback || function() {};
	for ( var site in sites ) {
		if ( Object.prototype.hasOwnProperty.call(sites,  site ) ) {
			if ( OSApp.currentSession.ip.indexOf( sites[ site ].os_ip ) !== -1 ) {
				callback( site );
				return;
			}
		}
	}

	callback( false );
};

// Multi site functions
OSApp.Sites.checkConfigured = function( firstLoad ) {
	OSApp.Storage.get( [ "sites", "current_site", "cloudToken" ], function( data ) {
		var sites = data.sites,
			current = data.current_site,
			names;

		sites = OSApp.Sites.parseSites( sites );

		names = Object.keys( sites );

		if ( !names.length ) {
			if ( firstLoad ) {
				if ( data.cloudToken === undefined || data.cloudToken === null ) {
					OSApp.UIDom.changePage( "#start", {
						transition: "none"
					} );
				} else {
					OSApp.UIDom.changePage( "#site-control", {
						transition: "none"
					} );
				}
			}
			return;
		}

		if ( current === null || !( current in sites ) ) {
			$.mobile.loading( "hide" );
			OSApp.UIDom.changePage( "#site-control", {
				transition: firstLoad ? "none" : undefined
			} );
			return;
		}

		OSApp.Sites.updateSiteList( names, current );

		OSApp.currentSession.token = sites[ current ].os_token;

		OSApp.currentSession.ip = sites[ current ].os_ip;
		OSApp.currentSession.pass = sites[ current ].os_pw;

		if ( typeof sites[ current ].ssl !== "undefined" && sites[ current ].ssl === "1" ) {
			OSApp.currentSession.prefix = "https://";
		} else {
			OSApp.currentSession.prefix = "http://";
		}

		if ( typeof sites[ current ].auth_user !== "undefined" &&
			typeof sites[ current ].auth_pw !== "undefined" ) {

			OSApp.currentSession.auth = true;
			OSApp.currentSession.authUser = sites[ current ].auth_user;
			OSApp.currentSession.authPass = sites[ current ].auth_pw;
		} else {
			OSApp.currentSession.auth = false;
		}

		if ( sites[ current ].is183 ) {
			OSApp.currentSession.fw183 = true;
		} else {
			OSApp.currentSession.fw183 = false;
		}

		OSApp.Sites.newLoad();
	} );
};

OSApp.Sites.parseSites = function( sites ) {
	return ( sites === undefined || sites === null ) ? {} : JSON.parse( sites );
};

OSApp.Sites.showSiteSelect = function( list ) {
	$( "#site-select" ).popup( "destroy" ).remove();

	var popup = $(
		"<div data-role='popup' id='site-select' data-theme='a' data-overlay-theme='b'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Select Site" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<ul data-role='none' class='ui-listview ui-corner-all ui-shadow'>" +
				"</ul>" +
			"</div>" +
		"</div>" );

	if ( list ) {
		popup.find( "ul" ).html( list );
	}

	popup.one( "popupafterclose", function() {
		$( this ).popup( "destroy" ).remove();
	} ).popup( {
		history: false,
		"positionTo": "window"
	} ).enhanceWithin().popup( "open" );
};

OSApp.Sites.showAddNew = function( autoIP, closeOld ) {
	$( "#addnew" ).popup( "destroy" ).remove();

	var isAuto = ( autoIP ) ? true : false,
		addnew = $( "<div data-role='popup' id='addnew' data-theme='a' data-overlay-theme='b'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "New Device" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content' id='addnew-content'>" +
				"<form method='post' novalidate>" +
					( isAuto ? "" : "<p class='center smaller'>" +
						OSApp.Language._( "Note: The name is used to identify the OpenSprinkler within the app. OpenSprinkler IP can be either an IP or hostname. You can also specify a port by using IP:Port" ) +
					"</p>" ) +
					"<label for='os_name'>" + OSApp.Language._( "Open Sprinkler Name:" ) + "</label>" +
					"<input autocorrect='off' spellcheck='false' type='text' name='os_name' " +
						"id='os_name' placeholder='Home'>" +
					( isAuto ? "" :
						"<div class='ui-field-contain'>" +
							"<fieldset data-role='controlgroup' class='ui-mini center connection-type' data-type='horizontal'>" +
								"<legend class='left'>" + OSApp.Language._( "Connection Type" ) + ":</legend>" +
								"<input class='noselect' type='radio' name='connectionType' id='type-direct' value='ip' checked='checked'>" +
								"<label for='type-direct'>" + OSApp.Language._( "Direct" ) + "</label>" +
								"<input class='noselect' type='radio' name='connectionType' id='type-token' value='token'>" +
								"<label for='type-token'>" + OSApp.Language._( "OpenThings Cloud" ) + "</label>" +
							"</fieldset>" +
						"</div>" +
						"<label class='ip-field' for='os_ip'>" + OSApp.Language._( "Open Sprinkler IP:" ) + "</label>" ) +
					"<input data-wrapper-class='ip-field' " + ( isAuto ? "data-role='none' style='display:none' " : "" ) +
						"autocomplete='off' autocorrect='off' autocapitalize='off' " +
						"spellcheck='false' type='url' pattern='' name='os_ip' id='os_ip' " +
						"value='" + ( isAuto ? autoIP : "" ) + "' placeholder='home.dyndns.org'>" +
					"<label class='token-field' for='os_token' style='display: none'>" + OSApp.Language._( "OpenThings Token" ) + ":</label>" +
					"<input data-wrapper-class='token-field hidden' " +
						"autocomplete='off' autocorrect='off' autocapitalize='off' " +
						"spellcheck='false' type='text' pattern='' name='os_token' id='os_token' " +
						"value='' placeholder='" + OSApp.Language._( "OpenThings Token" ) + "'>" +
					"<label for='os_pw'>" + OSApp.Language._( "Open Sprinkler Password:" ) + "</label>" +
					"<input type='password' name='os_pw' id='os_pw' value=''>" +
					"<label for='save_pw'>" + OSApp.Language._( "Save Password" ) + "</label>" +
					"<input type='checkbox' data-wrapper-class='save_pw' name='save_pw' " +
						"id='save_pw' data-mini='true' checked='checked'>" +
					( isAuto ? "" :
						"<div data-theme='a' data-mini='true' data-role='collapsible' class='advanced-options'>" +
							"<h4>" + OSApp.Language._( "Advanced" ) + "</h4>" +
							"<fieldset data-role='controlgroup' data-type='horizontal' " +
								"data-mini='true' class='center'>" +
							"<input type='checkbox' name='os_usessl' id='os_usessl'>" +
							"<label for='os_usessl'>" + OSApp.Language._( "Use SSL" ) + "</label>" +
							"<input type='checkbox' name='os_useauth' id='os_useauth'>" +
							"<label for='os_useauth'>" + OSApp.Language._( "Use Auth" ) + "</label>" +
							"</fieldset>" +
						"</div>" ) +
					"<input type='submit' data-theme='b' value='" + OSApp.Language._( "Submit" ) + "'>" +
				"</form>" +
			"</div>" +
		"</div>" );

	addnew.find( "form" ).on( "submit", function() {
		OSApp.Sites.submitNewSite();
		return false;
	} );

	addnew.one( "popupafterclose", function() {
		$( this ).popup( "destroy" ).remove();
	} ).popup( {
		history: false,
		"positionTo": "window"
	} ).enhanceWithin();

	if ( closeOld ) {
		$( ".ui-popup-active" ).children().first().one( "popupafterclose", function() {
			addnew.popup( "open" );
		} ).popup( "close" );
	} else {
		addnew.popup( "open" );
	}

	OSApp.UIDom.fixInputClick( addnew );

	addnew.find( ".ui-collapsible-heading-toggle" ).on( "click", function() {
		var open = $( this ).parents( ".ui-collapsible" ).hasClass( "ui-collapsible-collapsed" ),
			page = $( ".ui-page-active" ),
			height = parseInt( page.css( "min-height" ) );

		if ( open ) {
			page.css( "min-height", ( height + 65 ) + "px" );
		} else {
			page.css( "min-height", ( height - 65 ) + "px" );
		}

		addnew.popup( "reposition", { positionTo:"window" } );
	} );

	addnew.find( ".connection-type input[type='radio']" ).on( "change", function() {
		var previous = this.value === "token" ? "ip" : "token";
		addnew.find( "." + previous + "-field" ).hide();
		addnew.find( "." + this.value + "-field" ).removeClass( "hidden" ).show();
		addnew.find( ".advanced-options" ).toggle( this.value === "ip" );
	} );

	return false;
};

// Add a new site
// FIXME: rename this
OSApp.Sites.submitNewSite = function( ssl, useAuth ) {
	document.activeElement.blur();
	$.mobile.loading( "show" );

	var connectionType = $( ".connection-type input[type='radio']:checked" ).val(),
		ip = $.mobile.path.parseUrl( $( "#os_ip" ).val() ).hrefNoHash.replace( /https?:\/\//, "" ),
		token = connectionType === "token" ? $( "#os_token" ).val() : null,
		success = function( data, sites ) {
			$.mobile.loading( "hide" );
			var is183;

			if ( ( typeof data === "string" && data.match( /var (en|sd)\s*=/ ) ) || ( typeof data.fwv === "number" && data.fwv === 203 ) ) {
				is183 = true;
			}

			if ( data.fwv !== undefined || is183 === true ) {
				var name = $( "#os_name" ).val(),
					pw = $( "#os_pw" ).val(),
					savePW = $( "#save_pw" ).is( ":checked" );

				if ( name === "" ) {
					name = "Site " + ( Object.keys( sites ).length + 1 );
				}

				sites[ name ] = {};
				sites[ name ].os_token = OSApp.currentSession.token = token;
				sites[ name ].os_ip = OSApp.currentSession.ip = ip;

				if ( typeof data.fwv === "number" && data.fwv >= 213 ) {
					if ( typeof data.wl === "number" ) {
						pw = md5( pw );
					}
				}

				sites[ name ].os_pw = savePW ? pw : "";
				OSApp.currentSession.pass = pw;

				if ( ssl ) {
					sites[ name ].ssl = "1";
					OSApp.currentSession.prefix = "https://";
				} else {
					OSApp.currentSession.prefix = "http://";
				}

				if ( useAuth ) {
					sites[ name ].auth_user = $( "#os_auth_user" ).val();
					sites[ name ].auth_pw = $( "#os_auth_pw" ).val();
					OSApp.currentSession.auth = true;
					OSApp.currentSession.authUser = sites[ name ].auth_user;
					OSApp.currentSession.authPass = sites[ name ].auth_pw;
				} else {
					OSApp.currentSession.auth = false;
				}

				if ( is183 === true ) {
					sites[ name ].is183 = "1";
					OSApp.currentSession.fw183 = true;
				}

				$( "#os_name,#os_ip,#os_pw,#os_auth_user,#os_auth_pw,#os_token" ).val( "" );
				OSApp.Storage.set( {
					"sites": JSON.stringify( sites ),
					"current_site": name
				}, function() {
					OSApp.Network.cloudSaveSites();
					OSApp.Sites.updateSiteList( Object.keys( sites ), name );
					OSApp.Sites.newLoad();
				} );
			} else {
				OSApp.Errors.showError( OSApp.Language._( "Check IP/Port and try again." ) );
			}
		},
		fail = function( x ) {
			if ( !useAuth && x.status === 401 ) {
				getAuth();
				return;
			}
			if ( ssl ) {
				$.mobile.loading( "hide" );
				OSApp.Errors.showError( OSApp.Language._( "Check IP/Port and try again." ) );
			} else {
				OSApp.Sites.submitNewSite( true );
			}
		},
		getAuth = function() {
			if ( $( "#addnew-auth" ).length ) {
				OSApp.Sites.submitNewSite( ssl, true );
			} else {
				showAuth();
			}
		},
		getAuthInfo = function() {
			return btoa( $( "#os_auth_user" ).val() + ":" + $( "#os_auth_pw" ).val() );
		},
		showAuth = function() {
			$.mobile.loading( "hide" );
			var html = $( "<div class='ui-content' id='addnew-auth'>" +
					"<form method='post' novalidate>" +
						"<p class='center smaller'>" + OSApp.Language._( "Authorization Required" ) + "</p>" +
						"<label for='os_auth_user'>" + OSApp.Language._( "Username:" ) + "</label>" +
						"<input autocomplete='off' autocorrect='off' autocapitalize='off' " +
							"spellcheck='false' type='text' " +
							"name='os_auth_user' id='os_auth_user'>" +
						"<label for='os_auth_pw'>" + OSApp.Language._( "Password:" ) + "</label>" +
						"<input type='password' name='os_auth_pw' id='os_auth_pw'>" +
						"<input type='submit' value='" + OSApp.Language._( "Submit" ) + "'>" +
					"</form>" +
				"</div>" ).enhanceWithin();

			html.on( "submit", "form", function() {
				OSApp.Sites.submitNewSite( ssl, true );
				return false;
			} );

			$( "#addnew-content" ).hide();
			$( "#addnew" ).append( html ).popup( "reposition", { positionTo:"window" } );
		},
		prefix;

	if ( !ip && !token ) {
		OSApp.Errors.showError( OSApp.Language._( "An IP address or token is required to continue." ) );
		return;
	}

	if ( token && token.length !== 32 ) {
		OSApp.Errors.showError( OSApp.Language._( "OpenThings Token must be 32 characters long." ) );
		return;
	}

	if ( useAuth !== true && $( "#os_useauth" ).is( ":checked" ) ) {
		getAuth();
		return;
	}

	if ( $( "#os_usessl" ).is( ":checked" ) === true ) {
		ssl = true;
	}

	if ( ssl ) {
		prefix = "https://";
	} else {
		prefix = "http://";
	}

	if ( useAuth ) {
		$( "#addnew-auth" ).hide();
		$( "#addnew-content" ).show();
		$( "#addnew" ).popup( "reposition", { positionTo:"window" } );
	}

	var urlDest = "/jo?pw=" + md5( $( "#os_pw" ).val() ),
		url = token ? "https://cloud.openthings.io/forward/v1/" + token + urlDest : prefix + ip + urlDest;

	//Submit form data to the server
	$.ajax( {
		url: url,
		type: "GET",
		dataType: "json",
		timeout: 10000,
		global: false,
		beforeSend: function( xhr ) {
			if ( !token && useAuth ) {
				xhr.setRequestHeader(
					"Authorization",
					"Basic " + getAuthInfo()
				);
			}
		},
		error: function( x ) {
			if ( !useAuth && x.status === 401 ) {
				getAuth();
				return;
			}
			$.ajax( {
				url: token ? "https://cloud.openthings.io/forward/v1/" + token : prefix + ip,
				type: "GET",
				dataType: "text",
				timeout: 10000,
				global: false,
				cache: true,
				beforeSend: function( xhr ) {
					if ( !token && useAuth ) {
						xhr.setRequestHeader(
							"Authorization",
							"Basic " + getAuthInfo()
						);
					}
				},
				success: function( reply ) {
					OSApp.Storage.get( "sites", function( data ) {
						var sites = OSApp.Sites.parseSites( data.sites );
						success( reply, sites );
					} );
				},
				error: fail
			} );
		},
		success: function( reply ) {
			OSApp.Storage.get( "sites", function( data ) {
				var sites = OSApp.Sites.parseSites( data.sites );
				success( reply, sites );
			} );
		}
	} );
};

// Gather new controller information and load home page
OSApp.Sites.newLoad = function() {

	// Get the current site name from the site select drop down
	var name = $( "#site-selector" ).val(),
		loading = "<div class='logo'></div>" +
			"<h1 style='padding-top:5px'>" + OSApp.Language._( "Connecting to" ) + " " + name + "</h1>" +
			"<p class='cancel tight center inline-icon'>" +
				"<span class='btn-no-border ui-btn ui-icon-delete ui-btn-icon-notext'></span>" +
				"Cancel" +
			"</p>";

	$.mobile.loading( "show", {
		html: OSApp.currentSession.local ? "<h1>" + OSApp.Language._( "Loading" ) + "</h1>" : loading,
		textVisible: true,
		theme: "b"
	} );

	$( ".ui-loader" ).css( {
		"box-shadow": "none",
		"margin-top": "-4em"
	} ).find( ".cancel" ).one( "click", function() {
		$.ajaxq.abort( "default" );
		OSApp.UIDom.changePage( "#site-control", {
			transition: "none"
		} );
	} );

	//Empty object which will store device data
	OSApp.currentSession.controller = {};

	//Empty notifications
	OSApp.Notifications.clearNotifications();

	//Empty timers object
	OSApp.uiState.timers = {};

	//Clear the current queued AJAX requests (used for previous OSApp.currentSession.controller connection)
	$.ajaxq.abort( "default" );

	OSApp.Sites.updateController(
		function() {
			var weatherAdjust = $( ".weatherAdjust" ),
				changePassword = $( ".changePassword" );

			$.mobile.loading( "hide" );
			OSApp.Weather.checkURLandUpdateWeather();

			if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
				weatherAdjust.css( "display", "" );
			} else {
				weatherAdjust.hide();
			}

			if ( OSApp.Analog.checkAnalogSensorAvail() ) {
				OSApp.Analog.updateAnalogSensor();
				OSApp.Analog.updateProgramAdjustments();
				OSApp.Analog.updateMonitors();
			}

			// Hide change password feature for unsupported devices
			if ( OSApp.Firmware.isOSPi() || OSApp.Firmware.checkOSVersion( 208 ) ) {
				changePassword.css( "display", "" );
			} else {
				changePassword.hide();
			}

			// Show site name instead of default Information bar
			if ( !OSApp.currentSession.local ) {
				$( "#info-list" ).find( "li[data-role='list-divider']" ).text( name );
				document.title = "OpenSprinkler - " + name;
			} else {
				$( "#info-list" ).find( "li[data-role='list-divider']" ).text( OSApp.Language._( "Information" ) );
			}

			// Check if a firmware update is available
			OSApp.Firmware.checkFirmwareUpdate();

			// Check for unused expansion boards
			OSApp.Firmware.detectUnusedExpansionBoards();

			// Check if password is plain text (older method) and hash the password, if needed
			if ( OSApp.Firmware.checkOSVersion( 213 ) && OSApp.currentSession.controller.options.hwv !== 255 ) {
				OSApp.Sites.fixPasswordHash( name );
			}

			// Check if the OpenSprinkler can be accessed from the public IP
			if ( !OSApp.currentSession.local && typeof OSApp.currentSession.controller.settings.eip === "number" ) {
				OSApp.Network.checkPublicAccess( OSApp.currentSession.controller.settings.eip );
			}

			// Check if a cloud token is available and if so show logout button otherwise show login
			OSApp.UIDom.updateLoginButtons();

			if ( OSApp.Firmware.isOSPi() ) {

				// Show notification of unified firmware availability
				OSApp.Firmware.showUnifiedFirmwareNotification();
			}

			if ( OSApp.currentSession.controller.options.firstRun ) {
				OSApp.Sites.showGuidedSetup();
			} else {
				OSApp.UIDom.goHome( true );
			}
		},
		function( error ) {
			$.ajaxq.abort( "default" );
			OSApp.currentSession.controller = {};

			$.mobile.loading( "hide" );

			var fail = function() {
				if ( !OSApp.currentSession.local ) {
					if ( $( ".ui-page-active" ).attr( "id" ) === "site-control" ) {
						showFail();
					} else {
						$.mobile.document.one( "pageshow", showFail );
						OSApp.UIDom.changePage( "#site-control", {
							transition: "none"
						} );
					}
				} else {
					OSApp.Storage.remove( [ "sites" ], function() {
						window.location.reload();
					} );
				}
			},
			showFail = function() {
				OSApp.Errors.showError( OSApp.Language._( "Unable to connect to" ) + " " + name, 3500 );
			};

			if ( typeof error === "object" && error.status === 401 ) {
				$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

				OSApp.Network.changePassword( {
					fixIncorrect: true,
					name: name,
					callback: OSApp.Sites.newLoad,
					cancel: fail
				} );
			} else {
				fail();
			}
		}
	);
};

// Update controller information
OSApp.Sites.updateController = function( callback, fail ) {
	callback = callback || function() {};
	fail = fail || function() {};
	var finish = function() {
		$( "html" ).trigger( "datarefresh" );
		OSApp.Status.checkStatus();
		callback();
	};

	if ( OSApp.currentSession.isControllerConnected() && OSApp.Firmware.checkOSVersion( 216 ) ) {
		OSApp.Firmware.sendToOS( "/ja?pw=", "json" ).then( function( data ) {

			if ( typeof data === "undefined" || $.isEmptyObject( data ) ) {
				fail();
				return;
			}

			// The /ja call does not contain special station data, so let's cache it
			var special = OSApp.currentSession.controller.special;

			OSApp.currentSession.controller = data;

			// Restore the station cache to the object
			OSApp.currentSession.controller.special = special;

			// Fix the station status array
			OSApp.currentSession.controller.status = OSApp.currentSession.controller.status.sn;

			finish();
		}, fail );
	} else {
		$.when(
			OSApp.Sites.updateControllerPrograms(),
			OSApp.Sites.updateControllerStations(),
			OSApp.Sites.updateControllerOptions(),
			OSApp.Sites.updateControllerStatus(),
			OSApp.Sites.updateControllerSettings()
		).then( finish, fail );
	}
};

OSApp.Sites.updateControllerPrograms = function( callback ) {
	callback = callback || function() {};
	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/gp?d=0" ).done( function( programs ) {
			var vars = programs.match( /(nprogs|nboards|mnp)=[\w|\d|."]+/g ),
				progs = /pd=\[\];(.*);/.exec( programs ),
				newdata = {}, tmp, prog;

			for ( var i = 0; i < vars.length; i++ ) {
				if ( vars[ i ] === "" ) {
					continue;
				}
				tmp = vars[ i ].split( "=" );
				newdata[ tmp[ 0 ] ] = parseInt( tmp[ 1 ] );
			}

			newdata.pd = [];
			if ( progs !== null ) {
				progs = progs[ 1 ].split( ";" );
				for ( i = 0; i < progs.length; i++ ) {
					prog = progs[ i ].split( "=" );
					prog = prog[ 1 ].replace( "[", "" );
					prog = prog.replace( "]", "" );
					newdata.pd[ i ] = OSApp.Utils.parseIntArray( prog.split( "," ) );
				}
			}

			OSApp.currentSession.controller.programs = newdata;
			callback();
		} );
	} else {
		return OSApp.Firmware.sendToOS( "/jp?pw=", "json" ).done( function( programs ) {
			OSApp.currentSession.controller.programs = programs;
			callback();
		} );
	}
};

OSApp.Sites.updateControllerStations = function( callback ) {
	callback = callback || function() {};
	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/vs" ).done( function( stations ) {
			var names = /snames=\[(.*?)\];/.exec( stations ),
				masop = stations.match( /(?:masop|mo)\s?[=|:]\s?\[(.*?)\]/ );

			names = names[ 1 ].split( "," );
			names.pop();

			for ( var i = 0; i < names.length; i++ ) {
				names[ i ] = names[ i ].replace( /'/g, "" );
			}

			masop = OSApp.Utils.parseIntArray( masop[ 1 ].split( "," ) );

			OSApp.currentSession.controller.stations = {
				"snames": names,
				"masop": masop,
				"maxlen": names.length
			};
			callback();
		} );
	} else {
		return OSApp.Firmware.sendToOS( "/jn?pw=", "json" ).done( function( stations ) {
			OSApp.currentSession.controller.stations = stations;
			callback();
		} );
	}
};

OSApp.Sites.updateControllerOptions = function( callback ) {
	callback = callback || function() {};
	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/vo" ).done( function( options ) {
			var isOSPi = options.match( /var sd\s*=/ ),
				vars = {}, tmp, i, o;

			if ( isOSPi ) {
				var varsRegex = /(tz|htp|htp2|nbrd|seq|sdt|mas|mton|mtoff|urs|rst|wl|ipas)\s?[=|:]\s?([\w|\d|."]+)/gm,
					name;

				while ( ( tmp = varsRegex.exec( options ) ) !== null ) {
					name = tmp[ 1 ].replace( "nbrd", "ext" ).replace( "mtoff", "mtof" );
					vars[ name ] = +tmp[ 2 ];
				}
				vars.ext--;
				vars.fwv = "1.8.3-ospi";
			} else {
				var valid = [ 1, 2, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26 ];
				tmp = /var opts=\[(.*)\];/.exec( options );
				tmp = tmp[ 1 ].replace( /"/g, "" ).split( "," );

				for ( i = 0; i < tmp.length - 1; i = i + 4 ) {
					o = +tmp[ i + 3 ];
					if ( $.inArray( o, valid ) !== -1 ) {
						vars[ OSApp.Constants.keyIndex[ o ] ] = +tmp[ i + 2 ];
					}
				}
				vars.fwv = 183;
			}
			OSApp.currentSession.controller.options = vars;
			callback();
		} );
	} else {
		return OSApp.Firmware.sendToOS( "/jo?pw=", "json" ).done( function( options ) {
			OSApp.currentSession.controller.options = options;
			callback();
		} );
	}
};

OSApp.Sites.updateControllerStatus = function( callback ) {
	callback = callback || function() {};
	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/sn0" ).then(
			function( status ) {
				var tmp = status.toString().match( /\d+/ );

				tmp = OSApp.Utils.parseIntArray( tmp[ 0 ].split( "" ) );

				OSApp.currentSession.controller.status = tmp;
				callback();
			},
			function() {
				OSApp.currentSession.controller.status = [];
			} );
	} else {
		return OSApp.Firmware.sendToOS( "/js?pw=", "json" ).then(
			function( status ) {
				OSApp.currentSession.controller.status = status.sn;
				callback();
			},
			function() {
				OSApp.currentSession.controller.status = [];
			} );
	}
};

OSApp.Sites.updateControllerSettings = function( callback ) {
	callback = callback || function() {};
	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "" ).then(
			function( settings ) {
				var varsRegex = /(ver|devt|nbrd|tz|en|rd|rs|mm|rdst|urs)\s?[=|:]\s?([\w|\d|."]+)/gm,
					loc = settings.match( /loc\s?[=|:]\s?["|'](.*)["|']/ ),
					lrun = settings.match( /lrun=\[(.*)\]/ ),
					ps = settings.match( /ps=\[(.*)\];/ ),
					vars = {}, tmp, i;

				ps = ps[ 1 ].split( "],[" );
				for ( i = ps.length - 1; i >= 0; i-- ) {
					ps[ i ] = OSApp.Utils.parseIntArray( ps[ i ].replace( /\[|\]/g, "" ).split( "," ) );
				}

				while ( ( tmp = varsRegex.exec( settings ) ) !== null ) {
					vars[ tmp[ 1 ] ] = +tmp[ 2 ];
				}

				vars.loc = loc[ 1 ];
				vars.ps = ps;
				vars.lrun = OSApp.Utils.parseIntArray( lrun[ 1 ].split( "," ) );

				OSApp.currentSession.controller.settings = vars;
			},
			function() {
				if ( OSApp.currentSession.controller.settings && OSApp.currentSession.controller.stations ) {
					var ps = [], i;
					for ( i = 0; i < OSApp.currentSession.controller.stations.maxlen; i++ ) {
						ps.push( [ 0, 0 ] );
					}
					OSApp.currentSession.controller.settings.ps = ps;
				}
			} );
	} else {
		return OSApp.Firmware.sendToOS( "/jc?pw=" ).then(
			function( settings ) {
				if ( typeof settings !== "object" ) {
					try {
						settings = JSON.parse( settings );
						//eslint-disable-next-line no-unused-vars
					} catch ( err ) {
						var matchWTO = /,"wto":\{.*?\}/;
						var wto = settings.match( matchWTO );
						settings = settings.replace( matchWTO, "" );
						try {
							settings = JSON.parse( settings );
							OSApp.Sites.handleCorruptedWeatherOptions( wto );
							//eslint-disable-next-line no-unused-vars
						} catch ( e ) {
							return false;
						}
					}
				}

				if ( typeof settings.lrun === "undefined" ) {
					settings.lrun = [ 0, 0, 0, 0 ];
				}

				// Update the current coordinates if the user's location is using them
				if ( settings.loc.match( OSApp.Constants.regex.GPS ) ) {
					var location = settings.loc.split( "," );
					OSApp.currentSession.coordinates = [ parseFloat( location[ 0 ] ), parseFloat( location[ 1 ] ) ];
				}

				OSApp.currentSession.controller.settings = settings;
				callback();
			},
			function() {
				if ( OSApp.currentSession.controller.settings && OSApp.currentSession.controller.stations ) {
					var ps = [], i;
					for ( i = 0; i < OSApp.currentSession.controller.stations.maxlen; i++ ) {
						ps.push( [ 0, 0 ] );
					}
					OSApp.currentSession.controller.settings.ps = ps;
				}
			} );
	}
};

OSApp.Sites.handleCorruptedWeatherOptions = function( wto ) {
	if ( OSApp.uiState.showWeatherOptionsCorruptedNotification ) {
		return;
	}

	OSApp.Notifications.addNotification( {
		title: OSApp.Language._( "Weather Options have Corrupted" ),
		desc: OSApp.Language._( "Click here to retrieve the partial weather option data" ),
		on: function() {
			var button = $( this ).parent(),
				popup = $(
					"<div data-role='popup' data-theme='a' class='modal ui-content' id='weatherOptionCorruption'>" +
						"<h3 class='center'>" +
							OSApp.Language._( "Weather option data has corrupted" ) +
						"</h3>" +
						"<h5 class='center'>" + OSApp.Language._( "Please note this may indicate other data corruption as well, please verify all settings." ) + "</h5>" +
						"<h6 class='center'>" + OSApp.Language._( "Below is the corrupt data which could not be parsed but may be useful for restoration." ) + "</h6>" +
						"<code>" +
							wto[ 0 ].substr( 7 ) +
						"</code>" +
						"<a class='ui-btn ui-corner-all ui-shadow red reset-options' style='width:80%;margin:5px auto;' href='#'>" +
							OSApp.Language._( "Reset All Options" ) +
						"</a>" +
						"<a class='ui-btn ui-corner-all ui-shadow submit' style='width:80%;margin:5px auto;' href='#'>" +
							OSApp.Language._( "Dismiss" ) +
						"</a>" +
					"</div>"
				);

			popup.find( ".submit" ).on( "click", function() {
				OSApp.Notifications.removeNotification( button );
				popup.popup( "close" );

				return false;
			} );

			popup.find( ".reset-options" ).on( "click", function() {
				OSApp.Notifications.removeNotification( button );
				popup.popup( "close" );
				OSApp.UIDom.resetAllOptions( function() {
					OSApp.Errors.showError( OSApp.Language._( "Settings have been saved" ) );
				} );

				return false;
			} );

			OSApp.UIDom.openPopup( popup );
			return false;
		}
	} );

	OSApp.uiState.handleCorruptedWeatherOptions = true;
};

OSApp.Sites.updateControllerStationSpecial = function( callback ) {
	callback = callback || function() {};

	return OSApp.Firmware.sendToOS( "/je?pw=", "json" ).then(
		function( special ) {
			OSApp.currentSession.controller.special = special;
			callback();
		},
		function() {
			OSApp.currentSession.controller.special = {};
		} );
};

// Change the current site (needs to be defined AFTER OSApp.Sites.checkConfigured!)
OSApp.Sites.updateSite = function( newsite ) {
	OSApp.Storage.get( "sites", function( data ) {
		var sites = OSApp.Sites.parseSites( data.sites );
		if ( newsite in sites ) {
			OSApp.UIDom.closePanel( function() {
				OSApp.Storage.set( { "current_site":newsite }, () => OSApp.Sites.checkConfigured() );
			} );
		}
	} );
};

OSApp.Sites.fixPasswordHash = function( current ) {
	OSApp.Storage.get( [ "sites" ], function( data ) {
		var sites = OSApp.Sites.parseSites( data.sites );

		if ( !OSApp.Utils.isMD5( OSApp.currentSession.pass ) ) {
			var pw = md5( OSApp.currentSession.pass );

			OSApp.Firmware.sendToOS(
				"/sp?pw=&npw=" + encodeURIComponent( pw ) +
				"&cpw=" + encodeURIComponent( pw ), "json"
			).done( function( info ) {
				var result = info.result;

				if ( !result || result > 1 ) {
					return false;
				} else {
					sites[ current ].os_pw = OSApp.currentSession.pass = pw;
					OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, () => OSApp.Network.cloudSaveSites() );
				}
			} );
		}
	} );
};

// Show popup for new device after populating device IP with selected result
OSApp.Sites.addFound = function( ip ) {
	$( "#site-select" ).one( "popupafterclose", function() {
		OSApp.Sites.showAddNew( ip );
	} ).popup( "close" );
};

// Stub for guided setup page
OSApp.Sites.showGuidedSetup = function() {

	// Stub for guided setup page

};

OSApp.Sites.refreshData = function() {
	if ( !OSApp.currentSession.isControllerConnected() ) {
		return;
	}

	if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
		OSApp.Sites.updateController( function() {}, OSApp.Network.networkFail );
	} else {
		$.when(
			OSApp.Sites.updateControllerPrograms(),
			OSApp.Sites.updateControllerStations()
		).fail( OSApp.Network.networkFail );
	}
};

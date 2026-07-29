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
		sites, header, total, contentGeneration = 0, probeRequests = [];

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
		contentGeneration++;
		probeRequests.forEach( function( request ) {
			if ( request && typeof request.abort === "function" ) request.abort();
		} );
		probeRequests = [];
		$( "html" ).off( "siterefresh.siteControl" );
		popup.popup( "destroy" ).detach();
		page.detach();
	} );

	$( "html" ).off( "siterefresh.siteControl" ).on( "siterefresh.siteControl", function() {
		if ( page.hasClass( "ui-page-active" ) ) {
			updateContent();
		}
	} );

	function updateContent() {
		var renderGeneration = ++contentGeneration;
		probeRequests.forEach( function( request ) {
			if ( request && typeof request.abort === "function" ) request.abort();
		} );
		probeRequests = [];
		OSApp.Storage.get( [ "sites", "current_site", "cloudToken" ], function( data ) {
			if ( renderGeneration !== contentGeneration ) return;
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

				if ( !OSApp.currentSession.isControllerConnected() || !total ||
					!Object.prototype.hasOwnProperty.call( sites, data.current_site ) ) {
					makeStart();
				}

				sites = OSApp.Utils.sortObj( sites );

				$.each( sites, function( a, b ) {
					var siteName = a;
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
						"<label for='cnm-" + i + "'>" + OSApp.Language._( "Change Name" ) + "</label><input id='cnm-" + i + "' type='text' maxlength='128' value='" + a + "'>" +
						"</div>" +
						( b.os_token ? "" : "<div class='ui-field-contain'>" +
							"<label for='cip-" + i + "'>" + OSApp.Language._( "Change IP/URL" ) + "</label><input id='cip-" + i + "' type='text' inputmode='url' value='" + OSApp.Utils.htmlEscape( b.os_ip ) +
								"' autocomplete='off' autocorrect='off' autocapitalize='off' pattern='' spellcheck='false'>" +
							"</div>" ) +
							( b.os_token ? "<div class='ui-field-contain'>" +
								"<label for='ctoken-" + i + "'>" + OSApp.Language._( "Change Token" ) + "</label><input id='ctoken-" + i + "' type='text' value='" + OSApp.Utils.htmlEscape( b.os_token ) +
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
								"<input class='useauth' data-user='" + OSApp.Utils.htmlEscape( b.auth_user || "" ) + "' data-pw='" + OSApp.Utils.htmlEscape( b.auth_pw || "" ) +
							"' data-mini='true' type='checkbox' id='useauth-" + i + "' name='useauth-" + i + "'" +
							( typeof b.auth_user !== "undefined" && typeof b.auth_pw !== "undefined" ? " checked='checked'" : "" ) + ">" +
							OSApp.Language._( "Use Auth" ) +
							"</label>" +
							"<label for='legacyauth-" + i + "'>" +
							"<input class='legacyauth' data-mini='true' type='checkbox' id='legacyauth-" + i + "'" +
							( b.legacyAuth === true ? " checked='checked'" : "" ) + ">" +
							OSApp.Language._( "Legacy firmware (pre-2.1.3; sends password without hashing)" ) +
							"</label>" +
							"</fieldset>" ) +
						"<input class='submit' type='submit' value='" + OSApp.Language._( "Save Changes to" ) + " " + a + "'>" +
						"<a data-role='button' class='deletesite' data-site='" + i + "' href='#' data-theme='b'>" + OSApp.Language._( "Delete" ) + " " + a + "</a>" +
						"</form>" +
						"</fieldset>";

					probeRequests.push( OSApp.Sites.testSite( b, i, function( id, result ) {
						if ( renderGeneration !== contentGeneration || siteNames[ id ] !== siteName ||
							sites[ siteName ] !== b ) return;
						page.find( "#site-" + id + " .connectnow" )
							.removeClass( "yellow" )
							.addClass( result ? "green" : "red" );
					} ) );

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
						resolvedAddress = sites[ site ].os_token ? null : OSApp.Sites.resolveSiteAddress(
							list.find( "#cip-" + id ).val().trim(), list.find( "#usessl-" + id ).is( ":checked" )
						),
						ip = resolvedAddress ? resolvedAddress.address : "",
						token = sites[ site ].os_token ? list.find( "#ctoken-" + id ).val().trim() : "",
						pw = list.find( "#cpw-" + id ).val(),
						nm = list.find( "#cnm-" + id ).val().trim(),
						useauth = list.find( "#useauth-" + id ).is( ":checked" ),
						legacyAuth = list.find( "#legacyauth-" + id ).is( ":checked" ),
						usessl = resolvedAddress && resolvedAddress.ssl ? "1" : undefined,
							authUser = list.find( "#useauth-" + id ).data( "user" ),
							authPass = list.find( "#useauth-" + id ).data( "pw" ),
							nextToken = sites[ site ].os_token ? token : sites[ site ].os_token,
							nextAuthUser = useauth ? authUser : undefined,
							nextAuthPass = useauth ? authPass : undefined,
							needsReconnect = ( ip !== "" && ip !== sites[ site ].os_ip ) ||
								nextToken !== sites[ site ].os_token ||
								usessl !== sites[ site ].ssl ||
								legacyAuth !== ( sites[ site ].legacyAuth === true ) ||
								nextAuthUser !== sites[ site ].auth_user ||
								nextAuthPass !== sites[ site ].auth_pw || pw !== "",
						isCurrent = ( site === data.current_site ),
						rename = ( nm !== "" && nm !== site );

					if ( sites[ site ].os_token ? !OSApp.Utils.isValidOTC( token ) : !ip ) {
						OSApp.Errors.showError( OSApp.Language._( "Please enter a valid device address or OTC token." ) );
						return false;
					}
					if ( useauth && !OSApp.Utils.getBasicAuthHeader( authUser, authPass ) ) {
						OSApp.Errors.showError( OSApp.Language._( "Please enter valid authorization credentials." ) );
						return false;
					}

					if ( rename && ( !OSApp.Sites.isSafeSiteName( nm ) ||
						Object.prototype.hasOwnProperty.call( sites, nm ) ) ) {
						OSApp.Errors.showError( OSApp.Language._( "Please choose a unique site name." ) );
						return false;
					}

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

					if ( legacyAuth ) {
						sites[ site ].legacyAuth = true;
					} else {
						delete sites[ site ].legacyAuth;
					}

					if ( ip !== "" && ip !== sites[ site ].os_ip ) {
						sites[ site ].os_ip = ip;
					}
					if ( token !== "" && token !== sites[ site ].os_token ) {
						sites[ site ].os_token = token;
					}
					if ( pw !== "" && pw !== sites[ site ].os_pw ) {
						var passwordAuth = OSApp.Sites.prepareSitePassword( sites[ site ], pw );

						pw = passwordAuth.password;
						sites[ site ].os_pw = pw;
						sites[ site ].isHashed = passwordAuth.isHashed;
					}
						if ( rename ) {
						sites[ nm ] = sites[ site ];
						delete sites[ site ];
						site = nm;
							if ( isCurrent ) data.current_site = site;

						//OSApp.Firmware.sendToOS( "/cv?pw=&cn=" + data.current_site );
					}

						var stored = { sites:JSON.stringify( sites ) };
						if ( rename && isCurrent ) stored.current_site = site;
						OSApp.Storage.set( stored, function() {
							OSApp.Network.cloudSaveSites();
							OSApp.Sites.updateSiteList( Object.keys( sites ), data.current_site );
							OSApp.Errors.showError( OSApp.Language._( "Site updated successfully" ) );
							if ( site === data.current_site && needsReconnect ) OSApp.Sites.checkConfigured();
							if ( rename && !form.find( ".submit" ).hasClass( "preventUpdate" ) ) updateContent();
						} );

					return false;
				} );

				list.find( ".deletesite" ).on( "click", function() {
					var site = siteNames[ $( this ).data( "site" ) ];
					OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to delete " ) + site + "?", "", function() {
						var deletingCurrent = data.current_site === site,
							remaining, stored, finish;
						delete sites[ site ];
						remaining = Object.keys( sites ).sort();
						stored = { sites: JSON.stringify( sites ) };
						if ( deletingCurrent && remaining.length ) {
							data.current_site = remaining[ 0 ];
							stored.current_site = data.current_site;
						}

						finish = function() {
							OSApp.Network.cloudSaveSites();
							OSApp.Sites.updateSiteList( Object.keys( sites ), data.current_site );
							OSApp.Errors.showError( OSApp.Language._( "Site deleted successfully" ) );

							if ( deletingCurrent && remaining.length ) {
								OSApp.Sites.checkConfigured();
							} else {
								updateContent();
							}
							return false;
						};

						if ( deletingCurrent ) {
							makeStart();
							OSApp.Sites.invalidateCurrentSession();
						}

						OSApp.Storage.set( stored, function() {
							if ( deletingCurrent && !remaining.length ) {
								OSApp.Storage.remove( "current_site", function() {
									finish();
								} );
							} else {
								finish();
							}
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
	var auth = OSApp.Sites.prepareStoredSitePassword( site ),
		urlDest = "/jo?pw=" + encodeURIComponent( auth.password ),
		url = site.os_token ? "https://cloud.openthings.io/forward/v1/" + site.os_token + urlDest : ( site.ssl === "1" ? "https://" : "http://" ) + site.os_ip + urlDest,
		request;

	request = $.ajax( {
		url: url,
		type: "GET",
		dataType: "json",
		timeout: 10000,
		beforeSend: function( xhr ) {
			if ( typeof site.auth_user !== "undefined" && typeof site.auth_pw !== "undefined" ) {
				var header = OSApp.Utils.getBasicAuthHeader( site.auth_user, site.auth_pw );
				if ( header ) xhr.setRequestHeader( "Authorization", header );
			}
		}
	} );
	request.then(
		function( options ) {
			callback( id, OSApp.Firmware.isFullOptionsResponse( options ) );
		},
		function() {
			callback( id, false );
		}
	);

	return request;
};

// Update the panel list of sites
OSApp.Sites.updateSiteList = function( names, current ) {
	var list = "",
		select = $( "#site-selector" );

	$.each( names, function() {
		list += "<option " + ( this.toString() === current ? "selected " : "" ) + "value='" + OSApp.Utils.htmlEscape( this ) + "'>" + OSApp.Utils.htmlEscape( this ) + "</option>";
	} );

	$( "#info-list" ).find( "li[data-role='list-divider']" ).text( current );

	select.html( list );
	if ( select.parent().parent().hasClass( "ui-select" ) ) {
		select.selectmenu( "refresh" );
	}
};

OSApp.Sites.findLocalSiteName = function( sites, callback ) {
	callback = callback || function() {};
	var currentAddress = OSApp.Sites.normalizeSiteAddress( OSApp.currentSession.ip );
	if ( !currentAddress ) {
		callback( false );
		return;
	}
	for ( var site in sites ) {
		if ( Object.prototype.hasOwnProperty.call(sites,  site ) ) {
			var candidate = sites[ site ];
			if ( candidate && !candidate.os_token &&
				OSApp.Sites.normalizeSiteAddress( candidate.os_ip ) === currentAddress ) {
				callback( site );
				return;
			}
		}
	}

	callback( false );
};

// Multi site functions
OSApp.Sites.invalidateCurrentSession = function( clear ) {
	OSApp.currentSession.generation = ( OSApp.currentSession.generation || 0 ) + 1;
	if ( OSApp.Weather && typeof OSApp.Weather.cancelUpdate === "function" ) OSApp.Weather.cancelUpdate();
	if ( OSApp.Network && OSApp.Network.activeScan && typeof OSApp.Network.activeScan.cancel === "function" ) {
		OSApp.Network.activeScan.cancel();
	}
	if ( $.ajaxq && typeof $.ajaxq.abort === "function" ) {
		$.ajaxq.abort( "default" );
		$.ajaxq.abort( "change" );
	}
	if ( clear === false ) return;

	OSApp.currentSession.ip = undefined;
	OSApp.currentSession.pass = undefined;
	OSApp.currentSession.prefix = undefined;
	OSApp.currentSession.token = undefined;
	OSApp.currentSession.auth = false;
	OSApp.currentSession.authUser = undefined;
	OSApp.currentSession.authPass = undefined;
	OSApp.currentSession.fw183 = undefined;
	OSApp.currentSession.weather = undefined;
	OSApp.currentSession.controller = {};
};

OSApp.Sites.checkConfigured = function( firstLoad ) {
	OSApp.Storage.get( [ "sites", "current_site", "cloudToken" ], function( data ) {
		var sites = data.sites,
			current = data.current_site,
			names;

		sites = OSApp.Sites.parseSites( sites );

		names = Object.keys( sites );

		if ( !names.length ) {
			OSApp.Sites.invalidateCurrentSession();
			$.mobile.loading( "hide" );
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

		if ( current === null || !Object.prototype.hasOwnProperty.call( sites, current ) ) {
			OSApp.Sites.invalidateCurrentSession();
			$.mobile.loading( "hide" );
			OSApp.UIDom.changePage( "#site-control", {
				transition: firstLoad ? "none" : undefined
			} );
			return;
		}

		OSApp.Sites.updateSiteList( names, current );

		OSApp.currentSession.token = sites[ current ].os_token;

		OSApp.currentSession.ip = sites[ current ].os_ip;
		OSApp.currentSession.pass = OSApp.Sites.prepareStoredSitePassword( sites[ current ] ).password;

		if ( typeof sites[ current ].ssl !== "undefined" && sites[ current ].ssl === "1" ) {
			OSApp.currentSession.prefix = "https://";
		} else {
			OSApp.currentSession.prefix = "http://";
		}

		if ( !sites[ current ].os_token && typeof sites[ current ].auth_user !== "undefined" &&
			typeof sites[ current ].auth_pw !== "undefined" ) {

			OSApp.currentSession.auth = true;
			OSApp.currentSession.authUser = sites[ current ].auth_user;
			OSApp.currentSession.authPass = sites[ current ].auth_pw;
		} else {
			OSApp.currentSession.auth = false;
			OSApp.currentSession.authUser = undefined;
			OSApp.currentSession.authPass = undefined;
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
	var parsed,
		sanitized = {};

	if ( sites === undefined || sites === null ) {
		return sanitized;
	}

	try {
		parsed = typeof sites === "string" ? JSON.parse( sites ) : sites;
	} catch ( error ) { // eslint-disable-line no-unused-vars
		return sanitized;
	}

	if ( !parsed || typeof parsed !== "object" || Array.isArray( parsed ) ) {
		return sanitized;
	}

	Object.keys( parsed ).forEach( function( name ) {
		var site = parsed[ name ],
			normalized;

		if ( !OSApp.Sites.isSafeSiteName( name, true ) ||
			!site || typeof site !== "object" || Array.isArray( site ) ) {
			return;
		}
		normalized = OSApp.Sites.normalizeSiteRecord( site );
		if ( normalized ) sanitized[ name ] = normalized;
	} );

	return sanitized;
};

// Cloud replacement must fail closed. The permissive parser above is appropriate for recovering
// legacy local storage, but silently dropping corrupt cloud records can turn a bad payload into an
// apparently valid empty site map and overwrite every local controller.
OSApp.Sites.parseSitesStrict = function( sites ) {
	var parsed;
	try {
		parsed = typeof sites === "string" ? JSON.parse( sites ) : sites;
	} catch ( error ) { // eslint-disable-line no-unused-vars
		return null;
	}

	if ( !parsed || typeof parsed !== "object" || Array.isArray( parsed ) || Object.keys( parsed ).length > 2048 ) {
		return null;
	}

	var sanitized = {};
	for ( var name of Object.keys( parsed ) ) {
		if ( !OSApp.Sites.isSafeSiteName( name, true ) || name.length > 1024 ||
			!parsed[ name ] || typeof parsed[ name ] !== "object" || Array.isArray( parsed[ name ] ) ) {
			return null;
		}
		var normalized = OSApp.Sites.normalizeSiteRecord( parsed[ name ] );
		if ( !normalized ) return null;
		sanitized[ name ] = normalized;
	}

	return sanitized;
};

OSApp.Sites.isSafeSiteName = function( name, allowLegacyLength ) {
	return typeof name === "string" && name.trim() !== "" &&
		( allowLegacyLength === true || name.length <= 128 ) && name !== "prototype" &&
		!Object.prototype.hasOwnProperty.call( Object.prototype, name );
};

OSApp.Sites.parseSiteAddress = function( value ) {
	var i, code;
	if ( typeof value !== "string" || value.length < 1 || value.length > 2048 || value !== value.trim() ||
		/["'<>\\]/.test( value ) ) {
		return null;
	}
	for ( i = 0; i < value.length; i++ ) {
		code = value.charCodeAt( i );
		if ( code < 32 || code === 127 ) return null;
	}
	try {
		var url = new URL( /^[a-z][a-z\d+.-]*:\/\//i.test( value ) ? value : "http://" + value );
		if ( ( url.protocol !== "http:" && url.protocol !== "https:" ) || !url.host ||
			url.username || url.password || url.search || url.hash ) return null;
		var pathname = url.pathname === "/" ? "" : url.pathname.replace( /\/$/, "" );
		return { address:url.host + pathname, ssl:url.protocol === "https:" };
	} catch ( error ) { // eslint-disable-line no-unused-vars
		return null;
	}
};

OSApp.Sites.normalizeSiteAddress = function( value ) {
	var parsed = OSApp.Sites.parseSiteAddress( value );
	return parsed ? parsed.address : null;
};

OSApp.Sites.resolveSiteAddress = function( value, useSsl ) {
	var parsed = OSApp.Sites.parseSiteAddress( value );
	if ( !parsed ) return null;
	if ( !/^https?:\/\//i.test( value ) ) parsed.ssl = useSsl === true;
	return parsed;
};

OSApp.Sites.normalizeSiteMap = function( value, kind ) {
	var result = {},
		totalImageBytes = 0,
		imageLimit = OSApp.Dashboard && OSApp.Dashboard.MAX_STATION_IMAGE_BASE64_LENGTH || 512 * 1024;
	if ( !value || typeof value !== "object" || Array.isArray( value ) ) return result;
	Object.keys( value ).slice( 0, 2048 ).forEach( function( key ) {
		var item = value[ key ];
		if ( !/^(0|[1-9]\d{0,3})$/.test( key ) ) return;
		if ( kind === "notes" && typeof item === "string" ) result[ key ] = item.slice( 0, 4096 );
		else if ( kind === "lastRunTime" && typeof item === "number" && Number.isFinite( item ) && item >= 0 && item <= 0xffffffff ) result[ key ] = item;
		else if ( kind === "images" && typeof item === "string" && totalImageBytes + item.length <= 5 * 1024 * 1024 &&
			item.length <= imageLimit && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test( item ) ) {
			result[ key ] = item;
			totalImageBytes += item.length;
		}
	} );
	return result;
};

OSApp.Sites.normalizeSiteRecord = function( site ) {
	var parsedAddress = OSApp.Sites.parseSiteAddress( site.os_ip ),
		address = parsedAddress && parsedAddress.address,
		token = typeof site.os_token === "string" && OSApp.Utils.isValidOTC( site.os_token ) ? site.os_token : null,
		result = {};
	if ( !address && !token ) return null;
	if ( address ) result.os_ip = address;
	if ( token ) result.os_token = token;
	result.os_pw = typeof site.os_pw === "string" ? site.os_pw.slice( 0, 4096 ) : "";
	if ( site.ssl === "1" || parsedAddress && parsedAddress.ssl ) result.ssl = "1";
	if ( !token && typeof site.auth_user === "string" && typeof site.auth_pw === "string" ) {
		result.auth_user = site.auth_user.slice( 0, 2048 );
		result.auth_pw = site.auth_pw.slice( 0, 2048 );
	}
	if ( OSApp.Firmware.isValidFirmwareVersion( site.fwv ) ) result.fwv = site.fwv;
	if ( site.isHashed === true || site.isHashed === false ) result.isHashed = site.isHashed;
	if ( site.legacyAuth === true ) result.legacyAuth = true;
	if ( site.is183 === true || site.is183 === "1" ) result.is183 = site.is183;
	result.images = OSApp.Sites.normalizeSiteMap( site.images, "images" );
	result.notes = OSApp.Sites.normalizeSiteMap( site.notes, "notes" );
	result.lastRunTime = OSApp.Sites.normalizeSiteMap( site.lastRunTime, "lastRunTime" );
	return result;
};

OSApp.Sites.getSiteFirmwareVersion = function( site ) {
	if ( site && OSApp.Firmware.isValidFirmwareVersion( site.fwv ) ) {
		return site.fwv;
	}
	if ( site && site.is183 ) {
		return 183;
	}
	return undefined;
};

// Password edits must use the controller protocol metadata, not the format of the old saved
// value. In particular, a modern site with password saving disabled has an empty `os_pw`.
OSApp.Sites.prepareSitePassword = function( site, password ) {
	var firmwareVersion = OSApp.Sites.getSiteFirmwareVersion( site );

	// Old firmware metadata alone may have originated in an unauthenticated `/jo` response.
	// Require the operator's persisted legacy approval before selecting cleartext authentication.
	if ( ( typeof firmwareVersion === "number" && firmwareVersion < 213 || typeof firmwareVersion === "string" ) &&
		site.legacyAuth !== true ) {
		firmwareVersion = undefined;
	} else if ( firmwareVersion === undefined && site.legacyAuth === true ) {
		firmwareVersion = 212;
	}
	return OSApp.Firmware.getPasswordAuth( firmwareVersion, password, md5, site.legacyAuth === true );
};

OSApp.Sites.prepareStoredSitePassword = function( site ) {
	var password = site && typeof site.os_pw === "string" ? site.os_pw : "",
		firmwareVersion = OSApp.Sites.getSiteFirmwareVersion( site ),
		legacyApproved = site && site.legacyAuth === true && ( firmwareVersion === undefined ||
			typeof firmwareVersion === "number" && firmwareVersion < 213 || typeof firmwareVersion === "string" );

	if ( password === "" ) {
		return { password:"", isHashed: !legacyApproved, fwv:firmwareVersion };
	}
	if ( legacyApproved ) {
		return OSApp.Firmware.getPasswordAuth( firmwareVersion === undefined ? 212 : firmwareVersion, password, md5, true );
	}
	if ( ( !site || site.isHashed !== false ) && OSApp.Utils.isMD5( password ) ) {
		return { password:password, isHashed:true, fwv:firmwareVersion };
	}
	return OSApp.Firmware.getPasswordAuth( undefined, password, md5 );
};

OSApp.Sites.persistSitePasswordMetadata = function( name ) {
	var options = OSApp.currentSession.controller && OSApp.currentSession.controller.options,
		firmwareVersion = options && options.fwv,
		generation = OSApp.currentSession.generation || 0,
		controller = OSApp.currentSession.controller,
		verifiedPassword = OSApp.currentSession.pass;

	if ( !OSApp.Firmware.isValidFirmwareVersion( firmwareVersion ) ) {
		if ( OSApp.currentSession.fw183 ) {
			firmwareVersion = 183;
		} else {
			return;
		}
	}

	OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
		var sites = OSApp.Sites.parseSites( data.sites ),
			site = sites[ name ],
			auth, authFirmware, legacyFirmware, migratePassword;

		if ( !site || data.current_site !== name || !OSApp.Sites.isUpdateTargetCurrent( generation, controller ) ||
			verifiedPassword !== OSApp.currentSession.pass ) {
			return;
		}

		legacyFirmware = typeof firmwareVersion === "number" && firmwareVersion < 213 ||
			typeof firmwareVersion === "string";
		authFirmware = legacyFirmware && site.legacyAuth !== true ? undefined : firmwareVersion;
		auth = OSApp.Firmware.getPasswordAuth( authFirmware, "", md5, site.legacyAuth === true );
		migratePassword = auth.isHashed && site.os_pw !== "" && OSApp.Utils.isMD5( verifiedPassword ) &&
			( site.isHashed === false || !OSApp.Utils.isMD5( site.os_pw ) );
		if ( site.fwv === firmwareVersion && site.isHashed === auth.isHashed &&
			( auth.isHashed ? site.legacyAuth !== true : site.legacyAuth === true ) && !migratePassword ) {
			return;
		}

		site.fwv = firmwareVersion;
		site.isHashed = auth.isHashed;
		if ( migratePassword ) {
			site.os_pw = verifiedPassword;
		}
		if ( auth.isHashed ) {
			delete site.legacyAuth;
		} else {
			site.legacyAuth = true;
		}
		if ( !OSApp.Sites.isUpdateTargetCurrent( generation, controller ) || verifiedPassword !== OSApp.currentSession.pass ) return;
		OSApp.Storage.set( { "sites":JSON.stringify( sites ) }, function() {
			if ( OSApp.Sites.isUpdateTargetCurrent( generation, controller ) && verifiedPassword === OSApp.currentSession.pass ) {
				OSApp.Network.cloudSaveSites();
			}
		} );
	} );
};

// Controller options are later interpolated into legacy HTML controls. Enforce the documented
// numeric type for every known option while retaining unknown fields for forward compatibility.
// String/boolean compatibility fields are intentionally not numeric members of this allowlist.
OSApp.Sites.sanitizeJsonOptions = function( options ) {
	var numericKeys = {
		fwv: true,
		fwm: true,
		hwv: true,
		hwt: true,
		dexp: true,
		mexp: true,
		rlp: true
	},
		sanitized = {},
		key;

	if ( !options || typeof options !== "object" || Array.isArray( options ) ) {
		return sanitized;
	}

	if ( OSApp.Constants && OSApp.Constants.keyIndex ) {
		Object.keys( OSApp.Constants.keyIndex ).forEach( function( optionKey ) {
			numericKeys[ optionKey ] = true;
		} );
	}

	for ( key in options ) {
		if ( !Object.prototype.hasOwnProperty.call( options, key ) ) {
			continue;
		}
		if ( key === "__proto__" || key === "prototype" || key === "constructor" ) {
			continue;
		}
		if ( numericKeys[ key ] ) {
			if ( typeof options[ key ] === "number" && Number.isFinite( options[ key ] ) ) {
				sanitized[ key ] = options[ key ];
			}
		} else if ( key === "feature" || key === "fwf" ) {
			if ( typeof options[ key ] === "string" ) {
				sanitized[ key ] = options[ key ];
			}
		} else if ( key === "firstRun" ) {
			if ( typeof options[ key ] === "boolean" ) {
				sanitized[ key ] = options[ key ];
			}
		} else {
			sanitized[ key ] = options[ key ];
		}
	}

	return sanitized;
};

OSApp.Sites.isPlainObject = function( value ) {
	return !!value && typeof value === "object" && !Array.isArray( value );
};

OSApp.Sites.isBoundedJsonObject = function( value, maximumLength ) {
	var nodes = 0,
		visit = function( item, depth ) {
			nodes++;
			if ( nodes > 2048 || depth > 8 ) return false;
			if ( item === null || typeof item === "boolean" ) return true;
			if ( typeof item === "number" ) return Number.isFinite( item );
			if ( typeof item === "string" ) return item.length <= 4096;
			if ( Array.isArray( item ) ) {
				return item.length <= 512 && item.every( function( entry ) { return visit( entry, depth + 1 ); } );
			}
			if ( !OSApp.Sites.isPlainObject( item ) ) return false;
			var keys = Object.keys( item );
			return keys.length <= 128 && keys.every( function( key ) {
				return key !== "__proto__" && key !== "prototype" && key !== "constructor" && key.length <= 128 &&
					visit( item[ key ], depth + 1 );
			} );
		};

	if ( !OSApp.Sites.isPlainObject( value ) || !visit( value, 0 ) ) return false;
	try {
		return JSON.stringify( value ).length <= ( maximumLength || 65536 );
	} catch ( error ) { // eslint-disable-line no-unused-vars
		return false;
	}
};

OSApp.Sites.isSettingsResponse = function( settings ) {
	return OSApp.Sites.isPlainObject( settings ) && typeof settings.loc === "string" && settings.loc.length <= 1000 &&
		Number.isSafeInteger( settings.en ) && ( settings.en === 0 || settings.en === 1 ) &&
		Number.isSafeInteger( settings.nbrd ) && settings.nbrd >= 1 && settings.nbrd <= 255 &&
		( typeof settings.ps === "undefined" || OSApp.Sites.isProgramStatusResponse( settings.ps ) ) &&
		( typeof settings.lrun === "undefined" || OSApp.Sites.isFiniteIntegerArray( settings.lrun, 16, 4 ) ) &&
		( typeof settings.ifkey === "undefined" || typeof settings.ifkey === "string" && settings.ifkey.length <= 4096 ) &&
		( typeof settings.dname === "undefined" || typeof settings.dname === "string" && settings.dname.length <= 128 ) &&
		( typeof settings.mac === "undefined" || typeof settings.mac === "string" && settings.mac.length <= 64 ) &&
		( typeof settings.wsp === "undefined" || typeof settings.wsp === "string" && settings.wsp.length <= 2048 ) &&
		( typeof settings.gpio === "undefined" ||
			OSApp.Sites.isIntegerArrayInRange( settings.gpio, 256, 0, 0, 255 ) ) &&
		( typeof settings.wsp === "undefined" || OSApp.Sites.isBoundedJsonObject( settings.wto, 65536 ) ) &&
		[ "wto", "mqtt", "email", "otc" ].every( function( key ) {
			return typeof settings[ key ] === "undefined" || OSApp.Sites.isBoundedJsonObject( settings[ key ], 65536 );
		} );
};

OSApp.Sites.isFiniteIntegerArray = function( values, maximumLength, minimumLength ) {
	return Array.isArray( values ) && values.length >= ( minimumLength || 0 ) && values.length <= maximumLength &&
		values.every( function( value ) {
			return Number.isSafeInteger( value );
		} );
};

OSApp.Sites.isIntegerArrayInRange = function( values, maximumLength, minimumLength, minimum, maximum ) {
	return OSApp.Sites.isFiniteIntegerArray( values, maximumLength, minimumLength ) && values.every( function( value ) {
		return value >= minimum && value <= maximum;
	} );
};

OSApp.Sites.isProgramStatusResponse = function( rows, stationCount ) {
	return Array.isArray( rows ) && rows.length >= ( stationCount || 0 ) && rows.length <= 2040 &&
		rows.every( function( row ) {
			return OSApp.Sites.isFiniteIntegerArray( row, 16, 2 ) && row[ 0 ] >= 0 && row[ 0 ] <= 256 &&
				row[ 1 ] >= 0 && row[ 1 ] <= 0xffffffff &&
				( typeof row[ 2 ] === "undefined" || row[ 2 ] >= 0 && row[ 2 ] <= 0xffffffff ) &&
				( typeof row[ 3 ] === "undefined" || row[ 3 ] >= 0 && row[ 3 ] <= 255 );
		} );
};

OSApp.Sites.isStationsResponse = function( stations ) {
	if ( !OSApp.Sites.isPlainObject( stations ) || !Array.isArray( stations.snames ) ||
		stations.snames.length > 2040 || !stations.snames.every( function( name ) {
			return typeof name === "string" && name.length <= 128;
		} ) ) {
		return false;
	}

	var boardCount = Math.ceil( stations.snames.length / 8 ),
		attributes = [ "masop", "masop2", "ignore_rain", "ignore_sn1", "ignore_sn2", "act_relay", "stn_dis", "stn_seq", "stn_spe" ];

	if ( !OSApp.Sites.isIntegerArrayInRange( stations.masop, boardCount, boardCount, 0, 255 ) ) return false;
	if ( typeof stations.stn_grp !== "undefined" && ( !Array.isArray( stations.stn_grp ) ||
		stations.stn_grp.length !== stations.snames.length || !stations.stn_grp.every( function( gid ) {
			return Number.isSafeInteger( gid ) && ( gid === OSApp.Constants.options.PARALLEL_GID_VALUE ||
				gid >= 0 && gid < OSApp.Constants.options.NUM_SEQ_GROUPS );
		} ) ) ) return false;
	return attributes.every( function( key ) {
		return typeof stations[ key ] === "undefined" ||
			OSApp.Sites.isIntegerArrayInRange( stations[ key ], boardCount, boardCount, 0, 255 );
	} );
};

OSApp.Sites.isProgramsResponse = function( programs, firmwareVersion, stationCount ) {
	if ( !OSApp.Sites.isPlainObject( programs ) || !Array.isArray( programs.pd ) || programs.pd.length > 256 ||
		( typeof programs.nprogs !== "undefined" && ( !Number.isSafeInteger( programs.nprogs ) ||
			programs.nprogs !== programs.pd.length ) ) ||
		( typeof programs.nboards !== "undefined" && ( !Number.isSafeInteger( programs.nboards ) ||
			programs.nboards < 0 || programs.nboards > 255 ) ) ) return false;

	var modernFirmware = typeof firmwareVersion === "number" && firmwareVersion >= 210,
		legacyFirmware = typeof firmwareVersion === "string" && /ospi/i.test( firmwareVersion ) ||
			typeof firmwareVersion === "number" && firmwareVersion < 210,
		boardCount = Number.isSafeInteger( programs.nboards ) ? programs.nboards :
			( Number.isSafeInteger( stationCount ) ? Math.ceil( stationCount / 8 ) : undefined ),
		isModernProgram = function( program ) {
			if ( !Array.isArray( program ) || program.length < 6 || program.length > 8 ||
				!OSApp.Sites.isIntegerArrayInRange( program.slice( 0, 3 ), 3, 3, 0, 255 ) ||
				!OSApp.Sites.isIntegerArrayInRange( program[ 3 ], 4, 4, -1, 65535 ) ||
				!OSApp.Sites.isIntegerArrayInRange( program[ 4 ], 2040, 0, 0, 65535 ) ||
				typeof program[ 5 ] !== "string" || program[ 5 ].length > 128 ) return false;
			if ( Number.isSafeInteger( stationCount ) && program[ 4 ].length !== stationCount ) return false;
			if ( typeof program[ 6 ] !== "undefined" &&
				( !OSApp.Sites.isFiniteIntegerArray( program[ 6 ], 3, 3 ) ||
					( program[ 6 ][ 0 ] !== 0 && program[ 6 ][ 0 ] !== 1 ) || program[ 6 ][ 1 ] < 0 ||
					program[ 6 ][ 1 ] > 415 || program[ 6 ][ 2 ] < 0 || program[ 6 ][ 2 ] > 415 ) ) return false;
			return typeof program[ 7 ] === "undefined" || Number.isSafeInteger( program[ 7 ] ) ||
				OSApp.Sites.isBoundedJsonObject( program[ 7 ], 4096 );
		},
		isLegacyProgram = function( program ) {
			return Number.isSafeInteger( boardCount ) && boardCount > 0 &&
				OSApp.Sites.isFiniteIntegerArray( program, 7 + boardCount, 7 + boardCount ) &&
				OSApp.Sites.isIntegerArrayInRange( program.slice( 0, 3 ), 3, 3, 0, 255 ) &&
				program[ 3 ] >= -32768 && program[ 3 ] <= 32767 &&
				program[ 4 ] >= -32768 && program[ 4 ] <= 32767 &&
				program[ 5 ] >= 0 && program[ 5 ] <= 32767 && program[ 6 ] >= 0 && program[ 6 ] <= 65535 &&
				OSApp.Sites.isIntegerArrayInRange( program.slice( 7 ), boardCount, boardCount, 0, 255 );
		};

	if ( Number.isSafeInteger( stationCount ) && Number.isSafeInteger( boardCount ) &&
		boardCount !== Math.ceil( stationCount / 8 ) ) return false;
	return programs.pd.every( function( program ) {
		if ( modernFirmware ) return isModernProgram( program );
		if ( legacyFirmware ) return isLegacyProgram( program );
		return isModernProgram( program ) || isLegacyProgram( program );
	} );
};

OSApp.Sites.isAggregateResponse = function( data ) {
	if ( !OSApp.Sites.isPlainObject( data ) || !OSApp.Firmware.isFullOptionsResponse( data.options ) ||
		!OSApp.Sites.isSettingsResponse( data.settings ) || !OSApp.Sites.isStationsResponse( data.stations ) ||
		!OSApp.Sites.isPlainObject( data.status ) ) {
		return false;
	}

	var stationCount = data.stations.snames.length;
	return OSApp.Sites.isProgramsResponse( data.programs, data.options.fwv, stationCount ) &&
		OSApp.Sites.isProgramStatusResponse( data.settings.ps, stationCount ) && data.settings.ps.length === stationCount &&
		OSApp.Sites.isFiniteIntegerArray( data.settings.lrun, 16, 4 ) &&
		data.settings.nbrd === Math.ceil( stationCount / 8 ) &&
		( typeof data.options.uwt === "undefined" || OSApp.Sites.isPlainObject( data.settings.wto ) ) &&
		OSApp.Sites.isIntegerArrayInRange( data.status.sn, stationCount, stationCount, 0, 1 );
};

OSApp.Sites.isControllerResponse = function( controller ) {
	if ( !OSApp.Sites.isPlainObject( controller ) || !OSApp.Firmware.isFullOptionsResponse( controller.options ) ||
		!OSApp.Sites.isStationsResponse( controller.stations ) ||
		!OSApp.Sites.isSettingsResponse( controller.settings ) ) {
		return false;
	}

	var stationCount = controller.stations.snames.length;
	return OSApp.Sites.isProgramsResponse( controller.programs, controller.options.fwv, stationCount ) &&
		OSApp.Sites.isProgramStatusResponse( controller.settings.ps, stationCount ) && controller.settings.ps.length === stationCount &&
		OSApp.Sites.isFiniteIntegerArray( controller.settings.lrun, 16, 4 ) &&
		controller.settings.nbrd === Math.ceil( stationCount / 8 ) &&
		( typeof controller.options.uwt === "undefined" || OSApp.Sites.isPlainObject( controller.settings.wto ) ) &&
		OSApp.Sites.isIntegerArrayInRange( controller.status, stationCount, stationCount, 0, 1 );
};

OSApp.Sites.rejectInvalidResponse = function( error ) {
	return $.Deferred().reject( error || { status: 0, statusText: "invalid-response" } ).promise();
};

OSApp.Sites.isUpdateTargetCurrent = function( generation, controller ) {
	return generation === ( OSApp.currentSession.generation || 0 ) && controller === OSApp.currentSession.controller;
};

OSApp.Sites.sanitizeStationSpecial = function( special ) {
	var sanitized = {};

	if ( !OSApp.Sites.isPlainObject( special ) ) {
		return null;
	}

	Object.keys( special ).forEach( function( sid ) {
		var entry = special[ sid ];

		if ( !/^\d+$/.test( sid ) || !OSApp.Sites.isPlainObject( entry ) ||
			!Number.isSafeInteger( entry.st ) || entry.st < 0 || entry.st > 6 ||
			typeof entry.sd !== "string" || entry.sd.length > 4096 ) {
			return;
		}

		sanitized[ sid ] = { st: entry.st, sd: entry.sd };
	} );

	return sanitized;
};

// Run a dependent set of legacy endpoints against an isolated clone and install it only after
// every response validates. This prevents periodic and initial refreshes from exposing mixed
// old/new controller state when one endpoint fails or the station count changes. The shared tail
// also serializes the status and full-data refresh loops: both replace the controller object, so
// allowing them to overlap would make one valid same-session refresh appear stale.
OSApp.Sites.controllerSnapshotTail = OSApp.Sites.controllerSnapshotTail || $.Deferred().resolve().promise();
OSApp.Sites.updateControllerSnapshot = function( methods ) {
	var requestedGeneration = OSApp.currentSession.generation || 0,
		requestedMethods = methods.slice(),
		run = function() {
			var source, staged,
				sequence = $.Deferred().resolve().promise();

			// Capture the controller only when this queued refresh starts. A preceding same-session
			// refresh may legitimately have installed a newer snapshot while this request waited.
			if ( requestedGeneration !== ( OSApp.currentSession.generation || 0 ) ) {
				return OSApp.Sites.rejectInvalidResponse( { status:0, statusText:"stale-session" } );
			}
			source = OSApp.currentSession.controller;
			staged = $.extend( true, {}, source );

			requestedMethods.forEach( function( method ) {
				sequence = sequence.then( function() {
					if ( !OSApp.Sites.isUpdateTargetCurrent( requestedGeneration, source ) ) {
						return OSApp.Sites.rejectInvalidResponse( { status:0, statusText:"stale-session" } );
					}
					return OSApp.Sites[ method ]( undefined, staged );
				} );
			} );

			return sequence.then( function() {
				if ( !OSApp.Sites.isUpdateTargetCurrent( requestedGeneration, source ) ||
					!OSApp.Sites.isControllerResponse( staged ) ) return OSApp.Sites.rejectInvalidResponse();
				OSApp.currentSession.controller = staged;
				return staged;
			} );
		},
		request = OSApp.Sites.controllerSnapshotTail.then( run, run );

	// A failed snapshot must not poison the queue, while its own caller still receives the failure.
	OSApp.Sites.controllerSnapshotTail = request.then( function() {}, function() {} );
	return request;
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

OSApp.Sites.teardownAddSiteAttempt = function( popup ) {
	popup = $( popup );
	var attempt = popup.data( "site-attempt" );
	if ( !attempt ) return true;
	if ( attempt.committing ) {
		attempt.closeRequested = true;
		return false;
	}

	attempt.active = false;
	( attempt.requests || [] ).forEach( function( request ) {
		if ( request && typeof request.abort === "function" ) request.abort();
	} );
	attempt.requests = [];
	if ( attempt.loaderOwned && attempt.generation === ( OSApp.currentSession.generation || 0 ) ) {
		$.mobile.loading( "hide" );
	}
	attempt.loaderOwned = false;
	popup.removeData( "site-attempt" );
	return true;
};

OSApp.Sites.showAddNew = function( autoIP, closeOld ) {
	var previous = $( "#addnew" );
	if ( OSApp.Sites.teardownAddSiteAttempt( previous ) === false ) {
		OSApp.Errors.showError( OSApp.Language._( "Please wait while the device is saved." ) );
		return false;
	}
	previous.popup( "destroy" ).remove();

	var isAuto = ( autoIP ) ? true : false,
		addnew = $( "<div data-role='popup' id='addnew' data-theme='a' data-overlay-theme='b'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "New OpenSprinkler Device" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content' id='addnew-content'>" +
				"<form method='post' novalidate>" +
					"<label for='os_name'>" + OSApp.Language._( "Device Name:" ) + "</label>" +
					"<p class='smaller'>" +
						OSApp.Language._( "A custom name for this device" ) +
					"</p>" +
					"<input autocorrect='off' spellcheck='false' type='text' name='os_name' maxlength='128' " +
						"id='os_name' placeholder='Home'>" +
					( isAuto ? "" :
						"<label class='url-field' for='os_url'>" + OSApp.Language._( "Device Address:" ) + "</label>" +
					"<p class='smaller'>" +
						OSApp.Language._( "May be an IP, URL, or OTC Token" ) +
					"</p>" ) +
						"<input data-wrapper-class='url-field' " + ( isAuto ? "data-role='none' style='display:none' " : "" ) +
							"autocomplete='off' autocorrect='off' autocapitalize='off' " +
							"spellcheck='false' type='text' inputmode='url' pattern='' name='os_url' id='os_url' " +
							"value='" + ( isAuto ? autoIP : "" ) + "'>" +
					"<label for='os_pw'>" + OSApp.Language._( "Device Password:" ) + "</label>" +
					"<input type='password' name='os_pw' id='os_pw' value=''>" +
					"<label for='save_pw'>" + OSApp.Language._( "Save Password" ) + "</label>" +
					"<input type='checkbox' data-wrapper-class='save_pw' name='save_pw' " +
						"id='save_pw' data-mini='true' checked='checked'>" +
					"<label for='os_legacy_auth'>" + OSApp.Language._( "Legacy firmware (pre-2.1.3; sends password without hashing)" ) + "</label>" +
					"<input type='checkbox' name='os_legacy_auth' id='os_legacy_auth' data-mini='true'>" +
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
		if ( OSApp.Sites.teardownAddSiteAttempt( this ) !== false ) {
			$( this ).popup( "destroy" ).remove();
		}
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

	return false;
};

// Add a new site
// FIXME: rename this
OSApp.Sites.submitNewSite = function( ssl, useAuth ) {
	var popup = $( "#addnew" ),
		existing = popup.data( "site-attempt" );
	if ( existing && existing.active && existing.inFlight ) return false;
	if ( existing ) existing.active = false;
	if ( document.activeElement && typeof document.activeElement.blur === "function" ) document.activeElement.blur();

	var findField = function( selector ) {
			var field = popup.find( selector );
			return field.length ? field : $( selector ).first();
		},
		fieldValue = function( selector ) {
			var field = findField( selector );
			return field.length && typeof field.val() === "string" ? field.val() : "";
		},
		attempt = {
			active: true,
			inFlight: false,
			loaderOwned: false,
			requests: [],
			generation: OSApp.currentSession.generation || 0,
			name: fieldValue( "#os_name" ).trim(),
			input: fieldValue( "#os_url" ).trim(),
			rawPassword: fieldValue( "#os_pw" ),
			savePassword: findField( "#save_pw" ).is( ":checked" ),
			operatorLegacy: findField( "#os_legacy_auth" ).is( ":checked" ),
			sslChecked: findField( "#os_usessl" ).is( ":checked" ),
			authChecked: findField( "#os_useauth" ).is( ":checked" ),
			ssl: ssl === true,
			useAuth: useAuth === true,
			authUser: fieldValue( "#os_auth_user" ),
			authPassword: fieldValue( "#os_auth_pw" )
		},
		connectionType = /^OT[0-9a-f]*$/i.test( attempt.input ) ? "token" : "direct",
		rawUrl = connectionType === "direct" ? attempt.input : null,
		hasExplicitScheme = !!( rawUrl && /^https?:\/\//i.test( rawUrl ) ),
		parsedUrl, urlStr;

	attempt.token = connectionType === "token" ? attempt.input : null;
	urlStr = rawUrl;
	if ( urlStr && !hasExplicitScheme ) urlStr = "http://" + urlStr;
	if ( urlStr ) {
		try {
			parsedUrl = new URL( urlStr );
			if ( ( parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:" ) || !parsedUrl.host ||
				parsedUrl.search || parsedUrl.hash ) throw new Error( "Invalid controller URL" );
			if ( hasExplicitScheme ) attempt.ssl = parsedUrl.protocol === "https:";
			if ( parsedUrl.username || parsedUrl.password ) {
				attempt.authUser = decodeURIComponent( parsedUrl.username );
				attempt.authPassword = decodeURIComponent( parsedUrl.password );
				attempt.useAuth = true;
			}
			parsedUrl.username = "";
			parsedUrl.password = "";
			attempt.ip = OSApp.Sites.normalizeSiteAddress( parsedUrl.host + parsedUrl.pathname );
		} catch ( error ) { // eslint-disable-line no-unused-vars
			attempt.ip = null;
		}
	}

	popup.data( "site-attempt", attempt );
	var isCurrent = function() {
		return attempt.active && popup.data( "site-attempt" ) === attempt &&
			attempt.generation === ( OSApp.currentSession.generation || 0 ) && popup.length &&
			$.contains( document.documentElement, popup[ 0 ] );
		},
		settleLoader = function() {
			if ( attempt.loaderOwned ) {
				attempt.loaderOwned = false;
				$.mobile.loading( "hide" );
			}
		},
		showFailure = function( message ) {
			if ( !isCurrent() ) return;
			attempt.inFlight = false;
			settleLoader();
			OSApp.Errors.showError( message );
		},
		trackRequest = function( request ) {
			if ( request && typeof request.abort === "function" ) attempt.requests.push( request );
			return request;
		},
		showAuth, requestOptions, persistSite;

	if ( ( !attempt.ip && !attempt.token ) || attempt.token && !OSApp.Utils.isValidOTC( attempt.token ) ) {
		showFailure( attempt.token ?
			OSApp.Language._( "OpenThings Token must contain OT followed by 30 hexadecimal characters." ) :
			OSApp.Language._( "A valid IP address, URL, or token is required to continue." ) );
		return false;
	}
	if ( !hasExplicitScheme && attempt.sslChecked ) attempt.ssl = true;

	persistSite = function( reply, sites, auth ) {
		if ( !isCurrent() ) return;
		var is183 = typeof reply === "string" && /var (en|sd)\s*=/.test( reply ) ||
				reply && typeof reply.fwv === "number" && reply.fwv === 203,
			firmwareVersion = is183 ? 183 : reply && reply.fwv,
			name = attempt.name;
		if ( !sites || typeof sites !== "object" || Array.isArray( sites ) ||
			( !is183 && !OSApp.Firmware.isFullOptionsResponse( reply ) ) ) {
			showFailure( OSApp.Language._( "Check device password and try again." ) );
			return;
		}
		auth = auth || OSApp.Firmware.getPasswordAuth( firmwareVersion, attempt.rawPassword, md5 );
		if ( name === "" ) {
			var siteNumber = Object.keys( sites ).length + 1;
			while ( Object.prototype.hasOwnProperty.call( sites, "Site " + siteNumber ) ) siteNumber++;
			name = "Site " + siteNumber;
		}
		if ( !OSApp.Sites.isSafeSiteName( name ) || Object.prototype.hasOwnProperty.call( sites, name ) ) {
			showFailure( OSApp.Language._( "Please choose a unique site name." ) );
			return;
		}

		var site = {
			os_token: attempt.token,
			os_ip: attempt.ip,
			fwv: firmwareVersion,
			isHashed: auth.isHashed,
			os_pw: attempt.savePassword ? auth.password : ""
		};
		if ( !auth.isHashed ) site.legacyAuth = true;
		if ( attempt.ssl ) site.ssl = "1";
		if ( attempt.useAuth ) {
			site.auth_user = attempt.authUser;
			site.auth_pw = attempt.authPassword;
		}
		if ( is183 ) site.is183 = "1";
		sites[ name ] = site;

		attempt.committing = true;
		attempt.inFlight = false;
		popup.find( ":input,button,a" ).prop( "disabled", true ).addClass( "ui-disabled" );
		OSApp.Storage.set( { sites: JSON.stringify( sites ), current_site: name }, function() {
			if ( !isCurrent() ) return;
			settleLoader();
			attempt.committing = false;
			attempt.active = false;
			popup.removeData( "site-attempt" );
			OSApp.currentSession.token = attempt.token;
			OSApp.currentSession.ip = attempt.ip;
			OSApp.currentSession.pass = auth.password;
			OSApp.currentSession.prefix = attempt.ssl ? "https://" : "http://";
			OSApp.currentSession.auth = attempt.useAuth;
			OSApp.currentSession.authUser = attempt.useAuth ? attempt.authUser : undefined;
			OSApp.currentSession.authPass = attempt.useAuth ? attempt.authPassword : undefined;
			OSApp.currentSession.fw183 = !!is183;
			popup.find( "#os_name,#os_url,#os_pw,#os_auth_user,#os_auth_pw,#os_token" ).val( "" );
			OSApp.Network.cloudSaveSites();
			OSApp.Sites.updateSiteList( Object.keys( sites ), name );
			if ( popup.hasClass( "ui-popup" ) ) popup.popup( "destroy" );
			popup.remove();
			OSApp.Sites.newLoad();
		} );
	};

	showAuth = function() {
		if ( !isCurrent() ) return;
		attempt.inFlight = false;
		settleLoader();
		var html = popup.find( "#addnew-auth" );
		if ( !html.length ) {
			html = $( "<div class='ui-content' id='addnew-auth'><form method='post' novalidate>" +
				"<p class='center smaller'>" + OSApp.Language._( "Authorization Required" ) + "</p>" +
				"<label for='os_auth_user'>" + OSApp.Language._( "Username:" ) + "</label>" +
				"<input autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' type='text' name='os_auth_user' id='os_auth_user'>" +
				"<label for='os_auth_pw'>" + OSApp.Language._( "Password:" ) + "</label>" +
				"<input type='password' name='os_auth_pw' id='os_auth_pw'>" +
				"<input type='submit' value='" + OSApp.Language._( "Submit" ) + "'></form></div>" ).enhanceWithin();
			popup.append( html );
		}
		html.find( "#os_auth_user" ).val( attempt.authUser );
		html.find( "#os_auth_pw" ).val( attempt.authPassword );
		html.off( "submit.siteAuth" ).on( "submit.siteAuth", "form", function() {
			attempt.authUser = String( html.find( "#os_auth_user" ).val() || "" );
			attempt.authPassword = String( html.find( "#os_auth_pw" ).val() || "" );
			attempt.useAuth = true;
			html.hide();
			popup.find( "#addnew-content" ).show();
			requestOptions( OSApp.Firmware.getPasswordAuth(
				attempt.operatorLegacy ? 212 : undefined, attempt.rawPassword, md5 ), attempt.operatorLegacy );
			return false;
		} );
		popup.find( "#addnew-content" ).hide();
		html.show();
		if ( typeof popup.popup === "function" ) popup.popup( "reposition", { positionTo:"window" } );
	};

	requestOptions = function( auth, allowLegacyFallback ) {
		if ( !isCurrent() ) return;
		var prefix = attempt.ssl ? "https://" : "http://",
			urlDest = "/jo?pw=" + encodeURIComponent( auth.password ),
			base = attempt.token ? "https://cloud.openthings.io/forward/v1/" + attempt.token : prefix + attempt.ip,
			authHeader = !attempt.token && attempt.useAuth ?
				OSApp.Utils.getBasicAuthHeader( attempt.authUser, attempt.authPassword ) : null;
		if ( attempt.useAuth && !attempt.token && !authHeader ) {
			showFailure( OSApp.Language._( "Please enter valid authorization credentials." ) );
			return;
		}
		attempt.inFlight = true;
		if ( !attempt.loaderOwned ) {
			attempt.loaderOwned = true;
			$.mobile.loading( "show" );
		}
		var beforeSend = function( xhr ) {
			if ( authHeader ) xhr.setRequestHeader( "Authorization", authHeader );
		};
		trackRequest( $.ajax( {
			url: base + urlDest,
			type: "GET",
			dataType: "json",
			timeout: 10000,
			global: false,
			beforeSend: beforeSend,
			error: function( error ) {
				if ( !isCurrent() ) return;
				if ( !attempt.useAuth && error.status === 401 ) {
					showAuth();
					return;
				}
				if ( allowLegacyFallback === true ) {
					trackRequest( $.ajax( {
						url: base,
						type: "GET",
						dataType: "text",
						timeout: 10000,
						global: false,
						cache: true,
						beforeSend: beforeSend,
						success: function( reply ) {
							if ( !isCurrent() ) return;
							OSApp.Storage.get( "sites", function( stored ) {
								if ( isCurrent() ) persistSite( reply, OSApp.Sites.parseSites( stored.sites ),
									OSApp.Firmware.getPasswordAuth( 183, attempt.rawPassword, md5 ) );
							} );
						},
						error: function() {
							if ( !isCurrent() ) return;
							if ( !hasExplicitScheme && !attempt.token && !attempt.ssl ) {
								attempt.ssl = true;
								requestOptions( auth, false );
							} else showFailure( OSApp.Language._( "Check IP/URL/Port and try again." ) );
						}
					} ) );
					return;
				}
				if ( !hasExplicitScheme && !attempt.token && !attempt.ssl ) {
					attempt.ssl = true;
					requestOptions( auth, false );
				} else showFailure( OSApp.Language._( "Check IP/URL/Port and try again." ) );
			},
			success: function( reply ) {
				if ( !isCurrent() ) return;
				var selectedAuth = OSApp.Firmware.getPasswordAuth(
					reply && reply.fwv, attempt.rawPassword, md5, attempt.operatorLegacy );
				if ( !OSApp.Firmware.isFullOptionsResponse( reply ) || auth.isHashed !== selectedAuth.isHashed ) {
					showFailure( OSApp.Language._( "Check device password and try again." ) );
					return;
				}
				OSApp.Storage.get( "sites", function( stored ) {
					if ( isCurrent() ) persistSite( reply, OSApp.Sites.parseSites( stored.sites ), selectedAuth );
				} );
			}
		} ) );
	};

	if ( !attempt.useAuth && attempt.authChecked ) {
		showAuth();
		return false;
	}
	requestOptions( OSApp.Firmware.getPasswordAuth(
		attempt.operatorLegacy ? 212 : undefined, attempt.rawPassword, md5 ), attempt.operatorLegacy );
	return false;
};

// Gather new controller information and load home page
OSApp.Sites.newLoad = function() {

	// Get the current site name from the site select drop down
	var name = $( "#site-selector" ).val(),
		loadGeneration,
		loading = "<div class='logo'></div>" +
			"<h1 style='padding-top:5px'>" + OSApp.Language._( "Connecting to" ) + " " + OSApp.Utils.htmlEscape( name ) + "</h1>" +
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
		OSApp.currentSession.generation = ( OSApp.currentSession.generation || 0 ) + 1;
		if ( OSApp.Weather && typeof OSApp.Weather.cancelUpdate === "function" ) {
			OSApp.Weather.cancelUpdate();
		}
		$.ajaxq.abort( "default" );
		$.ajaxq.abort( "change" );
		$.mobile.loading( "hide" );
		OSApp.UIDom.changePage( "#site-control", {
			transition: "none"
		} );
	} );

	// Invalidate every callback created for the previous controller session.
	OSApp.currentSession.generation = ( OSApp.currentSession.generation || 0 ) + 1;
	loadGeneration = OSApp.currentSession.generation;
	if ( OSApp.Weather && typeof OSApp.Weather.cancelUpdate === "function" ) {
		OSApp.Weather.cancelUpdate();
	}

	//Empty object which will store device data
	OSApp.currentSession.controller = {};

	//Empty notifications
	OSApp.Notifications.clearNotifications();

	//Empty timers object
	OSApp.uiState.timers = {};

	//Clear the current queued AJAX requests (used for previous OSApp.currentSession.controller connection)
	$.ajaxq.abort( "default" );
	$.ajaxq.abort( "change" );

	OSApp.Sites.updateController(
		function() {
			if ( loadGeneration !== OSApp.currentSession.generation ) {
				return;
			}
			var weatherAdjust = $( ".weatherAdjust" ),
				changePassword = $( ".changePassword" );

			$.mobile.loading( "hide" );
			OSApp.Sites.persistSitePasswordMetadata( name );
			OSApp.Weather.checkURLandUpdateWeather();

			if ( OSApp.Firmware.checkOSVersion( 210 ) ) {
				weatherAdjust.css( "display", "" );
			} else {
				weatherAdjust.hide();
			}

			if ( OSApp.Analog.checkAnalogSensorAvail() ) {
				OSApp.Analog.updateAnalogSensor();
				OSApp.Analog.updateProgramAdjustments();
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
			if ( !OSApp.currentSession.local && typeof OSApp.currentSession.controller?.settings?.eip === "number" ) {
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
			if ( loadGeneration !== OSApp.currentSession.generation ) {
				return;
			}
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
	var generation = OSApp.currentSession.generation || 0,
		controller = OSApp.currentSession.controller,
		installedController = controller,
		finish = function() {
			if ( generation !== ( OSApp.currentSession.generation || 0 ) ||
				installedController !== OSApp.currentSession.controller ||
				!OSApp.Sites.isControllerResponse( installedController ) ) return OSApp.Sites.rejectInvalidResponse();
			if ( installedController.settings.loc.match( OSApp.Constants.regex.GPS ) ) {
				var location = installedController.settings.loc.split( "," );
				OSApp.currentSession.coordinates = [ parseFloat( location[ 0 ] ), parseFloat( location[ 1 ] ) ];
			}
			$( "html" ).trigger( "datarefresh" );
			OSApp.Status.checkStatus();
			callback();
	};

	if ( OSApp.currentSession.isControllerConnected() && OSApp.Firmware.checkOSVersion( 216 ) ) {
		return OSApp.Firmware.sendToOS( "/ja?pw=", "json" ).then( function( data ) {
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, controller ) ) return OSApp.Sites.rejectInvalidResponse();
			if ( !OSApp.Sites.isAggregateResponse( data ) ) return OSApp.Sites.rejectInvalidResponse();

			// The /ja call does not contain special station data, so let's cache it
			var special = OSApp.currentSession.controller.special;
			if ( data.options ) {
				data.options = OSApp.Sites.sanitizeJsonOptions( data.options );
			}

			OSApp.currentSession.controller = data;
			installedController = data;

			// Restore the station cache to the object
			OSApp.currentSession.controller.special = special;

			// Fix the station status array
			OSApp.currentSession.controller.status = OSApp.currentSession.controller.status.sn;

		} ).then( finish ).fail( fail );
	} else {
		return OSApp.Sites.updateControllerSnapshot( [
			"updateControllerOptions", "updateControllerStations", "updateControllerPrograms",
			"updateControllerSettings", "updateControllerStatus"
		] ).then( function( stagedController ) {
			installedController = stagedController;
			return finish();
		} ).fail( fail );
	}
};

OSApp.Sites.updateControllerPrograms = function( callback, destination ) {
	callback = callback || function() {};
	var generation = OSApp.currentSession.generation || 0,
		sessionController = OSApp.currentSession.controller,
		controller = destination || sessionController;

	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/gp?d=0" ).then( function( programs ) {
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) ||
				typeof programs !== "string" || programs.length > 2097152 ) {
				return OSApp.Sites.rejectInvalidResponse();
			}

			var variablePattern = /(nprogs|nboards|mnp)\s*=\s*(\d+)/g,
				programPattern = /pd\[(\d+)\]\s*=\s*\[([^\]]*)\]\s*;/g,
				newdata = { pd: [] }, seen = {}, match, values, index, count = 0;

			while ( ( match = variablePattern.exec( programs ) ) !== null ) {
				newdata[ match[ 1 ] ] = Number( match[ 2 ] );
			}
			if ( !Number.isSafeInteger( newdata.nprogs ) || newdata.nprogs < 0 || newdata.nprogs > 256 ||
				!Number.isSafeInteger( newdata.nboards ) || newdata.nboards < 1 || newdata.nboards > 255 ||
				!Number.isSafeInteger( newdata.mnp ) || newdata.mnp < 0 || newdata.mnp > 256 ) {
				return OSApp.Sites.rejectInvalidResponse();
			}

			while ( ( match = programPattern.exec( programs ) ) !== null ) {
				index = Number( match[ 1 ] );
				values = match[ 2 ].trim() === "" ? [] : match[ 2 ].split( "," ).map( function( value ) {
					return /^-?\d+$/.test( value.trim() ) ? Number( value.trim() ) : NaN;
				} );
				if ( !Number.isSafeInteger( index ) || index < 0 || index >= newdata.nprogs || seen[ index ] ||
					values.length < 7 + newdata.nboards || values.length > 262 ||
					!values.every( Number.isSafeInteger ) ) {
					return OSApp.Sites.rejectInvalidResponse();
				}
				seen[ index ] = true;
				newdata.pd[ index ] = values;
				count++;
			}
			if ( count !== newdata.nprogs || newdata.pd.length !== newdata.nprogs ) {
				return OSApp.Sites.rejectInvalidResponse();
			}

			controller.programs = newdata;
			callback();
		} );
	} else {
		return OSApp.Firmware.sendToOS( "/jp?pw=", "json" ).then( function( programs ) {
			var firmwareVersion = controller.options && controller.options.fwv,
				stationCount = OSApp.Sites.isStationsResponse( controller.stations ) ? controller.stations.snames.length : undefined;
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) ||
				!OSApp.Sites.isProgramsResponse( programs, firmwareVersion, stationCount ) ) {
				return OSApp.Sites.rejectInvalidResponse();
			}
			controller.programs = programs;
			callback();
		} );
	}
};

OSApp.Sites.updateControllerStations = function( callback, destination ) {
	callback = callback || function() {};
	var generation = OSApp.currentSession.generation || 0,
		sessionController = OSApp.currentSession.controller,
		controller = destination || sessionController;
	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/vs" ).then( function( stations ) {
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) ||
				typeof stations !== "string" || stations.length > 2097152 ) {
				return OSApp.Sites.rejectInvalidResponse();
			}
			var names = /snames=\[(.*?)\];/.exec( stations ),
				masop = stations.match( /(?:masop|mo)\s?[=|:]\s?\[(.*?)\]/ );
			if ( !names || !masop ) return OSApp.Sites.rejectInvalidResponse();

			names = names[ 1 ].split( "," );
			if ( names.length && names[ names.length - 1 ].trim() === "" ) names.pop();

			for ( var i = 0; i < names.length; i++ ) {
				var name = names[ i ].trim().match( /^(['"])(.*)\1$/ );
				if ( !name || name[ 2 ].length > 128 ) return OSApp.Sites.rejectInvalidResponse();
				names[ i ] = name[ 2 ];
			}

			if ( names.length > 2040 || !/^\s*\d+(?:\s*,\s*\d+)*\s*$/.test( masop[ 1 ] ) ) {
				return OSApp.Sites.rejectInvalidResponse();
			}
			masop = masop[ 1 ].split( "," ).map( function( value ) { return Number( value.trim() ); } );
			if ( !OSApp.Sites.isIntegerArrayInRange( masop, 255, Math.ceil( names.length / 8 ), 0, 255 ) ) {
				return OSApp.Sites.rejectInvalidResponse();
			}

			controller.stations = {
				"snames": names,
				"masop": masop,
				"maxlen": names.length
			};
			callback();
		} );
	} else {
		return OSApp.Firmware.sendToOS( "/jn?pw=", "json" ).then( function( stations ) {
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) || !OSApp.Sites.isStationsResponse( stations ) ) {
				return OSApp.Sites.rejectInvalidResponse();
			}
			controller.stations = stations;
			callback();
		} );
	}
};

OSApp.Sites.updateControllerOptions = function( callback, destination ) {
	callback = callback || function() {};
	var generation = OSApp.currentSession.generation || 0,
		sessionController = OSApp.currentSession.controller,
		controller = destination || sessionController;
	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/vo" ).then( function( options ) {
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) ||
				typeof options !== "string" || options.length > 2097152 ) return OSApp.Sites.rejectInvalidResponse();
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
				if ( !tmp ) return OSApp.Sites.rejectInvalidResponse();
				tmp = tmp[ 1 ].replace( /"/g, "" ).split( "," );

				for ( i = 0; i < tmp.length - 1; i = i + 4 ) {
					o = +tmp[ i + 3 ];
					if ( $.inArray( o, valid ) !== -1 ) {
						vars[ OSApp.Constants.keyIndex[ o ] ] = +tmp[ i + 2 ];
					}
				}
				vars.fwv = 183;
			}
			controller.options = vars;
			callback();
		} );
	} else {
		return OSApp.Firmware.sendToOS( "/jo?pw=", "json" ).then( function( options ) {
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) ||
				!OSApp.Firmware.isFullOptionsResponse( options ) ) return OSApp.Sites.rejectInvalidResponse();
			controller.options = OSApp.Sites.sanitizeJsonOptions( options );
			callback();
		} );
	}
};

OSApp.Sites.updateControllerStatus = function( callback, destination ) {
	callback = callback || function() {};
	var generation = OSApp.currentSession.generation || 0,
		sessionController = OSApp.currentSession.controller,
		controller = destination || sessionController,
		settleFailure = function( error ) {
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) || error &&
				( error.statusText === "abort" || error.statusText === "stale-session" ) ) {
				return OSApp.Sites.rejectInvalidResponse( error );
			}
			controller.status = [];
		};
	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "/sn0" ).then(
			function( status ) {
				if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) ) return OSApp.Sites.rejectInvalidResponse();
				if ( typeof status !== "string" || status.length > 2097152 ) return OSApp.Sites.rejectInvalidResponse();
				var bracketed = /\[((?:\s*[01]\s*,?)+)\]/.exec( status ),
					candidates, tmp;
				if ( bracketed ) {
					tmp = bracketed[ 1 ].indexOf( "," ) === -1 ? bracketed[ 1 ].replace( /\s/g, "" ).split( "" ) :
						bracketed[ 1 ].split( "," ).map( function( value ) { return value.trim(); } ).filter( Boolean );
				} else {
					candidates = status.match( /[01]+/g );
					if ( candidates ) candidates.sort( function( a, b ) { return b.length - a.length; } );
					tmp = candidates && candidates[ 0 ] ? candidates[ 0 ].split( "" ) : null;
				}
				if ( !tmp || tmp.length > 2040 ) return OSApp.Sites.rejectInvalidResponse();
				tmp = tmp.map( Number );

				controller.status = tmp;
				callback();
			},
			settleFailure );
	} else {
		return OSApp.Firmware.sendToOS( "/js?pw=", "json" ).then(
			function( status ) {
				if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) ) return OSApp.Sites.rejectInvalidResponse();
				if ( !OSApp.Sites.isPlainObject( status ) ||
					!OSApp.Sites.isIntegerArrayInRange( status.sn, 2040, 0, 0, 1 ) ||
					OSApp.Sites.isStationsResponse( controller.stations ) &&
					status.sn.length !== controller.stations.snames.length ) {
					return OSApp.Sites.rejectInvalidResponse();
				}
				controller.status = status.sn;
				callback();
			},
			settleFailure );
	}
};

OSApp.Sites.updateControllerSettings = function( callback, destination ) {
	callback = callback || function() {};
	var generation = OSApp.currentSession.generation || 0,
		sessionController = OSApp.currentSession.controller,
		controller = destination || sessionController,
		retainCachedSettings = function( error ) {
		if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) || error &&
			( error.statusText === "abort" || error.statusText === "stale-session" ) ) {
			return OSApp.Sites.rejectInvalidResponse( error );
		}
		var settings = controller.settings,
			stations = controller.stations;
		if ( !OSApp.Sites.isSettingsResponse( settings ) ) return OSApp.Sites.rejectInvalidResponse( error );
		if ( !Array.isArray( settings.ps ) && OSApp.Sites.isStationsResponse( stations ) ) {
			settings.ps = [];
			for ( var i = 0; i < stations.snames.length; i++ ) settings.ps.push( [ 0, 0 ] );
		}
		return settings;
	};
	if ( OSApp.currentSession.fw183 === true ) {

		// If the controller is using firmware 1.8.3, then parse the script tag for variables
		return OSApp.Firmware.sendToOS( "" ).then(
			function( settings ) {
				if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) ) return OSApp.Sites.rejectInvalidResponse();
				if ( typeof settings !== "string" ) return OSApp.Sites.rejectInvalidResponse();
				var varsRegex = /(ver|devt|nbrd|tz|en|rd|rs|mm|rdst|urs)\s?[=|:]\s?([\w|\d|."]+)/gm,
					loc = settings.match( /loc\s?[=|:]\s?["|'](.*)["|']/ ),
					lrun = settings.match( /lrun=\[(.*)\]/ ),
					ps = settings.match( /ps=\[(.*)\];/ ),
					vars = {}, tmp, i;

				if ( !loc || !lrun || !ps ) return OSApp.Sites.rejectInvalidResponse();
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
				if ( !OSApp.Sites.isSettingsResponse( vars ) || !OSApp.Sites.isProgramStatusResponse( vars.ps ) ||
					!OSApp.Sites.isFiniteIntegerArray( vars.lrun, 16, 4 ) ) {
					return OSApp.Sites.rejectInvalidResponse();
				}

				controller.settings = vars;
				callback();
			},
			retainCachedSettings );
	} else {
		return OSApp.Firmware.sendToOS( "/jc?pw=" ).then(
			function( settings ) {
				if ( !OSApp.Sites.isUpdateTargetCurrent( generation, sessionController ) ) return OSApp.Sites.rejectInvalidResponse();
				if ( typeof settings !== "object" || settings === null ) {
					if ( typeof settings !== "string" ) return OSApp.Sites.rejectInvalidResponse();
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
							// Corrupted JSON returned. Display error modal with fw update links
							OSApp.Errors.showCorruptedJsonModal( settings, OSApp.currentSession );
							return OSApp.Sites.rejectInvalidResponse();
						}
					}
				}

				var stationCount = OSApp.Sites.isStationsResponse( controller.stations ) ?
					controller.stations.snames.length : 0;
				if ( !OSApp.Sites.isSettingsResponse( settings ) ||
					!OSApp.Sites.isProgramStatusResponse( settings.ps, stationCount ) ||
					settings.ps.length !== stationCount || settings.nbrd !== Math.ceil( stationCount / 8 ) ) {
					return OSApp.Sites.rejectInvalidResponse();
				}

				if ( typeof settings.lrun === "undefined" ) {
					settings.lrun = [ 0, 0, 0, 0 ];
				}

				// Update the current coordinates if the user's location is using them
				if ( controller === sessionController && settings.loc.match( OSApp.Constants.regex.GPS ) ) {
					var location = settings.loc.split( "," );
					OSApp.currentSession.coordinates = [ parseFloat( location[ 0 ] ), parseFloat( location[ 1 ] ) ];
				}

				controller.settings = settings;
				callback();
			},
				retainCachedSettings );
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
						"<code></code>" +
						"<a class='ui-btn ui-corner-all ui-shadow red reset-options' style='width:80%;margin:5px auto;' href='#'>" +
							OSApp.Language._( "Reset All Options" ) +
						"</a>" +
						"<a class='ui-btn ui-corner-all ui-shadow submit' style='width:80%;margin:5px auto;' href='#'>" +
							OSApp.Language._( "Dismiss" ) +
						"</a>" +
					"</div>"
				);

				popup.find( "code" ).text( wto[ 0 ].substr( 7 ) );

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

	OSApp.uiState.showWeatherOptionsCorruptedNotification = true;
};

OSApp.Sites.updateControllerStationSpecial = function( callback ) {
	callback = callback || function() {};
	var generation = OSApp.currentSession.generation || 0,
		controller = OSApp.currentSession.controller;

	return OSApp.Firmware.sendToOS( "/je?pw=", "json" ).then(
		function( special ) {
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, controller ) ) {
				return OSApp.Sites.rejectInvalidResponse( { status: 0, statusText: "stale-session" } );
			}

			special = OSApp.Sites.sanitizeStationSpecial( special );
			if ( special === null ) return OSApp.Sites.rejectInvalidResponse();

			controller.special = special;
			callback();
		},
		function( error ) {
			if ( !OSApp.Sites.isUpdateTargetCurrent( generation, controller ) || error &&
				( error.statusText === "abort" || error.statusText === "stale-session" ) ) {
				return OSApp.Sites.rejectInvalidResponse( error );
			}
			controller.special = {};
		} );
};

// Change the current site (needs to be defined AFTER OSApp.Sites.checkConfigured!)
OSApp.Sites.updateSite = function( newsite ) {
	OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
		var sites = OSApp.Sites.parseSites( data.sites );
		if ( Object.prototype.hasOwnProperty.call( sites, newsite ) ) {
			if ( newsite !== data.current_site ) OSApp.Sites.invalidateCurrentSession();
			OSApp.UIDom.closePanel( function() {
				OSApp.Storage.set( { "current_site":newsite }, () => OSApp.Sites.checkConfigured() );
			} );
		}
	} );
};

OSApp.Sites.fixPasswordHash = function( current ) {
	var generation = OSApp.currentSession.generation || 0,
		controller = OSApp.currentSession.controller,
		originalPassword = OSApp.currentSession.pass;

	OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
		var sites = OSApp.Sites.parseSites( data.sites );

		if ( data.current_site === current && sites[ current ] && !OSApp.Utils.isMD5( originalPassword ) &&
			OSApp.Sites.isUpdateTargetCurrent( generation, controller ) && OSApp.currentSession.pass === originalPassword ) {
			var pw = md5( originalPassword );

			OSApp.Firmware.sendToOS(
				"/sp?pw=&npw=" + encodeURIComponent( pw ) +
				"&cpw=" + encodeURIComponent( pw ), "json"
			).done( function( info ) {
				if ( !OSApp.Sites.isPlainObject( info ) || info.result !== 1 ||
					!OSApp.Sites.isUpdateTargetCurrent( generation, controller ) ||
					OSApp.currentSession.pass !== originalPassword ) return;

				OSApp.Storage.get( [ "sites", "current_site" ], function( fresh ) {
					var freshSites = OSApp.Sites.parseSites( fresh.sites );
					if ( fresh.current_site !== current || !freshSites[ current ] ||
						!OSApp.Sites.isUpdateTargetCurrent( generation, controller ) ||
						OSApp.currentSession.pass !== originalPassword ) return;

					freshSites[ current ].os_pw = pw;
					freshSites[ current ].isHashed = true;
					delete freshSites[ current ].legacyAuth;
					OSApp.currentSession.pass = pw;
					OSApp.Storage.set( { "sites":JSON.stringify( freshSites ) }, () => OSApp.Network.cloudSaveSites() );
				} );
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
		return $.Deferred().resolve().promise();
	}

	if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
		return OSApp.Sites.updateController( function() {}, OSApp.Network.networkFail );
	} else {
		return OSApp.Sites.updateController( function() {}, OSApp.Network.networkFail );
	}
};

/* global checkConfigured, $ */

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


OSApp.Sites.testSite = ( site, id, callback = () => void 0 ) => {
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
OSApp.Sites.updateSiteList = ( names, current ) => {
	var list = "",
		select = $( "#site-selector" );

	$.each( names, function() {
		list += "<option " + ( this.toString() === current ? "selected " : "" ) + "value='" + OSApp.Utils.htmlEscape( this ) + "'>" + this + "</option>"; // TODO: mellodev refactor make utils.js or formatters.js
	} );

	$( "#info-list" ).find( "li[data-role='list-divider']" ).text( current );

	select.html( list );
	if ( select.parent().parent().hasClass( "ui-select" ) ) {
		select.selectmenu( "refresh" );
	}
};

// Change the current site
OSApp.Sites.updateSite = ( newsite ) => {
	OSApp.Storage.get( "sites", function( data ) {
		var sites = OSApp.Sites.parseSites( data.sites );
		if ( newsite in sites ) {
			OSApp.UIDom.closePanel( function() {
				OSApp.Storage.set( { "current_site":newsite }, checkConfigured ); // TODO: mellodev refactor
			} );
		}
	} );
}

OSApp.Sites.findLocalSiteName = ( sites, callback = () => void 0) => {
	for ( var site in sites ) {
		if ( sites.hasOwnProperty( site ) ) {
			if ( OSApp.currentSession.ip.indexOf( sites[ site ].os_ip ) !== -1 ) {
				callback( site );
				return;
			}
		}
	}

	callback( false );
};

// Multi site functions
OSApp.Sites.checkConfigured = ( firstLoad ) => {
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

		newLoad(); // TODO: mellodev refactor this
	} );
};

OSApp.Sites.parseSites = ( sites ) => {
	return ( sites === undefined || sites === null ) ? {} : JSON.parse( sites );
};

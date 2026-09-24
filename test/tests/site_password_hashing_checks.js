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

describe( "Site Password Hashing", function() {
	var sandbox,
		originalSession;

	beforeEach( function() {
		sandbox = sinon.createSandbox();
		originalSession = {
			ip: OSApp.currentSession.ip,
			pass: OSApp.currentSession.pass,
			token: OSApp.currentSession.token,
			prefix: OSApp.currentSession.prefix,
			auth: OSApp.currentSession.auth
		};
	} );

	afterEach( function() {
		sandbox.restore();
		$( "#addnew" ).remove();
		$.extend( OSApp.currentSession, originalSession );
	} );

	it( "caches the same MD5 hash it just used to authenticate when adding a new site", function() {
		var enteredPassword = "correct horse battery staple",
			hashedPassword = md5( enteredPassword ),
			savedSites;

		sandbox.stub( $.fn, "popup" ).callsFake( function( options ) {
			if ( options && typeof options === "object" ) {
				this.appendTo( "body" );
			}
			return this;
		} );
		sandbox.stub( $.mobile, "loading" );
		sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
			callback( { sites: "{}" } );
		} );
		sandbox.stub( OSApp.Storage, "set" ).callsFake( function( data, callback ) {
			savedSites = JSON.parse( data.sites );
			if ( callback ) {
				callback();
			}
		} );
		sandbox.stub( OSApp.Network, "cloudSaveSites" );
		sandbox.stub( OSApp.Sites, "updateSiteList" );
		sandbox.stub( OSApp.Sites, "newLoad" );

		// Real firmware never includes a "wl" field in its /jo (options) response --
		// see server_json_options_main() in opensprinkler_server.cpp, which only ever
		// emits IOPTS plus dexp/mexp/hwt/ms. "wl" only exists as a /jl log-record type.
		// Reproduce that faithfully here instead of relying on the shared
		// prepare_tests.js mock, which incorrectly bakes "wl":100 into its /jo fixture
		// and so hides this bug from every other test in the suite.
		sandbox.stub( $, "ajax" ).callsFake( function( options ) {
			if ( options.url.indexOf( "/jo" ) !== -1 ) {
				assert.equal(
					options.url.split( "pw=" )[ 1 ],
					hashedPassword,
					"the connection test itself must send the MD5 hash, not the raw password"
				);
				options.success( { fwv: 221, hwv: 64, wimod: 0 } );
			}
			return { done: function() { return this; }, fail: function() { return this; } };
		} );

		OSApp.Sites.showAddNew();
		$( "#os_url" ).val( "192.168.1.50" );
		$( "#os_pw" ).val( enteredPassword );
		$( "#os_name" ).val( "Test Site" );

		OSApp.Sites.submitNewSite();

		// The firmware only ever stored the hash (that's what the /jo request above
		// verified). If the app now caches the raw password instead, every request
		// that follows -- including the next login -- will send the wrong value and
		// get rejected, even though "the password was accepted" moments earlier.
		assert.equal(
			savedSites[ "Test Site" ].os_pw,
			hashedPassword,
			"cached os_pw must be the MD5 hash the firmware actually stored, not the raw password"
		);
		assert.equal(
			OSApp.currentSession.pass,
			hashedPassword,
			"currentSession.pass must match the hash too, since it's reused for every subsequent request"
		);
	} );
} );

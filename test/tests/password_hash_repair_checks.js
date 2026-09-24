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

describe( "Password Hash Self-Repair", function() {
	var sandbox,
		originalSession;

	beforeEach( function() {
		sandbox = sinon.createSandbox();
		originalSession = {
			pass: OSApp.currentSession.pass,
			ip: OSApp.currentSession.ip,
			prefix: OSApp.currentSession.prefix,
			token: OSApp.currentSession.token
		};
	} );

	afterEach( function() {
		sandbox.restore();
		$.extend( OSApp.currentSession, originalSession );
	} );

	it( "upgrades a raw cached password to the hash the firmware actually has stored", function() {
		var defaultPassword = "opendoor",

			// This is exactly DEFAULT_PASSWORD from firmware/defines.h -- the
			// firmware never stores a raw password once it's on 2.1.3+, only
			// this hash (see docs/docs/2.2.1/221_5_api.md).
			storedHash = md5( defaultPassword ),
			savedSites;

		// Simulates the app having a stale/raw password cached locally --
		// e.g. from the "Add New Site" caching bug, an old client, or a
		// manual storage edit -- while the device itself has always only
		// ever stored the hash.
		OSApp.currentSession.pass = defaultPassword;
		OSApp.currentSession.ip = "192.168.1.50";
		OSApp.currentSession.prefix = "http://";
		OSApp.currentSession.token = undefined;

		sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
			callback( { sites: JSON.stringify( { "Test Site": {} } ) } );
		} );
		sandbox.stub( OSApp.Storage, "set" ).callsFake( function( data, callback ) {
			savedSites = JSON.parse( data.sites );
			if ( callback ) {
				callback();
			}
		} );
		sandbox.stub( OSApp.Network, "cloudSaveSites" );
		sandbox.stub( OSApp.Errors, "showError" );

		// Faithful stand-in for server_change_password()/process_password() in
		// opensprinkler_server.cpp: /sp only succeeds when "pw" matches what's
		// actually stored (the hash), never the raw password.
		sandbox.stub( $, "ajax" ).callsFake( function( options ) {
			var query = ( options.url.split( "?" )[ 1 ] || "" ),
				params = {};

			query.split( "&" ).forEach( function( pair ) {
				var parts = pair.split( "=" );
				params[ parts[ 0 ] ] = decodeURIComponent( parts[ 1 ] || "" );
			} );

			var deferred = $.Deferred();
			if ( options.url.indexOf( "/sp" ) !== -1 ) {
				deferred.resolve( params.pw === storedHash ? { result: 1 } : { result: 2 } );
			}
			return deferred.promise();
		} );

		OSApp.Sites.fixPasswordHash( "Test Site" );

		assert.equal(
			OSApp.currentSession.pass,
			storedHash,
			"the cache must end up holding the hash the firmware actually stores, not the stale raw password"
		);
		assert.isDefined( savedSites, "the corrected password must be persisted to storage" );
		assert.equal( savedSites[ "Test Site" ].os_pw, storedHash );
	} );
} );

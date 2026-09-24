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
		originalSession,

		// This is exactly DEFAULT_PASSWORD from firmware/defines.h -- the
		// firmware never stores a raw password once it's on 2.1.3+, only
		// this hash (see docs/docs/2.2.1/221_5_api.md).
		defaultPassword = "opendoor",
		storedHash = md5( defaultPassword );

	// Faithful stand-in for server_change_password()/process_password() in
	// opensprinkler_server.cpp: /sp only succeeds when "pw" matches whatever
	// is actually stored server-side, never a raw password.
	function stubFirmware( actuallyStoredValue ) {
		return sandbox.stub( $, "ajax" ).callsFake( function( options ) {
			var query = ( options.url.split( "?" )[ 1 ] || "" ),
				params = {};

			query.split( "&" ).forEach( function( pair ) {
				var parts = pair.split( "=" );
				params[ parts[ 0 ] ] = decodeURIComponent( parts[ 1 ] || "" );
			} );

			var deferred = $.Deferred();
			if ( options.url.indexOf( "/sp" ) !== -1 ) {
				deferred.resolve( params.pw === actuallyStoredValue ? { result: 1 } : { result: 2 } );
			}
			return deferred.promise();
		} );
	}

	beforeEach( function() {
		sandbox = sinon.createSandbox();
		originalSession = {
			pass: OSApp.currentSession.pass,
			ip: OSApp.currentSession.ip,
			prefix: OSApp.currentSession.prefix,
			token: OSApp.currentSession.token
		};
		OSApp.currentSession.ip = "192.168.1.50";
		OSApp.currentSession.prefix = "http://";
		OSApp.currentSession.token = undefined;

		sandbox.stub( OSApp.Network, "cloudSaveSites" );
		sandbox.stub( OSApp.Errors, "showError" );
	} );

	afterEach( function() {
		sandbox.restore();
		$.extend( OSApp.currentSession, originalSession );
	} );

	it( "upgrades a raw cached password to the hash the firmware actually has stored", function() {
		var savedSites;

		// Simulates the app having a stale/raw password cached locally --
		// e.g. from the "Add New Site" caching bug, an old client, or a
		// manual storage edit -- while the device itself has always only
		// ever stored the hash.
		OSApp.currentSession.pass = defaultPassword;

		sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
			callback( { sites: JSON.stringify( { "Test Site": {} } ) } );
		} );
		sandbox.stub( OSApp.Storage, "set" ).callsFake( function( data, callback ) {
			savedSites = JSON.parse( data.sites );
			if ( callback ) {
				callback();
			}
		} );
		stubFirmware( storedHash );

		OSApp.Sites.fixPasswordHash( "Test Site" );

		assert.equal(
			OSApp.currentSession.pass,
			storedHash,
			"the cache must end up holding the hash the firmware actually stores, not the stale raw password"
		);
		assert.isDefined( savedSites, "the corrected password must be persisted to storage" );
		assert.equal( savedSites[ "Test Site" ].os_pw, storedHash );
		assert.isTrue(
			OSApp.Network.cloudSaveSites.called,
			"the corrected password must also be pushed to cloud-synced sites"
		);
	} );

	it( "does nothing when the cached password already looks like a hash", function() {
		OSApp.currentSession.pass = storedHash;

		sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
			callback( { sites: JSON.stringify( { "Test Site": {} } ) } );
		} );
		var storageSet = sandbox.stub( OSApp.Storage, "set" );
		var ajax = stubFirmware( storedHash );

		OSApp.Sites.fixPasswordHash( "Test Site" );

		assert.isFalse( storageSet.called, "must not touch storage when nothing needs fixing" );
		assert.isFalse( ajax.called, "must not make any network request when nothing needs fixing" );
		assert.equal( OSApp.currentSession.pass, storedHash );
	} );

	it( "leaves the cache untouched when the raw value doesn't match anything the firmware has stored", function() {

		// A genuinely wrong/stale password -- not just "needs to be hashed",
		// but actually incorrect. This must fail safely: no corruption, no
		// false "fixed" state, and no crash.
		var wrongPassword = "totally-wrong-password",
			storageSet = sandbox.stub( OSApp.Storage, "set" );

		OSApp.currentSession.pass = wrongPassword;

		sandbox.stub( OSApp.Storage, "get" ).callsFake( function( key, callback ) {
			callback( { sites: JSON.stringify( { "Test Site": {} } ) } );
		} );

		// The firmware actually has some other password's hash stored --
		// nothing derived from wrongPassword will ever match it.
		stubFirmware( storedHash );

		assert.doesNotThrow( function() {
			OSApp.Sites.fixPasswordHash( "Test Site" );
		} );

		assert.equal(
			OSApp.currentSession.pass,
			wrongPassword,
			"an unrecognized password must be left exactly as-is, not cleared or half-updated"
		);
		assert.isFalse( storageSet.called, "nothing should be persisted when the repair attempt fails" );
	} );
} );

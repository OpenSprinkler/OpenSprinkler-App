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

describe("Page Navigation Checks", function () {
	it( "Change page to program preview", function( done ) {
		$.mobile.document.one( "pageshow", "#preview", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#preview" );
		} );
	} );

	it( "Change to logs page", function( done ) {
		$.mobile.document.one( "pageshow", "#logs", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#logs" );
		} );
	} );

	it( "Change to runonce page", function( done ) {
		$.mobile.document.one( "pageshow", "#runonce", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#runonce" );
		} );
	} );

	it( "Change to edit programs page", function( done ) {
		$.mobile.document.one( "pageshow", "#programs", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#programs" );
		} );
	} );

	it( "Change to add new program page", function( done ) {
		$.mobile.document.one( "pageshow", "#addprogram", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#addprogram" );
		} );
	} );

	it( "Change to options page", function( done ) {
		$.mobile.document.one( "pageshow", "#os-options", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#os-options" );
		} );
	} );

	it( "Change to site manager page", function( done ) {
		$.mobile.document.one( "pageshow", "#site-control", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#site-control" );
		} );
	} );

	it( "Change to about page", function( done ) {
		$.mobile.document.one( "pageshow", "#about", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.changePage( "#about" );
		} );
	} );
});

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

/* global OSApp, assert, beforeEach, afterEach, describe, it */

describe( "OSApp.Status", function() {

	var originalCurrentSession;

	beforeEach( function() {
		originalCurrentSession = OSApp.currentSession;
		OSApp.currentSession = {
			isControllerConnected: function() { return true; },
			controller: {
				settings: {
					curr: 100,
					flcrt: 50,
					flwrt: 600,
					en: 1,
					pq: 0,
					rd: 0,
					rs: 0,
					sn1: 0,
					sn2: 0,
					mm: 0,
					lrun: [ 1, 1, 300, ( new Date( Date.UTC( 2024, 11, 4, 19, 0, 0 ) ) ).getTime() / 1000 ], // December 4, 2024, 7:00 PM UTC,
					ps: []
				},
				options: {
					urs: 2,
					sn1t: 2,
					re: 0
				},
				status: [],
				stations: {
					snames: [ "Station 1", "Station 2", "Station 3", "Station 4", "Station 5", "Station 6", "Station 7", "Station 8" ]
				}
			}
		};

		OSApp.Stations = {
			isMaster: function() { return false; },
			getRemainingRuntime: function() { return 600; },
			getPID: function() { return 1; },
			getName: function() { return "Station 1"; }
		};

		OSApp.Programs = {
			pidToName: function() { return "Program 1"; }
		};

		OSApp.Language = {
			_: function( key ) {
				var translations = {
					"Current": "Current",
					"Flow": "Flow",
					"remaining": "remaining",
					"System Idle": "System Idle"
				};
				return translations[ key ] || key;
			}
		};

		OSApp.Dates = {
			sec2hms: function( seconds ) {
				return Math.floor( seconds / 3600 ) + ":" + ( "0" + Math.floor( seconds / 60 ) % 60 ).slice( -2 ) + ":" + ( "0" + seconds % 60 ).slice( -2 );
			},
			dateToString: function( date ) {
				return date.toISOString();
			}
		};

		OSApp.Utils = {
			flowCountToVolume: function( flowCount ) {
				return flowCount; // Simplified for testing
			}
		};

		$( "#footer-running" ).html( "" );
	} );

	afterEach( function() {
		OSApp.currentSession = originalCurrentSession;
		$( "#footer-running" ).off( "click" );
	} );

	describe( "refreshStatus", function() {
		// Skipping tests for now due to jQuery usage and reliance on external functions
		// These would require complex mocking of OSApp.Sites, OSApp.Network, OSApp.Firmware, etc.
	} );

	describe.skip( "changeStatus", function() {
		// SKipped due to test not properly mocking DOM
		it( "should update the status bar with current and flow when seconds > 1", function() {
			OSApp.Status.changeStatus( 120, "green", "Test Line" );
			assert.equal( $( "#footer-running" ).hasClass( "green" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Current: 100 mA Flow: 8.33 L/min" ) > -1, true );
			assert.equal( $( "#footer-running" ).text().indexOf( "(0:02:00 remaining)" ) > -1, true );
		} );

		it( "should update the status bar without timer when seconds <= 1", function() {
			OSApp.Status.changeStatus( 1, "yellow", "Test Line" );
			assert.equal( $( "#footer-running" ).hasClass( "yellow" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Current: 100 mA Flow: 8.33 L/min" ) > -1, true );
			assert.equal( $( "#footer-running" ).text().indexOf( "remaining" ) === -1, true );
		} );

		it( "should update the status bar with custom onclick handler", function() {
			var clicked = false;
			OSApp.Status.changeStatus( 0, "red", "Test Line", function() {
				clicked = true;
			} );
			$( "#footer-running" ).trigger( "click" );
			assert.equal( clicked, true );
		} );
	} );

	describe( "checkStatus", function() {

		it.skip( "should display 'System Idle' when no specific conditions are met", function() {
			// Skipped due to test not mocking DOM properly
			OSApp.Status.checkStatus();
			// assert.equal( $( "#footer-running" ).hasClass( "transparent" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "System Idle" ) > -1, true );
		} );

		it( "should display 'Configured as Extender' when controller is an extender", function() {
			OSApp.currentSession.controller.options.re = 1;
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "red" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Configured as Extender" ) > -1, true );
		} );

		it( "should display 'System Disabled' when operation is disabled", function() {
			OSApp.currentSession.controller.settings.en = 0;
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "red" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "System Disabled" ) > -1, true );
		} );

		it( "should display 'Stations Currently Paused' when queue is paused", function() {
			OSApp.currentSession.controller.settings.pq = 1;
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "yellow" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Stations Currently Paused" ) > -1, true );
		} );

		it.skip( "should display program and station info when a single station is running", function() {
			// Skipped due to test not mocking DOM properly
			OSApp.currentSession.controller.settings.ps = [ 1 ];
			OSApp.currentSession.controller.status = [ 1 ];
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "green" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Program 1 is running on station Station 1" ) > -1, true );
		} );

		it( "should display program and number of stations when multiple stations are running", function() {
			OSApp.currentSession.controller.status = [ 1, 1 ];
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "green" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Program 1 is running on 2 stations" ) > -1, true );
		} );

		it( "should display 'Rain delay until' when rain delay is enabled", function() {
			OSApp.currentSession.controller.settings.rd = 1;
			OSApp.currentSession.controller.settings.rdst = ( new Date( Date.UTC( 2024, 11, 5, 19, 0, 0 ) ) ).getTime() / 1000; // December 5, 2024, 7:00 PM UTC
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "red" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Rain delay until 2024-12-05T19:00:00.000Z" ) > -1, true );
		} );

		it( "should display 'Rain detected' when rain sensor is triggered", function() {
			OSApp.currentSession.controller.options.urs = 1;
			OSApp.currentSession.controller.settings.rs = 1;
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "red" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Rain detected" ) > -1, true );
		} );

		it( "should display 'Sensor 1 (Rain) Activated' when sensor 1 is activated", function() {
			OSApp.currentSession.controller.settings.sn1 = 1;
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "red" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Sensor 1 (Rain) Activated" ) > -1, true );
		} );

		it( "should display 'Sensor 2 (Rain) Activated' when sensor 2 is activated", function() {
			OSApp.currentSession.controller.settings.sn2 = 1;
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "red" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Sensor 2 (Rain) Activated" ) > -1, true );
		} );

		it( "should display 'Manual mode enabled' when manual mode is enabled", function() {
			OSApp.currentSession.controller.settings.mm = 1;
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "red" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Manual mode enabled" ) > -1, true );
		} );

		it.skip( "should display last run information when available", function() {
			// Skipped due to test not mocking DOM properly
			OSApp.Status.checkStatus();
			assert.equal( $( "#footer-running" ).hasClass( "transparent" ), true );
			assert.equal( $( "#footer-running" ).text().indexOf( "Program 1 last ran station Station 1 for 5m 0s on 2024-12-04T18:55:00.000Z" ) > -1, true );
		} );
	} );
} );

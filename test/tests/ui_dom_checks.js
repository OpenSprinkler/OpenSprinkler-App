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

describe("UI DOM Checks", function () {
	before( function() {
		OSApp.UIDom.bindPanel();
	} );

	it( "Only exposes a working firmware update link for direct hardware 3.x sessions", function() {
		var session = OSApp.currentSession,
			originalHwv = session.controller.options.hwv,
			originalIp = session.ip,
			originalPrefix = session.prefix,
			originalToken = session.token,
			updateItem = $( "#sprinklers-settings .update-fw" ),
			updateLink = updateItem.find( "a" );

		try {
			session.controller.options.hwv = 30;
			session.ip = "sprinkler.local";
			session.prefix = "https://";
			session.token = undefined;
			$( "html" ).trigger( "datarefresh" );

			assert.isFalse( updateItem.hasClass( "hidden" ) );
			assert.equal( updateLink.attr( "href" ), "https://sprinkler.local/update" );

			session.ip = "";
			session.token = "12345678901234567890123456789012";
			$( "html" ).trigger( "datarefresh" );

			assert.isTrue( updateItem.hasClass( "hidden" ) );
			assert.equal( updateLink.attr( "href" ), "#" );
		} finally {
			session.controller.options.hwv = originalHwv;
			session.ip = originalIp;
			session.prefix = originalPrefix;
			session.token = originalToken;
			$( "html" ).trigger( "datarefresh" );
		}
	} );

	it( "Only handles sensor keyboard shortcuts when the controller supports sensors", function() {
		var controller = OSApp.currentSession.controller,
			hadSensors = Object.prototype.hasOwnProperty.call( controller, "sensors" ),
			originalSensors = controller.sensors,
			changePage = sinon.stub( OSApp.UIDom, "changePage" );

		try {
			delete controller.sensors;
			OSApp.UIDom.handleKeydown( $.Event( "keydown", { keyCode: 83, altKey: true } ) );
			OSApp.UIDom.handleKeydown( $.Event( "keydown", { keyCode: 71, altKey: true } ) );
			assert.equal( changePage.callCount, 0 );

			controller.sensors = { sn: [] };
			OSApp.UIDom.handleKeydown( $.Event( "keydown", {
				keyCode: 83,
				altKey: true,
				target: $( "<select></select>" ).get( 0 )
			} ) );
			OSApp.UIDom.handleKeydown( $.Event( "keydown", {
				keyCode: 71,
				altKey: true,
				target: $( "<div contenteditable='true'></div>" ).get( 0 )
			} ) );
			assert.equal( changePage.callCount, 0 );

			OSApp.UIDom.handleKeydown( $.Event( "keydown", { keyCode: 83, altKey: true } ) );
			OSApp.UIDom.handleKeydown( $.Event( "keydown", { keyCode: 71, altKey: true } ) );
			assert.equal( changePage.callCount, 2 );
			assert.deepEqual( changePage.firstCall.args, [ "#sensors" ] );
			assert.deepEqual( changePage.secondCall.args, [ "#sensor-logs" ] );
		} finally {
			changePage.restore();
			if ( hadSensors ) {
				controller.sensors = originalSensors;
			} else {
				delete controller.sensors;
			}
		}
	} );

	it( "Prevents navigation to sensor pages when the controller does not support them", function() {
		var controller = OSApp.currentSession.controller,
			hadSensors = Object.prototype.hasOwnProperty.call( controller, "sensors" ),
			originalSensors = controller.sensors;

		try {
			delete controller.sensors;
			[ "#sensors", "#add-sensor", "#sensor-logs" ].forEach( function( hash ) {
				var event = $.Event( "pagebeforechange" );
				$.mobile.document.trigger( event, { toPage: hash, options: {} } );
				assert.isTrue( event.isDefaultPrevented(), hash + " should be blocked" );
			} );
		} finally {
			if ( hadSensors ) {
				controller.sensors = originalSensors;
			} else {
				delete controller.sensors;
			}
		}
	} );

	it( "Renders duration titles and help text without interpreting controller markup", function() {
		var maliciousName = "<img id='duration-title-injection'>Station";
		var openPopup = sinon.stub( OSApp.UIDom, "openPopup" ).callsFake( function( popup ) {
			popup.appendTo( "body" );
		} );

		try {
			OSApp.UIDom.showDurationBox( {
				title: maliciousName,
				helptext: "Run " + maliciousName,
				maximum: 60
			} );

			assert.lengthOf( $( "#durationBox #duration-title-injection" ), 0 );
			assert.equal( $( "#durationBox .duration-title" ).text(), maliciousName );
			assert.equal( $( "#durationBox .rain-desc" ).text(), "Run " + maliciousName );
		} finally {
			$( "#durationBox" ).remove();
			openPopup.restore();
		}
	} );
} );

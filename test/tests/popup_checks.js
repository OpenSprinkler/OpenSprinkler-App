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

describe("Popup Checks", function () {

	it( "Show main menu popup with legacy analog sensor links", function( done ) {
		var controller = OSApp.currentSession.controller,
			hadSensors = Object.prototype.hasOwnProperty.call( controller, "sensors" ),
			originalSensors = controller.sensors,
			originalFeature = controller.options.feature;

		delete controller.sensors;
		controller.options.feature = "ASB";

		$.mobile.document.one( "popupafteropen", "#mainMenu", function() {
			try {
				assert.lengthOf( $( "#mainMenu a[href='#analogsensorconfig']" ), 1 );
				assert.lengthOf( $( "#mainMenu a[href='#analogsensorchart']" ), 1 );
				assert.lengthOf( $( "#mainMenu a[href='#sensors']" ), 0 );
				assert.lengthOf( $( "#mainMenu a[href='#sensor-logs']" ), 0 );
			} finally {
				if ( hadSensors ) {
					controller.sensors = originalSensors;
				}
				if ( originalFeature === undefined ) {
					delete controller.options.feature;
				} else {
					controller.options.feature = originalFeature;
				}
			}
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.showHomeMenu();
		} );
	} );

	it( "Show change rain delay popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#durationBox", function() {
			$.mobile.document.one( "popupafterclose", "#durationBox", function() {
				done();
			} );
			$( "#durationBox" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			$( "#mainMenu" ).find( "a[href='#raindelay']" ).trigger( "click" );
		} );
	} );

	it("Show add new site popup", function (done) {
		$.mobile.document.one("popupafteropen", "#addnew", function () {
			$.mobile.document.one("popupafterclose", "#addnew", function () {
				done();
			});
			$("#addnew").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Sites.showAddNew();
		});
	});

	it("Show site select popup", function (done) {
		$.mobile.document.one("popupafteropen", "#site-select", function () {
			$.mobile.document.one("popupafterclose", "#site-select", function () {
				done();
			});
			$("#site-select").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Sites.showSiteSelect();
		});
	});

	it("Show are you sure popup", function (done) {
		$.mobile.document.one("popupafteropen", "#sure", function () {
			$("#sure .sure-do").trigger("click");
		});
		assert.doesNotThrow(function () {
			OSApp.UIDom.areYouSure(null, null, done);
		});
	});

	it("Show IP Address input popup", function (done) {
		$.mobile.document.one("popupafteropen", "#ipInput", function () {
			$.mobile.document.one("popupafterclose", "#ipInput", function () {
				done();
			});
			$("#ipInput").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.UIDom.showIPRequest();
		});
	});

	it("Show single duration input popup", function (done) {
		$.mobile.document.one("popupafteropen", "#singleDuration", function () {
			$.mobile.document.one("popupafterclose", "#singleDuration", function () {
				done();
			});
			$("#singleDuration").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.UIDom.showSingleDurationInput();
		});
	});

	it("Show language selection popup", function (done) {
		$.mobile.document.one("popupafteropen", "#localization", function () {
			$.mobile.document.one("popupafterclose", "#localization", function () {
				done();
			});
			$("#localization").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Language.languageSelect();
		});
	});
});

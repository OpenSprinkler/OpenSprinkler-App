/* global $ */

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
OSApp.About = OSApp.About || {};

OSApp.About.displayPage = function() {
	// About page

	var page = $(`
		<div data-role="page" id="about">
			<div class="ui-content" role="main">
				<ul data-role="listview" data-inset="true">
					<li>
						<p>
							${OSApp.Language._("User manual for OpenSprinkler is available at")}
							<a class="iab" target="_blank" href="https://openthings.freshdesk.com/support/solutions/folders/5000147083">
								https://support.openthings.io
							</a>
						</p>
					</li>
				</ul>
				<ul data-role="listview" data-inset="true">
					<li>
						<p>
							${OSApp.Language._("This is open source software: source code and changelog for this application can be found at")}
							<a class="iab squeeze" target="_blank" href="https://github.com/OpenSprinkler/OpenSprinkler-App/">
								https://github.com/OpenSprinkler/OpenSprinkler-App/
							</a>
						</p>
						<p>
							${OSApp.Language._("Language localization is crowdsourced using Transifex available at")}
							<a class="iab squeeze" target="_blank" href="https://www.transifex.com/albahra/opensprinkler/">
								https://www.transifex.com/albahra/opensprinkler/
							</a>
						</p>
						<p>
							${OSApp.Language._("Open source attributions")}:
							<a class="iab iabNoScale squeeze" target="_blank" href="https://github.com/OpenSprinkler/OpenSprinkler-App/wiki/List-of-Integrated-Libraries">
								https://github.com/OpenSprinkler/OpenSprinkler-App/wiki/List-of-Integrated-Libraries
							</a>
						</p>
					</li>
				</ul>
				<p class="smaller">
					${OSApp.Language._("App Version")}: ${OSApp.uiState.appVersion}
					<br>
					${OSApp.Language._("Firmware")}: <span class="firmware"></span>
					<br>
					<span class="hardwareLabel">${OSApp.Language._("Hardware Version")}:</span> <span class="hardware"></span>
				</p>
			</div>
		</div>
	`),
	showHardware;

	function begin() {
		showHardware = typeof OSApp.currentSession.controller.options.hwv !== "undefined" ? false : true;
		page.find( ".hardware" ).toggleClass( "hidden", showHardware ).text( OSApp.Firmware.getHWVersion() + OSApp.Firmware.getHWType() );
		page.find( ".hardwareLabel" ).toggleClass( "hidden", showHardware );

		page.find( ".firmware" ).text( OSApp.Firmware.getOSVersion() + OSApp.Firmware.getOSMinorVersion() + ( OSApp.Analog.checkAnalogSensorAvail() ? " - ASB" : "" ) );

		page.one( "pagehide", function() {
			page.detach();
		} );

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "About" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			}
		} );

		$( "#about" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
};

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
OSApp.Errors = OSApp.Errors || {};

// Show error message box
OSApp.Errors.showError = function( msg, dur ) {
	dur = dur || 2500;

	clearTimeout( OSApp.uiState.errorTimeout );

	$.mobile.loading( "show", {
		text: msg,
		textVisible: true,
		textonly: true,
		theme: "b"
	} );

	// Hide after provided delay
	OSApp.uiState.errorTimeout = setTimeout( function() {$.mobile.loading( "hide" );}, dur );
};


OSApp.Errors.showCorruptedJsonModal = function(badJson, currentSession) {
	// Create and display a modal prompting user to update firmware
	let cs = OSApp.Language._('Unknown');
	OSApp.Storage.get("current_site", function(x) {
		cs = x?.current_site || OSApp.Language._('Unknown');
	});
	console.log("*** showCorruptedJsonModal", {badJson, currentSession, currentSite: cs});

	const modal = document.createElement('div');
	modal.innerHTML = `
	  <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border: 1px solid #ccc; z-index: 1000;">
		<h2>${OSApp.Language._('Corrupted Response')}</h2>
		<p>${OSApp.Language._('The OpenSprinkler controller sent unexpected data, likely due to outdated firmware.')}</p>
		<p><b>${OSApp.Language._('Site Name')}</b>: ${cs}</p>
		<p>${OSApp.Language._('To fix this, please update your firmware. Remember to use the "API Tool" to save your current settings beforehand!')}</p>
		<p style="text-align: right">
			<button id="recoveryButton">${OSApp.Language._('API Tool')}</button>
			<button id="instructionsButton">${OSApp.Language._('Help')}</button>
		</p>
	  </div>
	`;
	document.body.appendChild(modal);

	const recoveryButton = document.getElementById('recoveryButton');
	recoveryButton.addEventListener('click', () => {
		window.open('https://raysfiles.com/os/TestOSAPI220.html', "_blank");
	});

	const instructionsButton = document.getElementById('instructionsButton');
	instructionsButton.addEventListener('click', () => {
		window.open('https://openthings.freshdesk.com/support/solutions/articles/5000381694-opensprinkler-firmware-update-guide-summary-', "_blank");
	});
};

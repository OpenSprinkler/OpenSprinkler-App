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

OSApp.Errors.showErrorModal = function(message, source, lineno, colno, error) {
	// Create and display a modal with error information
	const modal = document.createElement('div');
	modal.innerHTML = `
	  <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border: 1px solid #ccc; z-index: 1000;">
		<h2>${OSApp.Language._('An error occurred')}:</h2>
		<p>${OSApp.Language._('Message')}: ${message}</p>
		<p>${OSApp.Language._('File')}: ${source}:${lineno}:${colno}</p>
		<p style="text-align: right">
			<button id="ignoreButton">${OSApp.Language._('Ignore')}</button>
			<button id="createIssueButton">${OSApp.Language._('Report Error')}</button>
		</p>
	  </div>
	`;
	document.body.appendChild(modal);

	const createIssueButton = document.getElementById('createIssueButton');
	createIssueButton.addEventListener('click', () => {
		OSApp.Errors.createGitHubIssue(message, source, lineno, colno, error);
		document.body.removeChild(modal)
	});

	const ignoreButton = document.getElementById('ignoreButton');
	ignoreButton.addEventListener('click', () => {
		document.body.removeChild(modal)
	});
};

OSApp.Errors.createGitHubIssue = function(message, source, lineno, colno, error) {
	const title = `JavaScript Error: ${message.substring(0, 50)}`; // Shorten the title
	const body = `
	## Error Details

	**Message:** ${message}
	**File:** ${source}:${lineno}:${colno}
	**Stack Trace:**\n\`\`\`\n${error ? error.stack : 'No stack trace available'}\n\`\`\`

	## User Information

	**User Agent:** ${navigator.userAgent}
	**Platform:** ${navigator.platform}
	**Language:** ${navigator.language}
	**App Version:** TODO!
	**Firmware Version:** ${OSApp.Firmware.getOSVersion()}

	## Steps to reproduce (if known):

	*(Please describe how to reproduce the error)*
	`;

	const encodedTitle = encodeURIComponent(title);
	const encodedBody = encodeURIComponent(body);

	const issueUrl = `https://github.com/OpenSprinkler/OpenSprinkler-App/issues/new?title=${encodedTitle}&body=${encodedBody}`;

	window.open(issueUrl, '_blank'); // Open in a new tab
};

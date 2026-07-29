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
	var toast = $( "#os-error-toast" );
	if ( !toast.length ) {
		toast = $( "<div id='os-error-toast' class='os-error-toast' role='alert' aria-live='assertive'></div>" )
			.appendTo( document.body );
	}
	toast.text( String( msg ) ).addClass( "visible" );

	// Hide after provided delay
	OSApp.uiState.errorTimeout = setTimeout( function() {
		toast.removeClass( "visible" ).empty();
	}, dur );
};


OSApp.Errors.showCorruptedJsonModal = function() {
	var previous = OSApp.Errors.corruptedJsonModal;
	if ( previous && previous.parentNode ) previous.parentNode.removeChild( previous );

	var unknownSite = OSApp.Language._( "Unknown" ),
		modal = document.createElement( "div" ),
		panel = document.createElement( "div" ),
		title = document.createElement( "h2" ),
		description = document.createElement( "p" ),
		siteLine = document.createElement( "p" ),
		siteLabel = document.createElement( "b" ),
		siteName = document.createElement( "span" ),
		advice = document.createElement( "p" ),
		actions = document.createElement( "p" ),
		recoveryButton = document.createElement( "button" ),
		instructionsButton = document.createElement( "button" ),
		dismissButton = document.createElement( "button" ),
		cleanup = function() {
			if ( OSApp.Errors.corruptedJsonModal === modal ) OSApp.Errors.corruptedJsonModal = null;
			if ( modal.parentNode ) modal.parentNode.removeChild( modal );
		},
		openExternal = function( url ) {
			var opened = window.open( url, "_blank", "noopener" );
			if ( opened ) opened.opener = null;
		};

	modal.className = "corrupted-json-modal";
	modal.setAttribute( "role", "dialog" );
	modal.setAttribute( "aria-modal", "true" );
	panel.className = "corrupted-json-panel";
	title.textContent = OSApp.Language._( "Corrupted Response" );
	description.textContent = OSApp.Language._( "The OpenSprinkler controller sent unexpected data, likely due to outdated firmware." );
	siteLabel.textContent = OSApp.Language._( "Site Name" ) + ": ";
	siteName.className = "corrupted-site-name";
	siteName.textContent = unknownSite;
	siteLine.appendChild( siteLabel );
	siteLine.appendChild( siteName );
	advice.textContent = OSApp.Language._( "To fix this, please update your firmware. Remember to use the \"API Tool\" to save your current settings beforehand!" );
	actions.className = "corrupted-json-actions";
	recoveryButton.type = instructionsButton.type = dismissButton.type = "button";
	recoveryButton.textContent = OSApp.Language._( "API Tool" );
	instructionsButton.textContent = OSApp.Language._( "Help" );
	dismissButton.textContent = OSApp.Language._( "Dismiss" );
	actions.appendChild( recoveryButton );
	actions.appendChild( instructionsButton );
	actions.appendChild( dismissButton );
	panel.appendChild( title );
	panel.appendChild( description );
	panel.appendChild( siteLine );
	panel.appendChild( advice );
	panel.appendChild( actions );
	modal.appendChild( panel );
	document.body.appendChild( modal );
	OSApp.Errors.corruptedJsonModal = modal;

	OSApp.Storage.get( "current_site", function( data ) {
		if ( OSApp.Errors.corruptedJsonModal !== modal || !modal.parentNode ) return;
		siteName.textContent = data && data.current_site || unknownSite;
	} );
	recoveryButton.addEventListener( "click", function() {
		openExternal( "https://raysfiles.com/os/TestOSAPI220.html" );
	} );
	instructionsButton.addEventListener( "click", function() {
		openExternal( "https://openthings.freshdesk.com/support/solutions/articles/5000381694-opensprinkler-firmware-update-guide-summary-" );
	} );
	dismissButton.addEventListener( "click", cleanup );
	modal.addEventListener( "click", function( event ) {
		if ( event.target === modal ) cleanup();
	} );
};

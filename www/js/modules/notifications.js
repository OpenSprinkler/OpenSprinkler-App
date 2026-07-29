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
OSApp.Notifications = OSApp.Notifications || {};

OSApp.Notifications.addNotification = function( item ) {
	OSApp.uiState.notifications.push( item );
	OSApp.Notifications.updateNotificationBadge();

	var panel = $( "#notificationPanel" );

	if ( panel.hasClass( "ui-panel-open" ) ) {
		panel.find( "ul" ).append( OSApp.Notifications.createNotificationItem( item ) ).listview( "refresh" );
	}
};

OSApp.Notifications.updateNotificationBadge = function() {
	var total = OSApp.uiState.notifications.length,
		header = $( "#header" );

	if ( total === 0 ) {
		header.find( ".notifications" ).hide();
	} else {
		header.find( ".notifications" ).show();
		header.find( ".notificationCount" ).text( total );
	}
};

OSApp.Notifications.createNotificationItem = function( item ) {
	var listItem = $( "<li><a class='primary' href='#'><h2></h2>" + ( item.desc ? "<p></p>" : "" ) +
		"</a><a class='ui-btn ui-btn-icon-notext ui-icon-delete'></a></li>" ).data( "notification", item );

	listItem.find( "h2" ).text( item.title );
	listItem.find( "p" ).text( item.desc );

	listItem.find( ".primary" ).on( "click", item.on );
	listItem.find( ".ui-icon-delete" ).on( "click", function() {
		OSApp.Notifications.removeNotification( $( this ).parent() );
	} );

	return listItem;
};

OSApp.Notifications.showNotifications = function() {
	if ( OSApp.uiState.notifications.length === 0 ) {
		return;
	}

	var panel = $( "#notificationPanel" ),
		menu = $( "#footer-menu" ),
		items = [ $( "<li data-role='list-divider'>" + OSApp.Language._( "Notifications" ) +
			"<button class='ui-btn ui-btn-icon-notext ui-icon-delete btn-no-border clear-all delete'></button></li>" )
		.on( "click", ".clear-all", function() {
			var button = $( this );

			if ( button.hasClass( "clear" ) ) {
				OSApp.Notifications.clearNotifications();
			} else {
				button.removeClass( "delete ui-btn-icon-notext ui-icon-delete" ).addClass( "clear" ).text( OSApp.Language._( "Clear" ) );
				setTimeout( function() {
				$.mobile.document.one( "click", function() {
						button.removeClass( "clear" ).addClass( "delete ui-btn-icon-notext ui-icon-delete" ).text( "" );
					} );
				}, 1 );
			}
		} ) ];

	for ( var i = OSApp.uiState.notifications.length - 1; i >= 0; i-- ) {
		items.push( OSApp.Notifications.createNotificationItem( OSApp.uiState.notifications[ i ] ) );
	}

	panel.find( "ul" ).replaceWith( $( "<ul/>" ).append( items ).listview() );
	panel.on( "panelbeforeclose", function() {
		menu.removeClass( "moveLeft" );
	} );
	panel.panel().panel( "option", "classes.modal", "needsclick ui-panel-dismiss" );
	menu.addClass( "moveLeft" );
	panel.panel( "open" );
};

OSApp.Notifications.clearNotifications = function() {
	var panel = $( "#notificationPanel" );

	OSApp.uiState.notifications = [];
	OSApp.Notifications.updateNotificationBadge();

	panel.find( "ul" ).empty();
	if ( panel.hasClass( "ui-panel-open" ) ) {
		panel.panel( "close" );
	}
};

OSApp.Notifications.removeNotification = function( button ) {
	var panel = $( "#notificationPanel" ),
		item = button.data( "notification" ),
		index = OSApp.uiState.notifications.indexOf( item ),
		off = item && item.off;

	if ( index === -1 ) {
		return;
	}

	if ( typeof off === "function" ) {
		if ( !off() ) {
			return;
		}
	}

	OSApp.uiState.notifications.splice( index, 1 );
	button.remove();
	OSApp.Notifications.updateNotificationBadge();
	if ( OSApp.uiState.notifications.length === 0 && panel.hasClass( "ui-panel-open" ) ) {
		panel.panel( "close" );
	}
};

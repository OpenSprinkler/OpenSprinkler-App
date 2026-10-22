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

OSApp.Cards = OSApp.Cards || {};

OSApp.Cards.getSID = function( cardObj ) {
	return cardObj.data( "station" );
};

OSApp.Cards.getDivider = function( cardObj ) {
	return cardObj.find( ".content-divider" );
};

OSApp.Cards.getGroupLabel = function( cardObj ) {
	if ( !OSApp.Supported.groups() ) {
		return undefined;
	}
	return cardObj.find( ".station-gid" );
};

OSApp.Cards.getGroupDescription = function( sid, value ) {
	var description = OSApp.Language._( "Sequential Group" ) + ": " + value,
		policy = OSApp.CycleSoak.supported() ? OSApp.CycleSoak.readablePolicy( sid ) : null;
	if ( policy && policy[ 0 ] ) {
		description += "\n" + OSApp.Language._( "Cycle and Soak" ) +
			"\n" + OSApp.Language._( "Maximum cycle (minutes)" ) + ": " + policy[ 1 ] / 60 +
			"\n" + OSApp.Language._( "Minimum soak (minutes)" ) + ": " + policy[ 2 ] / 60;
	}
	return description;
};

OSApp.Cards.setGroupLabel = function( cardObj, value ) {
	if ( !OSApp.Supported.groups() ) { return; }
	var groupLabel = OSApp.Cards.getGroupLabel( cardObj ),
		description = OSApp.Cards.getGroupDescription( OSApp.Cards.getSID( cardObj ), value );

	groupLabel.removeClass( "hidden" );
	groupLabel.text( value );
	if ( !OSApp.Cards.isMasterStation( cardObj ) ) {
		groupLabel.closest( ".station-settings" ).attr( {
			title: description,
			"aria-label": description
		} );
	}
};

OSApp.Cards.getGIDValue = function( cardObj ) {
	if ( !OSApp.Supported.groups() ) { return 0; }
	var cardButtons = $( cardObj.children()[ 0 ] ).children().filter( "span" ),
		cardAttributes = $( cardButtons[ cardButtons.length - 1 ] );
	return parseInt( cardAttributes.attr( "data-gid" ) );
};

OSApp.Cards.getGIDName = function( cardObj ) {

	//Return OSApp.Groups.mapGIDValueToName( OSApp.Cards.getGIDValue( cardObj ) );
	return OSApp.Groups.mapGIDValueToName( OSApp.Stations.getGIDValue( OSApp.Cards.getSID( cardObj ) ) );
};

OSApp.Cards.isMasterStation = function( cardObj ) {
	return OSApp.Stations.isMaster( OSApp.Cards.getSID( cardObj ) );
};

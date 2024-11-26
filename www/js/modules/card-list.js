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
OSApp.CardList = OSApp.CardList || {};

/* Card helpers: must pass in jquery object $(obj) */
OSApp.CardList.getAllCards = function( cardList ) {
	return cardList.filter( ".card" );
};

OSApp.CardList.getCardBySID = function( cardList, sid ) {
	return cardList.filter( "[data-station='" + sid + "']" );
};

// Based on order of cardList content
OSApp.CardList.getCardByIndex = function( cardList, idx ) {
	return $( cardList[ idx ] );
};

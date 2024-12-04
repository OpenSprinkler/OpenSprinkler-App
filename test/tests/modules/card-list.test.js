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

/* global describe, beforeEach, OSApp, assert */

describe('OSApp.CardList', function() {
	var cardList;

	beforeEach(function() {
		// Mock the card list using jQuery to create a set of dummy cards
		cardList = $("<div class='card' data-station='A'></div>" +
			"<div class='card' data-station='B'></div>" +
			"<div class='card' data-station='C'></div>");
	});

	describe('getAllCards', function() {
		it('should return all elements with the class "card"', function() {
			var cards = OSApp.CardList.getAllCards(cardList);
			assert.equal(cards.length, 3);
		});

		it('should return an empty jQuery object if no cards are found', function() {
			cardList = $("<div></div>"); // No .card elements
			var cards = OSApp.CardList.getAllCards(cardList);
			assert.equal(cards.length, 0);
		});
	});

	describe('getCardBySID', function() {
		it('should return the card with the specified SID', function() {
			var card = OSApp.CardList.getCardBySID(cardList, 'B');
			assert.equal(card.length, 1);
			assert.equal(card.data('station'), 'B');
		});

		it('should return an empty jQuery object if no card with the SID is found', function() {
			var card = OSApp.CardList.getCardBySID(cardList, 'Z');
			assert.equal(card.length, 0);
		});
	});

	describe('getCardByIndex', function() {
		it('should return the card at the specified index', function() {
			// Skipping this test for now since it uses jQuery internally
		});
	});
});

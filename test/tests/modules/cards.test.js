

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

describe('OSApp.Cards', function() {
	var cardObj;

	beforeEach(function() {
		cardObj = $("<div class='card' data-station='A'>" +
			"<div><span></span><span data-gid='1'></span></div>" +
			"<div class='content-divider'></div>" +
			"<div class='station-gid'></div>" +
			"</div>");

		// Store original values
		originalSupported = OSApp.Supported;
		originalStations = OSApp.Stations;

		// Mock dependencies
		OSApp.Supported = { groups: function() { return true; } };
		OSApp.Groups = { mapGIDValueToName: function(gid) {
				return 'Group ' + gid;
			}
		};
		OSApp.Stations = {
			getGIDValue: function(sid) {
				return 1;
			},
			isMaster: function(sid) {
				return sid === 'A';
			}
		};
	});

	afterEach(function() {
		// Restore original values
		OSApp.Supported = originalSupported;
		OSApp.Stations = originalStations;
	});

	describe('getSID', function() {
		it('should return the station ID', function() {
			var sid = OSApp.Cards.getSID(cardObj);
			assert.equal(sid, 'A');
		});
	});

	describe('getDivider', function() {
		it('should return the divider element', function() {
			var divider = OSApp.Cards.getDivider(cardObj);
			assert.equal(divider.hasClass('content-divider'), true);
		});
	});

	describe('getGroupLabel', function() {
		it('should return the group label (groups supported)', function() {
			var groupLabel = OSApp.Cards.getGroupLabel(cardObj);
			assert.equal(groupLabel.hasClass('station-gid'), true);
		});

		it('should return undefined (groups not supported)', function() {
			OSApp.Supported.groups = function() { return false; };
			var groupLabel = OSApp.Cards.getGroupLabel(cardObj);
			assert.equal(groupLabel, undefined);
		});
	});

	describe('setGroupLabel', function() {
		it('should set group label text (groups supported)', function() {
			OSApp.Cards.setGroupLabel(cardObj, 'Group 1');
			var groupLabel = OSApp.Cards.getGroupLabel(cardObj);
			assert.equal(groupLabel.text(), 'Group 1');
			assert.equal(groupLabel.hasClass('hidden'), false);
		});

		it('should do nothing (groups not supported)', function() {
			OSApp.Supported.groups = function() { return false; };
			var groupLabelBefore = OSApp.Cards.getGroupLabel(cardObj);
			OSApp.Cards.setGroupLabel(cardObj, 'Group 1');
			var groupLabelAfter = OSApp.Cards.getGroupLabel(cardObj);
			assert.equal(groupLabelBefore, groupLabelAfter);
		});
	});

	describe('getGIDValue', function() {
		it('should return the GID value', function() {
			var gid = OSApp.Cards.getGIDValue(cardObj);
			assert.equal(gid, 1);
		});

		it('should return 0 (groups not supported)', function() {
			OSApp.Supported.groups = function() { return false; };
			var gid = OSApp.Cards.getGIDValue(cardObj);
			assert.equal(gid, 0);
		});
	});

	describe('getGIDName', function() {
		it('should return the GID name', function() {
			var gidName = OSApp.Cards.getGIDName(cardObj);
			assert.equal(gidName, 'Group 1');
		});
	});

	describe('isMasterStation', function() {
		it('should return true for master station', function() {
			var isMaster = OSApp.Cards.isMasterStation(cardObj);
			assert.equal(isMaster, true);
		});

		it('should return false for non-master station', function() {
			cardObj.data('station', 'B');
			var isMaster = OSApp.Cards.isMasterStation(cardObj);
			assert.equal(isMaster, false);
		});
	});
});

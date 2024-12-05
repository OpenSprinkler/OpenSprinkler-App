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

/* global OSApp, assert, describe, it, beforeEach, afterEach */

describe('OSApp.Network', function () {
	describe('updateDeviceIP', function () {
		var originalGetWiFiIPAddress, originalFindRouter, networkinterface = {};

		beforeEach(function () {
			// Mock networkinterface.getWiFiIPAddress
			originalGetWiFiIPAddress = networkinterface.getWiFiIPAddress;
			networkinterface.getWiFiIPAddress = function (callback) {
				callback({ ip: '192.168.1.100' });
			};

			// Mock OSApp.Network.findRouter
			originalFindRouter = OSApp.Network.findRouter;
			OSApp.Network.findRouter = function (callback) {
				callback(true, '10.0.0.1');
			};
		});

		afterEach(function () {
			networkinterface.getWiFiIPAddress = originalGetWiFiIPAddress;
			OSApp.Network.findRouter = originalFindRouter;
		});

		it('should update OSApp.currentDevice.deviceIp using networkinterface.getWiFiIPAddress', function () {
			OSApp.currentDevice.deviceIp = '';
			OSApp.Network.updateDeviceIP();
			assert.equal(OSApp.currentDevice.deviceIp, '10.0.0.1');
		});

		it('should call finishCheck with the IP address if it is a function', function () {
			var finishCheckCalled = false;
			var ipAddressPassedToFinishCheck = null;

			OSApp.currentDevice = { deviceIp: '' };
			OSApp.Network.updateDeviceIP(function (ipAddress) {
				finishCheckCalled = true;
				ipAddressPassedToFinishCheck = ipAddress;
			});

			assert.isTrue(finishCheckCalled);
			assert.equal(ipAddressPassedToFinishCheck, '10.0.0.1');
		});

		it('should use OSApp.Network.findRouter if networkinterface.getWiFiIPAddress throws an error', function () {
			OSApp.currentDevice = { deviceIp: '' };
			networkinterface.getWiFiIPAddress = function () {
				throw new Error('getWiFiIPAddress failed');
			};

			OSApp.Network.updateDeviceIP();
			assert.equal(OSApp.currentDevice.deviceIp, '10.0.0.1');
		});
	});

	describe('isLocalIP', function () {
		it('should return true for local IPs', function () {
			assert.isTrue(OSApp.Network.isLocalIP('192.168.1.100'));
			assert.isTrue(OSApp.Network.isLocalIP('10.0.0.1'));
			assert.isTrue(OSApp.Network.isLocalIP('172.18.0.1'));
			assert.isTrue(OSApp.Network.isLocalIP('127.0.0.1'));
		});

		it('should return false for non-local IPs', function () {
			assert.isFalse(OSApp.Network.isLocalIP('8.8.8.8'));
			assert.isFalse(OSApp.Network.isLocalIP('172.16.0.1'));
		});
	});

	// FIXME: Skipping startScan, findRouter, ping, checkPublicAccess, addSyncStatus,
	// requestCloudAuth, cloudLogin, cloudSaveSites, cloudGetSites, cloudSyncStart,
	// cloudSync, getTokenUser, handleExpiredLogin, handleInvalidDataToken, intToIP,
	// changePassword, checkPW, networkFail, and logout because they use jQuery or are too complex

	describe('getWiFiRating', function () {
		it('should return the correct WiFi rating for different RSSI values', function () {
			var original_ = OSApp.Language._;
			OSApp.Language._ = function (key) {
				switch (key) {
					case 'Unusable':
						return 'Unusable';
					case 'Poor':
						return 'Poor';
					case 'Fair':
						return 'Fair';
					case 'Good':
						return 'Good';
					case 'Excellent':
						return 'Excellent';
					default:
						return key;
				}
			};

			assert.equal(OSApp.Network.getWiFiRating(-85), '-85dBm (Unusable)');
			assert.equal(OSApp.Network.getWiFiRating(-75), '-75dBm (Poor)');
			assert.equal(OSApp.Network.getWiFiRating(-65), '-65dBm (Fair)');
			assert.equal(OSApp.Network.getWiFiRating(-55), '-55dBm (Good)');
			assert.equal(OSApp.Network.getWiFiRating(-45), '-45dBm (Excellent)');

			OSApp.Language._ = original_;
		});
	});
});

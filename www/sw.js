/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <https://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Define a name for the current cache
var cacheName = "OpenSprinkler-v0.0.0";

// Html
var cacheFiles = [
	  "/index.html",
		"/map.html",
		"/manifest.json",
		"/modules.json",
	];

// App main javascript
cacheFiles = cacheFiles.concat([
	"/js/home.js",
	"/js/jqm-config.js",
	"/js/main.js",
	"/js/map.js",
]);

// FIXME: this module list needs to be dynamic so newly added modules are automatically inserted!
// App modules javascript
cacheFiles = cacheFiles.concat([
	"/js/modules/about.js",
	"/js/modules/analog.js",
	"/js/modules/card-list.js",
	"/js/modules/cards.js",
	"/js/modules/dashboard.js",
	"/js/modules/dates.js",
	"/js/modules/errors.js",
	"/js/modules/firmware.js",
	"/js/modules/groups.js",
	"/js/modules/import-export.js",
	"/js/modules/language.js",
	"/js/modules/logs.js",
	"/js/modules/network.js",
	"/js/modules/notifications.js",
	"/js/modules/options.js",
	"/js/modules/preview.js",
	"/js/modules/programs.js",
	"/js/modules/sites.js",
	"/js/modules/station-attributes.js",
	"/js/modules/station-queue.js",
	"/js/modules/stations.js",
	"/js/modules/status.js",
	"/js/modules/storage.js",
	"/js/modules/supported.js",
	"/js/modules/system-diagnostics.js",
	"/js/modules/ui-dom.js",
	"/js/modules/utils.js",
	"/js/modules/weather.js",
	"/js/modules/welcome.js",
]);

// Vendor Javascript
cacheFiles = cacheFiles.concat([
	"/vendor-js/apexcharts.min.js",
	"/vendor-js/jquery.js",
	"/vendor-js/jquery-migrate.min.js",
	"/vendor-js/jqm.js",
	"/vendor-js/dataTables-2.1.8.min.js",
	"/vendor-js/vis-timeline-graph2d.min.js",
	"/vendor-js/libs.js",
]);

// CSS and images
cacheFiles = cacheFiles.concat([
  "/css/jqm.css",
  "/css/main.css",
	"/css/analog.css",
	"/css/dataTables-2.1.8.dataTables.min.css",
	"/css/vis-timeline-graph2d.min.css",
  "/css/images/ajax-loader.gif",
  "/css/images/icons-png/star-black.png",
  "/css/images/icons-png/action-black.png",
  "/css/images/icons-png/action-white.png",
  "/css/images/icons-png/alert-black.png",
  "/css/images/icons-png/alert-white.png",
  "/css/images/icons-png/arrow-d-black.png",
  "/css/images/icons-png/arrow-d-l-black.png",
  "/css/images/icons-png/arrow-d-l-white.png",
  "/css/images/icons-png/arrow-d-r-black.png",
  "/css/images/icons-png/arrow-d-r-white.png",
  "/css/images/icons-png/arrow-d-white.png",
  "/css/images/icons-png/arrow-l-black.png",
  "/css/images/icons-png/arrow-l-white.png",
  "/css/images/icons-png/arrow-r-black.png",
  "/css/images/icons-png/arrow-r-white.png",
  "/css/images/icons-png/arrow-u-black.png",
  "/css/images/icons-png/arrow-u-l-black.png",
  "/css/images/icons-png/arrow-u-l-white.png",
  "/css/images/icons-png/arrow-u-r-black.png",
  "/css/images/icons-png/arrow-u-r-white.png",
  "/css/images/icons-png/arrow-u-white.png",
  "/css/images/icons-png/audio-black.png",
  "/css/images/icons-png/audio-white.png",
  "/css/images/icons-png/back-black.png",
  "/css/images/icons-png/back-white.png",
  "/css/images/icons-png/bars-black.png",
  "/css/images/icons-png/bars-white.png",
  "/css/images/icons-png/bullets-black.png",
  "/css/images/icons-png/bullets-white.png",
  "/css/images/icons-png/calendar-black.png",
  "/css/images/icons-png/calendar-white.png",
  "/css/images/icons-png/camera-black.png",
  "/css/images/icons-png/camera-white.png",
  "/css/images/icons-png/carat-d-black.png",
  "/css/images/icons-png/carat-d-white.png",
  "/css/images/icons-png/carat-l-black.png",
  "/css/images/icons-png/carat-l-white.png",
  "/css/images/icons-png/carat-r-black.png",
  "/css/images/icons-png/carat-r-white.png",
  "/css/images/icons-png/carat-u-black.png",
  "/css/images/icons-png/carat-u-white.png",
  "/css/images/icons-png/check-black.png",
  "/css/images/icons-png/check-white.png",
  "/css/images/icons-png/clock-black.png",
  "/css/images/icons-png/clock-white.png",
  "/css/images/icons-png/cloud-black.png",
  "/css/images/icons-png/cloud-white.png",
  "/css/images/icons-png/comment-black.png",
  "/css/images/icons-png/comment-white.png",
  "/css/images/icons-png/delete-black.png",
  "/css/images/icons-png/delete-white.png",
  "/css/images/icons-png/edit-black.png",
  "/css/images/icons-png/edit-white.png",
  "/css/images/icons-png/eye-black.png",
  "/css/images/icons-png/eye-white.png",
  "/css/images/icons-png/forbidden-black.png",
  "/css/images/icons-png/forbidden-white.png",
  "/css/images/icons-png/forward-black.png",
  "/css/images/icons-png/forward-white.png",
  "/css/images/icons-png/gear-black.png",
  "/css/images/icons-png/gear-white.png",
  "/css/images/icons-png/grid-black.png",
  "/css/images/icons-png/grid-white.png",
  "/css/images/icons-png/heart-black.png",
  "/css/images/icons-png/heart-white.png",
  "/css/images/icons-png/home-black.png",
  "/css/images/icons-png/home-white.png",
  "/css/images/icons-png/info-black.png",
  "/css/images/icons-png/info-white.png",
  "/css/images/icons-png/location-black.png",
  "/css/images/icons-png/location-white.png",
  "/css/images/icons-png/lock-black.png",
  "/css/images/icons-png/lock-white.png",
  "/css/images/icons-png/mail-black.png",
  "/css/images/icons-png/mail-white.png",
  "/css/images/icons-png/minus-black.png",
  "/css/images/icons-png/minus-white.png",
  "/css/images/icons-png/navigation-black.png",
  "/css/images/icons-png/navigation-white.png",
  "/css/images/icons-png/phone-black.png",
  "/css/images/icons-png/phone-white.png",
  "/css/images/icons-png/plus-black.png",
  "/css/images/icons-png/plus-white.png",
  "/css/images/icons-png/power-black.png",
  "/css/images/icons-png/power-white.png",
  "/css/images/icons-png/recycle-black.png",
  "/css/images/icons-png/recycle-white.png",
  "/css/images/icons-png/refresh-black.png",
  "/css/images/icons-png/refresh-white.png",
  "/css/images/icons-png/search-black.png",
  "/css/images/icons-png/search-white.png",
  "/css/images/icons-png/shop-black.png",
  "/css/images/icons-png/shop-white.png",
  "/css/images/icons-png/star-white.png",
  "/css/images/icons-png/tag-black.png",
  "/css/images/icons-png/tag-white.png",
  "/css/images/icons-png/user-black.png",
  "/css/images/icons-png/user-white.png",
  "/css/images/icons-png/video-black.png",
  "/css/images/icons-png/video-white.png",
  "/img/icon-1024.png",
  "/img/icon-512.png",
  "/img/bell.png",
  "/img/favicon.ico",
  "/img/logo.png",
  "/img/norain.png",
  "/img/placeholder.png",
  "/img/relay.png",
  "/img/running.png",
  "/img/serial.png",
]);

// Localization files
cacheFiles = cacheFiles.concat([
	"/locale/es.js",
	"/locale/af.js",
	"/locale/am.js",
	"/locale/bg.js",
	"/locale/cs.js",
	"/locale/de.js",
	"/locale/el.js",
	"/locale/et.js",
	"/locale/fa.js",
	"/locale/fr.js",
	"/locale/he.js",
	"/locale/hr.js",
	"/locale/hu.js",
	"/locale/is.js",
	"/locale/it.js",
	"/locale/lv.js",
	"/locale/mn.js",
	"/locale/nl.js",
	"/locale/no.js",
	"/locale/pes.js",
	"/locale/pl.js",
	"/locale/pt.js",
	"/locale/ro.js",
	"/locale/ru.js",
	"/locale/sk.js",
	"/locale/sl.js",
	"/locale/sv.js",
	"/locale/ta.js",
	"/locale/th.js",
	"/locale/tr.js",
	"/locale/zh.js"
]);

self.addEventListener("install", (e) => {
    console.log("[Service Worker] Install");
    e.waitUntil(
        caches.open(cacheName).then((cache) => {
            console.log("[Service Worker] Caching all the files");
            return cache.addAll(cacheFiles).then(() => self.skipWaiting());
        })
    );
});

self.addEventListener("fetch", function (e) {
	if ( e.request.method !== "GET" ) {
		return;
	}

	var url = new URL( e.request.url );
	if ( url.origin !== self.location.origin ) {
		return;
	}

	if ( e.request.mode === "navigate" ) {
		e.respondWith(
			fetch( e.request ).catch(function() {
				return caches.open( cacheName ).then(function( cache ) { return cache.match( "/index.html" ); });
			})
		);
		return;
	}

	// Only immutable, explicitly shipped assets are eligible. A denylist is unsafe because firmware
	// adds read/write endpoints over time; it can also cache credential-bearing query strings.
	if ( url.search !== "" || cacheFiles.indexOf( url.pathname ) === -1 ) {
		return;
	}

	e.respondWith(
		caches.open( cacheName ).then(function( cache ) {
			return cache.match( e.request ).then(function( cached ) {
				if ( cached ) return cached;
				return fetch( e.request ).then(function( response ) {
					if ( !response.ok || response.type !== "basic" ) return response;
					return cache.put( e.request, response.clone() ).then(function() { return response; } );
				} );
			} );
		} )
	);
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== cacheName && key.indexOf("OpenSprinkler-") === 0) {
                    console.log("[Service Worker] Removing old cache: " + key);
                    return caches.delete(key);
                }
            }));
		}).then(() => self.clients.claim())
    );
});

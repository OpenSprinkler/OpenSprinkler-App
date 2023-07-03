// Define a name for the current cache
var cacheName = "OpenSprinkler-v1";

// List of files to be cached for offline use
var cacheFiles = [
  "/index.html",
  "/css/jqm.css",
  "/css/main.css",
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
  "/js/jquery.js",
  "/js/jqm.js",
  "/js/libs.js",
  "/js/main.js",
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
];

self.addEventListener("install", (e) => {
    console.log("[Service Worker] Install");
    e.waitUntil(
        caches.open(cacheName).then((cache) => {
            console.log("[Service Worker] Caching all the files");
            return cache.addAll(cacheFiles);
        })
    );
});

self.addEventListener("fetch", function (e) {
    e.respondWith(
        caches.match(e.request).then(function (r) {
            console.log("[Service Worker] Fetching resource: " + e.request.url);
            return r || fetch(e.request).then(function (response) {
                return caches.open(cacheName).then(function (cache) {
                    console.log("[Service Worker] Caching new resource: " + e.request.url);
                    cache.put(e.request, response.clone());
                    return response;
                });
            });
        })
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== cacheName) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

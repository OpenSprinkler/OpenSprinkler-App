/* global $ */

/*
 * jQuery Mobile must be configured before jqm.js is evaluated. Its default
 * hash-driven page loader treats path-like fragments as pages to fetch and
 * inject, which is unsafe for an application that only uses embedded pages.
 */
$( document ).one( "mobileinit.opensprinklerSecurity", function() {
	$.mobile.ajaxEnabled = false;
	$.mobile.hashListeningEnabled = false;
	$.mobile.allowCrossDomainPages = false;
} );

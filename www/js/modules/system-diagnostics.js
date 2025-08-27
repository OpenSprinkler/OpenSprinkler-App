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
OSApp.SystemDiagnostics = OSApp.SystemDiagnostics || {};

// FIXME: please finish the renaming process of debugWU (css, html, etc)
OSApp.SystemDiagnostics.showDiagnostics = function() {
	var popup = "<div data-role='popup' id='debugWU' class='ui-content ui-page-theme-a'>";
	var scaleRow = undefined;
	if ( typeof OSApp.currentSession.controller.settings.wls !== "undefined" ) {
		var scales = OSApp.currentSession.controller.settings.wls
		if (scales.length > 5) {
			scaleRow = "[" + scales.slice(0, 5).join(", ") + "<br>" + scales.slice(5).join(", ") + "]";
		} else {
			scaleRow = "[" + scales.join(", ") + "]";
		}
	}

	popup += "<div class='debugWUHeading'>System Status</div>" +
			"<table class='debugWUTable'>" +
				( typeof OSApp.currentSession.controller.settings.lupt === "number" ? "<tr><td>" + OSApp.Language._( "Last Reboot" ) + "</td><td>" +
					( OSApp.currentSession.controller.settings.lupt < 1000 ? "--" : OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.lupt * 1000 ), null, 2 ) ) + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.lrbtc === "number" ? "<tr><td>" + OSApp.Language._( "Reboot Reason" ) + "</td><td>" + OSApp.Firmware.getRebootReason( OSApp.currentSession.controller.settings.lrbtc ) + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.RSSI === "number" ? "<tr><td>" + OSApp.Language._( "WiFi Strength" ) + "</td><td>" + OSApp.Network.getWiFiRating( OSApp.currentSession.controller.settings.RSSI ) + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.wterr === "number" ? "<tr><td>" + OSApp.Language._( "Weather Service" ) + "</td><td>" + OSApp.Weather.getWeatherStatus( OSApp.currentSession.controller.settings.wterr ) + "</td></tr>" : "" ) +
			"</table>" +
			"<div class='debugWUHeading'>Watering Level</div>" +
			"<table class='debugWUTable'>" +
				( typeof OSApp.currentSession.controller.options.uwt !== "undefined" ? "<tr><td>" + OSApp.Language._( "Method" ) + "</td><td>" + OSApp.Weather.getAdjustmentMethod( OSApp.currentSession.controller.options.uwt ).name + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.options.wl !== "undefined" ? "<tr><td>" + OSApp.Language._( "Watering Level" ) + "</td><td>" + OSApp.currentSession.controller.options.wl + " %</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.wls !== "undefined" ? "<tr><td>" + OSApp.Language._( "Multi-Day Levels" ) + "</td><td>" + scaleRow + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.wtrestr !== "undefined" ? "<tr><td>" + OSApp.Language._( "Weather Restri." ) + "</td><td>" + ( OSApp.currentSession.controller.settings.wtrestr > 0 ? "Active" : "Inactive" ) + "</td></tr>" : "") +
				( typeof OSApp.currentSession.controller.settings.lswc === "number" ? "<tr><td>" + OSApp.Language._( "Last Updated" ) + "</td><td>" +
					( OSApp.currentSession.controller.settings.lswc === 0  ? OSApp.Language._( "Never" ) : OSApp.Dates.humaniseDuration( OSApp.currentSession.controller.settings.devt * 1000, OSApp.currentSession.controller.settings.lswc * 1000 ) ) + "</td></tr>" : "" ) +
			"</table>" +
			"<div class='debugWUHeading'>Weather Service Details</div>" +
			"<div class='debugWUScrollable'>" +
			"<table class='debugWUTable'>";

	if ( typeof OSApp.currentSession.controller.settings.wtdata === "object" && Object.keys( OSApp.currentSession.controller.settings.wtdata ).length > 0 ) {
		popup += ( typeof OSApp.currentSession.controller.settings.wtdata.h !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Humidity" ) + "</td><td>" + OSApp.Weather.formatHumidity( OSApp.currentSession.controller.settings.wtdata.h ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.t !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Temp" ) + "</td><td>" + OSApp.Weather.formatTemp( OSApp.currentSession.controller.settings.wtdata.t ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.p !== "undefined" ? "<tr><td>" + OSApp.Language._( "Total Rain" ) + "</td><td>" + OSApp.Weather.formatPrecip( OSApp.currentSession.controller.settings.wtdata.p ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.eto !== "undefined" ? "<tr><td>" + OSApp.Language._( "ETo" ) + "</td><td>" + OSApp.Weather.formatPrecip( OSApp.currentSession.controller.settings.wtdata.eto ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.radiation !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Radiation" ) + "</td><td>" + OSApp.currentSession.controller.settings.wtdata.radiation + " kWh/m2</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.minT !== "undefined" ? "<tr><td>" + OSApp.Language._( "Min Temp" ) + "</td><td>" + OSApp.Weather.formatTemp( OSApp.currentSession.controller.settings.wtdata.minT ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.maxT !== "undefined" ? "<tr><td>" + OSApp.Language._( "Max Temp" ) + "</td><td>" + OSApp.Weather.formatTemp( OSApp.currentSession.controller.settings.wtdata.maxT ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.minH !== "undefined" ? "<tr><td>" + OSApp.Language._( "Min Humidity" ) + "</td><td>" + OSApp.Weather.formatHumidity( OSApp.currentSession.controller.settings.wtdata.minH ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.maxH !== "undefined" ? "<tr><td>" + OSApp.Language._( "Max Humidity" ) + "</td><td>" + OSApp.Weather.formatHumidity( OSApp.currentSession.controller.settings.wtdata.maxH ) + "</td></tr>" : "" ) +
			( typeof OSApp.currentSession.controller.settings.wtdata.wind !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Wind" ) + "</td><td>" + OSApp.Weather.formatSpeed( OSApp.currentSession.controller.settings.wtdata.wind ) + "</td></tr>" : "" );
	}

	popup += ( typeof OSApp.currentSession.controller.settings.lwc === "number" ? "<tr><td>" + OSApp.Language._( "Last Request" ) + "</td><td>" + OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.lwc * 1000 ), null, 2 ) + "</td></tr>" : "" );
	popup += ( typeof OSApp.currentSession.controller.settings.wterr === "number" ? "<tr><td>" + OSApp.Language._( "Last Response" ) + "</td><td>" + OSApp.Weather.getWeatherError( OSApp.currentSession.controller.settings.wterr ) + "</td></tr>" : "" );
	popup += "</table></div>";

	if ( typeof OSApp.currentSession.controller.settings.otcs === "number" ) {
		popup += "<div class='debugWUHeading'>Integrations</div>" +
			"<table class='debugWUTable'>" +
			"<tr><td>OpenThings Cloud</td><td>" + OSApp.SystemDiagnostics.resolveOTCStatus( OSApp.currentSession.controller.settings.otcs ) + "</td></tr>" +
		"</table>";
	}

	if ( OSApp.currentSession.controller.settings.wtdata && ( typeof OSApp.currentSession.controller.settings.wtdata.wp === "string" || typeof OSApp.currentSession.controller.settings.wtdata.weatherProvider === "string" ) ) {
		popup += "<hr>";
		popup += OSApp.Weather.makeAttribution( OSApp.currentSession.controller.settings.wtdata.wp || OSApp.currentSession.controller.settings.wtdata.weatherProvider );
	}
	popup += "</div>";

	OSApp.UIDom.openPopup( $( popup ) );

	return false;
};

OSApp.SystemDiagnostics.resolveOTCStatus = function( status ) {
	switch ( status ) {
		case 0:
			return OSApp.Language._( "Not Enabled" );
		case 1:
			return OSApp.Language._( "Connecting..." );
		case 2:
			return "<font class='debugWUError'>" + OSApp.Language._( "Disconnected" ) + "</font>";
		case 3:
			return "<font class='debugWUOK'>" + OSApp.Language._( "Connected" ) + "</font>";
	}
};

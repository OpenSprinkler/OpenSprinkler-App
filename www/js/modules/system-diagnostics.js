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

OSApp.SystemDiagnostics.coerceFiniteNumber = function( value ) {
	return OSApp.Utils.coerceFiniteNumber( value );
};

OSApp.SystemDiagnostics.normalizeWateringLevels = function( value ) {
	if ( !Array.isArray( value ) || value.length > 14 ) {
		return undefined;
	}

	var levels = [];
	for ( var i = 0; i < value.length; i++ ) {
		var level = OSApp.SystemDiagnostics.coerceFiniteNumber( value[ i ] );
		if ( typeof level === "undefined" || !Number.isInteger( level ) || level < 0 || level > 250 ) {
			return undefined;
		}
		levels.push( level );
	}
	return levels;
};

OSApp.SystemDiagnostics.renderWateringLevels = function( levels ) {
	if ( levels.length === 0 ) {
		return "<span class='ui-state-disabled'>" +
			OSApp.Language._( "No multi-day averages are available from this weather service." ) +
			"</span>";
	}

	var items = [];
	for ( var i = 0; i < levels.length; i++ ) {
		items.push( "<li><strong>" + OSApp.Utils.htmlEscape( levels[ i ] ) + "%</strong> &mdash; " +
			OSApp.Utils.htmlEscape( i + 1 ) + OSApp.Language._( "-day rolling average" ) + "</li>" );
	}
	return "<ol class='wls'>" + items.join( "" ) + "</ol>";
};

OSApp.SystemDiagnostics.multiDayAdjustmentState = function( wto, methodId ) {
	var configured = !!( wto && typeof wto === "object" && !Array.isArray( wto ) && wto.mda === 100 ),
		methodSupportsIt = methodId === 1 || methodId === 3,
		active = configured;
	return {
		active: active,
		configured: configured,
		methodSupportsIt: methodSupportsIt,
		status: active ? "Enabled" : "Disabled"
	};
};

// FIXME: please finish the renaming process of debugWU (css, html, etc)
OSApp.SystemDiagnostics.showDiagnostics = function() {
	var popup = "<div data-role='popup' id='debugWU' class='ui-content ui-page-theme-a'>",
		scales = OSApp.SystemDiagnostics.normalizeWateringLevels( OSApp.currentSession.controller.settings.wls ),
		wateringLevel = OSApp.SystemDiagnostics.coerceFiniteNumber( OSApp.currentSession.controller.options.wl ),
		weatherData = OSApp.currentSession.controller.settings.wtdata,
		adjustmentMethod,
		multiDayState,
		multiDayUsage,
		scaleRow,
		methodId,
		i;
	if ( typeof wateringLevel !== "undefined" &&
		( !Number.isInteger( wateringLevel ) || wateringLevel < 0 || wateringLevel > 250 ) ) {
		wateringLevel = undefined;
	}
	if ( typeof OSApp.currentSession.controller.options.uwt !== "undefined" ) {
		methodId = OSApp.SystemDiagnostics.coerceFiniteNumber( OSApp.currentSession.controller.options.uwt );
		if ( typeof methodId !== "undefined" && Number.isInteger( methodId ) ) {
			methodId &= ~( 1 << 7 );
			for ( i = 0; i < OSApp.Weather.Constants.adjustmentMethods.length; i++ ) {
				if ( OSApp.Weather.Constants.adjustmentMethods[ i ].id === methodId ) {
					adjustmentMethod = OSApp.Weather.Constants.adjustmentMethods[ i ];
					break;
				}
			}
		}
	}
	if ( typeof scales !== "undefined" ) {
		scaleRow = OSApp.SystemDiagnostics.renderWateringLevels( scales );
	}
	if ( typeof methodId !== "undefined" ) {
		multiDayState = OSApp.SystemDiagnostics.multiDayAdjustmentState(
			OSApp.currentSession.controller.settings.wto,
			methodId
		);
		multiDayUsage = multiDayState.active
			? OSApp.Language._( "Multi-day adjustment is enabled. An interval program with Use Weather enabled uses the N-day average for an N-day interval." ) +
				( multiDayState.methodSupportsIt ? "" : " " + OSApp.Language._( "The toggle remains enabled; it is normally shown while Zimmerman or ETo is selected." ) )
			: OSApp.Language._( "Multi-day adjustment is disabled. These values are reference only; interval programs with Use Weather use the current overall Watering Level." ) + " " +
				( multiDayState.methodSupportsIt
					? OSApp.Language._( "Enable multi-day adjustment under Settings > Weather to use these averages." )
					: OSApp.Language._( "Select Zimmerman or ETo under Settings > Weather to expose the multi-day toggle." ) );
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
				( typeof OSApp.currentSession.controller.options.uwt !== "undefined" ? "<tr><td>" + OSApp.Language._( "Method" ) + "</td><td>" +
					( adjustmentMethod ? OSApp.Language._( adjustmentMethod.name ) : OSApp.Language._( "Unknown" ) ) + "</td></tr>" : "" ) +
				( typeof wateringLevel !== "undefined" ? "<tr><td>" + OSApp.Language._( "Watering Level" ) + "</td><td>" + OSApp.Utils.htmlEscape( wateringLevel ) + " %</td></tr>" : "" ) +
				( multiDayState ? "<tr><td>" + OSApp.Language._( "Multi-Day Adjustment" ) + "</td><td>" +
					OSApp.Utils.htmlEscape( multiDayState.status ) + "</td></tr>" : "" ) +
				( typeof scales !== "undefined" ? "<tr><td>" + OSApp.Language._( "Multi-Day Levels" ) + "</td><td>" + scaleRow + "</td></tr>" +
					"<tr><td colspan='2'>" + OSApp.Language._( "Each value combines the most recent N weather days; it is not a forecast or a reading for one calendar date." ) + " " +
					( multiDayUsage || OSApp.Language._( "Whether multi-day adjustment is active could not be determined; treat these retained values as reference only." ) ) + " " +
					OSApp.Language._( "When enabled, an interval longer than this list uses the longest average available. 100% keeps programmed run times, 80% makes them 20% shorter, 150% makes them 50% longer, and 0% skips watering. An active weather restriction always skips watering." ) + "</td></tr>" : "" ) +
				( typeof OSApp.currentSession.controller.settings.wtrestr !== "undefined" ? "<tr><td>" + OSApp.Language._( "Weather Restri." ) + "</td><td>" + ( OSApp.currentSession.controller.settings.wtrestr > 0 ? "Active" : "Inactive" ) + "</td></tr>" : "") +
				( typeof OSApp.currentSession.controller.settings.lswc === "number" ? "<tr><td>" + OSApp.Language._( "Last Updated" ) + "</td><td>" +
					( OSApp.currentSession.controller.settings.lswc === 0  ? OSApp.Language._( "Never" ) : OSApp.Dates.humaniseDuration( OSApp.currentSession.controller.settings.devt * 1000, OSApp.currentSession.controller.settings.lswc * 1000 ) ) + "</td></tr>" : "" ) +
			"</table>" +
			"<div class='debugWUHeading'>Weather Service Details</div>" +
			"<div class='debugWUScrollable'>" +
			"<table class='debugWUTable'>";

	if ( weatherData && typeof weatherData === "object" && !Array.isArray( weatherData ) && Object.keys( weatherData ).length > 0 ) {
		var radiation = OSApp.SystemDiagnostics.coerceFiniteNumber( weatherData.radiation );
		popup += ( typeof weatherData.h !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Humidity" ) + "</td><td>" + OSApp.Weather.formatHumidity( weatherData.h ) + "</td></tr>" : "" ) +
			( typeof weatherData.t !== "undefined" ? "<tr><td>" + OSApp.Language._( "Mean Temp" ) + "</td><td>" + OSApp.Weather.formatTemp( weatherData.t ) + "</td></tr>" : "" ) +
			( typeof weatherData.p !== "undefined" ? "<tr><td>" + OSApp.Language._( "Total Rain" ) + "</td><td>" + OSApp.Weather.formatPrecip( weatherData.p ) + "</td></tr>" : "" ) +
			( typeof weatherData.eto !== "undefined" ? "<tr><td>" + OSApp.Language._( "ETo" ) + "</td><td>" + OSApp.Weather.formatPrecip( weatherData.eto ) + "</td></tr>" : "" ) +
			( typeof radiation !== "undefined" ? "<tr><td>" + OSApp.Language._( "Total Radiation" ) + "</td><td>" + OSApp.Utils.htmlEscape( radiation ) + " kWh/m2</td></tr>" : "" ) +
			( typeof weatherData.minT !== "undefined" ? "<tr><td>" + OSApp.Language._( "Min Temp" ) + "</td><td>" + OSApp.Weather.formatTemp( weatherData.minT ) + "</td></tr>" : "" ) +
			( typeof weatherData.maxT !== "undefined" ? "<tr><td>" + OSApp.Language._( "Max Temp" ) + "</td><td>" + OSApp.Weather.formatTemp( weatherData.maxT ) + "</td></tr>" : "" ) +
			( typeof weatherData.minH !== "undefined" ? "<tr><td>" + OSApp.Language._( "Min Humidity" ) + "</td><td>" + OSApp.Weather.formatHumidity( weatherData.minH ) + "</td></tr>" : "" ) +
			( typeof weatherData.maxH !== "undefined" ? "<tr><td>" + OSApp.Language._( "Max Humidity" ) + "</td><td>" + OSApp.Weather.formatHumidity( weatherData.maxH ) + "</td></tr>" : "" ) +
			( typeof weatherData.wind !== "undefined" ? "<tr><td>" + OSApp.Language._( "Peak Wind" ) + "</td><td>" + OSApp.Weather.formatSpeed( weatherData.wind ) + "</td></tr>" : "" );
	}

	popup += ( typeof OSApp.currentSession.controller.settings.lwc === "number" ? "<tr><td>" + OSApp.Language._( "Last Request" ) + "</td><td>" +
		( OSApp.currentSession.controller.settings.lwc === 0 ? OSApp.Language._( "Never" ) :
			OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.lwc * 1000 ), null, 2 ) ) + "</td></tr>" : "" );
	popup += ( typeof OSApp.currentSession.controller.settings.wterr === "number" ? "<tr><td>" + OSApp.Language._( "Last Response" ) + "</td><td>" + OSApp.Weather.getWeatherError( OSApp.currentSession.controller.settings.wterr ) + "</td></tr>" : "" );
	popup += "</table></div>";

	if ( typeof OSApp.currentSession.controller.settings.otcs === "number" ) {
		popup += "<div class='debugWUHeading'>Integrations</div>" +
			"<table class='debugWUTable'>" +
			"<tr><td>OpenThings Cloud</td><td>" + OSApp.SystemDiagnostics.resolveOTCStatus( OSApp.currentSession.controller.settings.otcs ) + "</td></tr>" +
		"</table>";
	}

	if ( weatherData && ( typeof weatherData.wp === "string" || typeof weatherData.weatherProvider === "string" ) ) {
		popup += "<hr>";
		popup += OSApp.Weather.makeAttribution( weatherData.wp || weatherData.weatherProvider );
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

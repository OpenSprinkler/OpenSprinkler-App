/* global SunCalc, $ */

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
OSApp.Weather = OSApp.Weather || {};

OSApp.Weather.Constants = {

	// Do NOT use Language._ to translate these here during definition. Do it when rendering!
	adjustmentMethods: [
        { name: "Manual", id: 0 },
        { name: "Zimmerman", id: 1 },
        { name: "Auto Rain Delay", id: 2, minVersion: 216 },
		{ name: "ETo", id: 3, minVersion: 216 },
		{ name: "Monthly", id:4, minVersion: 220 }
    ],

	// Ensure error codes align with App errors.ts (codes > 0) and HTTP error codes in Firmware defines.h (codes < 0)
	// Do NOT use Language._ to translate these here during definition. Do it when rendering!
	// FIXME: all enums should follow the pattern of an array with objects with id/name. Example: [{id: -4, name: "Empty Response"}]
	weatherErrors: {
		"-4":	"Empty Response",
		"-3":	"Timed Out",
		"-2":	"Connection Failed",
		"-1":	"No Response",
		"0":	"Success",
		"1":	"Weather Data Error",
		"2":	"Location Error",
		"3":	"PWS Error",
		"4":	"Adjustment Method Error",
		"5":	"Adjustment Options Error",
		"10":	"Insufficient Weather Data",
		"11":	"Weather Data Incomplete",
		"12":	"Weather Data Request Failed",
		"20":	"Location Service API Error",
		"21":	"Location Not Found",
		"22":	"Invalid Location Format",
		"30":	"Invalid WUnderground PWS",
		"31":	"Invalid WUnderground Key",
		"32":	"PWS Authentication Error",
		"33":	"Unsupported PWS Method",
		"34":	"PWS Not Provided Error",
		"35":	"Missing Weather API Key",
		"40":	"Unsupported Adjustment Method",
		"41":	"No Adjustment Method Provided",
		"50":	"Corrupt Adjustment Options",
		"51":	"Missing Adjustment Option",
		"99":	"Unexpected Error"
	}
};

OSApp.Weather.activeRequest = null;
OSApp.Weather.requestGeneration = 0;

OSApp.Weather.cancelUpdate = function() {
	OSApp.Weather.requestGeneration++;
	if ( OSApp.Weather.activeRequest && typeof OSApp.Weather.activeRequest.abort === "function" ) {
		OSApp.Weather.activeRequest.abort();
	}
	OSApp.Weather.activeRequest = null;
};

OSApp.Weather.safeIcon = function( icon ) {
	return String( icon || "" ).replace( /[^a-zA-Z0-9_-]/g, "" );
};

OSApp.Weather.toFiniteWeatherNumber = function( value ) {
	if ( ( typeof value !== "number" && typeof value !== "string" ) ||
		( typeof value === "string" && value.trim() === "" ) ) {
		return undefined;
	}

	var number = Number( value );
	return Number.isFinite( number ) ? number : undefined;
};

OSApp.Weather.normalizeWeatherData = function( data ) {
	if ( !data || typeof data !== "object" || Array.isArray( data ) ||
		!Array.isArray( data.location ) || data.location.length < 2 ||
		!Array.isArray( data.forecast ) || data.forecast.length === 0 || data.forecast.length > 32 ) {
		return null;
	}

	var latitude = OSApp.Weather.toFiniteWeatherNumber( data.location[ 0 ] ),
		longitude = OSApp.Weather.toFiniteWeatherNumber( data.location[ 1 ] ),
		temperature = OSApp.Weather.toFiniteWeatherNumber( data.temp ),
		precipitation = OSApp.Weather.toFiniteWeatherNumber( data.precip );

	if ( latitude === undefined || latitude < -90 || latitude > 90 ||
		longitude === undefined || longitude < -180 || longitude > 180 ||
		temperature === undefined || temperature < -500 || temperature > 500 ||
		precipitation === undefined || precipitation < 0 || precipitation > 10000 ||
		typeof data.description !== "string" || data.description.length > 2048 ||
		typeof data.icon !== "string" || data.icon.length > 64 ) {
		return null;
	}

	var forecast = [];
	for ( var index = 0; index < data.forecast.length; index++ ) {
		var entry = data.forecast[ index ];
		if ( !entry || typeof entry !== "object" || Array.isArray( entry ) ) {
			return null;
		}

		var minimum = OSApp.Weather.toFiniteWeatherNumber( entry.temp_min ),
			maximum = OSApp.Weather.toFiniteWeatherNumber( entry.temp_max ),
			forecastPrecipitation = OSApp.Weather.toFiniteWeatherNumber( entry.precip ),
			date = OSApp.Weather.toFiniteWeatherNumber( entry.date );

		if ( minimum === undefined || minimum < -500 || minimum > 500 ||
			maximum === undefined || maximum < minimum || maximum > 500 ||
			forecastPrecipitation === undefined || forecastPrecipitation < 0 || forecastPrecipitation > 10000 ||
			date === undefined || !Number.isSafeInteger( date ) || date <= 0 || date > 0xffffffff ||
			typeof entry.description !== "string" || entry.description.length > 2048 ||
			typeof entry.icon !== "string" || entry.icon.length > 64 ) {
			return null;
		}

		forecast.push( {
			temp_min: minimum,
			temp_max: maximum,
			precip: forecastPrecipitation,
			date: date,
			icon: entry.icon,
			description: entry.description
		} );
	}

	var normalized = {
		location: [ latitude, longitude ],
		temp: temperature,
		precip: precipitation,
		description: data.description,
		icon: data.icon,
		forecast: forecast
	};

	[ "humidity", "wind", "minTemp", "maxTemp", "timezone", "sunrise", "sunset", "ttl", "lastUpdated" ].forEach( function( field ) {
		var value = OSApp.Weather.toFiniteWeatherNumber( data[ field ] );
		if ( value !== undefined ) {
			normalized[ field ] = value;
		}
	} );

	[ "weatherProvider", "wp", "region", "city", "providedLocation" ].forEach( function( field ) {
		if ( typeof data[ field ] === "string" && data[ field ].length <= 2048 ) {
			normalized[ field ] = data[ field ];
		}
	} );

	if ( typeof data.raining === "boolean" ) {
		normalized.raining = data.raining;
	}

	if ( data.alert === null ) {
		normalized.alert = null;
	} else if ( data.alert && typeof data.alert === "object" && !Array.isArray( data.alert ) ) {
		var alert = {};
		[ "type", "name", "message" ].forEach( function( field ) {
			if ( typeof data.alert[ field ] === "string" && data.alert[ field ].length <= 32768 ) {
				alert[ field ] = data.alert[ field ];
			}
		} );
		normalized.alert = alert;
	}

	return normalized;
};

// Weather-option JSON is controller input. Normalize every value before it is interpolated into
// popup markup; input[type=number] does not make a hostile value safe while HTML is being parsed.
OSApp.Weather.finiteOption = function( value, fallback, minimum, maximum ) {
	if ( ( typeof value !== "number" && typeof value !== "string" ) ||
		( typeof value === "string" && value.trim() === "" ) ) {
		return fallback;
	}

	var number = Number( value );
	return Number.isFinite( number ) && number >= minimum && number <= maximum ? number : fallback;
};

OSApp.Weather.normalizeZimmermanOptions = function( value ) {
	value = value && typeof value === "object" ? value : {};
	return {
		h: OSApp.Weather.finiteOption( value.h, 100, 0, 100 ),
		t: OSApp.Weather.finiteOption( value.t, 100, 0, 100 ),
		r: OSApp.Weather.finiteOption( value.r, 100, 0, 100 ),
		bh: OSApp.Weather.finiteOption( value.bh, 30, 0, 100 ),
		bt: OSApp.Weather.finiteOption( value.bt, 70, 0, 120 ),
		br: OSApp.Weather.finiteOption( value.br, 0, 0, 1 )
	};
};

OSApp.Weather.normalizeRainDelayOptions = function( value ) {
	value = value && typeof value === "object" ? value : {};
	return { d: OSApp.Weather.finiteOption( value.d, 24, 0, 8760 ) };
};

OSApp.Weather.normalizeMonthlyOptions = function( value ) {
	var source = value && typeof value === "object" && Array.isArray( value.scales ) ? value.scales : [];
	return { scales: Array.from( { length: 12 }, function( _, index ) {
		return OSApp.Weather.finiteOption( source[ index ], 100, 0, 250 );
	} ) };
};

OSApp.Weather.normalizeEToOptions = function( value ) {
	value = value && typeof value === "object" ? value : {};
	return {
		baseETo: OSApp.Weather.finiteOption( value.baseETo, 0, 0, 1 ),
		elevation: OSApp.Weather.finiteOption( value.elevation, 600, -1400, 30000 )
	};
};

OSApp.Weather.normalizeRestrictionOptions = function( value ) {
	var normalized = value && typeof value === "object" ? Object.assign( {}, value ) : {};
	normalized.cali = value && ( value.cali === true || value.cali === 1 ) ? 1 : 0;
	normalized.rainAmt = OSApp.Weather.finiteOption( value && value.rainAmt, 0, 0, 100 );
	normalized.rainDays = OSApp.Weather.finiteOption( value && value.rainDays, 0, 0, 10 );
	normalized.minTemp = OSApp.Weather.finiteOption( value && value.minTemp, -40, -100, 100 );
	return normalized;
};

// Weather functions
OSApp.Weather.showZimmermanAdjustmentOptions = function( button, callback ) {
	callback = callback || function() {};
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	// Sensitivity and baseline values for Humidity, Temp and Rainfall for Zimmerman adjustment
	var options = OSApp.Weather.normalizeZimmermanOptions( OSApp.Utils.unescapeJSON( button.value ) ),

		// Enable Zimmerman extension to set weather conditions as baseline for adjustment
		hasBaseline = OSApp.Firmware.checkOSVersion( 2162 );

	// OSPi stores in imperial so convert to metric and adjust to nearest 1/10ths of a degree and mm
	if ( OSApp.currentDevice.isMetric ) {
		options.bt = Math.round( ( ( options.bt - 32 ) * 5 / 9 ) * 10 ) / 10;
		options.br = Math.round( ( options.br * 25.4 ) * 10 ) / 10;
	}

	var popup = $( "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Weather Adjustment Options" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "Set the baseline weather conditions for your location. " ) +
					OSApp.Language._( "The Zimmerman method will adjust the watering duration based on differences from this reference point." ) +
				"</p>" +
				"<div class='ui-grid-b'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "Temp" ) + ( OSApp.currentDevice.isMetric ? " &#176;C" : " &#176;F" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='bt' type='number' " + ( OSApp.currentDevice.isMetric ? "min='-20' max='50'" : "min='0' max='120'" ) + " value='" + options.bt + ( hasBaseline ? "'>" : "' disabled='disabled'>" ) +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Rain" ) + ( OSApp.currentDevice.isMetric ? " mm" : " \"" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='br' type='number' " + ( OSApp.currentDevice.isMetric ? "min='0' max='25' step='0.1'" : "min='0' max='1' step='0.01'" ) + " value='" + options.br + ( hasBaseline ? "'>" : "' disabled='disabled'>" ) +
					"</div>" +
					"<div class='ui-block-c'>" +
						"<label class='center'>" +
							OSApp.Language._( "Humidity" ) + " %" +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='bh' type='number'  min='0' max='100' value='" + options.bh + ( hasBaseline ? "'>" : "' disabled='disabled'>" ) +
					"</div>" +
				"</div>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "Set the sensitivity of the watering adjustment to changes in each of the above weather conditions." ) +
				"</p>" +
				"<span>" +
					"<fieldset class='ui-grid-b incr'>" +
						"<div class='ui-block-a'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-c'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a>" +
						"</div>" +
					"</fieldset>" +
					"<div class='ui-grid-b inputs'>" +
						"<div class='ui-block-a'>" +
							"<input data-wrapper-class='pad_buttons' class='t' type='number' min='0' max='100' value='" + options.t + "'>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<input data-wrapper-class='pad_buttons' class='r' type='number'  min='0' max='100' value='" + options.r + "'>" +
						"</div>" +
						"<div class='ui-block-c'>" +
							"<input data-wrapper-class='pad_buttons' class='h' type='number'  min='0' max='100' value='" + options.h + "'>" +
						"</div>" +
					"</div>" +
					"<fieldset class='ui-grid-b decr'>" +
						"<div class='ui-block-a'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-b'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
						"<div class='ui-block-c'>" +
							"<a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a>" +
						"</div>" +
					"</fieldset>" +
				"</span>" +
				"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>" ),
		changeValue = function( pos, dir ) {
			var input = popup.find( ".inputs input" ).eq( pos ),
				val = parseInt( input.val() );

			if ( ( dir === -1 && val === 0 ) || ( dir === 1 && val === 100 ) ) {
				return;
			}

			input.val( val + dir );
		};

	popup.find( ".submit" ).on( "click", function() {
		var options = {
			h: parseInt( popup.find( ".h" ).val() ),
			t: parseInt( popup.find( ".t" ).val() ),
			r: parseInt( popup.find( ".r" ).val() )
		};

		if ( hasBaseline ) {
			$.extend( options, {
				bh: parseInt( popup.find( ".bh" ).val() ),
				bt: parseFloat( popup.find( ".bt" ).val() ),
				br: parseFloat( popup.find( ".br" ).val() )
			} );

			// OSPi stores in imperial so onvert metric at higher precision so we dont lose accuracy
			if ( OSApp.currentDevice.isMetric ) {
				options.bt = Math.round( ( options.bt * 9 / 5 + 32 ) * 100 ) / 100;
				options.br = Math.round( ( options.br / 25.4 ) * 1000 ) / 1000;
			}
		}

		if ( button ) {
			button.value = OSApp.Utils.escapeJSON( options );
		}

		callback();

		popup.popup( "close" );
		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {

		// Generic min/max checker for Temp/Rain/Hum baseline as well as 0-100%
		var min = parseFloat( this.min ),
			max = parseFloat( this.max );

		if ( this.value === "" ) {
			this.value = "0";
		}
		if ( this.value < min || this.value > max ) {
			this.value = this.value < min ? min : max;
		}
	} );

	OSApp.UIDom.holdButton( popup.find( ".incr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, 1 );
		return false;
	} );

	OSApp.UIDom.holdButton( popup.find( ".decr" ).children(), function( e ) {
		var pos = $( e.currentTarget ).index();
		changeValue( pos, -1 );
		return false;
	} );

	$( "#adjustmentOptions" ).remove();

	popup.css( "max-width", "380px" );

	OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
};

OSApp.Weather.showAutoRainDelayAdjustmentOptions = function( button, callback ) {
	callback = callback || function() {};
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	var options = OSApp.Weather.normalizeRainDelayOptions( OSApp.Utils.unescapeJSON( button.value ) );

	var content = "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Weather Adjustment Options" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "If the current weather condition reports rain, a rain delay is automatically issued using the duration below." ) +
				"</p>" +
				"<label class='center' for='delay_duration'>" + OSApp.Language._( "Delay Duration (hours)" ) + "</label>" +
				"<div class='input_with_buttons'>" +
					"<button id='decr1' class='decr ui-btn ui-btn-icon-notext ui-icon-carat-l btn-no-border'></button>" +
					"<input id='delay_duration' type='number' pattern='[0-9]*' value='" + options.d + "'>" +
					"<button id='incr1' class='incr ui-btn ui-btn-icon-notext ui-icon-carat-r btn-no-border'></button>" +
				"</div>" +
			 "<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>";

	var popup = $( content );

	OSApp.UIDom.holdButton( popup.find( "#incr1" ), function() {
		const input  = popup.find("#delay_duration"),
			value = parseInt( input.val() ) + 1;
		if (value > 8760) return;
		input.val( value );
		return false;
	} );
	OSApp.UIDom.holdButton( popup.find( "#decr1" ), function() {
		const input  = popup.find("#delay_duration"),
			value = parseInt( input.val() ) - 1;
		if (value < 0) return;
		input.val( value );
		return false;
	} );

	popup.find( ".submit" ).on( "click", function() {
		options = { d: parseInt( popup.find( "#delay_duration" ).val() ) };

		if ( button ) {
			button.value = OSApp.Utils.escapeJSON( options );
		}

		callback();

		popup.popup( "close" );
		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {
		if ( this.value === "" || parseInt( this.value ) < 0 ) {
			this.value = "0";
		}
	} );

	$( "#adjustmentOptions" ).remove();

	popup.css( "max-width", "380px" );

	OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
};

OSApp.Weather.showMonthlyAdjustmentOptions = function( button, callback ) {
	callback = callback || function() {};
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	var options = OSApp.Weather.normalizeMonthlyOptions( OSApp.Utils.unescapeJSON( button.value ) );

	var popup = $( "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Weather Adjustment Options" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "Input Monthly Watering Percentage Values" ) +
				"</p>" +
				"<div class='ui-grid-c'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "Jan" )  +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc0' type='number' min=0 max=250 value=" + options.scales[ 0 ] + ">" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Feb" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc1' type='number' min=0 max=250 value=" + options.scales[ 1 ] + ">" +
					"</div>" +
					"<div class='ui-block-c'>" +
						"<label class='center'>" +
							OSApp.Language._( "Mar" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc2' type='number' min=0 max=250 value=" + options.scales[ 2 ] + ">" +
					"</div>" +
					"<div class='ui-block-d'>" +
						"<label class='center'>" +
							OSApp.Language._( "Apr" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc3' type='number' min=0 max=250 value=" + options.scales[ 3 ] + ">" +
					"</div>" +
				"</div>" +
				"<div class='ui-grid-c'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "May" )  +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc4' type='number' min=0 max=250 value=" + options.scales[ 4 ] + ">" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Jun" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc5' type='number' min=0 max=250 value=" + options.scales[ 5 ] + ">" +
					"</div>" +
					"<div class='ui-block-c'>" +
						"<label class='center'>" +
							OSApp.Language._( "Jul" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc6' type='number' min=0 max=250 value=" + options.scales[ 6 ] + ">" +
					"</div>" +
					"<div class='ui-block-d'>" +
						"<label class='center'>" +
							OSApp.Language._( "Aug" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc7' type='number' min=0 max=250 value=" + options.scales[ 7 ] + ">" +
					"</div>" +
				"</div>" +
				"<div class='ui-grid-c'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "Sep" )  +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc8' type='number' min=0 max=250 value=" + options.scales[ 8 ] + ">" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Oct" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc9' type='number' min=0 max=250 value=" + options.scales[ 9 ] + ">" +
					"</div>" +
					"<div class='ui-block-c'>" +
						"<label class='center'>" +
							OSApp.Language._( "Nov" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc10' type='number' min=0 max=250 value=" + options.scales[ 10 ] + ">" +
					"</div>" +
					"<div class='ui-block-d'>" +
						"<label class='center'>" +
							OSApp.Language._( "Dec" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='sc11' type='number' min=0 max=250 value=" + options.scales[ 11 ] + ">" +
					"</div>" +
				"</div>" +
				"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>" );

	popup.find( ".submit" ).on( "click", function() {
		var _scales = [];
		for ( var i = 0; i < 12; i++ ) {
			_scales[ i ] = parseInt( popup.find( ".sc" + i ).val() );
			if ( _scales[ i ] < 0 ) { _scales[ i ] = 0; }
			if ( _scales[ i ] > 250 ) { _scales[ i ] = 250; }
		}
		options = { scales: _scales };
		if ( button ) {
			button.value = OSApp.Utils.escapeJSON( options );
		}

		callback();

		popup.popup( "close" );
		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {
		if ( this.value === "" || parseInt( this.value ) < 0 ) {
			this.value = "0";
		}
	} );

	$( "#adjustmentOptions" ).remove();

	popup.css( "max-width", "380px" );

	OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
};

OSApp.Weather.formatTemp = function( temp ) {
	if ( OSApp.currentDevice.isMetric ) {
		temp = Math.round( ( temp - 32 ) * ( 5 / 9 ) * 10 ) / 10 + " &#176;C";
	} else {
		temp = Math.round( temp * 10 ) / 10 + " &#176;F";
	}
	return temp;
};

OSApp.Weather.formatPrecip = function( precip ) {
	if ( OSApp.currentDevice.isMetric ) {
		precip = Math.round( precip * 25.4 * 10 ) / 10 + " mm";
	} else {
		precip = Math.round( precip * 100 ) / 100 + " in";
	}
	return precip;
};

OSApp.Weather.formatHumidity = function( humidity ) {
	return Math.round( humidity ) + " %";
};

OSApp.Weather.formatSpeed = function( speed ) {
	if ( OSApp.currentDevice.isMetric ) {
		speed = Math.round( speed * 1.6 * 10 ) / 10 + " km/h";
	} else {
		speed = Math.round( speed * 10 ) / 10 + " mph";
	}
	return speed;
};

// Validates a Weather Underground location to verify it contains the data needed for Weather Adjustments
OSApp.Weather.validateWULocation = function( location, callback ) {
	callback = callback || function() {};
	if ( !OSApp.currentSession.controller.settings.wto || typeof OSApp.currentSession.controller.settings.wto.key !== "string" || OSApp.currentSession.controller.settings.wto.key === "" ) {
		callback( false );
		return;
	}

	$.ajax( {
		url: "https://api.weather.com/v2/pws/observations/hourly/7day?stationId=" + encodeURIComponent( location ) + "&format=json&units=e&apiKey=" + encodeURIComponent( OSApp.currentSession.controller.settings.wto.key ),
		cache: true
	} ).done( function( data ) {
		if ( !data || data.errors ) {
			callback( false );
			return;
		}

		callback( true );
	} ).fail( function() {
		callback( false );
	} );
};

OSApp.Weather.showEToAdjustmentOptions = function( button, callback ) {
	callback = callback || function() {};
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	// Elevation and baseline ETo for ETo adjustment.
	var options = OSApp.Weather.normalizeEToOptions( OSApp.Utils.unescapeJSON( button.value ) );

	if ( OSApp.currentDevice.isMetric ) {
		options.baseETo = Math.round( options.baseETo * 25.4 * 10 ) / 10;
		options.elevation = Math.round( options.elevation / 3.28 );
	}

	var popup = $( "<div data-role='popup' data-theme='a' id='adjustmentOptions'>" +
			"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._( "Weather Adjustment Options" ) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
					OSApp.Language._( "Set the baseline potential evapotranspiration (ETo) and elevation for your location. " ) +
					OSApp.Language._( "The ETo adjustment method will adjust the watering duration based on the difference between the baseline ETo and the current ETo." ) +
				"</p>" +
				"<div class='ui-grid-a'>" +
					"<div class='ui-block-a'>" +
						"<label class='center'>" +
							OSApp.Language._( "Baseline ETo" ) + ( OSApp.currentDevice.isMetric ? " (mm" : "(in" ) + "/day)" +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='baseline-ETo' type='number' min='0' " + ( OSApp.currentDevice.isMetric ? "max='25' step='0.1'" : "max='1' step='0.01'" ) + " value='" + options.baseETo + "'>" +
					"</div>" +
					"<div class='ui-block-b'>" +
						"<label class='center'>" +
							OSApp.Language._( "Elevation" ) + ( OSApp.currentDevice.isMetric ? " (m)" : " (ft)" ) +
						"</label>" +
						"<input data-wrapper-class='pad_buttons' class='elevation' type='number' step='1'" + ( OSApp.currentDevice.isMetric ? "min='-400' max='9000'" : "min='-1400' max='30000'" ) + " value='" + options.elevation + "'>" +
					"</div>" +
				"</div>" +
				"<button class='detect-baseline-eto'>" + OSApp.Language._( "Detect baseline ETo" ) + "</button>" +
				"<button class='submit' data-theme='b'>" + OSApp.Language._( "Submit" ) + "</button>" +
			"</div>" +
		"</div>"
	);

	popup.find( ".submit" ).on( "click", function() {
		options = {
			baseETo: parseFloat( popup.find( ".baseline-ETo" ).val() ),
			elevation: parseInt( popup.find( ".elevation" ).val() )
		};

		// Convert to imperial before storing.
		if ( OSApp.currentDevice.isMetric ) {
			options.baseETo = Math.round( options.baseETo / 25.4 * 100 ) / 100;
			options.elevation = Math.round( options.elevation * 3.28 );
		}

		if ( button ) {
			button.value = OSApp.Utils.escapeJSON( options );
		}

		callback();

		popup.popup( "close" );
		return false;
	} );

	popup.find( ".detect-baseline-eto" ).on( "click", function() {

		// Backup button contents so it can be restored after the request is completed.
		var buttonContents = popup.find( ".detect-baseline-eto" ).html();

		OSApp.UIDom.showLoading( ".detect-baseline-eto" );

		$.ajax( {
			url: OSApp.currentSession.weatherServerUrl + "/baselineETo?loc=" + encodeURIComponent( OSApp.currentSession.controller.settings.loc ),
			contentType: "application/json; charset=utf-8",
			success: function( data ) {

				var baselineETo = data.eto;

				// Convert to metric if necessary.
				if ( OSApp.currentDevice.isMetric ) {
					baselineETo = Math.round( baselineETo * 25.4 * 100 ) / 100;
				}

				popup.find( ".baseline-ETo" ).val( baselineETo );

				window.alert( "Detected baseline ETo for configured location is " + baselineETo + ( OSApp.currentDevice.isMetric ? "mm" : "in" ) + "/day" );
			},
			error: function( xhr, errorType ) {

				// Use the response body for HTTP errors and the error type for JQuery errors.
				var errorMessage = "Unable to detect baseline ETo: " +
					( xhr.status ? xhr.responseText + "(" + xhr.status + ")" : errorType );
				window.alert( errorMessage );
				window.console.error( errorMessage );
			},
			complete: function( ) {
				popup.find( ".detect-baseline-eto" ).html( buttonContents );
			}
		} );

		return false;
	} );

	popup.on( "focus", "input[type='number']", function() {
		this.value = "";
	} ).on( "blur", "input[type='number']", function() {

		// Generic min/max checker for each option.
		var min = parseFloat( this.min ),
			max = parseFloat( this.max );

		if ( this.value === "" ) {
			this.value = "0";
		}
		if ( this.value < min || this.value > max ) {
			this.value = this.value < min ? min : max;
		}
	} );

	$( "#adjustmentOptions" ).remove();

	popup.css( "max-width", "380px" );

	OSApp.UIDom.openPopup( popup, { positionTo: "window" } );
};

OSApp.Weather.hideWeather = function() {
	$( "#weather" ).empty().parents( ".info-card" ).addClass( "noweather" );
};

OSApp.Weather.finishWeatherUpdate = function( success ) {
	try {
		OSApp.Weather.updateWeatherBox();
	} finally {
		$.mobile.document.trigger( "weatherUpdateComplete", [ success !== false ] );
	}
};

OSApp.Weather.removeCachedWeather = function() {
	try {
		OSApp.Storage.removeItemSync( "weatherData" );
	} catch {
		// Cache cleanup is best effort when storage access is blocked.
	}
};

OSApp.Weather.updateWeather = function( force ) {
	OSApp.Weather.cancelUpdate();

	if ( !OSApp.Utils.isSessionValid() ) {
		console.log("*** updateWeather aborted due to invalid session");
		OSApp.Weather.hideWeather();
		OSApp.Weather.finishWeatherUpdate( false );
		return;
	}

	force = force === true || ( force && force.force === true );

	var now = new Date().getTime(),
		requestGeneration = OSApp.Weather.requestGeneration,
		sessionGeneration = OSApp.currentSession.generation || 0,
		location = OSApp.currentSession.controller.settings.loc;

	if ( !force ) {
		var currentWeather = OSApp.Weather.normalizeWeatherData( OSApp.currentSession.weather );
		if ( currentWeather && currentWeather.providedLocation === location &&
			Number.isFinite( currentWeather.lastUpdated ) && now - currentWeather.lastUpdated < 60 * 60 * 1000 ) {
			OSApp.currentSession.weather = currentWeather;
			OSApp.currentSession.coordinates = currentWeather.location.slice( 0, 2 );
			OSApp.Weather.finishWeatherUpdate();
			return;
		}

		var storedData;
		try {
			storedData = OSApp.Storage.getItemSync( "weatherData" );
		} catch {
			storedData = null;
		}
		if ( storedData ) {
			try {
				var weatherData = OSApp.Weather.normalizeWeatherData( JSON.parse( storedData ) );
				if ( weatherData && weatherData.providedLocation === location &&
					Number.isFinite( weatherData.lastUpdated ) && now - weatherData.lastUpdated < 60 * 60 * 1000 ) {
					OSApp.currentSession.weather = weatherData;
					OSApp.currentSession.coordinates = weatherData.location.slice( 0, 2 );
					OSApp.Weather.finishWeatherUpdate();
					return;
				}
				if ( !weatherData ) {
					OSApp.Weather.removeCachedWeather();
				}
			} catch {
				OSApp.Weather.removeCachedWeather();
			}
		}
	}

	OSApp.currentSession.weather = undefined;

	if ( location === "" ) {
		OSApp.Weather.hideWeather();
		OSApp.Weather.finishWeatherUpdate();
		return;
	}

	OSApp.UIDom.showLoading( "#weather" );

	const provider = OSApp.currentSession.controller.settings.wto?.provider;
	const key = OSApp.currentSession.controller.settings.wto?.key;
	const pws = OSApp.currentSession.controller.settings.wto?.pws;

	let url = OSApp.currentSession.weatherServerUrl + "/weatherData?loc=" + encodeURIComponent( location );

	if ( provider ){
		var weatherOptions = { provider: provider };
		if ( key ) {
			weatherOptions.key = key;
		}
		if ( provider === "WU" && pws ) {
			weatherOptions.pws = pws;
		}
		url += "&wto=" + encodeURIComponent( OSApp.Utils.escapeJSON( weatherOptions ) );
	}

	try {
		OSApp.Weather.activeRequest = $.ajax( {
			url: url,
			contentType: "application/json; charset=utf-8",
			success: function( data ) {
				if ( requestGeneration !== OSApp.Weather.requestGeneration ||
					sessionGeneration !== ( OSApp.currentSession.generation || 0 ) ||
					location !== OSApp.currentSession.controller.settings.loc ) {
					return;
				}

				var weatherData = OSApp.Weather.normalizeWeatherData( data );
				if ( !weatherData ) {
					OSApp.Weather.hideWeather();
					OSApp.Weather.finishWeatherUpdate( false );
					return;
				}

				OSApp.currentSession.coordinates = weatherData.location.slice( 0, 2 );
				weatherData.lastUpdated = new Date().getTime();
				weatherData.providedLocation = location;
				OSApp.currentSession.weather = weatherData;
				try {
					OSApp.Storage.setItemSync( "weatherData", JSON.stringify( weatherData ) );
				} catch {
					// Weather rendering should not fail when persistent storage is unavailable or full.
				}
				OSApp.Weather.finishWeatherUpdate();
			},
			error: function( xhr, status ) {
				if ( status === "abort" || requestGeneration !== OSApp.Weather.requestGeneration ||
					sessionGeneration !== ( OSApp.currentSession.generation || 0 ) ) {
					return;
				}
				OSApp.Weather.hideWeather();
				OSApp.Weather.finishWeatherUpdate( false );
			},
			complete: function() {
				if ( requestGeneration === OSApp.Weather.requestGeneration ) {
					OSApp.Weather.activeRequest = null;
				}
			}
		} );
	} catch {
		if ( requestGeneration === OSApp.Weather.requestGeneration ) {
			OSApp.Weather.activeRequest = null;
			OSApp.Weather.hideWeather();
			OSApp.Weather.finishWeatherUpdate( false );
		}
	}
};

OSApp.Weather.checkURLandUpdateWeather = function() {
	var sessionGeneration = OSApp.currentSession.generation || 0;
	var finish = function( wsp ) {
		if ( sessionGeneration !== ( OSApp.currentSession.generation || 0 ) ) {
			return;
		}
		if ( wsp ) {
			if ( OSApp.Firmware.checkOSVersion( 2214 ) ) {
				if ( /^https?:\/\//i.test(wsp) ) { // If a scheme is already present, honor it.
					OSApp.currentSession.weatherServerUrl = wsp.replace(/\/+$/, "");
				} else { // Default to HTTPS for custom WSP.to be consistent with firmware
					OSApp.currentSession.weatherServerUrl = ("https://" + wsp).replace(/\/+$/, "");
				}
			} else {
				OSApp.currentSession.weatherServerUrl = OSApp.currentSession.prefix + wsp;
			}
		} else {
			OSApp.currentSession.weatherServerUrl = OSApp.Constants.weather.DEFAULT_WEATHER_SERVER_URL;
		}
		OSApp.Weather.updateWeather();
	};

	if ( OSApp.currentSession.controller?.settings?.wsp ) {
		if ( OSApp.currentSession.controller.settings.wsp === "weather.opensprinkler.com" ) {
			finish();
			return;
		}

		finish( OSApp.currentSession.controller?.settings?.wsp );
		return;
	}

	return $.get( OSApp.currentSession.prefix + OSApp.currentSession.ip + "/su" ).then( function( reply ) {
		if ( sessionGeneration !== ( OSApp.currentSession.generation || 0 ) ) {
			return $.Deferred().reject( { status: 0, statusText: "stale-session" } ).promise();
		}
		var wsp = reply.match( /value="([\w|:|/|.]+)" name=wsp/ );
		finish( wsp ? wsp[ 1 ] : undefined );
	}, function() {
		finish();
	} );
};

OSApp.Weather.updateWeatherBox = function() {
	if (!OSApp.currentSession.weather || !OSApp.currentSession.controller.settings) {
		// Exit early if we don't have weather data or controller settings
		return;
	}

	var description = OSApp.Utils.htmlEscape( OSApp.currentSession.weather.description || "" ),
		icon = OSApp.Weather.safeIcon( OSApp.currentSession.weather.icon ),
		alert = OSApp.currentSession.weather.alert && typeof OSApp.currentSession.weather.alert === "object" &&
			!Array.isArray( OSApp.currentSession.weather.alert ) ? OSApp.currentSession.weather.alert : null,
		alertType = alert ? OSApp.Utils.htmlEscape( alert.type || "" ) : "";

	$( "#weather" )
		.html(
			/*( OSApp.currentSession.controller.settings.rd ? "<div class='rain-delay blue'><span class='icon ui-icon-alert'></span>Rain Delay<span class='time'>" + OSApp.Dates.dateToString( new Date( OSApp.currentSession.controller.settings.rdst * 1000 ), undefined, true ) + "</span></div>" : "" ) +*/
			"<div title='" + description + "' class='wicon'><img src='https://openweathermap.org/img/w/" + icon + ".png'></div>" +
			"<div class='inline tight'>" + OSApp.Weather.formatTemp( OSApp.currentSession.weather.temp ) + "</div><br><div class='inline location tight'>" + OSApp.Language._( "Current Weather" ) + "</div>" +
			( alert ? "<div><button class='tight help-icon btn-no-border ui-btn ui-icon-alert ui-btn-icon-notext ui-corner-all'></button>" + alertType + "</div>" : "" ) )
		.off( "click" ).on( "click", function( ) {
			/*var target = $( event.target );
			if ( target.hasClass( "rain-delay" ) || target.parents( ".rain-delay" ).length ) {
				OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to turn off rain delay?" ), "", function() {
					OSApp.UIDom.showLoading( "#weather" );
					OSApp.Firmware.sendToOS( "/cv?pw=&rd=0" ).done( function() {
						OSApp.Sites.updateController( OSApp.Weather.updateWeather );
					} );
				} );
			} else {*/
			OSApp.UIDom.changePage( "#forecast" );
			return false;
		} )
		.parents( ".info-card" ).removeClass( "noweather" );
};

OSApp.Weather.renderForecastPage = function( page ) {
	if ( !page || page.length === 0 ) {
		return;
	}

	var weather = OSApp.currentSession.weather,
		settings = OSApp.currentSession.controller && OSApp.currentSession.controller.settings ? OSApp.currentSession.controller.settings : {},
		weatherOptions = settings.wto && typeof settings.wto === "object" ? settings.wto : {},
		list = page.find( "ul.forecast-list" ),
		forecast = OSApp.Weather.makeForecast();

	if ( forecast ) {
		list.html( forecast );
	} else {
		list.empty().append( $( "<li data-icon='false' class='center'></li>" ).text( OSApp.Language._( "Weather data is unavailable" ) ) );
	}

	if ( list.hasClass( "ui-listview" ) ) {
		list.listview( "refresh" );
	}

	page.find( ".weatherAttribution" ).remove();
	page.find( ".ui-content" ).append( OSApp.Weather.makeAttribution(
		weatherOptions.provider || ( weather && ( weather.wp || weather.weatherProvider ) )
	) );

	page.find( ".alert" ).off( "click.weatherAlert" ).on( "click.weatherAlert", function() {
		var currentAlert = OSApp.currentSession.weather && OSApp.currentSession.weather.alert;
		if ( !currentAlert || typeof currentAlert !== "object" || Array.isArray( currentAlert ) ) {
			return false;
		}

		var alertPopup = $( "<div data-role='popup' data-theme='a'>" +
				"<div data-role='header' data-theme='b'>" +
					"<h1></h1>" +
				"</div>" +
				"<div class='ui-content'>" +
					"<span style='white-space: pre-wrap'></span>" +
				"</div>" +
			"</div>" );
		alertPopup.find( "h1" ).text( currentAlert.name || "" );
		alertPopup.find( "span" ).text( $.trim( currentAlert.message || "" ) );
		OSApp.UIDom.openPopup( alertPopup );
		return false;
	} );
};

OSApp.Weather.showForecast = function() {
	var page = $( "<div data-role='page' id='forecast'>" +
			"<div class='ui-content' role='main'>" +
				"<ul class='forecast-list' data-role='listview' data-inset='true'></ul>" +
			"</div>" +
		"</div>" );

	OSApp.Weather.renderForecastPage( page );

	OSApp.UIDom.changeHeader( {
		title: OSApp.Language._( "Forecast" ),
		leftBtn: {
			icon: "carat-l",
			text: OSApp.Language._( "Back" ),
			class: "ui-toolbar-back-btn",
			on: OSApp.UIDom.goBack
		},
		rightBtn: {
			icon: "refresh",
			text: OSApp.Language._( "Refresh" ),
			on: function() {
				$.mobile.loading( "show" );
				$.mobile.document.off( "weatherUpdateComplete.forecastRefresh" ).one( "weatherUpdateComplete.forecastRefresh", function( event, success ) {
					$.mobile.loading( "hide" );
					if ( success && page.hasClass( "ui-page-active" ) && page.parent().length ) {
						OSApp.Weather.renderForecastPage( page );
					}
				} );
				OSApp.Weather.updateWeather( true );
			}
		}
	} );

	page.one( "pagehide", function() {
		page.remove();
	} );

	$( "#forecast" ).remove();
	$.mobile.pageContainer.append( page );
};

OSApp.Weather.makeForecast = function() {
	var weather = OSApp.currentSession.weather,
		settings = OSApp.currentSession.controller && OSApp.currentSession.controller.settings,
		list = "",
		sunTimes,
		sunrise,
		sunset,
		i, date, displayDate, times;

	if ( !weather || typeof weather !== "object" || !settings || !Array.isArray( weather.forecast ) ) {
		return "";
	}

	if ( Number.isFinite( Number( settings.sunrise ) ) && Number.isFinite( Number( settings.sunset ) ) &&
		Number( settings.sunrise ) > 0 && Number( settings.sunset ) > 0 ) {
		sunrise = Number( settings.sunrise );
		sunset = Number( settings.sunset );
	} else {
		try {
			sunTimes = OSApp.Weather.getSunTimes();
			sunrise = sunTimes[ 0 ];
			sunset = sunTimes[ 1 ];
		} catch {
			sunrise = 0;
			sunset = 0;
		}
	}

	var description = OSApp.Utils.htmlEscape( weather.description || "" ),
		icon = OSApp.Weather.safeIcon( weather.icon );

	list += "<li data-icon='false' class='center'>" +
		"<div>" + OSApp.Language._( "Now" ) + "</div><br>" +
		"<div title='" + description + "' class='wicon'><img src='https://openweathermap.org/img/w/" + icon + ".png'></div>" +
		"<span>" + OSApp.Weather.formatTemp( weather.temp ) + "</span><br>" +
		"<span>" + OSApp.Language._( "Sunrise" ) + "</span><span>: " + OSApp.Dates.minutesToTime( sunrise ) + "</span> " +
		"<span>" + OSApp.Language._( "Sunset" ) + "</span><span>: " + OSApp.Dates.minutesToTime( sunset ) + "</span><br>" +
		"<span>" + OSApp.Language._( "Forecasted Rain" ) + "</span><span>: " + OSApp.Weather.formatPrecip( weather.precip ) + "</span>" +
		"</li>";

	for ( i = 1; i < weather.forecast.length; i++ ) {
		var entry = weather.forecast[ i ];
		if ( !entry || typeof entry !== "object" || !Number.isFinite( Number( entry.date ) ) ) {
			continue;
		}

		date = new Date( Number( entry.date ) * 1000 );
		displayDate = OSApp.Dates.controllerDateFromUnix( Number( entry.date ) );
		try {
			times = OSApp.Weather.getSunTimes( date );
		} catch {
			times = [ 0, 0 ];
		}
		description = OSApp.Utils.htmlEscape( entry.description || "" );
		icon = OSApp.Weather.safeIcon( entry.icon );

		sunrise = times[ 0 ];
		sunset = times[ 1 ];

		list += "<li data-icon='false' class='center'>" +
				"<div>" + OSApp.Dates.dateOnly( displayDate ) + "</div><br>" +
				"<div title='" + description + "' class='wicon'><img src='https://openweathermap.org/img/w/" + icon + ".png'></div>" +
				"<span>" + OSApp.Dates.getDayName( displayDate, "short" ) + "</span><br>" +
				"<span>" + OSApp.Language._( "Low" ) + "</span><span>: " + OSApp.Weather.formatTemp( entry.temp_min ) + "  </span>" +
				"<span>" + OSApp.Language._( "High" ) + "</span><span>: " + OSApp.Weather.formatTemp( entry.temp_max ) + "</span><br>" +
				"<span>" + OSApp.Language._( "Sunrise" ) + "</span><span>: " + OSApp.Dates.minutesToTime( sunrise ) + "</span> " +
				"<span>" + OSApp.Language._( "Sunset" ) + "</span><span>: " + OSApp.Dates.minutesToTime( sunset ) + "</span><br>";
				if ( typeof entry.precip !== "undefined") {
					list += "<span>" + OSApp.Language._( "Forecasted Rain" ) + "</span><span>: " + OSApp.Weather.formatPrecip( entry.precip ) + "</span>";
				}
		list += "</li>";
	}

	return list;
};

OSApp.Weather.makeAttribution = function( provider ) {
	if ( typeof provider !== "string" ) { return ""; }

	var attrib = "<div class='weatherAttribution'>";
	switch ( provider ) {
		case "Apple":
			attrib += OSApp.Language._( "Powered by Apple" );
			break;
		case "DarkSky":
		case "DS":
			attrib += "<a href='https://darksky.net/poweredby/' target='_blank'>" + OSApp.Language._( "Powered by Dark Sky" ) + "</a>";
			break;
		case "OWM":
			attrib += "<a href='https://openweathermap.org/' target='_blank'>" + OSApp.Language._( "Powered by OpenWeather" ) + "</a>";
			break;
		case "DWD":
			attrib += "<a href='https://brightsky.dev/' target='_blank'>" + OSApp.Language._( "Powered by Bright Sky+DWD" ) + "</a>";
			break;
		case "OpenMeteo":
		case "OM":
			attrib += "<a href='https://open-meteo.com/' target='_blank'>" + OSApp.Language._( "Powered by Open Meteo" ) + "</a>";
			break;
		case "WUnderground":
		case "WU":
			attrib += "<a href='https://wunderground.com/' target='_blank'>" + OSApp.Language._( "Powered by Weather Underground" ) + "</a>";
			break;
		case "PirateWeather":
		case "PW":
			attrib += "<a href='https://pirateweather.net/' target='_blank'>" + OSApp.Language._("Powered by PirateWeather" ) + "</a>";
			break;
		case "AccuWeather":
		case "AW":
			attrib += "<a href='https://www.accuweather.com/' target='_blank'>" + OSApp.Language._("Powered by AccuWeather" ) + "</a>";
			break;
		case "local":
			attrib += OSApp.Language._( "Powered by your Local PWS" );
			break;
		case "Manual":
			attrib += OSApp.Language._( "Using manual weather adjustment" );
			break;
		default:
			attrib += OSApp.Language._( "Unrecognised weather provider" );
			break;
	}
	return attrib + "</div>";
};

OSApp.Weather.getSunTimes = function( date ) {
	date = date || new Date( OSApp.currentSession.controller.settings.devt * 1000 );

	var times = SunCalc.getTimes( date, OSApp.currentSession.coordinates[ 0 ], OSApp.currentSession.coordinates[ 1 ] ),
		sunrise = times.sunrise,
		sunset = times.sunset,
		tzOffset = OSApp.Dates.getTimezoneOffsetOS();

	sunrise.setUTCMinutes( sunrise.getUTCMinutes() + tzOffset );
	sunset.setUTCMinutes( sunset.getUTCMinutes() + tzOffset );

	sunrise = ( sunrise.getUTCHours() * 60 + sunrise.getUTCMinutes() );
	sunset = ( sunset.getUTCHours() * 60 + sunset.getUTCMinutes() );

	return [ sunrise, sunset ];
};

OSApp.Weather.showRainDelay = function() {
	$( ".ui-popup-active" ).find( "[data-role='popup']" ).popup( "close" );

	OSApp.UIDom.showDurationBox( {
		title: OSApp.Language._( "Change Rain Delay" ),
		callback: OSApp.Weather.setRainDelay,
		label: OSApp.Language._( "Duration" ),
		maximum: 31536000,
		granularity: 2,
		preventCompression: true,
		incrementalUpdate: false,
		updateOnChange: false,
		helptext:
			OSApp.Language._( "Enable manual rain delay by entering a value into the input below. To turn off a currently enabled rain delay use a value of 0." )
	} );
};

OSApp.Weather.getWeatherProviderById = function( id ) {
	const providers = OSApp.Constants.weather.PROVIDERS;
	if(typeof id === "number"){
		return providers[id];
	}
	for(let provider of providers){
		if(provider.id === id){
			return provider;
		}
	}
	return false;
};

OSApp.Weather.getCurrentWeatherProvider = function() {
	const provider = OSApp.Weather.getWeatherProviderById(OSApp.currentSession.controller.settings.wto.provider);
	if(provider)
		return provider;

	return false;
};

OSApp.Weather.testAPIKey = function( key, provider, callback ) {
	callback = callback || function() {};
	key = typeof key === "string" ? key : "";
	let url,
		invalid = function() {
			callback( false );
			return $.Deferred().reject( { status:0, statusText:"invalid-provider" } ).promise();
		};
	if ( key.length < 1 || key.length > 4096 ) return invalid();

	switch(provider) {
		case "AW":
			url = "https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?q=42,-75&apikey=" + encodeURIComponent( key );
			break;
		case "PW":
			url = "https://api.pirateweather.net/forecast/" + encodeURIComponent( key ) + "/42,-75?&exclude=minutely,hourly,daily,alerts";
			break;
		case "OWM":
			url = "https://api.openweathermap.org/data/3.0/onecall?lat=42&lon=-75&exclude=minutely,hourly,daily,alerts&appid=" + encodeURIComponent( key );
			break;
		case "WU":
			url = "https://api.weather.com/v2/pws/observations/current?stationId=KMAHANOV10&format=json&units=m&apiKey=" + encodeURIComponent( key );
			break;
		default:
			return invalid();
	}

	return $.ajax( {
		url: url,
		cache: true
	} ).done( function( data ) {
		if ( !data || typeof data !== "object" || data.errors ) {
			callback( false );
			return;
		}
		callback( true );
	} ).fail( function() {
		callback( false );
	} );
};

OSApp.Weather.getWeatherError = function( err ) {
	var errType = Math.floor( err / 10 );

	if ( err in OSApp.Weather.Constants.weatherErrors ) {
		return OSApp.Weather.Constants.weatherErrors[ err ];
	} else if ( err <= 59 && err >= 10 && errType in OSApp.Weather.Constants.weatherErrors ) {
		return OSApp.Weather.Constants.weatherErrors[ errType ];
	}

	return OSApp.Language._( "Unrecognised" ) + " (" + err + ")";
};

OSApp.Weather.getWeatherStatus = function( status ) {
	if ( status < 0 ) {
		return "<font class='debugWUError'>" + OSApp.Language._( "Offline" ) + "</font>";
	} else if ( status > 0 ) {
		return "<font class='debugWUError'>" + OSApp.Language._( "Error" ) + "</font>";
	} else {
		return "<font class='debugWUOK'>" + OSApp.Language._( "Online" ) + "</font>";
	}
};

/** Returns the adjustment method for the corresponding ID, or a list of all methods if no ID is specified. */
OSApp.Weather.getAdjustmentMethod = function( id ) {
    if ( id === undefined ) {

		// FIXME: this is awkward. Refactor callers to use the Weather.Constants.adjustmentMethods array directly so they can apply localization
        return OSApp.Weather.Constants.adjustmentMethods;
    }

	return OSApp.Language._( OSApp.Weather.Constants.adjustmentMethods[ id & ~( 1 << 7 ) ] );
};

// TODO: does getAdjustmentMethod duplicate this logic? if so please refactor one or the other.
OSApp.Weather.getCurrentAdjustmentMethodId = function() {
	return OSApp.currentSession?.controller?.options?.uwt & ~( 1 << 7 );
};

OSApp.Weather.getRestriction = function( id ) {

	// TODO: refactor these values to Weather.Constants.xxx
	return [ {
				isCurrent: 0,
				name: OSApp.Language._( "None" )
			},
			{
				isCurrent: ( ( OSApp.currentSession.controller.options.uwt >> 7 ) & 1 ) ? true : false,
				name: OSApp.Language._( "California Restriction" )
			} ][ id ];
};

OSApp.Weather.setRestriction = function( id, uwt ) {

	// TODO: refactor this to use Weather.Constants.xxx (see getRestriction)
	uwt = uwt || OSApp.currentSession.controller.options.uwt & ~( 1 << 7 );

	if ( id === 1 ) {
		uwt |= ( 1 << 7 );
	}

	return uwt;
};

OSApp.Weather.setRainDelay = function( delay ) {
	if ( typeof delay === "string" && delay.trim() === "" ) {
		return false;
	}
	delay = Number( delay );
	if ( !Number.isFinite( delay ) || !Number.isInteger( delay ) || delay < 0 || delay > 31536000 || delay % 3600 !== 0 ) {
		return false;
	}

	$.mobile.loading( "show" );
	OSApp.Firmware.sendToOS( "/cv?pw=&rd=" + ( delay / 3600 ) ).done( function() {
		$.mobile.loading( "hide" );
		OSApp.UIDom.showLoading( "#footer-running" );
		OSApp.Status.refreshStatus( OSApp.Weather.updateWeather );
		OSApp.Errors.showError( OSApp.Language._( "Rain delay has been successfully set" ) );
	} ).fail( OSApp.Firmware.settleLoadingFailure );

	return false;
};

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
OSApp.Dates = OSApp.Dates || {};

OSApp.Dates.Constants = {
	MIN_DATE: "01/01",
	MAX_DATE: "12/31",
	DATE_REGEX: /^\d{1,2}\/\d{1,2}$/,
	DATE_REGEX_YEAR: /^\d{1,2}\/\d{1,2}\/\d{4}$/,
	DISPLAY_DATE_REGEX: /^\d{2}\/\d{2}\/\d{4}$/
};

// TODO: mellodev some of this should refactor out to programs.js?

OSApp.Dates.getDateRange = function( pid ) {
	return OSApp.currentSession.controller.programs.pd[ pid ][ 6 ];
};

OSApp.Dates.isDateRangeEnabled = function( pid ) {
	if ( pid === "new" ) {
		return 0;
	}

	return OSApp.Dates.getDateRange( pid )[ 0 ];
};

OSApp.Dates.getDateRangeStart = function( pid ) {
	if ( pid === "new" ) {
		return OSApp.Dates.Constants.minEncodedDate;
	}

	return OSApp.Dates.getDateRange( pid )[ 1 ];
};

OSApp.Dates.getDateRangeEnd = function( pid ) {
	if ( pid === "new" ) {
		return OSApp.Dates.Constants.maxEncodedDate; //
	}

	return OSApp.Dates.getDateRange( pid )[ 2 ];
};

OSApp.Dates.extractDateFromString = function( inputString ) {
	if ( typeof inputString !== "string" ) {
		return false;
	}

	return inputString.match( OSApp.Dates.Constants.DATE_REGEX );
};

OSApp.Dates.extractDateFromStringYear = function( inputString ) {
	if ( typeof inputString !== "string" ) {
		return false;
	}

	return inputString.match( OSApp.Dates.Constants.DATE_REGEX_YEAR );
};

OSApp.Dates.isValidDateFormat = function( dateString ) {
	var dates = OSApp.Dates.extractDateFromString( dateString ),
		parts, month, day, date;

	if ( !dates ) {
		return false;
	}

	parts = dates[ 0 ].split( "/" );
	month = parseInt( parts[ 0 ], 10 );
	day = parseInt( parts[ 1 ], 10 );
	date = new Date( Date.UTC( 2000, month - 1, day ) );

	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

OSApp.Dates.isValidDateRange = function( startDate, endDate ) {
	return OSApp.Dates.isValidDateFormat( startDate ) && OSApp.Dates.isValidDateFormat( endDate );
};

OSApp.Dates.parseDisplayDate = function( dateString ) {
	if ( typeof dateString !== "string" || !OSApp.Dates.Constants.DISPLAY_DATE_REGEX.test( dateString ) ) {
		return null;
	}

	var parts = dateString.split( "/" ),
		month = Number( parts[ 0 ] ),
		day = Number( parts[ 1 ] ),
		year = Number( parts[ 2 ] ),
		date = new Date( Date.UTC( year, month - 1, day ) );

	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
};

OSApp.Dates.formatDateInput = function( value ) {
	var digits = String( value || "" ).replace( /\D/g, "" ).slice( 0, 8 );

	return digits.slice( 0, 2 ) + ( digits.length > 2 ? "/" + digits.slice( 2, 4 ) : "" ) +
		( digits.length > 4 ? "/" + digits.slice( 4 ) : "" );
};

OSApp.Dates.encodeDate = function( dateString ) {
	var dateValues = OSApp.Dates.extractDateFromString( dateString );
	if ( !dateValues ) {
		return -1;
	}
	var dateToEncode = dateValues[ 0 ].split( "/", 2 );

	var month = parseInt( dateToEncode[ 0 ], 10 ),
		day = parseInt( dateToEncode[ 1 ], 10 );

	if ( !OSApp.Dates.isValidDateFormat( dateString ) ) {
		return -1;
	}

	return ( month << 5 ) + day;
};

OSApp.Dates.Constants.minEncodedDate = OSApp.Dates.encodeDate( OSApp.Dates.Constants.MIN_DATE );
OSApp.Dates.Constants.maxEncodedDate = OSApp.Dates.encodeDate( OSApp.Dates.Constants.MAX_DATE );

OSApp.Dates.decodeDate = function( dateValue ) {
	var dateString = [],
		monthValue, dayValue;
	if ( OSApp.Dates.Constants.minEncodedDate <= dateValue && dateValue <= OSApp.Dates.Constants.maxEncodedDate ) {
		monthValue = dateValue >> 5;
		dayValue = dateValue % 32;
		dateString.push(
			monthValue / 10 >> 0,
			monthValue % 10,
			"/",
			dayValue / 10 >> 0,
			dayValue % 10
		);
		return dateString.join( "" );
	} else if ( dateValue < OSApp.Dates.Constants.minEncodedDate ) { // Sanitize
		return OSApp.Dates.Constants.MIN_DATE;
	} else {
		return OSApp.Dates.Constants.MAX_DATE;
	}
};

OSApp.Dates.getTimezoneOffsetOS = function() {
	var options = OSApp.currentSession && OSApp.currentSession.controller && OSApp.currentSession.controller.options,
		tz = options ? Number( options.tz ) : NaN;

	// The controller stores timezone offsets in 15-minute units, biased by 48.
	return Number.isFinite( tz ) ? ( tz - 48 ) * 15 : 0;
};

OSApp.Dates.parseTimezoneOffset = function( value ) {
	var match = /^([+-])(\d{2}):(\d{2})$/.exec( String( value || "" ) );
	if ( !match ) return undefined;

	var hours = Number( match[ 2 ] ),
		minutes = Number( match[ 3 ] ),
		offset = hours * 60 + minutes;
	if ( minutes > 59 || minutes % 15 !== 0 || offset > 15 * 60 ||
		( match[ 1 ] === "-" && offset > 12 * 60 ) ) {
		return undefined;
	}

	return match[ 1 ] === "-" ? -offset : offset;
};

OSApp.Dates.formatTimezoneOffset = function( offsetMinutes ) {
	offsetMinutes = Number( offsetMinutes );
	if ( !Number.isInteger( offsetMinutes ) || offsetMinutes % 15 !== 0 ||
		offsetMinutes < -12 * 60 || offsetMinutes > 15 * 60 ) {
		return undefined;
	}

	var absolute = Math.abs( offsetMinutes );
	return ( offsetMinutes < 0 ? "-" : "+" ) + OSApp.Utils.pad( Math.floor( absolute / 60 ) ) +
		":" + OSApp.Utils.pad( absolute % 60 );
};

// Convert a real Unix timestamp to a Date whose UTC fields represent the
// controller's wall clock. Reading UTC fields keeps display independent of the
// browser timezone and avoids applying daylight-saving rules from the browser.
OSApp.Dates.controllerDateFromUnix = function( epochSeconds ) {
	var seconds = Number( epochSeconds );

	if ( !Number.isFinite( seconds ) ) {
		return new Date( NaN );
	}

	return new Date( ( seconds + OSApp.Dates.getTimezoneOffsetOS() * 60 ) * 1000 );
};

OSApp.Dates.currentControllerDate = function() {
	return OSApp.Dates.controllerDateFromUnix( Date.now() / 1000 );
};

// Credit Stacktrace
// https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site/23259289#23259289
OSApp.Dates.humaniseDuration = function( base, relative ) {
	var seconds = Math.floor( ( relative - base ) / 1000 ),
		isFuture = ( seconds > 0 ) ? true : false,
		intervalType;

	seconds = Math.abs( seconds );
	if ( seconds < 10 ) {
		return OSApp.Language._( "Just Now" );
	}

	var interval = Math.floor( seconds / 31536000 );
	if ( interval >= 1 ) {
		intervalType = ( interval > 1 ) ? OSApp.Language._( "years" ) : OSApp.Language._( "year" );
	} else {
		interval = Math.floor( seconds / 2592000 );
		if ( interval >= 1 ) {
			intervalType = ( interval > 1 ) ? OSApp.Language._( "months" ) : OSApp.Language._( "month" );
		} else {
			interval = Math.floor( seconds / 86400 );
			if ( interval >= 1 ) {
				intervalType = ( interval > 1 ) ? OSApp.Language._( "days" ) : OSApp.Language._( "day" );
			} else {
				interval = Math.floor( seconds / 3600 );
				if ( interval >= 1 ) {
					intervalType = ( interval > 1 ) ? OSApp.Language._( "hours" ) : OSApp.Language._( "hour" );
				} else {
					interval = Math.floor( seconds / 60 );
					if ( interval >= 1 ) {
						intervalType = ( interval > 1 ) ? OSApp.Language._( "minutes" ) : OSApp.Language._( "minute" );
					} else {
						interval = seconds;
						intervalType = ( interval > 1 ) ? OSApp.Language._( "seconds" ) : OSApp.Language._( "second" );
					}
				}
			}
		}
	}

	if ( isFuture ) {
		return OSApp.Language._( "In" ) + " " + interval + " " + intervalType;
	} else {
		return interval + " " + intervalType + " " + OSApp.Language._( "ago" );
	}
};

OSApp.Dates.format12Hour = function( hours, minutes, seconds ) {
	hours = ( Number( hours ) % 24 + 24 ) % 24;
	minutes = Number( minutes );

	var period = hours >= 12 ? "PM" : "AM",
		displayHour = hours % 12 || 12,
		result = displayHour + ":" + OSApp.Utils.pad( minutes );

	if ( seconds !== undefined ) {
		result += ":" + OSApp.Utils.pad( Number( seconds ) );
	}

	return result + " " + period;
};

OSApp.Dates.formatDisplayYear = function( year ) {
	var value = Number( year ),
		sign = value < 0 ? "-" : "",
		result = String( Math.abs( value ) );

	if ( !Number.isSafeInteger( value ) ) return String( year );
	while ( result.length < 4 ) result = "0" + result;
	return sign + result;
};

OSApp.Dates.dateOnly = function( date, toUTC ) {
	if ( !date || !Number.isFinite( date.getTime() ) ) {
		return "--";
	}

	var prefix = toUTC === false ? "get" : "getUTC";

	return OSApp.Utils.pad( date[ prefix + "Month" ]() + 1 ) + "/" +
		OSApp.Utils.pad( date[ prefix + "Date" ]() ) + "/" +
		OSApp.Dates.formatDisplayYear( date[ prefix + "FullYear" ]() );
};

OSApp.Dates.timeToString = function( date, toUTC, includeSeconds ) {
	if ( !date || !Number.isFinite( date.getTime() ) ) {
		return "--";
	}

	var prefix = toUTC === false ? "get" : "getUTC",
		hours = date[ prefix + "Hours" ](),
		minutes = date[ prefix + "Minutes" ](),
		seconds = includeSeconds === false ? undefined : date[ prefix + "Seconds" ]();

	if ( OSApp.uiState && OSApp.uiState.is24Hour ) {
		return OSApp.Utils.pad( hours ) + ":" + OSApp.Utils.pad( minutes ) +
			( seconds === undefined ? "" : ":" + OSApp.Utils.pad( seconds ) );
	}

	return OSApp.Dates.format12Hour( hours, minutes, seconds );
};

OSApp.Dates.dateTimeNoSeconds = function( date, toUTC ) {
	var dateText = OSApp.Dates.dateOnly( date, toUTC ),
		timeText = OSApp.Dates.timeToString( date, toUTC, false );

	return dateText === "--" || timeText === "--" ? "--" : dateText + " " + timeText;
};

OSApp.Dates.dateToString = function( date, toUTC ) {
	var dateText = OSApp.Dates.dateOnly( date, toUTC ),
		timeText = OSApp.Dates.timeToString( date, toUTC, true );

	return dateText === "--" || timeText === "--" ? "--" : dateText + " " + timeText;
};

OSApp.Dates.minutesToTime = function( minutes ) {
	minutes = Number( minutes );
	if ( OSApp.uiState && OSApp.uiState.is24Hour ) {
		return OSApp.Utils.pad( Math.floor( minutes / 60 ) % 24 ) + ":" + OSApp.Utils.pad( minutes % 60 );
	}
	return OSApp.Dates.format12Hour( Math.floor( minutes / 60 ), minutes % 60 );
};

// Return day of the week
OSApp.Dates.getDayName = function( day, type, toUTC ) {
	var ldays = [ OSApp.Language._( "Sunday" ), OSApp.Language._( "Monday" ), OSApp.Language._( "Tuesday" ), OSApp.Language._( "Wednesday" ), OSApp.Language._( "Thursday" ), OSApp.Language._( "Friday" ), OSApp.Language._( "Saturday" ) ],
		sdays = [ OSApp.Language._( "Sun" ), OSApp.Language._( "Mon" ), OSApp.Language._( "Tue" ), OSApp.Language._( "Wed" ), OSApp.Language._( "Thu" ), OSApp.Language._( "Fri" ), OSApp.Language._( "Sat" ) ];

	if ( type === "short" ) {
		return sdays[ toUTC === false ? day.getDay() : day.getUTCDay() ];
	} else {
		return ldays[ toUTC === false ? day.getDay() : day.getUTCDay() ];
	}
};

OSApp.Dates.getDurationText = function( time ) {
	if ( time === 65535 ) {
		return OSApp.Language._( "Sunset to Sunrise" );
	} else if ( time === 65534 ) {
		return OSApp.Language._( "Sunrise to Sunset" );
	} else {
		return OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( time ) );
	}
};

// Convert seconds into (HH:)MM:SS format. HH is only reported if greater than 0.
OSApp.Dates.sec2hms = function( diff ) {
	var str = "";
	var hours = Math.max( 0, parseInt( diff / 3600 ) );
	var minutes = Math.max( 0, parseInt( diff / 60 ) % 60 );
	var seconds = diff % 60;
	if ( hours ) {
		str += OSApp.Utils.pad( hours ) + ":";
	}
	return str + OSApp.Utils.pad( minutes ) + ":" + OSApp.Utils.pad( seconds );
};

// Convert seconds into array of days, hours, minutes and seconds.
OSApp.Dates.sec2dhms = function( diff ) {
	var isNegative = ( diff < 0 ) ? -1 : 1;
	diff = Math.abs( diff );
	return {
		"days": Math.max( 0, parseInt( diff / 86400 ) ) * isNegative,
		"hours": Math.max( 0, parseInt( diff % 86400 / 3600 ) ) * isNegative,
		"minutes": Math.max( 0, parseInt( ( diff % 86400 ) % 3600 / 60 ) ) * isNegative,
		"seconds": Math.max( 0, parseInt( ( diff % 86400 ) % 3600 % 60 ) ) * isNegative
	};
};

OSApp.Dates.dhms2str = function( arr ) {
	var str = "";
	if ( arr.days ) {
		str += arr.days + OSApp.Language._( "d" ) + " ";
	}
	if ( arr.hours ) {
		str += arr.hours + OSApp.Language._( "h" ) + " ";
	}
	if ( arr.minutes ) {
		str += arr.minutes + OSApp.Language._( "m" ) + " ";
	}
	if ( arr.seconds ) {
		str += arr.seconds + OSApp.Language._( "s" ) + " ";
	}
	if ( str === "" ) {
		str = "0" + OSApp.Language._( "s" );
	}
	return str.trim();
};

// Convert days, hours, minutes and seconds array into seconds (int).
OSApp.Dates.dhms2sec = function( arr ) {
	return parseInt( ( arr.days * 86400 ) + ( arr.hours * 3600 ) + ( arr.minutes * 60 ) + arr.seconds );
};

OSApp.Dates.dateToEpoch = function( dateString ) {
	//return epoch days from date
	var dateValues = OSApp.Dates.extractDateFromStringYear( dateString );
	if ( !dateValues ) {
		return -1;
	}

	dateValues = dateValues[ 0 ].split( "/" );
	var year = parseInt( dateValues[ 2 ], 10 ),
		month = parseInt( dateValues[ 0 ], 10 ),
		day = parseInt( dateValues[ 1 ], 10 ),
		date = new Date( Date.UTC( year, month - 1, day ) );

	if ( date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ) {
		return -1;
	}

	return Math.floor( date.getTime() / ( 1000 * 86400 ) );
};

OSApp.Dates.epochToDate = function( epochTime ) {
	//return a date string from an epoch time in days
	var date = new Date(epochTime * (1000 * 86400) );

	return OSApp.Utils.pad( date.getUTCMonth() + 1 ) + "/" + OSApp.Utils.pad( date.getUTCDate() ) + "/" + date.getUTCFullYear();
};

OSApp.Dates.isLastDayOfMonth = function( month, year, day ) {
	// Create a new Date object, setting the day to 0 (the last day of the previous month)
	return new Date(year, month + 1, 0).getDate() === day;
};

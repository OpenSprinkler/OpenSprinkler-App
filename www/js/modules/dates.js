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
	DATE_REGEX: /[0-9]{1,2}[/][0-9]{1,2}/g
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
	return inputString.match( OSApp.Dates.Constants.DATE_REGEX );
};

OSApp.Dates.isValidDateFormat = function( dateString ) {
	var dates = OSApp.Dates.extractDateFromString( dateString );

	return dates !== null;
};

OSApp.Dates.isValidDateRange = function( startDate, endDate ) {
	return OSApp.Dates.isValidDateFormat( startDate ) && OSApp.Dates.isValidDateFormat( endDate );
};

OSApp.Dates.encodeDate = function( dateString ) {
	var dateValues = OSApp.Dates.extractDateFromString( dateString );
	if ( dateValues === null ) {
		return -1;
	}
	var dateToEncode = dateValues[ 0 ].split( "/", 2 );

	var month = parseInt( dateToEncode[ 0 ] ),
		day = parseInt( dateToEncode[ 1 ] );

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
	var tz = OSApp.currentSession.controller.options.tz - 48,
		sign = tz >= 0 ? 1 : -1;

	tz = ( ( Math.abs( tz ) / 4 >> 0 ) * 60 ) + ( ( Math.abs( tz ) % 4 ) * 15 / 10 >> 0 ) + ( ( Math.abs( tz ) % 4 ) * 15 % 10 );
	return tz * sign;
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

OSApp.Dates.dateToString = function( date, toUTC, shorten ) {
	var dayNames = [ OSApp.Language._( "Sun" ), OSApp.Language._( "Mon" ), OSApp.Language._( "Tue" ),
					OSApp.Language._( "Wed" ), OSApp.Language._( "Thu" ), OSApp.Language._( "Fri" ), OSApp.Language._( "Sat" ) ],
		monthNames = [ OSApp.Language._( "Jan" ), OSApp.Language._( "Feb" ), OSApp.Language._( "Mar" ), OSApp.Language._( "Apr" ), OSApp.Language._( "May" ), OSApp.Language._( "Jun" ),
					OSApp.Language._( "Jul" ), OSApp.Language._( "Aug" ), OSApp.Language._( "Sep" ), OSApp.Language._( "Oct" ), OSApp.Language._( "Nov" ), OSApp.Language._( "Dec" ) ];

	if ( date.getTime() === 0 ) {
		return "--";
	}

	if ( toUTC !== false ) {
		date.setMinutes( date.getMinutes() + date.getTimezoneOffset() );
	}

	if ( OSApp.currentSession.lang === "de" ) {
		return OSApp.Utils.pad( date.getDate() ) + "." + OSApp.Utils.pad( date.getMonth() + 1 ) + "." +
				date.getFullYear() + " " + OSApp.Utils.pad( date.getHours() ) + ":" +
				OSApp.Utils.pad( date.getMinutes() ) + ":" + OSApp.Utils.pad( date.getSeconds() );
	} else {
		if ( shorten === 1 ) {
			return monthNames[ date.getMonth() ] + " " + OSApp.Utils.pad( date.getDate() ) + ", " +
					date.getFullYear() + " " + OSApp.Utils.pad( date.getHours() ) + ":" +
					OSApp.Utils.pad( date.getMinutes() ) + ":" + OSApp.Utils.pad( date.getSeconds() );
		} else if ( shorten === 2 ) {
			return monthNames[ date.getMonth() ] + " " + OSApp.Utils.pad( date.getDate() ) + ", " +
					OSApp.Utils.pad( date.getHours() ) + ":" + OSApp.Utils.pad( date.getMinutes() ) + ":" +
					OSApp.Utils.pad( date.getSeconds() );
		} else {
			return dayNames[ date.getDay() ] + ", " + OSApp.Utils.pad( date.getDate() ) + " " +
					monthNames[ date.getMonth() ] + " " + date.getFullYear() + " " +
					OSApp.Utils.pad( date.getHours() ) + ":" + OSApp.Utils.pad( date.getMinutes() ) + ":" +
					OSApp.Utils.pad( date.getSeconds() );
		}
	}
};

OSApp.Dates.minutesToTime = function( minutes ) {
	var period = minutes > 719 ? "PM" : "AM",
		hour = parseInt( minutes / 60 ) % 12;

	if ( hour === 0 ) {
		hour = 12;
	}

	return OSApp.uiState.is24Hour ? ( OSApp.Utils.pad( ( minutes / 60 >> 0 ) % 24 ) + ":" + OSApp.Utils.pad( minutes % 60 ) ) : ( hour + ":" + OSApp.Utils.pad( minutes % 60 ) + " " + period );
};

// Return day of the week
OSApp.Dates.getDayName = function( day, type ) {
	var ldays = [ OSApp.Language._( "Sunday" ), OSApp.Language._( "Monday" ), OSApp.Language._( "Tuesday" ), OSApp.Language._( "Wednesday" ), OSApp.Language._( "Thursday" ), OSApp.Language._( "Friday" ), OSApp.Language._( "Saturday" ) ],
		sdays = [ OSApp.Language._( "Sun" ), OSApp.Language._( "Mon" ), OSApp.Language._( "Tue" ), OSApp.Language._( "Wed" ), OSApp.Language._( "Thu" ), OSApp.Language._( "Fri" ), OSApp.Language._( "Sat" ) ];

	if ( type === "short" ) {
		return sdays[ day.getDay() ];
	} else {
		return ldays[ day.getDay() ];
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
	var hours = Math.max( 0, parseInt( diff / 3600 ) % 24 );
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

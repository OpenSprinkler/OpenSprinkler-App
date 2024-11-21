/* global htmlEscape, checkConfigured, $ */

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
	MIN_DATE: '01/01',
	MAX_DATE: '12/31',
	DATE_REGEX: /[0-9]{1,2}[\/][0-9]{1,2}/g,
};

// TODO: mellodev some of this should refactor out to programs.js?

OSApp.Dates.getDateRange = ( pid ) => {
	return OSApp.currentSession.controller.programs.pd[ pid ][ 6 ];
};

OSApp.Dates.isDateRangeEnabled = ( pid ) => {
	if ( pid === "new" ) {
		return 0;
	}

	return OSApp.Dates.getDateRange( pid )[ 0 ];
};

OSApp.Dates.getDateRangeStart = ( pid ) => {
	if ( pid === "new" ) {
		return minEncodedDate;
	}

	return OSApp.Dates.getDateRange( pid )[ 1 ];
};

OSApp.Dates.getDateRangeEnd = ( pid ) => {
	if ( pid === "new" ) {
		return OSApp.Dates.Constants.maxEncodedDate; //
	}

	return OSApp.Dates.getDateRange( pid )[ 2 ];
};

OSApp.Dates.extractDateFromString = ( inputString ) => {
	return inputString.match( OSApp.Dates.Constants.DATE_REGEX );
};

OSApp.Dates.isValidDateFormat = ( dateString ) => {
	var dates = OSApp.Dates.extractDateFromString( dateString );

	return dates !== null;
;}

OSApp.Dates.isValidDateRange = ( startDate, endDate ) => {
	return OSApp.Dates.isValidDateFormat( startDate ) && OSApp.Dates.isValidDateFormat( endDate );
}

OSApp.Dates.encodeDate = ( dateString ) => {
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

OSApp.Dates.decodeDate = ( dateValue ) => {
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
		return OSApp.Dates.Constants.MAX_DATE
	}
};

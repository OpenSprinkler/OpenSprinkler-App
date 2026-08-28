/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <http://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 */

var OSApp = OSApp || {};
OSApp.Bundles = OSApp.Bundles || {};

OSApp.Bundles.Constants = {
	DEFAULT_MEMBER_TYPE_MASK: 1,
	MAX_KNOWN_STATION_TYPE: 7,
	STAGGER_MS: 250
};

OSApp.Bundles.getBoardCount = function() {
	var stations = OSApp.currentSession.controller?.stations;
	if ( Array.isArray( stations?.stn_bnd ) ) {
		return stations.stn_bnd.length;
	}
	return Number( OSApp.currentSession.controller?.settings?.nbrd ) || 0;
};

OSApp.Bundles.encodeMembers = function( sids, boardCount ) {
	boardCount = typeof boardCount === "number" ? boardCount : OSApp.Bundles.getBoardCount();

	var bytes = [], bid;
	for ( bid = 0; bid < boardCount; bid++ ) {
		bytes.push( 0 );
	}

	( sids || [] ).forEach( function( sid ) {
		var board = ( sid / 8 ) >> 0;
		if ( Number.isInteger( sid ) && board >= 0 && board < boardCount ) {
			bytes[ board ] |= 1 << ( sid % 8 );
		}
	} );

	return bytes.map( function( value ) {
		return OSApp.Utils.pad( value.toString( 16 ) ).toUpperCase();
	} ).join( "" );
};

OSApp.Bundles.decodeMembers = function( encoded, boardCount ) {
	boardCount = typeof boardCount === "number" ? boardCount : OSApp.Bundles.getBoardCount();

	var members = [], bid, value, bit;
	if ( typeof encoded !== "string" ) {
		return members;
	}

	for ( bid = 0; bid < boardCount; bid++ ) {
		if ( encoded.substr( bid * 2, 2 ).length < 2 ) {
			continue;
		}
		value = parseInt( encoded.substr( bid * 2, 2 ), 16 );
		if ( isNaN( value ) ) {
			continue;
		}
		for ( bit = 0; bit < 8; bit++ ) {
			if ( value & ( 1 << bit ) ) {
				members.push( bid * 8 + bit );
			}
		}
	}
	return members;
};

OSApp.Bundles.normalizeBitmap = function( encoded, boardCount ) {
	return OSApp.Bundles.encodeMembers( OSApp.Bundles.decodeMembers( encoded, boardCount ), boardCount );
};

OSApp.Bundles.getMemberTypeMask = function() {
	var mask = Number( OSApp.currentSession.controller?.stations?.bmt );
	return Number.isInteger( mask ) && mask >= 0 ? mask : OSApp.Bundles.Constants.DEFAULT_MEMBER_TYPE_MASK;
};

OSApp.Bundles.memberTypeAllowed = function( type ) {
	type = Number( type );
	if ( !Number.isInteger( type ) || type < 0 || type > OSApp.Bundles.Constants.MAX_KNOWN_STATION_TYPE ) {
		return false;
	}
	return ( OSApp.Bundles.getMemberTypeMask() & ( 1 << type ) ) !== 0;
};

OSApp.Bundles.isLeader = function( sid ) {
	return OSApp.StationAttributes.getBundle( sid ) > 0;
};

OSApp.Bundles.isBundleApplied = function( sid ) {
	return OSApp.StationAttributes.getBundleApplied( sid ) > 0;
};

OSApp.Bundles.getMembers = function( leaderSid ) {
	var special = OSApp.currentSession.controller?.special;
	if ( !OSApp.Bundles.isLeader( leaderSid ) || typeof special !== "object" || special === null ||
		!Object.prototype.hasOwnProperty.call( special, leaderSid ) ) {
		return [];
	}
	return OSApp.Bundles.decodeMembers( special[ leaderSid ].sd );
};

OSApp.Bundles.getReferencingLeaders = function( sid ) {
	var leaders = [], stationCount = OSApp.currentSession.controller?.stations?.snames?.length || 0;
	for ( var leaderSid = 0; leaderSid < stationCount; leaderSid++ ) {
		if ( leaderSid !== sid && OSApp.Bundles.isLeader( leaderSid ) &&
			OSApp.Bundles.getMembers( leaderSid ).indexOf( sid ) !== -1 ) {
			leaders.push( leaderSid );
		}
	}
	return leaders;
};

OSApp.Bundles.getOwningLeaders = function( sid ) {
	return OSApp.Bundles.getReferencingLeaders( sid ).filter( function( leaderSid ) {
		return OSApp.Stations.isRunning( leaderSid );
	} );
};

OSApp.Bundles.hasDirectRun = function( sid ) {
	return OSApp.Stations.getPID( sid ) > 0;
};

OSApp.Bundles.isDerivedOnly = function( sid ) {
	return OSApp.Stations.isRunning( sid ) && OSApp.Bundles.isBundleApplied( sid ) && !OSApp.Bundles.hasDirectRun( sid );
};

OSApp.Bundles.memberEligibility = function( sid, leaderSid ) {
	if ( sid === leaderSid ) {
		return { selectable: false, note: OSApp.Language._( "this station" ) };
	}
	if ( OSApp.Stations.isMaster( sid ) ) {
		return { selectable: false, note: OSApp.Language._( "master" ) };
	}

	var type = OSApp.Stations.getSpecialType( sid );
	if ( typeof type === "undefined" ) {
		return { selectable: false, note: OSApp.Language._( "Special Station" ) };
	}
	if ( !OSApp.Bundles.memberTypeAllowed( type ) ) {
		return { selectable: false, note: OSApp.Stations.getSpecialTypeName( type ) };
	}
	if ( OSApp.Stations.isDisabled( sid ) ) {
		return { selectable: true, note: OSApp.Language._( "disabled" ) };
	}
	return { selectable: true, note: "" };
};

OSApp.Bundles.getEligibleMembers = function( members, leaderSid ) {
	return ( members || [] ).filter( function( sid ) {
		return OSApp.Bundles.memberEligibility( sid, leaderSid ).selectable && !OSApp.Stations.isDisabled( sid );
	} );
};

OSApp.Bundles.minimumDuration = function( eligibleMemberCount ) {
	return Math.ceil( eligibleMemberCount * OSApp.Bundles.Constants.STAGGER_MS / 1000 ) + 1;
};

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
OSApp.ImportExport = OSApp.ImportExport || {};

OSApp.ImportExport.limits = {
	maxImportCharacters: 8 * 1024 * 1024,
	maxTreeDepth: 12,
	maxTreeContainers: 10000,
	maxCollectionLength: 4096,
	maxPrograms: 255,
	maxBoards: 255,
	maxStations: 2040,
	maxStationNameLength: 128,
	maxProgramNameLength: 128,
	maxSettingStringLength: 4096,
	maxJsonSettingLength: 8192,
	maxSafeNumber: 9007199254740991
};

OSApp.ImportExport.activeOperation = null;
OSApp.ImportExport.operationSequence = 0;

OSApp.ImportExport.captureTarget = function() {
	return {
		generation: OSApp.currentSession.generation || 0,
		controller: OSApp.currentSession.controller,
		ip: OSApp.currentSession.ip,
		prefix: OSApp.currentSession.prefix,
		token: OSApp.currentSession.token,
		pass: OSApp.currentSession.pass,
		auth: OSApp.currentSession.auth,
		authUser: OSApp.currentSession.authUser,
		authPass: OSApp.currentSession.authPass
	};
};

OSApp.ImportExport.isTargetCurrent = function( target ) {
	return OSApp.ImportExport.isTargetSessionCurrent( target ) && target.controller === OSApp.currentSession.controller;
};

OSApp.ImportExport.isTargetSessionCurrent = function( target ) {
	return !!target && target.generation === ( OSApp.currentSession.generation || 0 ) && target.ip === OSApp.currentSession.ip &&
		target.prefix === OSApp.currentSession.prefix && target.token === OSApp.currentSession.token &&
		target.pass === OSApp.currentSession.pass && target.auth === OSApp.currentSession.auth &&
		target.authUser === OSApp.currentSession.authUser && target.authPass === OSApp.currentSession.authPass;
};

OSApp.ImportExport.isImportInProgress = function() {
	var active = OSApp.ImportExport.activeOperation;
	if ( !active || active.settled ) {
		return false;
	}

	// A site/session transition can occur outside the import promise chain. Release
	// ownership immediately instead of waiting for a request timeout.
	var targetCurrent = active.finalRefreshStarted ?
		OSApp.ImportExport.isTargetSessionCurrent( active.target ) : OSApp.ImportExport.isTargetCurrent( active.target );
	if ( !targetCurrent ) {
		if ( $.ajaxq && typeof $.ajaxq.abort === "function" ) {
			$.ajaxq.abort( "default" );
			$.ajaxq.abort( "change" );
		}
		OSApp.ImportExport.settleOperation( active );
		return false;
	}
	return true;
};

OSApp.ImportExport.beginOperation = function( target, mutationReceiver ) {
	var active = OSApp.ImportExport.activeOperation;
	if ( active && !active.settled ) {
		if ( OSApp.ImportExport.isTargetCurrent( active.target ) ) {
			return null;
		}
		try {
			if ( $.ajaxq && typeof $.ajaxq.abort === "function" ) {
				$.ajaxq.abort( "default" );
				$.ajaxq.abort( "change" );
			}
		} finally {
			OSApp.ImportExport.settleOperation( active );
		}
	}

	var restoreSendToOS,
		releaseMutationLease = OSApp.Firmware.acquireMutationLease( function( lease ) {
			restoreSendToOS = lease.sendToOS;
			if ( typeof mutationReceiver === "function" ) mutationReceiver( restoreSendToOS );
		} );
	if ( typeof releaseMutationLease !== "function" ) {
		return null;
	}

	var operation = {
		id: ++OSApp.ImportExport.operationSequence,
		target: target,
		settled: false,
		loaderOwned: true,
		finalRefreshStarted: false,
		releaseMutationLease: releaseMutationLease
	};
	OSApp.ImportExport.activeOperation = operation;
	try {
		if ( $.ajaxq && typeof $.ajaxq.abort === "function" ) {
			$.ajaxq.abort( "default" );
			$.ajaxq.abort( "change" );
		}
		OSApp.uiState.operationLoaderOwner = operation;
		$.mobile.loading( "show" );
	} catch ( error ) {
		OSApp.ImportExport.activeOperation = null;
		operation.settled = true;
		operation.loaderOwned = false;
		if ( OSApp.uiState.operationLoaderOwner === operation ) {
			OSApp.uiState.operationLoaderOwner = null;
		}
		operation.releaseMutationLease();
		operation.releaseMutationLease = null;
		throw error;
	}
	return operation;
};

OSApp.ImportExport.settleOperation = function( operation ) {
	if ( !operation || operation.settled ) {
		return false;
	}
	var ownsActiveOperation = OSApp.ImportExport.activeOperation === operation;
	operation.settled = true;
	if ( ownsActiveOperation ) {
		OSApp.ImportExport.activeOperation = null;
	}
	if ( typeof operation.releaseMutationLease === "function" ) {
		operation.releaseMutationLease();
		operation.releaseMutationLease = null;
	}
	if ( operation.loaderOwned && ownsActiveOperation && OSApp.uiState.operationLoaderOwner === operation ) {
		OSApp.uiState.operationLoaderOwner = null;
		$.mobile.loading( "hide" );
	}
	operation.loaderOwned = false;
	return true;
};

OSApp.ImportExport.getSensorAdjustmentParameter = function( program ) {
	var adjustment = program && program[ 7 ];
	if ( !adjustment || typeof adjustment !== "object" ) {
		return "";
	}

	var parts = [ adjustment.flag || 0, adjustment.uuid || 0 ];
	if ( Array.isArray( adjustment.splits ) ) {
		adjustment.splits.forEach( function( split ) {
			if ( split && Number.isFinite( split.x ) && Number.isFinite( split.y ) ) {
				parts.push( split.x, split.y );
			}
		} );
	}

	return "&snadj=" + parts.join( "," );
};

// Keep this aligned with MAX_SENSORS in the controller firmware.
OSApp.ImportExport.sensorLimit = 64;

OSApp.ImportExport.validateSensorDefinition = function( sensor ) {
	var isFiniteNumber = function( value ) {
			return typeof value === "number" && isFinite( value );
		},
		isInteger = function( value ) {
			return isFiniteNumber( value ) && Math.floor( value ) === value;
		},
		extra, lastX;

	if ( !OSApp.ImportExport.isPlainObject( sensor ) || !isInteger( sensor.uuid ) || sensor.uuid < 1 || sensor.uuid > 65535 ||
		typeof sensor.name !== "string" || sensor.name.length < 1 || sensor.name.length > 32 ||
		!isInteger( sensor.type ) || sensor.type < 0 || sensor.type > 4 ||
		!isInteger( sensor.interval ) || sensor.interval < 1 || !isInteger( sensor.unit ) || sensor.unit < 0 ||
		!isInteger( sensor.flag ) || sensor.flag < 0 || sensor.flag > 255 || !isFiniteNumber( sensor.min ) ||
		!isFiniteNumber( sensor.max ) || sensor.min > sensor.max || !OSApp.ImportExport.isPlainObject( sensor.extra ) ) {
		return false;
	}

	extra = sensor.extra;
	switch ( sensor.type ) {
		case 0:
			return isInteger( extra.action ) && extra.action >= 0 && extra.action < 6 && Array.isArray( extra.children ) &&
				extra.children.length <= 8 && extra.children.every( function( child ) {
					return OSApp.ImportExport.isPlainObject( child ) && isInteger( child.uuid ) && child.uuid >= 0 && child.uuid <= 65535 &&
						isFiniteNumber( child.scale ) && isFiniteNumber( child.offset );
				} ) && extra.children.map( function( child ) {
					return [ child.uuid, child.scale, child.offset ].join( "," );
				} ).join( ";" ).concat( ";" ).length < 320;
		case 1:
			if ( !isInteger( extra.pin ) || extra.pin < 1 || extra.pin > 16 || !isFiniteNumber( extra.scale ) ||
				!isFiniteNumber( extra.offset ) || !isInteger( extra.subtype ) ||
				!( extra.subtype === 0 || extra.subtype === 1 || extra.subtype >= 10 && extra.subtype <= 17 ) ) {
				return false;
			}
			if ( extra.subtype !== 1 ) {
				return true;
			}
			if ( !Array.isArray( extra.points ) || extra.points.length < 2 || extra.points.length > 8 ) {
				return false;
			}
			lastX = -Infinity;
			return extra.points.every( function( point ) {
				if ( !OSApp.ImportExport.isPlainObject( point ) || !isFiniteNumber( point.x ) ||
					!isFiniteNumber( point.y ) || point.x < lastX ) {
					return false;
				}
				lastX = point.x;
				return true;
			} ) && extra.points.map( function( point ) {
				return [ point.x, point.y ].join( "," );
			} ).join( "," ).length < 320;
		case 2:
			return isInteger( extra.action ) && extra.action >= 0;
		case 3:
			return isInteger( extra.metric ) && extra.metric >= 0;
		case 4:
			return isInteger( extra.input ) && extra.input >= 0 && extra.input < 4;
		default:
			return false;
	}
};

OSApp.ImportExport.normalizeSensorDescription = function( raw ) {
	var normalizeOption = function( option ) {
			if ( !option || typeof option !== "object" ) return {};
			var normalized = { id: option.id, label: option.l };
			if ( option.dfl ) normalized.defaults = option.dfl;
			if ( option.hd ) normalized.hides = option.hd;
			if ( option.lk ) normalized.locked = option.lk;
			if ( typeof option.ug === "number" ) normalized.unit_group = option.ug;
			return normalized;
		},
		normalizeArgument = function( argument, depth ) {
			if ( !argument || typeof argument !== "object" || depth > 8 ) return {};
			var normalized = { name: argument.n, arg: argument.a, type: argument.t };
			if ( Object.prototype.hasOwnProperty.call( argument, "d" ) ) normalized.default = argument.d;
			if ( Object.prototype.hasOwnProperty.call( argument, "h" ) ) normalized.hint = argument.h;
			if ( Object.prototype.hasOwnProperty.call( argument, "indicator" ) ) normalized.indicator = argument.indicator;
			if ( Array.isArray( argument.e ) ) {
				normalized.extra = argument.e.map( function( nested ) { return normalizeArgument( nested, depth + 1 ); } );
			}
			if ( Array.isArray( argument.o ) ) normalized.options = argument.o.map( normalizeOption );
			return normalized;
		},
		sensors = raw && Array.isArray( raw.sensors ) ? raw.sensors : [],
		units = raw && Array.isArray( raw.units ) ? raw.units : [],
		argumentsList = raw && Array.isArray( raw.as ) ? raw.as : [],
		flags = raw && Array.isArray( raw.flags ) ? raw.flags : [];

	return {
		sensors: sensors.map( function( sensor ) {
			if ( !sensor || typeof sensor !== "object" ) return {};
			var normalized = {
				name: sensor.n,
				args: Array.isArray( sensor.as ) ? sensor.as.map( function( argument ) {
					return normalizeArgument( argument, 0 );
				} ) : []
			};
			if ( Object.prototype.hasOwnProperty.call( sensor, "hwd" ) ) normalized.hardware_detected = !!sensor.hwd;
			if ( Object.prototype.hasOwnProperty.call( sensor, "dis" ) ) normalized.disabled = !!sensor.dis;
			return normalized;
		} ),
		units: units.filter( Array.isArray ).map( function( unit ) {
			return { value: unit[ 0 ], name: unit[ 1 ], short: unit[ 2 ], group: unit[ 3 ], index: unit[ 0 ] };
		} ),
		enums: raw && raw.enums && typeof raw.enums === "object" ? raw.enums : {},
		args: argumentsList.map( function( argument ) { return normalizeArgument( argument, 0 ); } ),
		flags: flags.map( function( flag ) {
			return { name: flag && flag.n, default: flag && flag.d };
		} )
	};
};

OSApp.ImportExport.sensorDefinitionSupported = function( sensor, description, targetSensors ) {
	if ( !description || !Array.isArray( description.sensors ) || !Array.isArray( description.units ) ) {
		return false;
	}

	var sensorDescription = description.sensors[ sensor.type ],
		existingSensor = Array.isArray( targetSensors ) && targetSensors.find( function( candidate ) {
			return Number( candidate.uuid ) === Number( sensor.uuid ) && Number( candidate.type ) === Number( sensor.type );
		} ),
		unitDescription = description.units.find( function( unit ) {
			return Number( unit.value ) === Number( sensor.unit );
		} );

	if ( !sensorDescription || sensorDescription.disabled && !existingSensor || !unitDescription ) {
		return false;
	}

	var extraKey = [ "action", "subtype", "action", "metric", "input" ][ sensor.type ],
		extraValue = sensor.extra[ extraKey ],
		findArgument = function( args, depth ) {
			var found;
			if ( !Array.isArray( args ) || depth > 8 ) return found;
			args.some( function( argument ) {
				if ( argument && argument.arg === extraKey ) {
					found = argument;
					return true;
				}
				found = findArgument( argument && argument.extra, depth + 1 );
				return !!found;
			} );
			return found;
		},
		argument = findArgument( sensorDescription.args, 0 ),
		selectedOption;

	if ( argument && Array.isArray( argument.options ) ) {
		selectedOption = argument.options.find( function( option ) {
			return Number( option.id ) === Number( extraValue );
		} );
		if ( !selectedOption || typeof selectedOption.unit_group === "number" &&
			Number( unitDescription.group ) !== selectedOption.unit_group ) {
			return false;
		}
	}

	if ( description.enums ) {
		var enumName = sensor.type === 0 ? "AggregateAction" : ( sensor.type === 2 ? "WeatherAction" : null );
		if ( enumName && Array.isArray( description.enums[ enumName ] ) &&
			sensor.extra.action >= description.enums[ enumName ].length ) {
			return false;
		}
	}

	return true;
};

OSApp.ImportExport.buildSensorImportCommand = function( sensor, targetUUID, includeAggregateChildren, remapUUID ) {
	var params = new URLSearchParams(),
		extra = sensor.extra;

	params.append( "pw", "" );
	params.append( "uuid", targetUUID );
	params.append( "type", sensor.type );
	params.append( "name", sensor.name );
	params.append( "min", sensor.min );
	params.append( "max", sensor.max );
	params.append( "interval", sensor.interval );
	params.append( "unit", sensor.unit );
	params.append( "flag", sensor.flag );

	switch ( sensor.type ) {
		case 0:
			params.append( "action", extra.action );
			if ( includeAggregateChildren ) {
				var children = extra.children.length > 0 ? extra.children : [ { uuid: 0, scale: 1, offset: 0 } ];
				params.append( "children", children.map( function( child ) {
					return [ remapUUID( child.uuid ), child.scale, child.offset ].join( "," );
				} ).join( ";" ) + ";" );
			}
			break;
		case 1:
			params.append( "pin", extra.pin );
			params.append( "scale", extra.scale );
			params.append( "offset", extra.offset );
			params.append( "subtype", extra.subtype );
			if ( extra.subtype === 1 ) {
				params.append( "points", extra.points.map( function( point ) {
					return [ point.x, point.y ].join( "," );
				} ).join( "," ) );
			}
			break;
		case 2:
			params.append( "action", extra.action );
			break;
		case 3:
			params.append( "metric", extra.metric );
			break;
		case 4:
			params.append( "input", extra.input );
			break;
	}

	return "/csn?" + params.toString();
};

OSApp.ImportExport.sensorDefinitionMatches = function( source, actual, remapUUID ) {
	if ( !actual || Number( actual.type ) !== Number( source.type ) || actual.name !== source.name ||
		Number( actual.interval ) !== Number( source.interval ) || Number( actual.unit ) !== Number( source.unit ) ||
		Number( actual.flag ) !== Number( source.flag ) || Number( actual.min ) !== Number( source.min ) ||
		Number( actual.max ) !== Number( source.max ) || !actual.extra || typeof actual.extra !== "object" ) {
		return false;
	}

	var sourceExtra = source.extra,
		actualExtra = actual.extra,
		equalPoints = function( sourcePoints, actualPoints ) {
			return Array.isArray( actualPoints ) && sourcePoints.length === actualPoints.length &&
				sourcePoints.every( function( point, index ) {
					return Number( point.x ) === Number( actualPoints[ index ].x ) &&
						Number( point.y ) === Number( actualPoints[ index ].y );
				} );
		};

	switch ( source.type ) {
		case 0:
			if ( Number( sourceExtra.action ) !== Number( actualExtra.action ) ||
				!Array.isArray( actualExtra.children ) || actualExtra.children.length !== 8 ) {
				return false;
			}
			return actualExtra.children.every( function( child, index ) {
				var expected = sourceExtra.children[ index ] || { uuid: 0, scale: 1, offset: 0 };
				return Number( child.uuid ) === Number( remapUUID( expected.uuid ) ) &&
					Number( child.scale ) === Number( expected.scale ) && Number( child.offset ) === Number( expected.offset );
			} );
		case 1:
			return Number( sourceExtra.pin ) === Number( actualExtra.pin ) &&
				Number( sourceExtra.scale ) === Number( actualExtra.scale ) &&
				Number( sourceExtra.offset ) === Number( actualExtra.offset ) &&
				Number( sourceExtra.subtype ) === Number( actualExtra.subtype ) &&
				( sourceExtra.subtype !== 1 || equalPoints( sourceExtra.points, actualExtra.points ) );
		case 2:
			return Number( sourceExtra.action ) === Number( actualExtra.action );
		case 3:
			return Number( sourceExtra.metric ) === Number( actualExtra.metric );
		case 4:
			return Number( sourceExtra.input ) === Number( actualExtra.input );
		default:
			return false;
	}
};

OSApp.ImportExport.createSensorRestorePlan = function( data, targetSensors, supportsSensors ) {
	var plan = {
			backupSensors: data.sensors && Array.isArray( data.sensors.sn ) ? data.sensors.sn : [],
			targetSensors: Array.isArray( targetSensors ) ? targetSensors : [],
			backupSensorUUIDs: Object.create( null ),
			activeSensorUUIDs: Object.create( null ),
			sensorUUIDMap: Object.create( null ),
			plannedDeletedSensorUUIDs: Object.create( null ),
			sensorsToDelete: [],
			error: ""
		},
		hasOwn = function( object, key ) {
			return Object.prototype.hasOwnProperty.call( object, key );
		},
		i, sensorKey;

	plan.resolveSensorUUID = function( uuid ) {
		var key = String( uuid ), numericUUID = Number( uuid );
		if ( !/^\d+$/.test( key ) || !Number.isInteger( numericUUID ) || numericUUID < 1 || numericUUID > 65535 ) {
			return 0;
		}
		if ( hasOwn( plan.sensorUUIDMap, key ) ) return plan.sensorUUIDMap[ key ];
		return hasOwn( plan.activeSensorUUIDs, key ) ? numericUUID : 0;
	};

	for ( i = 0; i < plan.targetSensors.length; i++ ) {
		sensorKey = String( plan.targetSensors[ i ] && plan.targetSensors[ i ].uuid );
		if ( /^\d+$/.test( sensorKey ) && Number( sensorKey ) > 0 && Number( sensorKey ) <= 65535 ) {
			plan.activeSensorUUIDs[ sensorKey ] = Number( sensorKey );
		}
	}

	if ( plan.backupSensors.length > 0 && !supportsSensors ) {
		plan.error = OSApp.Language._( "This backup contains sensor definitions that this controller does not support." );
		return plan;
	}

	for ( i = 0; i < plan.backupSensors.length; i++ ) {
		sensorKey = String( plan.backupSensors[ i ].uuid );
		plan.backupSensorUUIDs[ sensorKey ] = true;
		if ( hasOwn( plan.activeSensorUUIDs, sensorKey ) ) {
			plan.sensorUUIDMap[ sensorKey ] = Number( sensorKey );
		}
	}

	var aggregateChildUUIDs = Object.create( null );
	plan.backupSensors.forEach( function( sensor ) {
		if ( sensor.type === 0 ) {
			sensor.extra.children.forEach( function( child ) {
				if ( child.uuid ) aggregateChildUUIDs[ String( child.uuid ) ] = true;
			} );
		}
	} );

	var missingSensorCount = plan.backupSensors.filter( function( sensor ) {
			return !hasOwn( plan.activeSensorUUIDs, String( sensor.uuid ) );
		} ).length,
		targetOnlySensors = plan.targetSensors.filter( function( sensor ) {
			return !hasOwn( plan.backupSensorUUIDs, String( sensor.uuid ) );
		} ),
		targetOnlyAggregateParents = Object.create( null ),
		remainingDeletions = Math.max( 0,
			plan.targetSensors.length + missingSensorCount - OSApp.ImportExport.sensorLimit );

	targetOnlySensors.forEach( function( sensor ) {
		var parentKey = String( sensor.uuid );
		if ( sensor.type !== 0 || !sensor.extra || !Array.isArray( sensor.extra.children ) ) return;
		sensor.extra.children.forEach( function( child ) {
			var childKey = String( child.uuid );
			if ( !child.uuid || childKey === parentKey ) return;
			if ( !hasOwn( targetOnlyAggregateParents, childKey ) ) targetOnlyAggregateParents[ childKey ] = [];
			targetOnlyAggregateParents[ childKey ].push( parentKey );
		} );
	} );

	while ( remainingDeletions > 0 ) {
		var selectedInPass = false;
		for ( i = targetOnlySensors.length - 1; i >= 0 && remainingDeletions > 0; i-- ) {
			var candidate = targetOnlySensors[ i ], candidateKey = String( candidate.uuid );
			if ( hasOwn( plan.plannedDeletedSensorUUIDs, candidateKey ) || hasOwn( aggregateChildUUIDs, candidateKey ) ) continue;
			var parents = hasOwn( targetOnlyAggregateParents, candidateKey ) ? targetOnlyAggregateParents[ candidateKey ] : [];
			if ( parents.some( function( parentUUID ) {
				return !hasOwn( plan.plannedDeletedSensorUUIDs, parentUUID );
			} ) ) continue;
			plan.sensorsToDelete.push( candidate );
			plan.plannedDeletedSensorUUIDs[ candidateKey ] = true;
			remainingDeletions--;
			selectedInPass = true;
		}
		if ( !selectedInPass ) break;
	}

	if ( remainingDeletions > 0 ) {
		plan.error = OSApp.Language._( "This backup cannot be restored without removing sensors referenced by its aggregate definitions." );
		return plan;
	}

	targetOnlySensors.forEach( function( sensor ) {
		if ( sensor.type !== 0 || hasOwn( plan.plannedDeletedSensorUUIDs, String( sensor.uuid ) ) ||
			!sensor.extra || !Array.isArray( sensor.extra.children ) ) return;
		sensor.extra.children.forEach( function( child ) {
			if ( child.uuid ) aggregateChildUUIDs[ String( child.uuid ) ] = true;
		} );
	} );

	for ( sensorKey in aggregateChildUUIDs ) {
		if ( hasOwn( aggregateChildUUIDs, sensorKey ) && !hasOwn( plan.backupSensorUUIDs, sensorKey ) &&
			( !hasOwn( plan.activeSensorUUIDs, sensorKey ) ||
				hasOwn( plan.plannedDeletedSensorUUIDs, sensorKey ) ) ) {
			plan.error = OSApp.Language._( "Sensor definitions in this backup reference unavailable child sensors." );
			return plan;
		}
	}

	return plan;
};

OSApp.ImportExport.isPlainObject = function( value ) {
	if ( value === null || typeof value !== "object" || Array.isArray( value ) ) {
		return false;
	}

	var prototype = Object.getPrototypeOf( value );
	return prototype === Object.prototype || prototype === null;
};

OSApp.ImportExport.hasPoisonKey = function( key ) {
	return key === "__proto__" || key === "prototype" || key === "constructor";
};

OSApp.ImportExport.hasWellFormedUnicode = function( value ) {
	for ( var index = 0; index < value.length; index++ ) {
		var code = value.charCodeAt( index );
		if ( code >= 0xd800 && code <= 0xdbff ) {
			if ( index + 1 >= value.length ) {
				return false;
			}
			var next = value.charCodeAt( index + 1 );
			if ( next < 0xdc00 || next > 0xdfff ) {
				return false;
			}
			index++;
		} else if ( code >= 0xdc00 && code <= 0xdfff ) {
			return false;
		}
	}
	return true;
};

// Reject structures JSON itself cannot create, cycles, poison keys, and excessively
// broad/deep input before any field-specific traversal or command construction.
OSApp.ImportExport.hasSafeImportTree = function( value ) {
	var limits = OSApp.ImportExport.limits,
		seen = typeof WeakSet === "function" ? new WeakSet() : [],
		hasSeen = function( current ) {
			return typeof seen.has === "function" ? seen.has( current ) : seen.indexOf( current ) !== -1;
		},
		remember = function( current ) {
			if ( typeof seen.add === "function" ) {
				seen.add( current );
			} else {
				seen.push( current );
			}
		},
		containers = 0,
		visit = function( current, depth ) {
			if ( current === null || typeof current === "boolean" ) {
				return true;
			}
			if ( typeof current === "string" ) {
				return current.length <= limits.maxImportCharacters && OSApp.ImportExport.hasWellFormedUnicode( current );
			}
			if ( typeof current === "number" ) {
				return isFinite( current ) && Math.abs( current ) <= limits.maxSafeNumber;
			}
			if ( typeof current !== "object" || depth > limits.maxTreeDepth || hasSeen( current ) ) {
				return false;
			}

			containers++;
			if ( containers > limits.maxTreeContainers ) {
				return false;
			}
			remember( current );

			if ( Array.isArray( current ) ) {
				if ( current.length > limits.maxCollectionLength || Object.keys( current ).length !== current.length ) {
					return false;
				}
				for ( var index = 0; index < current.length; index++ ) {
					var arrayDescriptor = Object.getOwnPropertyDescriptor( current, String( index ) );
					if ( !arrayDescriptor || !Object.prototype.hasOwnProperty.call( arrayDescriptor, "value" ) ||
						!visit( arrayDescriptor.value, depth + 1 ) ) {
						return false;
					}
				}
				return true;
			}

			if ( !OSApp.ImportExport.isPlainObject( current ) ) {
				return false;
			}

			var keys = Object.keys( current );
			if ( keys.length > limits.maxCollectionLength ) {
				return false;
			}
			for ( var keyIndex = 0; keyIndex < keys.length; keyIndex++ ) {
				var key = keys[ keyIndex ],
					descriptor = Object.getOwnPropertyDescriptor( current, key );
				if ( key.length > 256 || !OSApp.ImportExport.hasWellFormedUnicode( key ) ||
					OSApp.ImportExport.hasPoisonKey( key ) || !descriptor ||
					!Object.prototype.hasOwnProperty.call( descriptor, "value" ) || !visit( descriptor.value, depth + 1 ) ) {
					return false;
				}
			}
			return true;
		};

	return visit( value, 0 );
};

OSApp.ImportExport.parseConfigText = function( text, normalizeQuotes ) {
	if ( typeof text !== "string" || text.length === 0 ||
		text.length > OSApp.ImportExport.limits.maxImportCharacters ) {
		return { ok: false };
	}

	var source = $.trim( text );
	if ( source.length === 0 ) {
		return { ok: false };
	}

	try {
		return { ok: true, data: JSON.parse( source ) };
		//eslint-disable-next-line no-unused-vars
	} catch ( err ) {
		if ( !normalizeQuotes ) {
			return { ok: false };
		}
	}

	var normalizedSource = source.replace( /“|”|″/g, "\"" );
	if ( normalizedSource === source ) {
		return { ok: false };
	}
	try {
		return { ok: true, data: JSON.parse( normalizedSource ) };
		//eslint-disable-next-line no-unused-vars
	} catch ( err ) {
		return { ok: false };
	}
};

OSApp.ImportExport.isValidOptionValue = function( key, value ) {
	if ( typeof value !== "number" || !Number.isSafeInteger( value ) || value < -2147483648 || value > 4294967295 ) {
		return false;
	}
	var byteOptions = [ "ip1", "ip2", "ip3", "ip4", "gw1", "gw2", "gw3", "gw4", "dns1", "dns2",
			"dns3", "dns4", "subn1", "subn2", "subn3", "subn4", "ntp1", "ntp2", "ntp3", "ntp4",
			"hp0", "hp1", "fpr0", "fpr1", "devid", "mas", "mas2", "con", "lit", "dim", "bst", "ife", "ife2" ],
		booleanOptions = [ "ntp", "dhcp", "ar", "seq", "rso", "den", "ipas", "lg", "sar",
			"sn1o", "sn2o", "fwire" ];
	if ( byteOptions.indexOf( key ) !== -1 ) return value >= 0 && value <= 255;
	if ( booleanOptions.indexOf( key ) !== -1 ) return value === 0 || value === 1;
	if ( key === "uwt" ) return value >= 0 && value <= 4 || value >= 128 && value <= 132;
	if ( key === "urs" || key === "sn1t" || key === "sn2t" ) return [ 0, 1, 2, 3, 240 ].indexOf( value ) !== -1;
	if ( key === "ext" ) return value >= 0 && value <= 254;
	if ( key === "tz" ) return value >= 0 && value <= 108;
	if ( key === "wl" ) return value >= 0 && value <= 250;
	return true;
};

OSApp.ImportExport.normalizeConfig = function( data ) {
	var limits = OSApp.ImportExport.limits,
		hasOwn = function( object, key ) {
			return Object.prototype.hasOwnProperty.call( object, key );
		},
		isIntegerInRange = function( value, min, max ) {
			return typeof value === "number" && isFinite( value ) && Math.floor( value ) === value &&
				Math.abs( value ) <= limits.maxSafeNumber && value >= min && value <= max;
		},
		copyJsonSetting = function( value ) {
			if ( !OSApp.ImportExport.isPlainObject( value ) || Object.keys( value ).length > 64 ) {
				return null;
			}
			var serialized = JSON.stringify( value );
			if ( serialized.length > limits.maxJsonSettingLength ) {
				return null;
			}
			return JSON.parse( serialized );
		},
		isValidEncodedDate = function( value ) {
			if ( !isIntegerInRange( value, 33, 415 ) ) {
				return false;
			}
			var month = value >> 5,
				day = value & 31,
				monthDays = [ 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
			return month >= 1 && month <= 12 && day >= 1 && day <= monthDays[ month - 1 ];
		},
		normalized, stationNames, boardKeys, programs, sourceFirmwareVersion, sourceBoardCount, requiredBoardCount, sensorUUIDs,
		invalid, i, key;

	try {
		if ( !OSApp.ImportExport.hasSafeImportTree( data ) || !OSApp.ImportExport.isPlainObject( data ) ||
			!OSApp.ImportExport.isPlainObject( data.options ) || !OSApp.ImportExport.isPlainObject( data.settings ) ||
			!OSApp.ImportExport.isPlainObject( data.stations ) || !OSApp.ImportExport.isPlainObject( data.programs ) ||
			!OSApp.Firmware.isValidFirmwareVersion( data.options.fwv ) ||
			!Array.isArray( data.stations.snames ) ||
			!Array.isArray( data.stations.masop ) || !Array.isArray( data.programs.pd ) ) {
			return null;
		}

		stationNames = data.stations.snames;
		if ( stationNames.length > limits.maxStations || !stationNames.every( function( name ) {
			return typeof name === "string" && name.length <= limits.maxStationNameLength;
		} ) ) {
			return null;
		}
		requiredBoardCount = Math.ceil( stationNames.length / 8 );
		if ( hasOwn( data.options, "ext" ) && data.options.ext !== Math.max( 0, requiredBoardCount - 1 ) ) {
			return null;
		}

		normalized = {
			options: { fwv: data.options.fwv },
			settings: {},
			stations: { snames: stationNames.slice() },
			programs: { pd: [] },
			special: {}
		};

		invalid = false;
		Object.keys( OSApp.Constants.keyIndex ).forEach( function( optionKey ) {
			if ( hasOwn( data.options, optionKey ) ) {
				if ( !isIntegerInRange( data.options[ optionKey ], -2147483648, 4294967295 ) ||
					!OSApp.ImportExport.isValidOptionValue( optionKey, data.options[ optionKey ] ) ) {
					invalid = true;
					return;
				}
				normalized.options[ optionKey ] = data.options[ optionKey ];
			}
			} );
			if ( invalid ) {
				return null;
			}
			var hasLowPort = hasOwn( data.options, "hp0" ),
				hasHighPort = hasOwn( data.options, "hp1" );
			if ( hasLowPort !== hasHighPort || hasLowPort && data.options.hp0 + data.options.hp1 * 256 === 0 ) return null;
			[ [ "ip1", "ip2", "ip3", "ip4" ], [ "gw1", "gw2", "gw3", "gw4" ],
				[ "dns1", "dns2", "dns3", "dns4" ], [ "subn1", "subn2", "subn3", "subn4" ] ].forEach( function( keys ) {
				if ( keys.every( function( optionKey ) { return hasOwn( data.options, optionKey ); } ) &&
					keys.every( function( optionKey ) { return data.options[ optionKey ] === 0; } ) ) invalid = true;
			} );
			if ( invalid ) return null;

		if ( data.settings.loc !== null && typeof data.settings.loc !== "undefined" ) {
			if ( typeof data.settings.loc !== "string" || data.settings.loc.length > limits.maxSettingStringLength ) {
				return null;
			}
			normalized.settings.loc = data.settings.loc;
		} else {
			normalized.settings.loc = "";
		}

		[ "ifkey", "dname" ].forEach( function( settingKey ) {
			if ( hasOwn( data.settings, settingKey ) && data.settings[ settingKey ] !== null ) {
				if ( typeof data.settings[ settingKey ] !== "string" ||
					data.settings[ settingKey ].length > limits.maxSettingStringLength ) {
					invalid = true;
					return;
				}
				normalized.settings[ settingKey ] = data.settings[ settingKey ];
			}
		} );
		if ( invalid ) {
			return null;
		}

		[ "wto", "mqtt", "email", "otc" ].forEach( function( settingKey ) {
			if ( hasOwn( data.settings, settingKey ) && data.settings[ settingKey ] !== null ) {
				var copied = copyJsonSetting( data.settings[ settingKey ] );
				if ( copied === null ) {
					invalid = true;
					return;
				}
				normalized.settings[ settingKey ] = copied;
			}
		} );
		if ( invalid ) {
			return null;
		}

		if ( hasOwn( data.settings, "nbrd" ) ) {
			if ( !isIntegerInRange( data.settings.nbrd, 0, limits.maxBoards ) || data.settings.nbrd !== requiredBoardCount ) {
				return null;
			}
			normalized.settings.nbrd = data.settings.nbrd;
		} else {
			normalized.settings.nbrd = Math.ceil( stationNames.length / 8 );
		}

		boardKeys = [ "masop", "masop2", "ignore_rain", "ignore_sn1", "ignore_sn2", "stn_dis", "stn_spe", "stn_seq", "act_relay" ];
		for ( i = 0; i < boardKeys.length; i++ ) {
			key = boardKeys[ i ];
			if ( !hasOwn( data.stations, key ) ) {
				if ( key === "masop" ) {
					return null;
				}
				continue;
			}
			if ( !Array.isArray( data.stations[ key ] ) || data.stations[ key ].length !== requiredBoardCount ||
				data.stations[ key ].length > limits.maxBoards ||
				!data.stations[ key ].every( function( value ) { return isIntegerInRange( value, 0, 255 ); } ) ) {
				return null;
			}
			normalized.stations[ key ] = data.stations[ key ].slice();
		}

		if ( hasOwn( data, "sensors" ) ) {
			if ( !OSApp.ImportExport.isPlainObject( data.sensors ) || !Array.isArray( data.sensors.sn ) ||
				data.sensors.sn.length > OSApp.ImportExport.sensorLimit || ( hasOwn( data.sensors, "count" ) &&
				( !isIntegerInRange( data.sensors.count, 0, OSApp.ImportExport.sensorLimit ) ||
					data.sensors.count !== data.sensors.sn.length ) ) ) {
				return null;
			}
			sensorUUIDs = Object.create( null );
			for ( i = 0; i < data.sensors.sn.length; i++ ) {
				var sensor = data.sensors.sn[ i ],
					sensorUUID = String( sensor && sensor.uuid );
				if ( !OSApp.ImportExport.validateSensorDefinition( sensor ) ||
					Object.prototype.hasOwnProperty.call( sensorUUIDs, sensorUUID ) ) {
					return null;
				}
				sensorUUIDs[ sensorUUID ] = true;
			}
			normalized.sensors = {
				sn: JSON.parse( JSON.stringify( data.sensors.sn ) ),
				count: data.sensors.sn.length
			};
		}

		programs = data.programs.pd;
		if ( programs.length > limits.maxPrograms || ( hasOwn( data.programs, "nprogs" ) &&
			( !isIntegerInRange( data.programs.nprogs, 0, limits.maxPrograms ) || data.programs.nprogs !== programs.length ) ) ) {
			return null;
		}
		[ "nboards", "mnp", "mnst", "pnsize" ].forEach( function( metadataKey ) {
			if ( hasOwn( data.programs, metadataKey ) &&
				!isIntegerInRange( data.programs[ metadataKey ], metadataKey === "mnst" || metadataKey === "pnsize" ? 1 : 0, 255 ) ) {
				invalid = true;
			}
		} );
		if ( invalid ) {
			return null;
		}
		if ( hasOwn( data.programs, "nboards" ) && data.programs.nboards !== requiredBoardCount ) {
			return null;
		}

		sourceFirmwareVersion = normalized.options.fwv;
		sourceBoardCount = Math.ceil( stationNames.length / 8 );
		if ( hasOwn( data.programs, "nboards" ) ) {
			sourceBoardCount = Math.max( sourceBoardCount, data.programs.nboards );
		}
		for ( i = 0; i < programs.length; i++ ) {
			var program = programs[ i ];
			if ( !Array.isArray( program ) || program.length < 5 ||
				!isIntegerInRange( program[ 0 ], 0, 255 ) || !isIntegerInRange( program[ 1 ], 0, 255 ) ||
				!isIntegerInRange( program[ 2 ], 0, 255 ) ) {
				return null;
			}

			if ( sourceFirmwareVersion >= 210 ) {
				if ( program.length < 6 || program.length > 8 || !Array.isArray( program[ 3 ] ) || program[ 3 ].length !== 4 ||
					!program[ 3 ].every( function( value ) { return isIntegerInRange( value, -32768, 32767 ); } ) ||
					!Array.isArray( program[ 4 ] ) || program[ 4 ].length !== stationNames.length ||
					program[ 4 ].length > limits.maxStations ||
					!program[ 4 ].every( function( value ) { return isIntegerInRange( value, 0, 65535 ); } ) ||
					typeof program[ 5 ] !== "string" || program[ 5 ].length > limits.maxProgramNameLength ) {
					return null;
				}

				if ( ( ( program[ 0 ] >> 4 ) & 3 ) === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL && program[ 2 ] === 0 ) {
					return null;
				}

				var normalizedProgram = [ program[ 0 ], program[ 1 ], program[ 2 ], program[ 3 ].slice(), program[ 4 ].slice(), program[ 5 ] ];
				if ( typeof program[ 6 ] !== "undefined" && program[ 6 ] !== null ) {
					if ( !Array.isArray( program[ 6 ] ) || program[ 6 ].length !== 3 ||
						!isIntegerInRange( program[ 6 ][ 0 ], 0, 1 ) || !isIntegerInRange( program[ 6 ][ 1 ], 0, 415 ) ||
						!isIntegerInRange( program[ 6 ][ 2 ], 0, 415 ) ) {
						return null;
					}
					var normalizedFrom = program[ 6 ][ 0 ] === 0 && program[ 6 ][ 1 ] === 0 ? 33 : program[ 6 ][ 1 ],
						normalizedTo = program[ 6 ][ 0 ] === 0 && program[ 6 ][ 2 ] === 0 ? 415 : program[ 6 ][ 2 ];
					if ( !isValidEncodedDate( normalizedFrom ) || !isValidEncodedDate( normalizedTo ) ) {
						return null;
					}
					normalizedProgram[ 6 ] = [ program[ 6 ][ 0 ], normalizedFrom, normalizedTo ];
				}
				if ( typeof program[ 7 ] !== "undefined" && program[ 7 ] !== null ) {
					var adjustment = program[ 7 ];
					if ( !OSApp.ImportExport.isPlainObject( adjustment ) ) {
						return null;
					}
					var hasAdjustment = Object.keys( adjustment ).length > 0;
					if ( hasAdjustment && ( !hasOwn( adjustment, "flag" ) || !isIntegerInRange( adjustment.flag, 0, 255 ) ||
						!hasOwn( adjustment, "uuid" ) || !isIntegerInRange( adjustment.uuid, 1, 65535 ) ||
						!hasOwn( adjustment, "splits" ) || !Array.isArray( adjustment.splits ) || adjustment.splits.length > 8 ||
						( adjustment.flag & 1 ) !== 0 && adjustment.splits.length === 0 ) ) {
						return null;
					}
					var normalizedAdjustment = {
						flag: hasAdjustment ? adjustment.flag : 0,
						uuid: hasAdjustment ? adjustment.uuid : 0,
						splits: []
					}, lastSplitX = -Infinity;
					if ( Array.isArray( adjustment.splits ) ) {
						for ( var splitIndex = 0; splitIndex < adjustment.splits.length; splitIndex++ ) {
							var split = adjustment.splits[ splitIndex ];
							if ( !OSApp.ImportExport.isPlainObject( split ) || typeof split.x !== "number" ||
								typeof split.y !== "number" || !isFinite( split.x ) || !isFinite( split.y ) ||
								split.y < 0 || split.x < lastSplitX || Math.abs( split.x ) > limits.maxSafeNumber ||
								Math.abs( split.y ) > limits.maxSafeNumber ) {
								return null;
							}
							lastSplitX = split.x;
							normalizedAdjustment.splits.push( { x: split.x, y: split.y } );
						}
					}
					normalizedProgram[ 7 ] = normalizedAdjustment;
				}
				normalized.programs.pd.push( normalizedProgram );
			} else {
				if ( program.length !== 7 + sourceBoardCount || program.length > 7 + limits.maxBoards ||
					!isIntegerInRange( program[ 3 ], -32768, 32767 ) || !isIntegerInRange( program[ 4 ], -32768, 32767 ) ||
					!isIntegerInRange( program[ 5 ], 0, 32767 ) || !isIntegerInRange( program[ 6 ], 0, 65535 ) ||
					!program.slice( 7 ).every( function( value ) { return isIntegerInRange( value, 0, 255 ); } ) ) {
					return null;
				}
				normalized.programs.pd.push( program.slice() );
			}
		}

		if ( data.special !== null && typeof data.special !== "undefined" ) {
			if ( !OSApp.ImportExport.isPlainObject( data.special ) || Object.keys( data.special ).length > limits.maxStations ) {
				return null;
			}
			var specialKeys = Object.keys( data.special );
			for ( i = 0; i < specialKeys.length; i++ ) {
				key = specialKeys[ i ];
				var sid = Number( key ),
					info = data.special[ key ];
				if ( !/^(0|[1-9]\d*)$/.test( key ) || !isIntegerInRange( sid, 0, stationNames.length - 1 ) ||
					!OSApp.ImportExport.isPlainObject( info ) || !isIntegerInRange( info.st, 0, 6 ) ||
					typeof info.sd !== "string" || info.sd.length > limits.maxSettingStringLength ||
					!OSApp.ImportExport.hasWellFormedUnicode( info.sd ) ) {
					return null;
				}
				normalized.special[ key ] = { st: info.st, sd: info.sd };
			}
		}

		return normalized;
		//eslint-disable-next-line no-unused-vars
	} catch ( err ) {
		return null;
	}
};

// Export and Import functions
OSApp.ImportExport.getExportMethod = function() {
	var popup = $(
		"<div data-role='popup' data-theme='a'>" +
			"<div class='ui-bar ui-bar-a'>" + OSApp.Language._( "Select Export Method" ) + "</div>" +
			"<div data-role='controlgroup' class='tight'>" +
				"<a class='ui-btn hidden fileMethod'>" + OSApp.Language._( "File" ) + "</a>" +
				"<a class='ui-btn pasteMethod'>" + OSApp.Language._( "Email" ) + "</a>" +
				"<a class='ui-btn localMethod'>" + OSApp.Language._( "Internal (within app)" ) + "</a>" +
			"</div>" +
		"</div>" ),
		obj = encodeURIComponent( JSON.stringify( OSApp.currentSession.controller ) ),
		controllerDate = OSApp.Dates.currentControllerDate(),
		subject = "OpenSprinkler Data Export on " + OSApp.Dates.dateToString( controllerDate );

	if ( OSApp.currentDevice.isFileCapable ) {
		popup.find( ".fileMethod" ).removeClass( "hidden" ).attr( {
			href: "data:text/json;charset=utf-8," + obj,
			download: "backup-" + OSApp.Dates.dateOnly( controllerDate ).replace( /\//g, "-" ) + ".json"
		} ).on( "click", function() {
			popup.popup( "close" );
		} );
	}

	var href = "mailto:?subject=" + encodeURIComponent( subject ) + "&body=" + obj;
	popup.find( ".pasteMethod" ).attr( "href", href ).on( "click", function() {
		window.open( href, OSApp.currentDevice.isOSXApp ? "_system" : undefined );
		popup.popup( "close" );
	} );

	popup.find( ".localMethod" ).on( "click", function() {
		popup.popup( "close" );
		OSApp.Storage.set( { "backup": JSON.stringify( OSApp.currentSession.controller ) }, function() {
			OSApp.Errors.showError( OSApp.Language._( "Backup saved on this device" ) );
		} );
	} );

	OSApp.UIDom.openPopup( popup, { positionTo: $( "#sprinklers-settings" ).find( ".export_config" ) } );
};

OSApp.ImportExport.getImportMethod = function( localData ) {
	var getPaste = function() {
			var popup = $(
					"<div data-role='popup' data-theme='a' id='paste_config'>" +
						"<p class='ui-bar'>" +
							"<textarea class='textarea' rows='10' placeholder='" + OSApp.Language._( "Paste your backup here" ) + "'></textarea>" +
							"<button data-mini='true' data-theme='b'>" + OSApp.Language._( "Import" ) + "</button>" +
						"</p>" +
					"</div>"
				),
				width = $.mobile.window.width();

			popup.find( "button" ).on( "click", function() {
				var data = popup.find( "textarea" ).val(),
					parsed;

				if ( data === "" ) {
					return;
				}

				parsed = OSApp.ImportExport.parseConfigText( data, true );
				if ( !parsed.ok ) {
					popup.find( "textarea" ).val( "" );
					OSApp.Errors.showError( OSApp.Language._( "Unable to read the configuration file. Please check the file and try again." ) );
					return;
				}

				popup.popup( "close" );
				OSApp.ImportExport.importConfig( parsed.data );
			} );

			popup.css( "width", ( width > 600 ? width * 0.4 + "px" : "100%" ) );
			OSApp.UIDom.openPopup( popup );
			return false;
		},
		popup = $(
			"<div data-role='popup' data-theme='a'>" +
				"<div class='ui-bar ui-bar-a'>" + OSApp.Language._( "Select Import Method" ) + "</div>" +
				"<div data-role='controlgroup' class='tight'>" +
					"<button class='hidden fileMethod'>" + OSApp.Language._( "File" ) + "</button>" +
					"<button class='pasteMethod'>" + OSApp.Language._( "Email (copy/paste)" ) + "</button>" +
					"<button class='hidden localMethod'>" + OSApp.Language._( "Internal (within app)" ) + "</button>" +
				"</div>" +
			"</div>" );

	if ( OSApp.currentDevice.isFileCapable ) {
		popup.find( ".fileMethod" ).removeClass( "hidden" ).on( "click", function() {
			popup.popup( "close" );
			$( "#configInput" ).remove();
			var input = $( "<input type='file' id='configInput' data-role='none' style='visibility:hidden;position:absolute;top:-50px;left:-50px'/>" )
				.on( "change", function() {
					var config = this.files[ 0 ],
						target = {
							generation: OSApp.currentSession.generation || 0,
							ip: OSApp.currentSession.ip,
							prefix: OSApp.currentSession.prefix,
							token: OSApp.currentSession.token
						},
						isTargetCurrent = function() {
							return target.generation === ( OSApp.currentSession.generation || 0 ) && target.ip === OSApp.currentSession.ip &&
								target.prefix === OSApp.currentSession.prefix && target.token === OSApp.currentSession.token;
						},
						cleanup = function() { input.remove(); };

					if ( !config || typeof config !== "object" ) {
						cleanup();
						return;
					}
					if ( typeof config.size === "number" && config.size > OSApp.ImportExport.limits.maxImportCharacters ) {
						cleanup();
						OSApp.Errors.showError( OSApp.Language._( "Invalid configuration" ) );
						return;
					}

					var reader = new FileReader();

					reader.onload = function( e ) {
						cleanup();
						if ( !isTargetCurrent() ) return;
						var parsed = OSApp.ImportExport.parseConfigText( e.target.result, false );
						if ( !parsed.ok ) {
							OSApp.Errors.showError( OSApp.Language._( "Unable to read the configuration file. Please check the file and try again." ) );
							return;
						}
						OSApp.ImportExport.importConfig( parsed.data );
					};
					reader.onerror = function() {
						cleanup();
						if ( !isTargetCurrent() ) return;
						OSApp.Errors.showError( OSApp.Language._( "Unable to read the configuration file. Please check the file and try again." ) );
					};
					reader.onabort = cleanup;

					reader.readAsText( config );
				} );

			input.appendTo( "#sprinklers-settings" );
			input.click();
			return false;
		} );
	} else {

		// Handle local storage being unavailable and present paste dialog immediately
		if ( !localData ) {
			getPaste();
			return;
		}
	}

	popup.find( ".pasteMethod" ).on( "click", function() {
		popup.popup( "close" );
		getPaste();
		return false;
	} );

	if ( localData ) {
		popup.find( ".localMethod" ).removeClass( "hidden" ).on( "click", function() {
			popup.popup( "close" );
			var parsed = OSApp.ImportExport.parseConfigText( localData, false );
			if ( !parsed.ok ) {
				OSApp.Errors.showError( OSApp.Language._( "Unable to read the configuration file. Please check the file and try again." ) );
				return false;
			}
			OSApp.ImportExport.importConfig( parsed.data );
			return false;
		} );
	}

	OSApp.UIDom.openPopup( popup, { positionTo: $( "#sprinklers-settings" ).find( ".import_config" ) } );
};

OSApp.ImportExport.importConfig = function( data ) {
	var warning = "",
		importTarget = OSApp.ImportExport.captureTarget(),
		isImportTargetCurrent = function() {
			return OSApp.ImportExport.isTargetCurrent( importTarget );
		},
		currentOptions = OSApp.currentSession.controller && OSApp.currentSession.controller.options ?
			OSApp.currentSession.controller.options : {},
		supportsSensors = OSApp.Supported.sensors(),
		targetSensors = supportsSensors ? importTarget.controller.sensors.sn : [],
		sensorPlan,
		networkOptionNames = {
			dhcp: true, ip1: true, ip2: true, ip3: true, ip4: true,
			gw1: true, gw2: true, gw3: true, gw4: true,
			hp0: true, hp1: true, dns1: true, dns2: true, dns3: true, dns4: true,
			subn1: true, subn2: true, subn3: true, subn4: true, devid: true
		};

	data = OSApp.ImportExport.normalizeConfig( data );
	if ( data === null ) {
		OSApp.Errors.showError( OSApp.Language._( "Invalid configuration" ) );
		return false;
	}

	if ( OSApp.ImportExport.isImportInProgress() ) {
		OSApp.Errors.showError( OSApp.Language._( "A configuration restore is already in progress." ) );
		return false;
	}

	var targetProgramLimit = importTarget.controller && importTarget.controller.programs &&
		Number.isInteger( importTarget.controller.programs.mnp ) ? importTarget.controller.programs.mnp : null;
	if ( targetProgramLimit !== null && data.programs.pd.length > targetProgramLimit ) {
		OSApp.Errors.showError( OSApp.Language._( "This backup contains more programs than this controller supports." ) );
		return false;
	}

	sensorPlan = OSApp.ImportExport.createSensorRestorePlan( data, targetSensors, supportsSensors );
	if ( sensorPlan.error ) {
		OSApp.Errors.showError( sensorPlan.error );
		return false;
	}

	if ( data.programs.pd.length > 0 && typeof data.options.fwv === "number" && data.options.fwv >= 210 &&
		( OSApp.Firmware.isOSPi() || !OSApp.Firmware.checkOSVersion( 210 ) ) ) {
		OSApp.Errors.showError( OSApp.Language._( "Program data is newer than the device firmware and cannot be imported" ) );
		return false;
	}

	if ( OSApp.Firmware.checkOSVersion( 210 ) && Object.keys( networkOptionNames ).some( function( optionName ) {
		return Object.prototype.hasOwnProperty.call( data.options, optionName ) &&
			data.options[ optionName ] !== currentOptions[ optionName ];
	} ) ) {

		warning = OSApp.Language._( "Warning: Network changes will be made and the device may no longer be accessible from this address." );
	}

	if ( sensorPlan.sensorsToDelete.length > 0 ) {
		warning += ( warning ? "\n\n" : "" ) + OSApp.Language._(
			"The controller is at its sensor limit. Restoring this backup will delete sensor definitions that exist only on this controller."
		);
	}
	var hasMissingAdjustmentSensor = data.programs.pd.some( function( program ) {
		var adjustment = program[ 7 ];
		return adjustment && adjustment.uuid > 0 &&
			!Object.prototype.hasOwnProperty.call( sensorPlan.backupSensorUUIDs, String( adjustment.uuid ) ) &&
			sensorPlan.resolveSensorUUID( adjustment.uuid ) === 0;
	} );
	if ( hasMissingAdjustmentSensor ) {
		warning += ( warning ? "\n\n" : "" ) + OSApp.Language._(
			"Program sensor adjustments that reference a sensor absent from both the backup and this controller will be disabled."
		);
	}

	return OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to restore the configuration?" ), warning, function() {
		if ( !isImportTargetCurrent() ) {
			OSApp.Errors.showError( OSApp.Language._( "The active controller changed. Please restart the restore." ) );
			return false;
		}
			var restoreSendToOS,
				operation = OSApp.ImportExport.beginOperation( importTarget, function( sendToOS ) {
					restoreSendToOS = sendToOS;
				} );
			if ( !operation ) {
				OSApp.Errors.showError( OSApp.Language._( "A configuration restore is already in progress." ) );
				return false;
			}

			try {
			var cs = "/cs?pw=",
			coEarly = "/co?pw=",
			coNetwork = "/co?pw=",
			cpStart = "/cp?pw=",
			ncs = Math.ceil( data.stations.snames.length / 16 ),
			csi = new Array( ncs ).fill( "/cs?pw=" ),
			isPi = OSApp.Firmware.isOSPi(),
			baseCommands = [],
			supportsDateRange = OSApp.Supported.dateRange(),
			hasNetworkOptions = false,
			i, k, key, option, station;

		var findKey = function( index ) { return OSApp.Constants.keyIndex[ index ] === key; };

			for ( i in data.options ) {
			if ( Object.prototype.hasOwnProperty.call(data.options,  i ) && Object.prototype.hasOwnProperty.call(OSApp.Constants.keyIndex,  i ) ) {
				key = OSApp.Constants.keyIndex[ i ];
				if ( $.inArray( key, [ 2, 14, 16, 21, 22, 25, 36 ] ) !== -1 && data.options[ i ] === 0 ) {
					continue;
				}
				if ( key === 3 ) {
					if ( OSApp.Firmware.checkOSVersion( 210 ) && importTarget.controller.options.dhcp === 1 ) {
						coNetwork += "&o3=1";
						hasNetworkOptions = true;
					}
					continue;
				}
				if ( isPi ) {
					key = Object.keys( OSApp.Constants.keyIndex ).find( findKey );
					if ( key === undefined ) {
						continue;
					}
				}
				if ( OSApp.Firmware.checkOSVersion( 208 ) === true && typeof data.options[ i ] === "string" ) {
					option = data.options[ i ].replace( /\s/g, "_" );
				} else {
					option = data.options[ i ];
				}
				if ( Object.prototype.hasOwnProperty.call( networkOptionNames, i ) ) {
					coNetwork += "&o" + key + "=" + encodeURIComponent( option );
					hasNetworkOptions = true;
				} else {
					coEarly += "&o" + key + "=" + encodeURIComponent( option );
				}
			}
			if ( !isPi && !Object.prototype.hasOwnProperty.call( data.options, "ext" ) ) {
				coEarly += "&o15=" + Math.max( 0, data.settings.nbrd - 1 );
			}
		}

		// Handle import from versions prior to 2.1.1 for enable logging flag
		if ( !isPi && typeof data.options.fwv === "number" && data.options.fwv < 211 && OSApp.Firmware.checkOSVersion( 211 ) ) {

			// Enables logging since prior firmwares always had logging enabled
			coEarly += "&o36=1";
		}

		// Import Weather Adjustment Options, if available
		if ( typeof data.settings.wto === "object" && OSApp.Firmware.checkOSVersion( 215 ) ) {
			coEarly += "&wto=" + encodeURIComponent( OSApp.Utils.escapeJSON( data.settings.wto ) );
		}

		// Import IFTTT Key, if available
		if ( typeof data.settings.ifkey === "string" && OSApp.Firmware.checkOSVersion( 217 ) ) {
			coEarly += "&ifkey=" + encodeURIComponent( data.settings.ifkey );
		}

		// Import device name, if available
		if ( typeof data.settings.dname === "string" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			coEarly += "&dname=" + encodeURIComponent( data.settings.dname );
		}

		// Import mqtt options, if available
		if ( typeof data.settings.mqtt === "object" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			coEarly += "&mqtt=" + encodeURIComponent( OSApp.Utils.escapeJSON( data.settings.mqtt ) );
		}

		//Import email options, if available
		if ( typeof data.settings.email === "object" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			coEarly += "&email=" + encodeURIComponent( OSApp.Utils.escapeJSON( data.settings.email ) );
		}

		if ( typeof data.settings.otc === "object" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			coEarly += "&otc=" + encodeURIComponent( OSApp.Utils.escapeJSON( data.settings.otc ) );
		}

		coEarly += "&" + ( isPi ? "o" : "" ) + "loc=" + encodeURIComponent( data.settings.loc || "" );

		// Due to potentially large number of zones, we split zone names import to maximum 16 per group
		for ( k = 0; k < ncs; k++ ) {
			for ( i = k * 16; i < ( k + 1 ) * 16 && i < data.stations.snames.length; i++ ) {
				if ( OSApp.Firmware.checkOSVersion( 208 ) === true ) {
					station = data.stations.snames[ i ].replace( /\s/g, "_" );
				} else {
					station = data.stations.snames[ i ];
				}
				csi[ k ] += "&s" + i + "=" + encodeURIComponent( station );
			}
		}

		for ( i = 0; i < data.stations.masop.length; i++ ) {
			cs += "&m" + i + "=" + encodeURIComponent( data.stations.masop[ i ] );
		}

		if ( typeof data.stations.masop2 === "object" ) {
			for ( i = 0; i < data.stations.masop2.length; i++ ) {
				cs += "&n" + i + "=" + encodeURIComponent( data.stations.masop2[ i ] );
			}
		}

		if ( typeof data.stations.ignore_rain === "object" ) {
			for ( i = 0; i < data.stations.ignore_rain.length; i++ ) {
				cs += "&i" + i + "=" + encodeURIComponent( data.stations.ignore_rain[ i ] );
			}
		}

		if ( typeof data.stations.ignore_sn1 === "object" ) {
			for ( i = 0; i < data.stations.ignore_sn1.length; i++ ) {
				cs += "&j" + i + "=" + encodeURIComponent( data.stations.ignore_sn1[ i ] );
			}
		}

		if ( typeof data.stations.ignore_sn2 === "object" ) {
			for ( i = 0; i < data.stations.ignore_sn2.length; i++ ) {
				cs += "&k" + i + "=" + encodeURIComponent( data.stations.ignore_sn2[ i ] );
			}
		}

		if ( typeof data.stations.stn_dis === "object" ) {
			for ( i = 0; i < data.stations.stn_dis.length; i++ ) {
				cs += "&d" + i + "=" + encodeURIComponent( data.stations.stn_dis[ i ] );
			}
		}

		if ( typeof data.stations.stn_spe === "object" ) {
			for ( i = 0; i < data.stations.stn_spe.length; i++ ) {
				cs += "&p" + i + "=" + encodeURIComponent( data.stations.stn_spe[ i ] );
			}
		}

		if ( typeof data.stations.stn_seq === "object" ) {
			for ( i = 0; i < data.stations.stn_seq.length; i++ ) {
				cs += "&q" + i + "=" + encodeURIComponent( data.stations.stn_seq[ i ] );
			}
		} else if ( !isPi && typeof data.options.fwv === "number" && data.options.fwv < 211 && !OSApp.Firmware.checkOSVersion( 211 ) ) {
			var bid;
			for ( bid = 0; bid < data.settings.nbrd; bid++ ) {
				cs += "&q" + bid + "=" + encodeURIComponent( data.options.seq === 1 ? 255 : 0 );
			}
		}

		if ( typeof data.stations.act_relay === "object" ) {
			for ( i = 0; i < data.stations.act_relay.length; i++ ) {
				cs += "&a" + i + "=" + encodeURIComponent( data.stations.act_relay[ i ] );
			}
		}

		// Structural options (notably ext/board count) must settle before station
		// masks, names, and program durations are submitted.
		baseCommands.push( OSApp.Utils.transformKeysinString( coEarly ) );
		baseCommands.push( cs );
		$.each( csi, function( i, comm ) {
			baseCommands.push( comm );
		} );
		$.each( data.special, function( sid, info ) {
			if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
				baseCommands.push( "/cs?pw=&sid=" + encodeURIComponent( sid ) + "&st=" +
					encodeURIComponent( info.st ) + "&sd=" + encodeURIComponent( info.sd ) );
			}
		} );

		var buildProgramCommand = function( sourceProgram, index ) {
			var prog = sourceProgram.slice(),
				name = "",
				dateRange = supportsDateRange ? "&endr=0&from=33&to=415" : "",
				sensorAdjustment = supportsSensors ? "&snadj=0,0" : "";

			// Handle data from firmware 2.1+ being imported to a 2.1+ device
			// The firmware does not accept program name inside the program array and must be submitted separately
			if ( !isPi && typeof data.options.fwv === "number" && data.options.fwv >= 210 && OSApp.Firmware.checkOSVersion( 210 ) ) {
				name = "&name=" + encodeURIComponent( prog[ 5 ] );
				if ( supportsDateRange && Array.isArray( prog[ 6 ] ) ) {
					dateRange = "&endr=" + prog[ 6 ][ 0 ] + "&from=" + prog[ 6 ][ 1 ] + "&to=" + prog[ 6 ][ 2 ];
				}
				var adjustment = prog[ 7 ],
					mappedUUID = adjustment && typeof adjustment === "object" ?
						sensorPlan.resolveSensorUUID( adjustment.uuid ) : 0;
				if ( supportsSensors && mappedUUID > 0 && adjustment ) {
					var adjustmentParts = [ adjustment.flag || 0, mappedUUID ];
					if ( Array.isArray( adjustment.splits ) ) {
						adjustment.splits.forEach( function( split ) {
							adjustmentParts.push( split.x, split.y );
						} );
					}
					sensorAdjustment = "&snadj=" + adjustmentParts.join( "," );
				}

				// Truncate metadata that must be submitted as separate parameters.
				prog = prog.slice( 0, 5 );
			}

			// Handle data from firmware prior to 2.1 being imported to a 2.1+ device
			if ( !isPi && typeof data.options.fwv === "number" && data.options.fwv < 210 && OSApp.Firmware.checkOSVersion( 210 ) ) {
				var program = OSApp.Programs.readProgram183( prog ),
					total = ( prog.length - 7 ),
					allDur = [],
					j = 0,
					bits, n, s;

				// Set enable/disable bit for program
				j |= ( program.en << 0 );

				// Set program restrictions
				if ( program.is_even ) {
					j |= ( 2 << 2 );
				} else if ( program.is_odd ) {
					j |= ( 1 << 2 );
				} else {
					j |= ( 0 << 2 );
				}

				// Set program type
				if ( program.type === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL ) {
					j |= ( 3 << 4 );
				} else if ( program.type === OSApp.Constants.options.PROGRAM_TYPE_MONTHLY ) {
					j |= ( 2 << 4 );
				} else if ( program.type === OSApp.Constants.options.PROGRAM_TYPE_SINGLERUN ) {
					j |= ( 1 << 4 );
				} else {
					j |= ( 0 << 4 );
				}

				// Set start time type (repeating)
				j |= ( 0 << 6 );

				// Save bits to program data
				prog[ 0 ] = j;

				// Using the total number of stations, migrate the duration into each station
				for ( n = 0; n < total; n++ ) {
					bits = prog[ 7 + n ];
					for ( s = 0; s < 8; s++ ) {
						allDur.push( ( bits & ( 1 << s ) ) ? program.duration : 0 );
					}
				}

				// Set the start time, interval time, and repeat count
				prog[ 3 ] = [ program.start, program.interval > 0 ?
					parseInt( ( program.end - program.start ) / program.interval ) : 0, program.interval, 0 ];

				// Change the duration from the previous int to the new array
				prog[ 4 ] = allDur;

				// Truncate the station enable/disable flags
				prog = prog.slice( 0, 5 );

				name = "&name=" + encodeURIComponent( OSApp.Language._( "Program" ) + " " + ( index + 1 ) );
			}

			return cpStart + "&pid=-1&v=" + encodeURIComponent( JSON.stringify( prog ) ) +
				name + dateRange + sensorAdjustment;
		},
			isSilentFailure = function( error ) {
				return error && ( error.statusText === "abort" || error.statusText === "stale-session" );
			},
			rejectImport = function( message ) {
				return $.Deferred().reject( {
					status: 0,
					statusText: "restore-validation",
					restoreMessage: message
				} ).promise();
			},
			sendImportRequest = function( command, type ) {
				if ( operation.settled || OSApp.ImportExport.activeOperation !== operation || !isImportTargetCurrent() ) {
					return $.Deferred().reject( { status: 0, statusText: "stale-session" } ).promise();
				}
				return restoreSendToOS( command, type ).then( function( response ) {
					if ( operation.settled || OSApp.ImportExport.activeOperation !== operation || !isImportTargetCurrent() ) {
						return $.Deferred().reject( { status: 0, statusText: "stale-session" } ).promise();
					}
					return response;
				} );
			},
			sendCommands = function( commands ) {
				var commandSequence = $.Deferred().resolve().promise();
				$.each( commands, function( commandIndex, command ) {
					commandSequence = commandSequence.then( function() {
						return sendImportRequest( command );
					} );
				} );
				return commandSequence;
			},
			readSensors = function() {
				return sendImportRequest( "/jsn?pw=", "json" ).then( function( snapshot ) {
					if ( !snapshot || !Array.isArray( snapshot.sn ) ) {
						return rejectImport( OSApp.Language._(
							"Unable to verify sensor definitions during import. The restore was stopped."
						) );
					}
					var uuids = Object.create( null ),
						valid = snapshot.sn.every( function( sensor ) {
							var uuid = Number( sensor && sensor.uuid ), sensorKey = String( sensor && sensor.uuid );
							if ( !Number.isInteger( uuid ) || uuid < 1 || uuid > 65535 ||
								Object.prototype.hasOwnProperty.call( uuids, sensorKey ) ) return false;
							uuids[ sensorKey ] = uuid;
							return true;
						} );
					if ( !valid || Object.prototype.hasOwnProperty.call( snapshot, "count" ) &&
						( !Number.isInteger( snapshot.count ) || snapshot.count !== snapshot.sn.length ) ) {
						return rejectImport( OSApp.Language._(
							"Unable to verify sensor definitions during import. The restore was stopped."
						) );
					}
					return { sensors: snapshot.sn, uuids: uuids };
				} );
			},
			preflightSensors = function() {
				if ( sensorPlan.backupSensors.length === 0 ) return $.Deferred().resolve().promise();
				return sendImportRequest( "/jsd?pw=", "json" ).then( function( rawDescription ) {
					if ( !rawDescription || typeof rawDescription !== "object" ) {
						return rejectImport( OSApp.Language._(
							"Unable to validate sensor definitions on this controller. No configuration changes were made."
						) );
					}
					var hasLongDescription = Array.isArray( rawDescription.sensors ) && rawDescription.sensors.some( function( sensor ) {
							return sensor && typeof sensor.name === "string";
						} ),
						description = hasLongDescription ? rawDescription :
						OSApp.ImportExport.normalizeSensorDescription( rawDescription );
					if ( !sensorPlan.backupSensors.every( function( sensor ) {
						return OSApp.ImportExport.sensorDefinitionSupported( sensor, description, sensorPlan.targetSensors );
					} ) ) {
						return rejectImport( OSApp.Language._(
							"This backup contains sensor definitions that are not supported by this controller."
						) );
					}
					return description;
				} );
			};

		var sequence = preflightSensors().then( function() {
			return sendCommands( baseCommands );
		} );

		$.each( sensorPlan.sensorsToDelete, function( sensorIndex, sensor ) {
			sequence = sequence.then( function() {
				return sendImportRequest( "/dsn?pw=&uuid=" + encodeURIComponent( sensor.uuid ) );
			} ).then( function() {
				delete sensorPlan.activeSensorUUIDs[ String( sensor.uuid ) ];
			} );
		} );

		$.each( sensorPlan.backupSensors, function( sensorIndex, sensor ) {
			var sourceUUID = String( sensor.uuid );
			sequence = sequence.then( function() {
				if ( Object.prototype.hasOwnProperty.call( sensorPlan.sensorUUIDMap, sourceUUID ) ) {
					return sendImportRequest( OSApp.ImportExport.buildSensorImportCommand(
						sensor, sensorPlan.sensorUUIDMap[ sourceUUID ], sensor.type !== 0, sensorPlan.resolveSensorUUID
					) );
				}
				var beforeCount = Object.keys( sensorPlan.activeSensorUUIDs ).length;
				return sendImportRequest( OSApp.ImportExport.buildSensorImportCommand(
					sensor, -1, sensor.type !== 0, sensorPlan.resolveSensorUUID
				) ).then( readSensors ).then( function( snapshot ) {
					var added = Object.keys( snapshot.uuids ).filter( function( uuid ) {
						return !Object.prototype.hasOwnProperty.call( sensorPlan.activeSensorUUIDs, uuid );
					} );
					if ( added.length !== 1 || snapshot.sensors.length !== beforeCount + 1 ) {
						return rejectImport( OSApp.Language._(
							"Unable to determine the UUID assigned to a restored sensor. The restore was stopped."
						) );
					}
					sensorPlan.activeSensorUUIDs = snapshot.uuids;
					sensorPlan.sensorUUIDMap[ sourceUUID ] = snapshot.uuids[ added[ 0 ] ];
				} );
			} );
		} );

		$.each( sensorPlan.backupSensors, function( sensorIndex, sensor ) {
			if ( sensor.type !== 0 ) return;
			sequence = sequence.then( function() {
				var mappedUUID = sensorPlan.resolveSensorUUID( sensor.uuid );
				if ( mappedUUID === 0 ) {
					return rejectImport( OSApp.Language._( "Unable to map an aggregate sensor during import. The restore was stopped." ) );
				}
				return sendImportRequest( OSApp.ImportExport.buildSensorImportCommand(
					sensor, mappedUUID, true, sensorPlan.resolveSensorUUID
				) );
			} );
		} );

		if ( sensorPlan.backupSensors.length > 0 ) {
			sequence = sequence.then( readSensors ).then( function( snapshot ) {
				sensorPlan.activeSensorUUIDs = snapshot.uuids;
				var verified = sensorPlan.backupSensors.every( function( sensor ) {
					var mappedUUID = sensorPlan.resolveSensorUUID( sensor.uuid ),
						actual = snapshot.sensors.find( function( candidate ) {
							return Number( candidate.uuid ) === Number( mappedUUID );
						} );
					return mappedUUID > 0 && OSApp.ImportExport.sensorDefinitionMatches(
						sensor, actual, sensorPlan.resolveSensorUUID
					);
				} );
				if ( !verified ) {
					return rejectImport( OSApp.Language._(
						"Restored sensor definitions did not pass verification. The restore was stopped before programs were changed."
					) );
				}
			} );
		}

		sequence = sequence.then( function() {
			return sendImportRequest( "/dp?pw=&pid=-1" );
		} );
		$.each( data.programs.pd, function( programIndex, program ) {
			sequence = sequence.then( function() {
				return sendImportRequest( buildProgramCommand( program, programIndex ) );
			} );
		} );
		if ( hasNetworkOptions ) {
			sequence = sequence.then( function() {
				return sendImportRequest( OSApp.Utils.transformKeysinString( coNetwork ) );
			} );
		}

			return sequence.then(
			function() {
				if ( operation.settled || OSApp.ImportExport.activeOperation !== operation || !isImportTargetCurrent() ||
					operation.finalRefreshStarted ) {
					OSApp.ImportExport.settleOperation( operation );
					return;
				}

				operation.finalRefreshStarted = true;
				var refresh;
				try {
					refresh = OSApp.Sites.updateController();
				} catch ( error ) {
					refresh = $.Deferred().reject( error ).promise();
				}

				return $.when( refresh ).then(
					function() {
						if ( operation.settled || OSApp.ImportExport.activeOperation !== operation ||
							!OSApp.ImportExport.isTargetSessionCurrent( importTarget ) ) {
							OSApp.ImportExport.settleOperation( operation );
							return;
						}

						// A successful refresh atomically replaces the controller snapshot.
						importTarget.controller = OSApp.currentSession.controller;
						if ( !OSApp.ImportExport.settleOperation( operation ) ) {
							return;
						}
						OSApp.Errors.showError( OSApp.Language._( "Backup restored to your device" ) );
						OSApp.Weather.updateWeather();
						OSApp.UIDom.goHome( true );
					},
					function( error ) {
						var targetCurrent = isImportTargetCurrent();
						OSApp.ImportExport.settleOperation( operation );
						if ( targetCurrent && !isSilentFailure( error ) ) {
							OSApp.Network.networkFail();
						}
					}
				);
			},
			function( error ) {
				var targetCurrent = isImportTargetCurrent();
				OSApp.ImportExport.settleOperation( operation );
				if ( targetCurrent && !isSilentFailure( error ) ) {
					OSApp.Errors.showError( error && error.restoreMessage ||
						OSApp.Language._( "Unable to import configuration." ) );
				}
			}
			);
			} catch ( error ) {
				OSApp.ImportExport.settleOperation( operation );
				throw error;
			}
		} );
};

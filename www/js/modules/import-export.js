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
		subject = "OpenSprinkler Data Export on " + OSApp.Dates.dateToString( new Date() );

	if ( OSApp.currentDevice.isFileCapable ) {
		popup.find( ".fileMethod" ).removeClass( "hidden" ).attr( {
			href: "data:text/json;charset=utf-8," + obj,
			download: "backup-" + new Date().toLocaleDateString().replace( /\//g, "-" ) + ".json"
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
				var data = popup.find( "textarea" ).val();

				if ( data === "" ) {
					return;
				}

				try {
					data = JSON.parse( $.trim( data ).replace( /“|”|″/g, "\"" ) );
					popup.popup( "close" );
					OSApp.ImportExport.importConfig( data );
					//eslint-disable-next-line no-unused-vars
				}catch ( err ) {
					popup.find( "textarea" ).val( "" );
					OSApp.Errors.showError( OSApp.Language._( "Unable to read the configuration file. Please check the file and try again." ) );
				}
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
			var input = $( "<input type='file' id='configInput' data-role='none' style='visibility:hidden;position:absolute;top:-50px;left:-50px'/>" )
				.on( "change", function() {
					var config = this.files[ 0 ],
						reader = new FileReader();

					if ( typeof config !== "object" ) {
						return;
					}

					reader.onload = function( e ) {
						try {
							var obj = JSON.parse( $.trim( e.target.result ) );
							OSApp.ImportExport.importConfig( obj );
							//eslint-disable-next-line no-unused-vars
						}catch ( err ) {
							OSApp.Errors.showError( OSApp.Language._( "Unable to read the configuration file. Please check the file and try again." ) );
						}
					};

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
			OSApp.ImportExport.importConfig( JSON.parse( localData ) );
			return false;
		} );
	}

	OSApp.UIDom.openPopup( popup, { positionTo: $( "#sprinklers-settings" ).find( ".import_config" ) } );
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

	if ( !sensor || typeof sensor !== "object" || !isInteger( sensor.uuid ) || sensor.uuid < 1 || sensor.uuid > 65535 ||
		typeof sensor.name !== "string" || sensor.name.length < 1 || sensor.name.length > 32 ||
		!isInteger( sensor.type ) || sensor.type < 0 || sensor.type > 4 ||
		!isInteger( sensor.interval ) || sensor.interval < 1 || !isInteger( sensor.unit ) || sensor.unit < 0 ||
		!isInteger( sensor.flag ) || sensor.flag < 0 || sensor.flag > 255 || !isFiniteNumber( sensor.min ) ||
		!isFiniteNumber( sensor.max ) || sensor.min > sensor.max || !sensor.extra || typeof sensor.extra !== "object" ) {
		return false;
	}

	extra = sensor.extra;
	switch ( sensor.type ) {
		case 0:
			return isInteger( extra.action ) && extra.action >= 0 && extra.action < 6 && Array.isArray( extra.children ) &&
				extra.children.length <= 8 && extra.children.every( function( child ) {
					return child && typeof child === "object" && isInteger( child.uuid ) && child.uuid >= 0 && child.uuid <= 65535 &&
						isFiniteNumber( child.scale ) && isFiniteNumber( child.offset );
				} ) && extra.children.map( function( child ) {
					return [ child.uuid, child.scale, child.offset ].join( "," );
				} ).join( ";" ).concat( ";" ).length < 320;
		case 1:
			if ( !isInteger( extra.pin ) || extra.pin < 1 || extra.pin > 16 || !isFiniteNumber( extra.scale ) ||
				!isFiniteNumber( extra.offset ) || !isInteger( extra.subtype ) ||
				!( extra.subtype === 0 || extra.subtype === 1 || ( extra.subtype >= 10 && extra.subtype <= 17 ) ) ) {
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
				if ( !point || !isFiniteNumber( point.x ) || !isFiniteNumber( point.y ) || point.x < lastX ) {
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

	// A disabled type cannot be created on this controller, but the firmware may
	// still allow an existing definition of that exact type to be updated.
	if ( !sensorDescription || ( sensorDescription.disabled && !existingSensor ) || !unitDescription ) {
		return false;
	}

	var extraKey = [ "action", "subtype", "action", "metric", "input" ][ sensor.type ],
		extraValue = sensor.extra[ extraKey ],
		findArg = function( args ) {
			var found;
			( args || [] ).some( function( arg ) {
				if ( arg.arg === extraKey ) {
					found = arg;
					return true;
				}
				found = findArg( arg.extra );
				return !!found;
			} );
			return found;
		},
		arg = findArg( sensorDescription.args ),
		selectedOption;

	if ( arg && Array.isArray( arg.options ) ) {
		selectedOption = arg.options.find( function( option ) {
			return Number( option.id ) === Number( extraValue );
		} );
		if ( !selectedOption ) {
			return false;
		}
		if ( typeof selectedOption.unit_group === "number" && Number( unitDescription.group ) !== selectedOption.unit_group ) {
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

OSApp.ImportExport.validateProgramDefinition = function( program, sourceFirmwareVersion, stationCount, legacyBoardCount ) {
	var isIntegerInRange = function( value, min, max ) {
			return Number.isInteger( value ) && value >= min && value <= max;
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
		isCurrentFormat = sourceFirmwareVersion === null ?
			Array.isArray( program && program[ 3 ] ) : sourceFirmwareVersion >= 210,
		requiredStations = Number.isInteger( stationCount ) && stationCount >= 0 ? stationCount : 0,
		requiredBoards = Number.isInteger( legacyBoardCount ) && legacyBoardCount >= 0 ? legacyBoardCount :
			Math.ceil( requiredStations / 8 );

	if ( !Array.isArray( program ) || program.length < 5 ||
		!isIntegerInRange( program[ 0 ], 0, 255 ) || !isIntegerInRange( program[ 1 ], 0, 255 ) ||
		!isIntegerInRange( program[ 2 ], 0, 255 ) ) {
		return false;
	}

	if ( isCurrentFormat ) {
		if ( program.length < 6 || !Array.isArray( program[ 3 ] ) || program[ 3 ].length !== 4 ||
			!program[ 3 ].every( function( value ) {
				// Sunrise/sunset encodings occupy the full signed 16-bit field, so
				// validate storage width rather than restricting values to clock time.
				return isIntegerInRange( value, -32768, 32767 );
			} ) || !Array.isArray( program[ 4 ] ) || program[ 4 ].length < requiredStations ||
			!program[ 4 ].every( function( value ) {
				return isIntegerInRange( value, 0, 65535 );
			} ) || typeof program[ 5 ] !== "string" ) {
			return false;
		}

		// The controller rejects interval programs whose interval-day field is
		// zero. Catch that before import erases the existing program list.
		if ( ( ( program[ 0 ] >> 4 ) & 0x03 ) === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL && program[ 2 ] === 0 ) {
			return false;
		}

		if ( typeof program[ 6 ] !== "undefined" && program[ 6 ] !== null &&
			( !Array.isArray( program[ 6 ] ) || program[ 6 ].length < 3 ||
				!isIntegerInRange( program[ 6 ][ 0 ], 0, 1 ) ||
				!isValidEncodedDate( program[ 6 ][ 1 ] ) ||
				!isValidEncodedDate( program[ 6 ][ 2 ] ) ) ) {
			return false;
		}

		return true;
	}

	if ( program.length < 7 + requiredBoards ||
		!isIntegerInRange( program[ 3 ], -32768, 32767 ) ||
		!isIntegerInRange( program[ 4 ], -32768, 32767 ) ||
		!isIntegerInRange( program[ 5 ], 0, 32767 ) ||
		!isIntegerInRange( program[ 6 ], 0, 65535 ) ) {
		return false;
	}

	return program.slice( 7 ).every( function( stationMask ) {
		return isIntegerInRange( stationMask, 0, 255 );
	} );
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
			return Array.isArray( actualPoints ) && sourcePoints.length === actualPoints.length && sourcePoints.every( function( point, index ) {
				return Number( point.x ) === Number( actualPoints[ index ].x ) && Number( point.y ) === Number( actualPoints[ index ].y );
			} );
		};

	switch ( source.type ) {
		case 0:
			if ( Number( sourceExtra.action ) !== Number( actualExtra.action ) || !Array.isArray( actualExtra.children ) || actualExtra.children.length !== 8 ) {
				return false;
			}
			return actualExtra.children.every( function( child, index ) {
				var expected = sourceExtra.children[ index ] || { uuid: 0, scale: 1, offset: 0 };
				return Number( child.uuid ) === Number( remapUUID( expected.uuid ) ) &&
					Number( child.scale ) === Number( expected.scale ) && Number( child.offset ) === Number( expected.offset );
			} );
		case 1:
			return Number( sourceExtra.pin ) === Number( actualExtra.pin ) && Number( sourceExtra.scale ) === Number( actualExtra.scale ) &&
				Number( sourceExtra.offset ) === Number( actualExtra.offset ) && Number( sourceExtra.subtype ) === Number( actualExtra.subtype ) &&
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

OSApp.ImportExport.importConfig = function( data ) {
	var warning = "",
		hasSensorData = !!data && Object.prototype.hasOwnProperty.call( data, "sensors" );

	if ( !data || typeof data !== "object" || !data.settings || !data.programs || !Array.isArray( data.programs.pd ) ||
		!data.stations || !Array.isArray( data.stations.snames ) || !Array.isArray( data.stations.masop ) ||
		( hasSensorData && ( !data.sensors || typeof data.sensors !== "object" || !Array.isArray( data.sensors.sn ) ||
			( Object.prototype.hasOwnProperty.call( data.sensors, "count" ) &&
				( !Number.isInteger( data.sensors.count ) || data.sensors.count !== data.sensors.sn.length ) ) ) ) ) {
		OSApp.Errors.showError( OSApp.Language._( "Invalid configuration" ) );
		return;
	}

	var importSession = OSApp.currentSession,
		importController = importSession.controller,
		programs = data.programs.pd,
		backupSensors = data.sensors && Array.isArray( data.sensors.sn ) ? data.sensors.sn : [],
		sourceFirmwareVersion = data.options && typeof data.options.fwv === "number" ? data.options.fwv : null,
		sourceStationCount = data.stations && Array.isArray( data.stations.snames ) ? data.stations.snames.length : 0,
		sourceLegacyBoardCount = Number.isInteger( data.settings.nbrd ) && data.settings.nbrd >= 0 ?
			data.settings.nbrd : Math.ceil( sourceStationCount / 8 ),
		targetProgramLimit = importController.programs && Number.isInteger( importController.programs.mnp ) ?
			importController.programs.mnp : null,
		targetSensors = importController.sensors && Array.isArray( importController.sensors.sn ) ? importController.sensors.sn : [],
		backupSensorUUIDs = Object.create( null ),
		activeSensorUUIDs = Object.create( null ),
		sensorUUIDMap = Object.create( null ),
		plannedDeletedSensorUUIDs = Object.create( null ),
		sensorsToDelete = [],
		hasOwn = function( object, key ) {
			return Object.prototype.hasOwnProperty.call( object, key );
		},
		resolveSensorUUID = function( uuid ) {
			var key = String( uuid );
			if ( !/^\d+$/.test( key ) || Number( uuid ) < 1 || Number( uuid ) > 65535 ) {
				return 0;
			}
			if ( hasOwn( sensorUUIDMap, key ) ) {
				return sensorUUIDMap[ key ];
			}
			return hasOwn( activeSensorUUIDs, key ) ? Number( uuid ) : 0;
		},
		i, sensorKey;

	if ( ( targetProgramLimit !== null && programs.length > targetProgramLimit ) || programs.some( function( prog ) {
		return !OSApp.ImportExport.validateProgramDefinition(
			prog, sourceFirmwareVersion, sourceStationCount, sourceLegacyBoardCount
		);
	} ) ) {
		OSApp.Errors.showError( OSApp.Language._( "Invalid program configuration in backup." ) );
		return;
	}

	for ( i = 0; i < targetSensors.length; i++ ) {
		sensorKey = String( targetSensors[ i ].uuid );
		if ( /^\d+$/.test( sensorKey ) && Number( sensorKey ) > 0 && Number( sensorKey ) <= 65535 ) {
			activeSensorUUIDs[ sensorKey ] = Number( sensorKey );
		}
	}

	var invalidProgramAdjustment = sourceFirmwareVersion !== null && sourceFirmwareVersion >= 210 && programs.some( function( prog ) {
		if ( !Array.isArray( prog ) ) {
			return true;
		}
		var adjustment = prog[ 7 ];
		if ( typeof adjustment === "undefined" || adjustment === null ) {
			return false;
		}
		// The firmware serializes a program without sensor adjustment as `{}`.
		if ( !Array.isArray( adjustment ) && typeof adjustment === "object" && Object.keys( adjustment ).length === 0 ) {
			return false;
		}
		if ( typeof adjustment !== "object" || !Number.isInteger( adjustment.flag ) || adjustment.flag < 0 || adjustment.flag > 255 ) {
			return true;
		}
		if ( !Number.isInteger( adjustment.uuid ) || adjustment.uuid < 1 || adjustment.uuid > 65535 ||
			!Array.isArray( adjustment.splits ) || adjustment.splits.length > 8 ||
			( ( adjustment.flag & 1 ) !== 0 && adjustment.splits.length < 1 ) ) {
			return true;
		}
		var lastX = -Infinity;
		return adjustment.splits.some( function( point ) {
			if ( !point || !Number.isFinite( point.x ) || !Number.isFinite( point.y ) || point.y < 0 || point.x < lastX ) {
				return true;
			}
			lastX = point.x;
			return false;
		} );
	} );
	if ( invalidProgramAdjustment ) {
		OSApp.Errors.showError( OSApp.Language._( "Invalid program sensor adjustment in backup." ) );
		return;
	}

	if ( backupSensors.length > 0 && !OSApp.Supported.sensors() ) {
		OSApp.Errors.showError( OSApp.Language._( "This backup contains sensor definitions that this controller does not support." ) );
		return;
	}

	for ( i = 0; i < backupSensors.length; i++ ) {
		sensorKey = String( backupSensors[ i ].uuid );
		if ( !OSApp.ImportExport.validateSensorDefinition( backupSensors[ i ] ) || hasOwn( backupSensorUUIDs, sensorKey ) ) {
			OSApp.Errors.showError( OSApp.Language._( "Invalid sensor configuration in backup." ) );
			return;
		}
		backupSensorUUIDs[ sensorKey ] = true;
		if ( hasOwn( activeSensorUUIDs, sensorKey ) ) {
			sensorUUIDMap[ sensorKey ] = Number( sensorKey );
		}
	}

	if ( backupSensors.length > OSApp.ImportExport.sensorLimit ) {
		OSApp.Errors.showError( OSApp.Language._( "This backup contains more sensor definitions than this controller supports." ) );
		return;
	}

	var aggregateChildUUIDs = Object.create( null );
	backupSensors.forEach( function( sensor ) {
		if ( sensor.type === 0 ) {
			sensor.extra.children.forEach( function( child ) {
				if ( child.uuid ) {
					aggregateChildUUIDs[ String( child.uuid ) ] = true;
				}
			} );
		}
	} );
	var missingSensorCount = backupSensors.filter( function( sensor ) {
			return !hasOwn( activeSensorUUIDs, String( sensor.uuid ) );
		} ).length,
		targetOnlySensors = targetSensors.filter( function( sensor ) {
			return !hasOwn( backupSensorUUIDs, String( sensor.uuid ) );
		} ),
		targetOnlyAggregateParents = Object.create( null ),
		remainingDeletions = Math.max( 0, targetSensors.length + missingSensorCount - OSApp.ImportExport.sensorLimit );

	// Children of an aggregate can be removed only after every target-only
	// aggregate that references them has also been selected for removal.
	targetOnlySensors.forEach( function( sensor ) {
		var parentKey = String( sensor.uuid );
		if ( sensor.type !== 0 || !sensor.extra || !Array.isArray( sensor.extra.children ) ) {
			return;
		}
		sensor.extra.children.forEach( function( child ) {
			var childKey = String( child.uuid );
			if ( !child.uuid || childKey === parentKey ) {
				return;
			}
			if ( !hasOwn( targetOnlyAggregateParents, childKey ) ) {
				targetOnlyAggregateParents[ childKey ] = [];
			}
			targetOnlyAggregateParents[ childKey ].push( parentKey );
		} );
	} );

	while ( remainingDeletions > 0 ) {
		var selectedInPass = false;
		for ( i = targetOnlySensors.length - 1; i >= 0 && remainingDeletions > 0; i-- ) {
			var candidate = targetOnlySensors[ i ], candidateKey = String( candidate.uuid );
			if ( hasOwn( plannedDeletedSensorUUIDs, candidateKey ) || hasOwn( aggregateChildUUIDs, candidateKey ) ) {
				continue;
			}
			var parents = hasOwn( targetOnlyAggregateParents, candidateKey ) ? targetOnlyAggregateParents[ candidateKey ] : [];
			if ( parents.some( function( parentUUID ) {
				return !hasOwn( plannedDeletedSensorUUIDs, parentUUID );
			} ) ) {
				continue;
			}
			sensorsToDelete.push( candidate );
			plannedDeletedSensorUUIDs[ candidateKey ] = true;
			remainingDeletions--;
			selectedInPass = true;
		}
		if ( !selectedInPass ) {
			break;
		}
	}

	if ( remainingDeletions > 0 ) {
		OSApp.Errors.showError( OSApp.Language._( "This backup cannot be restored without removing sensors referenced by its aggregate definitions." ) );
		return;
	}

	// Only preserved target-only aggregates add dependencies to the final state.
	targetOnlySensors.forEach( function( sensor ) {
		if ( sensor.type !== 0 || hasOwn( plannedDeletedSensorUUIDs, String( sensor.uuid ) ) ||
			!sensor.extra || !Array.isArray( sensor.extra.children ) ) {
			return;
		}
		sensor.extra.children.forEach( function( child ) {
			if ( child.uuid ) {
				aggregateChildUUIDs[ String( child.uuid ) ] = true;
			}
		} );
	} );

	for ( sensorKey in aggregateChildUUIDs ) {
		if ( hasOwn( aggregateChildUUIDs, sensorKey ) && !hasOwn( backupSensorUUIDs, sensorKey ) &&
			( !hasOwn( activeSensorUUIDs, sensorKey ) || hasOwn( plannedDeletedSensorUUIDs, sensorKey ) ) ) {
			OSApp.Errors.showError( OSApp.Language._( "Sensor definitions in this backup reference unavailable child sensors." ) );
			return;
		}
	}

	// Reject incompatible program data before making any changes to the controller.
	if ( programs.length > 0 && sourceFirmwareVersion !== null && sourceFirmwareVersion >= 210 &&
		( OSApp.Firmware.isOSPi() || !OSApp.Firmware.checkOSVersion( 210 ) ) ) {
		OSApp.Errors.showError( OSApp.Language._( "Program data is newer than the device firmware and cannot be imported" ) );
		return;
	}

	if ( OSApp.Firmware.checkOSVersion( 210 ) && data.options !== null && typeof data.options === "object" && (
		data.options.hp0 !== importController.options.hp0 || data.options.hp1 !== importController.options.hp1 ||
		data.options.dhcp !== importController.options.dhcp || data.options.devid !== importController.options.devid ) ) {

		warning = OSApp.Language._( "Warning: Network changes will be made and the device may no longer be accessible from this address." );
	}

	var hasMissingAdjustmentSensor = programs.some( function( prog ) {
			var adjustment = prog[ 7 ];
			return adjustment && typeof adjustment === "object" && String( adjustment.uuid || 0 ) !== "0" &&
				!hasOwn( backupSensorUUIDs, String( adjustment.uuid ) ) &&
				( !hasOwn( activeSensorUUIDs, String( adjustment.uuid ) ) || hasOwn( plannedDeletedSensorUUIDs, String( adjustment.uuid ) ) );
		} );

	if ( sensorsToDelete.length > 0 ) {
		warning += ( warning ? "<br><br>" : "" ) + OSApp.Language._(
			"The controller is at its sensor limit. Restoring this backup will delete sensor definitions that exist only on this controller."
		);
	}
	if ( hasMissingAdjustmentSensor ) {
		warning += ( warning ? "<br><br>" : "" ) + OSApp.Language._(
			"Program sensor adjustments that reference a sensor absent from both the backup and this controller will be disabled."
		);
	}

	return OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to restore the configuration?" ), warning, function() {
		if ( OSApp.currentSession !== importSession || OSApp.currentSession.controller !== importController ) {
			OSApp.Errors.showError( OSApp.Language._( "The active controller changed. Please restart the restore." ) );
			return;
		}
		$.mobile.loading( "show" );

		var cs = "/cs?pw=",
			co = "/co?pw=",
			cpStart = "/cp?pw=",
			ncs = Math.ceil( data.stations.snames.length / 16 ),
			csi = new Array( ncs ).fill( "/cs?pw=" ),
			isPi = OSApp.Firmware.isOSPi(),
			baseCommands = [],
			importFailureMessage = OSApp.Language._( "Unable to import configuration. The restore stopped before completion; review the controller before retrying." ),
			supportsDateRange = OSApp.Supported.dateRange(),
			supportsSensors = OSApp.Supported.sensors(),
			i, k, key, option, station;

		var findKey = function( index ) { return OSApp.Constants.keyIndex[ index ] === key; };

		for ( i in data.options ) {
			if ( Object.prototype.hasOwnProperty.call(data.options,  i ) && Object.prototype.hasOwnProperty.call(OSApp.Constants.keyIndex,  i ) ) {
				key = OSApp.Constants.keyIndex[ i ];
				if ( $.inArray( key, [ 2, 14, 16, 21, 22, 25, 36 ] ) !== -1 && data.options[ i ] === 0 ) {
					continue;
				}
				if ( key === 3 ) {
					if ( OSApp.Firmware.checkOSVersion( 210 ) && importController.options.dhcp === 1 ) {
						co += "&o3=1";
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
				if ( typeof option === "string" ) {
					option = encodeURIComponent( option );
				}
				co += "&o" + key + "=" + option;
			}
		}

		// Handle import from versions prior to 2.1.1 for enable logging flag
		if ( !isPi && sourceFirmwareVersion !== null && sourceFirmwareVersion < 211 && OSApp.Firmware.checkOSVersion( 211 ) ) {

			// Enables logging since prior firmwares always had logging enabled
			co += "&o36=1";
		}

		// Import Weather Adjustment Options, if available
		if ( typeof data.settings.wto === "object" && OSApp.Firmware.checkOSVersion( 215 ) ) {
			co += "&wto=" + encodeURIComponent( OSApp.Utils.escapeJSON( data.settings.wto ) );
		}

		// Import IFTTT Key, if available
		if ( typeof data.settings.ifkey === "string" && OSApp.Firmware.checkOSVersion( 217 ) ) {
			co += "&ifkey=" + encodeURIComponent( data.settings.ifkey );
		}

		// Import device name, if available
		if ( typeof data.settings.dname === "string" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			co += "&dname=" + encodeURIComponent( data.settings.dname );
		}

		// Import mqtt options, if available
		if ( typeof data.settings.mqtt === "object" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			co += "&mqtt=" + encodeURIComponent( OSApp.Utils.escapeJSON( data.settings.mqtt ) );
			}

		//Import email options, if available
		if ( typeof data.settings.email === "object" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			co += "&email=" + encodeURIComponent( OSApp.Utils.escapeJSON( data.settings.email ) );
			}

		if ( typeof data.settings.otc === "object" && OSApp.Firmware.checkOSVersion( 2191 ) ) {
			co += "&otc=" + encodeURIComponent( OSApp.Utils.escapeJSON( data.settings.otc ) );
			}

		co += "&" + ( isPi ? "o" : "" ) + "loc=" + encodeURIComponent( data.settings.loc );

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
			cs += "&m" + i + "=" + data.stations.masop[ i ];
		}

		if ( typeof data.stations.masop2 === "object" ) {
			for ( i = 0; i < data.stations.masop2.length; i++ ) {
				cs += "&n" + i + "=" + data.stations.masop2[ i ];
			}
		}

		if ( typeof data.stations.masop3 === "object" ) {
			for ( i = 0; i < data.stations.masop3.length; i++ ) {
				cs += "&u" + i + "=" + data.stations.masop3[ i ];
			}
		}

		if ( typeof data.stations.masop4 === "object" ) {
			for ( i = 0; i < data.stations.masop4.length; i++ ) {
				cs += "&v" + i + "=" + data.stations.masop4[ i ];
			}
		}

		if ( typeof data.stations.ignore_rain === "object" ) {
			for ( i = 0; i < data.stations.ignore_rain.length; i++ ) {
				cs += "&i" + i + "=" + data.stations.ignore_rain[ i ];
			}
		}

		if ( typeof data.stations.ignore_sn1 === "object" ) {
			for ( i = 0; i < data.stations.ignore_sn1.length; i++ ) {
				cs += "&j" + i + "=" + data.stations.ignore_sn1[ i ];
			}
		}

		if ( typeof data.stations.ignore_sn2 === "object" ) {
			for ( i = 0; i < data.stations.ignore_sn2.length; i++ ) {
				cs += "&k" + i + "=" + data.stations.ignore_sn2[ i ];
			}
		}

		if ( typeof data.stations.ignore_sn3 === "object" ) {
			for ( i = 0; i < data.stations.ignore_sn3.length; i++ ) {
				cs += "&o" + i + "=" + data.stations.ignore_sn3[ i ];
			}
		}

		if ( typeof data.stations.ignore_sn4 === "object" ) {
			for ( i = 0; i < data.stations.ignore_sn4.length; i++ ) {
				cs += "&r" + i + "=" + data.stations.ignore_sn4[ i ];
			}
		}

		if ( typeof data.stations.stn_dis === "object" ) {
			for ( i = 0; i < data.stations.stn_dis.length; i++ ) {
				cs += "&d" + i + "=" + data.stations.stn_dis[ i ];
			}
		}

		if ( typeof data.stations.stn_spe === "object" ) {
			for ( i = 0; i < data.stations.stn_spe.length; i++ ) {
				cs += "&p" + i + "=" + data.stations.stn_spe[ i ];
			}
		}

		if ( typeof data.stations.stn_seq === "object" ) {
			for ( i = 0; i < data.stations.stn_seq.length; i++ ) {
				cs += "&q" + i + "=" + data.stations.stn_seq[ i ];
			}
		} else if ( !isPi && sourceFirmwareVersion !== null && sourceFirmwareVersion < 211 && !OSApp.Firmware.checkOSVersion( 211 ) ) {
			var bid;
			for ( bid = 0; bid < data.settings.nbrd; bid++ ) {
				cs += "&q" + bid + "=" + ( data.options.seq === 1 ? 255 : 0 );
			}
		}

		if ( typeof data.stations.act_relay === "object" ) {
			for ( i = 0; i < data.stations.act_relay.length; i++ ) {
				cs += "&a" + i + "=" + data.stations.act_relay[ i ];
			}
		}

		// Normalize station special data object
		data.special = data.special || {};

		baseCommands.push( OSApp.Utils.transformKeysinString( co ), cs );
		baseCommands = baseCommands.concat( csi );

		var buildProgramCommand = function( sourceProgram, index ) {
			var prog = sourceProgram.slice(),
				// ProgramStruct defaults to the full valid firmware date range. Use
				// those values for older 2.1 backups that predate date metadata.
				dateRange = supportsDateRange ? "&endr=0&from=33&to=415" : "",
				name = "",
				sensorAdjustment = supportsSensors ? "&snadj=0,0" : "";

			// The firmware does not accept 2.1+ program metadata inside the program array.
			if ( !isPi && sourceFirmwareVersion !== null && sourceFirmwareVersion >= 210 && OSApp.Firmware.checkOSVersion( 210 ) ) {
				name = "&name=" + encodeURIComponent( prog[ 5 ] );

				if ( supportsDateRange && Array.isArray( prog[ 6 ] ) && prog[ 6 ].length >= 3 ) {
					dateRange = "&endr=" + ( prog[ 6 ][ 0 ] ? 1 : 0 ) + "&from=" + prog[ 6 ][ 1 ] + "&to=" + prog[ 6 ][ 2 ];
				}

				var adjustment = prog[ 7 ],
					mappedUUID = adjustment && typeof adjustment === "object" ? resolveSensorUUID( adjustment.uuid ) : 0;
				if ( supportsSensors && mappedUUID > 0 && adjustment &&
					( typeof adjustment.flag !== "undefined" || typeof adjustment.uuid !== "undefined" || Array.isArray( adjustment.splits ) ) ) {
					var adjustmentParts = [ adjustment.flag || 0, mappedUUID ];
					if ( Array.isArray( adjustment.splits ) ) {
						adjustment.splits.forEach( function( split ) {
							adjustmentParts.push( split.x, split.y );
						} );
					}
					sensorAdjustment = "&snadj=" + adjustmentParts.join( "," );
				}

				prog = prog.slice( 0, 5 );
			}

			// Handle data from firmware prior to 2.1 being imported to a 2.1+ device.
			if ( !isPi && sourceFirmwareVersion !== null && sourceFirmwareVersion < 210 && OSApp.Firmware.checkOSVersion( 210 ) ) {
				var program = OSApp.Programs.readProgram183( prog ),
					total = ( prog.length - 7 ),
					allDur = [],
					j = 0,
					bits, n, s;

				j |= ( program.en << 0 );
				if ( program.is_even ) {
					j |= ( 2 << 2 );
				} else if ( program.is_odd ) {
					j |= ( 1 << 2 );
				}
				if ( program.type === OSApp.Constants.options.PROGRAM_TYPE_INTERVAL ) {
					j |= ( 3 << 4 );
				} else if ( program.type === OSApp.Constants.options.PROGRAM_TYPE_MONTHLY ) {
					j |= ( 2 << 4 );
				} else if ( program.type === OSApp.Constants.options.PROGRAM_TYPE_SINGLERUN ) {
					j |= ( 1 << 4 );
				}

				prog[ 0 ] = j;
				for ( n = 0; n < total; n++ ) {
					bits = prog[ 7 + n ];
					for ( s = 0; s < 8; s++ ) {
						allDur.push( ( bits & ( 1 << s ) ) ? program.duration : 0 );
					}
				}
				prog[ 3 ] = [ program.start, parseInt( ( program.end - program.start ) / program.interval ), program.interval, 0 ];
				prog[ 4 ] = allDur;
				prog = prog.slice( 0, 5 );
				name = "&name=" + encodeURIComponent( OSApp.Language._( "Program" ) + " " + ( index + 1 ) );
			}

			return cpStart + "&pid=-1&v=" + JSON.stringify( prog ) + name + dateRange + sensorAdjustment;
		};

		$.each( data.special, function( sid, info ) {
			if ( OSApp.Firmware.checkOSVersion( 216 ) ) {
				baseCommands.push( "/cs?pw=&sid=" + sid + "&st=" + info.st + "&sd=" + encodeURIComponent( info.sd ) );
			}
		} );

		var isImportContextCurrent = function() {
				return OSApp.currentSession === importSession && OSApp.currentSession.controller === importController;
			},
			rejectImport = function( message ) {
				if ( message ) {
					importFailureMessage = message;
				}
				return $.Deferred().reject().promise();
			},
			sendImportRequest = function( command, type ) {
				var staleMessage = OSApp.Language._( "The active controller changed. The restore was stopped before completion." );
				if ( !isImportContextCurrent() ) {
					return rejectImport( staleMessage );
				}
				return OSApp.Firmware.sendToOS( command, type ).then( function( response ) {
					return isImportContextCurrent() ? response : rejectImport( staleMessage );
				} );
			},
			sendCommands = function( commands ) {
			var commandSequence = $.Deferred().resolve().promise();
			$.each( commands, function( index, command ) {
				commandSequence = commandSequence.then( function() {
					return sendImportRequest( command );
				} );
			} );
			return commandSequence;
		},
			readSensors = function() {
				return sendImportRequest( "/jsn?pw=", "json" ).then( function( snapshot ) {
					if ( !snapshot || !Array.isArray( snapshot.sn ) ) {
						return rejectImport( OSApp.Language._( "Unable to verify sensor definitions during import. The restore was stopped." ) );
					}
					var uuids = Object.create( null ),
						valid = snapshot.sn.every( function( sensor ) {
							var uuid = Number( sensor.uuid ), key = String( sensor.uuid );
							if ( !Number.isInteger( uuid ) || uuid < 1 || uuid > 65535 || hasOwn( uuids, key ) ) {
								return false;
							}
							uuids[ key ] = uuid;
							return true;
						} );
					if ( !valid || ( hasOwn( snapshot, "count" ) &&
						( !Number.isInteger( snapshot.count ) || snapshot.count !== snapshot.sn.length ) ) ) {
						return rejectImport( OSApp.Language._( "Unable to verify sensor definitions during import. The restore was stopped." ) );
					}
					return { sensors: snapshot.sn, uuids: uuids };
				} );
			},
			preflightSensors = function() {
				if ( backupSensors.length === 0 ) {
					return $.Deferred().resolve().promise();
				}
				return sendImportRequest( "/jsd?pw=", "json" ).then( function( rawDescription ) {
					if ( !rawDescription || typeof rawDescription !== "object" ) {
						return rejectImport( OSApp.Language._( "Unable to validate sensor definitions on this controller. No configuration changes were made." ) );
					}
					var description = rawDescription.sensors && rawDescription.sensors.length > 0 && rawDescription.sensors[ 0 ].name ?
						rawDescription : OSApp.Sensors.normalizeJsd( rawDescription );
					if ( !backupSensors.every( function( sensor ) {
						return OSApp.ImportExport.sensorDefinitionSupported( sensor, description, targetSensors );
					} ) ) {
						return rejectImport( OSApp.Language._( "This backup contains sensor definitions that are not supported by this controller." ) );
					}
					return description;
				} );
			},
			sequence = preflightSensors().then( function() {
				return sendCommands( baseCommands );
			} );

		// Make only the capacity-required deletions, and do them serially.
		$.each( sensorsToDelete, function( index, sensor ) {
			sequence = sequence.then( function() {
				return sendImportRequest( "/dsn?pw=&uuid=" + sensor.uuid );
			} ).then( function() {
				delete activeSensorUUIDs[ String( sensor.uuid ) ];
			} );
		} );

		// Update matching UUIDs and allocate missing sensors in backup order. Aggregate
		// children are deliberately omitted until every source UUID has a mapping.
		$.each( backupSensors, function( index, sensor ) {
			var sourceUUID = String( sensor.uuid );
			sequence = sequence.then( function() {
				if ( hasOwn( sensorUUIDMap, sourceUUID ) ) {
					return sendImportRequest( OSApp.ImportExport.buildSensorImportCommand(
						sensor, sensorUUIDMap[ sourceUUID ], sensor.type !== 0, resolveSensorUUID
					) );
				}

				var beforeCount = Object.keys( activeSensorUUIDs ).length;
				return sendImportRequest( OSApp.ImportExport.buildSensorImportCommand(
					sensor, -1, sensor.type !== 0, resolveSensorUUID
				) ).then( readSensors ).then( function( snapshot ) {
					var added = Object.keys( snapshot.uuids ).filter( function( uuid ) {
						return !hasOwn( activeSensorUUIDs, uuid );
					} );
					if ( added.length !== 1 || snapshot.sensors.length !== beforeCount + 1 ) {
						return rejectImport( OSApp.Language._( "Unable to determine the UUID assigned to a restored sensor. The restore was stopped." ) );
					}
					activeSensorUUIDs = snapshot.uuids;
					sensorUUIDMap[ sourceUUID ] = snapshot.uuids[ added[ 0 ] ];
				} );
			} );
		} );

		// A second aggregate pass safely remaps forward references and cycles.
		$.each( backupSensors, function( index, sensor ) {
			if ( sensor.type !== 0 ) {
				return;
			}
			sequence = sequence.then( function() {
				var mappedUUID = resolveSensorUUID( sensor.uuid );
				if ( mappedUUID === 0 ) {
					return rejectImport( OSApp.Language._( "Unable to map an aggregate sensor during import. The restore was stopped." ) );
				}
				return sendImportRequest( OSApp.ImportExport.buildSensorImportCommand(
					sensor, mappedUUID, true, resolveSensorUUID
				) );
			} );
		} );

		if ( backupSensors.length > 0 ) {
			sequence = sequence.then( readSensors ).then( function( snapshot ) {
				activeSensorUUIDs = snapshot.uuids;
				var verified = backupSensors.every( function( sensor ) {
					var mappedUUID = resolveSensorUUID( sensor.uuid ),
						actual = snapshot.sensors.find( function( candidate ) {
							return Number( candidate.uuid ) === Number( mappedUUID );
						} );
					return mappedUUID > 0 && OSApp.ImportExport.sensorDefinitionMatches( sensor, actual, resolveSensorUUID );
				} );
				if ( !verified ) {
					return rejectImport( OSApp.Language._( "Restored sensor definitions did not pass verification. The restore was stopped before programs were changed." ) );
				}
			} );
		}

		// Erase must settle before ordered /cp appends begin.
		sequence = sequence.then( function() {
			return sendImportRequest( "/dp?pw=&pid=-1" );
		} );

		$.each( programs, function( index, program ) {
			sequence = sequence.then( function() {
				return sendImportRequest( buildProgramCommand( program, index ) );
			} );
		} );

		return sequence.then(
			function() {
				setTimeout( function() {
					if ( !isImportContextCurrent() ) {
						$.mobile.loading( "hide" );
						OSApp.Errors.showError( OSApp.Language._( "The active controller changed. The restore finished without refreshing the new controller." ) );
						return;
					}
					OSApp.Sites.updateController(
						function() {
							$.mobile.loading( "hide" );
							OSApp.Errors.showError( OSApp.Language._( "Backup restored to your device" ) );
							OSApp.Weather.updateWeather();
							OSApp.UIDom.goHome( true );
						},
						function() {
							$.mobile.loading( "hide" );
							OSApp.Network.networkFail();
						}
					);
				}, 1500 );
			},
			function() {
				$.mobile.loading( "hide" );
				OSApp.Errors.showError( importFailureMessage );
			}
		);
	} );
};

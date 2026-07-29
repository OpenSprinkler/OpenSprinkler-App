/*global google */

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

var parentWindow = window.parent,
    parentOrigin = "*",
    mapInitialized = false;

try {
    if ( document.referrer ) {
        parentOrigin = new URL( document.referrer ).origin;
    } else {
        // Same-origin parents expose their origin directly. Cross-origin access throws; in that
        // case retain `*` and rely on the independently checked WindowProxy (`e.source`).
        try {
            if ( parentWindow.location.origin && parentWindow.location.origin !== "null" ) {
                parentOrigin = parentWindow.location.origin;
            }
        } catch {
            parentOrigin = "*";
        }
    }
    if ( parentOrigin === "null" ) {
        parentOrigin = "*";
    }
} catch ( err ) {
    console.warn( "Unable to determine map parent origin", err );
}

function postMapMessage( data ) {
    parentWindow.postMessage( data, parentOrigin );
}

// Create the script tag, set the appropriate attributes
var script = document.createElement( "script" );
script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyDaT_HTZwFojXmvYIhwWudK00vFXzMmOKc&libraries=places&callback=initMap";
script.async = true;
script.onerror = function() {
    if ( !mapInitialized ) {
        postMapMessage( { mapError: true } );
    }
};

// Attach your callback function to the `window` object
window.initMap = function() {
    mapInitialized = true;
    var markers = { pws: [], origin: [] },
        stations = [],
        mapLoaded = false,
        priorIdle, map, infoWindow, droppedPin, start, current;

    function postToParent( data ) {
        postMapMessage( data );
    }

    function isCoordinate( value, minimum, maximum ) {
        return typeof value === "number" && Number.isFinite( value ) && value >= minimum && value <= maximum;
    }

    function hasCoordinates( value ) {
        return value && isCoordinate( value.lat, -90, 90 ) && isCoordinate( value.lon, -180, 180 );
    }

    function renderStations() {
        if ( !mapLoaded || !map ) {
            return;
        }
        removeAllMarkers();
        plotAllMarkers( stations );
    }

    function geocodeLabel( results ) {
        if ( !Array.isArray( results ) || results.length === 0 ) {
            return "";
        }

        var preferred = results.find( function( result ) {
                return result && Array.isArray( result.types ) && result.types.some( function( type ) {
                    return [ "locality", "sublocality", "postal_code", "street_address" ].indexOf( type ) > -1;
                } );
            } ),
            result = preferred || results[ 0 ],
            label = result && result.formatted_address;

        return typeof label === "string" && label.length <= 500 ? label : "";
    }

    /**
     * Reverse geocode through the Maps JavaScript client service. The browser-visible Maps JS key
     * remains website/API restricted; it is never reused in a directly callable web-service URL.
     */
    function submitSelection( button, includeStation ) {
        if ( button.disabled ) {
            return;
        }
        var latLon = String( button.dataset.loc || "" ),
            parts = latLon.split( "," ),
            lat = Number( parts[ 0 ] ),
            lon = Number( parts[ 1 ] ),
            message = { WS: latLon },
            settled = false,
            timeout,
            finish = function( label ) {
                if ( settled ) {
                    return;
                }
                settled = true;
                if ( timeout ) {
                    clearTimeout( timeout );
                }
                button.disabled = false;
                if ( typeof label === "string" && label !== "" ) {
                    message.locationName = label;
                }
                postToParent( message );
            };

        if ( includeStation && typeof button.dataset.id === "string" && button.dataset.id.length <= 100 ) {
            message.station = button.dataset.id;
        }
        if ( parts.length !== 2 || !isCoordinate( lat, -90, 90 ) || !isCoordinate( lon, -180, 180 ) ) {
            return;
        }

        button.disabled = true;
        timeout = setTimeout( function() { finish( "" ); }, 5000 );
        try {
            new google.maps.Geocoder().geocode( { location: { lat: lat, lng: lon } }, function( results, status ) {
                finish( status === "OK" ? geocodeLabel( results ) : "" );
            } );
        } catch {
            finish( "" );
        }
    }

    // Handle select button for weather station selection.
    document.addEventListener( "click", function( e ) {
        if ( e.target.tagName !== "BUTTON" ) {
            return;
        }
        var classes = e.target.className.split( " " );
        if ( classes.indexOf( "submitPWS" ) > -1 ) {
            submitSelection( e.target, true );
        } else if ( classes.indexOf( "submit" ) > -1 ) {
            submitSelection( e.target, false );
        }
    }, false );

    // Load the map using the controller's current location
    function initialize() {
        if ( typeof start === "object" ) {
            var myOptions = {
                zoom: 14,
                maxZoom: 17,
                center: start,
                streetViewControl: false,
                mapTypeControl: false,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                zoomControl: true,
                zoomControlOptions: {
                    position: google.maps.ControlPosition.LEFT_BOTTOM
                },
                styles: [
                    { featureType: "poi", elementType: "labels", stylers: [ { visibility: "off" } ] },
                    { featureType: "transit", elementType: "labels", stylers: [ { visibility: "off" } ] }
                ]
            };

            map = new google.maps.Map( document.getElementById( "map_canvas" ), myOptions );
            infoWindow = new google.maps.InfoWindow();

            // Setup SearchBox for auto completion
            var controlBox = document.getElementById( "customControls" ),
                searchField = document.getElementById( "pac-input" );

            if ( controlBox && searchField && google.maps.places && typeof google.maps.places.SearchBox === "function" ) {
                var searchBox = new google.maps.places.SearchBox( searchField );

                controlBox.style.display = "block";

                map.controls[ google.maps.ControlPosition.TOP_LEFT ].push( controlBox );

                // Bias the SearchBox results towards current map's viewport.
                map.addListener( "bounds_changed", function() {
                    searchBox.setBounds( map.getBounds() );
                } );

                searchBox.addListener( "places_changed", function() {
                    var places = searchBox.getPlaces(),
                        place = places && places[ 0 ],
                        location = place && place.geometry && place.geometry.location;
                    if ( !location || typeof location.lat !== "function" || typeof location.lng !== "function" ) {
                        return;
                    }

                    var latitude = Number( location.lat() ),
                        longitude = Number( location.lng() );
                    if ( !isCoordinate( latitude, -90, 90 ) || !isCoordinate( longitude, -180, 180 ) ) {
                        return;
                    }

                    if ( droppedPin ) {
                        droppedPin.setMap( null );
                        droppedPin = null;
                    }
                    droppedPin = plotMarker( "origin", { message: "Selected Location" }, latitude, longitude );
                    map.setCenter( droppedPin.getPosition() );
                } );
            }

            var jumpToCurrent = document.getElementById( "jumpCurrent" );

            // Bind the current location button
            if ( jumpToCurrent ) {
                jumpToCurrent.addEventListener( "click", function() {
                    postToParent( { getLocation: true } );
                } );
            }

            // If a start location is specified, display and center it now
            if ( start.lat() !== 0 && start.lng() !== 0 ) {
                droppedPin = plotMarker( "origin", { message: "Selected Location" }, start.lat(), start.lng() );
            }

            // Once the UI/tiles are loaded, let the parent script know
            google.maps.event.addListenerOnce( map, "tilesloaded", function() {
                mapLoaded = true;
                postToParent( { loaded: true } );
                renderStations();

                // Fix autocomplete field for iOS (blur event never fires and therefore redirection does not occur)
                if ( /iP(ad|hone|od)/.test( navigator.userAgent ) ) {
                    var predictionContainer = document.querySelectorAll( ".pac-container" )[ 0 ];

                    if ( predictionContainer ) {
                        predictionContainer.addEventListener( "mousedown", function() {
                            postToParent( { dismissKeyboard: true } );
                        } );
                    }

                }
            } );

            // When the map is clicked, close any open info windows
            google.maps.event.addListener( map, "click", function() {
                infoWindow.close();
            } );

            // Handle dropping of a new pin / location
            google.maps.event.addListener( map, "click", function( event ) {
                if ( droppedPin ) {
                    droppedPin.setMap( null );
                    droppedPin = null;
                }
                droppedPin = plotMarker( "origin", { message: "Selected Location" }, event.latLng.lat(), event.latLng.lng() );
            } );

            // When the map center changes, update the weather stations shown
            map.addListener( "idle", function() {
                if ( getDistance( map.getCenter(), priorIdle ) < 15000 || map.getZoom() < 9 ) {
                    return;
                }

                priorIdle = map.getCenter();
                removeAllMarkers();
                postToParent( {
                    location: [ map.getCenter().lat(), map.getCenter().lng() ]
                } );
            } );

        } else {
            setTimeout( initialize, 1 );
        }
    }

    // Handle communication from parent window
	    window.onmessage = function( e ) {
        var data = e.data;
		if ( e.source !== parentWindow || ( parentOrigin !== "*" && e.origin !== parentOrigin ) ||
			typeof data !== "object" || data === null ) {
			return;
		}

        // Handle start point data
        if ( data.type === "startLocation" && data.payload && hasCoordinates( data.payload.start ) ) {
            start = new google.maps.LatLng( data.payload.start.lat, data.payload.start.lon );
            priorIdle = start;
            initialize();

            // Handle stations data
        } else if ( data.type === "pwsData" && typeof data.payload === "string" && data.payload.length <= 200000 ) {
			try {
				var parsed = JSON.parse( decodeURIComponent( data.payload ) );
				if ( !Array.isArray( parsed ) || parsed.length > 500 ) {
					return;
				}
				stations = parsed.filter( function( station ) {
					return hasCoordinates( station ) && typeof station.message === "string" && station.message.length <= 200 &&
					( station.id === undefined || ( typeof station.id === "string" && station.id.length <= 100 ) );
				} );
			} catch ( err ) {
				console.warn( "Ignoring invalid weather-station map data", err );
				return;
			}
            renderStations();
        } else if ( data.type === "currentLocation" && data.payload && hasCoordinates( data.payload ) ) {
            if ( current && typeof current.setMap === "function" ) {
                current.setMap( null );
            }
            current = new google.maps.LatLng( data.payload.lat, data.payload.lon );
            showCurrentLocation();
        }
	    };
	    postToParent( { ready: true } );

	    // Plot all stations on the map
    function plotAllMarkers( items ) {
        for ( var i = 0; i < items.length; i++ ) {
            plotMarker( "pws", items[ i ], items[ i ].lat, items[ i ].lon );
        }
    }

    // Plot an individual station on the map
    function plotMarker( type, data, lat, lon ) {
        var marker = new google.maps.Marker( {
            position: new google.maps.LatLng( lat, lon ),
            map: map,
            icon: type === "origin" ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png" : "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        } );

        google.maps.event.addListener( marker, "click", function() {
            infoWindow.close();
            var content = createInfoWindow( type, data, lat + "," + lon );
            infoWindow = new google.maps.InfoWindow( {
                content: content
            } );
            infoWindow.open( map, marker );
        } );

        markers[ type ].push( marker );

        if ( data.message === "Selected Location" ) {
            google.maps.event.trigger( marker, "click" );
        }

        return marker;
    }

    // Removes markers of specified type
    function removeAllMarkers() {
        for ( var i = 0; i < markers.pws.length; i++ ) {
            markers.pws[ i ].setMap( null );
        }
        markers.pws = [];
    }

    // Create text for popup info window
    function createInfoWindow( type, data, latLon ) {
		var content = document.createElement( "div" ),
			button = document.createElement( "button" );
		content.style.minHeight = "40px";
		content.style.textAlign = "center";
		content.appendChild( document.createTextNode( String( data.message || "" ) ) );
		content.appendChild( document.createElement( "br" ) );
		content.appendChild( document.createElement( "br" ) );
		button.className = type === "pws" ? "submitPWS" : "submit";
		button.dataset.loc = latLon;
		if ( type === "pws" && data.id !== undefined ) {
			button.dataset.id = String( data.id );
		}
		button.textContent = "Submit";
		content.appendChild( button );
		return content;
    }

    function showCurrentLocation() {

        // The app uses -999, -999 when geolocation is not possible which is resolved to -90, 81
        if ( current.lat() !== -90 && current.lng() !== 81 ) {
            current = plotMarker( "origin", { message: "Current Location" }, current.lat(), current.lng() );

            map.setCenter( { lat: current.getPosition().lat(), lng: current.getPosition().lng() } );
            infoWindow.close();
            google.maps.event.trigger( current, "click" );
        }
    }

    function rad( x ) {
        return x * Math.PI / 180;
    }

    function getDistance( p1, p2 ) {
        var R = 6378137,
            dLat = rad( p2.lat() - p1.lat() ),
            dLong = rad( p2.lng() - p1.lng() ),
            a = Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) +
                Math.cos( rad( p1.lat() ) ) * Math.cos( rad( p2.lat() ) ) *
                Math.sin( dLong / 2 ) * Math.sin( dLong / 2 ),
            c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) );

        return R * c;
    }
};

// Append the 'script' element to 'head'
document.head.appendChild( script );

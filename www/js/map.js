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

window.google = window.google || {};
google.maps = google.maps || {};
( function() {
	function getScript( src ) {
	    var a = document.createElement( "script" );
	    a.src = src;
	    document.getElementsByTagName( "head" )[ 0 ].appendChild( a );
    }

    var modules = google.maps.modules = {};
    google.maps.__gjsload__ = function( name, text ) {
        modules[ name ] = text;
    };

	// jscs:disable
	// jshint ignore:start
    google.maps.Load = function( apiLoad ) {
        delete google.maps.Load;

        apiLoad([0.009999999776482582,[[["https://mts0.googleapis.com/vt?lyrs=m@292000000\u0026src=api\u0026hl=en-US\u0026","https://mts1.googleapis.com/vt?lyrs=m@292000000\u0026src=api\u0026hl=en-US\u0026"],null,null,null,null,"m@292000000",["https://mts0.google.com/vt?lyrs=m@292000000\u0026src=api\u0026hl=en-US\u0026","https://mts1.google.com/vt?lyrs=m@292000000\u0026src=api\u0026hl=en-US\u0026"]],[["https://khms0.googleapis.com/kh?v=166\u0026hl=en-US\u0026","https://khms1.googleapis.com/kh?v=166\u0026hl=en-US\u0026"],null,null,null,1,"166",["https://khms0.google.com/kh?v=166\u0026hl=en-US\u0026","https://khms1.google.com/kh?v=166\u0026hl=en-US\u0026"]],[["https://mts0.googleapis.com/vt?lyrs=h@292000000\u0026src=api\u0026hl=en-US\u0026","https://mts1.googleapis.com/vt?lyrs=h@292000000\u0026src=api\u0026hl=en-US\u0026"],null,null,null,null,"h@292000000",["https://mts0.google.com/vt?lyrs=h@292000000\u0026src=api\u0026hl=en-US\u0026","https://mts1.google.com/vt?lyrs=h@292000000\u0026src=api\u0026hl=en-US\u0026"]],[["https://mts0.googleapis.com/vt?lyrs=t@132,r@292000000\u0026src=api\u0026hl=en-US\u0026","https://mts1.googleapis.com/vt?lyrs=t@132,r@292000000\u0026src=api\u0026hl=en-US\u0026"],null,null,null,null,"t@132,r@292000000",["https://mts0.google.com/vt?lyrs=t@132,r@292000000\u0026src=api\u0026hl=en-US\u0026","https://mts1.google.com/vt?lyrs=t@132,r@292000000\u0026src=api\u0026hl=en-US\u0026"]],null,null,[["https://cbks0.googleapis.com/cbk?","https://cbks1.googleapis.com/cbk?"]],[["https://khms0.googleapis.com/kh?v=84\u0026hl=en-US\u0026","https://khms1.googleapis.com/kh?v=84\u0026hl=en-US\u0026"],null,null,null,null,"84",["https://khms0.google.com/kh?v=84\u0026hl=en-US\u0026","https://khms1.google.com/kh?v=84\u0026hl=en-US\u0026"]],[["https://mts0.googleapis.com/mapslt?hl=en-US\u0026","https://mts1.googleapis.com/mapslt?hl=en-US\u0026"]],[["https://mts0.googleapis.com/mapslt/ft?hl=en-US\u0026","https://mts1.googleapis.com/mapslt/ft?hl=en-US\u0026"]],[["https://mts0.googleapis.com/vt?hl=en-US\u0026","https://mts1.googleapis.com/vt?hl=en-US\u0026"]],[["https://mts0.googleapis.com/mapslt/loom?hl=en-US\u0026","https://mts1.googleapis.com/mapslt/loom?hl=en-US\u0026"]],[["https://mts0.googleapis.com/mapslt?hl=en-US\u0026","https://mts1.googleapis.com/mapslt?hl=en-US\u0026"]],[["https://mts0.googleapis.com/mapslt/ft?hl=en-US\u0026","https://mts1.googleapis.com/mapslt/ft?hl=en-US\u0026"]],[["https://mts0.googleapis.com/mapslt/loom?hl=en-US\u0026","https://mts1.googleapis.com/mapslt/loom?hl=en-US\u0026"]]],["en-US","US",null,0,null,null,"https://maps.gstatic.com/mapfiles/","https://csi.gstatic.com","https://maps.googleapis.com","https://maps.googleapis.com",null,"https://maps.google.com","https://csi.gstatic.com","https://maps.gstatic.com/maps-api-v3/api/images/"],["https://maps.gstatic.com/maps-api-v3/api/js/19/10","3.19.10"],[1958094959],1,null,null,null,null,null,"",null,null,1,"https://khms.googleapis.com/mz?v=166\u0026",null,"https://earthbuilder.googleapis.com","https://earthbuilder.googleapis.com",null,"https://mts.googleapis.com/vt/icon",[["https://mts0.googleapis.com/vt","https://mts1.googleapis.com/vt"],["https://mts0.googleapis.com/vt","https://mts1.googleapis.com/vt"],null,null,null,null,null,null,null,null,null,null,["https://mts0.google.com/vt","https://mts1.google.com/vt"],"/maps/vt",292000000,132],2,500,[null,"https://g0.gstatic.com/landmark/tour","https://g0.gstatic.com/landmark/config","","https://www.google.com/maps/preview/log204","","https://static.panoramio.com.storage.googleapis.com/photos/",["https://geo0.ggpht.com/cbk","https://geo1.ggpht.com/cbk","https://geo2.ggpht.com/cbk","https://geo3.ggpht.com/cbk"]],["https://www.google.com/maps/api/js/master?pb=!1m2!1u19!2s10!2sen-US!3sUS!4s19/10","https://www.google.com/maps/api/js/widget?pb=!1m2!1u19!2s10!2sen-US"],null,0,0], loadScriptTime);
    };

    var loadScriptTime = new Date().getTime();

    // jshint ignore:end
    // jscs:enable
    getScript( "https://maps.gstatic.com/maps-api-v3/api/js/19/10/main.js" );
} )();

var markers = { airport: [], pws: [], orgin: [] },
    centerChangeEvent = false,
    map, infoWindow, start, stations, airports, droppedPin, current;

// Handle select button for weather station selection
document.addEventListener( "click", function( e ) {
    var classes = e.target.className.split( " " );
    if ( classes.indexOf( "submit" ) > -1 ) {
        window.top.postMessage( { WS: e.target.dataset.loc }, "*" );
    }
}, false );

// Load the map using the current location as the starting point
function initialize() {
    if ( typeof start === "object" ) {
        var myOptions = {
            zoom: 14,
            maxZoom: 17,
            center: current,
            streetViewControl: false,
            mapTypeControl: false,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        map = new google.maps.Map( document.getElementById( "map_canvas" ), myOptions );
        infoWindow = new google.maps.InfoWindow();

        // If a current location is specified, show the current location button
        // The app uses -999, -999 when geolocation is not possible which is resolved to -90, 81
        if ( start.lat() !== -90 && start.lng() !== 81 ) {

			// Create the DIV to hold the custom control and call the constructor
			var currentLocationDiv = document.createElement( "div" );
			new currentLocationControl( currentLocationDiv, map );

			currentLocationDiv.index = 1;
			map.controls[ google.maps.ControlPosition.TOP_CENTER ].push( currentLocationDiv );
			start = plotMarker( "orgin", { message: "Current Location" }, start.lat(), start.lng() );
		}

        // If a current location is specified, display and center it now
        if ( current.lat() !== 0 && current.lng() !== 0 ) {
            droppedPin = plotMarker( "orgin", { message: "Selected Location" }, current.lat(), current.lng() );
            var bounds = new google.maps.LatLngBounds();
            bounds.extend( current );
            centerChangeEvent = true;
            map.fitBounds( bounds );
        }

        // Once the UI/tiles are loaded, let the parent script know
        google.maps.event.addListenerOnce( map, "tilesloaded", function() {
            window.top.postMessage( { "loaded": true }, "*" );
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
            droppedPin = plotMarker( "orgin", { message: "Selected Location" }, event.latLng.lat(), event.latLng.lng() );
        } );

        // When the map center changes, update the weather stations shown
        map.addListener( "center_changed", function() {

            if ( centerChangeEvent === false ) {

                // Delay 3 seconds after the center of the map has changed before firing
                window.setTimeout( function() {
                    centerChangeEvent = false;
                    removeAllMarkers();
                    window.top.postMessage( {
                        location: [ map.getCenter().lat(), map.getCenter().lng() ]
                    }, "*" );
                }, 3000 );
            }

            centerChangeEvent = true;
        } );

        google.maps.event.addListener( map, "zoom_changed", function() {

            // Clear change event flag after fitBounds call
            centerChangeEvent = false;
        } );
    } else {
        setTimeout( initialize, 1 );
    }
}

// Handle communication from parent window
window.onmessage = function( e ) {
    var data = e.data;

    // Handle start point data
    if ( data.type === "currentLocation" ) {
        start = new google.maps.LatLng( data.payload.start.lat, data.payload.start.lon );
        current = new google.maps.LatLng( data.payload.current.lat, data.payload.current.lon );
        initialize();

    // Handle stations data
    } else if ( data.type === "pwsData" ) {
        stations = JSON.parse( decodeURIComponent( data.payload ) );
        removeMarkers( "pws" );
        plotAllMarkers( stations, true );
    } else if ( data.type === "airportData" ) {
        airports = JSON.parse( decodeURIComponent( data.payload ) );
        removeMarkers( "airport" );
        plotAllMarkers( airports );
    }
};

// Plot all stations on the map
function plotAllMarkers( markers, areStations ) {
    var marker;

    for ( var i = 0; i < markers.length; i++ ) {
        marker = plotMarker( ( areStations ? "pws" : "airport" ), markers[ i ], markers[ i ].lat, markers[ i ].lon );
    }
}

// Plot an individual station on the map
function plotMarker( type, data, lat, lon ) {
    var marker = new google.maps.Marker( {
            position: new google.maps.LatLng( lat, lon ),
            map: map,
            icon: ( type === "orgin" ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png" :
                ( type ===  "pws" ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" : "http://maps.google.com/mapfiles/ms/icons/orange-dot.png" ) )
        } );

    google.maps.event.addListener( marker, "click", function() {
        infoWindow.close();
        var html = createInfoWindow( type, data, lat + "," + lon );
        infoWindow = new google.maps.InfoWindow( {
            content: html
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
function removeMarkers( type ) {
    for ( var i = 0; i < markers[ type ].length; i++ ) {
        markers[ type ][ i ].setMap( null );
    }
    markers[ type ] = [];
}

// Remove all markers
function removeAllMarkers() {
    removeMarkers( "pws" );
    removeMarkers( "airport" );
}

// Create text for popup info window
function createInfoWindow( type, data, latLon ) {
    if ( type === "pws" ) {
        return "<div style='min-height:90px;min-width:170px;text-align:center;'><h3 style='padding:0;margin:0 0 4px 0'>" +
                ( data.city ? data.city + ", " : "" ) + ( data.state ? data.state + ", " : "" ) + data.country +
            "</h3><span style='font-size:8px;margin:0;padding:0;vertical-align: top'>ID: " + data.id + "</span><br><p style='margin:0'>" +
                data.neighborhood + "<br>" + data.distance_mi + " mile" + ( data.distance_mi > 1 ? "s" : "" ) + " away<br>" +
                "<button class='submit' data-loc='" + latLon + "'>Select</button>" +
            "</p></div>";
    } else if ( type === "airport" ) {
        return "<div style='min-height:80px;min-width:170px;text-align:center;'><h3 style='padding:0;margin:0 0 4px 0'>" +
                ( data.city ? data.city + ", " : "" ) + ( data.state ? data.state + ", " : "" ) + data.country +
            "</h3><span style='font-size:8px;margin:0;padding:0;vertical-align: top'>Airport ICAO: " + data.icao + "</span><br>" +
            "<button class='submit' data-loc='" + latLon + "'>Select</button></div>";
    } else {
        return "<div style='min-height:40px;text-align:center'>" + data.message + "<br><br><button class='submit' data-loc='" + latLon + "'>Submit</button></div>";
    }
}

/**
 * The CenterControl adds a control to the map that recenters the map on Chicago.
 * This constructor takes the control DIV as an argument.
 * @constructor
 */
function currentLocationControl( controlDiv ) {

	// Set CSS for the control border
	var controlUI = document.createElement( "div" );
	controlUI.style.backgroundColor = "#fff";
	controlUI.style.border = "2px solid #fff";
	controlUI.style.borderRadius = "3px";
	controlUI.style.boxShadow = "0 2px 6px rgba(0,0,0,.3)";
	controlUI.style.cursor = "pointer";
	controlUI.style.marginBottom = "22px";
	controlUI.style.textAlign = "center";
	controlUI.title = "Click to move to current location";
	controlDiv.appendChild( controlUI );

	// Set CSS for the control interior
	var controlText = document.createElement( "div" );
	controlText.style.color = "rgb(25,25,25)";
	controlText.style.fontFamily = "Roboto,Arial,sans-serif";
	controlText.style.fontSize = "16px";
	controlText.style.lineHeight = "38px";
	controlText.style.paddingLeft = "5px";
	controlText.style.paddingRight = "5px";
	controlText.innerHTML = "Jump to Current Location";
	controlUI.appendChild( controlText );

	// Setup the click event listeners: simply set the map to Chicago.
	controlUI.addEventListener( "click", function() {
		infoWindow.close();
		map.setCenter( { lat: start.getPosition().lat(), lng: start.getPosition().lng() } );
		google.maps.event.trigger( start, "click" );
	} );
}

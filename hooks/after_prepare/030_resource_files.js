#!/usr/bin/env node

//
// This hook copies various resource files from our version control system directories into the appropriate platform specific location
//

// configure all the files to copy.  Key of object is the source file, value is the destination location.  It's fine to put all platforms' icons and splash screen files here, even if we don't build for all platforms on each developer's box.
var filestocopy = [ {
    "res/android/icons/xxhdpi.png": "platforms/android/res/drawable/icon.png"
}, {
    "res/android/icons/hdpi.png": "platforms/android/res/drawable-hdpi/icon.png"
}, {
    "res/android/icons/ldpi.png": "platforms/android/res/drawable-ldpi/icon.png"
}, {
    "res/android/icons/mdpi.png": "platforms/android/res/drawable-mdpi/icon.png"
}, {
    "res/android/icons/xhdpi.png": "platforms/android/res/drawable-xhdpi/icon.png"
}, {
    "res/android/icons/xxhdpi.png": "platforms/android/res/drawable-xxhdpi/icon.png"
}, {
    "res/android/screens/xhdpi.9.png": "platforms/android/res/drawable/splash.9.png"
}, {
    "res/android/screens/mhdpi.9.png": "platforms/android/res/drawable-mdpi/splash.9.png"
}, {
    "res/android/screens/xhdpi.9.png": "platforms/android/res/drawable-xhdpi/splash.9.png"
}, {
    "res/ios/icons/icon-57.png": "platforms/ios/OpenSprinkler/Resources/icons/icon-57.png"
}, {
    "res/ios/icons/icon-60@2x.png": "platforms/ios/OpenSprinkler/Resources/icons/icon-60@2x.png"
}, {
    "res/ios/icons/icon-60@3x.png": "platforms/ios/OpenSprinkler/Resources/icons/icon-60@3x.png"
}, {
    "res/ios/icons/icon-72.png": "platforms/ios/OpenSprinkler/Resources/icons/icon-72.png"
}, {
    "res/ios/icons/icon-72@2x.png": "platforms/ios/OpenSprinkler/Resources/icons/icon-72@2x.png"
}, {
    "res/ios/icons/icon-76.png": "platforms/ios/OpenSprinkler/Resources/icons/icon-76.png"
}, {
    "res/ios/icons/icon-76@2x.png": "platforms/ios/OpenSprinkler/Resources/icons/icon-76@2x.png"
}, {
    "res/ios/screens/startup-retina.png": "platforms/ios/OpenSprinkler/Resources/splash/Default@2x~iphone.png"
}, {
    "res/ios/screens/startup-iphone5-retina.png": "platforms/ios/OpenSprinkler/Resources/splash/Default-568h@2x~iphone.png"
}, {
    "res/ios/screens/startup.png": "platforms/ios/OpenSprinkler/Resources/splash/Default~iphone.png"
}, {
    "res/ios/screens/startup-tablet-landscape.png": "platforms/ios/OpenSprinkler/Resources/splash/Default-Landscape~ipad.png"
}, {
    "res/ios/screens/startup-tablet-landscape-retina.png": "platforms/ios/OpenSprinkler/Resources/splash/Default-Landscape@2x~ipad.png"
}, {
    "res/ios/screens/startup-tablet-portrait.png": "platforms/ios/OpenSprinkler/Resources/splash/Default-Portrait~ipad.png"
}, {
    "res/ios/screens/startup-tablet-portrait-retina.png": "platforms/ios/OpenSprinkler/Resources/splash/Default-Portrait@2x~ipad.png"
} ];

var fs = require( "fs" );
var path = require( "path" );

// no need to configure below
var rootdir = process.argv[2];

filestocopy.forEach( function( obj ) {
    Object.keys( obj ).forEach( function( key ) {
        var val = obj[key];
        var srcfile = path.join( rootdir, key );
        var destfile = path.join( rootdir, val );
        var destdir = path.dirname( destfile );
        if ( fs.existsSync( srcfile ) && fs.existsSync( destdir ) ) {
            fs.createReadStream( srcfile ).pipe( fs.createWriteStream( destfile ) );
        }
    } );
} );

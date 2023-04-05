#!/bin/sh
cp build.json platforms/android/build.json
cp network_security_config.xml /srv/www/htdocs/ui/platforms/android/app/src/main/res/xml/

cordova run android --debug -- --packageType=apk

cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/debug/app-debug.apk /data/app-debug.apk

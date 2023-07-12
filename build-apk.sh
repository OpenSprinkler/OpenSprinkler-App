#!/bin/sh
export JAVA_HOME=/usr/lib64/jvm/java-11-openjdk

cp build.json platforms/android/build.json
cp network_security_config.xml /srv/www/htdocs/ui/platforms/android/app/src/main/res/xml/

cordova run android --release -- --packageType=apk

cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/release/app-release.apk /data/app-release.apk

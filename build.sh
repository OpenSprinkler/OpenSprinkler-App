#!/bin/sh
rm ./www/js/*~
rm ./www/js/DEADJOE

grunt buildFW
cp build.json platforms/android/build.json
cp network_security_config.xml /srv/www/htdocs/ui/platforms/android/app/src/main/res/xml/

#Kompatible Version für alte Android:
mv config.xml config.xml.sav -f
xmlstarlet edit \
--update '//*[local-name()="preference"][@name="android-minSdkVersion"]/@value' \
--value "24" \
--update '//*[local-name()="preference"][@name="android-targetSdkVersion"]/@value' \
--value "33" \
config.xml.sav >config.xml

cordova platform remove android
cordova platform add android@12.0.1
cordova build --release
#cordova run android --release
cordova run android --release -- --packageType=apk

mv config.xml.sav config.xml -f
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/release/app-release.apk /srv/www/htdocs/opensprinklershop/firmware/ -v

#Und wieder zurück:
cordova platform remove android
cordova platform add android
cordova prepare
cordova build --release
cordova run android --release
cordova run android --release -- --packageType=apk

chown stefan:www platforms/* -R
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/bundle/release/app-release.aab /data/app-release.aab
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/release/app-release.apk /data/app-release.apk

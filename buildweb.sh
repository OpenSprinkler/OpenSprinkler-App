#!/bin/sh
rm ./www/js/*~ 2>/dev/null
rm ./www/js/DEADJOE 2>/dev/null
rm ./www/locale/*~ 2>/dev/null

#grunt buildFW
cd www/js
cat jquery.js libs.js main.js analog.js apexcharts.min.js >app.js
cd ..
cd ..

cp build.json platforms/android/build.json

cordova build browser --release
chown stefan:www platforms/* -R
./scripts/appGMK2.sh

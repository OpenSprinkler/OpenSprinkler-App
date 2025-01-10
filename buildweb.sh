#!/bin/sh
rm ./www/js/*~ 2>/dev/null
rm ./www/js/DEADJOE 2>/dev/null
rm ./www/locale/*~ 2>/dev/null
rm ./www/*~ 2>/dev/null

./scripts/appGMK.sh
grunt buildFW
#cd www/js
#cat jquery.js libs.js main.js analog.js apexcharts.min.js >app.js
#cd ..
#cd ..

cordova build browser --release
chown stefan:www platforms/* -R
./scripts/appGMK2.sh

rm ./platforms/browser/platform_www/plugins/* -R 2>/dev/null
rm ./platforms/browser/www/*.js 2>/dev/null

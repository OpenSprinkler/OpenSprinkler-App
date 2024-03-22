#!/bin/sh
rm ./www/js/*~
rm ./www/js/DEADJOE
rm ./www/locale/*~

#grunt buildFW
cd www/js
cat jquery.js libs.js main.js analog.js apexcharts.min.js >app.js
cd ..
cd ..

cp build.json platforms/android/build.json

cordova build browser --release
chown stefan:www platforms/* -R

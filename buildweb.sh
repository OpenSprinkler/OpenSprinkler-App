#!/bin/sh
rm ./www/js/*~
rm ./www/js/DEADJOE

grunt buildFW
cp build.json platforms/android/build.json

cordova build browser --release
chown stefan:www platforms/* -R

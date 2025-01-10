#!/bin/sh

echo "$GOOGLEMAPSAPIKEY"
if [[ $OSTYPE == 'darwin'* ]]; then
	sed -i "" "s/GOOGLEMAPSAPIKEY/$GOOGLEMAPSAPIKEY/g" www/js/*.js
	echo "macos"
else
	sed -i "s/GOOGLEMAPSAPIKEY/$GOOGLEMAPSAPIKEY/g" www/js/*.js
	echo "linux"
fi

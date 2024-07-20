#!/bin/sh

if [[ $OSTYPE == 'darwin'* ]]; then
	sed -i "" "s/$GOOGLEMAPSAPIKEY/GOOGLEMAPSAPIKEY/g" www/js/*.js
else
	sed -i "s/$GOOGLEMAPSAPIKEY/GOOGLEMAPSAPIKEY/g" www/js/*.js
fi

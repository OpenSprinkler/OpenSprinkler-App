#!/bin/sh

echo "$GOOGLEMAPSAPIKEY"
sed -i "" "s/GOOGLEMAPSAPIKEY/$GOOGLEMAPSAPIKEY/g" www/js/*.js

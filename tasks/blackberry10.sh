BUILD_DIR="/Users/salbahra/WebWorks Projects/sprinklers"

( cd "$BUILD_DIR/www/"; rm -r * )
cp -r * "$BUILD_DIR/www/"
( cd "$BUILD_DIR"; cordova build --release )
zip build/blackberry10/com.albahra.sprinklers.zip "$BUILD_DIR/platforms/blackberry10/build/device/bb10app.bar"

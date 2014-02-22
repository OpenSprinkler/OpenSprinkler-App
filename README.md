[OpenSprinkler Hosted Controller](http://salbahra.github.io/OpenSprinkler-Hosted-Controller)
========================

A mobile frontend for the OpenSprinkler irrigation device. Designed to allow manual control, program management (view, edit, delete and add), initiate a run-once program, view status, adjust rain delay, and change OpenSprinkler settings. Screenshots available below.

Warning:
--------

+ Currently, this application is based on an unreleased firmware. Although the dependencies are available in firmware 2.0.2; certain bugs prevent the app from working. The most prominent is an HTTP header error that prevents cross-origin calls for the JSON data. Additionally, previous firmwares have bugs in the output. Please look for a firmware newer than 2.0.3 for use with this app.
  + If you are using firmware 2.0.3 or lower please use the [2.0-master branch](https://github.com/salbahra/OpenSprinkler-Hosted-Controller/tree/2.0-master)

+ This app does not support OSPi for the above mentioned reasons plus the lack of JSON output.
  + If you are using OSPi/OSBo device and wish to host this on a web server, please use the [2.0-master branch](https://github.com/salbahra/OpenSprinkler-Hosted-Controller/tree/2.0-master)

Overview:
---------

+ This application interfaces with the interval program on the OpenSprinkler which is the default software available. The application has been tested and compatible with firmware 2.0.4+ however specifically does NOT support 1.8.3, 2.0.0, 2.0.1, 2.0.2, and 2.0.3.
  + If you are using firmware 2.0.3 or lower please use the [2.0-master branch](https://github.com/salbahra/OpenSprinkler-Hosted-Controller/tree/2.0-master)

+ The application is written in Javascript and HTML/CSS. The application runs 100% within the user's browser and communicates directly with the OpenSprinkler.

+ For current discussion about the project please refer to the [forum post](http://rayshobby.net/phpBB3/viewtopic.php?f=2&t=154). 

Video Tutorial:
---------------
[![Video Tutorial](https://img.youtube.com/vi/5pYHsMZSj6w/0.jpg)](https://www.youtube.com/watch?v=5pYHsMZSj6w)

Very well put together by Ray, thanks!

Screenshots:
------------

![Splash Screen](http://albahra.com/journal/wp-content/uploads/2013/07/startup-iphone5-retina-175x300.png) ![Home Screen](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Jan-26-2014-7.15.37-PM-169x300.png) ![Status Page](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Jan-26-2014-7.15.45-PM-169x300.png) ![Program Preview](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Feb-9-2014-4.25.52-PM-169x300.png) ![Program Editor](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Jan-26-2014-7.24.09-PM-169x300.png) ![Manual Program](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Jan-26-2014-7.24.18-PM-169x300.png) ![Rain Delay](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Feb-9-2014-4.23.45-PM-169x300.png) ![Run Once](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Jan-26-2014-7.24.54-PM-169x300.png) ![Settings](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Feb-9-2014-4.26.09-PM-169x300.png)


Install Instructions:
---------------------

```sh
#install files
git clone https://github.com/salbahra/OpenSprinkler-Hosted-Controller.git /var/www/sprinklers

```

+ Now, visit the site using any browser (replacing IPAddr with the server IP): http://IPAddr/sprinklers

> If you don't have Git, you can download the [ZIP](https://github.com/salbahra/OpenSprinkler-Controller/archive/master.zip) file and extract to a local directory.

> The webapp can also be installed to the SD card of the OpenSprinkler and run directly from the device. For this you will need to grab the specially formatted version from the sdcard branch.

Update Instructions:
--------------------

```sh
#change to the install directory
cd /var/www/sprinklers

#perform update
git pull
```

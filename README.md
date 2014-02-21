[OpenSprinkler Hosted Controller](http://salbahra.github.io/OpenSprinkler-Hosted-Controller)
========================

A mobile frontend for the OpenSprinkler irrigation device. Designed to allow manual control, program management (view, edit, delete and add), initiate a run-once program, view status, adjust rain delay, and change OpenSprinkler settings. Screenshots available below.

Overview:
---------

+ This application interfaces with the interval program on the OpenSprinkler which is the default software available. The application has been tested on firmware version 2.0.0 but should be compatible with 1.8.x and newer.

+ The provided interface does not rely on the javascript files hosted by Ray therefore will work on a locally hosted server even without an internet connection (with the local asset option enabled, which is disabled by default). However an internet connection (with a properly configured web server and port forwarding) will allow you to access the application from anywhere.

+ The application is written in Javascript and HTML/CSS.

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
> If you don't have Git, you can download the [ZIP](https://github.com/salbahra/OpenSprinkler-Controller/archive/master.zip) file and extract to a local directory.

+ Now, visit the site using any browser (replacing IPAddr with the server IP): http://IPAddr/sprinklers

> The webapp can also be installed to the SD card of the OpenSprinkler and run directly from the device. For this you will need to grab the specially formatted version from the sdcard branch.

Update Instructions:
--------------------

```sh
#change to the install directory
cd /var/www/sprinklers

#perform update
git pull
```

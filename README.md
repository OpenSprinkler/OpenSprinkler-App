[Sprinklers](http://salbahra.github.io/Sprinklers)
========================

A mobile interface for the OpenSprinkler irrigation device. Designed to allow manual control, program management (view, edit, delete and add), initiation of a run-once program, viewing device status, adjusting rain delay, and changing of OpenSprinkler settings. Screenshots available below.

Overview:
---------

+ This application is available for free from the [Amazon Appstore](http://www.amazon.com/dp/B00JYFL8LW), [Apple App Store](https://itunes.apple.com/us/app/sprinklers/id830988967?ls=1&mt=8), [BlackBerry AppWorld](http://appworld.blackberry.com/webstore/content/53161895/), [Google Play Store](https://play.google.com/store/apps/details?id=com.albahra.sprinklers) and [Windows Phone Store](http://www.windowsphone.com/en-us/store/app/sprinklers/3dbc5da0-b33f-4ca8-9e54-e80febf0a0c5)

+ This application interfaces with the interval program on the OpenSprinkler which is the default software available. The application has been tested and compatible with all firmwares. The application is also compatible with OSPi python interval program.

+ The application is written in Javascript and HTML/CSS. The application runs 100% within the user's browser and communicates directly with the OpenSprinkler.

+ For advanced users, the application supports authentication (HTTP Basic) and SSL for devices behind proxies. [Guide:](http://rayshobby.net/mediawiki/index.php?title=Secure_Remote_Access)

+ For current discussion about the project please refer to the [forum post](http://rayshobby.net/phpBB3/viewtopic.php?f=2&t=154).

Screenshots:
------------

![Splash Screen](http://albahra.com/journal/wp-content/uploads/2013/07/startup-iphone5-retina-175x300.png) ![Home Screen](http://albahra.com/journal/wp-content/uploads/2014/03/home-169x300.png) ![Status Page](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Jan-26-2014-7.15.45-PM-169x300.png) ![Program Preview](http://albahra.com/journal/wp-content/uploads/2014/03/preview-169x300.png) ![Program Editor](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Jan-26-2014-7.24.09-PM-169x300.png) ![Manual Program](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Jan-26-2014-7.24.18-PM-169x300.png) ![Rain Delay](http://albahra.com/journal/wp-content/uploads/2014/03/raindelay-169x300.png) ![Run Once](http://albahra.com/journal/wp-content/uploads/2014/02/iOS-Simulator-Screen-shot-Jan-26-2014-7.24.54-PM-169x300.png) ![Settings](http://albahra.com/journal/wp-content/uploads/2014/03/settings-169x300.png)


Install Instructions:
---------------------

```sh
#install files
git clone https://github.com/salbahra/Sprinklers.git /var/www/sprinklers

```

+ Now, visit the site using any browser (replacing IPAddr with the server IP): http://IPAddr/sprinklers

> If you don't have Git, you can download the [ZIP](https://github.com/salbahra/Sprinklers/archive/master.zip) file and extract to a local directory.

Update Instructions:
--------------------

```sh
#change to the install directory
cd /var/www/sprinklers

#perform update
git pull
```

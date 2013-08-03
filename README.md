[OpenSprinkler Hosted Controller](http://salbahra.github.io/OpenSprinkler-Hosted-Controller)
========================

A mobile frontend for the OpenSprinkler irrigation device. Designed to allow manual control, program management (view, edit, delete and add), initiate a run-once program, view status, adjust rain delay, and change OpenSprinkler settings.

This version is designed for multiple users and uses no central storage. This version does not have the logging feature and also lacks weather based rain delay. Please see the main version of this software [here](https://github.com/salbahra/OpenSprinkler-Controller)

Overview:
---------

+ This application interfaces with the interval program on the OpenSprinkler which is the default software available. The application has been tested on firmware version 2.0.0 but should be compatible with 1.8.x and newer.

+ This software requires direct access to your OpenSprinkler which may require port forwarding.

+ For current discussion about the project please refer to the [forum post](http://rayshobby.net/phpBB3/viewtopic.php?f=2&t=154). 

Video Tutorial:
---------------
[![Video Tutorial](https://img.youtube.com/vi/5pYHsMZSj6w/0.jpg)](https://www.youtube.com/watch?v=5pYHsMZSj6w)

Very well put together by Ray, thanks!

Screenshots:
------------

![Splash Screen](http://albahra.com/journal/wp-content/uploads/2013/07/startup-iphone5-retina-175x300.png) ![Home Screen](http://albahra.com/journal/wp-content/uploads/2013/07/iOS-Simulator-Screen-shot-Jul-18-2013-6.36.32-PM-169x300.png) ![Status Page](http://albahra.com/journal/wp-content/uploads/2013/07/iOS-Simulator-Screen-shot-Jul-23-2013-6.24.41-PM-169x300.png) ![Program Preview](http://albahra.com/journal/wp-content/uploads/2013/07/iOS-Simulator-Screen-shot-Jul-2-2013-10.46.37-PM-169x300.png) ![Program Editor](http://albahra.com/journal/wp-content/uploads/2013/07/iOS-Simulator-Screen-shot-Jul-27-2013-5.55.42-PM-169x300.png) ![Manual Program](http://albahra.com/journal/wp-content/uploads/2013/07/iOS-Simulator-Screen-shot-Jul-2-2013-10.30.53-PM-169x300.png) ![Rain Delay](http://albahra.com/journal/wp-content/uploads/2013/07/iOS-Simulator-Screen-shot-Jul-2-2013-10.56.03-PM-169x300.png) ![Run Once](http://albahra.com/journal/wp-content/uploads/2013/07/iOS-Simulator-Screen-shot-Jul-31-2013-8.40.23-PM-169x300.png) ![Settings](http://albahra.com/journal/wp-content/uploads/2013/08/iOS-Simulator-Screen-shot-Aug-1-2013-6.52.25-PM-169x300.png)


Raspberry Pi Users:
-------------------

+ The application should also operate on the OpenSprinkler for Raspberry Pi so long the Raspberry Pi has the interval program installed. More information is available on  [Ray's Blog Post](http://rayshobby.net/?p=6339).
  +  This is a seperate program that needs to be running on the Raspberry Pi.
  + Please rememeber this is a front end for a hardware device. In the case of the OpenSprinkler Pi, the hardware happens to be the Pi combined with the interval program software.

+ In order for the interval program to be 100% compatibile with the web app you must be using an interval program built on or after June 22, 2013.

Install Instructions:
---------------------

+ You first need a working OpenSprinkler setup that you can access via a browser
  + For further information please refer to the OpenSprinkler online user manual available on [Ray's Website](http://rayshobby.net/?page_id=192)

+ Install prerequisites as needed (example for Debian using Apache web server)
  + ```apt-get install apache2 php5 libapache2-mod-php5 git``` 

+ Create the directory you wish to place the files in (ex. /var/www/sprinklers for http://yourwebsite/sprinklers)
  + ```mkdir -m 777 /var/www/sprinklers```

+ Download the files to your web directory using git
  + ```git clone https://github.com/salbahra/OpenSprinkler-Hosted-Controller.git /var/www/sprinklers```

+ From there you may attempt to access the front end which will guide you through the rest of the install process.

Update Instructions:
--------------------

+ Navigate to the web directory where the files are stored
  + ```cd /var/www/sprinklers```

+ Trigger a remote update using git
  + ```git pull```

[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/87d3c8783710e88024be2bf608fe8195 "githalytics.com")](http://githalytics.com/salbahra/OpenSprinkler-Controller)
## Sprinklers

<img align="left" height="96" src="http://albahra.com/sprinklers/icon.png">[![Build Status](https://travis-ci.org/salbahra/Sprinklers.png)](https://travis-ci.org/salbahra/Sprinklers)  
[Official Site][official] | [Support][help] | [Changelog][changelog]  
&copy; 2013-2014 [Samer Albahra][salbahra] ([@salbahra](https://twitter.com/salbahra))  

A mobile interface for the OpenSprinkler irrigation device. Designed to allow manual control, program management (view, edit, delete and add), initiation of a run-once program, viewing device status, adjusting rain delay, and changing of OpenSprinkler settings.
  
---

[official]: http://albahra.com/sprinklers/
[help]: http://rayshobby.net/phpBB3/viewforum.php?f=1
[changelog]: https://github.com/salbahra/Sprinklers/releases
[salbahra]: http://albahra.com/

<a href="https://albahra.com/sprinklers/img/home.png"><img src="https://albahra.com/sprinklers/img/home.png" width="100"/></a>
<a href="https://albahra.com/sprinklers/img/preview.png"><img src="https://albahra.com/sprinklers/img/preview.png" width="100"/></a>
<a href="https://albahra.com/sprinklers/img/log_graph.png"><img src="https://albahra.com/sprinklers/img/log_graph.png" width="100"/></a>
<a href="https://albahra.com/opensprinkler/img/program.png"><img src="https://albahra.com/opensprinkler/img/program.png" width="100"/></a>
<a href="https://albahra.com/sprinklers/img/raindelay.png"><img src="https://albahra.com/sprinklers/img/raindelay.png" width="100"/></a>
<a href="https://albahra.com/sprinklers/img/runonce.png"><img src="https://albahra.com/sprinklers/img/runonce.png" width="100"/></a>

<i>Screenshots: iPhone 5S</i>

---

#### Overview

+ This application is available for free from the following app stores:
  + [Amazon Appstore](http://www.amazon.com/dp/B00JYFL8LW)
  + [Apple App Store - iOS](https://itunes.apple.com/us/app/sprinklers/id830988967?ls=1&mt=8)
  + [Apple App Store - OS X](https://itunes.apple.com/us/app/sprinklers/id903464532?ls=1&mt=12)
  + [BlackBerry AppWorld](http://appworld.blackberry.com/webstore/content/53161895/)
  + [Firefox Marketplace](https://marketplace.firefox.com/app/sprinklers/)
  + [Google Play Store](https://play.google.com/store/apps/details?id=com.albahra.sprinklers)
  + [Google Web Store](https://chrome.google.com/webstore/detail/sprinklers/iegciplggbmhpihoeamfpjdedihblhhp)
  + [Windows Store](http://apps.microsoft.com/windows/en-us/app/sprinklers/ebc0d2d1-9678-4e72-9a9d-6d60e946b8c0)
  + [Windows Phone Store](http://www.windowsphone.com/en-us/store/app/sprinklers/3dbc5da0-b33f-4ca8-9e54-e80febf0a0c5)

+ This application interfaces with the interval program on the OpenSprinkler which is the default software available. The application has been tested and is compatible with all firmware versions of the interval program.

+ The application is written in Javascript and HTML/CSS. The application runs completely within the user's browser (or webview) and communicates directly with the OpenSprinkler.

+ For advanced users, the application supports authentication (HTTP Basic) and SSL for devices behind proxies. Guide available [here](http://rayshobby.net/mediawiki/index.php?title=Secure_Remote_Access).

+ For current discussion about the project please refer to the [forum post](http://rayshobby.net/phpBB3/viewtopic.php?f=2&t=154).

---

#### OpenSprinkler Arduino

Starting with firmware 2.0.3, an option has been added to change the Javascript URL path for the UI. Sprinklers now offers an injection method which takes over Ray's OpenSprinkler UI. Just follow the simple steps below to switch your UI:

    Please note this will load the development copy of Sprinklers.

 1. Navigate to http://x.x.x.x/su (replace x.x.x.x with your OpenSprinkler IP)
 2. For "Javascript URL" field use the following: https://rawgithub.com/salbahra/Sprinklers/master/www/js
 3. Enter your password in the field and push "Submit"
 4. Your page will reload and you will now see the Sprinklers application

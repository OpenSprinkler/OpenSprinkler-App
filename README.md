<img align="left" height="150" src="http://albahra.com/opensprinkler/icon-new.png"><h3>&nbsp;OpenSprinkler App <sup><img src="http://vb.teelaun.ch/OpenSprinkler/OpenSprinkler-App.svg"></sup></h3>
&nbsp;[![Build Status](https://api.travis-ci.org/OpenSprinkler/OpenSprinkler-App.svg?branch=master)](https://travis-ci.org/) [![Coverage Status](https://coveralls.io/repos/OpenSprinkler/OpenSprinkler-App/badge.svg?branch=master)](https://codecov.io/github/OpenSprinkler/OpenSprinkler-App?branch=master) [![devDependency Status](https://david-dm.org/OpenSprinkler/OpenSprinkler-App/dev-status.svg)](https://david-dm.org/OpenSprinkler/OpenSprinkler-App#info=devDependencies)  
&nbsp;[Official Site][official] | [Support][help] | [Changelog][changelog]  
&nbsp;&copy; 2013-2014 [Samer Albahra][salbahra] ([@salbahra](https://twitter.com/salbahra))  
<br>
A mobile interface for the OpenSprinkler irrigation device. Designed to allow manual control, program management (view, edit, delete and add), initiation of a run-once program, viewing device status, adjusting rain delay, changing of OpenSprinkler settings and much more.
  
---

[official]: https://opensprinkler.com
[help]: http://support.opensprinkler.com
[changelog]: https://github.com/OpenSprinkler/OpenSprinkler-App/releases
[salbahra]: http://albahra.com

<a href="https://albahra.com/opensprinkler/img/home.png"><img src="https://albahra.com/opensprinkler/img/home.png" width="100"/></a>
<a href="https://albahra.com/opensprinkler/img/preview.png"><img src="https://albahra.com/opensprinkler/img/preview.png" width="100"/></a>
<a href="https://albahra.com/opensprinkler/img/logs_timeline.png"><img src="https://albahra.com/opensprinkler/img/logs_timeline.png" width="100"/></a>
<a href="https://albahra.com/opensprinkler/img/program.png"><img src="https://albahra.com/opensprinkler/img/program.png" width="100"/></a>
<a href="https://albahra.com/opensprinkler/img/raindelay.png"><img src="https://albahra.com/opensprinkler/img/raindelay.png" width="100"/></a>
<a href="https://albahra.com/opensprinkler/img/runonce.png"><img src="https://albahra.com/opensprinkler/img/runonce.png" width="100"/></a>

<i>Screenshots: iPhone 5S</i>

---

#### Overview

+ This application is available for free from the following app stores:
  + [Amazon Appstore](http://www.amazon.com/dp/B00JYFL8LW)
  + [Apple App Store - iOS](https://itunes.apple.com/us/app/sprinklers/id830988967?ls=1&mt=8)
  + [Apple App Store - OS X](https://itunes.apple.com/us/app/sprinklers/id903464532?ls=1&mt=12)
  + [BlackBerry AppWorld](http://appworld.blackberry.com/webstore/content/53161895/)
  + [Firefox Marketplace](https://marketplace.firefox.com/app/opensprinkler/)
  + [Google Play Store](https://play.google.com/store/apps/details?id=com.albahra.sprinklers)
  + [Google Web Store](https://chrome.google.com/webstore/detail/sprinklers/iegciplggbmhpihoeamfpjdedihblhhp)
  + [Windows Phone Store](http://www.windowsphone.com/en-us/store/app/sprinklers/3dbc5da0-b33f-4ca8-9e54-e80febf0a0c5)

+ This application interfaces with OpenSprinkler. The application has been tested and is compatible with all versions of the Unified firmware for both Arduino and Raspberry Pi. Furthermore, Dan Kimberling's OSPi program is also supported.

+ The application is written in Javascript and HTML/CSS. The application runs completely within the user's browser (or webview) and communicates directly with the OpenSprinkler.

+ Language translation is crowd sourced using Get Localization. To contribute to any language please visit our Get Localization [page](http://getlocalization.com/OpenSprinkler).

+ For current discussion about the project please refer to the [forums](https://opensprinkler.com/forums/forum/opensprinkler-mobile-app/).

+ For advanced users, the application supports authentication (HTTP Basic) and SSL for devices behind proxies. Guide for OSPi available [here](http://rayshobby.net/mediawiki/index.php?title=Secure_Remote_Access).

---

#### OpenSprinkler Arduino

Starting with firmware 2.0.3, an option has been added to change the Javascript URL path for the UI. The application now offers an injection method which takes over Ray's OpenSprinkler UI. Just follow the simple steps below to switch your UI:

> Firmware 2.1.0 and newer have the following settings by default.

 1. Navigate to http://x.x.x.x/su (replace x.x.x.x with your OpenSprinkler IP)
 2. For "Javascript URL" field use the following: https://ui.opensprinkler.com/js
 3. Enter your password in the field and push "Submit"
 4. Your page will reload and you will now see the application

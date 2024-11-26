
<img align="left" height="150" src="http://albahra.com/opensprinkler/icon-new.png">

# OpenSprinkler App
[![GitHub version](https://img.shields.io/github/package-json/v/opensprinkler/opensprinkler-app.svg)](http://github.com/OpenSprinkler/OpenSprinkler-App)
[![License](https://img.shields.io/github/license/OpenSprinkler/OpenSprinkler-App)](LICENSE)

[Official Site][official] | [Support][help] | [Changelog][changelog]

&copy; 2013-2016 [Samer Albahra][salbahra] ([@salbahra](https://twitter.com/salbahra))

A mobile interface for the OpenSprinkler irrigation device. This app provides manual control, program management, run-once programs, device status viewing, rain delay adjustment, and OpenSprinkler settings changes.


[official]: https://opensprinkler.com
[help]: http://support.opensprinkler.com
[changelog]: https://github.com/OpenSprinkler/OpenSprinkler-App/releases
[salbahra]: http://albahra.com


## Features

* **Manual Control:** Water your lawn instantly with easy-to-use controls.
* **Program Management:** View, edit, add, or delete watering programs to fit your schedule.
* **Run-Once Programs:**  Quickly set up a one-time watering program for special needs.
* **Device Status:** Monitor the status of your OpenSprinkler device in real-time.
* **Rain Delay:** Adjust the rain delay to avoid overwatering during rainy periods.
* **Settings:** Customize OpenSprinkler settings directly from the app.


## Getting Started

**Download:**

* [Amazon Appstore](http://www.amazon.com/dp/B00JYFL8LW)
* [Apple App Store - iOS](https://itunes.apple.com/us/app/sprinklers/id830988967?ls=1&mt=8)
* [Apple App Store - OS X](https://itunes.apple.com/us/app/sprinklers/id903464532?ls=1&mt=12)
* [Google Play Store](https://play.google.com/store/apps/details?id=com.albahra.sprinklers)

**Prerequisites:**

* An OpenSprinkler device with Unified firmware (version 2.0.3 or later).

**Instructions:**

1.  Download and install the OpenSprinkler app on your device.
2.  Connect your mobile device to the same network as your OpenSprinkler device.
3.  Launch the app and follow the on-screen instructions to connect to your OpenSprinkler.

<br>

<p align="center">
  <a href="https://albahra.com/opensprinkler/img/home.png"><img src="https://albahra.com/opensprinkler/img/home.png" width="150" alt="Screenshot of the OpenSprinkler app home screen"/></a>
  <a href="https://albahra.com/opensprinkler/img/preview.png"><img src="https://albahra.com/opensprinkler/img/preview.png" width="150" alt="Screenshot of the OpenSprinkler app preview screen"/></a>
  <a href="https://albahra.com/opensprinkler/img/logs_timeline.png"><img src="https://albahra.com/opensprinkler/img/logs_timeline.png" width="150" alt="Screenshot of the OpenSprinkler app logs timeline screen"/></a>
  <a href="https://albahra.com/opensprinkler/img/program.png"><img src="https://albahra.com/opensprinkler/img/program.png" width="150" alt="Screenshot of the OpenSprinkler app program screen"/></a>
  <a href="https://albahra.com/opensprinkler/img/raindelay.png"><img src="https://albahra.com/opensprinkler/img/raindelay.png" width="150" alt="Screenshot of the OpenSprinkler app rain delay screen"/></a>
  <a href="https://albahra.com/opensprinkler/img/runonce.png"><img src="https://albahra.com/opensprinkler/img/runonce.png" width="150" alt="Screenshot of the OpenSprinkler app run once screen"/></a>
</p>
<br>


## Unified Firmware

Starting with firmware 2.0.3, an option has been added to change the Javascript URL path for the UI. The application now offers an injection method which takes over Ray's OpenSprinkler UI. Just follow the simple steps below to switch your UI:

> Firmware 2.1.0 and newer have the following settings by default.

1. Navigate to http://x.x.x.x/su (replace x.x.x.x with your OpenSprinkler IP)
2. For "Javascript URL" field use the following: https://ui.opensprinkler.com/js
3. Enter your password in the field and push "Submit"
4. Your page will reload and you will now see the application

## Troubleshooting

If you encounter any issues, please check the following resources:

*   **[Support Forum](https://opensprinkler.com/forums/forum/opensprinkler-mobile-app/)**: Search for existing solutions or ask for help.
*   **[GitHub Issues](https://github.com/OpenSprinkler/OpenSprinkler-App/issues)**: Check for known issues or report a new one.

Before reporting an issue, please provide the following information:

*   **App version:**
*   **OpenSprinkler firmware version:**
*   **Device type:** (e.g., iPhone, Android, etc.)
*   **Steps to reproduce the issue:**
*   **Screenshots or error messages:** (if applicable)


## Contributing

We welcome contributions to the OpenSprinkler app! If you'd like to contribute, please follow these guidelines:

*   **Fork the repository:** Create your own copy of the repository.
*   **Create a branch:**  Make a new branch for your feature or bug fix.
*   **Make your changes:** Implement your changes with clear commit messages.
*   **Submit a pull request:** Open a pull request to the main repository. Please be sure to include either a short demo video or screenshots to show your change.

Please ensure your code adheres to the existing coding style and includes tests for any new functionality. Please note that during the `git commit` step, husky will automatically run grunt to check for syntax and styling errors before the commit will be accepted.

## Local Development

Fork this repository then [install pnpm](https://pnpm.io/installation). Next, install the dependencies and start the dev web server with:

```bash
$ pnpm install
$ pnpm start
```

From here you can open your browser to `http://localhost:8080` and begin your development.

### Grunt Tasks

This project uses Grunt to automate various development tasks. Here are some of the key Grunt tasks available:

**Code Quality and Testing**

*   **`grunt eslint`**: Checks JavaScript code for potential errors and style issues.
*   **`grunt csslint`**: Analyzes CSS code for potential errors and style issues.
*   **`grunt blanket_mocha`**: Runs tests using Mocha and Blanket.js to generate code coverage reports.

**Building and Deployment**

*   **`grunt compress:makeFW`**: Creates a ZIP archive of the application files for firmware updates.
*   **`grunt shell:updateUI`**: Updates the UI on the OpenSprinkler device by transferring the ZIP archive.
*   **`grunt shell:updateBetaUI`**: Updates the UI on a beta OpenSprinkler device.

**Localization**

*   **`grunt shell:pushEng`**: Extracts English strings for translation, pushes them to Transifex, and updates the English PO file.
*   **`grunt shell:updateLang`**: Pulls translations from Transifex and updates the language files.

**Other**

*   **`grunt shell:startDemo`**: Starts a demo instance of the OpenSprinkler app.
*   **`grunt shell:stopDemo`**: Stops the demo instance.
*   **`grunt bump`**: Bumps the version number in various files (source code, Cordova config, and package.json) and push commit
*   **`grunt bump-version`**: Bumps the version number in various files (source code, Cordova config, and package.json). Does not commit or push!


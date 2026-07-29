# OpenSprinkler App

<img align="left" height="150" style="padding:10px" src="http://albahra.com/opensprinkler/icon-new.png">

[![GitHub version](https://img.shields.io/github/v/release/OpenSprinkler/OpenSprinkler-App)](http://github.com/OpenSprinkler/OpenSprinkler-App)
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

1. Download and install the OpenSprinkler app on your device.
2. Connect your mobile device to the same network as your OpenSprinkler device.
3. Launch the app and follow the on-screen instructions to connect to your OpenSprinkler.

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

* **[Support Forum](https://opensprinkler.com/forums/forum/opensprinkler-mobile-app/)**: Search for existing solutions or ask for help.
* **[GitHub Issues](https://github.com/OpenSprinkler/OpenSprinkler-App/issues)**: Check for known issues or report a new one.

Before reporting an issue, please provide the following information:

* **App version:**
* **OpenSprinkler firmware version:**
* **Device type:** (e.g., iPhone, Android, etc.)
* **Steps to reproduce the issue:**
* **Screenshots or error messages:** (if applicable)

## Contributing

We welcome contributions to the OpenSprinkler app! If you'd like to contribute, please follow these guidelines:

* **Fork the repository:** Create your own copy of the repository.
* **Create a branch:**  Make a new branch for your feature or bug fix.
* **Make your changes:** Implement your changes with clear commit messages.
* **Submit a pull request:** Open a pull request to the main repository. Please be sure to include either a short demo video or screenshots to show your change.

Please ensure your code adheres to the existing coding style and includes tests for any new functionality. During `git commit`, Husky runs the JavaScript and CSS lint tasks before accepting the commit.

## Local Development

The toolchain requires Node.js 22.13 or newer and npm 10.9 or newer. Fork this repository then:

```bash
npm install
npm run deps:rebuild
npm run prepare
npm start
```

Install scripts are disabled by default. `deps:rebuild` runs only the reviewed native/build hooks
for `better-sqlite3`, `esbuild`, and the optional macOS `fsevents` package; `prepare` installs the
repository's Husky hooks for local development.

From here you can open your browser to `http://localhost:8080` and begin your development.

### Development tasks

#### Code Quality and Testing

* **`npm run lint`**: Checks JavaScript code for potential errors and style issues.
* **`npm run lint:css`**: Analyzes CSS code for potential errors and style issues.

#### Building and Deployment

* **`npm run build:firmware`**: Creates the firmware asset tree and reproducible `UI.zip` archive.

#### Localization

* **`npm run localization:push-english`**: Extracts English strings, pushes them to Transifex, and updates the English PO file.
* **`npm run localization:update`**: Pulls translations from Transifex and updates the language files.

#### Unit Tests

The legacy suite uses a minimal local harness with headless Chrome. The launcher detects `google-chrome`, `chromium`, and
`chromium-browser`, including a Chromium-only Debian/Proxmox installation. Set `CHROME_BIN` explicitly when the
browser is installed elsewhere.

* **`npm test`**: Executes the legacy browser suite located under `/test/tests`.
* **`npm run ci`**: Runs audits, secret scanning, linting, typechecks, all Node suites, production builds, and the legacy browser suite.
* **`npm run test:browser:container`**: Runs the legacy browser suite in a digest-pinned, non-root Chromium container, so a host browser is not required.
* **`npm run ci:proxmox`**: Runs all CI checks with containerized Chromium, then builds and smoke-tests the production companion container. It requires Docker and Compose, but no host browser.

See [SECURITY.md](SECURITY.md) for the full dependency-audit policy and credential-rotation
requirements.

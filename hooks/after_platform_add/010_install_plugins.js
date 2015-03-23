#!/usr/bin/env node

var pluginlist = [
	"https://github.com/salbahra/NetworkInterfacePlugin.git",
	"https://github.com/phonegap-build/StatusBarPlugin.git",
	"https://github.com/apache/cordova-plugin-inappbrowser.git",
	"https://github.com/apache/cordova-plugin-splashscreen.git",
	"https://github.com/apache/cordova-plugin-geolocation.git"
];

var sys = require("sys"),
    exec = require("child_process").exec;

function puts(error, stdout, stderr) {
  sys.puts(stdout);
}

pluginlist.forEach(function(plug) {
  exec("cordova plugin add " + plug, puts);
});

/*global chrome */
chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create("index.htm", {
    "bounds": {
      "width": 942,
      "height": 512
    }
  });
});

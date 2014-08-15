module.exports = function(grunt) {

  // Load node-modules;
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-text-replace");
  grunt.loadNpmTasks("grunt-shell");
  grunt.loadNpmTasks("grunt-contrib-compress");

  var bumpVersion = function(version,level) {
    version = version.split(".") || [0,0,0];
    level = level || 2;
    version[level]++;
    return version.join(".");
  };

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    secrets: grunt.file.readJSON(".secrets.json"),
    jshint: {
    	main: ["<%= pkg.main %>","Gruntfile.js","www/js/home.js"],
      options: {
        jshintrc: true
      }
    },
    compress: {
      firefox: {
        options: {
          archive: "build/firefox/com.albahra.sprinklers.zip"
        },
        files: [{
          src: ["css/**","js/**","img/**","locale/**","index.html", "res/firefox/**"],
          cwd: "www/",
          expand: true
        },{
          src: ["manifest.webapp"]
        }]
      },
      chrome: {
        options: {
          archive: "build/chrome/com.albahra.sprinklers.zip"
        },
        files: [{
          src: ["css/**","js/**","img/**","locale/**","index.html", "res/chrome/**"],
          cwd: "www/",
          expand: true
        },{
          src: ["manifest.json"]
        }]
      },
      blackberry10: {
        options: {
          archive: "build/blackberry10/com.albahra.sprinklers.zip"
        },
        files: [{
          src: ["bb10app.bar"],
          cwd: "platforms/blackberry10/build/device/",
          expand: true
        }]
      }
    },
    shell: {
      pushEng: {
        command: "tasks/pusheng.sh"
      },
      updateLang: {
          command: "tasks/updatelang.sh <%= secrets.getLocalization.username %> <%= secrets.getLocalization.password %>"
      },
      blackberry10: {
          command: "cordova build blackberry10 --release"
      },
      pushBump: {
          command: [
            "git add www/js/main.js source/osx/Resources/Sprinklers-Info.plist www/config.xml manifest.json manifest.webapp package.json",
            "git commit -m 'Base: Increment version number'",
            "git push"
          ].join("&&")
      }
    },
    replace: {
      about: {
        src: ["www/js/main.js"],
        overwrite: true,
        replacements: [{
          from: /_\("App Version"\)\+": ([\d|\.]+)"/g,
          to: function(matchedWord, index, fullText, regexMatches){
            return "_(\"App Version\")+\": "+bumpVersion(regexMatches[0])+"\"";
          }
        }]
      },
      osx: {
        src: ["source/osx/Resources/Sprinklers-Info.plist"],
        overwrite: true,
        replacements: [{
          from: /<key>CFBundleShortVersionString<\/key>\n\t<string>([\d|\.]+)<\/string>/g,
          to: function(matchedWord, index, fullText, regexMatches){
            return "<key>CFBundleShortVersionString</key>\n\t<string>"+bumpVersion(regexMatches[0])+"</string>";
          }
        },{
          from: /<key>CFBundleVersion<\/key>\n\t<string>(\d+)<\/string>/g,
          to: function(matchedWord, index, fullText, regexMatches){
            return "<key>CFBundleVersion<\/key>\n\t<string>"+(parseInt(regexMatches[0])+1)+"<\/string>";
          }
        }]
      },
      phonegap: {
        src: ["www/config.xml"],
        overwrite: true,
        replacements: [{
          from: /version     = "([\d|\.]+)"/g,
          to: function(matchedWord, index, fullText, regexMatches){
            return "version     = \""+bumpVersion(regexMatches[0])+"\"";
          }
        },{
          from: /versionCode = "(\d+)"/g,
          to: function(matchedWord, index, fullText, regexMatches) {
            return "versionCode = \""+(parseInt(regexMatches[0])+1)+"\"";
          }
        }]
      },
      manifests: {
        src: ["manifest.json","manifest.webapp","package.json"],
        overwrite: true,
        replacements: [{
          from: /"version": "([\d|\.]+)"/g,
          to: function(matchedWord, index, fullText, regexMatches){
            return "\"version\": \""+bumpVersion(regexMatches[0])+"\"";
          }
        }]
      }
    }
  });

  // Default task(s).
  grunt.registerTask("default",["jshint"]);
  grunt.registerTask("bump",["replace","shell:pushBump"]);
  grunt.registerTask("updateLang",["shell:updateLang"]);
  grunt.registerTask("pushEng",["shell:pushEng"]);
  grunt.registerTask("build",["jshint","shell:blackberry10","compress"]);

};

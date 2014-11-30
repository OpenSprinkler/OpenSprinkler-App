module.exports = function(grunt) {

	// Load node-modules;
	grunt.loadNpmTasks("grunt-contrib-jshint");
	grunt.loadNpmTasks("grunt-text-replace");
	grunt.loadNpmTasks("grunt-shell");
	grunt.loadNpmTasks("grunt-contrib-compress");
	grunt.loadNpmTasks("grunt-mocha");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-contrib-cssmin");
	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-http-server");

	var bumpVersion = function(version) {
			var join = ".",
				level = grunt.option("level") || 2;

			if (typeof version === "number") {
				join = "";
				version = version.toString();
			}

			version = version.split(join) || [0,0,0];
			version[level]++;
			return version.join(join);
		},
		secrets;

	if (grunt.file.exists(".secrets.json")) {
		secrets = grunt.file.readJSON(".secrets.json");
	} else {
		secrets = {
				"getLocalization": {
						"username": "",
						"password": ""
				}
		};
	}

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		secrets: secrets,

		jshint: {
			main: ["<%= pkg.main %>","Gruntfile.js","www/js/home.js","chrome.js","test/spec.js"],
			options: {
				jshintrc: true
			}
		},

		mocha: {
			all: {
				src: ["test/spec.html"],
			},
			options: {
				run: true
			}
		},

		compress: {
			makeFW: {
				options: {
					archive: "build/firmware/UI.zip"
				},
				files: [{
					src: ["css/**","js/**","img/**","locale/*.js","*.htm","res/ios-web/**"],
					cwd: "www/",
					expand: true
				}]
			},
			jsAsset: {
				options: {
					mode: "gzip"
				},
				files: [{
					expand: true,
					src: ["www/js/app.js","www/js/jqm.js"],
					ext: ".jgz"
				}]
			},
			cssAsset: {
				options: {
					mode: "gzip"
				},
				files: [{
					expand: true,
					src: ["www/css/app.css"],
					ext: ".cgz"
				}]
			},
			firefox: {
				options: {
					archive: "build/firefox/com.albahra.sprinklers.zip"
				},
				files: [{
					src: ["css/**","js/**","img/**","locale/**","*.htm", "res/firefox/**"],
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
					src: ["css/**","js/**","img/**","locale/**","*.htm", "../chrome.js", "res/chrome/**"],
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
			updateUI: {
				command: [
					"cd build/firmware",
					"unzip UI.zip",
					"rsync -azp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r * <%= secrets.firmware.rayshobby.location %>",
					"rsync -azp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r * <%= secrets.firmware.opensprinkler.location %>"
				].join("&&")
			},
			updateBetaUI: {
				command: [
					"cd build/firmware",
					"unzip UI.zip",
					"rsync -azp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r * <%= secrets.firmware.betaui.location %>"
				].join("&&")
			},
			pushEng: {
				command: "tasks/pusheng.sh"
			},
			updateLang: {
					command: "tasks/updatelang.sh <%= secrets.getLocalization.username %> <%= secrets.getLocalization.password %>"
			},
			blackberry10: {
					command: [
						"cd www&&ln -s ../res res&&cd ..",
						"cordova build blackberry10 --release",
						"rm www/res"
					].join("&&")
			},
			pushBump: {
				command: [
					"git add www/js/main.js source/osx/Resources/OpenSprinkler-Info.plist www/config.xml manifest.json manifest.webapp package.json",
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
				src: ["source/osx/Resources/OpenSprinkler-Info.plist"],
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
				replacements: [
					{
						from: /version     = "([\d|\.]+)"/g,
						to: function(matchedWord, index, fullText, regexMatches){
							return "version     = \""+bumpVersion(regexMatches[0])+"\"";
						}
					},{
						from: /versionCode = "(\d+)"/g,
						to: function(matchedWord, index, fullText, regexMatches) {
							return "versionCode = \""+(parseInt(regexMatches[0])+1)+"\"";
						}
					},{
						from: /<string>(\d+)<\/string>/g,
						to: function(matchedWord, index, fullText, regexMatches) {
							return "<string>"+bumpVersion(parseInt(regexMatches[0]))+"</string>";
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
		},

		"http-server": {
			dev: {
				root: "",
				port: 8282,
				host: "127.0.0.1",
				showDir : true,
				autoIndex: true,
				ext: "html",
				runInBackground: false
			}
		},

		uglify: {
			makeFW: {
				files: {
					"www/js/app.js": ["www/js/jquery.js", "www/js/main.js", "www/js/libs.js"]
				}
			}
		},

		cssmin: {
			combine: {
				files: {
					"www/css/app.css": [ "www/css/jqm.css", "www/css/main.css"]
				}
			}
		},

		clean: {
			makeFW: ["www/js/app.js", "www/css/app.css", "www/css/app.cgz", "www/js/*.jgz"],
			pushFW: ["build/firmware/*"]
		}
	});

	// Default task(s).
	grunt.registerTask("default",["jshint"]);
	grunt.registerTask("test",["jshint","mocha"]);
	grunt.registerTask("updateLang",["shell:updateLang"]);
	grunt.registerTask("pushEng",["shell:pushEng"]);
	grunt.registerTask("makeFW",["jshint","uglify","cssmin","compress:jsAsset","compress:cssAsset","compress:makeFW","clean:makeFW"]);
	grunt.registerTask("pushFW",["makeFW","shell:updateUI","clean:pushFW"]);
	grunt.registerTask("pushBetaFW",["makeFW","shell:updateBetaUI","clean:pushFW"]);
	grunt.registerTask("build",["jshint","shell:blackberry10","compress:firefox","compress:chrome","compress:blackberry10","pushFW"]);
	grunt.registerTask("bump",["jshint","replace:about","replace:osx","replace:phonegap","replace:manifests","shell:pushBump"]);

};

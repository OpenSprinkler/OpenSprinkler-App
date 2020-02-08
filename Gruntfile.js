	/* OpenSprinkler App
	* Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
	*
	* This file is part of the OpenSprinkler project <http://opensprinkler.com>.
	*
	* This program is free software; you can redistribute it and/or modify
	* it under the terms of the GNU Affero General Public License version 3 as
	* published by the Free Software Foundation.
	*
	* You should have received a copy of the GNU Affero General Public License
	* along with this program.  If not, see <http://www.gnu.org/licenses/>.
	*/

	module.exports = function( grunt ) {

		// Load node-modules;
		grunt.loadNpmTasks( "grunt-contrib-jshint" );
		grunt.loadNpmTasks( "grunt-text-replace" );
		grunt.loadNpmTasks( "grunt-shell" );
		grunt.loadNpmTasks( "grunt-contrib-compress" );
		grunt.loadNpmTasks( "grunt-contrib-uglify" );
		grunt.loadNpmTasks( "grunt-contrib-cssmin" );
		grunt.loadNpmTasks( "grunt-contrib-csslint" );
		grunt.loadNpmTasks( "grunt-contrib-clean" );
		grunt.loadNpmTasks( "grunt-jscs" );
		grunt.loadNpmTasks( "grunt-blanket-mocha" );

		var bumpVersion = function( version ) {
				var join = ".",
					level = grunt.option( "level" ) || 2;

				if ( typeof version === "number" ) {
					join = "";
					version = version.toString();
				}

				version = version.split( join ) || [ 0, 0, 0 ];
				version[ level ]++;
				return version.join( join );
			},
			secrets;

		if ( grunt.file.exists( ".secrets.json" ) ) {
			secrets = grunt.file.readJSON( ".secrets.json" );
		} else {
			secrets = {
					"getLocalization": {
							"username": "",
							"password": ""
					}
			};
		}

		// Project configuration.
		grunt.initConfig( {
			pkg: grunt.file.readJSON( "package.json" ),
			secrets: secrets,

			jshint: {
				main: [ "www/js/main.js", "www/js/map.js", "Gruntfile.js", "www/js/hasher.js", "www/js/home.js", "chrome.js", "test/tests.js" ],
				options: {
					jshintrc: true
				}
			},

			jscs: {
				main: [ "www/js/main.js", "www/js/map.js", "Gruntfile.js", "www/js/hasher.js", "www/js/home.js", "chrome.js", "test/tests.js" ],
				options: {
					config: true,
					fix: true
				}
			},

			csslint: {
				strict: {
					options: {
						csslintrc: ".csslintrc"
					},
					src: [ "www/css/main.css" ]
				}
			},

			blanket_mocha: {
				test: {
					src: [ "test/tests.html" ],
					options: {
						threshold: 5,
						page: {
							settings: {
								webSecurityEnabled: false
							}
						}
					}
				}
			},

			compress: {
				makeFW: {
					options: {
						archive: "build/firmware/UI.zip"
					},
					files: [ {
						src: [ "css/**", "js/**", "img/**", "locale/*.js", "*.html" ],
						cwd: "www/",
						expand: true
					}, {
						src: "res/ios-web/**"
					} ]
				},
				makePGB: {
					options: {
						archive: "build/app.zip"
					},
					files: [ {
						src: [ "config.xml", "res/**", "www/**" ],
						dot: true,
						expand: true
					} ]
				},
				chrome: {
					options: {
						archive: "build/chrome/com.albahra.sprinklers.zip"
					},
					files: [ {
						src: [ "css/**", "js/**", "img/**", "locale/**", "*.html" ],
						cwd: "www/",
						expand: true
					}, {
						src: [ "manifest.json", "chrome.js", "res/chrome/**" ]
					} ]
				}
			},

			shell: {
				updateUI: {
					command: [
						"cd build/firmware",
						"unzip UI.zip",
						"rsync -azp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r * <%= secrets.firmware.rayshobby.location %>",
						"rsync -azp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r * <%= secrets.firmware.opensprinkler.location %>",
						"rsync -azp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r * <%= secrets.firmware.betaui.location %>"
					].join( "&&" )
				},
				updateBetaUI: {
					command: [
						"cd build/firmware",
						"unzip UI.zip",
						"rsync -azp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r * <%= secrets.firmware.betaui.location %>"
					].join( "&&" )
				},
				updatePGB: {
					command: "curl -X PUT -F file=@build/app.zip https://build.phonegap.com/api/v1/apps/<%= pkg.phonegap.id %>?auth_token=<%= secrets.phonegap.token %> >/dev/null 2>&1"
				},
				pushEng: {
					command: [
						"xgettext --keyword=_ --output=- www/js/main.js --omit-header --force-po --from-code=UTF-8 --language='Python' | sed '/^\#/d' > .msgjs",
						"sed -E 's/data-translate=(\".*\")/_(\\1)/g' www/index.html | xgettext --keyword=_ --output=- --language='Python' --omit-header --force-po - | sed '/^\#/d' > .msghtml",
						"msgcat .msgjs .msghtml > www/locale/messages_en.po",
						"rm .msgjs .msghtml",
						"git add www/locale/messages_en.po",
						"git diff-index --quiet HEAD || git commit -m 'Localization: Update English strings'",
						"git push"
					].join( "&&" )
				},
				updateLang: {
					command: [
						"curl --user <%= secrets.getLocalization.username %>:<%= secrets.getLocalization.password %> https://api.getlocalization.com/Sprinklers/api/translations/zip/ -o langs.zip",
						"unzip langs.zip",
						"rm langs.zip",
						"find . -type f -maxdepth 1 -iname 'messages_*.po' -print0 | while IFS= read -r -d $'\\0' line; do file=(${line//_/ }); lang=${file[1]}; file=(${lang//-/ }); " +
							"lang=${file[0]}; file=(${lang//./ }); lang=${file[0]}; mv \"$line\" messages.po; po2json -p messages.po > \"www/locale/$lang.js\"; rm messages.po; done",
						"git add www/locale",
						"git diff-index --quiet HEAD || git commit -m 'Localization: Update languages from getlocalization.com'",
						"git push"
					].join( "&&" )
				},
				startOSPi: {
					command: "test/launch_ospi.sh start"
				},
				stopOSPi: {
					command: [
						"test/launch_ospi.sh stop",
						"rm -r build/firmware/sip"
					].join( "&&" )
				},
				startDemo: {
					command: "test/launch_osdemo.sh start"
				},
				stopDemo: {
					command: [
						"test/launch_osdemo.sh stop",
						"rm -r build/firmware/unified"
					].join( "&&" )
				},
				symres: {
					command: "cd www && ln -s ../res res && cd .."
				},
				pushBump: {
					command: [
						"git add www/js/main.js config.xml manifest.json package.json",
						"git commit -m 'Base: Increment version number'",
						"git push"
					].join( "&&" )
				}
			},

			replace: {
				about: {
					src: [ "www/js/main.js" ],
					overwrite: true,
					replacements: [ {
						from: /_\( "App Version" \) \+ ": ([\d|\.]+)"/g,
						to: function( matchedWord, index, fullText, regexMatches ) {
							return "_( \"App Version\" ) + \": " + bumpVersion( regexMatches[ 0 ] ) + "\"";
						}
					} ]
				},
				phonegap: {
					src: [ "config.xml" ],
					overwrite: true,
					replacements: [
						{
							from: /version="([\d|\.]+)"/g,
							to: function( matchedWord, index, fullText, regexMatches ) {
								return "version=\"" + bumpVersion( regexMatches[ 0 ] ) + "\"";
							}
						}, {
							from: /versionCode="(\d+)"/g,
							to: function( matchedWord, index, fullText, regexMatches ) {
								return "versionCode=\"" + ( parseInt( regexMatches[ 0 ] ) + 1 ) + "\"";
							}
						}, {
							from: /<string>(\d+)<\/string>/g,
							to: function( matchedWord, index, fullText, regexMatches ) {
								return "<string>" + bumpVersion( parseInt( regexMatches[ 0 ] ) ) + "</string>";
							}
						} ]
				},
				manifests: {
					src: [ "manifest.json", "package.json" ],
					overwrite: true,
					replacements: [ {
						from: /"version": "([\d|\.]+)"/g,
						to: function( matchedWord, index, fullText, regexMatches ) {
							return "\"version\": \"" + bumpVersion( regexMatches[ 0 ] ) + "\"";
						}
					} ]
				}
			},

			uglify: {
				buildFW: {
					files: {
						"www/js/app.js": [ "www/js/jquery.js", "www/js/main.js", "www/js/libs.js" ]
					}
				}
			},

			cssmin: {
				combine: {
					files: {
						"www/css/app.css": [ "www/css/jqm.css", "www/css/main.css" ]
					}
				}
			},

			clean: {
				makeFW: [ "www/js/app.js", "www/css/app.css" ],
				pushFW: [ "build/firmware/*", "build/app.zip" ],
				symres: [ "www/res" ]
			}
		} );

		// Default task(s).
		grunt.registerTask( "default", [ "jshint", "jscs" ] );
		grunt.registerTask( "test", [ "default", "blanket_mocha" ] );
		grunt.registerTask( "updateLang", [ "shell:updateLang" ] );
		grunt.registerTask( "pushEng", [ "shell:pushEng" ] );
		grunt.registerTask( "buildFW", [ "default", "uglify", "cssmin" ] );
		grunt.registerTask( "makeFW", [ "buildFW", "compress:makeFW", "clean:makeFW" ] );
		grunt.registerTask( "pushFW", [ "makeFW", "shell:updateUI", "clean:pushFW" ] );
		grunt.registerTask( "pushBetaFW", [ "makeFW", "shell:updateBetaUI", "clean:pushFW" ] );
		grunt.registerTask( "build", [ "default", "shell:symres", "compress:chrome", "pushFW", "clean:symres" ] );
		grunt.registerTask( "bump", [ "default", "replace:about", "replace:phonegap", "replace:manifests", "shell:pushBump" ] );

	};

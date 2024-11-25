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
		grunt.loadNpmTasks( "grunt-text-replace" );
		grunt.loadNpmTasks( "grunt-shell" );
		grunt.loadNpmTasks( "grunt-contrib-compress" );
		grunt.loadNpmTasks( "grunt-contrib-csslint" );
		grunt.loadNpmTasks( "grunt-contrib-clean" );
		grunt.loadNpmTasks( "grunt-blanket-mocha" );
		grunt.loadNpmTasks( "grunt-eslint" );

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

			eslint: {
				target: ["www/js/**/*.js"]
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
						src: [ "css/**", "js/**", "img/**", "locale/*.js", "*.html", "manifest.json", "sw.js" ],
						cwd: "www/",
						expand: true
					}, {
						src: "res/ios-web/**"
					} ]
				}
			},

			shell: {
				updateUI: {
					command: [
						"cd build/firmware",
						"unzip UI.zip",
						"firebase deploy --only hosting:opensprinkler-betaui",
						"firebase deploy --only hosting:opensprinkler-ui"
					].join( "&&" )
				},
				updateBetaUI: {
					command: [
						"cd build/firmware",
						"unzip UI.zip",
						"firebase deploy --only hosting:opensprinkler-betaui"
					].join( "&&" )
				},
				pushEng: {
					command: [
						"xgettext --keyword=_ --output=- www/js/main.js www/js/analog.js --omit-header --force-po --from-code=UTF-8 --language='Python' | sed '/^\#/d' > .msgjs",
						"sed -E 's/data-translate=\"([^\"]*)\"/_\(\"\\1\"\)/g' www/index.html > temp.html && xgettext --keyword=_ --output=- --language='Python' --omit-header --force-po temp.html | sed '/^#/d' > .msghtml && rm temp.html",
						"msgcat .msgjs .msghtml > www/locale/messages_en.po",
						"rm .msgjs .msghtml",
						"tx push",
						"git add www/locale/messages_en.po",
						"git diff-index --quiet HEAD || git commit -m 'Localization: Update English strings'",
						"git push"
					].join( "&&" )
				},
				updateLang: {
					command: [
						"tx pull --all",
						"find . -type f -maxdepth 1 -iname 'messages_*.po' -print0 | while IFS= read -r -d $'\\0' line; do file=(${line//_/ }); lang=${file[1]}; file=(${lang//-/ }); " +
							"lang=${file[0]}; file=(${lang//./ }); lang=${file[0]}; mv \"$line\" messages.po; npx po2json -p -f mf messages.po \"www/locale/$lang.js\"; rm messages.po; " +
							"echo '{\"messages\":' | cat - \"www/locale/$lang.js\" | (cat && echo '}') > temp && mv temp \"www/locale/$lang.js\"; done",
						"git add www/locale",
						"git diff-index --quiet HEAD || git commit -m 'Localization: Update languages from Transifex'",
						"git push"
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
						"git add www/ config.xml package.json",
						"git commit -m 'chore(vers): Increment version number'",
						"git push"
					].join( "&&" )
				}
			},

			replace: {
				about: {
					src: [ "www/js/modules/ui-dom.js" ],
					overwrite: true,
					replacements: [ {
						from: /_\( "App Version" \) \+ ": ([\d|\.]+)"/g,
						to: function( matchedWord, index, fullText, regexMatches ) {
							return "_( \"App Version\" ) + \": " + bumpVersion( regexMatches[ 0 ] ) + "\"";
						}
					} ]
				},
				cordova: {
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
					src: [ "package.json" ],
					overwrite: true,
					replacements: [ {
						from: /"version": "([\d|\.]+)"/g,
						to: function( matchedWord, index, fullText, regexMatches ) {
							return "\"version\": \"" + bumpVersion( regexMatches[ 0 ] ) + "\"";
						}
					} ]
				}
			},

			clean: {
				pushFW: [ "build/firmware/*", "build/app.zip" ],
				symres: [ "www/res" ]
			}
		} );

		// Default task(s).
		grunt.registerTask( "default", [ "eslint" ] );
		grunt.registerTask( "test", [ "default", "blanket_mocha" ] );
		grunt.registerTask( "updateLang", [ "shell:updateLang" ] );
		grunt.registerTask( "pushEng", [ "shell:pushEng" ] );
		grunt.registerTask( "pushFW", [ "compress:makeFW", "shell:updateUI", "clean:pushFW" ] );
		grunt.registerTask( "pushBetaFW", [ "compress:makeFW", "shell:updateBetaUI", "clean:pushFW" ] );
		grunt.registerTask( "build", [ "default", "shell:symres", "pushFW", "clean:symres" ] );
		grunt.registerTask( "bump", [ "default", "replace:about", "replace:cordova", "replace:manifests", "shell:pushBump" ] );
		grunt.registerTask( "bump-version", [ "default", "replace:about", "replace:cordova", "replace:manifests" ] );
	};

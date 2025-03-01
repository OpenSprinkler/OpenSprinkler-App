/* eslint-disable */

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
	grunt.loadNpmTasks( "grunt-shell" );
	grunt.loadNpmTasks( "grunt-contrib-compress" );
	grunt.loadNpmTasks( "grunt-contrib-csslint" );
	grunt.loadNpmTasks( "grunt-eslint" );

	var secrets;

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
		jsFiles: grunt.file.expand("www/js/**/*.js").join(" "),

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

		compress: {
			makeFW: {
				options: {
					archive: "build/firmware/UI.zip"
				},
				files: [ {
					src: [ "css/**", "js/**", "vendor-js/**", "img/**", "locale/*.js", "*.html", "manifest.json", "sw.js" ],
					cwd: "www/",
					expand: true
				}, {
					src: "res/ios-web/**"
				}, {
					expand: true,
					src: "build/modules.json",
					flatten: true,
					dest: "/"
				} ]
			}
		},

		shell: {
			unzipFW: {
				command: "cd build/firmware && unzip UI.zip"
			},
			pushEng: {
				command: [
					"xgettext --keyword=OSApp.Language._ --output=- <%= jsFiles %> --omit-header --force-po --from-code=UTF-8 --language='Python' | sed '/^\#/d' > .msgjs",
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
			}
		}
	} );

	grunt.registerTask( "generateScriptsJson", function() {
		const scripts = grunt.file.expand({ cwd: "www/js/modules" }, "*.js");
		grunt.file.write("build/modules.json", JSON.stringify(scripts, null, 2));
	} );

	// Default task(s).
	grunt.registerTask( "default", [ "eslint" ] );
	grunt.registerTask( "updateLang", [ "shell:updateLang" ] );
	grunt.registerTask( "pushEng", [ "shell:pushEng" ] );
	grunt.registerTask( "prepareFW", [ "generateScriptsJson", "compress:makeFW", "shell:unzipFW" ] );
};

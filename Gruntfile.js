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
			target: ["www/js/**/*.js", "scripts/**/*.cjs"]
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
				command: "node scripts/translations.cjs extract && tx push"
			},
			updateLang: {
				command: [
					"node -e \"require('fs').mkdirSync('translations/incoming', {recursive:true})\"",
					"tx pull --all",
					"node scripts/translations.cjs import-po"
				].join( "&&" )
			}
		}
	} );

	grunt.registerTask( "generateScriptsJson", function() {
		const scripts = grunt.file.expand({ cwd: "www/js/modules" }, "*.js");
		grunt.file.write("build/modules.json", JSON.stringify(scripts, null, 2));
	} );

	// Default task(s).
	[ "extract", "coverage", "compile" ].forEach( function( command ) {
		grunt.registerTask( command, function() {
			require( "./scripts/translations.cjs" ).main( [ command ] );
		} );
	} );
	grunt.registerTask( "default", [ "eslint" ] );
	grunt.registerTask( "updateLang", [ "shell:updateLang" ] );
	grunt.registerTask( "pushEng", [ "shell:pushEng" ] );
	grunt.registerTask( "prepareFW", [ "generateScriptsJson", "compress:makeFW", "shell:unzipFW" ] );
};

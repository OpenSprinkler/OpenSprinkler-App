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
					src: [ "**/*", "!UI.zip" ],
					cwd: "build/firmware/",
					expand: true
				} ]
			}
		},

		shell: {
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
		const scripts = grunt.file.expand({ cwd: "www/js/modules" }, "*.js").sort();
		grunt.file.write("build/modules.json", JSON.stringify(scripts, null, 2));
	} );

	grunt.registerTask( "stageFirmware", function() {
		const output = "build/firmware/";
		const files = grunt.file.expand({ cwd: "www", filter: "isFile" }, [
			"css/**", "js/**/*.js", "vendor-js/*.js", "img/**", "locale/*.js", "*.html", "manifest.json", "sw.js"
		]);
		const resources = grunt.file.expand({ filter: "isFile" }, "res/ios-web/**");

		// Remove obsolete assets when a build is repeated locally.
		grunt.file.delete(output);
		files.forEach(file => grunt.file.copy("www/" + file, output + file));
		resources.forEach(file => grunt.file.copy(file, output + file));
		grunt.file.copy("build/modules.json", output + "modules.json");

		// Hash paths and contents so every dependent asset belongs to one build,
		// including rebuilds that keep the same application version.
		const assets = files.concat(resources, "modules.json").sort();
		const hash = require("crypto").createHash("sha256");
		assets.forEach(file => {
			hash.update(file + "\0");
			hash.update(grunt.file.read(output + file, { encoding: null }));
			hash.update("\0");
		});
		const assetPath = "assets/" + hash.digest("hex").slice(0, 20) + "/";
		assets.forEach(file => grunt.file.copy(output + file, output + assetPath + file));

		// Keep the firmware's stable entry URL and legacy files for older loaders.
		const loader = grunt.file.read(output + "js/home.js");
		const marker = 'var assetPath = "";';
		if (!loader.includes(marker)) {
			grunt.fail.fatal("The firmware loader is missing its asset path marker.");
		}
		grunt.file.write(output + "js/home.js", loader.replace(marker, 'var assetPath = "' + assetPath + '";'));
		grunt.log.writeln("Firmware assets: " + assetPath);
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
	grunt.registerTask( "prepareFW", [ "generateScriptsJson", "stageFirmware", "compress:makeFW" ] );
};

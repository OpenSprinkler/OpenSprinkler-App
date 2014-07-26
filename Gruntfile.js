module.exports = function(grunt) {

  // Load node-modules;
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-text-replace');

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
    	src: ["js/main.js"]
    },
    replace: {
      index: {
        src: ['index.html'],
        overwrite: true,
        replacements: [{
          from: /<p>Version: [\d|\.]+<\/p>/g,
          to: "<p>Version: <%= pkg.version %></p>"
        }]
      },
      phonegap: {
        src: ['config.xml'],
        overwrite: true,
        replacements: [{
          from: /version     = "[\d|\.]+"/g,
          to: "version     = \"<%= pkg.version %>\""
        },{
          from: /versionCode = "(\d+)"/g,
          to: function(matchedWord, index, fullText, regexMatches) {
            return "versionCode = \""+(parseInt(regexMatches[0])+1)+"\"";
          }
        }]
      },
      manifests: {
        src: ['manifest.json','manifest.webapp'],
        overwrite: true,
        replacements: [{
          from: /"version": "[\d|\.]+"/g,
          to: "\"version\": \"<%= pkg.version %>\""
        }]
      }
    }
  });

  // Default task(s).
  grunt.registerTask('default',['jshint']);

};

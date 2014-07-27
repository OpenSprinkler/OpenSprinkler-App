module.exports = function(grunt) {

  // Load node-modules;
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-text-replace');
  grunt.loadNpmTasks('grunt-shell');

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    secrets: grunt.file.readJSON('.secrets.json'),
    jshint: {
    	main: ["<%= pkg.main %>"]
    },
    shell: {
      updateLang: {
          command: "tasks/updatelang.sh <%= secrets.getLocalization.username %> <%= secrets.getLocalization.password %>",
          stdout: false
      },
      chrome: {
          command: "tasks/chrome.sh",
          stdout: false
      },
      firefox: {
          command: "tasks/firefox.sh",
          stdout: false,
          stderr: false
      },
      blackberry10: {
          command: "tasks/blackberry10.sh",
          stdout: false
      }
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
  grunt.registerTask('updateLang',['shell:updateLang']);
  grunt.registerTask('build',['updateLang','jshint','shell:firefox','shell:chrome','shell:blackberry10']);

};

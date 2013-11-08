module.exports = function(grunt){
  
	grunt.initConfig({
	  pkg: grunt.file.readJSON('package.json'),
    jsduck: {
      main: {
        // source paths with your code
        src: ['./lib'],

        // docs output dir
        dest: './documentation/manual',

        // extra options
        options: {
          'title': 'Daemon Manager',
          //'welcome': 'src/assets/html/welcome.html',
          //'head-html': '<link rel="stylesheet" href="resources/css/ngn.css" type="text/css">',
          //'categories': 'documentation/source/categories.json',
          'guides': 'documentation/source/guides.json',
          //'tags': 'custom',
          'color': true,
          'builtin-classes': false,
          //'comments-url':'http://comments.nodengn.com:81/auth',
          //'comments-domain':'ngn/0.0.8',
          'warnings': ['-req_after_opt'],
          'external': ['XMLHttpRequest','node']
        }
      }
    },
    uglify: {
      options: {
        banner: '/**\n * <%= pkg.name %> v<%= pkg.version %>\n * Author: <%= pkg.author%>\n * Built on <%= grunt.template.today("mm-dd-yyyy") %>\n * Copyright (c) <%= grunt.template.today("yyyy") %>, ThinkFirst, LLC. All Rights Reserved.\n * http://author.io\n */\n'
      },
      ui: {
        files: {
          'dist/ui/<%= pkg.name %>.js': ['dist/ui/<%= pkg.name %>-src.js']
        }
      },
      node: {
        files: {
          'dist/node/<%= pkg.name %>.js': ['dist/node/<%= pkg.name %>-src.js']
        }
      }
    },
    clean: {
      ui: ['dist/ui/<%= pkg.name %>-src.js'],
      node: ['dist/node/<%= pkg.name %>-src.js']
    }
  });
  
  grunt.registerTask('help','Help for running grunt tasks.',function(){
    console.log('\n\nThe following commands are available:\n');
    console.log(' doc      : Generate the API documentation.');
  });
  
  grunt.loadNpmTasks('grunt-jsduck');
  grunt.registerTask('doc', ['jsduck']);
  grunt.registerTask('default', ['help']);
};
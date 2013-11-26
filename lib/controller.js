var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  fork = require('child_process').fork,
	path = require('path');

/**
 * @class manager.Controller
 * The controller is a wrapper around any node.js process that adds standard and fine-grained control
 * over how it runs as a background service.
 *
 * ## Fine Grained Controls
 *
 * The controller provides several features for managing a process, handling restarts, communicating
 * with the Node.js process.
 * @singleton
 */
var controller = function(config){

  config = config || {};

  Object.defineProperties(this,{

    /**
     * @cfg {Object} env
     * A key/value object consisting of environment variables that should be
     * passed to the #script.
     */
    env: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: config.env || {}
    },

    /**
     * @cfg {Number} [maxWaitTimeInterval=60]
     * The maximum amount of time (in seconds) to track restarts. If the
     * process restarts too many times during this interval, the process
     * will be shut down. Determining "how many restarts is too many" is
     * defined in #maxRestarts.
     * @private
     */
    maxWaitTimeInterval: {
      enumerable: false,
      writable: true,
      configurable: false,
      value: config.maxWaitTimeInterval || 60
    },

    /**
     * @cfg {Number} [maxRestarts=5]
     * The maximum number of times the process should be restarted within a
     * a specific timeframe (#maxWaitTimeInterval) before shutting down.
     * in #max.
     */
    maxRestarts: {
      enumerable: true,
      writable: true,
      configurable: false,
      value: config.maxRetarts || 5
    },

    /**
     * @cfg {Number} [maxRetries=-1]
     * The maximum number of times the process will be auto-restarted
     * before throwing an error. `-1` indicates infinite retries.
     */
    maxRetries: {
      enumerable: true,
      writable: true,
      configurable: false,
      value: config.maxRetries || -1
    },

    /**
     * @cfg {Number} [wait=1]
     * The number of seconds between each restart attempt.
     */
    wait: {
      enumerable: true,
      writable: true,
      configurable: false,
      value: config.wait || 1
    },

    /**
     * @cfg {Number} [grow=.25]
     * A percentage growth rate at which the #wait time is increased.
     * This must be a over zero. This is a decimal value, so `.25` is `25%`
     * and `1.5` is `150%` The growth rate is used
     * to prevent bad processes from restarting too rapidly. If
     * a process fails, it will wait before restarting. If it rapidly fails,
     * the wait interval will be increased by this percentage.
     *
     * Using the defaults, if the wait is `1` second on the first failure, the
     * process will wait one second before restarting, then it will increase
     * the wait time by 25%, to 1.25 seconds. The second time the process fails,
     * the process will wait 1.25 seconds before restarting again. The wait time
     * will then be increased by 25% to 1.56 seconds and so on.
     *
     * If #wait is `1` and #grow is `.25`, you can expect the following restart schedule:
     *
     * - Failure 1, wait 1 second before restart.
     * - Failure 2, wait 1.25 seconds before restart. (1 x 1.25)
     * - Failure 3, wait 1.56 seconds before restart. (1.25 x 1.25)
     * - Failure 4, wait 1.95 seconds before restart. (1.56 x 1.25)
     * - Failure 5, wait 2.44 seconds before restart. (1.95 x 1.25)
     *
     * If the process remains running for more than 5 minutes, the growth
     * rate will be automatically reset.
     *
     * Setting this to 0 will immediately attempt to restart the process after
     * a failure.
     **/
    grow: {
      enumerable: true,
      writable: true,
      configurable: false,
      value: config.wait || .25
    },

    /**
     * @cfg {Boolean} [abortOnError=false]
     * Set to `true` to **not** attempt to restart the process when it fails with an error.
     */
    abortOnError: {
      enumerable: true,
      writable: true,
      configurable: false,
      value: config.hasOwnProperty('abortOnError') === true ? config.abortOnError : false
    },

    /**
     * @property {Number} starts
     * The number of successful starts.
     * @private
     * @readonly
     */
    starts: {
      enumerable: false,
      writable: true,
      configurable: false,
      value: 0
    },

    /**
     * @property {Number} attempts
     * The number of start attempts.
     * @private
     * @readonly
     */
    attempts: {
      enumerable: false,
      writable: true,
      configurable: false,
      value: 0
    },

    /**
     * @property {process} child
     * The child process spawned by the wrapper.
     * @private
     * @readonly
     */
    child: {
      enumerable: false,
      writable: true,
      configurable: false,
      value: null
    },

    /**
     * @property {Boolean} forcekill
     * @private
     * @readonly
     */
    forcekill: {
      enumerable: false,
      writable: true,
      configurable: false,
      value: false
    },

    /**
     * @property {Date/Time} startTime
     * The time when the process was started.
     * @private
     * @readonly
     */
    startTime: {
      enumerable: false,
      writable: true,
      configurable: false,
      value: null
    },

    /**
     * @cfg {String} script (required)
     * The absolute path of the node script to execute as a process.
     */
    script: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: config.script
    },

    /**
     * @property {String} scriptname
     * The script name (no path)
     * @private
     */
    scriptname: {
      enumerable: false,
      get: function(){
        return require('path').basename(this.script);
      }
    },

    /**
     * @cfg {Object} syslog
     * The system log (event log) object. By default, this
     * uses `console`, i.e. `console.log`, `console.info`, etc.
     * This can be be overridden with an object containing functions
     * that work like the `console` object.
     * @param {Any} data
     * The data to be logged.
     */
    syslog: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: config.syslog || console
    },

    /**
     * @cfg {Object} errlog
     * The error log object. Uses #syslog if this is not specified.
     */
    errlog: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: config.errlog || config.syslog || console
    },
		
		/**
		 * @cfg {Boolean} [restartOnScriptChange=false]
		 * Automatically restart the process when the #script is modified.
		 */
		restartOnScriptChange:{
			enumerable: true,
			writable: false,
			configurable: false,
			value: config.hasOwnProperty('restartOnScriptChange') ? config.restartOnScriptChange : false
		},
		
		enableMonitoring: {
			enumerable: false,
			writable: true,
			configurable: false,
			value: true
		
		}

    /**
     * @property {Number} port
     * The port where the socket connection is established. This is only
     * available after the socket connection has been created. Use the
     * #ready event to determine when the socket is established.
     */

    /**
     * @property {Object} socket
     * The socket server used to communicate with the controller.
     * @private
     */

  });

  // Disallow negative wait times.
  this.wait = this.wait < 0 ? 0 : this.wait;
  this.maxWaitTimeInterval = this.maxWaitTimeInterval < 0 ? 0 : this.maxWaitTimeInterval;
  this.maxRestarts = this.maxRestarts < 0 ? 0 : this.maxRestarts;
  this.grow = this.grow < 0 ? 0 : this.grow;
	
	// Increase event listener limit
	this.setMaxListeners(25);

	// Add Methods
  Object.defineProperties(this,{

    /**
     * @method monitor
     * Monitor the process to make sure it is running.
     * @private
     * @fires toomanyrestarts
     */
    monitor: {
      enumerable: false,
      writable: false,
      configurable: false,
      value: function(){
				
				if (!this.enableMonitoring){
					return;
				}

        var me = this;
        if(!this.child.pid){

          // If the number of periodic starts exceeds the max, kill the process
          if (this.starts >= this.maxRestarts){
            if (new Date().getTime()-(this.maxWaitTimeInterval*1000) <= this.startTime.getTime()){
              this.errlog.error('Too many restarts within the last '+this.maxWaitTimeInterval+' seconds. Please check the script.');

              /**
               * @event toomanyrestarts
               * Fired when the process restarts too many times within the
               * maximum alotted waiting period.
               * @param {String} script
               * Returns the path to the script.
               */
              this.emit('toomanyrestarts',this.script);

              process.exit();
            }
          }

          setTimeout(function(){
            me.wait = me.wait * me.grow;
            me.attempts += 1;
            if (me.attempts > me.maxRetries && me.maxRetries >= 0){
              me.errlog.error('Too many restarts. '+me.script+' will not be restarted because the maximum number of total restarts has been exceeded.');
              me.emit('toomanyrestarts',me.script);
              process.exit();
            } else {
              me.launch();
            }
          },me.wait);
        } else {
          me.attempts = 0;
          me.wait = this.wait * 1000;
        }
      }
    },

    /**
     * @method launch
     * Start the process.
     * @fires starting
     * @fires ready
     * @fires socketerror
     * @fires sockettimeout
     * @fires socketclosed
     * @fires socketconnect
     * @fires stdout
     * @fires stderr
     */
    launch:{
      enumerable: true,
      writable: false,
      configurable: false,
      value: function(){

        if (this.forcekill){
          return;
        }

        var me = this;

        // Create the socket server on the first launch.
        if (this.socket === undefined){

          var socket = require('net').createServer();

          socket.on('listening',function(){
            if (!me.hasOwnProperty('port')){

              // Create the port property
              Object.defineProperty(me,'port',{
                enumerable: true,
                writable: true,
                configurable: true,
                value: parseInt(socket.address().port)
              });

              /**
               * @event ready
               * Fired when the socket channel is established and listening.
               * @param {String} script
               * The absolute path of the script that the socket is used to communicate with.
               */
              me.emit('ready',me.script);
              me.syslog.info('Socket communcation established on port '+me.port.toString()+'.');
            }
          });

          socket.on('error',function(err){
            /**
             * @event socketerror
             * Fired when a socket error occurs.
             * @param {Error} error
             * The error sent from the socket.
             */
            me.emit('socketerror',err);
            me.errlog.error(err.message);
          });

          socket.on('close',function(){
            /**
             * @event socketclosed
             * Fired when the socket connection is closed.
             * @param {Number} port
             * The port of the socket that closed.
             */
            me.emit('socketclosed',me.port);
            me.syslog.info('Socket communication closed on port '+me.port.toString()+'.');
          });

          socket.on('timeout',function(){
            /**
             * @event sockettimeout
             * Fired when a socket timeout is detected.
             * @param {Number} port
             * The port of the socket that closed.
             */
            me.emit('timeout',me.port);
            me.errlog.info('Socket connection timed out on port '+me.port.toString()+'.');
          });

          socket.on('connect',function(client){
            /**
             * @event socketconnect
             * Fired when a client establishes a communication link via the socket.
             * @param {Object} client
             * The client object representing the client that connected to the socket.
             */
            me.emit('socketconnect',client);
            me.syslog.info('Client connected via socket on port '+me.port.toString());
          });

          Object.defineProperty(this,'socket',{
            enumerable: false,
            get: function(){
              return socket;
            }
          });

          this.socket.listen();

        }

        this.syslog.info('Starting '+this.script);

        /**
         * @event starting
         * Fired when the process begins the process of launching.
         * **This does not mean the process is ready yet.** It is
         * only an indicator that the process has attempted to start.
         */
        this.emit('starting',this.script);

        // Set the start time if it's null
        if (this.startTime == null) {
          this.startTime = this.startTime || new Date();
          setTimeout(function(){
            me.startTime = null;
            me.starts = 0;
          },(me.maxWaitTimeInterval * 1000)+1);
        }
        this.starts += 1;

        // Add or override the environment variables
        Object.keys(this.env).forEach(function(attr){
          process.env[attr] = me.env[attr];
        });
				
        // Fork the child process
        this.child = fork(this.script,[],{
          env:process.env,
          silent: true,
          cwd: this.script.replace(require('path').basename(this.script),'')
        });

				// If enabled, watch for file changes on the script
				if (this.restartOnScriptChange && !this.watching){
					var watch = require('watch');
					watch.createMonitor(path.dirname(path.resolve(this.script)),function(watcher){
						watcher.files = [path.resolve(me.script)];
						watcher.on("changed", function (filename, curr, prev) {
							me.syslog.info('The script was modified. Automatically restarting the process.');
							me.child.kill();
						});
						watcher.on("removed", function (filename, stat) {
							me.errlog.error(me.script+' was removed. the file can no longer run as a background daemon/service.');
							me.enableMonitoring = false;
							me.killChildProcess();
						});
					});
				}

        /**
         * @event start
         * Fired when the child process is started.
         * @param {Number} pid
         * The process ID of the child. `null` if the process could not be
         * started or there was an error.
         */
        this.emit('start',(this.child.pid||null));

        /**
         * @event message
         * Fired when the child process sends the controller a message.
         * @param {Object} data
         * The data of the message.
         */
        this.child.on('message',function(data){
          me.emit('message',data);
        });

        // Redirect process output (stdout) to the log
        this.child.stdout.on('data',function(data){
          /**
           * @event stdout
           * Fired when the process outputs something to stdout.
           * @param {Object} data
           * The data sent to stdout.
           */
          me.emit('stdout',data.toString());
          me.syslog.log(data.toString());
        });

        // Redirect process output (stderr) to the log
        this.child.stderr.on('data',function(data){
          /**
           * @event stderr
           * Fired when the process outputs something to stderr.
           * @param {Object} data
           * The data sent to stderr.
           */
          me.emit('stderr',data.toString());
          me.errlog.error(data.toString());
        });

        // Setup an event listener on the controller that relays when
        // the child process receives a message.
				/**
				 * @event childmessage
				 * Fired when the #script sends a message to the controller.
				 */
        this.child.on('message',function(msg){
          me.emit('childmessage',msg);
        });

        // When the child dies, attempt to restart based on configuration
        this.child.on('exit',function(code,signal){
          /**
           * @event exit
           * Fired when the process exits.
           * @param {String} script
           * The script that exited.
           */
          me.emit('exit',me.script);
          me.syslog.info(me.scriptname+' stopped running (code: '+code+', signal: '+signal+').');

          // If an error is thrown and the process is configured to exit, then kill the parent.
          if (code !== 0 && me.abortOnError == true){
            me.errlog.error(me.scriptname+' exited with error code '+code);
            /**
             * @event aborted
             * Fired when the process exits with an error and the restart is aborted.
             * This requires #abortOnError be set to `true`.
             * @param {String} script
             * The script that exited.
             */
            me.emit('aborted',me.script);
            process.exit();
          }

          me.child.pid = null;

          // Monitor the process
          me.monitor();
        });
      }
    },

    /**
     * @method sendMessage
     * Send a message to the #script. The script can listen for this
     * via the process, i.e.
     *
     *     process.on('message',function(msg){
     *       console.log(msg);
     *     });
     * @param {Object} message
     * The payload/message to be sent to the node script. This can
     * be a string, JSON/Object, number, date, etc.
     * @fires message
     */
    sendMessage: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: function(msg){
        this.child.send(msg);
      }
    },

    /**
     * @method killChildProcess
     * Kill the child process.
     * @private
     */
    killChildProcess: {
      enumerable: false,
      writable: false,
      configurable: false,
      value: function(){
        var me = this;
        this.forcekill = true;

        // Log the forced shutdown
        if (this.child){
          this.child.on('close',function(code,signal){
            me.syslog.info('Process forcibly closed with code '+(code||'-').toString()+', using '+signal+' signal.');
          });

          this.child.kill();
        }

        try {
          this.socket.close();
        } catch(e) {
          this.errlog.error(e.message);
        }
        /*if (child.pid) {
          require('child_process').exec('taskkill /F /PID '+child.pid,function(){
            process.exit(0);
          });
        }*/
      }
    }
  });
};

// Inherit Events
util.inherits(controller,EventEmitter);

module.exports = controller;
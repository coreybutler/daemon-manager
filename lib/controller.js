var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  fork = require('child_process').fork,
  socket = null;

/**
 * @class controller
 * The wrapper is used to provide standard and fine-grained control
 * over the node process.
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
     * - Failure 1,  wait 1 second before restart.
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
      value: config.wait || 1
    },
    
    /**
     * @cfg {Boolean} [abortOnError=false]
     * Set to `true` to **not** attempt to restart the process when it fails with an error. 
     */
    abortOnError: {
      enumerable: true,
      writable: true,
      configurable: false,
      value: config.abortOnError instanceof Boolean ? config.abortOnError : false
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
     * @cfg {String} syslog
     * The system log (event long). 
     */
    syslog: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: config.syslog || null
    },
    
    /**
     * @cfg {String} errlog
     * The error log. Uses #syslog if this is not specified. 
     */
    errlog: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: config.errlog || config.syslog || null
    },
    
    /**
     * @property {Number} port
     * The port where the socket listener is running. This will be `null`
     * until the process is launched.
     * @private
     */
    port: {
      enumerable: false,
      writeable: true,
      configurable: false,
      value: null
    }
    
  });

  // Disallow negative wait times.  
  this.wait = this.wait < 0 ? 0 : this.wait;
  this.maxWaitTimeInterval = this.maxWaitTimeInterval < 0 ? 0 : this.maxWaitTimeInterval;
  this.maxRestarts = this.maxRestarts < 0 ? 0 : this.maxRestarts;
  this.grow = this.grow < 0 ? 0 : this.grow;
  
  // Optionally override console.log/error/warn?
  
  // Emit events on different actions
  
  // Add Methods
  Object.defineProperties(this,{
    
    /**
     * @method monitor
     * Monitor the process to make sure it is running.
     * @private
     */
    monitor: {
      enumerable: false,
      writable: false,
      configurable: false,
      value: function(){
        var me = this;
        if(!this.child.pid){
      
          // If the number of periodic starts exceeds the max, kill the process
          if (this.starts >= this.maxRestarts){
            if (new Date().getTime()-(max*1000) <= this.startTime.getTime()){
              //log.error('Too many restarts within the last '+max+' seconds. Please check the script.');
              process.exit();
            }
          }
      
          setTimeout(function(){
            me.wait = me.wait * me.grow;
            me.attempts += 1;
            if (me.attempts > me.maxRetries && me.maxRetries >= 0){
              //log.error('Too many restarts. '+argv.f+' will not be restarted because the maximum number of total restarts has been exceeded.');
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
        if (socket == null){
          socket = require('net').createServer();
          
          socket.on('listening',function(){
            me.port = socket.address().port;
            me.emit('ready');
          });

          // Listen on a random socket port
          socket.listen(0, '0.0.0.0');
        }
              
        //log.info('Starting '+argv.f);
      
        // Set the start time if it's null
        if (this.startTime == null) {
          this.startTime = this.startTime || new Date();
          setTimeout(function(){
            me.startTime = null;
            me.starts = 0;
          },(me.maxWaitTimeInterval * 1000)+1);
        }
        this.starts += 1;
      
        // Fork the child process
        this.child = fork(this.script,{env:process.env});
      
        // When the child dies, attempt to restart based on configuration
        this.child.on('exit',function(code){
          //log.warn(argv.f+' stopped running.');
      
          // If an error is thrown and the process is configured to exit, then kill the parent.
          if (code !== 0 && argv.a == "yes"){
            //log.error(argv.f+' exited with error code '+code);
            process.exit();
            //server.unref();
          }
      
          // Monitor the process
          me.monitor();
        });
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
        this.forcekill = true;
        this.child.kill();
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
/**
 * @class manager.Daemon
 * Represents a bacckground service.
 */
var Class = require('./class'),
		util = require('util'),
  	EventEmitter = require('events').EventEmitter;

var daemon = Class.extend({
	
	constructor: function(config){
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
			 * @cfg {String} workingDirectory
			 * The current working directory/context in which the script will run.
			 * This is useful for processes leveraging local paths.
			 */
			workingDirectory: {
				enumerable: true,
				writable: false,
				configurable: false,
				value: config.workingDirectory || null
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
			
			},
			
			/**
			 * @cfg {Function} onSocketData
			 * This function is called when the built in socket server receives data.
			 * @param {Object} onSocketData.data
			 * The data received by the socket server
			 * @param {manager.Controller} self
			 * The instance of the controller.
			 */
			onSocketData: {
				enumerable: true,
				writable: false,
				configurable: false,
				value: config.onSocketData || undefined
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
		
		this.setMaxListeners(25);
			
	}
	
});

// Inherit Events
util.inherits(daemon,EventEmitter);

module.exports = daemon;
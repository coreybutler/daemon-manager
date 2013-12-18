var Daemon = require('./daemon'),
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
var controller = Daemon.extend({
	
	constructor: function(config){
		config = config || {};
		controller.super.constructor.call(this,config);
	
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
						
						// Enable external socket communications if configured.
						if (me.onSocketData !== undefined){
							socket.on('data',function(data){
								/**
								 * @event socketdata
								 * Fired when the socket receives data. This can only be fired if #onSocketData is defined.
								 * @param {Object} data
								 * The raw data sent to the socket server.
								 */
								me.emit('socketdata',data);
								me.onSocketData(data,me);
							});
						}
	
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
								return socket || {
									close: function(){
										console.log('Socket closed successfully');
									}
								};
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
						cwd: this.workingDirectory || this.script.replace(require('path').basename(this.script),'')
					});
	
					// If enabled, watch for file changes on the script
					if (this.restartOnScriptChange && !this.watching){
						var watch = require('watch');
						watch.createMonitor(path.dirname(path.resolve(this.script)),function(watcher){
							watcher.files = [path.resolve(me.script)];
							watcher.on("changed", function (filename, curr, prev) {
								/**
								 * @event scriptchanged
								 * Fired when the script is changed on the file system.
								 */
								me.emit('scriptchanged');
								me.syslog.info('The script was modified. Automatically restarting the process.');
								me.child.kill();
							});
							watcher.on("removed", function (filename, stat) {
								/**
								 * @event scriptdeleted
								 * Fired when the running script is removed from the file system (or moved to an unrecognized location).
								 */
								me.emit('scriptdeleted');
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
						if (typeof msg === 'string'){
							switch(msg.trim()){
								case 'STOP':
									me.syslog.info('Script stopped itself by sending a STOP event to the controller.');
									me.enableMonitoring = false;
									me.killChildProcess();
									process.exit();
									return;
								case 'START':
									me.syslog.info('Script started itself by sending a START event to the controller.');
									me.launch();
									return;
								case 'RESTART':
									me.syslog.info('Script restarted itself by sending a RESTART event to the controller.');
									me.enableMonitoring = false;
									me.child.kill();
									me.enableMonitoring = true;
									me.launch();
									return;
							}
						}
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
			
			killSocketServer: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: function(callback){
					try {
						this.socket.close();
					} catch(e) {
						if (this.socket){
							this.errlog.error(e.message);
							delete this.socket;
						}
					}
					callback();
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
							me.syslog.info('Process forcibly closed with code '+(code||'-').toString()+(signal !== null ? ', using '+signal+' signal.':''));
							me.killSocketServer(function(){
								process.exit(0);
							});
						});
	
						this.child.kill();
					} else {
						process.exit(0);
					}
				}
			}
		});
	}
});

module.exports = controller;
/**
 * @class manager.Installer
 * Provides an extendable daemon shell for installing a backgrounf service. This should
 * be overridden as appropriate on a per-operating-system basis.
 * @private
 */
var Daemon = require('./daemon');

var installer = Daemon.extend({
	
	constructor: function(config){
		config = config || {};
		
		installer.super.constructor.call(this,config);
		
		Object.defineProperties(this,{
			/**
			 * @cfg {String} name
			 * The name of the background service.
			 */
			name: {
				enumerable: false,
				writable: true,
				configurable: false,
				value: config.name || null
			},
			
			/**
			 * @property {String} id
			 * The ID of the daemon.
			 * @readonly
			 */
			id: {
				enumerable: true,
				get: function(){
					return this.name.replace(/[^\w]/gi,'').toLowerCase();
				}
			},
	
			/**
			 * @cfg {String} description
			 * A description of the daemon.
			 */
			description: {
				enumerable: true,
				writable: false,
				configurable: false,
				value: config.description || ''
			},
			
			/**
			 * @property {Object} [user]
			 * If you need to specify a specific user or particular credentials to manage a service, the following
			 * attributes may be helpful.
			 *
			 * The `user` attribute is an object with three keys: `domain`,`account`, and `password`.
			 * This can be used to identify which user the service library should use to perform system commands.
			 * By default, the domain is set to the local computer name, but it can be overridden with an Active Directory
			 * or LDAP domain. For example:
			 *
			 * **app.js**
			 *
			 *     var Service = require('node-windows').Service;
			 *
			 *     // Create a new service object
			 *     var svc = new Service({
			 *       name:'Hello World',
			 *       script: require('path').join(__dirname,'helloworld.js')
			 *     });
			 *
			 *     svc.user.domain = 'mydomain.local';
			 *     svc.user.account = 'username';
			 *     svc.user.password = 'password';
			 *     ...
			 *
			 * Both the account and password must be explicitly defined if you want the service module to
			 * run commands as a specific user. By default, it will run using the user account that launched
			 * the process (i.e. who launched `node app.js`).
			 */
			user: {
				enumerable: false,
				writable: true,
				configurable: false,
				value: {
					account: null,
					password: null,
					domain: process.env.COMPUTERNAME || null
				}
			},
			
			/**
			 * @cfg {String} sudoPassword
			 * Optionally provide a sudo password.
			 */
			sudo: {
				enumerable:false,
				writable: true,
				configurable: false,
				value: {
					password:config.sudoPassword || null
				}
			},
			
			/**
			 * @property {Boolean} exists
			 * Determine whether the service exists.
			 * @readonly
			 */
			exists:{
				enumerable: true,
				get: function(){
					return this._exists();
				}
			},
			
			_exists: {
				enumerable: false,
				writable: true,
				value: function(){
					throw new Error('The exists attribute must be overwritten.');
				}
			},
			
			
			/**
			 * @method install
			 * Install the script as a process.
			 * @param {String} [dir=root of script]
			 * The directory where the process files will be saved. Defaults to #script path.
			 * @param {Function} [callback]
			 * The callback to fire when the installation completes.
			 */
			/**
			 * @event install
			 * Fired when the installation process is complete.
			 */
			/**
			 * @event alreadyinstalled
			 * Fired if the script is already known to be a service.
			 */
			/**
			 * @event invalidinstallation
			 * Fired if an installation is detected but missing required files.
			 */
			/**
			 * @event error
			 * Fired in some instances when an error occurs.
			 */
			install: {
				enumerable: true,
				writable: true,
				configurable: false,
				value: function(dir){
					this.emit('install');
				}
			},
	
			/**
			 * @method uninstall
			 * Uninstall the service.
			 *
			 *      var Service = require('node-windows').Service;
			 *
			 *      // Create a new service object
			 *      var svc = new Service({
			 *        name:'Hello World',
			 *        script: require('path').join(__dirname,'helloworld.js')
			 *      });
			 *
			 *      // Listen for the "uninstall" event so we know when it's done.
			 *      svc.on('uninstall',function(){
			 *        console.log('Uninstall complete.');
			 *        console.log('The service exists: ',svc.exists);
			 *      });
			 *
			 *      // Uninstall the service.
			 *      svc.uninstall();
			 */
			/**
			 * @event uninstall
			 * Fired when the uninstall is complete.
			 */
			uninstall: {
				enumerable: true,
				writable: true,
				value: function(){
					this.emit('uninstall');
				}
			},
	
			/**
			 * @method start
			 * Start an existing method.
			 */
			/**
			 * @event start
			 * Fired when the event has started.
			 */
			start: {
				enumerable: true,
				writable: true,
				configurable: false,
				value: function(){
					this.emit('start');
				}
			},
	
			/**
			 * @method stop
			 * Stop the service.
			 */
			/**
			 * @event stop
			 * Fired when the service is stopped.
			 */
			stop: {
				enumerable: true,
				writable: true,
				value: function(){
				 this.emit('stop');
				}
			},
	
			/**
			 * @method restart
			 * Restart an existing service
			 */
			restart: {
				enumerable: true,
				writable: true,
				value: function(callback){
					var me = this;
					this.once('stop',me.start);
					this.stop();
				}
			}
	
		});
	}
});

// Add event support
var util = require('util'),
  EventEmitter = require('events').EventEmitter;

// Inherit Events
util.inherits(installer,EventEmitter);

module.exports = installer;
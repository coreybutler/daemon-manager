/**
 * @class manager.Logger
 * A generic logger that can be extended.
 */
var Class = require('./class');
var logger = Class.extend({
	
	constructor: function(config){
	
		var me = this;
		
		config = config || {};
		
		Object.defineProperties(this,{
			
			/**
			 * @cfg {Boolean} [stripColors=true]
			 * Strip any color console markup that may be in log messages.
			 */
			stripColors: {
				enumerable: true,
				writable: true,
				configurable: false,
				value: config.hasOwnProperty('stripColors') ? config.stripColors : true
			},
			
			stripMessageColors: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: function(msg){
					return msg.replace(/\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g, '');
				}
			},
			
			stripArgColors: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: function(args){
					if (!this.stripColors){
						return args;
					}
					for (var arg in args){
						if (typeof args[arg] === 'string'){
							args[arg] = this.stripMessageColors(args[arg]);
						}
					}
					return args;
				}
			},
			
			replaceData: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: function(txt){
					if (typeof txt !== 'string'){
						return txt;
					}
					var vars = Object.keys(this.findReplace),me=this;
					if (vars.length == 0){
						return txt;
					}
					vars.filter(function(el){
						return txt.indexOf(el) >= 0;
					}).forEach(function(el){
						txt = txt.replace(el,me.findReplace[el](txt));
					});
					return txt;
				}
			},
			
			processPrePostfix: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: function(args,fn){
					for (var arg in args){
						if (typeof args[arg] === 'string'){
							if (this['pre'+fn] !== null){
								args[arg] = this['pre'+fn] + args[arg];
							}
							if (this['post'+fn] !== null){
								args[arg] = args[arg] + this['post'+fn];
							}
							args[arg] = this.replaceData(args[arg]);
						}
					}
					return args;
				}
			},
			
			/**
			 * @cfg {Object} findReplace
			 * A key/value object of variables and functions used to replace the values.
			 * For example,to replace the text [DATE] in a message, the following object would be used:
			 * 
			 *     {
			 *       '[DATE]': function(msg){
			 *         return (new Date()).toString();
			 *       }
			 *     }
			 * 
			 * The object above will replace every instance of `[DATE]` within a log message with the current date.
			 * The `msg` attribute passed to the method is the log message itself.
			 */
			findReplace: {
				enumerable: true,
				writable: true,
				configurable: false,
				value: config.findReplace || {
					'[DATE]': function(msg){
						return (new Date()).toLocaleString();
					}
				}
			},
			
			/**
			 * @cfg {Function} info
			 * Override the info method.
			 * Takes the same parameters as console.info
			 */
			/**
			 * @method info
			 * Log information.
			 * @param {String[]} msg
			 * The message(s) to be logged as information.
			 */
			_info: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: config.info || console.info
			},
			
			/**
			 * @cfg {Function} log
			 * Override the log method.
			 * Takes the same parameters as console.log
			 */
			/**
			 * @method log
			 * General log.
			 * @param {String[]} msg
			 * The message(s) to be logged.
			 */
			_log: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: config.log || console.log
			},
			
			/**
			 * @cfg {Function} warn
			 * Override the warn method.
			 * Takes the same parameters as console.warn
			 */
			/**
			 * @method warn
			 * Log information.
			 * @param {String[]} msg
			 * The message(s) to be logged as a warning.
			 */
			_warn: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: config.warn || console.warn
			},
			
			/**
			 * @cfg {Function} error
			 * Override the error method.
			 * Takes the same parameters as console.error
			 */
			/**
			 * @method error
			 * Log error detail.
			 * @param {String[]} msg
			 * The message(s) to be logged as an error.
			 */
			_error: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: config.error || console.error
			},
			
			/**
			 * @cfg {Function} trace
			 * Override the trace method.
			 * Takes the same parameters as console.trace
			 */
			/**
			 * @method trace
			 * Print a stack trace to stderr of the current position
			 */
			trace: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: config.trace || console.trace
			},
			
			/**
			 * @cfg {Function} time
			 * Override the time method.
			 * Takes the same parameters as console.time
			 */
			/**
			 * @method time
			 * Time information (start). Begin timer.
			 * @param {String} label
			 * @private
			 */
			time: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: config.time || console.time
			},
			
			/**
			 * @cfg {Function} timeEnd
			 * Override the timeEnd method.
			 * Takes the same parameters as console.timeEnd
			 */
			/**
			 * @method timeEnd
			 * Time information (end). End timer.
			 * @param {String} label
			 * @private
			 */
			timeEnd: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: config.timeEnd || console.timeEnd
			},
			
			/**
			 * @cfg {Function} assert
			 * Override the assert method.
			 * Takes the same parameters as console.assert
			 */
			/**
			 * @method assert
			 * @param {Boolean} expression
			 * @param {String} message
			 * @private
			 */
			_assert: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: config.assert || console.assert
			},
			
			/**
			 * @cfg {Function} dir
			 * Override the dir method.
			 * Takes the same parameters as console.dir
			 */
			/**
			 * @method dir
			 * Inspection utility
			 * @param {Object} msg
			 * The objected to be inspected and logged.
			 */
			_dir: {
				enumerable: false,
				writable: false,
				configurable: false,
				value: config.dir || console.dir
			}
			
		});
		
		// Generate loggers with color strippper
		Object.getOwnPropertyNames(this).filter(function(el){
			return el.substr(0,1) == '_' && !me.propertyIsEnumerable(el);
		}).forEach(function(fn){
			Object.defineProperty(me,fn.replace('_',''),{
				enumerable: true,
				writable: false,
				configurable: false,
				value: function(){
					arguments = me.processPrePostfix(arguments,fn.replace('_','').substr(0,1).toUpperCase()+fn.replace('_','').substr(1,fn.length));
					arguments = me.stripArgColors(arguments);
					me[fn].apply(this,arguments);
				}
			});
			Object.defineProperty(me,'pre'+fn.replace('_','').substr(0,1).toUpperCase()+fn.replace('_','').substr(1,fn.length),{
				enumerable: true,
				writable: false,
				configurable: false,
				value: config['pre'+fn.replace('_','').substr(0,1).toUpperCase()+fn.replace('_','').substr(1,fn.length)] || null
			});
			Object.defineProperty(me,'post'+fn.replace('_','').substr(0,1).toUpperCase()+fn.replace('_','').substr(1,fn.length),{
				enumerable: true,
				writable: false,
				configurable: false,
				value: config['post'+fn.replace('_','').substr(0,1).toUpperCase()+fn.replace('_','').substr(1,fn.length)] || null
			});
		});
	}
});

module.exports = logger;
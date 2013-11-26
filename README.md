# Daemon Wrapper

This utility module was built specifically to standardize behavior across
[node-windows](http://github.com/coreybutler/node-windows), 
[node-mac](http://github.com/coreybutler/node-mac), and 
[node-linux](http://github.com/coreybutler/node-linux).

## Features

There are two main components, the Controller and the Logger. The Controller monitors and manages the node script. The logger
wraps general logging, making it easier to output to the native system and error logs.

### Controller Features

### Logger Features

**Custom Functions**

The `manager.Logger` singleton class allows developers to replace `console` methods with their own functions for:

- log()
- info()
- dir()
- warn()
- error()
- time()
- timeEnd()
- assert()

If these methods aren't overridden, the default methods from `console` will be used.

**Strip Console Colors**

The logger also has a configuration attribute called `stripColors`, which will strip any console color information from the logs.
This is useful when a script should output color-coded information to the screen during development, but not in production.

**Pre/Postfix Messages**

The logger can optionally prefix and postfix messages with static text. For example, if the `info` log should have the word `INFO: `
before each message, it can be configured like:

```javascript
	var logger = new manager.Logger({
		preInfo: 'INFO: ',
		postInfo: ' << End Info`
	});
	
	logger.info('my message');  // <--- Outputs Info: my message << End Info
```

Each method has a pre and post configuration option.

**Variable Replacement**

The logger has a unique configuration option called `findReplace`. This can be used to find and replace text in a log message. For example, the following
configuration will put the date in front of every log:

```javascript
	var logger = new manager.Logger({
		preLog: '[DATE]: ',
		findReplace: {
			'[DATE]': function(msg){
				return (new Date()).toLocaleString();
			}
		}
	});
	
	logger.log('my message'); // <-- Outputs Mon Nov 25 2013 20:35:01 GMT-0600 (Central Standard Time): my message
```

The date in the aforementioned example would of course be the current date.

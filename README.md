# Daemon Wrapper

This utility module was built specifically to standardize behavior across
[node-windows](http://github.com/coreybutler/node-windows), 
[node-mac](http://github.com/coreybutler/node-mac), and 
[node-linux](http://github.com/coreybutler/node-linux).

## Features

There are two main components, the Controller and the Logger. The Controller monitors and manages the node script. The logger
wraps general logging, making it easier to output to the native system and error logs.

### Controller Features

The `manager.Controller` singleton class optionally wraps the node script for more control of the daemon. It provides consistent process control
across operating systems, as well as a communications channel for controlling the script while the process is running.

```javascript
var manager = require('daemon-manager');

controller = new manager.Controller({
  script: '/path/to/script.js'
});

controller.on('ready',function(){
  console.log('Ready for communication on port '+controller.port.toString()+'....');
});

controller.launch();
```

The script above will launch `/path/to/script.js` as a long running process. It will be monitored, and should the process exit irregularly
or with an error, it will be restarted automatically.

**Restarting on File Change**

A new addition to the daemon manager is the ability to watch the node script for modifications. This is _disabled_ by default, but can be
enabled using the configuration attribute `restartOnScriptChange: true`. Enabling this attribute tells the monitor to watch the script for
changes. When the script is modified, the process will restart immediately. When the script is removed, the process will exit with an error
since the file is no longer accessible.

**Start, Stop, & Restart From the Script**

There are some circumstances where the node.js script should be able to trigger it's own shutdown, startup, or restart. The controller listens
for 3 simple case-sensitive messages: `START`, `STOP`, and `RESTART`. The script can trigger these actions by sending a process message, such as:

```javascript
process.send('RESTART');
```
If the code above is executed from within the node.js script, the process will restart itself.

**Send Data to the Script**

The controller API has a method called `sendMessage()`, which sends a payload to the script. For example:

_mydaemon.js_
```javascript
var manager = require('daemon-manager');

controller = new manager.Controller({
  script: '/path/to/myscript.js'
});

controller.on('ready',function(){
  controller.sendMessage({action:'start',msg:'Hello'});
});

controller.launch();
```

_myscript.js_
```javascript
process.on('message',function(data){
	if (data.action == 'start'){
		console.log('Controller said: '+data.msg);
	} else {
		console.log('Received an unrecognized action.');
	}
});
```

In this example, the daemon sends a JSON object to the script. The script should always listen for the `message` event, which will contain messages coming
from the controller. In this case, the daemon sends the message after it is ready to communicate. The script hears the message, processes the payload (data),
and outputs`Controller said: Hello`.

**Receive Data From the Script**

There are occasions where the script may need to trigger certain daemon-level functionality. If the script sends
messages to the controller, they will be emitted as an event of the controller, called `childmessage`. Listening for these events can be done via:

```javascript
controller.on('childmessage',function(msg){
	console.log(msg);
});
```

**Communicating Remotely**

The controller runs a lightweight socket server, allowing it to accept remote connections generated at any time. For example, it is possible to telnet into 
the running process or use a Node.js `net.Socket` client. The socket server runs all the time to support internal process communications, but remote communication
is disabled by default (for security purposes). If you are running in a safe environment or wish to add your own security layer, then enabling remote
communication can be safe and simple. Communication is established by configuring a `onSocketData` function. For example:

```javascript
var manager = require('daemon-manager');

controller = new manager.Controller({
  script: '/path/to/myscript.js',
	onSocketData: function(data,mycontroller){
		mycontroller.sendMessage(data);
	}
});

controller.on('ready',function(){
  console.log('Ready for remote connections on port '+controller.port.toString()+'....');
});

controller.launch();
```

The example above will create and launch a controller capable of processing remote socket communications. To setup a client, a connection would be made on
the port shown on the console (i.e. Ready for remote connectons on port ______). Any data sent (via `net.Socket` client, `telnet`, etc) to the socket on that
port will be sent to the script as a message (see Communicating With the Script).



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
	postInfo: ' << End Info'
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

var manager = require('../'), path = require('path');

controller = new manager.Controller({
  script: path.join(__dirname,'..','test','resources','app.js'),
	syslog: new manager.Logger({
		preLog: '[DATE]: '
	}),
	restartOnScriptChange: true
});

controller.on('ready',function(){
  console.log('Ready for communication on port '+controller.port.toString()+'....');
});

controller.on('starting',function(){
  console.log('Starting....');
});

controller.launch();

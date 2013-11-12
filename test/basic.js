var manager = require('../'),
  assert = require('assert'),
  path = require('path');

suite('Sanity Tests', function(){

  var controller, e = function(){}, logger = {
    info: e,
    log: e,
    warn: e,
    error: e
  };

  setup(function(){
    controller = new manager.Controller({
      script: path.join(__dirname,'resources','app.js'),
      env: {
        TEST: 'This is a test.'
      },
      syslog: logger
    });
  });
  
  teardown(function(){
    controller.removeAllListeners('ready');
    controller.killChildProcess();
  });
  
  test('Basic Initialization',function(){
    assert.ok(manager !== undefined,'The daemon manager was not loaded.');
    assert.ok(manager.Controller !== undefined,'The controller was not found.');
  });
  
  test('Startup & Shutdown',function(done){
    
    assert.ok(controller.hasOwnProperty('launch') == true,'The controller does not have the method launch().');
    
    controller.on('ready',function(){
      done();
    });
    
    controller.launch();
  });
  
  test('Auto-restart upon failure.',function(done){
    this.timeout(4000);
    
    var restartCount = 0;
    controller.on('starting',function(){
      restartCount++;
      restartCount > 1 && done();
    });
    controller.launch();
  });
  
  test('Child Communication & Environment Variables',function(done){

    this.timeout(3000);

    // When the controller receives a response from the child process,
    // we know communication works.
    controller.on('message',function(data){
      assert.ok(data == true,'The response data was invalid.');
      done();
    });
    
    // After the process starts, send it a message.
    controller.on('start',function(){
      controller.sendMessage('this is a test');
    });
    
    controller.launch();
    
  });
  
  test('Abort On Error',function(done){
    this.timeout(6000);

    controller.abortOnError = true;

    assert.ok(controller.abortOnError == true,'The abort on error flag was not retained.');
    
    controller.on('aborted',function(){
      done();
    });
    
    controller.launch();
    
  });
});